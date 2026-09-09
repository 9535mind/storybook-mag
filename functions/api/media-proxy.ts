import { requireAuth } from '../lib/auth'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
}

const MAX_BYTES = 12 * 1024 * 1024

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

/**
 * 원격 이미지를 바이너리로 프록시한다.
 * media-bytes(JSON+base64)는 큰 장면에서 응답이 비대해져 미리보기가 검게 깨질 수 있어
 * 얼굴·장면 스튜디오는 이 엔드포인트 + blob URL을 쓴다.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'media-proxy', rateLimitIdentity(auth), 200, 3600)
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
    const response = await fetch(imageUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StorymagBot/1.0)' },
    })
    if (response.status === 404 || response.status === 403 || response.status === 410) {
      return jsonResponse({ ok: false, error: 'source_image_expired' }, 200)
    }
    if (!response.ok) {
      return jsonResponse(
        { ok: false, error: 'source_image_fetch_failed', message: `HTTP ${response.status}` },
        200,
      )
    }

    const headerType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const urlLower = imageUrl.toLowerCase()
    const buf = await response.arrayBuffer()
    if (buf.byteLength < 64) {
      return jsonResponse({ ok: false, error: 'source_image_empty' }, 200)
    }
    if (buf.byteLength > MAX_BYTES) {
      return jsonResponse({ ok: false, error: 'source_image_too_large' }, 200)
    }

    const contentType =
      headerType.startsWith('image/') && !headerType.includes('svg')
        ? headerType
        : urlLower.includes('.png')
          ? 'image/png'
          : urlLower.includes('.webp')
            ? 'image/webp'
            : 'image/jpeg'

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'X-Proxy-Bytes': String(buf.byteLength),
      },
    })
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
