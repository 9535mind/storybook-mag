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

export function evaluateContentPolicy(
  promptText: string,
  _options?: { mode?: string },
): ContentPolicyVerdict {
  const text = promptText ?? ''

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

// 한국어는 명사와 동사 사이에 조사(을/를/이/가/은/는/도)가 붙는 게 훨씬 자연스러운 말투다
// ("속옷을 제거해줘", "옷을 벗겨줘") — 기존엔 \s*(공백만 허용)라 조사가 끼면 매칭에서
// 빠져서, 정밀모드 전환·negative prompt 조정이 통째로 안 걸리는 버그가 있었다. 조사를
// 선택적으로 허용하는 조각을 명사+동사 패턴 사이에 넣어 고친다.
const KO_PARTICLE_GAP = '(?:을|를|이|가|은|는|도)?\\s*'

/** 누드·탈의·속옷제거 의도 (성인 허용 — 순화하지 않음) */
export function wantsNudeOrUndress(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  const pattern = new RegExp(
    [
      '누드', '나체', 'nude', 'naked',
      `속옷${KO_PARTICLE_GAP}제거`, '속옷제거', `속옷${KO_PARTICLE_GAP}벗`,
      '탈의', `옷${KO_PARTICLE_GAP}벗`, `가운${KO_PARTICLE_GAP}벗`, `로브${KO_PARTICLE_GAP}벗`,
      `언더웨어${KO_PARTICLE_GAP}제거`,
      'undress', 'disrobe', 'strip(?:ping|ped)?',
      'remove\\s*(?:her\\s*)?(?:clothes|clothing|underwear|lingerie)',
      'fully\\s*nude', 'bare\\s*(?:skin|body)', '완전\\s*노출', '전라',
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
      // "벗겨"(사동형: 벗겨줘/벗겨주세요/벗겨봐)는 벗다의 흔한 캐주얼 요청 표현인데,
      // 기존 목록(벗는/벗어/벗기/벗김/벗을/벗었)엔 없어서 빠지고 있었다.
      '탈의', '벗는', '벗어', '벗기', '벗겨', '벗김', '벗을', '벗었',
      `속옷${KO_PARTICLE_GAP}제거`, '속옷제거', `언더웨어${KO_PARTICLE_GAP}제거`,
      `가운${KO_PARTICLE_GAP}벗`, `로브${KO_PARTICLE_GAP}벗`, `옷${KO_PARTICLE_GAP}벗`,
      'undress', 'disrobe', 'strip(?:ping|ped)?', 'take\\s*off',
      'removes?\\s*(?:her\\s*)?(?:clothes|clothing|underwear|lingerie|robe|dress)',
    ].join('|'),
    'i',
  )
  return pattern.test(t)
}

/**
 * SDXL 계열 negative prompt.
 * 얼굴 클로즈업 / 캐주얼 티 / 비즈니스 정장으로 의상이 바뀌는 실패를 강하게 억제한다.
 * (누드 요청 시에는 buildFashionNegativePrompt가 outfit 강제 항목을 제거한다.)
 */
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

/** 화보 네거티브 — 속옷·누드·거울 요청에 맞춰 이탈 억제 */
export function buildFashionNegativePrompt(description: string): string {
  const extras: string[] = []
  let base = DEFAULT_NEGATIVE_PROMPT

  if (wantsNudeOrUndress(description)) {
    // "missing outfit"은 누드(=의상 없음)와 정면 충돌 → 제거
    base = base.replace(OUTFIT_FORCE_NEGATIVE, '')
    extras.push(
      'clothes, clothing, dressed, wearing clothes, fully clothed',
      'bathrobe, bath robe, kimono robe, wrap robe, dressing gown, coat, shirt, dress',
      'lingerie, underwear, bra, panties, covering the body with fabric',
    )
  } else if (wantsUnderwearLook(description)) {
    extras.push(
      'bathrobe, bath robe, kimono robe, wrap robe, dressing gown, overcoat, trench coat',
      'white dress shirt, collared blouse, button-up shirt, sweater, cardigan, grey robe',
    )
  }
  if (/거울|mirror/i.test(description)) {
    extras.push('no mirror, missing mirror, plain seamless studio mugshot without mirror')
  }
  // 흰 배경을 요청했는데도 회색/베이지로 새는 사례가 실측으로 반복 확인됨 — 색상 이탈을 직접 억제.
  if (/흰\s*배경|흰색\s*배경|백색\s*배경|white\s*background|클린\s*화이트/i.test(description)) {
    extras.push('grey background, gray background, beige background, tan background, brown background, dark background, colored background, off-white background, cream background')
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

/** 화보 모드: 전신·의상처럼 img2img로 얼굴이 깨지기 쉬운 큰 수정 */
export function isStructuralRefineRevision(revision: string): boolean {
  const r = polishKoreanPromptText(revision)
  return /전신|풀\s*바디|풀바디|full\s*body|머리부터|발끝까지|속옷|란제리|underwear|lingerie|브래지|팬티|거울|차림으로|누드|나체|nude|다시\s*그려|재생성/i.test(
    r,
  )
}

/** "귀걸이 추가해줘"/"나비 넣어줘"처럼 원본에 없던 새 물체·요소를 더하는 수정인지 판별한다.
 * img2img는 strength(디노이징 강도)가 낮을수록 원본 구조를 강하게 보존하는데, 그 특성 때문에
 * "존재하지 않던 새 물체를 그려 넣어라" 같은 요청은 색상/질감 변경보다 훨씬 더 많은 자유도가
 * 필요하다 — 낮은 strength로는 모델이 새 물체를 안정적으로 합성하지 못하고 무시하거나(수정이
 * "안 먹힘") 반대로 전체 구도가 무너지는 실측 사례가 확인됐다. 그래서 이런 요청만 따로 감지해
 * strength를 한 단계 올려서(구조 변경 없이) 새 요소가 실제로 그려질 여지를 준다. */
export function isAdditiveRefineRevision(revision: string): boolean {
  const r = polishKoreanPromptText(revision)
  return /추가|넣어|넣기|넣다|덧붙|그려\s*넣|올려\s*줘|씌워|더해|add\b|insert\b|put\b.*\bin\b/i.test(r)
}

const ANIMAL_SUBJECT_PATTERN =
  /토끼|개구리|여우|사자|호랑이|고양이|강아지|원숭|당나귀|곰|늑대|동물|frog|rabbit|fox|lion|tiger|cat|dog|monkey|bear|bird|horse|animal/i

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

/** 한국어 의상/장소 키워드를 영어 강제 지시로 보강 (모델이 정장·스튜디오로 이탈하는 경우 억제). */
function amplifyClothingAndScene(description: string): string {
  const extras: string[] = []
  const nude = wantsNudeOrUndress(description)

  // 누드/탈의는 의상 강제보다 우선 — "속옷제거"가 속옷 착용으로 오인되지 않게
  if (nude) {
    extras.push(
      'adult nude, bare skin, no clothing, no lingerie, no underwear, no bra, no panties, no bathrobe, no robe',
      'garments removed / undressed as requested — do NOT keep fabric covering the body',
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
    const wantsDressGarment = /드레스|dress/i.test(description)
    if (wantsSilkOrSlip) {
      extras.push('wearing a silk slip dress, glossy silk fabric clearly visible, NOT a business suit, NOT a blazer')
    } else if (wantsDressGarment) {
      extras.push('wearing a dress, NOT a business suit, NOT a blazer')
    }
  }
  if (!nude && /란제리|레이스\s*브래지|lingerie|lace\s*bra|thong|탠가/i.test(description)) {
    extras.push(
      'wearing a delicate sand/beige lace lingerie set (wired lace bra and matching lace panties), sheer lace texture clearly visible, NOT a dress, NOT a blazer, NOT a sweater, NOT office wear',
    )
  }
  // 속옷차림 — 가운/랩로브/셔츠로 치환되는 실패가 많음 (제거·누드 요청 제외)
  if (wantsUnderwearLook(description)) {
    extras.push(
      'wearing only underwear / undergarments (bra and panties or equivalent lingerie), skin and undergarments clearly visible, NOT a bathrobe, NOT a kimono wrap robe, NOT a coat, NOT a white collared shirt',
    )
  }
  if (/거울|mirror/i.test(description)) {
    extras.push(
      'posed in front of a mirror, mirror or vanity glass readable in the scene, NOT a plain empty studio without a mirror',
    )
  }
  if (/비스듬|oblique|diagonal/i.test(description)) {
    extras.push('standing at an oblique / three-quarter angle')
  }
  if (/몸매|감상|admiring/i.test(description)) {
    extras.push('admiring her own figure, looking toward her body or mirror reflection')
  }
  if (/흰\s*배경|흰색\s*배경|백색\s*배경|white\s*background|클린\s*화이트/i.test(description)) {
    extras.push(
      'pure bright white seamless studio background, evenly lit white backdrop, NOT grey, NOT beige, NOT tan, NOT off-white, NOT dark backdrop',
    )
  }
  if (/귀[^.]{0,30}(가려|보이지\s*않|안\s*보임|관찰되지\s*않|없다|없음)/.test(description)) {
    extras.push('asymmetric single earring, exactly one ear shows an earring, the other ear bare or hidden by hair, earrings NOT matching on both sides')
  }
  if (/시스루\s*뱅|앞머리|see-?through\s*bang/i.test(description)) {
    extras.push('delicate see-through bangs (sheer wispy bangs) across the forehead')
  }
  if (/도시|시티|어반|거리|야경|urban|city|street/i.test(description)) {
    extras.push(
      'modern urban city background with buildings or street lights, NOT a plain solid grey studio wall',
    )
  }
  if (/자신감|포즈|confident|pose/i.test(description)) {
    extras.push('confident fashion pose, body language readable in frame')
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
  if (wantsNudeOrUndress(description)) {
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
  if (hasMale && !hasFemale) return 'Korean man, attractive face'
  if (hasMale && hasFemale) return 'Korean man and Korean woman, attractive faces'
  // 명시가 없으면 화보 기본 대상(여성)으로 간주
  return 'Korean woman, attractive face'
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
    return 'Default ethnicity (user did not specify): the man is Korean, with a handsome, attractive Korean face.'
  }
  if (hasMale && hasFemale) {
    return 'Default ethnicity (user did not specify): both the man and the woman are Korean, with attractive Korean faces.'
  }
  return 'Default ethnicity (user did not specify): the woman is Korean, with a pretty, attractive Korean face.'
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
  const nude = wantsNudeOrUndress(ethnicitySource)
  const ethnicityTag = defaultEthnicityTag(ethnicitySource)
  const nudeFlag = nude ? 'adult nude, bare skin' : ''
  const moodTag = resolveMoodTag(input.mood)
  const framing = resolveFramingHint(input.size)
  const qualitySuffix = 'photorealistic, natural skin, sharp focus, 8k'
  const rawAmplify = amplifyClothingAndScene(ethnicitySource).replace(/^,\s*/, '')

  const fixedWords =
    countWords(ethnicityTag) + countWords(nudeFlag) + countWords(moodTag) + countWords(framing) + countWords(qualitySuffix)
  const amplifyBudget = Math.max(0, SDXL_WORKING_BUDGET_WORDS - fixedWords - SDXL_MIN_DESCRIPTION_WORDS)
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
  return Math.max(SDXL_MIN_DESCRIPTION_WORDS, Math.min(SDXL_MAX_DESCRIPTION_WORDS, available))
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
  return extras.length ? `${FREE_NEGATIVE_PROMPT}, ${extras.join(', ')}` : FREE_NEGATIVE_PROMPT
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
  const revisionAmplify = free ? '' : amplifyClothingAndScene(`${base} ${revision}`)
  const freeEthnicity =
    free && mentionsHumanSubject(`${base} ${revision}`) ? defaultEthnicitySentence(`${base} ${revision}`) : ''

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
      wantsNudeOrUndress(revision)
        ? 'Adult nude/undress as requested: bare skin, remove garments — do not keep underwear or robes.'
        : 'CRITICAL: Do NOT invent a human woman, fashion model, bathrobe, or studio portrait.',
      freeEthnicity,
      base ? `Original scene (must still hold): ${base}.` : '',
      'Photorealistic illustration fidelity to the brief.',
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (input.mode === 'region') {
    return [
      'Local edit of an existing photo. ONLY change the masked white areas.',
      `Local change: ${revision}.${revisionAmplify}`,
      'Follow the revision exactly, including adult / nude / erotic changes when requested.',
      'Do NOT invent a new person, new face, new body, or new scene outside the mask.',
      'Preserve exact face identity, skin tone, hair, eye shape, and unmasked pixels — same woman.',
      base ? `Context: ${base}.` : '',
      'Photorealistic seamless inpaint, same lighting and color grade.',
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
  const revisionTargetsSkinTone = /피부\s*(색|톤)|태닝|skin\s*tone|\btan\b/i.test(revision)
  const identityLockAttributes = [
    !revisionTargetsEyes && 'same eyes',
    'same nose',
    !revisionTargetsLips && 'same lips',
    !revisionTargetsHair && 'same hair',
    !revisionTargetsSkinTone && 'same skin tone',
  ].filter((v): v is string => Boolean(v))

  return [
    `Image-to-image edit of the SAME photograph. IDENTITY LOCK: keep the exact same adult woman face, ${identityLockAttributes.join(', ')}.`,
    `ONLY apply this change: ${revision}.${revisionAmplify}`,
    'Do not replace the subject with a different person. Do not age-shift or beauty-filter into a new face.',
    'If the revision only changes color or a garment detail, keep framing and pose identical.',
    'Do not change background unless the revision asks for background.',
    'Do NOT invent a bathrobe, kimono wrap, white dress shirt, or coat unless the revision asks for that garment.',
    wantsNudeOrUndress(revision)
      ? 'If nude / undress / underwear removal is requested, show bare adult skin — remove garments; do NOT keep lingerie, bra, panties, or a robe.'
      : 'If lingerie or underwear is requested, show lingerie/underwear — never a robe.',
    base ? `Original brief for continuity (must still hold): ${base}.` : '',
    'Photorealistic, same lighting.',
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

/** 정지 이미지를 짧은 영상으로 바꿀 때 쓰는 I2V 모션 프롬프트. */
export function buildAnimationPrompt(input: { prompt?: string; motion?: string }): string {
  const fullOriginal = polishKoreanPromptText(input.prompt ?? '')
  // 참고문은 짧게 줄여서 모션 힌트와의 경쟁을 줄이지만, 누드/탈의 판별(sourceIsNude)은
  // 원문 전체로 해야 한다 — 여러 번 수정을 거치며 누적된 텍스트는 "누드로 바꿔줘" 같은
  // 문구가 뒤쪽(잘려 나가는 부분)에 있을 수 있어서, 잘린 텍스트만 보면 이미 누드인 원본을
  // "옷을 입은 상태"로 잘못 판정해 되레 옷을 입혀버리는 사고가 날 수 있다.
  const original = truncateContinuityText(fullOriginal, ANIMATION_CONTINUITY_MAX_CHARS)
  const motion = polishKoreanPromptText(input.motion ?? '')
  // 소스 이미지 자체가 이미 누드/전라인지(상태)와, 이번 모션이 "옷을 벗는 전환 동작"을
  // 실제로 요청했는지(동작)를 분리해서 판단한다. 이 둘을 하나로 합쳐서 판단하면,
  // 이미 누드인 이미지에 단순 포즈/움직임만 요청해도 "옷이 벗겨지는 동작" 문구가 붙어서
  // 영상이 "옷을 입은 상태에서 시작 → 벗는" 서사를 만들어내고, 그 결과 원본엔 없던
  // 옷/속옷/드레스가 프레임에 나타나는 부작용이 있었다.
  const sourceIsNude = wantsNudeOrUndress(fullOriginal)
  // wantsUndressAction은 "벗다/제거/undress/strip" 같은 동작 동사만 잡는다. 그런데 "누드인
  // 상태로 만들어라/누드로 바꿔줘"처럼 동작 동사 없이 '상태'만 요청하는 경우가 실측으로 흔했고,
  // 이때 undressAction이 false로 판정되어 "탈의 동작" 지시가 전혀 안 붙어서 옷이 그대로
  // 남는 사고가 있었다. 소스가 아직 옷을 입은 상태인데 모션이 누드 관련 단어를 언급하면,
  // 그 자체로 "지금 상태(옷 입음) → 누드로 전환"을 뜻하므로 동작으로 취급한다.
  const undressAction = wantsUndressAction(motion) || (wantsNudeOrUndress(motion) && !sourceIsNude)
  const staysNude = sourceIsNude && !undressAction

  // 모션 지시는 맨 앞에 CRITICAL로 강조한다. 예전엔 긴 "원본 연속성" 문단(원본 이미지
  // 프롬프트 전체) 뒤에 짧게 붙어 있어서, Wan I2V가 앞부분의 장문 설명에 가중치를 두고
  // 사용자가 요청한 모션(예: 특정 동작·전환)을 잘 따라가지 않는 문제가 있었다.
  const parts = ['Premium photorealistic adult short-form video.']
  if (motion) {
    parts.push(
      `CRITICAL MOTION — this is the main point of the clip, follow it exactly: ${motion}.`,
    )
  } else {
    parts.push('Natural movement, soft hair and fabric motion, confident pose.')
  }
  parts.push('Cinematic lighting, subtle camera motion.')
  if (original) {
    parts.push(
      `Subject/appearance continuity from source image (identity/outfit reference only — the motion instruction above always takes priority): ${original}`,
    )
  }
  if (undressAction) {
    parts.push(
      'CRITICAL ADULT MOTION: garments / underwear / robe are removed during the clip; end state is adult nude with bare skin visible.',
      'Do NOT freeze the subject fully clothed. Do NOT keep bra, panties, lingerie, or bathrobe at the end.',
      'Smooth undressing action, fabric sliding off, skin revealed as requested.',
    )
  } else if (staysNude) {
    parts.push(
      'CRITICAL: the subject is ALREADY fully nude / bare-skinned in the source image, starting from frame one.',
      'She STAYS fully nude for the entire clip — do NOT add, invent, fade in, or generate ANY clothing, underwear, bra, panties, lingerie, robe, or dress at any point in the video.',
      'No garments ever appear during the motion. Bare skin remains visible in every single frame, from start to finish.',
    )
  }
  parts.push('Follow the source image identity, including adult content when requested — do not sanitize.')
  // 맨 앞의 CRITICAL MOTION 하나만으로는, 그 뒤에 붙는 연속성/누드 관련 문단들이 길어질수록
  // (특히 여러 차례 수정을 거친 이미지) 모션 순응도가 흐려지는 경우가 실측으로 확인됐다.
  // 문장 끝에서 한 번 더 짧게 재강조해서 최근 지시 우선(recency) 효과도 함께 노린다.
  if (motion) {
    parts.push(`Reminder — the required motion for this clip is: ${motion}.`)
  }
  return parts.join(' ')
}
