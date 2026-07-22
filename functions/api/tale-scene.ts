import { requireAuth } from '../lib/auth'
import { evaluateTaleScenePolicy, polishKoreanPromptText } from '../lib/content-policy'
import { FAL_WILDLIFE_TIMEOUT_MS, generateFalKontextMultiImage, uploadDataUrlToFal } from '../lib/fal-client'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  FAL_KEY?: string
}

const MAX_REFERENCE_IMAGES = 6
const MAX_REFERENCE_BYTES = 12 * 1024 * 1024

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

/** 이미지 엔진이 안전 필터로 거절했는지 메시지 문자열로 추정 */
function isProviderContentBlock(message: string): boolean {
  return /nsfw|content.?policy|flagged|safety|could not be processed/i.test(message)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const auth = await requireAuth(request, env)
    if (auth instanceof Response) return auth

    const limited = await enforceRateLimit(env, 'tale-scene', rateLimitIdentity(auth), 15, 3600)
    if (limited) return limited

    if (!env.FAL_KEY?.trim()) {
      return jsonResponse({ ok: false, error: 'fal_key_not_configured' }, 500)
    }

    let body: { images?: string[]; description?: string; aspectRatio?: string }
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
    }

    const images = Array.isArray(body.images)
      ? body.images.filter((item): item is string => typeof item === 'string' && item.startsWith('data:'))
      : []
    if (images.length === 0) {
      return jsonResponse({ ok: false, error: 'reference_image_required' }, 400)
    }
    if (images.length > MAX_REFERENCE_IMAGES) {
      return jsonResponse(
        { ok: false, error: 'too_many_reference_images', max: MAX_REFERENCE_IMAGES },
        400,
      )
    }

    const description = polishKoreanPromptText(body.description ?? '')
    if (!description) {
      return jsonResponse({ ok: false, error: 'description_required' }, 400)
    }
    if (description.length > 800) {
      return jsonResponse({ ok: false, error: 'description_too_long' }, 400)
    }

    const policyVerdict = evaluateTaleScenePolicy(description)
    if (!policyVerdict.allowed) {
      return jsonResponse(
        {
          ok: false,
          error: 'content_policy_blocked',
          blockedReason: policyVerdict.blockedReason,
          matchedSignals: policyVerdict.matchedSignals,
        },
        422,
      )
    }

    const aspectRatio =
      typeof body.aspectRatio === 'string' && body.aspectRatio.trim() ? body.aspectRatio.trim() : undefined

    let imageUrls: string[]
    try {
      imageUrls = []
      for (let i = 0; i < images.length; i += 1) {
        const url = await uploadDataUrlToFal(env.FAL_KEY, images[i], `tale-ref-${Date.now()}-${i}.png`, {
          maxBytes: MAX_REFERENCE_BYTES,
          tooLargeError: 'reference_image_too_large',
        })
        imageUrls.push(url)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'reference_upload_failed'
      return jsonResponse({ ok: false, error: message }, 400)
    }

    const prompt = [
      description,
      '',
      'Keep the same characters, faces, art style, coloring, and mood as the reference illustrations.',
      'This new scene must look like it belongs in the same picture-book/illustration series as the references.',
    ].join('\n')

    try {
      const { imageUrl } = await generateFalKontextMultiImage({
        falKey: env.FAL_KEY,
        imageUrls,
        prompt,
        aspectRatio,
        timeoutMs: FAL_WILDLIFE_TIMEOUT_MS,
      })
      return jsonResponse({ ok: true, imageUrl, prompt }, 200)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error'
      if (isProviderContentBlock(message)) {
        return jsonResponse(
          {
            ok: false,
            error: 'provider_content_blocked',
            message: '이미지 엔진이 이 장면을 안전 필터로 거절했어요. 장면 설명을 조금 바꿔 다시 시도해 주세요.',
          },
          422,
        )
      }
      return jsonResponse({ ok: false, error: 'generation_failed', message }, 502)
    }
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: 'tale_scene_unexpected_error',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      500,
    )
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
