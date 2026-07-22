import { isAdminEmail, requireAuth } from '../lib/auth'
import {
  buildFashionMagazinePrompt,
  buildFashionNegativePrompt,
  evaluateContentPolicy,
  polishKoreanPromptText,
  wantsNudeOrUndress,
} from '../lib/content-policy'
import { FAL_WILDLIFE_TIMEOUT_MS, generateFalImage, resolveFalImageSize } from '../lib/fal-client'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'
import { generateReplicateImage, resolveReplicateImageSize } from '../lib/replicate-client'
import {
  compileResponsiveFreePrompt,
  isRealWildlifeScene,
  summarizePlan,
} from '../lib/scene-compiler'
import { compileSdxlTagPrompt, translateDescriptionForImagePrompt } from '../lib/translate'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  /** Workers AI — 자유 모드 장면 이해 + 한→영 번역 폴백 */
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }
  /** 한→영 번역 주 엔진(선택) — 없으면 Workers AI 폴백만 사용 */
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_MODEL?: string

  // 주 엔진 (primary) — Replicate: Juggernaut XL Lightning (저비용 + 유연)
  REPLICATE_API_TOKEN?: string
  REPLICATE_MODEL_OWNER?: string
  REPLICATE_MODEL_NAME?: string
  /** 조회 생략용 버전 고정(선택) — 비워두면 latest_version을 자동 조회 */
  REPLICATE_MODEL_VERSION?: string

  // 정밀 모드 전용 모델(선택) — Lightning 계열이 아닌, 많은 스텝에서 실제로 더 좋아지는 일반 SDXL.
  // 비워두면 공개 기본 모델(stability-ai/sdxl)을 사용한다.
  REPLICATE_PRECISION_MODEL_OWNER?: string
  REPLICATE_PRECISION_MODEL_NAME?: string
  REPLICATE_PRECISION_MODEL_VERSION?: string

  // 보조 엔진 (secondary / fallback) — fal.ai: Flux.2 Pro
  FAL_KEY?: string
  FAL_MODEL_ID?: string
}

type EngineAttempt = { engine: string; error: string }

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function isProviderContentBlock(message: string): boolean {
  return /nsfw|content.?policy|flagged|safety|could not be processed/i.test(message)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const auth = await requireAuth(request, env)
    if (auth instanceof Response) return auth

    const limited = await enforceRateLimit(env, 'generate', rateLimitIdentity(auth), 24, 3600)
    if (limited) return limited

    let body: { description?: string; mood?: string; size?: string; mode?: string; precision?: boolean }
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
    }

    const description = polishKoreanPromptText(body.description ?? '')
    if (!description) {
      return jsonResponse({ ok: false, error: 'description_required' }, 400)
    }
    // 관리자는 그림 상세본(최대 3000자 미만)을 그대로 붙여 넣을 수 있게 더 긴 요청을 허용한다.
    const maxDescriptionChars = isAdminEmail(auth.user.email) ? 3000 : 1200
    if (description.length > maxDescriptionChars) {
      return jsonResponse(
        { ok: false, error: 'description_too_long', maxLength: maxDescriptionChars },
        400,
      )
    }

    const mood = body.mood ?? 'clean'
    const size = body.size ?? 'square'
    // mode는 클라이언트가 보낸 값을 그대로 신뢰하면 안 된다 — UI(getGenMode)는 비관리자에게
    // 항상 'free'를 강제하지만, 그건 클라이언트 쪽 UX 제약일 뿐 서버가 보장하는 게 아니다.
    // /api/generate를 직접 호출하면 비관리자도 'fashion'(관리자 전용 화보/성인 파이프라인)에
    // 접근할 수 있었다 — 여기서 서버 쪽으로도 확실히 막는다.
    const requestedMode = body.mode === 'free' ? 'free' : 'fashion'
    const mode = requestedMode === 'fashion' && !isAdminEmail(auth.user.email) ? 'free' : requestedMode
    // 정밀 모드: 생성 속도를 희생해서 스텝 수를 늘려 세부 표현 반영률을 높인다.
    // 누드/탈의 요청은 기본(Lightning) 엔진이 "안전한" 결과 쪽으로 쏠려 옷을 입혀버리는 경향이
    // 실측으로 확인됐다 — 스텝이 적은 증류 모델일수록 이 편향이 강했다. 그래서 누드 요청은
    // 사용자가 체크박스를 안 켜도 자동으로 정밀 모드(스텝 30, CFG 7.5)로 전환한다.
    const autoPrecisionForNude = mode === 'fashion' && wantsNudeOrUndress(description)
    const precision = Boolean(body.precision) || autoPrecisionForNude

    const policyVerdict = evaluateContentPolicy(description, { mode })
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

    // 이미지 모델은 영어 위주로 학습돼 있어, 한글 원문을 프롬프트에 그대로 넣으면 대부분
    // 무시된다(길고 정교하게 써도 소용없어짐) — 프롬프트 조립 직전에 한 번 영어로 번역한다.
    // 정책 검사·likelyAdult 등 한글 키워드 매칭은 원문(description)으로 그대로 수행하고,
    // 실제 이미지 생성 프롬프트에 들어가는 부분만 번역본을 쓴다.
    // 화보(fashion) 모드는 SDXL/Juggernaut 엔진의 CLIP 인코더가 ~70단어를 넘으면 조용히 잘라버리므로,
    // 단순 번역이 아니라 "쉼표 구분 태그 + 70단어 예산" 압축까지 함께 해서 그 좁은 예산 안에 최대한
    // 많은 시각 정보가 실제로 모델에 도달하게 한다. 자유(동화) 모드는 별도 scene-compiler가 구조화
    // 파싱을 하므로 기존 번역만 사용한다.
    const descriptionForPrompt =
      mode === 'free'
        ? (await translateDescriptionForImagePrompt(description, env)).text
        : (await compileSdxlTagPrompt(description, env)).text

    let prompt: string
    let negativePrompt: string
    let sceneMeta: ReturnType<typeof summarizePlan> | null = null
    let complexScene = false
    let wildlifeScene = false

    if (mode === 'free') {
      const compiled = await compileResponsiveFreePrompt({
        description: descriptionForPrompt,
        size,
        mood,
        ai: env.AI,
      })
      prompt = compiled.prompt
      negativePrompt = compiled.negativePrompt
      wildlifeScene = isRealWildlifeScene(compiled.plan)
      complexScene =
        compiled.plan.multiSpecies ||
        compiled.plan.actions.length > 0 ||
        compiled.plan.states.length > 0 ||
        compiled.plan.traits.length > 0 ||
        compiled.plan.needsWideScene
      sceneMeta = summarizePlan(compiled.plan)
    } else {
      // free는 위에서 scene-compiler만 사용. fashion만 화보 프롬프트.
      prompt = buildFashionMagazinePrompt({
        description: descriptionForPrompt,
        mood,
        size,
        rawDescription: description,
      })
      negativePrompt = buildFashionNegativePrompt(description)
    }

    const attempts: EngineAttempt[] = []
    // wantsNudeOrUndress로 조사(을/를 등) 붙은 자연스러운 한국어까지 포함해서 판별한다 —
    // 예전엔 이 정규식이 \s*(공백만)라 "속옷을 제거해줘"처럼 흔한 말투를 놓쳐서, fal(엄격한
    // 콘텐츠 검열)로 먼저 시도했다가 거부당하고서야 Replicate로 넘어가는 낭비가 있었다.
    const likelyAdult =
      wantsNudeOrUndress(description) ||
      /란제리|lingerie|야한|에로|섹시|nsfw|porn|explicit|성기|자위|섹스/i.test(description)

    const tryFal = async (asPrimary: boolean) => {
      if (!env.FAL_KEY?.trim()) {
        attempts.push({ engine: 'fal', error: 'fal_key_not_configured' })
        return null
      }
      if (likelyAdult) {
        attempts.push({ engine: 'fal', error: 'fal_skipped_for_adult_content' })
        return null
      }
      try {
        const falModel = env.FAL_MODEL_ID?.trim() || 'fal-ai/flux-2-pro'
        const { imageUrl } = await generateFalImage({
          falKey: env.FAL_KEY,
          falModel,
          prompt,
          // Flux는 negative_prompt API 없음 → 클라이언트에서 긍정 제약으로 bake
          negativePrompt,
          imageSize: resolveFalImageSize(size),
          timeoutMs: wildlifeScene || asPrimary ? FAL_WILDLIFE_TIMEOUT_MS : undefined,
        })
        return jsonResponse(
          {
            ok: true,
            imageUrl,
            prompt,
            negativePrompt,
            mode,
            scene: sceneMeta,
            engine: 'fal',
            engineLabel: asPrimary
              ? 'fal.ai · Flux.2 Pro (야생동물 우선)'
              : mode === 'free'
                ? 'fal.ai · Flux.2 Pro (반응형 보조)'
                : 'fal.ai · Flux.2 Pro (보조엔진)',
            fallbackUsed: !asPrimary,
            primaryEngineError: asPrimary ? null : attempts[0]?.error ?? null,
            wildlifeRoute: wildlifeScene,
          },
          200,
        )
      } catch (error) {
        attempts.push({ engine: 'fal', error: error instanceof Error ? error.message : 'unknown_error' })
        return null
      }
    }

    const tryReplicate = async () => {
      if (!env.REPLICATE_API_TOKEN?.trim()) {
        attempts.push({ engine: 'replicate', error: 'replicate_token_not_configured' })
        return null
      }
      try {
        // 야생동물: Juggernaut 화보 편향을 CFG/steps로 누르고, 네거티브는 이미 강화됨
        const fashionSceneHeavy =
          mode === 'fashion' &&
          /속옷|거울|란제리|underwear|mirror|lingerie|몸매|비스듬/i.test(description)
        const baseSteps = mode === 'free' ? (wildlifeScene ? 18 : complexScene ? 14 : 12) : fashionSceneHeavy ? 14 : 10
        const baseCfg = mode === 'free' ? (wildlifeScene ? 7.0 : complexScene ? 5.0 : 4.0) : fashionSceneHeavy ? 4.2 : 3.2

        // 정밀 모드: Lightning 계열은 스텝을 늘려도 비례 개선이 안 되므로,
        // 많은 스텝에서 실제로 좋아지는 일반 SDXL 모델로 바꿔서 돈다(속도는 느려짐).
        const usePrecisionModel = precision
        const modelOwner = usePrecisionModel
          ? env.REPLICATE_PRECISION_MODEL_OWNER?.trim() || 'stability-ai'
          : env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based'
        const modelName = usePrecisionModel
          ? env.REPLICATE_PRECISION_MODEL_NAME?.trim() || 'sdxl'
          : env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning'
        const modelVersion = usePrecisionModel ? env.REPLICATE_PRECISION_MODEL_VERSION : env.REPLICATE_MODEL_VERSION
        const steps = usePrecisionModel ? 30 : baseSteps
        const cfg = usePrecisionModel ? 7.5 : baseCfg

        const { imageUrl } = await generateReplicateImage({
          apiToken: env.REPLICATE_API_TOKEN,
          modelOwner,
          modelName,
          modelVersion,
          prompt,
          negativePrompt,
          disableSafetyChecker: true,
          numInferenceSteps: steps,
          guidanceScale: cfg,
          ...resolveReplicateImageSize(size),
        })
        return jsonResponse(
          {
            ok: true,
            imageUrl,
            prompt,
            mode,
            scene: sceneMeta,
            engine: 'replicate',
            engineLabel: usePrecisionModel
              ? `Replicate · ${modelOwner}/${modelName} · 정밀모드(${steps}스텝)`
              : mode === 'free'
                ? wildlifeScene
                  ? 'Replicate · Juggernaut XL Lightning (야생동물)'
                  : 'Replicate · Juggernaut XL Lightning (반응형 자유)'
                : 'Replicate · Juggernaut XL Lightning',
            wildlifeRoute: wildlifeScene,
            fallbackUsed: wildlifeScene && attempts.some((a) => a.engine === 'fal'),
            primaryEngineError:
              wildlifeScene && attempts.some((a) => a.engine === 'fal')
                ? attempts.find((a) => a.engine === 'fal')?.error ?? null
                : null,
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

    // 실제 동물 장면: Flux가 지시 따르기에 유리 → fal 우선, Juggernaut는 보조
    // (Juggernaut Lightning은 양복·인화 초상화로 붕괴하는 경우가 많음)
    if (wildlifeScene) {
      const falRes = await tryFal(true)
      if (falRes) return falRes
      const repRes = await tryReplicate()
      if (repRes) return repRes
    } else {
      const repRes = await tryReplicate()
      if (repRes) return repRes
      const falRes = await tryFal(false)
      if (falRes) return falRes
    }

    const noEngineConfigured = attempts.every(
      (attempt) =>
        attempt.error === 'replicate_token_not_configured' || attempt.error === 'fal_key_not_configured',
    )
    if (noEngineConfigured) {
      return jsonResponse({ ok: false, error: 'no_engine_configured', attempts }, 500)
    }

    const providerBlocked = attempts.some((attempt) => isProviderContentBlock(attempt.error))
    if (providerBlocked) {
      return jsonResponse(
        {
          ok: false,
          error: 'provider_content_blocked',
          message:
            '이미지 엔진이 이 장면을 안전 필터로 거절했습니다. 누드/과도한 노출은 엔진 정책상 실패할 수 있어요. 구도·의상·장면을 조금 바꿔 다시 시도해 주세요.',
          attempts,
        },
        422,
      )
    }

    return jsonResponse({ ok: false, error: 'generation_failed', attempts }, 502)
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: 'generation_unexpected_error',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      500,
    )
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204 })
}
