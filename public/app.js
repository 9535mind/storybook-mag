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
  if (adminGallerySection) adminGallerySection.hidden = area !== 'admin'

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

const loadImageButton = document.getElementById('load-image-button')
const loadImageInput = document.getElementById('load-image-input')

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

/** 「수정하기」 버튼 라벨을 "N차 수정"으로 갱신한다(다음 클릭이 몇 번째 수정인지 표시). */
function updateReviseButtonLabel() {
  const label = `${(currentResult.reviseRound || 0) + 1}차 수정`
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
  setReviewChrome('revising')
  setReviseStatus('수정 요청을 입력한 뒤 「수정 적용」을 누르세요.', false)
}

function closeRevisePanel() {
  setReviewChrome('idle')
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
  currentResult.imageDataUrl = null
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
  void cacheImageForAnimate(imageUrl)

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
  // 사용자가 모션 힌트에 직접 반대되는 속도를 써놓고(예: "느리게 걷는다") 속도 버튼도
  // 따로 선택했으면(예: 빠르게), 자동으로 붙는 속도 힌트가 사용자 문구와 모순돼 영상
  // 모델에 비일관적인 지시가 전달될 수 있다 — 이때는 사용자가 직접 쓴 텍스트를 우선하고
  // 자동 속도 힌트는 붙이지 않는다.
  const speedConflict =
    (speedKey === 'slow' && /빠르게|빨리|급하게|격렬하게|재빠르게|fast|quick(?:ly)?|rapid(?:ly)?/i.test(motionBase)) ||
    (speedKey === 'fast' && /느리게|느린|천천히|slow(?:ly)?/i.test(motionBase))
  const speedHint = speedConflict ? '' : VIDEO_MOTION_HINTS[speedKey] || ''
  const motion = [motionBase, speedHint].filter(Boolean).join('. ')
  const speedLabel = speedKey === 'slow' ? '느리게' : speedKey === 'fast' ? '빠르게' : '보통'
  const undressMotion = wantsUndressActionClient(motionBase)
  // 실제로 어떤 모션 문구가 이번 요청에 반영됐는지 눈으로 바로 확인할 수 있게 상태 문구에
  // 노출한다 — 이전 요청 값이 그대로 남아 쓰이는지 헷갈릴 때 즉시 알아챌 수 있다.
  const motionPreview = motionBase
    ? ` (모션: "${motionBase.slice(0, 60)}${motionBase.length > 60 ? '…' : ''}"${speedConflict ? ` · 속도 버튼(${speedLabel})은 문구와 반대돼 자동 속도 힌트를 붙이지 않았어요` : ''})`
    : ' (모션 힌트 없음 · 기본 동작)'
  const stopTimer = startProgressTimer(
    setAnimateStatus,
    undressMotion
      ? `탈의·누드 모션으로 쇼츠(약 ${durationSec}초)를 시작해요…${motionPreview} (원본이 옷을 입은 상태면 엔진이 잘 안 벗기는 경우가 있어요)`
      : `쇼츠 영상(약 ${durationSec}초 · ${speedLabel})을 시작하고 있어요…${motionPreview}`,
  )

  try {
    // 캐시가 없으면 한 번 더 시도 (만료 전이면 성공)
    if (!currentResult.imageDataUrl && currentResult.imageUrl) {
      await cacheImageForAnimate(currentResult.imageUrl)
    }

    const response = await fetch('/api/animate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        imageUrl: currentResult.imageUrl,
        imageDataUrl: currentResult.imageDataUrl || undefined,
        prompt: currentResult.prompt,
        motion,
        size: currentResult.size,
        durationSec,
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
      setAnimateStatus(
        '정책에 의해 차단된 표현이 포함되어 있어요. 미성년·강간·실존인물 묘사는 사용할 수 없어요.',
        true,
      )
      return
    }

    if (!data.ok) {
      setAnimateStatus(`영상 생성에 실패했어요: ${animateErrorMessage(data, response)}`, true)
      return
    }

    let finalData = data
    if (data.pending && data.predictionId) {
      setAnimateStatus(
        `영상 렌더링 중(약 ${durationSec}초 · ${speedLabel})… 완료까지 1~2분 걸릴 수 있어요`,
        false,
      )
      finalData = await pollAnimateUntilDone(
        data.predictionId,
        data.durationSec || durationSec,
        speedLabel,
        (elapsedSec) => {
          setAnimateStatus(
            `영상 렌더링 중… ${elapsedSec}초 경과 (약 ${durationSec}초 · ${speedLabel})`,
            false,
          )
        },
      )
      if (!finalData) return
    }

    if (!finalData.videoUrl) {
      setAnimateStatus('영상 생성에 실패했어요: 결과 주소가 비어 있어요.', true)
      return
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
    // 다시 만들기로 옛 영상이 이미 R2에 영구 저장돼 있었다면, 새 영상이 안전하게
    // 저장된 뒤에 지운다.
    const animatedItemId = currentResult.itemId
    const previousPermanentVideoUrl = animatedItemId
      ? (() => {
          const prev = readGallery().find((entry) => entry.id === animatedItemId)?.videoUrl
          return isPermanentMediaUrl(prev) ? prev : null
        })()
      : null
    updateGalleryItemVideo(currentResult.itemId, finalData.videoUrl, draft)
    const dur = finalData.durationSec || durationSec
    setAnimateStatus(`쇼츠 영상 제작 완료(약 ${dur}초 · ${speedLabel})! (영상을 영구 저장하는 중…)`, false)

    // 영상도 replicate.delivery의 임시 CDN 링크라 시간이 지나면 만료된다. 이미지와
    // 마찬가지로 갤러리에 남는 즉시 R2로 백그라운드 복사해 영구 주소로 바꿔둔다.
    const animatedVideoUrl = finalData.videoUrl
    persistImageToPermanentStorage(animatedVideoUrl).then((permanentUrl) => {
      if (!permanentUrl) return
      applyPersistedVideoUrl(animatedItemId, animatedVideoUrl, permanentUrl)
      if (previousPermanentVideoUrl) deletePermanentMediaIfNeeded(previousPermanentVideoUrl)
      setAnimateStatus(`쇼츠 영상 제작 완료(약 ${dur}초 · ${speedLabel})! 영상도 영구 저장했어요.`, false)
    })
  } catch (error) {
    stopTimer()
    setAnimateStatus(
      `영상 생성에 실패했어요: ${error instanceof Error ? error.message : String(error)}`,
      true,
    )
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
      '사진을 불러왔어요! 아래에서 「1차 수정」・영역 지정으로 고치거나 「수용하기」로 갤러리에 저장하세요.',
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

// 화보/일러스트 스튜디오 화면에서 Ctrl+V로 사진을 붙여넣으면 바로 불러온다.
// 클립보드에 이미지가 없으면(텍스트만 있으면) 아무것도 가로채지 않고 원래 붙여넣기 동작을 둔다.
document.addEventListener('paste', (event) => {
  const area = getAppArea()
  if (area !== 'studio' && area !== 'admin') return
  const items = event.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.kind === 'file' && String(item.type || '').startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        event.preventDefault()
        loadImageFromFile(file)
      }
      return
    }
  }
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
    // 영역 지정 수정은 "지정한 사각형 밖은 그대로 보존"하는 방식이라, 누드/전신처럼
    // 마스크 밖 전체에 영향을 주는 요청과 함께 쓰면 그 부분이 반영되지 않는다
    // (예: "바구니 제거 + 올누드로" 요청 시 바구니만 지워지고 인물은 그대로 옷을 입은
    // 채 남는 사고가 실측으로 확인됐다). 미리 알려주고 계속할지 확인한다.
    const wholeBodyPattern = /누드|나체|전라|전신|올누드|풀바디|속옷|란제리|nude|naked|undress/i
    if (wholeBodyPattern.test(revision)) {
      const proceed = window.confirm(
        '영역 지정 수정은 지정한 사각형 밖은 바뀌지 않아요. 누드/전신처럼 몸 전체에 영향을 주는 요청은 "텍스트로 수정"이 더 잘 맞아요.\n\n그래도 지금 지정한 영역만 수정으로 계속할까요? (취소하면 모드를 바꿔서 다시 시도할 수 있어요)',
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
        baseDescription: currentResult.prompt || (descriptionField?.value || '').trim(),
        revision,
        maskDataUrl,
        mood: currentResult.mood,
        size: currentResult.size || sizeField?.value || 'landscape',
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

bootAuth()
renderGallery()
