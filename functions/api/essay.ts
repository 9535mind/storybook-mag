import { requireAuth } from '../lib/auth'
import { runDeskTextModel } from '../lib/claude-client'
import {
  ESSAY_ARCHITECT_SYSTEM,
  ESSAY_HELP_SYSTEM,
  ESSAY_PLOT_EXTRACT_SYSTEM,
  ESSAY_REWRITE_SYSTEM,
  ESSAY_REWRITE_VERIFY_SYSTEM,
  buildCritiqueUserMessage,
  buildHelpUserMessage,
  buildPlotExtractUserMessage,
  buildRewriteUserMessage,
  buildRewriteVerifyUserMessage,
  defaultAudience,
} from '../lib/essay-architect'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_MODEL?: string
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }
}

type EssayPhase = 'critique' | 'help' | 'rewrite'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function critiqueFallback(): string {
  return [
    '### [Phase 1: 편집장의 독설 (Diagnosis)]',
    'AI 엔진이 잠시 응답하지 않아 휴리스틱 진단입니다. 초안이 관찰 요약·결론 선언 위주면, 독자가 느낄 자리를 작가가 먼저 차지한 상태입니다. 사건 하나와 실패 장면이 없습니다.',
    '',
    '### [Phase 2: 해체 및 구조 재설계 (Restructuring)]',
    '갈등(구체 사건) → 고뇌(판단 실패) → 통찰(행동으로만 보여주기)로 다시 짜세요. "나는 깨달았습니다"류 문장은 삭제 대상입니다.',
    '',
    '### [Phase 3: 문장 수술대 (Editing Before & After)]',
    'Before: 분위기·감정을 설명한 문장 하나를 고르세요.',
    'After: 같은 순간에 누가 무엇을 했는지 세 줄로 보여 주세요.',
    '',
    '### [Phase 4: 조력자의 대안 및 작성 방향 (Actionable Advice)]',
    '교사가 창피했던(또는 명백히 틀린) 장면 하나를 쓰고, 등장인물 한 명만 끝까지 따라가세요.',
    '',
    '### [Phase 5: 타겟 독자 반응 시뮬레이션 (Reader Simulation)]',
    '결론 요약 문장에서 책을 덮고, 구체 디테일(번호·동작·대사)에서 붙잡힙니다.',
  ].join('\n')
}

function helpFallback(): string {
  return [
    '· 감정·결론을 직접 말한 문장이 있으면 행동·감각으로 바꾸세요.',
    '· 인물·사건 하나를 끝까지 따라가세요. 소개만 하고 버리는 인물은 빼세요.',
    '· AI식 표현(빛난다, 우주, 여정 등)을 생활 어휘로 교체하세요.',
    '· 아이/상대의 실제 대사 한 줄을 넣으면 독백에서 벗어납니다.',
  ].join('\n')
}

function rewriteFallback(source: string): string {
  const base = source.trim().slice(0, 800)
  return base
    ? `${base}\n\n(엔진 응답이 없어 원문을 바탕으로 한 임시본입니다. 다시 「AI 최종 원고 생성」을 눌러 주세요.)`
    : '최종 원고를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

function stripRewriteChrome(text: string): string {
  let t = text.trim()
  t = t.replace(/^```(?:markdown|md|text)?\s*/i, '').replace(/\s*```$/i, '')
  t = t.replace(/^#{1,3}\s*\[?Phase[^\n]*\n+/gi, '')
  return t.trim()
}

function sourceLabel(source: string): string {
  if (source === 'claude') return 'Claude'
  if (source === 'workers-ai') return 'Workers AI(보조)'
  return '휴리스틱'
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'essay', rateLimitIdentity(auth), 40, 3600)
  if (limited) return limited

  let body: {
    phase?: EssayPhase
    draft?: string
    revision?: string
    audience?: string
    stage?: 'revision' | 'final'
    critiqueExcerpt?: string
  }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const rawPhase = String(body.phase || 'critique')
  const phase: EssayPhase =
    rawPhase === 'help' ? 'help' : rawPhase === 'rewrite' ? 'rewrite' : 'critique'
  const draft = String(body.draft || '').trim()
  const audience = defaultAudience(String(body.audience || ''))
  const revision = String(body.revision || '').trim()
  const critiqueExcerpt = String(body.critiqueExcerpt || '').trim()

  if (phase === 'critique') {
    if (draft.length < 40) return jsonResponse({ ok: false, error: 'draft_too_short' }, 400)
    if (draft.length > 12000) return jsonResponse({ ok: false, error: 'draft_too_long' }, 400)
    const { text, source, model, debugError } = await runDeskTextModel({
      env,
      system: ESSAY_ARCHITECT_SYSTEM,
      user: buildCritiqueUserMessage(draft, audience),
      maxTokens: 3500,
      heuristic: critiqueFallback(),
    })
    return jsonResponse(
      {
        ok: true,
        phase: 'critique',
        audience,
        text,
        source,
        model,
        engineLabel: sourceLabel(source),
        debugError,
        message: `수술대 결과입니다. (${sourceLabel(source)})`,
      },
      200,
    )
  }

  if (phase === 'rewrite') {
    if (critiqueExcerpt.length < 40) {
      return jsonResponse({ ok: false, error: 'critique_required' }, 400)
    }
    const sourceText = revision || draft
    if (sourceText.length < 40) return jsonResponse({ ok: false, error: 'draft_too_short' }, 400)
    if (sourceText.length > 12000) return jsonResponse({ ok: false, error: 'draft_too_long' }, 400)

    // 1) 삭제되면 안 되는 사건·인물·갈등 체크리스트 추출 (누락 방지, 순수 추출이라 실패해도 재작성은 계속)
    const extractResult = await runDeskTextModel({
      env,
      system: ESSAY_PLOT_EXTRACT_SYSTEM,
      user: buildPlotExtractUserMessage(sourceText),
      maxTokens: 700,
      heuristic: '',
    })
    const checklist = extractResult.source !== 'heuristic' ? extractResult.text.trim() : ''

    // 2) 체크리스트를 반영한 재작성
    const { text, source, model, debugError } = await runDeskTextModel({
      env,
      system: ESSAY_REWRITE_SYSTEM,
      user: buildRewriteUserMessage({
        draft: draft || sourceText,
        revision,
        audience,
        critiqueExcerpt,
        checklist,
      }),
      maxTokens: 4500,
      heuristic: rewriteFallback(sourceText),
    })

    let finalText = stripRewriteChrome(text)
    let verified = false

    // 3) 자기검증 — 체크리스트 항목이 실제로 최종본에 있는지 대조·보강
    if (source !== 'heuristic' && checklist) {
      const verifyResult = await runDeskTextModel({
        env,
        system: ESSAY_REWRITE_VERIFY_SYSTEM,
        user: buildRewriteVerifyUserMessage({ manuscript: finalText, checklist, audience }),
        maxTokens: 4500,
        heuristic: '',
      })
      if (verifyResult.source !== 'heuristic' && verifyResult.text.trim()) {
        finalText = stripRewriteChrome(verifyResult.text)
        verified = true
      }
    }

    return jsonResponse(
      {
        ok: true,
        phase: 'rewrite',
        audience,
        text: finalText,
        source,
        model,
        engineLabel: sourceLabel(source),
        approved: false,
        debugError,
        verified,
        message:
          source === 'heuristic'
            ? `엔진 응답 실패로 임시본입니다 · ${debugError || ''}`
            : `AI 최종 원고(미승인) · ${sourceLabel(source)}${verified ? ' · 체크리스트 대조 완료' : ''}. 검토 후 승인하세요.`,
      },
      200,
    )
  }

  if (revision.length < 20) return jsonResponse({ ok: false, error: 'revision_too_short' }, 400)
  if (revision.length > 12000) return jsonResponse({ ok: false, error: 'draft_too_long' }, 400)
  const stage = body.stage === 'final' ? 'final' : 'revision'
  const { text, source, model, debugError } = await runDeskTextModel({
    env,
    system: ESSAY_HELP_SYSTEM,
    user: buildHelpUserMessage({
      draft: draft || revision,
      revision,
      audience,
      stage,
      critiqueExcerpt,
    }),
    maxTokens: 900,
    heuristic: helpFallback(),
  })
  return jsonResponse(
    {
      ok: true,
      phase: 'help',
      stage,
      audience,
      text,
      source,
      model,
      engineLabel: sourceLabel(source),
      debugError,
      message: `제출 전 점검 · ${sourceLabel(source)}. 본 파이프라인에는 쌓이지 않습니다.`,
    },
    200,
  )
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
