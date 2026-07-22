import { requireAuth } from '../lib/auth'
import { uploadDataUrlToFal } from '../lib/fal-client'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  FAL_KEY?: string
  MEDIA?: R2Bucket
  MEDIA_PUBLIC_BASE_URL?: string
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

  // 얼굴 참조 사진은 남의 서버(fal.ai)를 아예 거치지 않고 우리 R2 버킷에 직접 저장한다.
  // — 보관·삭제를 전부 우리가 직접 통제할 수 있고(진짜 delete), 제3자에게 원본을 넘기는
  // 단계 자체가 하나 줄어든다. R2가 아직 설정 안 된 배포 환경을 위해 fal 업로드로 폴백한다.
  if (body.purpose === 'face-reference' && env.MEDIA && env.MEDIA_PUBLIC_BASE_URL?.trim()) {
    try {
      const imageUrl = await uploadDataUrlToOwnStorage(env, dataUrl, ext, MAX_UPLOAD_BYTES)
      return jsonResponse({ ok: true, imageUrl }, 200)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'upload_failed'
      return jsonResponse({ ok: false, error: message === 'image_too_large' ? message : 'upload_failed', message }, 502)
    }
  }

  // 그 외(임시 편집용 원본, 마스크 등)는 기존대로 fal 스토리지 사용 — 만료 기한 30일.
  try {
    const imageUrl = await uploadDataUrlToFal(env.FAL_KEY, dataUrl, `upload-${Date.now()}.${ext}`, {
      maxBytes: MAX_UPLOAD_BYTES,
      tooLargeError: 'image_too_large',
    })
    return jsonResponse({ ok: true, imageUrl }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'upload_failed'
    return jsonResponse({ ok: false, error: message === 'image_too_large' ? message : 'upload_failed', message }, 502)
  }
}

/** data URI → 우리 storymag-media R2 버킷에 직접 저장 (fal 등 제3자 스토리지 미사용). */
async function uploadDataUrlToOwnStorage(
  env: Env,
  dataUrl: string,
  ext: string,
  maxBytes: number,
): Promise<string> {
  const blobResponse = await fetch(dataUrl)
  if (!blobResponse.ok) throw new Error('invalid_data_url')
  const blob = await blobResponse.blob()
  if (blob.size > maxBytes) throw new Error('image_too_large')

  const contentType = blob.type || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg')
  const key = `face-ref/${crypto.randomUUID()}.${ext}`
  await env.MEDIA!.put(key, await blob.arrayBuffer(), { httpMetadata: { contentType } })

  const publicBase = env.MEDIA_PUBLIC_BASE_URL!.trim().replace(/\/+$/, '')
  return `${publicBase}/${key}`
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204 })
}
