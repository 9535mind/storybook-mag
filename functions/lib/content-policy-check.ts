/**
 * 콘텐츠 정책 판정 — 하드 차단(미성년·비동의·실존 인물)만 다룬다.
 * content-policy.ts에서 분리 — 다른 모듈에 의존하지 않는 독립 판정기.
 */

export type ContentPolicyVerdict = {
  allowed: boolean
  blockedReason: string | null
  matchedSignals: string[]
}

const NON_CONSENSUAL_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'non-consensual', pattern: /강간|윤간|비동의|rape\b|non-?consensual/i },
]

const MINOR_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'minor-reference',
    pattern:
      /어린이|초등학생|중학생|고등학생|미성년|아동(?!극)|십대|청소년|loli|shota|\bchild\b|\bminor\b|\bteen(?:ager)?\b|\bkid\b|\bschoolgirl\b|로리콘|쇼타|로리\b/i,
  },
  {
    // "아이"는 그 자체로 독립된 낱말(어린이)일 때만 매칭한다 — 뒤에 조사/공백/문장부호/문장끝이 와야 함.
    // "아이보리·아이라인·아이섀도·아이템·아이콘·아이디어" 같은 색상·뷰티·IT 합성어는 "아이" 뒤에 다른 한글 음절이
    // 바로 붙어 있어 여기 해당하지 않으므로 오탐(false positive)이 아니다.
    label: 'minor-reference-word',
    pattern: /아이(?=가|는|를|의|와|랑|한테|에게|처럼|보다|보고|같이|만|까지|도|야|들|[\s,.!?)\]]|$)/,
  },
]

const REAL_PERSON_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'real-person', pattern: /실제\s*인물|실존\s*인물|연예인\s*(이름|사진)|celebrity\s*likeness/i },
]

function matchAny(text: string, rules: Array<{ label: string; pattern: RegExp }>): string[] {
  const found: string[] = []
  for (const { label, pattern } of rules) {
    if (pattern.test(text)) found.push(label)
  }
  return found
}

/**
 * 「not teen」「no child」처럼 미성년을 금지·부정하는 문구는 차단 신호가 아니다.
 * (AGE LOCK의 "not teen"이 나체 쇼츠를 통째로 막던 실측)
 */
function stripNegatedMinorPhrases(text: string): string {
  return String(text || '')
    .replace(
      /\b(?:not|no|non|never|without|forbid(?:den)?|avoid)\s*[-:]?\s*(?:a\s+|an\s+)?(?:teen(?:ager)?s?|child(?:ren)?|minor|kid|loli|shota|schoolgirl)s?\b/gi,
      ' ',
    )
    .replace(/미성년\s*(?:아님|아니|금지|제외)/g, ' ')
    .replace(/십대\s*(?:아님|아니|금지|제외)/g, ' ')
}

export function evaluateContentPolicy(
  promptText: string,
  _options?: { mode?: string },
): ContentPolicyVerdict {
  const text = stripNegatedMinorPhrases(promptText ?? '')

  const minor = matchAny(text, MINOR_PATTERNS)
  if (minor.length > 0) {
    return { allowed: false, blockedReason: 'blocked-minor-reference', matchedSignals: minor }
  }

  const nonConsensual = matchAny(text, NON_CONSENSUAL_PATTERNS)
  if (nonConsensual.length > 0) {
    return { allowed: false, blockedReason: 'blocked-non-consensual', matchedSignals: nonConsensual }
  }

  const realPerson = matchAny(text, REAL_PERSON_PATTERNS)
  if (realPerson.length > 0) {
    return { allowed: false, blockedReason: 'blocked-real-person', matchedSignals: realPerson }
  }

  return { allowed: true, blockedReason: null, matchedSignals: [] }
}

const ADULT_CONTENT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'adult-content',
    pattern:
      /누드|나체|섹스|성기|자위|전라|속옷\s*제거|란제리|nsfw|nude|naked|porn|explicit|sexual/i,
  },
]

/**
 * 동화 삽화(캐릭터 일관성) 전용 정책 — 화보 스튜디오와 달리 "아이/어린이" 묘사는
 * 이 기능의 정상적인 사용 목적(어린이 그림책)이므로 차단하지 않는다.
 * 실존 인물·비동의 폭력·성적 콘텐츠만 차단한다.
 */
export function evaluateTaleScenePolicy(promptText: string): ContentPolicyVerdict {
  const text = promptText ?? ''

  const realPerson = matchAny(text, REAL_PERSON_PATTERNS)
  if (realPerson.length > 0) {
    return { allowed: false, blockedReason: 'blocked-real-person', matchedSignals: realPerson }
  }

  const nonConsensual = matchAny(text, NON_CONSENSUAL_PATTERNS)
  if (nonConsensual.length > 0) {
    return { allowed: false, blockedReason: 'blocked-non-consensual', matchedSignals: nonConsensual }
  }

  const adult = matchAny(text, ADULT_CONTENT_PATTERNS)
  if (adult.length > 0) {
    return { allowed: false, blockedReason: 'blocked-adult-content', matchedSignals: adult }
  }

  return { allowed: true, blockedReason: null, matchedSignals: [] }
}
