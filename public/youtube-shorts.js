/**
 * YouTube Shorts 게시 준비 헬퍼.
 *
 * Google OAuth 없이도 "다운로드 → 메타 복사 → Studio 열기"를 한 흐름으로 묶는다.
 * 나중에 YouTube Data API 자동 업로드를 붙일 때 같은 draft 스키마를 재사용하면 된다.
 */

const YOUTUBE_STUDIO_UPLOAD_URL = 'https://studio.youtube.com/'
const YOUTUBE_UPLOAD_URL = 'https://www.youtube.com/upload'

/**
 * @param {{ prompt?: string, motion?: string }} input
 * @returns {{ title: string, description: string, tags: string[], filename: string, studioUrl: string, uploadUrl: string }}
 */
function buildYoutubeShortsDraft(input) {
  const prompt = (input.prompt || '').trim()
  const motion = (input.motion || '').trim()
  const snippet = prompt
    .replace(/\s+/g, ' ')
    .slice(0, 60)
    .trim()

  const titleBase = snippet
    ? `패션 쇼츠 · ${snippet}`
    : '패션 매거진 쇼츠'
  const title = truncateTitle(titleBase)

  const descriptionLines = [
    prompt || '하이엔드 패션 매거진풍 숏폼 영상',
    motion ? `Motion: ${motion}` : '',
    '',
    '#Shorts #Fashion #Editorial #MagazineLook #FashionFilm',
  ].filter((line, index, arr) => !(line === '' && arr[index - 1] === ''))

  const tags = ['Shorts', 'Fashion', 'Editorial', 'Magazine', 'FashionFilm']

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const filename = `fashion-shorts-${stamp}.mp4`

  return {
    title,
    description: descriptionLines.join('\n'),
    tags,
    filename,
    studioUrl: YOUTUBE_STUDIO_UPLOAD_URL,
    uploadUrl: YOUTUBE_UPLOAD_URL,
  }
}

function truncateTitle(text) {
  // YouTube 제목 권장 길이 안에서 Shorts 인식에 유리하게 유지
  const max = 90
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trim()}…`
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(area)
  return ok
}

/**
 * 영상 파일을 브라우저로 받아 로컬 다운로드를 유도한다.
 * (Replicate CDN URL은 외부 도메인이라 download 속성만으로는 파일명이 안 먹을 수 있음)
 */
async function downloadVideoFile(videoUrl, filename) {
  const response = await fetch(videoUrl)
  if (!response.ok) throw new Error('video_download_failed')
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  const lower = (filename || '').toLowerCase()
  const fallback =
    blob.type.includes('webm') || videoUrl.startsWith('blob:')
      ? 'fashion-shorts.webm'
      : 'fashion-shorts.mp4'
  anchor.download = filename || fallback
  if (!lower && blob.type.includes('webm')) {
    anchor.download = fallback
  }
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(objectUrl)
}

function openYoutubeUpload() {
  window.open(YOUTUBE_UPLOAD_URL, '_blank', 'noopener,noreferrer')
}
