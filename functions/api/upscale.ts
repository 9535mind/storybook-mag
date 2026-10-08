import { requireAuth } from '../lib/auth'
import { upscaleFalImage } from '../lib/fal-client'
import { mediaUrlError } from '../lib/media-url'
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

/**
 * 결과 이미지를 2배로 확대·선명하게 한다(Real-ESRGAN · fal.ai). 얼굴 복원은 쓰지 않아 얼굴은 달라지지 않는다.
 * 결과물 자체를 바꾸지 않고 새 URL을 돌려준다.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'upscale', rateLimitIdentity(auth), 30, 3600)
  if (limited) return limited

  if (!env.FAL_KEY?.trim()) {
    return jsonResponse({ ok: false, error: 'fal_key_not_configured' }, 500)
  }

  let body: { imageUrl?: string; scale?: number }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const imageUrl = (body.imageUrl ?? '').trim()
  const urlErr = mediaUrlError(imageUrl)
  if (urlErr) return jsonResponse({ ok: false, error: urlErr }, 400)

  try {
    const result = await upscaleFalImage({ falKey: env.FAL_KEY, imageUrl, scale: Number(body.scale) || 2 })
    return jsonResponse({ ok: true, imageUrl: result.imageUrl, width: result.width, height: result.height }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'upscale_failed'
    return jsonResponse({ ok: false, error: 'upscale_failed', message }, 502)
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
