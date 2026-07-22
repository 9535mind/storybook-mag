import { isAdminEmail, requireAuth, type AuthUser } from '../lib/auth'
import { revokeFalFileAccess } from '../lib/fal-client'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  FAL_KEY?: string
  MEDIA?: R2Bucket
  MEDIA_PUBLIC_BASE_URL?: string
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

/**
 * 예전/새 사진을 "완전히" 치운다.
 *
 * - 우리 R2(storymag-media) 주소면 env.MEDIA.delete()로 실제 바이트를 그 자리에서 지운다
 *   (제3자 API에 기대지 않는 진짜 삭제).
 * - fal.ai에 남아있던 예전 방식(이 기능 초기 버전) URL이면 fal File ACL을 hide로 바꿔
 *   즉시 접근을 끊는 방식으로 폴백한다.
 * 실패해도 예외를 던지지 않고 결과만 알려준다 — 삭제/교체 자체를 막을 이유는 아니라서.
 */
async function purgeFaceReferenceFile(
  env: Env,
  fileUrl: string,
): Promise<{ deleted: boolean; via: 'r2' | 'fal_acl' | 'none'; error: string | null }> {
  const url = fileUrl.trim()
  if (!url) return { deleted: false, via: 'none', error: null }

  const publicBase = env.MEDIA_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '')
  if (env.MEDIA && publicBase && url.startsWith(`${publicBase}/`)) {
    const key = url.slice(publicBase.length + 1)
    try {
      await env.MEDIA.delete(key)
      return { deleted: true, via: 'r2', error: null }
    } catch (error) {
      return { deleted: false, via: 'r2', error: error instanceof Error ? error.message : 'unknown' }
    }
  }

  // 레거시: 이 기능 초기 버전에서 fal.ai에 올라간 사진일 수 있다.
  if (env.FAL_KEY?.trim()) {
    try {
      await revokeFalFileAccess(env.FAL_KEY, url)
      return { deleted: true, via: 'fal_acl', error: null }
    } catch (error) {
      return { deleted: false, via: 'fal_acl', error: error instanceof Error ? error.message : 'unknown' }
    }
  }

  return { deleted: false, via: 'none', error: 'no_storage_backend_matched' }
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
    const previousUrl = await getSetting(env.DB, FACE_REFERENCE_URL_KEY)
    await setSetting(env.DB, FACE_REFERENCE_URL_KEY, imageUrl)
    await setSetting(env.DB, FACE_REFERENCE_LABEL_KEY, label)

    // 새 사진으로 교체된 경우, 옛 사진이 참조 없이 그대로 남지 않도록 즉시 지운다/차단한다.
    if (previousUrl && previousUrl !== imageUrl) {
      await purgeFaceReferenceFile(env, previousUrl)
    }

    return jsonResponse({ ok: true, imageUrl, label }, 200)
  } catch (error) {
    return jsonResponse(
      { ok: false, error: 'face_reference_save_failed', message: error instanceof Error ? error.message : 'unknown' },
      500,
    )
  }
}

/**
 * 얼굴 레퍼런스 삭제 — 이후 생성은 다시 일반(얼굴 미고정) 경로로 돌아간다.
 *
 * 우리 DB 참조만 지우면 실제 파일(R2든 레거시 fal 업로드든)이 그대로 남는다. 그래서
 * 삭제 시 파일 자체도 함께 치운다(purgeFaceReferenceFile) — 우리 R2 파일이면 진짜
 * delete, 레거시 fal 파일이면 즉시 접근 차단. 파일 정리가 실패해도(네트워크 문제 등)
 * DB 참조는 반드시 지우고, 실패 사실은 응답에 남겨 클라이언트가 정직하게 알릴 수 있게 한다.
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth
  if (!env.DB) return jsonResponse({ ok: true }, 200)

  try {
    await ensureSettingsTable(env.DB)
    const existingUrl = await getSetting(env.DB, FACE_REFERENCE_URL_KEY)

    const purge = existingUrl
      ? await purgeFaceReferenceFile(env, existingUrl)
      : { deleted: false, via: 'none' as const, error: null }

    await env.DB.prepare('DELETE FROM app_settings WHERE key IN (?, ?)')
      .bind(FACE_REFERENCE_URL_KEY, FACE_REFERENCE_LABEL_KEY)
      .run()

    return jsonResponse(
      { ok: true, remoteRevoked: purge.deleted, remoteRevokeVia: purge.via, remoteRevokeError: purge.error },
      200,
    )
  } catch (error) {
    return jsonResponse(
      { ok: false, error: 'face_reference_delete_failed', message: error instanceof Error ? error.message : 'unknown' },
      500,
    )
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
