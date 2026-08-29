import { mediaUrlError } from './media-url'

const MAX_IMAGE_BYTES = 12 * 1024 * 1024
/** JSON 응답에 실어 바로 <img>에 넣을 수 있는 상한 (대략 원본 4.5MB PNG) */
const MAX_INLINE_DATA_URL_BYTES = 6 * 1024 * 1024

function extFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase()
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  return 'jpg'
}

function contentTypeFromUrl(url: string, headerType: string): string {
  if (headerType.startsWith('image/') && !headerType.includes('svg')) return headerType
  const u = url.toLowerCase()
  if (u.includes('.png')) return 'image/png'
  if (u.includes('.webp')) return 'image/webp'
  if (u.includes('.gif')) return 'image/gif'
  return 'image/jpeg'
}

function bufferToDataUrl(buf: ArrayBuffer, contentType: string): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${contentType};base64,${btoa(binary)}`
}

/** fal/replicate CDN 이미지를 서버에서 읽어 data URL로 — 브라우저 CDN 차단(검은 미리보기) 회피 */
export async function fetchRemoteImageAsDataUrl(
  sourceUrl: string,
): Promise<{ dataUrl: string; bytes: number; contentType: string } | null> {
  const urlErr = mediaUrlError(sourceUrl)
  if (urlErr) return null
  try {
    const sourceRes = await fetch(sourceUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StorymagBot/1.0)' },
    })
    if (!sourceRes.ok) return null
    const buf = await sourceRes.arrayBuffer()
    if (buf.byteLength < 64 || buf.byteLength > MAX_IMAGE_BYTES) return null
    if (buf.byteLength > MAX_INLINE_DATA_URL_BYTES) {
      // 너무 크면 인라인 생략 — 호출부가 R2 persist만 쓰도록
      return null
    }
    const headerType = (sourceRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const contentType = contentTypeFromUrl(sourceUrl, headerType)
    return { dataUrl: bufferToDataUrl(buf, contentType), bytes: buf.byteLength, contentType }
  } catch {
    return null
  }
}

/** 임시 CDN → R2 공개 URL. 스토리지 미설정·실패 시 null */
export async function persistRemoteImageToR2(
  env: { MEDIA?: R2Bucket; MEDIA_PUBLIC_BASE_URL?: string },
  sourceUrl: string,
): Promise<string | null> {
  if (!env.MEDIA || !env.MEDIA_PUBLIC_BASE_URL?.trim()) return null
  const urlErr = mediaUrlError(sourceUrl)
  if (urlErr) return null
  const publicBase = env.MEDIA_PUBLIC_BASE_URL.trim().replace(/\/+$/, '')
  if (sourceUrl.startsWith(`${publicBase}/`)) return sourceUrl

  try {
    const sourceRes = await fetch(sourceUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StorymagBot/1.0)' },
    })
    if (!sourceRes.ok) return null
    const buf = await sourceRes.arrayBuffer()
    if (buf.byteLength < 64 || buf.byteLength > MAX_IMAGE_BYTES) return null
    const headerType = (sourceRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const contentType = contentTypeFromUrl(sourceUrl, headerType)
    const ext = extFromContentType(contentType)
    const key = `facescene/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    await env.MEDIA.put(key, buf, {
      httpMetadata: { contentType },
      customMetadata: { source: 'tale-scene' },
    })
    return `${publicBase}/${key}`
  } catch {
    return null
  }
}
