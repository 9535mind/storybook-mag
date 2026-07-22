import { jsonResponse, setAdminPinOverride, validateAdminPin, verifyAdminPin } from '../../lib/auth'
import { enforceRateLimit, getClientIp } from '../../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  if (!env.DB) return jsonResponse({ ok: false, error: 'auth_db_not_configured' }, 500)

  // 현재 PIN 무차별 대입 방어 — IP당 시간당 5회 + 전체 합산 시간당 20회(분산 시도 대비)
  const limitedByIp = await enforceRateLimit(env, 'auth-change-pin', getClientIp(request), 5, 3600)
  if (limitedByIp) return limitedByIp
  const limitedGlobal = await enforceRateLimit(env, 'auth-change-pin-global', 'global', 20, 3600)
  if (limitedGlobal) return limitedGlobal

  let body: { currentPin?: string; newPin?: string; confirmPin?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const currentPin = (body.currentPin ?? '').trim()
  const newPin = (body.newPin ?? '').trim()
  const confirmPin = (body.confirmPin ?? '').trim()

  if (!(await verifyAdminPin(env, currentPin))) {
    return jsonResponse({ ok: false, error: 'invalid_current_pin' }, 401)
  }

  const pinErr = validateAdminPin(newPin)
  if (pinErr) return jsonResponse({ ok: false, error: pinErr }, 400)
  if (newPin !== confirmPin) {
    return jsonResponse({ ok: false, error: 'pin_confirm_mismatch' }, 400)
  }
  if (newPin === currentPin) {
    return jsonResponse({ ok: false, error: 'pin_unchanged' }, 400)
  }

  const result = await setAdminPinOverride(env.DB, newPin)
  if ('error' in result) {
    return jsonResponse({ ok: false, error: result.error }, result.status)
  }

  return jsonResponse(
    {
      ok: true,
      message: 'PIN이 변경됐어요. 다음 입장부터 새 PIN을 사용하세요.',
    },
    200,
  )
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
