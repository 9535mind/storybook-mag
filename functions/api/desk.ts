import { requireAuth } from '../lib/auth'
import { runDeskTextModel, type ClaudeImageInput } from '../lib/claude-client'
import {
  OBSERVE_DETAIL_SYSTEM,
  OBSERVE_MODEL_ANSWER_SYSTEM,
  OBSERVE_QUESTIONS_SYSTEM,
  OBSERVE_SYSTEM,
  OBSERVE_TIDY_SYSTEM,
  TALE_HELP_SYSTEM,
  TALE_PAGE_SPLIT_SYSTEM,
  TALE_SYSTEM,
  buildObserveCritique,
  buildObserveDetail,
  buildObserveModelAnswer,
  buildObserveQuestions,
  buildObserveTidy,
  buildTaleCritique,
  buildTaleHelp,
  buildTalePageSplit,
} from '../lib/desk-prompts'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_MODEL?: string
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }
}

type Desk = 'tale' | 'observe'
type Phase = 'critique' | 'layout-suggest' | 'model-answer' | 'tidy' | 'questions' | 'detail'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function taleFallback(): string {
  return [
    '### [1. 첫인상]',
    '사건이 요약만 있고 장면이 없으면 동화가 아니라 줄거리 메모입니다.',
    '',
    '### [2. 구조·사건]',
    '주인공이 원하는 것 → 막는 것 → 시도 → 결과 순으로 한 줄씩 다시 쓰세요.',
    '',
    '### [3. 문장 수술 Before→After]',
    'Before: 슬펐어요.',
    'After: 주먹을 쥐고 신발 끝만 내려다보았어요.',
    '',
    '### [4. 다시 쓸 방향]',
    '교훈 문장을 지우고, 마지막에 주인공이 한 행동만 남기세요.',
    '',
    '### [5. 아이 독자 반응]',
    '교훈 선언에서 흥미를 잃고, 구체적인 행동 장면에서 붙잡힙니다.',
  ].join('\n')
}

/** AI 실패 시에도 항상 pageCount개의 배열을 반환하는 안전한 문장 기준 균등 분배. */
function splitTextEvenly(text: string, pageCount: number): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const sentences = normalized.split(/(?<=[.!?…]|[다요][.!?]?)\s+/).filter(Boolean)
  if (sentences.length === 0) return Array.from({ length: pageCount }, () => '')
  const perPage = Math.max(1, Math.ceil(sentences.length / pageCount))
  const pages: string[] = []
  for (let i = 0; i < pageCount; i++) {
    pages.push(sentences.slice(i * perPage, (i + 1) * perPage).join(' ').trim())
  }
  const consumed = perPage * pageCount
  if (sentences.length > consumed) {
    pages[pages.length - 1] = `${pages[pages.length - 1]} ${sentences.slice(consumed).join(' ')}`.trim()
  }
  return pages
}

/** 모델이 코드블록/설명을 덧붙인 경우까지 최대한 관용적으로 JSON 문자열 배열을 파싱. */
function parsePageArray(raw: string, pageCount: number): string[] | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    if (!parsed.every((p) => typeof p === 'string')) return null
    if (parsed.length === pageCount) return parsed
    // 길이가 다르면 목표 개수에 맞춰 합치거나 잘라 안전하게 보정
    if (parsed.length > pageCount) {
      const head = parsed.slice(0, pageCount - 1)
      const tail = parsed.slice(pageCount - 1).join(' ')
      return [...head, tail]
    }
    return [...parsed, ...Array.from({ length: pageCount - parsed.length }, () => '')]
  } catch {
    return null
  }
}

const MAX_OBSERVE_IMAGE_BASE64_CHARS = 8_000_000 // base64 8M자 ≈ 원본 6MB — 클라이언트에서 미리 리사이즈해서 보냄

/** data:image/xxx;base64,... 형식을 Claude Vision이 받는 {mediaType, base64}로 분해. */
function parseImageDataUrl(raw: string): ClaudeImageInput | null {
  const value = raw.trim()
  if (!value) return null
  const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([a-zA-Z0-9+/=]+)$/.exec(value)
  if (!match) return null
  if (match[2].length > MAX_OBSERVE_IMAGE_BASE64_CHARS) return null
  const mediaType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1]
  return { mediaType, base64: match[2] }
}

function observeModelAnswerFallback(): string {
  return [
    '### 관찰문 모범답안',
    '(엔진 응답 실패로 예시를 만들지 못했어요. 색·위치·동작·배경 순으로 눈에 보이는 것만 적어 보세요.)',
    '### 이렇게 쓴 이유',
    '사실을 색·위치·동작 순서로 나눠서 적었어요.',
  ].join('\n')
}

function observeFallback(): string {
  return [
    '### [1. 이미지와 대조한 정확도]',
    '색·위치·동작을 더 적어 보세요. "예쁜 그림"은 관찰이 아닙니다.',
    '',
    '### [2. 문장 예시 Before→After]',
    'Before: 기분이 좋았다.',
    'After: 창가에 놓인 컵에서 김이 올라오고 있었다.',
    '',
    '### [3. 다시 쓰기 과제]',
    '1) 사실 문장 세 개 2) 추측 문장 표시 3) 위치·동작 하나씩 더 적기',
    '',
    '### [4. 한 줄 총평]',
    '보이는 것을 먼저, 구체적으로.',
  ].join('\n')
}

function observeQuestionsFallback(): string {
  return [
    '### 관찰 질문',
    '1. 색은 정확히 몇 가지이고, 어디에 있나요?',
    '2. 주요 대상은 화면의 어느 쪽에 있나요?',
    '3. 배경에는 무엇이 보이나요?',
  ].join('\n')
}

function observeDetailFallback(): string {
  return [
    '(엔진 응답 실패로 상세본을 만들지 못했어요. 직접 다시 살펴보고 아래 항목을 좌우 따로따로, 액세서리까지 빠짐없이 채워 보세요. 표정은 감정 단어 대신 눈·눈썹·입 모양부터 적어 보세요.)',
    '### 요소별 상세',
    '- 주요 대상 판별(사람/동물/캐릭터, 개체 수):',
    '- 얼굴형·피부톤(또는 털 색)·피부 디테일:',
    '- 눈·눈썹·눈매·시선 방향:',
    '- 코·입·입술(색상·채도):',
    '- 얼굴·표정 상세(눈/눈썹/입/이마 부위별 → 종합 감정 한 문장):',
    '- 헤어 또는 털(색상·질감·길이·좌우 비대칭):',
    '- 액세서리(귀걸이·목걸이·반지 등 — 왼쪽/오른쪽 각각):',
    '- 의상 또는 무늬·패턴(색상·재질·디테일):',
    '- 자세·손(또는 앞발)의 위치와 동작:',
    '- 배경/환경:',
    '- 색감·조명·분위기:',
    '- 구도·카메라 앵글:',
    '- 스타일:',
    '### 이미지 생성용 통합 프롬프트',
    '(엔진 응답 실패)',
  ].join('\n')
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'desk', rateLimitIdentity(auth), 50, 3600)
  if (limited) return limited

  let body: {
    desk?: Desk
    phase?: Phase
    draft?: string
    revision?: string
    grade?: string
    observation?: string
    imageDataUrl?: string
    pageCount?: number
  }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const OBSERVE_PHASES: Phase[] = ['model-answer', 'tidy', 'questions', 'detail']
  const desk: Desk = body.desk === 'observe' ? 'observe' : 'tale'
  const phase: Phase =
    desk === 'tale' && body.phase === 'layout-suggest'
      ? 'layout-suggest'
      : desk === 'observe' && OBSERVE_PHASES.includes(body.phase as Phase)
        ? (body.phase as Phase)
        : 'critique'
  const grade = String(body.grade || '').trim()

  if (desk === 'tale') {
    if (phase === 'critique') {
      const draft = String(body.draft || '').trim()
      if (draft.length < 30) return jsonResponse({ ok: false, error: 'draft_too_short' }, 400)
      if (draft.length > 12000) return jsonResponse({ ok: false, error: 'draft_too_long' }, 400)
      const { text, source, model, debugError } = await runDeskTextModel({
        env,
        system: TALE_SYSTEM,
        user: buildTaleCritique(draft, grade),
        maxTokens: 3200,
        heuristic: taleFallback(),
      })
      return jsonResponse(
        {
          ok: true,
          desk,
          phase,
          text,
          source,
          model,
          debugError,
          grade: grade || '초등 3~4학년',
        },
        200,
      )
    }

    if (phase === 'layout-suggest') {
      const text = String(body.draft || '').trim()
      if (text.length < 20) return jsonResponse({ ok: false, error: 'draft_too_short' }, 400)
      if (text.length > 12000) return jsonResponse({ ok: false, error: 'draft_too_long' }, 400)
      const pageCount = Math.min(30, Math.max(2, Math.round(Number(body.pageCount) || 6)))
      const heuristicPages = splitTextEvenly(text, pageCount)
      const {
        text: raw,
        source,
        model,
        debugError,
      } = await runDeskTextModel({
        env,
        system: TALE_PAGE_SPLIT_SYSTEM,
        user: buildTalePageSplit(text, pageCount),
        maxTokens: Math.min(4000, Math.max(1200, text.length + 400)),
        heuristic: JSON.stringify(heuristicPages),
      })

      let pages = heuristicPages
      let usedHeuristic = source === 'heuristic'
      if (!usedHeuristic) {
        const parsed = parsePageArray(raw, pageCount)
        if (parsed) {
          pages = parsed
        } else {
          usedHeuristic = true
        }
      }

      return jsonResponse(
        {
          ok: true,
          desk,
          phase,
          pages,
          pageCount,
          source: usedHeuristic ? 'heuristic' : source,
          model,
          debugError,
        },
        200,
      )
    }

    const revision = String(body.revision || '').trim()
    if (revision.length < 20) return jsonResponse({ ok: false, error: 'revision_too_short' }, 400)
    const { text, source, model, debugError } = await runDeskTextModel({
      env,
      system: TALE_HELP_SYSTEM,
      user: buildTaleHelp(String(body.draft || ''), revision, grade),
      maxTokens: 900,
      heuristic: '· 교훈 문장 삭제\n· 사건 하나로 좁히기\n· 느낌 말을 행동으로 바꾸기',
    })
    return jsonResponse({ ok: true, desk, phase, text, source, model, debugError }, 200)
  }

  const observation = String(body.observation || '').trim()
  const imageDataUrlRaw = String(body.imageDataUrl || '').trim()
  let image: ClaudeImageInput | null = null
  if (imageDataUrlRaw) {
    image = parseImageDataUrl(imageDataUrlRaw)
    if (!image) return jsonResponse({ ok: false, error: 'observe_image_invalid' }, 400)
  }

  if (phase === 'model-answer') {
    if (!image && !observation) {
      return jsonResponse({ ok: false, error: 'observe_model_answer_needs_source' }, 400)
    }
    const { text, source, model, debugError } = await runDeskTextModel({
      env,
      system: OBSERVE_MODEL_ANSWER_SYSTEM,
      user: buildObserveModelAnswer({ picture: observation, grade, hasImage: Boolean(image) }),
      maxTokens: 900,
      heuristic: observeModelAnswerFallback(),
      image: image ?? undefined,
    })
    return jsonResponse({ ok: true, desk, phase, text, source, model, debugError }, 200)
  }

  if (phase === 'tidy') {
    if (!observation) {
      return jsonResponse({ ok: false, error: 'observe_tidy_needs_text' }, 400)
    }
    const { text, source, model, debugError } = await runDeskTextModel({
      env,
      system: OBSERVE_TIDY_SYSTEM,
      user: buildObserveTidy({ observation, hasImage: Boolean(image) }),
      maxTokens: 700,
      heuristic: observation,
      image: image ?? undefined,
    })
    return jsonResponse({ ok: true, desk, phase, text, source, model, debugError }, 200)
  }

  if (phase === 'questions') {
    if (!image && observation.length < 1) {
      return jsonResponse({ ok: false, error: 'observe_questions_needs_source' }, 400)
    }
    const { text, source, model, debugError } = await runDeskTextModel({
      env,
      system: OBSERVE_QUESTIONS_SYSTEM,
      user: buildObserveQuestions({ observation, grade, hasImage: Boolean(image) }),
      maxTokens: 700,
      heuristic: observeQuestionsFallback(),
      image: image ?? undefined,
    })
    return jsonResponse({ ok: true, desk, phase, text, source, model, debugError }, 200)
  }

  if (phase === 'detail') {
    if (!image && !observation) {
      return jsonResponse({ ok: false, error: 'observe_detail_needs_source' }, 400)
    }
    const { text, source, model, debugError } = await runDeskTextModel({
      env,
      system: OBSERVE_DETAIL_SYSTEM,
      user: buildObserveDetail({ picture: observation, hasImage: Boolean(image) }),
      // 전체 출력(요소별 상세+통합 프롬프트)을 3000자 미만으로 못박은 뒤라, 6000까지는 필요 없다.
      // 그래도 모델이 살짝 넘길 여유는 남겨서 마지막 "통합 프롬프트" 문단이 중간에 끊기지 않게 한다.
      maxTokens: 3600,
      heuristic: observeDetailFallback(),
      image: image ?? undefined,
    })
    return jsonResponse({ ok: true, desk, phase, text, source, model, debugError }, 200)
  }

  if (!image && observation.length < 20) {
    return jsonResponse({ ok: false, error: 'observe_too_short' }, 400)
  }
  const { text, source, model, debugError } = await runDeskTextModel({
    env,
    system: OBSERVE_SYSTEM,
    user: buildObserveCritique({ observation, grade, hasImage: Boolean(image) }),
    maxTokens: 2800,
    heuristic: observeFallback(),
    image: image ?? undefined,
  })
  return jsonResponse({ ok: true, desk, phase, text, source, model, debugError }, 200)
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
