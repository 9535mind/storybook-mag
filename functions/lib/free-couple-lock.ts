/**
 * 자유 스튜디오 전용.
 * 커플 사진 + 키스/가슴이 솔로 몸매투영·스톡 서양 커플로 새는 실패를 막는다.
 */

const SELF_SOLO_RE = /자기|스스로|혼자|her\s+own\s+hands/i
const KISS_RE = /키스|입\s*(?:을\s*)?맞|입맞춤|kiss/i
const BREAST_RE = /가슴|젖가슴|유방|젖꼭지|breast|nipple/i
const PARTNER_RE = /여자(?:의)?\s*가슴|파트너|남자|그(?:가|의)\s*손|his\s+hand/i

export const COUPLE_NUDE_STILL_REVISION = [
  'Keep BOTH people from this photo. Same two Korean faces, same pose, same crop, same white studio background.',
  'The man stays fully clothed — same navy suit, same shoes, same face. Do NOT undress him. Do NOT change his face or hair.',
  'ONLY the woman becomes fully nude: bare breasts with nipples, bare crotch with a neat Korean-30s dark-brown curly mons patch. Same woman face, same hair, same age.',
  'Keep the hug / arm positions. Photorealistic.',
  'FORBIDDEN: solo portrait, dropping the man, undressing the man, a new face, Caucasian faces, bathroom, bathtub, tiles, hotel, ghost overlay, zoom.',
].join(' ')

const CAST =
  'CAST LOCK: copy BOTH faces from the input image — the same Korean man and the same Korean woman. Same white studio. Man stays clothed. Woman stays nude. FORBIDDEN a different couple, Caucasian, bathroom, bathtub, tiles, hotel, stock porn, a new person.'

const BEAT2_KISS_BREAST =
  'the same source man deep mouth-to-mouth kisses the same source woman while his hand stays on her bare breast. Kiss on the MOUTH plus hand on breast. FORBIDDEN kissing her breast instead of her mouth. FORBIDDEN dropping the man, a solo crop, undressing the man, bathroom, new faces.'

const BEAT2_KISS =
  'the same source man deep mouth-to-mouth kisses the same source woman — lips on lips, both faces visible. FORBIDDEN kissing her breast instead of her mouth. FORBIDDEN a different couple, bathroom, bathtub, Caucasian faces, dropping the man, a solo crop.'

const LAST_KISS_BREAST =
  'LAST FRAME: still the same two source people, still mouth-to-mouth kissing, his hand still on her bare breast. Woman still nude. Man still clothed. Do NOT return to the opening still. Do NOT put her clothes back on.'

const LAST_KISS =
  'LAST FRAME: still the same two source people, still mouth-to-mouth kissing. Woman still nude. Man still clothed. Do NOT return to the opening still. Do NOT put her clothes back on.'

export const FREE_COUPLE_CAM =
  'CAST LOCK: input-photo people only, same two people from THIS photo, same place. BOTH visible. Never zoom. FORBIDDEN new faces, Caucasian, bathroom, bathtub, tiles, fashion model. '

export const FREE_BREAST_KISS_CAM =
  'CAST LOCK: same two people from the input photo, same place. Intimate chest two-shot: his mouth on her bare breast, both faces visible. FORBIDDEN a different couple, Caucasian, bathroom, bathtub, tiles, new faces. '

const BEAT2_BREAST_KISS =
  'the same source man leans in and kisses her bare breast with his mouth — lips stay on her nipple/breast, continuous oral contact, not a peck, not a hand-only touch, not mouth-to-mouth. Both source faces stay recognizable. Woman stays fully nude. Man keeps his source face and age. FORBIDDEN a different couple, Caucasian faces, bathroom, dropping either person.'

const LAST_BREAST_KISS =
  'LAST FRAME: still the same two source people, his mouth still on her bare breast. Woman still nude. Man still the source man. Do NOT return to the opening still. Do NOT put her clothes back on. Do NOT switch to a different couple.'

export function isFreeBreastKissMotion(text: string): boolean {
  const t = text || ''
  if (!t) return false
  return (
    /(?:가슴|젖꼭지|유두|유방)\s*(?:에(?:다가)?|을|를)\s*(?:입\s*(?:을\s*)?맞|키스)/i.test(t) ||
    /키스\s*(?:를\s*)?(?:가슴|젖꼭지|유두|유방)/i.test(t) ||
    /kiss(?:es|ing)?\s*(?:her\s*)?(?:breast|nipple)/i.test(t) ||
    /mouth\s+on\s+(?:her\s*)?(?:breast|nipple)/i.test(t)
  )
}

export function isFreeCoupleIntimateMotion(text: string): boolean {
  const t = text || ''
  if (!t) return false
  if (SELF_SOLO_RE.test(t) && !KISS_RE.test(t)) return false
  const kiss = KISS_RE.test(t)
  const breast = BREAST_RE.test(t)
  return kiss || (breast && PARTNER_RE.test(t))
}

export function wantsCoupleBreastTouch(text: string): boolean {
  return BREAST_RE.test(text || '') && !SELF_SOLO_RE.test(text || '')
}

export function buildFreeCoupleVideoPrompt(
  motion: string,
  opts?: { alreadyNude?: boolean },
): string {
  const breastKiss = isFreeBreastKissMotion(motion)
  const kissOnly = !breastKiss && KISS_RE.test(motion) && !wantsCoupleBreastTouch(motion)
  const alreadyNude =
    opts?.alreadyNude === true || /이미\s*완전\s*나체|already fully nude/i.test(motion || '')
  const action = breastKiss
    ? 'ACTION: he leans to her chest and his mouth stays on her bare breast (lips on nipple), continuous, not a peck, not mouth-to-mouth. Intimate chest two-shot, both source faces visible.'
    : kissOnly
      ? 'ACTION: he deep mouth-to-mouth kisses her. Both source faces visible.'
      : 'ACTION: he mouth-to-mouth kisses her and his hand stays on her bare breast. Both source faces visible.'
  const nudeLine = alreadyNude
    ? 'She is already fully nude in THIS photo. Keep that same nude woman and the same clothed man. Do NOT undress. Do NOT replace bodies or faces.'
    : 'She becomes fully nude. He stays the same man from the photo (same face, same hair). Same room as the photo.'
  return [
    'IMAGE-TO-VIDEO of THIS photo only. Copy both faces exactly from the input: the same East-Asian Korean man and the same East-Asian Korean woman, same ages, same hair, same place as this photo. Do not move them to a studio.',
    nudeLine,
    action,
    'FORBIDDEN: a new person, replacing either face, Caucasian, Western porn couple, bathroom, bathtub, tiles, dropping the man, a different woman, fashion model.',
    'Last frame: still these two people, still the action, her clothes do not return.',
  ].join(' ')
}

export function applyFreeCoupleIntimateLock(prompt: string, motion: string): string {
  if (!prompt || !isFreeCoupleIntimateMotion(motion)) return prompt
  const breastKiss = isFreeBreastKissMotion(motion)
  const kissOnly = !breastKiss && KISS_RE.test(motion) && !wantsCoupleBreastTouch(motion)
  const beat = breastKiss ? BEAT2_BREAST_KISS : kissOnly ? BEAT2_KISS : BEAT2_KISS_BREAST
  const last = breastKiss ? LAST_BREAST_KISS : kissOnly ? LAST_KISS : LAST_KISS_BREAST
  let next = prompt.replace(/Same Korean woman:/g, 'Same two adults from the source photo:')
  next = next.replace(
    /BEAT 2 \(([^)]+)\):\s*[\s\S]*?(?= LAST FRAME:| User motion:|$)/i,
    `BEAT 2 ($1): ${beat} `,
  )
  next = `${CAST} ${next}`
  next = next.replace(/LAST FRAME:[\s\S]*?(?= User motion:|$)/i, `${last} `)
  return next.replace(/\s{2,}/g, ' ').trim()
}
