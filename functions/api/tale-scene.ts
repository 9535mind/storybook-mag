import { requireAuth } from '../lib/auth'
import { hasClaudeKey, runClaudeText, type ClaudeImageInput } from '../lib/claude-client'
import {
  evaluateTaleScenePolicy,
  polishKoreanPromptText,
  wantsOtbeotgim,
  wantsNudeOrUndress,
  wantsSlipOrSilkLook,
  deskStillUsesAdultReplicate,
  wantsDeskUncensoredStill,
  wantsDeskPoseChange,
  COUPLE_MAN_SHIRT_ONLY,
} from '../lib/content-policy'
import {
  buildDeskStillPrompt,
  buildDeskShapePrompt,
  buildDeskExtendJacketPrompt,
  buildDeskExtendJacketLightPrompt,
  buildDeskExtendKeepLightPrompt,
  buildDeskExtendPantsPrompt,
  buildDeskExtendRecolorPrompt,
  buildDeskExtendSkirtPrompt,
  deskStillNegativePrompt,
  parseDeskIntent,
} from '../lib/desk-still-prompt'
import { verifyLookInpaintPayload } from '../lib/desk-look-server-verify'
import {
  submitFalFashnTryon,
  submitFalInpaint,
  submitFalKontextEdit,
  submitFalKontextMultiImage,
  submitFalTextToImage,
  uploadDataUrlToFal,
  type FalImageSize,
} from '../lib/fal-client'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'
import {
  resolveReplicateImageSize,
  startReplicateImageToImage,
  startReplicateInpaint,
} from '../lib/replicate-client'
import { translateDescriptionForImagePrompt } from '../lib/translate'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  FAL_KEY?: string
  FAL_MODEL_ID?: string
  REPLICATE_API_TOKEN?: string
  REPLICATE_MODEL_OWNER?: string
  REPLICATE_MODEL_NAME?: string
  REPLICATE_MODEL_VERSION?: string
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_MODEL?: string
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

function aspectRatioToFalSize(aspectRatio?: string): FalImageSize {
  const a = (aspectRatio || '').trim()
  if (a === '9:16' || a === 'portrait') return 'portrait_16_9'
  if (a === '16:9' || a === 'landscape') return 'landscape_4_3'
  if (a === '1:1' || a === 'square') return 'square_hd'
  return 'portrait_16_9'
}

function genderWord(g?: string): string {
  const v = (g || '').trim().toLowerCase()
  if (v === 'male') return 'man'
  if (v === 'female') return 'woman'
  if (v === 'non-binary') return 'non-binary adult'
  return ''
}

function parseDataUrlForClaude(dataUrl: string): ClaudeImageInput | null {
  const m = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    (dataUrl || '').trim(),
  )
  if (!m) return null
  const mediaType = m[1].toLowerCase().replace('image/jpg', 'image/jpeg')
  const base64 = m[2].replace(/\s+/g, '')
  if (base64.length < 64 || base64.length > 12_000_000) return null
  return { mediaType, base64 }
}

/** 증명사진 픽셀은 Flux에 넣지 않음. 나이·머리·(여성이면) 상의 가슴 실루엣만 짧게 읽는다. */
async function describeIdLookForSkeleton(
  env: Env,
  dataUrl: string,
  gender: string,
): Promise<string> {
  if (!hasClaudeKey(env)) return ''
  const image = parseDataUrlForClaude(dataUrl)
  if (!image) return ''
  const isWoman = /woman|female/i.test(gender || '')
  try {
    const { text } = await runClaudeText({
      env,
      system:
        'Casting notes only. No names, no celebrities. One English clause, max 50 words. Visible facts only. Do not invent.',
      user: isWoman
        ? `ID/passport photo of an adult woman. One line: age decade, hair color, hair length/style, part, glasses. No body or chest notes.
Example: "about 20s, long straight black hair, center part, no glasses".`
        : `ID/passport photo of an adult ${gender || 'person'}. One line: age decade, hair color, hair length/style, hairline (full/receding/balding), glasses, facial hair. Example: "about 55-65, short gray-white hair, receding hairline, no beard, no glasses".`,
      maxTokens: 256,
      image,
      timeoutMs: 8000,
    })
    return (text || '').replace(/\s+/g, ' ').trim().slice(0, 280)
  } catch {
    return ''
  }
}

function expressionLockLines(mode: 'id' | 'scene'): string[] {
  if (mode === 'scene') {
    return ['Expressions may match the scene (slight smile OK). Keep identity.']
  }
  return [
    'EXPRESSION LOCK: closed mouth, calm ID-photo face, no smile, no grin, no laugh, no fashion-model smirk.',
    'FORBIDDEN changing emotion from a typical passport photo.',
  ]
}

/** 얼굴로 장면 전용. 쇼츠·전신 장면·수정에는 쓰지 않음. */
function isFaceSceneAdultRequest(text: string): boolean {
  const t = polishKoreanPromptText(text)
  if (
    /나체|누드|전라|섹스|삽입|성교|성행위|유두|젖꼭지|보지|음부|외음|자지|페니스|음경|nude|naked|topless|intercourse|penetrat|pussy|penis|vaginal/i.test(
      t,
    )
  ) {
    return true
  }
  return /가슴|젖|유방|breast/i.test(t) && /주무르|만지|애무|fondl|grope|cup/i.test(t)
}

const FACE_SCENE_ADULT_MESSAGE =
  '이어그리기에서는 나체·성인 연출을 받지 않아요. 포즈 그리기 탭을 쓰세요.'

/** 다음 클립에서 얼굴이 다시 보일 동작 — 뒷모습 끝장에도 신분증을 써야 하는 이유 */
function wantsFaceRevealMotion(text: string): boolean {
  return /돌아(?:서|보|가)|뒤돌아|고개를|옆모습|옆얼굴|옆을\s*보|정면을|누워|누운|누우|엎드|look(?:s|ing)?\s+back|turns?\s+(?:around|back)|over[\s-]?shoulder|profile|side\s*view|lie(?:s|d)?\s+down|lying\s+down|prone/i.test(
    text,
  )
}

function buildIdentityContinuePrompt(descriptionKo: string, gender: string): string {
  const reveal = wantsFaceRevealMotion(descriptionKo)
  const who = gender || 'adult'
  const next = descriptionKo.trim() ? `Next action hint: ${descriptionKo.trim().slice(0, 280)}` : ''
  return [
    `Image 1 is the current video frame (body, clothes or nude state, pose, crop, background). Image 2 is the identity card of the SAME one ${who}.`,
    'ONE person only. FORBIDDEN a second person. FORBIDDEN treating the two images as two different people.',
    'The person in image 1 IS the person in image 2 — same recognized adult.',
    'Keep image 1 body type, clothes or nude state, location, lighting, and camera crop.',
    'Match hair color, hair length, hair texture, skin tone, ear shape, and nape from image 2.',
    reveal
      ? [
          next,
          'If this action shows a side face, three-quarter face, front face, lying face, or prone face, that face MUST be image 2 (same bone structure, eyes, nose, mouth, age, ethnicity, hair).',
          'A slight turn or over-shoulder that reveals image 2 is OK when the action needs a visible face.',
          'Do not invent a stranger face. Do not paste a passport onto the back of a head that stays fully away.',
        ].filter(Boolean).join(' ')
      : [
          'If image 1 shows the back of the head or no face: KEEP facing away.',
          'Do NOT invent a front face. Do NOT turn them around. Do NOT paste a passport face onto the back of the head.',
          'If any ear, cheek, jaw, or profile sliver is visible, it must match image 2.',
        ].join(' '),
    'Photoreal camera photograph. Adult 18+.',
  ].join(' ')
}

/** 한글 장면 문장에서 키스/포옹 등 — 골격 프롬프트용 짧은 행동 줄 (옷 입은 장면만) */
function detectSceneActionLines(descriptionKo: string): string[] {
  const t = polishKoreanPromptText(descriptionKo)
  const wantsKiss = /키스|입맞춤|입\s*(?:을\s*)?맞추|kiss/i.test(t)
  const wantsBackHug =
    /백\s*허그|뒤에서\s*(?:안|껴안|감싸)|등\s*뒤에서|back\s*hug|hug(?:s|ging)?\s*(?:her\s*)?from\s*behind|from\s*behind/i.test(
      t,
    )
  const wantsHug =
    !wantsKiss &&
    !wantsBackHug &&
    /포옹|안(?:다|고|은|아)|껴안|hug|embrace/i.test(t)
  const wantsArm =
    !wantsKiss &&
    !wantsBackHug &&
    !wantsHug &&
    /팔\s*감|허리에\s*팔|어깨에\s*팔|팔짱|데이트|arm\s*in\s*arm|arm\s*around|walking\s*(?:arm\s*in\s*arm|together)/i.test(
      t,
    )
  const lines: string[] = []
  if (wantsKiss) {
    lines.push('CRITICAL ACTION: soft lip kiss — heads close, lips touching. Both people in one frame. Clothes stay on.')
  } else if (wantsBackHug) {
    lines.push(
      'CRITICAL ACTION: back-hug — the man stands BEHIND the woman, she faces the camera, his face visible over her shoulder. Full body head to shoes. Clothes stay on.',
    )
  } else if (wantsHug) {
    lines.push('CRITICAL ACTION: hugging — arms around each other, bodies close. Clothes stay on.')
  } else if (wantsArm) {
    lines.push('CRITICAL ACTION: his arm around her waist or shoulders, standing close, looking at camera. Clothes stay on.')
  }
  if (wantsBackHug) {
    lines.push('FORBIDDEN two separate ID/passport portraits, contact sheet, collage, or side-by-side headshots.')
  }
  return lines
}

function restagePosePrompt(options: {
  poseId: string
  descriptionKo: string
  g0: string
  g1: string
}): string {
  const pose = (options.poseId || 'side').trim()
  const woman = options.g0 || 'adult woman'
  const man = options.g1 || 'adult man'
  const keep = [
    `Keep the SAME two East Asian adults: a ${woman} and a ${man}. Same faces, hair, clothes, shoes.`,
    'Do not redraw faces or hairstyles. Only change pose and how close they stand.',
    'Photoreal studio photograph, one continuous backdrop and floor, shared lighting.',
    'Full body head to shoes. Exactly two people, four arms and four legs total.',
    'FORBIDDEN collage, cutout stickers, extra limbs, extra people, face swap, ID cards.',
    'Adult 18+.',
  ]
  const poseLine =
    pose === 'arm'
      ? 'POSE CHANGE: they stand as one couple, hips touching. The man on the RIGHT wraps his LEFT arm around the woman\'s waist; his hand rests on her far hip. FORBIDDEN standing apart, both arms hanging at their sides, two separate cutouts.'
      : pose === 'hug-front'
        ? 'POSE: they hug, bodies close, BOTH faces turned toward the camera (not profile). Arms around each other.'
        : pose === 'lap-sit'
          ? 'POSE: the woman sits on the man’s lap facing the CAMERA. They do not look at each other. Both heads visible. Clothes stay on.'
        : pose === 'backhug'
          ? 'POSE: back-hug — the man stands behind the woman, arms around her waist. She faces the camera; his face visible over her shoulder.'
          : pose === 'hug-light' || pose === 'hug'
            ? 'POSE: a light, gentle hug. Bodies close, not crushing. Full body visible.'
            : 'POSE: they stand close side by side as a real couple, small natural gap or lightly touching. Both look at the camera. FORBIDDEN hugging, wrapping both arms, kissing. Not two separate cutouts.'
  return [poseLine, ...keep, options.descriptionKo ? `User scene: ${options.descriptionKo}` : '']
    .filter(Boolean)
    .join(' ')
}

function resolvePoseDrawId(poseId: string, descriptionKo: string, photoCount?: number): string {
  const t = descriptionKo || ''
  if (photoCount === 1) {
    if (/눕|누워|lying|on\s*(?:his|her)\s*back/i.test(t)) return 'lie'
    if (/옷벗김/.test(t) || poseId === 'otbeotgim') return 'otbeotgim'
    return 'nude'
  }
  if (/기승위|기마위|카우걸|cowgirl/i.test(t)) return 'cowgirl'
  if (/서서\s*(?:섹스|성교|성관계|삽입)|성행위|standing\s*sex|intercourse/i.test(t)) return 'sex-stand'
  if (/키스|입맞춤|kiss/i.test(t)) return 'kiss'
  if (/백\s*허그|뒤에서\s*(?:안|껴안)/i.test(t)) return 'backhug'
  if (/포옹|허그|\bhug\b/i.test(t)) return 'hug'
  if (/팔\s*감|허리에\s*팔|arm\s*around/i.test(t)) return 'arm'
  const id = (poseId || '').trim()
  if (id) return id
  return 'nude'
}

function poseDrawNeedsCouple(poseId: string): boolean {
  return (
    poseId === 'arm' ||
    poseId === 'hug' ||
    poseId === 'backhug' ||
    poseId === 'kiss' ||
    poseId === 'sex-stand' ||
    poseId === 'cowgirl'
  )
}

function poseDrawIsContact(poseId: string): boolean {
  return poseDrawNeedsCouple(poseId)
}

/** SDXL CLIP ~70단어. 동작+성별을 앞에 두고 나머지 자른다. */
function poseDrawCastLine(g0: string, g1: string, couple: boolean): string {
  if (!couple) return `one adult ${g0 || 'woman'}, fully nude`
  const left = g0 || 'woman'
  const right = g1 || 'man'
  if (left === 'woman' && right === 'man') {
    return 'LEFT woman (breasts, vulva). RIGHT man (flat male chest, penis, NO breasts). He stays male. FORBIDDEN two women'
  }
  if (left === 'man' && right === 'woman') {
    return 'LEFT man (male chest, penis). RIGHT woman (breasts). FORBIDDEN two women'
  }
  return `LEFT ${left}, RIGHT ${right}. keep each person's sex`
}

/** 포즈 엔진: 짧고 행동 우선. 얼굴 픽셀 고정·의상 유지는 하지 않음. */
function poseDrawPrompt(options: {
  poseId: string
  descriptionKo: string
  g0: string
  g1: string
  couple: boolean
}): string {
  const pose = options.poseId
  const wantsKiss = /키스|입맞춤|kiss/i.test(options.descriptionKo || '')
  const poseLine =
    pose === 'otbeotgim'
      ? '옷벗김 RESULT: fully nude, same body as the clothed source silhouette. Do not output a bra-only or high sports-bra photo. If a bra is seen it sits on the source bust mound then comes off. Do not invent a different body'
    : pose === 'cowgirl'
      ? 'cowgirl: nude woman straddles a lying nude man, hips on his pelvis. He on his back, male chest, penis. She female. FORBIDDEN two women, both standing'
      : pose === 'lie'
        ? options.g0 === 'man'
          ? 'adult man lying on his back, fully nude, male chest, penis, NO breasts'
          : 'adult woman lying on her back, fully nude'
      : pose === 'sex-stand'
      ? wantsKiss
        ? 'standing heterosexual sex AND mouth-to-mouth kiss, bodies pressed, hips joined, fully nude'
        : 'standing heterosexual sex, bodies pressed, hips joined, fully nude'
      : pose === 'kiss'
        ? 'mouth-to-mouth kiss, heads close, bodies touching, fully nude'
        : pose === 'backhug'
          ? 'nude back-hug: man behind woman, arms around her waist'
          : pose === 'hug'
            ? 'nude hug, arms around each other, bodies close'
            : pose === 'arm'
              ? 'both nude, man wraps arm around her waist, hips touching'
              : options.couple
                ? 'two adults fully nude standing close, not a passport pose'
                : options.g0 === 'man'
                  ? 'adult man fully nude standing, flat male chest, penis, NO breasts, not a woman. sharp photo, skin texture'
                  : 'adult woman fully nude standing, breasts, realistic vulva, soft labia, neat Korean-30s pubic curls on the mons slightly fuller than 20s, not a tall triangle, not a barbie seam. sharp photo, skin texture'
  return [
    poseLine,
    pose === 'cowgirl'
      ? 'lying adult man stays male (penis, no breasts). woman on top is female (breasts, vulva). FORBIDDEN two women'
      : poseDrawCastLine(options.g0, options.g1, options.couple),
    'photoreal uncensored 18+, no clothes',
  ]
    .filter(Boolean)
    .join('. ')
}

function poseDrawReplicateSize(aspectRatio?: string) {
  if (aspectRatio === '16:9') return resolveReplicateImageSize('landscape')
  if (aspectRatio === '1:1') return resolveReplicateImageSize('square')
  if (aspectRatio === '3:4' || aspectRatio === '2:3' || aspectRatio === 'portrait') {
    return resolveReplicateImageSize('portrait')
  }
  return resolveReplicateImageSize('story')
}

/** 1인 증명사진: 얼굴 픽셀은 클라이언트 InsightFace가 씌움. 여기선 장면 골격만. */
function buildFaceSoloComposePrompt(options: {
  description: string
  descriptionKo: string
  g0: string
  look0?: string
  expressionMode: 'id' | 'scene'
  actionLines: string[]
}): string {
  const person = options.g0 || 'adult woman'
  const look = (options.look0 || '').trim()
  const wantsFullBody = /전신|풀\s*바디|full\s*body|머리부터|발끝/i.test(options.descriptionKo)
  return [
    'Photorealistic full-color camera photograph. Not a beauty ad, not a stock model.',
    `Scene: ${options.description}`,
    `One East Asian adult ${person} in ONE continuous frame.`,
    look
      ? `APPEARANCE (must match this ID look, including age and hair): ${look}. FORBIDDEN de-aging, dyeing hair, filling a receding hairline, or swapping to a younger fashion model.`
      : `Keep a realistic adult ${person} — FORBIDDEN teen/20s beauty-model if the person looks older.`,
    ...options.actionLines,
    ...expressionLockLines(options.expressionMode),
    wantsFullBody
      ? 'CRITICAL FRAMING: full body visible head to toe — shoes and ground visible. FORBIDDEN headshot-only, passport crop, tight face close-up, waist-up crop.'
      : 'Show at least waist-up. Natural pose matching the scene — not a stiff passport stance.',
    'BODY FIRST: draw a complete body and neck that can accept a later pasted face. Head size must match a normal full-body photo — not a giant ID card.',
    'FORBIDDEN: rectangular ID/passport photos, colored studio backdrop cards behind the head, contact-sheet faces.',
    'Fully dressed everyday clothes. Modest photograph.',
    'FORBIDDEN: contact sheet, collage, grid, stacked panels, split frames, ID photo montage, black-and-white passport layout.',
    'Natural light unless the scene says otherwise. Adult subject (18+).',
  ]
    .filter(Boolean)
    .join('\n')
}

/** 2인 증명사진: Kontext에 ID를 넣으면 콜라주/복제가 반복 → 텍스트로 골격만 생성 */
function buildFaceCoupleComposePrompt(options: {
  description: string
  descriptionKo: string
  g0: string
  g1: string
  look0?: string
  look1?: string
  expressionMode: 'id' | 'scene'
  actionLines: string[]
}): string {
  const personA = options.g0 || 'adult woman'
  const personB = options.g1 || 'adult man'
  const look0 = (options.look0 || '').trim()
  const look1 = (options.look1 || '').trim()
  const wantsSide = /나란히|side\s*by\s*side|standing\s*together/i.test(options.descriptionKo)
  return [
    'Photorealistic full-color camera photograph. Not a beauty ad, not stock models.',
    `Scene: ${options.description}`,
    `Two distinct East Asian adults in ONE continuous frame: a ${personA} (left) and a ${personB} (right).`,
    look0
      ? `LEFT ${personA} appearance (must match, including age and hair): ${look0}.`
      : `LEFT is a realistic adult ${personA}.`,
    look1
      ? `RIGHT ${personB} appearance (must match, including age and hair): ${look1}.`
      : `RIGHT is a realistic adult ${personB}.`,
    'AGE/HAIR LOCK: if gray/white hair or receding hairline is described, keep it. FORBIDDEN young dark-haired man, FORBIDDEN de-aging, FORBIDDEN filling baldness, FORBIDDEN dyeing hair black.',
    wantsSide || !options.actionLines.length
      ? 'They stand side by side together, same ground plane, similar body scale, similar head sizes.'
      : 'Same ground plane, similar body scale, similar head sizes.',
    ...options.actionLines,
    ...expressionLockLines(options.expressionMode),
    'CRITICAL FRAMING: full body visible head to toe for both — shoes and ground visible. FORBIDDEN waist-up crop, headshot-only, passport crop.',
    'BODY FIRST: draw complete bodies and necks. Faces are placeholders — a later step pastes real faces. Both heads the same photographic scale. FORBIDDEN one giant portrait next to a tiny body.',
    'FORBIDDEN: rectangular ID/passport photos, blue or gray studio backdrop cards behind heads, contact-sheet or sticker faces.',
    'Fully dressed everyday clothes. Modest photograph.',
    'FORBIDDEN: contact sheet, collage, grid, stacked panels, split frames, two separate portraits, ID photo montage.',
    'FORBIDDEN: only one person, duplicating the same face twice, placing faces in separate boxes.',
    'Natural light unless the scene says otherwise. Adult subjects (18+).',
  ]
    .filter(Boolean)
    .join('\n')
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const auth = await requireAuth(request, env)
    if (auth instanceof Response) return auth

    const limited = await enforceRateLimit(env, 'tale-scene', rateLimitIdentity(auth), 80, 3600)
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
      /** id = 증명사진 표정 유지 / scene = 장면 맞게 표정 허용 */
      expressionMode?: string
      /** extend-body = 아래로 이어그리기 / scene-bg = 배경만 / restage-pose = 커플 포즈 재배치 / identity-continue = 쇼츠 끝장+신분증 / desk-still = CAST 사진으로 LOOK·PLACE·POSE만 바꿈 */
      composeMode?: string
      deskStep?: string
      poseId?: string
      photoCount?: number
      sourcePeople?: number
      sourceCast?: 'ww' | 'mw'
      adultStill?: boolean
      forceReplicate?: boolean
      lookConfirm?: boolean
      clothesMask?: string
      deskCastLayout?: { woman?: unknown; man?: unknown }
      deskLookVerify?: {
        ok?: boolean
        reason?: string
        maskSha256?: string
        maskWhite?: number
        segformerSha256?: string
        recSha256?: string
      }
      deskLook?: string
      deskAction?: string
      deskCouple?: boolean
      lookInpaintBoost?: boolean
      expand?: {
        top?: number
        bottom?: number
        left?: number
        right?: number
      }
      sourceWidth?: number
      sourceHeight?: number
      extendStyle?: string
      extendMedium?: string
      sourceClothHex?: string
      recolorTarget?: string
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

    const composeModeEarly = (body.composeMode || '').trim()
    const descriptionKo = polishKoreanPromptText(
      body.description ??
        (composeModeEarly === 'extend-recolor' ? '제공 사진과 같은 옷 색. 얼굴은 그대로.' : ''),
    )
    if (!descriptionKo) {
      return jsonResponse({ ok: false, error: 'description_required' }, 400)
    }
    if (descriptionKo.length > 1200) {
      return jsonResponse({ ok: false, error: 'description_too_long' }, 400)
    }

    const policyVerdict = evaluateTaleScenePolicy(descriptionKo)
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

    const composeMode = (body.composeMode || '').trim()
    if (composeMode === 'identity-continue') {
      try {
        if (images.length < 2) {
          return jsonResponse({ ok: false, error: 'identity_card_required' }, 400)
        }
        const imageUrls: string[] = []
        for (let i = 0; i < 2; i += 1) {
          const url = await uploadDataUrlToFal(env.FAL_KEY, images[i], `id-continue-${Date.now()}-${i}.jpg`, {
            maxBytes: MAX_REFERENCE_BYTES,
            tooLargeError: 'reference_image_too_large',
          })
          imageUrls.push(url)
        }
        const prompt = buildIdentityContinuePrompt(
          descriptionKo,
          genderWord(body.gender0) || 'adult woman',
        )
        const aspectRatio =
          typeof body.aspectRatio === 'string' && body.aspectRatio.trim()
            ? body.aspectRatio.trim()
            : undefined
        const submitted = await submitFalKontextMultiImage({
          falKey: env.FAL_KEY,
          imageUrls,
          prompt,
          aspectRatio,
          guidanceScale: 5.0,
        })
        if ('imageUrl' in submitted && submitted.imageUrl) {
          return jsonResponse(
            { ok: true, imageUrl: submitted.imageUrl, composeMode: 'identity-continue', prompt },
            200,
          )
        }
        return jsonResponse(
          {
            ok: true,
            pending: true,
            statusUrl: submitted.statusUrl,
            responseUrl: submitted.responseUrl,
            composeMode: 'identity-continue',
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
              message:
                '이미지 엔진이 이 요청을 거절했어요. 설명을 조금 바꿔 다시 시도해 주세요. (성인 장면은 허용됩니다.)',
            },
            422,
          )
        }
        return jsonResponse({ ok: false, error: 'identity_continue_failed', message }, 502)
      }
    }
    if (composeMode === 'extend-body') {
      try {
        const gender = genderWord(body.gender0) || 'adult'
        const drawn =
          String(body.extendMedium || '').toLowerCase() === 'illustration' ||
          body.photoreal === false
        const identityLock =
          'The face, hair, eyes, nose, mouth, and skin must match the identity image exactly. Same person. FORBIDDEN a different woman, a similar catalog model, a new face.'
        const continueMode = String(body.extendStyle || '') === 'continue'
        const clothHex =
          typeof body.sourceClothHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(body.sourceClothHex.trim())
            ? body.sourceClothHex.trim()
            : ''
        const colorLock = clothHex
          ? `Keep the exact identity cloth color ${clothHex}. Same fabric. Continue the missing lower body in that same color family.`
          : 'Keep the exact identity cloth color. Same fabric. Continue the missing lower body as trousers in that same light color family, not black slacks.'
        const clothesLock =
          gender === 'man'
            ? 'Keep EXACTLY the clothes visible in the identity image: the same shirt or jacket, same color, same collar. Do NOT add a jacket, blazer, suit coat, or tie that is not in the identity image; if he wears only a shirt, he stays in only that shirt. Continue the lower body with plain dark neutral trousers, one even color from waist to hem, and dark leather shoes. FORBIDDEN a new jacket, blazer, tie, a brown, grey, faded, or shiny-white patch on the seat or back of the pants.'
            : continueMode
              ? `Keep the exact same clothes already in the photograph. Same top, same hair, same pose. ${colorLock} Do not change the cloth color or the hairstyle.`
              : 'Keep EXACTLY the clothes visible in the identity image: the same top and the same jacket if she wears one, same colors and collar. Do NOT add a jacket or blazer that is not in the identity image. Continue the lower body naturally (skirt or trousers) in a color that goes with the top. Same hair length and curl. Same face as the identity image.'
        const standLock = continueMode
          ? 'Continue the existing photograph downward as one full-body photo. Same raised hand if present. The whole body from head to shoes is visible with natural proportions. EXACTLY ONE person. FORBIDDEN restaging into a studio, a new pose, a changed face, two people.'
          : 'Standing upright, full body, head to shoes. Two legs, shoes on the floor. Eye-level. EXACTLY ONE person. FORBIDDEN two people, two women, a couple, side-by-side portraits, desk, name-board, waist crop, ID headshot.'
        const proportionLock =
          gender === 'man'
            ? 'Korean adult man, about 7 to 7.5 heads tall. Shoulders about 2.75 times the face width. ID photos crop the shoulders — reconstruct the missing shoulder, then continue the arms from that full shoulder. Shirt or jacket tucked at the hip. Legs are long: crotch at the middle of the body, legs about 40 percent of total height, not longer, full natural thighs. Both shoes fully inside the frame with a little floor below them. FORBIDDEN continuing arms from the left/right cut of the ID photo, narrow ID shoulders, cropped shirt at the navel, pear hips, short legs, thin stick legs, cropped feet, new face.'
            : 'Korean adult woman, about 7 heads tall. Same CAST face. Shoulders about 2.65 times the face width. ID photos crop the shoulders — reconstruct the missing shoulder, then continue the arms from that full shoulder. Fingertips at mid-thigh, not below the skirt hem. Natural slender Korean woman legs: slim calves that taper to slim ankles, not thick calves, not heavy ankles. Proportions of an ordinary Korean woman, not a fashion model. FORBIDDEN ape-long arms, continuing arms from the ID crop edge, tiny head, stick legs, thick or bulging calves, thick ankles, narrow ID shoulders, a new face.'
        const prompt = drawn
          ? [
              `Full-body illustration of the SAME adult ${gender} as the identity drawing.`,
              'Keep the same art medium and style (webtoon, manhwa, watercolor, ink, or anime). Do not convert this into a photograph or photoreal studio shot.',
              identityLock,
              clothesLock,
              standLock,
              proportionLock,
            ].join(' ')
          : continueMode
            ? [
                `Continue the same photograph of this adult ${gender} downward. Do not restage.`,
                identityLock,
                clothesLock,
                standLock,
                'Keep the original photo pixels. Only paint the missing lower body and shoes under the existing crop.',
              ].join(' ')
            : [
              `Photograph of the SAME adult ${gender} standing full body, head to shoes.`,
              identityLock,
              clothesLock,
              standLock,
              proportionLock,
              'Not a passport photo, not a Korean ID headshot, not a waist crop. Seamless studio matching the identity photo.',
            ].join(' ')
        const identity = images[1] || images[0]
        let submitted
        if (images[1]) {
          const imageUrls: string[] = []
          for (let i = 0; i < 2; i += 1) {
            const src = i === 0 ? images[0] : identity
            imageUrls.push(
              src.startsWith('data:')
                ? await uploadDataUrlToFal(env.FAL_KEY, src, `extend-id-${Date.now()}-${i}.jpg`, {
                    maxBytes: MAX_REFERENCE_BYTES,
                    tooLargeError: 'reference_image_too_large',
                  })
                : src,
            )
          }
          submitted = await submitFalKontextMultiImage({
            falKey: env.FAL_KEY,
            imageUrls,
            prompt: [
              drawn
                ? 'Image 1 is the standing full-body layout. Image 2 is the exact identity drawing of the SAME one person. Keep image 2 art style.'
                : continueMode
                  ? 'Image 1 is the original photograph already placed at the top, with stretched empty space below it and at both sides. Image 2 is that same original photo. Continue the empty stretched area: paint the full standing body with natural adult proportions (the head is about one seventh of the full body height, with realistic long legs), the lower scene, and extend the same place (wall, floor) naturally to both sides. Keep the same face, hair, clothes, and background as image 1. The person may be drawn smaller than in image 1 so that the whole body fits in the frame.'
                  : 'Image 1 already shows ONE identity head and shoulders. Image 2 is that same person, not a second person.',
              continueMode
                ? 'EXACTLY ONE adult. Same face, same clothes, same pose, same raised hand if present, same background. Paint the missing body, legs, and shoes at a natural full-body scale. Do not restage into a studio, do not change the pose or the face.'
                : `EXACTLY ONE adult. Continue the body down from the head already in image 1. Keep image 2 face, hair length, and hair color. ${gender === 'man' ? 'Same clothes as image 2, no added jacket or tie, standing head to shoes.' : 'Same clothes as image 2, no added jacket, standing head to shoes.'} FORBIDDEN two people, a second woman, a couple, side-by-side portraits, a new hairstyle, an oval face sticker, leftover silhouette, a beige plate. Feet must reach the bottom of image 1.`,
              prompt,
            ].join(' '),
            aspectRatio: '3:4',
            guidanceScale: continueMode ? 8.2 : 7.5,
          })
        } else {
          submitted = await submitFalKontextEdit({
            falKey: env.FAL_KEY,
            imageUrl: images[0],
            prompt: continueMode
              ? `The image is an original photograph placed at the top with stretched empty space below it and at both sides. Paint the full standing body with natural adult proportions (head about one seventh of body height, realistic long legs), the shoes, and the lower scene into the empty area. ${prompt}`
              : prompt,
            guidanceScale: 6.5,
            aspectRatio: '3:4',
          })
        }
        if ('imageUrl' in submitted && submitted.imageUrl) {
          return jsonResponse(
            { ok: true, imageUrl: submitted.imageUrl, composeMode: 'extend-body' },
            200,
          )
        }
        return jsonResponse(
          {
            ok: true,
            pending: true,
            statusUrl: submitted.statusUrl,
            responseUrl: submitted.responseUrl,
            composeMode: 'extend-body',
          },
          200,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown_error'
        return jsonResponse({ ok: false, error: 'extend_body_failed', message }, 502)
      }
    }

    if (composeMode === 'pose-draw' || body.refKind === 'pose') {
      try {
        if (!env.REPLICATE_API_TOKEN?.trim()) {
          return jsonResponse({ ok: false, error: 'replicate_token_not_configured' }, 500)
        }
        const photoCount = Number(body.photoCount)
        const poseId = resolvePoseDrawId(String(body.poseId || ''), descriptionKo, photoCount)
        const g0 = genderWord(body.gender0) || 'woman'
        const g1 = genderWord(body.gender1)
        const couple =
          photoCount !== 1 &&
          (poseDrawNeedsCouple(poseId) ||
            photoCount >= 2 ||
            Boolean(g1 && g1 !== 'non-binary adult'))
        const prompt = poseDrawPrompt({
          poseId,
          descriptionKo,
          g0,
          g1: g1 || 'man',
          couple,
        })
        const dims = poseDrawReplicateSize(
          typeof body.aspectRatio === 'string' ? body.aspectRatio.trim() : '9:16',
        )
        const heteroNeg =
          couple && g0 === 'woman' && (g1 || 'man') === 'man'
            ? 'two women, lesbian, both female, feminized man, man with breasts, futa, gender swap, '
            : ''
        const soloNeg =
          !couple && g0 === 'man'
            ? 'woman, female body, breasts, boobs, vagina, vulva, feminized, futa, '
            : !couple && g0 === 'woman'
              ? 'penis, scrotum, barbie crotch, smeared vulva, extra labia, sealed crotch, '
              : ''
        const started = await startReplicateImageToImage({
          apiToken: env.REPLICATE_API_TOKEN,
          modelOwner: env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based',
          modelName: env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning',
          modelVersion: env.REPLICATE_MODEL_VERSION,
          imageUrl: images[0],
          prompt,
          negativePrompt:
            heteroNeg +
            soloNeg +
            'clothes, dressed, bra, panties, thong, underwear, collage, extra people, extra limbs, child, teen, censored, mosaic, black image',
          width: dims.width,
          height: dims.height,
          strength: poseDrawIsContact(poseId) ? 0.9 : couple ? 0.86 : 0.82,
          disableSafetyChecker: true,
        })
        if (started.imageUrl) {
          return jsonResponse(
            {
              ok: true,
              imageUrl: started.imageUrl,
              composeMode: 'pose-draw',
              engine: 'replicate',
              prompt,
            },
            200,
          )
        }
        return jsonResponse(
          {
            ok: true,
            pending: true,
            predictionId: started.predictionId,
            engine: 'replicate',
            composeMode: 'pose-draw',
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
              message:
                '이미지 엔진이 이 요청을 거절했어요. 포즈 설명을 조금 바꿔 다시 시도해 주세요. (성인 장면은 허용됩니다. 미성년·비동의·실존 연예인만 불가)',
            },
            422,
          )
        }
        return jsonResponse({ ok: false, error: 'pose_draw_failed', message }, 502)
      }
    }

    if (composeMode === 'pose-touch') {
      try {
        const mask = images[1]
        if (!mask) {
          return jsonResponse({ ok: false, error: 'pose_mask_required' }, 400)
        }
        const poseId = String(body.poseId || '').trim()
        const poseLine =
          poseId === 'backhug'
            ? 'The man stands behind the woman and wraps his arms around her waist. She stays in front. Clothes stay on.'
            : poseId === 'arm'
              ? 'Reposition the man\'s left arm so it wraps around the woman\'s waist. His hand on her far hip. Erase his hanging left arm. Do not add a third arm. They stand close. Clothes stay on.'
              : 'They hug gently, bodies close, arms around each other. Clothes stay on.'
        const submitted = await submitFalInpaint({
          falKey: env.FAL_KEY,
          imageUrl: images[0],
          maskUrl: mask,
          prompt: [
            'Photoreal photograph. Edit ONLY the white masked area.',
            poseLine,
            'Do not change faces, hair, or heads. Keep the existing clothes.',
            'Leave empty or transparent background empty. No new people.',
          ].join(' '),
          negativePrompt: 'new face, different person, extra limbs, collage, changed head, arms hanging at sides',
          strength: 0.78,
        })
        if ('imageUrl' in submitted && submitted.imageUrl) {
          return jsonResponse({ ok: true, imageUrl: submitted.imageUrl, composeMode: 'pose-touch' }, 200)
        }
        return jsonResponse(
          {
            ok: true,
            pending: true,
            statusUrl: submitted.statusUrl,
            responseUrl: submitted.responseUrl,
            composeMode: 'pose-touch',
          },
          200,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown_error'
        return jsonResponse({ ok: false, error: 'pose_touch_failed', message }, 502)
      }
    }

    if (composeMode === 'desk-still') {
      try {
        const step = String(body.deskStep || '')
        const coupleFromClient = typeof body.deskCouple === 'boolean' ? body.deskCouple : undefined
        const coupleFallback =
          body.sourceCast === 'mw' || images.length >= 2 || Number(body.sourcePeople) >= 2
        const couple = coupleFromClient !== undefined ? coupleFromClient : coupleFallback
        const intent = parseDeskIntent(descriptionKo, couple, step, {
          look: typeof body.deskLook === 'string' ? body.deskLook : undefined,
          action: typeof body.deskAction === 'string' ? body.deskAction : undefined,
          couple,
        })
        const prompt = buildDeskStillPrompt(descriptionKo, couple, step, {
          look: intent.look,
          action: intent.action,
          couple: intent.couple,
        })
        const poseCut = step === 'cut' && (intent.action === 'kiss' || intent.action === 'hug' || intent.action === 'breast')
        const nudeStill = intent.look === 'nude'
        const slipStill = intent.look === 'silk'
        if (step === 'look' && env.FAL_KEY?.trim()) {
          const clientMask =
            typeof body.clothesMask === 'string' && body.clothesMask.startsWith('data:image/')
              ? body.clothesMask
              : ''
          const lookGate = await verifyLookInpaintPayload({
            source: images[0],
            clothesMask: clientMask,
            deskCastLayout: body.deskCastLayout,
            deskLookVerify: body.deskLookVerify,
          })
          if (!lookGate.ok) {
            return jsonResponse(
              {
                ok: false,
                error: lookGate.error,
                message:
                  lookGate.error === 'look_couple_full'
                    ? '두 사람이 있는 장은 통째로 보내지 않습니다. 가운데는 원본입니다.'
                    : '의상 마스크·CAST 검증이 맞지 않아 보내지 않습니다.',
              },
              lookGate.status,
            )
          }
          // 슬립은 말로 옷을 설명하지 않는다. 옷 사진을 그대로 입힌다.
          // 인페인팅은 같은 마스크·같은 글로도 캐미솔·조끼·타이츠가 섞여 나왔다(3번에 1번).
          // VTON 은 목표 옷이 그림으로 고정되고 얼굴도 스스로 보존한다(ArcFace 0.964).
          if (slipStill) {
            try {
              const submitted = await submitFalFashnTryon({
                falKey: env.FAL_KEY,
                humanUrl: images[0],
                garmentUrl: new URL('/desk-look-garment-slip.png', request.url).toString(),
                category: 'one-pieces',
              })
              const engine = 'fal-fashn-tryon'
              if ('imageUrl' in submitted && submitted.imageUrl) {
                return jsonResponse(
                  { ok: true, imageUrl: submitted.imageUrl, composeMode: 'desk-still', engine, prompt },
                  200,
                )
              }
              return jsonResponse(
                {
                  ok: true,
                  pending: true,
                  statusUrl: submitted.statusUrl,
                  responseUrl: submitted.responseUrl,
                  composeMode: 'desk-still',
                  engine,
                  prompt,
                },
                200,
              )
            } catch (error) {
              const message = error instanceof Error ? error.message : 'unknown_error'
              return jsonResponse(
                {
                  ok: false,
                  error: 'look_tryon_failed',
                  message: '슬립을 입히지 못했습니다. 가운데는 원본입니다.',
                  detail: message,
                },
                502,
              )
            }
          }
          // Flux-dev 인페인트는 나체를 흰 수영복으로 막거나 원본 옷을 복사한다(실측).
          // 나체는 마스크 있는 Replicate 인페인트. 슬립 아닌 옷 갈아입히기만 Flux.
          if (nudeStill) {
            if (!env.REPLICATE_API_TOKEN?.trim()) {
              return jsonResponse({ ok: false, error: 'replicate_token_not_configured' }, 500)
            }
            try {
              const started = await startReplicateInpaint({
                apiToken: env.REPLICATE_API_TOKEN,
                imageUrl: images[0],
                maskUrl: clientMask,
                modelOwner: 'lucataco',
                modelName: 'realistic-vision-v5-inpainting',
                prompt:
                  'Photoreal. Edit ONLY the white-masked clothes. Melt those garments to bare adult skin of the same woman. Knit OFF, sweater OFF, skirt OFF, shirt OFF, jeans OFF, panty OFF. Bare breasts with nipples, bare belly, bare hips. Same pose, same crop. No new person, no lingerie, no leotard, no swimsuit.',
                negativePrompt: deskStillNegativePrompt({
                  couple,
                  nudeStill,
                  descriptionKo,
                }),
                strength: 0.94,
              })
              const engine = 'replicate-look-inpaint'
              if (started.imageUrl) {
                return jsonResponse(
                  { ok: true, imageUrl: started.imageUrl, composeMode: 'desk-still', engine, prompt },
                  200,
                )
              }
              return jsonResponse(
                {
                  ok: true,
                  pending: true,
                  predictionId: started.predictionId,
                  composeMode: 'desk-still',
                  engine,
                  prompt,
                },
                200,
              )
            } catch (error) {
              const message = error instanceof Error ? error.message : 'unknown_error'
              return jsonResponse(
                {
                  ok: false,
                  error: 'look_inpaint_failed',
                  message: '옷을 녹이지 못했습니다. 가운데는 원본입니다. 얼굴을 붙이지 않습니다.',
                  detail: message.slice(0, 160),
                },
                502,
              )
            }
          }
          const localEdit = `${prompt} Local edit ONLY the white-masked clothes of the CAST woman slot. Unmasked face, neck, skin, hands, man, and background stay exact source pixels. Same body, same crop. FORBIDDEN new person, catalog model, white studio, oval face sticker, assume right person is woman.`
          try {
            const submitted = await submitFalInpaint({
              falKey: env.FAL_KEY,
              imageUrl: images[0],
              maskUrl: clientMask,
              prompt: localEdit,
              negativePrompt: deskStillNegativePrompt({
                couple,
                nudeStill,
                descriptionKo,
              }),
              strength: 0.56,
            })
            const engine = 'fal-look-inpaint'
            if ('imageUrl' in submitted && submitted.imageUrl) {
              return jsonResponse(
                {
                  ok: true,
                  imageUrl: submitted.imageUrl,
                  composeMode: 'desk-still',
                  engine,
                  prompt,
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
                composeMode: 'desk-still',
                engine,
                prompt,
              },
              200,
            )
          } catch (error) {
            const message = error instanceof Error ? error.message : 'unknown_error'
            return jsonResponse(
              {
                ok: false,
                error: 'look_inpaint_failed',
                message:
                  message === 'look_source_too_large' || message === 'look_mask_too_large'
                    ? '사진이 커서 옷을 보내지 못했습니다. 가운데는 원본입니다.'
                    : '옷을 녹이지 못했습니다. 가운데는 원본입니다. 얼굴을 붙이지 않습니다.',
                detail: message.slice(0, 160),
              },
              502,
            )
          }
        }
        if (step === 'look') {
          return jsonResponse(
            {
              ok: false,
              error: 'look_inpaint_required',
              message: '옷 녹이기는 국소 편집만 합니다. 전신 재생성은 보내지 않습니다.',
            },
            500,
          )
        }
        const useAdultReplicate = deskStillUsesAdultReplicate(
          step,
          descriptionKo,
          Boolean(body.forceReplicate),
        )
        if (useAdultReplicate) {
          if (!env.REPLICATE_API_TOKEN?.trim()) {
            return jsonResponse({ ok: false, error: 'replicate_token_not_configured' }, 500)
          }
          const dims = poseDrawReplicateSize(
            typeof body.aspectRatio === 'string' && body.aspectRatio.trim()
              ? body.aspectRatio.trim()
              : '9:16',
          )
          const started = await startReplicateImageToImage({
            apiToken: env.REPLICATE_API_TOKEN,
            modelOwner: env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based',
            modelName: env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning',
            modelVersion: env.REPLICATE_MODEL_VERSION,
            imageUrl: images[0],
            prompt,
            negativePrompt: deskStillNegativePrompt({
              couple,
              nudeStill,
              descriptionKo,
            }),
            width: dims.width,
            height: dims.height,
            strength: nudeStill || slipStill
              ? couple
                ? 0.26
                : 0.24
              : wantsDeskPoseChange(descriptionKo)
                ? 0.4
                : wantsDeskUncensoredStill(descriptionKo)
                  ? 0.38
                  : 0.34,
            minStrength: nudeStill || slipStill ? 0.16 : 0.35,
            guidanceScale: 1.35,
            disableSafetyChecker: true,
          })
          if (started.imageUrl) {
            return jsonResponse(
              { ok: true, imageUrl: started.imageUrl, composeMode: 'desk-still', engine: 'replicate', prompt },
              200,
            )
          }
          return jsonResponse(
            {
              ok: true,
              pending: true,
              predictionId: started.predictionId,
              engine: 'replicate',
              composeMode: 'desk-still',
              prompt,
            },
            200,
          )
        }
        const submitted = await submitFalKontextEdit({
          falKey: env.FAL_KEY,
          imageUrl: images[0],
          prompt,
          tier: 'pro',
          guidanceScale: step === 'look' ? 3.8 : poseCut ? 4.4 : 4.6,
        })
        if ('imageUrl' in submitted && submitted.imageUrl) {
          return jsonResponse({ ok: true, imageUrl: submitted.imageUrl, composeMode: 'desk-still', prompt }, 200)
        }
        return jsonResponse(
          {
            ok: true,
            pending: true,
            statusUrl: submitted.statusUrl,
            responseUrl: submitted.responseUrl,
            composeMode: 'desk-still',
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
              message: '이미지 엔진이 이 요청을 거절했어요. 같은 버튼을 다시 눌러 주세요. (성인 장면은 허용됩니다.)',
            },
            422,
          )
        }
        return jsonResponse({ ok: false, error: 'desk_still_failed', message }, 502)
      }
    }

    if (composeMode === 'restage-pose') {
      try {
        const poseId = String(body.poseId || '').trim() || 'side'
        const prompt = restagePosePrompt({
          poseId,
          descriptionKo,
          g0: genderWord(body.gender0) || 'adult woman',
          g1: genderWord(body.gender1) || 'adult man',
        })
        const submitted = await submitFalKontextEdit({
          falKey: env.FAL_KEY,
          imageUrl: images[0],
          prompt,
          tier: 'pro',
          guidanceScale: 4.8,
        })
        if ('imageUrl' in submitted && submitted.imageUrl) {
          return jsonResponse(
            { ok: true, imageUrl: submitted.imageUrl, composeMode: 'restage-pose' },
            200,
          )
        }
        return jsonResponse(
          {
            ok: true,
            pending: true,
            statusUrl: submitted.statusUrl,
            responseUrl: submitted.responseUrl,
            composeMode: 'restage-pose',
          },
          200,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown_error'
        return jsonResponse({ ok: false, error: 'restage_pose_failed', message }, 502)
      }
    }

    // 한글 장면 → 모델용 영어 (Claude/Workers AI). 정책·행동 키워드는 한글 원문 기준.
    let description = descriptionKo
    try {
      const tr = await translateDescriptionForImagePrompt(descriptionKo, env)
      if (tr.text?.trim()) description = tr.text.trim()
    } catch {
      /* 원문 유지 */
    }

    if (composeMode === 'extend-recolor') {
      try {
        if (!images[0]) {
          return jsonResponse({ ok: false, error: 'recolor_image_required' }, 400)
        }
        const clothHex =
          typeof body.sourceClothHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(body.sourceClothHex.trim())
            ? body.sourceClothHex.trim()
            : ''
        const target = String(body.recolorTarget || '')
        const cropOnly = target === 'pants' || target === 'jacket'
        const prompt =
          target === 'pants'
            ? buildDeskExtendPantsPrompt(clothHex)
            : target === 'jacket'
              ? buildDeskExtendJacketLightPrompt(clothHex)
              : buildDeskExtendRecolorPrompt(clothHex)
        const submitted = await submitFalKontextEdit({
          falKey: env.FAL_KEY,
          imageUrl: images[0],
          prompt,
          tier: 'pro',
          guidanceScale: 8.2,
          ...(cropOnly ? {} : { aspectRatio: '3:4' }),
        })
        if ('imageUrl' in submitted && submitted.imageUrl) {
          return jsonResponse({ ok: true, imageUrl: submitted.imageUrl, composeMode: 'extend-recolor' }, 200)
        }
        return jsonResponse(
          {
            ok: true,
            pending: true,
            statusUrl: submitted.statusUrl,
            responseUrl: submitted.responseUrl,
            composeMode: 'extend-recolor',
          },
          200,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown_error'
        return jsonResponse({ ok: false, error: 'extend_recolor_failed', message }, 502)
      }
    }

    // 자유 스튜디오. Desk 와 같은 엔진이지만 걸음·마스크·게이트가 없다.
    // 사용자가 적은 말을 영어로 옮겨 그대로 보낸다. 사진이 있으면 그 사진을 고치고, 없으면 글만으로 그린다.
    if (composeMode === 'free-still') {
      try {
        // aspectRatio 는 이 아래에서 선언되므로 여기서 따로 읽는다.
        const freeRatio =
          typeof body.aspectRatio === 'string' && body.aspectRatio.trim() ? body.aspectRatio.trim() : undefined
        const freeLook = String(body.deskLook || '')
        const editPrompt =
          freeLook === 'shape'
              ? buildDeskShapePrompt()
              : freeLook === 'extend-jacket'
                ? buildDeskExtendJacketPrompt()
                : freeLook === 'extend-skirt'
                  ? buildDeskExtendSkirtPrompt()
                  : freeLook === 'extend-keep-light'
                    ? buildDeskExtendKeepLightPrompt(
                        typeof body.sourceClothHex === 'string' &&
                          /^#[0-9A-Fa-f]{6}$/.test(body.sourceClothHex.trim())
                          ? body.sourceClothHex.trim()
                          : '',
                      )
                    : description
        const keepLightRefs = freeLook === 'extend-keep-light' && images.length >= 2
        const submitted = keepLightRefs
          ? await submitFalKontextMultiImage({
              falKey: env.FAL_KEY,
              imageUrls: [
                images[0].startsWith('data:')
                  ? await uploadDataUrlToFal(env.FAL_KEY, images[0], `keep-light-${Date.now()}-0.jpg`, {
                      maxBytes: MAX_REFERENCE_BYTES,
                      tooLargeError: 'reference_image_too_large',
                    })
                  : images[0],
                images[1].startsWith('data:')
                  ? await uploadDataUrlToFal(env.FAL_KEY, images[1], `keep-light-${Date.now()}-1.jpg`, {
                      maxBytes: MAX_REFERENCE_BYTES,
                      tooLargeError: 'reference_image_too_large',
                    })
                  : images[1],
              ],
              prompt: editPrompt,
              aspectRatio: typeof freeRatio === 'string' ? freeRatio : '3:4',
              guidanceScale: 8.2,
            })
          : images.length
          ? await submitFalKontextEdit({
              falKey: env.FAL_KEY,
              imageUrl: images[0],
              prompt: editPrompt,
              tier: 'pro',
              guidanceScale:
                freeLook === 'extend-jacket' ||
                freeLook === 'extend-skirt' ||
                freeLook === 'extend-keep-light' ||
                freeLook === 'shape'
                  ? 8.2
                  : 4.2,
            })
          : await submitFalTextToImage({
              falKey: env.FAL_KEY,
              prompt: description,
              imageSize: aspectRatioToFalSize(freeRatio),
              falModel: env.FAL_MODEL_ID?.trim() || 'fal-ai/flux-2-pro',
            })
        if ('imageUrl' in submitted && submitted.imageUrl) {
          return jsonResponse(
            { ok: true, imageUrl: submitted.imageUrl, composeMode: 'free-still', prompt: editPrompt },
            200,
          )
        }
        return jsonResponse(
          {
            ok: true,
            pending: true,
            statusUrl: submitted.statusUrl,
            responseUrl: submitted.responseUrl,
            composeMode: 'free-still',
            prompt: editPrompt,
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
              message: '이미지 엔진이 이 요청을 거절했어요. 말을 조금 바꿔서 다시 눌러 주세요.',
            },
            422,
          )
        }
        return jsonResponse({ ok: false, error: 'free_still_failed', message }, 502)
      }
    }

    if (composeMode === 'scene-bg') {
      try {
        const mask = images[1]
        if (!mask) {
          return jsonResponse({ ok: false, error: 'background_mask_required' }, 400)
        }
        const prompt = [
          'Photoreal photograph. Fill ONLY the empty/white/gray background with ONE continuous light studio wall and floor.',
          `Scene mood: ${description}.`,
          'The two people already in the photo must stay pixel-identical — do not redraw faces, hair, clothes, hands, or bodies.',
          'FORBIDDEN split panels, two backdrop cards, oval mats, vertical seam, collage, extra people.',
          'Adult 18+.',
        ].join(' ')
        const submitted = await submitFalInpaint({
          falKey: env.FAL_KEY,
          imageUrl: images[0],
          maskUrl: mask,
          prompt,
          negativePrompt:
            'changed face, new person, collage, ID photo card, split panel, oval backdrop, extra limbs',
          strength: 0.82,
        })
        if ('imageUrl' in submitted && submitted.imageUrl) {
          return jsonResponse(
            { ok: true, imageUrl: submitted.imageUrl, composeMode: 'scene-bg' },
            200,
          )
        }
        return jsonResponse(
          {
            ok: true,
            pending: true,
            statusUrl: submitted.statusUrl,
            responseUrl: submitted.responseUrl,
            composeMode: 'scene-bg',
          },
          200,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown_error'
        return jsonResponse({ ok: false, error: 'scene_bg_failed', message }, 502)
      }
    }

    const aspectRatio =
      typeof body.aspectRatio === 'string' && body.aspectRatio.trim() ? body.aspectRatio.trim() : undefined

    const refKindEarly = body.refKind === 'body' ? 'body' : body.refKind === 'pose' ? 'pose' : 'face'
    const photorealEarly = body.photoreal !== false
    // 얼굴로 장면(1·2인): Kontext에 증명사진을 넣으면 콜라주·서양인 교체·검은 화면이 반복됨.
    // 장면 골격만 텍스트로 그리고, 얼굴은 클라이언트가 InsightFace로 씌운다.
    if (photorealEarly && refKindEarly === 'face') {
      if (isFaceSceneAdultRequest(descriptionKo)) {
        return jsonResponse(
          {
            ok: false,
            error: 'face_scene_adult_not_allowed',
            message: FACE_SCENE_ADULT_MESSAGE,
          },
          422,
        )
      }
      const g0e = genderWord(body.gender0) || 'woman'
      const g1e = genderWord(body.gender1) || 'man'
      const expressionMode: 'id' | 'scene' = body.expressionMode === 'scene' ? 'scene' : 'id'
      const couple = images.length >= 2
      const [look0, look1] = await Promise.all([
        describeIdLookForSkeleton(env, images[0], g0e),
        couple ? describeIdLookForSkeleton(env, images[1], g1e) : Promise.resolve(''),
      ])
      const detected = detectSceneActionLines(descriptionKo)
      const actionLinesE = couple
        ? detected.length
          ? detected
          : [
              'CRITICAL POSE: standing side by side, both facing roughly toward camera or slightly toward each other.',
            ]
        : detected
      const composePrompt = couple
        ? buildFaceCoupleComposePrompt({
            description,
            descriptionKo,
            g0: g0e,
            g1: g1e,
            look0,
            look1,
            expressionMode,
            actionLines: actionLinesE,
          })
        : buildFaceSoloComposePrompt({
            description,
            descriptionKo,
            g0: g0e,
            look0,
            expressionMode,
            actionLines: actionLinesE,
          })
      try {
        const submitted = await submitFalTextToImage({
          falKey: env.FAL_KEY,
          prompt: composePrompt,
          imageSize: aspectRatioToFalSize(aspectRatio),
          falModel: env.FAL_MODEL_ID?.trim() || 'fal-ai/flux-2-pro',
        })
        if ('imageUrl' in submitted && submitted.imageUrl) {
          return jsonResponse(
            {
              ok: true,
              imageUrl: submitted.imageUrl,
              prompt: composePrompt,
              composeMode: 'text2img',
              needsFaceLock: true,
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
            prompt: composePrompt,
            composeMode: 'text2img',
            needsFaceLock: true,
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
              message:
                '이미지 엔진이 이 요청을 거절했어요. 장면 설명을 조금 바꿔 다시 시도해 주세요. (성인 장면은 허용됩니다. 미성년·비동의·실존 연예인만 불가)',
            },
            422,
          )
        }
        return jsonResponse({ ok: false, error: 'generation_failed', message }, 502)
      }
    }

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
    const mentionsManWoman = /남녀|남자.{0,4}여자|여자.{0,4}남자|man\s+and\s+woman|couple/i.test(
      descriptionKo,
    )
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
    const wantsKissAction = /키스|입맞춤|입\s*(?:을\s*)?맞추|kiss/i.test(descriptionKo)
    const wantsBackHugAction =
      !wantsKissAction &&
      /백\s*허그|뒤에서\s*(?:안|껴안|감싸)|등\s*뒤에서|back\s*hug|hug(?:s|ging)?\s*(?:her\s*)?from\s*behind|from\s*behind/i.test(
        descriptionKo,
      )
    const wantsHugAction =
      !wantsKissAction &&
      !wantsBackHugAction &&
      /포옹|안(?:다|고|은|아)|껴안|hug|embrace/i.test(descriptionKo)
    const wantsArmInArmAction =
      !wantsKissAction &&
      !wantsBackHugAction &&
      !wantsHugAction &&
      /팔짱|데이트|arm\s*in\s*arm|walking\s*(?:arm\s*in\s*arm|together)/i.test(descriptionKo)
    const actionReinforcement = wantsKissAction
      ? [
          'CRITICAL ACTION: they are kissing on the lips now — heads tilted toward each other, lips touching. FORBIDDEN both facing camera with faces apart.',
          'CRITICAL COMPOSITION: one continuous full-color photo of the couple kissing (waist-up or full body OK). FORBIDDEN contact sheet, collage, or separate headshot panels.',
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
    const multiPerson = imageUrls.length >= 2
    const expressionMode = body.expressionMode === 'scene' ? 'scene' : 'id'
    const expressionClause =
      expressionMode === 'id'
        ? [
            'EXPRESSION LOCK (ID / passport):',
            'Keep each person’s facial expression as in their reference — same mouth, eyes, brow.',
            'Neutral ID face stays calm/neutral. FORBIDDEN: inventing a smile or different emotion.',
            'Pose and action may change; identity and expression must not.',
          ].join(' ')
        : [
            'EXPRESSION MODE (scene-driven):',
            'Expression may adapt slightly to the scene, but bone structure, ethnicity, and identity stay identical — FORBIDDEN a different person.',
          ].join(' ')

    // 나체 요청에 "Clothed tasteful"을 넣으면 의도·검은화면 모두 악화 → 의상 편향 문구 제거.
    // (검은 화면은 클라이언트 isNearlyBlackImage로 실패 처리)

    // 증명사진(얼굴 크롭)·전신 모두: 장면 텍스트가 얼굴을 덮어쓰면 서양인 스톡 커플로 바뀌는 실측.
    // Kontext tip: "while keeping … face identical" + 맨 앞·맨 뒤 반복.
    const facePixelLock = multiPerson
      ? [
          'FACE LOCK FIRST (highest priority — do before pose/clothes/place):',
          "Person A's face = near-copy of reference image 1 (eyes, nose, mouth, jaw, age, ethnicity, skin tone, hairline, hair color).",
          "Person B's face = near-copy of reference image 2.",
          'while keeping each face identical to its own reference photo',
          'FORBIDDEN: Western/Caucasian beauty-model replacement, beauty-filtered stranger, different ethnicity, different age, swapped A/B faces, celebrity look-alike.',
        ].join(' ')
      : [
          'FACE LOCK FIRST (highest priority — do before pose/clothes/place):',
          "This person's face = near-copy of the reference photo (eyes, nose, mouth, jaw, age, ethnicity, skin, hair).",
          'while keeping the face identical to the reference photo',
          'FORBIDDEN: Western/Caucasian beauty-model replacement, different person, beauty-filter stranger, ethnicity or age change.',
        ].join(' ')

    // 얼굴 경로: 예전(커밋) 강락 복구 + FACE LOCK. 전신 경로는 체형 강조 유지.
    const otbeotgimLine = wantsOtbeotgim(descriptionKo)
      ? /남자 옷은 유지|남자는 상의만|두 사람|Keep the man|HE keeps|Only SHE undresses/i.test(
          descriptionKo,
        )
        ? `옷벗김: SHE undresses only. ${COUPLE_MAN_SHIRT_ONLY} FORBIDDEN removing his shirt or pants.`
        : '옷벗김: remove top AND pants/belt/panty. RESULT is FULL NUDE, same bust volume as the clothed mound — FORBIDDEN smaller breasts. FORBIDDEN a pants-on topless still.'
      : ''

    const identityFirstLock = multiPerson
      ? [
          'HIGHEST PRIORITY — IDENTITY & BODY LOCK (do this before anything else):',
          facePixelLock,
          'The first reference photo IS Person A. The second reference photo IS Person B.',
          "Keep Person A's exact face (bone structure, eyes, nose, mouth, age), ethnicity, skin tone, hairstyle, and body build from reference 1 — same shoulder width, chest/bust volume, waist, and overall silhouette visible in that photo.",
          "Keep Person B's exact face, ethnicity, skin tone, hairstyle, and body build from reference 2 — same proportions visible in that photo.",
          refKind === 'body'
            ? 'References are half-body or full-body photos: preserve torso proportions, breast/chest size, waist-hip silhouette, and limb thickness exactly — FORBIDDEN inventing a slimmer or bulkier fashion-model body or a different face.'
            : 'References are ID / face crops: extend to full body naturally, but each face must stay the SAME recognized person as in that crop — FORBIDDEN replacing them with different fashion models.',
          'FORBIDDEN: inventing new faces, beauty-filtered strangers, different ethnicity, different age, different body type (do not slim, bulk, enlarge, or shrink bust/shoulders/hips away from the references).',
          expressionMode === 'id'
            ? 'FORBIDDEN: treating the scene text as permission to redesign who they are — scene text only changes pose, place, clothes if asked, and action — NOT facial identity or expression.'
            : 'FORBIDDEN: treating the scene text as permission to redesign who they are — scene text only changes pose, place, clothes if asked, action, and mild expression.',
          'Copy each reference face as faithfully as possible (same person recognition) — slight makeup change OK, different person NOT OK.',
          'Adult subjects (18+). Photorealistic camera photo. Do not blank or censor the output.',
        ]
          .filter(Boolean)
          .join(' ')
      : [
          'HIGHEST PRIORITY — IDENTITY LOCK (do this before anything else):',
          facePixelLock,
          'The reference photo IS the only person in the new photo. Keep their exact face, ethnicity, skin tone, hairstyle, and visible body proportions.',
          refKind === 'body'
            ? 'Preserve face identity and torso proportions from the reference — FORBIDDEN inventing a different fashion-model face or body.'
            : 'If the reference is a face or ID crop: extend to a natural full body, but the face must stay the same recognized person — FORBIDDEN a different model.',
          'FORBIDDEN: inventing a new face, beauty-filtered stranger, different ethnicity, different age, or different body type.',
          'Copy the reference face as faithfully as possible (same person recognition).',
          expressionMode === 'id'
            ? 'Scene text only changes pose, place, and clothes if asked — NOT facial identity or expression.'
            : 'Scene text may change pose, place, clothes if asked, and mild expression — NEVER a different person’s face.',
          'Adult subject (18+). Photorealistic camera photo.',
        ]
          .filter(Boolean)
          .join(' ')

    const faceLockAgain = multiPerson
      ? 'FINAL CHECK: faces still match reference 1 and 2 exactly (same ethnicity and bone structure) — if a face drifted into a stranger or Western model, restore it from the references.'
      : 'FINAL CHECK: the face still matches the reference photo exactly — if it drifted into a stranger, restore it from the reference.'

    // 증명사진 2인 + 키스/포옹: FACE LOCK을 맨 앞에 두면 Kontext가 장면을 안 만들고
    // 참고 증명사진을 좌우로 붙이는 덤프가 실측됨 → 장면(행동) 우선, 닮음은 후순위(클라이언트에서 얼굴 교체).
    const sceneFirstMode = refKind === 'face' && multiPerson && actionReinforcement.length > 0

    const prompt = body.photoreal
      ? sceneFirstMode
        ? [
            'HIGHEST PRIORITY — SCENE COMPOSITION (do this first):',
            'Create ONE continuous full-color photograph of TWO adults interacting in the same frame.',
            `Scene: ${description}`,
            ...actionReinforcement,
            'Person A comes from reference image 1; Person B from reference image 2 — BOTH must appear together.',
            g0 && g1
              ? `Person A is a ${g0}; Person B is a ${g1}. Keep sexes. FORBIDDEN cloning Person A twice.`
              : 'FORBIDDEN cloning one person twice — two distinct people.',
            'FORBIDDEN: pasting the two ID/passport photos side by side, contact sheet, collage, grid, split panels, separate headshots.',
            'FORBIDDEN: only one person visible, man missing, woman duplicated left and right.',
            'Waist-up or full body OK. Natural interaction pose — not stiff passport stance facing camera.',
            'Faces should roughly resemble the references (ethnicity, age, hair) — exact pixel copy is NOT required at this step.',
            multiPerson ? antiDuplicationClause : '',
            'OUTPUT: one photorealistic camera photo. Adult subjects (18+).',
          ]
            .filter(Boolean)
            .join('\n')
        : [
            identityFirstLock,
            otbeotgimLine,
            expressionClause,
            multiPerson ? antiDuplicationClause : '',
            '',
            expressionMode === 'id'
              ? `Scene direction ONLY (pose / place / action — do NOT change identity, ethnicity, body type, or facial expression): ${description}`
              : `Scene direction (pose / place / action — do NOT change who the people are or their ethnicity): ${description}`,
            ...actionReinforcement,
            multiPerson
              ? 'Both Person A and Person B appear together in one photorealistic photo, full body visible when possible.'
              : 'One person only (the reference). Full body visible when possible. Natural lighting. Do not invent a second person.',
            'OUTPUT FORMAT: exactly ONE continuous full-color camera photograph.',
            'FORBIDDEN: contact sheet, collage, grid of portraits, multi-panel layout, split frames, black-and-white passport montage, separate headshots in rows.',
            'Match the photographic look of the reference photos (real camera photo, not illustration).',
            actionReinforcement.length
              ? expressionMode === 'id'
                ? 'The requested action must be visible, but NEVER change faces, ethnicity, body types, or the locked ID expression.'
                : 'The requested action must be visible, but NEVER at the cost of swapping or reinventing faces.'
              : '',
            faceLockAgain,
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
      // scene-first(키스 등): 장면 순응을 위해 guidance 조금 상향.
      // 전신·반신: 참고 이미지 쪽 3.2. 일반 얼굴 2인: 4.5.
      const guidanceScale = body.photoreal
        ? refKind === 'body'
          ? 3.2
          : sceneFirstMode
            ? 5.0
            : imageUrls.length >= 2
              ? 4.5
              : 3.5
        : undefined
      const submitted = await submitFalKontextMultiImage({
        falKey: env.FAL_KEY,
        imageUrls,
        prompt,
        aspectRatio,
        guidanceScale,
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
            message:
              '이미지 엔진이 이 요청을 거절했어요. 장면 설명을 조금 바꿔 다시 시도해 주세요. (성인 장면은 허용됩니다. 미성년·비동의·실존 연예인만 불가)',
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
