import { requireAuth } from '../lib/auth'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
}

const MAX_BYTES = 10 * 1024 * 1024

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

/** 허용된 미디어 URL을 data URL로 읽어 브라우저 메모리에 캐시할 수 있게 한다. */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'media-bytes', rateLimitIdentity(auth), 40, 3600)
  if (limited) return limited

  let body: { imageUrl?: string }
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

  try {
    const response = await fetch(imageUrl, { method: 'GET', redirect: 'follow' })
    if (response.status === 404 || response.status === 403 || response.status === 410) {
      return jsonResponse({ ok: false, error: 'source_image_expired' }, 200)
    }
    if (!response.ok) {
      return jsonResponse(
        { ok: false, error: 'source_image_fetch_failed', message: `HTTP ${response.status}` },
        200,
      )
    }

    const buf = await response.arrayBuffer()
    if (buf.byteLength < 64) {
      return jsonResponse({ ok: false, error: 'source_image_empty' }, 200)
    }
    if (buf.byteLength > MAX_BYTES) {
      return jsonResponse({ ok: false, error: 'source_image_too_large' }, 200)
    }

    const headerType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const contentType =
      headerType.startsWith('image/') && !headerType.includes('svg')
        ? headerType
        : imageUrl.toLowerCase().includes('.png')
          ? 'image/png'
          : imageUrl.toLowerCase().includes('.webp')
            ? 'image/webp'
            : 'image/jpeg'

    const bytes = new Uint8Array(buf)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    const dataUrl = `data:${contentType};base64,${btoa(binary)}`

    return jsonResponse({ ok: true, dataUrl, bytes: buf.byteLength }, 200)
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: 'source_image_fetch_failed',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      200,
    )
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204 })
}
