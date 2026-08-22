import { requireAuth } from '../lib/auth'
import { checkAdvancedFaceSwap } from '../lib/fal-client'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  FAL_KEY?: string
}

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

  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  // 폴링이 몇 초마다라 얼굴 교체 몇 번이면 한도를 쉽게 넘김 — 넉넉히 잡는다.
  const limited = await enforceRateLimit(env, 'face-swap-status', rateLimitIdentity(auth), 800, 3600)
  if (limited) return limited

  if (!env.FAL_KEY?.trim()) {
    return jsonResponse({ ok: false, error: 'fal_key_not_configured' }, 500)
  }

  let body: { statusUrl?: string; responseUrl?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const statusUrl = String(body.statusUrl || '').trim()
  const responseUrl = String(body.responseUrl || '').trim()
  if (!statusUrl.startsWith('https://queue.fal.run/') || !responseUrl.startsWith('https://queue.fal.run/')) {
    return jsonResponse({ ok: false, error: 'status_url_required' }, 400)
  }

  try {
    const result = await checkAdvancedFaceSwap({
      falKey: env.FAL_KEY,
      statusUrl,
      responseUrl,
    })

    if (result.status === 'succeeded' && result.imageUrl) {
      return jsonResponse({ ok: true, pending: false, status: 'succeeded', imageUrl: result.imageUrl }, 200)
    }

    if (result.status === 'failed') {
      const message = result.error || 'fal_generation_failed'
      if (isProviderContentBlock(message)) {
        return jsonResponse(
          {
            ok: false,
            pending: false,
            status: 'failed',
            error: 'provider_content_blocked',
            message: '이미지 엔진이 이 얼굴 교체를 안전 필터로 거절했어요. 다른 사진으로 다시 시도해 주세요.',
          },
          200,
        )
      }
      return jsonResponse(
        { ok: false, pending: false, status: 'failed', error: 'face_swap_failed', message },
        200,
      )
    }

    return jsonResponse({ ok: true, pending: true, status: 'processing' }, 200)
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: 'face_swap_status_failed',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      200,
    )
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
