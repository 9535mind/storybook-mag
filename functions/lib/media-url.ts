/**
 * refine / animate 등으로 전달되는 외부 imageUrl 허용 목록.
 * 임의 URL fetch(SSRF·비용 남용)를 막는다.
 */

const ALLOWED_HOST_SUFFIXES = [
  'replicate.delivery',
  'replicate.com',
  'fal.media',
  'fal.ai',
]

/** Replicate/fal이 쓰는 알려진 S3 스타일 호스트만 (전체 amazonaws.com 금지) */
const ALLOWED_HOST_EXACT_OR_PREFIX = [
  /^s3\.amazonaws\.com$/i,
  /^[\w.-]+\.s3\.amazonaws\.com$/i,
  /^[\w.-]+\.s3\.[\w-]+\.amazonaws\.com$/i,
]

export function isAllowedMediaUrl(urlRaw: string): boolean {
  const url = (urlRaw || '').trim()
  if (!url || url.length > 2048) return false

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:') return false
  if (parsed.username || parsed.password) return false

  const host = parsed.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local') || host === '127.0.0.1' || host === '::1') {
    return false
  }
  // 사설 IP 대역 문자열 차단 (호스트가 IP인 경우)
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/.test(host)) return false

  if (ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    return true
  }
  return ALLOWED_HOST_EXACT_OR_PREFIX.some((re) => re.test(host))
}

/** 허용이면 null, 아니면 에러 코드 */
export function mediaUrlError(urlRaw: string): string | null {
  if (!urlRaw?.trim()) return 'image_url_required'
  if (!isAllowedMediaUrl(urlRaw)) return 'image_url_not_allowed'
  return null
}
