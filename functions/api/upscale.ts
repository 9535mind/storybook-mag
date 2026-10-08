import { requireAuth } from '../lib/auth'
import { uploadDataUrlToFal, upscaleFalImage } from '../lib/fal-client'
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

  const limited = await enforceRateLimit(env, 'upscale', rateLimitIdentity(auth), 120, 3600)
  if (limited) return limited

  if (!env.FAL_KEY?.trim()) {
    return jsonResponse({ ok: false, error: 'fal_key_not_configured' }, 500)
  }

  let body: { imageUrl?: string; dataUrl?: string; scale?: number }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  let imageUrl = (body.imageUrl ?? '').trim()
  const dataUrl = (body.dataUrl ?? '').trim()
  try {
    if (dataUrl) {
      // 화면의 결과는 대개 data URL 이다. 1024 로 줄이지 않고 원래 크기 그대로 fal 스토리지에 올린다
      if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(dataUrl)) {
        return jsonResponse({ ok: false, error: 'unsupported_image_format' }, 400)
      }
      const ext = /^data:image\/png/i.test(dataUrl) ? 'png' : /^data:image\/webp/i.test(dataUrl) ? 'webp' : 'jpg'
      imageUrl = await uploadDataUrlToFal(env.FAL_KEY, dataUrl, `upscale-${Date.now()}.${ext}`, {
        maxBytes: 10 * 1024 * 1024,
        tooLargeError: 'image_too_large',
      })
    } else {
      const urlErr = mediaUrlError(imageUrl)
      if (urlErr) return jsonResponse({ ok: false, error: urlErr }, 400)
    }
    const result = await upscaleFalImage({ falKey: env.FAL_KEY, imageUrl, scale: Number(body.scale) || 2 })
    return jsonResponse({ ok: true, imageUrl: result.imageUrl, width: result.width, height: result.height }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'upscale_failed'
    return jsonResponse({ ok: false, error: 'upscale_failed', message }, 502)
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
