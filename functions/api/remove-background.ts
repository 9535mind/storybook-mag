import { requireAuth } from '../lib/auth'
import { removeFalBackground } from '../lib/fal-client'
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
 * 생성/불러온 이미지의 배경을 제거해 투명 PNG로 돌려준다(BiRefNet v2 · fal.ai).
 * 결과물 자체를 바꾸는 게 아니라 새 URL을 돌려주므로, 클라이언트가 원본과 별개로
 * "배경 제거본"을 미리보기/저장할 수 있다.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'remove-background', rateLimitIdentity(auth), 20, 3600)
  if (limited) return limited

  if (!env.FAL_KEY?.trim()) {
    return jsonResponse({ ok: false, error: 'fal_key_not_configured' }, 500)
  }

  let body: { imageUrl?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const imageUrl = (body.imageUrl ?? '').trim()
  const urlErr = mediaUrlError(imageUrl)
  if (urlErr) return jsonResponse({ ok: false, error: urlErr }, 400)

  try {
    const { imageUrl: resultUrl } = await removeFalBackground({ falKey: env.FAL_KEY, imageUrl })
    return jsonResponse({ ok: true, imageUrl: resultUrl }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'background_removal_failed'
    return jsonResponse({ ok: false, error: 'background_removal_failed', message }, 502)
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
