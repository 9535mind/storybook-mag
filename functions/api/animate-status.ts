import { isAdminEmail, requireAuth } from '../lib/auth'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'
import { checkReplicateVideo } from '../lib/replicate-client'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  REPLICATE_API_TOKEN?: string
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

  // 폴링이 3초마다라 클립 몇 번이면 120을 쉽게 넘김 — 상태 조회 한도를 넉넉히
  const statusLimit = isAdminEmail(auth.user.email) ? 4000 : 800
  const limited = await enforceRateLimit(
    env,
    'animate-status',
    rateLimitIdentity(auth),
    statusLimit,
    3600,
  )
  if (limited) return limited

  if (!env.REPLICATE_API_TOKEN?.trim()) {
    return jsonResponse({ ok: false, error: 'replicate_token_not_configured' }, 500)
  }

  let body: { predictionId?: string; durationSec?: number }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const predictionId = String(body.predictionId || '').trim()
  if (!predictionId || predictionId.length > 80) {
    return jsonResponse({ ok: false, error: 'prediction_id_required' }, 400)
  }

  try {
    const result = await checkReplicateVideo({
      apiToken: env.REPLICATE_API_TOKEN,
      predictionId,
      durationSec: body.durationSec,
    })

    if (result.status === 'succeeded' && result.videoUrl) {
      return jsonResponse(
        {
          ok: true,
          pending: false,
          status: 'succeeded',
          videoUrl: result.videoUrl,
          durationSec: result.durationSec,
        },
        200,
      )
    }

    if (result.status === 'failed') {
      return jsonResponse(
        {
          ok: false,
          pending: false,
          status: 'failed',
          error: 'video_generation_failed',
          message: result.error || 'replicate_failed',
        },
        200,
      )
    }

    return jsonResponse(
      {
        ok: true,
        pending: true,
        status: 'processing',
        durationSec: result.durationSec,
      },
      200,
    )
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: 'video_status_failed',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      200,
    )
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
