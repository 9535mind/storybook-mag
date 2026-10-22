// 쇼츠 영상에 입힐 대사 목소리. Wan 엔진은 쓰지 않는다.
import { requireAuth } from '../lib/auth'
import { evaluateContentPolicy } from '../lib/aug27/content-policy'
import { synthesizeFalSpeech, synthesizeFalSpeechFromSample } from '../lib/fal-client'
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

  const limited = await enforceRateLimit(env, 'free-voice', rateLimitIdentity(auth), 20, 3600)
  if (limited) return limited

  if (!env.FAL_KEY?.trim()) {
    return jsonResponse({ ok: false, error: 'fal_key_not_configured' }, 500)
  }

  let body: { text?: string; voiceDataUrl?: string; voiceId?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const text = String(body.text || '').trim()
  const voiceDataUrl = String(body.voiceDataUrl || '').trim()
  const savedVoiceId = String(body.voiceId || '').trim()
  if (!text) return jsonResponse({ ok: false, error: 'revision_required' }, 400)
  if (text.length > 400) return jsonResponse({ ok: false, error: 'revision_too_long' }, 400)
  if (voiceDataUrl && !/^data:(audio\/|video\/webm)/i.test(voiceDataUrl)) {
    return jsonResponse({ ok: false, error: 'invalid_voice_sample' }, 400)
  }
  if (voiceDataUrl.length > 16_000_000) {
    return jsonResponse({ ok: false, error: 'voice_sample_too_large' }, 400)
  }

  const policy = evaluateContentPolicy(text, { mode: 'fashion' })
  if (!policy.allowed) {
    return jsonResponse(
      {
        ok: false,
        error: 'content_policy_blocked',
        blockedReason: policy.blockedReason,
      },
      422,
    )
  }

  try {
    const out = voiceDataUrl
      ? await synthesizeFalSpeechFromSample({
          falKey: env.FAL_KEY,
          text,
          audioDataUrl: voiceDataUrl,
        })
      : savedVoiceId
        ? await synthesizeFalSpeech({ falKey: env.FAL_KEY, text, voiceId: savedVoiceId })
        : await synthesizeFalSpeech({ falKey: env.FAL_KEY, text })
    return jsonResponse(
      {
        ok: true,
        audioUrl: out.audioUrl,
        voiceId: '',
        cloned: Boolean(voiceDataUrl),
        engineLabel: voiceDataUrl ? 'fal.ai · 내 녹취로 대사' : 'fal.ai · 대사 목소리',
      },
      200,
    )
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: 'voice_failed',
        message: error instanceof Error ? error.message : '목소리를 만들지 못했습니다.',
      },
      500,
    )
  }
}
