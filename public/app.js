const SESSION_STORAGE_KEY = 'fashionMagazineSessionToken'
const USER_STORAGE_KEY = 'fashionMagazineUserEmail'
/** 로그아웃 후에도 로그인 칸에 남길 관리자 아이디 */
const REMEMBERED_LOGIN_KEY = 'fashionMagazineRememberedLogin'
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
const authResetPin = document.getElementById('auth-reset-pin')
const authResetPassword = document.getElementById('auth-reset-password')
const authResetConfirm = document.getElementById('auth-reset-confirm')
const authResetSubmit = document.getElementById('auth-reset-submit')
const authResetStatus = document.getElementById('auth-reset-status')

const app = document.getElementById('app')
const logoutButton = document.getElementById('logout-button')
const pinSettingsButton = document.getElementById('pin-settings-button')
const pinChangeModal = document.getElementById('pin-change-modal')
const pinSettingsCurrent = document.getElementById('pin-settings-current')
const pinSettingsNew = document.getElementById('pin-settings-new')
const pinSettingsConfirm = document.getElementById('pin-settings-confirm')
const pinSettingsStatus = document.getElementById('pin-settings-status')
const pinSettingsSubmit = document.getElementById('pin-settings-submit')
const pinSettingsClose = document.getElementById('pin-settings-close')

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
const precisionModeField = document.getElementById('precision-mode')
const genModeHint = document.getElementById('gen-mode-hint')
let scenePreviewTimer = null
let scenePreviewSeq = 0

/** admin / admin@… 계정만 관리자. */
function isAdminUserEmail(emailRaw) {
  const email = String(emailRaw || '')
    .trim()
    .toLowerCase()
  if (!email) return false
  if (email === 'admin' || email === 'admin@local') return true
  return email.split('@')[0] === 'admin'
}

function isAdminUser() {
  return isAdminUserEmail(getStoredUserEmail())
}

function getGenMode() {
  // 일반 유저: 자유만. 관리자: 선택한 모드(자유 / 화보)
  if (!isAdminUser()) return 'free'
  const checked = document.querySelector('input[name="gen-mode"]:checked')
  return checked?.value === 'fashion' ? 'fashion' : 'free'
}

const APP_AREA_KEY = 'storymagAppArea'
const APP_AREAS = ['studio', 'admin', 'essay', 'tale', 'observe']
const APP_AREA_META = {
  studio: { title: null, subtitle: null },
  admin: { title: null, subtitle: null },
  essay: { title: '에세이 아키텍트', subtitle: '냉혹한 편집장 · 출간 수준 해체' },
  tale: { title: 'AI 동화 편집', subtitle: '초등 눈높이 · 사건과 행동으로' },
  observe: { title: '그림관찰과 표현', subtitle: '보이는 것을 정확하게' },
}

function getAppArea() {
  const saved = localStorage.getItem(APP_AREA_KEY)
  if (saved === 'admin' && !isAdminUser()) return 'studio'
  return APP_AREAS.includes(saved) ? saved : 'studio'
}

function setAppArea(area) {
  const next = APP_AREAS.includes(area) ? area : 'studio'
  localStorage.setItem(APP_AREA_KEY, next)
  syncAppAreaUi()
}

/** 일러스트/관리자전용은 같은 화보 스튜디오 폼을 쓰고, 에세이·동화·그림관찰은 별도 화면. */
function syncAppAreaUi() {
  const area = getAppArea()
  const usesStudioForm = area === 'studio' || area === 'admin'
  const appRoot = document.getElementById('app')

  const studioArea = document.getElementById('studio-area')
  const essayArea = document.getElementById('essay-area')
  const taleArea = document.getElementById('tale-area')
  const observeArea = document.getElementById('observe-area')
  if (studioArea) studioArea.hidden = !usesStudioForm
  if (essayArea) essayArea.hidden = area !== 'essay'
  if (taleArea) taleArea.hidden = area !== 'tale'
  if (observeArea) observeArea.hidden = area !== 'observe'
  // 「내 갤러리」(자유)와 「관리자 전용 갤러리」(화보)는 서로 섞이지 않게 탭별로 완전히 분리해서 보여준다.
  if (freeGallerySection) freeGallerySection.hidden = area !== 'studio'
  syncAdminWorkspaceUi()

  if (appRoot) {
    appRoot.classList.toggle('app--essay', !usesStudioForm)
    appRoot.classList.toggle('app--desk', !usesStudioForm)
  }

  document.querySelectorAll('[data-app-area]').forEach((btn) => {
    const on = btn.getAttribute('data-app-area') === area
    btn.classList.toggle('app__area-btn--active', on)
    btn.setAttribute('aria-selected', on ? 'true' : 'false')
  })

  if (newShootHeaderButton) newShootHeaderButton.hidden = !usesStudioForm
  const appHomeLink = document.getElementById('app-home-link')
  if (appHomeLink) appHomeLink.hidden = area === 'studio'

  const title = document.getElementById('app-title') || document.querySelector('.app__title')
  const subtitle = document.getElementById('app-subtitle')
  const meta = APP_AREA_META[area]
  if (!usesStudioForm && meta) {
    if (title) title.textContent = meta.title
    if (subtitle) subtitle.textContent = meta.subtitle
    if (area === 'essay' && window.StorymagEssay?.onShow) window.StorymagEssay.onShow()
    if (area === 'tale' && window.StorymagTale?.onShow) window.StorymagTale.onShow()
    if (area === 'observe' && window.StorymagObserve?.onShow) window.StorymagObserve.onShow()
  } else {
    // studio(자유) / admin(관리자전용) — 탭에 맞춰 내부 생성 모드를 강제한 뒤 동기화
    const desiredMode = area === 'admin' ? 'fashion' : 'free'
    const radio = document.querySelector(`input[name="gen-mode"][value="${desiredMode}"]`)
    if (radio && !radio.checked) radio.checked = true
    syncGenModeUi()
    syncResultVisibilityForArea(desiredMode)
  }
  syncAdminModeVisibility()
}

/** 「일러스트」와 「관리자 페이지」는 생성 결과 미리보기(검토/수용 패널)도 서로 안 보이게 분리한다 —
 *  안 그러면 관리자 페이지에서 만든 화보가 일러스트 탭으로 넘어와도 그대로 남아 보이는 문제가 있었다.
 *  currentResult는 지우지 않으므로, 원래 탭으로 돌아가면 다시 그대로 보인다. */
function syncResultVisibilityForArea(desiredMode) {
  if (!resultSection || !currentResult.imageUrl) return
  const resultMode = currentResult.genMode === 'fashion' ? 'fashion' : 'free'
  resultSection.hidden = resultMode !== desiredMode
}

/** 관리자에게만 「관리자전용」 탭을 보이게 한다(탭 자체가 이제 모드 전환 = 페이지 이동). */
function syncAdminModeVisibility() {
  const adminTab = document.getElementById('app-area-admin')
  // 개인 사용(solo): 로그인만 되면 관리자 — 라벨/기억된 아이디 둘 다 본다
  const admin =
    isAdminUser() ||
    isAdminUserEmail(typeof getRememberedLoginId === 'function' ? getRememberedLoginId() : '') ||
    isAdminUserEmail(authUserLabel?.textContent || '')
  if (adminTab) adminTab.hidden = !admin
  if (pinSettingsButton) pinSettingsButton.hidden = !admin
  if (!admin) {
    const freeRadio = document.querySelector('input[name="gen-mode"][value="free"]')
    if (freeRadio) freeRadio.checked = true
    if (getAppArea() === 'admin') setAppArea('studio')
  }
  // 관리자는 그림 상세본(최대 3000자 미만)을 그대로 옮겨 붙일 수 있게 3000자까지 허용한다.
  // 실제 이미지 생성 모델에 넣기 직전에는 compileSdxlTagPrompt가 자동으로 ~70단어 태그로
  // 한 번 더 압축하므로, 여기서는 원고 전체를 검증·수정할 수 있게 넉넉히 열어둔다.
  const descriptionEl = document.getElementById('description')
  if (descriptionEl) {
    descriptionEl.maxLength = admin ? 3000 : 1200
  }
  updateDescriptionCounter()
}

// 실시간 글자수 카운터 — "300자 허용이 실제로 몇 단어로 반영되는지 모르겠다"는 혼란을 줄이려고,
// 입력창 바로 아래 항상 "n / 한도자"를 보여준다(GStory류 "0/2500" 패턴). 한도에 거의 닿으면
// 빨간색으로 경고한다. 실제 이미지 생성 시엔 이후 번역·태그압축으로 더 줄어들 수 있다는 안내를
// 덧붙인다 — 원문 글자수 ≠ 이미지 모델에 실제로 들어가는 단어수라는 착각을 막기 위해서다.
function updateDescriptionCounter() {
  const hintEl = document.getElementById('description-limit-hint')
  if (!hintEl || !descriptionField) return
  const max = Number(descriptionField.maxLength) > 0 ? Number(descriptionField.maxLength) : 1200
  const len = (descriptionField.value || '').length
  const nearLimit = len >= max * 0.9
  hintEl.textContent =
    len > 0
      ? `${len} / ${max}자 · 실제 이미지 생성에는 이후 번역·압축을 거쳐 더 줄어들어요`
      : `0 / ${max}자`
  hintEl.hidden = false
  hintEl.classList.toggle('form__hint--error', nearLimit)
}
descriptionField?.addEventListener('input', updateDescriptionCounter)
const generateButton = document.getElementById('generate-button')
const formStatus = document.getElementById('form-status')

const resultSection = document.getElementById('result-section')
const resultEngine = document.getElementById('result-engine')
const resultImage = document.getElementById('result-image')
const resultDownload = document.getElementById('result-download')
const reviewBadge = document.getElementById('review-badge')
const compareBadge = document.getElementById('compare-badge')
const compareToggleButtons = document.querySelectorAll('.compare-toggle-btn')
const compareRevertButtons = document.querySelectorAll('.compare-revert-btn')
const removeBgButtons = [
  document.getElementById('remove-bg-button'),
  document.getElementById('remove-bg-button-accepted'),
].filter(Boolean)
const reviewPanel = document.getElementById('review-panel')
const revisePanel = document.getElementById('revise-panel')
const acceptedActions = document.getElementById('accepted-actions')
const animatePanel = document.getElementById('animate-panel')
const acceptButton = document.getElementById('accept-button')
const reviseToggleButton = document.getElementById('revise-toggle-button')
const reviseAgainButton = document.getElementById('revise-again-button')
const bodyProjectShortsButton = document.getElementById('body-project-shorts-button')
const moveGalleryButton = document.getElementById('move-gallery-button')
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
const bodyLandmarkCanvas = document.getElementById('body-landmark-canvas')
const bodyLandmarkToolbar = document.getElementById('body-landmark-toolbar')
const bodyLandmarkAutoButton = document.getElementById('body-landmark-auto')
const bodyLandmarkConfirmButton = document.getElementById('body-landmark-confirm')
const bodyLandmarkCancelButton = document.getElementById('body-landmark-cancel')
const pinToolbar = document.getElementById('pin-toolbar')
const pinStatus = document.getElementById('pin-status')
const reviseTextBlock = document.getElementById('revise-text-block')

/** 찍어서 붙이기 — AI 추측 대신 클릭 좌표에 소품 합성 */
let pinScale = 1
let pinBusy = false

const loadImageButton = document.getElementById('load-image-button')
const loadImageInput = document.getElementById('load-image-input')

const motionField = document.getElementById('motion')
const motion2Field = document.getElementById('motion-2')
const motionLabel = document.getElementById('motion-label')
const animateButton = document.getElementById('animate-button')
const animateStatus = document.getElementById('animate-status')
const dualFrameFields = document.getElementById('dual-frame-fields')
const dualFrameHint = document.getElementById('dual-frame-hint')
const videoDurationHint = document.getElementById('video-duration-hint')
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

/** 한 프레임 길이 + 두 프레임 연속(이름만 24/30, 내부는 12+12 / 15+15) */
const VIDEO_DURATION_OPTIONS = [10, 12, 15, 18, 24, 30]
/** @type {Record<number, number>} 표기 초 → 프레임당 초 */
const DUAL_FRAME_CLIP_SEC = { 24: 12, 30: 15 }

function isDualFrameDuration(sec) {
  return Object.prototype.hasOwnProperty.call(DUAL_FRAME_CLIP_SEC, Number(sec))
}

function getDualClipSec(totalSec) {
  return DUAL_FRAME_CLIP_SEC[Number(totalSec)] || 15
}

function getSelectedVideoDuration() {
  const fromAttr = Number(videoDurationGroup?.dataset?.duration || 15)
  if (VIDEO_DURATION_OPTIONS.includes(fromAttr)) return fromAttr
  return 15
}

function syncDualFrameUi(totalSec) {
  const dual = isDualFrameDuration(totalSec)
  if (dualFrameFields) dualFrameFields.hidden = !dual
  if (motionLabel) {
    motionLabel.textContent = dual ? '전반 모션 (1프레임)' : '모션 힌트 (선택)'
  }
  if (motionField) {
    motionField.placeholder = dual ? '전반 모션을 입력하세요' : '모션 힌트를 입력하세요'
  }
  if (dualFrameHint) {
    dualFrameHint.textContent = `${totalSec}초: 전반→후반 이어붙임. 탈의는 전반에서 와이드로 끝내고, 나체 전에 줌인하지 않음. 단일(10~18초)은 클로즈업·줌인 없음.`
  }
  if (videoDurationHint) {
    videoDurationHint.innerHTML = dual
      ? `<strong>${totalSec}초</strong>는 두 프레임 연속 생성입니다. 전반·후반 모션을 적고 아래 버튼으로 만드세요.`
      : '10~18초: 한 프레임. <strong>24초·30초</strong>: 두 프레임을 연속 생성해 이어 붙입니다 (속도감 유지).'
  }
  if (animateButton) {
    animateButton.textContent = dual
      ? `${totalSec}초 쇼츠 만들기 (두 프레임 연속)`
      : '쇼츠 비디오 만들기'
  }
}

function setSelectedVideoDuration(sec) {
  const n = Number(sec)
  const value = VIDEO_DURATION_OPTIONS.includes(n) ? n : 15
  if (videoDurationGroup) videoDurationGroup.dataset.duration = String(value)
  videoDurationGroup?.querySelectorAll('[data-duration]').forEach((btn) => {
    btn.classList.toggle('is-active', Number(btn.getAttribute('data-duration')) === value)
  })
  syncDualFrameUi(value)
}

function setAnimateBusy(busy) {
  if (animateButton) animateButton.disabled = busy
  if (bodyProjectShortsButton) {
    if (bodyProjectUiMode === 'working') {
      bodyProjectShortsButton.disabled = true
    } else if (bodyProjectUiMode === 'landmark') {
      bodyProjectShortsButton.disabled = false
    } else {
      bodyProjectShortsButton.disabled = busy
    }
  }
}

/** @type {'idle'|'landmark'|'working'} */
let bodyProjectUiMode = 'idle'
/** @type {null|(() => void)} */
let stopBodyProjectButtonTimer = null

function resetBodyProjectButtonUi() {
  stopBodyProjectButtonTimer?.()
  stopBodyProjectButtonTimer = null
  bodyProjectUiMode = 'idle'
  const btn = bodyProjectShortsButton || document.getElementById('body-project-shorts-button')
  if (!btn) return
  btn.classList.remove('is-active', 'is-working')
  btn.textContent = '몸매 투영'
  btn.disabled = false
  btn.removeAttribute('aria-busy')
  // 일반 쇼츠(키스/애무)가 「몸매 투영」문구에 가로채이지 않도록 모션칸 잔여 제거
  if (motionField && /^\s*몸매\s*투영/u.test(motionField.value || '')) {
    motionField.value = ''
  }
}

/**
 * 몸매 투영 버튼 활성/작업 UI.
 * @param {'idle'|'landmark'|'working'} mode
 */
function setBodyProjectButtonUi(mode) {
  const btn = bodyProjectShortsButton || document.getElementById('body-project-shorts-button')
  if (!btn) return
  stopBodyProjectButtonTimer?.()
  stopBodyProjectButtonTimer = null
  bodyProjectUiMode = mode
  btn.classList.toggle('is-active', mode === 'landmark' || mode === 'working')
  btn.classList.toggle('is-working', mode === 'working')
  btn.setAttribute('aria-busy', mode === 'working' ? 'true' : 'false')

  if (mode === 'idle') {
    btn.textContent = '몸매 투영'
    btn.disabled = false
    return
  }
  if (mode === 'landmark') {
    btn.textContent = '타점 조정 중'
    btn.disabled = false
    return
  }
  // working — 버튼에 경과 초 표시
  btn.disabled = true
  const startedAt = Date.now()
  const tick = () => {
    const seconds = Math.floor((Date.now() - startedAt) / 1000)
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    btn.textContent = m > 0 ? `투영 중 ${m}분 ${s}초` : `투영 중 ${s}초`
  }
  tick()
  const timerId = window.setInterval(tick, 1000)
  stopBodyProjectButtonTimer = () => {
    window.clearInterval(timerId)
  }
}

/** 기본 모션 예시 + 사용자가 저장한 예시 (로컬) */
const MOTION_PRESET_KEY = 'storymag.motionPresets.v1'
const BUILTIN_MOTION_PRESETS = []

function loadCustomMotionPresets() {
  try {
    const raw = localStorage.getItem(MOTION_PRESET_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((s) => String(s || '').trim())
      .filter((s) => s.length > 0 && s.length <= 400)
      .slice(0, 24)
  } catch {
    return []
  }
}

function saveCustomMotionPresets(list) {
  localStorage.setItem(MOTION_PRESET_KEY, JSON.stringify(list.slice(0, 24)))
}

function getMotionPresetTarget() {
  if (document.activeElement === motion2Field && motion2Field && !dualFrameFields?.hidden) {
    return motion2Field
  }
  return motionField
}

function renderMotionPresets() {
  const listEl = document.getElementById('motion-presets-list')
  if (!listEl) return
  const custom = loadCustomMotionPresets()
  const seen = new Set()
  const items = []
  for (const text of [...BUILTIN_MOTION_PRESETS, ...custom]) {
    const key = text.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    items.push({ text: key, custom: !BUILTIN_MOTION_PRESETS.includes(key) })
  }
  listEl.replaceChildren()
  items.forEach((item) => {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'motion-preset-chip'
    chip.title = item.text
    const label = document.createElement('span')
    label.className = 'motion-preset-chip__text'
    label.textContent = item.text
    chip.appendChild(label)
    chip.addEventListener('click', () => {
      const target = getMotionPresetTarget()
      if (!target) return
      target.value = item.text
      target.focus()
      setAnimateStatus('모션 예시를 넣었어요. 필요하면 고친 뒤 쇼츠를 만드세요.', false)
    })
    if (item.custom) {
      const x = document.createElement('span')
      x.className = 'motion-preset-chip__x'
      x.setAttribute('role', 'button')
      x.setAttribute('aria-label', '예시 삭제')
      x.tabIndex = 0
      x.textContent = '×'
      const remove = (event) => {
        event.preventDefault()
        event.stopPropagation()
        const next = loadCustomMotionPresets().filter((s) => s !== item.text)
        saveCustomMotionPresets(next)
        renderMotionPresets()
        setAnimateStatus('저장한 모션 예시를 지웠어요.', false)
      }
      x.addEventListener('click', remove)
      x.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') remove(event)
      })
      chip.appendChild(x)
    }
    listEl.appendChild(chip)
  })
}

document.getElementById('motion-preset-save')?.addEventListener('click', () => {
  const target = getMotionPresetTarget()
  const text = (target?.value || '').trim()
  if (!text) {
    setAnimateStatus('저장할 모션 문구를 먼저 입력하세요.', true)
    return
  }
  if (BUILTIN_MOTION_PRESETS.includes(text)) {
    setAnimateStatus('기본 예시라 따로 저장하지 않아도 됩니다.', false)
    return
  }
  const next = [text, ...loadCustomMotionPresets().filter((s) => s !== text)].slice(0, 24)
  saveCustomMotionPresets(next)
  renderMotionPresets()
  setAnimateStatus('모션 예시를 저장했어요. 다음에 칩을 눌러 바로 쓰세요.', false)
})

renderMotionPresets()


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
const freeGallerySection = document.getElementById('free-gallery')
const adminGallerySection = document.getElementById('admin-gallery')
const adminGalleryGrid = document.getElementById('admin-gallery-grid')
const adminGalleryEmpty = document.getElementById('admin-gallery-empty')
const clearAdminGalleryButton = document.getElementById('clear-admin-gallery')
const newShootAdminGalleryButton = document.getElementById('new-shoot-admin-gallery')
const bgmSlotsEl = document.getElementById('bgm-slots')
const bgmSlotsEmptyEl = document.getElementById('bgm-slots-empty')
const bgmAddTagButton = document.getElementById('bgm-add-tag')
const bgmSunoUrlInput = document.getElementById('bgm-suno-url')
const bgmSunoImportButton = document.getElementById('bgm-suno-import-button')
const bgmUploadInput = document.getElementById('bgm-upload')
const bgmVolumeInput = document.getElementById('bgm-volume')
const bgmVolumeLabel = document.getElementById('bgm-volume-label')
const bgmApplyButton = document.getElementById('bgm-apply')
const bgmResetButton = document.getElementById('bgm-reset')
const bgmStatus = document.getElementById('bgm-status')

/** 현재 결과 화면에 떠 있는 이미지/영상 상태 */
const currentResult = {
  imageUrl: null,
  /** replicate.delivery 만료 대비 — 서버가 읽어 둔 data URL */
  imageDataUrl: null,
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
  /** 직전 버전의 전체 스냅샷(imageUrl/prompt/mood/size/engine 등) — 「이전과 비교」로 보여주고,
   * 「이 버전에서 다시 수정」을 누르면 이 스냅샷과 현재 상태를 맞바꿔서 그 시점부터 이어서 수정할 수 있게 한다. */
  previousSnapshot: null,
  /** 이 이미지를 실제로 생성한 모드('free'|'fashion'). 탭을 나중에 옮겨도 「수정 적용」이
   * 지금 켜져 있는 탭이 아니라 이 이미지가 실제로 만들어진 모드를 쓰도록 고정한다. */
  genMode: 'free',
  /** 지금까지 적용된 「수정」 횟수. 0이면 아직 수정 전(다음 클릭이 1차 수정). */
  reviseRound: 0,
}

/** 이미지 수정 버튼 라벨 — 횟수는 보조 표시만. */
function updateReviseButtonLabel() {
  const n = (currentResult.reviseRound || 0) + 1
  const label = n <= 1 ? '이미지 수정' : `이미지 수정 (${n}회차)`
  if (reviseToggleButton) reviseToggleButton.textContent = label
  if (reviseAgainButton) reviseAgainButton.textContent = label
}

const bgmState = {
  selectedSlotId: '',
  uploadFile: null,
}

/** 「이전과 비교」 토글 중인지 — true면 화면엔 수정 전(previousSnapshot)이 떠 있는 상태 */
let comparingPrevious = false

/** currentResult에서 "버전 스냅샷"에 필요한 필드만 뽑아 복사한다(비교/되돌리기에서 재사용). */
function snapshotCurrentResult() {
  return {
    imageUrl: currentResult.imageUrl,
    imageDataUrl: currentResult.imageDataUrl,
    prompt: currentResult.prompt,
    mood: currentResult.mood,
    size: currentResult.size,
    engineLabel: currentResult.engineLabel,
    engine: currentResult.engine,
    fallbackUsed: currentResult.fallbackUsed,
    genMode: currentResult.genMode,
    reviseRound: currentResult.reviseRound,
  }
}

/** 다듬기용 톡톡톡 다각형 올가미 */
let reviseLasso = null

function ensureReviseLasso() {
  if (reviseLasso) return reviseLasso
  if (!regionCanvas || !window.StorymagPolyLasso?.create) return null
  reviseLasso = window.StorymagPolyLasso.create(regionCanvas, {
    onChange: () => {
      redrawRegions()
      updateRegionList()
    },
    onStatus: (msg, isError) => setReviseStatus(msg, isError),
    getImageSize: () => ({
      w: resultImage?.naturalWidth || regionCanvas.width,
      h: resultImage?.naturalHeight || regionCanvas.height,
    }),
  })
  return reviseLasso
}

function getSessionToken() {
  return localStorage.getItem(SESSION_STORAGE_KEY) || ''
}

function setSessionToken(token, email) {
  localStorage.setItem(SESSION_STORAGE_KEY, token)
  if (email) {
    localStorage.setItem(USER_STORAGE_KEY, email)
    rememberLoginId(email)
  }
}

function clearSessionToken() {
  localStorage.removeItem(SESSION_STORAGE_KEY)
  localStorage.removeItem(USER_STORAGE_KEY)
}

function getStoredUserEmail() {
  return localStorage.getItem(USER_STORAGE_KEY) || ''
}

function rememberLoginId(email) {
  const id = String(email || '').trim()
  if (!id) return
  localStorage.setItem(REMEMBERED_LOGIN_KEY, id)
}

function getRememberedLoginId() {
  return localStorage.getItem(REMEMBERED_LOGIN_KEY) || ''
}

/** 로그인 화면에 기억된 관리자 아이디를 채운다. */
function fillRememberedLogin() {
  if (!authEmailInput) return
  const remembered = getRememberedLoginId()
  if (remembered && !authEmailInput.value.trim()) {
    authEmailInput.value = remembered
  }
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
  syncAppAreaUi()
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

function authErrorMessage(code, data) {
  const map = {
    invalid_email: '이메일 형식을 확인해 주세요.',
    password_too_short: '비밀번호는 5자 이상이어야 해요.',
    password_too_long: '비밀번호가 너무 길어요.',
    email_already_registered: '이미 가입된 이메일이에요. 로그인해 주세요.',
    invalid_credentials: '이메일 또는 비밀번호가 올바르지 않아요.',
    unauthorized: '로그인이 필요해요.',
    auth_db_not_configured: '회원 DB가 아직 연결되지 않았어요.',
    signup_disabled: '지금은 회원가입을 받지 않아요. 안정화될 때까지 개인 사용입니다.',
    solo_admin_only: '지금은 관리자만 사용할 수 있어요. 안정화될 때까지 개인 사용입니다.',
    invalid_invite_code: '초대 코드가 올바르지 않아요.',
    invalid_admin_pin: 'ADMIN_PIN이 올바르지 않아요.',
    invalid_current_pin: '현재 PIN이 올바르지 않아요.',
    pin_too_short: 'PIN은 4자 이상이어야 해요.',
    pin_too_long: 'PIN이 너무 길어요.',
    pin_confirm_mismatch: '새 PIN 확인이 일치하지 않아요.',
    pin_unchanged: '이전 PIN과 같아요. 새 PIN을 입력해 주세요.',
    password_confirm_mismatch: '새 비밀번호 확인이 일치하지 않아요.',
    user_not_found: '해당 관리자 계정을 찾지 못했어요.',
    image_url_not_allowed: '허용되지 않은 이미지 주소예요. 앱에서 생성한 이미지만 사용할 수 있어요.',
  }
  if (code === 'rate_limited') {
    const sec = Number(data?.retryAfterSec)
    if (Number.isFinite(sec) && sec > 0) {
      if (sec >= 3600) return `시도가 너무 많아요. 약 ${Math.ceil(sec / 3600)}시간 뒤에 다시 시도해 주세요.`
      if (sec >= 60) return `시도가 너무 많아요. 약 ${Math.ceil(sec / 60)}분 뒤에 다시 시도해 주세요.`
      return `시도가 너무 많아요. 약 ${Math.ceil(sec)}초 뒤에 다시 시도해 주세요.`
    }
    return data?.message || '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.'
  }
  return map[code] || data?.message || `오류: ${code || 'unknown'}`
}

function setAuthResetStatus(message, isError) {
  if (!authResetStatus) return
  authResetStatus.hidden = !message
  authResetStatus.textContent = message || ''
  authResetStatus.style.color = isError ? '' : '#7dcea0'
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
  fillRememberedLogin()
  // 아이디가 이미 있으면 비밀번호로 포커스
  if (authEmailInput?.value.trim()) {
    authPasswordInput?.focus()
  } else {
    authEmailInput?.focus()
  }
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

/** 파일 선택창을 띄우고 선택된 파일을 반환한다 (취소 시 null). */
function pickAudioFile() {
  return new Promise((resolve) => {
    const picker = document.createElement('input')
    picker.type = 'file'
    picker.accept = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg'
    picker.onchange = () => resolve(picker.files?.[0] || null)
    picker.click()
  })
}

/** 음원 저장 관련 오류를 사용자 메시지로 변환한다. */
function bgmErrorMessage(error) {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg === 'audio_too_large') return '음원은 20MB 이하만 가능해요.'
  if (msg === 'empty_label') return '태그 이름을 입력해 주세요.'
  return `저장 실패: ${msg}`
}

async function renderBgmSlots() {
  if (!bgmSlotsEl || typeof listBgmSlots !== 'function') return
  const slots = await listBgmSlots()
  bgmSlotsEl.innerHTML = ''
  if (bgmSlotsEmptyEl) bgmSlotsEmptyEl.hidden = slots.length > 0

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
    meta.textContent = slot.hasAudio ? slot.fileName : '비어 있음'

    const actions = document.createElement('div')
    actions.className = 'bgm-slot__actions'

    const assignBtn = document.createElement('button')
    assignBtn.type = 'button'
    assignBtn.textContent = slot.hasAudio ? '교체' : '음원 넣기'
    assignBtn.addEventListener('click', async (event) => {
      event.stopPropagation()
      const file = await pickAudioFile()
      if (!file) return
      try {
        await replaceBgmSlotAudio(slot.id, file)
        bgmState.selectedSlotId = slot.id
        bgmState.uploadFile = null
        if (bgmUploadInput) bgmUploadInput.value = ''
        setBgmStatus(`「${slot.label}」 태그에 ${file.name}을(를) 넣었어요.`, false)
        await renderBgmSlots()
      } catch (error) {
        setBgmStatus(bgmErrorMessage(error), true)
      }
    })

    const renameBtn = document.createElement('button')
    renameBtn.type = 'button'
    renameBtn.textContent = '이름변경'
    renameBtn.addEventListener('click', async (event) => {
      event.stopPropagation()
      const nextLabel = window.prompt('새 태그 이름을 입력하세요 (24자 이내)', slot.label)
      if (nextLabel === null) return
      try {
        await renameBgmSlot(slot.id, nextLabel)
        setBgmStatus(`태그 이름을 「${nextLabel.trim().slice(0, 24)}」로 바꿨어요.`, false)
        await renderBgmSlots()
      } catch (error) {
        setBgmStatus(bgmErrorMessage(error), true)
      }
    })

    const deleteBtn = document.createElement('button')
    deleteBtn.type = 'button'
    deleteBtn.textContent = '삭제'
    deleteBtn.addEventListener('click', async (event) => {
      event.stopPropagation()
      if (!window.confirm(`「${slot.label}」 태그와 저장된 음원을 삭제할까요?`)) return
      await deleteBgmSlot(slot.id)
      if (bgmState.selectedSlotId === slot.id) bgmState.selectedSlotId = ''
      setBgmStatus(`「${slot.label}」 태그를 삭제했어요.`, false)
      await renderBgmSlots()
    })

    actions.appendChild(assignBtn)
    actions.appendChild(renameBtn)
    actions.appendChild(deleteBtn)
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

bgmAddTagButton?.addEventListener('click', async () => {
  const label = window.prompt('새 태그 이름을 입력하세요 (예: 업비트, 감성 발라드 등, 24자 이내)')
  if (label === null) return
  if (!label.trim()) {
    setBgmStatus('태그 이름을 입력해 주세요.', true)
    return
  }
  const file = await pickAudioFile()
  if (!file) return
  try {
    const newId = await addBgmSlot(label, file)
    bgmState.selectedSlotId = newId
    bgmState.uploadFile = null
    if (bgmUploadInput) bgmUploadInput.value = ''
    setBgmStatus(`「${label.trim().slice(0, 24)}」 태그를 만들고 음원을 저장했어요.`, false)
    await renderBgmSlots()
  } catch (error) {
    setBgmStatus(bgmErrorMessage(error), true)
  }
})

/** /api/bgm-from-url 응답 에러 코드를 사용자 메시지로 변환한다. */
function bgmFromUrlErrorMessage(data) {
  const code = data?.error || ''
  if (code === 'unsupported_url') return data.message || 'suno.com 공유 링크만 지원해요 (예: https://suno.com/s/xxxx).'
  if (code === 'suno_page_fetch_failed') return 'Suno 페이지를 불러오지 못했어요. 링크를 다시 확인해 주세요.'
  if (code === 'suno_audio_not_found') {
    return data.message || '이 링크에서 음원을 찾지 못했어요. 비공개 트랙일 수 있어요.'
  }
  if (code === 'suno_audio_not_allowed') return '허용되지 않은 음원 주소예요.'
  if (code === 'suno_audio_fetch_failed') return '음원 파일을 받아오지 못했어요. 잠시 후 다시 시도해 주세요.'
  if (code === 'suno_audio_too_large') return '음원이 20MB보다 커서 가져올 수 없어요.'
  if (code === 'suno_audio_empty') return '받아온 음원 파일이 비어 있어요.'
  if (code === 'url_required') return 'Suno 링크를 입력해 주세요.'
  return `가져오기 실패: ${data.message || code || '알 수 없는 오류'}`
}

// suno.com 공유 링크를 붙여넣으면 서버가 대신 mp3를 찾아 받아온 뒤, 새 태그로 저장한다.
bgmSunoImportButton?.addEventListener('click', async () => {
  const url = (bgmSunoUrlInput?.value || '').trim()
  if (!url) {
    setBgmStatus('Suno 링크를 입력해 주세요.', true)
    bgmSunoUrlInput?.focus()
    return
  }
  if (!isLoggedIn()) {
    showPinGate('로그인이 필요해요.')
    return
  }

  bgmSunoImportButton.disabled = true
  const stopTimer = startProgressTimer(setBgmStatus, 'Suno 링크에서 음원을 가져오고 있어요…')
  try {
    const response = await fetch('/api/bgm-from-url', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ url }),
    })
    const data = await response.json().catch(() => ({}))
    stopTimer()

    if (response.status === 401) {
      clearAllAuth()
      showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
      return
    }
    if (response.status === 429) {
      setBgmStatus(data.message || '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.', true)
      return
    }
    if (!data.ok) {
      setBgmStatus(bgmFromUrlErrorMessage(data), true)
      return
    }

    const blob = await (await fetch(data.dataUrl)).blob()
    const suggested = (data.title || '').trim().slice(0, 24) || '가져온 음원'
    const label = window.prompt('태그 이름을 확인하세요 (24자 이내)', suggested)
    if (label === null) return
    const file = new File([blob], `${suggested}.mp3`, { type: 'audio/mpeg' })

    const newId = await addBgmSlot(label, file)
    bgmState.selectedSlotId = newId
    bgmState.uploadFile = null
    if (bgmUploadInput) bgmUploadInput.value = ''
    if (bgmSunoUrlInput) bgmSunoUrlInput.value = ''
    setBgmStatus(`「${label.trim().slice(0, 24)}」 태그로 Suno 음원을 가져왔어요.`, false)
    await renderBgmSlots()
  } catch (error) {
    stopTimer()
    setBgmStatus(bgmErrorMessage(error), true)
  } finally {
    bgmSunoImportButton.disabled = false
  }
})

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
      genMode: currentResult.genMode,
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
  const v = document.querySelector('input[name="revise-mode"]:checked')?.value || 'pin'
  if (v === 'region' || v === 'pin' || v === 'text') return v
  return 'pin'
}

function getSelectedPinProp() {
  const checked = document.querySelector('input[name="pin-prop"]:checked')
  return checked?.value || 'watch'
}

function wantsAccessoryPinRevision(text) {
  const t = text || ''
  // 목걸이 제거는 올가미 AI가 맞고, 추가형 손목·귀 소품만 핀으로 유도
  if (/목걸이|초커|necklace|choker/i.test(t) && /제거|없애|지워|빼|삭제|remove/i.test(t)) return false
  return /귀걸이|이어링|피어싱|팔찌|시계|손목시계|워치|팔목|earring|bracelet|\bwatch\b|wristwatch|jewelry|jewellery/i.test(
    t,
  )
}

async function loadCurrentResultDataUrl() {
  if (!currentResult.imageUrl) throw new Error('no_image')
  let sourceDataUrl = currentResult.imageDataUrl
  if (!sourceDataUrl || !String(sourceDataUrl).startsWith('data:')) {
    const response = await fetch('/api/media-bytes', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ imageUrl: currentResult.imageUrl }),
    })
    const data = await response.json().catch(() => ({}))
    if (!data?.ok || !data.dataUrl) throw new Error(data?.error || 'media_bytes_failed')
    sourceDataUrl = data.dataUrl
    currentResult.imageDataUrl = sourceDataUrl
  }
  return sourceDataUrl
}

function drawPinWatch(ctx, cx, cy, scale) {
  const w = 72 * scale
  const h = 88 * scale
  ctx.save()
  ctx.translate(cx, cy)
  // strap
  ctx.fillStyle = 'rgba(40,40,45,0.92)'
  ctx.beginPath()
  ctx.roundRect(-w * 0.22, -h * 0.55, w * 0.44, h * 1.1, 6 * scale)
  ctx.fill()
  // case
  const grd = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2)
  grd.addColorStop(0, '#e8e8ea')
  grd.addColorStop(0.5, '#9a9aa3')
  grd.addColorStop(1, '#d4d4d8')
  ctx.fillStyle = grd
  ctx.strokeStyle = 'rgba(60,60,70,0.85)'
  ctx.lineWidth = 2 * scale
  ctx.beginPath()
  ctx.ellipse(0, 0, w * 0.42, h * 0.36, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // face
  ctx.fillStyle = '#f4f4f6'
  ctx.beginPath()
  ctx.ellipse(0, 0, w * 0.32, h * 0.27, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 1.5 * scale
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -h * 0.16)
  ctx.moveTo(0, 0)
  ctx.lineTo(w * 0.14, 0.02 * h)
  ctx.stroke()
  ctx.fillStyle = '#c9a227'
  ctx.beginPath()
  ctx.arc(0, 0, 2.2 * scale, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawPinBracelet(ctx, cx, cy, scale) {
  const r = 38 * scale
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = '#c9a227'
  ctx.lineWidth = 5 * scale
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 4 * scale
  ctx.beginPath()
  ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = '#f0d78c'
  ctx.lineWidth = 2 * scale
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 0.92, r * 0.48, 0, 0.2, Math.PI * 1.2)
  ctx.stroke()
  ctx.restore()
}

function drawPinHoopEarring(ctx, cx, cy, scale) {
  const r = 22 * scale
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = '#d4af37'
  ctx.lineWidth = 3.5 * scale
  ctx.beginPath()
  ctx.arc(0, 4 * scale, r, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.stroke()
  ctx.fillStyle = '#e8c547'
  ctx.beginPath()
  ctx.arc(0, -r * 0.15, 3 * scale, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawPinButterflyEarring(ctx, cx, cy, scale) {
  ctx.save()
  ctx.translate(cx, cy)
  const s = 18 * scale
  ctx.fillStyle = '#d4af37'
  ctx.strokeStyle = '#8a7020'
  ctx.lineWidth = 1.2 * scale
  // left wing
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(-s * 1.4, -s * 0.9, -s * 1.1, s * 0.2)
  ctx.quadraticCurveTo(-s * 0.6, s * 0.9, 0, s * 0.35)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // right wing
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(s * 1.4, -s * 0.9, s * 1.1, s * 0.2)
  ctx.quadraticCurveTo(s * 0.6, s * 0.9, 0, s * 0.35)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#f5e6a6'
  ctx.beginPath()
  ctx.ellipse(0, s * 0.1, s * 0.18, s * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()
  // hook
  ctx.strokeStyle = '#c9a227'
  ctx.lineWidth = 2 * scale
  ctx.beginPath()
  ctx.arc(0, -s * 0.55, 4 * scale, Math.PI * 0.2, Math.PI * 1.1)
  ctx.stroke()
  ctx.restore()
}

function drawPinProp(ctx, prop, cx, cy, scale) {
  if (prop === 'bracelet') drawPinBracelet(ctx, cx, cy, scale)
  else if (prop === 'hoop') drawPinHoopEarring(ctx, cx, cy, scale)
  else if (prop === 'butterfly') drawPinButterflyEarring(ctx, cx, cy, scale)
  else drawPinWatch(ctx, cx, cy, scale)
}

async function stampPropAtClientPoint(clientX, clientY) {
  if (pinBusy || !currentResult.imageUrl || !resultImage) return
  const rect = resultImage.getBoundingClientRect()
  if (rect.width < 8 || rect.height < 8) return
  const nx = (clientX - rect.left) / rect.width
  const ny = (clientY - rect.top) / rect.height
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return

  pinBusy = true
  if (pinStatus) pinStatus.textContent = '붙이는 중…'
  setReviseStatus('선택한 위치에 소품을 붙이는 중…', false)
  try {
    if (!isLoggedIn()) {
      showPinGate('로그인이 필요해요.')
      return
    }
    const sourceDataUrl = await loadCurrentResultDataUrl()
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('image_decode_failed'))
      img.src = sourceDataUrl
    })
    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas_unavailable')
    if (typeof ctx.roundRect !== 'function') {
      ctx.roundRect = function (x, y, rw, rh, r) {
        const rad = typeof r === 'number' ? r : 0
        this.beginPath()
        this.moveTo(x + rad, y)
        this.arcTo(x + rw, y, x + rw, y + rh, rad)
        this.arcTo(x + rw, y + rh, x, y + rh, rad)
        this.arcTo(x, y + rh, x, y, rad)
        this.arcTo(x, y, x + rw, y, rad)
        this.closePath()
      }
    }
    ctx.drawImage(img, 0, 0, w, h)
    const prop = getSelectedPinProp()
    const baseScale = (Math.min(w, h) / 900) * pinScale
    drawPinProp(ctx, prop, nx * w, ny * h, Math.max(0.45, baseScale))
    const dataUrl = canvas.toDataURL('image/png')

    const uploadRes = await fetch('/api/upload-image', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ dataUrl }),
    })
    const uploadData = await uploadRes.json().catch(() => ({}))
    if (!uploadData?.ok || !uploadData.imageUrl) {
      throw new Error(uploadData?.message || uploadData?.error || 'upload_failed')
    }

    const labels = {
      watch: '시계',
      butterfly: '나비 귀걸이',
      hoop: '링 귀걸이',
      bracelet: '팔찌',
    }
    const label = labels[prop] || '소품'
    const nextPrompt = polishConceptText(
      [currentResult.prompt, `${label} 추가(위치 지정 합성)`].filter(Boolean).join('. '),
    )
    showResult(uploadData.imageUrl, '로컬 합성 · 찍어서 붙이기', false, {
      size: currentResult.size,
      itemId: currentResult.itemId,
      prompt: nextPrompt,
      accepted: false,
      mood: currentResult.mood,
      engine: 'pin-stamp',
      reviseRound: (currentResult.reviseRound || 0) + 1,
    })
    currentResult.imageDataUrl = dataUrl
    setReviewChrome('revising')
    const pinRadio = document.querySelector('input[name="revise-mode"][value="pin"]')
    if (pinRadio) pinRadio.checked = true
    syncReviseModeUi()
    if (pinStatus) pinStatus.textContent = `${label} 붙임 · 다른 위치 클릭하면 하나 더`
    setReviseStatus(
      `${label}을(를) 클릭한 자리에 붙였어요. 크기: 휠로 조절(지금 ${pinScale.toFixed(1)}×). 더 붙이려면 다시 클릭.`,
      false,
    )
  } catch (error) {
    setReviseStatus(
      `붙이기 실패: ${error instanceof Error ? error.message : 'unknown'}. 잠시 후 다시 시도해 주세요.`,
      true,
    )
    if (pinStatus) pinStatus.textContent = '실패 — 다시 클릭해 보세요'
  } finally {
    pinBusy = false
  }
}

function setPinDrawEnabled(enabled) {
  if (pinToolbar) pinToolbar.hidden = !enabled
  if (reviseTextBlock) reviseTextBlock.hidden = enabled
  if (reviseApplyButton) reviseApplyButton.hidden = enabled
  resultStage?.classList.toggle('result__stage--pinning', enabled)
  if (enabled) {
    setRegionDrawEnabled(false)
    if (pinStatus) {
      pinStatus.textContent = `대기 — 클릭으로 붙이기 · 휠 크기 ${pinScale.toFixed(1)}×`
    }
  }
}

function syncReviseModeUi() {
  const mode = getSelectedReviseMode()
  if (mode === 'pin') {
    setPinDrawEnabled(true)
  } else if (mode === 'region') {
    setPinDrawEnabled(false)
    setRegionDrawEnabled(true)
  } else {
    setPinDrawEnabled(false)
    setRegionDrawEnabled(false)
  }
}

function clearAllRegions() {
  const lasso = ensureReviseLasso()
  if (lasso) lasso.clearAll()
  redrawRegions()
  updateRegionList()
}

function undoLastRegion() {
  const lasso = ensureReviseLasso()
  if (!lasso || !lasso.undoLastPoint()) {
    setReviseStatus('취소할 점/선택이 없어요.', true)
    return
  }
  redrawRegions()
  updateRegionList()
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

function redrawRegions() {
  if (!regionCanvas || regionCanvas.hidden) return
  syncRegionCanvasSize()
  const ctx = regionCanvas.getContext('2d')
  const lasso = ensureReviseLasso()
  if (lasso) lasso.draw(ctx)
  else if (ctx) ctx.clearRect(0, 0, regionCanvas.width, regionCanvas.height)
}

function updateRegionList() {
  const lasso = ensureReviseLasso()
  const regions = lasso?.getRegions?.() || []
  const draft = lasso?.getDraftCount?.() || 0
  if (!regions.length && !draft) {
    regionList.hidden = true
    regionList.textContent = ''
    return
  }
  regionList.hidden = false
  const parts = regions.map((_, index) => `${index + 1}번 선택`)
  if (draft) parts.push(`그리는 중(${draft}점)`)
  regionList.textContent = parts.join(' · ')
}

/** 닫힌 다각형 합집합 → 마스크(흰=수정, 가장자리 소프트). */
function buildMaskDataUrlFromRegion() {
  const lasso = ensureReviseLasso()
  return lasso?.buildMaskDataUrl?.(768) || null
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
  const lasso = ensureReviseLasso()
  if (enabled) {
    lasso?.setEnabled(true)
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
    lasso?.setEnabled(false)
    regionList.hidden = true
  }
}

/** idle: 수정·쇼츠·수용 · revising: 수정 패널만(쇼츠는 잠깐 숨김) */
function setReviewChrome(mode) {
  const revising = mode === 'revising'
  if (reviewActions) reviewActions.hidden = revising
  revisePanel.hidden = !revising
  // 수용 전에도 쇼츠 가능 — 다듬기 중일 때만 가려 한 화면에 한 일
  if (animatePanel && currentResult.imageUrl) {
    animatePanel.hidden = revising
  }
  if (!revising) {
    setPinDrawEnabled(false)
    setRegionDrawEnabled(false)
  } else {
    syncReviseModeUi()
  }
}

function enterReviewMode() {
  currentResult.accepted = false
  reviewBadge.hidden = false
  reviewPanel.hidden = false
  acceptedActions.hidden = true
  // 수용 없이 다듬기·쇼츠 바로 가능
  if (animatePanel) animatePanel.hidden = false
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
  if (animatePanel) animatePanel.hidden = false
  setRegionDrawEnabled(false)
  updateMoveGalleryButton()
}

/** 관리자에게만 「내 갤러리 ↔ 관리자 전용 갤러리」 사이에서 이 작품을 옮길 수 있는 버튼을 보여준다.
 *  갤러리에 저장된(수용된) 작품에만 의미가 있으므로 itemId가 있을 때만 노출한다. */
function updateMoveGalleryButton() {
  if (!moveGalleryButton) return
  if (!isAdminUser() || !currentResult.itemId) {
    moveGalleryButton.hidden = true
    return
  }
  const isFashion = currentResult.genMode === 'fashion'
  moveGalleryButton.hidden = false
  moveGalleryButton.textContent = isFashion ? '내 갤러리로 이동' : '관리자 갤러리로 이동'
}

moveGalleryButton?.addEventListener('click', () => {
  const itemId = currentResult.itemId
  if (!itemId) return
  const nextMode = currentResult.genMode === 'fashion' ? 'free' : 'fashion'
  moveGalleryItem(itemId, nextMode)
  const label = nextMode === 'fashion' ? '관리자 전용 갤러리' : '내 갤러리'
  setFormStatus(`${label}로 옮겼어요.`, false)
})

function openRevisePanel() {
  reviewPanel.hidden = false
  // 기본: 찍어서 붙이기(시계·귀걸이). 옷·구도는 텍스트, 지우기는 올가미.
  const pinRadio = document.querySelector('input[name="revise-mode"][value="pin"]')
  if (pinRadio) pinRadio.checked = true
  setReviewChrome('revising')
  setReviseStatus(
    '시계·귀걸이·팔찌는 「찍어서 붙이기」로 자리를 클릭하세요. 옷·나체·구도는 「텍스트」, 목걸이 제거 등은 「올가미」.',
    false,
  )
}

function closeRevisePanel() {
  setReviewChrome('idle')
  setPinDrawEnabled(false)
  setRegionDrawEnabled(false)
  setReviseStatus('', false)
}

/** 「이전과 비교」 버튼들의 활성/문구 상태를 갱신한다. */
function updateCompareButtons() {
  const hasPrevious =
    Boolean(currentResult.previousSnapshot?.imageUrl) &&
    currentResult.previousSnapshot.imageUrl !== currentResult.imageUrl
  compareToggleButtons.forEach((btn) => {
    btn.disabled = !hasPrevious && !comparingPrevious
    btn.textContent = comparingPrevious ? '현재 결과로 복귀' : '이전과 비교'
    btn.classList.toggle('compare-toggle-btn--active', comparingPrevious)
  })
  // 「이 버전에서 다시 수정」 버튼은 실제로 이전 이미지를 보고 있는 동안에만 노출한다.
  compareRevertButtons.forEach((btn) => {
    btn.hidden = !comparingPrevious
  })
}

/** 비교 중엔 지금 보이는 이미지가 수정 전이라 "수정"만 잠긴다(어느 버전을 이어서 고칠지
 * 헷갈리지 않게, 수정하려면 먼저 「이 버전에서 다시 수정」으로 전환해야 함).
 * 「수용하기」는 잠그지 않는다 — 지금 보이는(이전) 버전을 그대로 채택하고 싶을 수도 있어서,
 * 수용 클릭 시 accept 핸들러가 스스로 currentResult를 이 버전으로 맞바꾼 뒤 저장한다. */
function setActionsLockedForCompare(locked) {
  if (reviseToggleButton) reviseToggleButton.disabled = locked
  if (reviseAgainButton) reviseAgainButton.disabled = locked
}

/** 비교 미리보기를 끄고 현재(최신) 이미지로 화면을 되돌린다. */
function exitComparePreview() {
  if (!comparingPrevious) return
  comparingPrevious = false
  resultImage.src = currentResult.imageUrl
  compareBadge.hidden = true
  setActionsLockedForCompare(false)
  updateCompareButtons()
}

/** 「이전과 비교」 버튼 클릭 — 현재 ↔ 수정 직전 이미지를 화면에서만 즉시 토글해서 보여준다(비파괴적). */
function toggleComparePrevious() {
  if (comparingPrevious) {
    exitComparePreview()
    return
  }
  if (!currentResult.previousSnapshot?.imageUrl || currentResult.previousSnapshot.imageUrl === currentResult.imageUrl) {
    setReviseStatus('비교할 이전 이미지가 없어요.', true)
    return
  }
  comparingPrevious = true
  resultImage.src = currentResult.previousSnapshot.imageUrl
  compareBadge.hidden = false
  compareBadge.textContent =
    '🔍 이전(수정 전) 이미지를 보고 있어요 · 다시 누르면 현재 결과로 돌아와요 · 「이 버전에서 다시 수정」을 누르면 여기서부터 이어서 수정할 수 있어요'
  setActionsLockedForCompare(true)
  updateCompareButtons()
}

/** 비교 중 보고 있는 이전 버전을 새 「현재 결과」로 삼아 그 시점부터 다시 수정할 수 있게 한다.
 * 완전 삭제가 아니라 현재 상태와 맞바꾸는 방식이라, 되돌린 뒤 다시 「이전과 비교」를 누르면
 * 방금까지 보고 있던(더 최신) 버전을 그대로 다시 볼 수 있다. */
function revertToPreviousSnapshot() {
  const snapshot = currentResult.previousSnapshot
  if (!snapshot?.imageUrl) return

  const displaced = snapshotCurrentResult()
  Object.assign(currentResult, snapshot, { previousSnapshot: displaced })

  comparingPrevious = false
  compareBadge.hidden = true
  resultImage.src = currentResult.imageUrl
  resultDownload.href = currentResult.imageUrl
  if (currentResult.engineLabel) {
    resultEngine.hidden = false
    resultEngine.textContent = currentResult.engineLabel
    resultEngine.className = currentResult.fallbackUsed ? 'result__engine result__engine--fallback' : 'result__engine'
  } else {
    resultEngine.hidden = true
  }
  revisionText.value = ''
  setActionsLockedForCompare(false)
  updateReviseButtonLabel()
  updateCompareButtons()
  setReviseStatus('이전 버전으로 되돌아왔어요. 여기서부터 다시 수정할 수 있어요.', false)
}

compareToggleButtons.forEach((btn) => btn.addEventListener('click', toggleComparePrevious))
compareRevertButtons.forEach((btn) => btn.addEventListener('click', revertToPreviousSnapshot))

/** 지금 화면에 떠 있는 결과 이미지의 배경을 제거해 투명 PNG로 바꿔서 새 결과로 반영한다.
 * 원본은 「이전과 비교」로 그대로 다시 볼 수 있다(showResult가 자동으로 스냅샷을 남김). */
async function removeBackgroundFromCurrentResult() {
  if (!currentResult.imageUrl) return
  if (!isLoggedIn()) {
    showPinGate('로그인이 필요해요.')
    return
  }
  if (comparingPrevious) exitComparePreview()

  removeBgButtons.forEach((btn) => {
    if (btn) btn.disabled = true
  })
  const stopTimer = startProgressTimer(setFormStatus, '배경을 제거하고 있어요…')
  try {
    const response = await fetch('/api/remove-background', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ imageUrl: currentResult.imageUrl }),
    })
    const data = await response.json().catch(() => ({}))
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
    if (!data.ok || !data.imageUrl) {
      setFormStatus(
        data.error === 'fal_key_not_configured'
          ? '배경 제거 기능이 서버에 아직 설정되지 않았어요 (FAL_KEY 필요).'
          : `배경 제거에 실패했어요: ${data.message || data.error || '알 수 없는 오류'}`,
        true,
      )
      return
    }

    showResult(data.imageUrl, currentResult.engineLabel, currentResult.fallbackUsed, {
      size: currentResult.size,
      itemId: currentResult.itemId,
      prompt: currentResult.prompt,
      accepted: currentResult.accepted,
      mood: currentResult.mood,
      engine: currentResult.engine,
      genMode: currentResult.genMode,
      reviseRound: currentResult.reviseRound,
    })
    setFormStatus('배경을 제거했어요 (투명 PNG). 「이전과 비교」로 원본과 비교할 수 있어요.', false)
  } catch (error) {
    setFormStatus(`배경 제거에 실패했어요: ${error instanceof Error ? error.message : String(error)}`, true)
  } finally {
    stopTimer()
    removeBgButtons.forEach((btn) => {
      if (btn) btn.disabled = false
    })
  }
}
removeBgButtons.forEach((btn) => btn.addEventListener('click', removeBackgroundFromCurrentResult))

/**
 * @typedef {{
 *   moundL: {x:number,y:number}|null,
 *   moundR: {x:number,y:number}|null,
 *   nippleL: {x:number,y:number}|null,
 *   nippleR: {x:number,y:number}|null,
 *   breastRadius: number,
 *   breastRadiusL: number|null,
 *   breastRadiusR: number|null,
 * }} BodyLandmarksClient
 */

/** 몸매 투영 타점 — 흰 원(유방 중심)과 빨간 점(유두)을 분리 · 우클릭으로 쪽별 제거 */
const bodyLandmarkState = {
  open: false,
  /** @type {BodyLandmarksClient} */
  landmarks: {
    moundL: { x: 0.34, y: 0.46 },
    moundR: { x: 0.46, y: 0.46 },
    nippleL: { x: 0.34, y: 0.48 },
    nippleR: { x: 0.46, y: 0.48 },
    breastRadius: 0.075,
    breastRadiusL: 0.075,
    breastRadiusR: 0.075,
  },
  /** @type {'L'|'R'} */
  selected: 'L',
  /** @type {null|'moundL'|'moundR'|'nippleL'|'nippleR'|'radiusL'|'radiusR'} */
  drag: null,
  pointerId: null,
}

const BODY_PROJECT_MOTION =
  '몸매 투영: 벨트·바지·흰팬티·이중팬티 전부 삭제 후 완전 나체. 타점 유방·유두 유지. 벨트/팬티 잔존 실패'

function defaultBodyLandmarks() {
  return {
    moundL: { x: 0.34, y: 0.46 },
    moundR: { x: 0.46, y: 0.46 },
    // 기본도 유두를 원 중심보다 살짝 아래 — 실제 체형에 가깝게
    nippleL: { x: 0.34, y: 0.485 },
    nippleR: { x: 0.46, y: 0.485 },
    breastRadius: 0.075,
    breastRadiusL: 0.075,
    breastRadiusR: 0.075,
  }
}

function clampLandmarkRadius(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0.075
  return Math.min(0.22, Math.max(0.035, v))
}

function clamp01(n) {
  return Math.min(1, Math.max(0, Number(n) || 0))
}

function syncBodyLandmarkCanvasSize() {
  if (!bodyLandmarkCanvas || !resultImage) return
  const width = Math.max(1, Math.round(resultImage.clientWidth || resultImage.getBoundingClientRect().width))
  const height = Math.max(1, Math.round(resultImage.clientHeight || resultImage.getBoundingClientRect().height))
  bodyLandmarkCanvas.style.width = `${width}px`
  bodyLandmarkCanvas.style.height = `${height}px`
  bodyLandmarkCanvas.style.left = '0'
  bodyLandmarkCanvas.style.top = '0'
  if (bodyLandmarkCanvas.width !== width || bodyLandmarkCanvas.height !== height) {
    bodyLandmarkCanvas.width = width
    bodyLandmarkCanvas.height = height
  }
}

function isBodyLandmarkSideActive(side) {
  const lm = bodyLandmarkState.landmarks
  if (side === 'R') return Boolean(lm.nippleR && lm.moundR)
  return Boolean(lm.nippleL && lm.moundL)
}

function updateBodyLandmarkReadout() {
  const el = document.getElementById('body-landmark-readout')
  if (!el) return
  const lm = bodyLandmarkState.landmarks
  const sel = bodyLandmarkState.selected === 'R' ? 'R' : 'L'
  const name = sel === 'L' ? '왼' : '오른'
  if (!isBodyLandmarkSideActive(sel)) {
    el.textContent = `${name} 유방 타점 제거됨 · 「${name} 복구」또는 AI 타점 다시`
    return
  }
  const mound = sel === 'L' ? lm.moundL : lm.moundR
  const nip = sel === 'L' ? lm.nippleL : lm.nippleR
  const r = sel === 'L' ? lm.breastRadiusL : lm.breastRadiusR
  el.textContent =
    `${name} 유방 중심 ${ (mound.x * 100).toFixed(1) }%,${ (mound.y * 100).toFixed(1) }%` +
    ` · 유두 ${ (nip.x * 100).toFixed(1) }%,${ (nip.y * 100).toFixed(1) }%` +
    ` · 크기 ${(Number(r) * 100).toFixed(1)}%` +
    ` · 우클릭=제거`
}

function syncBodyLandmarkSelectButtons() {
  document.querySelectorAll('[data-lm-select]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return
    const id = btn.getAttribute('data-lm-select')
    const active = isBodyLandmarkSideActive(id)
    btn.classList.toggle('is-selected', id === bodyLandmarkState.selected && active)
    btn.classList.toggle('is-removed', !active)
    btn.disabled = !active
    if (id === 'L') btn.textContent = active ? '왼 유방' : '왼 (제거됨)'
    if (id === 'R') btn.textContent = active ? '오른 유방' : '오른 (제거됨)'
  })
  document.querySelectorAll('[data-lm-restore]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return
    const id = btn.getAttribute('data-lm-restore')
    btn.hidden = isBodyLandmarkSideActive(id)
  })
  updateBodyLandmarkReadout()
}

function setBodyLandmarkSelected(id) {
  if (id !== 'L' && id !== 'R') return
  if (!isBodyLandmarkSideActive(id)) {
    setAnimateStatus(
      `${id === 'L' ? '왼' : '오른'} 타점은 제거된 상태예요. 「${id === 'L' ? '왼' : '오른'} 복구」를 누르세요.`,
      true,
    )
    return
  }
  bodyLandmarkState.selected = id
  syncBodyLandmarkSelectButtons()
  drawBodyLandmarkOverlay()
}

function nudgeBodyLandmark(dir) {
  const step = 0.012
  const lm = bodyLandmarkState.landmarks
  const sel = bodyLandmarkState.selected === 'R' ? 'R' : 'L'
  if (!isBodyLandmarkSideActive(sel)) return
  // 선택된 쪽: 유두를 미세 이동 (흰 원은 상대 오프셋 유지하려면 둘 다 이동)
  const moundKey = sel === 'L' ? 'moundL' : 'moundR'
  const nipKey = sel === 'L' ? 'nippleL' : 'nippleR'
  let dx = 0
  let dy = 0
  if (dir === 'left') dx = -step
  else if (dir === 'right') dx = step
  else if (dir === 'up') dy = -step
  else if (dir === 'down') dy = step
  lm[moundKey] = { x: clamp01(lm[moundKey].x + dx), y: clamp01(lm[moundKey].y + dy) }
  lm[nipKey] = { x: clamp01(lm[nipKey].x + dx), y: clamp01(lm[nipKey].y + dy) }
  drawBodyLandmarkOverlay()
  updateBodyLandmarkReadout()
}

function resizeSelectedBreast(delta) {
  const sel = bodyLandmarkState.selected
  if (sel !== 'L' && sel !== 'R') return
  if (!isBodyLandmarkSideActive(sel)) return
  const lm = bodyLandmarkState.landmarks
  const key = sel === 'L' ? 'breastRadiusL' : 'breastRadiusR'
  lm[key] = clampLandmarkRadius(Number(lm[key]) + delta * 0.01)
  const radii = [lm.breastRadiusL, lm.breastRadiusR].filter((n) => n != null && Number.isFinite(n))
  lm.breastRadius = radii.length
    ? radii.reduce((a, b) => a + b, 0) / radii.length
    : 0.075
  drawBodyLandmarkOverlay()
  updateBodyLandmarkReadout()
}

/** 우클릭 등으로 한쪽 유방 크기·유두 타점 제거 */
function removeBodyLandmarkSide(side) {
  const id = side === 'R' ? 'R' : 'L'
  if (!isBodyLandmarkSideActive(id)) return false
  const other = id === 'L' ? 'R' : 'L'
  if (!isBodyLandmarkSideActive(other)) {
    setAnimateStatus('양쪽을 모두 제거할 수 없어요. 한쪽은 남겨 주세요.', true)
    return false
  }
  const lm = bodyLandmarkState.landmarks
  if (id === 'L') {
    lm.moundL = null
    lm.nippleL = null
    lm.breastRadiusL = null
  } else {
    lm.moundR = null
    lm.nippleR = null
    lm.breastRadiusR = null
  }
  bodyLandmarkState.selected = other
  bodyLandmarkState.drag = null
  syncBodyLandmarkSelectButtons()
  drawBodyLandmarkOverlay()
  setAnimateStatus(
    `${id === 'L' ? '왼' : '오른'} 유방 타점을 제거했어요. 「${id === 'L' ? '왼' : '오른'} 복구」로 다시 놓을 수 있어요.`,
    false,
  )
  return true
}

function restoreBodyLandmarkSide(side) {
  const id = side === 'R' ? 'R' : 'L'
  if (isBodyLandmarkSideActive(id)) {
    setBodyLandmarkSelected(id)
    return
  }
  const lm = bodyLandmarkState.landmarks
  const def = defaultBodyLandmarks()
  if (id === 'L') {
    lm.moundL = { ...def.moundL }
    lm.nippleL = { ...def.nippleL }
    lm.breastRadiusL = def.breastRadiusL
  } else {
    lm.moundR = { ...def.moundR }
    lm.nippleR = { ...def.nippleR }
    lm.breastRadiusR = def.breastRadiusR
  }
  const radii = [lm.breastRadiusL, lm.breastRadiusR].filter((n) => n != null && Number.isFinite(n))
  lm.breastRadius = radii.length
    ? radii.reduce((a, b) => a + b, 0) / radii.length
    : 0.075
  bodyLandmarkState.selected = id
  syncBodyLandmarkSelectButtons()
  drawBodyLandmarkOverlay()
  setAnimateStatus(
    `${id === 'L' ? '왼' : '오른'} 유방 타점을 다시 놓았어요. 위치·크기를 맞춰 주세요.`,
    false,
  )
}

function drawBodyLandmarkOverlay() {
  if (!bodyLandmarkCanvas || bodyLandmarkCanvas.hidden) return
  syncBodyLandmarkCanvasSize()
  const ctx = bodyLandmarkCanvas.getContext('2d')
  if (!ctx) return
  const w = bodyLandmarkCanvas.width
  const h = bodyLandmarkCanvas.height
  const lm = bodyLandmarkState.landmarks
  const minSide = Math.min(w, h)
  ctx.clearRect(0, 0, w, h)

  const drawSide = (mound, nipple, radiusNorm, id, label) => {
    const mx = mound.x * w
    const my = mound.y * h
    const nx = nipple.x * w
    const ny = nipple.y * h
    const r = Math.max(14, (radiusNorm || 0.075) * minSide)
    const selected = bodyLandmarkState.selected === id
    // 흰 원 = 유방
    ctx.beginPath()
    ctx.arc(mx, my, r, 0, Math.PI * 2)
    ctx.fillStyle = selected ? 'rgba(255, 255, 255, 0.32)' : 'rgba(255, 255, 255, 0.18)'
    ctx.fill()
    ctx.lineWidth = selected ? Math.max(3, r * 0.08) : Math.max(2, r * 0.055)
    ctx.strokeStyle = selected ? 'rgba(169, 139, 255, 0.98)' : 'rgba(255, 255, 255, 0.95)'
    ctx.stroke()
    // 크기 핸들
    ctx.beginPath()
    ctx.arc(mx + r, my, Math.max(5, r * 0.16), 0, Math.PI * 2)
    ctx.fillStyle = selected ? 'rgba(169, 139, 255, 0.95)' : 'rgba(255, 255, 255, 0.85)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(20, 16, 28, 0.55)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    // 유두가 원 중심과 다르면 얇은 가이드 선
    if (Math.hypot(nx - mx, ny - my) > 2) {
      ctx.beginPath()
      ctx.moveTo(mx, my)
      ctx.lineTo(nx, ny)
      ctx.strokeStyle = 'rgba(220, 40, 40, 0.35)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
    // 빨간 점 = 유두 (독립 위치)
    const dot = Math.max(4.5, r * 0.16)
    ctx.beginPath()
    ctx.arc(nx, ny, dot, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(220, 40, 40, 0.95)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.stroke()
    ctx.font = `600 ${Math.max(11, Math.round(minSide * 0.028))}px sans-serif`
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.lineWidth = 3
    ctx.strokeText(label, mx + r * 0.35, my - r * 0.75)
    ctx.fillText(label, mx + r * 0.35, my - r * 0.75)
  }

  if (lm.moundL && lm.nippleL) {
    drawSide(lm.moundL, lm.nippleL, lm.breastRadiusL || 0.075, 'L', 'L')
  }
  if (lm.moundR && lm.nippleR) {
    drawSide(lm.moundR, lm.nippleR, lm.breastRadiusR || 0.075, 'R', 'R')
  }
  updateBodyLandmarkReadout()
}

function hitBodyLandmark(clientX, clientY) {
  if (!bodyLandmarkCanvas) return null
  const rect = bodyLandmarkCanvas.getBoundingClientRect()
  const x = ((clientX - rect.left) / Math.max(1, rect.width)) * bodyLandmarkCanvas.width
  const y = ((clientY - rect.top) / Math.max(1, rect.height)) * bodyLandmarkCanvas.height
  const w = bodyLandmarkCanvas.width
  const h = bodyLandmarkCanvas.height
  const lm = bodyLandmarkState.landmarks
  const minSide = Math.min(w, h)
  const nipHit = Math.max(14, minSide * 0.028)

  // 1) 빨간 유두 점 우선
  if (lm.nippleL) {
    const nlx = lm.nippleL.x * w
    const nly = lm.nippleL.y * h
    if (Math.hypot(x - nlx, y - nly) <= nipHit) return 'nippleL'
  }
  if (lm.nippleR) {
    const nrx = lm.nippleR.x * w
    const nry = lm.nippleR.y * h
    if (Math.hypot(x - nrx, y - nry) <= nipHit) return 'nippleR'
  }
  // 2) 크기 핸들 · 3) 흰 원
  const hits = []
  if (lm.moundL) {
    const rL = Math.max(14, (lm.breastRadiusL || 0.075) * minSide)
    const mlx = lm.moundL.x * w
    const mly = lm.moundL.y * h
    if (Math.hypot(x - (mlx + rL), y - mly) <= Math.max(12, rL * 0.28)) return 'radiusL'
    hits.push({ id: 'moundL', x: mlx, y: mly, hitR: rL })
  }
  if (lm.moundR) {
    const rR = Math.max(14, (lm.breastRadiusR || 0.075) * minSide)
    const mrx = lm.moundR.x * w
    const mry = lm.moundR.y * h
    if (Math.hypot(x - (mrx + rR), y - mry) <= Math.max(12, rR * 0.28)) return 'radiusR'
    hits.push({ id: 'moundR', x: mrx, y: mry, hitR: rR })
  }
  let best = null
  let bestD = Infinity
  for (const hit of hits) {
    const d = Math.hypot(x - hit.x, y - hit.y)
    if (d <= hit.hitR && d < bestD) {
      best = hit.id
      bestD = d
    }
  }
  return best
}

function sideFromLandmarkHit(hit) {
  if (!hit) return null
  if (hit.endsWith('L') || hit === 'moundL' || hit === 'nippleL' || hit === 'radiusL') return 'L'
  if (hit.endsWith('R') || hit === 'moundR' || hit === 'nippleR' || hit === 'radiusR') return 'R'
  return null
}

function onBodyLandmarkContextMenu(event) {
  if (!bodyLandmarkState.open || !bodyLandmarkCanvas) return
  event.preventDefault()
  event.stopPropagation()
  const hit = hitBodyLandmark(event.clientX, event.clientY)
  const side = sideFromLandmarkHit(hit)
  if (!side) {
    setAnimateStatus('제거할 타점 위(흰 원·빨간 점·크기 핸들)에서 우클릭하세요.', true)
    return
  }
  removeBodyLandmarkSide(side)
}

function onBodyLandmarkPointerDown(event) {
  if (!bodyLandmarkState.open || !bodyLandmarkCanvas) return
  // 우클릭은 contextmenu에서 제거 처리 — 드래그 시작 금지
  if (event.button != null && event.button !== 0) return
  const hit = hitBodyLandmark(event.clientX, event.clientY)
  if (!hit) return
  event.preventDefault()
  event.stopPropagation()
  bodyLandmarkState.drag = hit
  bodyLandmarkState.pointerId = event.pointerId
  if (hit === 'moundL' || hit === 'nippleL' || hit === 'radiusL') setBodyLandmarkSelected('L')
  else if (hit === 'moundR' || hit === 'nippleR' || hit === 'radiusR') setBodyLandmarkSelected('R')
  bodyLandmarkCanvas.setPointerCapture?.(event.pointerId)
  bodyLandmarkCanvas.classList.add('is-dragging')
}

function onBodyLandmarkPointerMove(event) {
  if (!bodyLandmarkState.open || bodyLandmarkState.drag == null) return
  if (bodyLandmarkState.pointerId != null && event.pointerId !== bodyLandmarkState.pointerId) return
  event.preventDefault()
  const rect = bodyLandmarkCanvas.getBoundingClientRect()
  const nx = clamp01((event.clientX - rect.left) / Math.max(1, rect.width))
  const ny = clamp01((event.clientY - rect.top) / Math.max(1, rect.height))
  const lm = bodyLandmarkState.landmarks
  const drag = bodyLandmarkState.drag
  if (drag === 'nippleL' && lm.nippleL) {
    lm.nippleL = { x: nx, y: ny }
  } else if (drag === 'nippleR' && lm.nippleR) {
    lm.nippleR = { x: nx, y: ny }
  } else if (drag === 'moundL' && lm.moundL && lm.nippleL) {
    const dx = nx - lm.moundL.x
    const dy = ny - lm.moundL.y
    lm.moundL = { x: nx, y: ny }
    // 원 이동 시 유두 상대 위치 유지
    lm.nippleL = { x: clamp01(lm.nippleL.x + dx), y: clamp01(lm.nippleL.y + dy) }
  } else if (drag === 'moundR' && lm.moundR && lm.nippleR) {
    const dx = nx - lm.moundR.x
    const dy = ny - lm.moundR.y
    lm.moundR = { x: nx, y: ny }
    lm.nippleR = { x: clamp01(lm.nippleR.x + dx), y: clamp01(lm.nippleR.y + dy) }
  } else if ((drag === 'radiusL' && lm.moundL) || (drag === 'radiusR' && lm.moundR)) {
    const cx = drag === 'radiusL' ? lm.moundL.x : lm.moundR.x
    const cy = drag === 'radiusL' ? lm.moundL.y : lm.moundR.y
    const minSide = Math.min(bodyLandmarkCanvas.width, bodyLandmarkCanvas.height)
    const dist = Math.hypot((nx - cx) * bodyLandmarkCanvas.width, (ny - cy) * bodyLandmarkCanvas.height)
    const r = clampLandmarkRadius(dist / Math.max(1, minSide))
    if (drag === 'radiusL') lm.breastRadiusL = r
    else lm.breastRadiusR = r
    const radii = [lm.breastRadiusL, lm.breastRadiusR].filter((n) => n != null && Number.isFinite(n))
    lm.breastRadius = radii.length
      ? radii.reduce((a, b) => a + b, 0) / radii.length
      : r
  }
  drawBodyLandmarkOverlay()
}

function onBodyLandmarkPointerUp(event) {
  if (bodyLandmarkState.pointerId != null && event.pointerId !== bodyLandmarkState.pointerId) return
  bodyLandmarkState.drag = null
  bodyLandmarkState.pointerId = null
  bodyLandmarkCanvas?.classList.remove('is-dragging')
  updateBodyLandmarkReadout()
}

function closeBodyLandmarkEditor() {
  bodyLandmarkState.open = false
  bodyLandmarkState.drag = null
  bodyLandmarkState.pointerId = null
  if (bodyLandmarkCanvas) {
    bodyLandmarkCanvas.hidden = true
    bodyLandmarkCanvas.classList.remove('is-dragging')
  }
  if (bodyLandmarkToolbar) bodyLandmarkToolbar.hidden = true
  resultStage?.classList.remove('result__stage--landmarks')
}

/**
 * 서버(Claude Vision)가 이미지를 보고 유방 중심·유두 타점을 추정.
 * @returns {Promise<BodyLandmarksClient|null>}
 */
async function detectBodyLandmarksFromAi() {
  if (!currentResult.imageUrl && !currentResult.imageDataUrl) return null
  try {
    if (!currentResult.imageDataUrl && currentResult.imageUrl) {
      await cacheImageForAnimate(currentResult.imageUrl)
    }
    const response = await fetch('/api/body-landmarks', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        imageUrl: currentResult.imageUrl || undefined,
        imageDataUrl: currentResult.imageDataUrl || undefined,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!data?.ok || !data.landmarks) return null
    const raw = data.landmarks
    if (!raw.nippleL || !raw.nippleR) return null
    const rL = clampLandmarkRadius(raw.breastRadiusL ?? raw.breastRadius ?? 0.08)
    const rR = clampLandmarkRadius(raw.breastRadiusR ?? raw.breastRadius ?? 0.08)
    const nippleL = { x: clamp01(raw.nippleL.x), y: clamp01(raw.nippleL.y) }
    const nippleR = { x: clamp01(raw.nippleR.x), y: clamp01(raw.nippleR.y) }
    const moundL = raw.moundL
      ? { x: clamp01(raw.moundL.x), y: clamp01(raw.moundL.y) }
      : { x: nippleL.x, y: clamp01(nippleL.y - 0.015) }
    const moundR = raw.moundR
      ? { x: clamp01(raw.moundR.x), y: clamp01(raw.moundR.y) }
      : { x: nippleR.x, y: clamp01(nippleR.y - 0.015) }
    return {
      moundL,
      moundR,
      nippleL,
      nippleR,
      breastRadiusL: rL,
      breastRadiusR: rR,
      breastRadius: (rL + rR) / 2,
    }
  } catch {
    return null
  }
}

function applyBodyLandmarksClient(lm) {
  if (!lm) return
  bodyLandmarkState.landmarks = {
    moundL: lm.moundL ? { ...lm.moundL } : null,
    moundR: lm.moundR ? { ...lm.moundR } : null,
    nippleL: lm.nippleL ? { ...lm.nippleL } : null,
    nippleR: lm.nippleR ? { ...lm.nippleR } : null,
    breastRadiusL: lm.nippleL ? lm.breastRadiusL ?? 0.075 : null,
    breastRadiusR: lm.nippleR ? lm.breastRadiusR ?? 0.075 : null,
    breastRadius: lm.breastRadius ?? 0.075,
  }
  if (!isBodyLandmarkSideActive('L') && isBodyLandmarkSideActive('R')) {
    bodyLandmarkState.selected = 'R'
  } else if (!isBodyLandmarkSideActive('R') && isBodyLandmarkSideActive('L')) {
    bodyLandmarkState.selected = 'L'
  }
  syncBodyLandmarkSelectButtons()
  drawBodyLandmarkOverlay()
  updateBodyLandmarkReadout()
}

function openBodyLandmarkEditor() {
  if (!resultImage?.src || !currentResult.imageUrl) {
    setAnimateStatus('먼저 이미지를 생성하거나 불러와 주세요.', true)
    return false
  }
  try {
    setRegionDrawEnabled?.(false)
    setPinDrawEnabled?.(false)
  } catch {
    /* ignore */
  }
  if (regionCanvas) regionCanvas.hidden = true
  bodyLandmarkState.open = true
  bodyLandmarkState.landmarks = defaultBodyLandmarks()
  bodyLandmarkState.selected = 'L'
  if (bodyLandmarkCanvas) bodyLandmarkCanvas.hidden = false
  const toolbar = bodyLandmarkToolbar || document.getElementById('body-landmark-toolbar')
  if (toolbar) {
    toolbar.hidden = false
    toolbar.style.pointerEvents = 'auto'
  }
  resultStage?.classList.add('result__stage--landmarks')
  syncBodyLandmarkSelectButtons()
  resultSection?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  toolbar?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  const ready = () => {
    drawBodyLandmarkOverlay()
  }
  if (resultImage.complete && resultImage.naturalWidth > 0) ready()
  else resultImage.addEventListener('load', ready, { once: true })
  requestAnimationFrame(ready)
  setAnimateStatus('AI가 유방 원·유두 점을 체형에 맞게 잡는 중…', false)
  void (async () => {
    const aiLm = await detectBodyLandmarksFromAi()
    if (!bodyLandmarkState.open) return
    if (aiLm) {
      applyBodyLandmarksClient(aiLm)
      setAnimateStatus(
        'AI 제시 완료. 흰 원=유방 이동 · 빨간 점=유두만 이동 · 가장자리=크기. 수정 후 투영하세요.',
        false,
      )
    } else {
      setAnimateStatus('AI 타점 실패 — 기본 위치입니다. 원과 점을 직접 맞춰 주세요.', true)
    }
  })()
  return true
}

/**
 * 「몸매 투영 쇼츠」— 먼저 타점 UI, 확인 후 I2V.
 */
function startBodyProjectShorts() {
  const btn = bodyProjectShortsButton || document.getElementById('body-project-shorts-button')
  if (btn?.disabled && bodyProjectUiMode === 'working') return

  if (!currentResult.imageUrl) {
    setAnimateStatus('먼저 이미지를 생성하거나 불러와 주세요.', true)
    return
  }
  if (!isLoggedIn()) {
    showPinGate('로그인이 필요해요.')
    return
  }
  if (comparingPrevious) exitComparePreview()
  if (animatePanel) {
    animatePanel.hidden = false
    animatePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  if (motionField) motionField.value = BODY_PROJECT_MOTION
  setBodyProjectButtonUi('landmark')
  if (!openBodyLandmarkEditor()) {
    resetBodyProjectButtonUi()
    return
  }
  animateStatus?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

async function confirmBodyLandmarkAndAnimate() {
  if (!bodyLandmarkState.open) return
  const lm = bodyLandmarkState.landmarks
  if (!isBodyLandmarkSideActive('L') && !isBodyLandmarkSideActive('R')) {
    setAnimateStatus('유방 타점이 없어요. 복구하거나 AI 타점을 다시 잡으세요.', true)
    return
  }
  const landmarks = {
    ...(lm.moundL && lm.nippleL
      ? {
          moundL: { ...lm.moundL },
          nippleL: { ...lm.nippleL },
          breastRadiusL: lm.breastRadiusL ?? 0.075,
        }
      : {}),
    ...(lm.moundR && lm.nippleR
      ? {
          moundR: { ...lm.moundR },
          nippleR: { ...lm.nippleR },
          breastRadiusR: lm.breastRadiusR ?? 0.075,
        }
      : {}),
    breastRadius: lm.breastRadius || 0.075,
  }
  const radii = [landmarks.breastRadiusL, landmarks.breastRadiusR].filter((n) => n != null)
  if (radii.length) {
    landmarks.breastRadius = radii.reduce((a, b) => a + b, 0) / radii.length
  }
  closeBodyLandmarkEditor()

  if (motionField) motionField.value = BODY_PROJECT_MOTION
  setBodyProjectButtonUi('working')
  const lTxt = landmarks.nippleL
    ? `L(${(landmarks.nippleL.x * 100).toFixed(0)},${(landmarks.nippleL.y * 100).toFixed(0)})`
    : 'L(제거)'
  const rTxt = landmarks.nippleR
    ? `R(${(landmarks.nippleR.x * 100).toFixed(0)},${(landmarks.nippleR.y * 100).toFixed(0)})`
    : 'R(제거)'
  setAnimateStatus(`타점 고정 투영… 유두 ${lTxt} ${rTxt}`, false)
  animateStatus?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

  const dur = getSelectedVideoDuration()
  try {
    if (isDualFrameDuration(dur)) {
      if (motion2Field && !(motion2Field.value || '').trim()) {
        motion2Field.value = '이미 나체 유지하며 자연스럽게 숨 쉬고 살짝 미소한다'
      }
      syncDualFrameUi(dur)
      await requestDualFrameShorts(dur, {
        bodyProjectFirst: true,
        landmarks,
      })
      return
    }

    await requestAnimate({
      motionOverride: BODY_PROJECT_MOTION,
      bodyProject: true,
      statusPrefix: '몸매 투영',
      landmarks,
    })
  } catch (error) {
    setAnimateBusy(false)
    resetBodyProjectButtonUi()
    setAnimateStatus(
      `몸매 투영 쇼츠 실패: ${error instanceof Error ? error.message : String(error)}`,
      true,
    )
  }
}

bodyLandmarkCanvas?.addEventListener('pointerdown', onBodyLandmarkPointerDown)
bodyLandmarkCanvas?.addEventListener('pointermove', onBodyLandmarkPointerMove)
bodyLandmarkCanvas?.addEventListener('pointerup', onBodyLandmarkPointerUp)
bodyLandmarkCanvas?.addEventListener('pointercancel', onBodyLandmarkPointerUp)
bodyLandmarkCanvas?.addEventListener('contextmenu', onBodyLandmarkContextMenu)

// 위임 — 선택/미세이동/크기/확정 버튼
function onBodyLandmarkToolbarClick(event) {
  const target = event.target
  if (!(target instanceof Element)) return
  if (!target.closest('#body-landmark-toolbar')) return

  const restoreBtn = target.closest('[data-lm-restore]')
  if (restoreBtn instanceof HTMLElement) {
    event.preventDefault()
    event.stopPropagation()
    restoreBodyLandmarkSide(restoreBtn.getAttribute('data-lm-restore') || 'L')
    return
  }
  const selectBtn = target.closest('[data-lm-select]')
  if (selectBtn instanceof HTMLElement) {
    event.preventDefault()
    event.stopPropagation()
    setBodyLandmarkSelected(selectBtn.getAttribute('data-lm-select') || 'L')
    return
  }
  const nudgeBtn = target.closest('[data-lm-nudge]')
  if (nudgeBtn instanceof HTMLElement) {
    event.preventDefault()
    event.stopPropagation()
    nudgeBodyLandmark(nudgeBtn.getAttribute('data-lm-nudge') || '')
    return
  }
  const sizeBtn = target.closest('[data-lm-size]')
  if (sizeBtn instanceof HTMLElement) {
    event.preventDefault()
    event.stopPropagation()
    resizeSelectedBreast(Number(sizeBtn.getAttribute('data-lm-size')) || 0)
    return
  }

  const auto = target.closest('#body-landmark-auto')
  const confirm = target.closest('#body-landmark-confirm')
  const cancel = target.closest('#body-landmark-cancel')
  if (!auto && !confirm && !cancel) return
  event.preventDefault()
  event.stopPropagation()
  if (auto) {
    setAnimateStatus('AI가 그림을 보고 타점을 다시 잡는 중…', false)
    void (async () => {
      const aiLm = await detectBodyLandmarksFromAi()
      if (!bodyLandmarkState.open) return
      if (aiLm) {
        applyBodyLandmarksClient(aiLm)
        bodyLandmarkState.selected = 'L'
        syncBodyLandmarkSelectButtons()
        setAnimateStatus('AI 타점 다시 제시됨. 흰 원·빨간 점을 각각 수정한 뒤 투영하세요.', false)
      } else {
        bodyLandmarkState.landmarks = defaultBodyLandmarks()
        bodyLandmarkState.selected = 'L'
        syncBodyLandmarkSelectButtons()
        drawBodyLandmarkOverlay()
        setAnimateStatus('AI 타점 실패 — 기본 위치로 되돌렸습니다.', true)
      }
    })()
    return
  }
  if (confirm) {
    void confirmBodyLandmarkAndAnimate()
    return
  }
  if (cancel) {
    closeBodyLandmarkEditor()
    resetBodyProjectButtonUi()
    setAnimateStatus('몸매 투영 타점을 취소했어요.', false)
  }
}
document.getElementById('result-section')?.addEventListener('click', onBodyLandmarkToolbarClick)

window.addEventListener('resize', () => {
  if (bodyLandmarkState.open) drawBodyLandmarkOverlay()
})
window.addEventListener('keydown', (event) => {
  if (!bodyLandmarkState.open) return
  const tag = (event.target instanceof HTMLElement ? event.target.tagName : '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    nudgeBodyLandmark('left')
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    nudgeBodyLandmark('right')
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    nudgeBodyLandmark('up')
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    nudgeBodyLandmark('down')
  } else if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    resizeSelectedBreast(1)
  } else if (event.key === '-' || event.key === '_') {
    event.preventDefault()
    resizeSelectedBreast(-1)
  } else if (event.key === '1') setBodyLandmarkSelected('L')
  else if (event.key === '2') setBodyLandmarkSelected('R')
  else if (event.key === '3') setBodyLandmarkSelected('N')
})

// 클릭 위임 — 캐시·재렌더 후에도 동작하도록 actions 컨테이너에 연결
document.getElementById('animate-panel')?.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  const btn = target.closest('#body-project-shorts-button')
  if (!btn) return
  event.preventDefault()
  event.stopPropagation()
  startBodyProjectShorts()
})

/** 이미지 URL이 만료되기 전에 서버로 바이트를 읽어 메모리에 보관 */
async function cacheImageForAnimate(imageUrl) {
  if (!imageUrl || !isLoggedIn()) return
  const token = imageUrl
  try {
    const response = await fetch('/api/media-bytes', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ imageUrl }),
    })
    const data = await response.json().catch(() => ({}))
    if (data?.ok && data.dataUrl && currentResult.imageUrl === token) {
      currentResult.imageDataUrl = data.dataUrl
    }
  } catch {
    /* 캐시 실패해도 영상 요청 시 URL 재시도 */
  }
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
    genMode = currentResult.genMode || getGenMode(),
    reviseRound = currentResult.reviseRound || 0,
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
    currentResult.previousSnapshot = snapshotCurrentResult()
    // 이미지가 실제로 바뀌면(새 생성/수정/다른 갤러리 항목) 이전 이미지용 모션 힌트는
    // 더 이상 유효하지 않다 — 지우지 않으면 "이전 요청과 무관하게 옛 모션이 그대로
    // 적용되는" 문제가 생긴다.
    if (motionField) motionField.value = ''
  }
  currentResult.imageUrl = imageUrl
  // 합성·끝프레임 등은 data URL — null로 비우면 쇼츠가 image_url_not_allowed 로 실패함
  if (typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
    currentResult.imageDataUrl = imageUrl
  } else {
    currentResult.imageDataUrl = null
    void cacheImageForAnimate(imageUrl)
  }
  currentResult.prompt = prompt || ''
  currentResult.size = size
  currentResult.itemId = itemId
  currentResult.mood = mood
  currentResult.engineLabel = engineLabel || ''
  currentResult.fallbackUsed = Boolean(fallbackUsed)
  currentResult.engine = engine || ''
  currentResult.genMode = genMode === 'fashion' ? 'fashion' : 'free'
  currentResult.reviseRound = reviseRound || 0
  updateReviseButtonLabel()
  setAnimateStatus('', false)
  revisionText.value = ''

  // 새 결과가 들어오면 이전 비교 미리보기는 항상 해제하고 버튼 상태를 새로 계산한다.
  comparingPrevious = false
  compareBadge.hidden = true
  setActionsLockedForCompare(false)
  updateCompareButtons()

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

/** 화보(관리자 전용) 모드로 만든 이미지와 자유 일러스트 이미지를 물리적으로 분리해서 각자의
 *  그리드에 렌더링한다 — 「내 갤러리」는 자유 이미지만, 「관리자 전용 갤러리」는 화보 이미지만 보여준다. */
function renderGallery() {
  const items = readGallery()
  const freeItems = items.filter((item) => item.genMode !== 'fashion')
  const adminItems = items.filter((item) => item.genMode === 'fashion')

  renderGalleryInto(freeItems, galleryGrid, galleryEmpty, 'free')
  if (adminGalleryGrid && adminGalleryEmpty) {
    renderGalleryInto(adminItems, adminGalleryGrid, adminGalleryEmpty, 'fashion')
  }
}

/** 저장된 항목의 genMode를 바꿔서 「내 갤러리」 ↔ 「관리자 전용 갤러리」 사이로 옮긴다. */
function moveGalleryItem(itemId, nextMode) {
  const items = readGallery()
  const index = items.findIndex((entry) => entry.id === itemId)
  if (index === -1) return
  items[index] = { ...items[index], genMode: nextMode }
  writeGallery(items)
  renderGallery()
  if (currentResult.itemId === itemId) {
    currentResult.genMode = nextMode
    updateMoveGalleryButton()
    syncResultVisibilityForArea(getGenMode())
  }
}

function renderGalleryInto(items, gridEl, emptyEl, currentMode) {
  gridEl.innerHTML = ''
  emptyEl.hidden = items.length > 0

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

      // 버튼이 여러 개 겹쳐 덕지덕지 붙어 보이던 문제 — 체크박스 하나로 감춰두고,
      // 체크하면 드롭다운(select)으로 작업(쇼츠/이동/삭제)을 고르게 한다.
      const menuToggleLabel = document.createElement('label')
      menuToggleLabel.className = 'gallery__item-menu-toggle'
      const menuCheckbox = document.createElement('input')
      menuCheckbox.type = 'checkbox'
      menuToggleLabel.appendChild(menuCheckbox)
      menuToggleLabel.addEventListener('click', (event) => event.stopPropagation())
      cell.appendChild(menuToggleLabel)

      const menuSelect = document.createElement('select')
      menuSelect.className = 'gallery__item-menu'
      menuSelect.hidden = true
      const menuOptions = [{ value: '', label: '작업 선택…' }]
      menuOptions.push({
        value: 'shorts',
        // "YouTube 올리기"라고만 쓰면 클릭 즉시 실제로 업로드되는 것처럼 보이지만, 실제로는
        // 결과 패널을 열어줄 뿐이다(실제 준비는 그 안의 "한 번에 준비" 버튼을 눌러야 함) —
        // 오해를 줄이기 위해 "준비"를 붙인다.
        label: item.videoUrl ? 'YouTube 올리기 준비' : '쇼츠 비디오 만들기',
      })
      if (isAdminUser()) {
        menuOptions.push({
          value: 'move',
          label: currentMode === 'fashion' ? '내 갤러리로 이동' : '관리자 갤러리로 이동',
        })
      }
      menuOptions.push({ value: 'delete', label: '삭제' })
      menuOptions.forEach(({ value, label }) => {
        const option = document.createElement('option')
        option.value = value
        option.textContent = label
        menuSelect.appendChild(option)
      })
      menuSelect.addEventListener('click', (event) => event.stopPropagation())
      menuCheckbox.addEventListener('click', (event) => event.stopPropagation())
      menuCheckbox.addEventListener('change', () => {
        menuSelect.hidden = !menuCheckbox.checked
      })
      menuSelect.addEventListener('change', () => {
        const action = menuSelect.value
        menuSelect.value = ''
        menuCheckbox.checked = false
        menuSelect.hidden = true
        if (action === 'delete') {
          if (!window.confirm('이 항목을 삭제할까요? (영구 저장된 파일도 함께 삭제돼요)')) return
          deletePermanentMediaIfNeeded(item.imageUrl)
          deletePermanentMediaIfNeeded(item.videoUrl)
          const remaining = readGallery().filter((entry) => entry.id !== item.id)
          writeGallery(remaining)
          renderGallery()
          return
        }
        if (action === 'move') {
          moveGalleryItem(item.id, currentMode === 'fashion' ? 'free' : 'fashion')
          return
        }
        if (action === 'shorts') {
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
            genMode: item.genMode,
            reviseRound: item.reviseRound || 0,
          })
          // 예전엔 여기서 곧바로 requestAnimate()를 호출해서, 모션 힌트를 확인/입력할
          // 기회도 없이 (게다가 이전 이미지용으로 남아있던 모션 힌트 그대로) 영상 생성이
          // 시작되는 문제가 있었다. 이제는 애니메이트 패널로 이동만 시키고, 사용자가
          // 모션 힌트를 확인한 뒤 직접 「쇼츠 비디오 만들기」를 눌러야 생성이 시작된다.
          if (!item.videoUrl) {
            animatePanel.scrollIntoView({ behavior: 'smooth', block: 'start' })
            motionField?.focus()
            setAnimateStatus('모션 힌트를 확인하거나 입력한 뒤 「쇼츠 비디오 만들기」를 눌러 주세요.', false)
          } else {
            // "YouTube 올리기 준비"를 눌러도 자동으로 업로드되지 않는다 — YouTube Data API
            // 연동이 없어서, 실제로는 이 패널에서 "한 번에 준비" 버튼을 직접 눌러야
            // 영상 다운로드 + 제목·설명 복사 + 업로드 창 열기가 진행된다. 패널로 스크롤하고
            // 그 사실을 명확히 안내한다.
            document.getElementById('youtube-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            setYoutubeStatus('아래 「한 번에 준비」를 누르면 영상 받기·제목·설명 복사·YouTube 열기가 순서대로 진행돼요.', false)
          }
        }
      })
      cell.appendChild(menuSelect)

      cell.addEventListener('click', (event) => {
        if (event.target === menuToggleLabel || event.target === menuCheckbox || event.target === menuSelect) return
        showResult(item.imageUrl, item.engineLabel, item.fallbackUsed, {
          size: item.size,
          itemId: item.id,
          videoUrl: item.videoUrl,
          prompt: item.description || item.prompt || '',
          youtubeDraft: item.youtubeDraft || null,
          accepted: true,
          mood: item.mood,
          engine: item.engine,
          genMode: item.genMode,
          reviseRound: item.reviseRound || 0,
        })
      })

      gridEl.appendChild(cell)
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

/** 가이드(주부/술부/형용사/목적어/보어) + 캐릭터 설명 입력을 모두 비워서 새 장면을 시작할 수 있게 한다. */
function resetGuideFields() {
  if (guideWhoField) guideWhoField.value = ''
  if (guideActionField) guideActionField.value = ''
  GUIDE_DROPDOWN_IDS.forEach((id) => {
    const selectEl = document.getElementById(id)
    if (selectEl) selectEl.value = ''
    const custom = guideCustomEl(id)
    if (custom) {
      custom.value = ''
      custom.hidden = true
    }
  })
  syncGuideDetailVisibility()
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
  t = t.replace(/잇어요/g, '있어요')
  t = t.replace(/잆학/g, '입학')
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
  // 가이드가 바뀌면 컨셉 설명에 반영하되, 사용자가 직접 쓴/AI가 채운 설명이 있으면
  // (guideDescLocked) 덮어쓰지 않는다. 예전엔 여기서 무조건 force=true를 써서, 드롭다운
  // 하나만 바꿔도 애써 쓴 설명이 가이드 문장으로 통째로 교체되는 버그가 있었다.
  syncDescriptionFromGuide(false)
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

function animateErrorMessage(data, response) {
  const code = data?.error || ''
  const detail = String(data?.message || '').trim()
  const map = {
    replicate_token_not_configured: '영상 엔진 토큰이 설정되지 않았어요.',
    image_url_required: '원본 이미지가 없어요.',
    image_url_not_allowed:
      '이 이미지 주소로는 영상을 만들 수 없어요. 앱에서 생성·수용한 이미지를 사용해 주세요.',
    content_policy_blocked: '정책에 의해 차단된 표현이 포함되어 있어요.',
    video_generation_failed: detail || 'Replicate 영상 생성이 실패했어요.',
    video_status_failed: detail || '영상 상태 조회에 실패했어요.',
    prediction_id_required: '영상 작업 ID가 없어요. 다시 시작해 주세요.',
    missing_replicate_token: 'Replicate 토큰이 없어요.',
    missing_image_url: '원본 이미지 URL이 없어요.',
    source_image_expired:
      '원본 이미지 링크가 만료됐어요. 이미지를 다시 생성한 뒤, 바로 쇼츠를 만들어 주세요.',
    source_image_fetch_failed: '원본 이미지를 불러오지 못했어요. 이미지를 다시 생성해 주세요.',
    source_image_too_large: '원본 이미지가 너무 커요. 다시 생성해 주세요.',
    source_image_empty: '원본 이미지가 비어 있어요. 다시 생성해 주세요.',
    invalid_image_data_url: '저장된 이미지 형식이 올바르지 않아요. 이미지를 다시 생성해 주세요.',
    rate_limited: detail || '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
  }
  if (code === 'rate_limited') {
    const sec = Number(data?.retryAfterSec)
    if (Number.isFinite(sec) && sec > 0) {
      if (sec >= 3600) return `요청이 너무 많아요. 약 ${Math.ceil(sec / 3600)}시간 뒤에 다시 시도해 주세요.`
      if (sec >= 60) return `요청이 너무 많아요. 약 ${Math.ceil(sec / 60)}분 뒤에 다시 시도해 주세요.`
      return `요청이 너무 많아요. 약 ${Math.ceil(sec)}초 뒤에 다시 시도해 주세요.`
    }
    return map.rate_limited
  }
  if (map[code]) return map[code]
  if (/404|Not Found|replicate\.delivery/i.test(detail)) {
    return '원본 이미지 링크가 만료됐어요. 이미지를 다시 생성한 뒤, 바로 쇼츠를 만들어 주세요.'
  }
  if (detail) return detail
  if (code) return code
  if (response && response.status === 429) {
    return detail || '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
  }
  if (response && (response.status === 504 || response.status === 524 || response.status === 502)) {
    return '서버/게이트웨이 오류예요. 새로고침 후 다시 시도해 주세요. (엔진 시작이 끊긴 경우일 수 있어요)'
  }
  if (response && !response.ok) return `요청 실패 (HTTP ${response.status})`
  return '알 수 없는 오류'
}

async function pollAnimateUntilDone(predictionId, durationSec, speedLabel, onTick) {
  const maxAttempts = 60 // ~3분 (3초 간격)
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 3000))
    if (typeof onTick === 'function') onTick(attempt * 3)

    const response = await fetch('/api/animate-status', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ predictionId, durationSec }),
    })
    const data = await response.json().catch(() => ({}))

    if (response.status === 401) {
      clearAllAuth()
      showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
      return null
    }
    if (!data.ok && data.status === 'failed') {
      throw new Error(animateErrorMessage(data, response))
    }
    if (!data.ok && !data.pending) {
      throw new Error(animateErrorMessage(data, response))
    }
    if (data.ok && data.videoUrl && !data.pending) {
      return data
    }
  }
  throw new Error('영상 생성이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요.')
}

/**
 * 백엔드 /api/animate 호출 후, 필요 시 /api/animate-status 폴링.
 * (Cloudflare 30초 한도 — 서버에서 길게 기다리지 않음)
 */
// 한국어는 명사(속옷/옷/가운)와 동사(제거/벗) 사이에 조사(을/를 등)가 붙는 게 자연스러운
// 말투다("속옷을 벗겨줘") — 서버쪽 wantsUndressAction과 동일한 조사 허용 로직을 클라이언트
// 상태 문구 표시용으로도 맞춰둔다(그냥 \s*만 쓰면 조사 붙은 문장을 놓쳐서 상태 문구가
// "탈의·누드 모션" 안내를 못 보여줌).
function wantsUndressActionClient(text) {
  const t = (text || '').trim()
  if (!t) return false
  const gap = '(?:을|를|이|가|은|는|도)?\\s*'
  return new RegExp(
    `누드|나체|nude|naked|탈의|벗기|벗겨|벗어|벗는|속옷${gap}제거|옷${gap}벗|가운${gap}벗|undress|strip`,
    'i',
  ).test(t)
}

/**
 * @param {{ motionOverride?: string, durationSec?: number, skipHide?: boolean, statusPrefix?: string, persist?: boolean, keepBusy?: boolean, bodyProject?: boolean, clipRole?: 'single'|'dual-a'|'dual-b', landmarks?: BodyLandmarksClient, guideImageDataUrl?: string }} [options]
 * @returns {Promise<{ ok: boolean, videoUrl?: string }>}
 */
async function requestAnimate(options = {}) {
  if (!currentResult.imageUrl) return { ok: false }

  if (!isLoggedIn()) {
    showPinGate('로그인이 필요해요.')
    return { ok: false }
  }

  setAnimateBusy(true)
  if (!options.skipHide) hideVideoResult()

  let motionBase =
    typeof options.motionOverride === 'string'
      ? options.motionOverride.trim()
      : (motionField?.value || '').trim()
  // 두 사람 체크박스: 모션 문구에 "두 명"/"커플" 같은 단어가 없으면 코드가 1인 사진으로
  // 오판해 실제 커플 사진인데도 옷이 그대로 유지되는 사고가 있었다 — 체크박스로 명시.
  if (document.getElementById('animate-two-people')?.checked) {
    const suffix = ' (사진에는 두 사람이 함께 있다 — 커플)'
    motionBase = (motionBase.slice(0, 400 - suffix.length) + suffix).trim()
  }
  const fromMotion = motionBase.match(/(\d+)\s*초/)
  let durationSec =
    typeof options.durationSec === 'number' && Number.isFinite(options.durationSec)
      ? options.durationSec
      : getSelectedVideoDuration()
  // 단일 클립 API는 10~18. 24/30은 두 프레임 연속 경로에서 clipSec로만 넘긴다.
  if (fromMotion && options.durationSec == null) {
    const n = Number(fromMotion[1])
    if (n <= 10) durationSec = 10
    else if (n <= 12) durationSec = 12
    else if (n <= 15) durationSec = 15
    else if (n <= 18) durationSec = 18
    else if (n <= 24) durationSec = 24
    else durationSec = 30
    if (!isDualFrameDuration(getSelectedVideoDuration()) && !isDualFrameDuration(durationSec)) {
      setSelectedVideoDuration(durationSec)
    }
  }
  if (![10, 12, 15, 18].includes(durationSec)) durationSec = 15
  const speedKey = getSelectedVideoSpeed()
  const speedConflict =
    (speedKey === 'slow' && /빠르게|빨리|급하게|격렬하게|재빠르게|fast|quick(?:ly)?|rapid(?:ly)?/i.test(motionBase)) ||
    (speedKey === 'fast' && /느리게|느린|천천히|slow(?:ly)?/i.test(motionBase))
  const speedHint = speedConflict ? '' : VIDEO_MOTION_HINTS[speedKey] || ''
  const motion = [motionBase, speedHint].filter(Boolean).join('. ')
  const speedLabel = speedKey === 'slow' ? '느리게' : speedKey === 'fast' ? '빠르게' : '보통'
  const bodyProject = options.bodyProject === true
  const undressMotion = bodyProject || wantsUndressActionClient(motionBase)
  const landmarks = options.landmarks && typeof options.landmarks === 'object' ? options.landmarks : undefined
  const guideImageDataUrl =
    typeof options.guideImageDataUrl === 'string' && options.guideImageDataUrl.startsWith('data:image/')
      ? options.guideImageDataUrl
      : undefined
  const prefix = options.statusPrefix ? `${options.statusPrefix} ` : ''
  const motionPreview = motionBase
    ? ` (모션: "${motionBase.slice(0, 60)}${motionBase.length > 60 ? '…' : ''}")`
    : ' (모션 힌트 없음)'
  const stopTimer = startProgressTimer(
    setAnimateStatus,
    bodyProject
      ? `${prefix}몸매 투영 쇼츠(약 ${durationSec}초)…${motionPreview}`
      : undressMotion
        ? `${prefix}탈의·누드 쇼츠(약 ${durationSec}초)…${motionPreview}`
        : `${prefix}쇼츠(약 ${durationSec}초 · ${speedLabel})…${motionPreview}`,
  )

  try {
    let imageDataUrl =
      guideImageDataUrl ||
      currentResult.imageDataUrl ||
      (typeof currentResult.imageUrl === 'string' && currentResult.imageUrl.startsWith('data:image/')
        ? currentResult.imageUrl
        : undefined)
    let imageUrl =
      imageDataUrl || guideImageDataUrl
        ? undefined
        : currentResult.imageUrl || undefined

    if (!imageDataUrl && imageUrl) {
      await cacheImageForAnimate(imageUrl)
      imageDataUrl = currentResult.imageDataUrl || undefined
      if (imageDataUrl) imageUrl = undefined
    }

    if (!imageDataUrl && !imageUrl) {
      setAnimateStatus('원본 이미지가 없어요. 이미지를 다시 열어 주세요.', true)
      return { ok: false }
    }

    const response = await fetch('/api/animate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        imageUrl,
        imageDataUrl,
        prompt: currentResult.prompt,
        motion,
        size: currentResult.size,
        durationSec,
        bodyProject: bodyProject || undefined,
        landmarks: bodyProject && landmarks ? landmarks : undefined,
        clipRole: options.clipRole === 'dual-a' || options.clipRole === 'dual-b' ? options.clipRole : 'single',
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
      return { ok: false }
    }

    if (response.status === 422) {
      setAnimateStatus(
        '정책에 의해 차단된 표현이 포함되어 있어요. 미성년·강간·실존인물 묘사는 사용할 수 없어요.',
        true,
      )
      return { ok: false }
    }

    if (!data.ok) {
      setAnimateStatus(`영상 생성에 실패했어요: ${animateErrorMessage(data, response)}`, true)
      return { ok: false }
    }

    let finalData = data
    if (data.pending && data.predictionId) {
      setAnimateStatus(
        bodyProject
          ? `${prefix}몸매 투영 렌더링 중(약 ${durationSec}초)… 1~2분 걸릴 수 있어요`
          : `${prefix}영상 렌더링 중(약 ${durationSec}초 · ${speedLabel})… 1~2분 걸릴 수 있어요`,
        false,
      )
      finalData = await pollAnimateUntilDone(
        data.predictionId,
        data.durationSec || durationSec,
        speedLabel,
        (elapsedSec) => {
          setAnimateStatus(
            bodyProject
              ? `${prefix}몸매 투영 렌더링 중… ${elapsedSec}초 경과 (약 ${durationSec}초)`
              : `${prefix}영상 렌더링 중… ${elapsedSec}초 경과 (약 ${durationSec}초 · ${speedLabel})`,
            false,
          )
        },
      )
      if (!finalData) return { ok: false }
    }

    if (!finalData.videoUrl) {
      setAnimateStatus('영상 생성에 실패했어요: 결과 주소가 비어 있어요.', true)
      return { ok: false }
    }

    const draft = buildYoutubeShortsDraft({
      prompt: currentResult.prompt,
      motion: motionBase,
      genMode: currentResult.genMode,
    })
    showVideoResult(finalData.videoUrl, {
      prompt: currentResult.prompt,
      motion: motionBase,
      youtubeDraft: draft,
    })
    const animatedItemId = currentResult.itemId
    const previousPermanentVideoUrl = animatedItemId
      ? (() => {
          const prev = readGallery().find((entry) => entry.id === animatedItemId)?.videoUrl
          return isPermanentMediaUrl(prev) ? prev : null
        })()
      : null
    if (options.persist !== false) {
      updateGalleryItemVideo(currentResult.itemId, finalData.videoUrl, draft)
    }
    const dur = finalData.durationSec || durationSec
    setAnimateStatus(`${prefix}쇼츠 완료(약 ${dur}초 · ${speedLabel})!`, false)

    const animatedVideoUrl = finalData.videoUrl
    if (options.persist !== false) {
      persistImageToPermanentStorage(animatedVideoUrl).then((permanentUrl) => {
        if (!permanentUrl) return
        applyPersistedVideoUrl(animatedItemId, animatedVideoUrl, permanentUrl)
        if (previousPermanentVideoUrl) deletePermanentMediaIfNeeded(previousPermanentVideoUrl)
        setAnimateStatus(`${prefix}쇼츠 완료(약 ${dur}초)! 영구 저장했어요.`, false)
      })
    }
    return { ok: true, videoUrl: animatedVideoUrl }
  } catch (error) {
    stopTimer()
    setAnimateStatus(
      `영상 생성에 실패했어요: ${error instanceof Error ? error.message : String(error)}`,
      true,
    )
    return { ok: false }
  } finally {
    stopTimer()
    if (!options.keepBusy) {
      setAnimateBusy(false)
      if (options.bodyProject === true) resetBodyProjectButtonUi()
    }
  }
}

/** 영상 끝 프레임 → data URL (CORS 실패 시 null) */ 
async function captureVideoEndFrame(videoUrl) {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  video.src = videoUrl
  await new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('video_meta_timeout')), 20000)
    video.onloadedmetadata = () => {
      window.clearTimeout(t)
      resolve()
    }
    video.onerror = () => {
      window.clearTimeout(t)
      reject(new Error('video_meta_failed'))
    }
  })
  const dur = Number(video.duration)
  if (!Number.isFinite(dur) || dur <= 0) throw new Error('video_no_duration')
  video.currentTime = Math.max(0, dur - 0.08)
  await new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('video_seek_timeout')), 12000)
    video.onseeked = () => {
      window.clearTimeout(t)
      resolve()
    }
    video.onerror = () => {
      window.clearTimeout(t)
      reject(new Error('video_seek_failed'))
    }
  })
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 720
  canvas.height = video.videoHeight || 1280
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.92)
}

async function mergeShortsVideos(videoUrls) {
  const response = await fetch('/api/merge-videos', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ videoUrls }),
  })
  const data = await response.json().catch(() => ({}))
  if (!data?.ok || !data?.videoUrl) {
    throw new Error(data?.message || data?.error || 'merge_failed')
  }
  return data.videoUrl
}

/**
 * 두 프레임 연속 쇼츠.
 * UI 이름: 24초 / 30초 — 내부만 12+12 / 15+15 후 병합.
 * @param {number} [totalSec]
 * @param {{ bodyProjectFirst?: boolean, landmarks?: BodyLandmarksClient, guideImageDataUrl?: string }} [opts]
 */
async function requestDualFrameShorts(totalSec, opts = {}) {
  const total = isDualFrameDuration(totalSec) ? Number(totalSec) : getSelectedVideoDuration()
  if (!isDualFrameDuration(total)) {
    setAnimateStatus('24초 또는 30초를 선택한 뒤 다시 눌러 주세요.', true)
    return
  }
  const clipSec = getDualClipSec(total)

  if (!currentResult.imageUrl) return
  if (!isLoggedIn()) {
    showPinGate('로그인이 필요해요.')
    return
  }
  const motion1 = (motionField?.value || '').trim()
  const motion2 = (motion2Field?.value || '').trim()
  if (!motion1 || !motion2) {
    setAnimateStatus('전반·후반 모션을 모두 적어 주세요. (두 프레임 연속)', true)
    syncDualFrameUi(total)
    return
  }

  setAnimateBusy(true)
  setSelectedVideoDuration(total)
  const savedImageUrl = currentResult.imageUrl
  const savedImageDataUrl = currentResult.imageDataUrl
  const savedPrompt = currentResult.prompt
  const bodyProjectFirst = opts.bodyProjectFirst === true
  const landmarks = opts.landmarks
  const guideImageDataUrl = opts.guideImageDataUrl

  try {
    setAnimateStatus(
      bodyProjectFirst
        ? `${total}초 몸매 투영 쇼츠: 전반(1/2) 생성…`
        : `${total}초 쇼츠: 전반(1/2) 생성…`,
      false,
    )
    const clip1 = await requestAnimate({
      motionOverride: motion1,
      bodyProject: bodyProjectFirst,
      durationSec: clipSec,
      statusPrefix: bodyProjectFirst ? `[몸매 투영 · 1/2]` : `[${total}초 · 1/2]`,
      persist: false,
      keepBusy: true,
      clipRole: 'dual-a',
      landmarks: bodyProjectFirst ? landmarks : undefined,
      guideImageDataUrl: bodyProjectFirst ? guideImageDataUrl : undefined,
    })
    if (!clip1.ok || !clip1.videoUrl) return

    setAnimateStatus(`[${total}초 · 1/2] 끝 프레임으로 후반 연결 중…`, false)
    let endFrame = null
    try {
      endFrame = await captureVideoEndFrame(clip1.videoUrl)
    } catch (err) {
      console.warn('end frame capture failed', err)
    }
    if (endFrame?.startsWith('data:image/')) {
      showResult(endFrame, '전반 끝 프레임', false, {
        size: currentResult.size,
        itemId: currentResult.itemId,
        prompt: `${savedPrompt || ''} · already nude continuity`.trim(),
        accepted: true,
        mood: currentResult.mood,
        engine: currentResult.engine,
        genMode: currentResult.genMode,
      })
      currentResult.imageDataUrl = endFrame
      currentResult.imageUrl = endFrame
    } else {
      setAnimateStatus(
        `[${total}초 · 1/2] 끝 프레임을 못 가져와 원본 스틸로 후반을 이어갑니다.`,
        false,
      )
      currentResult.imageUrl = savedImageUrl
      currentResult.imageDataUrl = savedImageDataUrl
      currentResult.prompt = savedPrompt
    }

    const motion2Safe = /이미\s*나체|나체\s*유지|fully\s*nude|already\s*nude/i.test(motion2)
      ? motion2
      : `이미 완전 나체 유지(브라·팬티 되살림 금지). ${motion2}`
    if (motion2Field) motion2Field.value = motion2Safe

    setAnimateStatus(`${total}초 쇼츠: 후반(2/2) 생성…`, false)
    const clip2 = await requestAnimate({
      motionOverride: motion2Safe,
      durationSec: clipSec,
      skipHide: true,
      statusPrefix: `[${total}초 · 2/2]`,
      persist: false,
      keepBusy: true,
      clipRole: 'dual-b',
    })
    if (!clip2.ok || !clip2.videoUrl) return

    setAnimateStatus(`${total}초: 두 프레임을 이어 붙이는 중…`, false)
    try {
      const mergedUrl = await mergeShortsVideos([clip1.videoUrl, clip2.videoUrl])
      const draft = buildYoutubeShortsDraft({
        prompt: savedPrompt,
        motion: `${motion1} / ${motion2Safe}`,
        genMode: currentResult.genMode,
      })
      showVideoResult(mergedUrl, {
        prompt: savedPrompt,
        motion: `${motion1} / ${motion2Safe}`,
        youtubeDraft: draft,
      })
      updateGalleryItemVideo(currentResult.itemId, mergedUrl, draft)
      persistImageToPermanentStorage(mergedUrl).then((permanentUrl) => {
        if (!permanentUrl) return
        applyPersistedVideoUrl(currentResult.itemId, mergedUrl, permanentUrl)
        setAnimateStatus(`${total}초 쇼츠 완료! 영구 저장했어요.`, false)
      })
      setAnimateStatus(`${total}초 쇼츠 완료! (두 프레임 연속)`, false)
    } catch (mergeErr) {
      showVideoResult(clip2.videoUrl, {
        prompt: savedPrompt,
        motion: motion2Safe,
      })
      setAnimateStatus(
        `두 프레임은 만들었지만 자동 이어 붙이기 실패: ${
          mergeErr instanceof Error ? mergeErr.message : String(mergeErr)
        }. 후반 영상을 확인하세요.`,
        true,
      )
    }
  } finally {
    setAnimateBusy(false)
    if (bodyProjectFirst) resetBodyProjectButtonUi()
    setSelectedVideoDuration(total)
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
  // YouTube 탭은 반드시 가장 먼저(동기적으로) 연다 — 영상 다운로드(fetch)는 몇 초씩 걸릴 수
  // 있는데, 그 뒤에 window.open을 호출하면 브라우저가 "사용자 클릭과 무관한 팝업"으로 보고
  // 조용히 막아버리는 경우가 실측으로 확인됐다(사용자는 아무 반응이 없다고 느낌).
  handleYoutubeOpen()
  await handleYoutubeDownload()
  await handleYoutubeCopy()
  setYoutubeStatus(
    '준비 완료: YouTube 열기 → 영상 받기 → 제목·설명 복사. 업로드 창에서 붙여넣기만 하면 됩니다.',
    false,
  )
}

authTabLogin?.addEventListener('click', () => setAuthTab('login'))
authTabSignup?.addEventListener('click', () => setAuthTab('signup'))

authSubmitButton?.addEventListener('click', async () => {
  const email = (authEmailInput?.value || '').trim()
  const password = authPasswordInput?.value || ''
  if (!email || !password) {
    pinError.textContent = '아이디와 비밀번호를 입력해 주세요.'
    pinError.hidden = false
    return
  }

  // 안정화 전까지 회원가입 UI·요청 차단
  if (authMode === 'signup') {
    pinError.textContent = authErrorMessage('signup_disabled')
    pinError.hidden = false
    setAuthTab('login')
    return
  }

  if (!isAdminUserEmail(email)) {
    pinError.textContent = authErrorMessage('solo_admin_only')
    pinError.hidden = false
    return
  }

  authSubmitButton.disabled = true
  pinError.hidden = true
  const endpoint = '/api/auth/login'

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.ok || !data.token) {
      pinError.textContent = authErrorMessage(data.error, data)
      pinError.hidden = false
      return
    }
    clearAllAuth()
    const loginId = data.user?.email || email
    setSessionToken(data.token, loginId)
    rememberLoginId(loginId)
    if (authEmailInput) authEmailInput.value = loginId
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

authResetSubmit?.addEventListener('click', async () => {
  const email = (authEmailInput?.value || getRememberedLoginId() || '').trim() || 'admin'
  const adminPin = (authResetPin?.value || '').trim()
  const newPassword = authResetPassword?.value || ''
  const confirmPassword = authResetConfirm?.value || ''

  if (!adminPin || !newPassword || !confirmPassword) {
    setAuthResetStatus('ADMIN_PIN과 새 비밀번호를 모두 입력해 주세요.', true)
    return
  }
  if (newPassword !== confirmPassword) {
    setAuthResetStatus(authErrorMessage('password_confirm_mismatch'), true)
    return
  }
  if (!isAdminUserEmail(email)) {
    if (authEmailInput) authEmailInput.value = 'admin'
  }

  authResetSubmit.disabled = true
  setAuthResetStatus('비밀번호를 다시 만드는 중…', false)
  try {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: (authEmailInput?.value || 'admin').trim(),
        newPassword,
        confirmPassword,
        adminPin,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.ok) {
      setAuthResetStatus(authErrorMessage(data.error, data), true)
      return
    }
    rememberLoginId(data.email || email)
    if (authEmailInput) authEmailInput.value = data.email || email
    if (authPasswordInput) authPasswordInput.value = ''
    if (authResetPin) authResetPin.value = ''
    if (authResetPassword) authResetPassword.value = ''
    if (authResetConfirm) authResetConfirm.value = ''
    setAuthResetStatus(data.message || '비밀번호를 다시 설정했어요. 새 비밀번호로 로그인해 주세요.', false)
    authPasswordInput?.focus()
  } catch {
    setAuthResetStatus('네트워크 오류가 났어요. 잠시 후 다시 시도해 주세요.', true)
  } finally {
    authResetSubmit.disabled = false
  }
})

;[authResetPin, authResetPassword, authResetConfirm].forEach((input) => {
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') authResetSubmit?.click()
  })
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

/** PIN 변경 모달 상태 표시 */
function setPinSettingsStatus(message, isError) {
  if (!pinSettingsStatus) return
  pinSettingsStatus.hidden = !message
  pinSettingsStatus.textContent = message || ''
  pinSettingsStatus.style.color = isError ? '' : '#7dcea0'
}

function openPinSettingsModal() {
  if (!pinChangeModal) return
  if (pinSettingsCurrent) pinSettingsCurrent.value = ''
  if (pinSettingsNew) pinSettingsNew.value = ''
  if (pinSettingsConfirm) pinSettingsConfirm.value = ''
  setPinSettingsStatus('', false)
  pinChangeModal.hidden = false
  pinSettingsCurrent?.focus()
}

function closePinSettingsModal() {
  if (pinChangeModal) pinChangeModal.hidden = true
}

pinSettingsButton?.addEventListener('click', openPinSettingsModal)
pinSettingsClose?.addEventListener('click', closePinSettingsModal)
pinChangeModal?.addEventListener('click', (event) => {
  if (event.target === pinChangeModal) closePinSettingsModal()
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && pinChangeModal && !pinChangeModal.hidden) closePinSettingsModal()
})

pinSettingsSubmit?.addEventListener('click', async () => {
  const currentPin = (pinSettingsCurrent?.value || '').trim()
  const newPin = (pinSettingsNew?.value || '').trim()
  const confirmPin = (pinSettingsConfirm?.value || '').trim()

  if (!currentPin || !newPin || !confirmPin) {
    setPinSettingsStatus('현재 PIN과 새 PIN을 모두 입력해 주세요.', true)
    return
  }
  if (newPin !== confirmPin) {
    setPinSettingsStatus(authErrorMessage('pin_confirm_mismatch'), true)
    return
  }
  if (newPin === currentPin) {
    setPinSettingsStatus(authErrorMessage('pin_unchanged'), true)
    return
  }

  pinSettingsSubmit.disabled = true
  setPinSettingsStatus('PIN을 변경하는 중…', false)
  try {
    const response = await fetch('/api/auth/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin, confirmPin }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.ok) {
      setPinSettingsStatus(authErrorMessage(data.error, data), true)
      return
    }
    setPinSettingsStatus(data.message || 'PIN이 변경됐어요.', false)
    if (pinSettingsCurrent) pinSettingsCurrent.value = ''
    if (pinSettingsNew) pinSettingsNew.value = ''
    if (pinSettingsConfirm) pinSettingsConfirm.value = ''
  } catch (error) {
    setPinSettingsStatus(`PIN 변경 실패: ${error instanceof Error ? error.message : String(error)}`, true)
  } finally {
    pinSettingsSubmit.disabled = false
  }
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const description = composeDescription()
  if (!description) {
    // 예전엔 여기서 아무 메시지 없이 guideWhoField에 포커스만 주고 조용히 끝났다 —
    // 사용자가 스크롤이 많이 내려가 있으면(예: 화보 스튜디오 하단) 포커스 이동이 화면 밖이라
    // "버튼을 눌러도 아무 반응이 없다"는 혼란을 낳았다. 이제 눈에 보이는 에러도 함께 띄운다.
    setFormStatus('캐릭터 / 컨셉 설명(또는 위 가이드 칸)을 입력한 뒤 다시 눌러 주세요.', true)
    guideWhoField?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    guideWhoField?.focus()
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
      precision: Boolean(precisionModeField?.checked),
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

    if (data.error === 'description_too_long') {
      setFormStatus(`설명이 너무 길어요. ${data.maxLength || 1200}자 이내로 줄여 주세요.`, true)
      return
    }
    if (data.error === 'description_required') {
      setFormStatus('설명 또는 가이드(누구/어떤/뭐 하는) 중 하나 이상 입력해 주세요.', true)
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
      genMode: data.mode,
      reviseRound: 0,
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

// ─── 사진 · 그림 불러오기 (파일 선택 / 붙여넣기) ───────────────────────────
// 가지고 있는 사진(예: 오래된 가족 사진)을 새로 생성하지 않고 그대로 "수정 대상"으로
// 불러온다. refine/animate API는 SSRF 방지 화이트리스트 호스트(fal.media 등)만
// imageUrl로 받으므로, 먼저 /api/upload-image로 업로드해 허용된 URL을 받아온다.
async function prepareImageDataUrl(file, maxDim = 2200) {
  const original = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('read_failed'))
    reader.readAsDataURL(file)
  })
  const img = await new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('image_decode_failed'))
    el.src = original
  })
  const longSide = Math.max(img.naturalWidth, img.naturalHeight)
  const tooHeavy = typeof original === 'string' && original.length > 9_000_000
  if (!tooHeavy && longSide <= maxDim) return original

  const scale = Math.min(1, maxDim / longSide)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9)
}

async function loadImageFromFile(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    setFormStatus('이미지 파일만 불러올 수 있어요 (PNG/JPEG/WEBP).', true)
    return
  }
  if (!isLoggedIn()) {
    showPinGate('로그인이 필요해요.')
    return
  }

  if (loadImageButton) loadImageButton.disabled = true
  const stopTimer = startProgressTimer(setFormStatus, '사진을 불러와 업로드하고 있어요…')
  try {
    const dataUrl = await prepareImageDataUrl(file)
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ dataUrl }),
    })
    const data = await response.json().catch(() => ({}))
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
    if (!data.ok) {
      const msg =
        data.error === 'image_too_large'
          ? '사진 용량이 너무 커요. 더 작은 사진으로 다시 시도해 주세요.'
          : data.error === 'upload_engine_not_configured'
            ? '이미지 불러오기 기능이 서버에 아직 설정되지 않았어요 (FAL_KEY 필요).'
            : `사진을 불러오지 못했어요: ${data.message || data.error || '알 수 없는 오류'}`
      setFormStatus(msg, true)
      return
    }

    showResult(data.imageUrl, '불러온 사진 (수정 대상)', false, {
      size: sizeField.value,
      itemId: null,
      prompt: (descriptionField.value || '').trim(),
      accepted: false,
      mood: moodField.value,
      engine: 'uploaded',
      genMode: getGenMode(),
      reviseRound: 0,
    })
    setFormStatus(
      '사진을 불러왔어요! 수용 없이 「이미지 수정」·「쇼츠」를 바로 할 수 있어요. 갤러리 저장만 수용하세요.',
      false,
    )
  } catch (error) {
    stopTimer()
    setFormStatus(`사진을 불러오지 못했어요: ${error instanceof Error ? error.message : String(error)}`, true)
  } finally {
    stopTimer()
    if (loadImageButton) loadImageButton.disabled = false
    if (loadImageInput) loadImageInput.value = ''
  }
}

loadImageButton?.addEventListener('click', () => loadImageInput?.click())
loadImageInput?.addEventListener('change', () => {
  const file = loadImageInput.files?.[0]
  if (file) loadImageFromFile(file)
})

/** 클립보드/드롭에서 첫 이미지 파일 추출 (캡처·파일 탐색기 드래그 모두) */
function pickImageFileFromDataTransfer(dataTransfer) {
  if (!dataTransfer) return null
  const files = dataTransfer.files
  if (files?.length) {
    for (const file of files) {
      if (String(file.type || '').startsWith('image/')) return file
    }
  }
  const items = dataTransfer.items
  if (items?.length) {
    for (const item of items) {
      if (item.kind === 'file' && String(item.type || '').startsWith('image/')) {
        const file = item.getAsFile()
        if (file) return file
      }
    }
  }
  return null
}

function isStudioImageLoadContext() {
  const area = getAppArea()
  return area === 'studio' || area === 'admin'
}

// 화보/관리자: Ctrl+V 캡처·이미지 붙여넣기 → 수정 대상으로 불러오기
document.addEventListener('paste', (event) => {
  // 얼굴교체 패널이 열려 있으면 자체 리스너가 처리
  const faceswapPanel = document.getElementById('admin-faceswap-panel')
  if (faceswapPanel && !faceswapPanel.hidden) return
  if (!isStudioImageLoadContext()) return
  // 텍스트만 붙여넣는 경우는 가로채지 않음 (설명 칸 등)
  const file = pickImageFileFromDataTransfer(event.clipboardData)
  if (!file) return
  event.preventDefault()
  void loadImageFromFile(file)
})

// 캐릭터/컨셉 영역: 폴더에서 마우스로 끌어다 놓기
const descriptionDropzone = document.getElementById('description-dropzone')
const descriptionDropOverlay = descriptionDropzone?.querySelector('.description-dropzone__overlay')
let descriptionDragDepth = 0

function setDescriptionDropActive(on) {
  descriptionDropzone?.classList.toggle('description-dropzone--active', on)
  if (descriptionDropOverlay) descriptionDropOverlay.hidden = !on
}

descriptionDropzone?.addEventListener('dragenter', (event) => {
  if (!isStudioImageLoadContext()) return
  event.preventDefault()
  descriptionDragDepth += 1
  setDescriptionDropActive(true)
})
descriptionDropzone?.addEventListener('dragover', (event) => {
  if (!isStudioImageLoadContext()) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
})
descriptionDropzone?.addEventListener('dragleave', (event) => {
  if (!isStudioImageLoadContext()) return
  event.preventDefault()
  descriptionDragDepth = Math.max(0, descriptionDragDepth - 1)
  if (descriptionDragDepth === 0) setDescriptionDropActive(false)
})
descriptionDropzone?.addEventListener('drop', (event) => {
  if (!isStudioImageLoadContext()) return
  event.preventDefault()
  descriptionDragDepth = 0
  setDescriptionDropActive(false)
  const file = pickImageFileFromDataTransfer(event.dataTransfer)
  if (!file) {
    setFormStatus('이미지 파일만 끌어다 놓을 수 있어요 (PNG/JPEG/WEBP/GIF).', true)
    return
  }
  void loadImageFromFile(file)
})

// fal/replicate 임시 CDN 링크는 시간이 지나면 만료된다. 「수용하기」/영상 완성 시점에
// 그 파일(이미지·영상 모두)을 storymag-media R2 버킷으로 복사해 영구 주소로 바꿔둔다.
// (실패해도 원래 링크로 그대로 동작 — 실패는 조용히 무시)
async function persistImageToPermanentStorage(mediaUrl) {
  try {
    const response = await fetch('/api/persist-media', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ url: mediaUrl }),
    })
    const data = await response.json().catch(() => ({}))
    if (!data.ok || !data.url) return null
    return data.url
  } catch {
    return null
  }
}

// R2에 이미 저장된 파일인지(우리 버킷 소유의 영구 주소인지) 대략 판별한다.
// 아직 임시 CDN 링크(fal.media/replicate.delivery)면 false.
function isPermanentMediaUrl(url) {
  return typeof url === 'string' && /\br2\.dev\//.test(url)
}

// 갤러리 항목이 교체되거나 지워질 때, 이미 R2에 영구 저장돼 있던 옛 파일을 정리한다.
// 실패해도 사용자에게 영향 없는 백그라운드 정리 작업이라 결과를 기다리거나 알리지 않는다.
function deletePermanentMediaIfNeeded(url) {
  if (!isPermanentMediaUrl(url)) return
  fetch('/api/delete-media', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ url }),
  }).catch(() => {})
}

function applyPersistedImageUrl(itemId, originalUrl, permanentUrl) {
  const items = readGallery()
  const index = items.findIndex((entry) => entry.id === itemId)
  if (index !== -1 && items[index].imageUrl === originalUrl) {
    items[index] = { ...items[index], imageUrl: permanentUrl }
    writeGallery(items)
    renderGallery()
  }
  if (currentResult.itemId === itemId && currentResult.imageUrl === originalUrl) {
    currentResult.imageUrl = permanentUrl
    if (resultImage) resultImage.src = permanentUrl
  }
}

function applyPersistedVideoUrl(itemId, originalUrl, permanentUrl) {
  const items = readGallery()
  const index = items.findIndex((entry) => entry.id === itemId)
  if (index !== -1 && items[index].videoUrl === originalUrl) {
    items[index] = { ...items[index], videoUrl: permanentUrl }
    writeGallery(items)
    renderGallery()
  }
  if (currentResult.itemId === itemId) {
    if (currentResult.videoUrl === originalUrl) {
      currentResult.videoUrl = permanentUrl
      if (resultVideo) resultVideo.src = permanentUrl
    }
    if (currentResult.originalVideoUrl === originalUrl) {
      currentResult.originalVideoUrl = permanentUrl
    }
  }
}

acceptButton.addEventListener('click', () => {
  // 「이전과 비교」로 이전 버전을 보고 있는 중에 수용하기를 누르면, 화면에 보이는(=이전) 버전을
  // 그대로 채택하려는 의도다. currentResult는 아직 최신 버전을 들고 있으므로, 저장 전에
  // 먼저 previousSnapshot과 맞바꿔서 지금 보이는 이미지/설명/무드 등이 실제로 저장되게 한다.
  if (comparingPrevious) revertToPreviousSnapshot()
  if (!currentResult.imageUrl) return
  const itemId = currentResult.itemId || crypto.randomUUID()
  currentResult.itemId = itemId
  const acceptedImageUrl = currentResult.imageUrl
  const existing = readGallery().some((entry) => entry.id === itemId)
  if (!existing) {
    saveToGallery({
      id: itemId,
      imageUrl: acceptedImageUrl,
      description: currentResult.prompt,
      prompt: currentResult.prompt,
      mood: currentResult.mood,
      size: currentResult.size,
      engine: currentResult.engine,
      engineLabel: currentResult.engineLabel,
      fallbackUsed: currentResult.fallbackUsed,
      genMode: currentResult.genMode,
      reviseRound: currentResult.reviseRound,
      videoUrl: null,
      createdAt: new Date().toISOString(),
    })
  } else {
    const items = readGallery()
    const index = items.findIndex((entry) => entry.id === itemId)
    if (index !== -1) {
      items[index] = { ...items[index], imageUrl: acceptedImageUrl }
      writeGallery(items)
      renderGallery()
    }
  }
  enterAcceptedMode()
  setFormStatus('수용했어요. 갤러리에 저장됐고, 쇼츠 영상도 만들 수 있어요. (이미지를 영구 저장하는 중…)', false)

  // 갤러리 저장/화면 갱신은 즉시 끝내고, R2 영구 저장은 백그라운드로 이어서 진행한다.
  persistImageToPermanentStorage(acceptedImageUrl).then((permanentUrl) => {
    if (!permanentUrl) return
    applyPersistedImageUrl(itemId, acceptedImageUrl, permanentUrl)
    setFormStatus('수용했어요. 이미지를 영구 저장했어요 — 캐시를 지워도 갤러리에서 계속 볼 수 있어요.', false)
  })
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

document.querySelectorAll('input[name="revise-mode"]').forEach((input) => {
  input.addEventListener('change', () => {
    if (!revisePanel.hidden) syncReviseModeUi()
  })
})

// 이미지 통째로 잡히는 브라우저 기본 드래그 차단
resultImage.addEventListener('dragstart', (event) => {
  event.preventDefault()
})

// 찍어서 붙이기: 결과 이미지 클릭·휠
resultImage?.addEventListener('click', (event) => {
  if (revisePanel?.hidden || getSelectedReviseMode() !== 'pin') return
  event.preventDefault()
  stampPropAtClientPoint(event.clientX, event.clientY)
})

resultStage?.addEventListener(
  'wheel',
  (event) => {
    if (revisePanel?.hidden || getSelectedReviseMode() !== 'pin') return
    event.preventDefault()
    const dir = event.deltaY > 0 ? -0.1 : 0.1
    pinScale = Math.min(2.8, Math.max(0.4, pinScale + dir))
    if (pinStatus) pinStatus.textContent = `크기 ${pinScale.toFixed(1)}× — 클릭으로 붙이기`
  },
  { passive: false },
)

// 올가미 입력은 poly-lasso.js가 region-canvas에 직접 붙인다.
regionUndoButton.addEventListener('click', () => {
  undoLastRegion()
})

regionClearButton.addEventListener('click', () => {
  clearAllRegions()
  setReviseStatus('모든 선택을 지웠어요. 좌클릭으로 점을 다시 찍으세요.', false)
})

/** 좌우 이중 초상(diptych) 제거 요청 — AI 대신 절반 크롭이 확실함 */
function wantsDiptychCropFix(text) {
  return /이중\s*초상|좌우\s*(이중|분신|둘)|한\s*쪽만|한쪽만|한\s*장만|diptych|split\s*screen|둘로\s*나|분신\s*제거/i.test(
    text || '',
  )
}

function parseDiptychCropSide(text) {
  if (/오른|right/i.test(text || '')) return 'right'
  return 'left'
}

/**
 * 현재 결과 이미지를 좌/우 절반만 남긴 data URL로 반환.
 * CORS 회피: /api/media-bytes로 dataUrl을 받은 뒤 크롭.
 */
async function cropCurrentResultToHalf(side = 'left') {
  if (!currentResult.imageUrl) throw new Error('no_image')
  let sourceDataUrl = currentResult.imageDataUrl
  if (!sourceDataUrl || !String(sourceDataUrl).startsWith('data:')) {
    const response = await fetch('/api/media-bytes', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ imageUrl: currentResult.imageUrl }),
    })
    const data = await response.json().catch(() => ({}))
    if (!data?.ok || !data.dataUrl) throw new Error(data?.error || 'media_bytes_failed')
    sourceDataUrl = data.dataUrl
    currentResult.imageDataUrl = sourceDataUrl
  }
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('image_decode_failed'))
    img.src = sourceDataUrl
  })
  const fullW = img.naturalWidth || img.width
  const fullH = img.naturalHeight || img.height
  if (fullW < 32 || fullH < 32) throw new Error('image_too_small')
  const halfW = Math.max(1, Math.floor(fullW / 2))
  const canvas = document.createElement('canvas')
  canvas.width = halfW
  canvas.height = fullH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')
  const sx = side === 'right' ? halfW : 0
  ctx.drawImage(img, sx, 0, halfW, fullH, 0, 0, halfW, fullH)
  return canvas.toDataURL('image/png')
}

async function applyDiptychCrop(side = 'left') {
  if (!currentResult.imageUrl) {
    setReviseStatus('자를 이미지가 없어요.', true)
    return
  }
  if (!isLoggedIn()) {
    showPinGate('로그인이 필요해요.')
    return
  }
  reviseApplyButton.disabled = true
  const leftBtn = document.getElementById('diptych-crop-left')
  const rightBtn = document.getElementById('diptych-crop-right')
  if (leftBtn) leftBtn.disabled = true
  if (rightBtn) rightBtn.disabled = true
  setReviseStatus(`이중 초상 ${side === 'right' ? '오른쪽' : '왼쪽'}만 남기는 중…`, false)
  try {
    const cropped = await cropCurrentResultToHalf(side)
    const sideLabel = side === 'right' ? '오른쪽' : '왼쪽'
    showResult(cropped, `이중초상 제거 (${sideLabel}만 유지)`, false, {
      size: currentResult.size,
      itemId: currentResult.itemId,
      prompt: polishConceptText(
        [currentResult.prompt, `단일 프레임(${sideLabel} 패널만 유지)`].filter(Boolean).join('. '),
      ),
      accepted: false,
      mood: currentResult.mood,
      engine: 'crop',
      reviseRound: (currentResult.reviseRound || 0) + 1,
    })
    currentResult.imageDataUrl = cropped
    setReviseStatus(
      `이중 초상에서 ${sideLabel}만 남겼어요. 이제 한 장으로 이어서 수정·쇼츠할 수 있어요.`,
      false,
    )
    revisionText.value = ''
  } catch (error) {
    setReviseStatus(
      `자르기에 실패했어요: ${error instanceof Error ? error.message : 'unknown'}. 새로고침 후 다시 시도해 주세요.`,
      true,
    )
  } finally {
    reviseApplyButton.disabled = false
    if (leftBtn) leftBtn.disabled = false
    if (rightBtn) rightBtn.disabled = false
  }
}

document.getElementById('diptych-crop-left')?.addEventListener('click', () => applyDiptychCrop('left'))
document.getElementById('diptych-crop-right')?.addEventListener('click', () => applyDiptychCrop('right'))

reviseApplyButton.addEventListener('click', async () => {
  if (!currentResult.imageUrl) return
  if (getSelectedReviseMode() === 'pin') {
    setReviseStatus('찍어서 붙이기 모드입니다. 소품을 고른 뒤 사진 위를 클릭하세요. (수정 적용 버튼 없음)', true)
    return
  }
  let revision = polishConceptText(revisionText.value || '')
  if (revision && revision !== (revisionText.value || '').trim()) {
    revisionText.value = revision
  }
  if (!revision) {
    setReviseStatus('수정 요청을 입력해 주세요.', true)
    return
  }

  // 이중 초상 제거는 AI보다 절반 크롭이 확실 — 수정 적용으로도 동일 처리
  if (wantsDiptychCropFix(revision)) {
    await applyDiptychCrop(parseDiptychCropSide(revision))
    return
  }

  const mode = getSelectedReviseMode()
  let maskDataUrl = null
  if (mode === 'region') {
    maskDataUrl = buildMaskDataUrlFromRegion()
    if (!maskDataUrl) {
      setReviseStatus(
        '올가미 모드입니다. 부분만 고치려면 점을 찍어 닫으세요. 전신·구도처럼 전체를 바꾸려면 위에서 「텍스트로 수정」을 고른 뒤 다시 「수정 적용」을 누르세요.',
        true,
      )
      return
    }
    // 올가미 수정은 "선택 밖은 그대로 보존" — 누드/전신처럼 전역 요청과 섞으면 반만 반영된다.
    const wholeBodyPattern = /누드|나체|전라|전신|올누드|풀바디|속옷|란제리|nude|naked|undress/i
    if (wholeBodyPattern.test(revision)) {
      const proceed = window.confirm(
        '올가미 수정은 선택한 영역 밖은 바뀌지 않아요. 누드/전신처럼 몸 전체에 영향을 주는 요청은 "텍스트로 수정"이 더 잘 맞아요.\n\n그래도 지금 선택한 영역만 수정으로 계속할까요? (취소하면 모드를 바꿔서 다시 시도할 수 있어요)',
      )
      if (!proceed) {
        setReviseStatus('영역 지정을 취소했어요. 「텍스트로 수정」으로 바꿔서 다시 시도해 보세요.', false)
        return
      }
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
        // 지금 켜진 탭(getGenMode)이 아니라 "이 이미지를 실제로 만든 모드"를 써야 한다 —
        // 생성 후 탭을 옮기고 돌아와 수정하면 getGenMode()가 다른 값을 반환할 수 있어서,
        // 화보로 만든 동물 그림이 자유 모드 경로로(또는 반대로) 잘못 흘러가는 사고가 있었다.
        genMode: currentResult.genMode || getGenMode(),
        imageUrl: currentResult.imageUrl,
        // 두 사람 체크박스: 텍스트만으로 커플 여부를 추측하면(모션/설명에 "두 명" 같은
        // 단어가 없으면) 1인 잠금(IRONCLAD 등)이 적용되어 실제로는 커플 사진인데도
        // 옷이 그대로 유지되는 사고가 있었다 — 체크박스로 명시하면 텍스트 추측 없이 확실히 켜진다.
        baseDescription:
          (currentResult.prompt || (descriptionField?.value || '').trim()) +
          (document.getElementById('revise-two-people')?.checked ? ' (사진에는 두 사람이 함께 있다 — 커플)' : ''),
        revision,
        maskDataUrl,
        mood: currentResult.mood,
        size: currentResult.size || sizeField?.value || 'landscape',
        regionCount: ensureReviseLasso()?.getRegions?.().length || 0,
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
      if (data.error === 'use_accessory_pin') {
        const pinRadio = document.querySelector('input[name="revise-mode"][value="pin"]')
        if (pinRadio) pinRadio.checked = true
        syncReviseModeUi()
        setReviseStatus(data.message || '「찍어서 붙이기」로 자리를 클릭하세요.', true)
        return
      }
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

    // 탈의·의상 수정도 structuralRegen=false(img2img)라서, 예전엔 prompt를 안 갱신했음 →
    // 쇼츠가 옛 "가운/옷 입은" 서술만 보고 나체 이미지에 다시 옷을 입히는 회귀(실측).
    // 수정 지시는 항상 누적한다. 나체 요청이면 판별용 마커를 한 줄 더 붙인다.
    // 몸매 투영 원문을 base에 누적하면 고착 → 마커만 남김.
    const nudeBecomes = /몸매\s*투영|나체가\s*된다\.|나체가된다\./i.test(revision)
    const nudeRev =
      nudeBecomes ||
      /누드|나체|전라|유두|유방|젖꼭지|탈의|벗기|벗겨|벗어|벗는|nude|naked|undress|bare\s*breast|topless/i.test(
        revision,
      )
    const nextPrompt = polishConceptText(
      [
        currentResult.prompt,
        nudeBecomes ? '나체 수정 요청됨(몸매 투영)' : revision,
        nudeRev && !nudeBecomes ? '나체 수정 요청됨(쇼츠는 탈의 전환으로 처리)' : '',
      ]
        .filter(Boolean)
        .join('. '),
    )
    showResult(data.imageUrl, data.engineLabel, Boolean(data.fallbackUsed), {
      size: currentResult.size,
      itemId: currentResult.itemId,
      prompt: nextPrompt,
      accepted: false,
      mood: currentResult.mood,
      engine: data.engine,
      reviseRound: (currentResult.reviseRound || 0) + 1,
    })
    // 갤러리에 있던 항목이면 수정본 URL을 바로 반영 (재수용 전에도 최신본 유지)
    if (currentResult.itemId) {
      const items = readGallery()
      const index = items.findIndex((entry) => entry.id === currentResult.itemId)
      // 교체되기 전 이미지/영상이 이미 R2에 영구 저장돼 있었다면, 새 수정본이 안전하게
      // 저장된 뒤에 지운다(교체 전에 미리 지우면 새 저장이 실패했을 때 아예 잃어버림).
      const previousPermanentImageUrl =
        index !== -1 && isPermanentMediaUrl(items[index].imageUrl) ? items[index].imageUrl : null
      const previousPermanentVideoUrl =
        index !== -1 && isPermanentMediaUrl(items[index].videoUrl) ? items[index].videoUrl : null
      if (index !== -1) {
        items[index] = {
          ...items[index],
          imageUrl: data.imageUrl,
          engine: data.engine,
          engineLabel: data.engineLabel,
          videoUrl: null,
          reviseRound: currentResult.reviseRound,
        }
        writeGallery(items)
        renderGallery()
      }
      // 영상은 이제 이미지와 안 맞으니(위에서 videoUrl: null) 옛 영상은 곧바로 정리한다.
      if (previousPermanentVideoUrl) deletePermanentMediaIfNeeded(previousPermanentVideoUrl)
      // 이 수정본도 임시 CDN 링크이므로, 갤러리에 남는 즉시 영구 저장소로 백그라운드 복사한다.
      const revisedItemId = currentResult.itemId
      const revisedImageUrl = data.imageUrl
      persistImageToPermanentStorage(revisedImageUrl).then((permanentUrl) => {
        if (!permanentUrl) return
        applyPersistedImageUrl(revisedItemId, revisedImageUrl, permanentUrl)
        // 새 수정본이 안전하게 저장된 뒤에야 교체된 옛 이미지를 지운다.
        if (previousPermanentImageUrl) deletePermanentMediaIfNeeded(previousPermanentImageUrl)
      })
    }
    // 수정 적용 후: 수정 패널 닫고 수정하기 / 수용하기 복구
    setReviewChrome('idle')
    if (data.structuralRegen || getGenMode() === 'free') {
      setReviseStatus(
        (data.message ||
          '자유 일러스트 수정은 장면 재생성으로 처리했어요. 동물·구도를 유지한 채 반영합니다.') +
          ' 확정하려면 수용하기를 누르세요.',
        false,
      )
    } else if (data.fallbackUsed && data.message) {
      // 구조적 재생성이 실패해서 보조 경로로 대체된 경우처럼, 서버가 구체적인 사유를
      // 알려줄 땐 그 문구를 그대로 보여준다 — 뭉뚱그린 "보조 경로" 문구로 가려지면
      // 사용자가 큰 수정 요청이 실제로는 거의 반영 안 됐다는 걸 알 방법이 없다.
      setReviseStatus(`${data.message} 더 고치려면 수정하기, 확정하려면 수용하기를 누르세요.`, false)
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
  if (animateButton.disabled) return
  if (!currentResult.imageUrl) {
    setAnimateStatus('먼저 이미지를 생성하거나 불러와 주세요.', true)
    return
  }
  const dur = getSelectedVideoDuration()
  if (isDualFrameDuration(dur)) {
    void requestDualFrameShorts(dur)
    return
  }
  void requestAnimate()
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
  // 이전 장면에서 쓰던 가이드(주부/술부/형용사/목적어/보어)와 캐릭터 설명을 모두 비운다 —
  // 안 비우면 "새 장면 시작"을 눌러도 이전 장면 텍스트가 그대로 남아 헷갈리는 문제가 있었다.
  resetGuideFields()
  guideDescLocked = false
  if (descriptionField) descriptionField.value = ''
  if (scenePreviewEl) scenePreviewEl.hidden = true
  if (motionField) motionField.value = ''
  currentResult.imageUrl = ''
  currentResult.previousSnapshot = null
  comparingPrevious = false
  compareBadge.hidden = true
  setActionsLockedForCompare(false)
  updateCompareButtons()
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
  const area = getAppArea()
  if (area !== 'studio' && area !== 'admin') return
  const free = getGenMode() === 'free'
  const admin = isAdminUser()
  // 무드(조명·필름 질감)는 화보뿐 아니라 자유 일러스트 장면에도 적용된다 — 더 이상
  // 자유 모드에서 비활성화하지 않는다.
  const subtitle = document.getElementById('app-subtitle')
  const title = document.getElementById('app-title') || document.querySelector('.app__title')
  if (subtitle) {
    subtitle.textContent = free ? '자유 일러스트' : ''
  }
  if (title) {
    title.textContent = free || !admin ? '자유 일러스트 스튜디오' : '화보 스튜디오'
  }
  if (genModeHint) {
    if (admin && !free) {
      genModeHint.textContent = ''
      genModeHint.hidden = true
    } else if (admin) {
      genModeHint.hidden = false
      genModeHint.textContent = '장면을 자유 서술로 그립니다. 화보가 필요하면 상단 「관리자 페이지」 탭으로 이동하세요.'
    } else {
      genModeHint.textContent = ''
      genModeHint.hidden = true
    }
  }
  if (descriptionField) {
    descriptionField.placeholder = free
      ? '예: 여우가 느티나무 아래에 서있다 — 간략한 캐릭터 정보를 적어 주세요'
      : '예: 짧은 실크 슬립 드레스, 도시 야경, 자신감 있는 전신 포즈'
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
  input.addEventListener('change', () => {
    // 화보↔자유 모드를 전환해도 이전 모드용으로 쓴 캐릭터/컨셉 설명이 그대로 남아있으면
    // 새 모드의 장면 컴파일러(전혀 다른 파이프라인)에 그대로 흘러들어가 엉뚱한 결과가
    // 나올 수 있다 — 모드가 바뀌면 설명·가이드 필드를 비워 혼선을 막는다.
    const hadText = Boolean((descriptionField?.value || '').trim()) || Boolean(composeGuideSentence())
    if (hadText) {
      resetGuideFields()
      guideDescLocked = false
      if (descriptionField) descriptionField.value = ''
      if (scenePreviewEl) scenePreviewEl.hidden = true
      setFormStatus('모드를 전환해서 이전 캐릭터/컨셉 설명을 비웠어요. 새로 입력해 주세요.', false)
    }
    syncGenModeUi()
  })
})
document.querySelectorAll('[data-app-area]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setAppArea(btn.getAttribute('data-app-area') || 'studio')
  })
})
// bootAuth → showApp 에서 syncAppAreaUi 호출.
syncGenModeUi()
updateDescriptionCounter()

newShootHeaderButton.addEventListener('click', startNewShoot)
document.getElementById('app-home-button')?.addEventListener('click', () => setAppArea('studio'))
document.getElementById('app-home-link')?.addEventListener('click', () => setAppArea('studio'))
newShootGalleryButton.addEventListener('click', startNewShoot)
newShootAdminGalleryButton?.addEventListener('click', startNewShoot)

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
  if (!window.confirm('내 갤러리(자유 일러스트)에 저장된 모든 이미지를 삭제할까요? 관리자 전용 갤러리는 남아있어요.')) return
  const items = readGallery()
  items.filter((item) => item.genMode !== 'fashion').forEach((item) => {
    deletePermanentMediaIfNeeded(item.imageUrl)
    deletePermanentMediaIfNeeded(item.videoUrl)
  })
  writeGallery(items.filter((item) => item.genMode === 'fashion'))
  renderGallery()
})

clearAdminGalleryButton?.addEventListener('click', () => {
  if (!window.confirm('관리자 전용 갤러리에 저장된 모든 이미지를 삭제할까요? 내 갤러리는 남아있어요.')) return
  const items = readGallery()
  items.filter((item) => item.genMode === 'fashion').forEach((item) => {
    deletePermanentMediaIfNeeded(item.imageUrl)
    deletePermanentMediaIfNeeded(item.videoUrl)
  })
  writeGallery(items.filter((item) => item.genMode !== 'fashion'))
  renderGallery()
})

// ─── 갤러리 백업 (내보내기 / 가져오기) ─────────────────────────────────────
// 갤러리는 이 브라우저의 localStorage에만 있어서, 캐시를 지우거나 기기를 바꾸면
// 통째로 사라진다. JSON으로 내보내/가져올 수 있게 해서 최소한의 안전장치를 둔다.
// (내 갤러리·관리자 갤러리 항목을 모두 포함한 전체 백업)
const GALLERY_BACKUP_VERSION = 1

function exportGalleryBackup() {
  const items = readGallery()
  if (!items.length) {
    setFormStatus('내보낼 갤러리 항목이 없어요.', true)
    return
  }
  const payload = {
    app: 'storymag-gallery-backup',
    version: GALLERY_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  a.href = url
  a.download = `storymag-gallery-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  setFormStatus(`갤러리 ${items.length}개 항목을 JSON 파일로 내보냈어요.`, false)
}

function importGalleryBackupFromFile(file) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ''))
      const incoming = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : null
      if (!incoming) throw new Error('올바른 백업 파일 형식이 아니에요')

      const existing = readGallery()
      const merged = existing.slice()
      let added = 0
      let updated = 0
      incoming.forEach((item) => {
        if (!item || !item.id || !item.imageUrl) return
        const idx = merged.findIndex((entry) => entry.id === item.id)
        if (idx === -1) {
          merged.push(item)
          added += 1
        } else {
          merged[idx] = { ...merged[idx], ...item }
          updated += 1
        }
      })
      writeGallery(merged)
      renderGallery()
      setFormStatus(`가져오기 완료: 새 항목 ${added}개, 기존 항목 갱신 ${updated}개.`, false)
    } catch (error) {
      setFormStatus(
        `가져오기 실패: 올바른 백업 파일이 아니에요. (${error instanceof Error ? error.message : String(error)})`,
        true,
      )
    }
  }
  reader.onerror = () => setFormStatus('파일을 읽지 못했어요.', true)
  reader.readAsText(file)
}

document.getElementById('gallery-export')?.addEventListener('click', exportGalleryBackup)
document.getElementById('gallery-export-admin')?.addEventListener('click', exportGalleryBackup)

const galleryImportInput = document.getElementById('gallery-import-input')
document.getElementById('gallery-import')?.addEventListener('click', () => galleryImportInput?.click())
document.getElementById('gallery-import-admin')?.addEventListener('click', () => galleryImportInput?.click())
galleryImportInput?.addEventListener('change', () => {
  const file = galleryImportInput.files?.[0]
  if (file) importGalleryBackupFromFile(file)
  galleryImportInput.value = ''
})

/** R2 영구 저장 기능이 생기기 전에 이미 갤러리에 있던 항목은 여전히 fal/replicate
 *  임시 링크를 그대로 들고 있다. 그 항목들만 찾아 지금 R2로 옮긴다(이미 영구 저장된
 *  항목은 건드리지 않음). 각 요청 사이에 살짝 간격을 둬서 레이트리밋에 걸리지 않게 한다. */
let galleryMigrateRunning = false

async function migrateGalleryToPermanentStorage(triggerButtons) {
  if (galleryMigrateRunning) return
  const items = readGallery()
  const tasks = []
  items.forEach((item) => {
    if (item.imageUrl && !isPermanentMediaUrl(item.imageUrl)) {
      tasks.push({ itemId: item.id, kind: 'image', url: item.imageUrl })
    }
    if (item.videoUrl && !isPermanentMediaUrl(item.videoUrl)) {
      tasks.push({ itemId: item.id, kind: 'video', url: item.videoUrl })
    }
  })
  if (!tasks.length) {
    setFormStatus('이미 모든 갤러리 이미지·영상이 영구 저장돼 있어요.', false)
    return
  }

  galleryMigrateRunning = true
  triggerButtons.forEach((btn) => btn && (btn.disabled = true))
  let done = 0
  let failed = 0
  try {
    for (const task of tasks) {
      const kindLabel = task.kind === 'video' ? '영상' : '이미지'
      setFormStatus(`옛 ${kindLabel}을 영구 저장소로 옮기는 중… (${done + failed + 1}/${tasks.length})`, false)
      const permanentUrl = await persistImageToPermanentStorage(task.url)
      if (permanentUrl) {
        if (task.kind === 'video') {
          applyPersistedVideoUrl(task.itemId, task.url, permanentUrl)
        } else {
          applyPersistedImageUrl(task.itemId, task.url, permanentUrl)
        }
        done += 1
      } else {
        failed += 1
      }
      // 연속 호출 사이 짧은 간격 — 레이트리밋(60회/시간) 여유
      await new Promise((resolve) => window.setTimeout(resolve, 300))
    }
  } finally {
    galleryMigrateRunning = false
    triggerButtons.forEach((btn) => btn && (btn.disabled = false))
  }

  if (failed > 0) {
    setFormStatus(
      `영구 저장 완료: ${done}개 성공, ${failed}개 실패(이미 만료된 링크일 수 있어요 — 다시 생성해 주세요).`,
      failed === tasks.length,
    )
  } else {
    setFormStatus(`영구 저장 완료: ${done}개 이미지·영상을 옮겼어요.`, false)
  }
}

const galleryMigrateButtons = [
  document.getElementById('gallery-migrate'),
  document.getElementById('gallery-migrate-admin'),
]
galleryMigrateButtons.forEach((btn) => {
  btn?.addEventListener('click', () => migrateGalleryToPermanentStorage(galleryMigrateButtons))
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
        if (!isAdminUser()) {
          clearAllAuth()
          showPinGate(authErrorMessage('solo_admin_only'))
          return
        }
        showApp()
        return
      }
      clearSessionToken()
      if (data.error === 'solo_admin_only') {
        showPinGate(authErrorMessage('solo_admin_only'))
        return
      }
    } catch {
      /* 세션 검증 실패 — 로그인 화면 */
    }
  }

  showPinGate()
}

const ADMIN_PANEL_KEY = 'storymag-admin-panel'

function getAdminPanel() {
  const saved = localStorage.getItem(ADMIN_PANEL_KEY)
  return saved === 'gallery' || saved === 'faceswap' ? saved : 'fashion'
}

function setAdminPanel(panel) {
  const next = panel === 'gallery' || panel === 'faceswap' ? panel : 'fashion'
  localStorage.setItem(ADMIN_PANEL_KEY, next)
  syncAdminWorkspaceUi()
}

function syncAdminWorkspaceUi() {
  const area = getAppArea()
  const panel = getAdminPanel()
  const subnav = document.getElementById('admin-subnav')
  const faceswapPanel = document.getElementById('admin-faceswap-panel')
  const formPanel = document.getElementById('generate-form')?.closest('section.panel')
  const isAdminArea = area === 'admin'

  if (subnav) subnav.hidden = !isAdminArea
  document.querySelectorAll('[data-admin-panel]').forEach((btn) => {
    const on = btn.getAttribute('data-admin-panel') === panel
    btn.classList.toggle('admin-subnav__btn--active', on && isAdminArea)
    btn.setAttribute('aria-selected', on && isAdminArea ? 'true' : 'false')
  })

  if (faceswapPanel) faceswapPanel.hidden = !(isAdminArea && panel === 'faceswap')
  if (adminGallerySection) adminGallerySection.hidden = !(isAdminArea && panel === 'gallery')

  if (formPanel) {
    formPanel.hidden = isAdminArea && panel !== 'fashion'
  }
  if (resultSection) {
    if (isAdminArea && panel !== 'fashion') {
      resultSection.hidden = true
    } else if (area === 'studio' || area === 'admin') {
      syncResultVisibilityForArea(area === 'admin' ? 'fashion' : 'free')
    }
  }
}

document.querySelectorAll('[data-admin-panel]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setAdminPanel(btn.getAttribute('data-admin-panel') || 'fashion')
  })
})

// ---- 얼굴 교체(간단 모드) — 올가미/맞추기 없이 한 번의 AI 호출로 얼굴만 교체 ----
;(() => {
  const targetSlot = document.getElementById('admin-faceswap-target-slot')
  const face0Slot = document.getElementById('admin-faceswap-face0-slot')
  const face1Slot = document.getElementById('admin-faceswap-face1-slot')
  const targetInput = document.getElementById('admin-faceswap-target-input')
  const targetClearBtn = document.getElementById('admin-faceswap-target-clear')
  const face0Input = document.getElementById('admin-faceswap-face0-input')
  const face1Input = document.getElementById('admin-faceswap-face1-input')
  const gender0Select = document.getElementById('admin-faceswap-gender0')
  const gender1Select = document.getElementById('admin-faceswap-gender1')
  const face1ClearBtn = document.getElementById('admin-faceswap-face1-clear')
  const workflowSelect = document.getElementById('admin-faceswap-workflow')
  const upscaleCheckbox = document.getElementById('admin-faceswap-upscale')
  const runBtn = document.getElementById('admin-faceswap-run')
  const statusEl = document.getElementById('admin-faceswap-status')
  const resultWrap = document.getElementById('admin-faceswap-result-wrap')
  const resultPlaceholder = document.getElementById('admin-faceswap-result-placeholder')
  const resultImg = document.getElementById('admin-faceswap-result-img')
  const resultActions = document.getElementById('admin-faceswap-result-actions')
  const resultDownload = document.getElementById('admin-faceswap-result-download')
  const resultToMainBtn = document.getElementById('admin-faceswap-result-to-main')
  if (!targetSlot || !face0Slot || !face1Slot || !runBtn) return

  const state = { target: null, face0: null, face1: null }

  function setStatus(msg, isError) {
    if (!statusEl) return
    statusEl.hidden = !msg
    statusEl.textContent = msg || ''
    statusEl.classList.toggle('form__status--error', Boolean(isError))
  }

  function setSlotPreview(slotEl, dataUrl) {
    if (!slotEl) return
    if (dataUrl) {
      slotEl.style.backgroundImage = `url("${dataUrl}")`
      slotEl.classList.remove('admin-fuse-slot--empty')
      slotEl.classList.add('admin-faceswap-slot--filled')
    } else {
      slotEl.style.backgroundImage = ''
      slotEl.classList.add('admin-fuse-slot--empty')
      slotEl.classList.remove('admin-faceswap-slot--filled')
    }
  }

  async function assignFile(key, slotEl, file) {
    if (!file || !String(file.type || '').startsWith('image/')) {
      setStatus('이미지 파일만 넣을 수 있어요 (PNG/JPEG/WEBP).', true)
      return
    }
    try {
      const dataUrl = await prepareImageDataUrl(file)
      state[key] = dataUrl
      setSlotPreview(slotEl, dataUrl)
      setStatus('', false)
    } catch (error) {
      setStatus(`사진을 불러오지 못했어요: ${error instanceof Error ? error.message : String(error)}`, true)
    }
  }

  function wireSlot(key, slotEl, inputEl) {
    slotEl.addEventListener('click', () => inputEl?.click())
    slotEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        inputEl?.click()
      }
    })
    inputEl?.addEventListener('change', () => {
      const file = inputEl.files?.[0]
      if (file) void assignFile(key, slotEl, file)
      inputEl.value = ''
    })
    slotEl.addEventListener('dragover', (event) => {
      event.preventDefault()
      slotEl.classList.add('admin-fuse-slot--drag')
    })
    slotEl.addEventListener('dragleave', () => {
      slotEl.classList.remove('admin-fuse-slot--drag')
    })
    slotEl.addEventListener('drop', (event) => {
      event.preventDefault()
      slotEl.classList.remove('admin-fuse-slot--drag')
      const file = pickImageFileFromDataTransfer(event.dataTransfer)
      if (file) void assignFile(key, slotEl, file)
    })
    slotEl.addEventListener('paste', (event) => {
      const file = pickImageFileFromDataTransfer(event.clipboardData)
      if (file) {
        event.preventDefault()
        void assignFile(key, slotEl, file)
      }
    })
  }

  wireSlot('target', targetSlot, targetInput)
  wireSlot('face0', face0Slot, face0Input)
  wireSlot('face1', face1Slot, face1Input)

  face1ClearBtn?.addEventListener('click', () => {
    state.face1 = null
    setSlotPreview(face1Slot, null)
  })

  targetClearBtn?.addEventListener('click', () => {
    state.target = null
    setSlotPreview(targetSlot, null)
    setStatus('', false)
  })

  async function sleep(ms) {
    await new Promise((resolve) => window.setTimeout(resolve, ms))
  }

  // 얼굴 2장(특히 두 명 동시 교체, 또는 방금 새로 생성한 낯선 장면 위 교체)은 fal 처리가
  // 몇 분씩 걸리는 경우가 실측됐다 — 서버는 submit만 하고 status/response URL을 돌려준 뒤
  // 이 함수가 짧게 반복 조회한다(animate.ts의 predictionId 폴링과 동일한 이유 — Pages
  // Function 벽시계 한도 회피). 90회(약 3.6분)는 2인 교체엔 너무 짧아 넉넉히 늘린다.
  async function pollFaceSwapStatus(statusUrl, responseUrl, startedAt, label) {
    const prefix = label ? `${label}: ` : ''
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000)
      setStatus(
        elapsedSec > 60
          ? `${prefix}얼굴 교체 중… ${elapsedSec}초 (드물게 몇 분 걸릴 수 있어요, 기다려 주세요)`
          : `${prefix}얼굴 교체 중… ${elapsedSec}초`,
        false,
      )
      await sleep(attempt < 6 ? 1500 : 2500)
      const response = await fetch('/api/face-swap-status', {
        method: 'POST',
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusUrl, responseUrl }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        if (typeof clearAllAuth === 'function') clearAllAuth()
        if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
        return null
      }
      if (data.status === 'succeeded' && data.imageUrl) return data.imageUrl
      if (data.status === 'failed') {
        setStatus(data.message || `얼굴 교체에 실패했어요: ${data.error || 'unknown_error'}`, true)
        return null
      }
      // pending — 계속 대기
    }
    setStatus('얼굴 교체가 너무 오래 걸려요. 잠시 후 다시 시도해 주세요.', true)
    return null
  }

  // 1인 얼굴 교체 1회 호출(제출 + 필요 시 폴링). 2인 교체를 "빠른 1인 교체 2번"으로
  // 체이닝할 때도, 평범한 1인 교체일 때도 이 함수 하나로 처리한다.
  async function runSingleFaceSwap(opts) {
    const payload = {
      targetImage: opts.targetImage,
      face0: opts.faceDataUrl,
      gender0: opts.gender,
      workflowType: opts.workflowType,
      upscale: opts.upscale,
    }
    const response = await fetch('/api/face-swap', {
      method: 'POST',
      headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401) {
      if (typeof clearAllAuth === 'function') clearAllAuth()
      if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
      return null
    }
    if (response.status === 429) {
      setStatus(data.message || '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.', true)
      return null
    }
    if (data.ok && data.imageUrl) return data.imageUrl
    if (data.ok && data.pending && data.statusUrl && data.responseUrl) {
      return await pollFaceSwapStatus(data.statusUrl, data.responseUrl, Date.now(), opts.stepLabel)
    }
    const prefix = opts.stepLabel ? `${opts.stepLabel}: ` : ''
    setStatus(
      `${prefix}${
        data.message ||
        (data.error === 'fal_key_not_configured'
          ? '얼굴 교체 기능이 서버에 아직 설정되지 않았어요 (FAL_KEY 필요).'
          : `얼굴 교체에 실패했어요: ${data.error || response.status}`)
      }`,
      true,
    )
    return null
  }

  runBtn.addEventListener('click', async () => {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      if (typeof showPinGate === 'function') showPinGate('로그인이 필요해요.')
      return
    }
    if (!state.target) {
      setStatus('먼저 기본 사진(장면)을 넣어 주세요.', true)
      return
    }
    if (!state.face0) {
      setStatus('붙일 얼굴 사진(얼굴 1)을 넣어 주세요.', true)
      return
    }
    runBtn.disabled = true
    if (resultImg) resultImg.hidden = true
    if (resultActions) resultActions.hidden = true
    if (resultPlaceholder) resultPlaceholder.hidden = false
    const startedAt = Date.now()
    try {
      const hasSecondFace = Boolean(state.face1)
      let imageUrl
      if (hasSecondFace) {
        // fal의 easel-ai 모델은 "얼굴 2장 동시 교체"를 한 번에 처리하려 하면 내부적으로
        // 훨씬 무거운 연산을 타서 몇 분씩 걸리고 가끔 타임아웃까지 나는 게 실측됐다 —
        // 대신 "빠른 1인 교체(보통 10~30초)"를 두 번 연달아 체이닝하면 대개 훨씬 빠르고
        // 안정적이다: 1단계 결과(얼굴1 합성 완료 사진)를 2단계의 새 기본 사진으로 넘긴다.
        setStatus('1/2단계: 얼굴 1 교체 중…', false)
        const step1 = await runSingleFaceSwap({
          targetImage: state.target,
          faceDataUrl: state.face0,
          gender: gender0Select?.value || 'female',
          workflowType: workflowSelect?.value || 'user_hair',
          upscale: false, // 중간 단계는 업스케일 생략 — 2단계 이후 최종 결과만 업스케일
          startedAt,
          stepLabel: '1/2단계 (얼굴 1)',
        })
        if (!step1) return
        setStatus('2/2단계: 얼굴 2 교체 중…', false)
        imageUrl = await runSingleFaceSwap({
          targetImage: step1,
          faceDataUrl: state.face1,
          gender: gender1Select?.value || 'male',
          workflowType: workflowSelect?.value || 'user_hair',
          upscale: Boolean(upscaleCheckbox?.checked),
          startedAt,
          stepLabel: '2/2단계 (얼굴 2)',
        })
        if (!imageUrl) return
      } else {
        setStatus('얼굴 교체 중… 0초', false)
        imageUrl = await runSingleFaceSwap({
          targetImage: state.target,
          faceDataUrl: state.face0,
          gender: gender0Select?.value || 'female',
          workflowType: workflowSelect?.value || 'user_hair',
          upscale: Boolean(upscaleCheckbox?.checked),
          startedAt,
          stepLabel: '',
        })
        if (!imageUrl) return
      }
      if (resultImg) {
        resultImg.src = imageUrl
        resultImg.hidden = false
      }
      if (resultDownload) resultDownload.href = imageUrl
      if (resultActions) resultActions.hidden = false
      if (resultPlaceholder) resultPlaceholder.hidden = true
      if (resultWrap) resultWrap.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setStatus('얼굴 교체 완료! 아래 4번 결과란을 확인하세요.', false)
    } catch (error) {
      setStatus(`얼굴 교체 중 오류: ${error instanceof Error ? error.message : String(error)}`, true)
    } finally {
      runBtn.disabled = false
    }
  })

  // ---- 커플 씬 자동 생성 — 얼굴 사진 2장만 있으면 데이트/포옹/키스 장면을 AI가 새로 만들고
  // 그 위에 바로 얼굴을 합성한다(기본 사진을 직접 찍거나 구할 필요가 없음). ----
  const scenePresetSelect = document.getElementById('admin-faceswap-scene-preset')
  const scenePhotorealBtn = document.getElementById('admin-faceswap-scene-photoreal')
  const sceneGenerateBtn = document.getElementById('admin-faceswap-scene-generate')
  const sceneAndSwapBtn = document.getElementById('admin-faceswap-scene-and-swap')

  // "차렷 자세로 뻣뻣하게 서 있다"는 실측 실패 사례 — 팔짱/포옹/키스라는 단어만으로는
  // 부족해서, 팔의 구체적 위치·몸의 기울임·체중 이동까지 명시하고 "차렷 자세 금지"를
  // 직접 못박아야 자연스러운 커플 포즈가 나온다.
  const SCENE_PRESET_DESCRIPTIONS = {
    arm_in_arm:
      '20대 남녀 커플이 도심 거리에서 팔짱을 끼고 나란히 걸으며 데이트하는 모습. 여자가 남자의 팔을 양손으로 감싸 팔짱을 끼고, 두 사람의 어깨와 상체가 서로 살짝 기울어 맞닿아 있다. 서로 마주보며 자연스럽게 웃는 표정, 캐주얼하고 단정한 옷차림, 낮 시간 배경, 두 사람의 얼굴이 또렷하게 보이는 정면 구도, 사진처럼 사실적인 화보. 뻣뻣하게 양팔을 몸통 옆에 붙이고 차렷 자세로 정면을 보고 서 있는 증명사진 같은 포즈는 절대 금지.',
    hug: '20대 남녀 커플이 서로 마주 서서 다정하게 포옹하는 모습. 한 사람의 팔이 상대방의 등과 허리를 감싸 안고, 두 사람의 몸이 가깝게 밀착되어 있으며 고개는 서로의 어깨나 얼굴 쪽으로 살짝 기울어 있다. 캐주얼하고 단정한 옷차림, 실내 또는 거리 배경, 사진처럼 사실적인 화보. 뻣뻣하게 양팔을 몸통 옆에 붙이고 차렷 자세로 나란히 서 있는 증명사진 같은 포즈는 절대 금지.',
    kiss: '20대 남녀 커플이 서로 마주 보고 다정하게 입맞춤하는 모습. 두 사람이 서로를 향해 몸을 기울이고, 한쪽 또는 양쪽 팔이 상대방의 허리나 얼굴을 감싸며 입술이 맞닿아 있다. 캐주얼하고 단정한 옷차림, 사진처럼 사실적인 화보. 뻣뻣하게 양팔을 몸통 옆에 붙이고 차렷 자세로 떨어져 서 있는 증명사진 같은 포즈는 절대 금지.',
  }

  async function generateCoupleScene() {
    const description =
      SCENE_PRESET_DESCRIPTIONS[scenePresetSelect?.value] || SCENE_PRESET_DESCRIPTIONS.arm_in_arm
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, mood: 'clean', size: 'portrait', mode: 'fashion' }),
    })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401) {
      if (typeof clearAllAuth === 'function') clearAllAuth()
      if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
      return null
    }
    if (response.status === 429) {
      setStatus(data.message || '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.', true)
      return null
    }
    if (!data.ok || !data.imageUrl) {
      setStatus(
        data.message ||
          (data.error === 'provider_content_blocked'
            ? '장면 생성이 안전 필터에 걸렸어요. 다른 장면을 골라 다시 시도해 주세요.'
            : `장면 생성에 실패했어요: ${data.error || response.status}`),
        true,
      )
      return null
    }
    return data.imageUrl
  }

  // 이미 본인이 "1. 기본 사진"을 직접 넣어둔 상태에서 장면 생성 버튼을 누르면, 그 사진을
  // 그대로 덮어써버려서 "엉뚱한 사진이 나왔다"는 혼란이 생긴다 — 기본 사진이 이미 있으면
  // 확인 없이 진행하지 않고 안내만 하고 멈춘다.
  function blockedByExistingTarget() {
    if (!state.target) return false
    setStatus(
      '이미 "1. 기본 사진"이 채워져 있어요 — 이 버튼은 그 사진을 새로 만든 장면으로 덮어씁니다. 기존 사진을 그대로 쓰려면 "얼굴 바로 바꾸기"를 누르세요. 새 장면으로 바꾸려면 먼저 기본 사진 슬롯을 지우고(다시 클릭 후 다른 파일 선택 또는 새로고침) 다시 시도해 주세요.',
      true,
    )
    return true
  }

  // 증명사진 2장을 참고 이미지로 그대로 Flux Kontext Multi에 넘겨서, "장면 생성 + 별도
  // 얼굴교체" 2단계 대신 한 번의 생성으로 실제 얼굴을 유지한 전신 장면을 바로 만든다.
  // face-swap보다 훨씬 빠르고(생성 1회), 얼굴이 원본과 다른 사람으로 나오는 사고도 줄어든다.
  async function generateCoupleScenePhotoreal(face0DataUrl, face1DataUrl) {
    const preset = SCENE_PRESET_DESCRIPTIONS[scenePresetSelect?.value] || SCENE_PRESET_DESCRIPTIONS.arm_in_arm
    const description = `${preset} 두 사람 모두 전신이 보이는 구도. 첫 번째 참고 사진의 사람과 두 번째 참고 사진의 사람, 이 두 사람이 함께 있는 장면.`
    const response = await fetch('/api/tale-scene', {
      method: 'POST',
      headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: [face0DataUrl, face1DataUrl],
        description,
        aspectRatio: '3:4',
        photoreal: true,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401) {
      if (typeof clearAllAuth === 'function') clearAllAuth()
      if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
      return null
    }
    if (response.status === 429) {
      setStatus(data.message || '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.', true)
      return null
    }
    if (!data.ok || !data.imageUrl) {
      setStatus(
        data.message ||
          (data.error === 'provider_content_blocked'
            ? '장면 생성이 안전 필터에 걸렸어요. 다른 장면을 골라 다시 시도해 주세요.'
            : `장면 생성에 실패했어요: ${data.error || response.status}`),
        true,
      )
      return null
    }
    return data.imageUrl
  }

  scenePhotorealBtn?.addEventListener('click', async () => {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      if (typeof showPinGate === 'function') showPinGate('로그인이 필요해요.')
      return
    }
    if (!state.face0) {
      setStatus('얼굴 1(본인) 증명사진을 먼저 넣어 주세요.', true)
      return
    }
    if (!state.face1) {
      setStatus('얼굴 2(상대) 증명사진도 넣어야 커플 장면을 만들 수 있어요.', true)
      return
    }
    scenePhotorealBtn.disabled = true
    if (resultImg) resultImg.hidden = true
    if (resultActions) resultActions.hidden = true
    if (resultPlaceholder) resultPlaceholder.hidden = false
    setStatus('두 사람의 얼굴을 유지한 채 장면을 만들고 있어요… (보통 20~40초)', false)
    try {
      const imageUrl = await generateCoupleScenePhotoreal(state.face0, state.face1)
      if (!imageUrl) return
      if (resultImg) {
        resultImg.src = imageUrl
        resultImg.hidden = false
      }
      if (resultDownload) resultDownload.href = imageUrl
      if (resultActions) resultActions.hidden = false
      if (resultPlaceholder) resultPlaceholder.hidden = true
      if (resultWrap) resultWrap.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setStatus('완성! 아래 4번 결과란을 확인하세요. (얼굴이 조금 다르면 이 결과를 "기본 사진"으로 쓰고 「얼굴 바로 바꾸기」로 한 번 더 다듬을 수 있어요)', false)
      state.target = imageUrl
      setSlotPreview(targetSlot, imageUrl)
    } catch (error) {
      setStatus(`장면 생성 중 오류: ${error instanceof Error ? error.message : String(error)}`, true)
    } finally {
      scenePhotorealBtn.disabled = false
    }
  })

  sceneGenerateBtn?.addEventListener('click', async () => {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      if (typeof showPinGate === 'function') showPinGate('로그인이 필요해요.')
      return
    }
    if (blockedByExistingTarget()) return
    sceneGenerateBtn.disabled = true
    setStatus('데이트 장면을 만들고 있어요…', false)
    try {
      const imageUrl = await generateCoupleScene()
      if (!imageUrl) return
      state.target = imageUrl
      setSlotPreview(targetSlot, imageUrl)
      setStatus('장면을 만들었어요. 얼굴 사진을 넣고 「얼굴 바로 바꾸기」를 눌러 주세요.', false)
    } catch (error) {
      setStatus(`장면 생성 중 오류: ${error instanceof Error ? error.message : String(error)}`, true)
    } finally {
      sceneGenerateBtn.disabled = false
    }
  })

  sceneAndSwapBtn?.addEventListener('click', async () => {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      if (typeof showPinGate === 'function') showPinGate('로그인이 필요해요.')
      return
    }
    if (blockedByExistingTarget()) return
    if (!state.face0) {
      setStatus('얼굴 1(본인) 사진을 먼저 넣어 주세요.', true)
      return
    }
    if (!state.face1) {
      setStatus('얼굴 2(상대) 사진도 넣어야 커플 장면을 만들 수 있어요.', true)
      return
    }
    sceneAndSwapBtn.disabled = true
    setStatus('데이트 장면을 만들고 있어요…', false)
    try {
      const imageUrl = await generateCoupleScene()
      if (!imageUrl) return
      state.target = imageUrl
      setSlotPreview(targetSlot, imageUrl)
      runBtn.click()
    } catch (error) {
      setStatus(`장면 생성 중 오류: ${error instanceof Error ? error.message : String(error)}`, true)
    } finally {
      sceneAndSwapBtn.disabled = false
    }
  })

  resultToMainBtn?.addEventListener('click', () => {
    const url = resultImg?.src
    if (!url) {
      // 예전엔 여기서 조용히 return만 해서 "클릭했는데 아무 반응 없다"는 혼란이 있었다.
      setStatus('아직 결과 이미지가 없어요 — 먼저 위에서 얼굴 교체를 실행해 주세요.', true)
      return
    }
    // 얼굴 교체(간단 모드)는 관리자 전용 패널에서만 접근 가능한 기능이라 항상 '화보(관리자)'
    // 결과로 취급해야 한다. getGenMode()는 화면의 gen-mode 라디오 상태에 의존하는데, 그 라디오가
    // 어떤 이유로든 'free'로 남아있으면 이 결과가 "내 갤러리"로 저장되어 버려서 사용자가 기대하는
    // "관리자 전용 갤러리"에서 보이지 않는 회귀가 있었다 — 항상 'fashion'으로 고정한다.
    if (typeof setAppArea === 'function') setAppArea('admin')
    setAdminPanel('fashion')
    showResult(url, '얼굴 교체(AI)', false, {
      size: sizeField.value,
      itemId: null,
      prompt: '얼굴 교체(간단 모드) 결과',
      accepted: false,
      mood: moodField.value,
      engine: 'face-swap',
      genMode: 'fashion',
      reviseRound: 0,
    })
    setFormStatus('얼굴 교체 결과를 메인 결과로 가져왔어요. 「이미지 수정」·「쇼츠」·갤러리 저장이 바로 가능해요.', false)
  })
})()

bootAuth()
renderGallery()
