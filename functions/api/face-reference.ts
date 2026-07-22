import { isAdminEmail, requireAuth, type AuthUser } from '../lib/auth'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
}

// SOLO_ADMIN_ONLY(혼자 쓰는 개인 앱) 전제라 유저별로 나눌 필요 없이 전역 키 하나로 저장한다.
// app_settings는 이미 auth.ts(관리자 PIN 오버라이드)가 쓰는 것과 같은 범용 key-value 테이블이라
// 새 테이블을 만들지 않고 재사용한다.
const FACE_REFERENCE_URL_KEY = 'face_reference_url'
const FACE_REFERENCE_LABEL_KEY = 'face_reference_label'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function ensureSettingsTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    )
    .run()
}

async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM app_settings WHERE key = ? LIMIT 1')
    .bind(key)
    .first<{ value: string }>()
  return row?.value ?? null
}

async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(key, value, now)
    .run()
}

async function requireAdmin(
  request: Request,
  env: Env,
): Promise<{ user: AuthUser; via: 'session' | 'admin_pin' } | Response> {
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth
  if (!isAdminEmail(auth.user.email)) {
    return jsonResponse({ ok: false, error: 'admin_only' }, 403)
  }
  return auth
}

/** 현재 저장된 얼굴 레퍼런스 조회 (없으면 imageUrl: null). */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth
  if (!env.DB) return jsonResponse({ ok: true, imageUrl: null, label: null }, 200)

  try {
    await ensureSettingsTable(env.DB)
    const [imageUrl, label] = await Promise.all([
      getSetting(env.DB, FACE_REFERENCE_URL_KEY),
      getSetting(env.DB, FACE_REFERENCE_LABEL_KEY),
    ])
    return jsonResponse({ ok: true, imageUrl, label }, 200)
  } catch (error) {
    return jsonResponse(
      { ok: false, error: 'face_reference_read_failed', message: error instanceof Error ? error.message : 'unknown' },
      500,
    )
  }
}

/**
 * 얼굴 레퍼런스 사진 저장 — imageUrl은 반드시 먼저 /api/upload-image로 업로드해서 받은
 * 허용된 URL(fal.media 등)이어야 한다(SSRF 방지, mediaUrlError와 동일한 화이트리스트).
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth
  if (!env.DB) return jsonResponse({ ok: false, error: 'storage_not_configured' }, 200)

  const limited = await enforceRateLimit(env, 'face-reference', rateLimitIdentity(auth), 20, 3600)
  if (limited) return limited

  let body: { imageUrl?: string; label?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const imageUrl = (body.imageUrl ?? '').trim()
  const urlErr = mediaUrlError(imageUrl)
  if (urlErr) return jsonResponse({ ok: false, error: urlErr }, 400)
  const label = (body.label ?? '').trim().slice(0, 80)

  try {
    await ensureSettingsTable(env.DB)
    await setSetting(env.DB, FACE_REFERENCE_URL_KEY, imageUrl)
    await setSetting(env.DB, FACE_REFERENCE_LABEL_KEY, label)
    return jsonResponse({ ok: true, imageUrl, label }, 200)
  } catch (error) {
    return jsonResponse(
      { ok: false, error: 'face_reference_save_failed', message: error instanceof Error ? error.message : 'unknown' },
      500,
    )
  }
}

/** 얼굴 레퍼런스 삭제 — 이후 생성은 다시 일반(얼굴 미고정) 경로로 돌아간다. */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth
  if (!env.DB) return jsonResponse({ ok: true }, 200)

  try {
    await ensureSettingsTable(env.DB)
    await env.DB.prepare('DELETE FROM app_settings WHERE key IN (?, ?)')
      .bind(FACE_REFERENCE_URL_KEY, FACE_REFERENCE_LABEL_KEY)
      .run()
    return jsonResponse({ ok: true }, 200)
  } catch (error) {
    return jsonResponse(
      { ok: false, error: 'face_reference_delete_failed', message: error instanceof Error ? error.message : 'unknown' },
      500,
    )
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
