import { requireAuth } from '../lib/auth'
import {
  buildFashionMagazinePrompt,
  buildFashionNegativePrompt,
  buildRefinePrompt,
  evaluateContentPolicy,
  isStructuralRefineRevision,
  polishKoreanPromptText,
} from '../lib/content-policy'
import { refineFalImageToImage, refineFalInpaint } from '../lib/fal-client'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'
import {
  generateReplicateImage,
  refineReplicateImageToImage,
  resolveReplicateImageSize,
} from '../lib/replicate-client'
import { compileResponsiveFreePrompt } from '../lib/scene-compiler'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }
  REPLICATE_API_TOKEN?: string
  REPLICATE_MODEL_OWNER?: string
  REPLICATE_MODEL_NAME?: string
  REPLICATE_MODEL_VERSION?: string
  FAL_KEY?: string
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
  const imageUrl = (body.imageUrl ?? '').trim()
  const baseDescription = polishKoreanPromptText(body.baseDescription ?? '')
  const revision = polishKoreanPromptText(body.revision ?? '')
  const attempts: Array<{ engine: string; error: string }> = []

  const urlErr = mediaUrlError(imageUrl)
  if (urlErr) return jsonResponse({ ok: false, error: urlErr }, 400)
  if (!revision) return jsonResponse({ ok: false, error: 'revision_required' }, 400)
  if (revision.length > 800) return jsonResponse({ ok: false, error: 'revision_too_long' }, 400)
  if (baseDescription.length > 1200) return jsonResponse({ ok: false, error: 'description_too_long' }, 400)

  const policyVerdict = evaluateContentPolicy(`${baseDescription}\n${revision}`)
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

  const size = body.size ?? 'portrait'
  const mood = body.mood ?? 'editorial'
  const genMode = body.genMode === 'free' ? 'free' : 'fashion'
  const structural = mode === 'text' && isStructuralRefineRevision(revision)

  // 전신·란제리 등: 클로즈업 img2img는 가운/다른 얼굴로 붕괴 → 장면 재생성
  if (structural && env.REPLICATE_API_TOKEN?.trim()) {
    const merged = [baseDescription, revision].filter(Boolean).join('. ')
    let prompt = ''
    let negativePrompt = ''
    try {
      if (genMode === 'free') {
        const compiled = await compileResponsiveFreePrompt({
          description: merged,
          size,
          ai: env.AI,
        })
        prompt = compiled.prompt
        negativePrompt = compiled.negativePrompt
      } else {
        prompt = buildFashionMagazinePrompt({ description: merged, mood, size })
        negativePrompt = buildFashionNegativePrompt(merged)
      }
      const dims = resolveReplicateImageSize(size)
      const { imageUrl: nextUrl } = await generateReplicateImage({
        apiToken: env.REPLICATE_API_TOKEN,
        modelOwner: env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based',
        modelName: env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning',
        modelVersion: env.REPLICATE_MODEL_VERSION,
        prompt,
        negativePrompt,
        disableSafetyChecker: true,
        numInferenceSteps: genMode === 'free' ? 14 : 14,
        guidanceScale: genMode === 'free' ? 5.0 : 4.2,
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
          engineLabel:
            genMode === 'free'
              ? 'Replicate · 장면 재생성 (자유 · 큰 수정)'
              : 'Replicate · 장면 재생성 (전신·의상 큰 수정)',
          message:
            '전신·속옷처럼 큰 수정은 원본 유지 img2img 대신 장면 재생성으로 처리했어요. 얼굴이 조금 달라질 수 있어요.',
        },
        200,
      )
    } catch (error) {
      attempts.push({
        engine: 'replicate-t2i-structural',
        error: error instanceof Error ? error.message : 'unknown_error',
      })
      // 실패 시 아래 img2img로 폴백
    }
  }

  const prompt = buildRefinePrompt({ baseDescription, revision, mode })
  const negativePrompt = buildFashionNegativePrompt(`${baseDescription} ${revision}`)

  // ── 영역 수정: inpaint 우선, 실패 시 동일 요청으로 img2img 폴백(502 방지)
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
      // fal img2img 폴백은 성인 화보에서 검은 화면을 자주 내므로 쓰지 않음.
      // Replicate img2img만 보조로 시도.
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

  // ── 텍스트 수정(작은 변경): 낮은 strength로 얼굴 고정
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
