import { requireAuth } from '../lib/auth'
import { checkAdvancedFaceSwap, isUnchangedFaceSwapResult } from '../lib/fal-client'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'
import { checkReplicateImage } from '../lib/replicate-client'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  FAL_KEY?: string
  REPLICATE_API_TOKEN?: string
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

const NOOP_MESSAGE =
  '얼굴을 바꾸지 못하고 원본이 그대로 나왔어요. 커플 장면이면 바꿀 사람과 같은 성별을 고르고 Easel 엔진을 써 보세요.'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'face-swap-status', rateLimitIdentity(auth), 800, 3600)
  if (limited) return limited

  let body: {
    statusUrl?: string
    responseUrl?: string
    predictionId?: string
    baseImageUrl?: string
    engine?: string
  }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const predictionId = String(body.predictionId || '').trim()
  const statusUrl = String(body.statusUrl || '').trim()
  const responseUrl = String(body.responseUrl || '').trim()
  const baseImageUrl = String(body.baseImageUrl || '').trim()
  const engine = String(body.engine || '').trim()

  try {
    if (predictionId) {
      if (!env.REPLICATE_API_TOKEN?.trim()) {
        return jsonResponse({ ok: false, error: 'replicate_token_not_configured' }, 500)
      }
      const result = await checkReplicateImage({
        apiToken: env.REPLICATE_API_TOKEN,
        predictionId,
      })

      if (result.status === 'succeeded' && result.imageUrl) {
        if (baseImageUrl && (await isUnchangedFaceSwapResult(result.imageUrl, baseImageUrl))) {
          return jsonResponse(
            {
              ok: false,
              pending: false,
              status: 'failed',
              error: 'face_not_detected_noop',
              message: NOOP_MESSAGE,
              falStatus: 'NOOP',
            },
            200,
          )
        }
        return jsonResponse(
          {
            ok: true,
            pending: false,
            status: 'succeeded',
            imageUrl: result.imageUrl,
            falStatus: 'COMPLETED',
            engine: engine || 'replicate',
            persisted: false,
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

      return jsonResponse(
        { ok: true, pending: true, status: 'processing', falStatus: 'IN_PROGRESS', engine: 'replicate' },
        200,
      )
    }

    if (!env.FAL_KEY?.trim()) {
      return jsonResponse({ ok: false, error: 'fal_key_not_configured' }, 500)
    }
    if (!statusUrl.startsWith('https://queue.fal.run/') || !responseUrl.startsWith('https://queue.fal.run/')) {
      return jsonResponse({ ok: false, error: 'status_url_required' }, 400)
    }

    const result = await checkAdvancedFaceSwap({
      falKey: env.FAL_KEY,
      statusUrl,
      responseUrl,
    })

    if (result.status === 'succeeded' && result.imageUrl) {
      if (baseImageUrl && (await isUnchangedFaceSwapResult(result.imageUrl, baseImageUrl))) {
        return jsonResponse(
          {
            ok: false,
            pending: false,
            status: 'failed',
            error: 'face_not_detected_noop',
            message: NOOP_MESSAGE,
            falStatus: 'NOOP',
            engine,
          },
          200,
        )
      }
      return jsonResponse(
        {
          ok: true,
          pending: false,
          status: 'succeeded',
          imageUrl: result.imageUrl,
          falStatus: result.falStatus || 'COMPLETED',
          engine,
          persisted: false,
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
            falStatus: result.falStatus,
            error: 'provider_content_blocked',
            message: '이미지 엔진이 이 얼굴 교체를 안전 필터로 거절했어요. 다른 사진으로 다시 시도해 주세요.',
          },
          200,
        )
      }
      return jsonResponse(
        {
          ok: false,
          pending: false,
          status: 'failed',
          falStatus: result.falStatus,
          error: 'face_swap_failed',
          message,
        },
        200,
      )
    }

    return jsonResponse(
      {
        ok: true,
        pending: true,
        status: 'processing',
        falStatus: result.falStatus || 'WAITING',
        engine,
      },
      200,
    )
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        pending: false,
        status: 'failed',
        error: 'face_swap_status_failed',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      200,
    )
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
