import { requireAuth } from '../lib/auth'
import { submitAdvancedFaceSwap, uploadDataUrlToFal, type FaceSwapGender } from '../lib/fal-client'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  FAL_KEY?: string
}

const MAX_IMAGE_BYTES = 12 * 1024 * 1024

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function isProviderContentBlock(message: string): boolean {
  return /nsfw|content.?policy|flagged|safety|could not be processed/i.test(message)
}

function normalizeGender(value: unknown): FaceSwapGender | null {
  if (value === 'male' || value === 'female' || value === 'non-binary') return value
  return null
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const auth = await requireAuth(request, env)
    if (auth instanceof Response) return auth

    const limited = await enforceRateLimit(env, 'face-swap', rateLimitIdentity(auth), 20, 3600)
    if (limited) return limited

    if (!env.FAL_KEY?.trim()) {
      return jsonResponse({ ok: false, error: 'fal_key_not_configured' }, 500)
    }

    let body: {
      targetImage?: string
      face0?: string
      gender0?: string
      face1?: string
      gender1?: string
      workflowType?: string
      upscale?: boolean
    }
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
    }

    const targetImage = typeof body.targetImage === 'string' ? body.targetImage.trim() : ''
    const face0 = typeof body.face0 === 'string' ? body.face0.trim() : ''
    const targetIsDataUrl = targetImage.startsWith('data:')
    // AI로 방금 생성한 장면(예: /api/generate 결과)은 data URL이 아니라 원격 https URL로
    // 온다 — 커플 씬 자동 생성 + 얼굴 합성 원클릭 플로우를 위해 둘 다 허용한다.
    if (!targetIsDataUrl) {
      const urlErr = mediaUrlError(targetImage)
      if (urlErr) {
        return jsonResponse({ ok: false, error: 'target_image_required' }, 400)
      }
    }
    if (!face0.startsWith('data:')) {
      return jsonResponse({ ok: false, error: 'face0_required' }, 400)
    }
    const gender0 = normalizeGender(body.gender0)
    if (!gender0) {
      return jsonResponse({ ok: false, error: 'gender0_required' }, 400)
    }

    const face1 = typeof body.face1 === 'string' ? body.face1.trim() : ''
    const hasSecondFace = face1.startsWith('data:')
    const gender1 = hasSecondFace ? normalizeGender(body.gender1) : null
    if (hasSecondFace && !gender1) {
      return jsonResponse({ ok: false, error: 'gender1_required' }, 400)
    }

    const workflowType = body.workflowType === 'target_hair' ? 'target_hair' : 'user_hair'
    const upscale = body.upscale !== false

    let targetImageUrl: string
    let face0ImageUrl: string
    let face1ImageUrl: string | undefined
    try {
      targetImageUrl = targetIsDataUrl
        ? await uploadDataUrlToFal(env.FAL_KEY, targetImage, `faceswap-target-${Date.now()}.png`, {
            maxBytes: MAX_IMAGE_BYTES,
            tooLargeError: 'target_image_too_large',
          })
        : targetImage
      face0ImageUrl = await uploadDataUrlToFal(env.FAL_KEY, face0, `faceswap-face0-${Date.now()}.png`, {
        maxBytes: MAX_IMAGE_BYTES,
        tooLargeError: 'face0_image_too_large',
      })
      if (hasSecondFace) {
        face1ImageUrl = await uploadDataUrlToFal(env.FAL_KEY, face1, `faceswap-face1-${Date.now()}.png`, {
          maxBytes: MAX_IMAGE_BYTES,
          tooLargeError: 'face1_image_too_large',
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'image_upload_failed'
      return jsonResponse({ ok: false, error: message }, 400)
    }

    try {
      const submitted = await submitAdvancedFaceSwap({
        falKey: env.FAL_KEY,
        targetImageUrl,
        face0ImageUrl,
        gender0,
        face1ImageUrl,
        gender1: gender1 ?? undefined,
        workflowType,
        upscale,
      })
      // 드물게 큐 없이 즉시 완료되는 경우(짧은 1인 얼굴 교체 등) — 바로 결과 반환.
      if ('imageUrl' in submitted) {
        return jsonResponse({ ok: true, pending: false, imageUrl: submitted.imageUrl }, 200)
      }
      // 얼굴 2장 교체 등 큐 처리가 오래 걸리는 경우 — job만 반환하고
      // 클라이언트가 /api/face-swap-status로 폴링(Pages Function 벽시계 한도 회피).
      return jsonResponse(
        { ok: true, pending: true, statusUrl: submitted.statusUrl, responseUrl: submitted.responseUrl },
        200,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error'
      if (isProviderContentBlock(message)) {
        return jsonResponse(
          {
            ok: false,
            error: 'provider_content_blocked',
            message: '이미지 엔진이 이 얼굴 교체를 안전 필터로 거절했어요. 다른 사진으로 다시 시도해 주세요.',
          },
          422,
        )
      }
      return jsonResponse({ ok: false, error: 'face_swap_failed', message }, 502)
    }
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: 'face_swap_unexpected_error',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      500,
    )
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
