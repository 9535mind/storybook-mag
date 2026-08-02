/**
 * 패션 매거진 스튜디오 — 성인 놀이터 정책.
 *
 * 성인 대상 장면(누드·란제리·에로·노골적 표현 포함)은 요청대로 허용.
 * 유일한 하드 차단: 미성년(로리/쇼타 포함), 비동의·강간, 실존 인물 딥페이크.
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

// 한국어는 명사와 동사 사이에 조사(을/를/이/가/은/는/도/만)가 붙는 게 훨씬 자연스러운
// 말투다("속옷을 제거해줘", "가운만 입혀라") — 기존엔 \s*(공백만 허용)라 조사가 끼면
// 매칭에서 빠져서, 정밀모드 전환·negative prompt 조정이 통째로 안 걸리는 버그가 있었다.
// "옷을 다 벗겨줘"/"옷을 전부 벗어라"처럼 조사 뒤에 "다/전부/완전히" 같은 강조 부사가 한
// 번 더 끼는 것도 실제로 매우 흔하다 — 조사와 부사를 모두 선택적으로 허용하는 조각을
// 명사+동사 패턴 사이에 넣어 고친다.
const KO_PARTICLE_GAP =
  '(?:을|를|이|가|은|는|도|만)?\\s*(?:다|전부|모두|완전히|싹|모조리)?\\s*'

// 착의·탈의 요청에 등장하는 의류 명사 전체 목록. "가운/로브/옷"만 있던 예전엔 "브래지어를
// 벗겨줘", "치마를 제거해줘"처럼 세부 품목을 지칭하면 놓치는 사고가 있었다 — 사용자가
// 실제로 쓸 만한 상의/하의/속옷 명칭을 폭넓게 담아둔다. "브라(?!운)"은 "브라운"(색상)
// 오발동 방지(기존 wantsUnderwearLook과 동일 이유).
const KO_CLOTHING_NOUN =
  '옷|가운|로브|스웨터|가디건|속옷|언더웨어|상의|하의|티셔츠|셔츠|니트|블라우스|브래지어|브라(?!운)|바지|팬츠|팬티|치마|스커트|드레스|원피스|자켓|재킷|코트|조끼|탑|스타킹|양말'

// "벗다"뿐 아니라 "제거/없애/지우다"도 실제로 쓰이는 탈의 표현이다. 동사 어간만 매칭해서
// 활용형(제거하다/제거해줘/제거하라, 없애다/없애줘/없애라, 지우다/지워줘/지워라, 벗다/
// 벗어/벗겨/벗기/벗김/벗을/벗었 등)을 활용형 하나하나 나열하지 않고 전부 커버한다.
const KO_REMOVE_VERB_STEM = '(?:제거|없애|지워|지우|벗)'

// 반대 방향(착의) 동사 어간 — 입다/착용하다/걸치다/두르다/씌우다의 모든 활용형을 어간만으로 커버.
const KO_DRESS_VERB_STEM = '(?:입|착용|걸치|두르|씌우)'

// "바꾸다/교체하다/변경하다/대체하다/A 대신 B" — 명사 바로 옆이 아니라 문장 뒤쪽에 오는
// 경우가 많아(예: "바지를 스커트로 바꿔줘") 인접 매칭 대신 문장 전체에서 별도로 검사한다.
// "바꾸다"는 어미가 붙으며 어간이 "바꿔/바꾼/바꿨"으로 불규칙 활용되므로(바꾸+어→바꿔)
// "바꾸" 어간 자체로는 매칭되지 않는다 — 활용형을 별도로 나열한다. 영어 표현(instead/
// swap/replace/change into)도 같이 커버한다 — buildRefinePrompt는 이미 번역된 영어
// revision 텍스트로 이 로직을 다시 타므로 한국어만 있으면 놓친다.
const KO_REPLACE_WORD_PATTERN =
  /바꾸|바꿔|바꾼|바꿨|바뀌|교체|변경|대체|대신|instead\s*of|\bswap(?:s|ping|ped)?\b|\breplace(?:s|d|ing)?\b|chang(?:e|es|ed|ing)\s*(?:into|to)/i

// 영어 의류 명사 목록 — KO_CLOTHING_NOUN과 동일한 역할이지만 영어 표현용. buildRefinePrompt는
// translateDescriptionForImagePrompt로 이미 영어로 번역된 revision을 다시 검사하므로, 한국어
// 패턴만 있으면 "take off the pants and put on the skirt" 같은 번역문을 전혀 못 잡는다.
const EN_CLOTHING_NOUN =
  '(?:clothes|clothing|dress|robe|bathrobe|kimono|lingerie|underwear|bra|panties|pants|jeans|trousers|skirt|shirt|blouse|jacket|coat|top|stockings|socks|outfit)'

// 의류 명사 + (조사) + 제거/착의 동사 어간 — "명사마다 동사마다" 조합을 일일이 나열하는 대신
// 하나의 조합 패턴으로 일반화한다(예: 상의를 벗겨줘 / 치마 제거해줘 / 팬티 없애줘 / 가운만
// 입혀라 모두 매칭).
const KO_UNDRESS_NOUN_VERB_PATTERN = `(?:${KO_CLOTHING_NOUN})${KO_PARTICLE_GAP}${KO_REMOVE_VERB_STEM}`
const KO_DRESS_NOUN_VERB_PATTERN = `(?:${KO_CLOTHING_NOUN})${KO_PARTICLE_GAP}${KO_DRESS_VERB_STEM}`

/** 누드·탈의·의류제거 의도 (성인 허용 — 순화하지 않음) */
export function wantsNudeOrUndress(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  const pattern = new RegExp(
    [
      '누드', '나체', 'nude', 'naked', '탈의',
      KO_UNDRESS_NOUN_VERB_PATTERN,
      // "strip(?:ping|ped)?"에 단어 경계(\b)가 없어서 "striped"(줄무늬 패턴 — 탈의와 무관한
      // 흔한 의상 묘사 단어)의 앞부분 "strip"만 부분일치로 걸려 오발동하는 사고가 실측으로
      // 확인됐다("striped dress" 같은 영어 압축 프롬프트가 이전 라운드 baseDescription으로
      // 재사용될 때 특히 위험). \b를 앞뒤로 둬서 "strip"/"stripping"/"stripped"(동사, 겹자음
      // pp)만 매칭되고 "striped"(명사 stripe+d, 단자음 p)는 매칭되지 않게 한다.
      'undress', 'disrobe', '\\bstrip(?:ping|ped)?\\b',
      `remove\\s*(?:her\\s*)?${EN_CLOTHING_NOUN}`,
      `take(?:s|ing)?\\s*off\\s*(?:her\\s*|the\\s*)?${EN_CLOTHING_NOUN}`,
      'fully\\s*nude', 'bare\\s*(?:skin|body)', '완전\\s*노출', '전라',
      // 「유방/유두 보여줘」「가슴 노출」— 누드·나체 단어 없이도 탈의 의도 (실측: 가운만 색 바뀜)
      '유두', '유방', '젖꼭지', 'topless', 'bare\\s*breasts?', 'visible\\s*nipples?',
      'show\\s*(?:her\\s*)?(?:breasts?|nipples?)', 'nipples?\\s*(?:visible|showing)',
      '가슴\\s*(?:을\\s*)?(?:보여|노출|드러내|내보여)',
      '가운\\s*(?:을\\s*)?(?:열어|벗|풀어|헤쳐)', '로브\\s*(?:을\\s*)?(?:열어|벗|풀어)',
      'open\\s*(?:her\\s*)?(?:robe|gown)', 'open\\s*the\\s*robe',
    ].join('|'),
    'i',
  )
  return pattern.test(t)
}

/** 속옷/란제리 ‘착용’ 요청 — 제거·누드 요청이면 false */
export function wantsUnderwearLook(text: string): boolean {
  if (wantsNudeOrUndress(text)) return false
  return /속옷|underwear|란제리|lingerie|팬티|panties|브라(?!운)|브래지/i.test(text || '')
}

/**
 * "탈의 동작"(영상 중 옷이 벗겨지는 전환)만 좁게 감지 — 누드/전라 같은 '상태' 단어는 제외한다.
 * wantsNudeOrUndress는 상태+동작을 모두 잡아서, 이미 누드인 소스 이미지에 '포즈만' 요청해도
 * true가 되어 "옷이 벗겨지는 동작" 프롬프트가 잘못 붙는 문제가 있었다. 모션 문구에 실제
 * "벗다/제거/탈의" 같은 동작 동사가 있을 때만 true로 판단한다.
 */
export function wantsUndressAction(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  const pattern = new RegExp(
    [
      // "벗겨"(사동형: 벗겨줘/벗겨주세요/벗겨봐)는 벗다의 흔한 캐주얼 요청 표현이다.
      // 모션 힌트 문구는 앞서 나온 베이스 설명에서 이미 의류가 특정돼 있어 "천천히 벗어"처럼
      // 명사 없이 동사만 오는 경우가 많다 — 그래서 "벗다" 활용형은 명사 없이도 단독으로
      // 인식하고(아래 4번째 줄), "제거/없애/지우다"처럼 더 범용적인 동사만 명사와 묶어서
      // 요구한다(KO_UNDRESS_NOUN_VERB_PATTERN — "제거" 혼자면 의류 제거인지 알 수 없음).
      '탈의', '벗는', '벗어', '벗기', '벗겨', '벗김', '벗을', '벗었',
      KO_UNDRESS_NOUN_VERB_PATTERN,
      // wantsNudeOrUndress와 동일한 이유로 \b 필요("striped" 오발동 방지).
      'undress', 'disrobe', '\\bstrip(?:ping|ped)?\\b', 'take\\s*off',
      'removes?\\s*(?:her\\s*)?(?:clothes|clothing|underwear|lingerie|robe|dress)',
    ].join('|'),
    'i',
  )
  return pattern.test(t)
}

/**
 * "착의 동작"(영상 중 옷을 입는 전환, 벗기의 반대) 감지.
 * 예전엔 이 방향(옷을 입는 동작)에 대응하는 감지가 전혀 없었다 — 그래서 소스 이미지가
 * 누드인데 모션 힌트로 "옷을 입는다/걸쳐 입는다"를 요청하면, undressAction=false에
 * staysNude=true로 판정되어 buildAnimationPrompt가 오히려 "끝까지 누드 유지, 어떤 옷도
 * 등장 금지"라는 정반대 지시를 강하게 박아넣는 사고가 있었다(요청한 동작과 반대로 동작).
 */
export function wantsDressAction(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  const pattern = new RegExp(
    [
      // "입"은 흔한 단어(입구/가입/수입 등)에도 등장해 명사 없이 단독으로는 못 쓰지만,
      // 아래 구체적 활용형(입는/입어/입기/입혀/입힌다/입힘/입을/입었)은 안전하게 단독 매칭된다.
      '입는', '입어', '입기', '입혀', '입힌다', '입힘', '입을', '입었',
      '착용', '걸치', '두르', '씌우',
      KO_DRESS_NOUN_VERB_PATTERN,
      '걸쳐\\s*입', '걸쳐\\s*걸치',
      'get(?:s|ting)?\\s*dressed', 'dress(?:es|ing)?\\s*(?:her)?self',
      `puts?\\s*on\\s*(?:her\\s*|a\\s*|the\\s*|only\\s*)?${EN_CLOTHING_NOUN}`,
      `wear(?:s|ing)?\\s*(?:a\\s*|the\\s*|only\\s*|just\\s*)?${EN_CLOTHING_NOUN}`,
      'wraps?\\s*(?:herself\\s*)?in\\s*(?:a\\s*|the\\s*)?(?:robe|dress|coat)',
    ].join('|'),
    'i',
  )
  return pattern.test(t)
}

const NUDE_STATE_WORD_PATTERN =
  /누드|나체|nude|naked|fully\s*nude|bare\s*(?:skin|body|breasts?)|완전\s*노출|전라|유두|유방|젖꼭지|topless|visible\s*nipples?|가슴\s*(?:을\s*)?(?:보여|노출|드러내)/i

/** 누적 base에서 「나체가 된다.」/몸매투영 잔여를 제거 — 안 하면 /나체/에 걸려 이후 수정이 고착됨 */
export function stripNudeBecomesPhrase(text: string): string {
  return polishKoreanPromptText(text || '')
    .replace(/나체가\s*된다\.?/g, ' ')
    .replace(/나체가된다\.?/g, ' ')
    .replace(/몸매\s*투영/g, ' ')
    .replace(/나체\s*수정\s*요청됨[^.。]*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * 이번 요청의 나체 의도(단일 판별기).
 * - become + nudeBecomes: 「몸매 투영」버튼/문구 (체형 유지·옷 페이드 용해)
 * - become: 그 외 나체/탈의 → 일반 탈의
 * - hold: 「이미 나체 유지」또는 신뢰 마커
 */
export function resolveNudeIntent(input: {
  revision?: string
  motion?: string
  base?: string
  prompt?: string
  bodyProject?: boolean
}): { mode: 'become' | 'hold' | 'none'; nudeBecomes: boolean } {
  const revision = polishKoreanPromptText(input.revision || '')
  const motion = polishKoreanPromptText(input.motion || '')
  const base = polishKoreanPromptText(input.base || '')
  const prompt = polishKoreanPromptText(input.prompt || '')
  const active = motion || revision

  if (motionExplicitNudeHoldOnly(motion)) {
    return { mode: 'hold', nudeBecomes: false }
  }
  if (
    input.bodyProject === true ||
    isBodyProjectRequest(revision) ||
    isBodyProjectRequest(motion)
  ) {
    return { mode: 'become', nudeBecomes: true }
  }
  if (active && wantsDressAction(active)) {
    return { mode: 'none', nudeBecomes: false }
  }
  if (active && (wantsUndressAction(active) || wantsNudeOrUndress(active))) {
    return { mode: 'become', nudeBecomes: false }
  }
  const continuity = stripNudeBecomesPhrase(`${prompt} ${base}`)
  if (/현재\s*나체|옷\s*없음/i.test(continuity)) {
    return { mode: 'hold', nudeBecomes: false }
  }
  return { mode: 'none', nudeBecomes: false }
}

/**
 * 최종 결과가 전신 나체여야 하는지(네거티브·해부 락용).
 * 몸매 투영은 이번 revision에 있을 때만 강제 — base 잔여 문구로 고착되지 않음.
 */
export function wantsFullNude(revision: string, baseDescription?: string): boolean {
  const rev = polishKoreanPromptText(revision || '')
  const base = polishKoreanPromptText(baseDescription || '')
  if (isBodyProjectRequest(rev)) return true
  if (NUDE_STATE_WORD_PATTERN.test(rev)) return true
  if (wantsDressAction(rev)) return false
  if (wantsNudeOrUndress(rev)) return true
  if (!base) return false
  if (wantsDressAction(base)) return false
  const baseCont = stripNudeBecomesPhrase(base)
  if (/현재\s*나체|옷\s*없음/i.test(baseCont)) return true
  if (NUDE_STATE_WORD_PATTERN.test(baseCont)) return true
  return wantsNudeOrUndress(baseCont)
}

/**
 * "옷을 교체/스왑"하는 큰 수정인지 폭넓게 판별한다. 탈의(옷을 벗다)·착의(옷을 입다)·교체
 * ("A 대신 B로", "A를 B로 바꿔줘") 세 가지 표현 방식을 모두 하나의 판별로 묶어서, 의류
 * 명사·동사 조합을 사용자가 쓸 때마다 하나씩 나열하지 않아도 되게 한다.
 */
export function isClothingChangeRevision(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  if (wantsNudeOrUndress(t) || wantsDressAction(t)) return true
  // "바지를 스커트로 바꿔줘/교체해줘"처럼 명사와 교체 동사가 붙어있지 않고 문장 뒤쪽에
  // 떨어져 있는 경우는 인접 매칭으로 못 잡는다 — 의류 명사가 하나라도 있고 교체 계열
  // 표현이 있으면 옷 교체 요청으로 간주한다.
  const mentionsClothing = new RegExp(KO_CLOTHING_NOUN, 'i').test(t)
  return mentionsClothing && KO_REPLACE_WORD_PATTERN.test(t)
}

/**
 * SDXL 계열 negative prompt.
 * 얼굴 클로즈업 / 캐주얼 티 / 비즈니스 정장으로 의상이 바뀌는 실패를 강하게 억제한다.
 * (누드 요청 시에는 buildFashionNegativePrompt가 outfit 강제 항목을 제거한다.)
 */
/** 수정 반복 시 얼굴이 하얗게/흑갈색으로 드리프트·서양인 치환되는 실패 패턴 (철칙 금지). */
export const IDENTITY_DRIFT_NEGATIVE = [
  'different person, different face, face swap, identity change',
  'pale white face, chalky white skin, ghostly pale, overexposed bleached face, porcelain doll bleach',
  'muddy dark brown skin, blackish brown face, burned dark skin, orange fake tan, uneven skin darkening',
  'caucasian face when source is asian, western european facial features, wrong ethnicity',
  'changed body type, slimmed down body, bulked up body, different breast size, different hip shape',
].join(', ')

export const DEFAULT_NEGATIVE_PROMPT = [
  'worst quality, low quality, blurry, deformed, bad anatomy, extra limbs, extra fingers',
  'watermark, text, logo',
  'extreme close-up, headshot only, face-only crop, cropped at shoulders, tight facial portrait',
  'cropped feet, cut off feet, cut off head, ankles cropped, incomplete body',
  'plain white t-shirt, casual cotton tee, hoodie, jeans, sneakers',
  'business suit, blazer, office suit, corporate attire, formal pant suit, grey suit, grey wrap dress',
  'missing outfit, outfit not visible, clothing ignored, wrong clothing, ignored prompt, prompt ignored',
  'empty grey studio backdrop only when urban setting was requested',
  'unrelated subject, different scene than requested',
  // 증명사진·패널 콜라주만 금지 (한 장면 속 여러 인물/동물은 허용)
  'contact sheet, triptych, multiple panels, split screen collage, passport photos, ID photo strip, duplicated identical portraits side by side',
  IDENTITY_DRIFT_NEGATIVE,
  'wide toothy grin, exaggerated teeth, Hollywood smile, dental smile, mouth stretched open, too many teeth showing',
].join(', ')

const OUTFIT_FORCE_NEGATIVE =
  /missing outfit,\s*outfit not visible,\s*clothing ignored,\s*wrong clothing,\s*/i

/**
 * "힘차게 달린다/페달을 밟는다" 같은 동작 묘사를 감지하는 패턴.
 * amplifyClothingAndScene(양성 태그)와 buildFashionNegativePrompt(음성 태그) 양쪽에서
 * 같은 조건으로 참조해, 사용자가 매번 "몸을 앞으로 숙이고 근육에 힘이…" 식으로 직접
 * 풀어쓰지 않아도 동작 단어만으로 역동적인 포즈가 자동으로 강제되게 한다.
 */
const DYNAMIC_ACTION_PATTERN =
  /힘차게|힘있게|역동적|다이나믹|달린다|달리는|질주|전속력|스피드|속도감|뛰는|뛰어가|페달\s*을?\s*밟|바람에\s*날리|dynamic|running|sprinting|speeding|pedaling|galloping|mid-action|in\s*motion/i

/**
 * "춤춘다"만으로는 팔다리를 어떻게 둬야 할지 모델에게 정보가 거의 없어서(추상적 행위
 * 라벨일 뿐 구체적 자세가 아님), 실측으로 뻣뻣하게 서 있는 자세로 뭉개지는 경우가 반복
 * 확인됐다. 반면 왈츠/발레/살사 같은 구체적 장르는 학습 데이터에 특징적 자세(파트너 홀드,
 * 발끝 세우기 등)가 뚜렷해서 훨씬 안정적으로 반영된다 — 장르가 감지되면 그 장르의 전형적
 * 자세를 직접 명시하고, 장르가 없으면 최소한 "역동적인 춤 동작" 정도의 범용 태그를 붙여서
 * 완전히 뻣뻣한 정자세로 새는 것만이라도 막는다. DYNAMIC_ACTION_PATTERN(달리기/질주 계열)과
 * 는 성격이 달라 별도 패턴/함수로 분리한다(그 태그는 "몸을 앞으로 숙이고 바람에 날리는"
 * 식이라 춤에는 안 맞는 경우가 많다).
 */
const DANCE_GENRE_TAGS: Array<{ pattern: RegExp; en: string }> = [
  {
    pattern: /왈츠|활츠|waltz/i,
    en: 'elegant ballroom waltz pose, partner dance hold with one arm raised, flowing gown swirling mid-turn, graceful spin, poised ballroom dancer posture',
  },
  {
    pattern: /발레|ballet/i,
    en: 'classical ballet pose, pointed toes en pointe, arms in ballet fifth position, graceful ballerina posture',
  },
  {
    pattern: /탱고|tango/i,
    en: 'dramatic tango pose, sharp partner embrace, extended leg line, intense passionate posture',
  },
  {
    pattern: /살사|salsa/i,
    en: 'salsa dance pose, hip movement mid-turn, dynamic partner dance footwork',
  },
  {
    pattern: /플라멩코|flamenco/i,
    en: 'flamenco dance pose, dramatic arm and hand flourish, sharp footwork stance, passionate posture',
  },
  {
    pattern: /벨리\s*댄스|belly\s*dance/i,
    en: 'belly dance pose, fluid hip movement, flowing arm gestures, ornate dance costume',
  },
  {
    pattern: /브레이크\s*댄스|breakdance|비\s*보잉|b-?boying/i,
    en: 'breakdance pose, dynamic acrobatic street dance freeze, energetic street dance stance',
  },
  {
    pattern: /현대\s*무용|컨템포러리|contemporary\s*dance/i,
    en: 'contemporary dance pose, expressive fluid body line, artistic modern dance movement',
  },
  {
    pattern: /재즈\s*댄스|jazz\s*dance/i,
    en: 'jazz dance pose, sharp dynamic body line, theatrical dance stance',
  },
  {
    pattern: /케이팝|k-?pop\s*댄스|아이돌\s*댄스/i,
    en: 'k-pop choreography dance pose, sharp synchronized dance move, confident performance stance',
  },
  {
    pattern: /힙합|hip-?hop/i,
    en: 'hip-hop dance pose, street dance stance with bent knees, sharp expressive arm movement',
  },
]

const GENERIC_DANCE_PATTERN = /춤\s*추|춤춘다|춤을|댄스\s*를?\s*추|dancing|\bdance\b/i

/** 춤 감지 — 장르가 명시돼 있으면 그 장르 전용 자세, 없으면 범용 댄스 자세 태그를 반환. */
function resolveDanceTag(description: string): string {
  const genre = DANCE_GENRE_TAGS.find((g) => g.pattern.test(description))
  if (genre) return genre.en
  if (GENERIC_DANCE_PATTERN.test(description)) {
    return 'dynamic dance pose, mid-dance movement, expressive body line, graceful arm gesture, NOT a static standing portrait, NOT stiff arms at sides'
  }
  return ''
}

function isDanceRevision(description: string): boolean {
  return GENERIC_DANCE_PATTERN.test(description) || DANCE_GENRE_TAGS.some((g) => g.pattern.test(description))
}

/** 화보 네거티브 — 속옷·누드·거울 요청에 맞춰 이탈 억제 */
/**
 * @param descriptionOrBase 화면 전체 컨텍스트(거울·배경·귀걸이·춤 등 옷 이외의 판별에 계속
 * 이 전체 텍스트를 쓴다) — refine.ts처럼 revision을 따로 넘기지 않으면 이 값 하나로 전부
 * 판단한다(기존 동작과 동일, generate.ts의 단일 description 호출과 하위 호환).
 * @param revision (선택) 이번 수정 지시만 별도로 넘기면, 최종 누드 판별(wantsFullNude)만
 * revision·base를 분리해서 정확히 계산한다 — descriptionOrBase가 이미 "baseDescription
 * ${revision}" 형태로 합쳐져 있어도, base의 "치마를 입고 있다" 같은 서술 때문에 이번
 * revision의 순수 탈의 지시가 상쇄되는 사고를 막는다(wantsFullNude 주석 참고).
 */
/** 음모·체모만 손보자는 수정인지 (쇼츠/전역 나체 락과 분리 — 요청 시에만) */
export function wantsPubicHairOnlyRefine(revision: string): boolean {
  const t = polishKoreanPromptText(revision || '')
  return /음모|치모|체모|곱슬\s*음모|pubic\s*hair|\bbush\b/i.test(t)
}

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
    'natural adult density: fuller on the mons, slightly thinner toward the edges — not a harsh horizontal band',
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
 * 옷이 달라붙어 보이는 실루엣 = 나체/영상에서도 같은 몸매.
 * (타이트한 상의의 큰 가슴 → 나체에 바비형 빈유로 바뀌는 실망 방지)
 */
export function buildClothingSilhouetteBodyLock(text = ''): string {
  const t = polishKoreanPromptText(text || '')
  const bits = [
    'CLOTHING SILHOUETTE → BODY LOCK: read breast size, waist, hips, and overall figure from how the clothes fit in the source photo — nude or video must match that implied body, not a generic Barbie doll',
    'BUST HEIGHT from arm landmarks: compare the chest mound under the shirt to the shoulder, upper arm (bicep), and elbow — if fabric volume sits low toward mid-upper-arm / near elbow height, keep LOWER-set breasts (not high Barbie bust under the collarbone)',
    'BUST VOLUME from chest print/ruffles: if lettering or lace sits on a forward-projecting chest and the tee/blouse lifts off the ribs, read FULL adult volume about full-C to D cup — FORBIDDEN collapsing to flat 빈유 or tiny A/B when the clothed chest clearly projects',
    'if the outfit shows a full/large bust under fabric, keep LARGE full breasts when nude — FORBIDDEN tiny barbie breasts, flat doll chest, or shrinking the bust after undress',
    'if frontal clothing makes bust hard to read, prefer soft FULL breast volume (볼륨감, ~C½–D) over flat empty 빈유 — volume is safer than underestimating',
    'pendant / gourd-like (표주박) hang is OK when the clothed silhouette is long and low — do not auto-lift breasts to a perky high set',
    'if the outfit shows a narrow/slim waist, keep that slim waist — do not thicken the midsection',
    'if the outfit shows wider hips or a curvy hourglass, keep that hip/waist ratio when nude',
  ]
  if (/큰\s*가슴|풍만\s*가슴|거유|글래머|busty|large\s*breasts?|full\s*bust|voluptuous/i.test(t)) {
    bits.push('text confirms large bust — preserve generous breast volume and projection when nude')
  }
  if (/가는\s*허리|얇은\s*허리|잘록|개미\s*허리|슬림\s*허리|wasp\s*waist|slim\s*waist|narrow\s*waist/i.test(t)) {
    bits.push('text confirms slim waist — keep a narrow cinched waist')
  }
  if (/글래머|풍만|curvy|hourglass|글래머체/i.test(t)) {
    bits.push('curvy hourglass continuity — full bust, defined waist, hips matching the clothed silhouette')
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
  ].join(' ')
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
    buildClothingSilhouetteBodyLock(t),
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
 * 얼굴·체형·피부톤 철칙 잠금 (짧음 — SDXL CLIP 예산 안).
 * 사용자가 피부/체형을 바꾸라고 한 항목만 잠금에서 뺀다.
 * 화보 수정에서는 항상 호출 — 사용자가 「같은 얼굴」을 적지 않아도 적용된다.
 */
export function buildIroncladIdentityLock(revision: string, baseDescription = ''): string {
  const rev = polishKoreanPromptText(revision || '')
  const revisionTargetsSkinTone = /피부\s*(색|톤)|태닝|skin\s*tone|\btan\b|하얗|검게|어둡게/i.test(rev)
  const revisionTargetsBody =
    /체형|몸매|살\s*빼|살\s*찌|다이어트|가슴\s*(키우|줄이|크게|작게)|잘록한\s*허리|엉덩이\s*(키우|줄이)|body\s*type|lose\s*weight|gain\s*weight|breast\s*(size|enlarge|reduce)/i.test(
      rev,
    )
  const bits = [
    'IRONCLAD: same person, same face identity — preserve exact facial features from source',
    !revisionTargetsSkinTone &&
      'same natural East Asian / Korean skin tone — not pale white, not muddy dark brown',
    !revisionTargetsBody && 'same body type and proportions',
    'same lighting on face, no bleach, no darken',
    'exactly one woman, never invent a second person or side-by-side twin',
    buildKoreanTwentiesLookLock(`${baseDescription} ${rev}`),
    buildSoftMouthFaceLock(),
  ].filter((v): v is string => Boolean(v))
  if (baseDescription && !revisionTargetsSkinTone) {
    bits.push('match source photo colorimetry')
  }
  return bits.join(', ') + '.'
}

export function buildFashionNegativePrompt(descriptionOrBase: string, revision?: string): string {
  const description = revision === undefined ? descriptionOrBase : `${descriptionOrBase} ${revision}`.trim()
  const extras: string[] = []
  let base = DEFAULT_NEGATIVE_PROMPT

  // 1인 초상 수정에서 원본·결과 나란히 / 복제 인물이 나오는 실측 억제 (커플·두 명 요청은 제외)
  if (
    !/두\s*명|둘이|커플|연인|남자와|여성과|파트너|함께\s*있는|two\s*(?:people|persons|women|men)|couple|with\s*a\s*(?:man|woman|partner)/i.test(
      description,
    )
  ) {
    extras.push(
      'two people, second person, extra person, another woman, twin sister, clone face',
      'diptych, before and after split, side by side two portraits, dual portrait collage',
      'mirrored twin panels, left-right duplicate face, split canvas two versions, comparison layout',
      'vertical seam down torso, half-and-half clothing colors, left side different outfit from right, split-color garment',
    )
  }
  // 전신→상체 줌인 억제. base 설명에「전신」이 있어도 빼면 안 됨 — 이번 revision이
  // 아래로 확장일 때만 이 네거티브를 끈다.
  if (revision === undefined || !isFramingExtendRevision(revision)) {
    extras.push(
      'zoomed-in crop tighter than source, bust-only shot when source showed more body',
      'unexpected upper-body crop, head and shoulders only when source was full body or three-quarter',
    )
  }

  // wantsNudeOrUndress가 아니라 wantsFullNude를 쓴다 — "바지를 벗기고 치마를 입혀라"
  // 같은 옷 교체 요청까지 wantsNudeOrUndress만으로 판단하면 "옷을 입지 말라"는 네거티브를
  // 추가해버려서 사용자가 명시적으로 요청한 착의(치마)와 정반대로 충돌하는 사고가 있었다.
  if (wantsFullNude(revision ?? descriptionOrBase, revision === undefined ? '' : descriptionOrBase)) {
    // "missing outfit"은 누드(=의상 없음)와 정면 충돌 → 제거
    base = base.replace(OUTFIT_FORCE_NEGATIVE, '')
    extras.push(
      'clothes, clothing, dressed, wearing clothes, fully clothed',
      'bathrobe, bath robe, kimono robe, wrap robe, dressing gown, coat, shirt, dress',
      'lingerie, underwear, bra, panties, thong, briefs, bikini bottom, covering the body with fabric',
      'panties still on, underwear left on, clothes at ankles, fabric on crotch',
      // 유두·체모 검열/뭉개기 금지
      'censored nipples, covered nipples, no nipples, blank breasts, barbie doll body',
      'censored crotch, mosaic genitals, blurred pubic area, missing pubic detail when nude',
      'pasties, nipple tape, strategic covering, steam censor',
      // 탈의 img2img가 강할수록 얼굴 치환·복제 인물이 잘 생김
      'different face from source, new face, face morph, identity swap',
      'wide toothy grin, exaggerated teeth, Hollywood smile, mouth stretched open',
    )
  } else if (wantsUnderwearLook(description)) {
    extras.push(
      'bathrobe, bath robe, kimono robe, wrap robe, dressing gown, overcoat, trench coat',
      'white dress shirt, collared blouse, button-up shirt, sweater, cardigan, grey robe',
    )
  }
  // 이 조건은 반드시 "거울을 요청하지 않았을 때"만 걸려야 한다. amplifyClothingAndScene은
  // 거울이 언급되면 정반대로 "mirror or vanity glass readable in the scene, NOT a plain
  // empty studio without a mirror"를 양성 프롬프트에 넣는다 — 예전엔 이 negative가 조건을
  // 뒤집지 않고 그대로 "거울 언급 시" 걸려서, 사용자가 거울 장면을 요청해도 양성/음성
  // 프롬프트가 서로 정반대를 강요하는 자기모순이 있었다(실측: 거울·창밖 야경 요청이 거의
  // 항상 무시되고 텅 빈 스튜디오만 나옴). 거울을 요청하지 않았을 때만 "거울 헐루시네이션
  // 방지" 용도로 이 negative를 건다.
  if (!/거울|mirror/i.test(description)) {
    extras.push('no mirror, missing mirror, plain seamless studio mugshot without mirror')
  }
  // 흰 배경을 요청했는데도 회색/베이지로 새는 사례가 실측으로 반복 확인됨 — 색상 이탈을 직접 억제.
  if (/흰\s*배경|흰색\s*배경|백색\s*배경|white\s*background|클린\s*화이트/i.test(description)) {
    // "흰 배경의 스튜디오 + 창밖 도시 야경"처럼 실내는 화이트인데 창 너머로 어두운 밤 도시가
    // 보이는 조합은 실제로 흔한 사진 구성인데, "dark background/colored background"를 무조건
    // 넣으면 amplifyClothingAndScene이 넣는 "도시 배경·거리 조명" 양성 지시와 충돌해서 창밖
    // 야경 자체가 억제되는 사고가 있었다. 도시/야경 요청이 함께 있으면 그 두 항목만 뺀다
    // (벽 색이 회색/베이지로 새는 건 여전히 막되, 창 너머 어두운 야경은 허용).
    // "city"/"urban"이 경계 없으면 "electricity"("city" 포함), "suburban"("urban" 포함)
    // 같은 흔한 단어에도 오발동한다 — \b로 좁힌다.
    const wantsCityOrNight = /도시|시티|어반|거리|야경|\burban\b|\bcity\b|\bstreet\b/i.test(description)
    const whiteBgExtras = wantsCityOrNight
      ? 'grey background, gray background, beige background, tan background, brown background, off-white background, cream background'
      : 'grey background, gray background, beige background, tan background, brown background, dark background, colored background, off-white background, cream background'
    extras.push(whiteBgExtras)
  }
  // "한쪽 귀만 보이고 반대쪽은 안 보임" 같은 좌우 비대칭 액세서리 묘사가 실측에서 양쪽 다 보이는
  // 대칭형으로 뭉개지는 경우가 반복 확인됨 — 대칭 귀걸이를 직접 억제.
  if (/귀[^.]{0,30}(가려|보이지\s*않|안\s*보임|관찰되지\s*않|없다|없음)/.test(description)) {
    extras.push('matching earrings on both ears, symmetric pair of earrings, two identical earrings, earring visible on both sides')
  }
  // amplifyClothingAndScene의 역동적 포즈 태그와 짝을 맞춰, 같은 조건에서 정적 포즈로
  // 새는 것을 직접 억제한다.
  if (DYNAMIC_ACTION_PATTERN.test(description)) {
    extras.push(
      'static pose, standing still, calm posed portrait, looking back over the shoulder, relaxed stationary stance, studio glamour pose without motion, frozen with no motion blur',
    )
  }
  // 춤 요청인데 팔이 몸에 붙은 뻣뻣한 정자세로 새는 실패가 실측으로 반복 확인됨 — 위
  // DYNAMIC_ACTION_PATTERN(달리기/질주 계열) negative와는 별도로 춤 전용 억제를 건다.
  if (isDanceRevision(description)) {
    extras.push(
      'static standing pose, stiff arms at sides, arms glued to body, calm posed portrait, awkward frozen unnatural dance pose, motionless stance',
    )
  }
  return extras.length ? `${base}, ${extras.join(', ')}` : base
}

/** 생성·수정 공통: 흔한 한글 오타·커서 잔여 정리 */
export function polishKoreanPromptText(text: string): string {
  let t = String(text || '')
  if (!t) return ''
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, '')
  t = t.replace(/[|/\\]+/g, '')
  t = t.replace(/\s+/g, ' ').trim()
  t = t.replace(/([가-힣])\s+(게|히)(?=\s|$|[가-힣.,!?…·])/g, '$1$2')
  t = t.replace(/하고\s*잇다/g, '하고 있다')
  t = t.replace(/되어\s*잇다/g, '되어 있다')
  t = t.replace(/([가-힣])잇다/g, '$1있다')
  t = t.replace(/수정하래/g, '수정해줘')
  t = t.replace(/([가-힣])하래(?=\s|$|[.!?…])/g, '$1해줘')
  t = t.replace(/되엇/g, '되었')
  t = t.replace(/햇다/g, '했다')
  // 란제리촉옷차림 → 란제리 속옷차림
  t = t.replace(/촉옷/g, '속옷')
  t = t.replace(/란제리\s*속옷/g, '란제리 속옷')
  t = t.replace(/않자/g, '앉아')
  t = t.replace(/위애/g, '위에')
  t = t.replace(/잇어요/g, '있어요')
  t = t.replace(/잇다/g, '있다')
  t = t.replace(/잆학/g, '입학')
  t = t.replace(/입핵/g, '입학')
  return t.replace(/\s+/g, ' ').trim()
}

/**
 * 「허리/무릎/발목까지 그려줘」「전신으로」「발 보이게」— 크롭을 넓혀 같은 사람을 더 보여 달라는 요청.
 * 순수 T2I·일반 img2img로는 얼굴이 바뀌거나 구도가 안 넓어짐 → 아웃페인트 우선.
 */
export function isFramingExtendRevision(revision: string): boolean {
  const r = polishKoreanPromptText(revision)
  return /허리|반신|상반신|하반신|가슴\s*아래|배꼽|골반|무릎|발목|발끝|발\s*까지|다리\s*까지|허벅지|전신|풀\s*바디|풀바디|full\s*body|머리부터|발끝까지|머리\s*부터\s*발|크롭|잘린|잘려|잘림|보이게\s*그려|더\s*그려|아래로\s*그려|아래까지|발\s*보여|발\s*나오게|waist|torso|midriff|half[\s-]?body|feet\s*visible|head\s*to\s*toe|show\s*(the\s*)?(feet|ankles|knees|waist)|uncrop|outpaint|확장/i.test(
    r,
  )
}

/** 아웃페인트 픽셀 — 요청 범위에 따라 아래로(필요 시 좌우) 확장량. */
export function resolveFramingExpandPixels(revision: string): {
  expand_top: number
  expand_bottom: number
  expand_left: number
  expand_right: number
} {
  const r = polishKoreanPromptText(revision)
  if (/전신|풀\s*바디|풀바디|발끝|발목|발\s*까지|머리부터|head\s*to\s*toe|feet\s*visible/i.test(r)) {
    return { expand_top: 64, expand_bottom: 1400, expand_left: 160, expand_right: 160 }
  }
  if (/무릎|허벅지|다리\s*까지|knees?/i.test(r)) {
    return { expand_top: 48, expand_bottom: 1100, expand_left: 120, expand_right: 120 }
  }
  // 허리·반신·상반신 (증명사진 → 허리까지)
  return { expand_top: 32, expand_bottom: 720, expand_left: 80, expand_right: 80 }
}

/** 화보 모드: 전신·의상처럼 img2img로 얼굴이 깨지기 쉬운 큰 수정 */
export function isStructuralRefineRevision(revision: string): boolean {
  const r = polishKoreanPromptText(revision)
  const pattern = new RegExp(
    [
      '전신', '풀\\s*바디', '풀바디', 'full\\s*body', '머리부터', '발끝까지',
      '속옷', '란제리', 'underwear', 'lingerie', '브래지', '팬티', '거울', '차림으로',
      '누드', '나체', 'nude', '다시\\s*그려', '재생성', '탈의',
      '유두', '유방', '젖꼭지', 'topless',
    ].join('|'),
    'i',
  )
  // 특정 의류를 "벗다·제거·없애다"(탈의), "입다·착용하다"(착의), "A 대신 B로/A를 B로 바꿔"
  // (교체)해 달라는 요청은 무엇이든 실제로는 의상이 통째로 바뀌는 만큼 큰 수정이다 — 이걸
  // 놓치면 낮은 strength(0.28)로만 처리되다가 반영이 거의 안 되는 문제가 있었다.
  // isClothingChangeRevision 하나로 세 가지 표현 방식을 전부 통틀어 판별한다(뒤에서
  // nudeRevision과 함께 얼굴 보존 고강도 경로(strength 0.6·정밀모드)로 승격시킨다).
  return pattern.test(r) || isClothingChangeRevision(r) || isFramingExtendRevision(r)
}

/** 프레이밍 확장 수정용 — 같은 사람·같은 옷으로 아래로 확장 (하반신만/나체 발명 금지). */
export function buildFramingExtendRefineAddon(revision: string, baseDescription = ''): string {
  const corpus = `${baseDescription} ${revision}`
  const wantsNude = wantsFullNude(revision, baseDescription)
  const r = polishKoreanPromptText(revision)
  const target = /전신|발목|발끝|풀\s*바디|feet|head\s*to\s*toe/i.test(r)
    ? 'full body head-to-toe including knees, ankles and feet'
    : /무릎|허벅지|knees?/i.test(r)
      ? 'three-quarter or full-leg framing including knees'
      : 'waist-up / half-body framing showing from head down to the waist'
  return [
    'FRAMING EXTEND: keep the EXACT SAME face and person from the source photo — do not redesign the face.',
    `Widen the canvas downward to ${target}. Preserve the original head/shoulders pixels.`,
    'NOT a new passport photo, NOT the same tight headshot crop again, NOT a different woman, NOT headless.',
    wantsNude
      ? buildNudeAnatomyVisibilityLock(corpus)
      : 'Keep the original outfit and sweater/clothes — do NOT undress, do NOT invent nudity.',
  ]
    .filter(Boolean)
    .join(' ')
}

/** "귀걸이 추가해줘"/"나비 넣어줘"처럼 원본에 없던 새 물체·요소를 더하는 수정인지 판별한다.
 * img2img는 strength(디노이징 강도)가 낮을수록 원본 구조를 강하게 보존하는데, 그 특성 때문에
 * "존재하지 않던 새 물체를 그려 넣어라" 같은 요청은 색상/질감 변경보다 훨씬 더 많은 자유도가
 * 필요하다 — 낮은 strength로는 모델이 새 물체를 안정적으로 합성하지 못하고 무시하거나(수정이
 * "안 먹힘") 반대로 전체 구도가 무너지는 실측 사례가 확인됐다. 그래서 이런 요청만 따로 감지해
 * strength를 한 단계 올려서(구조 변경 없이) 새 요소가 실제로 그려질 여지를 준다. */
export function isAdditiveRefineRevision(revision: string): boolean {
  const r = polishKoreanPromptText(revision)
  // "목걸이를 채워줘"/"귀걸이 착용시켜줘"/"목도리 둘러줘"처럼 장신구·소품을 몸에 걸치게
  // 하는 표현들도 "새 물체를 그려 넣어라"와 동일한 부류다 — 실측으로 이 표현들이 위
  // 키워드에 안 걸려서 낮은 strength로 처리되다가, 목걸이 같은 새 물체를 억지로 끼워
  // 넣으려는 시도 때문에 얼굴·의상까지 통째로 무너지는 "구도 붕괴" 사고가 확인됐다
  // (추가하려는 시도 자체는 반영됐지만 그 대가로 무관한 부분까지 크게 바뀜).
  // "옷을 입혀줘/입는 걸로"처럼 누드 상태에서 옷을 다시 입히는 요청도 같은 부류다(맨살에
  // 없던 천 재질을 새로 그려 넣는 것) — 빠져 있으면 같은 구도 붕괴 위험이 있다.
  return /추가|넣어|넣기|넣다|덧붙|그려\s*넣|올려\s*줘|씌워|더해|채워|채우|착용|달아|달아줘|매줘|둘러|두르|걸어\s*줘|입혀|입혀줘|입는|입을|입었|add\b|insert\b|put\b.*\bin\b/i.test(
    r,
  )
}

// 영단어(frog/cat/dog/lion/bear/bird 등)는 \b로 단어 경계를 반드시 둬야 한다 — 예전엔
// 경계 없이 그냥 부분일치라서 "delicate"("cat" 포함), "million/billion/pavilion"("lion"
// 포함), "forbear"("bear" 포함) 같은 흔한 단어에도 오발동해서, 화보 수정 문구에 "delicate"
// (레이스/장신구 묘사에 자주 쓰임) 한 단어만 있어도 화보 모드 전체가 "동물/일러스트" 자유
// 모드로 잘못 전환되는 심각한 사고가 실측으로 확인됐다(정체성 잠금·인종 기본값·란제리
// 안전 문구가 전부 빠지고 "여성 모델을 만들지 말라"는 정반대 지시가 들어감). 복수형(s)만
// 허용하고, 그 외에는 정확히 그 단어여야 매칭되게 좁힌다.
const ANIMAL_SUBJECT_PATTERN =
  /토끼|개구리|여우|사자|호랑이|고양이|강아지|원숭|당나귀|곰|늑대|동물|\b(?:frog|rabbit|fox|lion|tiger|cat|dog|monkey|bear|bird|horse|animal)s?\b/i

// "말"(말horse)과 "새"(bird)는 JS 정규식의 \b가 한글을 \w로 취급하지 않아 "말\b"/"새\b"가
// 한글 문장에서는 절대 매칭되지 않는 죽은 패턴이었다(실측으로 확인 — "말의 머리 위에" 같은
// 문장에서 전혀 감지되지 않아 화보 모드 인물 고정 문구가 말 그림에 잘못 섞여 들어갔다).
// "말"은 "정말/거짓말/참말"처럼 앞 글자에 붙는 복합어와 구분해야 하므로, 문장 시작/공백/구두점
// 뒤에서 시작하고, 뒤에는 조사·공백·구두점·문장끝이 오는 경우만 "말(horse)"로 인정한다.
const HORSE_WORD_PATTERN =
  /(?:^|[\s"'“'(\[,.!?])말(?=이|가|은|는|을|를|의|과|와|도|만|처럼|같이|한테|에게|께|만큼|보다|들[이은을의]?|[\s"'”)\],.!?]|$)/
const BIRD_WORD_PATTERN =
  /(?:^|[\s"'“'(\[,.!?])새(?=가|는|를|의|와|랑|한테|에게|처럼|보다|같이|만|까지|도|들[이은을의]?|[\s"'”)\],.!?]|$)/

/** 화보(fashion) 모드로 선택돼 있어도 실제 내용이 동물/사물 장면인지 판별한다.
 * 관리자가 「관리자전용(화보)」 탭에서 동물 그림을 만든 경우, 이후 그 이미지를 텍스트로 수정할 때
 * "같은 성인 여성 얼굴 유지" 같은 인물 전용 잠금 문구를 넣으면 img2img 모델이 동물을 여성 얼굴로
 * 바꿔버리는 사고가 실측으로 확인됐다 — 그래서 genMode와 무관하게 실제 서술 내용으로 다시 판별한다. */
export function describesAnimalSubject(text: string): boolean {
  const t = polishKoreanPromptText(text)
  return ANIMAL_SUBJECT_PATTERN.test(t) || HORSE_WORD_PATTERN.test(t) || BIRD_WORD_PATTERN.test(t)
}

/** 자유 모드: 동물·소품·구도 추가 등 장면 구성 변경 → 반드시 장면 재생성 */
export function isFreeSceneRevision(revision: string, baseDescription = ''): boolean {
  const r = polishKoreanPromptText(`${baseDescription}\n${revision}`)
  if (!revision.trim()) return false
  // 동물·다중 주체·위치 관계·장면 동사
  if (describesAnimalSubject(r)) {
    return true
  }
  if (/위에|아래|등에|등에\s*타|타고|안[자줘]|앉아|들고|함께|추가|넣어|장면|들판|가로질러|달린|뛰는|쫓/i.test(r)) {
    return true
  }
  // 자유 모드 텍스트 수정은 기본적으로 장면 재생성(아래 refine.ts에서 강제)
  return true
}

/** 자유 일러스트 수정용 설명 병합 */
export function mergeFreeRevisionDescription(base: string, revision: string): string {
  const b = polishKoreanPromptText(base)
  const r = polishKoreanPromptText(revision)
  // 수정문이 이미 완결 장면이면(거실·엎드림·책 등) 수정문을 주 브리프로 사용
  const revisionIsFullScene =
    r.length >= 12 &&
    /[이가은는]/.test(r) &&
    (/거실|엎드|책|들판|달리|앉아|대학|입학|토끼|개구리|장면/.test(r) || r.length >= 20)
  if (revisionIsFullScene) {
    return [
      r,
      b && !r.includes(b.slice(0, Math.min(12, b.length)))
        ? `이전 맥락(참고): ${b}`
        : '',
      'Render the FULL scene from the Korean brief: environment, pose, props, and character must all be visible. NOT a passport/ID headshot, NOT a studio face-only crop.',
    ]
      .filter(Boolean)
      .join(' ')
  }
  if (!b) return r
  if (!r) return b
  return [
    b,
    `수정 반영(원 장면을 유지한 채 반드시 적용): ${r}`,
    'Keep subjects and setting; apply the revision exactly. Show full scene (pose, place, props). NOT face-only portrait, NOT passport photo.',
  ].join(' ')
}

/**
 * CLIP 예산(~70단어) 안에서 최대한 비용 대비 효과를 내려고, 화면비 라벨("2:3 vertical" 등)처럼
 * 프롬프트 텍스트로는 사실상 아무 시각 정보도 안 되는 표현은 빼고(화면비는 width/height로 이미 결정됨),
 * 같은 뜻을 반복하지 않는 짧은 태그로만 구성한다.
 */
/**
 * 태그체로 압축된 구도 힌트. "face-only crop 금지" 같은 부정 지시는 이미
 * DEFAULT_NEGATIVE_PROMPT(negative prompt)에 같은 내용이 들어 있어서 여기 긍정 프롬프트에
 * 중복으로 넣지 않는다 — 어차피 CLIP은 "Do NOT ~" 부정을 잘 못 알아듣고, negative prompt
 * 슬롯이 그 역할을 전담하도록 이미 설계돼 있다(위 buildFashionMagazinePrompt 주석 참고).
 * 중복을 빼는 것만으로 케이스별 5~6단어를 아꼈다.
 */
function resolveFramingHint(size: string | undefined): string {
  if (size === 'landscape') return 'full outfit, head to mid-thigh, background visible'
  if (size === 'square') return 'waist-up or three-quarter shot, outfit and pose visible'
  if (size === 'story') return 'full body, head to toe, feet visible, outfit readable'
  return 'full body, head to toe, feet visible, entire outfit visible'
}

/**
 * 한국어 의상/장소 키워드를 영어 강제 지시로 보강 (모델이 정장·스튜디오로 이탈하는 경우 억제).
 * @param revision (선택) buildFashionNegativePrompt와 동일한 이유로, revision을 따로
 * 넘기면 누드 판별(wantsFullNude)만 base와 분리해서 정확히 계산한다.
 */
function amplifyClothingAndScene(descriptionOrBase: string, revision?: string): string {
  const description = revision === undefined ? descriptionOrBase : `${descriptionOrBase} ${revision}`.trim()
  const extras: string[] = []
  // wantsFullNude — "바지를 벗기고 치마를 입혀라" 같은 옷 교체 요청까지 "no clothing, bare
  // skin" 태그를 강제로 붙이면 사용자가 명시한 착의 지시(치마)와 정반대로 충돌한다.
  const nude = wantsFullNude(revision ?? descriptionOrBase, revision === undefined ? '' : descriptionOrBase)

  // 누드/탈의는 의상 강제보다 우선 — "속옷제거"가 속옷 착용으로 오인되지 않게
  if (nude) {
    extras.push(
      'adult nude, bare skin, no clothing, no lingerie, no underwear, no bra, no panties, no bathrobe, no robe',
      'garments removed / undressed as requested — do NOT keep fabric covering the body',
      buildNudeAnatomyVisibilityLock(description),
    )
  } else {
    // "실크/슬립"(재질을 명시)과 "드레스/dress"(그냥 의상 종류)를 분리한다. 예전엔 이 둘을
    // 한 정규식으로 묶어서, "실크"를 언급한 적이 없는 그냥 "니트 원피스" 같은 설명도
    // "dress"라는 단어 하나만으로 "glossy silk fabric"을 강제로 덧씌워버렸다 — refine.ts가
    // baseDescription으로 이전 생성의 압축된 영어 프롬프트(currentResult.prompt)를 재사용하는데,
    // "원피스"가 Claude 압축 과정에서 "dress"로 번역되기만 해도(재질 언급 없이) 이 규칙이
    // 오발동해서, 수정 요청과 무관하게 의상 재질이 니트 → 광택 실크로 통째로 바뀌는 사고가
    // 실측으로 확인됐다. 재질(실크/슬립)을 실제로 언급했을 때만 재질을 강제한다.
    const wantsSilkOrSlip = /실크|슬립|slip|silk/i.test(description)
    // "dress"에 경계가 없으면 "address"("dress" 포함)에도 오발동한다("she addresses the
    // camera" 같은 번역문에서 실제 확인) — \b로 좁힌다(dressed/dressing 등 파생형은 유지).
    const wantsDressGarment = /드레스|\bdress/i.test(description)
    // 아래 태그들은 "NOT 업무복/가운" 같은 부정 문구를 길게 반복해 왔는데, 그 내용은 이미
    // DEFAULT_NEGATIVE_PROMPT(business suit/blazer/bathrobe 등)에 포함돼 있다 — positive
    // 프롬프트 쪽 예산이 다중 키워드 상황에서 특히 귀해서, 중복되는 부정 문구를 걷어내고
    // 옷 종류/재질만 짧게 못박는다.
    if (wantsSilkOrSlip) {
      extras.push('wearing a glossy silk slip dress')
    } else if (wantsDressGarment) {
      extras.push('wearing a dress')
    }
  }
  const isLaceLingerie = !nude && /란제리|레이스\s*브래지|lingerie|lace\s*bra|thong|탠가/i.test(description)
  if (isLaceLingerie) {
    // 거울/야경/흰배경 같은 다른 "장면 정의" 태그와 한 문장에 자주 겹쳐서 amplify 예산을
    // 같이 나눠 써야 하는 경우가 많다 — 의미 손실 없이 3단어를 줄인 짧은 버전을 쓴다.
    extras.push('wearing lace lingerie (bra, panties), sheer lace fabric')
  } else if (wantsUnderwearLook(description)) {
    // wantsUnderwearLook은 "란제리/lingerie"도 함께 매칭하는 더 넓은 판정이라, 위 레이스
    // 태그와 동시에 걸리면 같은 내용을 두 번 말하며 예산을 낭비했다 — 더 구체적인 레이스
    // 태그가 이미 걸렸으면 이 일반형 속옷 태그는 건너뛴다(제거·누드 요청 제외는 함수 내부에서 처리됨).
    extras.push('wearing only underwear (bra and panties), skin and undergarments visible, NOT a bathrobe')
  }
  // 아래부터는 "장면을 정의하는" 구조적 요소(거울/배경/도시/야경)를 먼저 배치한다 —
  // capWordsSimple이 예산 초과 시 뒤쪽부터 자르므로, 상대적으로 덜 치명적인 자세/표정
  // 같은 장식적 디테일(오블리크 앵글, 감상하는 시선, 자신감 포즈)은 이 함수 맨 뒤로
  // 옮겨서 다중 키워드가 겹치는 밀도 높은 요청에서도 배경 요소가 먼저 살아남게 한다.
  if (/거울|mirror/i.test(description)) {
    // "posed in front of... mirror visible in frame"(9단어)는 거울/야경/흰배경이 겹칠 때
    // 예산을 많이 차지했다 — 같은 의미를 6단어로 줄인다.
    extras.push('in front of a mirror, mirror visible')
  }
  const wantsCityOrNightHere = /도시|시티|어반|거리|야경|\burban\b|\bcity\b|\bstreet\b/i.test(description)
  const wantsNightHere = /야경|밤\s*풍경|저녁\s*풍경|night\s*view|night\s*skyline|nighttime/i.test(description)
  // "야경"(밤의 도시 풍경)은 그냥 "도시/거리" 태그만으로는 낮인지 밤인지 애매해서, 실측으로
  // 밝은 낮 시간 창문으로 나오는 경우가 반복 확인됐다("street lights"만 있으면 낮에도
  // 가로등이 있을 수 있다고 해석되는 듯함). 야경 요청이면 도시+야간을 한 태그로 합쳐서
  // (둘 다 걸릴 때 따로따로 두 번 "도시" 얘기를 반복해 예산을 낭비하지 않게) 시간대까지
  // 한 번에 못박는다. 거울과 마찬가지로 "장면을 정의하는" 핵심 요소라서 흰 배경 디테일
  // (덜 중요)보다 앞에 배치해 예산이 부족할 때 먼저 살아남게 한다.
  if (wantsNightHere) {
    // 예전 문구(12단어: "nighttime city view through the window, dark sky with glowing
    // city lights")는 란제리+거울+흰배경과 한 문장에 겹치면 amplify 예산 초과로 뒷부분
    // ("dark sky..." 이후)이 통째로 잘려나가는 사고가 실측으로 확인됐다 — 같은 의미를
    // 8단어로 줄여 겹침 상황에서도 끝까지 살아남게 한다.
    extras.push('night city skyline through window, dark sky, city lights')
  } else if (wantsCityOrNightHere) {
    extras.push('city buildings visible through window, not grey studio wall')
  }
  if (/흰\s*배경|흰색\s*배경|백색\s*배경|white\s*background|클린\s*화이트/i.test(description)) {
    // "흰 배경 + 창밖 야경"처럼 실내는 화이트인데 창 너머는 어두운 밤인 조합을 요청했을 때,
    // 아래 "NOT dark backdrop"이 뒤에서 추가되는 야경 태그("dark night sky")와 정반대로
    // 충돌해서 서로를 지워버리는 사고가 있었다 — 야경/도시가 함께 요청되면 그 문구만 뺀다.
    extras.push(
      wantsCityOrNightHere
        ? 'white interior walls, not grey'
        : 'pure white seamless studio background, not grey, not beige, not dark',
    )
  }
  if (/귀[^.]{0,30}(가려|보이지\s*않|안\s*보임|관찰되지\s*않|없다|없음)/.test(description)) {
    extras.push('asymmetric single earring, only one ear shows an earring')
  }
  if (/시스루\s*뱅|앞머리|see-?through\s*bang/i.test(description)) {
    extras.push('delicate see-through bangs across the forehead')
  }
  // 자세/표정 계열 장식적 디테일 — 예산이 부족하면 이 아래부터 먼저 잘려도 배경/의상 같은
  // 핵심 장면 요소보다 실손실이 적다.
  if (/비스듬|oblique|diagonal/i.test(description)) {
    extras.push('oblique / three-quarter angle stance')
  }
  if (/몸매|감상|admiring/i.test(description)) {
    extras.push('admiring her own figure in the mirror')
  }
  if (/자신감|포즈|confident|pose/i.test(description)) {
    extras.push('confident fashion pose')
  }
  // 예전엔 "밝|투명|clear|bright" 아무 데서나 매칭했다 — "머리색을 밝은 갈색으로"나 "change
  // hair color to bright red"처럼 머리색·의상 색 묘사에 쓴 "밝은"/"bright"에도 걸려서, 얼굴/
  // 화장과 전혀 무관한 리비전에도 "얼굴을 화사하게 바꿔라" 지시가 끼어드는 사고가 있었다
  // (실측: 머리색만 바꿔달라 했는데 얼굴까지 달라지는 원인 중 하나였다). 피부/안색/얼굴 근처에서
  // 밝기를 언급했을 때만 매칭하도록 좁힌다.
  if (
    /피부[^,.]{0,10}(밝|맑|투명)|안색[^,.]{0,10}(밝|맑)|(밝|맑|투명)[^,.]{0,10}(피부|안색|얼굴)|clear\s*skin|bright\s*skin|clear\s*complexion|bright\s*complexion|luminous\s*skin/i.test(
      description,
    )
  ) {
    extras.push('bright clear luminous face, natural makeup')
  }
  // "힘차게 달린다/페달을 밟는다" 같은 동작 묘사를 줘도 모델이 정적인 화보 포즈(뒤돌아보는
  // 시선, 발끝만 살짝 든 자세)로 뭉개는 경우가 실측으로 반복 확인됐다 — 매번 사용자가
  // "몸을 앞으로 숙이고, 근육에 힘이 들어가고, 배경이 흐려지고…" 식으로 직접 풀어써야 하는
  // 건 불편하므로, 동작 관련 단어를 감지하면 이 역동성 태그를 자동으로 붙인다.
  if (DYNAMIC_ACTION_PATTERN.test(description)) {
    extras.push(
      'dynamic mid-action pose captured in motion, body leaning forward into the movement, muscles visibly engaged and tensed, motion blur in the background suggesting speed, hair and loose fabric blown backward by the wind, dramatic low action-photography angle',
      'NOT a static standing pose, NOT a calm posed portrait, NOT looking back over the shoulder, NOT frozen mid-stride with no motion cues',
    )
  }
  // 춤 요청 — 장르가 있으면 그 장르 전용 자세, 없으면 범용 댄스 자세 태그.
  const danceTag = resolveDanceTag(description)
  if (danceTag) {
    extras.push(danceTag)
  }
  // 태그 스타일로 이어붙일 수 있게 쉼표로만 구분한다("Hard constraints:" 같은 지시문 단어는
  // CLIP한테는 그냥 토큰 낭비라 뺀다 — CLIP은 문장을 "이해"하지 못하고 토큰 뭉치로만 본다).
  return extras.length ? `, ${extras.join(', ')}` : ''
}

/** 한국어 동물명 → 영어 종 고정 (여우/개로 치환되는 실패 억제). */
const FREE_ANIMAL_SPECIES: Array<{ pattern: RegExp; en: string; not?: string }> = [
  { pattern: /원숭이|monkey|macaque|primate/i, en: 'real monkeys (primates with monkey faces and fur)', not: 'NOT a fox, NOT a dog, NOT a shiba, NOT a cat, NOT a human' },
  { pattern: /침팬지|chimpanzee|chimp/i, en: 'real chimpanzees', not: 'NOT a monkey of wrong species, NOT a fox' },
  { pattern: /고릴라|gorilla/i, en: 'real gorillas' },
  { pattern: /사자|lion/i, en: 'a real lion', not: 'NOT a tiger hybrid' },
  { pattern: /호랑이|tiger/i, en: 'a real tiger', not: 'NOT a lion hybrid' },
  { pattern: /고양이|cat(?!tle)/i, en: 'a real cat' },
  { pattern: /강아지|개\b|puppy|dog\b/i, en: 'a real dog' },
  { pattern: /여우|fox/i, en: 'a real fox' },
  { pattern: /곰\b|bear\b/i, en: 'a real bear' },
  { pattern: /토끼|rabbit|bunny/i, en: 'a real rabbit' },
  { pattern: /새\b|bird\b/i, en: 'a real bird' },
  { pattern: /말\b|horse\b/i, en: 'a real horse' },
  { pattern: /코끼리|elephant/i, en: 'a real elephant' },
  { pattern: /펭귄|penguin/i, en: 'a real penguin' },
]

/** 자유 모드: 장면 키워드를 영어 강제 지시로 보강. 성인 요청은 순화하지 않는다. */
function amplifyFreeScene(description: string): string {
  const extras: string[] = []
  const hasLion = /사자|lion/i.test(description)
  const hasTiger = /호랑이|tiger/i.test(description)
  const hasMonkey = /원숭이|monkey|macaque|primate|침팬지|chimpanzee/i.test(description)

  if (/싸우|격투|싸움|fight|fighting|combat|brawl/i.test(description)) {
    extras.push('two subjects actively fighting / physical combat in frame, dynamic action pose, NOT a calm portrait')
  }
  if (/축구|soccer|football|킥|드리블|골대|공\s*차/i.test(description)) {
    extras.push(
      'soccer/football match in progress: a round soccer ball must be clearly visible, athletic kicking or dribbling action, NOT a still portrait',
    )
  }
  if (/농구|basketball/i.test(description)) {
    extras.push('basketball action with a visible basketball in frame')
  }
  if (/야구|baseball/i.test(description)) {
    extras.push('baseball action with a visible baseball in frame')
  }
  if (/달리|뛰|레이스|runn?ing|race/i.test(description)) {
    extras.push('subjects in motion / running, dynamic body language')
  }
  const danceTag = resolveDanceTag(description)
  if (danceTag) {
    extras.push(danceTag)
  }

  // 종 고정 — 요청한 동물만, 다른 종으로 바꾸지 말 것
  const matchedSpecies = FREE_ANIMAL_SPECIES.filter((s) => s.pattern.test(description))
  for (const species of matchedSpecies) {
    extras.push(`${species.en} must be clearly recognizable${species.not ? `, ${species.not}` : ''}`)
  }

  // 사자+호랑이 동시 → 하이브리드(라이거)로 합쳐지는 실패를 강하게 막는다.
  if (hasLion && hasTiger) {
    extras.push(
      'TWO separate animals in the SAME scene: one real lion AND one real tiger as distinct creatures side by side or facing each other',
      'NOT a liger, NOT a hybrid, NOT a single animal with mixed features, NOT a face close-up of one creature',
    )
  }

  // 두 마리 / 엄마·새끼
  if (/두\s*마리|2\s*마리|둘이|two\s+(monkeys|animals|lions|tigers)/i.test(description)) {
    extras.push('exactly TWO animals visible together in one scene, both fully readable')
  }
  if (/엄마|어미|mother|모성/i.test(description) && /아기|새끼|infant|baby|cub|pup/i.test(description)) {
    extras.push(
      'an adult mother animal AND a small infant/baby of the SAME species together',
      'NOT two identical adult faces stacked, NOT a duplicated clone portrait',
    )
  }
  if (/젖.{0,8}먹|수유|모유|breastfeed|nurs(?:e|ing)|feeding\s*(milk|infant)/i.test(description)) {
    extras.push(
      'nursing / breastfeeding moment: mother feeding milk to the infant, bodies and interaction clearly shown',
      'natural wildlife documentary style, tender parental care, NOT a face-only collage',
    )
  }

  if (hasMonkey) {
    extras.push(
      'subjects must look like monkeys/primates (flat primate faces, monkey ears, monkey fur) — NEVER foxes, NEVER dogs, NEVER shiba inu',
    )
  }

  if (/남자와\s*여자|남녀|man\s+and\s+woman|couple\s+fight/i.test(description)) {
    extras.push('both an adult man AND an adult woman must appear together in the same image')
  }
  if (/우주|galaxy|space|planet/i.test(description)) {
    extras.push('outer space / cosmic scenery as requested, stars or planets visible')
  }
  if (/지구|earth|globe/i.test(description)) {
    extras.push('planet Earth clearly visible as requested')
  }
  if (nude) {
    if (/(뒷모습|후면|등\s*뒤|back\s*view|rear)/i.test(description)) {
      extras.push('adult nude from the BACK, rear three-quarter view, bare skin, no clothing')
    } else if (/(옆|비스듬|측면|side\s*view|profile)/i.test(description)) {
      extras.push('adult nude in SIDE / three-quarter view standing at an angle, bare skin, no clothing')
    } else {
      extras.push(
        'adult nude as requested: bare skin, no clothes, no lingerie, no underwear — do not keep garments',
      )
    }
  } else if (/란제리|lingerie|야한|에로|섹시|nsfw|porn|explicit/i.test(description)) {
    extras.push('adult sensual / erotic content as requested — do not censor or clothe over the brief')
  }
  if (matchedSpecies.length > 0 || /동물|animal|wildlife/i.test(description)) {
    const wantsAnthro =
      /반인반수|반인\s*반수|수인(?:화)?|인화|의인화|anthro|anthropomorphic|furry|kemono/i.test(
        description,
      )
    if (wantsAnthro) {
      extras.push(
        'anthropomorphic half-beast (반인반수) form as explicitly requested',
      )
    } else {
      extras.push(
        'REAL animals as main subjects with natural animal anatomy',
        'NOT anthropomorphic, NOT furry/kemono, NOT animal head on human body, NOT bipedal animal in suit/clothes, NOT human fashion model with animal face',
      )
    }
  }

  const isSceneShot =
    /싸우|격투|축구|농구|야구|달리|뛰|soccer|football|fight|running|action|젖\s*을?\s*먹|수유|두\s*마리|엄마|새끼|아기/i.test(
      description,
    ) ||
    isDanceRevision(description) ||
    (hasLion && hasTiger) ||
    hasMonkey
  if (isSceneShot) {
    extras.push(
      'full-scene shot showing bodies and interaction, NOT extreme face close-up, NOT headshot-only stack',
    )
  }

  return extras.length ? ` Mandatory scene facts: ${extras.join('; ')}.` : ''
}

/**
 * @deprecated free 모드 프롬프트는 `compileResponsiveFreePrompt`(scene-compiler)가 단일 소스.
 * 호출 시 즉시 실패시켜 드리프트를 막는다.
 */
export function buildFreePrompt(_input: {
  description: string
  size?: string
  revision?: string
}): string {
  throw new Error('deprecated_use_compileResponsiveFreePrompt')
}

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
 * Legacy text trigger (optional). Primary UX is the 「몸매 투영」 button (`bodyProject: true`).
 */
export const NUDE_BECOMES_PHRASE = '나체가 된다.'
/** 공백 제거 후: 나체가된다. */
const NUDE_BECOMES_EXACT_COMPACT = '나체가된다.'

/** Canonical revision when the 몸매 투영 button is used — no magic phrase required. */
export const BODY_PROJECT_REVISION =
  '몸매 투영: 얼굴·체형 그대로. 어깨·팔뚝·팔꿈치로 유두 높이를 읽고, 가슴은 옷에 볼륨이 있으면 C컵 반~D컵·처진 실루엣 가능. 배꼽·치부 기점 고정 후 상의·바지·벨트·팬티 전부 녹여 완전 나체. 가슴 아래 벨트/띠 잔상·바지/팬티 잔존·빈유 과소평가 실패.'

export function hasNudeBecomesPhrase(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  if (!t) return false
  // 반드시 마침표(.) — 「나체가 된다」단독·「되어」는 제외
  if (/나체가\s*된다\./u.test(t)) return true
  const compact = t.replace(/[\s·・\-_/]/g, '')
  return compact.includes(NUDE_BECOMES_EXACT_COMPACT)
}

/** 몸매 투영 요청 — 버튼 플래그, 「몸매 투영」문구, 또는 legacy 「나체가 된다.」 */
export function isBodyProjectRequest(text: string, bodyProjectFlag?: boolean): boolean {
  if (bodyProjectFlag === true) return true
  const t = polishKoreanPromptText(text || '')
  if (!t) return false
  if (/몸매\s*투영/u.test(t)) return true
  return hasNudeBecomesPhrase(t)
}

/** Normalized body landmarks (0–1, image top-left origin) placed by the user before 몸매 투영. */
export type BodyLandmarks = {
  /** White-circle center = breast mound center (not always equal to nipple). */
  moundL?: { x: number; y: number }
  moundR?: { x: number; y: number }
  /** Red-dot = nipple; may sit off-center on the mound. */
  nippleL: { x: number; y: number }
  nippleR: { x: number; y: number }
  /** Optional — UI no longer collects navel; kept for backward compat. */
  navel?: { x: number; y: number }
  /** Breast mound radius as fraction of min(imageW, imageH). */
  breastRadius?: number
  /** Per-side radii when user tuned left/right independently. */
  breastRadiusL?: number
  breastRadiusR?: number
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5
  return Math.min(1, Math.max(0, n))
}

function clampBreastRadius(n: number, fallback = 0.08): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(0.22, Math.max(0.035, n))
}

/** Sanitize client landmarks; returns null if incomplete. */
export function normalizeBodyLandmarks(raw: unknown): BodyLandmarks | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const readPt = (key: string) => {
    const p = o[key]
    if (!p || typeof p !== 'object') return null
    const x = Number((p as { x?: unknown }).x)
    const y = Number((p as { y?: unknown }).y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return { x: clamp01(x), y: clamp01(y) }
  }
  const nippleL = readPt('nippleL')
  const nippleR = readPt('nippleR')
  if (!nippleL || !nippleR) return null
  const moundL = readPt('moundL') || { ...nippleL }
  const moundR = readPt('moundR') || { ...nippleR }
  const navel = readPt('navel')
  const br = Number(o.breastRadius)
  const brL = Number(o.breastRadiusL)
  const brR = Number(o.breastRadiusR)
  const shared = Number.isFinite(br) ? clampBreastRadius(br) : 0.08
  const breastRadiusL = Number.isFinite(brL) ? clampBreastRadius(brL, shared) : shared
  const breastRadiusR = Number.isFinite(brR) ? clampBreastRadius(brR, shared) : shared
  return {
    moundL,
    moundR,
    nippleL,
    nippleR,
    ...(navel ? { navel } : {}),
    breastRadius: (breastRadiusL + breastRadiusR) / 2,
    breastRadiusL,
    breastRadiusR,
  }
}

function pct(n: number): string {
  return `${(clamp01(n) * 100).toFixed(1)}%`
}

/**
 * User-placed 타점 → exact nipple/breast/navel anchors for I2V.
 * Coords only — never paint dots onto the source; anchors must match the clothed silhouette.
 */
export function buildBodyLandmarkCoordsLock(landmarks: BodyLandmarks): string {
  const rL = landmarks.breastRadiusL ?? landmarks.breastRadius ?? 0.08
  const rR = landmarks.breastRadiusR ?? landmarks.breastRadius ?? 0.08
  const mL = landmarks.moundL ?? landmarks.nippleL
  const mR = landmarks.moundR ?? landmarks.nippleR
  const parts = [
    'USER-CONFIRMED BODY LANDMARKS (normalized image coords, origin top-left) — mound center and nipple may differ:',
    `LEFT breast MOUND center at x=${pct(mL.x)} , y=${pct(mL.y)} — mound radius ≈ ${(rL * 100).toFixed(1)}% of shorter image side`,
    `LEFT NIPPLE (red point) at x=${pct(landmarks.nippleL.x)} , y=${pct(landmarks.nippleL.y)} — place the actual nipple here; it may be off-center on the mound (not always at the circle center)`,
    `RIGHT breast MOUND center at x=${pct(mR.x)} , y=${pct(mR.y)} — mound radius ≈ ${(rR * 100).toFixed(1)}% of shorter image side`,
    `RIGHT NIPPLE (red point) at x=${pct(landmarks.nippleR.x)} , y=${pct(landmarks.nippleR.y)} — place the actual nipple here; off-center OK`,
  ]
  if (landmarks.navel) {
    parts.push(
      `NAVEL at x=${pct(landmarks.navel.x)} from left, y=${pct(landmarks.navel.y)} from top`,
    )
  }
  parts.push(
    'Draw soft breast volume around each MOUND center; put nipples exactly at the nipple coords — FORBIDDEN forcing nipples to geometric circle centers if the red points are offset',
    'The source image has NO painted circles or dots — use only these coordinates',
    'Do NOT move nipples to face/neck/shoulder; do NOT shrink the bust away from these anchors',
  )
  return parts.join('. ')
}

/**
 * 몸매 투영 — 착의 → 실루엣 예측 → 옷이 약하게 보이며 페이드로 녹음 → 같은 체형.
 */
export function buildNudeBecomesDefinitionLock(_corpus = '', landmarks?: BodyLandmarks | null): string {
  // 같은 얼굴/체형 + 옷 아래 유두·배꼽·치부 기점 → 상의·바지·치마·팬티 전부 제거
  const step1 = landmarks
    ? 'STEP 1 USE USER 타점 on THIS photo: draw breast mounds and nipples exactly at the locked left/right coords that sit on the real clothed chest — do not re-guess or drift to neck/shoulder.'
    : 'STEP 1 PREDICT under clothes: nipple (유두) height from shoulder/upper-arm/elbow landmarks on the clothed bust mound; navel (배꼽) on the torso midline at the natural waist (ignore any belt — the belt must be removed, not used as a keep-guide); pubic mound under pants/skirt.'
  return [
    'BOTTOM BAN FIRST (몸매 투영): pants, jeans, trousers, slacks, skirt, shorts, panties, thong, briefs, bikini bottoms, belts, waistbands — ALL must leave the body and exit the frame.',
    'FAILED results: topless but still in pants; nude top with jeans; white/sheer/double-layer panties left on; brown waist belt still strapped on the abdomen. Lower garments and belts must vanish completely.',
    buildPantyLayerBanLock(),
    'BODY PROJECTION = landmark reveal, not a new body.',
    buildFaceFrozenLock(),
    'SAME BODY: keep the exact people, faces, poses, person count from the source photo — do not invent anyone.',
    landmarks ? buildBodyLandmarkCoordsLock(landmarks) : '',
    step1,
    'STEP 2 LOCK those nipple, navel, and crotch landmarks — they must not drift after clothes disappear.',
    'STEP 3 REVEAL: clothes WEAKEN then fade — EVERY layer vanishes (blouse/top AND pants/jeans/skirt/shorts AND belt/waistband AND underwear); redraw continuous bare skin from underbust through navel to hips — no leftover strip.',
    'BUST: soft full volume around the nipple anchors (full-C to D when clothed chest projects) — FORBIDDEN high tiny barbie bust or flat 빈유 away from the markers.',
    buildUnderbustGarmentRemnantBanLock(),
    buildClothingSilhouetteBodyLock(_corpus),
    buildBodyLandmarkNudeRevealLock(),
    'END: fully nude — bare breasts with volume at the marked points, bare underbust/abdomen with ZERO belt remnant, bare navel, bare legs and crotch; ZERO pants, ZERO jeans, ZERO panties, ZERO belt. FORBIDDEN: new figure, gender swap, ending still in trousers, brown band under breasts.',
    buildNudeCensorFogBanLock(),
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * 쇼츠 몸매 투영 — 유두·배꼽 타점 고정 후 옷만 약하게 녹여 같은 몸을 드러냄.
 */
export function buildNudeBecomesAnimationPrompt(input: {
  motion: string
  clipRole?: 'single' | 'dual-a' | 'dual-b'
  prompt?: string
  landmarks?: BodyLandmarks | null
}): string {
  // Wan I2V ignores long essays; belt/bra/panties stick to source pixels.
  // Lead with USER coords, then a short beat script that bans lingerie stop.
  const corpus = `${input.prompt || ''} ${input.motion || ''}`
  const landmarks = input.landmarks ? normalizeBodyLandmarks(input.landmarks) : null
  const coords = landmarks ? buildBodyLandmarkCoordsLock(landmarks) : ''

  return [
    coords
      ? `USER TAJEOM LOCK (highest priority — do not ignore): ${coords}`
      : 'Estimate nipple and navel under clothing from the real torso — never on the face or neck.',
    'Adult photorealistic image-to-video. Same woman face and body as the input photo.',
    buildFaceFrozenLock(),
    'MISSION: melt ALL clothes to FULL NUDE. Forbidden stopping at bra/panties/lingerie.',
    'FAIL A: brown belt or any waist strap left on the belly.',
    'FAIL B: white panties, double-layer panties, thong, briefs left on.',
    'FAIL C: bra, bandeau, strapless bra, sports bra left on the chest.',
    'BEAT 1: clothed source.',
    'BEAT 2: dissolve TOP + BRA + TROUSERS + BELT + PANTIES together. Draw bare breasts and nipples exactly at the locked tajeom coords while fabric fades.',
    'BEAT 3: fully nude — bare breasts at locked nipple points, bare abdomen/navel, bare crotch. ZERO bra, ZERO panties, ZERO belt.',
    buildClothingSilhouetteBodyLock(corpus),
    buildNudeCensorFogBanLock(),
    'LAST FRAME: fully nude only. FAIL if bra, panties, belt, or fog crotch remain. FAIL if breasts ignore user tajeom coords.',
  ]
    .filter(Boolean)
    .join(' ')
}

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

// 무드 셀렉터: 필름·사진 질감(조명/컬러그레이딩) 축으로 재설계 — "패션 사진" 형용사만
// 다르던 이전 방식(에디토리얼/글래머/시크/로맨틱)은 SDXL류 엔진에게 시각적으로 잘 구분되지
// 않아, 실제 결과물 차이가 크게 나는 조명·필름 질감 축으로 바꿨다. 화보/자유 일러스트 양쪽
// 모드가 공유하는 단일 소스. 이전 값(editorial/glamour/chic/romantic)은 과거에 저장된 갤러리
// 항목을 다시 수정할 때 깨지지 않도록 하위 호환 별칭으로 남겨둔다.
// 태그체로 압축(관사/중복 형용사 제거) — SDXL_TAG_SYSTEM(translate.ts)이 사용자 description에
// 적용하는 것과 같은 원칙: 문장이 아니라 쉼표 구분 태그로, 의미가 살아남는 한 단어를 최대한 뺀다.
export const MOOD_LOOK_TAGS: Record<string, string> = {
  clean: 'clean digital photography, crisp detail, neutral color grade',
  vintage: 'vintage 35mm film photography, film grain, warm analog grade',
  cinematic: 'cinematic anamorphic photography, dramatic framing, teal-orange grade',
  pastel: 'soft pastel photography, dreamy light, high-key pastel palette',
  // 하위 호환 별칭
  editorial: 'clean digital photography, crisp detail, neutral color grade',
  glamour: 'cinematic anamorphic photography, dramatic framing, teal-orange grade',
  chic: 'clean digital photography, crisp detail, neutral color grade',
  romantic: 'soft pastel photography, dreamy light, high-key pastel palette',
}

export function resolveMoodTag(mood: string | undefined): string {
  return MOOD_LOOK_TAGS[mood || ''] || MOOD_LOOK_TAGS.clean
}

/** 화보풍 프롬프트 — 표현력을 죽이는 순화는 하지 않는다. */
/**
 * SDXL/Juggernaut의 CLIP 텍스트 인코더는 ~77토큰(대략 영어 60~70단어)을 넘으면 뒷부분을 조용히
 * 잘라서 버리고, "Do NOT ~" 같은 부정 지시문도 잘 못 알아듣는다(부정어를 무시하고 그 단어 자체에
 * 끌리는 경향). 그래서 예전처럼 긴 지시문 문장을 여러 개 이어붙이는 건 (1) 대부분 예산 밖으로
 * 잘려서 버려지고 (2) 설령 안 잘려도 "하지 마라" 부분이 잘 안 먹히는 이중 손해였다.
 * 지금은: 실제 시각 정보(description, 이미 SDXL 태그 형태로 압축돼 들어옴)를 맨 앞에 두고,
 * 뒤에는 짧은 태그만 붙인다. 금지 사항(옷 대체·순화 금지 등)은 여기서 빼고 negative prompt로
 * 옮겼다 — negative prompt는 별도의 77토큰 예산이라 "공짜로" 더 쓸 수 있고, 애초에 모델이
 * "빼야 할 것"을 처리하도록 설계된 슬롯이라 부정 지시가 실제로 더 잘 먹힌다.
 */
/** 단어 수 추정(SDXL ~77토큰 예산 근사용) — 공백 기준 분리. */
function countWords(text: string): number {
  return (text || '').trim().split(/\s+/).filter(Boolean).length
}

/** capWords(translate.ts)와 같은 단순 절삭 — content-policy.ts는 다른 모듈을 import하지 않는
 * 독립 모듈로 유지하려고 로컬에 하나 더 둔다. */
function capWordsSimple(text: string, maxWords: number): string {
  if (maxWords <= 0) return ''
  const words = (text || '').trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text.trim()
  return words.slice(0, maxWords).join(' ').replace(/[,;\s]+$/, '')
}

const SDXL_HARD_BUDGET_WORDS = 70
// "단어 수"는 실제 토큰 수와 1:1이 아니다(쉼표·복수음절 단어가 토큰을 더 씀) — 그 오차를
// 흡수할 안전 여유.
const SDXL_TOKEN_SAFETY_MARGIN_WORDS = 5
// 안전 여유를 뺀 실제 배분 대상 예산.
const SDXL_WORKING_BUDGET_WORDS = SDXL_HARD_BUDGET_WORDS - SDXL_TOKEN_SAFETY_MARGIN_WORDS
// description이 최소한 이만큼은 받도록 보장하는 하한. ethnicityTag/moodTag/framing/
// qualitySuffix 같은 "고정" 태그만 해도 실측으로 33~45단어를 차지해서(무드/사이즈 조합에
// 따라 다름), 이 하한을 여유 있게(예: 30) 잡으면 고정 태그+하한만으로 이미 65를 넘는
// 조합이 나온다 — 그래서 20으로 보수적으로 잡는다.
const SDXL_MIN_DESCRIPTION_WORDS = 20
// suffix가 비어 있어도(=amplify가 짧을 때) description에 65를 통째로 주지 않는 상한.
const SDXL_MAX_DESCRIPTION_WORDS = 60

/**
 * description 예약분(SDXL_MIN_DESCRIPTION_WORDS)을 항상 고정으로 지키면, amplify가
 * 정말 많이 필요한 경우(예: 거울+란제리+흰배경+도시+야경처럼 키워드 5~6개가 한 문장에
 * 겹치는 실측 사례) amplify가 8단어 안팎으로 짜부라져서 장면을 정의하는 핵심 요소(배경·
 * 거울·야경)가 통째로 잘려나가는 문제가 확인됐다. 이런 경우는 대개 description 원문
 * 자체가 amplify가 다시 설명해주는 내용과 크게 중복되므로(예: "거울 앞에서...도시의
 * 야경" 문장이 그대로 mirror/city/night amplify로 매칭됨), description 예약분을
 * 양보해도 실손실이 적다 — amplify가 실제로 필요로 하는 양(자르기 전 원본 길이)에 맞춰
 * description 예약분을 단계적으로 줄인다.
 */
function resolveMinDescriptionWords(rawAmplifyWords: number): number {
  // 실측(란제리+거울+흰배경+야경 4개 겹침 = rawAmplify 40대 중반)으로 기존 ">40 → 12"
  // 구간이 여전히 부족해서, 거울/야경 태그 자체가 amplify 안에서 중간에 잘리는 사고가
  // 있었다 — 브래킷을 더 촘촘하고 공격적으로 나눠 amplify 쪽에 더 넉넉히 양보한다.
  if (rawAmplifyWords > 55) return 6
  if (rawAmplifyWords > 35) return 9
  if (rawAmplifyWords > 22) return 12
  return SDXL_MIN_DESCRIPTION_WORDS
}

/**
 * buildFashionMagazinePrompt가 압축된 description 뒤에 붙이는 고정/조건부 태그들을 계산한다.
 * amplify(의상/장면 보강)도 압축 전 원문(rawDescription) 기준으로 판별한다 — 압축된 영어
 * 태그만 보면 "실크", "거울", "비스듬" 같은 한글 키워드가 압축 과정에서 잘려나가 매칭이
 * 빠질 수 있다(위 ethnicityTag/nude와 같은 이유).
 *
 * ethnicityTag/nudeFlag/moodTag/framing/qualitySuffix는 항상 그대로 붙는 "고정" 몫이고,
 * amplify만 매칭되는 키워드 수에 따라 크게 늘어나는 유일한 가변 항목이다(키워드가 여러 개
 * 겹치면 — 예: 란제리+거울+비스듬+흰배경+도시 — 그 자체로 100단어를 넘을 수 있다). 그래서
 * 고정 몫을 먼저 계산하고, description의 최소 몫(SDXL_MIN_DESCRIPTION_WORDS)을 지킬 수
 * 있는 만큼만 amplify에 남겨준다(넘치면 뒤쪽 — 상대적으로 덜 중요한 장식적 디테일 — 부터 자른다).
 * 이렇게 하면 suffix 총합 + description 최소 몫이 항상 SDXL_WORKING_BUDGET_WORDS를 넘지 않는다.
 */
function buildFashionPromptSuffixParts(input: {
  mood: string
  size?: string
  rawDescription: string
}): { ethnicityTag: string; amplify: string; nudeFlag: string; moodTag: string; framing: string; qualitySuffix: string } {
  const ethnicitySource = polishKoreanPromptText(input.rawDescription)
  // wantsFullNude — 옷 교체 요청("바지를 벗고 치마만 입혀라")까지 "no bra, no panties"를
  // 양성 프롬프트에 박아버리면 착의 지시와 충돌한다(amplifyClothingAndScene과 동일 이유).
  const nude = wantsFullNude(ethnicitySource)
  const ethnicityTag = defaultEthnicityTag(ethnicitySource)
  // 누드 요청 시 "no bra, no panties"까지 양성(positive) 프롬프트에 직접 못박아 둔다.
  // 예전엔 negative prompt(lingerie, underwear, bra, panties)에만 의존했는데, Lightning
  // 계열(스텝 8·CFG 2~4로 낮음)은 negative 프롬프트 순응도가 약해서, 학습 데이터 편향으로
  // 속옷을 입혀버리는 사고가 실측으로 반복 확인됐다 — 보통 더 잘 지켜지는 양성 프롬프트에도
  // 같은 지시를 중복으로 넣어 이탈 확률을 낮춘다.
  const nudeFlag = nude
    ? `adult nude, bare skin, no bra, no panties, ${buildNudeAnatomyVisibilityLock(ethnicitySource)}`
    : ''
  const moodTag = resolveMoodTag(input.mood)
  const framing = resolveFramingHint(input.size)
  const qualitySuffix = 'photorealistic, natural skin, sharp focus, 8k'
  const rawAmplify = amplifyClothingAndScene(ethnicitySource).replace(/^,\s*/, '')

  const fixedWords =
    countWords(ethnicityTag) + countWords(nudeFlag) + countWords(moodTag) + countWords(framing) + countWords(qualitySuffix)
  const minDescriptionWords = resolveMinDescriptionWords(countWords(rawAmplify))
  const amplifyBudget = Math.max(0, SDXL_WORKING_BUDGET_WORDS - fixedWords - minDescriptionWords)
  const amplify = capWordsSimple(rawAmplify, amplifyBudget)

  return { ethnicityTag, amplify, nudeFlag, moodTag, framing, qualitySuffix }
}

/**
 * compileSdxlTagPrompt(translate.ts)에 넘길 description 압축 예산을 동적으로 계산한다.
 * 예전엔 55로 고정했었는데, 화보 프롬프트가 압축된 description 뒤에 붙이는 인종/의상보강/
 * 무드/구도/품질 태그(suffix)의 실제 길이는 상황마다 크게 다르다. 특별한 키워드가 없으면
 * suffix가 짧아 description에 더 많은 예산을 줄 수 있고, 반대로 의상/장면 키워드가 여러 개
 * 겹치면(예: 란제리+거울+비스듬+흰배경) suffix 하나만 30단어를 넘길 수도 있어 55 고정은
 * 위험했다 — description이 55를 다 채우면, 뒤에 붙는 suffix가 모델의 CLIP 인코더에 의해
 * "어디가 잘렸는지 알 수도, 통제할 수도 없이" 조용히 잘려나간다(우리 capWords가 우선순위
 * 순서대로 자르는 것과 달리).
 */
export function resolveFashionDescriptionWordBudget(input: {
  mood: string
  size?: string
  rawDescription: string
}): number {
  const suffixWords = estimateFashionSuffixWords(input)
  const available = SDXL_WORKING_BUDGET_WORDS - suffixWords
  // buildFashionPromptSuffixParts와 같은 기준(원본 amplify 길이에 따른 적응형 하한)을 써야
  // 한다 — 여기서 옛 고정값(SDXL_MIN_DESCRIPTION_WORDS)으로 다시 올려버리면, amplify가
  // 실제로 더 받아간 몫만큼 총합이 다시 예산을 넘어서는 불일치가 생긴다.
  const ethnicitySource = polishKoreanPromptText(input.rawDescription)
  const rawAmplifyWords = countWords(amplifyClothingAndScene(ethnicitySource))
  const minDescriptionWords = resolveMinDescriptionWords(rawAmplifyWords)
  return Math.max(minDescriptionWords, Math.min(SDXL_MAX_DESCRIPTION_WORDS, available))
}

/** buildFashionPromptSuffixParts가 계산하는 고정/조건부 태그들의 단어 수 총합. */
export function estimateFashionSuffixWords(input: { mood: string; size?: string; rawDescription: string }): number {
  const parts = buildFashionPromptSuffixParts(input)
  return Object.values(parts).reduce((sum, p) => sum + countWords(p), 0)
}

export function buildFashionMagazinePrompt(input: {
  description: string
  mood: string
  size?: string
  /** 원본(압축·번역 전) 한글 설명. 인종·누드·의상보강 판별은 이 원문 기준으로 해야 한다 —
   * 단어 압축 과정에서 "일본인 여성" 같은 명시적 언급이 잘려나가면, 압축된 영어 텍스트만
   * 보고 판별할 경우 사용자가 명시한 인종이 기본값(한국인)으로 뒤집히는 버그가 있었다.
   * 넘겨주면 이 원문으로 판별하고, 안 넘기면(하위호환) 기존처럼 description 자체로 판별한다. */
  rawDescription?: string
}): string {
  const description = polishKoreanPromptText(input.description)
  const ethnicitySource = input.rawDescription ? polishKoreanPromptText(input.rawDescription) : description
  const suffix = buildFashionPromptSuffixParts({
    mood: input.mood,
    size: input.size,
    rawDescription: ethnicitySource,
  })

  const parts = [
    // 생성에서도 좌우 이중 초상(diptych) 실측 억제 — 맨 앞
    'single frame one woman portrait photo, not a diptych or split screen',
    description,
    // 짧은 태그라 앞쪽에 둬야 77토큰 예산에서 잘리지 않고 반영됨
    suffix.ethnicityTag,
    suffix.amplify,
    suffix.nudeFlag,
    suffix.moodTag,
    suffix.framing,
    suffix.qualitySuffix,
  ].filter(Boolean)
  return parts.join(', ')
}

/**
 * 화보(fashion) 프롬프트만. free는 generate.ts → scene-compiler.
 * mode==='free'면 명시적으로 실패 (이중 경로 방지).
 */
export function buildGenerationPrompt(input: {
  description: string
  mood: string
  size?: string
  revision?: string
  mode?: string
}): string {
  if (input.mode === 'free') {
    throw new Error('free_mode_requires_scene_compiler')
  }
  return buildFashionMagazinePrompt(input)
}

/** 자유 일러스트용 — 짧게 유지 (과도한 금지 키워드는 엔진 오탐 유발). */
export const FREE_NEGATIVE_PROMPT = [
  'worst quality, low quality, blurry, deformed, bad anatomy, extra limbs, extra fingers',
  'watermark, text, logo',
  'ignored prompt, unrelated scene, wrong subject, wrong animal species',
  'solo fashion model studio portrait when animals or action were requested',
  'calm ID photo pose when fighting or action was requested',
  'extreme face close-up, headshot only, duplicated stacked faces, clone faces',
  // 증명사진·패널 콜라주만 금지 (한 장면 속 여러 동물/인물은 허용)
  'contact sheet, triptych, multiple panels, split screen collage, passport photos, ID photo strip, duplicated identical portraits side by side',
  'fox, shiba inu, dog face when monkey was requested',
  'liger, lion-tiger hybrid, merged lion and tiger into one creature',
  'missing soccer ball when soccer was requested',
  'underage human, loli, shota',
].join(', ')

const ANTHRO_NEGATIVE =
  'anthropomorphic, anthro, furry, kemono, animal head on human body, humanoid animal, bipedal animal in suit, animal wearing clothes, suited fox, fashion fox'

/** 요청 동물에 맞춰 negative를 추가로 붙인다. */
export function buildFreeNegativePrompt(description: string): string {
  const extras: string[] = []
  const wantsAnthro =
    /반인반수|반인\s*반수|수인(?:화)?|인화|의인화|anthro|anthropomorphic|furry|kemono/i.test(
      description,
    )
  const hasAnimal = /여우|사자|호랑이|고양이|강아지|원숭이|당나귀|곰|토끼|늑대|동물|fox|lion|tiger|cat|dog|monkey|animal/i.test(
    description,
  )
  if (hasAnimal && !wantsAnthro) extras.push(ANTHRO_NEGATIVE)
  if (/원숭이|monkey|macaque|primate|침팬지/i.test(description)) {
    extras.push('fox, red fox, shiba inu, dog, puppy, feline face, human baby')
  }
  if (/사자|lion/i.test(description) && /호랑이|tiger/i.test(description)) {
    extras.push('liger, hybrid cat, single animal only')
  }
  if (/젖\s*을?\s*먹|수유|breastfeed|nurs/i.test(description)) {
    extras.push('two identical adult faces, mirrored clone portrait, no infant')
  }
  if (isDanceRevision(description)) {
    extras.push('static standing pose, stiff arms at sides, arms glued to body, motionless stance, awkward frozen unnatural dance pose')
  }
  return extras.length ? `${FREE_NEGATIVE_PROMPT}, ${extras.join(', ')}` : FREE_NEGATIVE_PROMPT
}

/**
 * 전신 나체 텍스트 수정 전용 — CLIP ~77토큰 안에 탈의 지시가 앞에 오도록 짧게.
 * 몸매 투영이면 공식 정의(얼굴·체형 고정 + 옷 페이드 용해)를 최우선.
 */
export function buildNudeIdentityRefinePrompt(revision: string, baseDescription = ''): string {
  const rev = stripDefaultContinuityEchoes(polishKoreanPromptText(revision || ''))
  const specialized = isBodyProjectRequest(revision) || isBodyProjectRequest(rev)
  if (specialized) {
    return [
      buildNudeBecomesDefinitionLock(`${baseDescription || ''} ${rev}`),
      buildClothingSilhouetteBodyLock(`${baseDescription || ''} ${rev}`),
      buildBodyLandmarkNudeRevealLock(),
      'Fade-melt fabric only — nude skin appears at predicted nipple(유두) and navel(배꼽) anchors on the identical body.',
      'Same pose, framing, faces, person count. Not a new model. Not a smile-only touch-up.',
      'Photorealistic still — clothes must be gone; landmarks stay where the clothed silhouette implied.',
    ].join(' ')
  }
  // 일반 나체/탈의 (「나체가 되어」등)
  return [
    'FULL NUDE: same face and same body as source; remove all clothes — bare breasts and bare crotch, ZERO panties.',
    buildClothingSilhouetteBodyLock(`${baseDescription || ''} ${rev}`),
    'Keep any other person in the source — only undress the woman.',
    'Same background and framing. Photorealistic adult photo.',
    rev ? `User: ${rev}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/** 텍스트 수정 / 영역 수정용 프롬프트. genMode=free면 사람 얼굴 락을 쓰지 않는다. */
export function buildRefinePrompt(input: {
  baseDescription: string
  revision: string
  mode: 'text' | 'region'
  genMode?: 'free' | 'fashion'
}): string {
  const base = polishKoreanPromptText(input.baseDescription)
  const revision = polishKoreanPromptText(input.revision)
  // genMode='fashion'이라도 실제 서술이 동물/사물 장면이면 "성인 여성 얼굴 유지" 문구를 쓰지 않는다
  // (관리자가 화보 탭에서 동물 그림을 만들었다가 나중에 그 그림을 수정하는 경우가 실제로 있다).
  const free = input.genMode === 'free' || describesAnimalSubject(`${base} ${revision}`)
  // base/revision을 따로 넘긴다 — amplifyClothingAndScene 내부의 누드 판별(wantsFullNude)만
  // 분리해서 정확히 계산하고, 나머지(거울·배경·귀걸이 등) 판별은 그대로 base+revision
  // 전체 컨텍스트를 본다(기존과 동일).
  const revisionAmplify = free ? '' : amplifyClothingAndScene(base, revision)
  const freeEthnicity =
    free && mentionsHumanSubject(`${base} ${revision}`) ? defaultEthnicitySentence(`${base} ${revision}`) : ''

  // 전신 나체: 긴 일반 refine 프롬프트 대신 짧은 전용(탈의 지시가 CLIP 앞에 오도록)
  if (!free && input.mode === 'text' && wantsFullNude(revision, base)) {
    return buildNudeIdentityRefinePrompt(revision, base)
  }

  if (free) {
    if (input.mode === 'region') {
      return [
        'Local edit of an existing illustration/photo. ONLY change the masked white areas.',
        `Local change: ${revision}.`,
        'Do NOT replace animals with a human fashion model. Preserve species, pose, and unmasked scene.',
        freeEthnicity,
        base ? `Scene context: ${base}.` : '',
        'Photorealistic seamless inpaint, same lighting.',
      ]
        .filter(Boolean)
        .join(' ')
    }
    return [
      'Edit the SAME scene. Keep original subjects (animals/objects) and setting.',
      `Apply exactly: ${revision}.`,
      // wantsFullNude(revision, base) — "치마를 벗기고 바지를 입혀라" 같은 옷 교체 요청까지
      // "bare skin, remove garments" 지시를 넣으면 착의 지시와 정반대로 충돌한다. base를
      // 같이 넘겨서 이전 라운드에 확립된 누드 상태는 계속 승계되게 한다.
      wantsFullNude(revision, base)
        ? `Adult full nude: bare skin — remove robe/bra/pants/skirt/panties/thong completely; bare crotch, no underwear left on. ${buildNudeAnatomyVisibilityLock(`${base} ${revision}`)}`
        : 'CRITICAL: Do NOT invent a human woman, fashion model, bathrobe, or studio portrait.',
      freeEthnicity,
      base ? `Original scene (must still hold): ${base}.` : '',
      'Photorealistic illustration fidelity to the brief.',
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (input.mode === 'region') {
    if (wantsJewelryAccessoryRefine(revision)) {
      return buildJewelryAccessoryRefinePrompt(revision)
    }
    return [
      'Local edit of an existing photo. ONLY change the masked white areas.',
      `Local change: ${revision}.${revisionAmplify}`,
      'Follow the revision exactly, including adult / nude / erotic changes when requested.',
      // 영역 지정(인페인트) 수정에도 텍스트 수정과 동일하게 "속옷 재등장 금지"를 명시한다 —
      // 예전엔 이 분기엔 없어서, 마스크한 부분에서 옷/속옷을 지워달라고 해도 모델이 학습
      // 편향으로 브라·팬티를 다시 그려 넣는 사고가 텍스트 수정 경로보다도 더 흔했다
      // (마스크 영역이 좁아 모델이 "뭔가로는 채워야 한다"고 판단하기 쉬움).
      wantsFullNude(revision, base)
        ? `Adult full nude inside the mask: remove garment AND panties/thong — bare breasts and bare crotch, no underwear redrawn. ${buildNudeAnatomyVisibilityLock(`${base} ${revision}`)}`
        : '',
      'Do NOT invent a new person, new face, new body, or new scene outside the mask.',
      'Do NOT invent a surgical face mask, medical mask, or new buildings in the background.',
      buildIroncladIdentityLock(revision, base),
      'Preserve unmasked pixels exactly — same woman.',
      base ? `Context: ${base}.` : '',
      'Photorealistic seamless inpaint, same lighting and color grade — no pale bleach, no dark muddy skin.',
    ]
      .filter(Boolean)
      .join(' ')
  }
  // IDENTITY LOCK 문구가 리비전이 실제로 바꾸려는 속성까지 "그대로 유지하라"고 동시에
  // 지시하면 모델에게 자기모순된 신호를 준다 — 예: "머리색을 빨간색으로 바꿔줘"인데
  // 잠금 문구엔 "same hair"가 그대로 박혀 있는 식. 실측으로 이런 모순이 있으면 모델이
  // 지시 전체의 신뢰도를 낮게 보고 얼굴·의상까지 필요 이상으로 크게 갈아엎는 경향이
  // 확인됐다. 리비전이 실제로 겨냥하는 속성만 잠금 목록에서 뺀다.
  const revisionTargetsHair = /머리\s*(색|카락|스타일)|염색|dye|hair\s*color/i.test(revision)
  const revisionTargetsEyes = /눈\s*(색|동자)|eye\s*color|colored\s*contacts?/i.test(revision)
  const revisionTargetsLips = /입술\s*색|립스틱|lipstick|lip\s*color/i.test(revision)
  const revisionTargetsSkinTone = /피부\s*(색|톤)|태닝|skin\s*tone|\btan\b|하얗|검게|어둡게/i.test(revision)
  // 「허리까지 그려줘」의 허리는 체형 변경이 아님 — 체형 키워드만 잠금 해제
  const revisionTargetsBody =
    /체형|몸매|살\s*빼|살\s*찌|다이어트|가슴\s*(키우|줄이|크게|작게)|잘록한\s*허리|엉덩이\s*(키우|줄이)|body\s*type|lose\s*weight|gain\s*weight|breast\s*(size|enlarge|reduce)/i.test(
      revision,
    )
  const revisionTargetsPubic = /음모|치모|제모|민무늬|pubic|shav(e|ed)|wax/i.test(revision)
  const identityLockAttributes = [
    !revisionTargetsEyes && 'same eyes',
    'same nose',
    !revisionTargetsLips && 'same lips',
    !revisionTargetsHair && 'same hair',
    !revisionTargetsSkinTone && 'same natural Korean skin tone (not pale white, not dark brown)',
    !revisionTargetsBody && 'same body type',
    !revisionTargetsPubic && wantsFullNude(revision, base) && 'same pubic detail as source',
  ].filter((v): v is string => Boolean(v))

  // 이 문장형 프롬프트는 그대로 SDXL/Juggernaut(CLIP ~77토큰≈65~70단어) img2img 엔진에
  // 들어가는데, 예전엔 단어 예산 제한이 전혀 없었다 — 실측으로 재보니 고정 지시문만 합쳐도
  // 100단어를 넘어서, "원본 참고문(Original brief)"이나 "배경 유지"/"란제리 안전문구" 같은
  // 뒤쪽 문장이 CLIP 인코더에 의해 조용히 잘려나가고 있었다(수정을 반복할수록 base가
  // 길어져 더 심해짐 — "수정할수록 얼굴/의상이 이상하게 무너진다"는 반복 신고의 핵심
  // 원인 중 하나). 고정 문구를 최대한 짧게 줄이고, revision은 절대 자르지 않은 채
  // amplify/base(원본 참고문 — 어차피 img2img는 원본 이미지 픽셀을 직접 보므로 텍스트
  // 손실의 피해가 상대적으로 적다)에 남는 예산을 나눠서 CLIP 한도 안에서 핵심 안전
  // 지시(배경 유지·가운 방지·란제리)가 항상 살아남게 한다.
  // SINGLE FRAME을 맨 앞에 — 실측: 비교 UI 스크린샷·정밀모델에서 좌우 이중 초상이 한 장에 박힘
  const imgEditPrefix =
    'SINGLE FRAME ONLY: one photo, one woman. FORBIDDEN: diptych, split screen, side-by-side twin, before-after collage, two panels.'
  const identityLockSentence = `${buildIroncladIdentityLock(revision, base)} IDENTITY LOCK: same face, ${identityLockAttributes.join(', ')}.`
  const applyPrefix = 'ONLY apply this change:'
  const framingCastNote =
    'Same camera framing and crop as the source (full-body stays full-body; no bust zoom). Still exactly one subject in one frame.'
  const bgAndPoseNote = 'Keep background and pose unchanged unless the change requires it.'
  const bathrobeNote = 'Do not add a bathrobe, kimono, or coat unless requested.'
  const nudeOrLingerieNote = wantsFullNude(revision, base)
    ? `CRITICAL FULL NUDE: remove ALL garments — robe, gown, sweater, bra, pants, skirt, AND panties/thong/briefs/underwear. Bare breasts with visible nipples AND bare crotch (no fabric on hips/mons). End state: fully nude adult woman, zero underwear remnant. ${buildNudeAnatomyVisibilityLock(`${base} ${revision}`)}`
    : 'If lingerie/underwear is requested, show it, never a robe.'
  const contextPrefix = 'Context (must still hold):'
  const photoNote = 'Photorealistic, same lighting. Reminder: single frame, not a dual portrait.'

  // 모든 고정 문구 단어 수를 먼저 합산하고, revision(절대 안 자름)을 뺀 나머지만
  // amplify/base에 나눠준다 (CLIP ~77토큰 예산).
  const fixedWords =
    countWords(imgEditPrefix) +
    countWords(identityLockSentence) +
    countWords(applyPrefix) +
    countWords(framingCastNote) +
    countWords(bgAndPoseNote) +
    countWords(bathrobeNote) +
    countWords(nudeOrLingerieNote) +
    countWords(contextPrefix) +
    countWords(photoNote)
  const remainingForAmplifyAndBase = Math.max(0, SDXL_WORKING_BUDGET_WORDS - fixedWords - countWords(revision))
  const amplifyBudget = Math.min(countWords(revisionAmplify), Math.ceil(remainingForAmplifyAndBase * 0.6), 15)
  const cappedAmplify = capWordsSimple(revisionAmplify.replace(/^,\s*/, ''), amplifyBudget)
  const baseBudget = Math.max(0, remainingForAmplifyAndBase - countWords(cappedAmplify))
  const cappedBase = capWordsSimple(base, baseBudget)

  return [
    `${imgEditPrefix} ${identityLockSentence}`,
    `${applyPrefix} ${revision}.${cappedAmplify ? ` ${cappedAmplify}.` : ''}`,
    framingCastNote,
    bgAndPoseNote,
    bathrobeNote,
    nudeOrLingerieNote,
    cappedBase ? `${contextPrefix} ${cappedBase}.` : '',
    photoNote,
  ]
    .filter(Boolean)
    .join(' ')
}

// 화보 설명(원본 + 수정 라운드마다 누적되는 텍스트)은 최대 3000자까지 허용되지만, 영상
// 모델에게는 "정체성/의상 참고용" 참고문일 뿐이다. 수정을 여러 번 거친 이미지일수록 이 텍스트가
// 계속 길어지고, 그 안에 새 포즈·동작 서술이 섞여 있는 경우가 많아서(예: "자전거를 타고" 같은
// 동작 문구) 실제로 요청한 모션 힌트와 은근히 경쟁하며 순응도를 떨어뜨리는 사고가 실측으로
// 확인됐다("2차/3차 수정 이후 만든 쇼츠일수록 모션이 잘 안 먹힌다"). 참고문은 짧게 잘라서
// 정체성·의상·배경 같은 핵심만 남기고, 뒤에 누적된 최근 수정 문구의 비중을 줄인다.
const ANIMATION_CONTINUITY_MAX_CHARS = 260

function truncateContinuityText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const slice = text.slice(0, maxLen)
  const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(', '), slice.lastIndexOf(' '))
  const cut = lastBreak > maxLen * 0.5 ? lastBreak : maxLen
  return slice.slice(0, cut).trim()
}

/**
 * I2V 모션: 애무·눕기·올라타기 등 Wan이 무시하기 쉬운 성인 동작을 영어 동작 지시로 증폭.
 * (단순 번역만 넣으면 "subtle camera / limbs only" 잠금에 밀려 안 먹히는 실측)
 */
export function amplifyAdultMotionForVideo(motion: string): {
  addon: string
  wantsPartner: boolean
  wantsPoseChange: boolean
} {
  const t = polishKoreanPromptText(motion || '')
  const bits: string[] = []
  let wantsPartner = false
  let wantsPoseChange = false

  // 가슴/유두 빨기 — 빤다/빨아/빨아라 포함
  if (
    /(?:가슴|젖|유방|유두|젖꼭지)\s*(?:을\s*|를\s*)?(?:빨|빤)|빨아(?:라|줘|요)?|빤다|빨며|빨고|suck(?:s|ing)?\s*(?:on\s*)?(?:her\s*)?(?:breast|nipple)/i.test(
      t,
    )
  ) {
    wantsPartner = true
    bits.push(
      'VISIBLE oral contact on the bare breast and nipple: mouth and lips sealed on the nipple, tongue and rhythmic sucking, breast soft tissue moving with each suck — not a freeze, not staring without contact',
    )
  }

  // 눕다 / 눕히다
  if (/눕|누워|lie\s*down|lying\s*(?:down|back)|lays?\s*(?:her\s*)?down|laid\s*(?:her\s*)?down/i.test(t)) {
    wantsPoseChange = true
    if (/눕히|눕혀|눕힌|lays?\s*her|laid\s*her/i.test(t)) wantsPartner = true
    bits.push(
      'FULL BODY pose change to lying on her back: she reclines onto the surface, head settles back, torso horizontal, legs rest — she must NOT stay standing for the whole clip',
    )
  }

  // 배 위에 올라탄다 / 걸터앉다
  if (
    /배\s*위|올라\s*타|올라탄|올라타|걸터|타고\s*앉|straddl|mount(?:s|ing)?(?:\s+(?:her|on))?|on\s*(?:her\s*)?(?:belly|stomach|abdomen|torso)/i.test(
      t,
    )
  ) {
    wantsPartner = true
    wantsPoseChange = true
    bits.push(
      'a second consenting adult straddles / sits astride on her belly or lower torso with clear weight and hip placement on the abdomen — not standing beside her, not a solo pose',
    )
  }

  // 보지/크롯치 애무 — 가슴 애무로 오인되면 허벅지만 스치는 실패가 남음(실측)
  const crotchTouch =
    /(?:보지|음부|성기|클리토리스|클리|외음|사타구니|가랑이|크롯치|crotch|pussy|vulva|clit(?:oris)?|labia|mons)\s*(?:을|를|을\s*|를\s*)?(?:만지|주무르|애무|쓰다듬|문지르|비비|자극)|(?:만지|주무르|애무|쓰다듬|문지르)\s*(?:는\s*|고\s*)?(?:보지|음부|성기|크롯치)|fondl(?:e|es|ing)\s*(?:her\s*)?(?:crotch|pussy|vulva|clit)|rub(?:s|bing)?\s*(?:her\s*)?(?:crotch|pussy|vulva)|finger(?:s|ing)?\s*(?:her\s*)?(?:crotch|pussy|vulva|clit)/i.test(
      t,
    )
  if (crotchTouch) {
    wantsPoseChange = true
    // 파트너 명시 없으면 본인 손으로 (CAST LOCK과 충돌해 손이 허벅지로 도망가는 회귀 방지)
    if (/파트너|남자|남친|애인|상대|partner|man\s+hand|his\s+hand/i.test(t)) {
      wantsPartner = true
      bits.push(
        'CROTCH FONDLE: a consenting adult partner hand stays ON her bare vulva/crotch for most of the clip — fingers press and rub the bare genitals continuously with clear skin contact',
      )
    } else {
      bits.push(
        'CROTCH FONDLE (self): her own hand stays ON her bare vulva/crotch for most of the clip — fingertips press and rub the bare genitals with continuous skin contact',
      )
    }
    bits.push(
      'PANTY OFF FIRST: panties/thong/briefs must be fully removed before the fondling — bare crotch with adult pubic hair visible under the hand',
      'FORBIDDEN: hand hovering near the hip/thigh without touching genitals; hand only on outer thigh; fondling over panties; ending still wearing underwear',
      'LAST FRAME: hand still contacting bare crotch — do not return to the source still pose',
    )
  }

  // 가슴 만짐/애무 — 「만지면서」활용형·가슴+만지 조합을 명시적으로 (키스만 되고 손은 빠지는 실측)
  // 보지 애무만 있을 때는 가슴으로 가로채지 않음
  const breastTouch =
    !crotchTouch &&
    /(?:가슴|젖|유방|젖가슴)\s*(?:을|를)?\s*(?:만지|주무르|애무|쓰다듬|문지르)|만지면서|주무르면서|애무하|caress(?:es|ing)?\s*(?:her\s*)?(?:breast|chest)|fondl(?:e|es|ing)\s*(?:her\s*)?(?:breast|chest)|hand(?:s)?\s*(?:on|cupping)\s*(?:her\s*)?(?:breast|chest|boob)/i.test(
      t,
    )
  if (breastTouch) {
    wantsPartner = true
    wantsPoseChange = true
    bits.push(
      'sustained breast fondling for most of the clip: hand stays on her bare breast, squeezing and stroking continuously — not a one-second tap',
    )
  }

  // 키스·기타 애무 (파트너 동작이 흔한 케이스)
  if (/딥\s*키스|키스|kiss(?:es|ing)?/i.test(t)) {
    wantsPartner = true
    wantsPoseChange = true
    bits.push(
      'mandatory deep mouth-to-mouth kissing for most of the clip — lips locked together, heads leaning in, continuous kiss (not a quick peck, not faces apart)',
      'slight natural teeth OK if lips part; no wide Hollywood grin',
      'last frame still kissing — do not return to the source still pose',
    )
    if (/나체|누드|nude|naked|전라|topless/i.test(t)) {
      bits.push('kissing while fully nude, bare breasts visible')
    }
  }
  if (
    !breastTouch &&
    !crotchTouch &&
    /애무|쓰다듬|주무르|만지|문지르|caress|fondl|grope|rub(?:s|bing)?\s*(?:her\s*)?(?:breast|body|chest)/i.test(
      t,
    )
  ) {
    if (!/스스로|혼자|self[\s-]?touch|masturbat/i.test(t)) wantsPartner = true
    wantsPoseChange = true
    bits.push(
      'hands actively caressing the body/breasts with continuous touching — fingers press and stroke, not a static hand pose',
      'END POSE: keep the intimate contact through the last frame — do not return to the source still pose',
    )
  }

  return { addon: bits.join('. '), wantsPartner, wantsPoseChange }
}

/**
 * 얼굴·체형·나체·음모 등 "기본 구조"를 소스와 같게 묶는 잠금 문구.
 * 텍스트에 힌트가 있으면 구체화하고, 없어도 I2V/수정이 구조를 갈아엎지 못하게 최소 잠금을 건다.
 * (모션이 바꾸라고 한 속성 — 예: 착의 — 은 호출 쪽에서 빼거나 덮어쓴다.)
 */
export function buildAdultStructureLock(
  text: string,
  opts?: { forNudeHold?: boolean; allowPoseChange?: boolean },
): string {
  const t = polishKoreanPromptText(text || '')
  const bits: string[] = [
    'STRUCTURE LOCK from the source image: same face identity, same age look',
    'same natural East Asian / Korean skin tone — not pale white, not muddy dark brown',
    'same body type and silhouette (shoulders, waist, hips, breast size/shape, limb proportions)',
    buildClothingSilhouetteBodyLock(t),
    buildKoreanTwentiesLookLock(t),
  ]
  // 남성이 실제로 언급될 때만 — couple만으로 남성 털 락을 걸면 여여 장면이 남성화되는 회귀
  if (
    /남자|남성|남녀|남친|남자와|man\b|male\b|boyfriend/i.test(t) &&
    !/여성\s*두|여자\s*둘|두\s*여성|두\s*여자|two\s*women|both\s*women|여여/i.test(t)
  ) {
    bits.push(buildKoreanMaleBodyHairLock())
  }

  if (/글래머|글래머러스|글래머체|풍만|글래머\s*몸|curvy|voluptuous|hourglass/i.test(t)) {
    bits.push('curvy glamorous figure — keep that body type, do not slim her down')
  } else if (/슬림|마른|날씬|가느다란|slim|slender|thin\b/i.test(t)) {
    bits.push('slim slender figure — keep that body type, do not bulk her up')
  } else if (/탄탄|근육|운동|athletic|fit\b|toned/i.test(t)) {
    bits.push('athletic toned figure — keep muscle tone and proportions')
  } else if (/통통|포동|플러스|chubby|plus[\s-]?size|plump/i.test(t)) {
    bits.push('soft fuller figure — keep that body type')
  }

  if (/큰\s*가슴|풍만\s*가슴|거유|large\s*breasts?|busty/i.test(t)) {
    bits.push('same large breast size/shape as source — never shrink to barbie/tiny breasts when nude')
  } else if (/작은\s*가슴|빈유|small\s*breasts?/i.test(t)) {
    bits.push('same small breast size/shape as source')
  }
  // 키스·파트너 등장 시 가슴이 커지거나 위치가 바뀌는 드리프트 실측
  bits.push(
    'BREAST PIXEL LOCK from source still: same breast volume, shape, cleavage spacing, and vertical placement on the ribcage — do not enlarge, shrink, lift to the collarbone, or drop toward the belly',
  )
  if (/가는\s*허리|얇은\s*허리|잘록|개미\s*허리|slim\s*waist|narrow\s*waist|wasp\s*waist/i.test(t)) {
    bits.push('same slim narrow waist as source / clothed silhouette')
  }

  if (opts?.forNudeHold || wantsFullNude(t) || /음모|치모|누드|나체|nude|naked/i.test(t)) {
    bits.push(
      buildFemaleAdultAnatomyLock(t),
      'nude anatomy continuity: same woman, female breasts and bare hips/crotch — no underwear redrawn',
      // I2V는 과도한 음모 장문이 안전필터·순응도 모두 해침 → 짧게
      opts?.forNudeHold
        ? 'adult nude crotch, natural adult pubic detail, no panties'
        : buildAdultPubicHairLock(t),
    )
  }

  bits.push(
    opts?.allowPoseChange
      ? 'Do NOT morph into a different woman or different face. Pose MAY change for the motion (kiss lean-in, hand on breast, undress) and MUST STAY in that new pose at the end — FORBIDDEN returning to the exact source still pose.'
      : 'Do NOT morph into a different woman, different face, or different body. Small natural motion is OK; do not hard-reset to a different identity.',
  )
  return bits.join('. ') + '.'
}

/**
 * 모션이 「이미 나체 유지」만 명시하고 탈의·전환을 말하지 않는지.
 * (dual-b 후반 등 — 진짜 유지 경로)
 */
export function motionExplicitNudeHoldOnly(motion: string): boolean {
  const t = polishKoreanPromptText(motion || '')
  if (!t) return false
  const hold =
    /이미\s*(완전\s*)?나체\s*유지|나체\s*유지(?:하며|하고|한\s*채)?|fully\s*nude\s*hold|already\s*(fully\s*)?nude\s*(?:hold|stay|keep)|stay(?:s|ing)?\s*(?:fully\s*)?nude/i.test(
      t,
    )
  if (!hold) return false
  // 유지라고 써도 벗기/팬티제거/나체로 전환이면 탈의 경로
  if (wantsUndressAction(t)) return false
  if (/나체로|누드로|올\s*누드|완전\s*나체로|옷을\s*벗겨|팬티\s*(?:를\s*)?(?:벗|제거|없)|속옷\s*(?:을\s*)?(?:벗|제거|없)/i.test(t)) {
    return false
  }
  return true
}

/**
 * 쇼츠 모션이 나체·탈의를 요구하면 탈의(전환) 경로로 강제.
 * 「나체」(조사 로 없음)도 포함 — 예전엔 「나체로」만 잡아, 누적 「현재 나체」와 만나
 * staysNude(유지)로 떨어져 팬티가 픽셀 그대로 남는 회귀가 있었음.
 */
export function motionForcesBecomeNude(motion: string): boolean {
  const t = polishKoreanPromptText(motion || '')
  if (!t) return false
  if (motionExplicitNudeHoldOnly(t)) return false
  // 몸매 투영 = 탈의·신체 복구 전환
  if (isBodyProjectRequest(t)) return true
  if (wantsUndressAction(t)) return true
  // 상태 단어 「나체/누드」만 있어도 쇼츠에서는 전환으로 본다 (정지 이미지에 속옷 잔존 흔함)
  if (wantsNudeOrUndress(t)) return true
  return /올\s*누드|전라|fully\s*nude|get(?:s|ting)?\s*(?:fully\s*)?naked/i.test(t)
}

/**
 * 나체/누드 요청 모션에 팬티·의상 잔존 방지 문구를 붙인다.
 * 중요: 소스가 아직 옷을 입은 상태인데 「이미 나체 유지」를 붙이면
 * Wan이 탈의를 건너뛰고 팬티만 남긴 채 동작을 하는 실측이 있었음 → 소스 상태로 문구를 가른다.
 */
export function ensureNudeHoldMotionPhrase(motion: string, opts?: { sourceAlreadyNude?: boolean }): string {
  const t = polishKoreanPromptText(motion || '')
  if (!t) return t
  const asksNude =
    wantsNudeOrUndress(t) ||
    wantsUndressAction(t) ||
    wantsFullNude(t) ||
    /누드|나체|nude|naked/i.test(t)
  if (!asksNude && !opts?.sourceAlreadyNude) return t

  const pantyBan =
    '브라·팬티·바지·치마·끈팬티 한 픽셀도 남기지 말 것 — 끝까지 완전 나체. 팬티 대신 뿌연 블러·안개·김·모자이크·피부색 얼룩 장애물도 금지 — 크롯치는 선명히 보이고 성인 체모(곱슬 음모)는 유지'
  const fogBanEn =
    'FORBIDDEN foggy blur / milky haze / steam cloud / cloudy smudge over crotch (fake panty substitute). Uncensored sharp crotch with natural adult pubic hair visible — not a shaved blank doll crotch, not fog.'

  // 모션이 나체/탈의를 요구하면(유지-only가 아니면) 소스 마커와 무관하게 전환
  if (motionForcesBecomeNude(t)) {
    let cleaned = t
      .replace(/이미\s*(완전\s*)?나체\s*유지\s*(\([^)]*\))?\s*\.?\s*/gi, '')
      .replace(/fully\s*nude\s*hold[^.]*\.?\s*/gi, '')
      .replace(/already\s*(fully\s*)?nude[^.]*\.?\s*/gi, '')
      .trim()
    if (isBodyProjectRequest(cleaned)) {
      return `BODY PROJECTION (몸매 투영): keep same faces/bodies; predict nipple(유두)+navel(배꼽) under clothes; dissolve fabric only onto those anchors; panties/briefs must leave. FORBIDDEN new body, gender swap, smile-only, fog. ${pantyBan}. ${fogBanEn}. ${cleaned}`
    }
    if (/옷을\s*벗겨\s*완전\s*나체|완전\s*나체로\s*전환|undress\s*to\s*full\s*nude|take\s*off\s*all\s*(?:clothes|clothing|panties)/i.test(cleaned)) {
      return /팬티|panty|블러|뿌연|fog|blur/i.test(cleaned)
        ? cleaned
        : `${cleaned}. ${pantyBan}. ${fogBanEn}`
    }
    return `Take off ALL clothes including panties/thong in the first third — then the action. FORBIDDEN clothed conversation or foggy crotch blur. ${pantyBan}. ${fogBanEn}. ${cleaned}`
  }

  // 명시적 유지-only 또는 (모션에 나체 요청 없이) 소스만 나체 마커
  if (opts?.sourceAlreadyNude || motionExplicitNudeHoldOnly(t)) {
    if (/이미\s*(완전\s*)?나체\s*유지|fully\s*nude\s*hold|already\s*(fully\s*)?nude/i.test(t)) {
      return /팬티|panty|블러|뿌연|fog|blur/i.test(t)
        ? `${t}. ${fogBanEn}`
        : `${t}. If any panties/underwear or foggy blur remain in the source, remove them immediately. ${pantyBan}. ${fogBanEn}`
    }
    return `이미 완전 나체 유지. 소스에 팬티·뿌연 블러가 보이면 즉시 제거. ${pantyBan}. ${fogBanEn}. ${t}`
  }

  // 착의 소스: 「이미 나체」문구가 있으면 오히려 해로우니 제거·교체
  let cleaned = t
    .replace(/이미\s*(완전\s*)?나체\s*유지\s*(\([^)]*\))?\s*\.?\s*/gi, '')
    .replace(/fully\s*nude\s*hold[^.]*\.?\s*/gi, '')
    .replace(/already\s*(fully\s*)?nude[^.]*\.?\s*/gi, '')
    .trim()
  if (/옷을\s*벗겨\s*완전\s*나체|완전\s*나체로\s*전환|undress\s*to\s*full\s*nude/i.test(cleaned)) {
    return cleaned
  }
  return `옷을 벗겨 완전 나체가 된 뒤 동작(팬티·브라 포함 전부 제거, 뿌연 블러 금지). ${pantyBan}. ${fogBanEn}. ${cleaned}`
}

/** 모션에 「클로즈업으로 끝내」「줌인 유지」 등 — 2프레임 후반 줌아웃 대신 클로즈 종결 */
export function wantsEndCloseUp(motion: string): boolean {
  const t = polishKoreanPromptText(motion || '')
  return /클로즈\s*업\s*(으로\s*)?(끝|종|마무리)|줌\s*인\s*(으로\s*)?(끝|유지|종)|줌인\s*상태|클로즈업\s*상태|가까이\s*(에서\s*)?(끝|마무리)|close[\s-]?up\s*(end|ending|finish|hold)|end\s*(on\s*)?(a\s*)?close[\s-]?up|stay\s*zoomed|keep\s*zoomed|no\s*zoom[\s-]?out/i.test(
    t,
  )
}

/** 정지 이미지를 짧은 영상으로 바꿀 때 쓰는 I2V 모션 프롬프트.
 *  clipRole: single=한 클립(줌 연출 없음) · dual-a=24/30 전반 · dual-b=후반 */
export function buildAnimationPrompt(input: {
  prompt?: string
  motion?: string
  clipRole?: 'single' | 'dual-a' | 'dual-b'
  landmarks?: BodyLandmarks | null
  /** 「몸매 투영」버튼 — 번역으로 한글 트리거가 희석돼도 become 경로 고정 */
  bodyProject?: boolean
}): string {
  const fullOriginal = polishKoreanPromptText(input.prompt ?? '')
  const clipRole = input.clipRole === 'dual-a' || input.clipRole === 'dual-b' ? input.clipRole : 'single'
  const landmarks = input.landmarks ? normalizeBodyLandmarks(input.landmarks) : null
  const endCloseUp = wantsEndCloseUp(input.motion ?? '')
  // 참고문은 짧게 줄여서 모션 힌트와의 경쟁을 줄이지만, 누드/탈의 판별(sourceIsNude)은
  // 원문 전체로 해야 한다 — 여러 번 수정을 거치며 누적된 텍스트는 "누드로 바꿔줘" 같은
  // 문구가 뒤쪽(잘려 나가는 부분)에 있을 수 있어서, 잘린 텍스트만 보면 이미 누드인 원본을
  // "옷을 입은 상태"로 잘못 판정해 되레 옷을 입혀버리는 사고가 날 수 있다.
  const motion = polishKoreanPromptText(input.motion ?? '')
  const intimate = amplifyAdultMotionForVideo(motion)
  // 단일 판별기 — 누적 base의 몸매 투영 잔여만으로 매번 탈의 강제하지 않음
  const nudeIntent = resolveNudeIntent({
    motion,
    prompt: fullOriginal,
    base: fullOriginal,
    bodyProject: input.bodyProject === true,
  })
  const forceBecomeNude =
    nudeIntent.mode === 'become' || (!motion.trim() && isBodyProjectRequest(fullOriginal))
  const holdOnly = nudeIntent.mode === 'hold'
  const continuityText = stripNudeBecomesPhrase(fullOriginal)
  const sourceIsNude =
    !forceBecomeNude &&
    (holdOnly ||
      /현재\s*나체|옷\s*없음/.test(continuityText) ||
      (/fully\s*nude|already\s*(fully\s*)?nude|bare\s*breasts?\s*,\s*visible\s*nipples?/i.test(
        continuityText,
      ) &&
        !NUDE_STATE_WORD_PATTERN.test(motion)))
  const undressAction =
    forceBecomeNude ||
    wantsUndressAction(motion) ||
    (wantsNudeOrUndress(motion) && !sourceIsNude)
  const dressAction = !undressAction && wantsDressAction(motion)
  const staysNude = sourceIsNude && !undressAction && !dressAction
  const structureCorpus = `${fullOriginal}\n${motion}`
  const coupleRequested =
    intimate.wantsPartner ||
    /남녀|남여|둘\s*다|남자와|여성과|커플|서로|partner|couple|both\s*adults|man\s+and\s+woman/i.test(
      `${motion} ${fullOriginal}`,
    )

  // 몸매 투영 전용 — 버튼(bodyProject) 또는 유효 타점이 있을 때만 become 단축.
  // 모션 문구에 「몸매 투영」이 남아 있어도 키스/애무 leanIntimate를 가로채지 않는다.
  if (input.bodyProject === true || landmarks) {
    return buildNudeBecomesAnimationPrompt({
      motion: motion || '몸매 투영',
      clipRole,
      prompt: fullOriginal,
      landmarks,
    })
  }

  // 나체+키스/만짐: 장문 잠금이 Wan에서 키스·나체를 죽이고 "툭 만짐"만 남는 실측
  // → 짧은 동작 타임라인 전용 프롬프트로 보낸다.
  const leanIntimate =
    (undressAction || staysNude) &&
    (intimate.wantsPartner ||
      intimate.addon.includes('CROTCH FONDLE') ||
      /키스|kiss|만지|애무|가슴|보지|음부|성기|crotch|pussy/i.test(motion))

  if (leanIntimate) {
    const wantsKiss = /키스|kiss/i.test(motion)
    const wantsCrotch =
      intimate.addon.includes('CROTCH FONDLE') ||
      /보지|음부|성기|클리|외음|크롯치|crotch|pussy|vulva|clit/i.test(motion)
    const wantsBreast =
      !wantsCrotch &&
      (intimate.addon.includes('breast fondling') ||
        /(?:가슴|젖|유방)\s*(?:을|를)?\s*(?:만지|주무르|애무)|breast\s*fondl/i.test(motion))
    const crotchBeat = wantsCrotch
      ? intimate.wantsPartner
        ? 'BEAT 2 (rest of clip): partner hand ON her bare vulva/crotch — fingers rub and stroke the bare genitals with continuous skin contact. ZERO panties. FORBIDDEN hand only on thigh/hip.'
        : 'BEAT 2 (rest of clip): her own hand ON her bare vulva/crotch — fingertips rub and stroke the bare genitals with continuous skin contact. ZERO panties. FORBIDDEN hand hovering on thigh without touching genitals.'
      : ''
    const beats = [
      'Adult photorealistic video. Same Korean woman face as the input image.',
      isBodyProjectRequest(motion) ? buildNudeBecomesDefinitionLock(`${fullOriginal} ${motion}`) : '',
      'PANTY BAN FIRST: bare crotch in every frame after beat 1 — ZERO panties, thong, briefs, lingerie bottoms. Underwear must leave the body before any fondling.',
      buildNudeCensorFogBanLock(),
      undressAction
        ? 'BEAT 1 (first third): she pulls off ALL clothes — top, bra, pants/skirt, AND panties/thong — until fully nude with bare breasts, nipples, and bare hips/crotch. Underwear must leave her body and exit the frame (not left on, not at ankles). No fog left where panties were.'
        : 'BEAT 1: she is fully nude — bare breasts, clear bare crotch (no blur mist, no panties). If the source still shows panties/underwear or a foggy patch, remove them in the first seconds BEFORE any hand action.',
      wantsCrotch
        ? crotchBeat
        : wantsKiss && wantsBreast
          ? 'BEAT 2 (rest of clip): a consenting adult partner deep-kisses her mouth while continuously fondling her bare breast with his hand. Kiss AND breast touch both stay visible — not a quick peck, not a one-tap.'
          : wantsKiss
            ? 'BEAT 2 (rest of clip): a consenting adult partner deep-kisses her mouth continuously — lips locked, heads lean in, most of the clip is kissing.'
            : wantsBreast
              ? 'BEAT 2 (rest of clip): a hand continuously fondles her bare breast — sustained caress, not a tap.'
              : intimate.addon
                ? `BEAT 2 (rest of clip): ${intimate.addon}`
                : 'BEAT 2: continue the requested nude intimate action with clear hand-to-skin contact.',
      wantsCrotch
        ? 'LAST FRAME: fully nude, ZERO panties, hand still on bare crotch/vulva. Do NOT return to the opening still pose.'
        : 'LAST FRAME: still fully nude (bare breasts + sharp bare crotch, ZERO panties, ZERO fog patch), still in the intimate pose. Do NOT return to the opening still pose. Do NOT put clothes back on.',
      'Same face identity and breast size as the source. Stable camera, no zoom-in.',
      motion ? `User motion: ${motion}` : '',
      intimate.addon ? `ACTION LOCK: ${intimate.addon}` : '',
    ].filter(Boolean)
    return beats.join(' ')
  }

  // 나체 유지/탈의 시 continuity에 남은 "wearing…"·바지 서술이 옷을 다시 입힘(실측) → 제거
  let original = truncateContinuityText(fullOriginal, ANIMATION_CONTINUITY_MAX_CHARS)
  if (staysNude || undressAction) {
    original = original
      .replace(/\b(?:wearing|wears|dressed in|clothed in|in a|in an)\s+[^.,;]+/gi, 'bare skin')
      .replace(
        /(?:가운|로브|드레스|스웨터|니트|브라|팬티|속옷|바지|팬츠|청바지|슬랙스|치마|스커트|bathrobe|robe|sweater|lingerie|pants|jeans|trousers|skirt)\s*(?:을|를|만)?\s*(?:입은|걸친|착용)?/gi,
        '',
      )
      .replace(/\b(?:pants|jeans|trousers|panties|bra|skirt)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    original = truncateContinuityText(original, ANIMATION_CONTINUITY_MAX_CHARS)
  }

  // 모션 지시는 맨 앞에 CRITICAL로 강조한다. 예전엔 긴 "원본 연속성" 문단(원본 이미지
  // 프롬프트 전체) 뒤에 짧게 붙어 있어서, Wan I2V가 앞부분의 장문 설명에 가중치를 두고
  // 사용자가 요청한 모션(예: 특정 동작·전환)을 잘 따라가지 않는 문제가 있었다.
  const parts = ['Premium photorealistic adult short-form video.']
  // 나체 유지는 모션보다 앞에 — Wan이 뒤쪽 누드 락을 무시하고 옷을 입히던 실측
  const koreanLook = buildKoreanTwentiesLookLock(structureCorpus)
  if (koreanLook) parts.push(koreanLook)
  if (staysNude || undressAction) {
    parts.push(buildFemaleAdultAnatomyLock(structureCorpus))
  }
  if (staysNude || undressAction) {
    if (isBodyProjectRequest(motion)) {
      parts.push(buildNudeBecomesDefinitionLock(`${fullOriginal} ${motion}`))
    }
    // 팬티 잔존·뿌연 검열이 최우선 실패 모드 — 얼굴/랜드마크보다 앞에 짧게 고정
    parts.push(
      'PANTY BAN: crotch and hips stay bare — ZERO panties, ZERO thong, ZERO briefs, ZERO lingerie bottoms, ZERO bikini bottoms in EVERY frame after undress begins. Pull underwear fully OFF the body (not left on, not at ankles).',
    )
    parts.push(buildNudeCensorFogBanLock())
    parts.push(buildFaceFrozenLock())
    parts.push(buildBodyLandmarkNudeRevealLock())
  }
  if (staysNude) {
    parts.push(
      'NUDE HOLD FIRST: source is already fully nude adult woman — bare female breasts with visible nipples, clear bare crotch, no clothing and no foggy censor patch in any frame.',
      'Keep the same body landmarks (breasts, waist, navel, hips) — only motion, not a new body.',
    )
  } else if (undressAction) {
    parts.push(
      'UNDRESS = clothing removal over a remembered body: dissolve/remove fabric while FACE stays the source face untouched.',
      'UNDRESS FIRST (while WIDE): early in the clip pull off sweater/cardigan AND jeans/pants/skirt AND panties/underwear completely — garments leave the body and exit the frame.',
      'End state: fully nude adult woman with soft female breasts and visible nipples — ZERO bra, ZERO panties, ZERO jeans, ZERO skirt, ZERO milky fog over crotch (not at ankles, not bunched, not half-on, not blurred).',
      'Body form memory: waist, breast size/placement, navel height match the clothed source — redraw nude skin on those anchors only.',
      'Do NOT interpret this as “already nude with panties still on” or “nude with fog covering crotch” — panties and fog must come off.',
    )
  }
  if (motion) {
    parts.push(
      `CRITICAL MOTION — this is the main point of the clip, follow it exactly: ${motion}.`,
    )
    if (intimate.addon) {
      parts.push(`ACTION DETAIL (must be visible on screen): ${intimate.addon}.`)
    }
  } else {
    parts.push('Natural movement, soft hair and fabric motion, confident pose.')
  }
  // "subtle camera motion"이 Wan에서 조기 줌인·클로즈업으로 해석되는 실측 → 잠금 구도일 때는 쓰지 않음
  const lockCameraForUndress = undressAction || staysNude
  if (clipRole === 'single' || (clipRole === 'dual-a' && undressAction)) {
    parts.push('Cinematic lighting; LOCKED camera — subject moves, framing does not tighten.')
  } else if (intimate.wantsPoseChange || intimate.wantsPartner) {
    parts.push('Cinematic lighting; subjects move within a stable frame.')
  } else {
    parts.push('Cinematic lighting, very slight steadiness — no push-in.')
  }
  // 줌/클로즈업: 단일(1회)은 전면 금지. 탈의 중에는 나체 완료 전 줌인 금지.
  if (clipRole === 'single') {
    parts.push(
      'CAMERA (single clip — NO CLOSE-UP): keep the EXACT same shot scale and crop as the source still for EVERY frame.',
      'FORBIDDEN for the whole single clip: zoom-in, push-in, dolly-in, smash zoom, face close-up, bust-only crop, headshot crop, tightening the frame.',
      'If the source shows hips/legs/full body, those areas MUST stay visible through the last frame — never crop them away.',
    )
    if (lockCameraForUndress) {
      parts.push(
        'SEQUENCE: undress / nude action happens while the camera STAYS WIDE — never zoom before or during undressing.',
      )
    }
  } else if (clipRole === 'dual-a') {
    if (undressAction) {
      // 전반은 탈의 완성에만 집중 — 줌은 후반(dual-b)으로 미룸 (나체 전 줌인 사고 방지)
      parts.push(
        'CAMERA (dual clip 1/2 — UNDRESS WIDE ONLY): hold the FULL source framing for the ENTIRE clip 1. Zero zoom-in, zero close-up, zero push-in.',
        'This clip’s job is finishing undress while wide. Do NOT begin any zoom bridge here — zoom belongs only after she is already fully nude (clip 2).',
        'Hips, legs, and crotch area stay in frame so pants/skirt/panties can be pulled fully off and leave the body.',
      )
    } else {
      parts.push(
        'CAMERA (dual clip 1/2): hold wide source framing through most of this clip.',
        'Only in the LAST portion of THIS clip begin a SLOW gradual zoom-in toward a medium framing — bridging into clip 2. Never smash-zoom at the start.',
      )
    }
  } else {
    // dual-b
    if (undressAction || staysNude) {
      parts.push(
        'CAMERA (dual clip 2/2): she should already be fully nude from clip 1 — keep framing wide enough at the start to confirm bare hips/breasts with no pants/skirt/panties left.',
        'Do NOT zoom-in until nude is clearly established. Any zoom only in the late portion, slow and slight.',
      )
    } else {
      parts.push(
        'CAMERA (dual clip 2/2): may continue a closer intimate framing from clip 1; early/mid portion stays stable.',
      )
    }
    if (endCloseUp) {
      parts.push(
        'USER REQUEST: END ON CLOSE-UP — only after nude/action is clear; do NOT zoom out; finish held in close-up as requested.',
      )
    } else if (!(undressAction || staysNude)) {
      parts.push(
        'In the FINAL portion of THIS clip, SLOWLY zoom back out to a wider closing frame (soft zoom-out ending). Do not smash cut.',
      )
    }
  }
  if (clipRole !== 'single') {
    parts.push(
      'If any zoom happens: SAME face identity and SAME skin color/tone as the source — no face morph, no pale bleach, no muddy recolor.',
      'NEVER zoom-in before clothing is fully removed when undress was requested.',
    )
  }
  // 키스·애무·탈의도 포즈 변경 허용 — limbs-only면 원자세로 되돌아가는 실측
  const allowPoseChange =
    intimate.wantsPoseChange || intimate.wantsPartner || undressAction || staysNude
  parts.push(
    buildAdultStructureLock(structureCorpus, {
      forNudeHold: undressAction || staysNude,
      allowPoseChange,
    }),
  )
  if (original) {
    if (staysNude || undressAction) {
      parts.push(
        `Subject continuity from source (FACE + BODY SHAPE only — IGNORE any clothing/lingerie in this text; motion requires FULL nude, no panties): ${original}`,
      )
    } else {
      parts.push(
        `Subject/appearance continuity from source image (identity/outfit reference only — the motion instruction above always takes priority): ${original}`,
      )
    }
  }
  if (undressAction) {
    parts.push(
      'TIMELINE (must all happen in this clip): (1) early — clothes/bra/panties come OFF to full nude; (2) mid-to-end — requested intimate action WHILE nude; (3) LAST FRAME still nude in that intimate pose.',
      'CRITICAL: do not skip step (1). Do not fondle over panties. Bare breasts and bare crotch before/during the action.',
      'If breast touch was requested: hand on her bare breast — visible every second of the intimate part.',
      'If crotch/보지 touch was requested: hand ON bare vulva/crotch with continuous skin contact — FORBIDDEN hand only on thigh; FORBIDDEN panties left on.',
      'Do NOT freeze clothed. ZERO panties/bra/jeans at the end. FORBIDDEN: snap back to the original source standing pose in the last frames.',
    )
  } else if (dressAction) {
    parts.push(
      'CRITICAL ADULT MOTION: the subject starts bare-skinned/nude and puts on or wraps herself in a garment (robe, dress, or clothing) during the clip; end state is dressed as requested.',
      'Do NOT freeze the subject fully nude for the whole clip. Do NOT keep bare skin visible at the end if the motion asks her to get dressed.',
      'Smooth dressing action, fabric sliding on and settling naturally onto the body.',
      'While dressing, keep the same face and body type as the source until fabric covers them.',
    )
  } else if (staysNude) {
    parts.push(
      'CRITICAL: the subject should be fully nude / bare-skinned for the entire clip.',
      'If the source still shows panties, thong, briefs, underwear, OR a foggy/milky blur patch over the crotch, REMOVE that cover in the first frames — then keep sharp bare crotch for the rest of the clip.',
      'She STAYS fully nude — do NOT add, invent, fade in, or generate ANY clothing, underwear, bra, panties, lingerie, robe, dress, or censor fog.',
      'No garments and no cloudy obstacles ever appear during the motion. Sharp bare skin remains visible in every single frame.',
      'Keep the same breasts and hips as the source — no censor blur, no invented lingerie patch, no steam smudge.',
      'Visible nipples; mandatory natural adult pubic hair (curly strands on mons) — uncensor, no mosaic, no frosted haze, no hairless doll crotch unless user asked to shave.',
      'FORBIDDEN: keeping source panties on; foggy panty-shaped blur; anyone putting bra or panties on her; clothes reappearing mid-clip.',
    )
  }
  // 솔로 나체: 파트너 요청이 없을 때만 2인물 금지.
  // 빨기·올라타기·눕히기는 파트너가 필요해서 CAST LOCK이 동작을 죽이던 실측 → 그때는 허용.
  if ((undressAction || staysNude) && !coupleRequested) {
    parts.push(
      'CAST LOCK: only the single person from the input photo. FORBIDDEN inventing a second person, man partner, or stranger who dresses her.',
    )
  } else if (intimate.wantsPartner) {
    parts.push(
      'CAST: a second consenting adult may appear only to perform the requested intimate action.',
      'IDENTITY LOCK: the woman from the source photo keeps the SAME face, same haircut, same body type and proportions — do NOT morph her into a more muscular, taller, or different-looking woman.',
      'FACE WHILE NUDE/KISS: while undressing and kissing, facial identity stays the same; only a light smile, light blushing shyness, or soft pleasure — never a distorted kissing grimace that changes who she is. Deep kiss = strong lips/mouth/cheek movement on that same face.',
      'BODY WHILE PARTNER/KISS: her breast size and breast position on the torso stay identical to the source image — the partner must not cause a different bust size or relocated bust.',
      buildKoreanMaleBodyHairLock(),
      'If the partner is a man from the source: keep HIS face — Korean adult man, smooth nearly hairless chest/abdomen when shirtless/nude.',
    )
  }
  if ((undressAction || staysNude) && intimate.wantsPartner) {
    parts.push(
      'NUDE COUPLE LOCK: while kissing or intimate, the woman stays fully nude — bare crotch, no panties/thong/underwear for a “tasteful fashion” look.',
      'FORBIDDEN: keeping panties on during a nude kiss; sheer lingerie remnant; fashion-magazine underwear holdout.',
      'BREAST LOCK DURING KISS: match source breast size AND placement height exactly — not bigger, not smaller, not higher, not lower than the source still.',
      buildKoreanMaleBodyHairLock(),
      'Any nude/shirtless man: smooth Korean male torso — FORBIDDEN dense chest hair or thick belly trail.',
    )
  }
  if (/패션|매거진|magazine|editorial|haute\s*couture|하이엔드/i.test(structureCorpus) && (undressAction || staysNude)) {
    parts.push(
      'Even if the brief says fashion-magazine style, when nude/undress is requested the end state is FULL nude — magazine lighting/mood only, NOT lingerie left on.',
    )
  }
  parts.push('Follow the source image identity, including adult content when requested — do not sanitize.')
  // 맨 앞의 CRITICAL MOTION 하나만으로는, 그 뒤에 붙는 연속성/누드 관련 문단들이 길어질수록
  // (특히 여러 차례 수정을 거친 이미지) 모션 순응도가 흐려지는 경우가 실측으로 확인됐다.
  // 문장 끝에서 한 번 더 짧게 재강조해서 최근 지시 우선(recency) 효과도 함께 노린다.
  if (motion) {
    parts.push(`Reminder — the required motion for this clip is: ${motion}.`)
    if (intimate.addon) {
      parts.push(`ACTION REMINDER: ${intimate.addon}.`)
    }
  }
  parts.push(
    'FINAL POSE LOCK: the last frame keeps the intimate action pose (kiss lean-in, hands where requested) — FORBIDDEN resetting to the opening source still pose.',
  )
  if (undressAction || staysNude) {
    parts.push(
      'FINAL LOCK: last frame fully nude — bare breasts and uncensored bare hips/crotch with natural adult pubic hair visible, ZERO bra, ZERO panties, ZERO foggy blur over genitals. Same face identity, same breast size/placement as source silhouette.',
      'FINAL FACE: soft natural mouth, slight teeth OK if parted.',
      buildNudeCensorFogBanLock(),
    )
  }
  return parts.join(' ')
}
