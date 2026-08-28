/**
 * 몸매 투영(옷 → 나체 전환) 시 잔여물 금지 + 한국인 외모/체모 잠금.
 * content-policy.ts에서 분리 — korean-text.ts / face-locks.ts 외 다른 모듈 의존 없음.
 */
import { polishKoreanPromptText } from './korean-text'
import { buildSoftMouthFaceLock } from './face-locks'

export function buildUnderbustGarmentRemnantBanLock(): string {
  return [
    'UNDERBUST / TORSO REMNANT BAN (CRITICAL): ZERO belt, ZERO leather strap, ZERO waistband, ZERO buckle, ZERO shirt hem, ZERO tucked-fabric ridge under the breasts',
    'FORBIDDEN: brown/tan/cognac horizontal band wrapping the upper abdomen, wide flat belt left on after the top is gone, gold C-buckle remnant, tape-like strip, rectangle patch, hard seam line between breasts and navel',
    'If the source photo shows a thin brown leather belt or high-rise waistband on trousers — DELETE it entirely; do NOT convert it into a nude-body belt accessory',
    'The skin from the inframammary fold down through the navel must be continuous bare flesh — navel fully visible with no belt covering or sitting above it',
    'CRITICAL FAIL: topless woman still wearing the same waist belt from the clothed photo',
  ].join('. ')
}

/** 팬티 한 겹·두 겹·속옷 잔존 금지 */
export function buildPantyLayerBanLock(): string {
  return [
    'PANTY BAN (CRITICAL): ZERO panties, ZERO thong, ZERO briefs, ZERO underwear, ZERO lingerie bottoms, ZERO bikini bottoms',
    'FORBIDDEN: white panties, sheer panties, double-layer panties, darker panty outline under a lighter layer, gusset seam, elastic waistband on the hips, fabric covering the crotch or mons',
    'Pants/jeans/trousers leave first, then any underwear under them must also leave — never stop at panties-only',
    'Crotch must be bare adult skin (natural pubic hair ok) — no second fabric layer, no panty shadow',
  ].join('. ')
}

/**
 * 체형 기점(가슴·유두·허리·배꼽·보지) 고정 후 옷만 투명/제거.
 * 몸매 투영의 핵심 — 새 몸을 그리지 않고 기점 위에 맨살을 드러냄.
 */
export function buildBodyLandmarkNudeRevealLock(): string {
  return [
    'LANDMARK PREDICT then REVEAL: from the clothed photo, estimate nipples (유두), navel (배꼽), and pubic mound under the fabric',
    'NIPPLE HEIGHT: use shoulder → upper arm → elbow as rulers — place nipples where the clothed bust mound actually sits (often mid-upper-arm; lower-set if the mound reaches toward the elbow), not automatically under the collarbone',
    'BUST SIZE: if the chest fabric projects (print/ruffles riding on a full mound), keep soft FULL volume roughly full-C to D; when unsure between flat and full, choose fuller — FORBIDDEN 빈유 underestimation',
    'ANCHORS stay fixed after undress: breast mound centers, nipple height/spacing, waist pinch, navel on the midline, hip bones, pubic mound / crotch',
    'Remove clothing as a transparent overlay — top, dress, skirt, pants, jeans, trousers, belt, waistband, AND panties/shorts — redraw nude skin around those anchors; do not invent a new figure',
    buildUnderbustGarmentRemnantBanLock(),
    buildPantyLayerBanLock(),
    'waist width and torso length match the clothed silhouette exactly',
    'crotch and legs become bare at predicted landmarks — FORBIDDEN leaving pants, jeans, belt, or one/two layers of panties on after the top is gone',
  ].join('. ')
}

export function buildKoreanTwentiesLookLock(text: string): string {
  const t = polishKoreanPromptText(text || '')
  const otherNation =
    /중국인|일본인|태국|베트남|서양인|백인|흑인|chinese|japanese|thai|vietnamese|caucasian|african\s*american|southeast\s*asian/i.test(
      t,
    ) && !/한국|korean/i.test(t)
  if (otherNation) return ''
  const otherAge = /30대|40대|50대|60대|중년|노년|thirties|forties|fifties|middle[\s-]?aged|elderly/i.test(t)
  return [
    'ETHNICITY LOCK: clearly a Korean woman — Korean facial features (눈·코·턱 비율), natural Korean beauty / K-beauty look',
    // "teen" 단어를 넣지 말 것 — 정책/엔진이 "not teen"도 미성년 신호로 오탐해 나체를 통째로 막음
    otherAge ? '' : 'AGE LOCK: clearly an adult woman in her twenties (20대 성인) — mature adult face, not middle-aged',
    buildSoftMouthFaceLock(),
    'FORBIDDEN: drifting into Southeast Asian or Chinese stereotype face, wrong ethnicity, Westernized face swap',
  ]
    .filter(Boolean)
    .join('. ')
}

/**
 * 한국인 남성 체모 — 서양형 가슴·배 털 금지.
 * (한국 남성은 가슴·배가 거의 매끈한 편이 일반적)
 */
export function buildKoreanMaleBodyHairLock(): string {
  return [
    'KOREAN MALE BODY HAIR LOCK: every adult man in the frame has a nearly hairless smooth chest and abdomen — typical East Asian / Korean male torso',
    'Chest, pecs, stomach, and around the navel stay clean and mostly bare — only tiny sparse hairs OK, never a thick dark mat',
    'FORBIDDEN: dense Western chest hair, thick pectoral fur, heavy happy trail down the belly, hairy navel bush, ape-like torso hair, European body-hair stereotype',
  ].join('. ')
}
