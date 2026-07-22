import { jsonResponse, resetAdminPasswordWithPin } from '../../lib/auth'
import { enforceRateLimit, getClientIp } from '../../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  SOLO_ADMIN_ONLY?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  // ADMIN_PIN 무차별 대입 방어 — IP당 시간당 5회 + 전체 합산 시간당 20회(분산 시도 대비)
  const limitedByIp = await enforceRateLimit(env, 'auth-reset-password', getClientIp(request), 5, 3600)
  if (limitedByIp) return limitedByIp
  const limitedGlobal = await enforceRateLimit(env, 'auth-reset-password-global', 'global', 20, 3600)
  if (limitedGlobal) return limitedGlobal

  let body: { email?: string; newPassword?: string; confirmPassword?: string; adminPin?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const newPassword = body.newPassword ?? ''
  const confirmPassword = body.confirmPassword ?? ''
  if (newPassword !== confirmPassword) {
    return jsonResponse({ ok: false, error: 'password_confirm_mismatch' }, 400)
  }

  const result = await resetAdminPasswordWithPin(
    env,
    body.email ?? '',
    newPassword,
    body.adminPin ?? '',
  )
  if ('error' in result) {
    return jsonResponse({ ok: false, error: result.error }, result.status)
  }

  return jsonResponse(
    {
      ok: true,
      email: result.email,
      message: '비밀번호를 다시 설정했어요. 새 비밀번호로 로그인해 주세요.',
    },
    200,
  )
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
