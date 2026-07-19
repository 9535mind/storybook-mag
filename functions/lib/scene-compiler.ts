/**
 * 형태 무관(form-agnostic) 언어 반응형 장면 컴파일러.
 *
 * 목표: 완전문 / 명사구 / 관형절 / 단어 나열 어떤 입력이든
 * 「머리명사(주인공) · 상태 · 관계 · 행동 · 상대」 슬롯으로 읽어 이미지 브리프를 만든다.
 *
 * 예:
 *  - 배고픈 당나귀
 *  - 원숭이에게 쫓기는 배고픈 호랑이
 *  - 여우가 고양이를 품에 안고 돌보는 모습
 */

export type SceneEntity = {
  nameEn: string
  kind: 'animal' | 'human' | 'object' | 'other'
  /** head=주인공, other=장면 속 다른 존재 */
  focus: 'head' | 'other'
  /** 문법 힌트(있을 때만) */
  grammar?: 'agent' | 'patient' | 'dative' | 'companion' | 'unspecified'
}

export type ScenePlan = {
  raw: string
  /** 주인공(명사구의 핵 / 문장의 주제) */
  head: SceneEntity | null
  entities: SceneEntity[]
  /** 배고픈, 큰, 슬픈 … */
  states: string[]
  /** chasing, holding, nursing … */
  actions: string[]
  /** soccer ball … */
  props: string[]
  /** 한쪽 눈 없음 등 외형 꾸밈 */
  traits: string[]
  /** 자연어 관계 잠금 문장들 */
  relations: string[]
  setting: string | null
  viewpoint: string | null
  countHint: number | null
  adult: boolean
  /** 사용자가 반인반수·인화·furry 등을 명시한 경우에만 true */
  anthro: boolean
  needsWideScene: boolean
  multiSpecies: boolean
  inputForm: 'phrase' | 'clause' | 'sentence' | 'keywords'
  source: 'ai' | 'heuristic'
}

type AiBinding = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>
}

// ─── Lexicons ───────────────────────────────────────────────

const ENTITY_LEX: Array<{ re: RegExp; en: string; kind: SceneEntity['kind'] }> = [
  { re: /원숭이|monkey|macaque/i, en: 'monkey', kind: 'animal' },
  { re: /침팬지|chimpanzee/i, en: 'chimpanzee', kind: 'animal' },
  { re: /고릴라|gorilla/i, en: 'gorilla', kind: 'animal' },
  { re: /사자|lion/i, en: 'lion', kind: 'animal' },
  { re: /호랑이|tiger/i, en: 'tiger', kind: 'animal' },
  { re: /고양이|cat\b/i, en: 'cat', kind: 'animal' },
  { re: /당나귀|donkey|ass\b/i, en: 'donkey', kind: 'animal' },
  { re: /강아지|개\b|dog\b|puppy/i, en: 'dog', kind: 'animal' },
  { re: /여우|fox/i, en: 'fox', kind: 'animal' },
  { re: /곰\b|bear\b/i, en: 'bear', kind: 'animal' },
  { re: /토끼|rabbit|bunny/i, en: 'rabbit', kind: 'animal' },
  { re: /말\b|horse\b/i, en: 'horse', kind: 'animal' },
  { re: /코끼리|elephant/i, en: 'elephant', kind: 'animal' },
  { re: /펭귄|penguin/i, en: 'penguin', kind: 'animal' },
  { re: /늑대|wolf/i, en: 'wolf', kind: 'animal' },
  { re: /사슴|deer\b/i, en: 'deer', kind: 'animal' },
  { re: /돼지|pig\b/i, en: 'pig', kind: 'animal' },
  { re: /소\b|cow\b|bull\b/i, en: 'cow', kind: 'animal' },
  { re: /쥐|mouse|rat\b/i, en: 'mouse', kind: 'animal' },
  { re: /새\b|bird\b/i, en: 'bird', kind: 'animal' },
  { re: /물고기|fish\b/i, en: 'fish', kind: 'animal' },
  { re: /용\b|dragon/i, en: 'dragon', kind: 'other' },
  { re: /로봇|robot/i, en: 'robot', kind: 'object' },
  { re: /자동차|차\b|car\b/i, en: 'car', kind: 'object' },
  { re: /여성|여자|woman|female/i, en: 'adult woman', kind: 'human' },
  { re: /남성|남자|man\b|male/i, en: 'adult man', kind: 'human' },
  { re: /모델|model/i, en: 'adult model', kind: 'human' },
]

const STATE_LEX: Array<{ re: RegExp; en: string }> = [
  { re: /배고픈|배고프|배가\s*고프|배가고프|고파서|먹고\s*싶|머고\s*싶|hungry|starving|wanting\s+to\s+eat/i, en: 'hungry / starving' },
  { re: /목마르|thirsty/i, en: 'thirsty' },
  { re: /슬프|울고|sad|crying/i, en: 'sad' },
  { re: /기쁘|행복|happy|joyful/i, en: 'happy' },
  { re: /화난|분노|angry/i, en: 'angry' },
  { re: /무섭|두려|scared|afraid/i, en: 'scared' },
  { re: /피곤|지친|tired|exhausted/i, en: 'tired' },
  { re: /아픈|상처|injured|hurt/i, en: 'injured / hurt' },
  { re: /작|어린\s*느낌|small|tiny/i, en: 'small' },
  { re: /큰|거대한|huge|giant|large/i, en: 'large' },
  { re: /늙은|나이\s*든|old\b/i, en: 'old' },
  { re: /젊|young/i, en: 'young' },
  { re: /젖은|비에\s*젖|wet/i, en: 'wet' },
  { re: /더러운|dirty/i, en: 'dirty' },
  { re: /아름다운|예쁘|beautiful|pretty/i, en: 'beautiful' },
  { re: /강한|힘센|strong/i, en: 'strong' },
  { re: /약한|weak/i, en: 'weak' },
  { re: /잠든|자는|sleeping|asleep/i, en: 'sleeping' },
  { re: /웃는|미소|smiling/i, en: 'smiling' },
]

const ACTION_LEX: Array<{ re: RegExp; en: string; props?: string[]; passive?: boolean }> = [
  { re: /쫓기|쫓기당|chased\s+by|being\s+chased/i, en: 'being chased', passive: true },
  // 능동 '쫓다' — 피동 '쫓기는'과 겹치지 않게 부정 전방탐색
  { re: /추격|(?<!쫓기)쫓(?!기)|chasing(?!\s+away)/i, en: 'chasing' },
  { re: /축구|soccer|football/i, en: 'playing soccer', props: ['soccer ball'] },
  { re: /농구|basketball/i, en: 'playing basketball', props: ['basketball'] },
  { re: /야구|baseball/i, en: 'playing baseball', props: ['baseball'] },
  { re: /싸우|격투|fight|combat/i, en: 'fighting' },
  { re: /달리|뛰는|뛰고|running/i, en: 'running' },
  { re: /젖.{0,8}먹|수유|breastfeed|nurs/i, en: 'nursing / breastfeeding' },
  { re: /돌보|보살피|caring|looking after/i, en: 'caring for' },
  { re: /품\s*에\s*안|안고|품에|holding|cuddling|hugg?ing/i, en: 'holding in arms' },
  { re: /먹이(?!\s*는\s*모습)|feeding/i, en: 'feeding' },
  { re: /물기|물어|biting/i, en: 'biting' },
  { re: /날|비행|flying/i, en: 'flying' },
  { re: /수영|헤엄|swimming/i, en: 'swimming' },
  { re: /춤|danc/i, en: 'dancing' },
  { re: /서성|배회|어슬렁|돌아다니|서성이|pacing|wandering|loitering/i, en: 'pacing / wandering restlessly' },
  { re: /서\s*있|standing/i, en: 'standing' },
  { re: /앉|sitting/i, en: 'sitting' },
  { re: /걷|walking/i, en: 'walking' },
  { re: /도망|flee|escaping/i, en: 'fleeing / escaping' },
  { re: /숨|hiding/i, en: 'hiding' },
  { re: /올려다|쳐다|바라보|looking\s+up|gazing/i, en: 'looking up / gazing' },
  { re: /키스|kiss/i, en: 'kissing' },
  { re: /포옹|embrace/i, en: 'embracing' },
]

const PROP_LEX: Array<{ re: RegExp; en: string }> = [
  { re: /포도|grape/i, en: 'grapes / grape clusters' },
  { re: /축구공|soccer\s*ball/i, en: 'soccer ball' },
  { re: /꽃|flower/i, en: 'flowers' },
  { re: /공\b|ball\b/i, en: 'ball' },
]

/** 관형 꾸밈·외형 (주부 앞 수식어) — CRITICAL로 잠금 */
const TRAIT_LEX: Array<{ re: RegExp; en: string }> = [
  {
    re: /한쪽\s*눈이\s*없|눈\s*한쪽\s*없|외눈|애꾸|one[- ]?eyed|missing\s+(an?\s+)?eye|without\s+(an?\s+)?eye|no\s+one\s+eye/i,
    en: 'missing one eye (visibly one-eyed / empty eye socket or closed scarred eye)',
  },
  { re: /두\s*눈이\s*없|장님|눈먼|blind(?!\s*spot)/i, en: 'blind' },
  { re: /귀가\s*없|earless|missing\s+ears?/i, en: 'missing ear(s)' },
  { re: /꼬리가\s*없|tailless|no\s+tail/i, en: 'missing tail' },
  { re: /절름|절뚝|limp(?:ing)?/i, en: 'limping on one leg' },
  { re: /흉터|scarred|\bscars?\b/i, en: 'visible scars' },
  { re: /흰\s*털|하얀\s*털|white\s+fur/i, en: 'white fur' },
  { re: /검은\s*털|검정\s*털|black\s+fur/i, en: 'black fur' },
  { re: /젖은\s*털|wet\s+fur/i, en: 'wet fur' },
  { re: /새끼|아기\s*동물|baby\s+|cub\b|kit\b/i, en: 'juvenile / young animal' },
]

const SETTING_LEX: Array<{ re: RegExp; en: string }> = [
  { re: /포도\s*나무|포도나무|포도원|grapevine|grape\s*vine|under\s+the\s+grape/i, en: 'under a grapevine with hanging grapes' },
  { re: /나무\s*아래|나무아래|under\s+(a\s+)?tree/i, en: 'under a tree' },
  { re: /우주|galaxy|space/i, en: 'outer space' },
  { re: /지구|earth/i, en: 'planet Earth visible' },
  { re: /숲|jungle|forest/i, en: 'forest' },
  { re: /사막|desert/i, en: 'desert' },
  { re: /바다|ocean|sea/i, en: 'ocean' },
  { re: /산\b|mountain/i, en: 'mountains' },
  { re: /도시|city|urban|street/i, en: 'city' },
  { re: /초원|savannah|grassland/i, en: 'grassland' },
  { re: /들판|field(?!\s*of\s*view)/i, en: 'open field' },
  { re: /빗속|rain/i, en: 'in the rain' },
  { re: /햇살|sunshine|sunlight/i, en: 'in sunlight' },
  { re: /운동장|경기장|필드|stadium|field/i, en: 'sports field' },
  { re: /스튜디오|studio|흰\s*배경/i, en: 'studio' },
]

// ─── Helpers ────────────────────────────────────────────────

type Hit = { en: string; kind: SceneEntity['kind']; index: number; len: number }

function findEntityHits(text: string): Hit[] {
  const hits: Hit[] = []
  const seen = new Set<string>()
  for (const e of ENTITY_LEX) {
    const m = e.re.exec(text)
    if (!m || m.index == null) continue
    if (seen.has(e.en)) continue
    seen.add(e.en)
    hits.push({ en: e.en, kind: e.kind, index: m.index, len: m[0].length })
  }
  return hits.sort((a, b) => a.index - b.index)
}

function particleAfter(text: string, index: number, len: number): string {
  return text.slice(index + len, index + len + 3)
}

function grammarFromParticle(after: string): SceneEntity['grammar'] {
  if (after.startsWith('가') || (after.startsWith('이') && !after.startsWith('에게'))) return 'agent'
  if (after.startsWith('를') || after.startsWith('을')) return 'patient'
  if (after.startsWith('에게') || after.startsWith('한테')) return 'dative'
  if (after.startsWith('와') || after.startsWith('과')) return 'companion'
  return 'unspecified'
}

function detectInputForm(text: string): ScenePlan['inputForm'] {
  if (/[이가을를와과에게한테]/.test(text) && /(?:다|요|죠|음|모습|장면)\s*$/.test(text)) {
    return 'sentence'
  }
  if (/는|은|에게\s*[가-힣]+는|에게\s*쫓|에게\s*쫓기/.test(text) || /(?:는|은)\s*[가-힣]+$/.test(text) === false) {
    if (/는|은/.test(text) && findEntityHits(text).length >= 1) return 'clause'
  }
  if (/[이가을를와과에게]/.test(text)) return 'sentence'
  if (findEntityHits(text).length >= 1 && text.length <= 40) return 'phrase'
  if (findEntityHits(text).length === 0) return 'keywords'
  return 'phrase'
}

function parseCount(text: string): number | null {
  if (/다섯|5\s*마리|five/i.test(text)) return 5
  if (/네\s*마리|4\s*마리|four/i.test(text)) return 4
  if (/세\s*마리|3\s*마리|three/i.test(text)) return 3
  if (/두\s*마리|둘|2\s*마리|two/i.test(text)) return 2
  if (/한\s*마리|1\s*마리|one\b/i.test(text)) return 1
  return null
}

function extractStates(text: string): string[] {
  return STATE_LEX.filter((s) => s.re.test(text)).map((s) => s.en)
}

function extractActions(text: string): { actions: string[]; props: string[]; hasPassive: boolean } {
  const actions: string[] = []
  const props: string[] = []
  let hasPassive = false
  for (const a of ACTION_LEX) {
    if (!a.re.test(text)) continue
    actions.push(a.en)
    if (a.props) props.push(...a.props)
    if (a.passive) hasPassive = true
  }
  for (const p of PROP_LEX) {
    if (p.re.test(text)) props.push(p.en)
  }
  return { actions: [...new Set(actions)], props: [...new Set(props)], hasPassive }
}

function extractSetting(text: string): string | null {
  for (const s of SETTING_LEX) {
    if (s.re.test(text)) return s.en
  }
  return null
}

function extractTraits(text: string): string[] {
  return TRAIT_LEX.filter((t) => t.re.test(text)).map((t) => t.en)
}

/** 포도+배고픔 등: 소품이 장식이 아니라 이야기 요소가 되도록 */
function enrichSetting(raw: string, setting: string | null, props: string[]): string | null {
  let s = setting
  const hasGrapes = props.some((p) => /grape/i.test(p)) || /포도/.test(raw)
  if (hasGrapes && !(s && /grape/i.test(s))) {
    if (/나무|vine|아래|서성|먹고\s*싶|머고\s*싶/.test(raw)) {
      s = s
        ? `${s}, outdoors by a grapevine with hanging grape clusters`
        : 'outdoors under / beside a grapevine with hanging grape clusters'
    }
  }
  return s
}

function buildStoryLocks(
  raw: string,
  props: string[],
  states: string[],
  traits: string[],
): string[] {
  const locks: string[] = []
  const hungry =
    states.some((s) => /hungry/i.test(s)) || /먹고\s*싶|머고\s*싶|배고|고파/.test(raw)
  if (props.some((p) => /grape/i.test(p)) && hungry) {
    locks.push(
      'STORY: grapes hang on a vine/tree as the food the animal wants — animal paces looking up toward them. FORBIDDEN: grapes as boutonniere, lapel pin, jewelry, clothing decoration, or studio prop on a suit',
    )
  }
  if (traits.some((t) => /one eye|one-eyed|missing one eye/i.test(t))) {
    locks.push(
      'APPEARANCE: the subject must clearly show ONLY ONE functioning eye (or one missing/scarred eye). FORBIDDEN: two normal symmetrical eyes',
    )
  }
  return locks
}

function extractViewpoint(text: string): string | null {
  if (/(뒷모습|후면|back\s*view)/i.test(text)) return 'back view'
  if (/(옆|비스듬|측면|side|profile)/i.test(text)) return 'side / three-quarter view'
  if (/(전신|full\s*body)/i.test(text)) return 'full body'
  return null
}

/** 반인반수·인화는 명시 요청일 때만 허용 */
function detectAnthroRequest(text: string): boolean {
  return /반인반수|반인\s*반수|수인(?:화)?|인화|의인화|인간형\s*동물|동물\s*인간|사람\s*몸|인간\s*몸|두\s*발\s*보행\s*동물|anthro|anthropomorphic|furry|kemono|ケモノ|humanoid\s*animal|animal\s*headed|fox\s*girl|cat\s*girl|wolf\s*girl/i.test(
    text,
  )
}

function hasAnimalCast(plan: Pick<ScenePlan, 'head' | 'entities'>): boolean {
  if (plan.head?.kind === 'animal') return true
  return plan.entities.some((e) => e.kind === 'animal')
}

/**
 * 주인공(head) 결정:
 * 1) 관형절 핵 — "…는/은 X" 또는 문장 끝쪽 동물
 * 2) 주격 조사 있는 존재
 * 3) 텍스트상 가장 오른쪽(수식받는 핵) 엔티티
 */
function pickHead(text: string, hits: Hit[]): Hit | null {
  if (hits.length === 0) return null

  // "…는 호랑이" / "배고픈 당나귀" — 마지막 엔티티가 핵인 경우가 많음
  const trailing = /(?:는|은|던|라는)\s*([가-힣]{2,8})\s*$/.exec(text)
  if (trailing) {
    const noun = trailing[1]
    const hit = hits.find((h) => ENTITY_LEX.some((e) => e.en === h.en && e.re.test(noun)))
    if (hit) return hit
    // 핵 단어가 엔티티 사전과 직접 매칭
    for (const h of hits) {
      if (text.lastIndexOf(h.en) >= 0) continue
    }
    for (const e of ENTITY_LEX) {
      if (e.re.test(noun)) {
        const found = hits.find((h) => h.en === e.en)
        if (found) return found
      }
    }
  }

  // 주격
  for (const h of hits) {
    const g = grammarFromParticle(particleAfter(text, h.index, h.len))
    if (g === 'agent') return h
  }

  // 관형절: X에게 쫓기는 Y → Y가 head (오른쪽)
  if (/에게/.test(text) && hits.length >= 2) {
    return hits[hits.length - 1]
  }

  // 명사구: 수식어 + 핵 → 오른쪽
  return hits[hits.length - 1]
}

function buildRelations(
  text: string,
  head: SceneEntity | null,
  entities: SceneEntity[],
  actions: string[],
  hasPassive: boolean,
): string[] {
  const rel: string[] = []
  if (!head) return rel

  const others = entities.filter((e) => e.nameEn !== head.nameEn)
  const dative = entities.find((e) => e.grammar === 'dative')
  const patient = entities.find((e) => e.grammar === 'patient')
  const agent = entities.find((e) => e.grammar === 'agent')

  // 수동/피동: 원숭이에게 쫓기는 호랑이
  if (hasPassive && (dative || others[0])) {
    const chaser = dative?.nameEn || others[0]?.nameEn
    if (chaser) {
      rel.push(
        `COMPOSITION: ONE ${head.nameEn} is being chased by ONE ${chaser}`,
        `Both visible: ${head.nameEn} (fleeing) AND ${chaser} (pursuing)`,
        `NOT two ${head.nameEn}s, NOT missing the ${chaser}`,
      )
    }
  }

  // 능동 3형식: 여우가 고양이를 …
  if (agent && patient && agent.nameEn !== patient.nameEn) {
    const act = actions[0] || 'interacting with'
    rel.push(
      `COMPOSITION: ONE ${agent.nameEn} is ${act} ONE ${patient.nameEn}`,
      `Different species both visible — NOT two ${agent.nameEn}s, NOT missing ${patient.nameEn}`,
    )
  }

  // 이종만 있고 관계 미확정
  if (others.length > 0 && rel.length === 0) {
    rel.push(
      `COMPOSITION: show ${head.nameEn} together with ${others.map((o) => o.nameEn).join(' and ')} as distinct beings`,
      'Do not merge species or duplicate one species',
    )
  }

  if (/엄마|어미|mother/i.test(text) && /아기|새끼|infant|baby|cub/i.test(text)) {
    rel.push('mother with infant of the same species, tender care')
  }

  return rel
}

/** 휴리스틱 — 입력 형태 무관 */
export function compileSceneHeuristic(description: string): ScenePlan {
  const raw = description.trim()
  const hits = findEntityHits(raw)
  const headHit = pickHead(raw, hits)
  const { actions, props, hasPassive } = extractActions(raw)
  const states = extractStates(raw)
  const traits = extractTraits(raw)
  const inputForm = detectInputForm(raw)

  const entities: SceneEntity[] = hits.map((h) => {
    const grammar = grammarFromParticle(particleAfter(raw, h.index, h.len))
    // 에게 = dative (쫓기는 쪽의 가해자)
    const g =
      particleAfter(raw, h.index, h.len).startsWith('에게') ||
      particleAfter(raw, h.index, h.len).startsWith('한테')
        ? 'dative'
        : grammar
    return {
      nameEn: h.en,
      kind: h.kind,
      focus: headHit && h.en === headHit.en ? 'head' : 'other',
      grammar: g,
    }
  })

  // dative 보정: "원숭이에게" — particleAfter on 원숭이 is 에게
  for (const e of entities) {
    const hit = hits.find((h) => h.en === e.nameEn)
    if (!hit) continue
    const after = particleAfter(raw, hit.index, hit.len)
    if (after.startsWith('에게') || after.startsWith('한테')) e.grammar = 'dative'
  }

  const head =
    entities.find((e) => e.focus === 'head') ||
    (headHit
      ? {
          nameEn: headHit.en,
          kind: headHit.kind,
          focus: 'head' as const,
          grammar: 'unspecified' as const,
        }
      : null)

  const animalNames = [...new Set(entities.filter((e) => e.kind === 'animal').map((e) => e.nameEn))]
  const multiSpecies = animalNames.length >= 2
  let countHint = parseCount(raw)
  if (countHint == null && multiSpecies) countHint = animalNames.length
  if (countHint == null && head && entities.length === 1) countHint = 1

  const relations = [
    ...buildRelations(raw, head, entities, actions, hasPassive),
    ...buildStoryLocks(raw, props, states, traits),
  ]
  const adult = /누드|나체|nude|naked|란제리|lingerie|야한|에로|섹시|nsfw|explicit|글래머/i.test(raw)
  const setting = enrichSetting(raw, extractSetting(raw), props)
  const hasPlaceHint = /아래|위에서|속에서|에서|옆에서|앞에서|뒤에서|나무|포도|숲|들판|빗속|햇살/.test(raw)
  const hasBodyMotion =
    actions.length > 0 || /서성|배회|걷|달리|뛰|쫓|안|돌보|놀|먹|서\s*있|앉/.test(raw)

  const needsWideScene =
    multiSpecies ||
    actions.length > 0 ||
    relations.length > 0 ||
    props.length > 0 ||
    traits.length > 0 ||
    !!setting ||
    hasPlaceHint ||
    hasBodyMotion ||
    (countHint != null && countHint >= 2) ||
    hasPassive ||
    raw.length >= 28

  return {
    raw,
    head,
    entities,
    states,
    actions,
    props,
    traits,
    relations,
    setting,
    viewpoint: extractViewpoint(raw) || (needsWideScene ? 'full body' : null),
    countHint,
    adult,
    anthro: detectAnthroRequest(raw),
    needsWideScene,
    multiSpecies,
    inputForm,
    source: 'heuristic',
  }
}

function framingFor(size: string | undefined, plan: ScenePlan): string {
  if (plan.needsWideScene || plan.multiSpecies) {
    return 'medium-wide shot, full bodies of all subjects, interaction readable, not a face-only crop'
  }
  if (size === 'landscape') return 'wide cinematic frame'
  if (size === 'story') return '9:16 vertical frame'
  if (size === 'square') return 'square frame'
  return 'vertical 2:3 frame'
}

/** 실제 동물 장면 여부 (반인반수 제외) — 엔진 라우팅용 */
export function isRealWildlifeScene(plan: ScenePlan): boolean {
  return hasAnimalCast(plan) && !plan.anthro
}

/**
 * SDXL/Lightning은 긴 CRITICAL 문장보다 앞쪽 시각 태그를 더 잘 따름.
 * 실제 동물 장면용 짧은 리드를 맨 앞에 둔다.
 */
function buildWildlifeVisualLead(plan: ScenePlan): string {
  const head = plan.head?.nameEn || 'animal'
  const bits = [
    'National Geographic wildlife photography',
    `real ${head}`,
    'quadruped',
    'four legs',
    'natural animal body',
    'animal fur',
    'no clothes',
    'no suit',
    'no necktie',
    'not anthropomorphic',
    'not a person',
  ]
  if (plan.traits.length) bits.push(...plan.traits)
  if (plan.states.length) bits.push(...plan.states)
  if (plan.actions.length) bits.push(...plan.actions)
  if (plan.props.length) bits.push(...plan.props)
  if (plan.setting) bits.push(plan.setting)
  bits.push(framingFor(undefined, { ...plan, needsWideScene: true }), 'outdoor nature', 'photorealistic')
  return bits.join(', ')
}

/** ScenePlan → 이미지 브리프 */
export function buildPromptFromPlan(
  plan: ScenePlan,
  options?: { size?: string; revision?: string },
): string {
  const head = plan.head
  const others = plan.entities.filter((e) => !head || e.nameEn !== head.nameEn)

  const critical: string[] = []
  const animalScene = hasAnimalCast(plan)
  const wildlife = isRealWildlifeScene(plan)

  // 야생동물: 시각 태그를 최전방 (엔진이 여기부터 읽음)
  if (wildlife) {
    critical.push(buildWildlifeVisualLead(plan))
    critical.push(
      `SHOT: real living ${head?.nameEn || 'animal'} only — wildlife documentary still, NOT fashion editorial, NOT character portrait in clothes.`,
    )
  }

  if (head) {
    const stateBit = plan.states.length ? `, ${plan.states.join(', ')}` : ''
    const traitBit = plan.traits.length ? `, ${plan.traits.join(', ')}` : ''
    if (head.kind === 'animal' && plan.anthro) {
      critical.push(
        `CRITICAL FOCUS: anthropomorphic half-beast ${head.nameEn}${stateBit}${traitBit} (반인반수, explicitly requested).`,
      )
    } else if (head.kind === 'animal') {
      critical.push(
        `CRITICAL FOCUS: a real wild ${head.nameEn}${stateBit}${traitBit} — natural animal body, four legs / real anatomy, not a person.`,
      )
    } else {
      critical.push(`CRITICAL FOCUS: the main subject is a real ${head.nameEn}${stateBit}${traitBit}.`)
    }
  }
  if (plan.traits.length) {
    critical.push(`CRITICAL TRAITS (must be visible): ${plan.traits.join('; ')}.`)
    // 한쪽 눈: 엔진이 놓치기 쉬워 한 번 더 못박음
    if (plan.traits.some((t) => /one eye|one-eyed|missing one eye/i.test(t))) {
      critical.push(
        'REPEAT: one-eyed animal, missing left or right eye, asymmetrical face, only one visible open eye.',
      )
    }
  }

  if (animalScene) {
    if (plan.anthro) {
      critical.push(
        'CRITICAL FORM: 반인반수 / anthropomorphic form is allowed because the user explicitly requested it.',
      )
    } else {
      critical.push(
        'CRITICAL FORM: REAL animal only. FORBIDDEN: anthropomorphic, furry, kemono, animal head on human body, bipedal animal, clothes, suit, jacket, shirt, necktie, bowtie, fashion model animal face.',
      )
    }
  }

  if (plan.relations.length) {
    critical.push(...plan.relations.map((r) => `CRITICAL: ${r}`))
  } else if (head && plan.states.length) {
    critical.push(`CRITICAL: show a ${plan.states.join(', ')} ${head.nameEn} clearly.`)
  }
  if (plan.actions.length) {
    critical.push(`CRITICAL ACTION: the ${head?.nameEn || 'subject'} must be visibly ${plan.actions.join(', ')}.`)
  }
  if (plan.setting) {
    critical.push(`CRITICAL SETTING: environment must show ${plan.setting} — not a plain studio backdrop.`)
  }
  if (plan.props.length) {
    critical.push(`CRITICAL PROPS: include ${plan.props.join(', ')} in frame.`)
  }
  if (plan.needsWideScene) {
    critical.push(
      'CRITICAL FRAMING: full-body or medium-wide environmental shot. FORBIDDEN: face-only headshot, portrait crop, black void backdrop.',
    )
  }

  const entityLine = plan.entities.length
    ? plan.entities
        .map((e) => {
          const tag = e.focus === 'head' ? 'HEAD' : e.grammar && e.grammar !== 'unspecified' ? e.grammar : 'cast'
          return `${e.nameEn}(${tag})`
        })
        .join(' + ')
    : 'subjects from user brief'

  const parts = [
    ...critical,
    `USER INPUT (${plan.inputForm}, accept any form): ${plan.raw}`,
    `Scene cast: ${entityLine}.`,
    plan.countHint != null ? `Subject count target: ${plan.countHint}.` : '',
    plan.states.length ? `Visible states/mood: ${plan.states.join('; ')}.` : '',
    plan.traits.length ? `Required appearance traits: ${plan.traits.join('; ')}.` : '',
    plan.actions.length ? `Visible actions: ${plan.actions.join('; ')}.` : '',
    plan.props.length ? `Required props: ${plan.props.join(', ')}.` : '',
    plan.setting ? `Setting: ${plan.setting}.` : '',
    plan.viewpoint ? `Viewpoint: ${plan.viewpoint}.` : '',
    others.length
      ? `Other beings must remain their own species: ${others.map((o) => o.nameEn).join(', ')}.`
      : '',
    'Obey every clause of the user input. Do not drop adjectives, place, props, relative clauses, or secondary animals.',
    'Do not replace species. Do not duplicate one species when two were named.',
    wildlife
      ? 'Do not invent a suited/anthropomorphic animal portrait instead of a real animal in the scene.'
      : 'Do not invent a fashion-model portrait or tight animal headshot instead of the requested scene.',
    framingFor(options?.size, plan),
    wildlife
      ? 'Photorealistic wildlife, natural anatomy, sharp focus, story-clear outdoor composition.'
      : 'Photorealistic, coherent anatomy, sharp focus, story-clear composition.',
  ]

  // 엔진이 앞부분만 잘 따르는 경향 → 핵심 슬롯을 끝에 한 번 더
  if (wildlife) {
    const echo = [
      plan.head ? `FINAL LOCK: real ${plan.head.nameEn}` : '',
      plan.traits.length ? plan.traits.join(', ') : '',
      plan.actions.length ? plan.actions.join(', ') : '',
      plan.setting || '',
      plan.props.length ? plan.props.join(', ') : '',
      'four legs, no clothes, outdoor wildlife photo',
    ]
      .filter(Boolean)
      .join(', ')
    parts.push(echo)
  }

  if (plan.adult) {
    parts.push(
      'Adult playground: render adult sensual/nude/erotic content exactly as requested. Do not sanitize.',
    )
  }
  if (options?.revision?.trim()) {
    parts.push(`Revision (must apply): ${options.revision.trim()}`)
  }

  return parts.filter(Boolean).join(' ')
}

export function buildNegativeFromPlan(plan: ScenePlan): string {
  const base = [
    'worst quality, low quality, blurry, deformed, bad anatomy',
    'watermark, text, logo',
    'ignored prompt, wrong species, missing subject, missing adjective state',
    'fashion model studio portrait',
    'extreme face close-up, clone faces',
    'underage human, loli, shota',
  ]

  if (plan.head) {
    for (const e of plan.entities) {
      if (e.nameEn === plan.head.nameEn) continue
      base.push(`missing ${e.nameEn}`, `no ${e.nameEn}`)
    }
  }
  if (plan.multiSpecies) {
    for (const e of plan.entities.filter((x) => x.kind === 'animal')) {
      base.push(`two ${e.nameEn}s only`, `only ${e.nameEn}s`)
    }
    base.push('same species twice', 'hybrid merge')
  }
  if (plan.states.includes('hungry / starving')) {
    base.push('well-fed plump look when hunger was requested')
  }
  if (plan.actions.length) {
    base.push('no interaction, static unrelated pose, ignoring the described action')
  }
  if (plan.needsWideScene || plan.setting) {
    base.push(
      'extreme face close-up, headshot only, portrait crop, plain black background, studio void, missing environment',
    )
  }
  if (plan.props.includes('soccer ball')) base.push('missing soccer ball')
  if (plan.props.some((p) => /grape/i.test(p))) {
    base.push(
      'missing grapes, no grapevine',
      'grapes as boutonniere',
      'grape lapel pin',
      'grapes on clothing',
      'fashion accessory grapes',
    )
  }
  if (plan.setting && /grape/i.test(plan.setting)) {
    base.push('no grapevine, indoor studio, empty black backdrop')
  }
  if (plan.traits.some((t) => /one eye|one-eyed|missing one eye/i.test(t))) {
    base.push('two normal eyes', 'both eyes intact', 'symmetrical two-eyed face')
  }
  if (plan.traits.length) {
    base.push('ignoring described appearance traits', 'missing requested physical trait')
  }
  if (plan.entities.some((e) => e.nameEn === 'monkey')) {
    base.push('fox face, shiba, dog face instead of monkey')
  }

  if (hasAnimalCast(plan) && !plan.anthro) {
    base.push(
      'anthropomorphic',
      'anthro',
      'furry',
      'kemono',
      'animal head on human body',
      'humanoid animal',
      'bipedal animal',
      'bipedal animal in suit',
      'animal wearing clothes',
      'clothes',
      'suit',
      'jacket',
      'blazer',
      'shirt',
      'dress shirt',
      'necktie',
      'bowtie',
      'tie',
      'tuxedo',
      'tuxedo animal',
      'fashion fox',
      'suited fox',
      'human fashion model with animal face',
      'cartoon mascot person',
      'studio portrait lighting',
      'fashion magazine cover',
    )
  }

  return base.join(', ')
}

// ─── Workers AI (optional) ──────────────────────────────────

function parseAiJson(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function compileSceneWithAi(
  description: string,
  ai: AiBinding | undefined,
): Promise<ScenePlan | null> {
  if (!ai?.run) return null

  const system = [
    'Parse ANY Korean/English image request (full sentence, noun phrase, relative clause, or keywords) into JSON only.',
    'Schema: {"head":{"nameEn":"string","kind":"animal|human|object|other"},',
    '"entities":[{"nameEn":"string","kind":"string","grammar":"agent|patient|dative|companion|unspecified"}],',
    '"states":["hungry"],"actions":["being chased"],"props":[],"traits":["missing one eye"],"relations":["..."],',
    '"setting":null,"viewpoint":null,"countHint":1,"adult":false,"anthro":false,"needsWideScene":true,"multiSpecies":false,',
    '"inputForm":"phrase|clause|sentence|keywords"}',
    'Rules: head = main noun being described (배고픈 당나귀 → donkey).',
    'Relative: 원숭이에게 쫓기는 호랑이 → head=tiger, dative=monkey, action=being chased.',
    'SVO: 여우가 고양이를 안아 → agent=fox, patient=cat. Keep species separate. No markdown.',
    'traits = appearance modifiers (한쪽 눈이 없는 → missing one eye).',
    'anthro=true ONLY if user explicitly asks 반인반수/수인/인화/furry/anthropomorphic.',
  ].join(' ')

  try {
    const result = (await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: description },
      ],
      max_tokens: 550,
      temperature: 0.1,
    })) as { response?: string }

    const text = typeof result?.response === 'string' ? result.response : JSON.stringify(result)
    const parsed = parseAiJson(text)
    if (!parsed) return null

    const fallback = compileSceneHeuristic(description)
    const headObj = parsed.head as { nameEn?: string; kind?: SceneEntity['kind'] } | null
    const head: SceneEntity | null = headObj?.nameEn
      ? {
          nameEn: String(headObj.nameEn),
          kind: headObj.kind || 'other',
          focus: 'head',
          grammar: 'unspecified',
        }
      : fallback.head

    const entitiesRaw = Array.isArray(parsed.entities) ? parsed.entities : []
    const entities: SceneEntity[] = entitiesRaw.length
      ? entitiesRaw.map((e) => {
          const row = e as SceneEntity
          return {
            nameEn: String(row.nameEn || '').trim(),
            kind: row.kind || 'other',
            focus: head && row.nameEn === head.nameEn ? 'head' : 'other',
            grammar: row.grammar || 'unspecified',
          }
        }).filter((e) => e.nameEn)
      : fallback.entities

    if (head && !entities.some((e) => e.nameEn === head.nameEn)) {
      entities.unshift(head)
    }

    const multiSpecies =
      typeof parsed.multiSpecies === 'boolean'
        ? parsed.multiSpecies
        : new Set(entities.filter((e) => e.kind === 'animal').map((e) => e.nameEn)).size >= 2

    return {
      raw: description.trim(),
      head,
      entities,
      states: Array.isArray(parsed.states) ? parsed.states.map(String) : fallback.states,
      actions: Array.isArray(parsed.actions) ? parsed.actions.map(String) : fallback.actions,
      props: Array.isArray(parsed.props) ? parsed.props.map(String) : fallback.props,
      traits: Array.isArray(parsed.traits) ? parsed.traits.map(String) : fallback.traits,
      relations: Array.isArray(parsed.relations)
        ? parsed.relations.map(String)
        : fallback.relations,
      setting: parsed.setting != null ? String(parsed.setting) : fallback.setting,
      viewpoint: parsed.viewpoint != null ? String(parsed.viewpoint) : fallback.viewpoint,
      countHint: typeof parsed.countHint === 'number' ? parsed.countHint : fallback.countHint,
      adult: typeof parsed.adult === 'boolean' ? parsed.adult : fallback.adult,
      anthro:
        typeof parsed.anthro === 'boolean'
          ? parsed.anthro || fallback.anthro
          : fallback.anthro || detectAnthroRequest(description),
      needsWideScene:
        typeof parsed.needsWideScene === 'boolean'
          ? parsed.needsWideScene
          : fallback.needsWideScene,
      multiSpecies,
      inputForm: (parsed.inputForm as ScenePlan['inputForm']) || fallback.inputForm,
      source: 'ai',
    }
  } catch {
    return null
  }
}

export async function compileResponsiveFreePrompt(input: {
  description: string
  size?: string
  revision?: string
  ai?: AiBinding
}): Promise<{ prompt: string; negativePrompt: string; plan: ScenePlan }> {
  const heuristic = compileSceneHeuristic(input.description)
  const aiPlan = await compileSceneWithAi(input.description, input.ai)
  const plan = aiPlan ?? heuristic

  // AI 결과가 빈약하면 휴리스틱 슬롯으로 보강
  if (!plan.states.length && heuristic.states.length) plan.states = heuristic.states
  if (!plan.actions.length && heuristic.actions.length) plan.actions = heuristic.actions
  if (!plan.props.length && heuristic.props.length) plan.props = heuristic.props
  if (!plan.traits?.length && heuristic.traits.length) plan.traits = heuristic.traits
  if (!plan.traits) plan.traits = heuristic.traits
  // 휴리스틱 외형·스토리 잠금은 항상 병합
  for (const t of heuristic.traits) {
    if (!plan.traits.includes(t)) plan.traits.push(t)
  }
  if (!plan.setting && heuristic.setting) plan.setting = heuristic.setting
  else if (heuristic.setting && plan.setting && !/grape/i.test(plan.setting) && /grape/i.test(heuristic.setting)) {
    plan.setting = heuristic.setting
  }
  if (heuristic.needsWideScene) plan.needsWideScene = true
  if (heuristic.anthro) plan.anthro = true
  if (!plan.anthro && detectAnthroRequest(plan.raw)) plan.anthro = true
  if (plan.needsWideScene && !plan.viewpoint) plan.viewpoint = heuristic.viewpoint || 'full body'

  // AI가 relation을 비우면 휴리스틱으로 보강 + 스토리 잠금 병합
  if (plan.relations.length === 0) {
    const hasPassive = /쫓기|chased/i.test(plan.raw) || plan.actions.some((a) => /chased|being/i.test(a))
    plan.relations.push(
      ...buildRelations(plan.raw, plan.head, plan.entities, plan.actions, hasPassive),
    )
  }
  for (const lock of buildStoryLocks(plan.raw, plan.props, plan.states, plan.traits)) {
    if (!plan.relations.includes(lock)) plan.relations.push(lock)
  }

  return {
    prompt: buildPromptFromPlan(plan, { size: input.size, revision: input.revision }),
    negativePrompt: buildNegativeFromPlan(plan),
    plan,
  }
}

/** UI/API용 짧은 요약 */
export function summarizePlan(plan: ScenePlan): {
  source: string
  subjects: string[]
  actions: string[]
  states: string[]
  traits: string[]
  props: string[]
  setting: string | null
  form: string
  anthro: boolean
} {
  return {
    source: plan.source,
    subjects: plan.entities.map((e) => {
      const tag = e.focus === 'head' ? 'head' : e.grammar && e.grammar !== 'unspecified' ? e.grammar : ''
      return tag ? `${e.nameEn}(${tag})` : e.nameEn
    }),
    actions: plan.actions,
    states: plan.states,
    traits: plan.traits,
    props: plan.props,
    setting: plan.setting,
    form: plan.inputForm,
    anthro: plan.anthro,
  }
}
