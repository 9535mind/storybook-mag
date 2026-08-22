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

    let body: { images?: string[]; description?: string; aspectRatio?: string; photoreal?: boolean }
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

    // 실사 인물 사진(증명사진 등)으로 새 장면을 만들 때는 "일러스트/동화책" 언어를 쓰면 안
    // 된다 — 모델이 사진을 그림풍으로 바꿔버리거나 얼굴을 다시 그려서 원래 얼굴과 달라지는
    // 사고가 실측됨. photoreal 플래그로 사진 전용 지시문을 분리한다.
    //
    // 이 모델(flux-pro/kontext/multi)은 fal 공식 예시("Put the little duckling on top of
    // the woman's t-shirt")에서 보듯 "첫 번째 이미지를 베이스로 두고 그 위에 편집을
    // 가하는" 방식으로 동작한다. "두 사람을 합쳐라"처럼 모호하게 쓰면 첫 번째(이미지1)
    // 사람만 확대·연장하고 두 번째 사람은 아예 무시하는 사고가 실측됨 — 반드시 "the first
    // reference photo" / "the second reference photo"를 직접 지칭해 "두 번째 사람을
    // 첫 번째 사진 장면에 추가로 넣어라"는 편집 지시문 형태로 써야 둘 다 반영된다.
    // Kontext Multi는 인물 정체성(얼굴·피부·헤어) 보존 지시를 여러 번 반복해 강하게 지키는
    // 편향이 있는데, 상대적으로 "행동"(키스/포옹) 지시는 설명문 한 줄에만 있으면 쉽게 묻혀서
    // — 실측으로 "두 사람이 그냥 나란히 정면을 보고 서 있는" 결과(키스도 포옹도 전혀 없음)가
    // 반복 확인됐다. 행동 키워드를 감지해 정체성 지시와 동일한 비중(반복·CRITICAL)으로
    // 행동 자체를 재차 명시한다.
    // 실측 회귀: "두 사람" 지시가 있어도 모델이 두 번째 참고 사진을 무시하고 첫 번째
    // 사람을 그대로 복제해 "같은 사람이 양쪽에 차렷 자세로 서 있는" 결과를 내는 사고가
    // 반복 확인됐다 — 정체성 지시가 "각자의 얼굴을 유지하라"고만 되어 있어 "둘이 서로
    // 다른 사람이어야 한다"는 조건 자체가 명시돼 있지 않았기 때문. 이 조건을 별도
    // 문장으로 명시한다.
    const mentionsManWoman = /남녀|남자.{0,4}여자|여자.{0,4}남자|man\s+and\s+woman|couple/i.test(description)
    const antiDuplicationClause = [
      'CRITICAL: Person A and Person B are two DIFFERENT, DISTINCT individuals — FORBIDDEN cloning/duplicating one person twice, FORBIDDEN showing the same face/body on both sides — one person must come from EACH of the two reference photos, clearly recognizable as two separate people.',
      mentionsManWoman
        ? 'The scene is a man and a woman together — whichever reference photo shows the man keeps a male body/face, whichever shows the woman keeps a female body/face. FORBIDDEN two men, FORBIDDEN two women.'
        : '',
    ]
      .filter(Boolean)
      .join(' ')
    const wantsKissAction = /키스|입맞춤|입\s*(?:을\s*)?맞추|kiss/i.test(description)
    const wantsHugAction = !wantsKissAction && /포옹|안(?:다|고|은|아)|껴안|hug|embrace/i.test(description)
    const actionReinforcement = wantsKissAction
      ? [
          'CRITICAL ACTION (this is the main subject of the photo, not a side detail): Person A and Person B are kissing on the lips right now — their faces are turned toward each other, heads tilted, eyes closed or nearly closed, and their lips are actually touching/pressed together.',
          'FORBIDDEN: both people facing the camera; FORBIDDEN: faces not touching; FORBIDDEN: any gap between their mouths; FORBIDDEN: looking at the camera instead of each other.',
        ]
      : wantsHugAction
        ? [
            'CRITICAL ACTION (this is the main subject of the photo, not a side detail): Person A and Person B are hugging each other right now — at least one arm of each person is wrapped around the other person\'s back/shoulders, and their chests/bodies are pressed close together.',
            'FORBIDDEN: both people facing the camera with arms at their sides; FORBIDDEN: standing apart without any arm contact.',
          ]
        : []
    const prompt = body.photoreal
      ? [
          `Edit these two reference photos into one single new photorealistic photo: ${description}`,
          '',
          'The first reference photo shows Person A. The second reference photo shows Person B.',
          'Add Person B standing together with Person A in the same new photo, both fully visible at full-body length, positioned and posed exactly as described above.',
          antiDuplicationClause,
          ...actionReinforcement,
          "Keep Person A's exact face, identity, skin tone, and hairstyle unchanged from the first reference photo.",
          "Keep Person B's exact face, identity, skin tone, and hairstyle unchanged from the second reference photo.",
          'Do not omit either person. Both Person A and Person B must appear together in the final image, photographed together in real life — not a cropped or extended version of only one reference photo.',
          'Both people must have natural, relaxed body language that matches the pose described above (arms actually touching/wrapped around each other, bodies leaning together, weight shifted naturally) — FORBIDDEN: a stiff ID-photo-like pose with both arms straight down at the sides, standing rigidly apart facing forward like a passport photo.',
          actionReinforcement.length
            ? 'Reminder: the required action above (kiss/hug) MUST be visibly happening in the final image — a photo of two people merely standing near each other does NOT satisfy this request.'
            : '',
          'Photorealistic photo, not an illustration, painting, or drawing.',
        ]
          .filter(Boolean)
          .join('\n')
      : [
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
        // 2인 합성 시 "둘 다 빠짐없이 넣어라" 지시를 더 강하게 지키도록 기본보다 높임.
        // 키스/포옹처럼 신체 접촉이 필요한 행동은 정체성 보존 편향 때문에 더 쉽게 무시되므로
        // (실측: "둘 다 정면 보고 서 있기만 함") 가이던스를 한 단계 더 올린다.
        guidanceScale: body.photoreal && imageUrls.length >= 2 ? (actionReinforcement.length ? 7.5 : 6) : undefined,
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
