import { requireAuth } from '../lib/auth'
import {
  isUnchangedFaceSwapResult,
  submitFaceSwapJob,
  submitFalKontextMultiImage,
  uploadDataUrlToFal,
  HEAD_SWAP_KONTEXT_PROMPT,
  type FaceSwapEngine,
  type FaceSwapGender,
} from '../lib/fal-client'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'
import { startReplicateFaceSwap, startReplicateIndexedFaceSwap } from '../lib/replicate-client'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  FAL_KEY?: string
  REPLICATE_API_TOKEN?: string
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

/** gender = Easel · left/right = 좌→우 인덱스 0/1 */
function normalizeTargetSide(value: unknown): 'gender' | 'left' | 'right' {
  if (value === 'left' || value === 'right') return value
  return 'gender'
}

function normalizeEngine(value: unknown, targetSide: 'gender' | 'left' | 'right'): FaceSwapEngine {
  if (targetSide === 'left' || targetSide === 'right') return 'indexed'
  if (value === 'replicate' || value === 'insight') return value
  return 'easel'
}

function destinationIndexForSide(side: 'left' | 'right'): number {
  return side === 'right' ? 1 : 0
}

async function respondReplicateResult(
  started: { status: 'succeeded' | 'processing'; predictionId: string; imageUrl?: string },
  targetImageUrl: string,
  engine: FaceSwapEngine,
): Promise<Response> {
  if (started.status === 'succeeded' && started.imageUrl) {
    if (await isUnchangedFaceSwapResult(started.imageUrl, targetImageUrl)) {
      return jsonResponse(
        {
          ok: false,
          error: 'face_not_detected_noop',
          message:
            '얼굴을 바꾸지 못하고 원본이 그대로 나왔어요. 좌·우를 바꿔 보거나, 성별 매칭(Easel)을 써 보세요.',
        },
        422,
      )
    }
    return jsonResponse(
      {
        ok: true,
        pending: false,
        imageUrl: started.imageUrl,
        engine,
        baseImageUrl: targetImageUrl,
      },
      200,
    )
  }
  return jsonResponse(
    {
      ok: true,
      pending: true,
      predictionId: started.predictionId,
      engine,
      baseImageUrl: targetImageUrl,
    },
    200,
  )
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const auth = await requireAuth(request, env)
    if (auth instanceof Response) return auth

    const limited = await enforceRateLimit(env, 'face-swap', rateLimitIdentity(auth), 80, 3600)
    if (limited) return limited

    let body: {
      targetImage?: string
      face0?: string
      gender0?: string
      face1?: string
      gender1?: string
      workflowType?: string
      upscale?: boolean
      engine?: string
      targetSide?: string
    }
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
    }

    const targetImage = typeof body.targetImage === 'string' ? body.targetImage.trim() : ''
    let face0 = typeof body.face0 === 'string' ? body.face0.trim() : ''
    let gender0Raw = body.gender0
    let face1 = typeof body.face1 === 'string' ? body.face1.trim() : ''
    let gender1Raw = body.gender1

    const isData = (s: string) => s.startsWith('data:')
    const isHttpOk = (s: string) => Boolean(s) && !isData(s) && !mediaUrlError(s)

    if (!isData(face0) && !isHttpOk(face0) && (isData(face1) || isHttpOk(face1))) {
      face0 = face1
      gender0Raw = gender1Raw
      face1 = ''
      gender1Raw = undefined
    }

    const targetIsDataUrl = isData(targetImage)
    if (!targetIsDataUrl) {
      const urlErr = mediaUrlError(targetImage)
      if (urlErr) {
        return jsonResponse({ ok: false, error: 'target_image_required' }, 400)
      }
    }
    if (!isData(face0) && !isHttpOk(face0)) {
      return jsonResponse(
        {
          ok: false,
          error: 'face0_required',
          message: '증명사진을 왼쪽 또는 오른쪽에 넣어 주세요.',
        },
        400,
      )
    }
    const gender0 = normalizeGender(gender0Raw)
    if (!gender0) {
      return jsonResponse({ ok: false, error: 'gender0_required' }, 400)
    }

    const hasSecondFace = isData(face1) || isHttpOk(face1)
    const gender1 = hasSecondFace ? normalizeGender(gender1Raw) : null
    if (hasSecondFace && !gender1) {
      return jsonResponse({ ok: false, error: 'gender1_required' }, 400)
    }
    if (hasSecondFace && gender1 && gender0 === gender1) {
      // 남남·여여: Easel 성별 매칭으로는 구분이 안 되므로 indexed만 허용
      if (normalizeTargetSide(body.targetSide) === 'gender') {
        return jsonResponse(
          {
            ok: false,
            error: 'same_gender_use_slots',
            message:
              '같은 성별 두 명(남남·여여)은 「슬롯 위치대로(좌·우)」로 바꿔 주세요. 성별 매칭은 남·여가 다를 때만 됩니다.',
          },
          400,
        )
      }
    }

    let targetSide = normalizeTargetSide(body.targetSide)
    let engine = normalizeEngine(body.engine, targetSide)
    // 클라이언트가 엔진을 명시한 경우 존중 (insight = 성인 장면에서도 검열 없이 기하 교체)
    if (body.engine === 'insight' || body.engine === 'replicate' || body.engine === 'indexed' || body.engine === 'easel' || body.engine === 'kontext') {
      engine = body.engine
    } else if (hasSecondFace && targetSide === 'gender') {
      engine = 'easel'
    } else if (targetSide === 'left' || targetSide === 'right') {
      engine = 'indexed'
    }

    const workflowType = body.workflowType === 'user_hair' ? 'user_hair' : 'target_hair'
    // 미지정·true → on (닮음 강화). 클라이언트가 명시적으로 false일 때만 off.
    const upscale = body.upscale !== false

    if ((engine === 'replicate' || engine === 'indexed') && !env.REPLICATE_API_TOKEN?.trim()) {
      if (engine === 'indexed') {
        return jsonResponse(
          {
            ok: false,
            error: 'replicate_token_not_configured',
            message: '좌·우 교체는 Replicate가 필요해요. 지금은 성별 매칭(Easel)을 써 주세요.',
          },
          500,
        )
      }
      engine = 'insight'
    }
    if ((engine === 'insight' || engine === 'easel' || engine === 'kontext') && !env.FAL_KEY?.trim()) {
      return jsonResponse({ ok: false, error: 'fal_key_not_configured' }, 500)
    }

    let targetImageUrl: string
    let face0ImageUrl: string
    let face1ImageUrl: string | undefined
    try {
      if (!env.FAL_KEY?.trim()) {
        return jsonResponse(
          { ok: false, error: 'fal_key_not_configured', message: '이미지 업로드용 FAL_KEY가 필요해요.' },
          500,
        )
      }
      const falKey = env.FAL_KEY
      const [targetUrl, face0Url, face1Url] = await Promise.all([
        targetIsDataUrl
          ? uploadDataUrlToFal(falKey, targetImage, `faceswap-target-${Date.now()}.jpg`, {
              maxBytes: MAX_IMAGE_BYTES,
              tooLargeError: 'target_image_too_large',
            })
          : Promise.resolve(targetImage),
        isData(face0)
          ? uploadDataUrlToFal(falKey, face0, `faceswap-face0-${Date.now()}.jpg`, {
              maxBytes: MAX_IMAGE_BYTES,
              tooLargeError: 'face0_image_too_large',
            })
          : Promise.resolve(face0),
        hasSecondFace
          ? isData(face1)
            ? uploadDataUrlToFal(falKey, face1, `faceswap-face1-${Date.now()}.jpg`, {
                maxBytes: MAX_IMAGE_BYTES,
                tooLargeError: 'face1_image_too_large',
              })
            : Promise.resolve(face1)
          : Promise.resolve(undefined as string | undefined),
      ])
      targetImageUrl = targetUrl
      face0ImageUrl = face0Url
      face1ImageUrl = face1Url
    } catch (error) {
      const message = error instanceof Error ? error.message : 'image_upload_failed'
      return jsonResponse({ ok: false, error: message }, 400)
    }

    try {
      if (engine === 'indexed') {
        const destIndex =
          targetSide === 'left' || targetSide === 'right' ? destinationIndexForSide(targetSide) : 0
        const started = await startReplicateIndexedFaceSwap({
          apiToken: env.REPLICATE_API_TOKEN as string,
          targetImageUrl,
          faceImageUrl: face0ImageUrl,
          destinationFaceIndex: destIndex,
          sourceFaceIndex: 0,
        })
        return await respondReplicateResult(started, targetImageUrl, 'indexed')
      }

      if (engine === 'replicate') {
        const started = await startReplicateFaceSwap({
          apiToken: env.REPLICATE_API_TOKEN as string,
          targetImageUrl,
          faceImageUrl: face0ImageUrl,
        })
        return await respondReplicateResult(started, targetImageUrl, 'replicate')
      }

      if (engine === 'kontext') {
        const submitted = await submitFalKontextMultiImage({
          falKey: env.FAL_KEY as string,
          imageUrls: [targetImageUrl, face0ImageUrl],
          prompt: HEAD_SWAP_KONTEXT_PROMPT,
          guidanceScale: 5,
        })
        if ('imageUrl' in submitted && submitted.imageUrl) {
          return jsonResponse(
            {
              ok: true,
              pending: false,
              imageUrl: submitted.imageUrl,
              engine: 'kontext',
              baseImageUrl: targetImageUrl,
            },
            200,
          )
        }
        return jsonResponse(
          {
            ok: true,
            pending: true,
            statusUrl: submitted.statusUrl,
            responseUrl: submitted.responseUrl,
            engine: 'kontext',
            baseImageUrl: targetImageUrl,
          },
          200,
        )
      }

      const submitted = await submitFaceSwapJob({
        falKey: env.FAL_KEY as string,
        engine: engine === 'insight' ? 'insight' : 'easel',
        targetImageUrl,
        face0ImageUrl,
        gender0,
        face1ImageUrl,
        gender1: gender1 ?? undefined,
        workflowType,
        upscale,
      })
      if ('imageUrl' in submitted) {
        if (await isUnchangedFaceSwapResult(submitted.imageUrl, targetImageUrl)) {
          return jsonResponse(
            {
              ok: false,
              error: 'face_not_detected_noop',
              message:
                '얼굴을 바꾸지 못하고 원본이 그대로 나왔어요. 「원본 왼쪽/오른쪽」으로 바꿔 보거나 성별을 확인해 주세요.',
              engine: submitted.engine,
            },
            422,
          )
        }
        return jsonResponse(
          {
            ok: true,
            pending: false,
            imageUrl: submitted.imageUrl,
            engine: submitted.engine,
            baseImageUrl: targetImageUrl,
          },
          200,
        )
      }
      return jsonResponse(
        {
          ok: true,
          pending: true,
          statusUrl: submitted.statusUrl,
          responseUrl: submitted.responseUrl,
          engine: submitted.engine,
          baseImageUrl: targetImageUrl,
        },
        200,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error'
      if (isProviderContentBlock(message)) {
        return jsonResponse(
          {
            ok: false,
            error: 'provider_content_blocked',
            message: '이 교체 엔진이 장면을 거절했어요. 다른 엔진으로 이어갑니다.',
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
