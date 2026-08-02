import { requireAuth } from '../lib/auth'
import { FAL_VIDEO_MERGE_TIMEOUT_MS, mergeFalVideos } from '../lib/fal-client'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  FAL_KEY?: string
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'merge-videos', rateLimitIdentity(auth), 20, 3600)
  if (limited) return limited

  if (!env.FAL_KEY?.trim()) {
    return jsonResponse({ ok: false, error: 'fal_key_not_configured' }, 500)
  }

  let body: { videoUrls?: string[] }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const videoUrls = Array.isArray(body.videoUrls)
    ? body.videoUrls.map((u) => String(u || '').trim()).filter(Boolean)
    : []
  if (videoUrls.length < 2) {
    return jsonResponse({ ok: false, error: 'at_least_two_videos_required' }, 400)
  }
  if (videoUrls.length > 8) {
    return jsonResponse({ ok: false, error: 'too_many_videos', max: 8 }, 400)
  }
  for (const url of videoUrls) {
    const err = mediaUrlError(url)
    if (err) return jsonResponse({ ok: false, error: err, url }, 400)
  }

  try {
    const { videoUrl } = await mergeFalVideos({
      falKey: env.FAL_KEY.trim(),
      videoUrls,
      timeoutMs: FAL_VIDEO_MERGE_TIMEOUT_MS,
    })
    return jsonResponse({ ok: true, videoUrl, engineLabel: 'fal.ai · ffmpeg merge' }, 200)
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: 'video_merge_failed',
        message: error instanceof Error ? error.message : 'unknown_error',
      },
      200,
    )
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
