/**
 * 인종/국적 미지정 시 기본값(한국인) 판정 + 태그/문장 빌더.
 * content-policy.ts에서 분리 — 다른 모듈에 의존하지 않는 독립 유틸.
 */

// 사용자 지시: 인종/국적을 특별히 언급하지 않으면, 등장인물(남녀 모두)의 기본 컨셉은
// "예쁜/매력적인 한국인 얼굴"로 제시한다. 이미 다른 인종·국적을 명시했으면 그 지시를 존중해
// 강제로 덮어쓰지 않는다.
const ETHNICITY_MENTIONED_PATTERN =
  /한국\s*인|한국\s*사람|korean\b|일본\s*인|japanese\b|중국\s*인|chinese\b|백인|caucasian|서양\s*(?:인|여성|남성|여자|남자)|western\b|흑인|african[- ]american|black\s*(?:man|woman)|히스패닉|hispanic|latina\b|latino\b|인도\s*인|indian\b|동남아|태국\s*인|베트남\s*인|필리핀\s*인|혼혈|mixed[- ]race|외국\s*인|foreigner|아랍|arab\b/i

const MALE_SUBJECT_PATTERN =
  /남성|남자|남편|오빠|아저씨|청년|소년|아빠|아버지|신사|\bman\b|\bmale\b|\bboy\b/i
const FEMALE_SUBJECT_PATTERN =
  /여성|여자|여인|아가씨|소녀|언니|누나|엄마|어머니|숙녀|\bwoman\b|\bfemale\b|\bgirl\b|\blady\b/i

/** 화보(fashion) 프롬프트는 SDXL CLIP 인코더의 ~77토큰 예산 때문에 짧은 태그만 써야 한다
 * (buildFashionMagazinePrompt 주석 참고) — 이땐 짧은 태그 버전을 쓴다. */
export function defaultEthnicityTag(text: string): string {
  if (ETHNICITY_MENTIONED_PATTERN.test(text)) return ''
  const hasMale = MALE_SUBJECT_PATTERN.test(text)
  const hasFemale = FEMALE_SUBJECT_PATTERN.test(text)
  if (hasMale && !hasFemale) return 'Korean man in his 20s, attractive Korean face'
  if (hasMale && hasFemale) return 'Korean man and Korean woman in their 20s, attractive Korean faces'
  // 명시가 없으면 화보 기본 대상(여성)으로 간주
  return 'Korean woman in her 20s, attractive Korean face'
}

const GENERIC_PERSON_PATTERN =
  /사람|인물|모델|캐릭터|아가씨|숙녀|신사|\bperson\b|\bcharacter\b|\bmodel\b/i

/** free 모드 등 사람이 아닐 수도 있는 장면에서, 실제로 사람이 등장하는지 판별하는 가드. */
export function mentionsHumanSubject(text: string): boolean {
  return (
    MALE_SUBJECT_PATTERN.test(text) ||
    FEMALE_SUBJECT_PATTERN.test(text) ||
    GENERIC_PERSON_PATTERN.test(text)
  )
}

/** scene-compiler / img2img 리바이즈처럼 긴 CRITICAL 문장을 쓰는 경로용 — 문장형. */
export function defaultEthnicitySentence(text: string): string {
  if (ETHNICITY_MENTIONED_PATTERN.test(text)) return ''
  const hasMale = MALE_SUBJECT_PATTERN.test(text)
  const hasFemale = FEMALE_SUBJECT_PATTERN.test(text)
  if (hasMale && !hasFemale) {
    return 'Default ethnicity (user did not specify): the man is Korean in his twenties, with a handsome Korean face.'
  }
  if (hasMale && hasFemale) {
    return 'Default ethnicity (user did not specify): both are Korean in their twenties, with attractive Korean faces.'
  }
  return 'Default ethnicity (user did not specify): the woman is Korean in her twenties, with a pretty Korean face — Korean facial proportions, not a drifted Southeast-Asian or Westernized look.'
}
