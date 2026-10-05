/**
 * 얼굴/입 고정 잠금 문구 — 탈의·수정 시 얼굴이 드리프트하지 않도록.
 * content-policy.ts에서 분리 — 다른 모듈에 의존하지 않는 독립 유틸.
 */

/**
 * 입·이빨 과장 억제 — 이빨을 과하게 드러내면 서양형/다른 사람으로 드리프트하는 실측.
 * (입을 열었을 때 이빨이 전혀 안 보이면 어색 → 조금 보이는 정도는 허용)
 */
export function buildSoftMouthFaceLock(): string {
  return [
    'MOUTH LOCK: natural Korean mouth — soft closed smile, or lightly parted lips when speaking/kissing',
    'teeth may show slightly when the mouth opens — a small natural glimpse only',
    'FORBIDDEN: wide toothy Hollywood grin, rows of exaggerated teeth, mouth stretched open that changes identity',
    'keep the same lip shape and mouth width as the source face — do not stretch the mouth',
  ].join('. ')
}

/** 탈의/나체 시 얼굴 픽셀 동결 — 몸만 바꾸고 얼굴은 가져오기 */
export function buildFaceFrozenLock(): string {
  return [
    'FACE FROZEN: copy the source face as-is — eyes, nose, mouth, brows, jaw, skin',
    'Do NOT redraw, beautify, age, Westernize, or change the mouth for expression beyond a tiny soft smile',
    buildSoftMouthFaceLock(),
  ].join('. ')
}

/**
 * 2인(커플) 쇼츠 전용 얼굴 고정 — 위 buildFaceFrozenLock/STRUCTURE LOCK은 전부 단수
 * ("same face identity" 한 문장)라 한 사람만 있다고 가정한 문구였다. 소스 사진에 두 사람이
 * 함께 있을 때(특히 증명사진이 아니라 전신/반신 합성 사진처럼 두 얼굴이 작게 나오는 경우)
 * Wan I2V가 영상 진행 중 둘 중 한쪽 얼굴을 다른 사람으로 드리프트시키는 실측이 확인됐다 —
 * "두 사람 모두 각자의 얼굴을 그대로 유지"를 별도 문장으로 명시해야 한다.
 */
export function buildCoupleFaceLock(): string {
  return [
    'TWO PEOPLE, TWO SEPARATE FACES: this is two different real individuals, not one person twice — keep EACH person\'s own face, skin tone, and hairstyle exactly as in the source photo, in every frame',
    'FORBIDDEN: either face drifting into a different-looking person, the two faces blending into each other, or one person being replaced/duplicated as the video plays',
  ].join('. ')
}

/** 「여여 키스 금지」처럼 여여를 막는 문구는 여여 요청으로 보지 않음(실측 2026-09-01). */
function stripTwoWomenForbidPhrases(text: string): string {
  return (text || '')
    .replace(/여여\s*(?:키스\s*)?금지/g, '')
    .replace(/두\s*번째\s*여자\s*금지/g, '')
    .replace(/남자를\s*여자로\s*바꾸기\s*금지/g, '')
    .replace(/\bNOT two women\b/gi, '')
    .replace(/FORBIDDEN(?:[:\s]+)?(?:two women|turning him into a second woman)/gi, '')
}

/** 여여/레즈를 요청문에 명시한 경우 — 남녀 강제 금지 */
export function isExplicitTwoWomenCast(text: string): boolean {
  return /여여|여자\s*둘|두\s*여자|두\s*여성|lesbian|two\s*women|both\s*women|sapphic|girls?\s*kiss/i.test(
    stripTwoWomenForbidPhrases(text),
  )
}

/**
 * 소스 사진의 남+여를 여여 키스로 바꾸지 않음.
 * 「나체로 서로 키스」처럼 남자/여자 단어가 없어도 커플 사진+키스면 이걸 쓴다(실측 2026-09-01).
 */
export function buildSourcePairCastLock(): string {
  return [
    'CAST: copy BOTH source faces every frame (same age, haircut, wrinkles, skin). MAN stays male (short hair, flat chest). WOMAN stays that woman.',
    'FORBIDDEN new model, two women / gender-swap him.',
  ].join(' ')
}

/**
 * 「남자가 여자의 가슴을 만진다」처럼 남·여가 명시된 요청 —
 * 소스에 여자 2명이 앞에 있으면 모델이 여여 키스로 바꾸는 실측이 있어 강하게 잠근다.
 */
export function wantsHeteroManWomanCast(text: string): boolean {
  const t = text || ''
  if (isExplicitTwoWomenCast(t)) {
    return false
  }
  // 남·여만 있으면 안 됨 — 옷 입은 커플 데이트까지 나체 락이 붙는 사고 방지.
  const intimateOrUndress =
    /키스|입맞춤|가슴|유방|유두|보지|애무|만지|주무르|나체|누드|탈의|벗기|벗겨|벗는|kiss|breast|fondl|caress|nude|naked|undress|strip/i.test(
      t,
    )
  if (!intimateOrUndress) return false
  const mentionsMan = /남자|남성|남친|남편|boyfriend|\bman\b|\bmale\b|his\s+hand/i.test(t)
  const mentionsWoman = /여자|여성|여친|아내|\bwoman\b|\bfemale\b|her\s+breast|bare\s+breast/i.test(t)
  const manActsOnWoman =
    /남자(?:가|는|의)?[\s\S]{0,48}여자|여자(?:의|가|를)?[\s\S]{0,24}(?:가슴|유방).{0,24}남자|man[\s\S]{0,40}woman|his\s+(?:hand|mouth)[\s\S]{0,40}her/i.test(
      t,
    )
  return manActsOnWoman || (mentionsMan && mentionsWoman)
}

export function buildHeteroManWomanCastLock(): string {
  return [
    'CAST — EXACTLY the source MAN + the source WOMAN (copy their faces, age, hair)',
    'ACTION: that same MAN kisses that same WOMAN; HIS hand on HER bare breast',
    'FORBIDDEN: a new person, de-age, beautify, woman-woman kiss, gender-swap the man',
    'He stays in the foreground kissing — not idle in the background',
    'Woman FULL NUDE: top, bra, pants, panties off — FORBIDDEN topless-only with pants still on',
  ].join('. ')
}
