import { requireAuth } from '../lib/auth'
import {
  buildFashionMagazinePrompt,
  buildFashionNegativePrompt,
  buildRefinePrompt,
  evaluateContentPolicy,
  isStructuralRefineRevision,
  mergeFreeRevisionDescription,
  polishKoreanPromptText,
} from '../lib/content-policy'
import { FAL_WILDLIFE_TIMEOUT_MS, generateFalImage, refineFalImageToImage, refineFalInpaint, resolveFalImageSize } from '../lib/fal-client'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'
import {
  generateReplicateImage,
  refineReplicateImageToImage,
  resolveReplicateImageSize,
} from '../lib/replicate-client'
import {
  compileResponsiveFreePrompt,
  isRealWildlifeScene,
  summarizePlan,
} from '../lib/scene-compiler'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }
  REPLICATE_API_TOKEN?: string
  REPLICATE_MODEL_OWNER?: string
  REPLICATE_MODEL_NAME?: string
  REPLICATE_MODEL_VERSION?: string
  FAL_KEY?: string
  FAL_MODEL_ID?: string
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'refine', rateLimitIdentity(auth), 40, 3600)
  if (limited) return limited

  let body: {
    mode?: 'text' | 'region'
    genMode?: 'free' | 'fashion'
    imageUrl?: string
    baseDescription?: string
    revision?: string
    maskDataUrl?: string
    mood?: string
    size?: string
    regionCount?: number
  }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const mode = body.mode === 'region' ? 'region' : 'text'
  // 기본은 자유 일러스트 (화보 모드는 명시할 때만)
  const genMode = body.genMode === 'fashion' ? 'fashion' : 'free'
  const imageUrl = (body.imageUrl ?? '').trim()
  const baseDescription = polishKoreanPromptText(body.baseDescription ?? '')
  const revision = polishKoreanPromptText(body.revision ?? '')
  const attempts: Array<{ engine: string; error: string }> = []

  const urlErr = mediaUrlError(imageUrl)
  if (urlErr) return jsonResponse({ ok: false, error: urlErr }, 400)
  if (!revision) return jsonResponse({ ok: false, error: 'revision_required' }, 400)
  if (revision.length > 800) return jsonResponse({ ok: false, error: 'revision_too_long' }, 400)
  if (baseDescription.length > 1200) return jsonResponse({ ok: false, error: 'description_too_long' }, 400)

  const policyVerdict = evaluateContentPolicy(`${baseDescription}\n${revision}`, { mode: genMode })
  if (!policyVerdict.allowed) {
    return jsonResponse(
      {
        ok: false,
        error: 'content_policy_blocked',
        blockedReason: policyVerdict.blockedReason,
        matchedSignals: policyVerdict.matchedSignals,
      },
      422,
    )
  }

  const size = body.size ?? (genMode === 'free' ? 'landscape' : 'portrait')
  const mood = body.mood ?? 'editorial'

  // ═══════════════════════════════════════════════════════════
  // 자유 일러스트 · 텍스트 수정
  // 절대 화보 img2img(얼굴 유지)로 보내지 않음 → 장면 재생성만
  // (토끼+개구리 수정이 사람 가운 초상으로 붕괴하던 경로를 차단)
  // ═══════════════════════════════════════════════════════════
  if (mode === 'text' && genMode === 'free') {
    const merged = mergeFreeRevisionDescription(baseDescription, revision)
    try {
      const compiled = await compileResponsiveFreePrompt({
        description: merged,
        size,
        ai: env.AI,
      })
      const prompt = compiled.prompt
      const negativePrompt = compiled.negativePrompt
      const wildlifeScene = isRealWildlifeScene(compiled.plan)
      const complexScene =
        compiled.plan.multiSpecies ||
        compiled.plan.actions.length > 0 ||
        compiled.plan.states.length > 0 ||
        compiled.plan.traits.length > 0 ||
        compiled.plan.needsWideScene
      const sceneMeta = summarizePlan(compiled.plan)

      const tryFal = async (asPrimary: boolean) => {
        if (!env.FAL_KEY?.trim()) {
          attempts.push({ engine: 'fal', error: 'fal_key_not_configured' })
          return null
        }
        try {
          const falModel = env.FAL_MODEL_ID?.trim() || 'fal-ai/flux-2-pro'
          const { imageUrl: nextUrl } = await generateFalImage({
            falKey: env.FAL_KEY,
            falModel,
            prompt,
            negativePrompt,
            imageSize: resolveFalImageSize(size),
            timeoutMs: wildlifeScene || asPrimary ? FAL_WILDLIFE_TIMEOUT_MS : undefined,
          })
          return jsonResponse(
            {
              ok: true,
              imageUrl: nextUrl,
              prompt,
              negativePrompt,
              mode,
              genMode,
              structuralRegen: true,
              scene: sceneMeta,
              engine: 'fal',
              engineLabel: asPrimary
                ? 'fal.ai · Flux 장면 재생성 (자유 수정 · 야생동물)'
                : 'fal.ai · Flux 장면 재생성 (자유 수정)',
              message:
                '자유 일러스트 수정은 장면 재생성으로 처리해요. 원본 동물·구도를 유지한 채 요청을 반영합니다.',
              wildlifeRoute: wildlifeScene,
            },
            200,
          )
        } catch (error) {
          attempts.push({
            engine: 'fal',
            error: error instanceof Error ? error.message : 'unknown_error',
          })
          return null
        }
      }

      const tryReplicate = async () => {
        if (!env.REPLICATE_API_TOKEN?.trim()) {
          attempts.push({ engine: 'replicate', error: 'replicate_token_not_configured' })
          return null
        }
        try {
          const steps = wildlifeScene ? 18 : complexScene ? 14 : 12
          const cfg = wildlifeScene ? 7.0 : complexScene ? 5.0 : 4.0
          const dims = resolveReplicateImageSize(size)
          const { imageUrl: nextUrl } = await generateReplicateImage({
            apiToken: env.REPLICATE_API_TOKEN,
            modelOwner: env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based',
            modelName: env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning',
            modelVersion: env.REPLICATE_MODEL_VERSION,
            prompt,
            negativePrompt,
            disableSafetyChecker: true,
            numInferenceSteps: steps,
            guidanceScale: cfg,
            ...dims,
          })
          return jsonResponse(
            {
              ok: true,
              imageUrl: nextUrl,
              prompt,
              negativePrompt,
              mode,
              genMode,
              structuralRegen: true,
              scene: sceneMeta,
              engine: 'replicate',
              engineLabel: wildlifeScene
                ? 'Replicate · 장면 재생성 (자유 수정 · 야생동물)'
                : 'Replicate · 장면 재생성 (자유 수정)',
              message:
                '자유 일러스트 수정은 장면 재생성으로 처리해요. 원본 동물·구도를 유지한 채 요청을 반영합니다.',
              wildlifeRoute: wildlifeScene,
              attempts: attempts.length ? attempts : undefined,
            },
            200,
          )
        } catch (error) {
          attempts.push({
            engine: 'replicate',
            error: error instanceof Error ? error.message : 'unknown_error',
          })
          return null
        }
      }

      if (wildlifeScene) {
        const falRes = await tryFal(true)
        if (falRes) return falRes
        const repRes = await tryReplicate()
        if (repRes) return repRes
      } else {
        const falRes = await tryFal(false)
        if (falRes) return falRes
        const repRes = await tryReplicate()
        if (repRes) return repRes
      }

      return jsonResponse(
        {
          ok: false,
          error: 'refine_failed',
          message: '자유 장면 수정(재생성)에 실패했어요. 잠시 후 다시 시도해 주세요.',
          attempts,
        },
        500,
      )
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error: 'refine_failed',
          message: error instanceof Error ? error.message : 'free_scene_regen_failed',
          attempts,
        },
        500,
      )
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 화보 모드 · 큰 수정 → 화보 T2I 재생성
  // ═══════════════════════════════════════════════════════════
  const structural = mode === 'text' && isStructuralRefineRevision(revision)
  if (structural && genMode === 'fashion' && env.REPLICATE_API_TOKEN?.trim()) {
    const merged = [baseDescription, revision].filter(Boolean).join('. ')
    const prompt = buildFashionMagazinePrompt({ description: merged, mood, size })
    const negativePrompt = buildFashionNegativePrompt(merged)
    try {
      const dims = resolveReplicateImageSize(size)
      const { imageUrl: nextUrl } = await generateReplicateImage({
        apiToken: env.REPLICATE_API_TOKEN,
        modelOwner: env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based',
        modelName: env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning',
        modelVersion: env.REPLICATE_MODEL_VERSION,
        prompt,
        negativePrompt,
        disableSafetyChecker: true,
        numInferenceSteps: 14,
        guidanceScale: 4.2,
        ...dims,
      })
      return jsonResponse(
        {
          ok: true,
          imageUrl: nextUrl,
          prompt,
          mode,
          genMode,
          structuralRegen: true,
          engine: 'replicate',
          engineLabel: 'Replicate · 장면 재생성 (전신·의상 큰 수정)',
          message:
            '전신·속옷처럼 큰 수정은 원본 유지 img2img 대신 장면 재생성으로 처리했어요.',
        },
        200,
      )
    } catch (error) {
      attempts.push({
        engine: 'replicate-t2i-structural',
        error: error instanceof Error ? error.message : 'unknown_error',
      })
    }
  }

  const prompt = buildRefinePrompt({ baseDescription, revision, mode, genMode })
  const negativePrompt =
    genMode === 'free'
      ? 'human fashion model, woman portrait, bathrobe, studio mugshot, replaced animal with human'
      : buildFashionNegativePrompt(`${baseDescription} ${revision}`)

  // ── 영역 수정: inpaint 우선
  if (mode === 'region') {
    const maskDataUrl = (body.maskDataUrl ?? '').trim()
    if (!maskDataUrl.startsWith('data:image/')) {
      return jsonResponse({ ok: false, error: 'mask_required' }, 400)
    }
    if (maskDataUrl.length > 1_800_000) {
      return jsonResponse(
        {
          ok: false,
          error: 'mask_too_large',
          message: '선택 영역 데이터가 너무 커요. 영역을 줄이거나 텍스트로 수정을 시도해 주세요.',
        },
        413,
      )
    }
    if (!env.FAL_KEY?.trim()) {
      return jsonResponse(
        {
          ok: false,
          error: 'fal_key_required_for_region_refine',
          message: '영역 수정은 fal 키가 필요합니다. Cloudflare Secrets에 FAL_KEY를 등록해 주세요.',
        },
        500,
      )
    }

    try {
      const { imageUrl: nextUrl } = await refineFalInpaint({
        falKey: env.FAL_KEY,
        imageUrl,
        maskUrl: maskDataUrl,
        prompt,
      })
      return jsonResponse(
        {
          ok: true,
          imageUrl: nextUrl,
          prompt,
          mode,
          genMode,
          engine: 'fal',
          engineLabel: 'fal.ai · Flux Inpaint (영역만 수정)',
          regionCount: body.regionCount ?? 1,
        },
        200,
      )
    } catch (error) {
      attempts.push({
        engine: 'fal-inpaint',
        error: error instanceof Error ? error.message : 'failed',
      })
      if (env.REPLICATE_API_TOKEN?.trim()) {
        try {
          const dims = resolveReplicateImageSize(size)
          const { imageUrl: nextUrl } = await refineReplicateImageToImage({
            apiToken: env.REPLICATE_API_TOKEN,
            modelOwner: env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based',
            modelName: env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning',
            modelVersion: env.REPLICATE_MODEL_VERSION,
            imageUrl,
            prompt,
            negativePrompt,
            width: dims.width,
            height: dims.height,
            strength: 0.45,
            disableSafetyChecker: true,
          })
          return jsonResponse(
            {
              ok: true,
              imageUrl: nextUrl,
              prompt,
              mode: 'text',
              genMode,
              engine: 'replicate',
              engineLabel: 'Replicate · Img2Img (영역 수정 폴백)',
              fallbackUsed: true,
              attempts,
              regionCount: body.regionCount ?? 1,
            },
            200,
          )
        } catch (fallbackError) {
          attempts.push({
            engine: 'replicate-img2img-fallback',
            error: fallbackError instanceof Error ? fallbackError.message : 'failed',
          })
        }
      }
      return jsonResponse(
        {
          ok: false,
          error: 'refine_failed',
          message:
            '영역 수정에 실패했어요. 영역을 하나씩 나눠 적용하거나, 텍스트로 수정을 시도해 주세요.',
          attempts,
        },
        500,
      )
    }
  }

  // ── 화보 모드 전용: 작은 텍스트 수정만 얼굴 유지 img2img
  // (자유 모드는 위에서 이미 return — 여기 도달하지 않음)
  if (env.REPLICATE_API_TOKEN?.trim()) {
    try {
      const dims = resolveReplicateImageSize(size)
      const { imageUrl: nextUrl } = await refineReplicateImageToImage({
        apiToken: env.REPLICATE_API_TOKEN,
        modelOwner: env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based',
        modelName: env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning',
        modelVersion: env.REPLICATE_MODEL_VERSION,
        imageUrl,
        prompt,
        negativePrompt,
        width: dims.width,
        height: dims.height,
        strength: structural ? 0.32 : 0.28,
        disableSafetyChecker: true,
      })
      return jsonResponse(
        {
          ok: true,
          imageUrl: nextUrl,
          prompt,
          mode,
          genMode,
          structuralRegen: false,
          engine: 'replicate',
          engineLabel: 'Replicate · Img2Img (얼굴 유지 수정)',
          attempts: attempts.length ? attempts : undefined,
        },
        200,
      )
    } catch (error) {
      attempts.push({
        engine: 'replicate-img2img',
        error: error instanceof Error ? error.message : 'unknown_error',
      })
    }
  } else {
    attempts.push({ engine: 'replicate-img2img', error: 'replicate_token_not_configured' })
  }

  if (env.FAL_KEY?.trim()) {
    try {
      const { imageUrl: nextUrl } = await refineFalImageToImage({
        falKey: env.FAL_KEY,
        imageUrl,
        prompt,
        strength: 0.28,
      })
      return jsonResponse(
        {
          ok: true,
          imageUrl: nextUrl,
          prompt,
          mode,
          genMode,
          engine: 'fal',
          engineLabel: 'fal.ai · Flux Img2Img (얼굴 유지 수정)',
          fallbackUsed: true,
          attempts,
        },
        200,
      )
    } catch (error) {
      attempts.push({
        engine: 'fal-img2img',
        error: error instanceof Error ? error.message : 'unknown_error',
      })
    }
  } else {
    attempts.push({ engine: 'fal-img2img', error: 'fal_key_not_configured' })
  }

  return jsonResponse(
    {
      ok: false,
      error: 'refine_failed',
      message: '원본을 유지한 수정에 실패했어요. 잠시 후 다시 시도해 주세요.',
      attempts,
    },
    500,
  )
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204 })
}
