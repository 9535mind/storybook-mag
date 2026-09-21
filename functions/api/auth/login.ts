import { isAdminEmail, isSoloAdminOnly, jsonResponse, loginUser, verifyEnvAdminPin } from '../../lib/auth'
import { enforceRateLimit, getClientIp } from '../../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  SOLO_ADMIN_ONLY?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  if (!env.DB) return jsonResponse({ ok: false, error: 'auth_db_not_configured' }, 500)

  try {
    let body: { email?: string; password?: string }
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
    }

    const pinBypass = isAdminEmail(body.email ?? '') && verifyEnvAdminPin(env, body.password ?? '')
    if (!pinBypass) {
      const limited = await enforceRateLimit(env, 'auth-login', getClientIp(request), 30, 3600)
      if (limited) return limited
    }

    if (isSoloAdminOnly(env) && !isAdminEmail(body.email ?? '')) {
      return jsonResponse({ ok: false, error: 'solo_admin_only' }, 403)
    }

    const result = await loginUser(env.DB, body.email ?? '', body.password ?? '', env)
    if ('error' in result) {
      return jsonResponse({ ok: false, error: result.error }, result.status >= 500 ? 200 : result.status)
    }

    if (isSoloAdminOnly(env) && !isAdminEmail(result.user.email)) {
      return jsonResponse({ ok: false, error: 'solo_admin_only' }, 403)
    }

    if (!result.token) {
      return jsonResponse({
        ok: true,
        pinAuth: true,
        user: result.user,
      })
    }

    return jsonResponse({
      ok: true,
      token: result.token,
      user: result.user,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'login_failed'
    const quota = /D1_ERROR|exceeded D1|row read limit|row write limit/i.test(message)
    return jsonResponse(
      { ok: false, error: quota ? 'd1_quota' : 'login_failed', message },
      200,
    )
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
