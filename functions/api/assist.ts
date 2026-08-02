import { requireAuth } from '../lib/auth'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }
}

type AssistField =
  | 'description'
  | 'guideWho'
  | 'guideState'
  | 'guideAction'
  | 'guideObject'
  | 'guideComplement'
  | 'revision'
  | 'motion'

type AssistPhase = 'advice' | 'fill'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function heuristicAdvice(field: AssistField, mode: string, context: string): string {
  const free = mode === 'free'
  const ctx = context || ''

  if (field === 'description') {
    return free
      ? '주인공·상태·행동이 한눈에 들어오게, 장면 전체를 선명하게.'
      : '의상·포즈·분위기가 분명하게, 화보처럼 한 장으로.'
  }
  if (field === 'guideWho') {
    return free ? '누가 주인공인지 한눈에 들어오게.' : '모델 주인공을 또렷한 명사로.'
  }
  if (field === 'guideState') {
    return '어떤 상태·감정이 보이는지 형용사로.'
  }
  if (field === 'guideAction') {
    return '지금 무엇을 하는지 동사로 분명히.'
  }
  if (field === 'guideObject') {
    return '무엇을/누구를 상대하는지 짧게.'
  }
  if (field === 'guideComplement') {
    return '어디서·어떻게인지 장소나 방식으로.'
  }
  if (field === 'revision') {
    return ctx.includes('여우') || /동물|animal/i.test(ctx)
      ? '표정·동작·배경이 더 또렷해지게.'
      : '얼굴·분위기·디테일이 더 선명해지게.'
  }
  if (field === 'motion') {
    return '시선·몸·옷자락이 자연스럽게 움직이도록.'
  }
  return '장면을 더 선명하게 다듬어 보세요.'
}

function heuristicFill(
  field: AssistField,
  text: string,
  mode: string,
  context: string,
  advice: string,
): string {
  const seed = text.trim()
  const tip = advice.trim()
  const free = mode === 'free'
  const lines = context
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const pick = (key: string) => {
    const row = lines.find((l) => l.startsWith(`${key}:`))
    if (!row) return ''
    const v = row.slice(key.length + 1).trim()
    return v === '-' ? '' : v
  }
  const who = pick('주부')
  const state = pick('형용사')
  const action = pick('술부')
  const object = pick('목적어')
  const complement = pick('보어')
  const desc = pick('설명')

  if (field === 'guideWho') {
    if (seed) return seed.slice(0, 80)
    if (who) return who.replace(/[이가]$/, '')
    return free ? '여우' : '성인 여성 모델'
  }
  if (field === 'guideState') {
    if (seed) return seed
    if (state) return state
    return free ? '배고픈' : '자신감 있는'
  }
  if (field === 'guideAction') {
    if (seed) return seed
    if (action) return action
    return free ? '앉아 있다' : '카메라를 응시한다'
  }
  if (field === 'guideObject') {
    if (seed) return seed
    if (object) return object
    return free ? '포도' : '실크 슬립 드레스'
  }
  if (field === 'guideComplement') {
    if (seed) return seed
    if (complement) return complement
    return free ? '포도 나무 아래에서' : '도시 야경 앞에서'
  }
  if (field === 'revision') {
    if (seed) return tip ? `${seed}. ${tip}` : `${seed}. 자연스럽게 이어지게 수정해줘.`
    return tip || '얼굴과 분위기는 유지한 채, 표현을 더 또렷하고 세련되게 다듬어줘.'
  }
  if (field === 'motion') {
    if (seed) return seed
    return tip || '천천히 고개를 돌리며 시선을 옮기고, 옷자락·털이 부드럽게 흔들림'
  }

  // description — 맥락 조립. 조언은 지시로만 쓰고 문장에 붙이지 않음.
  if (seed && seed.length > 12) return seed
  if (desc && desc.length > 8) return desc

  const subject = [state, who || (free ? '여우' : '성인 여성 모델')].filter(Boolean).join(' ')
  const bits = [complement, object, action || (free ? '앉아 있다' : '서 있다')].filter(Boolean)
  if (subject && bits.length) {
    const particle = /[이가]$/.test(subject) ? '' : '가'
    let sentence = `${subject}${particle} ${bits.join(' ')}`.replace(/\s+/g, ' ').trim()
    // 조언이 장면·선명을 요구하면 전신·장소가 드러나게 살짝 보강
    if (tip && /장면|선명|한눈에|주인공/.test(tip) && !/모습|전신|아래|속/.test(sentence)) {
      sentence = `${sentence} 모습이 한눈에 들어오는 장면`
    }
    return sentence
  }
  return free
    ? '배고픈 여우가 숲 가장자리에 앉아 먼 곳을 바라보는 모습'
    : '세련된 도시의 매력적인 성인 여성, 짧은 실크 슬립 드레스, 자신감 있는 전신 포즈, 도시 야경 배경'
}

async function aiAdvice(
  ai: Env['AI'],
  field: AssistField,
  text: string,
  mode: string,
  context: string,
): Promise<string | null> {
  if (!ai?.run) return null

  try {
    const result = (await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: [
            'You write ONE short Korean directing tip for an image studio field.',
            'Advice ONLY — do NOT write the filled answer. No quotes, no markdown.',
            'Max 40 Korean characters. Tone: concise coach tip.',
            'Example for description: 주인공·상태·행동이 한눈에 들어오게, 장면 전체를 선명하게.',
            `Field: ${field}. Mode: ${mode === 'free' ? 'free illustration' : 'fashion'}.`,
          ].join(' '),
        },
        {
          role: 'user',
          content: `Current: ${text || '(empty)'}\nContext:\n${context || '(none)'}\nWrite the tip.`,
        },
      ],
      max_tokens: 80,
      temperature: 0.5,
    })) as { response?: string }

    const out = (typeof result?.response === 'string' ? result.response : '').trim()
    if (!out) return null
    return out
      .replace(/^["「『]+|["」』]+$/g, '')
      .replace(/^(팁|조언|힌트)\s*[:：]\s*/i, '')
      .slice(0, 80)
  } catch {
    return null
  }
}

async function aiFill(
  ai: Env['AI'],
  field: AssistField,
  text: string,
  mode: string,
  context: string,
  advice: string,
): Promise<string | null> {
  if (!ai?.run) return null

  const fieldHint: Record<AssistField, string> = {
    description:
      'Write ONE Korean image-prompt sentence using Context AND the director tip. Concrete subject + state + action + place if known. Do NOT paste the tip verbatim into the sentence.',
    guideWho: 'Korean subject noun only (주부). Example: 여우. No adjectives if possible.',
    guideState: 'Korean adjective/state only (형용사). Example: 배고픈.',
    guideAction: 'Korean verb/predicate only (술부). Example: 앉아 있다. No subject.',
    guideObject: 'Korean object noun or short phrase only (목적어). Example: 고양이 / 포도.',
    guideComplement: 'Korean complement/manner/place only (보어). Example: 힘없이 / 포도 나무 아래에서.',
    revision:
      'Write a short Korean image-edit instruction for ONLY the change requested (outfit, pose, detail). Do NOT write “같은 얼굴 유지” or “한 명만” — the server locks face and single subject automatically. Follow the director tip.',
    motion: 'Write a short Korean video motion hint for I2V. Camera/body/fabric motion. Follow the director tip.',
  }

  try {
    const result = (await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: [
            'You fill Korean creative writing slots for an adult image studio.',
            'Return ONLY the filled Korean text. No quotes, no markdown, no explanation, no coaching tips.',
            'Obey the Director tip as creative intent (what to emphasize), but write the actual field content — do not copy the tip as the answer.',
            'Read Context carefully and stay consistent with 주부/술부/형용사/목적어/보어/설명.',
            'Partial input is OK — complete it. Empty input — invent a fitting brief from Context + tip.',
            'Never involve minors. Mode: ' + (mode === 'free' ? 'free illustration' : 'fashion editorial') + '.',
            fieldHint[field],
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `Field: ${field}`,
            `Director tip (intent to follow): ${advice || '(none)'}`,
            `Current: ${text || '(empty)'}`,
            `Context:\n${context || '(none)'}`,
          ].join('\n'),
        },
      ],
      max_tokens: 220,
      temperature: 0.7,
    })) as { response?: string }

    const out = (typeof result?.response === 'string' ? result.response : '').trim()
    if (!out) return null
    return out
      .replace(/^["「『]+|["」』]+$/g, '')
      .replace(/^여기(?:요|서)?[:：]\s*/i, '')
      .slice(0, field === 'description' ? 1200 : field === 'revision' || field === 'motion' ? 800 : 200)
  } catch {
    return null
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'assist', rateLimitIdentity(auth), 80, 3600)
  if (limited) return limited

  let body: {
    field?: string
    text?: string
    mode?: string
    context?: string
    phase?: string
    /** fill 단계에서 사용자가 클릭한 조언 칩 텍스트 */
    advice?: string
  }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const field = (body.field || 'description') as AssistField
  const allowed: AssistField[] = [
    'description',
    'guideWho',
    'guideState',
    'guideAction',
    'guideObject',
    'guideComplement',
    'revision',
    'motion',
  ]
  if (!allowed.includes(field)) {
    return jsonResponse({ ok: false, error: 'invalid_field' }, 400)
  }

  const phase: AssistPhase = body.phase === 'advice' ? 'advice' : 'fill'
  const text = (body.text ?? '').trim()
  const mode = body.mode === 'free' ? 'free' : 'fashion'
  const sceneContext = (body.context ?? '').trim().slice(0, 1500)
  const adviceFromClient = (body.advice ?? '').trim().slice(0, 200)

  if (phase === 'advice') {
    const aiText = await aiAdvice(env.AI, field, text, mode, sceneContext)
    const advice = (aiText || heuristicAdvice(field, mode, sceneContext)).trim()
    return jsonResponse(
      {
        ok: true,
        phase: 'advice',
        field,
        text: advice,
        source: aiText ? 'ai' : 'heuristic',
      },
      200,
    )
  }

  const aiText = await aiFill(env.AI, field, text, mode, sceneContext, adviceFromClient)
  const filled = (
    aiText || heuristicFill(field, text, mode, sceneContext, adviceFromClient)
  ).trim()
  if (!filled) {
    return jsonResponse({ ok: false, error: 'assist_empty' }, 500)
  }

  return jsonResponse(
    {
      ok: true,
      phase: 'fill',
      field,
      text: filled,
      adviceUsed: adviceFromClient || null,
      source: aiText ? 'ai' : 'heuristic',
    },
    200,
  )
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204 })
}
