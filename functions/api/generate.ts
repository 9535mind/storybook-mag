import { requireAuth } from '../lib/auth'
import {
  buildFashionMagazinePrompt,
  buildFashionNegativePrompt,
  evaluateContentPolicy,
  polishKoreanPromptText,
} from '../lib/content-policy'
import { FAL_WILDLIFE_TIMEOUT_MS, generateFalImage, resolveFalImageSize } from '../lib/fal-client'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'
import { generateReplicateImage, resolveReplicateImageSize } from '../lib/replicate-client'
import {
  compileResponsiveFreePrompt,
  isRealWildlifeScene,
  summarizePlan,
} from '../lib/scene-compiler'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  /** Workers AI — 자유 모드 장면 이해 */
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }

  // 주 엔진 (primary) — Replicate: Juggernaut XL Lightning (저비용 + 유연)
  REPLICATE_API_TOKEN?: string
  REPLICATE_MODEL_OWNER?: string
  REPLICATE_MODEL_NAME?: string
  /** 조회 생략용 버전 고정(선택) — 비워두면 latest_version을 자동 조회 */
  REPLICATE_MODEL_VERSION?: string

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

    let body: { description?: string; mood?: string; size?: string; mode?: string }
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
    }

    const description = polishKoreanPromptText(body.description ?? '')
    if (!description) {
      return jsonResponse({ ok: false, error: 'description_required' }, 400)
    }
    if (description.length > 1200) {
      return jsonResponse({ ok: false, error: 'description_too_long' }, 400)
    }

    const mood = body.mood ?? 'editorial'
    const size = body.size ?? 'square'
    const mode = body.mode === 'free' ? 'free' : 'fashion'

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

    let prompt: string
    let negativePrompt: string
    let sceneMeta: ReturnType<typeof summarizePlan> | null = null
    let complexScene = false
    let wildlifeScene = false

    if (mode === 'free') {
      const compiled = await compileResponsiveFreePrompt({
        description,
        size,
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
      prompt = buildFashionMagazinePrompt({ description, mood, size })
      negativePrompt = buildFashionNegativePrompt(description)
    }

    const attempts: EngineAttempt[] = []
    const likelyAdult =
      /누드|나체|nude|naked|란제리|lingerie|야한|에로|섹시|nsfw|porn|explicit|성기|자위|섹스/i.test(
        description,
      )

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
        const steps = mode === 'free' ? (wildlifeScene ? 18 : complexScene ? 14 : 12) : fashionSceneHeavy ? 14 : 10
        const cfg = mode === 'free' ? (wildlifeScene ? 7.0 : complexScene ? 5.0 : 4.0) : fashionSceneHeavy ? 4.2 : 3.2
        const { imageUrl } = await generateReplicateImage({
          apiToken: env.REPLICATE_API_TOKEN,
          modelOwner: env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based',
          modelName: env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning',
          modelVersion: env.REPLICATE_MODEL_VERSION,
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
            engineLabel:
              mode === 'free'
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
