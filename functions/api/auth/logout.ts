import { deleteSession, jsonResponse } from '../../lib/auth'

interface Env {
  DB?: D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  if (!env.DB) return jsonResponse({ ok: false, error: 'auth_db_not_configured' }, 500)

  const token =
    request.headers.get('x-session-token')?.trim() ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    ''

  if (token) await deleteSession(env.DB, token)
  return jsonResponse({ ok: true }, 200)
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
