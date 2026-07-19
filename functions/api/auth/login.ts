import { jsonResponse, loginUser } from '../../lib/auth'

interface Env {
  DB?: D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  if (!env.DB) return jsonResponse({ ok: false, error: 'auth_db_not_configured' }, 500)

  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const result = await loginUser(env.DB, body.email ?? '', body.password ?? '')
  if ('error' in result) {
    return jsonResponse({ ok: false, error: result.error }, result.status)
  }

  return jsonResponse({
    ok: true,
    token: result.token,
    user: result.user,
  })
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
