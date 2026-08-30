import { isAdminEmail, requireAuth } from '../lib/auth'
import { persistRemoteImageToR2 } from '../lib/persist-remote-image'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'
import { checkReplicateImage } from '../lib/replicate-client'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  REPLICATE_API_TOKEN?: string
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

/** /api/generate?async=true 로 시작한 Replicate 이미지 job 폴링 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const statusLimit = isAdminEmail(auth.user.email) ? 4000 : 800
  const limited = await enforceRateLimit(
    env,
    'generate-status',
    rateLimitIdentity(auth),
    statusLimit,
    3600,
  )
  if (limited) return limited

  if (!env.REPLICATE_API_TOKEN?.trim()) {
    return jsonResponse({ ok: false, error: 'replicate_token_not_configured' }, 500)
  }

  let body: { predictionId?: string }
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
    const result = await checkReplicateImage({
      apiToken: env.REPLICATE_API_TOKEN,
      predictionId,
    })

    if (result.status === 'succeeded' && result.imageUrl) {
      const persisted = await persistRemoteImageToR2(env, result.imageUrl)
      return jsonResponse(
        {
          ok: true,
          pending: false,
          status: 'succeeded',
          imageUrl: persisted || result.imageUrl,
          persisted: Boolean(persisted),
        },
        200,
      )
    }

    if (result.status === 'failed') {
      const message = result.error || 'replicate_failed'
      if (isProviderContentBlock(message)) {
        return jsonResponse(
          {
            ok: false,
            pending: false,
            status: 'failed',
            error: 'provider_content_blocked',
            message: '이미지 엔진이 이 장면을 거절했어요. 장면 설명을 바꿔 다시 시도해 주세요.',
          },
          200,
        )
      }
      return jsonResponse(
        {
          ok: false,
          pending: false,
          status: 'failed',
          error: 'generation_failed',
          message,
        },
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
        error: 'generate_status_failed',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      200,
    )
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
