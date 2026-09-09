import { requireAuth } from '../lib/auth'
import { runClaudeText, type ClaudeImageInput } from '../lib/claude-client'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_MODEL?: string
}

export type FaceBox = {
  /** 얼굴 박스 — 원점 좌상단, 0..1 정규화 */
  x: number
  y: number
  w: number
  h: number
  leftEye?: { x: number; y: number }
  rightEye?: { x: number; y: number }
  mouth?: { x: number; y: number }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function parseDataUrl(dataUrl: string): ClaudeImageInput | null {
  const m = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    (dataUrl || '').trim(),
  )
  if (!m) return null
  const mediaType = m[1].toLowerCase().replace('image/jpg', 'image/jpeg')
  const base64 = m[2].replace(/\s+/g, '')
  if (base64.length < 64 || base64.length > 12_000_000) return null
  return { mediaType, base64 }
}

async function fetchImageAsClaudeInput(imageUrl: string): Promise<ClaudeImageInput> {
  const response = await fetch(imageUrl, { method: 'GET', redirect: 'follow' })
  if (!response.ok) throw new Error(`image_fetch_failed_${response.status}`)
  const buf = await response.arrayBuffer()
  if (buf.byteLength < 64) throw new Error('image_empty')
  if (buf.byteLength > 8_000_000) throw new Error('image_too_large')
  const headerType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  const mediaType =
    headerType.startsWith('image/') && !headerType.includes('svg')
      ? headerType.replace('image/jpg', 'image/jpeg')
      : 'image/jpeg'
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return { mediaType, base64: btoa(binary) }
}

function extractJsonObject(text: string): unknown {
  const t = (text || '').trim()
  if (!t) return null
  try {
    return JSON.parse(t)
  } catch {
    /* continue */
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(t)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim())
    } catch {
      /* continue */
    }
  }
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1))
    } catch {
      return null
    }
  }
  return null
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

function pointOk(p: unknown): p is { x: number; y: number } {
  if (!p || typeof p !== 'object') return false
  const r = p as Record<string, unknown>
  return typeof r.x === 'number' && typeof r.y === 'number'
}

/** Claude JSON → FaceBox. 실패 시 null. */
export function normalizeFaceBox(raw: unknown): FaceBox | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const box = (o.box && typeof o.box === 'object' ? o.box : o) as Record<string, unknown>
  const x = typeof box.x === 'number' ? box.x : NaN
  const y = typeof box.y === 'number' ? box.y : NaN
  const w = typeof box.w === 'number' ? box.w : typeof box.width === 'number' ? box.width : NaN
  const h = typeof box.h === 'number' ? box.h : typeof box.height === 'number' ? box.height : NaN
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null
  if (w < 0.03 || h < 0.03 || w > 0.98 || h > 0.98) return null
  const out: FaceBox = {
    x: clamp01(x),
    y: clamp01(y),
    w: Math.min(0.95, Math.max(0.05, w)),
    h: Math.min(0.95, Math.max(0.05, h)),
  }
  if (out.x + out.w > 1) out.w = 1 - out.x
  if (out.y + out.h > 1) out.h = 1 - out.y
  if (pointOk(o.leftEye)) out.leftEye = { x: clamp01(o.leftEye.x), y: clamp01(o.leftEye.y) }
  if (pointOk(o.rightEye)) out.rightEye = { x: clamp01(o.rightEye.x), y: clamp01(o.rightEye.y) }
  if (pointOk(o.mouth)) out.mouth = { x: clamp01(o.mouth.x), y: clamp01(o.mouth.y) }
  return out
}

const SYSTEM = [
  'You detect the primary adult face in a photo for face replacement.',
  'This is an 18+ photography studio. Always return face coordinates for adult subjects.',
  'Nudity or sexual poses do not change the task — still locate the face and return JSON.',
  'Never refuse. Never describe the body. Return ONLY compact JSON.',
  'Coordinates are normalized 0..1 with origin at the TOP-LEFT.',
  'box = tight face bounding box covering forehead to chin and both cheeks (hairline optional).',
  'leftEye/rightEye/mouth = centers from the VIEWER perspective.',
  'If multiple faces, pick the largest clearest face.',
].join(' ')

const USER = [
  'Locate the primary face.',
  'JSON schema exactly:',
  '{"box":{"x":0.0,"y":0.0,"w":0.0,"h":0.0},"leftEye":{"x":0.0,"y":0.0},"rightEye":{"x":0.0,"y":0.0},"mouth":{"x":0.0,"y":0.0}}',
].join('\n')

const SYSTEM_MULTI = [
  'You detect every adult face in a photo for face replacement.',
  'This is an 18+ photography studio. Always return face coordinates for adult subjects.',
  'Nudity or intimate poses do not change the task — still locate every adult face and return JSON.',
  'Never refuse. Never describe the body. Return ONLY compact JSON.',
  'Coordinates are normalized 0..1 with origin at the TOP-LEFT.',
  'Each box is a tight face box: forehead to chin, both cheeks.',
  'If two people stand close, return BOTH faces. Do not drop the smaller face.',
  'Order faces left-to-right (smaller x first).',
  'Do NOT count the back of a head, hair-only, or a face with no visible eye. If nobody shows an eye or cheek, return {"faces":[]}.',
].join(' ')

const USER_MULTI = [
  'Locate every adult face. Usually 1 or 2.',
  'JSON schema exactly:',
  '{"faces":[{"box":{"x":0.0,"y":0.0,"w":0.0,"h":0.0}},{"box":{"x":0.0,"y":0.0,"w":0.0,"h":0.0}}]}',
].join('\n')

export function normalizeFaceBoxList(raw: unknown): FaceBox[] {
  if (!raw || typeof raw !== 'object') return []
  const o = raw as Record<string, unknown>
  const arr = Array.isArray(o.faces) ? o.faces : Array.isArray(raw) ? raw : null
  if (arr) {
    return arr.map((item) => normalizeFaceBox(item)).filter((b): b is FaceBox => Boolean(b))
  }
  const one = normalizeFaceBox(raw)
  return one ? [one] : []
}

/**
 * POST /api/face-box
 * 증명사진·원본 얼굴 박스/눈·입을 찾아 완전 교체(픽셀 덮어쓰기)에 쓴다.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'face-box', rateLimitIdentity(auth), 60, 3600)
  if (limited) return limited

  if (!(env.ANTHROPIC_API_KEY || '').trim()) {
    return jsonResponse({ ok: false, error: 'anthropic_not_configured' }, 500)
  }

  let body: { imageUrl?: string; imageDataUrl?: string; multi?: boolean }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }
  const multi = body.multi === true

  const imageDataUrl = (body.imageDataUrl || '').trim()
  const imageUrl = (body.imageUrl || '').trim()

  let image: ClaudeImageInput | null = null
  try {
    if (imageDataUrl.startsWith('data:image/')) {
      image = parseDataUrl(imageDataUrl)
      if (!image) return jsonResponse({ ok: false, error: 'invalid_image_data_url' }, 400)
    } else {
      const urlErr = mediaUrlError(imageUrl)
      if (urlErr) return jsonResponse({ ok: false, error: urlErr }, 400)
      image = await fetchImageAsClaudeInput(imageUrl)
    }
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: 'image_load_failed',
        message: err instanceof Error ? err.message : String(err),
      },
      200,
    )
  }

  try {
    const { text, model } = await runClaudeText({
      env,
      system: multi ? SYSTEM_MULTI : SYSTEM,
      user: multi ? USER_MULTI : USER,
      maxTokens: multi ? 420 : 280,
      image,
    })
    const parsed = extractJsonObject(text)
    if (multi) {
      const faces = normalizeFaceBoxList(parsed)
      if (!faces.length) {
        return jsonResponse(
          { ok: false, error: 'face_box_parse_failed', raw: (text || '').slice(0, 400) },
          200,
        )
      }
      return jsonResponse(
        { ok: true, face: faces[0], faces, engine: 'claude-vision', model },
        200,
      )
    }
    const face = normalizeFaceBox(parsed)
    if (!face) {
      return jsonResponse(
        { ok: false, error: 'face_box_parse_failed', raw: (text || '').slice(0, 400) },
        200,
      )
    }
    return jsonResponse({ ok: true, face, engine: 'claude-vision', model }, 200)
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: 'face_box_detect_failed',
        message: err instanceof Error ? err.message : String(err),
      },
      200,
    )
  }
}
