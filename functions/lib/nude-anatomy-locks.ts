/**
 * 나체 시 여성 해부(음모/유두/체형) 사실성 잠금 + 커플/연속샷 판별.
 * content-policy.ts에서 분리 — polishKoreanPromptText 외 다른 모듈 의존 없음.
 */
import { polishKoreanPromptText } from './korean-text'

// buildClothingSilhouetteBodyLock·buildNudeBodyShapeContinuityLock 둘 다 텍스트에서 큰 가슴/
// 슬림 허리/글래머 체형 언급을 같은 기준으로 감지해 왔다 — 예전엔 동일한 정규식 리터럴이
// 두 함수에 복사돼 있어서 한쪽만 고치면 갈라지는 위험이 있었다. 하나로 통합.
const LARGE_BUST_MENTION_PATTERN =
  /큰\s*가슴|풍만\s*가슴|거유|글래머|busty|large\s*breasts?|full\s*bust|voluptuous/i
const SLIM_WAIST_MENTION_PATTERN =
  /가는\s*허리|얇은\s*허리|잘록|개미\s*허리|슬림\s*허리|wasp\s*waist|slim\s*waist|narrow\s*waist/i
const CURVY_HOURGLASS_MENTION_PATTERN = /글래머|풍만|curvy|hourglass|글래머체/i

/** 음모·체모만 손보자는 수정인지 (쇼츠/전역 나체 락과 분리 — 요청 시에만) */
export function wantsPubicHairOnlyRefine(revision: string): boolean {
  const t = polishKoreanPromptText(revision || '')
  return /음모|치모|체모|곱슬\s*음모|pubic\s*hair|\bbush\b/i.test(t)
}

/** 제모·민무늬를 아주 명시했을 때만 true (bare/smooth 같은 약한 단어로는 허용하지 않음) */
export function wantsExplicitPubicShave(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  return /제모|민무늬|쉐이븐|왁싱|waxed|shaved\s*(pubic|bush|crotch)?|no\s*pubic\s*hair|음모\s*(없|제거|밀)/i.test(
    t,
  )
}

/**
 * 탈의·나체 시 성별/가슴 드리프트 방지 (헐렁한 옷 → 중성·남성 근육형으로 바뀌는 실측).
 */
export function buildFemaleAdultAnatomyLock(text = ''): string {
  const t = polishKoreanPromptText(text || '')
  const large = /큰\s*가슴|풍만|거유|글래머|busty|large\s*breasts?/i.test(t)
  const small = /작은\s*가슴|빈유|small\s*breasts?/i.test(t)
  const bust =
    large
      ? 'clear soft female breasts with full volume'
      : small
        ? 'clear soft female breasts, smaller natural volume — still unmistakably female, not flat male pecs'
        : 'clear soft adult female breasts with natural soft tissue volume (not flat, not male pectorals)'
  return [
    'SEX LOCK: the subject is an adult WOMAN — feminine face, female body, female chest',
    `${bust}, visible female nipples when nude`,
    'nipples/areola: plain natural skin, soft pinkish-brown, smooth continuous tone — FORBIDDEN spiral, swirl, ring, target, pinwheel, tattoo, or any printed graphic pattern on the breast',
    'FORBIDDEN: male or androgynous flat chest, bodybuilder pecs, six-pack masculinization, turning her into a man',
    'FORBIDDEN: leaving jeans/pants/underwear on when nude/undress is requested — remove lower garments completely',
  ].join('. ')
}

/**
 * 성인 여성 음모·외음 — 기본 강제(곱슬 가닥 + 현실적 비율).
 * 민무늬·점묘 텍스처·과도하게 다문 “인형형” 금지. 명시적 제모만 예외.
 */
export function buildAdultPubicHairLock(text = ''): string {
  const t = polishKoreanPromptText(text || '')
  if (wantsExplicitPubicShave(t)) {
    return 'pubic area smooth/shaved ONLY because the user explicitly requested shaving/waxing'
  }
  return [
    'MANDATORY photorealistic adult pubic hair: soft dark-brown natural CURLS with visible separate strands on the mons pubis (곱슬·가닥)',
    'hair looks like real coiled hair in soft clumps — NOT grainy stipple, NOT sandpaper noise, NOT 5-o’clock shadow stubble, NOT a painted ink blob',
    'COMPACT SHAPE: a modest, neatly-contained patch centered on the mons pubis only — NOT spreading wide onto the inner thighs or groin creases, NOT scraggly stray wisps trailing outward at the edges; a clean, soft-edged perimeter',
    'DENSE VOLUME within that compact patch: full, curly, richly coiled hair packed close together — not sparse or thin, not a harsh horizontal band',
    'vulva anatomy realistic for an adult woman: soft natural labia, gentle cleft — NOT clamped tightly shut, NOT oversized sealed Barbie seam, NOT cartoon slit',
    'CRITICAL SAFETY: FORBIDDEN hairless/smooth blank crotch that reads as non-adult',
    'FORBIDDEN: fabric underwear, thong, briefs, lace bottoms covering the crotch — bare skin + natural hair only',
    'not a male happy trail to the navel; feminine mons bush shape',
  ].join('. ')
}

/** 체모만 사실적으로 — 마스크 inpaint / 국소 img2img용 짧은 프롬프트 */
export function buildRealisticPubicHairRefinePrompt(revision: string): string {
  const t = polishKoreanPromptText(revision || '')
  if (wantsExplicitPubicShave(t)) {
    return [
      'Local edit of the masked pubic area only.',
      'Smooth shaved bare pubic skin as explicitly requested. No dense bush.',
      'Do not change face, breasts, pose, or background outside the mask.',
    ].join(' ')
  }
  return [
    'Local edit of the masked pubic area only.',
    'Photorealistic adult refine: replace grainy/stubble faux-hair with real soft dark-brown curly strands and small coils; natural bush volume on the mons.',
    'Relax an overly clamped/sealed vulva seam into a soft natural adult labial contour — modest and realistic, not exaggerated.',
    buildAdultPubicHairLock(t),
    'Not a male happy trail climbing to the navel; skin above the mons stays bare — no underwear fabric.',
    'Do not change face, breasts, pose, lighting, or background outside the mask.',
    t ? `User note: ${t}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/** 유두·유륜 크기/형태만 */
export function wantsNippleAreolaRefine(revision: string): boolean {
  const t = polishKoreanPromptText(revision || '')
  return /유두|유륜|젖꼭지|유두\s*륜|nipple|areola/i.test(t)
}

export function buildNippleAreolaRefinePrompt(revision: string): string {
  const t = polishKoreanPromptText(revision || '')
  const larger = /크|크게|키우|커지|larger|bigger|enlarge/i.test(t)
  return [
    'Local edit of the masked breast area only.',
    larger
      ? 'Slightly larger nipples and areolae, natural round areola shape, soft pinkish-brown tone, realistic texture — modest enlarge, not cartoonish.'
      : 'Refine nipple and areola shape to look natural and clear, soft pinkish-brown, realistic texture.',
    'Keep the same breast size/shape and the same woman. Do not change face, hair, pose, or background outside the mask.',
    t ? `User note: ${t}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * 가슴 높이 — 사용자가 직접 고르는 명시적 오버라이드.
 * "애매할 때만 살짝 더 낮게" 자동 추정이 여러 번 빗나간다는 사용자 피드백(2026-08-27)에
 * 따라, 옷 실루엣/팔꿈치 랜드마크로 추측하는 대신 사용자가 높게/중간/낮게를 직접 못박을
 * 수 있게 한다. 'auto'(기본, 미선택)면 빈 문자열 — 기존 추정 로직을 그대로 쓴다.
 */
export type BustHeightPreference = 'auto' | 'high' | 'mid' | 'low'

export function buildBustHeightPreferenceLine(pref?: string): string {
  switch (pref) {
    case 'high':
      return 'BUST HEIGHT (user override, follow this over any clothing-based guess): breasts HIGH-set, lifted toward the upper chest near the collarbone, perkier rounded profile.'
    case 'mid':
      return 'BUST HEIGHT (user override, follow this over any clothing-based guess): breasts at a NATURAL MID height on the chest — neither lifted high nor drooping low.'
    case 'low':
      return 'BUST HEIGHT (user override, follow this over any clothing-based guess): breasts LOW-set and relaxed, closer to mid-upper-arm/elbow height — not lifted, not perky.'
    default:
      return ''
  }
}

/**
 * 옷이 달라붙어 보이는 실루엣 = 나체/영상에서도 같은 몸매.
 * (타이트한 상의의 큰 가슴 → 나체에 바비형 빈유로 바뀌는 실망 방지)
 */
export function buildClothingSilhouetteBodyLock(text = '', bustHeight?: string): string {
  const t = polishKoreanPromptText(text || '')
  const heightOverride = buildBustHeightPreferenceLine(bustHeight)
  const bits = [
    'CLOTHING SILHOUETTE → BODY LOCK: read breast size, waist, hips, and overall figure from how the clothes fit in the source photo — nude or video must match that implied body, not a generic Barbie doll',
    heightOverride ||
      'BUST HEIGHT from arm landmarks: compare the chest mound under the shirt to the shoulder, upper arm (bicep), and elbow — if fabric volume sits low toward mid-upper-arm / near elbow height, keep LOWER-set breasts (not high Barbie bust under the collarbone)',
    heightOverride
      ? ''
      : 'if the arm/elbow landmarks are unclear or hard to read from the photo, default to a slightly LOWER, natural relaxed bust placement rather than a lifted/perky high-set one — a natural drop is safer than an artificially raised bust when in doubt',
    'BUST VOLUME from chest print/ruffles: if lettering or lace sits on a forward-projecting chest and the tee/blouse lifts off the ribs, read FULL adult volume about full-C to D cup — FORBIDDEN collapsing to flat 빈유 or tiny A/B when the clothed chest clearly projects',
    'if the outfit shows a full/large bust under fabric, keep LARGE full breasts when nude — FORBIDDEN tiny barbie breasts, flat doll chest, or shrinking the bust after undress',
    'if frontal clothing makes bust hard to read, prefer soft FULL breast volume (볼륨감, ~C½–D) over flat empty 빈유 — volume is safer than underestimating',
    'pendant / gourd-like (표주박) hang is OK when the clothed silhouette is long and low — do not auto-lift breasts to a perky high set',
    'if the outfit shows a narrow/slim waist, keep that slim waist — do not thicken the midsection',
    'if the outfit shows wider hips or a curvy hourglass, keep that hip/waist ratio when nude',
  ]
  if (LARGE_BUST_MENTION_PATTERN.test(t)) {
    bits.push('text confirms large bust — preserve generous breast volume and projection when nude')
  }
  if (SLIM_WAIST_MENTION_PATTERN.test(t)) {
    bits.push('text confirms slim waist — keep a narrow cinched waist')
  }
  if (CURVY_HOURGLASS_MENTION_PATTERN.test(t)) {
    bits.push('curvy hourglass continuity — full bust, defined waist, hips matching the clothed silhouette')
  }
  return bits.filter(Boolean).join('. ') + '.'
}

/**
 * 정지 이미지 나체 전용 체형 유지 잠금 — buildClothingSilhouetteBodyLock과 의도(같은 체형
 * 유지)는 같지만, "shirt/blouse/fabric/tee/lace/collarbone/outfit/Barbie" 같은 의류 어휘를
 * 전혀 쓰지 않는다. 실측(Replicate SDXL/Juggernaut img2img, strength 0.72~0.85)으로 확인된
 * 회귀: 이 프롬프트가 이미지 프롬프트에 "shirt/lace/bra/Barbie" 같은 토큰을 포함하면, 오히려
 * img2img가 그 토큰들을 근거로 브라·레이스 속옷을 다시 그려 넣어(정확히 이 잠금이 막으려던
 * "Barbie" 결과가 그대로 재현됨) 탈의 자체가 실패하는 사고가 재현 확인됐다 — 부정형 지시라도
 * 명사 토큰 자체가 그 개념을 다시 불러온다. 정지 이미지 나체 경로(쇼츠/영상 경로는 별개—
 * buildClothingSilhouetteBodyLock을 그대로 유지)에서만 이 의류-무관 버전을 쓴다.
 */
export function buildNudeBodyShapeContinuityLock(text = ''): string {
  const t = polishKoreanPromptText(text || '')
  const bits = [
    'BODY SHAPE CONTINUITY: keep the exact same breast size, waist width, and hip width the person already has — do not shrink, flatten, or generic-ify the figure into a smaller doll-like body',
    'Preserve natural adult breast volume and shape at their existing size — FORBIDDEN tiny flat chest, FORBIDDEN unrealistic oversized breasts; match the existing proportions',
  ]
  if (LARGE_BUST_MENTION_PATTERN.test(t)) {
    bits.push('text confirms large bust — preserve generous breast volume and projection')
  }
  if (SLIM_WAIST_MENTION_PATTERN.test(t)) {
    bits.push('text confirms slim waist — keep a narrow cinched waist')
  }
  if (CURVY_HOURGLASS_MENTION_PATTERN.test(t)) {
    bits.push('curvy hourglass continuity — full bust, defined waist, matching hip width')
  }
  return bits.join('. ') + '.'
}

/**
 * 팬티 대신 생기는 뿌연 장애물(블러·안개·김·피부색 얼룩) 금지.
 * Wan 등이 「no panties」를 검열 스머지로 대체하는 회귀 방지.
 */
export function buildNudeCensorFogBanLock(): string {
  return [
    'CENSOR/FOG BAN: FORBIDDEN any foggy blur, milky haze, steam cloud, soft white/beige smudge, cloudy obstacle, mosaic, pixelation, censor bar, or skin-colored smear covering the crotch, mons, or genitals — those are fake underwear substitutes.',
    'Require a sharp in-focus bare crotch (uncensored) — NOT shaved-blank “doll” skin: keep natural adult pubic hair with visible curly strands on the mons unless the user explicitly asked for shaving/waxing.',
    'Clear = no blur/fog covering the area; pubic hair stays visible and photorealistic.',
    // 실측(2026-08-22): 팬티/브라를 지우라고만 하면 대신 "브라·팬티 무늬가 비쳐 보이는
    // 반투명 레이스 잠옷"을 그려서 절충하는 사고가 있었다 — 실제로는 안 벗은 것과 같다.
    'FORBIDDEN sheer/see-through lace, mesh, netted, or embroidered-pattern fabric that still outlines a bra/panty shape underneath — a translucent negligee printed with an underwear silhouette is NOT nudity and counts as still-clothed; skin must be bare, not veiled by patterned sheer cloth.',
  ].join(' ')
}

/**
 * 같은 인물(들)·같은 배경·같은 카메라로 한 샷을 유지 — 인물 소실/교체/장면 전환 방지.
 * coupleRequested=true면 "두 사람 모두 계속 보여야 한다"를 명시해, 커플 영상에서
 * 한쪽이 중간에 사라지거나 다른 인물로 바뀌는 실측(고스팅/장면 이탈)을 억제한다.
 */
export function buildSingleContinuousShotLock(coupleRequested: boolean): string {
  // 실측(2026-08-22): 셔츠에 없던 "LOGO" 텍스트나 작은 속옷 아이콘 스티커 같은
  // 그래픽 환각이 튀어나온 사례 — 짧게 한 줄로 금지(길이 예산 아끼려 최소화).
  const noHallucinatedGraphics =
    ' FORBIDDEN inventing random text, logos, brand marks, graphic icons, or stickers on clothing/skin/background that were not in the source photo — plain fabric and skin only.'
  return (
    coupleRequested
      ? 'SINGLE CONTINUOUS SHOT (CRITICAL): this is ONE unbroken shot of the SAME two people, in the SAME room/background, from the SAME camera the entire time. FORBIDDEN: cutting to a different scene/background/room; either person disappearing, being replaced, or fading into a ghostly double-exposure; a third/different person appearing; the frame narrowing so only one of them is visible when the source shows two. Both people stay clearly visible together throughout unless the motion explicitly says one leaves the frame.'
      : 'SINGLE CONTINUOUS SHOT (CRITICAL): this is ONE unbroken shot of the SAME person, in the SAME room/background, from the SAME camera the entire time. FORBIDDEN: cutting to a different scene/background/room; a second/different person appearing or replacing her; a ghostly double-exposure or blurred duplicate figure overlapping her; any activity other than the requested action.'
  ) + noHallucinatedGraphics
}

/**
 * 나체 시 유두·성인 음모가 보이게 — 평활/검열·소아형 크롯치 편향 억제.
 * 제모 요청이면 smooth 유지.
 */
export function buildNudeAnatomyVisibilityLock(text: string): string {
  const t = polishKoreanPromptText(text || '')
  return [
    'visible nipples on bare breasts, uncensor nipples',
    buildAdultPubicHairLock(t),
    'no mosaic, no censor bar, no skin-smoothed away nipples or genitals',
    buildNudeCensorFogBanLock(),
    // 정지 이미지 전용: buildClothingSilhouetteBodyLock의 "shirt/blouse/lace/bra/Barbie" 어휘가
    // SDXL/Juggernaut img2img에서 오히려 속옷을 다시 그려 넣게 만드는 회귀가 실측됐다 → 의류
    // 무관 버전으로 교체(쇼츠/영상 경로는 이 함수를 쓰지 않으므로 영향 없음).
    buildNudeBodyShapeContinuityLock(t),
  ].join(', ')
}

/**
 * 「같은 얼굴 유지」「한 명만」은 수정 시 서버가 기본으로 건다(buildIroncladIdentityLock 등).
 * 사용자가 습관적으로 적으면 CLIP 예산을 낭비하고 변경 지시와 경쟁하므로 제거한다.
 */
export function stripDefaultContinuityEchoes(revision: string): string {
  let t = polishKoreanPromptText(revision || '')
  const patterns = [
    /같은\s*얼굴\s*(을\s*)?(유지|그대로)[.!,，。\s]*/gi,
    /얼굴\s*(을\s*)?(유지해|유지하|그대로\s*유지)[.!,，。\s]*(줘|주세요|요)?[.!,，。\s]*/gi,
    /체형\s*(과\s*|·\s*|,\s*)?얼굴\s*그대로\s*유지[.!,，。\s]*/gi,
    /얼굴\s*(과\s*|·\s*|,\s*)?체형\s*그대로\s*유지[.!,，。\s]*/gi,
    /체형\s*그대로\s*유지[.!,，。\s]*/gi,
    /얼굴\s*그대로\s*유지[.!,，。\s]*/gi,
    /몸매\s*그대로\s*유지[.!,，。\s]*/gi,
    /동일\s*인물\s*(유지)?[.!,，。\s]*/gi,
    /원본\s*얼굴\s*(유지)?[.!,，。\s]*/gi,
    /한\s*명만[.!,，。\s]*/gi,
    /한\s*사람만[.!,，。\s]*/gi,
    /일인만[.!,，。\s]*/gi,
    /keep\s*(the\s*)?same\s*face[.!,，。\s]*/gi,
    /same\s*face(?:\s*please)?[.!,，。\s]*/gi,
    /keep\s*(the\s*)?same\s*body[.!,，。\s]*/gi,
    /exactly\s*one\s*(?:woman|person|girl)[.!,，。\s]*/gi,
    /only\s*one\s*(?:woman|person|girl)[.!,，。\s]*/gi,
  ]
  for (const p of patterns) t = t.replace(p, ' ')
  return t
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*([.!,，。])\s*\1+/g, '$1')
    .replace(/^[.!,，。\s]+|[.!,，。\s]+$/g, '')
    .trim()
}

/**
 * 소스/수정문이 커플·2인 사진임을 언급하는지 판별. "한 명만 나와야 한다"는 방어적 잠금
 * (single-frame·one-woman 등)이 실제로는 두 명이 있는 사진(커플 나체화 등)과 정면으로
 * 충돌해서, 그 모순 신호 때문에 나체화 자체가 잘 안 먹히는 사고가 실측됐다 — 이 함수로
 * "한 명만" 계열 잠금을 커플 사진에서는 빼도록 공통 게이트를 둔다.
 */
export function mentionsCoupleOrSecondPerson(text: string): boolean {
  return /두\s*명|둘이|커플|연인|남자와|여성과|파트너|함께\s*있는|two\s*(?:people|persons|women|men)|couple|with\s*a\s*(?:man|woman|partner)/i.test(
    text || '',
  )
}
