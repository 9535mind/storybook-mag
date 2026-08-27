/**
 * 귀걸이·목걸이·시계·팔찌 등 장신구만 국소 수정하는 프롬프트 빌더.
 * content-policy.ts에서 분리 — polishKoreanPromptText 외 다른 모듈 의존 없음.
 */
import { polishKoreanPromptText } from './korean-text'

/** 귀걸이·목걸이·시계 등 장신구만 — 전신 img2img strength↑로 인물이 사라지던 실측 분리 */
export function wantsJewelryAccessoryRefine(revision: string): boolean {
  const t = polishKoreanPromptText(revision || '')
  return /귀걸이|이어링|피어싱|목걸이|초커|팔찌|반지|시계|손목시계|워치|발찌|earring|necklace|choker|bracelet|piercing|jewelry|jewellery|\bwatch\b|wristwatch|anklet/i.test(
    t,
  )
}

/** 손목 시계·팔찌 — 귀 마스크가 아니라 손목 마스크로 라우팅 */
export function wantsWristAccessoryRefine(revision: string): boolean {
  const t = polishKoreanPromptText(revision || '')
  if (/귀걸이|이어링|earring|피어싱|piercing/i.test(t) && !/시계|워치|\bwatch\b|팔찌|bracelet|팔목/i.test(t)) {
    return false
  }
  return /시계|손목시계|워치|손목|팔목|팔찌|발찌|\bwatch\b|wristwatch|bracelet|anklet/i.test(t)
}

/** 목걸이 추가·제거·변경 */
export function wantsNecklaceRefine(revision: string): boolean {
  const t = polishKoreanPromptText(revision || '')
  return /목걸이|초커|펜던트|necklace|choker|pendant/i.test(t)
}

/** 목걸이 제거·없애기 */
export function wantsNecklaceRemove(revision: string): boolean {
  const t = polishKoreanPromptText(revision || '')
  if (!wantsNecklaceRefine(t)) return false
  return /제거|없애|지워|빼|삭제|벗어|빼고|없이|remove|delete|without|no\s*necklace/i.test(t)
}

/** 장신구만 추가/변경 — 얼굴·헤어·옷·배경·포즈 픽셀 유지 전제 */
export function buildJewelryAccessoryRefinePrompt(revision: string): string {
  const t = polishKoreanPromptText(revision || '')
  const wrist = wantsWristAccessoryRefine(t)
  const necklace = wantsNecklaceRefine(t)
  if (wrist && necklace) return buildWristAndNecklaceRefinePrompt(t)
  if (wrist) return buildWristWatchRefinePrompt(t)
  if (necklace) return buildNecklaceRefinePrompt(t)
  const butterfly = /나비|butterfly/i.test(t)
  return [
    'Local edit: ONLY change the masked ear/jewelry areas. Paint jewelry into the white mask only.',
    butterfly
      ? 'Add clearly visible butterfly-shaped dangling earrings on the visible ear(s) — ornate butterfly wing motif, metallic, readable at a glance.'
      : 'Add or change the requested jewelry on the SAME woman from the source photo.',
    'CRITICAL: keep the exact same face, hair, body, clothing, pose, background, and camera framing outside the mask — do not invent a new person or studio portrait.',
    'FORBIDDEN inventions: surgical/medical face mask, KF94, covering the mouth/nose, new buildings, extra walls, changed sky or trees.',
    'If the source is a profile, put the earring on the visible ear near the jaw/hairline. Do not blank the ear — the earring must be clearly visible.',
    t ? `Jewelry request: ${t}.` : '',
    'Photorealistic seamless inpaint, same lighting.',
  ]
    .filter(Boolean)
    .join(' ')
}

/** 손목에 시계/팔찌만 — 얼굴·옷·배경 유지 */
export function buildWristWatchRefinePrompt(revision: string): string {
  const t = polishKoreanPromptText(revision || '')
  const wantsWatch = /시계|워치|\bwatch\b|wristwatch/i.test(t)
  const wantsBracelet = /팔찌|bracelet/i.test(t)
  let addLine =
    'Add a clearly visible wristwatch on the most prominent visible wrist — slim metal or leather strap, readable watch face, fashion editorial.'
  if (wantsWatch && wantsBracelet) {
    addLine =
      'Add BOTH: a slim wristwatch on one wrist AND a slim elegant metal bracelet on the other wrist — both clearly visible, fashion editorial. Do not leave either wrist bare if both are in frame.'
  } else if (wantsBracelet && !wantsWatch) {
    addLine = 'Add a slim elegant bracelet on the most visible wrist — metallic, clear, fashion editorial.'
  }
  return [
    'Local edit: ONLY change the masked wrist areas. Paint accessory onto visible wrists only.',
    addLine,
    'CRITICAL: keep the exact same face, hair, body, clothing, pose, background, and camera framing. Do not invent a new person.',
    'FORBIDDEN: surgical face mask, new buildings, changing outfit or hair, blanking wrists without the requested accessory.',
    'If wrists are not in frame, do not invent arms from a close-up crop — leave the image unchanged rather than inventing a new pose.',
    t ? `Accessory request: ${t}.` : '',
    'Photorealistic seamless inpaint, same lighting.',
  ]
    .filter(Boolean)
    .join(' ')
}

/** 목걸이만 추가/제거 */
export function buildNecklaceRefinePrompt(revision: string): string {
  const t = polishKoreanPromptText(revision || '')
  const remove = wantsNecklaceRemove(t)
  return [
    'Local edit: ONLY change the masked neck/chest necklace area.',
    remove
      ? 'REMOVE the necklace, chain, cross pendant, and any neck jewelry completely. Bare clean neck and upper chest skin matching the source. No chain shadow leftover.'
      : 'Add or change the necklace as requested on the SAME woman — clear pendant/chain, fashion editorial.',
    'CRITICAL: keep the exact same face, hair, blouse, pose, background, and framing. Do not invent a new person or change clothing.',
    'FORBIDDEN: surgical face mask, new buildings, changing outfit.',
    t ? `Necklace request: ${t}.` : '',
    'Photorealistic seamless inpaint, same lighting.',
  ]
    .filter(Boolean)
    .join(' ')
}

/** 손목 액세서리 + 목걸이 처리(제거 포함) 한 번에 */
export function buildWristAndNecklaceRefinePrompt(revision: string): string {
  const t = polishKoreanPromptText(revision || '')
  const wantsWatch = /시계|워치|\bwatch\b|wristwatch/i.test(t)
  const wantsBracelet = /팔찌|bracelet/i.test(t)
  const removeNecklace = wantsNecklaceRemove(t)
  const wristLine =
    wantsWatch && wantsBracelet
      ? 'On the wrists: add a slim wristwatch on one wrist AND a slim metal bracelet on the other — both clearly visible.'
      : wantsBracelet
        ? 'On the wrists: add a slim elegant bracelet on the most visible wrist.'
        : 'On the wrists: add a clearly visible slim wristwatch on the most prominent wrist.'
  const neckLine = removeNecklace
    ? 'On the neck: REMOVE the necklace, chain, and cross pendant completely — bare clean neck matching the skin, no leftover chain.'
    : 'On the neck: apply the necklace change as requested.'
  return [
    'Local edit: ONLY change the masked wrist and neck areas.',
    wristLine,
    neckLine,
    'CRITICAL: keep the exact same face, hair, clothing (white blouse, red skirt), pose, studio white background, and framing. Same woman.',
    'FORBIDDEN: surgical face mask, new buildings, changing outfit or hair, inventing a new person.',
    t ? `Request: ${t}.` : '',
    'Photorealistic seamless inpaint, same lighting.',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * 한 장 안에서 좌우로 옷/색/몸이 갈라진 생성 오류 수정
 * (두 패널 크롭과 다름 — 세로 이음새·반반 색 통일)
 */
export function wantsSplitCompositeFix(revision: string): boolean {
  const t = polishKoreanPromptText(revision || '')
  return /갈라|반반|세로\s*나|이음|통일|하나로|한\s*벌|색\s*하나로|split\s*(?:color|outfit|composite)|half[\s-]?and[\s-]?half|merged\s*twin|세로\s*분할/i.test(
    t,
  )
}

/** 한 장·한 사람·한 옷으로 되돌리는 짧은 수정 프롬프트 */
export function buildSplitCompositeFixPrompt(revision: string): string {
  const t = polishKoreanPromptText(revision || '')
  return [
    'Image-to-image repair of ONE photo of ONE woman.',
    'CRITICAL: the source wrongly shows a vertical split — left and right halves differ in clothing color or look fused. Unify into a single coherent person and a single outfit color across the whole torso.',
    'No vertical seam down the middle, no half-and-half garment, no side-by-side twin inside one frame.',
    'Keep the same face identity. Prefer the clearer half of the face/outfit if they conflict.',
    'Photorealistic single portrait, not a diptych.',
    t ? `User note: ${t}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}
