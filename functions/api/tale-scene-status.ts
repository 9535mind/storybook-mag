import { requireAuth } from '../lib/auth'
import { checkFalKontextMultiImage } from '../lib/fal-client'
import { fetchRemoteImageAsDataUrl, persistRemoteImageToR2 } from '../lib/persist-remote-image'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  FAL_KEY?: string
  MEDIA?: R2Bucket
  MEDIA_PUBLIC_BASE_URL?: string
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

  const limited = await enforceRateLimit(env, 'tale-scene-status', rateLimitIdentity(auth), 800, 3600)
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
    const result = await checkFalKontextMultiImage({
      falKey: env.FAL_KEY,
      statusUrl,
      responseUrl,
    })

    if (result.status === 'succeeded' && result.imageUrl) {
      // 브라우저가 fal CDN을 직접 못 읽어 검은 화면만 나오는 실측 → 서버에서 받아
      // dataUrl / R2 URL로 바꿔 돌려준다.
      const [persisted, inlined] = await Promise.all([
        persistRemoteImageToR2(env, result.imageUrl),
        fetchRemoteImageAsDataUrl(result.imageUrl),
      ])
      const imageUrl = persisted || result.imageUrl
      if (!inlined?.dataUrl && !persisted) {
        // 둘 다 실패해도 URL은 주되, 클라이언트가 다시 media-bytes 시도
        return jsonResponse(
          { ok: true, pending: false, status: 'succeeded', imageUrl, previewFailed: true },
          200,
        )
      }
      return jsonResponse(
        {
          ok: true,
          pending: false,
          status: 'succeeded',
          imageUrl,
          ...(inlined?.dataUrl ? { dataUrl: inlined.dataUrl } : {}),
        },
        200,
      )
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
            message: '이미지 엔진이 이 장면을 안전 필터로 거절했어요. 장면 설명을 조금 바꿔 다시 시도해 주세요.',
          },
          200,
        )
      }
      return jsonResponse(
        { ok: false, pending: false, status: 'failed', error: 'generation_failed', message },
        200,
      )
    }

    return jsonResponse({ ok: true, pending: true, status: 'processing' }, 200)
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        pending: false,
        status: 'failed',
        error: 'tale_scene_status_unexpected_error',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      500,
    )
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
