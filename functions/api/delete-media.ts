import { requireAuth } from '../lib/auth'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  MEDIA?: R2Bucket
  MEDIA_PUBLIC_BASE_URL?: string
}

// 갤러리 항목을 지울 때(개별 삭제 · 전체 삭제 · 수정본으로 교체) storymag-media R2
// 버킷에 남아있는 옛 이미지/영상 파일도 같이 지워서 저장 공간이 무한정 쌓이지 않게 한다.
// 우리 자신의 R2 공개 주소가 아니면(아직 영구 저장 전인 임시 CDN 링크 등) 아무것도 하지 않고
// 성공으로 응답한다 — 호출부에서 매번 "영구 저장된 링크인지" 미리 따지지 않아도 되게.

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

  const limited = await enforceRateLimit(env, 'delete-media', rateLimitIdentity(auth), 120, 3600)
  if (limited) return limited

  if (!env.MEDIA || !env.MEDIA_PUBLIC_BASE_URL?.trim()) {
    return jsonResponse({ ok: true, skipped: true }, 200)
  }

  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const url = (body.url ?? '').trim()
  if (!url) {
    return jsonResponse({ ok: false, error: 'url_required' }, 400)
  }

  const publicBase = env.MEDIA_PUBLIC_BASE_URL.trim().replace(/\/+$/, '')
  const prefix = `${publicBase}/`
  if (!url.startsWith(prefix)) {
    // 우리 R2 버킷 소유가 아닌 주소(아직 영구 저장되지 않은 임시 링크 등) — 지울 게 없다.
    return jsonResponse({ ok: true, skipped: true }, 200)
  }

  const key = url.slice(prefix.length)
  if (!key || key.includes('..') || key.length > 512) {
    return jsonResponse({ ok: false, error: 'invalid_key' }, 400)
  }

  try {
    await env.MEDIA.delete(key)
    return jsonResponse({ ok: true }, 200)
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: 'delete_failed',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      200,
    )
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204 })
}
