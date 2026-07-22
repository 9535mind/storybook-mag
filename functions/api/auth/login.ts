import { isAdminEmail, isSoloAdminOnly, jsonResponse, loginUser } from '../../lib/auth'
import { enforceRateLimit, getClientIp } from '../../lib/rate-limit'

interface Env {
  DB?: D1Database
  SOLO_ADMIN_ONLY?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  if (!env.DB) return jsonResponse({ ok: false, error: 'auth_db_not_configured' }, 500)

  // 비밀번호 무차별 대입 방어 — IP당 시간당 10회
  const limited = await enforceRateLimit(env, 'auth-login', getClientIp(request), 10, 3600)
  if (limited) return limited

  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  if (isSoloAdminOnly(env) && !isAdminEmail(body.email ?? '')) {
    return jsonResponse({ ok: false, error: 'solo_admin_only' }, 403)
  }

  const result = await loginUser(env.DB, body.email ?? '', body.password ?? '')
  if ('error' in result) {
    return jsonResponse({ ok: false, error: result.error }, result.status)
  }

  if (isSoloAdminOnly(env) && !isAdminEmail(result.user.email)) {
    return jsonResponse({ ok: false, error: 'solo_admin_only' }, 403)
  }

  return jsonResponse({
    ok: true,
    token: result.token,
    user: result.user,
  })
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
