import { requireAuth } from '../lib/auth'
import { runClaudeText, type ClaudeImageInput } from '../lib/claude-client'
import { normalizeBodyLandmarks, type BodyLandmarks } from '../lib/content-policy'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_MODEL?: string
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

const SYSTEM = [
  'You are a careful adult anatomy landmark detector for clothed fashion photos.',
  'Return ONLY compact JSON. No markdown, no commentary.',
  'Coordinates are normalized 0..1 with origin at the TOP-LEFT of the image.',
  'x = fraction from left edge, y = fraction from top edge.',
  'Find the primary adult woman facing the camera (if multiple people, prefer the clearest frontal female torso).',
  'moundL/R = breast mound centers (white circle). nippleL/R = nipple points (red dots).',
  'IMPORTANT: nipples are often NOT at the geometric center of the breast — they may sit slightly lower/outward/inward. Set mound and nipple independently when the clothed silhouette suggests it.',
  'breastRadiusL/R are mound radii as a fraction of min(imageWidth,imageHeight), typically 0.05..0.12.',
  'Never place points on face, neck, shoulders, or arms.',
].join(' ')

const USER = [
  'Inspect this photo and estimate body landmarks for the main woman.',
  'JSON schema exactly:',
  '{"moundL":{"x":0.0,"y":0.0},"moundR":{"x":0.0,"y":0.0},"nippleL":{"x":0.0,"y":0.0},"nippleR":{"x":0.0,"y":0.0},"breastRadiusL":0.08,"breastRadiusR":0.08}',
  'Rules: left/right from VIEWER perspective. mound = soft breast volume center under clothing; nipple = expected nipple under fabric (may be off-center). Omit navel.',
].join('\n')

/**
 * POST /api/body-landmarks
 * Claude Vision으로 유두 L/R·유방 반경을 추정해 타점 UI 초기값으로 쓴다.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'body-landmarks', rateLimitIdentity(auth), 30, 3600)
  if (limited) return limited

  if (!(env.ANTHROPIC_API_KEY || '').trim()) {
    return jsonResponse({ ok: false, error: 'anthropic_not_configured' }, 500)
  }

  let body: { imageUrl?: string; imageDataUrl?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

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
      system: SYSTEM,
      user: USER,
      maxTokens: 400,
      image,
    })
    const parsed = extractJsonObject(text)
    const landmarks = normalizeBodyLandmarks(parsed) as BodyLandmarks | null
    if (!landmarks) {
      return jsonResponse(
        { ok: false, error: 'landmark_parse_failed', raw: (text || '').slice(0, 400) },
        200,
      )
    }
    return jsonResponse({ ok: true, landmarks, engine: 'claude-vision', model }, 200)
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: 'landmark_detect_failed',
        message: err instanceof Error ? err.message : String(err),
      },
      200,
    )
  }
}
