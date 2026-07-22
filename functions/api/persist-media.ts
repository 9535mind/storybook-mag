import { requireAuth } from '../lib/auth'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  MEDIA?: R2Bucket
  MEDIA_PUBLIC_BASE_URL?: string
}

// 「수용하기」를 누른 이미지와 「쇼츠 비디오 만들기」로 만든 영상을 fal/replicate의
// 임시 CDN 링크에서 storymag-media R2 버킷으로 복사해 영구 보관한다.
// (fal.media/replicate.delivery 링크는 시간이 지나면 만료돼 갤러리 항목이 통째로 사라짐)
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_VIDEO_BYTES = 80 * 1024 * 1024

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function extFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase()
  if (ct.includes('webm')) return 'webm'
  if (ct.includes('quicktime')) return 'mov'
  if (ct.startsWith('video/')) return 'mp4'
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  return 'jpg'
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'persist-media', rateLimitIdentity(auth), 60, 3600)
  if (limited) return limited

  if (!env.MEDIA) {
    return jsonResponse({ ok: false, error: 'storage_not_configured' }, 200)
  }
  if (!env.MEDIA_PUBLIC_BASE_URL?.trim()) {
    return jsonResponse({ ok: false, error: 'storage_not_configured' }, 200)
  }

  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const sourceUrl = (body.url ?? '').trim()
  const urlErr = mediaUrlError(sourceUrl)
  if (urlErr) {
    return jsonResponse({ ok: false, error: urlErr }, 400)
  }

  // 이미 영구 저장된 주소면(재수정 없이 다시 수용한 경우 등) 다시 복사하지 않고 그대로 반환한다.
  const publicBase = env.MEDIA_PUBLIC_BASE_URL.trim().replace(/\/+$/, '')
  if (sourceUrl.startsWith(`${publicBase}/`)) {
    return jsonResponse({ ok: true, url: sourceUrl, alreadyPersisted: true }, 200)
  }

  try {
    const sourceRes = await fetch(sourceUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StorymagBot/1.0)' },
    })
    if (!sourceRes.ok) {
      return jsonResponse(
        { ok: false, error: 'source_fetch_failed', message: `HTTP ${sourceRes.status}` },
        200,
      )
    }

    // 본문을 통째로 내려받기 전에 Content-Length로 먼저 걸러낸다 (큰 영상 파일 낭비 방지).
    const declaredLength = Number(sourceRes.headers.get('content-length') || '')
    if (Number.isFinite(declaredLength) && declaredLength > MAX_VIDEO_BYTES) {
      return jsonResponse({ ok: false, error: 'source_too_large' }, 200)
    }

    const buf = await sourceRes.arrayBuffer()
    if (buf.byteLength < 64) {
      return jsonResponse({ ok: false, error: 'source_empty' }, 200)
    }

    const headerType = (sourceRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const isVideo = headerType.startsWith('video/')
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    if (buf.byteLength > maxBytes) {
      return jsonResponse({ ok: false, error: 'source_too_large' }, 200)
    }

    const contentType = isVideo
      ? headerType
      : headerType.startsWith('image/') && !headerType.includes('svg')
        ? headerType
        : 'image/jpeg'
    const ext = extFromContentType(contentType)
    const kindPrefix = isVideo ? 'vid' : 'img'
    const key = `${kindPrefix}/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/${crypto.randomUUID()}.${ext}`

    await env.MEDIA.put(key, buf, {
      httpMetadata: { contentType },
    })

    return jsonResponse({ ok: true, url: `${publicBase}/${key}` }, 200)
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: 'persist_failed',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      200,
    )
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204 })
}
