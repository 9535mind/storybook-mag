import { requireAuth } from '../lib/auth'
import { evaluateTaleScenePolicy, polishKoreanPromptText } from '../lib/content-policy'
import { submitFalKontextMultiImage, uploadDataUrlToFal } from '../lib/fal-client'
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

    let body: {
      images?: string[]
      description?: string
      aspectRatio?: string
      photoreal?: boolean
      gender0?: string
      gender1?: string
      refKind?: string
    }
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
    if (description.length > 1200) {
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
    const genderWord = (g?: string) => {
      const v = (g || '').trim().toLowerCase()
      if (v === 'male') return 'man'
      if (v === 'female') return 'woman'
      if (v === 'non-binary') return 'non-binary adult'
      return ''
    }
    const g0 = genderWord(body.gender0)
    const g1 = genderWord(body.gender1)
    const genderHint =
      g0 && g1
        ? `Person A (first reference) is a ${g0}; Person B (second reference) is a ${g1}. Keep those sexes/body types — do not swap genders.`
        : g0
          ? `Person A (first reference) is a ${g0}.`
          : ''
    const antiDuplicationClause = [
      'CRITICAL: Person A and Person B are two DIFFERENT, DISTINCT individuals — FORBIDDEN cloning/duplicating one person twice — one person must come from EACH of the two reference photos.',
      genderHint,
      mentionsManWoman || (g0 === 'man' && g1 === 'woman') || (g0 === 'woman' && g1 === 'man')
        ? 'Keep male and female as in the references. FORBIDDEN two men, FORBIDDEN two women, FORBIDDEN gender-swap.'
        : '',
    ]
      .filter(Boolean)
      .join(' ')
    const wantsKissAction = /키스|입맞춤|입\s*(?:을\s*)?맞추|kiss/i.test(description)
    const wantsBackHugAction =
      !wantsKissAction &&
      /백\s*허그|뒤에서\s*(?:안|껴안|감싸)|등\s*뒤에서|back\s*hug|hug(?:s|ging)?\s*(?:her\s*)?from\s*behind|from\s*behind/i.test(
        description,
      )
    const wantsHugAction =
      !wantsKissAction &&
      !wantsBackHugAction &&
      /포옹|안(?:다|고|은|아)|껴안|hug|embrace/i.test(description)
    const wantsArmInArmAction =
      !wantsKissAction &&
      !wantsBackHugAction &&
      !wantsHugAction &&
      /팔짱|데이트|arm\s*in\s*arm|walking\s*(?:arm\s*in\s*arm|together)/i.test(description)
    const actionReinforcement = wantsKissAction
      ? [
          'CRITICAL ACTION: they are kissing on the lips now — heads tilted toward each other, lips touching. FORBIDDEN both facing camera with faces apart.',
        ]
      : wantsBackHugAction
        ? [
            'CRITICAL ACTION: back-hug — one stands BEHIND the other, arms wrapped from behind. FORBIDDEN face-to-face square stance.',
          ]
        : wantsHugAction
          ? [
              'CRITICAL ACTION: hugging now — arms around each other, bodies close. FORBIDDEN arms hanging at sides facing camera.',
            ]
          : wantsArmInArmAction
            ? [
                'CRITICAL ACTION: arm-in-arm / linked arms on a date, bodies leaning together. FORBIDDEN stiff passport pose.',
              ]
            : []

    const refKind = body.refKind === 'body' ? 'body' : 'face'
    const identityFirstLock = [
      'HIGHEST PRIORITY — IDENTITY & BODY LOCK (do this before anything else):',
      'The first reference photo IS Person A. The second reference photo IS Person B.',
      "Keep Person A's exact face (bone structure, eyes, nose, mouth, age), skin tone, hairstyle, and body build from reference 1 — same shoulder width, chest/bust volume, waist, and overall silhouette visible in that photo.",
      "Keep Person B's exact face, skin tone, hairstyle, and body build from reference 2 — same proportions visible in that photo.",
      refKind === 'body'
        ? 'References are half-body or full-body photos: preserve torso proportions, breast/chest size, waist-hip silhouette, and limb thickness exactly — FORBIDDEN inventing a slimmer or bulkier fashion-model body.'
        : 'If a reference is a face crop or half-body shot: extend to full body naturally, but the face and the visible torso proportions must stay the same person — FORBIDDEN replacing them with a different fashion model.',
      'FORBIDDEN: inventing new faces, beauty-filtered strangers, different ethnicity, different age, different body type (do not slim, bulk, enlarge, or shrink bust/shoulders/hips away from the references).',
      'FORBIDDEN: treating the scene text as permission to redesign who they are — scene text only changes pose, place, clothes if asked, and action.',
      'Copy each reference face as faithfully as possible (same person recognition) — slight makeup change OK, different person NOT OK.',
    ].join(' ')

    const prompt = body.photoreal
      ? [
          identityFirstLock,
          antiDuplicationClause,
          '',
          `Scene direction ONLY (pose / place / action — do NOT change identity or body type): ${description}`,
          ...actionReinforcement,
          'Both Person A and Person B appear together in one photorealistic photo, full body visible when possible.',
          'Match the photographic look of the reference photos (real camera photo, not illustration).',
          actionReinforcement.length
            ? 'The requested action must be visible, but NEVER at the cost of swapping faces or body types.'
            : '',
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
      // 동기 대기는 Pages 벽시계·45초 fal 한도에 걸려 "서버 시간 한도"로 자주 실패함.
      // 업로드·프롬프트 준비 후 submit만 하고, 클라이언트는 /api/tale-scene-status로 폴링.
      // guidance: 너무 높으면 장면 텍스트에 과적합되어 참고 얼굴을 버림(실측). 정체성 우선으로 4.5.
      const submitted = await submitFalKontextMultiImage({
        falKey: env.FAL_KEY,
        imageUrls,
        prompt,
        aspectRatio,
        guidanceScale: body.photoreal && imageUrls.length >= 2 ? 4.5 : undefined,
      })
      if ('imageUrl' in submitted && submitted.imageUrl) {
        return jsonResponse({ ok: true, imageUrl: submitted.imageUrl, prompt }, 200)
      }
      return jsonResponse(
        {
          ok: true,
          pending: true,
          statusUrl: submitted.statusUrl,
          responseUrl: submitted.responseUrl,
          prompt,
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
