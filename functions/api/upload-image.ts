import { requireAuth } from '../lib/auth'
import { FACE_REFERENCE_UPLOAD_TTL_SECONDS, uploadDataUrlToFal } from '../lib/fal-client'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  FAL_KEY?: string
}

// 사용자가 갖고 있는 사진(예: 오래된 가족 사진)을 스튜디오로 불러와서 그 이미지를 바로
// "수정 대상"으로 쓸 수 있게 한다. refine/animate는 SSRF 방지용 화이트리스트 호스트
// (fal.media, replicate.delivery 등)만 imageUrl로 받아 주므로, 로컬 파일/붙여넣기 이미지를
// 먼저 fal 스토리지에 업로드해서 허용된 https URL로 바꿔준다.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

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

  const limited = await enforceRateLimit(env, 'upload-image', rateLimitIdentity(auth), 30, 3600)
  if (limited) return limited

  if (!env.FAL_KEY?.trim()) {
    return jsonResponse({ ok: false, error: 'upload_engine_not_configured' }, 500)
  }

  let body: { dataUrl?: string; purpose?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const dataUrl = (body.dataUrl ?? '').trim()
  if (!dataUrl) {
    return jsonResponse({ ok: false, error: 'image_required' }, 400)
  }
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(dataUrl)) {
    return jsonResponse({ ok: false, error: 'unsupported_image_format' }, 400)
  }
  if (dataUrl.length > MAX_UPLOAD_BYTES * 1.4) {
    // base64는 원본보다 ~33% 커지므로 대략적인 상한선만 여기서 앞서 걸러낸다.
    return jsonResponse({ ok: false, error: 'image_too_large' }, 400)
  }

  const ext = /^data:image\/png/i.test(dataUrl) ? 'png' : /^data:image\/webp/i.test(dataUrl) ? 'webp' : 'jpg'

  // 얼굴 참조 사진은 계속 재사용해야 하니 더 긴 보관 기한(1년)을 준다.
  // 그 외(임시 편집용 원본, 마스크 등)는 fal-client의 기본값(30일)을 그대로 쓴다.
  const lifecycleSeconds = body.purpose === 'face-reference' ? FACE_REFERENCE_UPLOAD_TTL_SECONDS : undefined

  try {
    const imageUrl = await uploadDataUrlToFal(env.FAL_KEY, dataUrl, `upload-${Date.now()}.${ext}`, {
      maxBytes: MAX_UPLOAD_BYTES,
      tooLargeError: 'image_too_large',
      lifecycleSeconds,
    })
    return jsonResponse({ ok: true, imageUrl }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'upload_failed'
    return jsonResponse({ ok: false, error: message === 'image_too_large' ? message : 'upload_failed', message }, 502)
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204 })
}
