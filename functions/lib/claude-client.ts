/**
 * Anthropic Claude Messages API — 글쓰기 desk 주 엔진.
 * 환경변수:
 *   ANTHROPIC_API_KEY (필수)
 *   ANTHROPIC_MODEL (선택, 기본 claude-sonnet-5)
 */

export type ClaudeEnv = {
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_MODEL?: string
}

export type TextModelSource = 'claude' | 'workers-ai' | 'heuristic'

/** 그림관찰과 표현 — Claude Vision에 넘길 이미지(base64). */
export type ClaudeImageInput = { mediaType: string; base64: string }

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
// 'claude-sonnet-5'는 이 계정에서 실제로 존재하지 않는 모델 ID였음 — 콘솔에서 발급한 키의 curl 예시가 알려준 진짜 ID로 교체.
const DEFAULT_MODEL = 'claude-sonnet-4-6'

type AnthropicContent = { type?: string; text?: string }
type AnthropicResponse = {
  content?: AnthropicContent[]
  error?: { message?: string; type?: string }
}

type AnthropicMessageBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

export function resolveClaudeModel(env: ClaudeEnv): string {
  const m = (env.ANTHROPIC_MODEL || '').trim()
  return m || DEFAULT_MODEL
}

export function hasClaudeKey(env: ClaudeEnv): boolean {
  return Boolean((env.ANTHROPIC_API_KEY || '').trim())
}

export function extractClaudeText(payload: AnthropicResponse): string {
  if (!payload?.content?.length) return ''
  return payload.content
    .filter((c) => c && (c.type === 'text' || c.text))
    .map((c) => String(c.text || ''))
    .join('\n')
    .trim()
}

export async function runClaudeText(input: {
  env: ClaudeEnv
  system: string
  user: string
  maxTokens: number
  /** 첨부하면 Claude Vision으로 이미지를 함께 보낸다 (그림관찰과 표현 등). */
  image?: ClaudeImageInput
}): Promise<{ text: string; model: string }> {
  const apiKey = (input.env.ANTHROPIC_API_KEY || '').trim()
  if (!apiKey) throw new Error('anthropic_api_key_missing')

  const model = resolveClaudeModel(input.env)
  const content: AnthropicMessageBlock[] | string = input.image
    ? [
        { type: 'image', source: { type: 'base64', media_type: input.image.mediaType, data: input.image.base64 } },
        { type: 'text', text: input.user },
      ]
    : input.user
  const bodyJson = JSON.stringify({
    model,
    max_tokens: Math.min(Math.max(input.maxTokens, 256), 8192),
    system: input.system,
    messages: [{ role: 'user', content }],
  })
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'user-agent': 'storymag-cloudflare-pages/1.0',
    },
    body: bodyJson,
  })

  if (!response.ok) {
    const rawText = await response.text().catch((e) => `<본문 읽기 실패: ${errMessage(e)}>`)
    let message = ''
    try {
      const parsed = JSON.parse(rawText) as AnthropicResponse
      message = parsed.error?.message || ''
    } catch {
      /* not JSON */
    }
    const bodyPreview = rawText ? rawText.slice(0, 300) : '<응답 본문 없음>'
    const detail = message || bodyPreview
    const imgInfo = input.image
      ? ` [이미지: ${input.image.mediaType}, base64 ${input.image.base64.length}자, 요청 바이트 ${bodyJson.length}]`
      : ` [요청 바이트 ${bodyJson.length}]`
    const headerDump = Array.from(response.headers.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')
    console.error(
      `[claude-client] anthropic_http_${response.status} model=${model}${imgInfo} headers=[${headerDump || '없음'}] body=${bodyPreview}`,
    )
    const headerNote = headerDump ? '' : ' · 응답 헤더 전혀 없음(중간 차단 의심)'
    throw new Error(`anthropic_http_${response.status}${headerNote}: ${detail}`)
  }
  const payload = (await response.json().catch(() => ({}))) as AnthropicResponse
  const text = extractClaudeText(payload)
  if (!text) throw new Error('anthropic_empty_response')
  return { text, model }
}

/** Workers AI Llama 폴백 — 2026-05-30 llama-3.1-8b-instruct 폐지, -fast 변형으로 교체 */
const WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast'

export async function runWorkersAiText(input: {
  ai?: { run: (model: string, body: Record<string, unknown>) => Promise<unknown> }
  system: string
  user: string
  maxTokens: number
}): Promise<string> {
  if (!input.ai) throw new Error('workers_ai_missing')
  const result = await input.ai.run(WORKERS_AI_MODEL, {
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: input.user },
    ],
    max_tokens: input.maxTokens,
    temperature: 0.55,
  })
  if (!result || typeof result !== 'object') throw new Error('workers_ai_empty')
  const r = result as { response?: string; result?: string; text?: string }
  const text = String(r.response ?? r.result ?? r.text ?? '').trim()
  if (!text) throw new Error('workers_ai_empty')
  return text
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err || 'unknown_error')
}

/**
 * 주 엔진 Claude → 실패/키 없음 시 Workers AI → 그래도 실패 시 heuristic.
 * 실패 사유는 wrangler 로그(console.error)에 남기고, heuristic으로 떨어질 때는
 * 응답에 debugError로도 함께 실어 화면에서 바로 원인을 볼 수 있게 한다.
 */
export async function runDeskTextModel(input: {
  env: ClaudeEnv & {
    AI?: { run: (model: string, body: Record<string, unknown>) => Promise<unknown> }
  }
  system: string
  user: string
  maxTokens: number
  heuristic: string
  /** 첨부하면 Claude Vision으로만 처리한다 (Workers AI 텍스트 모델은 이미지를 볼 수 없음). */
  image?: ClaudeImageInput
}): Promise<{ text: string; source: TextModelSource; model?: string; debugError?: string }> {
  let claudeError = ''
  let workersAiError = ''

  if (hasClaudeKey(input.env)) {
    try {
      const { text, model } = await runClaudeText({
        env: input.env,
        system: input.system,
        user: input.user,
        maxTokens: input.maxTokens,
        image: input.image,
      })
      return { text, source: 'claude', model }
    } catch (err) {
      claudeError = errMessage(err)
      console.error('[claude-client] Claude 호출 실패:', claudeError)
    }

    // 이미지 포함 요청이 실패해도, 이미지 없이 텍스트만으로 한 번 더 시도한다 —
    // 통짜 heuristic보다는 실제 Claude가 (이미지 대조 없이) 글쓰기 코칭을 해 주는 쪽이 사용자에게 낫다.
    if (input.image) {
      try {
        const { text, model } = await runClaudeText({
          env: input.env,
          system: input.system,
          user: input.user,
          maxTokens: input.maxTokens,
        })
        return {
          text,
          source: 'claude',
          model,
          debugError: `이미지 분석 실패로 텍스트만으로 재시도했어요 [원인: ${claudeError}]`,
        }
      } catch (err2) {
        const retryError = errMessage(err2)
        console.error('[claude-client] 이미지 없이 재시도도 실패:', retryError)
        const debugError = `Claude(이미지): ${claudeError} · Claude(텍스트 재시도): ${retryError}`
        return { text: input.heuristic, source: 'heuristic', debugError }
      }
    }
  } else {
    claudeError = 'anthropic_api_key_missing'
  }

  if (input.image) {
    // 키가 없어 위 블록을 타지 않은 경우 — Workers AI 텍스트 모델(Llama)은 이미지를 볼 수 없으므로 바로 heuristic으로.
    const debugError = `Claude: ${claudeError} · 이미지 분석은 Claude 전용`
    console.error('[claude-client] 이미지 첨부 요청, Claude 실패로 heuristic 대체:', debugError)
    return { text: input.heuristic, source: 'heuristic', debugError }
  }

  try {
    const text = await runWorkersAiText({
      ai: input.env.AI,
      system: input.system,
      user: input.user,
      maxTokens: Math.min(input.maxTokens, 2200),
    })
    return { text, source: 'workers-ai', model: WORKERS_AI_MODEL }
  } catch (err) {
    workersAiError = errMessage(err)
    console.error('[claude-client] Workers AI 호출 실패:', workersAiError)
    const debugError = `Claude: ${claudeError || 'ok'} · Workers AI: ${workersAiError}`
    console.error('[claude-client] 두 엔진 모두 실패, heuristic으로 대체:', debugError)
    return { text: input.heuristic, source: 'heuristic', debugError }
  }
}
