const SESSION_STORAGE_KEY = 'fashionMagazineSessionToken'
const USER_STORAGE_KEY = 'fashionMagazineUserEmail'
const GALLERY_STORAGE_KEY = 'fashionMagazineGallery'
const LEGACY_PIN_STORAGE_KEY = 'fashionMagazineAdminPin'

const pinGate = document.getElementById('pin-gate')
const pinError = document.getElementById('pin-error')
const authEmailInput = document.getElementById('auth-email')
const authPasswordInput = document.getElementById('auth-password')
const authSubmitButton = document.getElementById('auth-submit')
const authTabLogin = document.getElementById('auth-tab-login')
const authTabSignup = document.getElementById('auth-tab-signup')
const authInviteWrap = document.getElementById('auth-invite-wrap')
const authInviteInput = document.getElementById('auth-invite')
const authUserLabel = document.getElementById('auth-user-label')

const app = document.getElementById('app')
const logoutButton = document.getElementById('logout-button')

let authMode = 'login'

const form = document.getElementById('generate-form')
const descriptionField = document.getElementById('description')
const guideWhoField = document.getElementById('guide-who')
const guideStateField = document.getElementById('guide-state')
const guideActionField = document.getElementById('guide-action')
const guideObjectField = document.getElementById('guide-object')
const guideComplementField = document.getElementById('guide-complement')
const guideDetail = document.getElementById('guide-detail')
const scenePreviewEl = document.getElementById('scene-preview')
const moodField = document.getElementById('mood')
const sizeField = document.getElementById('size')
const genModeHint = document.getElementById('gen-mode-hint')
let scenePreviewTimer = null
let scenePreviewSeq = 0

function getGenMode() {
  // 당분간 자유 일러스트에 집중 — 화보(관리자) 모드는 UI에서 숨김
  return 'free'
}
const generateButton = document.getElementById('generate-button')
const formStatus = document.getElementById('form-status')

const resultSection = document.getElementById('result-section')
const resultEngine = document.getElementById('result-engine')
const resultImage = document.getElementById('result-image')
const resultDownload = document.getElementById('result-download')
const reviewBadge = document.getElementById('review-badge')
const reviewPanel = document.getElementById('review-panel')
const revisePanel = document.getElementById('revise-panel')
const acceptedActions = document.getElementById('accepted-actions')
const animatePanel = document.getElementById('animate-panel')
const acceptButton = document.getElementById('accept-button')
const reviseToggleButton = document.getElementById('revise-toggle-button')
const reviseAgainButton = document.getElementById('revise-again-button')
const rejectButton = document.getElementById('reject-button')
const reviseApplyButton = document.getElementById('revise-apply-button')
const reviseCancelButton = document.getElementById('revise-cancel-button')
const reviewActions = document.getElementById('review-actions')
const revisionText = document.getElementById('revision-text')
const reviseStatus = document.getElementById('revise-status')
const resultStage = document.getElementById('result-stage')
const regionCanvas = document.getElementById('region-canvas')
const regionHint = document.getElementById('region-hint')
const regionToolbar = document.getElementById('region-toolbar')
const regionUndoButton = document.getElementById('region-undo-button')
const regionClearButton = document.getElementById('region-clear-button')
const regionList = document.getElementById('region-list')

const motionField = document.getElementById('motion')
const animateButton = document.getElementById('animate-button')
const animateStatus = document.getElementById('animate-status')
const videoResultSection = document.getElementById('video-result')
const resultVideo = document.getElementById('result-video')
const videoDurationGroup = document.getElementById('video-duration')
const videoSpeedGroup = document.getElementById('video-speed')

const VIDEO_PLAYBACK_RATES = { slow: 0.75, normal: 1, fast: 1.35 }
const VIDEO_MOTION_HINTS = {
  slow: 'slow gentle movement, unhurried pace, soft motion',
  normal: '',
  fast: 'faster dynamic movement, quicker subject and camera motion',
}

function getSelectedVideoDuration() {
  const fromAttr = Number(videoDurationGroup?.dataset?.duration || 8)
  if (fromAttr === 8 || fromAttr === 10 || fromAttr === 12 || fromAttr === 15) return fromAttr
  return 8
}

function setSelectedVideoDuration(sec) {
  const n = Number(sec)
  const value = n === 8 || n === 10 || n === 12 || n === 15 ? n : 8
  if (videoDurationGroup) videoDurationGroup.dataset.duration = String(value)
  videoDurationGroup?.querySelectorAll('[data-duration]').forEach((btn) => {
    btn.classList.toggle('is-active', Number(btn.getAttribute('data-duration')) === value)
  })
}

function getSelectedVideoSpeed() {
  const v = videoSpeedGroup?.dataset?.speed || 'normal'
  return v === 'slow' || v === 'fast' ? v : 'normal'
}

function setSelectedVideoSpeed(speed) {
  const value = speed === 'slow' || speed === 'fast' ? speed : 'normal'
  if (videoSpeedGroup) videoSpeedGroup.dataset.speed = value
  videoSpeedGroup?.querySelectorAll('[data-speed]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-speed') === value)
  })
  document.querySelectorAll('[data-speed-play]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-speed-play') === value)
  })
  applyVideoPlaybackRate()
}

function applyVideoPlaybackRate() {
  if (!resultVideo) return
  const rate = VIDEO_PLAYBACK_RATES[getSelectedVideoSpeed()] || 1
  resultVideo.playbackRate = rate
  try {
    resultVideo.defaultPlaybackRate = rate
  } catch {
    /* ignore */
  }
}

const ytTitleField = document.getElementById('yt-title')
const ytDescriptionField = document.getElementById('yt-description')
const ytPrepareAllButton = document.getElementById('yt-prepare-all')
const ytDownloadButton = document.getElementById('yt-download')
const ytCopyButton = document.getElementById('yt-copy')
const ytOpenButton = document.getElementById('yt-open')
const youtubeStatus = document.getElementById('youtube-status')

const galleryGrid = document.getElementById('gallery-grid')
const galleryEmpty = document.getElementById('gallery-empty')
const clearGalleryButton = document.getElementById('clear-gallery')
const newShootHeaderButton = document.getElementById('new-shoot-header')
const newShootGalleryButton = document.getElementById('new-shoot-gallery')
const bgmSlotsEl = document.getElementById('bgm-slots')
const bgmUploadInput = document.getElementById('bgm-upload')
const bgmVolumeInput = document.getElementById('bgm-volume')
const bgmVolumeLabel = document.getElementById('bgm-volume-label')
const bgmApplyButton = document.getElementById('bgm-apply')
const bgmResetButton = document.getElementById('bgm-reset')
const bgmStatus = document.getElementById('bgm-status')

/** 현재 결과 화면에 떠 있는 이미지/영상 상태 */
const currentResult = {
  imageUrl: null,
  videoUrl: null,
  originalVideoUrl: null,
  mixedVideoFilename: null,
  prompt: '',
  mood: 'editorial',
  size: 'portrait',
  itemId: null,
  youtubeDraft: null,
  accepted: false,
  engineLabel: '',
  fallbackUsed: false,
  engine: '',
  previousImageUrl: '',
}

const bgmState = {
  selectedSlotId: '',
  uploadFile: null,
}

/** 확정된 수정 영역들 + 현재 드래그 중인 임시 사각형 */
const regionState = {
  regions: /** @type {Array<{ id: number, x: number, y: number, w: number, h: number }>} */ ([]),
  nextId: 1,
  draft: { active: false, startX: 0, startY: 0, x: 0, y: 0, w: 0, h: 0 },
}

function getSessionToken() {
  return localStorage.getItem(SESSION_STORAGE_KEY) || ''
}

function setSessionToken(token, email) {
  localStorage.setItem(SESSION_STORAGE_KEY, token)
  if (email) localStorage.setItem(USER_STORAGE_KEY, email)
}

function clearSessionToken() {
  localStorage.removeItem(SESSION_STORAGE_KEY)
  localStorage.removeItem(USER_STORAGE_KEY)
}

function getStoredUserEmail() {
  return localStorage.getItem(USER_STORAGE_KEY) || ''
}

/** API 호출용 인증 헤더 (세션 토큰) */
function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra }
  const token = getSessionToken()
  if (token) headers['x-session-token'] = token
  return headers
}

function showApp() {
  pinGate.hidden = true
  app.hidden = false
  const email = getStoredUserEmail()
  if (authUserLabel) {
    if (email) {
      authUserLabel.hidden = false
      authUserLabel.textContent = email
    } else {
      authUserLabel.hidden = true
    }
  }
}

function setAuthTab(mode) {
  authMode = mode === 'signup' ? 'signup' : 'login'
  authTabLogin?.classList.toggle('auth-tab--active', authMode === 'login')
  authTabSignup?.classList.toggle('auth-tab--active', authMode === 'signup')
  if (authSubmitButton) authSubmitButton.textContent = authMode === 'signup' ? '회원가입' : '로그인'
  if (authPasswordInput) {
    authPasswordInput.autocomplete = authMode === 'signup' ? 'new-password' : 'current-password'
  }
  if (authInviteWrap) authInviteWrap.hidden = authMode !== 'signup'
  if (pinError) {
    pinError.hidden = true
    pinError.textContent = ''
  }
}

function authErrorMessage(code) {
  const map = {
    invalid_email: '이메일 형식을 확인해 주세요.',
    password_too_short: '비밀번호는 5자 이상이어야 해요.',
    password_too_long: '비밀번호가 너무 길어요.',
    email_already_registered: '이미 가입된 이메일이에요. 로그인해 주세요.',
    invalid_credentials: '이메일 또는 비밀번호가 올바르지 않아요.',
    unauthorized: '로그인이 필요해요.',
    auth_db_not_configured: '회원 DB가 아직 연결되지 않았어요.',
    signup_disabled: '지금은 회원가입을 받지 않아요. 관리자에게 문의해 주세요.',
    invalid_invite_code: '초대 코드가 올바르지 않아요.',
    image_url_not_allowed: '허용되지 않은 이미지 주소예요. 앱에서 생성한 이미지만 사용할 수 있어요.',
  }
  return map[code] || `오류: ${code || 'unknown'}`
}

function showPinGate(message) {
  app.hidden = true
  pinGate.hidden = false
  if (message) {
    pinError.textContent = message
    pinError.hidden = false
  } else {
    pinError.hidden = true
  }
  authEmailInput?.focus()
}

function isLoggedIn() {
  return Boolean(getSessionToken())
}

function clearAllAuth() {
  sessionStorage.removeItem(LEGACY_PIN_STORAGE_KEY)
  clearSessionToken()
}

function readGallery() {
  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeGallery(items) {
  localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(items))
}

function saveToGallery(entry) {
  const items = readGallery()
  items.push(entry)
  writeGallery(items)
  renderGallery()
}

function updateGalleryItemVideo(itemId, videoUrl, youtubeDraft) {
  if (!itemId) return
  const items = readGallery()
  const index = items.findIndex((entry) => entry.id === itemId)
  if (index === -1) return
  items[index] = {
    ...items[index],
    videoUrl,
    youtubeDraft: youtubeDraft || items[index].youtubeDraft || null,
  }
  writeGallery(items)
  renderGallery()
}

function setYoutubeStatus(message, isError) {
  youtubeStatus.hidden = !message
  youtubeStatus.textContent = message || ''
  youtubeStatus.className = isError ? 'form__status form__status--error' : 'form__status'
}

function fillYoutubeDraftFields(draft) {
  currentResult.youtubeDraft = draft
  ytTitleField.value = draft.title
  ytDescriptionField.value = draft.description
}

function syncYoutubeDraftFromFields() {
  if (!currentResult.youtubeDraft) return null
  currentResult.youtubeDraft = {
    ...currentResult.youtubeDraft,
    title: ytTitleField.value.trim() || currentResult.youtubeDraft.title,
    description: ytDescriptionField.value.trim() || currentResult.youtubeDraft.description,
  }
  return currentResult.youtubeDraft
}

function setBgmStatus(message, isError) {
  bgmStatus.hidden = !message
  bgmStatus.textContent = message || ''
  bgmStatus.className = isError ? 'form__status form__status--error' : 'form__status'
}

async function renderBgmSlots() {
  if (!bgmSlotsEl || typeof listBgmSlots !== 'function') return
  const slots = await listBgmSlots()
  bgmSlotsEl.innerHTML = ''
  slots.forEach((slot) => {
    const card = document.createElement('div')
    card.className =
      bgmState.selectedSlotId === slot.id ? 'bgm-slot bgm-slot--selected' : 'bgm-slot'
    card.dataset.slotId = slot.id

    const label = document.createElement('div')
    label.className = 'bgm-slot__label'
    label.textContent = slot.label

    const meta = document.createElement('div')
    meta.className = 'bgm-slot__meta'
    meta.textContent = slot.hasAudio ? slot.fileName : '비어 있음 · Suno 음원 넣기'

    const actions = document.createElement('div')
    actions.className = 'bgm-slot__actions'

    const assignBtn = document.createElement('button')
    assignBtn.type = 'button'
    assignBtn.textContent = slot.hasAudio ? '교체' : '음원 넣기'
    assignBtn.addEventListener('click', async (event) => {
      event.stopPropagation()
      const picker = document.createElement('input')
      picker.type = 'file'
      picker.accept = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg'
      picker.onchange = async () => {
        const file = picker.files?.[0]
        if (!file) return
        try {
          await saveBgmSlot(slot.id, file)
          bgmState.selectedSlotId = slot.id
          bgmState.uploadFile = null
          if (bgmUploadInput) bgmUploadInput.value = ''
          setBgmStatus(`「${slot.label}」 슬롯에 ${file.name}을(를) 넣었어요.`, false)
          await renderBgmSlots()
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          setBgmStatus(
            msg === 'audio_too_large' ? '음원은 20MB 이하만 가능해요.' : `저장 실패: ${msg}`,
            true,
          )
        }
      }
      picker.click()
    })

    const clearBtn = document.createElement('button')
    clearBtn.type = 'button'
    clearBtn.textContent = '비우기'
    clearBtn.disabled = !slot.hasAudio
    clearBtn.addEventListener('click', async (event) => {
      event.stopPropagation()
      await clearBgmSlot(slot.id)
      if (bgmState.selectedSlotId === slot.id) bgmState.selectedSlotId = ''
      setBgmStatus(`「${slot.label}」 슬롯을 비웠어요.`, false)
      await renderBgmSlots()
    })

    actions.appendChild(assignBtn)
    actions.appendChild(clearBtn)
    card.appendChild(label)
    card.appendChild(meta)
    card.appendChild(actions)

    card.addEventListener('click', () => {
      if (!slot.hasAudio) {
        assignBtn.click()
        return
      }
      bgmState.selectedSlotId = slot.id
      bgmState.uploadFile = null
      if (bgmUploadInput) bgmUploadInput.value = ''
      renderBgmSlots()
      setBgmStatus(`「${slot.label}」 음원을 선택했어요. BGM 입히기를 누르세요.`, false)
    })

    bgmSlotsEl.appendChild(card)
  })
}

function showVideoResult(videoUrl, options) {
  const { prompt = currentResult.prompt, motion = '', youtubeDraft = null, asOriginal = true } =
    options || {}
  if (asOriginal) {
    if (currentResult.videoUrl?.startsWith('blob:') && currentResult.videoUrl !== videoUrl) {
      URL.revokeObjectURL(currentResult.videoUrl)
    }
    currentResult.originalVideoUrl = videoUrl
    currentResult.mixedVideoFilename = null
  }
  currentResult.videoUrl = videoUrl
  resultVideo.src = videoUrl

  const draft =
    youtubeDraft ||
    buildYoutubeShortsDraft({
      prompt,
      motion: motion || motionField.value.trim(),
    })
  fillYoutubeDraftFields(draft)

  videoResultSection.hidden = false
  setYoutubeStatus('', false)
  setBgmStatus('', false)
  applyVideoPlaybackRate()
  renderBgmSlots().catch(() => {})
}

function hideVideoResult() {
  if (currentResult.videoUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(currentResult.videoUrl)
  }
  resultVideo.removeAttribute('src')
  currentResult.videoUrl = null
  currentResult.originalVideoUrl = null
  currentResult.mixedVideoFilename = null
  currentResult.youtubeDraft = null
  bgmState.selectedSlotId = ''
  bgmState.uploadFile = null
  if (bgmUploadInput) bgmUploadInput.value = ''
  ytTitleField.value = ''
  ytDescriptionField.value = ''
  setYoutubeStatus('', false)
  setBgmStatus('', false)
  videoResultSection.hidden = true
}

function setFormStatus(message, isError) {
  formStatus.hidden = !message
  formStatus.textContent = message || ''
  formStatus.className = isError ? 'form__status form__status--error' : 'form__status'
}

function setAnimateStatus(message, isError) {
  animateStatus.hidden = !message
  animateStatus.textContent = message || ''
  animateStatus.className = isError ? 'form__status form__status--error' : 'form__status'
}

/** 생성 대기 중 경과 초를 1초마다 갱신해 “작업이 진행 중”임을 보여준다. */
function startProgressTimer(setStatus, baseMessage) {
  const startedAt = Date.now()
  let stopped = false
  const render = () => {
    if (stopped) return
    const seconds = Math.floor((Date.now() - startedAt) / 1000)
    setStatus(`${baseMessage} (${seconds}초 경과)`, false)
  }
  render()
  const timerId = window.setInterval(render, 1000)
  return () => {
    if (stopped) return
    stopped = true
    window.clearInterval(timerId)
  }
}

function setReviseStatus(message, isError) {
  reviseStatus.hidden = !message
  reviseStatus.textContent = message || ''
  reviseStatus.className = isError ? 'form__status form__status--error' : 'form__status'
}

function getSelectedReviseMode() {
  const checked = document.querySelector('input[name="revise-mode"]:checked')
  return checked?.value === 'region' ? 'region' : 'text'
}

function clearAllRegions() {
  regionState.regions = []
  regionState.nextId = 1
  regionState.draft.active = false
  regionState.draft.w = 0
  regionState.draft.h = 0
  redrawRegions()
  updateRegionList()
}

function undoLastRegion() {
  if (!regionState.regions.length) {
    setReviseStatus('취소할 영역이 없어요.', true)
    return
  }
  const removed = regionState.regions.pop()
  redrawRegions()
  updateRegionList()
  setReviseStatus(
    removed ? `${regionState.regions.length + 1}번 영역을 취소했어요.` : '마지막 영역을 취소했어요.',
    false,
  )
}

function findRegionIndexAtPoint(x, y) {
  // 위에 그린(나중) 영역부터 히트 테스트
  for (let i = regionState.regions.length - 1; i >= 0; i -= 1) {
    const r = regionState.regions[i]
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i
  }
  return -1
}

function syncRegionCanvasSize() {
  const width = Math.max(1, Math.round(resultImage.clientWidth || resultImage.getBoundingClientRect().width))
  const height = Math.max(1, Math.round(resultImage.clientHeight || resultImage.getBoundingClientRect().height))
  regionCanvas.style.width = `${width}px`
  regionCanvas.style.height = `${height}px`
  if (regionCanvas.width !== width || regionCanvas.height !== height) {
    regionCanvas.width = width
    regionCanvas.height = height
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function pointerToCanvasPoint(event) {
  const bounds = regionCanvas.getBoundingClientRect()
  const scaleX = regionCanvas.width / Math.max(1, bounds.width)
  const scaleY = regionCanvas.height / Math.max(1, bounds.height)
  const x = clamp((event.clientX - bounds.left) * scaleX, 0, regionCanvas.width)
  const y = clamp((event.clientY - bounds.top) * scaleY, 0, regionCanvas.height)
  return { x, y }
}

function drawOneRegion(ctx, rect, label) {
  if (rect.w < 4 || rect.h < 4) return
  ctx.fillStyle = 'rgba(124, 92, 255, 0.22)'
  ctx.strokeStyle = 'rgba(232, 180, 255, 0.95)'
  ctx.lineWidth = 2
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)

  const badge = String(label)
  const badgeW = 22
  const badgeH = 18
  const bx = rect.x + 4
  const by = rect.y + 4
  ctx.fillStyle = 'rgba(124, 92, 255, 0.95)'
  ctx.fillRect(bx, by, badgeW, badgeH)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 12px sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(badge, bx + badgeW / 2, by + badgeH / 2 + 1)
}

function redrawRegions() {
  syncRegionCanvasSize()
  const ctx = regionCanvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, regionCanvas.width, regionCanvas.height)

  regionState.regions.forEach((region, index) => {
    drawOneRegion(ctx, region, index + 1)
  })

  if (regionState.draft.active || regionState.draft.w >= 4) {
    // 드래그 중 임시 영역은 다음 번호로 미리보기
    drawOneRegion(ctx, regionState.draft, regionState.regions.length + 1)
  }
}

function updateRegionList() {
  if (!regionState.regions.length) {
    regionList.hidden = true
    regionList.textContent = ''
    return
  }
  regionList.hidden = false
  regionList.textContent = regionState.regions
    .map((_, index) => `${index + 1}번 영역`)
    .join(' · ')
}

/** 모든 확정 영역 합집합 → 마스크(흰=수정). 최대변 768 PNG(이진화 유지, JPEG는 마스크를 망가뜨림). */
function buildMaskDataUrlFromRegion() {
  if (!regionState.regions.length) return null
  const natW = resultImage.naturalWidth || regionCanvas.width
  const natH = resultImage.naturalHeight || regionCanvas.height
  const maxSide = 768
  const outScale = Math.min(1, maxSide / Math.max(natW, natH))
  const outW = Math.max(1, Math.round(natW * outScale))
  const outH = Math.max(1, Math.round(natH * outScale))
  const scaleX = outW / regionCanvas.width
  const scaleY = outH / regionCanvas.height

  const mask = document.createElement('canvas')
  mask.width = outW
  mask.height = outH
  const ctx = mask.getContext('2d')
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, outW, outH)
  ctx.fillStyle = '#ffffff'
  for (const region of regionState.regions) {
    ctx.fillRect(
      Math.round(region.x * scaleX),
      Math.round(region.y * scaleY),
      Math.max(1, Math.round(region.w * scaleX)),
      Math.max(1, Math.round(region.h * scaleY)),
    )
  }
  return mask.toDataURL('image/png')
}

/** 수정 결과가 거의 검은 화면(필터 블랭크)인지 검사 */
async function isNearlyBlackImage(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const w = Math.min(64, img.naturalWidth)
        const h = Math.min(64, img.naturalHeight)
        if (!w || !h) {
          resolve(true)
          return
        }
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const { data } = ctx.getImageData(0, 0, w, h)
        let sum = 0
        const n = data.length / 4
        for (let i = 0; i < data.length; i += 4) {
          sum += data[i] + data[i + 1] + data[i + 2]
        }
        resolve(sum / n < 12)
      } catch {
        // CORS 등으로 샘플 불가 → URL만 있으면 통과
        resolve(false)
      }
    }
    img.onerror = () => resolve(true)
    img.src = url
  })
}

function setRegionDrawEnabled(enabled) {
  regionCanvas.hidden = !enabled
  regionHint.hidden = !enabled
  regionToolbar.hidden = !enabled
  resultStage.classList.toggle('result__stage--drawing', enabled)
  resultImage.draggable = false
  if (enabled) {
    const ready = () => {
      syncRegionCanvasSize()
      redrawRegions()
      updateRegionList()
    }
    if (resultImage.complete && resultImage.naturalWidth > 0) {
      ready()
    } else {
      resultImage.addEventListener('load', ready, { once: true })
      requestAnimationFrame(ready)
    }
  } else {
    clearAllRegions()
    regionList.hidden = true
  }
}

/** idle: 수정/다시생성/수용 버튼 · revising: 수정 패널만 */
function setReviewChrome(mode) {
  const revising = mode === 'revising'
  if (reviewActions) reviewActions.hidden = revising
  revisePanel.hidden = !revising
  if (!revising) {
    setRegionDrawEnabled(false)
  } else {
    setRegionDrawEnabled(getSelectedReviseMode() === 'region')
  }
}

function enterReviewMode() {
  currentResult.accepted = false
  reviewBadge.hidden = false
  reviewPanel.hidden = false
  acceptedActions.hidden = true
  animatePanel.hidden = true
  setReviewChrome('idle')
  setReviseStatus('', false)
}

function enterAcceptedMode() {
  currentResult.accepted = true
  reviewBadge.hidden = true
  reviewPanel.hidden = true
  revisePanel.hidden = true
  if (reviewActions) reviewActions.hidden = false
  acceptedActions.hidden = false
  animatePanel.hidden = false
  setRegionDrawEnabled(false)
}

function openRevisePanel() {
  reviewPanel.hidden = false
  setReviewChrome('revising')
  setReviseStatus('수정 요청을 입력한 뒤 「수정 적용」을 누르세요.', false)
}

function closeRevisePanel() {
  setReviewChrome('idle')
  setRegionDrawEnabled(false)
  setReviseStatus('', false)
}

function showResult(imageUrl, engineLabel, fallbackUsed, options) {
  const {
    size = 'portrait',
    itemId = null,
    videoUrl = null,
    prompt = '',
    youtubeDraft = null,
    accepted = false,
    mood = moodField.value,
    engine = '',
  } = options || {}

  resultImage.src = imageUrl
  resultDownload.href = imageUrl
  if (engineLabel) {
    resultEngine.hidden = false
    resultEngine.textContent = engineLabel
    resultEngine.className = fallbackUsed ? 'result__engine result__engine--fallback' : 'result__engine'
  } else {
    resultEngine.hidden = true
  }

  if (currentResult.imageUrl && currentResult.imageUrl !== imageUrl) {
    currentResult.previousImageUrl = currentResult.imageUrl
  }
  currentResult.imageUrl = imageUrl
  currentResult.prompt = prompt || ''
  currentResult.size = size
  currentResult.itemId = itemId
  currentResult.mood = mood
  currentResult.engineLabel = engineLabel || ''
  currentResult.fallbackUsed = Boolean(fallbackUsed)
  currentResult.engine = engine || ''
  setAnimateStatus('', false)
  revisionText.value = ''

  if (videoUrl) {
    showVideoResult(videoUrl, { prompt, youtubeDraft })
  } else {
    hideVideoResult()
  }

  if (accepted) {
    enterAcceptedMode()
  } else {
    enterReviewMode()
  }

  resultSection.hidden = false
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function renderGallery() {
  const items = readGallery()
  galleryGrid.innerHTML = ''
  galleryEmpty.hidden = items.length > 0

  items
    .slice()
    .reverse()
    .forEach((item) => {
      const cell = document.createElement('div')
      cell.className = 'gallery__item'

      const img = document.createElement('img')
      img.src = item.imageUrl
      img.alt = item.description || '생성된 이미지'
      cell.appendChild(img)

      if (item.engineLabel) {
        const engineTag = document.createElement('span')
        engineTag.className = 'gallery__item-engine'
        engineTag.textContent = item.engineLabel.replace(' (보조엔진)', '')
        cell.appendChild(engineTag)
      }

      if (item.videoUrl) {
        const videoTag = document.createElement('span')
        videoTag.className = 'gallery__item-video'
        videoTag.textContent = '영상있음'
        cell.appendChild(videoTag)
      }

      const deleteButton = document.createElement('button')
      deleteButton.type = 'button'
      deleteButton.className = 'gallery__item-delete'
      deleteButton.textContent = '삭제'
      deleteButton.addEventListener('click', (event) => {
        event.stopPropagation()
        const remaining = readGallery().filter((entry) => entry.id !== item.id)
        writeGallery(remaining)
        renderGallery()
      })
      cell.appendChild(deleteButton)

      const shortsButton = document.createElement('button')
      shortsButton.type = 'button'
      shortsButton.className = 'gallery__item-shorts'
      shortsButton.textContent = item.videoUrl ? 'YouTube 올리기' : '쇼츠 비디오 만들기'
      shortsButton.addEventListener('click', (event) => {
        event.stopPropagation()
        const prompt = item.description || item.prompt || ''
        showResult(item.imageUrl, item.engineLabel, item.fallbackUsed, {
          size: item.size,
          itemId: item.id,
          videoUrl: item.videoUrl,
          prompt,
          youtubeDraft: item.youtubeDraft || null,
          accepted: true,
          mood: item.mood,
          engine: item.engine,
        })
        if (!item.videoUrl) {
          requestAnimate()
        }
      })
      cell.appendChild(shortsButton)

      cell.addEventListener('click', (event) => {
        if (event.target === deleteButton || event.target === shortsButton) return
        showResult(item.imageUrl, item.engineLabel, item.fallbackUsed, {
          size: item.size,
          itemId: item.id,
          videoUrl: item.videoUrl,
          prompt: item.description || item.prompt || '',
          youtubeDraft: item.youtubeDraft || null,
          accepted: true,
          mood: item.mood,
          engine: item.engine,
        })
      })

      galleryGrid.appendChild(cell)
    })
}

async function attemptGenerate(payload) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  const rawText = await response.text()
  let data = {}
  try {
    data = rawText ? JSON.parse(rawText) : {}
  } catch {
    data = {}
  }
  return { response, data, rawText }
}

/** 후속 칸(형용사·목적어·보어)만 드롭다운 + 직접입력 */
const GUIDE_DROPDOWN_IDS = ['guide-state', 'guide-object', 'guide-complement']

function guideCustomEl(selectId) {
  return document.getElementById(`${selectId}-custom`)
}

function getGuideDropdownValue(selectEl) {
  if (!selectEl) return ''
  const v = (selectEl.value || '').trim()
  if (!v) return ''
  if (v === '__custom__') {
    return (guideCustomEl(selectEl.id)?.value || '').trim()
  }
  return v
}

function syncGuideCustomVisibility(selectEl) {
  const custom = guideCustomEl(selectEl?.id)
  if (!custom) return
  const show = selectEl.value === '__custom__'
  custom.hidden = !show
  if (show) custom.focus()
}

function setGuideDropdownValue(selectId, text) {
  const selectEl = document.getElementById(selectId)
  const custom = guideCustomEl(selectId)
  if (!selectEl) return
  const value = (text || '').trim()
  if (!value) {
    selectEl.value = ''
    syncGuideCustomVisibility(selectEl)
    return
  }
  const match = [...selectEl.options].find((o) => o.value === value)
  if (match) {
    selectEl.value = value
  } else {
    selectEl.value = '__custom__'
    if (custom) custom.value = value
  }
  syncGuideCustomVisibility(selectEl)
  selectEl.dispatchEvent(new Event('change', { bubbles: true }))
}

function syncGuideDetailVisibility() {
  if (!guideDetail) return
  const who = (guideWhoField?.value || '').trim()
  guideDetail.hidden = !who
}

/** 목적어 칸이 이유·절·부사면 조사「를」을 붙이지 않음 */
function formatGuideObject(object) {
  const o = (object || '').trim()
  if (!o) return ''
  if (/[을를]$/.test(o)) return o
  if (
    /(으로|로|서|해서|고파서|싶어서|때문에|도록|며|거나|게|히)$/.test(o) ||
    o.length > 12 ||
    /싶|고프|배고|차림/.test(o)
  ) {
    return o
  }
  return `${o}를`
}

/** 컨셉·수정 요청용: 커서 잔여(|)·깨진 띄어쓰기·흔한 오타 정리 */
function polishConceptText(text) {
  let t = String(text || '')
  if (!t) return ''
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, '')
  t = t.replace(/[|/\\]+/g, '')
  t = t.replace(/\s+/g, ' ').trim()
  // 비스듬하 게 → 비스듬하게
  t = t.replace(/([가-힣])\s+(게|히)(?=\s|$|[가-힣.,!?…·])/g, '$1$2')
  t = t.replace(/([가-힣])\s+(이|가|을|를|은|는|와|과|도|만|로|으로)(?=\s|$|[.,!?…·])/g, '$1$2')
  // 잇다 → 있다, 수정하래 → 수정해줘
  t = t.replace(/하고\s*잇다/g, '하고 있다')
  t = t.replace(/되어\s*잇다/g, '되어 있다')
  t = t.replace(/([가-힣])잇다/g, '$1있다')
  t = t.replace(/수정하래/g, '수정해줘')
  t = t.replace(/([가-힣])하래(?=\s|$|[.!?…])/g, '$1해줘')
  t = t.replace(/되엇/g, '되었')
  t = t.replace(/햇다/g, '했다')
  t = t.replace(/촉옷/g, '속옷')
  t = t.replace(/않자/g, '앉아')
  t = t.replace(/위애/g, '위에')
  return t.replace(/\s+/g, ' ').trim()
}

/** 주부·술부·형용사·목적어·보어만으로 문장 조합 */
function composeGuideSentence() {
  const who = (guideWhoField?.value || '').trim()
  const state = getGuideDropdownValue(guideStateField)
  const action = (guideActionField?.value || '').trim()
  const object = getGuideDropdownValue(guideObjectField)
  const complement = getGuideDropdownValue(guideComplementField)

  if (!who && !action && !state && !object && !complement) return ''

  let subject = [state, who].filter(Boolean).join(' ').trim()
  if (subject && who && !/[이가은는]$/.test(subject) && !/[이가은는]$/.test(who)) {
    subject = `${subject}가`
  }

  const parts = [formatGuideObject(object), complement, action].filter(Boolean)
  const predicate = parts.join(' ').replace(/\s+/g, ' ').trim()

  let sentence = ''
  if (subject && predicate) {
    sentence = `${subject} ${predicate}`
  } else {
    sentence = subject || predicate || ''
  }
  return polishConceptText(sentence)
}

/** 설명칸을 직접 고친 뒤에만 true. 가이드가 다시 바뀌면 무조건 해제·반영 */
let guideDescLocked = false
let lastSyncedGuideDesc = ''
let syncingDescriptionFromGuide = false

/** 가이드 → 캐릭터/컨셉 설명 실시간 반영. force면 잠금 무시 */
function syncDescriptionFromGuide(force = false) {
  if (!descriptionField) return
  const sentence = composeGuideSentence()
  if (!force && guideDescLocked) {
    // 설명칸이 비어 있으면 잠금 해제하고 다시 연동
    if ((descriptionField.value || '').trim()) return
    guideDescLocked = false
  }
  if (force) guideDescLocked = false
  syncingDescriptionFromGuide = true
  descriptionField.value = sentence
  lastSyncedGuideDesc = sentence
  syncingDescriptionFromGuide = false
}

function onDescriptionManualInput() {
  if (!descriptionField || syncingDescriptionFromGuide) return
  const current = (descriptionField.value || '').trim()
  const guide = composeGuideSentence()
  if (!current) {
    guideDescLocked = false
    lastSyncedGuideDesc = ''
    syncDescriptionFromGuide(true)
    return
  }
  if (current === guide || current === lastSyncedGuideDesc) {
    guideDescLocked = false
    lastSyncedGuideDesc = current
    return
  }
  guideDescLocked = true
}

/** 설명칸 우선. 비어 있으면 가이드 문장. (생성 시에도 오타 정리) */
function composeDescription() {
  const main = polishConceptText(descriptionField?.value || '')
  if (main) return main
  return composeGuideSentence()
}

function guideContextBlob() {
  return [
    `주부:${(guideWhoField?.value || '').trim() || '-'}`,
    `술부:${(guideActionField?.value || '').trim() || '-'}`,
    `형용사:${getGuideDropdownValue(guideStateField) || '-'}`,
    `목적어:${getGuideDropdownValue(guideObjectField) || '-'}`,
    `보어:${getGuideDropdownValue(guideComplementField) || '-'}`,
    `설명:${(descriptionField?.value || '').trim() || '-'}`,
  ].join('\n')
}

function onGuideFieldsChanged() {
  syncGuideDetailVisibility()
  // 가이드가 바뀌면 컨셉 설명에 즉시·강제 반영
  syncDescriptionFromGuide(true)
  scheduleScenePreview()
}

;[guideWhoField, guideActionField].forEach((el) => {
  el?.addEventListener('input', onGuideFieldsChanged)
  el?.addEventListener('change', onGuideFieldsChanged)
  el?.addEventListener('keyup', onGuideFieldsChanged)
})

GUIDE_DROPDOWN_IDS.forEach((id) => {
  const selectEl = document.getElementById(id)
  selectEl?.addEventListener('change', () => {
    syncGuideCustomVisibility(selectEl)
    onGuideFieldsChanged()
  })
  const custom = guideCustomEl(id)
  custom?.addEventListener('input', onGuideFieldsChanged)
  custom?.addEventListener('keyup', onGuideFieldsChanged)
  custom?.addEventListener('change', onGuideFieldsChanged)
})
syncGuideDetailVisibility()
syncDescriptionFromGuide(true)

function formatScenePreview(data) {
  if (!data?.ok || !data.scene) return ''
  const s = data.scene
  const bits = []
  if (s.subjects?.length) bits.push(s.subjects.join('+'))
  if (s.traits?.length) bits.push(s.traits.slice(0, 1).join(', '))
  if (s.states?.length) bits.push(s.states.slice(0, 2).join(', '))
  if (s.actions?.length) bits.push(s.actions.slice(0, 2).join(', '))
  if (data.props?.length) bits.push(data.props.slice(0, 1).join(', '))
  if (data.setting) bits.push(data.setting)
  bits.push(data.wildlife ? '실제동물' : s.anthro ? '반인반수' : '장면')
  return `<strong>생성 전 장면 읽기</strong> · ${bits.join(' · ')}`
}

async function refreshScenePreview() {
  if (!scenePreviewEl || getGenMode() !== 'free' || !isLoggedIn()) {
    if (scenePreviewEl) scenePreviewEl.hidden = true
    return
  }
  const description = composeDescription()
  if (!description || description.length < 4) {
    scenePreviewEl.hidden = true
    return
  }
  const seq = ++scenePreviewSeq
  try {
    const response = await fetch('/api/scene-preview', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ description, size: sizeField?.value }),
    })
    const data = await response.json().catch(() => ({}))
    if (seq !== scenePreviewSeq) return
    if (!response.ok || !data.ok) {
      scenePreviewEl.hidden = true
      return
    }
    scenePreviewEl.innerHTML = formatScenePreview(data)
    scenePreviewEl.hidden = false
  } catch {
    if (seq === scenePreviewSeq) scenePreviewEl.hidden = true
  }
}

function scheduleScenePreview() {
  if (scenePreviewTimer) clearTimeout(scenePreviewTimer)
  scenePreviewTimer = setTimeout(() => {
    refreshScenePreview()
  }, 450)
}

descriptionField?.addEventListener('input', () => {
  onDescriptionManualInput()
  scheduleScenePreview()
})
descriptionField?.addEventListener('change', scheduleScenePreview)
document.querySelectorAll('input[name="gen-mode"]').forEach((el) => {
  el.addEventListener('change', scheduleScenePreview)
})
sizeField?.addEventListener('change', scheduleScenePreview)

async function requestAiAssist(field, text, context, phase = 'fill', advice = '') {
  const response = await fetch('/api/assist', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      field,
      text,
      context,
      mode: getGenMode(),
      phase,
      ...(phase === 'fill' && advice ? { advice } : {}),
    }),
  })
  const data = await response.json().catch(() => ({}))
  return { response, data }
}

function ensureAiAdviceChip(btn) {
  const head = btn.closest('.field-head')
  if (!head) return null

  let chip = head.nextElementSibling
  if (!chip?.classList?.contains('ai-advice')) {
    chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'ai-advice'
    chip.hidden = true
    chip.innerHTML =
      '<span class="ai-advice__label">조언 · 클릭하면 AI가 채워 줌</span><span class="ai-advice__text"></span>'
    head.insertAdjacentElement('afterend', chip)
  }
  return chip
}

function applyAssistText(targetId, target, text) {
  if (GUIDE_DROPDOWN_IDS.includes(targetId)) {
    setGuideDropdownValue(targetId, text)
    onGuideFieldsChanged()
  } else if (targetId === 'guide-who' || targetId === 'guide-action') {
    target.value = text
    onGuideFieldsChanged()
  } else {
    if (targetId === 'description') {
      guideDescLocked = true
    }
    target.value = text
    target.dispatchEvent(new Event('input', { bubbles: true }))
  }
  syncGuideDetailVisibility()
  // 사용자가 바로 고칠 수 있게 포커스
  if (GUIDE_DROPDOWN_IDS.includes(targetId)) {
    const custom = guideCustomEl(targetId)
    if (custom && !custom.hidden) custom.focus()
    else target.focus?.()
  } else {
    target.focus?.()
  }
}

function statusForFilledField(field) {
  if (field === 'revision') {
    setReviseStatus('AI가 채웠어요. 글을 고친 뒤 「수정 적용」을 눌러 주세요.', false)
  } else if (field === 'motion') {
    setAnimateStatus('AI가 채웠어요. 글을 고친 뒤 쇼츠 생성을 눌러 주세요.', false)
  } else {
    setFormStatus('AI가 채웠어요. 글을 고친 뒤 「이미지 생성」을 눌러 주세요.', false)
  }
}

document.querySelectorAll('.ai-help-btn').forEach((btn) => {
  const chip = ensureAiAdviceChip(btn)

  btn.addEventListener('click', async () => {
    if (!isLoggedIn()) {
      showPinGate('로그인이 필요해요.')
      return
    }

    const field = btn.getAttribute('data-ai-field') || 'description'
    const targetId = btn.getAttribute('data-ai-target')
    const target = targetId ? document.getElementById(targetId) : null
    if (!target || !chip) return

    btn.disabled = true
    const prevLabel = btn.textContent
    btn.textContent = '조언 준비 중…'

    try {
      const currentText = GUIDE_DROPDOWN_IDS.includes(targetId)
        ? getGuideDropdownValue(target)
        : target.value || ''
      const { response, data } = await requestAiAssist(
        field,
        currentText,
        guideContextBlob(),
        'advice',
      )
      if (response.status === 401) {
        clearAllAuth()
        showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
        return
      }
      if (!data.ok || !data.text) {
        setFormStatus(data.message || '조언을 불러오지 못했어요.', true)
        return
      }

      const textEl = chip.querySelector('.ai-advice__text')
      if (textEl) textEl.textContent = data.text
      chip.dataset.field = field
      chip.dataset.targetId = targetId
      chip.dataset.advice = data.text
      chip.hidden = false
      chip.focus()
      setFormStatus('조언이 떴어요. 조언을 클릭하면 AI가 맥락을 보고 채워 줍니다.', false)
    } catch {
      setFormStatus('AI 도움 요청 중 오류가 났어요.', true)
    } finally {
      btn.disabled = false
      btn.textContent = prevLabel || 'AI 도움 받기'
    }
  })

  chip?.addEventListener('click', async () => {
    if (!isLoggedIn()) {
      showPinGate('로그인이 필요해요.')
      return
    }

    const field = chip.dataset.field || btn.getAttribute('data-ai-field') || 'description'
    const targetId = chip.dataset.targetId || btn.getAttribute('data-ai-target')
    const target = targetId ? document.getElementById(targetId) : null
    if (!target) return

    chip.disabled = true
    btn.disabled = true
    const textEl = chip.querySelector('.ai-advice__text')
    const adviceKeep = (chip.dataset.advice || textEl?.textContent || '').trim()
    if (textEl) textEl.textContent = '맥락·조언을 보고 작성 중…'

    try {
      const currentText = GUIDE_DROPDOWN_IDS.includes(targetId)
        ? getGuideDropdownValue(target)
        : target.value || ''
      const { response, data } = await requestAiAssist(
        field,
        currentText,
        guideContextBlob(),
        'fill',
        adviceKeep,
      )
      if (response.status === 401) {
        clearAllAuth()
        showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
        return
      }
      if (!data.ok || !data.text) {
        setFormStatus(data.message || 'AI 작성에 실패했어요. 다시 시도해 주세요.', true)
        if (textEl) textEl.textContent = adviceKeep
        return
      }

      applyAssistText(targetId, target, data.text)
      if (textEl) textEl.textContent = adviceKeep
      chip.hidden = true
      statusForFilledField(field)
    } catch {
      setFormStatus('AI 작성 중 오류가 났어요.', true)
      if (textEl) textEl.textContent = adviceKeep
    } finally {
      chip.disabled = false
      btn.disabled = false
    }
  })
})

/**
 * 백엔드 /api/animate 호출.
 * 이미지 원본 URL + 원본 프롬프트(description)를 전달하고,
 * 성공 시 갤러리(localStorage)의 해당 항목에 videoUrl을 매핑한다.
 */
async function requestAnimate() {
  if (!currentResult.imageUrl) return

  if (!isLoggedIn()) {
    showPinGate('로그인이 필요해요.')
    return
  }

  animateButton.disabled = true
  hideVideoResult()

  const motionBase = (motionField?.value || '').trim()
  const fromMotion = motionBase.match(/(\d+)\s*초/)
  let durationSec = getSelectedVideoDuration()
  if (fromMotion) {
    const n = Number(fromMotion[1])
    if (n <= 8) durationSec = 8
    else if (n <= 10) durationSec = 10
    else if (n <= 12) durationSec = 12
    else durationSec = 15
    setSelectedVideoDuration(durationSec)
  }
  const speedKey = getSelectedVideoSpeed()
  const speedHint = VIDEO_MOTION_HINTS[speedKey] || ''
  const motion = [motionBase, speedHint].filter(Boolean).join('. ')
  const speedLabel = speedKey === 'slow' ? '느리게' : speedKey === 'fast' ? '빠르게' : '보통'
  const stopTimer = startProgressTimer(
    setAnimateStatus,
    `쇼츠 영상(약 ${durationSec}초 · ${speedLabel})을 만들고 있어요… 잠시만 기다려 주세요`,
  )

  try {
    const response = await fetch('/api/animate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        imageUrl: currentResult.imageUrl,
        prompt: currentResult.prompt,
        motion,
        size: currentResult.size,
        durationSec,
      }),
    })
    const data = await response.json().catch(() => ({}))

    stopTimer()

    if (response.status === 401) {
      clearAllAuth()
      showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
      return
    }

    if (response.status === 422) {
      setAnimateStatus(
        '정책에 의해 차단된 표현이 포함되어 있어요. 미성년·강간·실존인물 묘사는 사용할 수 없어요.',
        true,
      )
      return
    }

    if (!data.ok) {
      setAnimateStatus(`영상 생성에 실패했어요: ${data.message || data.error || '알 수 없는 오류'}`, true)
      return
    }

    const draft = buildYoutubeShortsDraft({
      prompt: currentResult.prompt,
      motion: motionBase,
    })
    showVideoResult(data.videoUrl, {
      prompt: currentResult.prompt,
      motion: motionBase,
      youtubeDraft: draft,
    })
    updateGalleryItemVideo(currentResult.itemId, data.videoUrl, draft)
    const dur = data.durationSec || durationSec
    setAnimateStatus(`쇼츠 영상 제작 완료(약 ${dur}초 · ${speedLabel})!`, false)
  } catch (error) {
    stopTimer()
    setAnimateStatus(`네트워크 오류: ${error instanceof Error ? error.message : String(error)}`, true)
  } finally {
    stopTimer()
    animateButton.disabled = false
  }
}

async function handleYoutubeDownload() {
  if (!currentResult.videoUrl) return
  const draft = syncYoutubeDraftFromFields()
  const filename =
    currentResult.mixedVideoFilename ||
    draft?.filename ||
    (currentResult.videoUrl.startsWith('blob:') ? 'fashion-shorts.webm' : 'fashion-shorts.mp4')
  setYoutubeStatus('영상을 받는 중…', false)
  try {
    await downloadVideoFile(currentResult.videoUrl, filename)
    setYoutubeStatus('영상 다운로드 완료. 이어서 제목·설명을 복사하세요.', false)
  } catch (error) {
    // CORS 등으로 blob 다운로드가 막히면 새 탭으로 폴백
    window.open(currentResult.videoUrl, '_blank', 'noopener,noreferrer')
    setYoutubeStatus('새 탭에서 영상을 열었어요. 저장한 뒤 업로드하세요.', false)
  }
}

async function handleYoutubeCopy() {
  const draft = syncYoutubeDraftFromFields()
  if (!draft) return
  const payload = `${draft.title}\n\n${draft.description}`
  try {
    await copyTextToClipboard(payload)
    setYoutubeStatus('제목·설명을 클립보드에 복사했어요. YouTube에 붙여넣으세요.', false)
  } catch {
    setYoutubeStatus('복사에 실패했어요. 아래 제목·설명을 직접 선택해 복사해 주세요.', true)
  }
}

function handleYoutubeOpen() {
  openYoutubeUpload()
  setYoutubeStatus('YouTube 업로드 창을 열었어요. 받은 영상과 복사한 제목·설명을 붙여넣으세요.', false)
}

async function handleYoutubePrepareAll() {
  if (!currentResult.videoUrl) return
  await handleYoutubeDownload()
  await handleYoutubeCopy()
  handleYoutubeOpen()
  setYoutubeStatus(
    '준비 완료: 영상 받기 → 제목·설명 복사 → YouTube 열기. 업로드 창에서 붙여넣기만 하면 됩니다.',
    false,
  )
}

authTabLogin?.addEventListener('click', () => setAuthTab('login'))
authTabSignup?.addEventListener('click', () => setAuthTab('signup'))

authSubmitButton?.addEventListener('click', async () => {
  const email = (authEmailInput?.value || '').trim()
  const password = authPasswordInput?.value || ''
  if (!email || !password) {
    pinError.textContent = '이메일과 비밀번호를 입력해 주세요.'
    pinError.hidden = false
    return
  }

  const inviteCode = (authInviteInput?.value || '').trim()
  if (authMode === 'signup' && !inviteCode) {
    pinError.textContent = '회원가입에는 초대 코드가 필요해요.'
    pinError.hidden = false
    return
  }

  authSubmitButton.disabled = true
  pinError.hidden = true
  const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login'

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        authMode === 'signup' ? { email, password, inviteCode } : { email, password },
      ),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.ok || !data.token) {
      pinError.textContent = authErrorMessage(data.error)
      pinError.hidden = false
      return
    }
    clearAllAuth()
    setSessionToken(data.token, data.user?.email || email)
    if (authPasswordInput) authPasswordInput.value = ''
    if (authInviteInput) authInviteInput.value = ''
    showApp()
  } catch {
    pinError.textContent = '네트워크 오류가 났어요. 잠시 후 다시 시도해 주세요.'
    pinError.hidden = false
  } finally {
    authSubmitButton.disabled = false
  }
})

authPasswordInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') authSubmitButton?.click()
})

logoutButton.addEventListener('click', async () => {
  const token = getSessionToken()
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: authHeaders(),
      })
    } catch {
      /* ignore */
    }
  }
  clearAllAuth()
  showPinGate()
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const description = composeDescription()
  if (!description) {
    setFormStatus('설명 또는 가이드(누구/어떤/뭐 하는) 중 하나 이상 입력해 주세요. 또는 「AI 도움 받기」를 눌러 보세요.', true)
    return
  }
  // 가이드만 채운 경우 설명칸에도 반영해 이후 수정·갤러리 연속성이 좋게
  if (!(descriptionField.value || '').trim()) {
    descriptionField.value = description
  }

  if (!isLoggedIn()) {
    showPinGate('로그인이 필요해요.')
    return
  }

  generateButton.disabled = true
  const stopTimer = startProgressTimer(
    setFormStatus,
    '이미지를 생성하고 있어요… 잠시만 기다려 주세요',
  )

  try {
    const { response, data, rawText } = await attemptGenerate({
      description,
      mood: moodField.value,
      size: sizeField.value,
      mode: getGenMode(),
    })

    stopTimer()

    if (response.status === 401) {
      clearAllAuth()
      showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
      return
    }

    if (response.status === 429) {
      setFormStatus(data.message || '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.', true)
      return
    }

    if (response.status === 422) {
      if (data.error === 'provider_content_blocked') {
        setFormStatus(
          data.message ||
            '이미지 엔진이 이 장면을 거절했습니다. 표현을 조금 바꿔 다시 시도해 주세요.',
          true,
        )
        return
      }
      const reason = data.blockedReason || ''
      const msg =
        reason === 'blocked-minor-reference'
          ? '미성년(아이·로리·쇼타 등) 관련 묘사는 성인 놀이터에서 사용할 수 없어요.'
          : reason === 'blocked-non-consensual'
            ? '강간·비동의 표현은 사용할 수 없어요.'
            : reason === 'blocked-real-person'
              ? '실존 인물·연예인 딥페이크 요청은 사용할 수 없어요.'
              : '정책에 의해 차단됐어요. (미성년·강간·실존인물)'
      setFormStatus(msg, true)
      return
    }

    if (!data.ok) {
      const attemptSummary = Array.isArray(data.attempts)
        ? data.attempts.map((a) => `${a.engine}: ${a.error}`).join(' / ')
        : ''
      const gatewayHint =
        !data.error &&
        !data.message &&
        (response.status >= 502 || /bad gateway|<!DOCTYPE/i.test(rawText || ''))
          ? `서버 게이트웨이 오류(${response.status}). 잠시 후 다시 시도해 주세요.`
          : ''
      setFormStatus(
        `생성에 실패했어요: ${data.message || data.error || gatewayHint || '알 수 없는 오류'}${attemptSummary ? ` (${attemptSummary})` : ''}`,
        true,
      )
      return
    }

    showResult(data.imageUrl, data.engineLabel, data.fallbackUsed, {
      size: sizeField.value,
      itemId: null,
      prompt: description,
      accepted: false,
      mood: moodField.value,
      engine: data.engine,
    })
    const sceneHint =
      data.scene && Array.isArray(data.scene.subjects) && data.scene.subjects.length
        ? ` · 장면(${data.scene.source}/${data.scene.form || '?'}): ${data.scene.subjects.join('+')}${
            data.scene.traits?.length ? ` · ${data.scene.traits.slice(0, 1).join(', ')}` : ''
          }${data.scene.states?.length ? ` · ${data.scene.states.slice(0, 2).join(', ')}` : ''}${
            data.scene.actions?.length ? ` · ${data.scene.actions.slice(0, 2).join(', ')}` : ''
          }${data.scene.props?.length ? ` · ${data.scene.props.slice(0, 1).join(', ')}` : ''}${
            data.scene.setting ? ` · ${data.scene.setting}` : ''
          }${
            data.scene.anthro
              ? ' · 반인반수'
              : data.scene.subjects?.some((s) =>
                    /fox|lion|tiger|cat|dog|monkey|donkey|bear|wolf|rabbit|horse|animal/i.test(s),
                  )
                ? ' · 실제동물'
                : ''
          }`
        : ''
    setFormStatus(
      data.fallbackUsed
        ? `생성 완료! 결과를 검토한 뒤 수용/수정/다시 생성을 선택하세요. (보조엔진)${sceneHint}`
        : `생성 완료! 결과를 검토한 뒤 수용/수정/다시 생성을 선택하세요.${sceneHint}`,
      false,
    )
  } catch (error) {
    stopTimer()
    setFormStatus(`네트워크 오류: ${error instanceof Error ? error.message : String(error)}`, true)
  } finally {
    stopTimer()
    generateButton.disabled = false
  }
})

acceptButton.addEventListener('click', () => {
  if (!currentResult.imageUrl) return
  const itemId = currentResult.itemId || crypto.randomUUID()
  currentResult.itemId = itemId
  const existing = readGallery().some((entry) => entry.id === itemId)
  if (!existing) {
    saveToGallery({
      id: itemId,
      imageUrl: currentResult.imageUrl,
      description: currentResult.prompt,
      prompt: currentResult.prompt,
      mood: currentResult.mood,
      size: currentResult.size,
      engine: currentResult.engine,
      engineLabel: currentResult.engineLabel,
      fallbackUsed: currentResult.fallbackUsed,
      videoUrl: null,
      createdAt: new Date().toISOString(),
    })
  } else {
    const items = readGallery()
    const index = items.findIndex((entry) => entry.id === itemId)
    if (index !== -1) {
      items[index] = { ...items[index], imageUrl: currentResult.imageUrl }
      writeGallery(items)
      renderGallery()
    }
  }
  enterAcceptedMode()
  setFormStatus('수용했어요. 갤러리에 저장됐고, 쇼츠 영상도 만들 수 있어요.', false)
})

reviseToggleButton.addEventListener('click', () => {
  openRevisePanel()
  revisePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})

reviseAgainButton.addEventListener('click', () => {
  openRevisePanel()
  revisePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})

reviseCancelButton.addEventListener('click', () => {
  closeRevisePanel()
})

rejectButton.addEventListener('click', () => {
  if (!window.confirm('현재 결과를 버리고 같은 설명으로 다시 생성할까요?')) return
  form.requestSubmit()
})

document.querySelectorAll('input[name="revise-mode"]').forEach((input) => {
  input.addEventListener('change', () => {
    if (!revisePanel.hidden) {
      setRegionDrawEnabled(getSelectedReviseMode() === 'region')
    }
  })
})

// 이미지 통째로 잡히는 브라우저 기본 드래그 차단
resultImage.addEventListener('dragstart', (event) => {
  event.preventDefault()
})

regionCanvas.addEventListener('pointerdown', (event) => {
  if (regionCanvas.hidden) return
  event.preventDefault()
  event.stopPropagation()
  syncRegionCanvasSize()
  const point = pointerToCanvasPoint(event)

  // 기존 번호 박스를 짧게 클릭하면 해당 영역만 삭제
  const hitIndex = findRegionIndexAtPoint(point.x, point.y)
  regionState._hitIndexOnDown = hitIndex
  regionState._downX = point.x
  regionState._downY = point.y

  regionState.draft.active = true
  regionState.draft.startX = point.x
  regionState.draft.startY = point.y
  regionState.draft.x = point.x
  regionState.draft.y = point.y
  regionState.draft.w = 0
  regionState.draft.h = 0
  regionCanvas.setPointerCapture(event.pointerId)
  redrawRegions()
})

regionCanvas.addEventListener('pointermove', (event) => {
  if (!regionState.draft.active) return
  event.preventDefault()
  const point = pointerToCanvasPoint(event)
  regionState.draft.x = Math.min(regionState.draft.startX, point.x)
  regionState.draft.y = Math.min(regionState.draft.startY, point.y)
  regionState.draft.w = Math.abs(point.x - regionState.draft.startX)
  regionState.draft.h = Math.abs(point.y - regionState.draft.startY)
  redrawRegions()
})

regionCanvas.addEventListener('pointerup', (event) => {
  if (!regionState.draft.active) return
  event.preventDefault()
  regionState.draft.active = false
  try {
    regionCanvas.releasePointerCapture(event.pointerId)
  } catch {
    /* ignore */
  }

  const moved =
    Math.abs(regionState.draft.w) < 8 &&
    Math.abs(regionState.draft.h) < 8 &&
    typeof regionState._hitIndexOnDown === 'number' &&
    regionState._hitIndexOnDown >= 0

  // 거의 움직이지 않은 클릭 = 해당 번호 영역 삭제
  if (moved) {
    const removedOrder = regionState._hitIndexOnDown + 1
    regionState.regions.splice(regionState._hitIndexOnDown, 1)
    regionState.draft.w = 0
    regionState.draft.h = 0
    redrawRegions()
    updateRegionList()
    setReviseStatus(`${removedOrder}번 영역을 삭제했어요.`, false)
    regionState._hitIndexOnDown = -1
    return
  }

  // 충분히 큰 사각형만 확정 영역으로 추가 (기존 영역 유지)
  if (regionState.draft.w >= 12 && regionState.draft.h >= 12) {
    regionState.regions.push({
      id: regionState.nextId,
      x: regionState.draft.x,
      y: regionState.draft.y,
      w: regionState.draft.w,
      h: regionState.draft.h,
    })
    regionState.nextId += 1
    setReviseStatus(
      `${regionState.regions.length}번 영역까지 지정됐어요. 잘못됐으면 「마지막 영역 취소」를 누르세요.`,
      false,
    )
  }
  regionState.draft.w = 0
  regionState.draft.h = 0
  regionState._hitIndexOnDown = -1
  redrawRegions()
  updateRegionList()
})

regionCanvas.addEventListener('pointercancel', () => {
  regionState.draft.active = false
  regionState.draft.w = 0
  regionState.draft.h = 0
  redrawRegions()
})

regionUndoButton.addEventListener('click', () => {
  undoLastRegion()
})

regionClearButton.addEventListener('click', () => {
  clearAllRegions()
  setReviseStatus('모든 선택 영역을 지웠어요. 다시 드래그해 주세요.', false)
})

reviseApplyButton.addEventListener('click', async () => {
  if (!currentResult.imageUrl) return
  const revision = polishConceptText(revisionText.value || '')
  if (revision && revision !== (revisionText.value || '').trim()) {
    revisionText.value = revision
  }
  if (!revision) {
    setReviseStatus('수정 요청을 입력해 주세요.', true)
    return
  }

  const mode = getSelectedReviseMode()
  let maskDataUrl = null
  if (mode === 'region') {
    maskDataUrl = buildMaskDataUrlFromRegion()
    if (!maskDataUrl) {
      setReviseStatus('수정할 사각형 영역을 하나 이상 드래그해서 지정해 주세요.', true)
      return
    }
  }

  if (!isLoggedIn()) {
    showPinGate('로그인이 필요해요.')
    return
  }

  reviseApplyButton.disabled = true
  const stopTimer = startProgressTimer(setReviseStatus, '수정하고 있어요… 잠시만 기다려 주세요')

  try {
    const response = await fetch('/api/refine', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        mode,
        genMode: getGenMode(),
        imageUrl: currentResult.imageUrl,
        baseDescription: currentResult.prompt,
        revision,
        maskDataUrl,
        mood: currentResult.mood,
        size: currentResult.size,
        regionCount: regionState.regions.length,
      }),
    })
    const rawText = await response.text()
    let data = {}
    try {
      data = rawText ? JSON.parse(rawText) : {}
    } catch {
      data = {}
    }
    stopTimer()

    if (response.status === 401) {
      clearAllAuth()
      showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
      return
    }
    if (response.status === 422) {
      setReviseStatus('내부 정책에 의해 차단된 수정 요청이에요.', true)
      return
    }
    if (!data.ok) {
      const attemptSummary = Array.isArray(data.attempts)
        ? data.attempts.map((a) => `${a.engine}: ${a.error}`).join(' / ')
        : ''
      const gatewayHint =
        !data.error &&
        !data.message &&
        (response.status >= 502 || /bad gateway|<!DOCTYPE/i.test(rawText))
          ? `서버 게이트웨이 오류(${response.status}). 잠시 후 다시 시도해 주세요.`
          : ''
      setReviseStatus(
        `수정 실패: ${data.message || data.error || gatewayHint || '알 수 없는 오류'}${attemptSummary ? ` (${attemptSummary})` : ''}`,
        true,
      )
      return
    }

    const keptMode = mode
    const priorUrl = currentResult.imageUrl
    const blank = await isNearlyBlackImage(data.imageUrl)
    if (blank) {
      setReviseStatus(
        '수정 엔진이 빈(검은) 이미지를 반환했어요. 원본을 유지합니다. 영역을 하나씩 나눠 적용하거나 텍스트 수정을 시도해 주세요.',
        true,
      )
      if (priorUrl) {
        showResult(priorUrl, currentResult.engineLabel, currentResult.fallbackUsed, {
          size: currentResult.size,
          itemId: currentResult.itemId,
          prompt: currentResult.prompt,
          accepted: false,
          mood: currentResult.mood,
          engine: currentResult.engine,
        })
        setReviewChrome('revising')
        if (keptMode === 'region') {
          const regionRadio = document.querySelector('input[name="revise-mode"][value="region"]')
          if (regionRadio) regionRadio.checked = true
          setRegionDrawEnabled(true)
        }
      }
      return
    }

    const nextPrompt = data.structuralRegen
      ? polishConceptText([currentResult.prompt, revision].filter(Boolean).join('. '))
      : currentResult.prompt
    showResult(data.imageUrl, data.engineLabel, Boolean(data.fallbackUsed), {
      size: currentResult.size,
      itemId: currentResult.itemId,
      prompt: nextPrompt,
      accepted: false,
      mood: currentResult.mood,
      engine: data.engine,
    })
    // 갤러리에 있던 항목이면 수정본 URL을 바로 반영 (재수용 전에도 최신본 유지)
    if (currentResult.itemId) {
      const items = readGallery()
      const index = items.findIndex((entry) => entry.id === currentResult.itemId)
      if (index !== -1) {
        items[index] = {
          ...items[index],
          imageUrl: data.imageUrl,
          engine: data.engine,
          engineLabel: data.engineLabel,
          videoUrl: null,
        }
        writeGallery(items)
        renderGallery()
      }
    }
    // 수정 적용 후: 수정 패널 닫고 수정하기 / 다시 생성 / 수용하기 복구
    setReviewChrome('idle')
    if (data.structuralRegen || getGenMode() === 'free') {
      setReviseStatus(
        (data.message ||
          '자유 일러스트 수정은 장면 재생성으로 처리했어요. 동물·구도를 유지한 채 반영합니다.') +
          ' 확정하려면 수용하기를 누르세요.',
        false,
      )
    } else {
      setReviseStatus(
        data.fallbackUsed
          ? '수정본이 준비됐어요(보조 경로 · 얼굴 유지). 더 고치려면 수정하기, 확정하려면 수용하기를 누르세요.'
          : '수정본이 준비됐어요(얼굴 유지). 더 고치려면 수정하기, 확정하려면 수용하기를 누르세요.',
        false,
      )
    }
  } catch (error) {
    stopTimer()
    setReviseStatus(`네트워크 오류: ${error instanceof Error ? error.message : String(error)}`, true)
  } finally {
    stopTimer()
    reviseApplyButton.disabled = false
  }
})

window.addEventListener('resize', () => {
  if (!regionCanvas.hidden) {
    syncRegionCanvasSize()
    redrawRegions()
  }
})

animateButton.addEventListener('click', () => {
  if (!currentResult.accepted) {
    setAnimateStatus('먼저 결과를 수용한 뒤에 쇼츠 영상을 만들 수 있어요.', true)
    return
  }
  requestAnimate()
})

videoDurationGroup?.querySelectorAll('[data-duration]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setSelectedVideoDuration(Number(btn.getAttribute('data-duration')))
  })
})
setSelectedVideoDuration(getSelectedVideoDuration())

videoSpeedGroup?.querySelectorAll('[data-speed]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setSelectedVideoSpeed(btn.getAttribute('data-speed'))
  })
})
document.querySelectorAll('[data-speed-play]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setSelectedVideoSpeed(btn.getAttribute('data-speed-play'))
  })
})
setSelectedVideoSpeed(getSelectedVideoSpeed())
resultVideo?.addEventListener('loadedmetadata', () => {
  applyVideoPlaybackRate()
})
resultVideo?.addEventListener('play', () => {
  applyVideoPlaybackRate()
})

ytPrepareAllButton.addEventListener('click', () => {
  handleYoutubePrepareAll()
})
ytDownloadButton.addEventListener('click', () => {
  handleYoutubeDownload()
})
ytCopyButton.addEventListener('click', () => {
  handleYoutubeCopy()
})
ytOpenButton.addEventListener('click', () => {
  handleYoutubeOpen()
})

function startNewShoot() {
  const hasOpenResult = !resultSection.hidden && currentResult.imageUrl
  if (hasOpenResult && !currentResult.accepted) {
    if (!window.confirm('아직 수용하지 않은 결과가 있어요. 새 장면을 시작할까요?')) return
  }

  resultSection.hidden = true
  hideVideoResult()
  setReviewChrome('idle')
  reviewPanel.hidden = true
  acceptedActions.hidden = true
  animatePanel.hidden = true
  setRegionDrawEnabled(false)
  clearAllRegions()
  setFormStatus('', false)
  setReviseStatus('', false)
  setAnimateStatus('', false)
  revisionText.value = ''
  currentResult.imageUrl = ''
  currentResult.previousImageUrl = ''
  currentResult.itemId = null
  currentResult.prompt = ''
  currentResult.videoUrl = null
  currentResult.accepted = false
  currentResult.youtubeDraft = null

  descriptionField.focus()
  form.scrollIntoView({ behavior: 'smooth', block: 'start' })
  setFormStatus('새 장면을 시작할 수 있어요. 설명을 입력한 뒤 생성하세요.', false)
}

function syncGenModeUi() {
  const free = getGenMode() === 'free'
  if (moodField) moodField.disabled = free
  const subtitle = document.getElementById('app-subtitle')
  if (subtitle) {
    subtitle.textContent = '자유 일러스트'
  }
  if (genModeHint) {
    genModeHint.textContent = ''
    genModeHint.hidden = true
  }
  if (descriptionField) {
    descriptionField.placeholder =
      '예: 백설공주가 사과를 들고 고민하고 있다 — 간략한 캐릭터 정보를 적어 주세요'
  }
  // 자유 모드 기본은 가로(장면), 관리자전용은 세로(전신)
  if (sizeField && !sizeField.dataset.userPicked) {
    sizeField.value = free ? 'landscape' : 'portrait'
  }
}
sizeField?.addEventListener('change', () => {
  if (sizeField) sizeField.dataset.userPicked = '1'
})
document.querySelectorAll('input[name="gen-mode"]').forEach((input) => {
  input.addEventListener('change', syncGenModeUi)
})
syncGenModeUi()

newShootHeaderButton.addEventListener('click', startNewShoot)
newShootGalleryButton.addEventListener('click', startNewShoot)

bgmUploadInput?.addEventListener('change', () => {
  const file = bgmUploadInput.files?.[0] || null
  bgmState.uploadFile = file
  if (file) {
    bgmState.selectedSlotId = ''
    renderBgmSlots().catch(() => {})
    setBgmStatus(`업로드 음원: ${file.name}. BGM 입히기를 누르세요.`, false)
  }
})

bgmVolumeInput?.addEventListener('input', () => {
  if (bgmVolumeLabel) bgmVolumeLabel.textContent = `${bgmVolumeInput.value}%`
})

bgmApplyButton?.addEventListener('click', async () => {
  const sourceUrl = currentResult.originalVideoUrl || currentResult.videoUrl
  if (!sourceUrl) {
    setBgmStatus('먼저 쇼츠 영상을 만들어 주세요.', true)
    return
  }
  if (typeof mixVideoWithBgm !== 'function') {
    setBgmStatus('BGM 믹서 스크립트를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.', true)
    return
  }

  let audioBlob = bgmState.uploadFile
  if (!audioBlob && bgmState.selectedSlotId) {
    audioBlob = await getBgmSlotBlob(bgmState.selectedSlotId)
  }
  if (!audioBlob) {
    setBgmStatus('슬롯에 음원을 넣거나, 바로 업로드한 뒤 다시 시도해 주세요.', true)
    return
  }

  const volume = Number(bgmVolumeInput?.value || 40) / 100
  bgmApplyButton.disabled = true
  bgmResetButton.disabled = true
  try {
    const { blobUrl, filename } = await mixVideoWithBgm(sourceUrl, audioBlob, {
      volume,
      onProgress: (msg) => setBgmStatus(msg, false),
    })
    if (currentResult.videoUrl?.startsWith('blob:') && currentResult.videoUrl !== sourceUrl) {
      URL.revokeObjectURL(currentResult.videoUrl)
    }
    currentResult.videoUrl = blobUrl
    currentResult.mixedVideoFilename = filename
    resultVideo.src = blobUrl
    resultVideo.load()
    if (currentResult.youtubeDraft) {
      currentResult.youtubeDraft = {
        ...currentResult.youtubeDraft,
        filename,
      }
    }
    // 갤러리는 원본(무음) URL 유지 — BGM 합성본은 세션 미리듣기/다운로드용
    setBgmStatus('BGM을 입혔어요. 미리 들어본 뒤 YouTube 준비로 받으세요.', false)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    setBgmStatus(
      msg === 'mediarecorder_unsupported'
        ? '이 브라우저는 BGM 합성을 지원하지 않아요. Chrome/Edge를 사용해 주세요.'
        : `BGM 합성 실패: ${msg}`,
      true,
    )
  } finally {
    bgmApplyButton.disabled = false
    bgmResetButton.disabled = false
  }
})

bgmResetButton?.addEventListener('click', () => {
  const original = currentResult.originalVideoUrl
  if (!original) {
    setBgmStatus('되돌릴 원본 영상이 없어요.', true)
    return
  }
  if (currentResult.videoUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(currentResult.videoUrl)
  }
  currentResult.videoUrl = original
  currentResult.mixedVideoFilename = null
  resultVideo.src = original
  resultVideo.load()
  setBgmStatus('원본 영상으로 되돌렸어요.', false)
})

clearGalleryButton.addEventListener('click', () => {
  if (!window.confirm('저장된 모든 이미지를 삭제할까요?')) return
  writeGallery([])
  renderGallery()
})

async function bootAuth() {
  setAuthTab('login')
  // 예전 PIN 입장 잔여값 제거
  sessionStorage.removeItem(LEGACY_PIN_STORAGE_KEY)

  const token = getSessionToken()
  if (token) {
    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'x-session-token': token },
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.ok) {
        if (data.user?.email) localStorage.setItem(USER_STORAGE_KEY, data.user.email)
        showApp()
        return
      }
      clearSessionToken()
    } catch {
      /* 세션 검증 실패 — 로그인 화면 */
    }
  }

  showPinGate()
}

bootAuth()
renderGallery()
