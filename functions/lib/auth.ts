export type AuthUser = {
  id: string
  email: string
}

type AuthEnv = {
  DB?: D1Database
  ADMIN_PIN?: string
}

const SESSION_DAYS = 30
const PBKDF2_ITERATIONS = 100_000

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim()
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(new Uint8Array(digest))
}

export async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return { salt: bytesToHex(salt), hash: bytesToHex(new Uint8Array(bits)) }
}

export async function verifyPassword(password: string, saltHex: string, hashHex: string): Promise<boolean> {
  const salt = hexToBytes(saltHex)
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  const computed = bytesToHex(new Uint8Array(bits))
  if (computed.length !== hashHex.length) return false
  let diff = 0
  for (let i = 0; i < computed.length; i += 1) diff |= computed.charCodeAt(i) ^ hashHex.charCodeAt(i)
  return diff === 0
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string): boolean {
  // 로컬 아이디(admin 등) 또는 일반 이메일
  if (/^[a-z0-9._-]{3,64}$/i.test(email)) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validatePassword(password: string): string | null {
  if (password.length < 5) return 'password_too_short'
  if (password.length > 128) return 'password_too_long'
  return null
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const token = `${crypto.randomUUID()}${bytesToHex(crypto.getRandomValues(new Uint8Array(16)))}`
  const tokenHash = await sha256Hex(token)
  const id = crypto.randomUUID()
  const now = new Date()
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await db
    .prepare(
      'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(id, userId, tokenHash, expires.toISOString(), now.toISOString())
    .run()
  return token
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  const tokenHash = await sha256Hex(token)
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
}

export async function getUserBySession(db: D1Database, token: string): Promise<AuthUser | null> {
  if (!token?.trim()) return null
  const tokenHash = await sha256Hex(token.trim())
  const row = await db
    .prepare(
      `SELECT u.id as id, u.email as email, s.expires_at as expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?
       LIMIT 1`,
    )
    .bind(tokenHash)
    .first<{ id: string; email: string; expires_at: string }>()

  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
    return null
  }
  return { id: row.id, email: row.email }
}

export async function createUser(
  db: D1Database,
  emailRaw: string,
  password: string,
): Promise<{ user: AuthUser; token: string } | { error: string; status: number }> {
  const email = normalizeEmail(emailRaw)
  if (!isValidEmail(email)) return { error: 'invalid_email', status: 400 }
  const pwError = validatePassword(password)
  if (pwError) return { error: pwError, status: 400 }

  const existing = await db.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(email).first()
  if (existing) return { error: 'email_already_registered', status: 409 }

  const { salt, hash } = await hashPassword(password)
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  try {
    await db
      .prepare(
        'INSERT INTO users (id, email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(id, email, salt, hash, createdAt)
      .run()
  } catch {
    return { error: 'email_already_registered', status: 409 }
  }

  const token = await createSession(db, id)
  return { user: { id, email }, token }
}

export async function loginUser(
  db: D1Database,
  emailRaw: string,
  password: string,
): Promise<{ user: AuthUser; token: string } | { error: string; status: number }> {
  const email = normalizeEmail(emailRaw)
  if (!isValidEmail(email) || !password) return { error: 'invalid_credentials', status: 401 }

  const row = await db
    .prepare('SELECT id, email, password_salt, password_hash FROM users WHERE email = ? LIMIT 1')
    .bind(email)
    .first<{ id: string; email: string; password_salt: string; password_hash: string }>()

  if (!row) return { error: 'invalid_credentials', status: 401 }
  const ok = await verifyPassword(password, row.password_salt, row.password_hash)
  if (!ok) return { error: 'invalid_credentials', status: 401 }

  const token = await createSession(db, row.id)
  return { user: { id: row.id, email: row.email }, token }
}

const SETTINGS_PIN_SALT = 'admin_pin_salt'
const SETTINGS_PIN_HASH = 'admin_pin_hash'

let settingsTableReady = false

async function ensureSettingsTable(db: D1Database): Promise<void> {
  if (settingsTableReady) return
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    )
    .run()
  settingsTableReady = true
}

async function getSetting(db: D1Database, key: string): Promise<string | null> {
  await ensureSettingsTable(db)
  const row = await db
    .prepare('SELECT value FROM app_settings WHERE key = ? LIMIT 1')
    .bind(key)
    .first<{ value: string }>()
  return row?.value ?? null
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** 환경변수 PIN 또는 D1에 저장된 커스텀 PIN */
export async function verifyAdminPin(env: AuthEnv, pinRaw: string): Promise<boolean> {
  const pin = (pinRaw || '').trim()
  if (!pin || pin.length < 4 || pin.length > 64) return false

  if (env.DB) {
    try {
      const salt = await getSetting(env.DB, SETTINGS_PIN_SALT)
      const hash = await getSetting(env.DB, SETTINGS_PIN_HASH)
      if (salt && hash) {
        return verifyPassword(pin, salt, hash)
      }
    } catch {
      /* fall through to env pin */
    }
  }

  const adminPin = env.ADMIN_PIN?.trim() ?? ''
  if (!adminPin) return false
  return timingSafeEqualString(pin, adminPin)
}

export function validateAdminPin(pin: string): string | null {
  const p = pin.trim()
  if (p.length < 4) return 'pin_too_short'
  if (p.length > 64) return 'pin_too_long'
  return null
}

/** 앱에서 바꾼 PIN을 D1에 저장 (이후 env ADMIN_PIN보다 우선) */
export async function setAdminPinOverride(
  db: D1Database,
  newPin: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const err = validateAdminPin(newPin)
  if (err) return { error: err, status: 400 }
  await ensureSettingsTable(db)
  const { salt, hash } = await hashPassword(newPin.trim())
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(SETTINGS_PIN_SALT, salt, now)
    .run()
  await db
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(SETTINGS_PIN_HASH, hash, now)
    .run()
  return { ok: true }
}

/**
 * 세션 토큰 또는 (비상용) ADMIN_PIN 으로 인증.
 * API는 x-session-token 또는 Authorization: Bearer 를 받는다.
 */
export async function requireAuth(
  request: Request,
  env: AuthEnv,
): Promise<{ user: AuthUser; via: 'session' | 'admin_pin' } | Response> {
  const sessionToken =
    request.headers.get('x-session-token')?.trim() ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    ''

  if (sessionToken && env.DB) {
    const user = await getUserBySession(env.DB, sessionToken)
    if (user) return { user, via: 'session' }
  }

  const pin = request.headers.get('x-admin-pin') ?? ''
  if (await verifyAdminPin(env, pin)) {
    return { user: { id: 'admin', email: 'admin@local' }, via: 'admin_pin' }
  }

  if (!env.DB) {
    return jsonResponse({ ok: false, error: 'auth_db_not_configured' }, 500)
  }
  return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
}

export { jsonResponse, normalizeEmail, isValidEmail }
