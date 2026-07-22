import { requireAuth } from '../lib/auth'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
}

// suno.com 공유 링크(예: https://suno.com/s/xxxx)를 붙여넣으면 서버가 대신
// 페이지를 읽어 실제 mp3 주소를 찾아내고, 그 음원을 대신 받아 클라이언트로 돌려준다.
// (브라우저에서 곧바로 suno 도메인을 fetch하면 CORS로 막히기 때문에 서버가 대리 요청한다.)
const MAX_AUDIO_BYTES = 20 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15000
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function isAllowedSunoPageUrl(urlRaw: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(urlRaw)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  const host = parsed.hostname.toLowerCase()
  return host === 'suno.com' || host === 'www.suno.com'
}

function isAllowedSunoAudioUrl(urlRaw: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(urlRaw)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  const host = parsed.hostname.toLowerCase()
  return (
    host === 'suno.ai' ||
    host.endsWith('.suno.ai') ||
    host === 'suno.com' ||
    host.endsWith('.suno.com')
  )
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Suno 공유 페이지 HTML(Next.js RSC 페이로드) 안에 박혀 있는 clip 정보에서 title/audio_url을 뽑아낸다. */
function extractSunoClip(html: string): { title: string; audioUrl: string } | null {
  // RSC 페이로드 안에서는 JSON 문자열이 \" 형태로 이스케이프돼 있으므로 먼저 풀어준다.
  const unescaped = html.replace(/\\"/g, '"')

  const withTitle = unescaped.match(
    /"title":"([^"]*)"[\s\S]{0,600}?"audio_url":"(https:\/\/[^"]+\.mp3)"/,
  )
  if (withTitle) {
    return { title: withTitle[1]?.trim() || '', audioUrl: withTitle[2] }
  }

  const audioOnly = unescaped.match(/"audio_url":"(https:\/\/[^"]+\.mp3)"/)
  if (audioOnly) {
    return { title: '', audioUrl: audioOnly[1] }
  }

  return null
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'bgm-from-url', rateLimitIdentity(auth), 20, 3600)
  if (limited) return limited

  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const pageUrl = (body.url ?? '').trim()
  if (!pageUrl) {
    return jsonResponse({ ok: false, error: 'url_required' }, 400)
  }
  if (!isAllowedSunoPageUrl(pageUrl)) {
    return jsonResponse(
      {
        ok: false,
        error: 'unsupported_url',
        message: 'suno.com 공유 링크만 지원해요 (예: https://suno.com/s/xxxx).',
      },
      400,
    )
  }

  // 1) 공유 페이지를 대신 열어서 실제 mp3 주소를 찾는다.
  let html: string
  try {
    const pageRes = await fetchWithTimeout(
      pageUrl,
      {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
      },
      FETCH_TIMEOUT_MS,
    )
    if (!pageRes.ok) {
      return jsonResponse(
        { ok: false, error: 'suno_page_fetch_failed', message: `HTTP ${pageRes.status}` },
        200,
      )
    }
    html = await pageRes.text()
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: 'suno_page_fetch_failed',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      200,
    )
  }

  const clip = extractSunoClip(html)
  if (!clip?.audioUrl) {
    return jsonResponse(
      {
        ok: false,
        error: 'suno_audio_not_found',
        message: '이 링크에서 음원 주소를 찾지 못했어요. 비공개 트랙이거나 페이지 구조가 바뀌었을 수 있어요.',
      },
      200,
    )
  }
  if (!isAllowedSunoAudioUrl(clip.audioUrl)) {
    return jsonResponse({ ok: false, error: 'suno_audio_not_allowed' }, 200)
  }

  // 2) 실제 mp3 파일을 서버가 대신 받아서 클라이언트로 전달한다 (CORS 회피).
  try {
    const audioRes = await fetchWithTimeout(
      clip.audioUrl,
      { method: 'GET', redirect: 'follow' },
      FETCH_TIMEOUT_MS,
    )
    if (!audioRes.ok) {
      return jsonResponse(
        { ok: false, error: 'suno_audio_fetch_failed', message: `HTTP ${audioRes.status}` },
        200,
      )
    }

    const buf = await audioRes.arrayBuffer()
    if (buf.byteLength < 64) {
      return jsonResponse({ ok: false, error: 'suno_audio_empty' }, 200)
    }
    if (buf.byteLength > MAX_AUDIO_BYTES) {
      return jsonResponse({ ok: false, error: 'suno_audio_too_large' }, 200)
    }

    const bytes = new Uint8Array(buf)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    const dataUrl = `data:audio/mpeg;base64,${btoa(binary)}`

    return jsonResponse({ ok: true, dataUrl, title: clip.title, bytes: buf.byteLength }, 200)
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: 'suno_audio_fetch_failed',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      200,
    )
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204 })
}
