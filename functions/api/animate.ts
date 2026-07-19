import { requireAuth } from '../lib/auth'
import { buildAnimationPrompt, evaluateContentPolicy } from '../lib/content-policy'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'
import {
  generateReplicateVideo,
  resolveReplicateVideoAspect,
  resolveWanI2vDuration,
} from '../lib/replicate-client'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string

  // I2V(이미지→비디오) 엔진 — Replicate: 기본값 Wan2.2 I2V (wan-video/wan-2.2-i2v-fast)
  REPLICATE_API_TOKEN?: string
  REPLICATE_VIDEO_MODEL_OWNER?: string
  REPLICATE_VIDEO_MODEL_NAME?: string
  /** 조회 생략용 버전 고정(선택) — 비워두면 latest_version을 자동 조회 */
  REPLICATE_VIDEO_MODEL_VERSION?: string
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

  const limited = await enforceRateLimit(env, 'animate', rateLimitIdentity(auth), 10, 3600)
  if (limited) return limited

  if (!env.REPLICATE_API_TOKEN?.trim()) {
    return jsonResponse({ ok: false, error: 'replicate_token_not_configured' }, 500)
  }

  let body: { imageUrl?: string; prompt?: string; motion?: string; size?: string; durationSec?: number }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const imageUrl = (body.imageUrl ?? '').trim()
  const urlErr = mediaUrlError(imageUrl)
  if (urlErr) {
    return jsonResponse({ ok: false, error: urlErr }, 400)
  }

  const originalPrompt = (body.prompt ?? '').trim()
  if (originalPrompt.length > 1200) {
    return jsonResponse({ ok: false, error: 'prompt_too_long' }, 400)
  }

  const motion = (body.motion ?? '').trim()
  if (motion.length > 400) {
    return jsonResponse({ ok: false, error: 'motion_too_long' }, 400)
  }

  // 원본 프롬프트 + 모션 설명 모두 콘텐츠 정책 검사
  const policyText = [originalPrompt, motion].filter(Boolean).join('\n')
  if (policyText) {
    const policyVerdict = evaluateContentPolicy(policyText)
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
  }

  const prompt = buildAnimationPrompt({ prompt: originalPrompt, motion })
  // 환경변수 미지정 시 오픈소스 I2V 기본 스펙(Wan2.2)으로 자동 바인딩
  const modelOwner = env.REPLICATE_VIDEO_MODEL_OWNER?.trim() || 'wan-video'
  const modelName = env.REPLICATE_VIDEO_MODEL_NAME?.trim() || 'wan-2.2-i2v-fast'

  try {
    const requested =
      typeof body.durationSec === 'number' && Number.isFinite(body.durationSec) ? body.durationSec : 8
    const { approxSec } = resolveWanI2vDuration(requested)

    const { videoUrl, durationSec } = await generateReplicateVideo({
      apiToken: env.REPLICATE_API_TOKEN,
      modelOwner,
      modelName,
      modelVersion: env.REPLICATE_VIDEO_MODEL_VERSION,
      imageUrl,
      prompt,
      aspect: resolveReplicateVideoAspect(body.size),
      durationSec: requested,
    })

    return jsonResponse(
      {
        ok: true,
        videoUrl,
        prompt,
        durationSec: durationSec || approxSec,
        engine: 'replicate',
        engineLabel: `Replicate · ${modelOwner}/${modelName}`,
      },
      200,
    )
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: 'video_generation_failed',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      502,
    )
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204 })
}
