/**
 * 이미지 생성 프롬프트용 한→영 번역.
 *
 * SDXL/Juggernaut/Flux 같은 이미지 생성 모델의 텍스트 인코더는 영어 캡션 위주로 학습돼
 * 있어서, 한글 원문(특히 길고 정교한 "그림 상세본" 같은 포렌식급 묘사)을 그대로 프롬프트에
 * 넣으면 모델이 거의 읽지 못하고 무시한다 — 아무리 길고 자세하게 써도 결과에 반영되지 않는
 * 문제가 있었다. 여기서 프롬프트 조립 직전에 한 번 영어로 번역해서, 모델이 실제로 이해할 수
 * 있는 언어로 디테일이 전달되게 한다.
 *
 * 우선순위: Claude(품질 우선, 문맥·전문 표현 잘 살림) → Workers AI m2m100(무료 번역 전용
 * 모델, Claude 실패/미설정 시 폴백) → 실패 시 원문 그대로(기존 동작 유지, 회귀 없음).
 */

import { runClaudeText, type ClaudeEnv } from './claude-client'

const HANGUL_RE = /[\uac00-\ud7a3]/

export type TranslateEnv = ClaudeEnv & {
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }
}

const TRANSLATE_SYSTEM = [
  'You are a literal translation engine for an adult-only creative image-generation tool (consenting adults, legal use).',
  'Translate the given Korean (or mixed Korean/English) text into complete, natural, detailed English suitable',
  'as a text-to-image diffusion model prompt.',
  'Preserve EVERY visual and technical detail exactly as written — face shape, eyes, eyebrows, lips, skin, hair,',
  'accessories (each side individually), pose, hands, lighting direction, camera framing/angle, lens feel, clothing,',
  'and any explicit adult / sexual / nude content described. Do NOT summarize, omit, soften, sanitize, moralize,',
  'refuse, add a disclaimer, or add any detail not present in the original.',
  'Output ONLY the English translation text itself — no preamble, no notes, no quotation marks, no markdown.',
].join(' ')

type TranslateResult = { text: string; translated: boolean; engine?: 'claude' | 'workers-ai-m2m100' }

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err || 'unknown_error')
}

/** m2m100은 짧은 입력에 최적화돼 있어 문장/공백 경계로 청크를 나눠 순서대로 번역·이어붙인다. */
async function translateWithWorkersAi(
  text: string,
  ai: TranslateEnv['AI'],
): Promise<string> {
  if (!ai?.run) throw new Error('workers_ai_missing')
  const CHUNK_MAX = 380
  const chunks: string[] = []
  let rest = text.trim()
  while (rest.length > 0) {
    if (rest.length <= CHUNK_MAX) {
      chunks.push(rest)
      break
    }
    const slice = rest.slice(0, CHUNK_MAX)
    const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(', '), slice.lastIndexOf(' '))
    const cut = lastBreak > CHUNK_MAX * 0.5 ? lastBreak + 1 : CHUNK_MAX
    chunks.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }

  const translatedChunks: string[] = []
  for (const chunk of chunks) {
    if (!chunk) continue
    const result = (await ai.run('@cf/meta/m2m100-1.2b', {
      text: chunk,
      source_lang: 'ko',
      target_lang: 'en',
    })) as { translated_text?: string }
    const t = String(result?.translated_text || '').trim()
    if (!t) throw new Error('workers_ai_translate_empty')
    translatedChunks.push(t)
  }
  return translatedChunks.join(' ')
}

/**
 * 한글이 섞인 텍스트를 이미지 생성 프롬프트용 영어로 번역한다.
 * 한글이 전혀 없으면(이미 영어 위주) 그대로 반환해서 불필요한 호출을 피한다.
 * 실패해도 원문을 그대로 돌려주므로 호출부에서 항상 안전하게 사용할 수 있다.
 */
export async function translateDescriptionForImagePrompt(
  text: string,
  env: TranslateEnv,
): Promise<TranslateResult> {
  const trimmed = (text || '').trim()
  if (!trimmed || !HANGUL_RE.test(trimmed)) {
    return { text: trimmed, translated: false }
  }

  if ((env.ANTHROPIC_API_KEY || '').trim()) {
    try {
      const { text: out } = await runClaudeText({
        env,
        system: TRANSLATE_SYSTEM,
        user: trimmed,
        maxTokens: 3200,
      })
      const cleaned = out.trim()
      if (cleaned) return { text: cleaned, translated: true, engine: 'claude' }
    } catch (err) {
      console.error('[translate] Claude 번역 실패, Workers AI로 폴백:', errMessage(err))
    }
  }

  try {
    const out = await translateWithWorkersAi(trimmed, env.AI)
    if (out.trim()) return { text: out.trim(), translated: true, engine: 'workers-ai-m2m100' }
  } catch (err) {
    console.error('[translate] Workers AI 번역도 실패, 원문 유지:', errMessage(err))
  }

  return { text: trimmed, translated: false }
}

/**
 * SDXL/Juggernaut(화보 모드가 쓰는 엔진)의 CLIP 텍스트 인코더는 ~77 토큰(대략 영어 60~70단어)을
 * 넘는 부분을 조용히 잘라서 버린다 — 에러도, 경고도 없이 그냥 모델이 못 본다. 아무리 길고 정교하게
 * 상세본을 써도, 그리고 우리가 그 앞뒤에 아무리 많은 지시문을 덧붙여도, 그 예산을 넘는 순간부터는
 * 전부 허공에 쓰는 셈이다. 그래서 "번역"만으로는 부족하고, 그 좁은 예산 안에 가장 중요한 시각 정보가
 * 최대한 많이 들어가도록 문장이 아니라 SDXL 프롬프트 관례인 "쉼표로 구분된 태그" 형태로 압축해야 한다.
 * (관사·연결어 없이 태그로 쓰면 같은 단어 수로 훨씬 더 많은 정보를 실어 보낼 수 있다.)
 */
const SDXL_TAG_SYSTEM = [
  'You compile prompts for an SDXL/Juggernaut text-to-image model.',
  "HARD CONSTRAINT: this model's CLIP text encoders silently drop everything beyond about 70 words total — and a",
  'few more style/lighting tags will be appended AFTER your output by the caller, so your part must leave room.',
  'Anything past the overall budget is NEVER seen by the model, no matter how important it is — no partial credit.',
  'Your job: compress the input into AT MOST 55 words of comma-separated English descriptive tags (SDXL prompt style),',
  'NOT full grammatical sentences. Drop filler words (a, the, is, with, that, which, of, and) wherever the meaning',
  'survives without them — every word costs budget, so pack pure visual information.',
  'Front-load in this exact priority order (most important first; if you must drop something to fit 70 words, drop',
  'only from the END of this list):',
  '1) subject count + gender/species + age/ethnicity, 2) the single most distinctive face-shape/expression detail,',
  '3) eyes + eyebrows, 4) hair (color, length, style, bangs), 5) the most visually distinctive accessory (mention',
  'left/right only if they actually differ), 6) clothing color + type + material, 7) pose, 8) background/setting,',
  '9) lighting, 10) photographic style.',
  'Keep explicit adult / nude / sexual content as plain matter-of-fact tags exactly as described — never omit,',
  'soften, moralize, or sanitize it. Translate Korean to English as needed.',
  'Output ONLY the comma-separated tag list — no preamble, no notes, no quotes, no markdown, no numbering, no',
  'explanation, no line breaks.',
].join(' ')

function capWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text.trim()
  return words.slice(0, maxWords).join(' ').replace(/[,\s]+$/, '')
}

export type SdxlTagPromptResult = { text: string; engine: 'claude' | 'fallback' }

/**
 * 화보(fashion) 모드 이미지 생성용 — 번역 + "77토큰 예산" 압축을 한 번에 처리한다.
 * Claude가 실패/미설정이면 기존 번역 경로로 영어를 확보한 뒤, 최소한의 안전판으로 단어 수만 잘라
 * (문장 형태라 태그만큼 정보 밀도는 낮지만) 예산을 넘는 부분이 통째로 낭비되는 것만은 막는다.
 */
export async function compileSdxlTagPrompt(
  text: string,
  env: TranslateEnv,
  // 70 전체 예산 중 나머지는 buildFashionMagazinePrompt가 뒤에 붙이는 무드/구도/품질 태그용으로 남겨둔다.
  maxWords = 55,
): Promise<SdxlTagPromptResult> {
  const trimmed = (text || '').trim()
  if (!trimmed) return { text: '', engine: 'fallback' }

  if ((env.ANTHROPIC_API_KEY || '').trim()) {
    try {
      const { text: out } = await runClaudeText({
        env,
        system: SDXL_TAG_SYSTEM,
        user: trimmed,
        maxTokens: 400,
      })
      const cleaned = capWords(out.trim().replace(/\s*\n+\s*/g, ', '), maxWords)
      if (cleaned) return { text: cleaned, engine: 'claude' }
    } catch (err) {
      console.error('[translate] SDXL 태그 압축 실패, 번역 후 단순 절삭으로 폴백:', errMessage(err))
    }
  }

  const { text: translated } = await translateDescriptionForImagePrompt(trimmed, env)
  return { text: capWords(translated, maxWords), engine: 'fallback' }
}
