import { requireAuth } from '../lib/auth'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'
import {
  buildPromptFromPlan,
  compileSceneHeuristic,
  isRealWildlifeScene,
  summarizePlan,
} from '../lib/scene-compiler'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

/** 생성 전 장면 슬롯 미리보기 (휴리스틱만 · 빠르고 비용 없음) */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'scene-preview', rateLimitIdentity(auth), 120, 3600)
  if (limited) return limited

  let body: { description?: string; size?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const description = (body.description ?? '').trim()
  if (!description) return jsonResponse({ ok: false, error: 'description_required' }, 400)
  if (description.length > 1200) return jsonResponse({ ok: false, error: 'description_too_long' }, 400)

  const plan = compileSceneHeuristic(description)
  const scene = summarizePlan(plan)
  const promptPreview = buildPromptFromPlan(plan, { size: body.size }).slice(0, 900)

  return jsonResponse(
    {
      ok: true,
      scene,
      wildlife: isRealWildlifeScene(plan),
      needsWideScene: plan.needsWideScene,
      setting: plan.setting,
      props: plan.props,
      traits: plan.traits,
      promptPreview,
    },
    200,
  )
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
