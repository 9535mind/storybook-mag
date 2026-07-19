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
      /어린이|아이(?!콘)|초등학생|중학생|고등학생|미성년|아동(?!극)|십대|청소년|loli|shota|\bchild\b|\bminor\b|\bteen(?:ager)?\b|\bkid\b|\bschoolgirl\b|로리콘|쇼타|로리\b/i,
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

/**
 * SDXL 계열 negative prompt.
 * 얼굴 클로즈업 / 캐주얼 티 / 비즈니스 정장으로 의상이 바뀌는 실패를 강하게 억제한다.
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
].join(', ')

/** 화보 네거티브 — 속옷·거울 등 요청 시 가운/셔츠 이탈 억제 */
export function buildFashionNegativePrompt(description: string): string {
  const extras: string[] = []
  if (/속옷|underwear|란제리|lingerie|브래지|팬티|panties/i.test(description)) {
    extras.push(
      'bathrobe, bath robe, kimono robe, wrap robe, dressing gown, overcoat, trench coat',
      'white dress shirt, collared blouse, button-up shirt, sweater, cardigan, grey robe',
    )
  }
  if (/거울|mirror/i.test(description)) {
    extras.push('no mirror, missing mirror, plain seamless studio mugshot without mirror')
  }
  return extras.length ? `${DEFAULT_NEGATIVE_PROMPT}, ${extras.join(', ')}` : DEFAULT_NEGATIVE_PROMPT
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
  return t.replace(/\s+/g, ' ').trim()
}

/** 화보 모드: 전신·의상처럼 img2img로 얼굴이 깨지기 쉬운 큰 수정 */
export function isStructuralRefineRevision(revision: string): boolean {
  const r = polishKoreanPromptText(revision)
  return /전신|풀\s*바디|풀바디|full\s*body|머리부터|발끝까지|속옷|란제리|underwear|lingerie|브래지|팬티|거울|차림으로|누드|나체|nude|다시\s*그려|재생성/i.test(
    r,
  )
}

/** 자유 모드: 동물·소품·구도 추가 등 장면 구성 변경 → 반드시 장면 재생성 */
export function isFreeSceneRevision(revision: string, baseDescription = ''): boolean {
  const r = polishKoreanPromptText(`${baseDescription}\n${revision}`)
  if (!revision.trim()) return false
  // 동물·다중 주체·위치 관계·장면 동사
  if (
    /토끼|개구리|여우|사자|호랑이|고양이|강아지|원숭|당나귀|곰|늑대|새\b|말\b|동물|frog|rabbit|fox|lion|tiger|cat|dog|monkey|bear|bird|horse|animal/i.test(
      r,
    )
  ) {
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
  if (!b) return r
  if (!r) return b
  return [
    b,
    `수정 반영(원 장면을 유지한 채 반드시 적용): ${r}`,
    'Keep every original subject and setting; apply the revision exactly without replacing animals with a human model.',
  ].join(' ')
}

function resolveFramingHint(size: string | undefined): string {
  if (size === 'landscape') {
    return 'wide fashion editorial frame, full outfit visible from head to mid-thigh or full body, environment readable in background'
  }
  if (size === 'square') {
    return 'medium-full fashion shot, waist-up or three-quarter body so dress and pose are clearly visible, not a face-only crop'
  }
  if (size === 'story') {
    return [
      '9:16 vertical Shorts frame',
      'full body preferred, head to toe in frame, feet visible when possible',
      'entire outfit readable, no face-only crop',
    ].join(', ')
  }
  return [
    '2:3 vertical fashion editorial',
    'FULL BODY shot, head to toe, feet fully visible in frame',
    'standing full figure, entire outfit from neckline to hem visible',
    'do not crop head, feet, or dress hem',
    'confident full-body pose',
  ].join(', ')
}

/** 한국어 의상/장소 키워드를 영어 강제 지시로 보강 (모델이 정장·스튜디오로 이탈하는 경우 억제). */
function amplifyClothingAndScene(description: string): string {
  const extras: string[] = []
  if (/실크|슬립|드레스|slip|silk|dress/i.test(description)) {
    extras.push(
      'wearing a short silk slip dress (thin silky lingerie-style slip dress), glossy silk fabric clearly visible, NOT a business suit, NOT a blazer',
    )
  }
  if (/란제리|레이스\s*브래지|lingerie|lace\s*bra|thong|탠가/i.test(description)) {
    extras.push(
      'wearing a delicate sand/beige lace lingerie set (wired lace bra and matching lace panties), sheer lace texture clearly visible, NOT a dress, NOT a blazer, NOT a sweater, NOT office wear',
    )
  }
  // 속옷차림 — 가운/랩로브/셔츠로 치환되는 실패가 많음
  if (/속옷|underwear|팬티|브라(?!운)|브래지/i.test(description)) {
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
  if (/흰\s*배경|흰색\s*배경|white\s*background|클린\s*화이트/i.test(description)) {
    extras.push('clean pure white seamless studio background, NOT grey wall, NOT dark backdrop')
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
  if (/밝|투명|clear|bright/i.test(description)) {
    extras.push('bright clear luminous face, natural makeup')
  }
  return extras.length ? ` Hard constraints: ${extras.join(' ')}.` : ''
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
  if (/누드|나체|nude|naked/i.test(description)) {
    if (/(뒷모습|후면|등\s*뒤|back\s*view|rear)/i.test(description)) {
      extras.push('adult nude from the BACK, rear three-quarter view, bare skin as requested')
    } else if (/(옆|비스듬|측면|side\s*view|profile)/i.test(description)) {
      extras.push('adult nude in SIDE / three-quarter view standing at an angle, bare skin as requested')
    } else {
      extras.push('adult nude as requested, bare skin, follow the brief exactly')
    }
  }
  if (/란제리|lingerie|야한|에로|섹시|nsfw|porn|explicit/i.test(description)) {
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

/** 화보풍 프롬프트 — 표현력을 죽이는 순화는 하지 않는다. */
export function buildFashionMagazinePrompt(input: {
  description: string
  mood: string
  size?: string
  revision?: string
}): string {
  const moodPhrase =
    {
      editorial: 'high-end fashion editorial photography for a premium magazine spread',
      glamour: 'glamorous fashion photography, confident premium adult presence',
      chic: 'chic modern urban fashion photography, city atmosphere, sleek styling',
      romantic: 'romantic soft-lit fashion photography, elegant atmosphere',
    }[input.mood] ?? 'high-end fashion editorial photography'

  const description = polishKoreanPromptText(input.description)
  const framing = resolveFramingHint(input.size)
  const amplify = amplifyClothingAndScene(description)
  const revision = polishKoreanPromptText(input.revision ?? '')

  const parts = [
    `USER BRIEF (highest priority, obey every clause): ${description}.${amplify}`,
    'Photorealistic adult fashion magazine editorial. Prompt adherence is mandatory.',
    'Show the requested clothing, pose, viewpoint, body details, and setting exactly — face beauty is secondary to brief accuracy.',
    'Do NOT replace the outfit with a grey dress, blazer, bathrobe, robe, white shirt, or unrelated clothes. Do NOT invent a different look.',
    `${moodPhrase}. ${framing}.`,
    'Outfit fabric and silhouette must be unmistakable in frame. If underwear, lingerie, a dress, or a specific garment is requested, that exact garment must be visible.',
    'If a mirror is requested, include a mirror in the scene. If urban or city vibe is requested, include modern city or street context, not a plain grey studio backdrop.',
    'Natural skin texture, sharp focus, professional fashion lighting, 8k quality.',
    'Adult content allowed when requested — do not sanitize lingerie, underwear, glamour, or nude briefs.',
  ]
  if (revision) {
    parts.push(`Revision request (must apply on the same subject): ${revision}`)
  }
  return parts.join(' ')
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
  const free = input.genMode === 'free'
  const revisionAmplify = free ? '' : amplifyClothingAndScene(`${base} ${revision}`)

  if (free) {
    if (input.mode === 'region') {
      return [
        'Local edit of an existing illustration/photo. ONLY change the masked white areas.',
        `Local change: ${revision}.`,
        'Do NOT replace animals with a human fashion model. Preserve species, pose, and unmasked scene.',
        base ? `Scene context: ${base}.` : '',
        'Photorealistic seamless inpaint, same lighting.',
      ]
        .filter(Boolean)
        .join(' ')
    }
    return [
      'Edit the SAME scene. Keep original subjects (animals/objects) and setting.',
      `Apply exactly: ${revision}.`,
      'CRITICAL: Do NOT invent a human woman, fashion model, bathrobe, or studio portrait.',
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
  return [
    'Image-to-image edit of the SAME photograph. IDENTITY LOCK: keep the exact same adult woman face, same eyes, same nose, same lips, same hair, same skin tone.',
    `ONLY apply this change: ${revision}.${revisionAmplify}`,
    'Do not replace the subject with a different person. Do not age-shift or beauty-filter into a new face.',
    'If the revision only changes color or a garment detail, keep framing and pose identical.',
    'Do not change background unless the revision asks for background.',
    'Do NOT invent a bathrobe, kimono wrap, white dress shirt, or coat unless the revision asks for that garment.',
    'If lingerie or underwear is requested, show lingerie/underwear — never a robe.',
    base ? `Original brief for continuity (must still hold): ${base}.` : '',
    'Photorealistic, same lighting.',
  ]
    .filter(Boolean)
    .join(' ')
}

/** 정지 이미지를 짧은 영상으로 바꿀 때 쓰는 I2V 모션 프롬프트. */
export function buildAnimationPrompt(input: { prompt?: string; motion?: string }): string {
  const original = (input.prompt ?? '').trim()
  const motion = (input.motion ?? '').trim()
  const parts = [
    'Premium photorealistic adult short-form video.',
    'Cinematic lighting, natural movement, subtle camera motion.',
  ]
  if (original) {
    parts.push(`Subject continuity from source image: ${original}`)
  }
  if (motion) {
    parts.push(`Motion direction: ${motion}`)
  } else {
    parts.push('Natural movement, soft hair and fabric motion, confident pose.')
  }
  parts.push('Follow the source image mood exactly, including adult content when present.')
  return parts.join(' ')
}
