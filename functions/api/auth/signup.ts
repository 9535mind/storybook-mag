import { createUser, jsonResponse } from '../../lib/auth'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  /** 설정 시 이 코드와 일치해야 가입 가능. 없으면 ADMIN_PIN을 초대 코드로 사용. 둘 다 없으면 가입 비활성. */
  SIGNUP_INVITE_CODE?: string
}

function inviteMatches(provided: string, env: Env): boolean {
  const got = provided.trim()
  if (!got) return false
  const expected = (env.SIGNUP_INVITE_CODE || env.ADMIN_PIN || '').trim()
  if (!expected) return false
  if (got.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i += 1) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  if (!env.DB) return jsonResponse({ ok: false, error: 'auth_db_not_configured' }, 500)

  const inviteConfigured = Boolean((env.SIGNUP_INVITE_CODE || env.ADMIN_PIN || '').trim())
  if (!inviteConfigured) {
    return jsonResponse({ ok: false, error: 'signup_disabled' }, 403)
  }

  let body: { email?: string; password?: string; inviteCode?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  if (!inviteMatches(body.inviteCode ?? '', env)) {
    return jsonResponse({ ok: false, error: 'invalid_invite_code' }, 403)
  }

  const result = await createUser(env.DB, body.email ?? '', body.password ?? '')
  if ('error' in result) {
    return jsonResponse({ ok: false, error: result.error }, result.status)
  }

  return jsonResponse(
    {
      ok: true,
      token: result.token,
      user: result.user,
    },
    201,
  )
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
