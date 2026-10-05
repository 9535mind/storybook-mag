/**
 * 자유 스튜디오 전용. 8월 27일 사본은 「가슴 만지기」를 파트너 손으로 읽고
 * 「자기」를 못 본다. 동결본은 그대로 두고, 조립이 끝난 쇼츠 프롬프트만 고친다.
 */

const SELF_RE = /자기|자신(?:의|이|을|를)?|스스로|혼자|self[\s-]?touch|her\s+own|own\s+hands?/i
const BREAST_RE = /가슴|젖가슴|유방|젖꼭지|breast|chest|nipple/i
const TOUCH_RE =
  /만지|만져|만진|만졌|주무르|주물러|애무|쓰다듬|knead|squeez|fondl|caress|stroke|touch/i

const SELF_BEAT =
  'BOTH her own hands knead and squeeze her own bare breasts — nipples stay visible between fingers. FORBIDDEN a partner, modest covering, palms hiding nipples, or standing idle.'

const SELF_LAST =
  'LAST FRAME: still fully nude, BOTH her own hands still kneading her bare breasts. Do NOT return to the opening still pose. Do NOT put clothes back on.'

export function isFreeSelfBreastMotion(text: string): boolean {
  const t = text || ''
  if (!SELF_RE.test(t) || !BREAST_RE.test(t) || !TOUCH_RE.test(t)) return false
  // 「키스하고 여자의 가슴」은 파트너. 자기/혼자일 때만 본인 손.
  if (/키스|입\s*맞|입맞춤|kiss/i.test(t) && !/자기|자신|스스로|혼자/i.test(t)) return false
  return true
}

export function applyFreeSelfBreastLock(prompt: string, motion: string): string {
  if (!prompt || (!isFreeSelfBreastMotion(motion) && !isFreeSelfBreastMotion(prompt))) {
    return prompt
  }
  let next = prompt.replace(
    /BEAT 2 \(([^)]+)\):\s*(?:a consenting adult partner[\s\S]*?(?:breast|kiss)[\s\S]*?|a hand continuously[\s\S]*?|hold the fully nude pose[\s\S]*?)(?= LAST FRAME:| THREE-BEAT| User motion:|$)/i,
    `BEAT 2 ($1): ${SELF_BEAT} `,
  )
  if (!/her own hands knead/i.test(next)) {
    next = next.replace(/BEAT 2 \(([^)]+)\):\s*[\s\S]*?(?= LAST FRAME:| User motion:|$)/i, `BEAT 2 ($1): ${SELF_BEAT} `)
  }
  next = next.replace(/LAST FRAME:[\s\S]*?(?= User motion:|$)/i, `${SELF_LAST} `)
  return next.replace(/\s{2,}/g, ' ').trim()
}
