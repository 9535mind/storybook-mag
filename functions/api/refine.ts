import { isAdminEmail, requireAuth } from '../lib/auth'
import {
  buildFashionMagazinePrompt,
  buildFashionNegativePrompt,
  buildRefinePrompt,
  DEFAULT_NEGATIVE_PROMPT,
  describesAnimalSubject,
  evaluateContentPolicy,
  isAdditiveRefineRevision,
  isStructuralRefineRevision,
  mergeFreeRevisionDescription,
  polishKoreanPromptText,
  resolveFashionDescriptionWordBudget,
  wantsNudeOrUndress,
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
import { compileSdxlTagPrompt, translateDescriptionForImagePrompt } from '../lib/translate'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }
  /** 한→영 번역 주 엔진(선택) — 없으면 Workers AI 폴백만 사용 */
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_MODEL?: string
  REPLICATE_API_TOKEN?: string
  REPLICATE_MODEL_OWNER?: string
  REPLICATE_MODEL_NAME?: string
  REPLICATE_MODEL_VERSION?: string
  REPLICATE_PRECISION_MODEL_OWNER?: string
  REPLICATE_PRECISION_MODEL_NAME?: string
  REPLICATE_PRECISION_MODEL_VERSION?: string
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
  // 클라이언트가 보낸 genMode를 그대로 신뢰한다(generate.ts와 동일한 패턴).
  // 예전엔 여기서 무조건 'free'로 강제해서, 화보(관리자) 모드에서 "귀걸이 추가" 같은
  // 작은 텍스트 수정도 전부 자유 일러스트용 장면 재생성(LLM 기반 동물/사물 재해석)으로
  // 흘러갔다. 그 결과 이미지가 전혀 "수정"되지 않고 완전히 다른 장면(심지어 사자 같은
  // 동물)으로 재생성되는 사고가 났다. 화보 모드는 아래의 화보 전용 img2img/재생성 경로를
  // 타야 하므로, genMode='fashion'이면 자유 장면 재생성 블록을 건너뛰게 한다.
  const genMode: 'free' | 'fashion' = body.genMode === 'fashion' ? 'fashion' : 'free'
  const imageUrl = (body.imageUrl ?? '').trim()
  const baseDescription = polishKoreanPromptText(body.baseDescription ?? '')
  const revision = polishKoreanPromptText(body.revision ?? '')
  const attempts: Array<{ engine: string; error: string }> = []

  const urlErr = mediaUrlError(imageUrl)
  if (urlErr) return jsonResponse({ ok: false, error: urlErr }, 400)
  if (!revision) return jsonResponse({ ok: false, error: 'revision_required' }, 400)
  // 관리자는 그림 상세본(최대 3000자 미만)을 그대로 baseDescription으로 들고 올 수 있게 허용한다.
  const maxDescriptionChars = isAdminEmail(auth.user.email) ? 3000 : 1200
  if (revision.length > 800) return jsonResponse({ ok: false, error: 'revision_too_long' }, 400)
  if (baseDescription.length > maxDescriptionChars) {
    return jsonResponse({ ok: false, error: 'description_too_long', maxLength: maxDescriptionChars }, 400)
  }

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

  const size = body.size ?? 'landscape'
  const mood = body.mood ?? 'clean'
  // genMode='fashion'이라도 실제 서술이 동물/사물 장면이면(관리자가 화보 탭에서 동물 그림을
  // 만든 경우) "성인 여성 얼굴 유지" 문구를 쓰면 안 된다. 번역이 "말"을 애매하게 옮길 수도
  // 있으니, 번역 전 원문 한국어 텍스트로 먼저 판별해서 아래 img2img 경로 전체에 재사용한다.
  const animalSubject = describesAnimalSubject(`${baseDescription} ${revision}`)

  // ═══════════════════════════════════════════════════════════
  // 자유 모드 텍스트 수정 = 항상 자유 장면 재생성 (동물/사물 일러스트 전용 경로)
  // 화보(fashion) 모드는 여기를 건너뛰고 아래 화보 전용 재생성/img2img 경로를 탄다.
  // ═══════════════════════════════════════════════════════════
  if (mode === 'text' && genMode === 'free') {
    // 한글 병합 브리프(merged)는 그대로 두고, 실제 이미지 프롬프트 조립 직전에만 영어로
    // 번역한다 — 그래야 씬 파서(Llama)와 최종 프롬프트 둘 다 영어 텍스트를 받게 된다.
    const merged = mergeFreeRevisionDescription(baseDescription, revision)
    const { text: mergedForPrompt } = await translateDescriptionForImagePrompt(merged, env)
    try {
      const compiled = await compileResponsiveFreePrompt({
        description: mergedForPrompt,
        size,
        mood,
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
  // isStructuralRefineRevision은 "누드/나체/nude"도 구조적 큰 수정으로 분류하는데, 바로 아래
  // T2I 재생성 분기는 원본 이미지를 전혀 입력으로 쓰지 않는 순수 텍스트→이미지 생성이라
  // (얼굴은 "Korean woman, attractive face" 같은 일반 인종 태그로만 지정됨) 매번 완전히
  // 다른 사람 얼굴이 나온다 — 실측으로 "수정(누드 요청)할 때마다 얼굴이 달라진다"는 신고가
  // 반복 확인됐다. 누드/탈의 요청은 원본 이미지를 실제로 입력으로 쓰는 img2img 경로(아래
  // 511행~, 정밀모델·strength 0.6)로 보내서 얼굴을 최대한 보존한 채 옷을 벗기게 한다 —
  // 이 경로는 T2I 재생성보다 옷을 완전히 제거하는 성공률은 다소 낮을 수 있지만, "다른 사람"
  // 이 되어버리는 것보다는 원본 인물을 지키는 쪽이 사용자에게 훨씬 중요하다.
  const nudeRevision = wantsNudeOrUndress(`${baseDescription} ${revision}`)
  if (structural && !nudeRevision && genMode === 'fashion' && env.REPLICATE_API_TOKEN?.trim()) {
    const merged = [baseDescription, revision].filter(Boolean).join('. ')
    // SDXL/Juggernaut CLIP 인코더의 ~70단어 예산에 맞춰 번역+압축 — generate.ts의 화보 경로와 동일.
    // revision을 따로 넘겨서, 예산 안에서 수정 지시가 조용히 잘려나가지 않게 한다. 예산 자체도
    // 55 고정이 아니라, 뒤에 붙을 인종/의상보강/무드/구도/품질 태그 길이에 맞춰 동적으로 정한다.
    const descriptionBudget = resolveFashionDescriptionWordBudget({ mood, size, rawDescription: merged })
    const { text: mergedForPrompt } = await compileSdxlTagPrompt(baseDescription, env, descriptionBudget, revision)
    // 인종·누드 판별은 압축 전 원문(merged) 기준 — 압축 과정에서 명시적 언급이 잘려나가면
    // 기본값(한국인)이 사용자가 지정한 인종을 뒤집어버리는 버그가 있었다.
    const prompt = buildFashionMagazinePrompt({
      description: mergedForPrompt,
      mood,
      size,
      rawDescription: merged,
    })
    const negativePrompt = buildFashionNegativePrompt(merged)
    // 이 블록은 위에서 nudeRevision을 걸러냈으므로(285행 주석) 누드/탈의 케이스는 절대
    // 여기 도달하지 않는다 — "전신으로/거울 앞에서" 같은 순수 프레이밍·구도 변경만 처리한다.
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
          engineLabel: 'Replicate · 장면 재생성 (전신·구도 큰 수정)',
          message:
            '전신·구도처럼 큰 수정은 원본 유지 img2img 대신 장면 재생성으로 처리했어요.',
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

  // img2img/inpaint 프롬프트는 "정확히 이 변경만 적용해줘"가 핵심이라 번역 품질이 특히 중요하다
  // (예: "귀걸이 추가해줘"가 한글 그대로 들어가면 이미지 모델이 못 읽어서 수정이 안 먹힘).
  const [{ text: baseDescriptionForPrompt }, { text: revisionForPrompt }] = await Promise.all([
    translateDescriptionForImagePrompt(baseDescription, env),
    translateDescriptionForImagePrompt(revision, env),
  ])
  const prompt = buildRefinePrompt({
    baseDescription: baseDescriptionForPrompt,
    revision: revisionForPrompt,
    mode,
    // 위에서 원문 한국어로 이미 판별한 animalSubject를 그대로 강제 반영한다(번역이 "말"을
    // 애매하게 옮겨서 buildRefinePrompt 내부의 자체 재판별이 놓치는 경우를 방지).
    genMode: genMode === 'fashion' && animalSubject ? 'free' : genMode,
  })
  // 예전엔 이 분기에 품질/해부구조 네거티브(DEFAULT_NEGATIVE_PROMPT) 없이 "사람으로 바뀌지 말 것"
  // 문구만 있었다 — 아래에서 추가형 수정에 strength를 올리면 팔다리 개수가 틀어지는 등 해부구조
  // 오류 위험이 커지므로, 기본 품질 네거티브를 반드시 함께 넣는다.
  const negativePrompt =
    genMode === 'free' || animalSubject
      ? `${DEFAULT_NEGATIVE_PROMPT}, human fashion model, woman portrait, bathrobe, studio mugshot, replaced animal with human`
      : buildFashionNegativePrompt(`${baseDescription} ${revision}`)
  // "추가해줘/넣어줘"처럼 원본에 없던 새 요소를 그리는 요청은 img2img strength를 더 줘야
  // 실제로 반영된다(낮은 strength는 원본 보존이 강해서 새 물체 합성이 잘 안 됨 — 실측 확인).
  const additive = mode === 'text' && !structural && isAdditiveRefineRevision(revision)

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
        negativePrompt,
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
          // 이 폴백은 실제 마스크를 전달하지 않고 이미지 전체를 다시 그린다. 그런데 위 `prompt`는
          // mode:'region'용으로 지어져 "마스크된 영역만 바꾸고 나머지는 보존하라"는 지시를
          // 포함한다 — 마스크가 없는 이 경로에서 그 지시를 그대로 쓰면, 전신 누드처럼 마스크
          // 밖 전체에 영향을 주는 요청이 "보존하라"는 문구에 눌려 반영되지 않는 사고가 실측으로
          // 확인됐다(바구니만 지워지고 인물은 그대로 옷을 입고 있는 등). 전체 이미지 수정이므로
          // mode:'text' 프롬프트로 다시 만든다.
          const wholeImagePrompt = buildRefinePrompt({
            baseDescription: baseDescriptionForPrompt,
            revision: revisionForPrompt,
            mode: 'text',
            genMode: genMode === 'fashion' && animalSubject ? 'free' : genMode,
          })
          // 누드/탈의 요청도 마찬가지로 기본 Lightning 엔진(8스텝)이 옷을 입혀버리는 편향이
          // 실측으로 확인된 케이스다 — generate.ts / 위 구조적 재생성 분기와 동일하게
          // 정밀 모델(스텝·CFG↑)로 자동 전환한다.
          const nudeFallback = wantsNudeOrUndress(`${baseDescription} ${revision}`)
          const fallbackStrength = nudeFallback ? 0.55 : 0.45
          const { imageUrl: nextUrl } = await refineReplicateImageToImage({
            apiToken: env.REPLICATE_API_TOKEN,
            modelOwner: nudeFallback
              ? env.REPLICATE_PRECISION_MODEL_OWNER?.trim() || 'stability-ai'
              : env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based',
            modelName: nudeFallback
              ? env.REPLICATE_PRECISION_MODEL_NAME?.trim() || 'sdxl'
              : env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning',
            modelVersion: nudeFallback ? env.REPLICATE_PRECISION_MODEL_VERSION : env.REPLICATE_MODEL_VERSION,
            imageUrl,
            prompt: wholeImagePrompt,
            negativePrompt,
            width: dims.width,
            height: dims.height,
            strength: fallbackStrength,
            numInferenceSteps: nudeFallback ? 30 : undefined,
            guidanceScale: nudeFallback ? 7.5 : undefined,
            disableSafetyChecker: true,
          })
          return jsonResponse(
            {
              ok: true,
              imageUrl: nextUrl,
              prompt: wholeImagePrompt,
              mode: 'text',
              genMode,
              engine: 'replicate',
              engineLabel: nudeFallback
                ? 'Replicate · Img2Img (영역 수정 폴백 · 정밀모드, 누드 요청 자동 전환)'
                : 'Replicate · Img2Img (영역 수정 폴백)',
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
  //
  // 이 시점에 structural===true(누드 제외)라면, 위 "화보 T2I 재생성" 시도가 이미 실패해서
  // 여기로 떨어진 것이다(성공했으면 이미 return됨). structural===true이면서 nudeRevision도
  // true인 경우는 위에서 T2I 재생성을 의도적으로 건너뛴 것이다(얼굴 보존을 위해 — 위 285행
  // 주석 참고) — "실패해서 대체됐다"가 아니라 "원래 이 경로가 정답"인 케이스이므로 메시지를
  // 다르게 표시한다. 이 img2img 경로는 원래 "작은 텍스트 수정"용으로 튜닝된 낮은
  // strength(0.32)라, 전신·란제리·누드 같은 큰 구조 변경 요청을 대신 처리하면 거의 반영이
  // 안 된다 — 정밀모드 전환·strength 상향으로 대응한다.
  if (env.REPLICATE_API_TOKEN?.trim()) {
    try {
      const dims = resolveReplicateImageSize(size)
      const structuralFallbackNude = structural && nudeRevision
      const strength = structural ? (structuralFallbackNude ? 0.6 : 0.5) : additive ? 0.5 : 0.28
      const { imageUrl: nextUrl } = await refineReplicateImageToImage({
        apiToken: env.REPLICATE_API_TOKEN,
        modelOwner: structuralFallbackNude
          ? env.REPLICATE_PRECISION_MODEL_OWNER?.trim() || 'stability-ai'
          : env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based',
        modelName: structuralFallbackNude
          ? env.REPLICATE_PRECISION_MODEL_NAME?.trim() || 'sdxl'
          : env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning',
        modelVersion: structuralFallbackNude ? env.REPLICATE_PRECISION_MODEL_VERSION : env.REPLICATE_MODEL_VERSION,
        imageUrl,
        prompt,
        negativePrompt,
        width: dims.width,
        height: dims.height,
        strength,
        numInferenceSteps: structuralFallbackNude ? 30 : undefined,
        guidanceScale: structuralFallbackNude ? 7.5 : undefined,
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
          engineLabel: structuralFallbackNude
            ? 'Replicate · Img2Img (누드 요청 · 얼굴 보존 · 정밀모드)'
            : structural
              ? 'Replicate · Img2Img (장면 재생성 실패 · 보조 경로)'
              : additive
                ? 'Replicate · Img2Img (요소 추가 · strength↑)'
                : 'Replicate · Img2Img (얼굴 유지 수정)',
          fallbackUsed: structural && !structuralFallbackNude ? true : undefined,
          message: structuralFallbackNude
            ? '원본 인물의 얼굴을 보존하기 위해 장면 재생성 대신 img2img로 처리했어요. 누드가 충분히 반영되지 않았으면 다시 수정하기를 한 번 더 눌러 주세요.'
            : structural
              ? '장면을 통째로 다시 그리는 재생성이 실패해서, 원본을 더 보존하는 보조 방식으로 대체했어요. 큰 변경이 기대만큼 반영되지 않았을 수 있어요 — 필요하면 다시 수정하기를 눌러 재시도해 주세요.'
              : undefined,
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
        strength: structural ? 0.32 : additive ? 0.5 : 0.28,
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
