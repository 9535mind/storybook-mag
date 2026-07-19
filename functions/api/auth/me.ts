import { getUserBySession, jsonResponse, verifyAdminPin } from '../../lib/auth'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const token =
    request.headers.get('x-session-token')?.trim() ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    ''

  if (token && env.DB) {
    const user = await getUserBySession(env.DB, token)
    if (user) return jsonResponse({ ok: true, user }, 200)
  }

  const pin = request.headers.get('x-admin-pin') ?? ''
  if (await verifyAdminPin(env, pin)) {
    return jsonResponse({ ok: true, user: { id: 'admin', email: 'admin@local' }, via: 'admin_pin' }, 200)
  }

  return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
