import { jsonResponse } from './auth'

type RateEnv = { DB?: D1Database }

let ensured = false

async function ensureTable(db: D1Database): Promise<void> {
  if (ensured) return
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL
      )`,
    )
    .run()
  ensured = true
}

/**
 * 슬라이딩 윈도우가 아닌 고정 윈도우 카운터.
 * 한도 초과 시 Response(429), 통과 시 null.
 * DB 없으면 통과(로컬/미연결 허용).
 */
export async function enforceRateLimit(
  env: RateEnv,
  bucket: string,
  identity: string,
  limit: number,
  windowSec: number,
): Promise<Response | null> {
  if (!env.DB || limit <= 0) return null

  const key = `${bucket}:${identity}`.slice(0, 200)
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - (now % windowSec)

  try {
    await ensureTable(env.DB)
    const row = await env.DB.prepare('SELECT window_start, count FROM rate_limits WHERE key = ?')
      .bind(key)
      .first<{ window_start: number; count: number }>()

    if (!row || row.window_start !== windowStart) {
      await env.DB.prepare(
        'INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1',
      )
        .bind(key, windowStart)
        .run()
      return null
    }

    if (row.count >= limit) {
      const retryAfter = Math.max(1, windowStart + windowSec - now)
      const waitLabel =
        retryAfter >= 3600
          ? `약 ${Math.ceil(retryAfter / 3600)}시간`
          : retryAfter >= 60
            ? `약 ${Math.ceil(retryAfter / 60)}분`
            : `약 ${retryAfter}초`
      return jsonResponse(
        {
          ok: false,
          error: 'rate_limited',
          message: `요청이 너무 많아요. ${waitLabel} 뒤에 다시 시도해 주세요.`,
          retryAfterSec: retryAfter,
          bucket,
        },
        429,
      )
    }

    await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ? AND window_start = ?')
      .bind(key, windowStart)
      .run()
    return null
  } catch {
    // 레이트리밋 장애 시 생성 자체를 막지 않음
    return null
  }
}

export function rateLimitIdentity(auth: { user: { id: string }; via: string }): string {
  return `${auth.via}:${auth.user.id}`
}

/**
 * 로그인 전(pre-auth) 엔드포인트용 식별자. Cloudflare가 붙여주는 접속 IP를 우선 사용한다.
 * (로그인/가입/PIN 엔드포인트는 세션이 없어 rateLimitIdentity를 쓸 수 없음)
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}
