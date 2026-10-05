const SESSION_STORAGE_KEY = 'fashionMagazineSessionToken'
window.__DESK_BUILD = '20261005mw191'
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
const APP_AREAS = ['studio', 'admin', 'essay', 'tale', 'observe', 'free']
const APP_AREA_META = {
  studio: { title: null, subtitle: null },
  admin: { title: null, subtitle: null },
  free: { title: '자유 스튜디오', subtitle: '걸음 없이 · 적은 대로 한 장' },
  essay: { title: '에세이 아키텍트', subtitle: '냉혹한 편집장 · 출간 수준 해체' },
  tale: { title: 'AI 동화 편집', subtitle: '초등 눈높이 · 사건과 행동으로' },
  observe: { title: '그림관찰과 표현', subtitle: '보이는 것을 정확하게' },
}

function getAppArea() {
  const saved = localStorage.getItem(APP_AREA_KEY)
  // 자유 스튜디오도 Desk 와 같은 성인 엔진을 쓴다. 관리자만.
  if ((saved === 'admin' || saved === 'free') && !isAdminUser()) return 'studio'
  if (APP_AREAS.includes(saved)) return saved
  return isAdminUser() ? 'admin' : 'studio'
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
  const freeArea = document.getElementById('free-area')
  if (studioArea) studioArea.hidden = !usesStudioForm
  if (essayArea) essayArea.hidden = area !== 'essay'
  if (taleArea) taleArea.hidden = area !== 'tale'
  if (observeArea) observeArea.hidden = area !== 'observe'
  if (freeArea) freeArea.hidden = area !== 'free'
  // 「내 갤러리」(자유)와 「관리자 전용 갤러리」(화보)는 서로 섞이지 않게 탭별로 완전히 분리해서 보여준다.
  if (freeGallerySection) freeGallerySection.hidden = area !== 'studio'
  syncAdminWorkspaceUi()

  if (appRoot) {
    appRoot.classList.toggle('app--essay', !usesStudioForm)
    appRoot.classList.toggle('app--desk', !usesStudioForm)
    appRoot.classList.toggle('app--adult-desk', area === 'admin')
  }

  document.querySelectorAll('[data-app-area]').forEach((btn) => {
    const on = btn.getAttribute('data-app-area') === area
    btn.classList.toggle('app__area-btn--active', on)
    btn.setAttribute('aria-selected', on ? 'true' : 'false')
  })

  if (newShootHeaderButton) {
    newShootHeaderButton.hidden = !usesStudioForm
    newShootHeaderButton.textContent = area === 'admin' ? '새 화보 시작' : '새 장면 시작'
  }
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
  const freeTab = document.getElementById('app-area-free')
  if (freeTab) freeTab.hidden = !admin
  if (pinSettingsButton) pinSettingsButton.hidden = !admin
  if (!admin) {
    const freeRadio = document.querySelector('input[name="gen-mode"][value="free"]')
    if (freeRadio) freeRadio.checked = true
    const now = getAppArea()
    if (now === 'admin' || now === 'free') setAppArea('studio')
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
  document.getElementById('remove-bg-button-revise'),
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
const bustHeightGroup = document.getElementById('bust-height-select')
const bustHeightGroupShorts = document.getElementById('bust-height-select-shorts')

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
    motionField.placeholder = dual
      ? '전반 예: 옷벗김'
      : '예: 옷벗김 후 자신의 가슴을 주무른다'
  }
  if (dualFrameHint) {
    dualFrameHint.textContent = `${totalSec}초: 전반→후반 이어붙임. 첫 얼굴은 신분증으로 남기고, 끝 장에 얼굴이 보이면 다시 맞춥니다. 줌인은 모션에 「줌인」을 적을 때만.`
  }
  if (videoDurationHint) {
    videoDurationHint.innerHTML = dual
      ? `<strong>${totalSec}초</strong>는 두 프레임 연속 생성입니다. 전반·후반 모션을 적고 아래 버튼으로 만드세요.`
      : '10~18초: 한 프레임. 줌인은 모션에 「줌인」을 적을 때만. 탈의+키스는 <strong>24초</strong>가 더 잘 됩니다.'
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
const OTBEOTGIM_WORD = '옷벗김'
const BUILTIN_MOTION_PRESETS = [
  OTBEOTGIM_WORD,
  '옷벗김 후 자신의 가슴을 주무른다',
  '옷벗김 후 왼손은 가슴을 만지고 오른손은 보지를 만진다',
]

function fieldHasOtbeotgim(value) {
  return /옷벗김/.test(String(value || ''))
}

function toggleOtbeotgimOnField(field, phrase) {
  if (!field) return
  const word = phrase || OTBEOTGIM_WORD
  const cur = (field.value || '').trim()
  if (fieldHasOtbeotgim(cur)) {
    field.value = cur
      .replace(/옷벗김(?:\.\s*겉옷[^.]*(?:나체)?)?/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  } else {
    field.value = cur ? `${word} ${cur}` : word
  }
  field.focus()
}

function bindOtbeotgimChip(boxId, fieldId, phrase) {
  const box = document.getElementById(boxId)
  const field = document.getElementById(fieldId)
  if (!box || !field) return
  box.replaceChildren()
  const chip = document.createElement('button')
  chip.type = 'button'
  chip.className = 'motion-preset-chip'
  chip.setAttribute('aria-pressed', 'false')
  const label = document.createElement('span')
  label.className = 'motion-preset-chip__text'
  label.textContent = OTBEOTGIM_WORD
  chip.appendChild(label)
  const sync = () => {
    const on = fieldHasOtbeotgim(field.value)
    chip.classList.toggle('is-selected', on)
    chip.setAttribute('aria-pressed', on ? 'true' : 'false')
  }
  chip.addEventListener('click', () => {
    toggleOtbeotgimOnField(field, phrase)
    sync()
  })
  field.addEventListener('input', sync)
  box.appendChild(chip)
  sync()
}

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
      if (item.text === OTBEOTGIM_WORD && (target.value || '').trim() && !fieldHasOtbeotgim(target.value)) {
        toggleOtbeotgimOnField(target, OTBEOTGIM_WORD)
      } else {
        target.value = item.text
        target.focus()
      }
      setAnimateStatus(
        item.text === OTBEOTGIM_WORD
          ? '옷벗김을 넣었어요. 겉옷→브라·팬티→나체 순입니다. 필요하면 고친 뒤 쇼츠를 만드세요.'
          : '모션 예시를 넣었어요. 필요하면 고친 뒤 쇼츠를 만드세요.',
        false,
      )
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
bindOtbeotgimChip('description-otbeotgim', 'description', OTBEOTGIM_WORD)
bindOtbeotgimChip('revision-otbeotgim', 'revision-text', OTBEOTGIM_WORD)
bindOtbeotgimChip('fs-scene-body-actions', 'fs-scene-body-desc', OTBEOTGIM_WORD)

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

const BUST_HEIGHT_VALUES = ['auto', 'high', 'mid', 'low']

function getBustHeightFrom(group) {
  const v = group?.dataset?.bustHeight || 'auto'
  return BUST_HEIGHT_VALUES.includes(v) ? v : 'auto'
}

function setBustHeightOn(group, value) {
  const v = BUST_HEIGHT_VALUES.includes(value) ? value : 'auto'
  if (group) group.dataset.bustHeight = v
  group?.querySelectorAll('[data-bust-height]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-bust-height') === v)
  })
}

function getSelectedBustHeight() {
  return getBustHeightFrom(bustHeightGroup)
}

function getSelectedBustHeightShorts() {
  return getBustHeightFrom(bustHeightGroupShorts)
}

bustHeightGroup?.querySelectorAll('[data-bust-height]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setBustHeightOn(bustHeightGroup, btn.getAttribute('data-bust-height'))
  })
})
bustHeightGroupShorts?.querySelectorAll('[data-bust-height]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setBustHeightOn(bustHeightGroupShorts, btn.getAttribute('data-bust-height'))
  })
})

function applyVideoPlaybackRate() {
  if (!resultVideo) return
  const rate = VIDEO_PLAYBACK_RATES[getSelectedVideoSpeed()] || 1
  resultVideo.playbackRate = rate
  resultVideo.loop = true
  try {
    resultVideo.defaultPlaybackRate = rate
  } catch {
    /* ignore */
  }
}

function playResultVideoLoop() {
  if (!resultVideo?.src) return
  resultVideo.loop = true
  const start = () => {
    const play = resultVideo.play()
    if (play && typeof play.catch === 'function') play.catch(() => {})
  }
  if (resultVideo.readyState >= 2) start()
  else resultVideo.addEventListener('canplay', start, { once: true })
}

if (resultVideo && !resultVideo.dataset.loopBound) {
  resultVideo.dataset.loopBound = '1'
  resultVideo.addEventListener('ended', () => {
    if (!resultVideo.loop || !resultVideo.src) return
    resultVideo.currentTime = 0
    resultVideo.play().catch(() => {})
  })
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
const deletePickedGalleryButton = document.getElementById('delete-picked-gallery')
const deletePickedAdminGalleryButton = document.getElementById('delete-picked-admin-gallery')
const galleryPickedIds = new Set()
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
  /** 쇼츠 이음용 끝 장 — 첫 정면 신분증을 덮어쓰지 않는다. */
  isShortsEndFrame: false,
}

/** 24초 이음: 체인 첫 정면 사진. 끝 장으로 바꾸지 않는다. */
let shortsFaceIdStill = null

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

function getStoredAdminPin() {
  return sessionStorage.getItem(LEGACY_PIN_STORAGE_KEY) || ''
}

function setStoredAdminPin(pin) {
  const value = String(pin || '').trim()
  if (value) sessionStorage.setItem(LEGACY_PIN_STORAGE_KEY, value)
  else sessionStorage.removeItem(LEGACY_PIN_STORAGE_KEY)
}

function setSessionToken(token, email) {
  if (token) localStorage.setItem(SESSION_STORAGE_KEY, token)
  else localStorage.removeItem(SESSION_STORAGE_KEY)
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

/** API 호출용 인증 헤더 (세션 토큰 또는 ADMIN_PIN) */
function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra }
  const token = getSessionToken()
  if (token) headers['x-session-token'] = token
  const pin = getStoredAdminPin()
  if (pin) headers['x-admin-pin'] = pin
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
    login_failed: '로그인이 서버에서 끊겼어요. 비밀번호 칸에 Cloudflare ADMIN_PIN을 넣어 다시 시도해 주세요.',
    auth_hash_failed: '비밀번호 검사가 서버에서 실패했어요. Cloudflare ADMIN_PIN으로 들어가 주세요.',
    d1_quota:
      '오늘 회원 DB 읽기 한도를 다 썼어요. 비밀번호 칸에 ADMIN_PIN을 넣으면 바로 들어갑니다. UTC 자정(한국 아침 9시)에 한도가 리셋됩니다.',
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
  return Boolean(getSessionToken() || getStoredAdminPin())
}

function clearAllAuth() {
  sessionStorage.removeItem(LEGACY_PIN_STORAGE_KEY)
  clearSessionToken()
}

function isStorageQuotaError(err) {
  return Boolean(
    err &&
      (err.name === 'QuotaExceededError' ||
        err.code === 22 ||
        err.code === 1014 ||
        /quota/i.test(String(err.message || err))),
  )
}

const MEDIA_DB_NAME = 'storymag-keep'
const MEDIA_DB_VERSION = 1
let galleryMem = null
let deskMem = null
let mediaDbPromise = null

function openKeepDb() {
  if (mediaDbPromise) return mediaDbPromise
  mediaDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(MEDIA_DB_NAME, MEDIA_DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      mediaDbPromise = null
      reject(req.error || new Error('keep_db_open_failed'))
    }
  })
  return mediaDbPromise
}

function keepDbGet(key) {
  return openKeepDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction('kv', 'readonly').objectStore('kv').get(key)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

function keepDbSet(key, value) {
  return openKeepDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite')
        tx.objectStore('kv').put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

function readGalleryFromLocal() {
  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function richerGalleryItem(a, b) {
  if (!a) return b
  if (!b) return a
  const next = { ...b, ...a }
  if (String(b.imageUrl || '').length > String(a.imageUrl || '').length) next.imageUrl = b.imageUrl
  if (String(b.videoUrl || '').length > String(a.videoUrl || '').length) next.videoUrl = b.videoUrl
  return next
}

function mergeGalleryLists(primary, secondary) {
  const map = new Map()
  for (const item of [...(secondary || []), ...(primary || [])]) {
    if (!item?.id) continue
    map.set(item.id, richerGalleryItem(map.get(item.id), item))
  }
  return [...map.values()]
}

function readGallery() {
  if (Array.isArray(galleryMem)) return galleryMem
  return readGalleryFromLocal()
}

function writeGallery(items) {
  const list = Array.isArray(items) ? items.slice() : []
  galleryMem = list
  void persistGalleryKeep(list)
}

function persistGalleryKeep(list) {
  return keepDbSet(GALLERY_STORAGE_KEY, list)
    .then(() => {
      try {
        localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(list))
      } catch (err) {
        if (isStorageQuotaError(err)) {
          try {
            localStorage.removeItem(GALLERY_STORAGE_KEY)
          } catch {
            /* IndexedDB에 원본이 있으므로 로컬만 비움 */
          }
        }
      }
    })
    .catch((err) => {
      console.warn('gallery keep save failed', err)
      try {
        localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(list))
      } catch {
        /* 용량이 차도 메모리 목록은 유지 */
      }
    })
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
  if (animatePanel) animatePanel.hidden = false
  if (getAppArea() === 'admin') {
    const stage = document.getElementById('result-stage')
    if (stage) stage.after(videoResultSection)
  }
  setYoutubeStatus('', false)
  setBgmStatus('', false)
  applyVideoPlaybackRate()
  playResultVideoLoop()
  renderBgmSlots().catch(() => {})
  videoResultSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function hideVideoResult() {
  if (currentResult.videoUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(currentResult.videoUrl)
  }
  resultVideo.pause()
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

function deskErrText(err) {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err.trim()) return err.trim()
  if (err && typeof err === 'object') {
    if (err.message) return String(err.message)
    try {
      const s = JSON.stringify(err)
      if (s && s !== '{}') return s.slice(0, 180)
    } catch (_) {
      /* ignore */
    }
  }
  return '알 수 없는 오류'
}

function setFormStatus(message, isError) {
  formStatus.hidden = !message
  formStatus.textContent = message || ''
  formStatus.className = isError ? 'form__status form__status--error' : 'form__status'
  const deskStatus = document.getElementById('desk-status')
  if (deskStatus) {
    deskStatus.hidden = !message
    deskStatus.textContent = message || ''
    deskStatus.className = isError ? 'form__status form__status--error' : 'form__status'
  }
  const deskProgress = document.getElementById('adult-desk-progress')
  if (deskProgress) {
    deskProgress.hidden = !message
    deskProgress.textContent = message || ''
    deskProgress.classList.toggle('form__status--error', Boolean(isError))
  }
}

function setAnimateStatus(message, isError) {
  animateStatus.hidden = !message
  animateStatus.textContent = message || ''
  animateStatus.className = isError ? 'form__status form__status--error' : 'form__status'
  const deskStatus = document.getElementById('desk-status')
  if (deskStatus) {
    deskStatus.hidden = !message
    deskStatus.textContent = message || ''
    deskStatus.className = isError ? 'form__status form__status--error' : 'form__status'
  }
}

/** 생성 대기 중 경과 초를 1초마다 갱신해 “작업이 진행 중”임을 보여준다. */
function startProgressTimer(setStatus, baseMessage, opts) {
  const startedAt = Date.now()
  const maxSec = Number(opts?.maxSec) > 0 ? Math.round(Number(opts.maxSec)) : 0
  let stopped = false
  let timerId = 0
  let hitMax = false
  const render = () => {
    if (stopped) return
    const seconds = Math.floor((Date.now() - startedAt) / 1000)
    if (maxSec && seconds >= maxSec) {
      if (opts.keepWaiting) {
        if (!hitMax) {
          hitMax = true
          if (typeof opts.onMax === 'function') opts.onMax(maxSec)
        }
        setStatus(`${baseMessage} (${seconds}초, 엔진 대기)`, false)
        return
      }
      stopped = true
      window.clearInterval(timerId)
      if (typeof opts.onMax === 'function') opts.onMax(maxSec)
      else setStatus(`${baseMessage} — ${maxSec}초를 넘겼습니다. 다시 누르세요.`, true)
      return
    }
    setStatus(
      maxSec ? `${baseMessage} (${seconds}초 / ${maxSec}초)` : `${baseMessage} (${seconds}초 경과)`,
      false,
    )
  }
  render()
  timerId = window.setInterval(render, 1000)
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
  if (v === 'region' || v === 'erase' || v === 'pin' || v === 'text') return v
  return 'pin'
}

function wantsObjectEraseClient(text) {
  const t = polishConceptText(text || '')
  if (/나체|누드|벗기|옷벗|undress|\bnude\b|\bnaked\b/i.test(t)) return false
  return (
    /선택(?:한)?\s*(?:사람|사물|인물|영역).{0,12}(?:지우|지워|제거|없애)/i.test(t) ||
    /(?:사람|인물|사물).{0,10}(?:을|를)?\s*(?:완전히\s*)?(?:지우|지워|제거|없애)/i.test(t) ||
    (/(?:옆|다른)\s*(?:사람|인물)/i.test(t) && /지우|지워|제거|없애/i.test(t)) ||
    /배경(?:으로|에)?\s*메워|자연스럽게\s*메워/i.test(t) ||
    /지워\s*줘|지우기|지워(?:요|라)?$|erase|remove\s*(?:the\s*)?(?:masked|selected)\s*(?:person|people|object)/i.test(t)
  )
}

/** 올가미 지우기 전용 수정 문구 — 서버가 content-aware fill로 해석 */
const ERASE_REGION_REVISION =
  '선택한 사람·사물을 완전히 지우고 주변 배경·벽·바닥 질감으로 자연스럽게 메워 주세요. 빈 자리에 새 사람·새 얼굴을 만들지 마세요.'

function syncEraseRevisionPlaceholder() {
  const mode = getSelectedReviseMode()
  if (!revisionText) return
  if (mode === 'erase') {
    if (!revisionText.value.trim() || revisionText.dataset.erasePrefill === '1') {
      revisionText.value = ERASE_REGION_REVISION
      revisionText.dataset.erasePrefill = '1'
    }
    revisionText.placeholder = '지울 대상을 올가미로 감싼 뒤 수정 적용 (문구는 바꿔도 됨)'
  } else if (revisionText.dataset.erasePrefill === '1') {
    revisionText.value = ''
    delete revisionText.dataset.erasePrefill
    revisionText.placeholder = '예: 옷 색 하나로 통일 / 목걸이 제거 / 나체가 되어'
  }
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
  } else if (mode === 'region' || mode === 'erase') {
    setPinDrawEnabled(false)
    setRegionDrawEnabled(true)
  } else {
    setPinDrawEnabled(false)
    setRegionDrawEnabled(false)
  }
  syncEraseRevisionPlaceholder()
  const eraseApply = document.getElementById('region-apply-erase')
  const editApply = document.getElementById('region-apply-edit')
  if (eraseApply) eraseApply.hidden = mode !== 'erase'
  if (editApply) editApply.hidden = mode !== 'region'
  // 지우기 모드: 아래 긴 텍스트/가슴높이 패널을 접어 버튼이 가까워지게
  if (reviseTextBlock) {
    reviseTextBlock.hidden = mode === 'pin' || mode === 'erase'
  }
  if (mode === 'erase') {
    setReviseStatus(
      '지울 사람을 감싸 닫으세요. 클릭으로 점을 찍거나, 누른 채 끌면 자유롭게 그려집니다. 닫은 뒤 안쪽을 잡아 옮길 수 있어요.',
      false,
    )
  }
}

document.getElementById('region-apply-erase')?.addEventListener('click', () => {
  const eraseRadio = document.querySelector('input[name="revise-mode"][value="erase"]')
  if (eraseRadio) eraseRadio.checked = true
  syncReviseModeUi()
  reviseApplyButton?.click()
})

document.getElementById('region-apply-edit')?.addEventListener('click', () => {
  reviseApplyButton?.click()
})

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
  const erase =
    getSelectedReviseMode() === 'erase' || wantsObjectEraseClient(revisionText?.value || '')
  return (
    lasso?.buildMaskDataUrl?.(768, erase ? { expandPx: 32, blurPx: 4 } : undefined) || null
  )
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image_load_failed'))
    img.src = src
  })
}

/**
 * 마스크 안을 코너·테두리 배경색으로 메움.
 * 옆 사람 피부색을 구멍으로 밀어 넣으면 엔진이 새 얼굴을 복원한다.
 */
async function prefillMaskedHole(imageSrc, maskDataUrl) {
  const [img, maskImg] = await Promise.all([loadImageElement(imageSrc), loadImageElement(maskDataUrl)])
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = w
  maskCanvas.height = h
  const mctx = maskCanvas.getContext('2d', { willReadFrequently: true })
  mctx.drawImage(maskImg, 0, 0, w, h)
  const pix = ctx.getImageData(0, 0, w, h)
  const mask = mctx.getImageData(0, 0, w, h).data
  const data = pix.data
  let sr = 0
  let sg = 0
  let sb = 0
  let sc = 0
  const take = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = (y * w + x) * 4
    if (mask[i] > 80) return
    sr += data[i]
    sg += data[i + 1]
    sb += data[i + 2]
    sc += 1
  }
  const band = Math.max(6, Math.round(Math.min(w, h) * 0.06))
  for (let y = 0; y < band; y += 2) {
    for (let x = 0; x < band; x += 2) {
      take(x, y)
      take(w - 1 - x, y)
      take(x, h - 1 - y)
      take(w - 1 - x, h - 1 - y)
    }
  }
  for (let x = 0; x < w; x += 3) {
    take(x, 0)
    take(x, h - 1)
  }
  for (let y = 0; y < h; y += 3) {
    take(0, y)
    take(w - 1, y)
  }
  const br = sc ? sr / sc : 210
  const bg = sc ? sg / sc : 210
  const bb = sc ? sb / sc : 210
  for (let i = 0; i < mask.length; i += 4) {
    if (mask[i] > 80) {
      data[i] = br
      data[i + 1] = bg
      data[i + 2] = bb
    }
  }
  const copy = new Uint8ClampedArray(data)
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const p = (y * w + x) * 4
      if (mask[p] <= 80) continue
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const o = ((y + dy) * w + (x + dx)) * 4
          r += copy[o]
          g += copy[o + 1]
          b += copy[o + 2]
          n += 1
        }
      }
      data[p] = r / n
      data[p + 1] = g / n
      data[p + 2] = b / n
    }
  }
  ctx.putImageData(pix, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92)
}

async function uploadImageDataUrl(dataUrl) {
  const response = await fetch('/api/upload-image', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ dataUrl }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.ok || !data.imageUrl) {
    throw new Error(data.message || data.error || `upload_failed_${response.status}`)
  }
  return data.imageUrl
}

/** 수정 결과가 거의 검은 화면(필터 블랭크)인지 검사 */
async function isNearlyBlackImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(true)
      return
    }
    const img = new Image()
    // data/blob에 crossOrigin을 붙이면 로드가 실패하고, 예전엔 그걸 검은 화면으로 오인했다.
    if (/^https?:\/\//i.test(url)) img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const w = Math.min(64, img.naturalWidth)
        const h = Math.min(64, img.naturalHeight)
        if (!w || !h) {
          resolve(false)
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
        resolve(false)
      }
    }
    img.onerror = () => resolve(false)
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

/** idle: 수정·쇼츠·수용 · revising: 다듬기 도구 활성 */
function setReviewChrome(mode) {
  const revising = mode === 'revising'
  const onEditTab = getAppArea() === 'admin' && getAdminPanel() === 'edit'
  if (reviewActions) reviewActions.hidden = revising || onEditTab
  // 「이미지 다듬기」탭에서는 수정 패널을 항상 연다
  if (revisePanel) revisePanel.hidden = onEditTab ? false : !revising
  if (animatePanel && currentResult.imageUrl) {
    if (getAppArea() === 'admin') {
      animatePanel.hidden = revising || onEditTab || !currentResult.videoUrl
    } else {
      animatePanel.hidden = revising || onEditTab
    }
  }
  if (!revising && !onEditTab) {
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

/**
 * 갤러리 항목이 없으면 만들고 itemId를 붙인다.
 * 얼굴·장면 → 메인/쇼츠 경로에서 「수용」을 안 눌러도 관리자 갤러리에 보이게 한다.
 * @returns {string|null} itemId
 */
function ensureCurrentResultInGallery() {
  if (!currentResult.imageUrl) return null
  const itemId = currentResult.itemId || crypto.randomUUID()
  currentResult.itemId = itemId
  currentResult.accepted = true
  const items = readGallery()
  const index = items.findIndex((entry) => entry.id === itemId)
  if (index === -1) {
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
      genMode: currentResult.genMode === 'fashion' ? 'fashion' : 'free',
      reviseRound: currentResult.reviseRound,
      videoUrl: currentResult.videoUrl || null,
      createdAt: new Date().toISOString(),
    })
  } else {
    items[index] = {
      ...items[index],
      imageUrl: currentResult.imageUrl,
      prompt: currentResult.prompt,
      description: currentResult.prompt,
      videoUrl: currentResult.videoUrl || items[index].videoUrl || null,
      genMode: currentResult.genMode === 'fashion' ? 'fashion' : items[index].genMode,
    }
    writeGallery(items)
    renderGallery()
  }
  enterAcceptedMode()
  return itemId
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
  moveGalleryButton.textContent = isFashion ? '일러스트 갤러리로 이동' : '소지함으로 이동'
}

moveGalleryButton?.addEventListener('click', () => {
  const itemId = currentResult.itemId
  if (!itemId) return
  const nextMode = currentResult.genMode === 'fashion' ? 'free' : 'fashion'
  moveGalleryItem(itemId, nextMode)
  const label = nextMode === 'fashion' ? '소지함' : '내 갤러리'
  setFormStatus(`${label}로 옮겼어요.`, false)
})

function openRevisePanel(opts = {}) {
  const editPanel = document.getElementById('admin-edit-panel')
  // 관리자: 「이미지 다듬기」탭으로 이동
  if (!opts.skipNavigate && typeof isAdminUser === 'function' && isAdminUser()) {
    if (typeof setAppArea === 'function' && getAppArea() !== 'admin') {
      setAppArea('admin')
    }
    if (getAdminPanel() !== 'edit') {
      setAdminPanel('edit')
      return
    }
  }
  // 자유 스튜디오: 다듬기 패널만 펼침
  if (editPanel) editPanel.hidden = false
  reviewPanel.hidden = false
  const pinRadio = document.querySelector('input[name="revise-mode"][value="pin"]')
  if (pinRadio && !opts.keepMode) pinRadio.checked = true
  setReviewChrome('revising')
  setReviseStatus(
    '이미지 다듬기입니다. 사람·사물 → 「올가미로 지우기」, 배경 → 「배경 지우기」.',
    false,
  )
}

function closeRevisePanel() {
  setReviewChrome('idle')
  setPinDrawEnabled(false)
  setRegionDrawEnabled(false)
  setReviseStatus('', false)
  const editPanel = document.getElementById('admin-edit-panel')
  if (editPanel && !(getAppArea() === 'admin' && getAdminPanel() === 'edit')) {
    editPanel.hidden = true
  }
}

document.getElementById('revise-erase-mode-btn')?.addEventListener('click', () => {
  const eraseRadio = document.querySelector('input[name="revise-mode"][value="erase"]')
  if (eraseRadio) eraseRadio.checked = true
  syncReviseModeUi()
  setReviseStatus(
    '사람·사물 지우기: 사진 위에서 지울 부분을 점으로 감싸 닫은 뒤 「이 선택 지우기」를 누르세요.',
    false,
  )
})

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
  if (getAppArea() === 'admin') setWorkshopStage('shorts')
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
    // blob/data는 서버로 보내지 않음 (media-bytes 400 / image_url_not_allowed)
    if (imageUrl.startsWith('data:image/')) {
      if (currentResult.imageUrl === token || currentResult.imageUrl?.startsWith('http')) {
        currentResult.imageDataUrl = imageUrl
      }
      return
    }
    if (imageUrl.startsWith('blob:')) {
      const blob = await fetch(imageUrl).then((r) => r.blob())
      if (!blob || blob.size < 64) return
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result)
        fr.onerror = () => reject(new Error('read_failed'))
        fr.readAsDataURL(blob)
      })
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
        // 미리보기는 blob이어도 쇼츠용 캐시는 data로 보관
        currentResult.imageDataUrl = dataUrl
      }
      return
    }
    if (!/^https?:\/\//i.test(imageUrl)) return

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
    isShortsEndFrame = false,
    keepVideo = false,
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
  syncTwoPeopleCheckboxFromSource()
  void lockTwoPeopleFromStill(imageUrl)
  currentResult.size = size
  currentResult.itemId = itemId
  currentResult.mood = mood
  currentResult.engineLabel = engineLabel || ''
  currentResult.fallbackUsed = Boolean(fallbackUsed)
  currentResult.engine = engine || ''
  currentResult.genMode = genMode === 'fashion' ? 'fashion' : 'free'
  currentResult.reviseRound = reviseRound || 0
  currentResult.isShortsEndFrame = Boolean(isShortsEndFrame)
  if (!currentResult.isShortsEndFrame) shortsFaceIdStill = null
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
  } else if (!keepVideo) {
    hideVideoResult()
  }

  if (accepted) {
    enterAcceptedMode()
  } else {
    enterReviewMode()
  }

  resultSection.hidden = false
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
  if (typeof window.persistDeskWorkScene === 'function') {
    void window.persistDeskWorkScene(imageUrl)
  }
  if (typeof window.syncDeskNextCutButton === 'function') {
    window.syncDeskNextCutButton()
  }
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
  syncGalleryPickButtons()
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

function syncGalleryPickButtons() {
  const items = readGallery()
  const freeN = items.filter((item) => item.genMode !== 'fashion' && galleryPickedIds.has(item.id)).length
  const adminN = items.filter((item) => item.genMode === 'fashion' && galleryPickedIds.has(item.id)).length
  if (deletePickedGalleryButton) {
    deletePickedGalleryButton.hidden = freeN === 0
    deletePickedGalleryButton.textContent = freeN ? `고른 ${freeN}개 삭제` : '고른 것 삭제'
  }
  if (deletePickedAdminGalleryButton) {
    deletePickedAdminGalleryButton.hidden = adminN === 0
    deletePickedAdminGalleryButton.textContent = adminN ? `고른 ${adminN}개 삭제` : '고른 것 삭제'
  }
}

function deletePickedGalleryItems(mode) {
  const fashion = mode === 'fashion'
  const items = readGallery()
  const picked = items.filter((item) => {
    const mine = fashion ? item.genMode === 'fashion' : item.genMode !== 'fashion'
    return mine && galleryPickedIds.has(item.id)
  })
  if (!picked.length) return
  if (!window.confirm(`고른 ${picked.length}개를 삭제할까요? (영구 저장된 파일도 함께 삭제돼요)`)) return
  picked.forEach((item) => {
    deletePermanentMediaIfNeeded(item.imageUrl)
    deletePermanentMediaIfNeeded(item.videoUrl)
    galleryPickedIds.delete(item.id)
  })
  const drop = new Set(picked.map((item) => item.id))
  writeGallery(items.filter((item) => !drop.has(item.id)))
  renderGallery()
}

function renderGalleryInto(items, gridEl, emptyEl, currentMode) {
  gridEl.innerHTML = ''
  emptyEl.hidden = items.length > 0

  items
    .slice()
    .reverse()
    .forEach((item) => {
      const cell = document.createElement('div')
      cell.className = galleryPickedIds.has(item.id) ? 'gallery__item is-picked' : 'gallery__item'
      cell.dataset.id = item.id

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

      const menuToggleLabel = document.createElement('label')
      menuToggleLabel.className = 'gallery__item-menu-toggle'
      const menuCheckbox = document.createElement('input')
      menuCheckbox.type = 'checkbox'
      menuCheckbox.checked = galleryPickedIds.has(item.id)
      menuCheckbox.setAttribute('aria-label', '이 칸 고르기')
      menuToggleLabel.appendChild(menuCheckbox)
      menuToggleLabel.addEventListener('click', (event) => event.stopPropagation())
      menuCheckbox.addEventListener('click', (event) => event.stopPropagation())
      menuCheckbox.addEventListener('change', () => {
        if (menuCheckbox.checked) galleryPickedIds.add(item.id)
        else galleryPickedIds.delete(item.id)
        cell.classList.toggle('is-picked', menuCheckbox.checked)
        syncGalleryPickButtons()
      })
      cell.appendChild(menuToggleLabel)

      cell.addEventListener('click', (event) => {
        if (event.target === menuToggleLabel || event.target === menuCheckbox) return
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
    body: JSON.stringify({ ...payload, async: true }),
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

async function pollGenerateImageUntilDone(predictionId, onTick) {
  const startedAt = Date.now()
  const HARD_LIMIT_SEC = 180
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const elapsedSec = Math.round((Date.now() - startedAt) / 1000)
    if (elapsedSec >= HARD_LIMIT_SEC) {
      return { ok: false, message: `생성이 ${HARD_LIMIT_SEC}초를 넘었어요. 다시 눌러 주세요.` }
    }
    if (typeof onTick === 'function') {
      onTick(`그리는 중… ${elapsedSec}초 / ${HARD_LIMIT_SEC}초`, false)
    }
    await new Promise((resolve) => setTimeout(resolve, attempt < 4 ? 1500 : 2500))
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 12000)
    try {
      const response = await fetch('/api/generate-status', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ predictionId }),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        return { ok: false, unauthorized: true }
      }
      if (data.status === 'succeeded' && data.imageUrl) {
        return { ok: true, imageUrl: data.imageUrl, persisted: data.persisted }
      }
      if (data.ok === false || data.status === 'failed') {
        return { ok: false, message: data.message || data.error || 'generation_failed' }
      }
    } catch (_) {
      /* 한 번 실패해도 이어서 폴링 */
    } finally {
      window.clearTimeout(timer)
    }
  }
  return { ok: false, message: '시간이 지나도 결과가 없어요. 다시 시도해 주세요.' }
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
  if (/throttl|rate limit|less than \$5/i.test(detail) || (code === 'rate_limited' && /크레딧|credit/i.test(detail))) {
    return (
      detail && /크레딧/.test(detail)
        ? detail
        : 'Replicate 계정 크레딧이 $5 미만이라 영상이 막혔어요. replicate.com 에서 크레딧을 충전하면 한도가 풀립니다. 약 10초 뒤 한 번만 다시 눌러 주세요.'
    )
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
  if (/Director:|E6802|unexpected error handling prediction/i.test(detail)) {
    return 'Replicate 엔진 내부 장애예요(E6802). 크레딧·장면 문제가 아닙니다. 같은 버튼으로 한 번만 다시 눌러 주세요.'
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
  if (response && response.status === 500) {
    return '서버가 시작 전에 끊겼어요. 같은 장으로 한 번만 다시 눌러 주세요.'
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
    `누드|나체|nude|naked|탈의|벗기|벗겨|벗어|벗는|옷벗김|겹벗김|한\\s*겹씩|한\\s*장씩|하나씩\\s*(?:벗|제거)|겹겹이|겉(?:옷)?부터|속옷\\s*경유|layer[\\s-]*by[\\s-]*layer|peel\\s+one\\s+layer|속옷${gap}제거|옷${gap}벗|가운${gap}벗|undress|strip`,
    'i',
  ).test(t)
}

/** 이미 나체가 아니라, 옷 입은 장에서 벗기는 요청만. */
function wantsBecomeNudeClient(text) {
  const t = text || ''
  if (/이미\s*(?:완전\s*)?나체|현재\s*나체|옷\s*없음|already\s*(?:fully\s*)?nude/i.test(t)) return false
  return /나체가\s*된|나체가\s*되어|탈의|벗기|벗겨|벗는|옷벗김|겹벗김|한\s*겹씩|하나씩\s*(?:벗|제거)|undress|strip/i.test(t)
}

/** 1인·자신 애무 (자동 2인/24초 전환 금지) */
function isSoloSelfMotion(text) {
  return /자신(?:의|이|을|를)?|스스로|혼자|왼손|오른손|self[\s-]?touch|masturbat|her\s+own\s+(?:bare\s+)?(?:breast|chest|body)|own\s+breasts?/i.test(
    text || '',
  )
}

/** 기승위 — 선 자세 원본 I2V/포즈 엔진으로 안 됨. 억지로 돌리지 않음. */
function isCowgirlPoseRequest(text) {
  return /기승위|기마위|카우걸|cowgirl|reverse\s*cowgirl|여자(?:가|는)?\s*위에\s*타|타고\s*앉아서\s*(?:섹스|성교|삽입)/i.test(
    text || '',
  )
}

/** 파트너가 필요한 애무·키스 — 자동 2인/24초용. 「서로」단독은 오탐 많아 제외. */
function wantsPartnerIntimateClient(text) {
  const t = String(text || '')
    .replace(/\bno(?:t)?\s+(?:a\s+)?kiss(?:es|ing)?\b/gi, ' ')
    .replace(/키스\s*(?:금지|없이|말고)/g, ' ')
  return /키스|입맞춤|포옹|껴안|지퍼|남자가|남자는|남자 바지|남여|남녀|커플|두\s*사람|partner|kiss|hug|zipper|couple|both\s*(?:become|nude|naked)/i.test(
    t,
  )
}

/** 키스·가슴 애무 등 (상태 문구용) */
function wantsIntimateActionClient(text) {
  return (
    wantsPartnerIntimateClient(text) ||
    /가슴|유방|유두|만지|애무|주무르|breast|fondl|caress/i.test(text || '')
  )
}

function sourceLooksLikeTwoPeople(text) {
  return /두\s*명|둘이|남녀|남여|커플|연인|남자와|여성과|두\s*사람|함께\s*있는|사진에는 두 사람|both\s*adults|couple|man\s+and\s+woman|two\s*(?:people|persons|adults)/i.test(
    text || '',
  )
}

function sourceHasTwoPeopleClient(motion) {
  if (isSoloSelfMotion(motion)) return false
  if (document.getElementById('animate-two-people')?.checked) return true
  if (document.getElementById('desk-two-people')?.checked) return true
  if (sourceLooksLikeTwoPeople(motion)) return true
  if (sourceLooksLikeTwoPeople(currentResult.prompt)) return true
  if (sourceLooksLikeTwoPeople(descriptionField?.value)) return true
  return false
}

function setTwoPeopleChecked(on) {
  if (!on) return
  const deskTwo = document.getElementById('desk-two-people')
  const animateTwo = document.getElementById('animate-two-people')
  if (deskTwo) deskTwo.checked = true
  if (animateTwo) animateTwo.checked = true
}

function syncTwoPeopleCheckboxFromSource() {
  if (
    sourceLooksLikeTwoPeople(`${currentResult.prompt || ''} ${descriptionField?.value || ''}`)
  ) {
    setTwoPeopleChecked(true)
  }
}

async function lockTwoPeopleFromStill(imageUrl) {
  if (!imageUrl || typeof countDeskSceneFaces !== 'function') return
  try {
    const n = await countDeskSceneFaces(imageUrl, 8000)
    if (n >= 2) setTwoPeopleChecked(true)
  } catch (_) {
    /* 얼굴 감지가 실패해도 체크를 풀지 않음 */
  }
}

function maybeAutoCheckTwoPeople(motion) {
  const el = document.getElementById('animate-two-people')
  if (!el || el.checked) return
  if (isSoloSelfMotion(motion)) return
  if (sourceHasTwoPeopleClient(motion)) el.checked = true
}

/** 남+여 + 키스/탈의/가슴 만짐일 때만 성별 잠금. 옷 입은 커플 데이트에는 붙이지 않음. */
function wantsHeteroIntimateClient(text) {
  const t = text || ''
  if (!t) return false
  if (/여여|두\s*여자|만지기 없음|lesbian|two\s*women/i.test(t)) return false
  const intimate =
    wantsUndressActionClient(t) ||
    /키스|입맞춤|가슴|유방|유두|보지|애무|만지|주무르|나체|누드|kiss|breast|fondl|caress|nude|naked/i.test(t)
  if (!intimate) return false
  if (/남자|남성|남친/i.test(t) && /여자|여성/i.test(t)) return true
  // 「나체로 서로 키스」+ 커플 체크 — 남자/여자 단어가 없어도 소스 남녀를 여여로 바꾸지 않음
  return /커플|두\s*사람|서로\s*(?:키스|포옹)|사진에는 두 사람/i.test(t)
}

function appendHeteroCastHint(motion) {
  const t = (motion || '').trim()
  if (!t) return t
  if (!sourceHasTwoPeopleClient(t)) return t
  if (!wantsHeteroIntimateClient(t)) return t
  if (/여여\s*키스\s*금지|남자와\s*여자만\s*키스|남자는 남자로/.test(t)) return t
  const hint = wantsUndressActionClient(t)
    ? ' (남녀만: 여자는 나체. 남자 옷은 유지. 자지 금지. 남자는 남자로. 여여 금지)'
    : ' (남녀만: 소스 남자가 여자와 동작. 남자는 남자로 유지. 여여 키스 금지)'
  return (t.slice(0, 400 - hint.length) + hint).trim()
}

/**
 * @param {{ motionOverride?: string, durationSec?: number, skipHide?: boolean, statusPrefix?: string, persist?: boolean, keepBusy?: boolean, bodyProject?: boolean, clipRole?: 'single'|'dual-a'|'dual-b', landmarks?: BodyLandmarksClient, guideImageDataUrl?: string, sourcePeople?: 1|2, sourceCast?: 'ww'|'mw' }} [options]
 * @returns {Promise<{ ok: boolean, videoUrl?: string }>}
 */
async function requestAnimate(options = {}) {
  if (!currentResult.imageUrl) return { ok: false }

  if (!isLoggedIn()) {
    showPinGate('로그인이 필요해요.')
    return { ok: false }
  }

  const motionPeek =
    typeof options.motionOverride === 'string'
      ? options.motionOverride.trim()
      : (motionField?.value || '').trim()
  if (isCowgirlPoseRequest(motionPeek)) {
    setAnimateStatus(
      '기승위는 선 자세 쇼츠로 안 됩니다. 억지로 돌리면 원본 자세로 돌아갑니다. 이 요청은 받지 않습니다.',
      true,
    )
    return { ok: false }
  }
  const sourcePeople =
    options.sourcePeople === 1 || options.sourcePeople === 2 ? options.sourcePeople : undefined
  const sourceCast = options.sourceCast === 'ww' || options.sourceCast === 'mw' ? options.sourceCast : undefined
  let sourceBust = options.sourceBust === true
  if (options.sourceBust == null && typeof window.deskPhotoNeedsBodyExtend === 'function') {
    try {
      sourceBust = Boolean(
        await window.deskPhotoNeedsBodyExtend(currentResult.imageDataUrl || currentResult.imageUrl),
      )
    } catch {
      sourceBust = false
    }
  }
  if (sourcePeople !== 1) {
    maybeAutoCheckTwoPeople(`${motionPeek} ${currentResult.prompt || ''} ${descriptionField?.value || ''}`)
  }
  if (
    sourcePeople !== 1 &&
    sourcePeople !== 2 &&
    wantsPartnerIntimateClient(motionPeek) &&
    !isSoloSelfMotion(motionPeek) &&
    !sourceHasTwoPeopleClient(motionPeek)
  ) {
    setAnimateStatus(
      '키스·포옹·상대 만짐은 사진에 그 사람이 이미 있어야 합니다. 화보가 남녀 두 사람이면 그대로 됩니다. 혼자 사진이면 「두 사람」을 켜지 말고 자신 애무만 적으세요.',
      true,
    )
    return { ok: false }
  }

  // 수용 전 쇼츠도 갤러리에 남기기 — 「영구 저장」만 하고 목록에 안 보이는 사고 방지
  if (options.persist !== false) {
    ensureCurrentResultInGallery()
  }

  setAnimateBusy(true)
  if (!options.skipHide) hideVideoResult()

  let motionBase =
    typeof options.motionOverride === 'string'
      ? options.motionOverride.trim()
      : (motionField?.value || '').trim()
  if (sourcePeople !== 1) maybeAutoCheckTwoPeople(motionBase)
  if (sourcePeople !== 1) motionBase = appendHeteroCastHint(motionBase)
  // 지금장 인원이 1이면 커플 접미사를 붙이지 않는다. 2이면 서버에 sourcePeople로 넘긴다.
  if (sourcePeople !== 1 && sourcePeople !== 2 && sourceHasTwoPeopleClient(motionBase)) {
    const suffix = ' (사진에는 두 사람이 함께 있다 — 커플)'
    if (!motionBase.includes('사진에는 두 사람이')) {
      motionBase = (motionBase.slice(0, 400 - suffix.length) + suffix).trim()
    }
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
  if (![5, 10, 12, 15, 18].includes(durationSec)) durationSec = 15
  const speedKey = getSelectedVideoSpeed()
  const speedConflict =
    (speedKey === 'slow' && /빠르게|빨리|급하게|격렬하게|재빠르게|fast|quick(?:ly)?|rapid(?:ly)?/i.test(motionBase)) ||
    (speedKey === 'fast' && /느리게|느린|천천히|slow(?:ly)?/i.test(motionBase))
  const speedHint = speedConflict ? '' : VIDEO_MOTION_HINTS[speedKey] || ''
  const motion = [motionBase, speedHint].filter(Boolean).join('. ')
  const speedLabel = speedKey === 'slow' ? '느리게' : speedKey === 'fast' ? '빠르게' : '보통'
  const bodyProject = options.bodyProject === true
  const undressMotion = bodyProject || wantsUndressActionClient(motionBase)
  let landmarks = options.landmarks && typeof options.landmarks === 'object' ? options.landmarks : undefined
  const guideImageDataUrl =
    typeof options.guideImageDataUrl === 'string' && options.guideImageDataUrl.startsWith('data:image/')
      ? options.guideImageDataUrl
      : undefined
  const prefix = options.statusPrefix ? `${options.statusPrefix} ` : ''
  if (!landmarks && !bodyProject && sourcePeople == null && /옷벗김/.test(motionBase)) {
    setAnimateStatus(`${prefix}옷벗김: 원본 가슴 자리를 읽는 중…`, false)
    landmarks = await detectBodyLandmarksFromAi()
  }
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
    const httpUrl =
      typeof currentResult.imageUrl === 'string' && /^https:\/\//i.test(currentResult.imageUrl)
        ? currentResult.imageUrl
        : ''
    const stableHttp =
      /r2\.dev|r2\.cloudflarestorage\.com|\.fal\.media$|fal\.ai/i.test(httpUrl)
    let imageDataUrl = guideImageDataUrl
      ? guideImageDataUrl
      : stableHttp
        ? undefined
        : currentResult.imageDataUrl ||
          (typeof currentResult.imageUrl === 'string' && currentResult.imageUrl.startsWith('data:image/')
            ? currentResult.imageUrl
            : undefined)
    let imageUrl = imageDataUrl ? undefined : httpUrl || undefined

    if (!imageDataUrl && imageUrl && !stableHttp) {
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
        prompt: '',
        motion,
        size: currentResult.size,
        durationSec,
        bodyProject: bodyProject || undefined,
        landmarks: landmarks || undefined,
        clipRole: options.clipRole === 'dual-a' || options.clipRole === 'dual-b' ? options.clipRole : 'single',
        bustHeight: getSelectedBustHeightShorts(),
        sourcePeople,
        sourceCast,
        sourceBust: sourceBust || undefined,
        genMode: getGenMode(),
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

/** 영상 출구 프레임 → data URL. 맨 끝(스냅백) 대신 1초 앞을 씀. */
async function captureVideoEndFrame(videoUrl) {
  // CORS 회피: Replicate/fal 원본은 canvas가 tainted 됨 → /api/media-bytes
  let source = videoUrl
  try {
    const response = await fetch('/api/media-bytes', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ imageUrl: videoUrl }),
    })
    const data = await response.json().catch(() => ({}))
    if (data?.ok && typeof data.dataUrl === 'string' && data.dataUrl.startsWith('data:video/')) {
      source = data.dataUrl
    } else if (response.status === 401) {
      throw new Error('video_auth')
    }
  } catch (err) {
    console.warn('media-bytes proxy for end-frame capture failed, trying direct URL', err)
  }
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  if (source === videoUrl) video.crossOrigin = 'anonymous'
  video.src = source
  await new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('video_meta_timeout')), 60000)
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
  // 마지막 1초가 원본으로 돌아가기 쉬움 → 그 직전 프레임을 후반 소스로
  video.currentTime = Math.max(0.2, dur - 1.2)
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

/** Desk에서 다음 15초가 나오면 이전 편 뒤에 이어 붙여 같은 항목으로 저장한다. */
async function appendAndPersistDeskShorts(prevUrl, nextUrl, prompt, motion) {
  const mergedUrl = await mergeShortsVideos([prevUrl, nextUrl])
  const draft = buildYoutubeShortsDraft({
    prompt,
    motion,
    genMode: currentResult.genMode,
  })
  showVideoResult(mergedUrl, { prompt, motion, youtubeDraft: draft })
  updateGalleryItemVideo(currentResult.itemId, mergedUrl, draft)
  const prevPermanent = typeof isPermanentMediaUrl === 'function' && isPermanentMediaUrl(prevUrl) ? prevUrl : null
  persistImageToPermanentStorage(mergedUrl).then((permanentUrl) => {
    if (!permanentUrl) return
    applyPersistedVideoUrl(currentResult.itemId, mergedUrl, permanentUrl)
    if (prevPermanent) deletePermanentMediaIfNeeded(prevPermanent)
    setAnimateStatus('이전 편과 이번 편을 한 파일로 저장했습니다.', false)
    setFormStatus('이전 편과 이번 편을 한 파일로 저장했습니다.', false)
  })
  return mergedUrl
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
  if (!(currentResult.isShortsEndFrame && shortsFaceIdStill)) {
    shortsFaceIdStill = currentResult.imageDataUrl || currentResult.imageUrl || null
  }
  if (!isLoggedIn()) {
    showPinGate('로그인이 필요해요.')
    return
  }
  ensureCurrentResultInGallery()
  const motion1 = (motionField?.value || '').trim()
  const motion2 = (motion2Field?.value || '').trim()
  if (!motion1 || !motion2) {
    setAnimateStatus('전반·후반 모션을 모두 적어 주세요. (두 프레임 연속)', true)
    syncDualFrameUi(total)
    return
  }
  maybeAutoCheckTwoPeople(`${motion1} ${motion2}`)

  setAnimateBusy(true)
  setSelectedVideoDuration(total)
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

    setAnimateStatus(`[${total}초 · 1/2] 후반 연결용 프레임 잡는 중…`, false)
    let endFrame = null
    try {
      endFrame = await captureVideoEndFrame(clip1.videoUrl)
    } catch (err) {
      console.warn('end frame capture failed', err)
    }
    if (!endFrame?.startsWith('data:image/')) {
      setAnimateStatus(
        `[${total}초 · 1/2] 끝 프레임을 가져오지 못해 중단했습니다. 다시 시도해 주세요 (후반이 원본 옷 입은 스틸로 이어지면 도중에 다시 옷을 입는 것처럼 보이는 오류가 생깁니다).`,
        true,
      )
      return
    }
    if (
      shortsFaceIdStill &&
      typeof globalThis.lockShortsIdentityOntoFrame === 'function' &&
      !sourceHasTwoPeopleClient(`${motion1} ${motion2}`)
    ) {
      setAnimateStatus(`[${total}초 · 1/2] 끝 장을 첫 사진 인물에 맞추는 중…`, false)
      try {
        const locked = await globalThis.lockShortsIdentityOntoFrame(endFrame, shortsFaceIdStill, {
          motion: motion2,
        })
        if (locked?.aborted) return
        if (locked?.url && locked.locked > 0) {
          endFrame = locked.url
          setAnimateStatus(`[${total}초 · 1/2] 얼굴을 맞췄습니다. 후반을 시작합니다…`, false)
        } else if (locked?.url && locked.baked) {
          endFrame = locked.url
          setAnimateStatus(
            `[${total}초 · 1/2] 뒷모습이어도 첫 사진 인물로 맞춰 후반을 시작합니다…`,
            false,
          )
        } else if (locked?.reason === 'no_face') {
          setAnimateStatus(
            `[${total}초 · 1/2] 인물 맞춤이 안 되어 몸만 잇습니다. 후반을 시작합니다…`,
            false,
          )
        }
      } catch (err) {
        console.warn('shorts identity lock failed', err)
      }
    }
    const clip1WasNudeOrUndress =
      bodyProjectFirst ||
      wantsUndressActionClient(motion1) ||
      /나체|누드|\bnude\b|\bnaked\b/i.test(motion1)
    showResult(endFrame, '전반 끝 프레임', false, {
      size: currentResult.size,
      itemId: currentResult.itemId,
      prompt: clip1WasNudeOrUndress
        ? `${savedPrompt || ''} · already nude continuity. If panty remains, melt it off now.`.trim()
        : savedPrompt || '',
      accepted: true,
      isShortsEndFrame: true,
      mood: currentResult.mood,
      engine: currentResult.engine,
      genMode: currentResult.genMode,
    })
    currentResult.imageDataUrl = endFrame
    currentResult.imageUrl = endFrame

    const motion2HasNudeHold = /이미\s*나체|나체\s*유지|fully\s*nude|already\s*nude/i.test(motion2)
    const motion2Safe =
      clip1WasNudeOrUndress && !motion2HasNudeHold
        ? `이미 완전 나체 유지(브라·팬티 되살림 금지). ${motion2}`
        : motion2
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
    const raw = await response.text()
    let data = {}
    try {
      data = raw ? JSON.parse(raw) : {}
    } catch {
      pinError.textContent =
        '로그인이 서버에서 끊겼어요. 비밀번호 칸에 ADMIN_PIN을 넣어 다시 시도해 주세요.'
      pinError.hidden = false
      return
    }
    const pinFallback = async () => {
      const me = await fetch('/api/auth/me', {
        headers: { 'x-admin-pin': password },
      })
      const meData = await me.json().catch(() => ({}))
      return me.ok && meData.ok
    }

    if ((!response.ok || !data.ok || (!data.token && !data.pinAuth)) && (await pinFallback())) {
      data = { ok: true, pinAuth: true, user: { email } }
    }

    if (!data.ok || (!data.token && !data.pinAuth)) {
      pinError.textContent = authErrorMessage(data.error, data)
      pinError.hidden = false
      return
    }
    clearAllAuth()
    const loginId = data.user?.email || email
    if (data.pinAuth || !data.token) setStoredAdminPin(password)
    if (data.token) setSessionToken(data.token, loginId)
    else {
      localStorage.setItem(USER_STORAGE_KEY, loginId)
      rememberLoginId(loginId)
    }
    rememberLoginId(loginId)
    if (authEmailInput) authEmailInput.value = loginId
    if (authPasswordInput) authPasswordInput.value = ''
    if (authInviteInput) authInviteInput.value = ''
    if (isAdminUser()) setAppArea('admin')
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
  const deskRun = document.getElementById('desk-run')
  if (deskRun) deskRun.disabled = true
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
      imageUrls: conceptRefUrls(),
    })

    if (data.ok && data.pending && data.statusUrl && data.responseUrl) {
      stopTimer()
      const mixUrl = await pollConceptMixUntilDone(data.statusUrl, data.responseUrl, setFormStatus)
      if (!mixUrl) {
        setFormStatus('참고 이미지를 비비지 못했어요. 다시 눌러 주세요.', true)
        return
      }
      data.pending = false
      data.imageUrl = mixUrl
    } else if (data.ok && data.pending && data.predictionId) {
      stopTimer()
      const polled = await pollGenerateImageUntilDone(data.predictionId, setFormStatus)
      if (polled.unauthorized) {
        clearAllAuth()
        showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
        return
      }
      if (!polled.ok || !polled.imageUrl) {
        setFormStatus(polled.message || '생성이 끝나지 않았어요. 다시 시도해 주세요.', true)
        return
      }
      data.pending = false
      data.imageUrl = polled.imageUrl
    } else {
      stopTimer()
    }

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

    let imageUrl = data.imageUrl
    if (typeof isNearlyBlackImage === 'function' && imageUrl && (await isNearlyBlackImage(imageUrl))) {
      setFormStatus(
        '엔진이 빈 장을 냈습니다. 같은 참고와 옷벗김으로 다시 눌러 주세요. (성인 장면은 다른 엔진으로 다시 보냅니다.)',
        true,
      )
      return
    }
    const resultOpts = {
      size: sizeField.value,
      itemId: null,
      prompt: description,
      accepted: false,
      mood: moodField.value,
      engine: data.engine,
      genMode: data.mode,
      reviseRound: 0,
    }
    const doDeskStamp = Boolean(
      window.__deskStampAfterGenerate && typeof applyDeskWorkFaces === 'function',
    )
    window.__deskStampAfterGenerate = false
    window.__deskStampEpoch = (window.__deskStampEpoch || 0) + 1
    const stampEpoch = window.__deskStampEpoch
    if (
      doDeskStamp &&
      typeof deskCastPhotos === 'function' &&
      deskCastPhotos().length === 1 &&
      typeof countDeskSceneFaces === 'function'
    ) {
      setFormStatus('장면 확인 중…', false)
      const faces = await countDeskSceneFaces(imageUrl)
      if (faces >= 2) {
        window.__deskStampSkipped = 'extra_person'
        window.__deskSkipScenePersist = true
      }
    }
    showResult(imageUrl, data.engineLabel, data.fallbackUsed, resultOpts)
    stopTimer()
    generateButton.disabled = false
    if (deskRun) deskRun.disabled = false
    if (doDeskStamp && !window.__deskStampSkipped) {
      setFormStatus('장면이 나왔습니다. 얼굴을 붙이는 중…', false)
      try {
        const stamped = await Promise.race([
          applyDeskWorkFaces(imageUrl, {
            skipFaceCount: true,
            preferPaste: false,
            skipPasteFallback: true,
            engineOrder: ['insight'],
            hardLimitSec: 28,
          }),
          new Promise((resolve) => {
            window.setTimeout(() => resolve({ timeout: true }), 25000)
          }),
        ])
        if (stampEpoch !== window.__deskStampEpoch) {
          /* 새 생성이 이 붙이기를 무효로 만듦 */
        } else if (stamped?.timeout) {
          window.__deskStampEpoch += 1
          window.__deskStampSkipped = 'stamp_timeout'
        } else if (stamped?.skipped) {
          window.__deskStampSkipped = stamped.reason || 'need_two_faces'
          window.__deskSkipScenePersist = true
        } else if (stamped?.url) {
          imageUrl = stamped.url
          window.__deskStampSkipped = ''
          showResult(imageUrl, data.engineLabel, data.fallbackUsed, resultOpts)
        }
      } catch (err) {
        console.warn('desk face stamp failed', err)
      }
    }
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
    if (getAppArea() === 'admin' && typeof ensureCurrentResultInGallery === 'function') {
      ensureCurrentResultInGallery()
    }
    const stampSkip = window.__deskStampSkipped
    window.__deskStampSkipped = ''
    setFormStatus(
      stampSkip === 'extra_person'
        ? '혼자 장면인데 두 번째 사람이 그려졌습니다. 이 장은 쓰지 마세요. 남 칸을 비우고 다시 만들어 주세요.'
        : stampSkip === 'stamp_timeout'
        ? '장면은 나왔습니다. 얼굴 붙이기가 오래 걸려 장면만 넣었습니다. 이 장으로 움직이거나 다시 만들어 주세요.'
        : stampSkip
        ? '장면은 나왔지만 주인공 얼굴을 못 붙여 이 장은 이어달리기에 넣지 않았습니다. 다시 만들어 주세요.'
        : getAppArea() === 'admin'
          ? data.fallbackUsed
            ? `나왔습니다. 움직이려면 움직이기를 누르세요. (보조엔진)${sceneHint}`
            : `나왔습니다. 움직이려면 움직이기를 누르세요.${sceneHint}`
          : data.fallbackUsed
            ? `생성 완료! 결과를 검토한 뒤 수용/수정/다시 생성을 선택하세요. (보조엔진)${sceneHint}`
            : `생성 완료! 결과를 검토한 뒤 수용/수정/다시 생성을 선택하세요.${sceneHint}`,
      Boolean(stampSkip),
    )
  } catch (error) {
    stopTimer()
    setFormStatus(`네트워크 오류: ${error instanceof Error ? error.message : String(error)}`, true)
  } finally {
    stopTimer()
    generateButton.disabled = false
    if (deskRun) deskRun.disabled = false
    window.__deskStampAfterGenerate = false
    window.__deskSkipScenePersist = false
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
  const isJpeg = typeof original === 'string' && /^data:image\/jpeg/i.test(original)
  const tooHeavy = typeof original === 'string' && original.length > 1_200_000
  if (!tooHeavy && longSide <= maxDim && isJpeg) return original

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
    return data.imageUrl
  } catch (error) {
    stopTimer()
    setFormStatus(`사진을 불러오지 못했어요: ${error instanceof Error ? error.message : String(error)}`, true)
  } finally {
    stopTimer()
    if (loadImageButton) loadImageButton.disabled = false
    if (loadImageInput) loadImageInput.value = ''
  }
}

const conceptRefs = [null, null]
let conceptRefPickSlot = -1

function conceptRefUrls() {
  return conceptRefs.filter(Boolean)
}

function clearConceptRefs() {
  conceptRefs[0] = null
  conceptRefs[1] = null
  renderConceptRefs()
}

function renderConceptRefs() {
  document.querySelectorAll('.concept-ref').forEach((btn) => {
    const idx = Number(btn.getAttribute('data-ref') || '0')
    const url = conceptRefs[idx]
    const empty = btn.querySelector('.concept-ref__empty')
    const img = btn.querySelector('.concept-ref__img')
    const x = btn.querySelector('.concept-ref__x')
    btn.classList.toggle('is-on', Boolean(url))
    if (empty) empty.hidden = Boolean(url)
    if (img) {
      img.hidden = !url
      img.src = url || ''
    }
    if (x) x.hidden = !url
  })
}

async function uploadConceptFile(file) {
  const dataUrl = await prepareImageDataUrl(file)
  const response = await fetch('/api/upload-image', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ dataUrl }),
  })
  const data = await response.json().catch(() => ({}))
  if (response.status === 401) {
    clearAllAuth()
    showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
    return ''
  }
  if (!data.ok || !data.imageUrl) {
    throw new Error(data.message || data.error || 'upload_failed')
  }
  return data.imageUrl
}

async function addConceptRefFiles(files, slot) {
  const list = (files || []).filter(isImageFileLike).slice(0, 2)
  if (!list.length) {
    setFormStatus('이미지 파일만 넣을 수 있어요 (PNG/JPEG/WEBP).', true)
    return
  }
  if (!isLoggedIn()) {
    showPinGate('로그인이 필요해요.')
    return
  }
  const stopTimer = startProgressTimer(setFormStatus, '참고 이미지를 올리는 중…')
  try {
    for (const file of list) {
      const url = await uploadConceptFile(file)
      if (!url) return
      const idx =
        typeof slot === 'number' && slot >= 0 && slot <= 1 ? slot : conceptRefs[0] ? 1 : 0
      conceptRefs[idx] = url
      slot = -1
    }
    renderConceptRefs()
    const n = conceptRefUrls().length
    setFormStatus(
      n >= 2
        ? '참고 두 장을 넣었습니다. 생성하면 한 장면에 비빕니다.'
        : '참고 한 장을 넣었습니다. 한 장 더 넣으면 둘이 비빕니다.',
      false,
    )
  } catch (error) {
    setFormStatus(`참고 이미지를 넣지 못했어요: ${error instanceof Error ? error.message : String(error)}`, true)
  } finally {
    stopTimer()
    if (loadImageInput) loadImageInput.value = ''
    conceptRefPickSlot = -1
  }
}

async function pollConceptMixUntilDone(statusUrl, responseUrl, onTick) {
  const startedAt = Date.now()
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const elapsedSec = Math.round((Date.now() - startedAt) / 1000)
    if (elapsedSec >= 180) return ''
    if (typeof onTick === 'function') onTick(`참고 이미지를 비비는 중… ${elapsedSec}초`, false)
    await new Promise((resolve) => setTimeout(resolve, attempt < 4 ? 1500 : 2500))
    const response = await fetch('/api/tale-scene-status', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ statusUrl, responseUrl }),
    })
    const data = await response.json().catch(() => ({}))
    if (data.status === 'succeeded' && data.imageUrl) return data.imageUrl
    if (data.status === 'failed' || data.ok === false) return ''
  }
  return ''
}

function conceptRefSlotFromEvent(event) {
  const btn = event.target?.closest?.('.concept-ref')
  if (!btn) return -1
  const idx = Number(btn.getAttribute('data-ref'))
  return idx === 0 || idx === 1 ? idx : -1
}

function nextConceptRefSlot() {
  const hover = window.__conceptRefHoverSlot
  if ((hover === 0 || hover === 1) && !conceptRefs[hover]) return hover
  if (!conceptRefs[0]) return 0
  if (!conceptRefs[1]) return 1
  if (hover === 0 || hover === 1) return hover
  if (conceptRefPickSlot === 0 || conceptRefPickSlot === 1) return conceptRefPickSlot
  return 1
}

async function pasteConceptRefSlot(idx) {
  const slot = idx === 0 || idx === 1 ? idx : nextConceptRefSlot()
  conceptRefPickSlot = slot
  window.__conceptRefHoverSlot = slot
  try {
    const file = await readClipboardImageFile()
    if (!file) {
      setFormStatus('복사한 사진을 Ctrl+V로 붙이거나, 칸에 끌어다 놓으세요.', true)
      return
    }
    await addConceptRefFiles([file], slot)
  } catch {
    setFormStatus('복사한 사진을 Ctrl+V로 붙이거나, 칸에 끌어다 놓으세요.', true)
  }
}

loadImageButton?.addEventListener('click', () => {
  conceptRefPickSlot = conceptRefs[0] ? (conceptRefs[1] ? 1 : 1) : 0
  loadImageInput?.click()
})
loadImageInput?.addEventListener('change', () => {
  const files = [...(loadImageInput.files || [])]
  if (files.length) void addConceptRefFiles(files, conceptRefPickSlot)
})
document.querySelectorAll('.concept-ref').forEach((btn) => {
  const idx = Number(btn.getAttribute('data-ref') || '0')
  btn.addEventListener('pointerenter', () => {
    window.__conceptRefHoverSlot = idx
    conceptRefPickSlot = idx
  })
  btn.addEventListener('click', (event) => {
    if (event.target?.classList?.contains('concept-ref__x')) {
      event.preventDefault()
      conceptRefs[idx] = null
      renderConceptRefs()
      return
    }
    if (event.target?.closest?.('.concept-ref__paste')) {
      event.preventDefault()
      event.stopPropagation()
      void pasteConceptRefSlot(idx)
      return
    }
    conceptRefPickSlot = idx
    window.__conceptRefHoverSlot = idx
    loadImageInput?.click()
  })
  btn.addEventListener('paste', (event) => {
    const files = pickImageFilesFromDataTransfer(event.clipboardData)
    if (!files.length) return
    event.preventDefault()
    event.stopPropagation()
    conceptRefPickSlot = idx
    window.__conceptRefHoverSlot = idx
    void addConceptRefFiles(files, idx)
  })
  btn.addEventListener('dragenter', (event) => {
    event.preventDefault()
    event.stopPropagation()
    btn.classList.add('is-drag')
  })
  btn.addEventListener('dragover', (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    btn.classList.add('is-drag')
  })
  btn.addEventListener('dragleave', (event) => {
    if (btn.contains(event.relatedTarget)) return
    btn.classList.remove('is-drag')
  })
  btn.addEventListener('drop', (event) => {
    event.preventDefault()
    event.stopPropagation()
    btn.classList.remove('is-drag')
    const files = pickImageFilesFromDataTransfer(event.dataTransfer)
    if (files.length) void addConceptRefFiles(files, idx)
  })
})

/** 클립보드/드롭에서 이미지 파일 추출 (최대 2장) */
function isImageFileLike(file) {
  if (!file) return false
  const type = String(file.type || '').toLowerCase()
  if (type.startsWith('image/')) return true
  if (type && type !== 'application/octet-stream') return false
  const name = String(file.name || '')
  if (/\.(png|jpe?g|webp|gif|bmp|heic|heif|jfif)$/i.test(name)) return true
  return !type
}

function isDeskMakeOpen() {
  const desk = document.getElementById('adult-desk')
  const make = document.getElementById('adult-desk-make')
  return Boolean(desk && !desk.hidden && make && !make.hidden)
}

function isDeskAssembleOpen() {
  const panel = document.getElementById('desk-assemble')
  return isDeskMakeOpen() && Boolean(panel && !panel.hidden)
}

function deskHasFileDrag(event) {
  const types = event.dataTransfer?.types
  if (!types) return false
  return Array.from(types).includes('Files')
}

function pickImageFilesFromDataTransfer(dataTransfer) {
  if (!dataTransfer) return []
  const out = []
  const files = dataTransfer.files
  if (files?.length) {
    for (const file of files) {
      if (isImageFileLike(file)) out.push(file)
    }
  }
  if (!out.length) {
    const items = dataTransfer.items
    if (items?.length) {
      for (const item of items) {
        const type = String(item.type || '')
        if (item.kind === 'file' && (type.startsWith('image/') || !type)) {
          const file = item.getAsFile()
          if (isImageFileLike(file)) out.push(file)
        }
      }
    }
  }
  return out.slice(0, 2)
}

function pickImageFileFromDataTransfer(dataTransfer) {
  return pickImageFilesFromDataTransfer(dataTransfer)[0] || null
}

async function readClipboardImageFile() {
  if (!navigator.clipboard?.read) return null
  const items = await navigator.clipboard.read()
  for (const item of items) {
    const type = item.types.find((one) => String(one).startsWith('image/'))
    if (!type) continue
    const blob = await item.getType(type)
    if (blob) return new File([blob], `paste-${Date.now()}.png`, { type: blob.type || type })
  }
  return null
}

function isStudioImageLoadContext() {
  const area = getAppArea()
  return area === 'studio' || area === 'admin'
}

function isImageAttachArea() {
  const area = getAppArea()
  return (
    area === 'studio' ||
    area === 'admin' ||
    area === 'free' ||
    area === 'observe' ||
    area === 'tale' ||
    area === 'essay'
  )
}

// 화보/관리자: Ctrl+V 캡처·이미지 붙여넣기 → 수정 대상으로 불러오기
document.addEventListener('paste', (event) => {
  // 얼굴교체 패널이 열려 있으면 자체 리스너가 처리
  const faceswapPanel = document.getElementById('admin-faceswap-panel')
  if (faceswapPanel && !faceswapPanel.hidden) return
  if (event.target?.closest?.('#pin-gate, .pin-gate')) return
  const files = pickImageFilesFromDataTransfer(event.clipboardData)
  const file = files[0] || null
  if (!file) return
  const conceptZone = Boolean(event.target?.closest?.('#description-dropzone, #concept-refs'))
  if (isDeskMakeOpen() && !conceptZone) {
    const tag = event.target
    if (tag && (tag.tagName === 'INPUT' || tag.tagName === 'TEXTAREA') && tag.id === 'desk-work-title') {
      /* 작품 이름 칸이어도 사진이면 CAST에 붙인다 */
    }
    event.preventDefault()
    if (isDeskAssembleOpen() && typeof window.__deskAssembleAddFile === 'function') {
      void window.__deskAssembleAddFile(file)
      return
    }
    if (typeof window.__deskTakeCastFiles === 'function') {
      void window.__deskTakeCastFiles(files)
      return
    }
    if (typeof window.__deskApplyCastFile === 'function') {
      const pasteCast =
        window.__deskPasteCast === 'woman' || window.__deskPasteCast === 'man'
          ? window.__deskPasteCast
          : window.__deskLastCast === 'woman' || window.__deskLastCast === 'man'
            ? window.__deskLastCast
            : 'woman'
      void window.__deskApplyCastFile(pasteCast, file)
      return
    }
  }
  if (isStudioImageLoadContext()) {
    event.preventDefault()
    const slot = conceptRefSlotFromEvent(event)
    void addConceptRefFiles(files, slot >= 0 ? slot : nextConceptRefSlot())
    return
  }
  // 에세이 초안 칸에 글 붙여넣기를 그림이 가로채지 않게.
  if (getAppArea() === 'essay') return
  if (typeof StorymagAttach?.route === 'function') {
    event.preventDefault()
    StorymagAttach.route(files, event)
  }
})

document.addEventListener('dragover', (event) => {
  if (!deskHasFileDrag(event)) return
  if (!isImageAttachArea() && !isDeskMakeOpen()) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
})

document.addEventListener('drop', (event) => {
  const files = pickImageFilesFromDataTransfer(event.dataTransfer)
  if (!files.length) return
  const make = document.getElementById('adult-desk-make')
  const target = event.target
  if (isDeskMakeOpen() && make?.contains(target)) {
    if (isDeskAssembleOpen() && typeof window.__deskAssembleAddFile === 'function') {
      event.preventDefault()
      event.stopPropagation()
      void window.__deskAssembleAddFile(files[0])
      return
    }
    if (target.closest?.('#desk-scene-paste, #desk-scene-upload, #desk-scene-input')) {
      event.preventDefault()
      if (typeof window.__deskApplySceneFile === 'function') void window.__deskApplySceneFile(files[0])
      return
    }
    const person = document.querySelector('.adult-desk__person')
    if (
      person?.contains(target) ||
      target.closest?.('.desk-cast, .desk-cast-paste, #desk-cast-woman, #desk-cast-man')
    ) {
      event.preventDefault()
      event.stopPropagation()
      const hit = target.closest?.('#desk-cast-woman, #desk-cast-paste-w')
        ? 'woman'
        : target.closest?.('#desk-cast-man, #desk-cast-paste-m')
          ? 'man'
          : ''
      if (typeof window.__deskTakeCastFiles === 'function') void window.__deskTakeCastFiles(files, hit)
      return
    }
    event.preventDefault()
    if (typeof window.__deskTakeCastFiles === 'function') void window.__deskTakeCastFiles(files)
    return
  }
  if (isStudioImageLoadContext()) return
  if (getAppArea() === 'essay') {
    const pdfs = files.filter((file) => /\.pdf$/i.test(file.name || '') || file.type === 'application/pdf')
    if (!pdfs.length) return
    event.preventDefault()
    StorymagAttach?.route?.(pdfs, event)
    return
  }
  if (typeof StorymagAttach?.route === 'function') {
    event.preventDefault()
    StorymagAttach.route(files, event)
  }
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
  const files = pickImageFilesFromDataTransfer(event.dataTransfer)
  if (!files.length) {
    setFormStatus('이미지 파일만 끌어다 놓을 수 있어요 (PNG/JPEG/WEBP/GIF).', true)
    return
  }
  const slot = conceptRefSlotFromEvent(event)
  void addConceptRefFiles(files, slot >= 0 ? slot : undefined)
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
  if (getAppArea() === 'admin') setAdminPanel('fashion')
})

document.getElementById('edit-load-current')?.addEventListener('click', () => {
  const status = document.getElementById('edit-load-status')
  if (!currentResult?.imageUrl) {
    if (status) {
      status.hidden = false
      status.className = 'form__status form__status--error'
      status.textContent = '아직 생성 결과가 없어요. 「사진 올리기」로 불러오세요.'
    }
    return
  }
  resultSection.hidden = false
  setReviewChrome('revising')
  if (status) {
    status.hidden = false
    status.className = 'form__status'
    status.textContent = '생성 결과를 다듬기 대상으로 사용 중이에요.'
  }
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

document.getElementById('edit-upload-btn')?.addEventListener('click', () => {
  document.getElementById('edit-upload-input')?.click()
})

document.getElementById('edit-upload-input')?.addEventListener('change', async (event) => {
  const file = event.target?.files?.[0]
  event.target.value = ''
  const status = document.getElementById('edit-load-status')
  if (!file) return
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('read_failed'))
      reader.readAsDataURL(file)
    })
    if (!dataUrl.startsWith('data:image/')) throw new Error('not_image')
    showResult(dataUrl, '다듬기용 업로드', false, {
      size: sizeField?.value || 'portrait',
      itemId: null,
      prompt: '다듬기용 업로드',
      accepted: false,
      mood: moodField?.value || 'clean',
      engine: 'upload',
      genMode: 'fashion',
      reviseRound: 0,
    })
    currentResult.imageDataUrl = dataUrl
    currentResult.imageUrl = dataUrl
    resultSection.hidden = false
    setReviewChrome('revising')
    if (status) {
      status.hidden = false
      status.className = 'form__status'
      status.textContent = '사진을 올렸어요. 아래 도구로 다듬으세요.'
    }
  } catch (error) {
    if (status) {
      status.hidden = false
      status.className = 'form__status form__status--error'
      status.textContent = `올리기 실패: ${error instanceof Error ? error.message : String(error)}`
    }
  }
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
  const reviseModeUi = getSelectedReviseMode()
  if (reviseModeUi === 'erase') {
    if (!revision.trim()) revision = ERASE_REGION_REVISION
    else if (!/지우|메워|erase|remove\s*(the\s*)?(masked|selected|person)|배경/i.test(revision)) {
      revision = `${ERASE_REGION_REVISION} ${revision}`.trim()
    }
  }
  if (!revision) {
    setReviseStatus('수정 요청을 입력해 주세요.', true)
    return
  }
  revision = appendHeteroCastHint(revision)

  // 이중 초상 제거는 AI보다 절반 크롭이 확실 — 수정 적용으로도 동일 처리
  if (wantsDiptychCropFix(revision)) {
    await applyDiptychCrop(parseDiptychCropSide(revision))
    return
  }

  const mode = reviseModeUi === 'erase' ? 'region' : reviseModeUi
  let maskDataUrl = null
  if (mode === 'region') {
    maskDataUrl = buildMaskDataUrlFromRegion()
    if (!maskDataUrl) {
      setReviseStatus(
        reviseModeUi === 'erase'
          ? '지우기 모드입니다. 지울 부분을 점으로 이어서 닫은 뒤 「수정 적용」을 누르세요.'
          : '올가미 모드입니다. 부분만 고치려면 점을 찍어 닫으세요. 전신·구도처럼 전체를 바꾸려면 위에서 「텍스트로 수정」을 고른 뒤 다시 「수정 적용」을 누르세요.',
        true,
      )
      return
    }
    // 올가미 수정은 "선택 밖은 그대로 보존" — 누드/전신처럼 전역 요청과 섞으면 반만 반영된다.
    const wholeBodyPattern = /누드|나체|전라|전신|올누드|풀바디|속옷|란제리|nude|naked|undress/i
    if (reviseModeUi !== 'erase' && wholeBodyPattern.test(revision)) {
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
    let refineImageUrl = currentResult.imageUrl
    if ((reviseModeUi === 'erase' || wantsObjectEraseClient(revision)) && maskDataUrl) {
      setReviseStatus('지울 자리를 배경색으로 메우는 중…', false)
      const source = await loadCurrentResultDataUrl()
      const prefilled = await prefillMaskedHole(source, maskDataUrl)
      refineImageUrl = await uploadImageDataUrl(prefilled)
    }
    const response = await fetch('/api/refine', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        mode,
        // 지금 켜진 탭(getGenMode)이 아니라 "이 이미지를 실제로 만든 모드"를 써야 한다 —
        // 생성 후 탭을 옮기고 돌아와 수정하면 getGenMode()가 다른 값을 반환할 수 있어서,
        // 화보로 만든 동물 그림이 자유 모드 경로로(또는 반대로) 잘못 흘러가는 사고가 있었다.
        genMode: currentResult.genMode || getGenMode(),
        imageUrl: refineImageUrl,
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
        bustHeight: getSelectedBustHeight(),
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
  if (!currentResult.imageUrl) {
    setAnimateStatus('먼저 이미지를 생성하거나 불러와 주세요.', true)
    return
  }
  const motionText = (motionField?.value || '').trim()
  maybeAutoCheckTwoPeople(motionText)
  const dur = getSelectedVideoDuration()
  if (
    !isDualFrameDuration(dur) &&
    wantsUndressActionClient(motionText) &&
    wantsPartnerIntimateClient(motionText) &&
    !isSoloSelfMotion(motionText)
  ) {
    setAnimateStatus(
      '탈의+키스를 한 클립에 넣으면 끝이 원본으로 돌아가기 쉬워요. 24초(전반 탈의 → 후반 키스)를 고르세요.',
      false,
    )
  }
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
    const leaveMsg =
      getAppArea() === 'admin'
        ? '작품의 인물과 지금 장을 비우고 새 화보를 시작할까요?'
        : '아직 수용하지 않은 결과가 있어요. 새 장면을 시작할까요?'
    if (!window.confirm(leaveMsg)) return
  }
  if (getAppArea() === 'admin') {
    setAdminPanel('fashion')
    if (typeof window.clearDeskWorkCast === 'function') {
      window.clearDeskWorkCast()
    }
    setFormStatus('인물을 비웠습니다. CAST에 사람을 넣고 장면을 올리거나 새 사진을 만드세요.', false)
    return
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
  clearConceptRefs()
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
  // 자유 스튜디오는 제 제목·안내를 쓴다. 여기서 덮으면 일러스트 문구가 새어 나온다.
  const inFreeStudio = typeof getAppArea === 'function' && getAppArea() === 'free'
  if (subtitle && !inFreeStudio) {
    subtitle.textContent = free ? '자유 일러스트' : ''
  }
  if (title && !inFreeStudio) {
    title.textContent = free || !admin ? '자유 일러스트 스튜디오' : 'Storymag'
  }
  if (!inFreeStudio) document.title = free || !admin ? 'Storymag · 자유 일러스트' : 'Storymag'
  const genBtn = document.getElementById('generate-button')
  if (genBtn) genBtn.textContent = free ? '이미지 생성' : '만들기'
  const resultTitle = document.getElementById('result-title')
  if (resultTitle) resultTitle.textContent = free ? '생성 결과' : ''
  if (genModeHint) {
    if (inFreeStudio || (admin && !free)) {
      genModeHint.textContent = ''
      genModeHint.hidden = true
    } else if (admin) {
      genModeHint.hidden = false
      genModeHint.textContent = '장면을 자유 서술로 그립니다. 성인 장면은 성인 엔진으로 그립니다.'
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
    galleryPickedIds.delete(item.id)
  })
  writeGallery(items.filter((item) => item.genMode === 'fashion'))
  renderGallery()
})

clearAdminGalleryButton?.addEventListener('click', () => {
  if (!window.confirm('소지한 화보·작품을 모두 삭제할까요? 일러스트 갤러리는 남아 있습니다.')) return
  const items = readGallery()
  items.filter((item) => item.genMode === 'fashion').forEach((item) => {
    deletePermanentMediaIfNeeded(item.imageUrl)
    deletePermanentMediaIfNeeded(item.videoUrl)
    galleryPickedIds.delete(item.id)
  })
  writeGallery(items.filter((item) => item.genMode !== 'fashion'))
  renderGallery()
})

deletePickedGalleryButton?.addEventListener('click', () => deletePickedGalleryItems('free'))
deletePickedAdminGalleryButton?.addEventListener('click', () => deletePickedGalleryItems('fashion'))

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

  const token = getSessionToken()
  const pin = getStoredAdminPin()
  if (token || pin) {
    try {
      const headers = {}
      if (token) headers['x-session-token'] = token
      if (pin) headers['x-admin-pin'] = pin
      const response = await fetch('/api/auth/me', {
        headers,
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.ok) {
        if (data.user?.email) localStorage.setItem(USER_STORAGE_KEY, data.user.email)
        if (!isAdminUser()) {
          clearAllAuth()
          showPinGate(authErrorMessage('solo_admin_only'))
          return
        }
        if (isAdminUser() && !localStorage.getItem(APP_AREA_KEY)) setAppArea('admin')
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
const WORKSHOP_STAGE_KEY = 'storymag-workshop-stage'

function getWorkshopStage() {
  const saved = localStorage.getItem(WORKSHOP_STAGE_KEY)
  if (saved === 'shoot' || saved === 'shorts' || saved === 'keep') return saved
  return localStorage.getItem(ADMIN_PANEL_KEY) === 'gallery' ? 'keep' : 'shoot'
}

function setWorkshopStage(stage) {
  const next = stage === 'shorts' || stage === 'keep' ? stage : 'shoot'
  localStorage.setItem(WORKSHOP_STAGE_KEY, next)
  if (next === 'keep') {
    localStorage.setItem(ADMIN_PANEL_KEY, 'gallery')
  } else if (next === 'shoot') {
    const panel = localStorage.getItem(ADMIN_PANEL_KEY)
    if (panel === 'gallery') localStorage.setItem(ADMIN_PANEL_KEY, 'fashion')
  }
  syncAdminWorkspaceUi()
}

function getAdminPanel() {
  if (getWorkshopStage() === 'keep') return 'gallery'
  const saved = localStorage.getItem(ADMIN_PANEL_KEY)
  return saved === 'faceswap' || saved === 'edit' ? saved : 'fashion'
}

function setAdminPanel(panel) {
  if (panel === 'gallery') {
    localStorage.setItem(WORKSHOP_STAGE_KEY, 'keep')
    localStorage.setItem(ADMIN_PANEL_KEY, 'gallery')
  } else {
    localStorage.setItem(WORKSHOP_STAGE_KEY, 'shoot')
    localStorage.setItem(
      ADMIN_PANEL_KEY,
      panel === 'faceswap' || panel === 'edit' ? panel : 'fashion',
    )
  }
  syncAdminWorkspaceUi()
}

function syncAdminWorkspaceUi() {
  const area = getAppArea()
  const isAdminArea = area === 'admin'
  const stage = getWorkshopStage()
  const panel = getAdminPanel()
  const chrome = document.getElementById('workshop-chrome')
  const adultDesk = document.getElementById('adult-desk')
  const deskMake = document.getElementById('adult-desk-make')
  const deskKeep = document.getElementById('adult-desk-keep')
  const subnav = document.getElementById('admin-subnav')
  const faceswapPanel = document.getElementById('admin-faceswap-panel')
  const editPanel = document.getElementById('admin-edit-panel')
  const formPanel = document.getElementById('generate-form')?.closest('section.panel')
  const shortsEmpty = document.getElementById('workshop-shorts-empty')
  const fashionLead = document.getElementById('workshop-fashion-lead')
  const shortsHead = document.getElementById('workshop-shorts-head')
  const goShortsBtns = [
    document.getElementById('workshop-go-shorts'),
    document.getElementById('workshop-go-shorts-accepted'),
  ]
  const deskView = localStorage.getItem('storymag-desk-view') === 'keep' ? 'keep' : 'make'
  const deskAdvanced = document.body.classList.contains('desk-advanced-on')

  if (chrome) chrome.hidden = true
  if (adultDesk) adultDesk.hidden = !isAdminArea
  if (deskMake) deskMake.hidden = !(isAdminArea && deskView === 'make')
  if (deskKeep) deskKeep.hidden = !(isAdminArea && deskView === 'keep')
  if (subnav) subnav.hidden = !(isAdminArea && deskAdvanced)
  if (typeof placeAdultDeskNodes === 'function') placeAdultDeskNodes()

  document.querySelectorAll('[data-desk-view]').forEach((btn) => {
    const on = btn.getAttribute('data-desk-view') === deskView
    btn.classList.toggle('is-on', on && isAdminArea)
    btn.setAttribute('aria-selected', on && isAdminArea ? 'true' : 'false')
  })

  document.querySelectorAll('[data-workshop-stage]').forEach((btn) => {
    const on = btn.getAttribute('data-workshop-stage') === stage
    btn.classList.toggle('workshop-spine__step--active', on && isAdminArea)
    btn.setAttribute('aria-selected', on && isAdminArea ? 'true' : 'false')
  })

  document.querySelectorAll('[data-admin-panel]').forEach((btn) => {
    const on = btn.getAttribute('data-admin-panel') === panel
    btn.classList.toggle('admin-subnav__btn--active', on && isAdminArea && stage === 'shoot')
    btn.setAttribute('aria-selected', on && isAdminArea && stage === 'shoot' ? 'true' : 'false')
  })

  if (faceswapPanel) faceswapPanel.hidden = !(isAdminArea && deskAdvanced && panel === 'faceswap')
  if (editPanel) editPanel.hidden = !(isAdminArea && deskAdvanced && panel === 'edit')
  if (adminGallerySection) adminGallerySection.hidden = !(isAdminArea && deskView === 'keep')
  if (formPanel) formPanel.hidden = isAdminArea
  if (fashionLead) fashionLead.hidden = true
  if (shortsHead) shortsHead.hidden = true
  goShortsBtns.forEach((btn) => {
    if (btn) btn.hidden = true
  })

  if (resultSection) {
    if (isAdminArea && deskView === 'keep') {
      resultSection.hidden = true
    } else if (isAdminArea) {
      resultSection.hidden = !currentResult?.imageUrl
    } else if (area === 'studio' || area === 'admin') {
      syncResultVisibilityForArea(area === 'admin' ? 'fashion' : 'free')
    }
  }
  if (isAdminArea) syncDeskStageEmpty()

  if (shortsEmpty) shortsEmpty.hidden = true

  if (animatePanel) {
    if (isAdminArea) {
      animatePanel.hidden = !currentResult?.videoUrl
    } else if (currentResult?.imageUrl) {
      animatePanel.hidden = false
    }
  }

  if (isAdminArea && deskAdvanced && panel === 'edit') {
    if (revisePanel) revisePanel.hidden = false
    if (animatePanel) animatePanel.hidden = true
    if (currentResult?.imageUrl) {
      reviewPanel.hidden = false
      setReviewChrome('revising')
    }
  } else if (isAdminArea && revisePanel && !revisePanel.hidden && !(deskAdvanced && panel === 'edit')) {
    closeRevisePanel()
  }
}

document.querySelectorAll('[data-workshop-stage]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setWorkshopStage(btn.getAttribute('data-workshop-stage') || 'shoot')
  })
})

document.getElementById('workshop-empty-to-shoot')?.addEventListener('click', () => {
  setWorkshopStage('shoot')
  setAdminPanel('fashion')
})

document.getElementById('workshop-go-shorts')?.addEventListener('click', () => {
  setWorkshopStage('shorts')
})

document.getElementById('workshop-go-shorts-accepted')?.addEventListener('click', () => {
  setWorkshopStage('shorts')
})

document.querySelectorAll('[data-admin-panel]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setAdminPanel(btn.getAttribute('data-admin-panel') || 'fashion')
  })
})

// ---- 얼굴·장면 (재구축) — 1단계: 얼굴 바꾸기만 동작 ----
;(() => {
  const MODE_KEY = 'storymag.fsMode.v3'
  const face0Slot = document.getElementById('fs-face0-slot')
  const face1Slot = document.getElementById('fs-face1-slot')
  const targetSlot = document.getElementById('fs-target-slot')
  const face0Input = document.getElementById('fs-face0-input')
  const face1Input = document.getElementById('fs-face1-input')
  const targetInput = document.getElementById('fs-target-input')
  const gender0Select = document.getElementById('fs-gender0')
  const gender1Select = document.getElementById('fs-gender1')
  const face0ClearBtn = document.getElementById('fs-face0-clear')
  const face1ClearBtn = document.getElementById('fs-face1-clear')
  const targetClearBtn = document.getElementById('fs-target-clear')
  const workflowSelect = document.getElementById('fs-workflow')
  const upscaleCheckbox = document.getElementById('fs-upscale')
  const engineSelect = document.getElementById('fs-engine')
  const targetSideSelect = document.getElementById('fs-target-side')
  const easelOptions = document.getElementById('fs-easel-options')
  const runBtn = document.getElementById('fs-run-swap')
  const statusEl = document.getElementById('fs-status')
  const resultWrap = document.getElementById('fs-result-wrap')
  const resultPlaceholder = document.getElementById('fs-result-placeholder')
  const resultImg = document.getElementById('fs-result-img')
  const resultActions = document.getElementById('fs-result-actions')
  const resultDownload = document.getElementById('fs-result-download')
  const resultToMainBtn = document.getElementById('fs-result-to-main')
  const resultAsTargetBtn = document.getElementById('fs-result-as-target')
  const paneSwap = document.getElementById('fs-pane-swap')
  const paneFace = document.getElementById('fs-pane-face')
  const panePose = document.getElementById('fs-pane-pose')
  const paneBody = document.getElementById('fs-pane-body')

  if (!targetSlot || !face0Slot || !runBtn) return

  const state = { target: null, face0: null, face1: null }
  let blobUrl = null
  let lastRemoteUrl = null

  function syncEngineUi() {
    const raw = targetSideSelect?.value || 'all'
    const isEasel = raw === 'gender'
    const isHard = raw === 'hard'
    const isKontext = raw === 'kontext'
    if (easelOptions) easelOptions.hidden = !isEasel
    if (upscaleCheckbox?.closest('.form__checkbox-row')) {
      upscaleCheckbox.closest('.form__checkbox-row').hidden = !isEasel
    }
    if (engineSelect) {
      engineSelect.value = isEasel ? 'easel' : isKontext ? 'kontext' : 'insight'
    }
    if (isEasel && workflowSelect) {
      workflowSelect.value = 'user_hair'
    }
    const hint = document.getElementById('fs-mode-hint')
    if (hint) {
      hint.innerHTML = isHard
        ? '<strong>비추천</strong>: 스티커처럼 붙습니다. 쓰지 마세요.'
        : isKontext
          ? '<strong>실험</strong>: 머리 통째는 자주 검은 화면입니다. 실패하면 자동으로 InsightFace(얼굴만)로 바꿉니다. 「사진 이어그리기」는 머리를 바꾸지 않습니다.'
          : isEasel
            ? '<strong>실험</strong>: Easel은 장애·검은 화면이 많습니다. 실패 시 InsightFace로 전환합니다.'
            : '<strong>안정 · InsightFace</strong>: 원본 얼굴만 교체 (헤어는 원본 유지 · 성인 장면 OK). 칸1→왼쪽, 칸2→오른쪽.'
    }
  }
  targetSideSelect?.addEventListener('change', syncEngineUi)
  engineSelect?.addEventListener('change', syncEngineUi)
  syncEngineUi()

  /**
   * 최대 2칸. 「사용 안 함」은 제외. slot 0=왼쪽, 1=오른쪽.
   */
  function resolveFaceSlots() {
    const candidates = [
      { dataUrl: state.face0, gender: gender0Select?.value || 'female', slot: 0 },
      { dataUrl: state.face1, gender: gender1Select?.value || 'none', slot: 1 },
    ]
    const packed = candidates.filter((c) => c.dataUrl && c.gender && c.gender !== 'none')
    if (!packed.length) return null
    return {
      list: packed,
      face0: packed[0].dataUrl,
      gender0: packed[0].gender,
      face1: packed[1] ? packed[1].dataUrl : null,
      gender1: packed[1] ? packed[1].gender : null,
      count: packed.length,
    }
  }

  function clearFaceSlot(key, slotEl, genderSelect) {
    state[key] = null
    setSlotPreview(slotEl, null)
    if (genderSelect && key === 'face1') {
      genderSelect.value = 'none'
    }
  }

  function wireGenderUnused(genderSelect, key, slotEl) {
    if (!genderSelect) return
    genderSelect.addEventListener('change', () => {
      if (genderSelect.value === 'none') {
        clearFaceSlot(key, slotEl, genderSelect)
        setStatus(`${key === 'face0' ? '칸1(왼쪽)' : '칸2(오른쪽)'} 사용 안 함`, false)
      }
    })
  }

  function sideLabel(side) {
    if (side === 'left') return '왼쪽'
    if (side === 'right') return '오른쪽'
    if (side === 'all') return '좌·우'
    return '성별'
  }

  function indexToSide(index) {
    return index === 1 ? 'right' : 'left'
  }

  function setStatus(msg, isError) {
    if (statusEl) {
      statusEl.hidden = !msg
      statusEl.textContent = msg || ''
      statusEl.classList.toggle('form__status--error', Boolean(isError))
    }
    const desk = document.getElementById('adult-desk')
    if (desk && !desk.hidden && typeof setFormStatus === 'function') {
      if (isError && typeof window.__deskStopStepTimer === 'function') {
        window.__deskStopStepTimer()
        window.__deskStopStepTimer = null
      }
      if (isError || !window.__deskStepTimerOn) setFormStatus(msg || '', Boolean(isError))
    }
  }

  function setMode(mode) {
    const next = mode === 'face' || mode === 'body' || mode === 'pose' ? mode : 'swap'
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch (_) {
      /* ignore */
    }
    document.querySelectorAll('[data-fs-mode]').forEach((btn) => {
      const on = btn.getAttribute('data-fs-mode') === next
      btn.classList.toggle('faceswap-mode-tabs__btn--active', on)
      btn.setAttribute('aria-selected', on ? 'true' : 'false')
    })
    if (paneSwap) paneSwap.hidden = next !== 'swap'
    if (paneFace) paneFace.hidden = next !== 'face'
    if (panePose) panePose.hidden = next !== 'pose'
    if (paneBody) paneBody.hidden = next !== 'body'
  }

  document.querySelectorAll('[data-fs-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.getAttribute('data-fs-mode')))
  })
  const saved = localStorage.getItem(MODE_KEY)
  setMode(saved === 'face' || saved === 'body' || saved === 'pose' || saved === 'swap' ? saved : 'swap')

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
      // 증명사진은 고화질 유지(압축↓) — 닮음에 직결
      const dataUrl =
        key === 'target' ? await prepareImageDataUrl(file) : await prepareImageDataUrl(file, 1800)
      state[key] = dataUrl
      setSlotPreview(slotEl, dataUrl)
      // 사진 올리면 「사용 안 함」이면 성별을 기본값으로 올림 (칸1=좌·남성 기본)
      if (key === 'face0' && gender0Select?.value === 'none') gender0Select.value = 'male'
      if (key === 'face1' && gender1Select?.value === 'none') gender1Select.value = 'female'
      setStatus('', false)
    } catch (error) {
      setStatus(`사진을 불러오지 못했어요: ${error instanceof Error ? error.message : String(error)}`, true)
    }
  }

  function wireSlot(key, slotEl, inputEl) {
    if (!slotEl || !inputEl) return
    slotEl.addEventListener('click', () => inputEl.click())
    slotEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        inputEl.click()
      }
    })
    inputEl.addEventListener('change', () => {
      const file = inputEl.files?.[0]
      if (file) void assignFile(key, slotEl, file)
      inputEl.value = ''
    })
    slotEl.addEventListener('dragover', (event) => {
      event.preventDefault()
      slotEl.classList.add('admin-fuse-slot--drag')
    })
    slotEl.addEventListener('dragleave', () => slotEl.classList.remove('admin-fuse-slot--drag'))
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

  wireSlot('face0', face0Slot, face0Input)
  wireSlot('face1', face1Slot, face1Input)
  wireSlot('target', targetSlot, targetInput)
  wireGenderUnused(gender0Select, 'face0', face0Slot)
  wireGenderUnused(gender1Select, 'face1', face1Slot)

  face0ClearBtn?.addEventListener('click', () => {
    clearFaceSlot('face0', face0Slot, gender0Select)
    if (gender0Select) gender0Select.value = 'none'
  })
  face1ClearBtn?.addEventListener('click', () => clearFaceSlot('face1', face1Slot, gender1Select))
  targetClearBtn?.addEventListener('click', () => {
    state.target = null
    setSlotPreview(targetSlot, null)
  })

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
  }

  function revokeBlob() {
    if (blobUrl) {
      try {
        URL.revokeObjectURL(blobUrl)
      } catch (_) {
        /* ignore */
      }
      blobUrl = null
    }
  }

  async function toDisplayUrl(imageUrl) {
    if (!imageUrl) return null
    if (imageUrl.startsWith('blob:')) return imageUrl
    if (imageUrl.startsWith('data:image/')) {
      try {
        const blob = await (await fetch(imageUrl)).blob()
        if (blob.size < 2000) return null
        revokeBlob()
        blobUrl = URL.createObjectURL(blob)
        return blobUrl
      } catch (_) {
        return imageUrl
      }
    }
    try {
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 90000)
      const res = await fetch('/api/media-proxy', {
        method: 'POST',
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
        signal: controller.signal,
      })
      window.clearTimeout(timer)
      const ctype = (res.headers.get('content-type') || '').toLowerCase()
      if (!res.ok || !ctype.startsWith('image/')) return null
      const blob = await res.blob()
      if (!blob || blob.size < 2000) return null
      revokeBlob()
      blobUrl = URL.createObjectURL(blob)
      return blobUrl
    } catch (_) {
      return null
    }
  }

  function paintResult(displayUrl, remoteUrl) {
    if (displayUrl !== blobUrl) revokeBlob()
    if (resultImg) {
      resultImg.onload = null
      resultImg.onerror = null
      resultImg.src = displayUrl
      resultImg.hidden = false
    }
    if (resultPlaceholder) resultPlaceholder.hidden = true
    if (resultActions) resultActions.hidden = false
    if (resultDownload) {
      resultDownload.href = displayUrl
      resultDownload.removeAttribute('hidden')
    }
    if (remoteUrl && (remoteUrl.startsWith('http') || remoteUrl.startsWith('data:'))) {
      lastRemoteUrl = remoteUrl
    }
    if (typeof showResult === 'function') {
      showResult(displayUrl, '얼굴 바꾸기', false, {
        size: typeof sizeField !== 'undefined' && sizeField ? sizeField.value : 'portrait',
        itemId: null,
        prompt: '얼굴 바꾸기 결과',
        accepted: false,
        mood: typeof moodField !== 'undefined' && moodField ? moodField.value : 'clean',
        engine: 'face-swap',
        genMode: 'fashion',
        reviseRound: 0,
      })
      if (lastRemoteUrl && typeof currentResult !== 'undefined' && currentResult) {
        currentResult.imageUrl = lastRemoteUrl
        if (typeof cacheImageForAnimate === 'function') void cacheImageForAnimate(lastRemoteUrl)
      }
    }
    if (resultWrap) {
      window.setTimeout(() => resultWrap.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40)
    }
  }

  async function displayResult(imageUrl) {
    setStatus('결과 불러오는 중…', false)
    logFs('display_start', { kind: imageUrl?.startsWith('http') ? 'http' : 'other' })
    const displayUrl = await toDisplayUrl(imageUrl)
    if (!displayUrl) {
      logFs('display_failed', { imageUrl: String(imageUrl || '').slice(0, 120) })
      setStatus('결과는 받았지만 미리보기에 실패했어요. 「다운로드」로 확인해 보세요.', true)
      return false
    }
    paintResult(displayUrl, imageUrl)
    logFs('display_ok', {})
    return true
  }

  function logFs(step, detail) {
    if (step === 'face_box_fallback' || step === 'scene_faces_empty' || step === 'face_box_error') return
    try {
      console.info('[faceswap]', step, detail || '')
    } catch (_) {
      /* ignore */
    }
  }

  function engineLabel(engine) {
    if (engine === 'easel') return 'Easel(헤어)'
    if (engine === 'insight') return 'fal InsightFace'
    if (engine === 'indexed') return '좌우 인덱스'
    if (engine === 'replicate') return '증명사진 교체'
    if (engine === 'kontext') return 'Kontext 머리통째'
    return 'Replicate'
  }

  function loadHtmlImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('image_load_failed'))
      img.src = src
    })
  }

  /** 얼굴 박스 휴리스틱 — API 실패 시. 증명사진 전체(셔츠·배경)를 얼굴로 보지 않음. */
  function heuristicFaceBox(kind) {
    if (kind === 'id') return { x: 0.22, y: 0.1, w: 0.56, h: 0.5 }
    return { x: 0.28, y: 0.07, w: 0.44, h: 0.22 }
  }

  function clampNormFace(face, kind) {
    const fb = face && typeof face.w === 'number' ? face : heuristicFaceBox(kind)
    let x = fb.x
    let y = fb.y
    let w = fb.w
    let h = fb.h
    if (kind === 'id' && (w > 0.62 || h > 0.58)) {
      const cx = x + w / 2
      const cy = y + h * 0.36
      w = 0.48
      h = 0.46
      x = Math.max(0, Math.min(1 - w, cx - w / 2))
      y = Math.max(0, Math.min(1 - h, cy - h / 2))
    }
    if (kind === 'target' && (w > 0.72 || h > 0.48)) {
      const cx = x + w / 2
      w = 0.42
      h = 0.22
      x = Math.max(0, Math.min(1 - w, cx - w / 2))
      y = Math.max(0.05, Math.min(0.18, y))
    }
    return { ...fb, x, y, w, h }
  }

  const faceBoxMemo = new Map()
  function faceBoxMemoKey(dataUrl, kind) {
    const s = String(dataUrl || '')
    return `${kind}:${s.length}:${s.slice(48, 120)}:${s.slice(-40)}`
  }
  function faceBoxMemoGet(key) {
    return faceBoxMemo.has(key) ? faceBoxMemo.get(key) : null
  }
  function faceBoxMemoSet(key, value) {
    if (faceBoxMemo.size > 28) {
      const first = faceBoxMemo.keys().next().value
      if (first) faceBoxMemo.delete(first)
    }
    faceBoxMemo.set(key, value)
    return value
  }

  async function estimateFaceBoxFromImage(src, opts) {
    try {
      const img = await loadHtmlImage(src)
      const maxW = 96
      const scale = maxW / Math.max(img.naturalWidth, 1)
      const w = Math.max(24, Math.round(img.naturalWidth * scale))
      const h = Math.max(24, Math.round(img.naturalHeight * scale))
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, w, h)
      const { data } = ctx.getImageData(0, 0, w, h)
      const scanTop = Number(opts?.scanTop) > 0 ? Number(opts.scanTop) : 0.44
      const scanH = Math.round(h * scanTop)
      const x0 = opts?.centerOnly ? Math.max(1, Math.round(w * 0.22)) : 1
      const x1 = opts?.centerOnly ? Math.min(w - 1, Math.round(w * 0.78)) : w - 1
      let minX = w
      let minY = h
      let maxX = 0
      let maxY = 0
      let n = 0
      for (let y = 1; y < scanH; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * w + x) * 4
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          if (data[i + 3] < 40) continue
          const luma = r * 0.299 + g * 0.587 + b * 0.114
          if (luma < 72 || luma > 232) continue
          if (r < 82 || r < g - 6 || r < b + 6) continue
          const sat = Math.max(r, g, b) - Math.min(r, g, b)
          if (sat < 14 || sat > 128) continue
          n += 1
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
      if (n < 18) return null
      const pad = 3
      const x = Math.max(0, (minX - pad) / w)
      const y = Math.max(0, (minY - pad) / h)
      const bw = Math.min(1 - x, (maxX - minX + pad * 2) / w)
      const bh = Math.min(1 - y, (maxY - minY + pad * 2) / h)
      if (bw < 0.08 || bh < 0.08 || bh > 0.55) return null
      return { x, y, w: bw, h: bh }
    } catch (_) {
      return null
    }
  }

  async function detectFaceBox(imageDataUrl, kind) {
    const key = faceBoxMemoKey(imageDataUrl, `one:${kind || ''}`)
    const hit = faceBoxMemoGet(key)
    if (hit) return hit
    try {
      const small = await compressToJpegDataUrl(imageDataUrl, 1024, 0.82)
      const response = await fetch('/api/face-box', {
        method: 'POST',
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: small }),
      })
      const data = await response.json().catch(() => ({}))
      if (data?.ok && data.face && typeof data.face.w === 'number') {
        logFs('face_box_ok', { kind, x: data.face.x, y: data.face.y, w: data.face.w, h: data.face.h })
        return faceBoxMemoSet(key, clampNormFace(data.face, kind))
      }
      logFs('face_box_fallback', { kind, http: response.status, error: data?.error })
    } catch (err) {
      logFs('face_box_error', { kind, message: err instanceof Error ? err.message : String(err) })
    }
    const local = await estimateFaceBoxFromImage(imageDataUrl)
    if (local) return faceBoxMemoSet(key, clampNormFace(local, kind))
    return faceBoxMemoSet(key, heuristicFaceBox(kind))
  }

  function remapFacePoint(p, sx, sy, sw, sh, iw, ih) {
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return null
    return {
      x: (p.x * iw - sx) / Math.max(sw, 1),
      y: (p.y * ih - sy) / Math.max(sh, 1),
    }
  }

  /**
   * 증명사진 모서리의 파란/회색 스튜디오 배경만 지움. 가운데(얼굴·머리)는 보호.
   */
  function keyIdStudioBackdrop(canvas, opts = {}) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const w = canvas.width
    const h = canvas.height
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const sampleAt = (x, y) => {
      const i = (Math.max(0, Math.min(w - 1, x)) + Math.max(0, Math.min(h - 1, y)) * w) * 4
      return [d[i], d[i + 1], d[i + 2]]
    }
    const samples = [
      sampleAt(2, 2),
      sampleAt(w - 3, 2),
      sampleAt(2, Math.round(h * 0.12)),
      sampleAt(w - 3, Math.round(h * 0.12)),
      sampleAt(Math.round(w / 2), 2),
    ]
    const cx = w / 2
    const cy = h * 0.46
    const prx = w * 0.32
    const pry = h * 0.36
    const protectTorso = opts.protectTorso !== false
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const nx = (x - cx) / prx
        const ny = (y - cy) / pry
        if (nx * nx + ny * ny < 1) continue
        if (protectTorso && x > w * 0.2 && x < w * 0.8 && y > h * 0.04 && y < h * 0.42) continue
        const i = (y * w + x) * 4
        const r = d[i]
        const g = d[i + 1]
        const b = d[i + 2]
        let nearest = 999
        for (let s = 0; s < samples.length; s += 1) {
          const dr = r - samples[s][0]
          const dg = g - samples[s][1]
          const db = b - samples[s][2]
          const dist = Math.sqrt(dr * dr + dg * dg + db * db)
          if (dist < nearest) nearest = dist
        }
        const maxc = Math.max(r, g, b)
        const minc = Math.min(r, g, b)
        const luma = r * 0.299 + g * 0.587 + b * 0.114
        const outsideBody = x < w * 0.2 || x > w * 0.8
        const studioGray = outsideBody && luma > 168 && maxc - minc < 32
        if (nearest < 48 || studioGray) d[i + 3] = 0
        else if (nearest < 64) d[i + 3] = Math.round(d[i + 3] * ((64 - nearest) / 16))
      }
    }
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] < 200) d[i] = 0
    }
    ctx.putImageData(img, 0, 0)
  }

  /**
   * ② 증명사진에서 얼굴(+머리)만 투명 PNG로 자름. 파란/회색 카드 배경은 버림.
   */
  async function extractIdFacePng(idDataUrl, opts) {
    let workUrl = idDataUrl
    try {
      const cut = await isolateOutpaintedPerson(idDataUrl)
      if (cut && cut.width > 24 && cut.height > 24 && !subjectLooksLikePhotoCard(cut)) {
        punchIdPhotoBackdrop(cut)
        workUrl = cut.toDataURL('image/png')
      }
    } catch (err) {
      console.warn('id face isolate failed', err)
    }
    const img = await loadHtmlImage(workUrl)
    const face = await detectFaceBox(workUrl, 'id')
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const tight = Boolean(opts?.tight)
    const padX = face.w * (tight ? 0.08 : 0.22)
    const padYTop = face.h * (tight ? 0.16 : 0.48)
    const padYBot = face.h * (tight ? 0.1 : 0.16)
    const sx = Math.max(0, Math.round((face.x - padX) * iw))
    const sy = Math.max(0, Math.round((face.y - padYTop) * ih))
    const sw = Math.min(iw - sx, Math.round((face.w + padX * 2) * iw))
    const sh = Math.min(ih - sy, Math.round((face.h + padYTop + padYBot) * ih))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(8, sw)
    canvas.height = Math.max(8, sh)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    punchIdPhotoBackdrop(canvas)
    keyIdStudioBackdrop(canvas)
    const mask = document.createElement('canvas')
    mask.width = canvas.width
    mask.height = canvas.height
    const mctx = mask.getContext('2d')
    const cx = canvas.width / 2
    const cy = canvas.height * 0.46
    const rx = canvas.width * (tight ? 0.36 : 0.42)
    const ry = canvas.height * (tight ? 0.4 : 0.48)
    const grad = mctx.createRadialGradient(
      cx,
      cy,
      Math.min(rx, ry) * 0.5,
      cx,
      cy,
      Math.max(rx, ry),
    )
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(0.7, 'rgba(0,0,0,1)')
    grad.addColorStop(0.88, 'rgba(0,0,0,0.4)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    mctx.fillStyle = grad
    mctx.beginPath()
    mctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    mctx.fill()
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(mask, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    defringeCutout(canvas)
    return {
      pngDataUrl: canvas.toDataURL('image/png'),
      w: canvas.width,
      h: canvas.height,
      leftEye: remapFacePoint(face.leftEye, sx, sy, sw, sh, iw, ih),
      rightEye: remapFacePoint(face.rightEye, sx, sy, sw, sh, iw, ih),
    }
  }

  /**
   * ② 얼굴+상의를 PNG로. 스튜디오 배경만 지우고 흰 바탕에 올려 아래로 이어그리게 함.
   */
  async function extractIdSubjectPng(idDataUrl) {
    const img = await loadHtmlImage(idDataUrl)
    let canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    let isolated = false
    try {
      const cut = await isolateOutpaintedPerson(idDataUrl)
      if (cut && cut.width > 24 && cut.height > 24) {
        canvas = cut
        isolated = true
      }
    } catch (err) {
      console.warn('id subject isolate failed', err)
    }
    if (!isolated) {
      keyIdStudioBackdrop(canvas, { protectTorso: true })
      defringeCutout(canvas)
    }
    punchIdPhotoBackdrop(canvas)
    defringeCutout(canvas)
    const flat = document.createElement('canvas')
    flat.width = canvas.width
    flat.height = canvas.height
    const fctx = flat.getContext('2d')
    fctx.fillStyle = '#f4f4f4'
    fctx.fillRect(0, 0, flat.width, flat.height)
    fctx.drawImage(canvas, 0, 0)
    return {
      pngDataUrl: canvas.toDataURL('image/png'),
      flatDataUrl: flat.toDataURL('image/jpeg', 0.92),
      w: canvas.width,
      h: canvas.height,
    }
  }

  function paintSeamlessStudio(ctx, cw, ch, cloth) {
    const light = Boolean(cloth && cloth.luma > 120)
    const wall = ctx.createLinearGradient(0, 0, 0, ch)
    if (light) {
      wall.addColorStop(0, '#e8e4de')
      wall.addColorStop(0.72, '#ddd8d2')
      wall.addColorStop(1, '#d2cdc6')
    } else {
      wall.addColorStop(0, '#3f4449')
      wall.addColorStop(0.72, '#4a5056')
      wall.addColorStop(1, '#32363a')
    }
    ctx.fillStyle = wall
    ctx.fillRect(0, 0, cw, ch)
    const fy = Math.round(ch * 0.84)
    const floor = ctx.createLinearGradient(0, fy, 0, ch)
    floor.addColorStop(0, 'rgba(0,0,0,0)')
    floor.addColorStop(1, 'rgba(0,0,0,0.1)')
    ctx.fillStyle = floor
    ctx.fillRect(0, fy, cw, ch - fy)
  }

  function drawFootContactShadow(ctx, cx, fy, radiusX, radiusY) {
    ctx.save()
    const g = ctx.createRadialGradient(cx, fy, 2, cx, fy, radiusX)
    g.addColorStop(0, 'rgba(40,40,40,0.22)')
    g.addColorStop(0.55, 'rgba(40,40,40,0.08)')
    g.addColorStop(1, 'rgba(40,40,40,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(cx, fy, radiusX, radiusY, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  function sceneCanvasSize(aspectRatio) {
    const a = aspectRatio || '9:16'
    if (a === '16:9') return [1365, 768]
    if (a === '1:1') return [1024, 1024]
    return [768, 1365]
  }

  const FAL_OUTPAINT_MAX_DIM = 2550

  function fitOutpaintExpandClient(srcW, srcH, expand) {
    const fitPair = (src, first, second, preferSecond) => {
      let a = Math.max(0, Math.round(first || 0))
      let b = Math.max(0, Math.round(second || 0))
      const room = Math.max(0, FAL_OUTPAINT_MAX_DIM - src)
      if (a + b <= room) return [a, b]
      if (room === 0) return [0, 0]
      if (preferSecond) {
        b = Math.min(b, room)
        a = Math.min(a, Math.max(0, room - b))
      } else {
        const scale = room / (a + b)
        a = Math.floor(a * scale)
        b = Math.max(0, room - a)
      }
      return [a, b]
    }
    const [left, right] = fitPair(srcW, expand.left, expand.right, false)
    const [top, bottom] = fitPair(srcH, expand.top, expand.bottom, true)
    return { top, bottom, left, right }
  }

  async function shrinkSubjectForOutpaint(flatDataUrl, w, h) {
    const maxSrcW = 960
    const maxSrcH = 1100
    const scale = Math.min(1, maxSrcW / Math.max(w, 1), maxSrcH / Math.max(h, 1))
    if (scale >= 0.99) return { dataUrl: flatDataUrl, w, h }
    const cw = Math.max(8, Math.round(w * scale))
    const ch = Math.max(8, Math.round(h * scale))
    const img = await loadHtmlImage(flatDataUrl)
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    canvas.getContext('2d').drawImage(img, 0, 0, cw, ch)
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), w: cw, h: ch }
  }

  async function regionLumaStats(src, y0, ySpan) {
    const img = await loadHtmlImage(src)
    const w = img.naturalWidth
    const h = img.naturalHeight
    const sy = Math.floor(h * y0)
    const sh = Math.max(1, Math.floor(h * ySpan))
    const c = document.createElement('canvas')
    c.width = 32
    c.height = 32
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, sy, w, sh, 0, 0, 32, 32)
    const data = ctx.getImageData(0, 0, 32, 32).data
    let sum = 0
    let sum2 = 0
    let n = 0
    for (let i = 0; i < data.length; i += 4) {
      const y = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      sum += y
      sum2 += y * y
      n += 1
    }
    const mean = sum / Math.max(n, 1)
    const variance = sum2 / Math.max(n, 1) - mean * mean
    return { mean, variance }
  }

  /** 투명 픽셀을 검은 화면으로 세지 않음. 프레임 대부분이 실제 검정일 때만 true. */
  async function isSolidBlackPhoto(url) {
    if (!url) return false
    return new Promise((resolve) => {
      const img = new Image()
      if (/^https?:\/\//i.test(url)) img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const w = Math.min(64, img.naturalWidth)
          const h = Math.min(64, img.naturalHeight)
          if (!w || !h) {
            resolve(false)
            return
          }
          const c = document.createElement('canvas')
          c.width = w
          c.height = h
          const ctx = c.getContext('2d')
          ctx.drawImage(img, 0, 0, w, h)
          const { data } = ctx.getImageData(0, 0, w, h)
          let black = 0
          let opaque = 0
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 16) continue
            opaque += 1
            if (data[i] + data[i + 1] + data[i + 2] < 18) black += 1
          }
          const area = w * h
          resolve(opaque > area * 0.6 && black > opaque * 0.92)
        } catch {
          resolve(false)
        }
      }
      img.onerror = () => resolve(false)
      img.src = url
    })
  }
  async function looksLikeEmptyExtend(src, referenceSrc) {
    const band = await regionLumaStats(src, 0.52, 0.36)
    if (band.variance >= 40 && band.mean < 205) return false
    if (referenceSrc) {
      const ref = await regionLumaStats(referenceSrc, 0.52, 0.36)
      return band.variance < 18 && band.mean > 188 && band.variance <= ref.variance + 6
    }
    return band.variance < 22 && band.mean > 198
  }

  function isolatedStillBust(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return true
    const ratio = canvas.height / Math.max(canvas.width, 1)
    return ratio < 1.52 || opaqueRatio(canvas) < 0.04
  }

  function cropNonBackground(canvas) {
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    let minX = w
    let minY = h
    let maxX = 0
    let maxY = 0
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        if (d[(y * w + x) * 4 + 3] < 24) continue
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
    if (maxX <= minX || maxY <= minY) return canvas
    const pad = 8
    const sx = Math.max(0, minX - pad)
    const sy = Math.max(0, minY - pad)
    const sw = Math.min(w - sx, maxX - minX + pad * 2)
    const sh = Math.min(h - sy, maxY - minY + pad * 2)
    const out = document.createElement('canvas')
    out.width = Math.max(8, sw)
    out.height = Math.max(8, sh)
    out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height)
    return out
  }

  function opaqueRatio(canvas) {
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    const d = ctx.getImageData(0, 0, w, h).data
    let n = 0
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] > 24) n += 1
    }
    return n / Math.max(w * h, 1)
  }

  async function isolateOutpaintedPerson(src, remoteUrl, opts) {
    let working = src
    let remote = typeof remoteUrl === 'string' ? remoteUrl : ''
    const localOnly = opts?.localOnly !== false
    if (!localOnly) {
      if (!/^https:\/\//i.test(remote) && /^https:\/\//i.test(src)) remote = src
      if (!/^https:\/\//i.test(remote)) {
        try {
          const uploaded = await uploadDataUrlForSwap(
            src.startsWith('data:') ? src : await ensureStableDataUrl(src),
            '전신 배경제거',
          )
          if (uploaded) remote = uploaded
        } catch (_) {
          /* flood + island fallback */
        }
      }
      if (/^https:\/\//i.test(remote)) {
        const cutUrl = await cutRemoteBackground(remote)
        if (cutUrl) working = cutUrl
      }
    }
    const stable = working.startsWith('data:image/') ? working : await ensureStableDataUrl(working)
    const img = await loadHtmlImage(stable)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const beforeCut = document.createElement('canvas')
    beforeCut.width = canvas.width
    beforeCut.height = canvas.height
    beforeCut.getContext('2d').drawImage(canvas, 0, 0)
    if (!canvasHasTransparency(canvas)) floodKeyStudio(canvas)
    dropStudioIslands(canvas)
    erodeAlpha(canvas, 2)
    dropStudioIslands(canvas)
    defringeCutout(canvas)
    erodeAlpha(canvas, 1)
    let cropped = cropNonBackground(canvas)
    const tiny =
      opaqueRatio(cropped) < 0.03 ||
      cropped.width * cropped.height < canvas.width * canvas.height * 0.05
    if (tiny) cropped = cropNonBackground(beforeCut)
    return cropped
  }

  function erodeAlpha(canvas, radius) {
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    const r = Math.max(1, Math.round(radius || 1))
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const copy = new Uint8ClampedArray(d)
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4
        if (copy[i + 3] < 24) continue
        let kill = false
        for (let dy = -r; dy <= r && !kill; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
              kill = true
              break
            }
            if (copy[(ny * w + nx) * 4 + 3] < 24) {
              kill = true
              break
            }
          }
        }
        if (kill) d[i + 3] = 0
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  /** 배경제거·오려붙이기가 남긴 흰 테두리(헤일로)를 지움. */
  function defringeCutout(canvas) {
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const copy = new Uint8ClampedArray(d)
    const alphaAt = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return 0
      return copy[(y * w + x) * 4 + 3]
    }
    const nextToClear = (x, y) =>
      alphaAt(x - 1, y) < 16 ||
      alphaAt(x + 1, y) < 16 ||
      alphaAt(x, y - 1) < 16 ||
      alphaAt(x, y + 1) < 16
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4
        if (copy[i + 3] < 16 || !nextToClear(x, y)) continue
        const r = copy[i]
        const g = copy[i + 1]
        const b = copy[i + 2]
        const luma = r * 0.299 + g * 0.587 + b * 0.114
        const sat = Math.max(r, g, b) - Math.min(r, g, b)
        let ir = 0
        let ig = 0
        let ib = 0
        let n = 0
        let innerLuma = 0
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            const ni = (ny * w + nx) * 4
            if (copy[ni + 3] < 80 || nextToClear(nx, ny)) continue
            ir += copy[ni]
            ig += copy[ni + 1]
            ib += copy[ni + 2]
            innerLuma += copy[ni] * 0.299 + copy[ni + 1] * 0.587 + copy[ni + 2] * 0.114
            n += 1
          }
        }
        if (n > 0) innerLuma /= n
        const brightFringe = luma > 168 && sat < 42 && (n === 0 || luma > innerLuma + 22)
        if (brightFringe) {
          d[i + 3] = 0
          continue
        }
        if (n > 0) {
          d[i] = Math.round(ir / n)
          d[i + 1] = Math.round(ig / n)
          d[i + 2] = Math.round(ib / n)
        }
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  function canvasLooksDarkBackdrop(canvas) {
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    const pts = [
      [2, 2],
      [w - 3, 2],
      [2, h - 3],
      [w - 3, h - 3],
      [Math.round(w / 2), 2],
    ]
    let dark = 0
    for (const [x, y] of pts) {
      const d = ctx.getImageData(x, y, 1, 1).data
      if (d[3] < 16) return false
      const luma = d[0] * 0.299 + d[1] * 0.587 + d[2] * 0.114
      if (luma < 42) dark += 1
    }
    return dark >= 4
  }

  function suppressWhiteHaloOnDark(canvas) {
    if (!canvasLooksDarkBackdrop(canvas)) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const copy = new Uint8ClampedArray(d)
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const i = (y * w + x) * 4
        const r = copy[i]
        const g = copy[i + 1]
        const b = copy[i + 2]
        const luma = r * 0.299 + g * 0.587 + b * 0.114
        const sat = Math.max(r, g, b) - Math.min(r, g, b)
        if (luma < 176 || sat > 38) continue
        let darkN = 0
        let subR = 0
        let subG = 0
        let subB = 0
        let subN = 0
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!dx && !dy) continue
            const ni = ((y + dy) * w + (x + dx)) * 4
            const nl = copy[ni] * 0.299 + copy[ni + 1] * 0.587 + copy[ni + 2] * 0.114
            const ns = Math.max(copy[ni], copy[ni + 1], copy[ni + 2]) - Math.min(copy[ni], copy[ni + 1], copy[ni + 2])
            if (nl < 48) darkN += 1
            else if (nl < 168 || ns > 28) {
              subR += copy[ni]
              subG += copy[ni + 1]
              subB += copy[ni + 2]
              subN += 1
            }
          }
        }
        if (darkN < 1) continue
        if (subN > 0) {
          d[i] = Math.round(subR / subN)
          d[i + 1] = Math.round(subG / subN)
          d[i + 2] = Math.round(subB / subN)
        } else if (darkN >= 2) {
          d[i] = 8
          d[i + 1] = 8
          d[i + 2] = 8
        }
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  async function cleanResultHalo(src) {
    const stable = src.startsWith('data:image/') ? src : await ensureStableDataUrl(src)
    const img = await loadHtmlImage(stable)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    if (canvasHasTransparency(canvas)) {
      defringeCutout(canvas)
      erodeAlpha(canvas, 1)
    } else {
      suppressWhiteHaloOnDark(canvas)
    }
    return canvasHasTransparency(canvas)
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.94)
  }

  function canvasHasTransparency(canvas) {
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    const d = ctx.getImageData(0, 0, w, h).data
    for (let x = 0; x < w; x += 8) {
      if (d[x * 4 + 3] < 16) return true
      if (d[((h - 1) * w + x) * 4 + 3] < 16) return true
    }
    return false
  }

  function punchIdPhotoBackdrop(canvas) {
    if (!canvas || !canvas.width) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const w = canvas.width
    const h = canvas.height
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const top = Math.round(h * 0.48)
    for (let y = 0; y < top; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4
        if (d[i + 3] < 16) continue
        const nx = x / w
        const inFace = nx > 0.3 && nx < 0.7 && y > h * 0.04 && y < h * 0.4
        const r = d[i]
        const g = d[i + 1]
        const b = d[i + 2]
        const luma = r * 0.299 + g * 0.587 + b * 0.114
        const sat = Math.max(r, g, b) - Math.min(r, g, b)
        const wall = luma > 148 && sat < 36
        if (wall && !inFace) d[i + 3] = 0
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  function subjectLooksLikePhotoCard(canvas) {
    if (!canvas || !canvas.width) return true
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const w = canvas.width
    const h = canvas.height
    const pts = [
      [2, 2],
      [w - 3, 2],
      [2, Math.max(2, Math.round(h * 0.08))],
      [w - 3, Math.max(2, Math.round(h * 0.08))],
    ]
    let opaque = 0
    for (const [x, y] of pts) {
      const p = ctx.getImageData(Math.max(0, x), Math.max(0, y), 1, 1).data
      if (p[3] > 200) opaque += 1
    }
    return opaque >= 3
  }

  async function cutRemoteBackground(imageUrl) {
    try {
      const response = await fetch('/api/remove-background', {
        method: 'POST',
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      })
      const data = await response.json().catch(() => ({}))
      if (data?.ok && data.imageUrl) return data.imageUrl
    } catch (_) {
      /* flood + island fallback */
    }
    return null
  }

  /**
   * 플러드가 못 지운 회색 타원·패널(가장자리와 안 이어진 스튜디오 조각)만 제거.
   * 옷·피부처럼 채도/명암이 있는 덩어리는 남긴다.
   */
  function dropStudioIslands(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const w = canvas.width
    const h = canvas.height
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const seen = new Uint8Array(w * h)
    const q = []
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const start = y * w + x
        if (seen[start] || d[start * 4 + 3] < 24) continue
        q.length = 0
        q.push(x, y)
        seen[start] = 1
        const pixels = []
        let n = 0
        let sumY = 0
        let sumSat = 0
        let colorN = 0
        let qi = 0
        while (qi < q.length) {
          const cx = q[qi]
          const cy = q[qi + 1]
          qi += 2
          const ci = cy * w + cx
          pixels.push(ci)
          const r = d[ci * 4]
          const g = d[ci * 4 + 1]
          const b = d[ci * 4 + 2]
          const luma = r * 0.299 + g * 0.587 + b * 0.114
          const sat = Math.max(r, g, b) - Math.min(r, g, b)
          n += 1
          sumY += luma
          sumSat += sat
          if (sat > 28 || luma < 150) colorN += 1
          const nbr = [cx - 1, cy, cx + 1, cy, cx, cy - 1, cx, cy + 1]
          for (let k = 0; k < nbr.length; k += 2) {
            const nx = nbr[k]
            const ny = nbr[k + 1]
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            const ni = ny * w + nx
            if (seen[ni] || d[ni * 4 + 3] < 24) continue
            seen[ni] = 1
            q.push(nx, ny)
          }
        }
        const colorRatio = colorN / Math.max(n, 1)
        const meanY = sumY / Math.max(n, 1)
        const meanSat = sumSat / Math.max(n, 1)
        const dropSpeck = n < 48
        const dropStudio = colorRatio < 0.07 && meanY > 168 && meanSat < 28
        if (dropSpeck || dropStudio) {
          for (let p = 0; p < pixels.length; p += 1) d[pixels[p] * 4 + 3] = 0
        }
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  /** 전신 결과에서 스튜디오 배경만 가장자리부터 지움. 가운데 타원을 남기면 회색 반원이 남음. */
  function floodKeyStudio(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const w = canvas.width
    const h = canvas.height
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const colorAt = (x, y) => {
      const i = (y * w + x) * 4
      return [d[i], d[i + 1], d[i + 2], d[i + 3]]
    }
    const refs = [
      colorAt(2, 2),
      colorAt(w - 3, 2),
      colorAt(2, h - 3),
      colorAt(w - 3, h - 3),
      colorAt(Math.round(w / 2), 2),
    ]
    const isBg = (r, g, b) => {
      const y = r * 0.299 + g * 0.587 + b * 0.114
      const sat = Math.max(r, g, b) - Math.min(r, g, b)
      if (sat > 16) return false
      if (y > 188 && sat < 14) return true
      for (let s = 0; s < refs.length; s += 1) {
        const refSat =
          Math.max(refs[s][0], refs[s][1], refs[s][2]) - Math.min(refs[s][0], refs[s][1], refs[s][2])
        if (refSat > 18) continue
        if (Math.hypot(r - refs[s][0], g - refs[s][1], b - refs[s][2]) < 22) return true
      }
      return false
    }
    const faceKeep = (x, y) => x > w * 0.28 && x < w * 0.72 && y > h * 0.03 && y < h * 0.24
    const seen = new Uint8Array(w * h)
    const q = []
    const pushIfBg = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return
      const si = y * w + x
      if (seen[si] || faceKeep(x, y)) return
      const [r, g, b, a] = colorAt(x, y)
      if (a < 8) {
        seen[si] = 1
        return
      }
      if (!isBg(r, g, b)) return
      seen[si] = 1
      q.push(x, y)
    }
    for (let x = 0; x < w; x += 1) {
      pushIfBg(x, 0)
      pushIfBg(x, h - 1)
    }
    for (let y = 0; y < h; y += 1) {
      pushIfBg(0, y)
      pushIfBg(w - 1, y)
    }
    let qi = 0
    while (qi < q.length) {
      const x = q[qi]
      const y = q[qi + 1]
      qi += 2
      d[(y * w + x) * 4 + 3] = 0
      pushIfBg(x - 1, y)
      pushIfBg(x + 1, y)
      pushIfBg(x, y - 1)
      pushIfBg(x, y + 1)
    }
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] < 200) d[i] = 0
    }
    ctx.putImageData(img, 0, 0)
  }

  function trimWhiteBoardBottom(canvas) {
    if (!canvas || !canvas.width) return canvas
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const w = canvas.width
    const h = canvas.height
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    let cut = h
    const x0 = Math.round(w * 0.18)
    const x1 = Math.max(x0 + 1, Math.round(w * 0.82))
    const midW = x1 - x0
    for (let y = h - 1; y > Math.round(h * 0.55); y -= 1) {
      let white = 0
      for (let x = x0; x < x1; x += 1) {
        const i = (y * w + x) * 4
        if (d[i + 3] < 16) continue
        if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) white += 1
      }
      if (white / midW > 0.82) cut = y
      else break
    }
    if (cut >= h - 4 || cut <= h * 0.58) return canvas
    const keep = document.createElement('canvas')
    keep.width = w
    keep.height = cut
    keep.getContext('2d').drawImage(canvas, 0, 0, w, cut, 0, 0, w, cut)
    return keep
  }

  /** 얼굴+어깨+가슴만 남기고, 책상·팻말은 자른다. */
  async function cropPhotoToShoulders(dataUrl) {
    const img = await loadHtmlImage(dataUrl)
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    let face = await estimateFaceBoxFromImage(dataUrl)
    if (face && face.h > 0.42) face = { ...face, h: 0.3, y: Math.min(face.y, 0.1) }
    let sx = 0
    let sy = 0
    let sw = iw
    let sh = Math.round(ih * 0.48)
    if (face && face.h >= 0.04) {
      const padX = Math.max(0.16, face.w * 1.05)
      const padTop = face.h * 0.75
      const padBot = face.h * 1.25
      sx = Math.max(0, Math.round((face.x - padX) * iw))
      sy = Math.max(0, Math.round((face.y - padTop) * ih))
      sw = Math.min(iw - sx, Math.round((face.w + padX * 2) * iw))
      sh = Math.min(ih - sy, Math.round((face.h + padTop + padBot) * ih), Math.round(ih * 0.55))
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(8, sw)
    canvas.height = Math.max(8, sh)
    canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    return trimWhiteBoardBottom(canvas).toDataURL('image/jpeg', 0.94)
  }

  function punchBottomLedge(canvas) {
    if (!canvas || !canvas.width) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const w = canvas.width
    const h = canvas.height
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const y0 = Math.round(h * 0.62)
    for (let y = y0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4
        if (d[i + 3] < 16) continue
        const luma = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
        const sat = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])
        if (luma > 176 && sat < 48) d[i + 3] = 0
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  async function cropSubjectOffDesk(subject) {
    if (!subject?.pngDataUrl) return subject
    const img = await loadHtmlImage(subject.pngDataUrl)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    punchBottomLedge(canvas)
    const trimmed = cropNonBackground(canvas)
    punchBottomLedge(trimmed)
    const flat = document.createElement('canvas')
    flat.width = trimmed.width
    flat.height = trimmed.height
    const fctx = flat.getContext('2d')
    fctx.fillStyle = '#f4f4f4'
    fctx.fillRect(0, 0, flat.width, flat.height)
    fctx.drawImage(trimmed, 0, 0)
    return {
      pngDataUrl: trimmed.toDataURL('image/png'),
      flatDataUrl: flat.toDataURL('image/jpeg', 0.92),
      w: trimmed.width,
      h: trimmed.height,
    }
  }

  async function looksLikeHoldingBoard(src) {
    if (!src) return false
    const lower = await regionLumaStats(src, 0.78, 0.18)
    if (lower.variance >= 28) return false
    const img = await loadHtmlImage(src)
    const w = Math.min(80, img.naturalWidth)
    const h = Math.min(120, img.naturalHeight)
    if (!w || !h) return false
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    let run = 0
    let best = 0
    const y0 = Math.round(h * 0.42)
    const y1 = Math.round(h * 0.78)
    for (let y = y0; y < y1; y += 1) {
      const mid0 = Math.round(w * 0.22)
      const mid1 = Math.max(mid0 + 1, Math.round(w * 0.78))
      const midW = mid1 - mid0
      let centerWhite = 0
      for (let x = mid0; x < mid1; x += 1) {
        const i = (y * w + x) * 4
        if (data[i] > 198 && data[i + 1] > 198 && data[i + 2] > 198) centerWhite += 1
      }
      if (centerWhite / midW > 0.78) {
        run += 1
        if (run > best) best = run
      } else run = 0
    }
    return best >= Math.max(4, Math.round(h * 0.06))
  }

  function sampleLayerShirt(layered) {
    const w = layered.width
    const h = layered.height
    const ctx = layered.getContext('2d', { willReadFrequently: true })
    const sw = Math.max(4, Math.round(w * 0.44))
    const sh = Math.max(4, Math.round(h * 0.35))
    const data = ctx.getImageData(Math.round(w * 0.28), Math.round(h * 0.55), sw, sh).data
    let r = 0
    let g = 0
    let b = 0
    let n = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 80) continue
      const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      if (luma > 225 || luma < 28) continue
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      n += 1
    }
    if (n < 12) return [88, 92, 98]
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
  }

  function fadeIdCropSides(lctx, dw, dh, fadeX) {
    const fx = Math.max(8, Math.round(fadeX))
    if (fx < 4 || dw < 24) return
    const img = lctx.getImageData(0, 0, dw, dh)
    const d = img.data
    for (let y = 0; y < dh; y += 1) {
      for (let x = 0; x < fx; x += 1) {
        const t = x / fx
        const a = t * t
        d[(y * dw + x) * 4 + 3] = Math.round(d[(y * dw + x) * 4 + 3] * a)
        const xr = dw - 1 - x
        d[(y * dw + xr) * 4 + 3] = Math.round(d[(y * dw + xr) * 4 + 3] * a)
      }
    }
    lctx.putImageData(img, 0, 0)
  }

  function measureLayerShoulderSpan(lctx, dw, dh, face) {
    const chinY = face ? Math.round((face.y + face.h) * dh) : Math.round(dh * 0.62)
    const y0 = Math.max(0, Math.min(dh - 2, chinY + Math.round((face?.h || 0.25) * dh * 0.28)))
    const y1 = Math.max(y0 + 1, Math.min(dh - 1, chinY + Math.round((face?.h || 0.25) * dh * 0.85)))
    const { data } = lctx.getImageData(0, 0, dw, dh)
    let best = 0
    for (let y = y0; y <= y1; y += 1) {
      let x0 = dw
      let x1 = 0
      for (let x = 0; x < dw; x += 1) {
        const i = (y * dw + x) * 4
        if (data[i + 3] < 40) continue
        const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
        const sat = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2])
        if (luma > 236 && sat < 12) continue
        if (x < x0) x0 = x
        if (x > x1) x1 = x
      }
      if (x1 > x0 + 3) best = Math.max(best, x1 - x0 + 1)
    }
    return best
  }

  function paintSoftStandingHint(ctx, cw, ch, dx, dy, dw, dh, _layered, torsoW, skirt, headW, cloth) {
    const neckY = dy + dh - 6
    const midX = cw / 2
    const bodyW = Math.max(cw * 0.36, Number(torsoW) > 8 ? torsoW : dw * 1.18)
    const neckW = Math.max(dw * 0.5, Number(headW) > 8 ? headW * 1.12 : bodyW * 0.42)
    const feetY = skirt ? ch * 0.82 : ch * 0.91
    const bodyH = Math.max(80, feetY - neckY)
    const chestY = neckY + bodyH * 0.16
    const waistY = neckY + bodyH * 0.36
    const hipY = neckY + bodyH * (skirt ? 0.4 : 0.54)
    const hemY = skirt ? neckY + bodyH * 0.14 : neckY + bodyH * 0.58
    const skirtW = bodyW * 0.3
    const hipW = bodyW * 0.52
    const legW = bodyW * 0.34
    const gap = bodyW * 0.08
    const lightCloth = Boolean(cloth && cloth.luma > 120)
    ctx.save()
    ctx.globalAlpha = lightCloth ? 0.58 : 0.1
    ctx.fillStyle = lightCloth
      ? `rgb(${cloth.r},${cloth.g},${cloth.b})`
      : '#4a5056'
    ctx.beginPath()
    ctx.moveTo(midX - neckW * 0.5, neckY)
    ctx.lineTo(midX + neckW * 0.5, neckY)
    ctx.lineTo(midX + bodyW * 0.5, chestY)
    if (skirt) {
      ctx.lineTo(midX + skirtW * 0.5, hemY)
      ctx.lineTo(midX - skirtW * 0.5, hemY)
    } else {
      ctx.lineTo(midX + bodyW * 0.46, waistY)
      ctx.lineTo(midX + hipW, hipY)
      ctx.lineTo(midX + bodyW * 0.48, hemY)
      ctx.lineTo(midX - bodyW * 0.48, hemY)
      ctx.lineTo(midX - hipW, hipY)
      ctx.lineTo(midX - bodyW * 0.46, waistY)
    }
    ctx.lineTo(midX - bodyW * 0.5, chestY)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(midX - gap / 2 - legW, hemY - 4, legW, feetY - hemY)
    ctx.fillRect(midX + gap / 2, hemY - 4, legW, feetY - hemY)
    const armW = Math.max(10, bodyW * 0.15)
    const handY = neckY + bodyH * 0.52
    ctx.fillRect(Math.round(midX - bodyW * 0.5 - armW * 0.15), Math.round(chestY), Math.round(armW), Math.round(handY - chestY))
    ctx.fillRect(Math.round(midX + bodyW * 0.5 - armW * 0.85), Math.round(chestY), Math.round(armW), Math.round(handY - chestY))
    ctx.globalAlpha = lightCloth ? 0.35 : 0.5
    ctx.fillStyle = lightCloth
      ? `rgb(${Math.max(0, cloth.r - 18)},${Math.max(0, cloth.g - 18)},${Math.max(0, cloth.b - 18)})`
      : '#2c2c2c'
    ctx.fillRect(midX - gap / 2 - legW - 6, feetY - 12, legW + 12, 16)
    ctx.fillRect(midX + gap / 2 - 6, feetY - 12, legW + 12, 16)
    ctx.restore()
  }

  async function buildBodyExtendCanvas(subject, gender) {
    const [cw, ch] = [768, 1152]
    const png = await loadHtmlImage(subject.pngDataUrl)
    const zip = await deskClothRgb(subject.pngDataUrl, 0.78, 0.98, { bright: true }).catch(() => null)
    const cloth =
      zip && zip.hex
        ? zip
        : (await deskClothRgb(subject.pngDataUrl, 0.58, 0.92).catch(() => null))
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    paintSeamlessStudio(ctx, cw, ch, { luma: 40, r: 42, g: 44, b: 48 })
    let face = null
    try {
      face =
        typeof estimateFaceBoxFromImage === 'function'
          ? await estimateFaceBoxFromImage(subject.pngDataUrl)
          : null
    } catch (_) {
      face = null
    }
    const faceH = face && face.h > 0.06 ? face.h : 0
    const chin = face ? face.y + face.h : 1
    const lacksShoulders = faceH >= 0.22 || (face && face.w >= 0.3) || chin >= 0.62
    const scale = lacksShoulders
      ? Math.min((ch * 0.36) / Math.max(png.naturalHeight, 1), (cw * 0.7) / Math.max(png.naturalWidth, 1))
      : Math.min(
          (ch * 0.42) / Math.max(png.naturalHeight, 1),
          (cw * 0.52) / Math.max(png.naturalWidth, 1),
        )
    const dw = Math.round(png.naturalWidth * scale)
    const dh = Math.round(png.naturalHeight * scale)
    const dx = Math.round((cw - dw) / 2)
    const dy = Math.round(ch * 0.04)
    const layered = document.createElement('canvas')
    layered.width = dw
    layered.height = dh
    const lctx = layered.getContext('2d', { willReadFrequently: true })
    lctx.drawImage(png, 0, 0, dw, dh)
    const chinY = face ? Math.round(chin * dh) : Math.round(dh * 0.7)
    const fadeTop = lacksShoulders
      ? Math.min(dh - 8, Math.max(Math.round(dh * 0.78), chinY + Math.round((face?.h || 0.3) * dh * 0.9)))
      : dh - Math.max(16, Math.round(dh * 0.12))
    const fadeH = Math.max(8, dh - fadeTop)
    const fade = lctx.getImageData(0, fadeTop, dw, fadeH)
    for (let y = 0; y < fadeH; y += 1) {
      const t = y / Math.max(fadeH - 1, 1)
      const a = 1 - t * t
      for (let x = 0; x < dw; x += 1) {
        const i = (y * dw + x) * 4 + 3
        fade.data[i] = Math.round(fade.data[i] * a)
      }
    }
    lctx.putImageData(fade, 0, fadeTop)
    const headW = face ? Math.max(24, face.w * png.naturalWidth * scale) : dw * 0.55
    const isMan = gender === 'male' || gender === 'man'
    const targetShoulder = headW * (isMan ? 2.75 : 2.65)
    const seenShoulder = measureLayerShoulderSpan(lctx, dw, dh, face)
    const idCroppedShoulders = Boolean(
      lacksShoulders || seenShoulder < targetShoulder * 0.92 || dw < targetShoulder * 1.04,
    )
    if (idCroppedShoulders) fadeIdCropSides(lctx, dw, dh, Math.max(dw * 0.14, (targetShoulder - seenShoulder) * 0.45))
    const hintTorsoW = idCroppedShoulders
      ? Math.max(cw * 0.4, targetShoulder)
      : Math.max(dw * 1.18, targetShoulder)
    paintSoftStandingHint(ctx, cw, ch, dx, dy, dw, dh, layered, hintTorsoW, false, headW, {
      luma: 40,
      r: 42,
      g: 44,
      b: 48,
    })
    ctx.drawImage(layered, dx, dy)
    return {
      image: canvas.toDataURL('image/jpeg', 0.92),
      subjectLayer: layered.toDataURL('image/png'),
      cw,
      ch,
      dx,
      dy,
      dw,
      dh,
    }
  }

  async function sourceHasKeepableTorso(dataUrl) {
    if (!dataUrl) return false
    const face =
      typeof estimateFaceBoxFromImage === 'function'
        ? await estimateFaceBoxFromImage(dataUrl, { scanTop: 0.55, centerOnly: true })
        : null
    if (!face) return false
    const tightId = face.h >= 0.4 && face.y + face.h >= 0.7
    return !tightId
  }

  function samplePhotoBottomRgb(img) {
    const tw = Math.min(64, img.naturalWidth)
    const th = Math.min(8, img.naturalHeight)
    const c = document.createElement('canvas')
    c.width = tw
    c.height = th
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, img.naturalHeight - th, img.naturalWidth, th, 0, 0, tw, th)
    const { data } = ctx.getImageData(0, 0, tw, th)
    let r = 0
    let g = 0
    let b = 0
    let n = 0
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      n += 1
    }
    if (!n) return [220, 220, 220]
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
  }

  async function buildBodyContinueCanvas(src, size, opts) {
    const [cw, ch] = Array.isArray(size) ? size : [768, 1152]
    const img = await loadHtmlImage(src)
    const iw = Math.max(1, img.naturalWidth)
    const ih = Math.max(1, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    const [br, bg, bb] = samplePhotoBottomRgb(img)
    // 사진 크기: 기본은 캔버스 높이의 62%. 가슴 위 클로즈업이면 머리가 거대해지므로, 머리(머리카락 포함)가
    // 키의 약 14.5% 가 되도록 사진을 줄여 놓는다. 나머지 몸과 장면은 모델이 이어 그린다.
    const maxPhotoH = Math.round(ch * 0.62)
    let scale = Math.min(cw / iw, maxPhotoH / ih)
    const faceH = Number(opts?.faceH)
    if (faceH > 0.05) {
      const headFrac = Math.min(0.9, faceH * 1.35)
      const headTarget = Number(opts?.headTarget) > 0 ? Number(opts.headTarget) : 0.18
      scale = Math.min(scale, (headTarget * ch) / headFrac / ih)
    }
    const dw = Math.max(8, Math.round(iw * scale))
    const dh = Math.max(8, Math.round(ih * scale))
    const dx = Math.round((cw - dw) / 2)
    const dy = faceH > 0.05 ? Math.round(ch * 0.02) : 0
    // 빈 곳은 사진 가장자리를 늘려 채운다 (모델이 채워야 할 곳으로 인식하는 신호)
    const fill = document.createElement('canvas')
    fill.width = cw
    fill.height = ch
    const fctx = fill.getContext('2d')
    fctx.fillStyle = `rgb(${br},${bg},${bb})`
    fctx.fillRect(0, 0, cw, ch)
    if (dx > 2) {
      fctx.drawImage(img, 0, 0, 4, ih, 0, dy, dx + 2, dh)
      fctx.drawImage(img, iw - 4, 0, 4, ih, dx + dw - 2, dy, cw - dx - dw + 2, dh)
    }
    if (dy > 2) fctx.drawImage(img, 0, 0, iw, 4, dx, 0, dw, dy + 2)
    if (dy + dh < ch) fctx.drawImage(img, 0, ih - 6, iw, 6, 0, dy + dh - 2, cw, ch - dy - dh + 2)
    // 번지게 하면 모델이 '이미 완성된 흐릿한 배경'으로 보고 몸을 그리지 않는다(mw184 실측: unpainted). 늘려 채운 줄무늬를 그대로 둔다
    ctx.drawImage(fill, 0, 0)
    ctx.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh)
    // 보호 마스크: 검정 = 원본 화소를 그대로 둔다. 사진 거의 전체(90%)를 지키고 가장자리는 부드럽게
    const mask = document.createElement('canvas')
    mask.width = cw
    mask.height = ch
    const mctx = mask.getContext('2d')
    mctx.fillStyle = '#fff'
    mctx.fillRect(0, 0, cw, ch)
    const keepH = Math.max(8, Math.round(dh * 0.9))
    const blend = Math.max(16, Math.round(dh * 0.1))
    mctx.fillStyle = '#000'
    mctx.fillRect(dx, dy, dw, keepH)
    const fade = mctx.getImageData(dx, dy + keepH, dw, Math.max(1, Math.min(blend, ch - dy - keepH)))
    for (let y = 0; y < fade.height; y += 1) {
      const t = y / Math.max(fade.height - 1, 1)
      const v = Math.round(255 * t)
      for (let x = 0; x < dw; x += 1) {
        const i = (y * dw + x) * 4
        fade.data[i] = v
        fade.data[i + 1] = v
        fade.data[i + 2] = v
        fade.data[i + 3] = 255
      }
    }
    mctx.putImageData(fade, dx, dy + keepH)
    // 좌우·위 가장자리를 부드럽게 (복원할 때 경계선이 보이지 않게). 사진이 작을수록 더 넓게 번지게 한다
    const soft = document.createElement('canvas')
    soft.width = cw
    soft.height = ch
    const sctx = soft.getContext('2d')
    sctx.filter = `blur(${Math.max(5, Math.round(dw * 0.03))}px)`
    sctx.drawImage(mask, 0, 0)
    return {
      image: canvas.toDataURL('image/jpeg', 0.92),
      mask: soft.toDataURL('image/png'),
      continue: true,
      extendStyle: 'continue',
      cw,
      ch,
      dx,
      dy,
      dw,
      dh,
    }
  }

  /**
   * 이어 그린 결과 안에서 원본 사진이 놓인 위치·크기를 겹쳐 맞춰 찾은 뒤, 그 자리에 원본 화소를 그대로 복원한다.
   * (모델이 사진을 조금 다른 크기·위치로 다시 그려도 얼굴이 이중으로 보이지 않게 한다)
   * 못 찾으면(일치도 0.75 미만) url 을 비워 돌려준다. 가짜 얼굴로 대신하지 않기 위해 호출한 쪽이 실패로 처리한다.
   */
  async function restoreOriginalPhotoOnContinued(resultUrl, prepared, sourceUrl) {
    const log = {}
    try {
      const [out, src] = await Promise.all([loadHtmlImage(resultUrl), loadHtmlImage(sourceUrl)])
      const rw = out.naturalWidth
      const rh = out.naturalHeight
      const kx = rw / prepared.cw
      const ky = rh / prepared.ch
      const x0 = prepared.dx * kx
      const y0 = prepared.dy * ky
      const w0 = prepared.dw * kx
      const h0 = prepared.dh * ky
      const grayOf = (img, w, h) => {
        const c = document.createElement('canvas')
        c.width = Math.max(2, w)
        c.height = Math.max(2, h)
        const x = c.getContext('2d', { willReadFrequently: true })
        x.imageSmoothingQuality = 'high'
        x.drawImage(img, 0, 0, c.width, c.height)
        const d = x.getImageData(0, 0, c.width, c.height).data
        const g = new Float32Array(c.width * c.height)
        for (let i = 0; i < g.length; i += 1) g[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114
        return { g, w: c.width, h: c.height }
      }
      const ncc = (T, G, ox, oy, stride) => {
        let st = 0
        let sg = 0
        let st2 = 0
        let sg2 = 0
        let stg = 0
        let n = 0
        for (let y = 0; y < T.h; y += stride) {
          const gy = oy + y
          if (gy < 0 || gy >= G.h) return -2
          for (let x = 0; x < T.w; x += stride) {
            const gx = ox + x
            if (gx < 0 || gx >= G.w) return -2
            const t = T.g[y * T.w + x]
            const g = G.g[gy * G.w + gx]
            st += t
            sg += g
            st2 += t * t
            sg2 += g * g
            stg += t * g
            n += 1
          }
        }
        const vt = st2 - (st * st) / n
        const vg = sg2 - (sg * sg) / n
        return (stg - (st * sg) / n) / Math.sqrt(Math.max(1e-6, vt) * Math.max(1e-6, vg))
      }
      const D = 2
      const G1 = grayOf(out, Math.round(rw / D), Math.round(rh / D))
      let best = { score: -2, s: 1, ox: 0, oy: 0 }
      for (const s of [0.4, 0.48, 0.56, 0.64, 0.72, 0.8, 0.88, 0.94, 1, 1.07, 1.15, 1.25, 1.36, 1.5, 1.7]) {
        const T = grayOf(src, Math.round((w0 * s) / D), Math.round((h0 * s) / D))
        const baseX = Math.round((x0 + w0 / 2) / D - T.w / 2)
        const baseY = Math.round(y0 / D)
        for (let oy = -50; oy <= 50; oy += 3) {
          for (let ox = -50; ox <= 50; ox += 3) {
            const sc = ncc(T, G1, baseX + ox, baseY + oy, 2)
            if (sc > best.score) best = { score: sc, s, ox: baseX + ox, oy: baseY + oy }
          }
        }
      }
      log.coarse = Number(best.score.toFixed(3))
      log.scale = best.s
      if (best.score < 0.6) {
        log.skip = 'no_match'
        return { url: '', log }
      }
      // 전 해상도에서 다듬기
      const G2 = grayOf(out, rw, rh)
      let fine = { score: -2, s: best.s, ox: best.ox * D, oy: best.oy * D }
      for (const m of [0.97, 1, 1.03]) {
        const s = best.s * m
        const T = grayOf(src, Math.round(w0 * s), Math.round(h0 * s))
        for (let oy = -6; oy <= 6; oy += 1) {
          for (let ox = -6; ox <= 6; ox += 1) {
            const sc = ncc(T, G2, best.ox * D + ox, best.oy * D + oy, 3)
            if (sc > fine.score) fine = { score: sc, s, ox: best.ox * D + ox, oy: best.oy * D + oy, tw: T.w, th: T.h }
          }
        }
      }
      log.score = Number(fine.score.toFixed(3))
      log.final = { s: Number(fine.s.toFixed(3)), x: fine.ox, y: fine.oy }
      if (fine.score < 0.75) {
        log.skip = 'low_match'
        return { url: '', log }
      }
      const px = fine.ox
      const py = fine.oy
      const pw = fine.tw
      const ph = fine.th
      const layer = document.createElement('canvas')
      layer.width = rw
      layer.height = rh
      const lctx = layer.getContext('2d')
      lctx.imageSmoothingQuality = 'high'
      lctx.drawImage(src, px, py, pw, ph)
      const feather = Math.max(6, Math.round(pw * 0.03))
      const mk = document.createElement('canvas')
      mk.width = rw
      mk.height = rh
      const mctx = mk.getContext('2d')
      mctx.filter = `blur(${feather}px)`
      mctx.fillStyle = '#fff'
      mctx.fillRect(px + feather, py + feather, pw - feather * 2, Math.round(ph * 0.9) - feather)
      lctx.globalCompositeOperation = 'destination-in'
      lctx.drawImage(mk, 0, 0)
      const res = document.createElement('canvas')
      res.width = rw
      res.height = rh
      const rctx = res.getContext('2d')
      rctx.drawImage(out, 0, 0, rw, rh)
      rctx.drawImage(layer, 0, 0)
      return { url: res.toDataURL('image/jpeg', 0.92), log }
    } catch (err) {
      log.skip = 'err'
      log.message = err instanceof Error ? err.message : String(err)
      return { url: '', log }
    }
  }

  async function restoreProtectedExtendPixels(resultUrl, prepared) {
    if (!resultUrl || !prepared?.image || !prepared?.mask) return resultUrl
    const [out, src, mask] = await Promise.all([
      loadHtmlImage(resultUrl),
      loadHtmlImage(prepared.image),
      loadHtmlImage(prepared.mask),
    ])
    const w = out.naturalWidth
    const h = out.naturalHeight
    if (!w || !h) return resultUrl
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(out, 0, 0, w, h)
    const srcC = document.createElement('canvas')
    srcC.width = w
    srcC.height = h
    srcC.getContext('2d').drawImage(src, 0, 0, w, h)
    const maskC = document.createElement('canvas')
    maskC.width = w
    maskC.height = h
    maskC.getContext('2d').drawImage(mask, 0, 0, w, h)
    const outData = ctx.getImageData(0, 0, w, h)
    const srcData = srcC.getContext('2d').getImageData(0, 0, w, h)
    const maskData = maskC.getContext('2d').getImageData(0, 0, w, h)
    const od = outData.data
    const sd = srcData.data
    const md = maskData.data
    for (let i = 0; i < od.length; i += 4) {
      // 검정(0)=원본을 그대로, 흰색(255)=생성 결과. 가장자리는 값만큼 섞는다
      const keep = 1 - md[i] / 255
      if (keep <= 0.002) continue
      od[i] = od[i] * (1 - keep) + sd[i] * keep
      od[i + 1] = od[i + 1] * (1 - keep) + sd[i + 1] * keep
      od[i + 2] = od[i + 2] * (1 - keep) + sd[i + 2] * keep
    }
    ctx.putImageData(outData, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.92)
  }

  function genderHeightFactor(gender) {
    const g = (gender || '').trim().toLowerCase()
    if (g === 'male' || g === 'man') return 0.9
    if (g === 'female' || g === 'woman') return 0.8
    return 0.85
  }

  function poseSlotXs(pose, count) {
    if (count !== 2) return count === 1 ? [0.5] : null
    if (pose === 'arm') return [0.42, 0.56]
    if (pose === 'hug-light' || pose === 'hug-front' || pose === 'hug') return [0.43, 0.55]
    if (pose === 'backhug') return [0.49, 0.53]
    return [0.3, 0.7]
  }

  function isMaleGender(gender) {
    return /^(male|man)$/i.test(String(gender || '').trim())
  }

  function isFemaleGender(gender) {
    return /^(female|woman)$/i.test(String(gender || '').trim())
  }

  function orderCoupleBodies(bodies, pose) {
    if (!bodies || bodies.length < 2 || !pose || pose === 'side') return bodies
    const woman = bodies.find((b) => isFemaleGender(b.gender))
    const man = bodies.find((b) => isMaleGender(b.gender))
    if (woman && man) return [woman, man]
    return bodies
  }

  async function flattenPngOnStudio(dataUrl, color) {
    const img = await loadHtmlImage(dataUrl)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = color || '#c8c8c8'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.92)
  }

  function buildPoseContactMask(cw, ch, placed, pose) {
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, cw, ch)
    if (!placed || placed.length < 2) return canvas.toDataURL('image/png')
    const woman = placed[0]
    const man = placed[1]
    ctx.fillStyle = '#ffffff'
    const y0 = Math.min(woman.dy + woman.dh * (pose === 'backhug' ? 0.28 : 0.34), man.dy + man.dh * 0.32)
    const y1 = Math.min(woman.dy + woman.dh * 0.78, man.dy + man.dh * 0.78)
    ctx.beginPath()
    ctx.ellipse(
      (woman.dx + woman.dw * 0.72 + man.dx + man.dw * 0.22) / 2,
      (y0 + y1) / 2,
      Math.max(36, (man.dx + man.dw * 0.55 - woman.dx - woman.dw * 0.2) / 2),
      Math.max(28, (y1 - y0) / 2),
      0,
      0,
      Math.PI * 2,
    )
    ctx.fill()
    if (pose === 'arm' || pose === 'hug-light' || pose === 'hug-front' || pose === 'hug') {
      ctx.fillRect(
        Math.round(man.dx - man.dw * 0.06),
        Math.round(man.dy + man.dh * 0.28),
        Math.round(man.dw * 0.62),
        Math.round(man.dh * 0.5),
      )
    }
    return canvas.toDataURL('image/png')
  }

  /** ④ 이어그린 몸통들을 투명 PNG로 나란히 배치. 배경은 그리지 않음. */
  async function compositeBodiesSideBySide(bodySrcs, aspectRatio, pose) {
    const isolated = []
    const genders = []
    for (const item of bodySrcs) {
      if (item && item.isolated) {
        isolated.push(item.isolated)
      } else {
        const src = typeof item === 'string' ? item : item.display
        const remote = typeof item === 'string' ? '' : item.remoteUrl
        isolated.push(await isolateOutpaintedPerson(src, remote))
      }
      genders.push(typeof item === 'string' ? '' : item.gender || '')
    }
    const [cw, ch] = sceneCanvasSize(aspectRatio)
    const out = document.createElement('canvas')
    out.width = cw
    out.height = ch
    const ctx = out.getContext('2d')
    ctx.clearRect(0, 0, cw, ch)
    const count = isolated.length
    const slots =
      poseSlotXs(pose, count) || isolated.map((_, i) => (i + 1) / (count + 1))
    const pairMaxW =
      pose === 'arm' || pose === 'hug-light' || pose === 'hug-front' || pose === 'hug' || pose === 'backhug'
        ? cw * 0.34
        : cw * 0.3
    const factors = isolated.map((_, i) => genderHeightFactor(genders[i]))
    const maxF = Math.max(...factors, 0.01)
    const maxW = count === 1 ? cw * 0.58 : pairMaxW
    const placed = []
    for (let i = 0; i < isolated.length; i += 1) {
      const src = isolated[i]
      const targetH = ch * 0.86 * (factors[i] / maxF)
      let scale = targetH / Math.max(src.height, 1)
      scale = Math.min(scale, maxW / Math.max(src.width, 1))
      try {
        const face = await detectFaceBox(src.toDataURL('image/png'), 'target')
        if (face && face.h > 0.04 && face.h < 0.55) {
          const facePx = face.h * src.height
          const wantFace = ch * 0.122
          const faceScale = wantFace / Math.max(facePx, 1)
          scale = Math.min(scale, faceScale, maxW / Math.max(src.width, 1), (ch * 0.9) / Math.max(src.height, 1))
        }
      } catch (_) {
        /* keep height scale */
      }
      const dw = Math.round(src.width * scale)
      const dh = Math.round(src.height * scale)
      const dx = Math.round(cw * slots[i] - dw / 2)
      const dy = Math.round(ch - dh - ch * 0.035)
      placed.push({ src, dx, dy, dw, dh })
    }
    const drawOrder =
      pose === 'backhug' && placed.length >= 2
        ? [placed[1], placed[0]]
        : placed.slice().sort((a, b) => a.dh - b.dh)
    for (const p of drawOrder) {
      ctx.drawImage(p.src, p.dx, p.dy, p.dw, p.dh)
    }
    defringeCutout(out)
    return { composite: out.toDataURL('image/png'), placed, cw, ch }
  }

  /**
   * ④ 투명 얼굴 PNG만 몸통 얼굴에 맞춤. 증명사진 카드는 쓰지 않음.
   */
  async function pasteFacePngOnCrop(targetCropDataUrl, faceAsset, opts = {}) {
    const [targetImg, pngImg, targetFace] = await Promise.all([
      loadHtmlImage(targetCropDataUrl),
      loadHtmlImage(faceAsset.pngDataUrl),
      detectFaceBox(targetCropDataUrl, 'target'),
    ])
    const tw = targetImg.naturalWidth
    const th = targetImg.naturalHeight
    const pw = pngImg.naturalWidth
    const ph = pngImg.naturalHeight
    const tBoxW = targetFace.w * tw
    const tBoxH = targetFace.h * th
    let rotation = 0
    let anchorTx = (targetFace.x + targetFace.w / 2) * tw
    let anchorTy = (targetFace.y + targetFace.h * 0.42) * th
    let scale = tBoxH / Math.max(ph * 0.78, 1)
    const hasEyes =
      targetFace.leftEye &&
      targetFace.rightEye &&
      faceAsset.leftEye &&
      faceAsset.rightEye
    if (hasEyes) {
      const tLx = targetFace.leftEye.x * tw
      const tLy = targetFace.leftEye.y * th
      const tRx = targetFace.rightEye.x * tw
      const tRy = targetFace.rightEye.y * th
      const sLx = faceAsset.leftEye.x * pw
      const sLy = faceAsset.leftEye.y * ph
      const sRx = faceAsset.rightEye.x * pw
      const sRy = faceAsset.rightEye.y * ph
      const tDist = Math.hypot(tRx - tLx, tRy - tLy) || 1
      const sDist = Math.hypot(sRx - sLx, sRy - sLy) || 1
      scale = (tDist / sDist) * 1.04
      const tAng = Math.atan2(tRy - tLy, tRx - tLx)
      const sAng = Math.atan2(sRy - sLy, sRx - sLx)
      rotation = tAng - sAng
      if (Math.abs(rotation) > Math.PI / 4) rotation = 0
      anchorTx = (tLx + tRx) / 2
      anchorTy = (tLy + tRy) / 2
    }
    const maxFaceH = typeof opts.maxFaceH === 'number' ? opts.maxFaceH : th * 0.22
    if (ph * scale > maxFaceH) scale = maxFaceH / ph
    if (ph * scale < th * 0.08) scale = (th * 0.08) / ph
    const dw = Math.round(pw * scale)
    const dh = Math.round(ph * scale)
    let srcEyeX = pw / 2
    let srcEyeY = ph * 0.42
    if (hasEyes) {
      srcEyeX = ((faceAsset.leftEye.x + faceAsset.rightEye.x) / 2) * pw
      srcEyeY = ((faceAsset.leftEye.y + faceAsset.rightEye.y) / 2) * ph
    }

    const out = document.createElement('canvas')
    out.width = tw
    out.height = th
    const ctx = out.getContext('2d')
    ctx.drawImage(targetImg, 0, 0, tw, th)

    const eraseRx = Math.max(tBoxW * 0.52, dw * 0.4)
    const eraseRy = Math.max(tBoxH * 0.68, dh * 0.48)
    const sampleR = Math.round(Math.min(eraseRx, eraseRy) * 0.14) || 4
    let sr = 0
    let sg = 0
    let sb = 0
    let sn = 0
    const ringPts = [
      [anchorTx, anchorTy + eraseRy * 0.92],
      [anchorTx - eraseRx * 0.68, anchorTy + eraseRy * 0.5],
      [anchorTx + eraseRx * 0.68, anchorTy + eraseRy * 0.5],
    ]
    const tmp = ctx.getImageData(0, 0, tw, th)
    for (const [px, py] of ringPts) {
      const x0 = Math.max(0, Math.min(tw - 1, Math.round(px)))
      const y0 = Math.max(0, Math.min(th - 1, Math.round(py)))
      for (let dy = -sampleR; dy <= sampleR; dy += 2) {
        for (let dx = -sampleR; dx <= sampleR; dx += 2) {
          const x = Math.max(0, Math.min(tw - 1, x0 + dx))
          const y = Math.max(0, Math.min(th - 1, y0 + dy))
          const o = (y * tw + x) * 4
          sr += tmp.data[o]
          sg += tmp.data[o + 1]
          sb += tmp.data[o + 2]
          sn += 1
        }
      }
    }
    if (sn > 0 && !opts.skipEraseFill) {
      const avgR = sr / sn
      const avgG = sg / sn
      const avgB = sb / sn
      const luma = avgR * 0.299 + avgG * 0.587 + avgB * 0.114
      const sat = Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB)
      if (!(luma > 168 && sat < 38)) {
        ctx.save()
        ctx.translate(anchorTx, anchorTy)
        ctx.rotate(rotation)
        ctx.fillStyle = `rgb(${Math.round(avgR)},${Math.round(avgG)},${Math.round(avgB)})`
        ctx.beginPath()
        ctx.ellipse(0, eraseRy * 0.04, eraseRx, eraseRy, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    const layer = document.createElement('canvas')
    layer.width = tw
    layer.height = th
    const lctx = layer.getContext('2d')
    lctx.save()
    lctx.translate(anchorTx, anchorTy)
    lctx.rotate(rotation)
    lctx.drawImage(pngImg, -srcEyeX * scale, -srcEyeY * scale, dw, dh)
    lctx.restore()

    const mask = document.createElement('canvas')
    mask.width = tw
    mask.height = th
    const mctx = mask.getContext('2d')
    const rx = Math.max(dw, tBoxW) * 0.52
    const ry = Math.max(dh, tBoxH) * 0.64
    const grad = mctx.createRadialGradient(
      anchorTx,
      anchorTy + ry * 0.06,
      Math.min(rx, ry) * 0.48,
      anchorTx,
      anchorTy + ry * 0.06,
      Math.max(rx, ry),
    )
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(0.64, 'rgba(0,0,0,1)')
    grad.addColorStop(0.84, 'rgba(0,0,0,0.5)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    mctx.fillStyle = grad
    mctx.beginPath()
    mctx.ellipse(anchorTx, anchorTy + ry * 0.04, rx, ry, rotation, 0, Math.PI * 2)
    mctx.fill()

    lctx.globalCompositeOperation = 'destination-in'
    lctx.drawImage(mask, 0, 0)
    lctx.globalCompositeOperation = 'source-over'
    try {
      tintLayerTowardTarget(layer, out, mask)
    } catch (_) {
      /* ignore */
    }
    ctx.drawImage(layer, 0, 0)
    return out.toDataURL('image/jpeg', 0.95)
  }

  /** 좌·우 반쪽 폭 (겹침 포함). 너무 작으면 얼굴이 잘리고, 너무 크면 이음새가 얼굴 중앙을 가른다. */
  function sideCutWidth(fullW) {
    return Math.max(8, Math.round(fullW * 0.58))
  }

  /** 원본을 좌/우 반으로 잘라 1명만 남김 */
  async function cropTargetSide(imageSrc, side) {
    const display = imageSrc.startsWith('data:') || imageSrc.startsWith('blob:')
      ? imageSrc
      : await toDisplayUrl(imageSrc)
    if (!display) throw new Error('crop_source_unavailable')
    const img = await loadHtmlImage(display)
    const w = img.naturalWidth
    const h = img.naturalHeight
    const cut = sideCutWidth(w)
    const sx = side === 'right' ? Math.max(0, w - cut) : 0
    const canvas = document.createElement('canvas')
    canvas.width = cut
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, sx, 0, cut, h, 0, 0, cut, h)
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.82), cut, fullW: w, fullH: h }
  }

  /**
   * 교체된 반쪽을 전체에 붙임 — 겹침 구간은 가로 알파 페더로 세로 이음새(얼굴 중앙 금)를 없앤다.
   */
  async function pasteSideOntoFull(fullSrc, swappedSrc, side) {
    const fullDisplay =
      fullSrc.startsWith('data:') || fullSrc.startsWith('blob:') ? fullSrc : await toDisplayUrl(fullSrc)
    const swappedDisplay =
      swappedSrc.startsWith('data:') || swappedSrc.startsWith('blob:')
        ? swappedSrc
        : await toDisplayUrl(swappedSrc)
    if (!fullDisplay || !swappedDisplay) throw new Error('stitch_source_unavailable')
    const base = await loadHtmlImage(fullDisplay)
    const piece = await loadHtmlImage(swappedDisplay)
    const w = base.naturalWidth
    const h = base.naturalHeight
    const cut = sideCutWidth(w)
    const dx = side === 'right' ? Math.max(0, w - cut) : 0
    const feather = Math.max(24, Math.round(w * 0.1))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(base, 0, 0, w, h)

    const layer = document.createElement('canvas')
    layer.width = w
    layer.height = h
    const lctx = layer.getContext('2d')
    lctx.drawImage(piece, dx, 0, cut, h)

    // 가로 페더 마스크: left는 오른쪽 끝을 투명하게, right는 왼쪽 끝을 투명하게
    const mask = document.createElement('canvas')
    mask.width = w
    mask.height = h
    const mctx = mask.getContext('2d')
    if (side === 'left') {
      mctx.fillStyle = '#000'
      mctx.fillRect(0, 0, Math.max(0, cut - feather), h)
      const grad = mctx.createLinearGradient(cut - feather, 0, cut, 0)
      grad.addColorStop(0, 'rgba(0,0,0,1)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      mctx.fillStyle = grad
      mctx.fillRect(cut - feather, 0, feather, h)
    } else {
      const grad = mctx.createLinearGradient(dx, 0, dx + feather, 0)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, 'rgba(0,0,0,1)')
      mctx.fillStyle = grad
      mctx.fillRect(dx, 0, feather, h)
      mctx.fillStyle = '#000'
      mctx.fillRect(dx + feather, 0, Math.max(0, cut - feather), h)
    }

    lctx.globalCompositeOperation = 'destination-in'
    lctx.drawImage(mask, 0, 0)
    lctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(layer, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.95)
  }

  /** 간단 피부톤 맞춤 — 붙여 넣은 얼굴 평균색을 원본 얼굴 쪽으로 살짝 당김 */
  function tintLayerTowardTarget(layerCanvas, targetCanvas, maskCanvas) {
    const w = layerCanvas.width
    const h = layerCanvas.height
    const lctx = layerCanvas.getContext('2d')
    const tctx = targetCanvas.getContext('2d')
    const mctx = maskCanvas.getContext('2d')
    const layer = lctx.getImageData(0, 0, w, h)
    const target = tctx.getImageData(0, 0, w, h)
    const mask = mctx.getImageData(0, 0, w, h)
    let lr = 0
    let lg = 0
    let lb = 0
    let tr = 0
    let tg = 0
    let tb = 0
    let n = 0
    for (let i = 0; i < mask.data.length; i += 4) {
      if (mask.data[i + 3] < 180) continue
      lr += layer.data[i]
      lg += layer.data[i + 1]
      lb += layer.data[i + 2]
      tr += target.data[i]
      tg += target.data[i + 1]
      tb += target.data[i + 2]
      n += 1
    }
    if (n < 40) return
    lr /= n
    lg /= n
    lb /= n
    tr /= n
    tg /= n
    tb /= n
    // 완전 색맞춤은 증명사진 정체성을 죽임 — 35%만
    const k = 0.35
    const dr = 1 + ((tr - lr) / Math.max(lr, 1)) * k
    const dg = 1 + ((tg - lg) / Math.max(lg, 1)) * k
    const db = 1 + ((tb - lb) / Math.max(lb, 1)) * k
    for (let i = 0; i < layer.data.length; i += 4) {
      const a = mask.data[i + 3]
      if (a < 8) continue
      layer.data[i] = Math.min(255, Math.max(0, layer.data[i] * dr))
      layer.data[i + 1] = Math.min(255, Math.max(0, layer.data[i + 1] * dg))
      layer.data[i + 2] = Math.min(255, Math.max(0, layer.data[i + 2] * db))
    }
    lctx.putImageData(layer, 0, 0)
  }

  /**
   * 「얼굴 바꾸기」탭: 얼굴 PNG 추출 후 같은 붙이기 경로를 씀.
   */
  async function hardReplaceFaceOnCrop(targetCropDataUrl, idFaceDataUrl) {
    const facePng = await extractIdFacePng(idFaceDataUrl)
    return pasteFacePngOnCrop(targetCropDataUrl, facePng)
  }

  /**
   * 증명사진 → 완전 교체 (픽셀 덮어쓰기). InsightFace/Easel 합성 미사용.
   */
  async function runIdPhotoBySlots(faces) {
    let currentTarget = state.target
    for (let i = 0; i < faces.list.length; i += 1) {
      const item = faces.list[i]
      const side = indexToSide(item.slot)
      setStatus(
        `${i + 1}/${faces.list.length} · 칸${item.slot + 1} 증명사진 → ${sideLabel(side)} 완전 교체(덮어쓰기)…`,
        false,
      )
      let crop
      try {
        crop = await cropTargetSide(currentTarget, side)
      } catch (err) {
        setStatus(
          `원본 ${sideLabel(side)}을 자르지 못했어요: ${err instanceof Error ? err.message : String(err)}`,
          true,
        )
        return null
      }
      try {
        setStatus(`${sideLabel(side)} 얼굴 위치 찾는 중…`, false)
        const replaced = await hardReplaceFaceOnCrop(crop.dataUrl, item.dataUrl)
        currentTarget = await pasteSideOntoFull(currentTarget, replaced, side)
      } catch (err) {
        setStatus(`완전 교체 실패: ${err instanceof Error ? err.message : String(err)}`, true)
        return null
      }
    }
    return currentTarget
  }

  async function pollFaceSwapStatus(job, startedAt) {
    // job: { statusUrl, responseUrl, predictionId, baseImageUrl, engine }
    const HARD_LIMIT_SEC =
      typeof job.hardLimitSec === 'number'
        ? job.hardLimitSec
        : job.engine === 'easel'
          ? 90
          : 180
    const QUEUE_STUCK_SEC =
      typeof job.queueStuckSec === 'number'
        ? job.queueStuckSec
        : job.engine === 'easel'
          ? 45
          : 50
    const engTag = engineLabel(job.engine)
    let consecutiveNetFails = 0
    let lastFalStatus = ''
    let queueSince = Date.now()
    let lastQueueStatus = ''
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000)
      if (elapsedSec >= HARD_LIMIT_SEC) {
        setStatus(
          `${engTag}: ${HARD_LIMIT_SEC}초가 지나도 결과가 없어요. (마지막 큐: ${lastFalStatus || '없음'})`,
          true,
        )
        logFs('poll_timeout', { elapsedSec, lastFalStatus, attempt, engine: job.engine })
        return { __failed: true, error: 'poll_timeout', message: '시간 초과', falStatus: lastFalStatus }
      }
      // IN_PROGRESS는 이미 처리 중 — 큐 정체 타이머 대상이 아님.
      // (예전 status API가 pending을 항상 WAITING으로 줘서 처리 중에도 끊기던 사고)
      const upperFal = String(lastFalStatus || '').toUpperCase()
      const queueWaiting =
        upperFal === 'IN_QUEUE' || upperFal === 'WAITING' || upperFal === 'IN_QUEUE_WAITING'
      if (upperFal === 'IN_PROGRESS' || upperFal === 'COMPLETED') {
        queueSince = Date.now()
      }
      if (queueWaiting && Math.round((Date.now() - queueSince) / 1000) >= QUEUE_STUCK_SEC) {
        logFs('queue_stuck', { elapsedSec, QUEUE_STUCK_SEC, engine: job.engine, lastFalStatus })
        return {
          __failed: true,
          error: 'queue_stuck',
          message: `${engTag} 대기열이 ${QUEUE_STUCK_SEC}초 이상이에요. 다른 방식으로 바꿉니다.`,
          falStatus: lastFalStatus,
        }
      }
      const queueLabel = lastFalStatus ? ` · 큐 ${lastFalStatus}` : ''
      setStatus(
        elapsedSec > 40
          ? `${engTag} 교체 중… ${elapsedSec}초 / 한도 ${HARD_LIMIT_SEC}초${queueLabel}`
          : `${engTag} 교체 중… ${elapsedSec}초${queueLabel}`,
        false,
      )
      await sleep(attempt < 6 ? 1500 : 2500)
      let response
      try {
        const controller = new AbortController()
        const timer = window.setTimeout(() => controller.abort(), 25000)
        const body = {
          engine: job.engine,
          baseImageUrl: job.baseImageUrl || undefined,
        }
        if (job.predictionId) body.predictionId = job.predictionId
        else {
          body.statusUrl = job.statusUrl
          body.responseUrl = job.responseUrl
        }
        response = await fetch('/api/face-swap-status', {
          method: 'POST',
          headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        window.clearTimeout(timer)
        consecutiveNetFails = 0
      } catch (err) {
        consecutiveNetFails += 1
        logFs('poll_network_error', {
          attempt,
          consecutiveNetFails,
          message: err instanceof Error ? err.message : String(err),
        })
        if (consecutiveNetFails >= 8) {
          setStatus('상태 조회가 반복 실패했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.', true)
          return null
        }
        setStatus(`상태 조회 재시도 중… (${consecutiveNetFails}/8)`, false)
        continue
      }
      const data = await response.json().catch(() => ({}))
      if (typeof data.falStatus === 'string' && data.falStatus) {
        if (data.falStatus !== lastQueueStatus) {
          lastQueueStatus = data.falStatus
          queueSince = Date.now()
        }
        lastFalStatus = data.falStatus
      }
      logFs('poll', {
        attempt,
        elapsedSec,
        http: response.status,
        status: data.status,
        falStatus: data.falStatus,
        hasImage: Boolean(data.imageUrl),
        engine: job.engine,
        error: data.error,
      })
      if (response.status === 401) {
        if (typeof clearAllAuth === 'function') clearAllAuth()
        if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
        return null
      }
      if (data.status === 'succeeded' && data.imageUrl) {
        logFs('poll_succeeded', { elapsedSec, falStatus: data.falStatus, engine: job.engine })
        return data.imageUrl
      }
      if (data.status === 'failed') {
        setStatus(data.message || `얼굴 교체 실패: ${data.error || 'unknown'}`, true)
        return { __failed: true, error: data.error, message: data.message }
      }
    }
    setStatus('시간이 지나도 결과가 없어요. 다시 시도해 주세요.', true)
    return { __failed: true, error: 'poll_timeout', message: '시간 초과' }
  }

  async function compressToJpegDataUrl(src, maxEdge = 1280, quality = 0.82) {
    const img = await loadHtmlImage(src)
    const w0 = img.naturalWidth || 1
    const h0 = img.naturalHeight || 1
    const scale = Math.min(1, maxEdge / Math.max(w0, h0))
    const w = Math.max(1, Math.round(w0 * scale))
    const h = Math.max(1, Math.round(h0 * scale))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d').drawImage(img, 0, 0, w, h)
    return c.toDataURL('image/jpeg', quality)
  }

  async function fetchRemoteAsDataUrl(imageUrl) {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 90000)
    try {
      const res = await fetch('/api/media-proxy', {
        method: 'POST',
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
        signal: controller.signal,
      })
      const ctype = (res.headers.get('content-type') || '').toLowerCase()
      if (!res.ok || !ctype.startsWith('image/')) {
        throw new Error('결과를 불러오지 못했어요')
      }
      const blob = await res.blob()
      if (!blob || blob.size < 64) throw new Error('결과를 불러오지 못했어요')
      return await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('결과를 불러오지 못했어요'))
        reader.readAsDataURL(blob)
      })
    } finally {
      window.clearTimeout(timer)
    }
  }

  /** toDisplayUrl은 blob을 하나뿐 들고 있어서, 다음 미리보기를 받으면 이전 blob을 폐기한다. */
  async function ensureStableDataUrl(src) {
    if (!src) return src
    if (src.startsWith('data:image/')) return src
    if (/^https?:\/\//i.test(src)) return fetchRemoteAsDataUrl(src)
    const display = src.startsWith('blob:') ? src : (await toDisplayUrl(src)) || src
    return compressToJpegDataUrl(display, 1536, 0.9)
  }

  async function uploadDataUrlForSwap(src, label) {
    if (!src) return null
    if (/^https?:\/\//i.test(src)) return src
    setStatus(`${label} 업로드 중…`, false)
    const display =
      src.startsWith('data:') || src.startsWith('blob:') ? src : await toDisplayUrl(src)
    if (!display) throw new Error('upload_source_unavailable')
    const dataUrl = await compressToJpegDataUrl(display, 1024, 0.8)
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 20000)
    let response
    try {
      response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
        signal: controller.signal,
      })
    } catch (err) {
      throw new Error(controller.signal.aborted ? 'upload_timeout' : err instanceof Error ? err.message : 'upload_failed')
    } finally {
      window.clearTimeout(timer)
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.ok || !data.imageUrl) {
      throw new Error(data.message || data.error || `upload_failed_${response.status}`)
    }
    return data.imageUrl
  }

  async function submitFaceSwapOnce(options) {
    const { engine, targetSide, targetImage, face0, gender0, face1, gender1, workflowType } = options
    let targetUrl
    let face0Url
    let face1Url
    try {
      ;[targetUrl, face0Url, face1Url] = await Promise.all([
        uploadDataUrlForSwap(targetImage, '원본'),
        uploadDataUrlForSwap(face0, '증명사진'),
        face1 ? uploadDataUrlForSwap(face1, '증명사진2') : Promise.resolve(null),
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!options.quiet) {
        setStatus(
          /fetch|network|Failed/i.test(msg)
            ? '업로드 중 연결이 끊겼어요. 사진을 줄이거나 잠시 후 다시 시도해 주세요.'
            : `업로드 실패: ${msg}`,
          true,
        )
      }
      return {
        response: { status: 0 },
        data: { ok: false, error: 'upload_failed', message: msg },
      }
    }

    const payload = {
      targetImage: targetUrl,
      face0: face0Url,
      gender0: gender0 || 'female',
      workflowType: workflowType || workflowSelect?.value || 'target_hair',
      upscale:
        typeof options.upscale === 'boolean'
          ? options.upscale
          : upscaleCheckbox
            ? Boolean(upscaleCheckbox.checked)
            : true,
      engine,
      targetSide,
    }
    if (face1Url) {
      payload.face1 = face1Url
      payload.gender1 = gender1 || 'male'
    }
    logFs('submit_start', {
      engine,
      targetSide,
      hasFace1: Boolean(face1Url),
      gender0: payload.gender0,
      targetKind: 'url',
    })
    setStatus(`${engineLabel(engine)} · ${sideLabel(targetSide)} 등록 중…`, false)
    try {
      const response = await fetch('/api/face-swap', {
        method: 'POST',
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      logFs('submit_response', {
        http: response.status,
        ok: data.ok,
        pending: data.pending,
        engine: data.engine,
        hasImage: Boolean(data.imageUrl),
        error: data.error,
      })
      return { response, data }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatus(
        /Failed to fetch|NetworkError|network/i.test(msg)
          ? '서버 연결이 끊겼어요(요청이 크거나 일시 장애). 새로고침 후 다시 시도해 주세요.'
          : `오류: ${msg}`,
        true,
      )
      return {
        response: { status: 0 },
        data: { ok: false, error: 'fetch_failed', message: msg },
      }
    }
  }

  async function runOneJob(options) {
    const { response, data } = await submitFaceSwapOnce(options)
    if (response.status === 401) {
      if (typeof clearAllAuth === 'function') clearAllAuth()
      if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
      return null
    }
    if (response.status === 429) {
      if (!options.quiet) setStatus(data.message || '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.', true)
      return null
    }
    if (!data.ok) {
      if (!options.quiet) setStatus(data.message || `얼굴 교체 실패: ${data.error || response.status}`, true)
      return { __failed: true, error: data.error, message: data.message }
    }
    if (data.imageUrl) return data.imageUrl
    if (data.pending) {
      const polled = await pollFaceSwapStatus(
        {
          statusUrl: data.statusUrl,
          responseUrl: data.responseUrl,
          predictionId: data.predictionId,
          baseImageUrl: data.baseImageUrl,
          engine: data.engine || options.engine,
          hardLimitSec: options.hardLimitSec,
          queueStuckSec: options.queueStuckSec,
        },
        Date.now(),
      )
      return polled
    }
    if (!options.quiet) setStatus(data.message || '얼굴 교체 실패', true)
    return { __failed: true, error: 'unknown', message: data.message }
  }

  /** 슬롯 번호(0/1) = 원본 좌/우. InsightFace로 반쪽만 교체 후 다시 붙임.
   * 생성형(Flux) 검열이 없고, 성인 장면 원본에서도 얼굴만 기하적으로 바꿈.
   * 중요: 양쪽 모두 *같은 원본*에서 잘라 교체한 뒤 페더로 합성한다.
   * (한쪽을 붙인 뒤 그 결과에서 다시 자르면 세로 이음새가 얼굴 중앙을 가른다.) */
  async function runInsightBySlots(faces) {
    const originalTarget = state.target
    const parts = []
    for (let i = 0; i < faces.list.length; i += 1) {
      const item = faces.list[i]
      const side = indexToSide(item.slot)
      setStatus(
        `${i + 1}/${faces.list.length} · 칸${item.slot + 1}→${sideLabel(side)} InsightFace 교체 중…`,
        false,
      )
      let crop
      try {
        crop = await cropTargetSide(originalTarget, side)
      } catch (err) {
        setStatus(
          `원본 ${sideLabel(side)}을 자르지 못했어요: ${err instanceof Error ? err.message : String(err)}`,
          true,
        )
        return null
      }
      const imageUrl = await runOneJob({
        engine: 'insight',
        targetSide: 'gender',
        targetImage: crop.dataUrl,
        face0: item.dataUrl,
        gender0: item.gender,
      })
      if (!imageUrl || (typeof imageUrl === 'object' && imageUrl.__failed)) {
        if (imageUrl && imageUrl.message) setStatus(imageUrl.message, true)
        return null
      }
      parts.push({ side, imageUrl })
    }

    let currentTarget = originalTarget
    // 왼쪽 먼저 → 오른쪽 (페더로 겹침). 순서를 바꾸면 이음새 방향만 다를 뿐.
    const ordered = parts.slice().sort((a, b) => {
      if (a.side === b.side) return 0
      return a.side === 'left' ? -1 : 1
    })
    for (const part of ordered) {
      try {
        setStatus(`${sideLabel(part.side)} 이음새 없이 붙이는 중…`, false)
        currentTarget = await pasteSideOntoFull(currentTarget, part.imageUrl, part.side)
      } catch (err) {
        setStatus(`반쪽 붙이기 실패: ${err instanceof Error ? err.message : String(err)}`, true)
        return null
      }
    }
    return currentTarget
  }

  /** 장면이 증명사진을 좌우로 붙인 덤프인지(키스 미생성) 대략 감지 */
  async function looksLikeIdPhotoDump(sceneSrc, face0, face1) {
    async function grayThumb(src, x0, y0, x1, y1) {
      const display =
        src.startsWith('data:') || src.startsWith('blob:') ? src : await toDisplayUrl(src)
      if (!display) return null
      const img = await loadHtmlImage(display)
      const w = img.naturalWidth
      const h = img.naturalHeight
      const sx = Math.floor(w * x0)
      const sy = Math.floor(h * y0)
      const sw = Math.max(1, Math.floor(w * (x1 - x0)))
      const sh = Math.max(1, Math.floor(h * (y1 - y0)))
      const c = document.createElement('canvas')
      c.width = 24
      c.height = 24
      const ctx = c.getContext('2d')
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 24, 24)
      const data = ctx.getImageData(0, 0, 24, 24).data
      const out = new Float32Array(24 * 24)
      for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
        out[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      }
      return out
    }
    function mse(a, b) {
      if (!a || !b || a.length !== b.length) return 1e9
      let s = 0
      for (let i = 0; i < a.length; i += 1) {
        const d = a[i] - b[i]
        s += d * d
      }
      return s / a.length
    }
    try {
      const left = await grayThumb(sceneSrc, 0, 0, 0.5, 1)
      const right = await grayThumb(sceneSrc, 0.5, 0, 1, 1)
      const f0 = await grayThumb(face0, 0, 0, 1, 1)
      if (!left || !right || !f0) return ''
      const thr = 2200
      if (mse(left, f0) < thr && mse(right, f0) < thr) return 'dup_face0'
      if (face1) {
        const f1 = await grayThumb(face1, 0, 0, 1, 1)
        if (f1 && mse(left, f0) < thr && mse(right, f1) < thr) return 'side_by_side_refs'
        if (f1 && mse(left, f1) < thr && mse(right, f0) < thr) return 'side_by_side_refs'
      }
      // 위·아래 스택 콜라주 (나란히 전신 실패 전형)
      const top = await grayThumb(sceneSrc, 0, 0, 1, 0.5)
      const bot = await grayThumb(sceneSrc, 0, 0.5, 1, 1)
      if (top && bot && face1) {
        const f1 = await grayThumb(face1, 0, 0, 1, 1)
        if (f1 && mse(top, f1) < thr && mse(bot, f0) < thr) return 'stacked_refs'
        if (f1 && mse(top, f0) < thr && mse(bot, f1) < thr) return 'stacked_refs'
      }
      if (top && bot && mse(top, f0) < thr && mse(bot, f0) < thr) return 'dup_face0'
    } catch (err) {
      console.warn('[faceswap] id-dump check failed', err)
    }
    return ''
  }

  /** 슬롯 번호(0/1) = 원본 좌/우. 레거시 인덱스 경로(폴백용). */
  async function runIndexedBySlots(faces) {
    let currentTarget = state.target
    for (let i = 0; i < faces.list.length; i += 1) {
      const item = faces.list[i]
      const side = indexToSide(item.slot)
      setStatus(
        `${i + 1}/${faces.list.length} · 칸${item.slot + 1}→${sideLabel(side)} 교체 중…`,
        false,
      )
      const imageUrl = await runOneJob({
        engine: 'indexed',
        targetSide: side,
        targetImage: currentTarget,
        face0: item.dataUrl,
        gender0: item.gender,
      })
      if (!imageUrl || (typeof imageUrl === 'object' && imageUrl.__failed)) {
        if (imageUrl && imageUrl.message) setStatus(imageUrl.message, true)
        return null
      }
      currentTarget = imageUrl
    }
    return currentTarget
  }

  /** Kontext Multi — 머리·헤어 통째. 검은 화면이면 null (호출측이 Insight로 폴백). */
  async function runKontextHeadBySlots(faces) {
    const originalTarget = state.target
    const parts = []
    for (let i = 0; i < faces.list.length; i += 1) {
      const item = faces.list[i]
      const side = indexToSide(item.slot)
      setStatus(
        `${i + 1}/${faces.list.length} · 칸${item.slot + 1}→${sideLabel(side)} Kontext 머리 통째…`,
        false,
      )
      let crop
      try {
        crop = await cropTargetSide(originalTarget, side)
      } catch (err) {
        setStatus(
          `원본 ${sideLabel(side)}을 자르지 못했어요: ${err instanceof Error ? err.message : String(err)}`,
          true,
        )
        return null
      }
      const imageUrl = await runOneJob({
        engine: 'kontext',
        targetSide: 'gender',
        targetImage: crop.dataUrl,
        face0: item.dataUrl,
        gender0: item.gender,
      })
      if (!imageUrl || (typeof imageUrl === 'object' && imageUrl.__failed)) return null
      if (await isBadSwapResult(imageUrl)) {
        logFs('kontext_black', { side })
        return null
      }
      parts.push({ side, imageUrl })
    }
    let currentTarget = originalTarget
    const ordered = parts.slice().sort((a, b) => {
      if (a.side === b.side) return 0
      return a.side === 'left' ? -1 : 1
    })
    for (const part of ordered) {
      try {
        setStatus(`${sideLabel(part.side)} 이음새 없이 붙이는 중…`, false)
        currentTarget = await pasteSideOntoFull(currentTarget, part.imageUrl, part.side)
      } catch (err) {
        setStatus(`반쪽 붙이기 실패: ${err instanceof Error ? err.message : String(err)}`, true)
        return null
      }
    }
    if (await isBadSwapResult(currentTarget)) return null
    return currentTarget
  }

  async function resolveDisplayUrl(url) {
    if (!url) return null
    if (url.startsWith('data:') || url.startsWith('blob:')) return url
    return (await toDisplayUrl(url)) || url
  }

  async function isBadSwapResult(url) {
    const display = await resolveDisplayUrl(url)
    if (!display) return true
    return isNearlyBlackImage(display)
  }

  async function runFaceSwapJob(faces) {
    let targetSide = targetSideSelect?.value || 'all'
    if (!['gender', 'left', 'right', 'all', 'hard', 'kontext'].includes(targetSide)) {
      targetSide = 'all'
    }

    const sameGender = faces.count === 2 && faces.gender0 === faces.gender1
    const onlyForSide =
      targetSide === 'left' || targetSide === 'right'
        ? (() => {
            const filtered = faces.list.filter((f) => indexToSide(f.slot) === targetSide).slice(0, 1)
            if (filtered.length) return { list: filtered, count: 1 }
            return {
              list: [
                {
                  dataUrl: faces.face0,
                  gender: faces.gender0,
                  slot: targetSide === 'right' ? 1 : 0,
                },
              ],
              count: 1,
            }
          })()
        : faces

    if (targetSide === 'kontext') {
      const k = await runKontextHeadBySlots(faces)
      if (k) return k
      setStatus('머리 통째 엔진이 비웠어요 → 안정 모드(InsightFace 얼굴만)로…', false)
      return await runInsightBySlots(faces)
    }

    if (faces.count === 2 && targetSide === 'gender') {
      if (sameGender) {
        setStatus('성별이 같아요. InsightFace로 진행해요…', false)
        return await runInsightBySlots(faces)
      }
      if (workflowSelect) workflowSelect.value = 'user_hair'
      const imageUrl = await runOneJob({
        engine: 'easel',
        targetSide: 'gender',
        targetImage: state.target,
        face0: faces.face0,
        gender0: faces.gender0,
        face1: faces.face1,
        gender1: faces.gender1,
      })
      if (imageUrl && typeof imageUrl !== 'object' && !(await isBadSwapResult(imageUrl))) {
        return imageUrl
      }
      setStatus('Easel 실패/검은 화면 → InsightFace로…', false)
      return await runInsightBySlots(faces)
    }

    if (targetSide === 'gender' && faces.count === 1) {
      return await runInsightBySlots(faces)
    }

    if (targetSide === 'hard') {
      return await runIdPhotoBySlots(faces)
    }

    let result = await runInsightBySlots(onlyForSide)
    if (result && !(await isBadSwapResult(result))) return result
    setStatus('InsightFace 실패 → 인덱스 교체 재시도…', false)
    result = await runIndexedBySlots(onlyForSide)
    if (result && !(await isBadSwapResult(result))) return result
    setStatus('교체에 실패했어요. 사진만 바꿔 다시 시도해 주세요.', true)
    return null
  }

  runBtn.addEventListener('click', async () => {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      if (typeof showPinGate === 'function') showPinGate('로그인이 필요해요.')
      return
    }
    if (!state.target) {
      setStatus('원본 이미지를 넣어 주세요.', true)
      return
    }
    const faces = resolveFaceSlots()
    if (!faces) {
      setStatus('증명사진을 1~2장 넣어 주세요. (안 쓰는 칸은 「사용 안 함」)', true)
      return
    }
    const side = targetSideSelect?.value || 'all'
    runBtn.disabled = true
    if (resultImg) resultImg.hidden = true
    if (resultActions) resultActions.hidden = true
    if (resultPlaceholder) resultPlaceholder.hidden = false
    try {
      setStatus(
        faces.count === 2 ? '2명 · 좌·우 교체 중…' : `${sideLabel(side)} 얼굴 교체 중…`,
        false,
      )
      const imageUrl = await runFaceSwapJob(faces)
      if (!imageUrl) return
      if (await isBadSwapResult(imageUrl)) {
        setStatus(
          '결과가 검은 화면이에요. 엔진이 비운 거라 「안정 · InsightFace」로 다시 실행해 주세요.',
          true,
        )
        return
      }
      const shown = await displayResult(imageUrl)
      if (!shown) return
      setStatus('완성! 아래 결과와 메인 「생성 결과」를 확인하세요.', false)
    } catch (error) {
      setStatus(`오류: ${error instanceof Error ? error.message : String(error)}`, true)
    } finally {
      runBtn.disabled = false
    }
  })

  resultAsTargetBtn?.addEventListener('click', () => {
    const url =
      lastRemoteUrl && (lastRemoteUrl.startsWith('http') || lastRemoteUrl.startsWith('data:'))
        ? lastRemoteUrl
        : null
    if (!url) {
      setStatus('원본으로 넣을 주소가 없어요. 다운로드 후 원본 칸에 다시 올려 주세요.', true)
      return
    }
    state.target = url
    setSlotPreview(targetSlot, url)
    setMode('swap')
    setStatus('결과를 원본으로 넣었어요. 새 증명사진으로 다시 바꿀 수 있어요.', false)
  })

  document.getElementById('fs-result-to-pose')?.addEventListener('click', async () => {
    const src = resultImg?.src || lastRemoteUrl
    if (!src) {
      setStatus('아직 결과 이미지가 없어요.', true)
      return
    }
    try {
      const dataUrl = src.startsWith('data:') ? src : await ensureStableDataUrl(src)
      if (!dataUrl) {
        setStatus('포즈 칸에 넣을 이미지를 만들지 못했어요.', true)
        return
      }
      const emptyFirst = !sceneState.pose0
      const key = emptyFirst ? 'pose0' : 'pose1'
      sceneState[key] = dataUrl
      setSlotPreview(document.getElementById(emptyFirst ? 'fs-scene-pose0-slot' : 'fs-scene-pose1-slot'), dataUrl)
      if (!emptyFirst) {
        const g = document.getElementById('fs-scene-pose-gender1')
        if (g && g.value === 'none') g.value = 'male'
      }
      setMode('pose')
      setStatus(emptyFirst ? '결과를 포즈 사진 1에 넣었어요.' : '결과를 포즈 사진 2에 넣었어요.', false)
    } catch (error) {
      setStatus(`포즈 칸에 넣지 못했어요: ${error instanceof Error ? error.message : String(error)}`, true)
    }
  })

  resultToMainBtn?.addEventListener('click', () => {
    const url = resultImg?.src || lastRemoteUrl
    if (!url) {
      setStatus('아직 결과 이미지가 없어요.', true)
      return
    }
    if (typeof setAppArea === 'function') setAppArea('admin')
    setAdminPanel('fashion')
    showResult(url, '얼굴·장면 결과', false, {
      size: sizeField.value,
      itemId: null,
      prompt: '얼굴·장면 결과',
      accepted: false,
      mood: moodField.value,
      engine: 'face-swap',
      genMode: 'fashion',
      reviseRound: 0,
    })
    if (lastRemoteUrl && typeof currentResult !== 'undefined' && currentResult) {
      currentResult.imageUrl = lastRemoteUrl
    }
    if (typeof ensureCurrentResultInGallery === 'function') {
      ensureCurrentResultInGallery()
    }
    setFormStatus(
      '이 결과를 화보로 올렸습니다. 소지함에도 넣었습니다. 위 「쇼츠」에서 다음 컷을 만들 수 있습니다.',
      false,
    )
    setStatus('화보로 올렸어요. 위 「쇼츠」에서 다음 컷을 만드세요.', false)
  })

  // ── 얼굴로 장면 / 전신·반신으로 장면 (Kontext + 한글 요청) ──
  const sceneState = {
    face0: null,
    face1: null,
    pose0: null,
    pose1: null,
    body0: null,
    body1: null,
  }

  async function assignSceneFile(key, slotEl, file) {
    if (!file || !String(file.type || '').startsWith('image/')) {
      setStatus('이미지 파일만 넣을 수 있어요 (PNG/JPEG/WEBP).', true)
      return
    }
    try {
      const dataUrl = await prepareImageDataUrl(file, 1800)
      sceneState[key] = dataUrl
      setSlotPreview(slotEl, dataUrl)
      // 얼굴2/인물2를 넣으면 「사용 안 함」이면 자동으로 성별 켬 (안 그러면 무시되어 남자 얼굴이 안 맞음)
      if (key === 'face1') {
        const g = document.getElementById('fs-scene-gender1')
        if (g && g.value === 'none') g.value = 'male'
      }
      if (key === 'body1') {
        const g = document.getElementById('fs-scene-body-gender1')
        if (g && g.value === 'none') g.value = 'male'
      }
      if (key === 'pose1') {
        const g = document.getElementById('fs-scene-pose-gender1')
        if (g && g.value === 'none') g.value = 'male'
      }
      setStatus(
        key === 'face1' || key === 'body1' || key === 'pose1'
          ? '사진 2를 넣었어요. 성별이 「남성」으로 켜졌습니다. 다르면 바꿔 주세요.'
          : '',
        false,
      )
    } catch (error) {
      setStatus(`사진을 불러오지 못했어요: ${error instanceof Error ? error.message : String(error)}`, true)
    }
  }

  function bindSceneSlot(key, slotId, inputId, clearId) {
    const slotEl = document.getElementById(slotId)
    const inputEl = document.getElementById(inputId)
    const clearBtn = document.getElementById(clearId)
    if (!slotEl || !inputEl) return
    slotEl.addEventListener('click', () => inputEl.click())
    slotEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        inputEl.click()
      }
    })
    inputEl.addEventListener('change', () => {
      const file = inputEl.files?.[0]
      if (file) void assignSceneFile(key, slotEl, file)
      inputEl.value = ''
    })
    slotEl.addEventListener('dragover', (event) => {
      event.preventDefault()
      slotEl.classList.add('admin-fuse-slot--drag')
    })
    slotEl.addEventListener('dragleave', () => slotEl.classList.remove('admin-fuse-slot--drag'))
    slotEl.addEventListener('drop', (event) => {
      event.preventDefault()
      slotEl.classList.remove('admin-fuse-slot--drag')
      const file = pickImageFileFromDataTransfer(event.dataTransfer)
      if (file) void assignSceneFile(key, slotEl, file)
    })
    slotEl.addEventListener('paste', (event) => {
      const file = pickImageFileFromDataTransfer(event.clipboardData)
      if (file) {
        event.preventDefault()
        void assignSceneFile(key, slotEl, file)
      }
    })
    clearBtn?.addEventListener('click', () => {
      sceneState[key] = null
      setSlotPreview(slotEl, null)
    })
  }

  bindSceneSlot('face0', 'fs-scene-face0-slot', 'fs-scene-face0-input', 'fs-scene-face0-clear')
  bindSceneSlot('face1', 'fs-scene-face1-slot', 'fs-scene-face1-input', 'fs-scene-face1-clear')
  bindSceneSlot('pose0', 'fs-scene-pose0-slot', 'fs-scene-pose0-input', 'fs-scene-pose0-clear')
  bindSceneSlot('pose1', 'fs-scene-pose1-slot', 'fs-scene-pose1-input', 'fs-scene-pose1-clear')
  bindSceneSlot('body0', 'fs-scene-body0-slot', 'fs-scene-body0-input', 'fs-scene-body0-clear')
  bindSceneSlot('body1', 'fs-scene-body1-slot', 'fs-scene-body1-input', 'fs-scene-body1-clear')

  // ── 얼굴로 장면: 나란히만. 팔 감기·포옹은 얼굴·옷 고정과 동시에 못 함 ──
  const SCENE_FACE_ACTIONS = [
    { id: 'side', label: '나란히', action: '두 사람이 가까이 나란히 서 있는' },
  ]
  const FACE_SCENE_CONTACT_MSG =
    '이어그리기는 나란히 전신만 됩니다. 팔 감기·포옹은 포즈 엔진에서 따로 굴립니다.'
  const sceneFaceCombo = { actionId: null }

  function isFaceSceneAdultRequest(text) {
    const t = String(text || '')
    if (
      /나체|누드|전라|섹스|삽입|성교|성행위|유두|젖꼭지|보지|음부|외음|자지|페니스|음경|nude|naked|topless|intercourse|penetrat|pussy|penis|vaginal/i.test(
        t,
      )
    ) {
      return true
    }
    return /가슴|젖|유방|breast/i.test(t) && /주무르|만지|애무|fondl|grope|cup/i.test(t)
  }

  function resolveScenePoseId(actionId, description) {
    if (actionId === 'side') return 'side'
    const t = description || ''
    if (/백\s*허그|뒤에서\s*(?:안|껴안)/.test(t)) return 'backhug'
    if (/정면/.test(t) && /허그|포옹/.test(t)) return 'hug-front'
    if (/가볍/.test(t) && /포옹|허그/.test(t)) return 'hug-light'
    if (/팔\s*감|팔\s*짱|허리에\s*팔|어깨에\s*팔/.test(t)) return 'arm'
    if (/포옹|허그|\bhug\b/i.test(t)) return 'hug-light'
    return actionId || 'side'
  }

  function isFaceSceneContactPose(pose) {
    return pose === 'arm' || pose === 'hug-light' || pose === 'hug-front' || pose === 'hug' || pose === 'backhug'
  }

  function composeSceneFacePrompt() {
    const action = SCENE_FACE_ACTIONS.find((a) => a.id === sceneFaceCombo.actionId)
    if (!action) return ''
    return `${action.action} 전신 사진, 실사`
  }

  function syncSceneFaceComboToDesc() {
    const descEl = document.getElementById('fs-scene-face-desc')
    if (!descEl) return
    const text = composeSceneFacePrompt()
    if (!text) return
    let rest = (descEl.value || '').trim()
    for (const item of SCENE_FACE_ACTIONS) {
      const line = `${item.action} 전신 사진, 실사`
      if (rest === line) {
        rest = ''
        break
      }
      if (rest.startsWith(`${line}\n`)) rest = rest.slice(line.length).trim()
    }
    descEl.value = rest ? `${text}\n${rest}` : text
    descEl.focus()
    const actionLabel = SCENE_FACE_ACTIONS.find((a) => a.id === sceneFaceCombo.actionId)?.label
    setStatus(
      actionLabel ? `${actionLabel}. 성별·사진을 확인한 뒤 실행하세요.` : '장면 요청을 넣었어요.',
      false,
    )
  }

  function renderSceneFaceComboChips() {
    const actionBox = document.getElementById('fs-scene-face-actions')
    if (!actionBox) return
    actionBox.innerHTML = ''
    for (const item of SCENE_FACE_ACTIONS) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'motion-preset-chip'
      chip.classList.toggle('is-selected', sceneFaceCombo.actionId === item.id)
      chip.setAttribute('aria-pressed', sceneFaceCombo.actionId === item.id ? 'true' : 'false')
      const label = document.createElement('span')
      label.className = 'motion-preset-chip__text'
      label.textContent = item.label
      chip.appendChild(label)
      chip.addEventListener('click', () => {
        sceneFaceCombo.actionId = sceneFaceCombo.actionId === item.id ? null : item.id
        renderSceneFaceComboChips()
        syncSceneFaceComboToDesc()
      })
      actionBox.appendChild(chip)
    }
  }

  renderSceneFaceComboChips()

  const POSE_DRAW_ACTIONS = [
    { id: 'otbeotgim', label: '옷벗김', action: '옷벗김, 겉옷·상의·하의 다음 브라·팬티를 남긴 뒤 속옷까지 제거해 같은 체형 나체', couple: false },
    { id: 'nude', label: '나체', action: '성인 나체로 서 있는', couple: false },
    { id: 'arm', label: '나체 팔 감기', action: '나체로 남자가 여자 허리에 팔을 감고 서 있는', couple: true },
    { id: 'hug', label: '나체 포옹', action: '나체로 포옹하는', couple: true },
    { id: 'backhug', label: '나체 백허그', action: '나체로 뒤에서 안는 백허그', couple: true },
    { id: 'kiss', label: '나체 키스', action: '나체로 키스하는', couple: true },
    { id: 'sex-stand', label: '서서 성행위', action: '서서 성관계하는', couple: true },
    { id: 'cowgirl', label: '기승위 (시험)', action: '기승위, 누운 남자 위에 여자가 앉은', couple: true },
  ]
  const poseDrawCombo = { actionId: null }

  function composePoseDrawPrompt() {
    const action = POSE_DRAW_ACTIONS.find((a) => a.id === poseDrawCombo.actionId)
    if (!action) return ''
    return `${action.action} 전신 사진, 실사`
  }

  function syncPoseDrawComboToDesc() {
    const descEl = document.getElementById('fs-scene-pose-desc')
    if (!descEl) return
    const text = composePoseDrawPrompt()
    if (!text) return
    let rest = (descEl.value || '').trim()
    for (const item of POSE_DRAW_ACTIONS) {
      const line = `${item.action} 전신 사진, 실사`
      if (rest === line) {
        rest = ''
        break
      }
      if (rest.startsWith(`${line}\n`)) rest = rest.slice(line.length).trim()
    }
    descEl.value = rest ? `${text}\n${rest}` : text
    const action = POSE_DRAW_ACTIONS.find((a) => a.id === poseDrawCombo.actionId)
    setStatus(
      action
        ? action.couple
          ? action.id === 'cowgirl'
            ? `${action.label}. 사진 1은 여자, 사진 2는 누운 남자. 쇼츠는 안 합니다.`
            : `${action.label}. 사진 2장이 필요합니다.`
          : `${action.label}.`
        : '포즈를 넣었어요.',
      false,
    )
  }

  function renderPoseDrawChips() {
    const box = document.getElementById('fs-scene-pose-actions')
    if (!box) return
    box.innerHTML = ''
    for (const item of POSE_DRAW_ACTIONS) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'motion-preset-chip'
      chip.classList.toggle('is-selected', poseDrawCombo.actionId === item.id)
      chip.setAttribute('aria-pressed', poseDrawCombo.actionId === item.id ? 'true' : 'false')
      const label = document.createElement('span')
      label.className = 'motion-preset-chip__text'
      label.textContent = item.label
      chip.appendChild(label)
      chip.addEventListener('click', () => {
        poseDrawCombo.actionId = poseDrawCombo.actionId === item.id ? null : item.id
        renderPoseDrawChips()
        syncPoseDrawComboToDesc()
      })
      box.appendChild(chip)
    }
  }

  renderPoseDrawChips()

  // clear face1 also resets gender to none
  document.getElementById('fs-scene-face1-clear')?.addEventListener('click', () => {
    const g = document.getElementById('fs-scene-gender1')
    if (g) g.value = 'none'
  })
  document.getElementById('fs-scene-body1-clear')?.addEventListener('click', () => {
    const g = document.getElementById('fs-scene-body-gender1')
    if (g) g.value = 'none'
  })
  document.getElementById('fs-scene-pose1-clear')?.addEventListener('click', () => {
    const g = document.getElementById('fs-scene-pose-gender1')
    if (g) g.value = 'none'
  })

  async function pollTaleScene(job, startedAt, label, limitSec) {
    const HARD_LIMIT_SEC = Math.max(25, limitSec || 180)
    for (let attempt = 0; attempt < 160; attempt += 1) {
      if (window.__deskStepAbort?.signal?.aborted) return null
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000)
      if (elapsedSec >= HARD_LIMIT_SEC) {
        setStatus(`${label || '장면'}이 ${HARD_LIMIT_SEC}초를 넘었어요. 같은 버튼으로 다시 눌러 주세요.`, true)
        return null
      }
      if (!window.__deskStepTimerOn) {
        setStatus(`${label || '장면 그리는 중'}… ${elapsedSec}초 / ${HARD_LIMIT_SEC}초`, false)
      }
      await sleep(attempt < 5 ? 1500 : 2500)
      if (window.__deskStepAbort?.signal?.aborted) return null
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 20000)
      try {
        const response = await fetch('/api/tale-scene-status', {
          method: 'POST',
          headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            statusUrl: job.statusUrl,
            responseUrl: job.responseUrl,
          }),
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))
        if (response.status === 401) {
          if (typeof clearAllAuth === 'function') clearAllAuth()
          if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
          return null
        }
        if (data.status === 'succeeded' && data.imageUrl) {
          setStatus(`${label || '장면'} 받았습니다. 확인하는 중…`, false)
          return data.imageUrl
        }
        const engineFailed =
          data.status === 'failed' &&
          (data.error === 'provider_content_blocked' || data.error === 'generation_failed')
        if (engineFailed) {
          setStatus(data.message || `장면 생성 실패: ${data.error || 'unknown'}`, true)
          return null
        }
      } catch (_) {
        /* retry */
      } finally {
        window.clearTimeout(timer)
      }
    }
    setStatus('시간이 지나도 결과가 없어요. 다시 시도해 주세요.', true)
    return null
  }

  async function pollReplicatePose(predictionId, startedAt, label, limitSec) {
    const HARD_LIMIT_SEC = Math.max(90, limitSec || 180)
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000)
      if (elapsedSec >= HARD_LIMIT_SEC) {
        setStatus(`${label || '포즈'}가 ${HARD_LIMIT_SEC}초를 넘었어요. 같은 버튼으로 다시 눌러 주세요.`, true)
        return null
      }
      setStatus(`${label || '성인 엔진 그리는 중'}… ${elapsedSec}초 / ${HARD_LIMIT_SEC}초`, false)
      await sleep(attempt < 5 ? 1500 : 2500)
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 12000)
      try {
        const response = await fetch('/api/generate-status', {
          method: 'POST',
          headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
          body: JSON.stringify({ predictionId }),
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))
        if (response.status === 401) {
          if (typeof clearAllAuth === 'function') clearAllAuth()
          if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
          return null
        }
        if (data.status === 'succeeded' && data.imageUrl) {
          setStatus(`${label || '포즈'} 받았습니다. 확인하는 중…`, false)
          return data.imageUrl
        }
        if (data.ok === false || data.status === 'failed') {
          setStatus(data.message || `포즈 생성 실패: ${data.error || 'unknown'}`, true)
          return null
        }
      } catch (_) {
        /* retry */
      } finally {
        window.clearTimeout(timer)
      }
    }
    setStatus('시간이 지나도 결과가 없어요. 다시 시도해 주세요.', true)
    return null
  }

  // onError 를 주면 그쪽으로 알린다. 자유 스튜디오처럼 폼이 숨어 있는 화면에서는
  // setFormStatus 가 안 보이는 칸에 글을 써서 사용자가 이유를 못 본다.
  async function postTaleSceneJob(payload, pollLabel, pollLimitSec, onError) {
    const submitCtrl = new AbortController()
    const submitTimer = window.setTimeout(() => submitCtrl.abort(), 55000)
    const stepAbort = window.__deskStepAbort?.signal
    const onStepAbort = () => submitCtrl.abort()
    if (stepAbort) {
      if (stepAbort.aborted) {
        window.clearTimeout(submitTimer)
        return null
      }
      stepAbort.addEventListener('abort', onStepAbort, { once: true })
    }
    let response
    try {
      response = await fetch('/api/tale-scene', {
        method: 'POST',
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: submitCtrl.signal,
      })
    } catch (err) {
      window.clearTimeout(submitTimer)
      if (stepAbort) stepAbort.removeEventListener('abort', onStepAbort)
      const msg = submitCtrl.signal.aborted
        ? '엔진이 응답하지 않아 멈췄습니다. 같은 버튼을 다시 누르세요.'
        : `보내지 못했습니다. ${err instanceof Error ? err.message : String(err)}`
      if (typeof onError === 'function') onError(msg)
      else if (typeof setFormStatus === 'function') setFormStatus(msg, true)
      else setStatus(msg, true)
      return null
    }
    window.clearTimeout(submitTimer)
    if (stepAbort) stepAbort.removeEventListener('abort', onStepAbort)
    const data = await response.json().catch(() => ({}))
    if (response.status === 401) {
      if (typeof clearAllAuth === 'function') clearAllAuth()
      if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
      return { auth: true }
    }
    if (!data.ok) {
      const code = data.error || String(response.status)
      const detail = typeof data.detail === 'string' && data.detail.trim() ? data.detail.trim().slice(0, 80) : ''
      const msg = `${data.message || '보내지 못했습니다.'} (${code}${detail ? `: ${detail}` : ''} · ${window.__DESK_BUILD || ''})`
      if (typeof onError === 'function') onError(msg)
      else if (typeof setFormStatus === 'function') setFormStatus(msg, true)
      else setStatus(msg, true)
      return null
    }
    // 어느 엔진이 그렸는지는 뒤에서 합성 여부를 가른다. VTON 은 얼굴을 스스로 지킨다.
    const engine = typeof data.engine === 'string' ? data.engine : ''
    if (data.imageUrl) return { imageUrl: data.imageUrl, engine }
    if (data.pending && data.predictionId) {
      const imageUrl = await pollReplicatePose(
        data.predictionId,
        Date.now(),
        pollLabel,
        pollLimitSec || 180,
      )
      return imageUrl ? { imageUrl, engine } : null
    }
    if (data.pending && data.statusUrl && data.responseUrl) {
      const imageUrl = await pollTaleScene(
        { statusUrl: data.statusUrl, responseUrl: data.responseUrl },
        Date.now(),
        pollLabel,
        pollLimitSec || 180,
      )
      return imageUrl ? { imageUrl, engine } : null
    }
    setStatus('장면 결과를 받지 못했어요. 다시 시도해 주세요.', true)
    return null
  }

  function expandNormBox(box, imgW, imgH) {
    const padX = (box.w || 0.2) * 0.4
    const padTop = (box.h || 0.2) * 0.65
    const padBot = (box.h || 0.2) * 0.4
    const x = Math.max(0, box.x - padX)
    const y = Math.max(0, box.y - padTop)
    const w = Math.min(1 - x, box.w + padX * 2)
    const h = Math.min(1 - y, box.h + padTop + padBot)
    return {
      sx: Math.max(0, Math.round(x * imgW)),
      sy: Math.max(0, Math.round(y * imgH)),
      sw: Math.max(32, Math.round(w * imgW)),
      sh: Math.max(32, Math.round(h * imgH)),
    }
  }

  async function cropHeadFromBox(imageSrc, box) {
    const display =
      imageSrc.startsWith('data:') || imageSrc.startsWith('blob:')
        ? imageSrc
        : await toDisplayUrl(imageSrc)
    if (!display) throw new Error('crop_source_unavailable')
    const img = await loadHtmlImage(display)
    const rect = expandNormBox(box, img.naturalWidth, img.naturalHeight)
    rect.sw = Math.min(rect.sw, img.naturalWidth - rect.sx)
    rect.sh = Math.min(rect.sh, img.naturalHeight - rect.sy)
    const canvas = document.createElement('canvas')
    canvas.width = rect.sw
    canvas.height = rect.sh
    canvas.getContext('2d').drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rect.sw, rect.sh)
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.9),
      ...rect,
      fullW: img.naturalWidth,
      fullH: img.naturalHeight,
    }
  }

  async function pasteHeadOntoFull(fullSrc, swappedSrc, rect) {
    const fullDisplay =
      fullSrc.startsWith('data:') || fullSrc.startsWith('blob:') ? fullSrc : await toDisplayUrl(fullSrc)
    const swappedDisplay =
      swappedSrc.startsWith('data:') || swappedSrc.startsWith('blob:')
        ? swappedSrc
        : (await toDisplayUrl(swappedSrc)) || swappedSrc
    if (!fullDisplay || !swappedDisplay) throw new Error('stitch_source_unavailable')
    const base = await loadHtmlImage(fullDisplay)
    const piece = await loadHtmlImage(swappedDisplay)
    const canvas = document.createElement('canvas')
    canvas.width = base.naturalWidth
    canvas.height = base.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(base, 0, 0)
    const layer = document.createElement('canvas')
    layer.width = canvas.width
    layer.height = canvas.height
    const lctx = layer.getContext('2d')
    lctx.drawImage(piece, rect.sx, rect.sy, rect.sw, rect.sh)
    const mask = document.createElement('canvas')
    mask.width = canvas.width
    mask.height = canvas.height
    const mctx = mask.getContext('2d')
    const cx = rect.sx + rect.sw / 2
    const cy = rect.sy + rect.sh * 0.46
    const rx = rect.sw * 0.46
    const ry = rect.sh * 0.5
    const grad = mctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.55, cx, cy, Math.max(rx, ry))
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(0.78, 'rgba(0,0,0,1)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    mctx.fillStyle = grad
    mctx.beginPath()
    mctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    mctx.fill()
    lctx.globalCompositeOperation = 'destination-in'
    lctx.drawImage(mask, 0, 0)
    ctx.drawImage(layer, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.94)
  }

  function iouNormBoxes(a, b) {
    const ax2 = a.x + a.w
    const ay2 = a.y + a.h
    const bx2 = b.x + b.w
    const by2 = b.y + b.h
    const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x))
    const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y))
    const inter = ix * iy
    const uni = a.w * a.h + b.w * b.h - inter
    return uni > 0 ? inter / uni : 0
  }

  function heuristicPoseHeadBox(index, total) {
    if (total >= 2) {
      return index === 0
        ? { x: 0.1, y: 0.04, w: 0.34, h: 0.28 }
        : { x: 0.56, y: 0.04, w: 0.34, h: 0.28 }
    }
    return { x: 0.26, y: 0.03, w: 0.48, h: 0.3 }
  }

  async function sceneImageIsWide(src) {
    try {
      const img = await loadHtmlImage(src)
      const w = img.naturalWidth || 1
      const h = img.naturalHeight || 1
      return w > h * 1.08
    } catch (_) {
      return false
    }
  }

  async function detectSceneFaceBoxes(imageDataUrl, expectedCount, opts) {
    const want = Math.max(1, expectedCount || 1)
    const guessIfMissing = opts?.guessIfMissing !== false
    const localOnly = Boolean(opts?.localOnly)
    const key = faceBoxMemoKey(imageDataUrl, `multi:${want}:${guessIfMissing}:${localOnly}:id1`)
    const hit = faceBoxMemoGet(key)
    if (hit) return hit
    const maySplitOneFace = async (box) => {
      if (!box || want < 2 || box.w < 0.42) return false
      return sceneImageIsWide(imageDataUrl)
    }
    const local = await estimateFaceBoxFromImage(imageDataUrl)
    if (local && (localOnly || want === 1)) return faceBoxMemoSet(key, [local])
    if (localOnly) {
      if (!guessIfMissing) return faceBoxMemoSet(key, [])
      return faceBoxMemoSet(
        key,
        Array.from({ length: want }, (_, i) => heuristicPoseHeadBox(i, want)),
      )
    }
    try {
      const small = await compressToJpegDataUrl(imageDataUrl, 1024, 0.82)
      const response = await fetch('/api/face-box', {
        method: 'POST',
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: small, multi: true }),
      })
      const data = await response.json().catch(() => ({}))
      const list = Array.isArray(data?.faces) ? data.faces : data?.face ? [data.face] : []
      const minW = want >= 2 ? 0.018 : 0.03
      const boxes = list.filter((f) => f && typeof f.w === 'number' && f.w >= minW)
      const uniq = []
      for (const box of boxes.sort((a, b) => a.x - b.x)) {
        const mergeIou = typeof opts?.mergeIou === 'number' ? opts.mergeIou : 0.55
        if (uniq.some((u) => iouNormBoxes(u, box) > mergeIou)) continue
        uniq.push(box)
      }
      if (uniq.length >= 2) return faceBoxMemoSet(key, uniq)
      if (uniq.length === 1 && (await maySplitOneFace(uniq[0]))) {
        const a = uniq[0]
        return faceBoxMemoSet(key, [
          { x: a.x, y: a.y, w: a.w / 2, h: a.h },
          { x: a.x + a.w / 2, y: a.y, w: a.w / 2, h: a.h },
        ])
      }
      if (uniq.length && want === 1) return faceBoxMemoSet(key, uniq)
      if (uniq.length === 1) return faceBoxMemoSet(key, uniq)
      logFs('scene_faces_empty', { http: response.status, error: data?.error, want, guessIfMissing, n: uniq.length })
    } catch (err) {
      logFs('scene_faces_error', { message: err instanceof Error ? err.message : String(err) })
    }
    const again = await estimateFaceBoxFromImage(imageDataUrl)
    if (again && want === 1) return faceBoxMemoSet(key, [again])
    if (again && (await maySplitOneFace(again))) {
      return faceBoxMemoSet(key, [
        { x: again.x, y: again.y, w: again.w / 2, h: again.h },
        { x: again.x + again.w / 2, y: again.y, w: again.w / 2, h: again.h },
      ])
    }
    if (again) return faceBoxMemoSet(key, [again])
    if (!guessIfMissing) return faceBoxMemoSet(key, [])
    return faceBoxMemoSet(
      key,
      Array.from({ length: want }, (_, i) => heuristicPoseHeadBox(i, want)),
    )
  }

  async function swapHeadCrop(cropDataUrl, faceDataUrl, gender, engineOrder, hardLimitSec) {
    const engines = engineOrder && engineOrder.length ? engineOrder : ['replicate', 'insight']
    let lastMessage = ''
    const limit = typeof hardLimitSec === 'number' ? hardLimitSec : 70
    for (const engine of engines) {
      const imageUrl = await runOneJob({
        engine,
        targetSide: 'gender',
        targetImage: cropDataUrl,
        face0: faceDataUrl,
        gender0: gender || 'female',
        upscale: false,
        hardLimitSec: limit,
        queueStuckSec: Math.min(28, limit),
        quiet: true,
        workflowType: 'user_hair',
      })
      if (imageUrl == null) return { aborted: true, imageUrl: null, message: lastMessage }
      if (typeof imageUrl === 'string' && imageUrl && !(await isNearlyBlackImage(imageUrl))) {
        return { aborted: false, imageUrl, message: '' }
      }
      if (imageUrl && typeof imageUrl === 'object' && imageUrl.message) {
        lastMessage = String(imageUrl.message)
      } else if (typeof imageUrl === 'string') {
        lastMessage = '교체 결과가 비었거나 검은 화면입니다.'
      }
    }
    return { aborted: false, imageUrl: null, message: lastMessage }
  }

  async function lockPoseFacesOntoResult(posedUrl, facePhotos, opts) {
    const photos = (facePhotos || []).filter((p) => p && p.dataUrl)
    const wanted = photos.length
    if (!wanted) return { url: posedUrl, locked: 0, wanted: 0, method: '' }
    const stable = await ensureStableDataUrl(posedUrl)
    setStatus('포즈는 됐습니다. 얼굴 위치를 찾는 중…', false)
    const boxes = await detectSceneFaceBoxes(stable, photos.length, opts)
    if (opts?.guessIfMissing === false && boxes.length < photos.length) {
      return { url: stable, locked: 0, wanted, method: '', reason: boxes.length ? 'not_enough_faces' : 'no_face' }
    }
    const jobs = []
    if (photos.length === 1) {
      const box = boxes.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0] || heuristicPoseHeadBox(0, 1)
      jobs.push({ box, photo: photos[0] })
    } else if (boxes.length >= 2) {
      const sorted = boxes.slice().sort((a, b) => a.x - b.x)
      jobs.push({ box: sorted[0], photo: photos[0] })
      jobs.push({ box: sorted[sorted.length - 1], photo: photos[1] })
    } else if (boxes.length === 1) {
      jobs.push({ box: boxes[0], photo: photos[0] })
      jobs.push({ box: heuristicPoseHeadBox(1, 2), photo: photos[1] })
    } else {
      jobs.push({ box: heuristicPoseHeadBox(0, 2), photo: photos[0] })
      jobs.push({ box: heuristicPoseHeadBox(1, 2), photo: photos[1] })
    }

    let current = stable
    let locked = 0
    let lastMessage = ''
    let method = ''

    const applyCropSwap = async (crop, photo, label) => {
      setStatus(`${label} 머리만 교체하는 중…`, false)
      let swapped = await swapHeadCrop(
        crop.dataUrl,
        photo.dataUrl,
        photo.gender,
        opts?.engineOrder,
        opts?.hardLimitSec,
      )
      if (swapped.aborted) return { aborted: true }
      if (swapped.imageUrl) {
        const piece = await ensureStableDataUrl(swapped.imageUrl)
        if (!(await isNearlyBlackImage(piece))) {
          current = await pasteHeadOntoFull(current, piece, crop)
          locked += 1
          method = 'swap'
          return { ok: true }
        }
      }
      lastMessage = swapped.message || lastMessage
      return { ok: false }
    }

    for (let i = 0; i < jobs.length; i += 1) {
      const label = `올린 얼굴 ${i + 1}/${jobs.length}`
      const crop = await cropHeadFromBox(current, jobs[i].box)
      if (!opts?.preferPaste) {
        const applied = await applyCropSwap(crop, jobs[i].photo, label)
        if (applied.aborted) return { url: current, locked, wanted, aborted: true, message: lastMessage, method }
        if (applied.ok) continue
      }

      if (!opts?.preferPaste && photos.length === 1) {
        setStatus('머리 크롭이 안 되어 전신에서 다시 교체합니다…', false)
        const full = await swapHeadCrop(
          current,
          jobs[i].photo.dataUrl,
          jobs[i].photo.gender,
          opts?.engineOrder,
          opts?.hardLimitSec,
        )
        if (full.aborted) return { url: current, locked, wanted, aborted: true, message: lastMessage, method }
        if (full.imageUrl) {
          const piece = await ensureStableDataUrl(full.imageUrl)
          if (!(await isNearlyBlackImage(piece))) {
            current = piece
            locked += 1
            method = 'full'
            continue
          }
        }
        lastMessage = full.message || lastMessage
      }

      if (opts?.skipPasteFallback) {
        continue
      }

      try {
        setStatus(`${label} · 엔진이 거절해서 올린 얼굴을 붙입니다…`, false)
        const facePng = await extractIdFacePng(jobs[i].photo.dataUrl)
        const pasted = await pasteFacePngOnCrop(crop.dataUrl, facePng)
        current = await pasteHeadOntoFull(current, pasted, crop)
        locked += 1
        method = method || 'paste'
      } catch (err) {
        lastMessage =
          lastMessage || (err instanceof Error ? err.message : '얼굴을 붙이지 못했습니다.')
      }
    }
    return { url: current, locked, wanted, message: lastMessage, method }
  }

  function shortsAspectFromSize(size) {
    if (size === 'landscape') return '16:9'
    if (size === 'square') return '1:1'
    return '9:16'
  }

  function motionAfterIdentityStill(motion) {
    let t = String(motion || '')
      .replace(
        /나체가\s*된(?:\s*뒤)?|나체가\s*되어|옷을\s*벗(?:겨|어|고|는|기)?|옷벗김|겹벗김|한\s*겹씩|탈의|undress(?:es|ing)?|strip(?:s|ping)?/gi,
        ' ',
      )
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (!/이미\s*나체|현재\s*나체|fully\s*nude|already\s*(?:fully\s*)?nude/i.test(t)) {
      t = t ? `이미 나체 유지. ${t}` : '이미 나체 유지'
    }
    return t
  }

  /** 탈의 I2V는 얼굴을 다시 그림 → 정지화에 얼굴 고정 후 그 장으로 쇼츠. */
  async function prepareNudeIdentityStillForShorts(imageDataUrl) {
    const job = await postTaleSceneJob(
      {
        composeMode: 'pose-draw',
        poseId: 'nude',
        photoCount: 1,
        images: [imageDataUrl],
        description: '성인 나체, 같은 장소와 구도, 실사. 올린 사람과 같은 얼굴.',
        photoreal: true,
        refKind: 'pose',
        aspectRatio: shortsAspectFromSize(currentResult.size),
        gender0: 'female',
      },
      '나체 정지화',
      160,
    )
    if (!job || job.auth || !job.imageUrl) return null
    const stable = await ensureStableDataUrl(job.imageUrl)
    if (!stable || (await isNearlyBlackImage(stable))) return null
    const locked = await lockPoseFacesOntoResult(stable, [{ dataUrl: imageDataUrl, gender: 'female' }])
    if (locked.aborted) return { aborted: true }
    if (!locked.locked) return null
    const url = await ensureStableDataUrl(locked.url)
    if (!url || (await isNearlyBlackImage(url))) return null
    return { dataUrl: url }
  }

  async function sourceLooksIllustration(src) {
    try {
      const img = await loadHtmlImage(src)
      const w = 64
      const h = 64
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, w, h)
      const d = ctx.getImageData(0, 0, w, h).data
      const lumaAt = (x, y) => {
        const i = (y * w + x) * 4
        return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
      }
      let paper = 0
      let ink = 0
      let flat = 0
      let grain = 0
      const n = w * h
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const i = (y * w + x) * 4
          const r = d[i]
          const g = d[i + 1]
          const b = d[i + 2]
          if (r > 232 && g > 224 && b > 214 && Math.abs(r - g) < 20) paper += 1
          if (x >= w - 1 || y >= h - 1) continue
          const L = lumaAt(x, y)
          const dx = Math.abs(L - lumaAt(x + 1, y))
          const dy = Math.abs(L - lumaAt(x, y + 1))
          const jump = dx > dy ? dx : dy
          const neighbor = dx > dy ? lumaAt(x + 1, y) : lumaAt(x, y + 1)
          const dark = L < neighbor ? L : neighbor
          if (jump >= 52 && dark < 55) ink += 1
          else if (jump <= 5) flat += 1
          else if (jump >= 10 && jump < 36) grain += 1
        }
      }
      const paperR = paper / n
      const inkR = ink / n
      const flatR = flat / n
      const grainR = grain / n
      // 웹툰·선화만. 뷰티·증명 실사(매끈한 피부+머리 가장자리)는 그림이 아님.
      if (inkR >= 0.05 && flatR >= 0.45 && grainR < 0.16 && paperR >= 0.22) return true
      if (paperR >= 0.28 && grainR < 0.14 && inkR >= 0.04) return true
      return false
    } catch (_) {
      return false
    }
  }

  async function deskFaceBoxForExtend(src) {
    try {
      if (typeof detectSceneFaceBoxes === 'function') {
        const boxes = await detectSceneFaceBoxes(src, 1, { guessIfMissing: false, localOnly: true })
        if (boxes && boxes.length) return boxes.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0]
      }
    } catch (_) {
      /* 로컬 추정으로 */
    }
    return estimateFaceBoxFromImage(src)
  }

  async function deskPersonVerticalSpan(src) {
    try {
      const img = await loadHtmlImage(src)
      const w = Math.min(90, img.naturalWidth)
      const h = Math.min(180, img.naturalHeight)
      if (!w || !h) return null
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, w, h)
      const { data } = ctx.getImageData(0, 0, w, h)
      let top = h
      let bot = 0
      const x0 = Math.round(w * 0.18)
      const x1 = Math.round(w * 0.82)
      for (let y = 0; y < h; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * w + x) * 4
          if (data[i + 3] < 20) continue
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const luma = r * 0.299 + g * 0.587 + b * 0.114
          const sat = Math.max(r, g, b) - Math.min(r, g, b)
          if (luma > 208 && sat < 20) continue
          if (y < top) top = y
          if (y > bot) bot = y
        }
      }
      if (bot <= top + 8) return null
      return { top: top / h, bot: (bot + 1) / h }
    } catch (_) {
      return null
    }
  }

  /** 어깨 너비 = 얼굴 너비 × faceMul. 재서 맞춘다. 머리 스티커로 덮지 않는다. */
  async function fitShouldersToFace(src, faceMul, extra = 1.1) {
    if (!src) return src
    const face = await deskFaceBoxForExtend(src)
    if (!face || !(face.w > 0.04)) return src
    const img = await loadHtmlImage(src)
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const probe = document.createElement('canvas')
    const pw = Math.min(220, iw)
    const ph = Math.min(360, ih)
    probe.width = pw
    probe.height = ph
    const pctx = probe.getContext('2d', { willReadFrequently: true })
    pctx.drawImage(img, 0, 0, pw, ph)
    const { data } = pctx.getImageData(0, 0, pw, ph)
    const isPerson = (i, x) => {
      if (data[i + 3] < 20) return false
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const luma = r * 0.299 + g * 0.587 + b * 0.114
      const sat = Math.max(r, g, b) - Math.min(r, g, b)
      const edge = x < pw * 0.12 || x > pw * 0.88
      if (edge && luma > 220 && sat < 18) return false
      if (!edge && luma > 242 && sat < 10) return false
      return true
    }
    const chin = face.y + face.h
    const y0 = Math.round(Math.min(0.48, Math.max(0.16, chin + face.h * 0.45)) * ph)
    const y1 = Math.round(Math.min(0.58, Math.max(y0 + 3, chin + face.h * 1.05)) * ph)
    let best = 0
    for (let y = y0; y <= y1; y += 1) {
      let x0 = pw
      let x1 = 0
      for (let x = 0; x < pw; x += 1) {
        if (!isPerson((y * pw + x) * 4, x)) continue
        if (x < x0) x0 = x
        if (x > x1) x1 = x
      }
      if (x1 > x0 + 3) {
        const w = (x1 - x0 + 1) / pw
        if (w > best) best = w
      }
    }
    if (best <= 0.04) return src
    const extraN = Number(extra) > 1 ? Number(extra) : 1.1
    const mul = (Number(faceMul) > 1 ? Number(faceMul) : 2.585) * extraN
    const targetW = face.w * mul
    if (best >= targetW * 0.97) return src
    const idCropped = best < face.w * 2.25
    const scaleMax = idCropped ? 1.36 : extraN >= 1.2 ? 1.28 : 1.16
    const scaleX = Math.min(scaleMax, Math.max(1.04, targetW / Math.max(best, 0.06)))
    const srcC = document.createElement('canvas')
    srcC.width = iw
    srcC.height = ih
    srcC.getContext('2d').drawImage(img, 0, 0)
    const out = document.createElement('canvas')
    out.width = iw
    out.height = ih
    const octx = out.getContext('2d')
    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = 'high'
    paintSeamlessStudio(octx, iw, ih)
    const neckY = Math.max(0, Math.round((chin + face.h * 0.02) * ih))
    const peakY = Math.min(ih - 1, Math.round((chin + face.h * 0.9) * ih))
    const chestY = Math.min(ih - 1, Math.round((chin + face.h * 1.55) * ih))
    const waistY = Math.min(ih - 1, Math.round((chin + face.h * 2.2) * ih))
    const cx = (face.x + face.w / 2) * iw
    octx.drawImage(srcC, 0, 0, iw, neckY, 0, 0, iw, neckY)
    if (waistY < ih) {
      octx.drawImage(srcC, 0, waistY, iw, ih - waistY, 0, waistY, iw, ih - waistY)
    }
    const smooth = (t) => t * t * (3 - 2 * t)
    const step = 6
    for (let y = neckY; y < waistY; y += step) {
      const mid = Math.min(waistY - 1, y + Math.floor(step / 2))
      let s = 1
      if (mid <= peakY) {
        const t = Math.min(1, (mid - neckY) / Math.max(peakY - neckY, 1))
        s = 1 + (scaleX - 1) * smooth(t)
      } else if (mid <= chestY) {
        s = scaleX
      } else {
        const u = Math.min(1, (mid - chestY) / Math.max(waistY - chestY, 1))
        s = scaleX + (1 - scaleX) * smooth(u)
      }
      const h = Math.min(step, waistY - y)
      const dw = Math.max(1, Math.round(iw * s))
      const dx = Math.round(cx - cx * s)
      octx.drawImage(srcC, 0, y, iw, h, dx, y, dw, h)
    }
    return out.toDataURL('image/jpeg', 0.92)
  }

  async function widenWomanFrame(src) {
    return fitShouldersToFace(src, 2.65, 1.18)
  }

  async function widenMaleTorso(src) {
    return fitShouldersToFace(src, 2.65, 1.14)
  }

  /** 37. 18번: 재킷이 허리에서 끝나면 가슴~밑단을 골반까지 늘린다. 엉덩이만 넓히지 않는다. */
  async function fitManFromFace(src) {
    if (!src) return src
    const face = await deskFaceBoxForExtend(src)
    if (!face || !(face.h > 0.04)) return src
    const span = await deskPersonVerticalSpan(src)
    const img = await loadHtmlImage(src)
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const c = document.createElement('canvas')
    c.width = iw
    c.height = ih
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, iw, ih)
    const lumaAt = (x, y) => {
      const i = (Math.max(0, Math.min(ih - 1, y)) * iw + Math.max(0, Math.min(iw - 1, x))) * 4
      return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    }
    let barTop = ih
    for (let y = ih - 1; y > ih * 0.88; y -= 1) {
      let n = 0
      let dark = 0
      for (let x = 0; x < iw; x += 3) {
        n += 1
        if (lumaAt(x, y) < 60) dark += 1
      }
      if (dark > n * 0.82) barTop = y
      else break
    }
    const headTop = Math.max(0.01, span ? Math.min(span.top, face.y - face.h * 0.42) : face.y - face.h * 0.42)
    const chin = face.y + face.h
    const neck = Math.min(0.86, chin + face.h * 0.08)
    let feetY = Math.min(barTop - 3, Math.round(ih * 0.94))
    for (let y = Math.min(barTop - 3, ih - 4); y > ih * 0.72; y -= 1) {
      let dark = 0
      for (let x = Math.round(iw * 0.4); x < Math.round(iw * 0.6); x += 1) {
        if (lumaAt(x, y) < 45) dark += 1
      }
      if (dark >= 12) {
        feetY = y
        break
      }
    }
    let feet = feetY / ih
    if (feet < neck + 0.36) feet = Math.min(0.94, neck + 0.72)
    const bodyH = Math.max(0.16, feet - neck)
    const personH = Math.max(0.3, feet - headTop)
    const chest = neck + bodyH * 0.08
    const cx = Math.round((face.x + face.w / 2) * iw)
    const chestY = Math.round((neck + bodyH * 0.16) * ih)
    const jxs = []
    for (const dx of [-0.1, -0.07, 0.07, 0.1]) {
      jxs.push(Math.round(cx + dx * iw))
    }
    const inner = [cx - 20, cx - 8, cx, cx + 8, cx + 20]
    let jacketL = 0
    let jacketN = 0
    for (const x of jxs) {
      const L = lumaAt(x, chestY)
      if (L > 40 && L < 190) {
        jacketL += L
        jacketN += 1
      }
    }
    jacketL = jacketN ? jacketL / jacketN : lumaAt(Math.round(iw * 0.42), chestY)
    let hem = 0
    const y0 = Math.round(Math.max(chest + 0.06, headTop + personH * 0.42) * ih)
    const y1 = Math.round((neck + bodyH * 0.58) * ih)
    for (let y = y0; y < y1; y += 1) {
      let pants = 0
      for (const x of inner) {
        const L = lumaAt(x, y)
        if (L < 52 && jacketL - L > 36) pants += 1
      }
      if (pants >= 2) {
        let hold = 0
        for (let k = 0; k < 10; k += 1) {
          let p2 = 0
          for (const x of inner) {
            const L = lumaAt(x, y + k)
            if (L < 52 && jacketL - L > 36) p2 += 1
          }
          if (p2 >= 2) hold += 1
        }
        if (hold >= 7) {
          hem = y / ih
          break
        }
      }
    }
    const oldCrotch = hem > chest + 0.06 ? hem : neck + bodyH * 0.48
    const hemFromHead = (oldCrotch - headTop) / personH
    if (hemFromHead >= 0.48) return src
    const targetCrotch = Math.min(feet - personH * 0.36, headTop + personH * 0.62)
    const add = Math.min(Math.max(0, targetCrotch - oldCrotch), personH * 0.14)
    if (add < personH * 0.04) return src
    const legsH = Math.max(0.12, feet - oldCrotch)
    let newCrotch = oldCrotch + add
    let newFeet = feet
    if (newCrotch + legsH * 0.72 > feet) newCrotch = feet - legsH * 0.72
    const chestPx = Math.max(1, Math.round(chest * ih))
    const oldCrotchPx = Math.max(chestPx + 8, Math.round(oldCrotch * ih))
    const feetPx = Math.min(ih - 2, Math.round(feet * ih))
    const newCrotchPx = Math.max(chestPx + 12, Math.round(newCrotch * ih))
    const newFeetPx = Math.min(ih - 2, Math.round(newFeet * ih))
    const srcMidH = Math.max(8, oldCrotchPx - chestPx)
    const destMidH = Math.max(10, newCrotchPx - chestPx)
    const srcLegsH = Math.max(8, feetPx - oldCrotchPx)
    const destLegsDraw = Math.max(8, newFeetPx - newCrotchPx)
    const out = document.createElement('canvas')
    out.width = iw
    out.height = ih
    const octx = out.getContext('2d')
    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = 'high'
    paintSeamlessStudio(octx, iw, ih)
    octx.drawImage(img, 0, 0, iw, chestPx, 0, 0, iw, chestPx)
    octx.drawImage(img, 0, chestPx, iw, srcMidH, 0, chestPx, iw, destMidH)
    octx.drawImage(img, 0, oldCrotchPx, iw, srcLegsH, 0, newCrotchPx, iw, destLegsDraw)
    return out.toDataURL('image/jpeg', 0.92)
  }

  /** 3번: 양손 손바닥 높이에 남자 엉덩이. 손은 두고 몸통만 채운다. */
  async function fillManSeatAtPalms(src) {
    if (!src) return src
    const img = await loadHtmlImage(src)
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    if (!iw || !ih) return src
    const c = document.createElement('canvas')
    c.width = iw
    c.height = ih
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, iw, ih)
    const luma = (i) => data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    const isNavy = (x, y) => {
      if (x < 0 || y < 0 || x >= iw || y >= ih) return false
      const i = (y * iw + x) * 4
      const yv = luma(i)
      return yv < 92 && data[i + 2] >= data[i] - 8
    }
    const isSkin = (x, y) => {
      if (x < 0 || y < 0 || x >= iw || y >= ih) return false
      const i = (y * iw + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const yv = luma(i)
      const s = Math.max(r, g, b) - Math.min(r, g, b)
      if (yv < 72 || yv > 205 || r < 85 || r < g - 8 || r <= b + 8 || s < 14) return false
      return !isNavy(x, y)
    }
    const y0s = Math.round(ih * 0.42)
    const y1s = Math.round(ih * 0.64)
    const hits = []
    for (let y = y0s; y < y1s; y += 1) {
      let ln = 0
      let rn = 0
      let lMax = -1
      let rMin = iw
      for (let x = Math.round(iw * 0.08); x < Math.round(iw * 0.36); x += 1) {
        if (isSkin(x, y)) {
          ln += 1
          if (x > lMax) lMax = x
        }
      }
      for (let x = Math.round(iw * 0.64); x < Math.round(iw * 0.92); x += 1) {
        if (isSkin(x, y)) {
          rn += 1
          if (x < rMin) rMin = x
        }
      }
      if (ln >= 3 && rn >= 3) hits.push({ y, lMax, rMin, n: ln + rn })
    }
    if (!hits.length) return src
    const yMax = hits[hits.length - 1].y
    const band = hits.filter((h) => h.y >= yMax - 16)
    const mid = band[Math.floor(band.length / 2)]
    const palmY = mid.y
    const leftIn = mid.lMax
    const rightIn = mid.rMin
    const bestN = mid.n
    if (bestN < 6) return src
    const cx = iw / 2
    const seatY = palmY + Math.round(ih * 0.032)
    let coreL = Math.round(cx)
    let coreR = Math.round(cx)
    while (coreL > iw * 0.18 && isNavy(coreL, seatY)) coreL -= 1
    while (coreR < iw * 0.82 && isNavy(coreR, seatY)) coreR += 1
    const coreW = Math.max(8, coreR - coreL)
    const gapL = Math.max(12, leftIn - 20)
    const gapR = Math.min(iw - 12, rightIn + 20)
    const targetHalf = Math.max(coreW * 0.62, Math.min(cx - gapL, gapR - cx))
    const peak = Math.min(1.26, Math.max(1.18, (targetHalf * 2) / coreW))
    if (peak < 1.06) return src
    const sigma = ih * 0.052
    const y0 = Math.max(4, palmY - Math.round(ih * 0.01))
    const y1 = Math.min(ih - 4, seatY + Math.round(sigma * 2.4))
    const out = document.createElement('canvas')
    out.width = iw
    out.height = ih
    const octx = out.getContext('2d')
    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = 'high'
    octx.drawImage(c, 0, 0)
    for (let y = y0; y < y1; y += 1) {
      const dist = (y - seatY) / sigma
      const bump = Math.exp(-dist * dist)
      const scaleX = 1 + (peak - 1) * bump
      if (scaleX < 1.015) continue
      const dw = Math.round(iw * scaleX)
      const dx = Math.round(cx - cx * scaleX)
      octx.save()
      octx.beginPath()
      octx.rect(gapL, y, Math.max(4, gapR - gapL), 1)
      octx.clip()
      octx.drawImage(c, 0, y, iw, 1, dx, y, dw, 1)
      octx.restore()
    }
    return out.toDataURL('image/jpeg', 0.92)
  }

  /** 35. 얼굴→어깨→상체·하체·팔. 14번처럼 엉덩이만 넓히지 않는다. */
  async function fitKoreanManCanon(src) {
    if (!src) return src
    let out = src
    try {
      const fitted = await fitManFromFace(out)
      if (fitted) out = fitted
    } catch (_) {
      /* 원본 유지 */
    }
    try {
      const wide = await widenMaleTorso(out)
      if (wide) out = wide
    } catch (_) {
      /* 원본 유지 */
    }
    return out
  }

  /** 여자는 넓히기와 7등신을 한 함수에서. 전체를 줄여 막대처럼 만들지 않는다. */
  async function shortenWomanLegsInPlace(src) {
    if (!src) return src
    const face = await deskFaceBoxForExtend(src)
    if (!face || !(face.h > 0.04)) return src
    const span = await deskPersonVerticalSpan(src)
    const headTop = Math.max(0, span ? Math.min(span.top, face.y - face.h * 0.38) : face.y - face.h * 0.4)
    const chin = face.y + face.h
    const neck = Math.min(0.92, chin + face.h * 0.12)
    const feet = Math.min(0.99, span ? Math.max(span.bot, neck + 0.2) : 0.96)
    const headH = Math.max(0.04, neck - headTop)
    const personH = Math.max(0.2, feet - headTop)
    if (personH < 0.5) return src
    if (headH / personH >= 0.132) return src
    const hip = Math.min(feet - 0.08, Math.max(neck + 0.08, headTop + personH * 0.55))
    const img = await loadHtmlImage(src)
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const hipPx = Math.min(ih, Math.round(hip * ih))
    const feetPx = Math.min(ih, Math.round(feet * ih))
    const legsH = Math.max(8, feetPx - hipPx)
    const targetPerson = headH / 0.143
    const torsoFrac = hip - headTop
    const needLegs = Math.max(0.12, targetPerson - torsoFrac)
    const newLegsH = Math.max(Math.round(legsH * 0.68), Math.round(needLegs * ih))
    if (newLegsH >= legsH * 0.96) return src
    const out = document.createElement('canvas')
    out.width = iw
    out.height = ih
    const octx = out.getContext('2d')
    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = 'high'
    paintSeamlessStudio(octx, iw, ih)
    octx.drawImage(img, 0, 0, iw, hipPx, 0, 0, iw, hipPx)
    octx.drawImage(img, 0, hipPx, iw, legsH, 0, hipPx, iw, newLegsH)
    return out.toDataURL('image/jpeg', 0.92)
  }

  async function growWomanBodyUnderNeck(src) {
    if (!src) return src
    const face = await deskFaceBoxForExtend(src)
    if (!face || !(face.h > 0.04)) return src
    const span = await deskPersonVerticalSpan(src)
    const headTop = Math.max(0, span ? Math.min(span.top, face.y - face.h * 0.38) : face.y - face.h * 0.4)
    const chin = face.y + face.h
    const neck = Math.min(0.92, chin + face.h * 0.12)
    const feet = Math.min(0.99, span ? Math.max(span.bot, neck + 0.2) : 0.96)
    const headH = Math.max(0.04, neck - headTop)
    const personH = Math.max(0.2, feet - headTop)
    if (personH < 0.45) return src
    if (headH / personH <= 0.145) return src
    const targetPerson = headH / 0.138
    const bodyH = Math.max(0.12, feet - neck)
    let scaleY = (targetPerson - headH) / bodyH
    const maxFeet = 0.965
    if (neck + bodyH * scaleY > maxFeet) scaleY = (maxFeet - neck) / bodyH
    if (scaleY < 1.04) return src
    scaleY = Math.min(1.22, scaleY)
    const scaleX = 1.1
    const img = await loadHtmlImage(src)
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const neckPx = Math.max(1, Math.round(neck * ih))
    const feetPx = Math.min(ih, Math.round(feet * ih))
    const srcBodyH = Math.max(8, feetPx - neckPx)
    const newBodyH = Math.round(srcBodyH * scaleY)
    const cx = (face.x + face.w / 2) * iw
    const dw = Math.round(iw * scaleX)
    const dx = Math.round(cx - cx * scaleX)
    const out = document.createElement('canvas')
    out.width = iw
    out.height = ih
    const octx = out.getContext('2d')
    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = 'high'
    paintSeamlessStudio(octx, iw, ih)
    octx.drawImage(img, 0, 0, iw, neckPx, 0, 0, iw, neckPx)
    octx.drawImage(img, 0, neckPx, iw, srcBodyH, dx, neckPx, dw, newBodyH)
    return out.toDataURL('image/jpeg', 0.92)
  }

  /**
   * 여자 팔 길이 보정. 손끝(몸 옆 피부색 덩어리의 맨 아래)이 바닥에서 키의 0.36 보다 낮으면(팔이 길면) 세로로 줄인다.
   * 옛 방식(고정 위치 열 띠를 옮김)은 손 주변에 직사각형 이음새를 남겨 버렸다. 이제 줄 단위로 부드럽게 줄인다.
   * 좌우 손 높이가 다르면 더 낮은 쪽 기준. 손끝이 허벅지 중간(바닥에서 약 0.385)에 오도록 한다. 길지 않으면 그대로 둔다.
   * window.__deskWomanArmsLog 에 측정값이 남는다.
   */
  async function shortenWomanArmsInPlace(src) {
    const log = { engine: 'woman-arms' }
    window.__deskWomanArmsLog = log
    try {
      const img = await loadHtmlImage(src)
      const W = img.naturalWidth
      const H = img.naturalHeight
      if (!(W > 80 && H > 160)) return src
      const c0 = document.createElement('canvas')
      c0.width = W
      c0.height = H
      const x0 = c0.getContext('2d', { willReadFrequently: true })
      x0.drawImage(img, 0, 0)
      const px = x0.getImageData(0, 0, W, H).data
      const rowEdge = (y) => {
        const e = [0, 0, 0, 0, 0, 0]
        for (let k = 0; k < 24; k += 1) {
          const il = (y * W + k) * 4
          const ir = (y * W + (W - 1 - k)) * 4
          for (let c = 0; c < 3; c += 1) {
            e[c] += px[il + c] / 24
            e[3 + c] += px[ir + c] / 24
          }
        }
        return e
      }
      const personAt = (x, y, e) => {
        const i = (y * W + x) * 4
        return (
          Math.min(
            Math.hypot(px[i] - e[0], px[i + 1] - e[1], px[i + 2] - e[2]),
            Math.hypot(px[i] - e[3], px[i + 1] - e[4], px[i + 2] - e[5]),
          ) > 38
        )
      }
      const rowHas = (y) => {
        const e = rowEdge(y)
        let n = 0
        for (let x = Math.round(W * 0.28); x < Math.round(W * 0.72); x += 1) {
          if (personAt(x, y, e)) {
            n += 1
            if (n >= 6) return true
          }
        }
        return false
      }
      let top = -1
      for (let y = 0; y < H * 0.4 && top < 0; y += 1) if (rowHas(y)) top = y
      let soles = -1
      for (let y = H - 1; y > H * 0.6 && soles < 0; y -= 1) if (rowHas(y)) soles = y
      if (top < 0 || soles < 0 || soles - top < H * 0.5) {
        log.skip = 'no_figure'
        return src
      }
      const Hc = soles - top
      const cx = W / 2
      // 손: 몸 옆(가운데에서 좌우 8~34%)의 피부색 덩어리. 격자 2px 로 연결 요소를 센다
      const y0 = Math.round(top + Hc * 0.42)
      const y1 = Math.round(top + Hc * 0.74)
      const step = 2
      const gw = Math.floor(W / step)
      const gh = Math.floor((y1 - y0) / step)
      const skin = new Uint8Array(gw * gh)
      for (let gy = 0; gy < gh; gy += 1) {
        for (let gx = 0; gx < gw; gx += 1) {
          const x = gx * step
          const y = y0 + gy * step
          const dx = Math.abs(x - cx)
          if (dx < W * 0.08 || dx > W * 0.34) continue
          const i = (y * W + x) * 4
          const r = px[i]
          const g = px[i + 1]
          const b = px[i + 2]
          const luma = r * 0.299 + g * 0.587 + b * 0.114
          if (r > 140 && r > b + 22 && r > g + 6 && luma > 100) skin[gy * gw + gx] = 1
        }
      }
      const seen = new Uint8Array(gw * gh)
      const blobs = []
      for (let s0 = 0; s0 < skin.length; s0 += 1) {
        if (!skin[s0] || seen[s0]) continue
        const stack = [s0]
        seen[s0] = 1
        let area = 0
        let maxY = 0
        let sumX = 0
        while (stack.length) {
          const v = stack.pop()
          area += 1
          const vy = Math.floor(v / gw)
          const vx = v % gw
          if (vy > maxY) maxY = vy
          sumX += vx
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = vx + ox
            const ny = vy + oy
            if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue
            const ni = ny * gw + nx
            if (skin[ni] && !seen[ni]) {
              seen[ni] = 1
              stack.push(ni)
            }
          }
        }
        if (area >= 60) blobs.push({ area, y: y0 + maxY * step, x: (sumX / area) * step })
      }
      const left = blobs.filter((b) => b.x < cx).sort((a, b) => b.area - a.area)[0]
      const right = blobs.filter((b) => b.x >= cx).sort((a, b) => b.area - a.area)[0]
      if (!left && !right) {
        log.skip = 'no_hands'
        return src
      }
      const tipY = Math.max(left ? left.y : 0, right ? right.y : 0)
      const floorH = (soles - tipY) / Hc
      log.floorH = Number(floorH.toFixed(3))
      log.hands = { left: left ? left.y : null, right: right ? right.y : null }
      if (floorH >= 0.36) {
        log.skip = 'arms_ok'
        return src
      }
      // 손끝이 바닥에서 0.385 가 되도록, 팔꿈치 높이~손끝 사이 줄을 줄인다
      const delta = (0.385 - floorH) * Hc
      const yA = top + 0.45 * Hc
      const yB = tipY + 0.05 * Hc
      const L = yB - yA
      const cArm = Math.max(0.8, Math.min(1, (L - delta) / L))
      log.compress = Number(cArm.toFixed(3))
      const smooth = (v) => {
        const q = Math.max(0, Math.min(1, v))
        return q * q * (3 - 2 * q)
      }
      const ramp = 0.03 * Hc
      const nw = new Float64Array(H)
      let acc = 0
      for (let y = 0; y < H; y += 1) {
        let sc = 1
        if (y >= yA - ramp && y < yA) sc = 1 + (cArm - 1) * smooth((y - (yA - ramp)) / ramp)
        else if (y >= yA && y < yB) sc = cArm
        else if (y >= yB && y < yB + ramp) sc = cArm + (1 - cArm) * smooth((y - yB) / ramp)
        nw[y] = acc
        acc += sc
      }
      const newH = Math.ceil(acc)
      const out = document.createElement('canvas')
      out.width = W
      out.height = newH
      const octx = out.getContext('2d', { willReadFrequently: true })
      const od = octx.createImageData(W, newH)
      const o = od.data
      let j = 0
      for (let yn = 0; yn < newH; yn += 1) {
        while (j < H - 2 && nw[j + 1] <= yn) j += 1
        const span = Math.max(1e-6, nw[j + 1] - nw[j])
        const ysrc = Math.min(H - 1.001, j + Math.max(0, Math.min(1, (yn - nw[j]) / span)))
        const ya = Math.floor(ysrc)
        const t = ysrc - ya
        for (let x = 0; x < W; x += 1) {
          const a = (ya * W + x) * 4
          const b = ((ya + 1) * W + x) * 4
          const d = (yn * W + x) * 4
          o[d] = px[a] * (1 - t) + px[b] * t
          o[d + 1] = px[a + 1] * (1 - t) + px[b + 1] * t
          o[d + 2] = px[a + 2] * (1 - t) + px[b + 2] * t
          o[d + 3] = 255
        }
      }
      octx.putImageData(od, 0, 0)
      log.size = [W, newH]
      return out.toDataURL('image/png')
    } catch (err) {
      log.skip = 'err'
      log.message = err instanceof Error ? err.message : String(err)
      return src
    }
  }

  /** 36. 2·9 CAST 얼굴. 화보 8등신·가는 다리 금지. 어깨는 얼굴에 맞춘다. */
  async function fitKoreanWomanCanon(src) {
    if (!src) return src
    let out = src
    try {
      const wide = await widenWomanFrame(out)
      if (wide) out = wide
    } catch (_) {
      /* 원본 유지 */
    }
    try {
      const grown = await growWomanBodyUnderNeck(out)
      if (grown) out = grown
    } catch (_) {
      /* 원본 유지 */
    }
    try {
      const short = await shortenWomanLegsInPlace(out)
      if (short) out = short
    } catch (_) {
      /* 넓은 장 유지 */
    }
    try {
      const arms = await shortenWomanArmsInPlace(out)
      if (arms) out = arms
    } catch (_) {
      /* 전신 유지 */
    }
    return out
  }

  /** 가분수는 목 아래를 조금 늘리고, 다리가 비정상적으로 길면 허리 아래만 줄인다. */
  async function balanceBodyProportion(src) {
    if (!src) return src
    const face = await deskFaceBoxForExtend(src)
    if (!face || !(face.h > 0.04)) return src
    const span = await deskPersonVerticalSpan(src)
    const headTop = Math.max(0, span ? Math.min(span.top, face.y - face.h * 0.38) : face.y - face.h * 0.4)
    const chin = face.y + face.h
    const neck = Math.min(0.92, chin + face.h * 0.12)
    const feet = Math.min(0.99, span ? Math.max(span.bot, neck + 0.2) : 0.96)
    const headH = Math.max(0.04, neck - headTop)
    const personH = Math.max(0.2, feet - headTop)
    if (personH < 0.5) return src
    const ratio = headH / personH
    const hip = Math.min(feet - 0.08, Math.max(neck + 0.08, headTop + personH * 0.55))
    const legH = Math.max(0.08, feet - hip)
    const longFigure = ratio < 0.145
    const longLegs = legH / personH > 0.42 || longFigure
    const giantHead = ratio > 0.155 && !longFigure
    if (!giantHead && !longLegs) return src
    const img = await loadHtmlImage(src)
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const headTopPx = Math.max(0, Math.round(headTop * ih))
    const neckPx = Math.min(ih, Math.round(neck * ih))
    const hipPx = Math.min(ih, Math.round(hip * ih))
    const feetPx = Math.min(ih, Math.round(feet * ih))
    const drawFit = (tmp, figH) => {
      const out = document.createElement('canvas')
      out.width = iw
      out.height = ih
      const octx = out.getContext('2d')
      paintSeamlessStudio(octx, iw, ih)
      const fit = Math.min((ih * 0.92) / figH, 0.78)
      const dw = Math.round(iw * fit)
      const dh = Math.round(figH * fit)
      const dx = Math.round((iw - dw) / 2)
      const dy = Math.round(ih * 0.96 - dh)
      octx.drawImage(tmp, dx, dy, dw, dh)
      return out.toDataURL('image/jpeg', 0.92)
    }
    if (longLegs) {
      const torsoH = Math.max(8, hipPx - headTopPx)
      const legsH = Math.max(8, feetPx - hipPx)
      const scaleY = Math.max(0.62, Math.min(0.88, (personH * 0.4) / legH))
      const newLegsH = Math.round(legsH * scaleY)
      const figH = torsoH + newLegsH
      const tmp = document.createElement('canvas')
      tmp.width = iw
      tmp.height = figH
      const tctx = tmp.getContext('2d')
      tctx.imageSmoothingEnabled = true
      tctx.imageSmoothingQuality = 'high'
      const overlap = Math.max(6, Math.round(torsoH * 0.04))
      tctx.drawImage(img, 0, headTopPx, iw, torsoH, 0, 0, iw, torsoH)
      tctx.drawImage(
        img,
        0,
        Math.max(0, hipPx - overlap),
        iw,
        legsH + overlap,
        0,
        torsoH - overlap,
        iw,
        newLegsH + overlap,
      )
      return drawFit(tmp, figH)
    }
    const bodyH = Math.max(0.08, feet - neck)
    const targetPersonH = headH / 0.143
    const scaleY = Math.min(1.18, Math.max(1, (targetPersonH - headH) / bodyH))
    if (scaleY <= 1.02) return src
    const headSliceH = Math.max(8, neckPx - headTopPx)
    const bodySliceH = Math.max(8, feetPx - neckPx)
    const overlap = Math.max(6, Math.round(headSliceH * 0.08))
    const newBodyH = Math.round(bodySliceH * scaleY)
    const figH = headSliceH + newBodyH
    const tmp = document.createElement('canvas')
    tmp.width = iw
    tmp.height = figH
    const tctx = tmp.getContext('2d')
    tctx.imageSmoothingEnabled = true
    tctx.imageSmoothingQuality = 'high'
    tctx.drawImage(img, 0, headTopPx, iw, headSliceH, 0, 0, iw, headSliceH)
    tctx.drawImage(
      img,
      0,
      Math.max(0, neckPx - overlap),
      iw,
      bodySliceH + overlap,
      0,
      headSliceH - overlap,
      iw,
      newBodyH + overlap,
    )
    return drawFit(tmp, figH)
  }

  async function postDeskFaceHold(targetDisplay, faceSrc, spec) {
    try {
    const compact = async (src) => {
      if (typeof compressToJpegDataUrl !== 'function') return src
      try {
        return (await compressToJpegDataUrl(src, 1280, 0.86)) || src
      } catch {
        return src
      }
    }
    const headers = typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' }
    const gender =
      spec.gender === 'male' || spec.gender === 'man'
        ? 'male'
        : spec.gender === 'non-binary'
          ? 'non-binary'
          : 'female'
    const response = await fetch('/api/face-swap', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        targetImage: await compact(targetDisplay),
        face0: await compact(faceSrc),
        gender0: gender,
        engine: spec.engine,
        workflowType: 'user_hair',
        upscale: true,
        keepFullBody: spec.keepFullBody === true,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!data.ok) return ''
    if (data.imageUrl) return data.imageUrl
    if (!data.pending) return ''
    for (let i = 0; i < 40; i += 1) {
      await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 2500))
      const poll = await fetch('/api/face-swap-status', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          engine: data.engine,
          baseImageUrl: data.baseImageUrl,
          statusUrl: data.statusUrl,
          responseUrl: data.responseUrl,
          predictionId: data.predictionId,
        }),
      })
      const p = await poll.json().catch(() => ({}))
      if (p.imageUrl && p.ok !== false && (p.status === 'succeeded' || !p.pending)) return p.imageUrl
      if (p.status === 'failed' || p.ok === false) return ''
    }
    return ''
    } catch (_) {
      return ''
    }
  }

  /**
   * 남자 어깨 너비 보정. 목 아래 상체(어깨·몸통·팔)를 가로로 factor배(기본 0.95) 줄이고,
   * 허벅지 위에서 서서히 원래 폭으로 되돌린다. 머리·다리는 그대로 둔다.
   * window.__deskShoulderScale 로 조정(1이면 끔). 실패하면 원본을 돌려준다.
   */
  async function narrowManShoulders(src) {
    const log = { engine: 'shoulder' }
    window.__deskShoulderLog = log
    const k = Number(window.__deskShoulderScale) > 0 ? Number(window.__deskShoulderScale) : 0.95
    log.factor = k
    if (k >= 0.999) return src
    try {
      const img = await loadHtmlImage(src)
      const W = img.naturalWidth
      const H = img.naturalHeight
      if (!(W > 80 && H > 160)) return src
      const c0 = document.createElement('canvas')
      c0.width = W
      c0.height = H
      const x0 = c0.getContext('2d', { willReadFrequently: true })
      x0.drawImage(img, 0, 0)
      const px = x0.getImageData(0, 0, W, H).data
      // 줄마다 좌우 가장자리 배경색을 따로 재고, 사람 판정은 더 가까운 쪽 기준 (한쪽 모서리의 물체에 속지 않게)
      const bgAt = (y) => {
        const e = [0, 0, 0, 0, 0, 0]
        for (let kk = 0; kk < 24; kk += 1) {
          const il = (y * W + kk) * 4
          const ir = (y * W + (W - 1 - kk)) * 4
          for (let c = 0; c < 3; c += 1) {
            e[c] += px[il + c] / 24
            e[3 + c] += px[ir + c] / 24
          }
        }
        return e
      }
      const dist = (i, e) =>
        Math.min(
          Math.hypot(px[i] - e[0], px[i + 1] - e[1], px[i + 2] - e[2]),
          Math.hypot(px[i] - e[3], px[i + 1] - e[4], px[i + 2] - e[5]),
        )
      const personRun = (y, a, b, need) => {
        const e = bgAt(y)
        let n = 0
        for (let x = a; x < b; x += 1) {
          const i = (y * W + x) * 4
          if (dist(i, e) > 38) {
            n += 1
            if (n >= need) return true
          }
        }
        return false
      }
      const a0 = Math.round(W * 0.28)
      const b0 = Math.round(W * 0.72)
      let top = -1
      for (let y = 0; y < H * 0.4 && top < 0; y += 1) if (personRun(y, a0, b0, 6)) top = y
      let soles = -1
      for (let y = H - 1; y > H * 0.6 && soles < 0; y -= 1) if (personRun(y, a0, b0, 6)) soles = y
      if (top < 0 || soles < 0 || soles - top < H * 0.5) {
        log.skip = 'no_figure'
        return src
      }
      const Hc = soles - top
      // 몸 중심선: 머리 줄의 좌우 끝 가운데
      const headRow = Math.round(top + Hc * 0.08)
      const e = bgAt(headRow)
      let fl = W
      let fr = 0
      for (let x = 0; x < W; x += 1) {
        const i = (headRow * W + x) * 4
        if (dist(i, e) > 38) {
          if (x < fl) fl = x
          if (x > fr) fr = x
        }
      }
      const cx = fr > fl ? (fl + fr) / 2 : W / 2
      const smooth = (t) => t * t * (3 - 2 * t)
      const scaleAt = (y) => {
        const f = (y - top) / Hc
        if (f < 0.145 || f > 0.7) return 1
        if (f < 0.2) return 1 + (k - 1) * smooth((f - 0.145) / 0.055)
        if (f <= 0.58) return k
        return k + (1 - k) * smooth((f - 0.58) / 0.12)
      }
      const out = document.createElement('canvas')
      out.width = W
      out.height = H
      const octx = out.getContext('2d', { willReadFrequently: true })
      const od = octx.createImageData(W, H)
      const o = od.data
      const rA = W * 0.36
      const rB = W * 0.48
      for (let y = 0; y < H; y += 1) {
        const s = scaleAt(y)
        for (let x = 0; x < W; x += 1) {
          // 중심에서 rA 안쪽은 1/s 로 줄이고, rA~rB 사이에서 서서히 원래 위치로 돌아와 가장자리는 그대로 둔다 (가장자리 복제 줄무늬 방지)
          const u = x - cx
          const au = Math.abs(u)
          const wt = au <= rA ? 0 : au >= rB ? 1 : smooth((au - rA) / (rB - rA))
          const srcU = (au / s) * (1 - wt) + au * wt
          const xs = Math.max(0, Math.min(W - 1.001, cx + (u < 0 ? -srcU : srcU)))
          const xi = Math.floor(xs)
          const t = xs - xi
          const a = (y * W + xi) * 4
          const b = a + 4
          const d = (y * W + x) * 4
          o[d] = px[a] * (1 - t) + px[b] * t
          o[d + 1] = px[a + 1] * (1 - t) + px[b + 1] * t
          o[d + 2] = px[a + 2] * (1 - t) + px[b + 2] * t
          o[d + 3] = 255
        }
      }
      octx.putImageData(od, 0, 0)
      log.top = top
      log.soles = soles
      return out.toDataURL('image/png')
    } catch (err) {
      log.skip = 'err'
      log.message = err instanceof Error ? err.message : String(err)
      return src
    }
  }

  /**
   * 남자 전신 비율 보정. 생성 결과는 몸통이 길고 다리가 짧게 나온다(다리 약 27~35%, 정상 46~48%).
   * 머리·목(위 18.5%)과 신발(아래 4.5%)은 그대로 두고, 그 사이에서 몸통은 줄이고 다리는 늘린다.
   * 다리가 이미 길면(40% 이상) 건드리지 않는다. 실패하면 원본을 돌려준다.
   */
  async function fixManProportions(src) {
    const log = { engine: 'proportion' }
    window.__deskPropLog = log
    try {
      const img = await loadHtmlImage(src)
      let W = img.naturalWidth
      let H = img.naturalHeight
      if (!(W > 80 && H > 160)) return src
      const c0 = document.createElement('canvas')
      c0.width = W
      c0.height = H
      const x0 = c0.getContext('2d', { willReadFrequently: true })
      x0.drawImage(img, 0, 0)
      const px = x0.getImageData(0, 0, W, H).data
      // 맨 아래 균일한 어두운 띠(생성 찌꺼기)는 잘라 낸다
      let barTop = H
      for (let y = H - 1; y > H * 0.9; y -= 1) {
        let dark = 0
        let n = 0
        for (let x = 0; x < W; x += 4) {
          const i = (y * W + x) * 4
          n += 1
          if (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114 < 70) dark += 1
        }
        if (dark > n * 0.9) barTop = y
        else break
      }
      if (barTop < H) {
        log.bar = H - barTop
        H = barTop - 6
      }
      // 배경색: 줄마다 좌우 가장자리에서 잰다 (바닥이 더 밝은 사진도 맞게)
      const rowBg = new Float32Array(H * 6)
      for (let y = 0; y < H; y += 1) {
        for (let side = 0; side < 2; side += 1) {
          const xs = side === 0 ? 0 : W - 24
          let r = 0
          let g = 0
          let b = 0
          for (let x = xs; x < xs + 24; x += 1) {
            const i = (y * W + x) * 4
            r += px[i]
            g += px[i + 1]
            b += px[i + 2]
          }
          rowBg[y * 6 + side * 3] = r / 24
          rowBg[y * 6 + side * 3 + 1] = g / 24
          rowBg[y * 6 + side * 3 + 2] = b / 24
        }
      }
      const isPerson = (x, y) => {
        const i = (y * W + x) * 4
        let best = 1e9
        for (let side = 0; side < 2; side += 1) {
          const dr = px[i] - rowBg[y * 6 + side * 3]
          const dg = px[i + 1] - rowBg[y * 6 + side * 3 + 1]
          const db = px[i + 2] - rowBg[y * 6 + side * 3 + 2]
          best = Math.min(best, Math.sqrt(dr * dr + dg * dg + db * db))
        }
        return best > 38
      }
      const cxa = Math.round(W * 0.28)
      const cxb = Math.round(W * 0.72)
      const rowHas = (y, a, b, need) => {
        let n = 0
        for (let x = a; x < b; x += 1) {
          if (isPerson(x, y)) {
            n += 1
            if (n >= need) return true
          }
        }
        return false
      }
      let top = -1
      for (let y = 0; y < H * 0.4 && top < 0; y += 1) if (rowHas(y, cxa, cxb, 6)) top = y
      let soles = -1
      for (let y = H - 1; y > H * 0.6 && soles < 0; y -= 1) if (rowHas(y, cxa, cxb, 6)) soles = y
      if (top < 0 || soles < 0 || soles - top < H * 0.5) return src
      log.top = top
      log.soles = soles
      if (!log.bar && soles >= H - 3) {
        // 신발이 프레임 끝에 닿았다: 그대로 보정한다 (신발 잘림 정도는 같고 캔버스만 늘어난다)
        log.feetAtEdge = true
      }
      const Hc = soles - top
      // 사타구니: 몸 중심선 부근에서 다리 사이 틈이 처음 생기는 줄 (팔과 몸통 사이 틈은 세지 않는다)
      let figL = W
      let figR = 0
      const headRow = Math.round(top + Hc * 0.1)
      for (let x = 0; x < W; x += 1) {
        if (isPerson(x, headRow)) {
          if (x < figL) figL = x
          if (x > figR) figR = x
        }
      }
      const midX = figR > figL ? (figL + figR) / 2 : W / 2
      // 다리 사이 틈: 배경색에 기대지 않고 '같은 색 다리 - 다른 색 틈 - 같은 색 다리' 패턴을 몸 중심선 근처에서 찾는다
      // (배경이 가운데는 어둡고 가장자리는 밝은 사진, 어두운 바지 모두 대응)
      // 몸통 좌우 끝(가슴 높이): 틈이 '배경과 비슷한 색'인지 보려고 몸 바로 바깥 배경색을 잰다 (지퍼·단추 줄 같은 솔기를 거르기 위해)
      const torsoRow = Math.round(top + Hc * 0.3)
      let torsoL = W
      let torsoR = 0
      for (let x = 0; x < W; x += 1) {
        if (isPerson(x, torsoRow)) {
          if (x < torsoL) torsoL = x
          if (x > torsoR) torsoR = x
        }
      }
      const nearBg = (y) => {
        const out = [0, 0, 0, 0, 0, 0]
        const xs = [Math.max(0, torsoL - 40), Math.min(W - 1, torsoR + 12)]
        for (let side = 0; side < 2; side += 1) {
          let cnt = 0
          for (let x = xs[side]; x < xs[side] + 28 && x < W; x += 1) {
            const i = (y * W + x) * 4
            out[side * 3] += px[i]
            out[side * 3 + 1] += px[i + 1]
            out[side * 3 + 2] += px[i + 2]
            cnt += 1
          }
          for (let c = 0; c < 3; c += 1) out[side * 3 + c] /= Math.max(1, cnt)
        }
        return out
      }
      const centerGap = (y) => {
        const eBg = nearBg(y)
        const lo = Math.max(1, Math.round(midX - W * 0.13))
        const hi = Math.min(W - 2, Math.round(midX + W * 0.13))
        const segs = []
        let sx = lo
        let cr = px[(y * W + lo) * 4]
        let cg = px[(y * W + lo) * 4 + 1]
        let cb = px[(y * W + lo) * 4 + 2]
        let n = 1
        let sr = cr
        let sg = cg
        let sb2 = cb
        const flush = (x) => {
          segs.push({ a: sx, b: x - 1, r: sr / n, g: sg / n, b2: sb2 / n })
        }
        for (let x = lo + 1; x <= hi; x += 1) {
          const i = (y * W + x) * 4
          const prev = i - 4
          const jump = Math.hypot(px[i] - px[prev], px[i + 1] - px[prev + 1], px[i + 2] - px[prev + 2])
          if (jump > 28) {
            flush(x)
            sx = x
            sr = 0
            sg = 0
            sb2 = 0
            n = 0
          }
          sr += px[i]
          sg += px[i + 1]
          sb2 += px[i + 2]
          n += 1
        }
        flush(hi + 1)
        const cd = (p, q) => Math.hypot(p.r - q.r, p.g - q.g, p.b2 - q.b2)
        // 경계 픽셀(1~3px 조각)은 건너뛰고, 틈 양쪽의 넓은 구간(다리)끼리 비교한다
        for (let k = 0; k < segs.length; k += 1) {
          const G = segs[k]
          const gw2 = G.b - G.a + 1
          const mid = (G.a + G.b) / 2
          if (gw2 < 2 || gw2 >= W * 0.2 || Math.abs(mid - midX) >= W * 0.07) continue
          let kl = k - 1
          while (kl >= 0 && segs[kl].b - segs[kl].a + 1 < 4) kl -= 1
          let kr = k + 1
          while (kr < segs.length && segs[kr].b - segs[kr].a + 1 < 4) kr += 1
          if (kl < 0 || kr >= segs.length) continue
          const A = segs[kl]
          const B = segs[kr]
          const dBg = Math.min(
            Math.hypot(G.r - eBg[0], G.g - eBg[1], G.b2 - eBg[2]),
            Math.hypot(G.r - eBg[3], G.g - eBg[4], G.b2 - eBg[5]),
          )
          if (cd(A, B) < 45 && cd(G, A) > 38 && cd(G, B) > 38 && dBg < 95) return true
        }
        return false
      }
      // 다리 사이 틈은 발 쪽으로 끝까지 이어진다. 셔츠 단추 줄 같은 짧은 밝은 선은 걸러진다
      const y0g = Math.round(top + Hc * 0.45)
      const y1g = Math.round(soles - Hc * 0.1)
      const gapRows = []
      for (let y = y0g; y <= y1g; y += 1) gapRows.push(centerGap(y) ? 1 : 0)
      // 발 쪽에서부터 위로 올라가며 틈이 이어지는 곳까지 (4줄 이하의 끊김은 허용). 그 맨 위가 사타구니
      let crotch = -1
      let misses = 0
      for (let k = gapRows.length - 1; k >= 0; k -= 1) {
        if (gapRows[k]) {
          crotch = y0g + k
          misses = 0
        } else {
          misses += 1
          if (misses > 4 && crotch >= 0) break
        }
      }
      if (crotch >= 0 && y1g - crotch < 30) crotch = -1
      if (crotch < 0) {
        // 바지가 붙어 다리 사이 틈이 안 보이면 생성 결과의 전형값(다리 약 35%)으로 가정한다
        crotch = Math.round(soles - Hc * 0.35)
        log.assumed = true
      }
      const legs = (soles - crotch) / Hc
      log.legs = Number(legs.toFixed(3))
      // 다리 37~43% 는 그대로 둔다 (사용자가 21번 37.6% 를 '현실적'이라 함). 사타구니가 실제로 보이는데 43% 보다 길면 서양식 하체라서 40% 로 줄인다
      const longLegs = !log.assumed && legs > 0.43
      if (legs >= 0.37 && !longLegs) {
        log.skip = 'already_ok'
        return src
      }
      const strength = Math.max(0.5, Math.min(1, (0.4 - legs) / 0.12))
      const sTop = 1 - 0.2 * strength
      const sBot = 1 + 0.48 * strength
      const neckY = top + 0.185 * Hc
      const shoeY = top + 0.955 * Hc
      let cLegs = 1
      if (longLegs) {
        const L1 = Math.max(10, shoeY - crotch)
        const shoeLen = soles - shoeY
        cLegs = Math.max(0.78, Math.min(1, (0.4 * (Hc - L1) - shoeLen) / (0.6 * L1)))
        log.compress = Number(cLegs.toFixed(3))
      }
      const smoothS = (v) => {
        const q = Math.max(0, Math.min(1, v))
        return q * q * (3 - 2 * q)
      }
      const ys = new Float64Array(H)
      const nw = new Float64Array(H)
      let acc = 0
      for (let y = 0; y < H; y += 1) {
        ys[y] = y
        const f = (y - top) / Hc
        let sc
        if (longLegs) {
          const t1 = crotch - 0.03 * Hc
          const t2 = crotch + 0.03 * Hc
          if (y < t1) sc = 1
          else if (y < t2) sc = 1 + (cLegs - 1) * smoothS((y - t1) / (t2 - t1))
          else if (y < shoeY - 0.02 * Hc) sc = cLegs
          else if (y < shoeY) sc = cLegs + (1 - cLegs) * smoothS((y - (shoeY - 0.02 * Hc)) / (0.02 * Hc))
          else sc = 1
        } else {
          sc = y >= neckY && y < shoeY ? sTop + (sBot - sTop) / (1 + Math.exp(-14 * (f - 0.66))) : 1
        }
        nw[y] = acc
        acc += sc
      }
      const newH = Math.ceil(acc)
      const out = document.createElement('canvas')
      out.width = W
      out.height = newH
      const octx = out.getContext('2d', { willReadFrequently: true })
      const od = octx.createImageData(W, newH)
      const o = od.data
      let j = 0
      for (let yn = 0; yn < newH; yn += 1) {
        while (j < H - 2 && nw[j + 1] <= yn) j += 1
        const span = Math.max(1e-6, nw[j + 1] - nw[j])
        const ysrc = Math.min(H - 1.001, j + Math.max(0, Math.min(1, (yn - nw[j]) / span)))
        const y0 = Math.floor(ysrc)
        const t = ysrc - y0
        for (let x = 0; x < W; x += 1) {
          const a = (y0 * W + x) * 4
          const b = ((y0 + 1) * W + x) * 4
          const d = (yn * W + x) * 4
          o[d] = px[a] * (1 - t) + px[b] * t
          o[d + 1] = px[a + 1] * (1 - t) + px[b + 1] * t
          o[d + 2] = px[a + 2] * (1 - t) + px[b + 2] * t
          o[d + 3] = 255
        }
      }
      octx.putImageData(od, 0, 0)
      const newSoles = nw[soles]
      const newCrotch = nw[crotch]
      log.after = Number(((newSoles - newCrotch) / (newSoles - nw[top])).toFixed(3))
      log.size = [W, newH]
      return out.toDataURL('image/png')
    } catch (err) {
      log.skip = 'err'
      log.message = err instanceof Error ? err.message : String(err)
      return src
    }
  }

  /**
   * 원본 증명사진의 머리(얼굴·머리카락·목) 화소를 이은 전신 위에 그대로 얹는다.
   * 얼굴 교체 엔진처럼 새로 그리지 않는다. 좌표 추정(LLM)에 기대지 않고,
   * 원본 머리와 생성된 머리를 크기·위치를 바꿔 가며 겹쳐 보아 가장 닮은 자리에 얹는다.
   * 실패하면 빈 문자열을 돌려주고 호출한 쪽이 기존 엔진으로 넘어간다.
   */
  /** 얼굴 사진의 배경이 단색(증명사진 같은 판)인지. 일상 사진(실외·복잡한 배경)은 false */
  async function idPhotoLooksPlain(src) {
    try {
      const img = await loadHtmlImage(src)
      const w = 120
      const h = Math.max(40, Math.round((120 * img.naturalHeight) / Math.max(1, img.naturalWidth)))
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, w, h)
      const d = ctx.getImageData(0, 0, w, h).data
      const lum = (x, y) => {
        const i = (y * w + x) * 4
        return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
      }
      const vals = []
      let ls = 0
      let ln = 0
      let rs = 0
      let rn = 0
      for (let y = 0; y < Math.round(h * 0.07); y += 1) for (let x = 0; x < w; x += 1) vals.push(lum(x, y))
      for (let y = 0; y < Math.round(h * 0.55); y += 1) {
        for (let x = 0; x < Math.round(w * 0.1); x += 1) {
          const v = lum(x, y)
          vals.push(v)
          ls += v
          ln += 1
        }
        for (let x = Math.round(w * 0.9); x < w; x += 1) {
          const v = lum(x, y)
          vals.push(v)
          rs += v
          rn += 1
        }
      }
      const mean = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length)
      const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, vals.length))
      const plain = std < 30 && Math.abs(ls / Math.max(1, ln) - rs / Math.max(1, rn)) < 35
      window.__deskPlainBgLog = { std: Number(std.toFixed(1)), plain }
      return plain
    } catch (_) {
      return false
    }
  }

  async function pastePixelHeadOnStanding(standingUrl, sourceUrl, opts) {
    const t0 = Date.now()
    const log = { engine: 'pixel' }
    const fail = (why, extra) => {
      log.skip = why
      if (extra) Object.assign(log, extra)
      return { url: '', log }
    }
    try {
      if (opts?.strict && !(await idPhotoLooksPlain(sourceUrl))) {
        return fail('busy_bg', window.__deskPlainBgLog)
      }
      const [sImg, gImg] = await Promise.all([loadHtmlImage(sourceUrl), loadHtmlImage(standingUrl)])
      const sw = sImg.naturalWidth
      const sh = sImg.naturalHeight
      const gw = gImg.naturalWidth
      const gh = gImg.naturalHeight
      if (!(sw > 40 && sh > 40 && gw > 40 && gh > 40)) return fail('size')
      // 1) 원본: 배경만 투명하게 (원본과 같은 크기를 유지)
      const cut = document.createElement('canvas')
      cut.width = sw
      cut.height = sh
      const cctx = cut.getContext('2d', { willReadFrequently: true })
      cctx.drawImage(sImg, 0, 0)
      const rawPx = cctx.getImageData(0, 0, sw, sh).data
      if (!canvasHasTransparency(cut)) floodKeyStudio(cut)
      dropStudioIslands(cut)
      defringeCutout(cut)
      const cd = cctx.getImageData(0, 0, sw, sh)
      const d = cd.data
      // 머리 꼭대기: 줄마다 좌우 가장자리 배경색과 다른 화소가 이어지는 첫 줄. 그 위에 남은 배경 띠는 지운다
      {
        const edge = (y, side) => {
          const xs = side === 0 ? 0 : sw - 12
          let r = 0
          let g = 0
          let b = 0
          for (let x = xs; x < xs + 12; x += 1) {
            const i = (y * sw + x) * 4
            r += rawPx[i]
            g += rawPx[i + 1]
            b += rawPx[i + 2]
          }
          return [r / 12, g / 12, b / 12]
        }
        let topC = -1
        for (let y = 0; y < sh * 0.6 && topC < 0; y += 1) {
          const L = edge(y, 0)
          const R = edge(y, 1)
          let run = 0
          for (let x = Math.round(sw * 0.15); x < Math.round(sw * 0.85); x += 1) {
            const i = (y * sw + x) * 4
            const dl = Math.hypot(rawPx[i] - L[0], rawPx[i + 1] - L[1], rawPx[i + 2] - L[2])
            const dr = Math.hypot(rawPx[i] - R[0], rawPx[i + 1] - R[1], rawPx[i + 2] - R[2])
            if (Math.min(dl, dr) > 30) {
              run += 1
              if (run >= 6) {
                topC = y
                break
              }
            } else run = 0
          }
        }
        if (topC > 2) {
          for (let y = 0; y < topC - 1; y += 1) for (let x = 0; x < sw; x += 1) d[(y * sw + x) * 4 + 3] = 0
        }
      }
      // 4픽셀 이상 이어진 구간만 몸으로 본다 (배경 잔점 하나로 폭이 넓어지지 않게)
      const rowSpan = (y) => {
        let a = -1
        let b = -1
        let runLen = 0
        for (let x = 0; x < sw; x += 1) {
          if (d[(y * sw + x) * 4 + 3] > 128) {
            runLen += 1
            if (runLen >= 4) {
              if (a < 0) a = x - 3
              b = x
            }
          } else runLen = 0
        }
        return a < 0 ? null : [a, b]
      }
      let top = -1
      for (let y = 0; y < sh && top < 0; y += 1) {
        const sp = rowSpan(y)
        if (sp && sp[1] - sp[0] > sw * 0.05) top = y
      }
      if (top < 0) return fail('no_subject')
      // 2) 머리 크기·어깨 시작·목 줄을 알파 폭으로 잰다
      let run = 0
      let runRow = top
      let headW = 0
      let neckRow = -1
      let neckW = 1e9
      let shoulder = -1
      let phase = 0
      for (let y = top; y < sh; y += 1) {
        const sp = rowSpan(y)
        const w = sp ? sp[1] - sp[0] : 0
        if (phase === 0) {
          if (w > run) {
            run = w
            runRow = y
          }
          if (run > sw * 0.22 && w < run * 0.88 && y > runRow + 4) {
            headW = run
            phase = 1
          }
        }
        if (phase === 1) {
          if (w < neckW) {
            neckW = w
            neckRow = y
          }
          if (w > headW * 1.12 && y > neckRow + 2) {
            shoulder = y
            break
          }
        }
      }
      if (!headW) headW = Math.min(sw * 0.62, run || sw * 0.5)
      const cutY = Math.min(sh - 1, shoulder > 0 ? shoulder + headW * 0.06 : top + headW * 1.45)
      const chinY = Math.min(neckRow > 0 ? neckRow : top + headW * 1.15, cutY - headW * 0.25)
      const neckHalf = Math.min(headW * 0.5, Math.max(headW * 0.34, (neckW < 1e8 ? neckW : headW * 0.6) * 0.56))
      log.head = { top, w: headW, neck: neckRow, cut: Math.round(cutY) }
      let cxSum = 0
      let cxN = 0
      for (let y = top + Math.round(headW * 0.15); y < top + Math.round(headW * 0.7) && y < sh; y += 2) {
        const sp = rowSpan(y)
        if (sp) {
          cxSum += (sp[0] + sp[1]) / 2
          cxN += 1
        }
      }
      const cx = cxN ? cxSum / cxN : sw / 2
      // 2-1) 배경 제거가 머리 둘레(보호 영역)에서 못 지운 배경을, 줄마다 가장자리 배경색과 거의 같은 화소로 찾아 지운다
      for (let y = Math.max(0, top - 2); y < Math.min(sh, top + Math.round(headW * 0.95)); y += 1) {
        const eL = [0, 0, 0]
        const eR = [0, 0, 0]
        for (let k = 0; k < 12; k += 1) {
          const il = (y * sw + k) * 4
          const ir = (y * sw + (sw - 1 - k)) * 4
          for (let c = 0; c < 3; c += 1) {
            eL[c] += rawPx[il + c] / 12
            eR[c] += rawPx[ir + c] / 12
          }
        }
        for (let x = 0; x < sw; x += 1) {
          const i = (y * sw + x) * 4
          if (d[i + 3] === 0) continue
          const dl = Math.hypot(rawPx[i] - eL[0], rawPx[i + 1] - eL[1], rawPx[i + 2] - eL[2])
          const dr = Math.hypot(rawPx[i] - eR[0], rawPx[i + 1] - eR[1], rawPx[i + 2] - eR[2])
          if (Math.min(dl, dr) < 14) d[i + 3] = 0
        }
      }
      // 2-2) 배경 제거가 깎은 머리카락 복원: 머리 높이 구간에서 가장자리 배경색과 28 이상 다른 화소는 머리다
      for (let y = Math.max(0, top - 2); y < Math.min(sh, top + Math.round(headW * 0.8)); y += 1) {
        const eL = [0, 0, 0]
        const eR = [0, 0, 0]
        for (let k = 0; k < 12; k += 1) {
          const il = (y * sw + k) * 4
          const ir = (y * sw + (sw - 1 - k)) * 4
          for (let c = 0; c < 3; c += 1) {
            eL[c] += rawPx[il + c] / 12
            eR[c] += rawPx[ir + c] / 12
          }
        }
        const xa = Math.max(0, Math.round(cx - headW * 0.62))
        const xb = Math.min(sw - 1, Math.round(cx + headW * 0.62))
        for (let x = xa; x <= xb; x += 1) {
          const i = (y * sw + x) * 4
          if (d[i + 3] > 128) continue
          const dl = Math.hypot(rawPx[i] - eL[0], rawPx[i + 1] - eL[1], rawPx[i + 2] - eL[2])
          const dr = Math.hypot(rawPx[i] - eR[0], rawPx[i + 1] - eR[1], rawPx[i + 2] - eR[2])
          // 머리카락은 배경보다 어둡다. 배경이 머리 둘레에서 더 밝아지는 부분(흰 얼룩)은 되살리지 않는다
          const lumaPx = rawPx[i] * 0.299 + rawPx[i + 1] * 0.587 + rawPx[i + 2] * 0.114
          const lumaBg = Math.min(
            eL[0] * 0.299 + eL[1] * 0.587 + eL[2] * 0.114,
            eR[0] * 0.299 + eR[1] * 0.587 + eR[2] * 0.114,
          )
          if (Math.min(dl, dr) > 28 && lumaPx < lumaBg - 12) {
            d[i] = rawPx[i]
            d[i + 1] = rawPx[i + 1]
            d[i + 2] = rawPx[i + 2]
            d[i + 3] = 255
          }
        }
      }
      // 3) 회색 머리가 배경색과 비슷해 깎인 곳을 메운다 (머리 윗부분 줄은 좌우 끝 사이가 모두 머리)
      for (let y = top; y < top + Math.round(headW * 0.55) && y < sh; y += 1) {
        const sp = rowSpan(y)
        if (!sp || sp[1] - sp[0] > headW * 1.15) continue
        // 이미 머리로 찬 비율이 낮으면(잔머리만 있는 줄) 배경을 채우게 되므로 건너뛴다
        let filled = 0
        for (let x = sp[0]; x <= sp[1]; x += 1) if (d[(y * sw + x) * 4 + 3] > 128) filled += 1
        if (filled < (sp[1] - sp[0] + 1) * 0.6) continue
        // 메우는 것은 머리카락(배경보다 어두움)과 피부색뿐이다. 관자놀이의 오목한 곳에 있는 배경은 채우지 않는다
        let bgL = 0
        for (let k = 0; k < 12; k += 1) {
          const il = (y * sw + k) * 4
          const ir = (y * sw + (sw - 1 - k)) * 4
          bgL += (rawPx[il] * 0.299 + rawPx[il + 1] * 0.587 + rawPx[il + 2] * 0.114 + rawPx[ir] * 0.299 + rawPx[ir + 1] * 0.587 + rawPx[ir + 2] * 0.114) / 24
        }
        for (let x = sp[0]; x <= sp[1]; x += 1) {
          const i = (y * sw + x) * 4
          const lp = rawPx[i] * 0.299 + rawPx[i + 1] * 0.587 + rawPx[i + 2] * 0.114
          const skinLike = rawPx[i] > rawPx[i + 2] + 14 && rawPx[i] > 110
          if (d[i + 3] <= 128 && !(lp < bgL - 12 || skinLike)) continue
          if (d[i + 3] <= 128) {
            d[i] = rawPx[i]
            d[i + 1] = rawPx[i + 1]
            d[i + 2] = rawPx[i + 2]
          }
          d[i + 3] = 255
        }
      }
      // 3-1) 흰머리 구레나룻처럼 배경색과 같아 지워진 부분: 관자놀이 높이까지는 머리의 바깥 윤곽(볼록 껍질) 안쪽을 모두 머리로 본다
      {
        const yA = top + Math.round(headW * 0.12)
        const yB = Math.min(sh - 1, top + Math.round(headW * 0.62))
        const pts = []
        for (let y = yA; y <= yB; y += 3) {
          const sp = rowSpan(y)
          if (sp && sp[1] - sp[0] < headW * 1.15) {
            pts.push([sp[0], y])
            pts.push([sp[1], y])
          }
        }
        if (pts.length >= 6) {
          pts.sort((p, q) => p[0] - q[0] || p[1] - q[1])
          const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
          const lower = []
          for (const pt of pts) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop()
            lower.push(pt)
          }
          const upper = []
          for (let k = pts.length - 1; k >= 0; k -= 1) {
            const pt = pts[k]
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop()
            upper.push(pt)
          }
          const hull = lower.slice(0, -1).concat(upper.slice(0, -1))
          const hm = document.createElement('canvas')
          hm.width = sw
          hm.height = sh
          const hctx = hm.getContext('2d', { willReadFrequently: true })
          hctx.fillStyle = '#fff'
          hctx.beginPath()
          hull.forEach((pt, k) => (k ? hctx.lineTo(pt[0], pt[1]) : hctx.moveTo(pt[0], pt[1])))
          hctx.closePath()
          hctx.fill()
          const hd2 = hctx.getImageData(0, 0, sw, sh).data
          for (let y = yA; y <= yB; y += 1) {
            for (let x = 0; x < sw; x += 1) {
              const i = (y * sw + x) * 4
              if (hd2[i + 3] > 200 && d[i + 3] <= 128) {
                d[i] = rawPx[i]
                d[i + 1] = rawPx[i + 1]
                d[i + 2] = rawPx[i + 2]
                d[i + 3] = 255
              }
            }
          }
        }
      }
      cctx.putImageData(cd, 0, 0)
      // 4) 생성된 전신의 머리와 겹쳐 보아 크기·위치를 찾는다
      const K = Math.max(2, Math.round(gw / 176))
      const lowW = Math.round(gw / K)
      const lowH = Math.round(gh / K)
      const lumaOf = (cv, w, h) => {
        const dd = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data
        const out = new Float32Array(w * h)
        for (let i = 0; i < w * h; i += 1) out[i] = dd[i * 4] * 0.299 + dd[i * 4 + 1] * 0.587 + dd[i * 4 + 2] * 0.114
        return out
      }
      const scaled = (img, w, h) => {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const x = c.getContext('2d', { willReadFrequently: true })
        x.imageSmoothingQuality = 'high'
        x.drawImage(img, 0, 0, w, h)
        return c
      }
      const tplX0 = Math.max(0, Math.round(cx - headW * 0.65))
      const tplX1 = Math.min(sw, Math.round(cx + headW * 0.65))
      const tplY0 = top
      const tplY1 = Math.min(sh, Math.round(top + headW * 1.25))
      const makeTpl = (s, k) => {
        const tw = Math.max(6, Math.round(((tplX1 - tplX0) * s) / k))
        const th = Math.max(6, Math.round(((tplY1 - tplY0) * s) / k))
        const c = document.createElement('canvas')
        c.width = tw
        c.height = th
        const x = c.getContext('2d', { willReadFrequently: true })
        x.imageSmoothingQuality = 'high'
        x.drawImage(cut, tplX0, tplY0, tplX1 - tplX0, tplY1 - tplY0, 0, 0, tw, th)
        const dd = x.getImageData(0, 0, tw, th).data
        const idx = []
        const val = []
        let sum = 0
        let sum2 = 0
        for (let i = 0; i < tw * th; i += 1) {
          if (dd[i * 4 + 3] > 200) {
            const l = dd[i * 4] * 0.299 + dd[i * 4 + 1] * 0.587 + dd[i * 4 + 2] * 0.114
            idx.push(i)
            val.push(l)
            sum += l
            sum2 += l * l
          }
        }
        const n = idx.length
        const mean = n ? sum / n : 0
        const varT = Math.max(1e-6, sum2 - n * mean * mean)
        return { tw, th, idx, val, n, mean, varT, cxOff: ((cx - tplX0) * s) / k }
      }
      const ncc = (tpl, G, gW, ox, oy) => {
        let sg = 0
        let sg2 = 0
        let stg = 0
        for (let j = 0; j < tpl.n; j += 1) {
          const i = tpl.idx[j]
          const x = ox + (i % tpl.tw)
          const y = oy + Math.floor(i / tpl.tw)
          const g = G[y * gW + x]
          sg += g
          sg2 += g * g
          stg += tpl.val[j] * g
        }
        const covar = stg - tpl.mean * sg
        const varG = sg2 - (sg * sg) / tpl.n
        return covar / Math.sqrt(tpl.varT * Math.max(1e-6, varG))
      }
      const G1 = lumaOf(scaled(gImg, lowW, lowH), lowW, lowH)
      let best = { score: -2, s: 1, ox: 0, oy: 0 }
      const sLo = (0.1 * gw) / headW
      const sHi = (0.3 * gw) / headW
      for (let s = sLo; s <= sHi; s *= 1.045) {
        const tpl = makeTpl(s, K)
        if (tpl.n < 40) continue
        const x0 = Math.max(0, Math.round(lowW * 0.3 - tpl.cxOff))
        const x1 = Math.min(lowW - tpl.tw, Math.round(lowW * 0.7 - tpl.cxOff))
        const y1 = Math.min(lowH - tpl.th, Math.round(lowH * 0.22))
        for (let oy = 0; oy <= y1; oy += 1) {
          for (let ox = x0; ox <= x1; ox += 1) {
            const sc = ncc(tpl, G1, lowW, ox, oy)
            if (sc > best.score) best = { score: sc, s, ox, oy }
          }
        }
      }
      if (best.score < 0.3) return fail('no_match', { score: Number(best.score.toFixed(3)) })
      // 5) 더 촘촘한 격자에서 다듬는다
      const K2 = Math.max(1, Math.round(K / 3))
      const midW = Math.round(gw / K2)
      const midH = Math.round(gh / K2)
      const G2 = lumaOf(scaled(gImg, midW, midH), midW, midH)
      const f = K / K2
      let fine = { score: -2, s: best.s, ox: Math.round(best.ox * f), oy: Math.round(best.oy * f) }
      for (const m of [0.955, 0.97, 0.985, 1, 1.015, 1.03, 1.045]) {
        const s = best.s * m
        const tpl = makeTpl(s, K2)
        if (tpl.n < 40) continue
        const bx = Math.round(best.ox * f)
        const by = Math.round(best.oy * f)
        for (let oy = by - 5; oy <= by + 5; oy += 1) {
          for (let ox = bx - 5; ox <= bx + 5; ox += 1) {
            if (ox < 0 || oy < 0 || ox + tpl.tw > midW || oy + tpl.th > midH) continue
            const sc = ncc(tpl, G2, midW, ox, oy)
            if (sc > fine.score) fine = { score: sc, s, ox, oy }
          }
        }
      }
      if (fine.score < 0.3) return fail('no_match_fine', { score: Number(fine.score.toFixed(3)) })
      if (opts?.strict && fine.score < 0.8) return fail('low_match', { score: Number(fine.score.toFixed(3)) })
      const scale = fine.s
      // 템플릿 왼쪽 위 (tplX0, tplY0)가 생성 이미지의 (ox*K2, oy*K2)에 놓인다
      const gAx = fine.ox * K2 - tplX0 * scale
      const gAy = fine.oy * K2 - tplY0 * scale
      log.scale = Number(scale.toFixed(3))
      log.score = Number(fine.score.toFixed(3))
      // 생성된 머리가 놓인 모양: 맞춘 위치·크기에 놓은 원본 머리 윤곽 (나중에 이 모양대로 배경을 채운다)
      const silh = document.createElement('canvas')
      silh.width = sw
      silh.height = sh
      silh.getContext('2d').drawImage(cut, 0, 0)
      // 6) 목 아래로 자르는 선과 좌우 폭
      for (let y = 0; y < sh; y += 1) {
        const vy = y >= cutY ? 0 : y > cutY - headW * 0.16 ? (cutY - y) / (headW * 0.16) : 1
        const half =
          y <= chinY
            ? headW * 0.58
            : headW * 0.58 + (neckHalf - headW * 0.58) * Math.min(1, (y - chinY) / Math.max(1, cutY - chinY))
        for (let x = 0; x < sw; x += 1) {
          const i = (y * sw + x) * 4
          if (vy <= 0) {
            d[i + 3] = 0
            continue
          }
          const dx = Math.abs(x - cx)
          const hx = dx <= half - 6 ? 1 : dx >= half ? 0 : (half - dx) / 6
          d[i + 3] = Math.round(d[i + 3] * vy * hx)
        }
      }
      cctx.putImageData(cd, 0, 0)
      // 7) 전신: 생성된 머리를 그 모양대로 주변 배경색으로 지운다 (얹은 머리가 더 작아도 잔상이 남지 않게)
      const out = document.createElement('canvas')
      out.width = gw
      out.height = gh
      const octx = out.getContext('2d', { willReadFrequently: true })
      octx.drawImage(gImg, 0, 0)
      {
        const eraseBottom = Math.min(gh - 2, Math.round(gAy + Math.min(chinY, cutY - headW * 0.16) * scale))
        const mk = document.createElement('canvas')
        mk.width = gw
        mk.height = gh
        const mctx = mk.getContext('2d', { willReadFrequently: true })
        const grow = Math.max(5, Math.round(headW * scale * 0.1))
        mctx.filter = `blur(${grow}px)`
        mctx.save()
        mctx.translate(gAx, gAy)
        mctx.scale(scale, scale)
        mctx.drawImage(silh, 0, 0)
        mctx.restore()
        const md = mctx.getImageData(0, 0, gw, gh).data
        const od = octx.getImageData(0, 0, gw, gh)
        const g = od.data
        const cover = (x, y) => Math.min(1, (md[(y * gw + x) * 4 + 3] / 255) * 2.6)
        const ramp = 10
        for (let y = 0; y <= eraseBottom; y += 1) {
          let x0 = -1
          let x1 = -1
          for (let x = 0; x < gw; x += 1) {
            if (cover(x, y) > 0.5) {
              if (x0 < 0) x0 = x
              x1 = x
            }
          }
          if (x0 < 0) continue
          const sample = (xc, c) => {
            let sum = 0
            for (let k = 0; k < 4; k += 1) sum += g[(y * gw + Math.max(0, Math.min(gw - 1, xc + k))) * 4 + c]
            return sum / 4
          }
          const lx = Math.max(0, x0 - 10)
          const rx = Math.min(gw - 4, x1 + 7)
          const bottomFade = y > eraseBottom - ramp ? (eraseBottom - y) / ramp : 1
          for (let x = x0 - 2; x <= x1 + 2; x += 1) {
            if (x < 0 || x >= gw) continue
            const a = cover(x, y) * bottomFade
            if (a <= 0) continue
            const t = (x - x0) / Math.max(1, x1 - x0)
            const i = (y * gw + x) * 4
            for (let c = 0; c < 3; c += 1) {
              const fill = sample(lx, c) * (1 - t) + sample(rx, c) * t
              g[i + c] = g[i + c] * (1 - a) + fill * a
            }
          }
        }
        octx.putImageData(od, 0, 0)
      }
      // 8) 원본 머리를 얹는다. 생성된 몸은 머리가 큰 편(약 6등신)이라, 목 자리를 기준으로 머리만 조금 줄인다
      const shrink =
        Number(opts?.shrink) > 0
          ? Number(opts.shrink)
          : Number(window.__deskHeadShrink) > 0
            ? Number(window.__deskHeadShrink)
            : 0.95
      const pgx = gAx + cx * scale
      const pgy = gAy + chinY * scale
      const scale2 = scale * shrink
      const pAx = pgx - cx * scale2
      const pAy = pgy - chinY * scale2
      log.shrink = shrink
      // 얹은 머리를 생성 크기의 임시 판에 그려 두고, 열마다 생성된 검은 깃(터틀넥·재킷)이 시작하는 높이에서 끊는다.
      // (깃 윗선은 곡선이라 한 줄로 끊으면 양옆에서 살색이 검은 깃 위에 겹쳐 갈색 띠가 된다)
      const pc = document.createElement('canvas')
      pc.width = gw
      pc.height = gh
      const pctx = pc.getContext('2d', { willReadFrequently: true })
      pctx.save()
      pctx.translate(pAx, pAy)
      pctx.scale(scale2, scale2)
      pctx.imageSmoothingQuality = 'high'
      pctx.drawImage(cut, 0, 0)
      pctx.restore()
      {
        const gdata = octx.getImageData(0, 0, gw, gh).data
        const pimg = pctx.getImageData(0, 0, gw, gh)
        const pd = pimg.data
        const yStart = Math.max(0, Math.round(pgy - headW * scale2 * 0.08))
        const yEnd = Math.min(gh - 6, Math.round(pgy + headW * scale2 * 0.8))
        const xa = Math.max(1, Math.round(pgx - headW * scale2 * 0.75))
        const xb = Math.min(gw - 2, Math.round(pgx + headW * scale2 * 0.75))
        const lumaAt = (x, y) => {
          let sum = 0
          for (let dx = -1; dx <= 1; dx += 1) {
            const i = (y * gw + x + dx) * 4
            sum += gdata[i] * 0.299 + gdata[i + 1] * 0.587 + gdata[i + 2] * 0.114
          }
          return sum / 3
        }
        let clipped = 0
        for (let x = xa; x <= xb; x += 1) {
          let cy = -1
          for (let y = yStart; y < yEnd && cy < 0; y += 1) {
            if (lumaAt(x, y) < 100) {
              let ok = 0
              for (let k = 1; k <= 4; k += 1) if (lumaAt(x, y + k) < 85) ok += 1
              if (ok >= 4) cy = y - 1
            }
          }
          if (cy < 0) continue
          clipped += 1
          for (let y = Math.max(0, cy - 2); y < gh; y += 1) {
            const f = y >= cy ? 0 : (cy - y) / 2
            const i = (y * gw + x) * 4 + 3
            pd[i] = Math.round(pd[i] * f)
          }
        }
        pctx.putImageData(pimg, 0, 0)
        log.collarCols = clipped
      }
      octx.drawImage(pc, 0, 0)
      log.ok = true
      log.ms = Date.now() - t0
      return { url: out.toDataURL('image/png'), log }
    } catch (err) {
      return fail('err', { message: err instanceof Error ? err.message : String(err) })
    }
  }

  async function holdIdFaceOnStanding(bodyDisplay, idDataUrl, gender) {
    const log = []
    window.__deskHoldLog = log
    const heldIsZoomedBust = async (display) => {
      const face = await estimateFaceBoxFromImage(display)
      if (!face) return false
      return face.h >= 0.36 || face.y + face.h >= 0.58
    }
    const isManHold = gender === 'male' || gender === 'man'
    const pixelHeadOn =
      window.__deskPixelHead === true ||
      (window.__deskPixelHead !== false && (isManHold || window.__deskPixelHeadWoman !== false))
    if (pixelHeadOn) {
      // 남자는 기존 그대로. 여자는 단색 배경 증명사진이고 일치도 0.8 이상일 때만 쓰고, 아니면 아래 교체 엔진으로 넘어간다
      const px = await pastePixelHeadOnStanding(
        bodyDisplay,
        idDataUrl,
        isManHold ? undefined : { strict: true, shrink: Number(window.__deskHeadShrinkWoman) > 0 ? Number(window.__deskHeadShrinkWoman) : 1.0 },
      )
      log.push(px.log)
      if (px.url) return px.url
    }
    const specs = [
      { engine: 'insight', gender },
      { engine: 'kontext', keepFullBody: true, gender },
      { engine: 'replicate', gender },
    ]
    for (const spec of specs) {
      try {
        const url = await postDeskFaceHold(bodyDisplay, idDataUrl, spec)
        if (!url) {
          log.push({ engine: spec.engine, skip: 'no_url' })
          continue
        }
        const display = await ensureStableDataUrl(url)
        if (!display) {
          log.push({ engine: spec.engine, skip: 'no_display' })
          continue
        }
        if (await heldIsZoomedBust(display)) {
          log.push({ engine: spec.engine, skip: 'zoom' })
          continue
        }
        if (typeof countDeskSceneFaces === 'function') {
          const n = await countDeskSceneFaces(display, 4000)
          if (n >= 2) {
            log.push({ engine: spec.engine, skip: 'faces', n })
            continue
          }
        }
        if (typeof deskLooksLikeHintPlate === 'function' && (await deskLooksLikeHintPlate(display))) {
          log.push({ engine: spec.engine, skip: 'plate' })
          continue
        }
        const hold = await deskFacesHold(idDataUrl, display)
        log.push({ engine: spec.engine, ok: true, holdOk: Boolean(hold.ok), skipped: Boolean(hold.skipped) })
        return display
      } catch (err) {
        log.push({ engine: spec.engine, skip: 'err', message: err instanceof Error ? err.message : String(err) })
      }
    }
    return ''
  }

  async function extendOneIdBody(idDataUrl, gender, index, total, opts) {
    const timingT0 = Date.now()
    window.__deskBodyStop = null
    const timing = { jobs: [], holdSec: 0, totalSec: 0 }
    window.__deskTiming = timing
    const timingDone = () => {
      timing.totalSec = Math.round((Date.now() - timingT0) / 1000)
      if (timing.continue && timing.continue.fellBack) {
        const why = `장면 이어 그리기를 쓰지 못해 서서 전신으로 이었습니다: ${timing.continue.reason}${timing.continue.message ? ` (${timing.continue.message})` : ''}`
        setTimeout(() => (typeof setFormStatus === 'function' ? setFormStatus(why, true) : null), 1500)
      }
      try {
        console.info('[desk-extend timing]', JSON.stringify(timing))
      } catch (_) {
        /* ignore */
      }
    }
    setStatus(`이어그리기 · ${index}/${total} 사진 붙이는 중…`, false)
    const source = opts?.faceSrc || idDataUrl
    const isWomanBody = !(gender === 'male' || gender === 'man')
    const plainSource = isWomanBody && window.__deskPixelHeadWoman !== false ? await idPhotoLooksPlain(source) : false
    const drawn = opts?.forcePhoto ? false : await sourceLooksIllustration(source)
    const zipCloth = await deskClothRgb(source, 0.78, 0.98, { bright: true }).catch(() => null)
    const sourceCloth = zipCloth?.hex
      ? zipCloth
      : await deskClothRgb(source, 0.58, 0.92).catch(() => null)
    const clothHex = sourceCloth?.hex || ''
    const runJob = async (image, label, quiet, style, mask, capSec) => {
      const left = opts?.deadline
        ? Math.max(8, Math.round((opts.deadline - Date.now()) / 1000))
        : 200
      if (left < 12) return null
      const jobT0 = Date.now()
      const job = await postTaleSceneJob(
        {
          composeMode: 'extend-body',
          images: image === source ? [source] : [image, source],
          description:
            gender === 'male' || gender === 'man'
              ? '같은 셔츠·재킷. 증명사진 잘린 어깨를 얼굴 너비의 2.75배로 잇고, 그 어깨에서 팔을 내린다. 잘린 끝에서 팔 금지.'
              : '한 사람만. 같은 얼굴. 같은 옷 전신.',
          photoreal: !drawn,
          extendMedium: drawn ? 'illustration' : 'photo',
          refKind: 'face',
          gender0: gender || 'female',
          aspectRatio: '3:4',
          extendStyle: style || 'stand',
          sourceClothHex: clothHex || undefined,
          clothesMask: typeof mask === 'string' && mask.startsWith('data:image/') ? mask : undefined,
        },
        label,
        Math.min(capSec || 200, left),
        quiet ? () => {} : undefined,
      )
      timing.jobs.push({ label, sec: Math.round((Date.now() - jobT0) / 1000), ok: Boolean(job && !job.auth) })
      if (!job || job.auth) return job
      const display = await ensureStableDataUrl(job.imageUrl)
      return { display, remoteUrl: job.imageUrl }
    }
    const hasStandingLegs = async (display) => {
      const lower = await regionLumaStats(display, 0.68, 0.28)
      return lower.variance >= 22 || lower.mean < 190
    }
    const looksLikeStandingHintPlate = async (display) => {
      const img = await loadHtmlImage(display)
      if (!img.naturalWidth || !img.naturalHeight) return false
      const w = Math.min(200, img.naturalWidth)
      const h = Math.min(300, img.naturalHeight)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, w, h)
      const { data } = ctx.getImageData(0, 0, w, h)
      const beigeFrac = (ya, yb) => {
        const x0 = Math.round(w * 0.28)
        const x1 = Math.round(w * 0.72)
        let n = 0
        let hit = 0
        for (let y = Math.round(h * ya); y < Math.round(h * yb); y += 1) {
          for (let x = x0; x < x1; x += 1) {
            const i = (y * w + x) * 4
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]
            const luma = r * 0.299 + g * 0.587 + b * 0.114
            const sat = Math.max(r, g, b) - Math.min(r, g, b)
            n += 1
            if (luma > 165 && luma < 220 && sat >= 12 && sat <= 55 && r >= g - 8 && g >= b - 8) hit += 1
          }
        }
        return n > 20 ? hit / n : 0
      }
      return beigeFrac(0.4, 0.62) >= 0.45 && beigeFrac(0.22, 0.36) < 0.15
    }
    const looksLikeExtendDebris = async (display) => {
      const img = await loadHtmlImage(display)
      if (!img.naturalWidth || !img.naturalHeight) return false
      const w = Math.min(200, img.naturalWidth)
      const h = Math.min(300, img.naturalHeight)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, w, h)
      const { data } = ctx.getImageData(0, 0, w, h)
      const face = await estimateFaceBoxFromImage(display)
      let topDark = 0
      let topN = 0
      const yTop = Math.max(1, Math.round(h * 0.07))
      for (let y = 0; y < yTop; y += 1) {
        for (let x = Math.round(w * 0.28); x < Math.round(w * 0.72); x += 1) {
          const i = (y * w + x) * 4
          const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
          topN += 1
          if (luma < 90) topDark += 1
        }
      }
      if ((!face || face.y > 0.1) && topN && topDark / topN >= 0.08) return 'topDark'
      if (face) {
        const x0 = Math.max(0, Math.round(face.x * w))
        const x1 = Math.min(w, Math.round((face.x + face.w) * w))
        const y0 = Math.max(0, Math.round(face.y * h))
        const y1 = Math.min(h, Math.round((face.y + face.h) * h))
        let n = 0
        let bright = 0
        let lumaSum = 0
        for (let y = y0; y < y1; y += 1) {
          for (let x = x0; x < x1; x += 1) {
            const i = (y * w + x) * 4
            const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
            n += 1
            lumaSum += luma
            if (luma > 198) bright += 1
          }
        }
        if (n > 20 && bright / n >= 0.45) return 'faceBright'
      }
      let card = 0
      const y0 = Math.round(h * 0.46)
      const y1 = Math.round(h * 0.7)
      for (let y = y0; y < y1; y += 1) {
        for (let x = Math.round(w * 0.04); x < Math.round(w * 0.26); x += 1) {
          const i = (y * w + x) * 4
          const sat = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2])
          if (data[i] > 210 && data[i + 1] > 210 && data[i + 2] > 210 && sat < 18) card += 1
        }
      }
      let leftN = 0
      let rightN = 0
      let leftDark = 0
      let rightDark = 0
      const xL = Math.max(1, Math.round(w * 0.08))
      const xR = Math.round(w * 0.92)
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < xL; x += 1) {
          const i = (y * w + x) * 4
          const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
          leftN += 1
          if (luma < 70) leftDark += 1
        }
        for (let x = xR; x < w; x += 1) {
          const i = (y * w + x) * 4
          const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
          rightN += 1
          if (luma < 70) rightDark += 1
        }
      }
      if (leftN && rightN && leftDark / leftN >= 0.72 && rightDark / rightN >= 0.72) return 'darkSides'
      return card > Math.round(w * h * 0.004) ? 'card' : false
    }
    const debrisBlocks = async (display) => {
      const why = await looksLikeExtendDebris(display)
      if (!why) return ''
      // 잔해 검사는 밝은 배경·머리가 위에 닿은 사진을 잘못 거를 수 있다.
      // 한 사람이 서 있는 전신(다리 있음)으로 확인되면 막지 않는다.
      try {
        const legs0 = await hasStandingLegs(display)
        const n0 = typeof countDeskSceneFaces === 'function' ? await countDeskSceneFaces(display, 4000) : 1
        const bust0 =
          typeof window.deskPhotoNeedsBodyExtend === 'function' ? await window.deskPhotoNeedsBodyExtend(display) : true
        const faceBox0 = await estimateFaceBoxFromImage(display)
        const faceSmall0 = Boolean(faceBox0 && faceBox0.h < 0.3 && faceBox0.y < 0.3)
        if (legs0 && n0 === 1 && (faceSmall0 || !bust0)) {
          window.__deskAcceptLog = [...(window.__deskAcceptLog || []), `debrisIgnored:${why}`].slice(-24)
          return ''
        }
      } catch (_) {
        /* 구조를 못 재면 검사 결과를 따른다 */
      }
      return String(why)
    }
    const rejectBody = (why) => {
      window.__deskAcceptLog = [...(window.__deskAcceptLog || []), why].slice(-24)
      console.warn('extend-body reject:', why)
      return false
    }
    const acceptBody = async (result, layoutImage, opts) => {
      if (!result?.display) return rejectBody('noDisplay')
      if (await isSolidBlackPhoto(result.display)) return rejectBody('solidBlack')
      if (await looksLikeEmptyExtend(result.display, layoutImage || source)) return rejectBody('emptyExtend')
      const debrisWhy = await debrisBlocks(result.display)
      if (debrisWhy) return rejectBody(`debris:${debrisWhy}`)
      const face = await estimateFaceBoxFromImage(result.display)
      const faceH = face?.h || 0
      const legs = await hasStandingLegs(result.display)
      if (faceH >= 0.36 && !legs) return rejectBody('faceZoomNoLegs')
      let n = 1
      if (typeof countDeskSceneFaces === 'function') {
        n = await countDeskSceneFaces(result.display, 4000)
        if (n >= 2) return rejectBody('twoFaces')
      }
      const personStanding = Boolean(face && faceH > 0 && faceH < 0.36 && legs && n < 2)
      if (typeof looksLikeHoldingBoard === 'function' && (await looksLikeHoldingBoard(result.display))) {
        return rejectBody('holdingBoard')
      }
      if (!personStanding) {
        if (typeof deskLooksLikeHintPlate === 'function' && (await deskLooksLikeHintPlate(result.display))) {
          return rejectBody('hintPlate')
        }
        if (await looksLikeStandingHintPlate(result.display)) return rejectBody('hintPlate2')
      }
      if (opts?.jacket !== false && (await deskJacketDrifted(source, result.display))) return rejectBody('jacketDrift')
      if (opts?.jacket !== false && (await deskChestSplit(result.display))) return rejectBody('chestSplit')
      const pixelWillRun =
        window.__deskPixelHead === true ||
        (window.__deskPixelHead !== false && (gender === 'male' || gender === 'man' || plainSource))
      if (opts?.face !== false && !pixelWillRun) {
        const hold = await deskFacesHold(source, result.display)
        if (!hold.ok) return rejectBody('faceHold')
      }
      return true
    }
    const restoreJacket = async (display) => {
      if (!display || typeof globalThis.postTaleSceneJob !== 'function') return display
      if (!(await deskJacketDrifted(source, display))) return display
      setStatus(`${index}/${total} 재킷을 증명과 같은 검정으로 맞추는 중…`, false)
      const job = await globalThis.postTaleSceneJob(
        {
          composeMode: 'free-still',
          deskLook: 'extend-jacket',
          images: [display],
          description:
            'Same exact woman, same face, same pose. Change only the cream ivory beige or white jacket into a black office blazer. Keep the black V-neck. FORBIDDEN a new face, leftover cream jacket, trousers, a pantsuit.',
          photoreal: true,
          aspectRatio: '3:4',
          gender0: gender || 'female',
          sourcePeople: 1,
        },
        '재킷을 맞추는 중',
        120,
      )
      if (!job || job.auth || !job.imageUrl) return display
      const stable = await ensureStableDataUrl(job.imageUrl)
      return stable || display
    }
    const restoreSkirt = async (display) => {
      if (!display || typeof globalThis.postTaleSceneJob !== 'function') return display
      if (gender === 'male' || gender === 'man') return display
      const srcChest = await regionLumaStats(source, 0.42, 0.22)
      if (srcChest.mean >= 90) return display
      const midLeg = await regionLumaStats(display, 0.55, 0.18)
      if (midLeg.mean >= 90) return display
      const belowKnee = await regionLumaStats(display, 0.72, 0.08)
      if (belowKnee.mean >= 70) return display
      setStatus(`${index}/${total} 스커트를 무릎 펜슬로 맞추는 중…`, false)
      const job = await globalThis.postTaleSceneJob(
        {
          composeMode: 'free-still',
          deskLook: 'extend-skirt',
          images: [display],
          description:
            'Same exact woman, same face, same pose. Change only the long coat or flared dress into a short black office blazer over a knee pencil skirt. FORBIDDEN a long coat, an A-line flare, a new face.',
          photoreal: true,
          aspectRatio: '3:4',
          gender0: gender || 'female',
          sourcePeople: 1,
        },
        '스커트를 맞추는 중',
        120,
      )
      if (!job || job.auth || !job.imageUrl) return display
      const stable = await ensureStableDataUrl(job.imageUrl)
      return stable || display
    }

    const makePrepared = async () => {
      const bustSrc = await cropPhotoToShoulders(source)
      let subject = null
      try {
        subject = await cropSubjectOffDesk(await extractIdSubjectPng(bustSrc))
      } catch (_) {
        subject = null
      }
      if (!subject?.pngDataUrl) subject = { pngDataUrl: bustSrc }
      return buildBodyExtendCanvas(subject, gender)
    }
    const tryPreparedJob = async (label) => {
      const prepared = await makePrepared()
      const alt = await runJob(prepared.image, label)
      return { alt, prepared }
    }
    const sourceFace = await estimateFaceBoxFromImage(source, { scanTop: 0.5, centerOnly: true })
    const sourceIsBust =
      typeof window.deskPhotoNeedsBodyExtend === 'function'
        ? await window.deskPhotoNeedsBodyExtend(source)
        : Boolean(
            !sourceFace || sourceFace.h >= 0.18 || sourceFace.y + sourceFace.h >= 0.45,
          )
    if (!sourceIsBust) {
      let display = source
      try {
        const isMan = gender === 'male' || gender === 'man'
        if (isMan && typeof fitKoreanManCanon === 'function') {
          display = (await fitKoreanManCanon(display)) || display
        } else if (!isMan && typeof fitKoreanWomanCanon === 'function') {
          display = (await fitKoreanWomanCanon(display)) || display
        }
      } catch (_) {
        display = source
      }
      return { display, remoteUrl: '', gender, isolated: false }
    }
    // 여자 + 일상 사진(배경이 단색이 아님): 그 장면을 살리고 아래만 이어 그린다. 원본 사진의 화소(얼굴·손·배경)는 그대로 복원한다.
    // 사용자 지시: 가짜 얼굴로 대신하지 않는다. 최대 2번 시도하고, 그래도 안 되면 서서 전신(교체 엔진 얼굴)으로 넘어가지 않고 멈춘다.
    // 끄기: window.__deskWomanContinue = false / 예전처럼 실패 시 서서 전신으로 넘기기: window.__deskWomanContinueFallback = true
    // 단색 증명사진도 같은 경로: 서서 전신 방식은 옷을 바꾸고 얼굴을 교체 엔진으로 새로 그려 가짜 얼굴(24 (2).jpg → 79번)이 되었다
    if (isWomanBody && !drawn && window.__deskWomanContinue !== false) {
      const contLog = { engine: 'continue', tries: [] }
      timing.continue = contLog
      // 이어 그린 결과가 정말 그려졌는지: 늘려 채운 빈 곳은 세로줄 무늬라 아래 영역에서 줄 사이 차이가 거의 없다
      const looksPainted = async (display) => {
        const img = await loadHtmlImage(display)
        const w = 160
        const h = Math.max(80, Math.round((160 * img.naturalHeight) / Math.max(1, img.naturalWidth)))
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const cx2 = c.getContext('2d', { willReadFrequently: true })
        cx2.drawImage(img, 0, 0, w, h)
        const d = cx2.getImageData(0, 0, w, h).data
        let sum = 0
        let n = 0
        for (let y = Math.round(h * 0.72); y < Math.round(h * 0.93); y += 1) {
          for (let x = Math.round(w * 0.25); x < Math.round(w * 0.75); x += 1) {
            const i = (y * w + x) * 4
            const j = ((y + 4) * w + x) * 4
            sum += Math.abs(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 - (d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114))
            n += 1
          }
        }
        return sum / Math.max(1, n)
      }
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const tryLog = { n: attempt + 1 }
        contLog.tries.push(tryLog)
        try {
          setStatus(`${index}/${total} 사진의 장면을 살려 아래로 이어 그리는 중… (${attempt + 1}/5)`, false)
          // 얼굴 크기(사진 높이 대비)를 재서, 클로즈업이면 사진을 줄여 머리가 정상 크기가 되게 한다
          let faceH = 0
          try {
            const fb = await detectFaceBox(source, 'id')
            faceH = fb && Number(fb.h) > 0.05 ? Number(fb.h) : 0
          } catch (_) {
            faceH = 0
          }
          tryLog.faceH = Number(faceH.toFixed(3))
          // 1번째는 머리 28%(mw187 실측: 이 구도는 모델이 그려 준다), 2번째는 20%로 달리 시도한다. 비율은 프롬프트로 모델에게 자연스럽게 그리라고 지시한다
          const prepared = await buildBodyContinueCanvas(source, [864, 1152], { faceH, headTarget: [0.28, 0.2, 0.36, 0.28, 0.24][attempt] })
          const contT0 = Date.now()
          // 한 번에 최대 110초
          const alt = await runJob(prepared.image, `${index}/${total} 장면 이어 그리기`, false, 'continue', undefined, 110)
          tryLog.sec = Math.round((Date.now() - contT0) / 1000)
          if (alt?.auth) return alt
          if (!alt?.display) {
            tryLog.reason = 'no_result'
            continue
          }
          // 먼저 모델이 돌려준 결과의 상태를 기록한다 (크기·평균 밝기·그려짐·결과 주소). 복원이 실패해도 이유를 볼 수 있게
          tryLog.url = typeof alt.remoteUrl === 'string' ? alt.remoteUrl : ''
          try {
            const outImg = await loadHtmlImage(alt.display)
            tryLog.size = `${outImg.naturalWidth}x${outImg.naturalHeight}`
            const sc = document.createElement('canvas')
            sc.width = 32
            sc.height = 32
            const sx = sc.getContext('2d', { willReadFrequently: true })
            sx.drawImage(outImg, 0, 0, 32, 32)
            const sd = sx.getImageData(0, 0, 32, 32).data
            let lum = 0
            let lum2 = 0
            for (let i = 0; i < sd.length; i += 4) {
              const l = sd[i] * 0.299 + sd[i + 1] * 0.587 + sd[i + 2] * 0.114
              lum += l
              lum2 += l * l
            }
            const nPx = sd.length / 4
            tryLog.avg = Math.round(lum / nPx)
            tryLog.flat = Number(Math.sqrt(Math.max(0, lum2 / nPx - (lum / nPx) * (lum / nPx))).toFixed(1))
            tryLog.paint0 = Number((await looksPainted(alt.display)).toFixed(2))
          } catch (_) {
            /* 상태 기록 실패는 무시 */
          }
          // 모델이 검은 자리표시 이미지(안전 필터)나 단색을 돌려주면 복원 시도 없이 바로 이유를 남기고 다시 시도한다
          if (tryLog.flat != null && tryLog.flat < 2) {
            tryLog.reason = tryLog.avg != null && tryLog.avg < 12 ? 'black' : 'flat'
            continue
          }
          // 모델이 사진을 다른 크기·위치로 다시 그렸을 수 있어, 결과 안에서 원본 위치를 찾아 그 자리에 복원한다
          const rr = await restoreOriginalPhotoOnContinued(alt.display, prepared, source)
          tryLog.restore = rr.log
          if (!rr.url) {
            tryLog.reason = 'restore_miss'
            continue
          }
          const restored = rr.url
          tryLog.black = await isSolidBlackPhoto(restored)
          tryLog.faces = typeof countDeskSceneFaces === 'function' ? await countDeskSceneFaces(restored, 4000) : 1
          tryLog.paint = Number((await looksPainted(restored)).toFixed(2))
          if (tryLog.black) tryLog.reason = 'black'
          else if (tryLog.faces >= 2) tryLog.reason = 'two_people'
          else if (tryLog.paint < 4) tryLog.reason = 'unpainted'
          else {
            tryLog.reason = 'ok'
            contLog.reason = 'ok'
            timingDone()
            return { display: restored, remoteUrl: alt.remoteUrl, gender, isolated: false, continued: true }
          }
        } catch (err) {
          tryLog.reason = 'err'
          tryLog.message = err instanceof Error ? err.message : String(err)
        }
      }
      contLog.reason = contLog.tries
        .map(
          (t) =>
            `${t.reason}${t.restore && t.restore.coarse != null ? ` 일치${t.restore.coarse}` : ''}${t.paint != null ? ` 그림${t.paint}` : ''}${t.paint0 != null ? ` 그림0 ${t.paint0}` : ''}${t.avg != null ? ` 밝기${t.avg}/편차${t.flat}` : ''}${t.size ? ` ${t.size}` : ''}${t.sec != null ? ` ${t.sec}초` : ''}${t.url ? ` [${t.url}]` : ''}`,
        )
        .join(' + ')
      if (window.__deskWomanContinueFallback === true) {
        contLog.fellBack = true
        console.warn('장면 이어 그리기를 쓰지 못해 서서 전신 방식으로 넘어갑니다:', JSON.stringify(contLog))
      } else {
        const stop = `원본 사진의 장면을 살려 이어 그리지 못했습니다 (${contLog.reason}). 가짜 얼굴로 대신하지 않습니다. 다시 시도해 주세요.`
        if (typeof setFormStatus === 'function') setFormStatus(stop, true)
        else setStatus(stop, true)
        console.warn(stop, JSON.stringify(contLog))
        window.__deskBodyStop = { at: Date.now(), text: stop }
        timing.totalSec = Math.round((Date.now() - timingT0) / 1000)
        return null
      }
    }
    let result = null
    let standing = null
    let faceAccepted = false
    let triedPrepared = false
    let triedSource = false
    let preparedKeep = null
    const takeStanding = async (alt, layoutImage) => {
      if (!alt?.display) return
      if (await acceptBody(alt, layoutImage)) {
        result = alt
        faceAccepted = true
      } else if (await acceptBody(alt, layoutImage, { jacket: false, face: false })) {
        standing = alt
      }
    }
    try {
      setStatus(`${index}/${total} 상반신을 서서 전신으로 잇는 중…`, false)
      const { alt, prepared } = await tryPreparedJob(`${index}/${total} 서서 전신 그리는 중`)
      triedPrepared = true
      preparedKeep = prepared
      if (alt?.auth) return alt
      await takeStanding(alt, prepared.image)
    } catch (_) {
      result = null
    }
    if (!result?.display && !preparedKeep?.continue) {
      const left = opts?.deadline
        ? Math.round((opts.deadline - Date.now()) / 1000)
        : 90
      if (
        left >= 25 &&
        !window.__deskStepAbort?.signal?.aborted &&
        (!triedSource || !triedPrepared)
      ) {
        setStatus(`${index}/${total} 상반신만 나와 전신으로 다시 잇는 중…`, false)
        if (!triedSource) {
          triedSource = true
          const again = await runJob(source, `${index}/${total} 서서 전신 그리는 중`)
          if (again?.auth) return again
          await takeStanding(again, source)
        } else if (!triedPrepared) {
          try {
            const { alt, prepared } = await tryPreparedJob(`${index}/${total} 서서 전신 그리는 중`)
            if (alt?.auth) return alt
            await takeStanding(alt, prepared.image)
          } catch (_) {
            /* fail below */
          }
        }
      }
    }
    if (!result?.display && standing?.display) {
      result = { ...standing, display: preparedKeep?.continue ? standing.display : await restoreJacket(standing.display) }
    }
    if (result?.display && !drawn && !preparedKeep?.continue) {
      result = { ...result, display: await restoreSkirt(result.display) }
    }
    if (!result?.display) {
      const whyList = (window.__deskAcceptLog || []).slice(-6)
      const why = whyList.join(',')
      const lastWhy = String(whyList.filter((w) => !String(w).startsWith('debrisIgnored')).slice(-1)[0] || '')
      const whyText = /^debris/.test(lastWhy)
        ? '배경·가장자리 잔해 검사에 걸려 저장하지 않습니다.'
        : /hintPlate|holdingBoard/.test(lastWhy)
          ? '베이지 힌트 판(안내 그림)이 남아 저장하지 않습니다.'
          : /twoFaces/.test(lastWhy)
            ? '한 사람이 아닌 그림이 나와 저장하지 않습니다.'
            : /faceZoomNoLegs|emptyExtend/.test(lastWhy)
              ? '전신이 그려지지 않아 저장하지 않습니다.'
              : /solidBlack/.test(lastWhy)
                ? '검은 화면이 나와 저장하지 않습니다.'
                : /jacketDrift|chestSplit|faceHold/.test(lastWhy)
                  ? '옷이나 얼굴이 원본과 달라 저장하지 않습니다.'
                  : '조건에 맞지 않아 저장하지 않습니다.'
      const fail = `${index}/${total} ${whyText} CAST 그 얼굴만 잇습니다.${why ? ` [거절: ${why}]` : ''}`
      if (typeof setFormStatus === 'function') setFormStatus(fail, true)
      else setStatus(fail, true)
      timingDone()
      return null
    }

    if (!drawn && result?.display && !preparedKeep?.continue) {
      try {
        setStatus(`${index}/${total} 증명 얼굴을 전신에 붙이는 중…`, false)
        window.__deskLastStanding = result.display
        const holdT0 = Date.now()
        const held = await holdIdFaceOnStanding(result.display, source, gender)
        timing.holdSec = Math.round((Date.now() - holdT0) / 1000)
        {
          const px = (window.__deskHoldLog || []).find((l) => l.engine === 'pixel')
          if (px && !px.ok) {
            const why = `원본 얼굴 얹기 건너뜀: ${px.skip}${px.message ? ` (${px.message})` : ''}`
            console.warn(why, JSON.stringify(px))
            setTimeout(() => (typeof setFormStatus === 'function' ? setFormStatus(why, true) : null), 1500)
          } else if (px?.ok) {
            timing.pixelHead = px
          }
        }
        timing.holdLog = window.__deskHoldLog
        const standingFace = await estimateFaceBoxFromImage(result.display)
        const standingZoomed = Boolean(
          standingFace && (standingFace.h >= 0.36 || standingFace.y + standingFace.h >= 0.58),
        )
        const standingHasLegs = await hasStandingLegs(result.display)
        if (!held || (await debrisBlocks(held))) {
          if (
            !result.display ||
            (!standingHasLegs && standingZoomed) ||
            (await debrisBlocks(result.display))
          ) {
            const fail = `${index}/${total} CAST 얼굴을 붙이지 못해 저장하지 않습니다. 다른 사람은 잇지 않습니다.`
            if (typeof setFormStatus === 'function') setFormStatus(fail, true)
            else setStatus(fail, true)
            return null
          }
        } else {
          const heldFace = await estimateFaceBoxFromImage(held)
          const zoomed = Boolean(heldFace && (heldFace.h >= 0.36 || heldFace.y + heldFace.h >= 0.58))
          if (zoomed) {
            if (standingZoomed || (await debrisBlocks(result.display))) {
              const fail = `${index}/${total} 전신이 아닌 얼굴을 저장하지 않습니다. CAST 그 얼굴만 잇습니다.`
              if (typeof setFormStatus === 'function') setFormStatus(fail, true)
              else setStatus(fail, true)
              return null
            }
          } else {
            result.display = held
          }
        }
      } catch (_) {
        const fail = `${index}/${total} CAST 얼굴을 붙이지 못해 저장하지 않습니다. 다른 사람은 잇지 않습니다.`
        if (typeof setFormStatus === 'function') setFormStatus(fail, true)
        else setStatus(fail, true)
        return null
      }
      try {
        window.__deskRecolorLog = { useBlack: true, hex: clothHex || '' }
      } catch (_) {
        /* 얼굴 붙인 전신을 남긴다 */
      }
      try {
        setStatus(`${index}/${total} 얼굴·어깨 비율을 맞추는 중…`, false)
        const isMan = gender === 'male' || gender === 'man'
        if (isMan) {
          // 옛 캐논(어깨를 얼굴 폭 2.75배로 넓히고 6줄 띠로 윤곽을 계단지게 함)은 실제 체형(어깨÷머리 약 2.2)과 맞지 않아 끈다
          if (window.__deskManCanon === true) {
            const fitted = await fitKoreanManCanon(result.display)
            if (fitted) result.display = fitted
          }
          result.display = await fixManProportions(result.display)
          timing.proportion = window.__deskPropLog
          result.display = await narrowManShoulders(result.display)
          timing.shoulder = window.__deskShoulderLog
        } else {
          const fitted = await fitKoreanWomanCanon(result.display)
          if (fitted) result.display = fitted
        }
      } catch (_) {
        /* 전신은 남긴다 */
      }
    }
    timingDone()
    return {
      display: result.display,
      remoteUrl: result.remoteUrl,
      gender,
      isolated: result.isolated,
    }
  }

  async function runFaceExtendScene(opts) {
    const { images, gender0, gender1, aspectRatio } = opts
    const bodies = []
    for (let i = 0; i < images.length; i += 1) {
      const one = await extendOneIdBody(
        images[i],
        i === 0 ? gender0 : gender1,
        i + 1,
        images.length,
      )
      if (!one) return null
      if (one.auth) return one
      bodies.push(one)
    }
    setStatus('이어그리기 · 배경 없이 PNG로 붙이는 중…', false)
    const laid = await compositeBodiesSideBySide(bodies, aspectRatio || '9:16', 'side')
    const cleaned = await cleanResultHalo(laid.composite)
    const shown = await displayResult(cleaned)
    if (!shown) return null
    setStatus('완성! 이어그린 전신 PNG입니다. 포즈는 바꾸지 않았습니다.', false)
    return { imageUrl: cleaned }
  }

  async function runSceneFromRefs(opts) {
    const { refKind, images, gender0, gender1, description, aspectRatio, expressionMode, runBtnEl } =
      opts
    if (!images.length) {
      setStatus('참고 사진을 1장 이상 넣어 주세요.', true)
      return
    }
    if (!description || description.trim().length < 4) {
      setStatus('원하는 장면을 한글로 적어 주세요.', true)
      return
    }
    if (refKind === 'face' && isFaceSceneAdultRequest(description)) {
      setStatus('이어그리기에서는 나체·성인 연출을 받지 않아요.', true)
      return
    }
    if (refKind === 'face' && isFaceSceneContactPose(resolveScenePoseId(sceneFaceCombo.actionId, description))) {
      setStatus(FACE_SCENE_CONTACT_MSG, true)
      return
    }
    if (runBtnEl) runBtnEl.disabled = true
    if (resultImg) resultImg.hidden = true
    if (resultActions) resultActions.hidden = true
    if (resultPlaceholder) resultPlaceholder.hidden = false
    try {
      if (refKind === 'face') {
        await runFaceExtendScene({
          images,
          gender0,
          gender1,
          description: description.trim(),
          aspectRatio,
          poseId: sceneFaceCombo.actionId,
          expressionMode,
        })
        return
      }
      setStatus('한글 요청을 이해하고 장면을 만드는 중…', false)
      const payload = {
        images,
        description: description.trim(),
        photoreal: true,
        refKind,
        aspectRatio: aspectRatio || '9:16',
        gender0,
        expressionMode: expressionMode === 'scene' ? 'scene' : 'id',
      }
      if (gender1 && gender1 !== 'none') payload.gender1 = gender1
      const job = await postTaleSceneJob(payload, '장면 그리는 중')
      if (!job || job.auth) return
      const displayForCheck =
        job.imageUrl.startsWith('data:') || job.imageUrl.startsWith('blob:')
          ? job.imageUrl
          : (await toDisplayUrl(job.imageUrl)) || job.imageUrl
      if (await isNearlyBlackImage(displayForCheck)) {
        setStatus(
          '엔진이 결과를 비웠어요(검은 화면). 「카페·해변·나란히 걷기」처럼 담백한 장면으로 바꿔 다시 시도해 보세요.',
          true,
        )
        return
      }
      let outUrl = job.imageUrl
      if (typeof lockPoseFacesOntoResult === 'function') {
        setStatus('올린 얼굴을 붙이는 중…', false)
        const photos = images
          .map((dataUrl, i) => ({
            dataUrl,
            gender:
              i === 0
                ? gender0 || 'female'
                : gender1 && gender1 !== 'none'
                  ? gender1
                  : 'male',
          }))
          .filter((p) => p.dataUrl)
        try {
          const locked = await lockPoseFacesOntoResult(displayForCheck, photos, {
            preferPaste: true,
            skipPasteFallback: false,
            hardLimitSec: 16,
          })
          if (locked?.url && (locked.locked || 0) > 0) outUrl = locked.url
        } catch (err) {
          console.warn('scene body face lock failed', err)
        }
      }
      const shown = await displayResult(outUrl)
      if (!shown) return
      setStatus('완성! 한글 요청으로 장면을 만들었어요. 아래 결과를 확인하세요.', false)
    } catch (error) {
      setStatus(`오류: ${error instanceof Error ? error.message : String(error)}`, true)
    } finally {
      if (runBtnEl) runBtnEl.disabled = false
    }
  }

  async function composePoseStartCanvas(images, aspectRatio, close, opts) {
    const loaded = []
    for (const src of images) loaded.push(await loadHtmlImage(src))
    const [cw, ch] = sceneCanvasSize(aspectRatio || '9:16')
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#c8c8c8'
    ctx.fillRect(0, 0, cw, ch)
    const fill = Boolean(opts && opts.fill)
    const drawOne = (img, cx, maxW) => {
      const scale = Math.min((ch * 0.92) / Math.max(img.naturalHeight, 1), maxW / Math.max(img.naturalWidth, 1))
      const dw = Math.round(img.naturalWidth * scale)
      const dh = Math.round(img.naturalHeight * scale)
      ctx.drawImage(img, Math.round(cx - dw / 2), Math.round(ch - dh - ch * 0.02), dw, dh)
    }
    if (loaded.length < 2) {
      drawOne(loaded[0], cw * 0.5, cw * (fill ? 0.78 : 0.62))
    } else {
      const maxW = fill ? cw * 0.5 : cw * (close ? 0.46 : 0.38)
      drawOne(loaded[0], cw * (close ? 0.44 : fill ? 0.26 : 0.32), maxW)
      drawOne(loaded[1], cw * (close ? 0.56 : fill ? 0.74 : 0.68), maxW)
    }
    return canvas.toDataURL('image/jpeg', 0.92)
  }

  async function composeCowgirlStartCanvas(womanSrc, manSrc, aspectRatio) {
    const woman = await loadHtmlImage(womanSrc)
    const man = await loadHtmlImage(manSrc)
    const [cw, ch] = sceneCanvasSize(aspectRatio || '9:16')
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, cw, ch)
    const cover = Math.max(cw / Math.max(man.naturalWidth, 1), ch / Math.max(man.naturalHeight, 1))
    const mw = man.naturalWidth * cover
    const mh = man.naturalHeight * cover
    ctx.drawImage(man, Math.round((cw - mw) / 2), Math.round((ch - mh) / 2), mw, mh)
    const ws = Math.min((ch * 0.36) / Math.max(woman.naturalHeight, 1), (cw * 0.4) / Math.max(woman.naturalWidth, 1))
    const dw = Math.round(woman.naturalWidth * ws)
    const dh = Math.round(woman.naturalHeight * ws)
    ctx.drawImage(woman, Math.round((cw - dw) / 2), Math.round(ch * 0.34), dw, dh)
    return canvas.toDataURL('image/jpeg', 0.92)
  }

  async function runPoseDrawScene(opts) {
    const { images, gender0, gender1, description, aspectRatio, poseId, runBtnEl } = opts
    if (!images.length) {
      setStatus('사진을 1장 이상 넣어 주세요.', true)
      return
    }
    if (!description || description.trim().length < 4) {
      setStatus('포즈를 고르거나 한글로 적어 주세요.', true)
      return
    }
    const cowgirlAsk = poseId === 'cowgirl' || isCowgirlPoseRequest(description)
    if (cowgirlAsk && images.length < 2) {
      setStatus('기승위는 사진 1 여자, 사진 2 누운 남자가 필요합니다.', true)
      return
    }
    if (cowgirlAsk && gender1 !== 'male') {
      setStatus('기승위는 사진 2 성별을 남성으로 고르세요. 누운 남자 사진을 넣으세요.', true)
      return
    }
    const action = POSE_DRAW_ACTIONS.find((a) => a.id === poseId)
    const contactFromText =
      /키스|입맞춤|섹스|성교|성행위|삽입|포옹|허그|백\s*허그|팔\s*감/i.test(description || '')
    if (action?.couple && images.length < 2) {
      setStatus('이 포즈는 사진 2장이 필요합니다.', true)
      return
    }
    if (runBtnEl) runBtnEl.disabled = true
    if (resultImg) resultImg.hidden = true
    if (resultActions) resultActions.hidden = true
    if (resultPlaceholder) resultPlaceholder.hidden = false
    try {
      const splitTwo =
        !cowgirlAsk &&
        images.length >= 2 &&
        gender0 &&
        gender1 &&
        gender1 !== 'none' &&
        gender0 !== gender1

      let posedClean
      if (cowgirlAsk) {
        setStatus('기승위 시험 · 누운 남자 위에 올리는 중…', false)
        const start = await composeCowgirlStartCanvas(images[0], images[1], aspectRatio || '9:16')
        const job = await postTaleSceneJob(
          {
            composeMode: 'pose-draw',
            poseId: 'cowgirl',
            photoCount: 2,
            images: [start],
            description: description.trim(),
            photoreal: true,
            refKind: 'pose',
            aspectRatio: aspectRatio || '9:16',
            gender0,
            gender1,
          },
          '기승위 그리는 중',
          160,
        )
        if (!job || job.auth) return
        const displayForCheck =
          job.imageUrl.startsWith('data:') || job.imageUrl.startsWith('blob:')
            ? job.imageUrl
            : (await toDisplayUrl(job.imageUrl)) || job.imageUrl
        if (await isNearlyBlackImage(displayForCheck)) {
          setStatus('엔진이 결과를 비웠어요. 누운 남자 전신 사진으로 다시 시도해 주세요.', true)
          return
        }
        posedClean = await cleanResultHalo(displayForCheck)
      } else if (splitTwo) {
        const runSolo = async (dataUrl, gender, label) => {
          const start = await composePoseStartCanvas([dataUrl], aspectRatio || '9:16', false)
          const payload = {
            composeMode: 'pose-draw',
            poseId: 'nude',
            photoCount: 1,
            images: [start],
            description: gender === 'male' ? '성인 남성 전신 나체, 실사' : '성인 여성 전신 나체, 실사',
            photoreal: true,
            refKind: 'pose',
            aspectRatio: aspectRatio || '9:16',
            gender0: gender,
          }
          const job = await postTaleSceneJob(payload, label, 160)
          if (!job || job.auth) return job
          const stable = await ensureStableDataUrl(job.imageUrl)
          if (!stable || (await isNearlyBlackImage(stable))) return null
          return stable
        }
        setStatus('포즈 그리기 · 여자 몸 그리는 중…', false)
        const womanFirst = gender0 === 'female'
        const a = await runSolo(
          images[0],
          gender0,
          womanFirst ? '여자 나체 그리는 중' : '남자 나체 그리는 중',
        )
        if (!a || a.auth) return
        setStatus('포즈 그리기 · 사진 1 얼굴 넣는 중…', false)
        const lockedA = await lockPoseFacesOntoResult(a, [{ dataUrl: images[0], gender: gender0 }])
        if (lockedA.aborted) return
        setStatus('포즈 그리기 · 남자 몸 그리는 중…', false)
        const b = await runSolo(
          images[1],
          gender1,
          womanFirst ? '남자 나체 그리는 중' : '여자 나체 그리는 중',
        )
        if (!b || b.auth) return
        setStatus('포즈 그리기 · 사진 2 얼굴 넣는 중…', false)
        const lockedB = await lockPoseFacesOntoResult(b, [{ dataUrl: images[1], gender: gender1 }])
        if (lockedB.aborted) return
        posedClean = await cleanResultHalo(
          await composePoseStartCanvas(
            [lockedA.url || a, lockedB.url || b],
            aspectRatio || '9:16',
            false,
            { fill: true },
          ),
        )
        const locked = {
          url: posedClean,
          locked: (lockedA.locked || 0) + (lockedB.locked || 0),
          wanted: 2,
          message: lockedA.message || lockedB.message || '',
          method: lockedA.method === 'paste' || lockedB.method === 'paste' ? 'paste' : lockedA.method || lockedB.method,
        }
        const shown = await displayResult(posedClean)
        if (!shown) return
        const label = action?.label || '포즈'
        if (locked.wanted && locked.locked < locked.wanted) {
          const why = locked.message ? ` (${locked.message})` : ''
          setStatus(
            `몸은 그렸습니다. 얼굴 교체가 ${locked.locked}/${locked.wanted}만 됐습니다.${why} 다시 실행해 보세요.`,
            true,
          )
          return
        }
        if (!locked.locked) {
          const why = locked.message ? ` (${locked.message})` : ''
          setStatus(`몸은 그렸습니다. 얼굴 교체가 안 됐습니다.${why} 다시 실행해 보세요.`, true)
          return
        }
        if (action?.couple || contactFromText) {
          setStatus(
            '남녀 나체에 올린 얼굴을 넣었습니다. 포옹·키스·밀착은 증명사진에서 안 되어 나란히만 붙였습니다.',
            false,
          )
          return
        }
        setStatus(`완성! ${label}. 각자 그린 뒤 올린 얼굴로 교체했습니다.`, false)
        return
      } else {
        setStatus('포즈 그리기 · 성인 엔진에 넣는 중…', false)
        const closeBodies = Boolean(action?.couple) || (images.length >= 2 && contactFromText)
        const start = await composePoseStartCanvas(images, aspectRatio || '9:16', closeBodies)
        const job = await postTaleSceneJob(
          {
            composeMode: 'pose-draw',
            poseId: poseId || '',
            photoCount: images.length,
            images: [start],
            description: description.trim(),
            photoreal: true,
            refKind: 'pose',
            aspectRatio: aspectRatio || '9:16',
            gender0,
            gender1,
          },
          '성인 엔진 그리는 중',
          160,
        )
        if (!job || job.auth) return
        const displayForCheck =
          job.imageUrl.startsWith('data:') || job.imageUrl.startsWith('blob:')
            ? job.imageUrl
            : (await toDisplayUrl(job.imageUrl)) || job.imageUrl
        if (await isNearlyBlackImage(displayForCheck)) {
          setStatus('엔진이 결과를 비웠어요(검은 화면). 포즈를 조금 바꿔 다시 시도해 주세요.', true)
          return
        }
        posedClean = await cleanResultHalo(displayForCheck)
      }
      setStatus('포즈는 됐습니다. 올린 얼굴로 교체하는 중…', false)
      const facePhotos = images.map((dataUrl, i) => ({
        dataUrl,
        gender: i === 0 ? gender0 : gender1,
      }))
      const locked = await lockPoseFacesOntoResult(posedClean, facePhotos)
      if (locked.aborted) return
      const shown = await displayResult(await cleanResultHalo(locked.url))
      if (!shown) return
      const label = action?.label || '포즈'
      if (locked.wanted && locked.locked < locked.wanted) {
        const why = locked.message ? ` (${locked.message})` : ''
        setStatus(
          `포즈는 됐습니다. 얼굴 교체가 ${locked.locked}/${locked.wanted}만 됐습니다.${why} 다시 실행해 보세요.`,
          true,
        )
        return
      }
      if (!locked.locked) {
        const why = locked.message ? ` (${locked.message})` : ''
        setStatus(`포즈는 됐습니다. 얼굴 교체가 안 됐습니다.${why} 다시 실행해 보세요.`, true)
        return
      }
      if (locked.method === 'paste') {
        setStatus(
          `완성! ${label}. 포즈는 됐고, 교체 엔진이 거절해서 올린 얼굴을 붙였습니다.`,
          false,
        )
        return
      }
      if (cowgirlAsk) {
        setStatus(
          '기승위 시험 결과입니다. 안 되면 누운 남자 전신으로 다시 해 보세요. 쇼츠는 안 합니다.',
          false,
        )
        return
      }
      if (splitTwo && (action?.couple || contactFromText)) {
        setStatus(
          '남녀 나체는 따로 그렸습니다. 포옹·키스·밀착은 증명사진에서 안 되어 억지로 넣지 않았습니다.',
          false,
        )
        return
      }
      setStatus(`완성! ${label}. 포즈를 그린 뒤 올린 얼굴로 교체했습니다.`, false)
    } catch (error) {
      setStatus(`오류: ${error instanceof Error ? error.message : String(error)}`, true)
    } finally {
      if (runBtnEl) runBtnEl.disabled = false
    }
  }

  document.getElementById('fs-scene-pose-run')?.addEventListener('click', () => {
    const g1 = document.getElementById('fs-scene-pose-gender1')?.value || 'none'
    if (sceneState.pose1 && g1 === 'none') {
      setStatus('사진 2가 있는데 성별이 「사용 안 함」이에요. 성별을 고른 뒤 다시 실행하세요.', true)
      return
    }
    const images = [sceneState.pose0, g1 !== 'none' ? sceneState.pose1 : null].filter(Boolean)
    if (g1 !== 'none' && !sceneState.pose1) {
      setStatus('사진 2를 넣거나 「사용 안 함」으로 바꿔 주세요.', true)
      return
    }
    void runPoseDrawScene({
      images,
      gender0: document.getElementById('fs-scene-pose-gender0')?.value || 'female',
      gender1: g1,
      description: document.getElementById('fs-scene-pose-desc')?.value || '',
      aspectRatio: document.getElementById('fs-scene-pose-ratio')?.value || '9:16',
      poseId: poseDrawCombo.actionId,
      runBtnEl: document.getElementById('fs-scene-pose-run'),
    })
  })

  document.getElementById('fs-scene-face-run')?.addEventListener('click', () => {
    const g1 = document.getElementById('fs-scene-gender1')?.value || 'none'
    // 사진이 있는데 사용 안 함이면 경고 (남자 얼굴이 안 맞는 사고 방지)
    if (sceneState.face1 && g1 === 'none') {
      setStatus(
        '사진 2가 있는데 성별이 「사용 안 함」이에요. 성별을 고른 뒤 다시 실행하세요.',
        true,
      )
      return
    }
    const images = [sceneState.face0, g1 !== 'none' ? sceneState.face1 : null].filter(Boolean)
    if (g1 !== 'none' && !sceneState.face1) {
      setStatus('사진 2를 넣거나 「사용 안 함」으로 바꿔 주세요.', true)
      return
    }
    void runSceneFromRefs({
      refKind: 'face',
      images,
      gender0: document.getElementById('fs-scene-gender0')?.value || 'female',
      gender1: g1,
      description: document.getElementById('fs-scene-face-desc')?.value || '',
      aspectRatio: document.getElementById('fs-scene-face-ratio')?.value || '9:16',
      expressionMode: document.getElementById('fs-scene-face-expression')?.value || 'id',
      runBtnEl: document.getElementById('fs-scene-face-run'),
    })
  })

  document.getElementById('fs-scene-body-run')?.addEventListener('click', () => {
    const g1 = document.getElementById('fs-scene-body-gender1')?.value || 'none'
    if (sceneState.body1 && g1 === 'none') {
      setStatus(
        '인물 2 사진이 있는데 성별이 「사용 안 함」이에요. 「남성」으로 바꾼 뒤 다시 실행하세요.',
        true,
      )
      return
    }
    const images = [sceneState.body0, g1 !== 'none' ? sceneState.body1 : null].filter(Boolean)
    if (g1 !== 'none' && !sceneState.body1) {
      setStatus('인물 2를 넣거나 「사용 안 함」으로 바꿔 주세요.', true)
      return
    }
    void runSceneFromRefs({
      refKind: 'body',
      images,
      gender0: document.getElementById('fs-scene-body-gender0')?.value || 'female',
      gender1: g1,
      description: document.getElementById('fs-scene-body-desc')?.value || '',
      aspectRatio: document.getElementById('fs-scene-body-ratio')?.value || '9:16',
      expressionMode: document.getElementById('fs-scene-body-expression')?.value || 'id',
      runBtnEl: document.getElementById('fs-scene-body-run'),
    })
  })

  async function bakeShortsIdentityOnBodyFrame(frameUrl, idUrl, motion) {
    const frame = await compressToJpegDataUrl(frameUrl, 1280, 0.86)
    const id = await compressToJpegDataUrl(idUrl, 1024, 0.86)
    if (!frame || !id) return null
    const job = await postTaleSceneJob(
      {
        composeMode: 'identity-continue',
        images: [frame, id],
        description: String(motion || '').trim() || '같은 인물 유지',
        photoreal: true,
        refKind: 'body',
        aspectRatio: shortsAspectFromSize(currentResult.size),
        gender0: 'female',
      },
      '인물 맞춤',
      120,
    )
    if (!job || job.auth) return job?.auth ? { aborted: true } : null
    if (!job.imageUrl) return null
    const url = await ensureStableDataUrl(job.imageUrl)
    if (!url || (await isNearlyBlackImage(url))) return null
    return { url }
  }

  async function lockShortsIdentityOntoFrame(frameUrl, idUrl, opts) {
    if (!frameUrl || !idUrl) return { url: frameUrl, locked: 0, reason: 'missing' }
    if (typeof deskLockedCast === 'function' && deskLockedCast().sceneInWomanSlot) {
      return { url: frameUrl, locked: 0, reason: 'scene_cast' }
    }
    const frame = await ensureStableDataUrl(frameUrl)
    const id = await ensureStableDataUrl(idUrl)
    if (!frame || !id) return { url: frameUrl, locked: 0, reason: 'missing' }
    const faces = await detectSceneFaceBoxes(frame, 1, { guessIfMissing: false })
    if (faces.length) {
      return lockPoseFacesOntoResult(frame, [{ dataUrl: id, gender: 'female' }], {
        guessIfMissing: false,
      })
    }
    const baked = await bakeShortsIdentityOnBodyFrame(frame, id, opts?.motion)
    if (baked?.aborted) return { url: frame, locked: 0, aborted: true, reason: 'aborted' }
    if (!baked?.url) return { url: frame, locked: 0, reason: 'no_face' }
    const after = await detectSceneFaceBoxes(baked.url, 1, { guessIfMissing: false })
    if (!after.length) return { url: baked.url, locked: 0, baked: true, reason: 'baked_body' }
    const locked = await lockPoseFacesOntoResult(baked.url, [{ dataUrl: id, gender: 'female' }], {
      guessIfMissing: false,
    })
    return { ...locked, baked: true, reason: locked.locked ? 'baked_then_locked' : 'baked_body' }
  }

  globalThis.prepareNudeIdentityStillForShorts = prepareNudeIdentityStillForShorts
  globalThis.motionAfterIdentityStill = motionAfterIdentityStill
  globalThis.lockShortsIdentityOntoFrame = lockShortsIdentityOntoFrame
  globalThis.lockPoseFacesOntoResult = lockPoseFacesOntoResult
  globalThis.postTaleSceneJob = postTaleSceneJob
  globalThis.extendOneIdBody = extendOneIdBody
  globalThis.balanceBodyProportion = balanceBodyProportion
  globalThis.widenMaleTorso = widenMaleTorso
  globalThis.widenWomanFrame = widenWomanFrame
  globalThis.fitKoreanManCanon = fitKoreanManCanon
  globalThis.fitKoreanWomanCanon = fitKoreanWomanCanon
  globalThis.isolateOutpaintedPerson = isolateOutpaintedPerson
  globalThis.extractIdFacePng = extractIdFacePng
  globalThis.paintSeamlessStudio = paintSeamlessStudio
  globalThis.drawFootContactShadow = drawFootContactShadow
  globalThis.detectSceneFaceBoxes = detectSceneFaceBoxes
  globalThis.estimateFaceBoxFromImage = estimateFaceBoxFromImage
  globalThis.cropHeadFromBox = cropHeadFromBox
  globalThis.ensureStableDataUrl = ensureStableDataUrl
  globalThis.cropTargetSide = cropTargetSide
  globalThis.pasteSideOntoFull = pasteSideOntoFull
})()


const DESK_WORKS_KEY = 'storymag-desk-works'

function unpackDeskWork(work) {
  if (!work || typeof work !== 'object') return work
  const next = { ...work }
  if (!next.woman && next.womanFace) next.woman = next.womanFace
  if (!next.man && next.manFace) next.man = next.manFace
  return next
}

function packDeskWork(work) {
  if (!work || typeof work !== 'object') return work
  const next = { ...work }
  if (next.woman && next.woman === next.womanFace) next.woman = ''
  if (next.man && next.man === next.manFace) next.man = ''
  return next
}

function readDeskWorksFromLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(DESK_WORKS_KEY) || '{}')
    const works = Array.isArray(raw.works) ? raw.works.map(unpackDeskWork) : []
    const currentId = typeof raw.currentId === 'string' ? raw.currentId : works[0]?.id || ''
    return { works, currentId }
  } catch {
    return { works: [], currentId: '' }
  }
}

function mergeDeskStores(primary, secondary) {
  const map = new Map()
  for (const work of [...(secondary?.works || []), ...(primary?.works || [])]) {
    if (!work?.id) continue
    const prev = map.get(work.id)
    map.set(work.id, prev ? unpackDeskWork({ ...prev, ...work }) : unpackDeskWork(work))
  }
  const works = [...map.values()]
  const currentId = primary?.currentId || secondary?.currentId || works[0]?.id || ''
  return { works, currentId }
}

function readDeskWorks() {
  if (deskMem) {
    return {
      works: deskMem.works.map(unpackDeskWork),
      currentId: deskMem.currentId,
    }
  }
  return readDeskWorksFromLocal()
}

function writeDeskWorks(data) {
  const currentId = data?.currentId || ''
  const works = Array.isArray(data?.works) ? data.works.map(unpackDeskWork) : []
  deskMem = { works, currentId }
  void persistDeskKeep(deskMem)
}

function persistDeskKeep(store) {
  const payload = {
    currentId: store.currentId || '',
    works: (store.works || []).map(unpackDeskWork),
  }
  return keepDbSet(DESK_WORKS_KEY, payload)
    .then(() => {
      try {
        localStorage.setItem(
          DESK_WORKS_KEY,
          JSON.stringify({
            currentId: payload.currentId,
            works: payload.works.map(packDeskWork),
          }),
        )
      } catch (err) {
        if (isStorageQuotaError(err)) {
          try {
            localStorage.removeItem(DESK_WORKS_KEY)
          } catch {
            /* IndexedDB에 원본이 있으므로 로컬만 비움 */
          }
        }
      }
    })
    .catch((err) => {
      console.warn('desk works save failed', err)
      try {
        localStorage.setItem(
          DESK_WORKS_KEY,
          JSON.stringify({
            currentId: payload.currentId,
            works: payload.works.map(packDeskWork),
          }),
        )
      } catch {
        /* 용량이 차도 CAST 메모리는 유지 */
      }
    })
}

async function hydrateStorymagStores() {
  const localGallery = readGalleryFromLocal()
  const localDesk = readDeskWorksFromLocal()
  try {
    const [idbGallery, idbDesk] = await Promise.all([
      keepDbGet(GALLERY_STORAGE_KEY),
      keepDbGet(DESK_WORKS_KEY),
    ])
    galleryMem = mergeGalleryLists(
      Array.isArray(idbGallery) ? idbGallery : [],
      localGallery,
    )
    deskMem = mergeDeskStores(
      idbDesk && typeof idbDesk === 'object' ? idbDesk : { works: [], currentId: '' },
      localDesk,
    )
  } catch {
    galleryMem = localGallery
    deskMem = localDesk
  }
  await Promise.all([persistGalleryKeep(galleryMem), persistDeskKeep(deskMem)])
  renderGallery()
  if (typeof window.syncDeskWorkUi === 'function') window.syncDeskWorkUi()
  if (typeof restoreDeskWorkScene === 'function') restoreDeskWorkScene()
}

function currentDeskWork() {
  const store = readDeskWorks()
  return store.works.find((work) => work.id === store.currentId) || store.works[0] || null
}

function ensureDeskWork() {
  const store = readDeskWorks()
  if (store.works.length) {
    if (!store.works.some((work) => work.id === store.currentId)) {
      store.currentId = store.works[0].id
      writeDeskWorks(store)
    }
    return currentDeskWork()
  }
  const work = {
    id: `w-${Date.now()}`,
    title: '작품 1',
    woman: '',
    man: '',
    womanFace: '',
    manFace: '',
    womanFull: false,
    manFull: false,
    scene: '',
    scenePrompt: '',
    sceneSize: '',
  }
  writeDeskWorks({ works: [work], currentId: work.id })
  return work
}

function deskIdPhoto(work, role) {
  if (!work) return ''
  const face = role === 'man' ? work.manFace : work.womanFace
  const body = role === 'man' ? work.man : work.woman
  if (face && !/^data:image\/png/i.test(String(face))) return face
  return body || face || ''
}

function deskMwPatch(extra) {
  return {
    sourceCast: 'mw',
    verifiedSourceCast: 'mw',
    pair: 'mw',
    peopleCount: 2,
    ...(extra || {}),
  }
}

function deskTwoPeopleChecked() {
  return Boolean(document.getElementById('desk-two-people')?.checked)
}

/** 여 칸 커플 장면·두 사람 체크는 제품이 여남이다. 얼굴 수 실패로 혼자 녹이지 않는다. */
function deskLockMwWomanScene(work, extra) {
  const w = work || currentDeskWork() || {}
  if (!w.woman) return w
  if (w.verifiedSourceCast === 'mw' || (w.woman && w.man)) {
    if (w.woman && w.man && w.verifiedSourceCast !== 'mw') {
      return updateCurrentDeskWork(deskMwPatch({ sourceKind: 'pair', ...(extra || {}) }))
    }
    return w
  }
  return updateCurrentDeskWork(
    deskMwPatch({
      sourceKind: w.man ? 'pair' : 'scene',
      womanFull: w.womanFull || Boolean(extra?.womanFull),
      ...(extra || {}),
    }),
  )
}

/** 여 칸 이름과 사진 속 인원·성별을 섞지 않는다. 여여는 통과시키지 않는다. */
function deskLockedCast(work) {
  const w = work || currentDeskWork() || {}
  const bothSlots = Boolean(w.woman && w.man)
  const stored = Number(w.peopleCount) || 0
  const verifiedSourceCast = bothSlots || w.verifiedSourceCast === 'mw' ? 'mw' : ''
  const peopleCount = Math.max(
    stored,
    bothSlots ? 2 : verifiedSourceCast === 'mw' ? 2 : w.woman || w.man ? 1 : 0,
  )
  const sourceCast = verifiedSourceCast === 'mw' ? 'mw' : ''
  const unverified = peopleCount >= 2 && !sourceCast
  const sourceKind =
    w.sourceKind === 'scene' || w.sourceKind === 'portrait' || w.sourceKind === 'pair'
      ? w.sourceKind
      : peopleCount >= 2 && !bothSlots
        ? 'scene'
        : bothSlots
          ? 'pair'
          : peopleCount
            ? 'portrait'
            : ''
  const people =
    sourceCast === 'mw'
      ? [
          { index: 0, gender: 'female', action: 'edit' },
          { index: 1, gender: 'male', action: 'preserve' },
        ]
      : peopleCount === 1 && w.man && !w.woman
        ? [{ index: 0, gender: 'male', action: 'edit' }]
        : peopleCount === 1
          ? [{ index: 0, gender: 'female', action: 'edit' }]
          : []
  return {
    sourceKind,
    peopleCount,
    sourceCast,
    verifiedSourceCast: sourceCast,
    unverified,
    genders: people.map((p) => p.gender),
    people,
    targetPersonIndex: 0,
    preservePersonIndexes: people.filter((p) => p.action === 'preserve').map((p) => p.index),
    couple: peopleCount >= 2,
    hetero: sourceCast === 'mw',
    sceneInWomanSlot: sourceKind === 'scene' && Boolean(w.woman) && !w.man,
  }
}

function deskCastUnverified(work) {
  const cast = deskLockedCast(work)
  return cast.peopleCount > 1 && !cast.verifiedSourceCast
}

function deskFaceRefs(work) {
  const w = work || currentDeskWork()
  const cast = deskLockedCast(w)
  if (cast.sceneInWomanSlot) return []
  const refs = []
  const woman = deskIdPhoto(w, 'woman')
  const man = deskIdPhoto(w, 'man')
  if (woman && man && woman === man) return []
  if (woman) refs.push({ dataUrl: woman, gender: 'female', targetPersonIndex: 0 })
  if (man) refs.push({ dataUrl: man, gender: 'male', targetPersonIndex: 1 })
  return refs
}

function deskCastPhotos() {
  return deskFaceRefs(currentDeskWork()).map((ref) => ({ dataUrl: ref.dataUrl, gender: ref.gender }))
}

/** 여 칸 커플 원본에서 왼쪽·오른쪽 얼굴을 잘라 고정한다. CAST 칸을 머리 크롭으로 덮지 않는다. */
async function deskScenePairFacePhotos(work) {
  const w = work || currentDeskWork() || {}
  const scene = w.womanLock || deskIdPhoto(w, 'woman') || w.woman || ''
  if (!scene || typeof globalThis.detectSceneFaceBoxes !== 'function') return []
  try {
    const stable =
      typeof globalThis.ensureStableDataUrl === 'function'
        ? await globalThis.ensureStableDataUrl(scene)
        : scene
    const boxes = await globalThis.detectSceneFaceBoxes(stable, 2, {
      guessIfMissing: false,
      mergeIou: 0.45,
    })
    if (!Array.isArray(boxes) || boxes.length < 2) return []
    const sorted = boxes.slice().sort((a, b) => a.x - b.x)
    const left = await globalThis.cropHeadFromBox(stable, sorted[0])
    const right = await globalThis.cropHeadFromBox(stable, sorted[sorted.length - 1])
    if (!left?.dataUrl || !right?.dataUrl) return []
    return [
      { dataUrl: left.dataUrl, gender: 'male' },
      { dataUrl: right.dataUrl, gender: 'female' },
    ]
  } catch (err) {
    console.warn('desk scene pair faces failed', err)
    return []
  }
}

/** 여 칸 커플: 오른쪽 사람만 잘라 유료 엔진에 보낸다. 왼쪽 남자 화소는 안 보낸다. */
async function cropDeskRightPerson(imageSrc) {
  return cropDeskWomanFromFaces(imageSrc)
}

async function cropDeskWomanFromFaces(imageSrc, faces) {
  if (!imageSrc) return null
  let list = Array.isArray(faces) ? faces.filter((b) => b && b.w > 0 && b.h > 0) : []
  if (list.length < 2 && typeof globalThis.detectSceneFaceBoxes === 'function') {
    const stable =
      typeof globalThis.ensureStableDataUrl === 'function'
        ? await globalThis.ensureStableDataUrl(imageSrc)
        : imageSrc
    const boxes = await globalThis.detectSceneFaceBoxes(stable, 2, {
      guessIfMissing: false,
      mergeIou: 0.45,
    })
    list = (Array.isArray(boxes) ? boxes : []).filter((b) => b && b.w >= 0.018 && b.h >= 0.022)
  }
  if (list.length < 2) {
    const img = await loadDeskImage(imageSrc)
    const w = img.naturalWidth || 1
    const h = img.naturalHeight || 1
    const sx = Math.round(w * 0.5)
    const sw = Math.max(32, w - sx)
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = h
    canvas.getContext('2d').drawImage(img, sx, 0, sw, h, 0, 0, sw, h)
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), sx, sy: 0, sw, sh: h, fullW: w, fullH: h }
  }
  const woman =
    list.find((f) => f.slot === 'woman') || list.slice().sort((a, b) => a.x - b.x)[list.length > 1 ? 1 : 0]
  const man = list.find((f) => f.slot === 'man') || list.slice().sort((a, b) => a.x - b.x)[0]
  const img = await loadDeskImage(imageSrc)
  const w = img.naturalWidth || 1
  const h = img.naturalHeight || 1
  const wcx = (woman.x + woman.w / 2) * w
  const mcx = (man.x + man.w / 2) * w
  const mid = Math.round((wcx + mcx) / 2)
  const womanRight = wcx >= mcx
  const sx = womanRight ? Math.max(0, mid) : 0
  const sw = womanRight ? Math.max(32, w - sx) : Math.max(32, mid)
  if (sw < w * 0.22 || sw > w * 0.78) return null
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = h
  canvas.getContext('2d').drawImage(img, sx, 0, sw, h, 0, 0, sw, h)
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), sx, sy: 0, sw, sh: h, fullW: w, fullH: h }
}

async function pasteDeskRectOntoFull(fullSrc, pieceSrc, rect) {
  const base = await loadDeskImage(fullSrc)
  const piece = await loadDeskImage(pieceSrc)
  const w = base.naturalWidth || rect.fullW
  const h = base.naturalHeight || rect.fullH
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(base, 0, 0, w, h)
  const layer = document.createElement('canvas')
  layer.width = w
  layer.height = h
  const lx = layer.getContext('2d')
  lx.drawImage(piece, rect.sx, rect.sy, rect.sw, rect.sh)
  const feather = Math.max(16, Math.round(rect.sw * 0.08))
  const fade = lx.createLinearGradient(rect.sx, 0, rect.sx + feather, 0)
  fade.addColorStop(0, 'rgba(0,0,0,0)')
  fade.addColorStop(1, 'rgba(0,0,0,1)')
  lx.globalCompositeOperation = 'destination-in'
  lx.fillStyle = '#000'
  lx.fillRect(rect.sx + feather, 0, Math.max(1, w - rect.sx - feather), h)
  lx.fillStyle = fade
  lx.fillRect(rect.sx, 0, feather, h)
  ctx.drawImage(layer, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92)
}

function updateCurrentDeskWork(patch) {
  const store = readDeskWorks()
  const idx = store.works.findIndex((work) => work.id === store.currentId)
  if (idx < 0) return currentDeskWork()
  store.works[idx] = { ...store.works[idx], ...patch }
  writeDeskWorks(store)
  return store.works[idx]
}

function createDeskWork() {
  const work = {
    id: `w-${Date.now()}`,
    title: '작품 1',
    woman: '',
    man: '',
    womanFace: '',
    manFace: '',
    womanFull: false,
    manFull: false,
    scene: '',
    scenePrompt: '',
    sceneSize: '',
  }
  writeDeskWorks({ works: [work], currentId: work.id })
  return work
}

function selectDeskWork(id) {
  const store = readDeskWorks()
  if (!store.works.some((work) => work.id === id)) return currentDeskWork()
  store.currentId = id
  writeDeskWorks(store)
  return currentDeskWork()
}

async function captureDeskLeadsFromScene(imageUrl) {
  if (!imageUrl || typeof globalThis.detectSceneFaceBoxes !== 'function') {
    return { count: 0 }
  }
  const stable =
    typeof globalThis.ensureStableDataUrl === 'function'
      ? await globalThis.ensureStableDataUrl(imageUrl)
      : imageUrl
  const boxes = await globalThis.detectSceneFaceBoxes(stable, 2, {
    guessIfMissing: false,
    mergeIou: 0.45,
  })
  if (!boxes.length) return { count: 0 }
  const sorted = boxes.slice().sort((a, b) => a.x - b.x)
  const left = await globalThis.cropHeadFromBox(stable, sorted[0])
  const right = sorted[1] ? await globalThis.cropHeadFromBox(stable, sorted[1]) : null
  if (!right) {
    const work = currentDeskWork()
    updateCurrentDeskWork({
      woman: work?.woman || stable,
      womanLock: work?.womanLock || work?.woman || stable,
    })
    return { count: 1 }
  }
  const layout = deskLayoutFromSceneFaces(sorted, currentDeskWork())
  updateCurrentDeskWork(
    deskMwPatch({
      woman: stable,
      womanLock: stable,
      womanFace: stable,
      womanFull: true,
      man: '',
      manFace: '',
      manCastId: '',
      manCastLock: null,
      manFull: false,
      assembledPair: true,
      sourceKind: 'scene',
      peopleCount: 2,
      castLayout: layout,
      scene: stable,
    }),
  )
  setTwoPeopleChecked(true)
  return { count: 2 }
}

function swapDeskCastSlots() {
  const work = currentDeskWork()
  if (!work) return
  updateCurrentDeskWork({
    woman: work.man || '',
    man: work.woman || '',
    womanFace: work.manFace || work.man || '',
    manFace: work.womanFace || work.woman || '',
    womanFull: Boolean(work.manFull),
    manFull: Boolean(work.womanFull),
  })
}

/** 몸 잇기를 멈춘 구체적 이유가 최근에 있으면 그것을, 없으면 기본 실패 문구를 돌려준다 (일반 문구가 이유를 덮어쓰지 않게) */
function deskBodyFail(defaultText) {
  const r = window.__deskBodyStop
  if (r && r.text && Date.now() - r.at < 180000) return r.text
  return defaultText
}

async function compactDeskScene(src, maxEdge = 1920, quality = 0.92) {
  const img = await loadDeskImage(src)
  const w0 = img.naturalWidth || 1
  const h0 = img.naturalHeight || 1
  const scale = Math.min(1, maxEdge / Math.max(w0, h0))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w0 * scale))
  canvas.height = Math.max(1, Math.round(h0 * scale))
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

async function persistDeskWorkScene(imageUrl) {
  if (window.__deskSkipScenePersist) return
  if (typeof getAppArea === 'function' && getAppArea() !== 'admin') return
  if (!currentDeskWork() || !imageUrl) return
  let compact = imageUrl
  try {
    if (typeof globalThis.ensureStableDataUrl === 'function' && !String(imageUrl).startsWith('data:image/')) {
      compact = (await globalThis.ensureStableDataUrl(imageUrl)) || imageUrl
    }
    if (String(compact).startsWith('data:image/')) {
      compact = await compactDeskScene(compact, 1280, 0.86)
    }
  } catch (err) {
    console.warn('desk scene compact failed', err)
  }
  const patch = {
    scene: compact,
    scenePrompt: currentResult.prompt || '',
    sceneSize: currentResult.size || '',
  }
  const retries = [
    [960, 0.78],
    [720, 0.72],
  ]
  try {
    updateCurrentDeskWork(patch)
  } catch {
    for (const [edge, q] of retries) {
      try {
        patch.scene = await compactDeskScene(compact, edge, q)
        updateCurrentDeskWork(patch)
        return
      } catch (_) {
        /* quota — try smaller */
      }
    }
    console.warn('desk scene save failed')
  }
}

function restoreDeskWorkScene() {
  const work = currentDeskWork()
  if (!work?.scene) return false
  showResult(work.scene, '작품 지금 장', false, {
    accepted: true,
    prompt: work.scenePrompt || currentResult.prompt || '',
    size: work.sceneSize || currentResult.size || document.getElementById('size')?.value || 'story',
    genMode: 'fashion',
    engine: 'desk-scene',
    isShortsEndFrame: true,
  })
  const lead = deskIdPhoto(work, 'woman') || deskIdPhoto(work, 'man')
  if (lead) shortsFaceIdStill = lead
  return true
}

function clearDeskStage() {
  currentResult.imageUrl = ''
  currentResult.imageDataUrl = null
  currentResult.isShortsEndFrame = false
  currentResult.prompt = ''
  shortsFaceIdStill = null
  if (typeof hideVideoResult === 'function') hideVideoResult()
  const img = document.getElementById('result-image')
  if (img) img.removeAttribute('src')
  const section = document.getElementById('result-section')
  if (section) section.hidden = true
}

function clearDeskWorkScene() {
  window.__deskSkipScenePersist = true
  try {
    updateCurrentDeskWork({ scene: '', scenePrompt: '', sceneSize: '' })
  } catch (_) {
    /* quota */
  }
  clearDeskStage()
  window.__deskSkipScenePersist = false
}

function clearDeskWorkCast() {
  window.__deskSkipScenePersist = true
  try {
    updateCurrentDeskWork({
      woman: '',
      man: '',
      womanFace: '',
      manFace: '',
      womanFull: false,
      manFull: false,
      peopleCount: 0,
      sourceKind: '',
      sourceCast: '',
      verifiedSourceCast: '',
      pair: '',
      scene: '',
      scenePrompt: '',
      sceneSize: '',
    })
  } catch (_) {
    /* quota */
  }
  clearDeskStage()
  window.__deskSkipScenePersist = false
  if (typeof window.syncDeskWorkUi === 'function') window.syncDeskWorkUi()
}

window.persistDeskWorkScene = persistDeskWorkScene
window.clearDeskWorkScene = clearDeskWorkScene
window.clearDeskWorkCast = clearDeskWorkCast

async function applyDeskWorkFaces(imageUrl, opts) {
  const photos =
    Array.isArray(opts?.photos) && opts.photos.length ? opts.photos.filter(Boolean) : deskCastPhotos()
  if (!photos.length || typeof globalThis.lockPoseFacesOntoResult !== 'function') {
    return { url: imageUrl, locked: 0 }
  }
  if (photos.length === 1 && typeof countDeskSceneFaces === 'function') {
    const faces = await countDeskSceneFaces(imageUrl)
    if (faces >= 2) {
      return { url: imageUrl, locked: 0, skipped: true, reason: 'extra_person' }
    }
  }
  const preferPaste = Boolean(opts?.preferPaste)
  const fast = Boolean(opts?.fast) && !preferPaste
  const result = await globalThis.lockPoseFacesOntoResult(imageUrl, photos, {
    guessIfMissing: photos.length >= 2 ? false : undefined,
    hardLimitSec: opts?.hardLimitSec ?? (fast || preferPaste ? 16 : undefined),
    engineOrder: preferPaste ? undefined : fast ? ['insight'] : opts?.engineOrder,
    skipPasteFallback: preferPaste ? false : fast || Boolean(opts?.skipPasteFallback),
    preferPaste,
  })
  if (photos.length >= 2 && (result?.locked || 0) < 2) {
    if ((result?.locked || 0) > 0 && result?.url) {
      return { url: result.url, locked: result.locked, skipped: false, reason: 'partial_faces' }
    }
    return { url: imageUrl, locked: 0, skipped: true, reason: result?.reason || 'need_two_faces' }
  }
  return result
}

function loadDeskImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('desk_image_load'))
    img.src = src
  })
}

function deskComposeKind() {
  const size = currentResult?.size || document.getElementById('size')?.value || 'story'
  if (size === 'landscape') return 'landscape'
  if (size === 'square') return 'square'
  return 'story'
}

function deskComposeSize() {
  if (globalThis.DeskPipeline?.composeSize) return globalThis.DeskPipeline.composeSize(deskComposeKind())
  const kind = deskComposeKind()
  if (kind === 'landscape') return [1920, 1248]
  if (kind === 'square') return [1536, 1536]
  return [1248, 1920]
}

function paintDeskStudio(ctx, cw, ch) {
  if (typeof globalThis.paintSeamlessStudio === 'function') {
    globalThis.paintSeamlessStudio(ctx, cw, ch)
    return
  }
  const wall = ctx.createLinearGradient(0, 0, 0, ch)
  wall.addColorStop(0, '#f4f4f4')
  wall.addColorStop(0.72, '#ececec')
  wall.addColorStop(1, '#d8d8d8')
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, cw, ch)
}

function deskSourceSize(src) {
  return {
    w: src.naturalWidth || src.width || 1,
    h: src.naturalHeight || src.height || 1,
  }
}

async function deskIsolatePerson(src) {
  if (typeof globalThis.isolateOutpaintedPerson === 'function') {
    try {
      const cut = await globalThis.isolateOutpaintedPerson(src, '', { localOnly: true })
      if (cut && cut.width > 24 && cut.height > 24) return cut
    } catch (err) {
      console.warn('desk isolate failed', err)
    }
  }
  const img = await loadDeskImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext('2d').drawImage(img, 0, 0)
  return canvas
}

function deskFitBodyScale(src, cw, ch, heightFactor) {
  const { w, h } = deskSourceSize(src)
  const targetH = ch * 0.86 * (heightFactor || 1)
  return Math.min(targetH / Math.max(h, 1), (cw * 0.4) / Math.max(w, 1), (ch * 0.9) / Math.max(h, 1))
}

async function deskFacesHold(source, display) {
  const skip = { ok: true, skipped: true }
  if (!source || !display) return skip
  const runtime = globalThis.DeskLookRuntime
  if (!runtime || typeof runtime.embedCast !== 'function' || typeof deskVecCos !== 'function') return skip
  try {
    const srcFace = await globalThis.estimateFaceBoxFromImage(source)
    const outFace = await globalThis.estimateFaceBoxFromImage(display)
    if (!srcFace || !outFace) return skip
    const left = await runtime.embedCast(source, srcFace)
    const right = await runtime.embedCast(display, outFace)
    if (!left?.ok || !right?.ok) return skip
    return { ok: deskVecCos(left.vec, right.vec) >= 0.42, skipped: false }
  } catch (_) {
    return skip
  }
}

async function deskLooksLikeHintPlate(display) {
  if (!display) return false
  if (typeof looksLikeHoldingBoard === 'function' && (await looksLikeHoldingBoard(display))) return true
  const img = await loadDeskImage(display)
  if (!img.naturalWidth || !img.naturalHeight) return false
  const w = Math.min(200, img.naturalWidth)
  const h = Math.min(300, img.naturalHeight)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const bandFrac = (ya, yb, test) => {
    const x0 = Math.round(w * 0.28)
    const x1 = Math.round(w * 0.72)
    let n = 0
    let hit = 0
    for (let y = Math.round(h * ya); y < Math.round(h * yb); y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * w + x) * 4
        n += 1
        if (test(data[i], data[i + 1], data[i + 2])) hit += 1
      }
    }
    return n > 20 ? hit / n : 0
  }
  const beige = (r, g, b) => {
    const luma = r * 0.299 + g * 0.587 + b * 0.114
    const sat = Math.max(r, g, b) - Math.min(r, g, b)
    return luma > 165 && luma < 220 && sat >= 12 && sat <= 55 && r >= g - 8 && g >= b - 8
  }
  const white = (r, g, b) => {
    const luma = r * 0.299 + g * 0.587 + b * 0.114
    const sat = Math.max(r, g, b) - Math.min(r, g, b)
    return luma > 220 && sat < 22
  }
  if (bandFrac(0.4, 0.62, beige) >= 0.45 && bandFrac(0.22, 0.36, beige) < 0.15) return true
  let run = 0
  let best = 0
  const y0 = Math.round(h * 0.38)
  const y1 = Math.round(h * 0.62)
  const mid0 = Math.round(w * 0.28)
  const mid1 = Math.round(w * 0.72)
  const midW = Math.max(1, mid1 - mid0)
  for (let y = y0; y < y1; y += 1) {
    let whiteN = 0
    for (let x = mid0; x < mid1; x += 1) {
      const i = (y * w + x) * 4
      if (white(data[i], data[i + 1], data[i + 2])) whiteN += 1
    }
    if (whiteN / midW > 0.82) {
      run += 1
      if (run > best) best = run
    } else run = 0
  }
  return best >= Math.max(5, Math.round(h * 0.07))
}

async function deskClothRgb(url, ya, yb, opts) {
  const img = await loadDeskImage(url)
  const w = Math.min(160, img.naturalWidth)
  const h = Math.min(240, img.naturalHeight)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const x0 = Math.round(w * 0.34)
  const x1 = Math.round(w * 0.66)
  const bright = Boolean(opts?.bright)
  const minL = bright ? 160 : 28
  const maxSkip = bright ? 244 : 228
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let y = Math.round(h * ya); y < Math.round(h * yb); y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * w + x) * 4
      const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      const sat = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2])
      if (luma > maxSkip && sat < 14) continue
      if (luma < minL) continue
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      n += 1
    }
  }
  if (n < 30) return { r: 128, g: 128, b: 128, luma: 128, hex: '' }
  r = Math.round(r / n)
  g = Math.round(g / n)
  b = Math.round(b / n)
  const luma = r * 0.299 + g * 0.587 + b * 0.114
  const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
  return { r, g, b, luma, hex }
}

async function deskJacketSideLuma(url, ya, yb, bands) {
  const img = await loadDeskImage(url)
  const w = Math.min(160, img.naturalWidth)
  const h = Math.min(240, img.naturalHeight)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const use = Array.isArray(bands) && bands.length ? bands : [
    [0.32, 0.42],
    [0.58, 0.68],
  ]
  let sum = 0
  let n = 0
  for (const [xa, xb] of use) {
    const x0 = Math.round(w * xa)
    const x1 = Math.round(w * xb)
    for (let y = Math.round(h * ya); y < Math.round(h * yb); y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * w + x) * 4
        const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
        const sat = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2])
        if (luma > 228 && sat < 14) continue
        sum += luma
        n += 1
      }
    }
  }
  return n > 20 ? sum / n : 200
}

async function deskChestLuma(url, ya, yb) {
  const rgb = await deskClothRgb(url, ya, yb)
  return rgb.luma
}

async function deskJacketDrifted(source, display) {
  if (!source || !display) return false
  try {
    const srcL = await deskChestLuma(source, 0.58, 0.92)
    const outL = await deskChestLuma(display, 0.26, 0.46)
    return srcL < 72 && outL > 168
  } catch (_) {
    return false
  }
}

async function deskChestSplit(display) {
  if (!display) return false
  try {
    const img = await loadDeskImage(display)
    const w = Math.min(160, img.naturalWidth)
    const h = Math.min(240, img.naturalHeight)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    const band = (x0n, x1n) => {
      const x0 = Math.round(w * x0n)
      const x1 = Math.round(w * x1n)
      let sum = 0
      let n = 0
      for (let y = Math.round(h * 0.26); y < Math.round(h * 0.46); y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * w + x) * 4
          sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
          n += 1
        }
      }
      return n ? sum / n : 128
    }
    return Math.abs(band(0.22, 0.44) - band(0.56, 0.78)) > 55
  } catch (_) {
    return false
  }
}

async function deskCropBand(url, fromY, toY) {
  const img = await loadDeskImage(url)
  const y0 = Math.max(0, Math.round(img.naturalHeight * (Number.isFinite(fromY) ? fromY : 0)))
  const y1 = Math.min(
    img.naturalHeight,
    Math.round(img.naturalHeight * (Number.isFinite(toY) ? toY : 1)),
  )
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = Math.max(8, y1 - y0)
  c.getContext('2d').drawImage(img, 0, -y0)
  return c.toDataURL('image/jpeg', 0.92)
}

async function deskCropLower(url, fromY) {
  return deskCropBand(url, fromY, 1)
}

async function deskPasteBand(base, piece, fromY, toY, opts) {
  const bg = await loadDeskImage(base)
  const lg = await loadDeskImage(piece)
  const c = document.createElement('canvas')
  c.width = bg.naturalWidth
  c.height = bg.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bg, 0, 0)
  const y0 = Math.max(0, Math.round(bg.naturalHeight * (Number.isFinite(fromY) ? fromY : 0)))
  const y1 = Math.min(
    bg.naturalHeight,
    Math.round(bg.naturalHeight * (Number.isFinite(toY) ? toY : 1)),
  )
  const h = Math.max(8, y1 - y0)
  const w = c.width
  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  tmp.getContext('2d').drawImage(lg, 0, 0, lg.naturalWidth, lg.naturalHeight, 0, 0, w, h)
  const baseBand = ctx.getImageData(0, y0, w, h)
  const newBand = tmp.getContext('2d').getImageData(0, 0, w, h)
  const mark = new Uint8Array(w * h)
  const skipHands = opts?.skipHands || 'top'
  const handY = skipHands === 'bottom' ? Math.round(h * 0.88) : Math.round(h * 0.2)
  const side = skipHands === 'bottom' ? Math.round(w * 0.18) : Math.round(w * 0.3)
  const skipCell = (px, py) => {
    if (skipHands === 'bottom') return py > handY && (px < side || px > w - side)
    if (skipHands === 'top') return py < handY && (px < side || px > w - side)
    return false
  }
  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      if (skipCell(px, py)) continue
      const p = (py * w + px) * 4
      const luma = baseBand.data[p] * 0.299 + baseBand.data[p + 1] * 0.587 + baseBand.data[p + 2] * 0.114
      if (luma < 92) mark[py * w + px] = 1
    }
  }
  const seen = new Uint8Array(w * h)
  const keep = new Uint8Array(w * h)
  const minKeep = Math.max(400, Math.round(w * h * 0.012))
  for (let i = 0; i < mark.length; i += 1) {
    if (!mark[i] || seen[i]) continue
    const stack = [i]
    seen[i] = 1
    const cells = []
    let maxY = 0
    while (stack.length) {
      const k = stack.pop()
      cells.push(k)
      const px = k % w
      const py = (k - px) / w
      if (py > maxY) maxY = py
      if (px + 1 < w && mark[k + 1] && !seen[k + 1]) {
        seen[k + 1] = 1
        stack.push(k + 1)
      }
      if (px > 0 && mark[k - 1] && !seen[k - 1]) {
        seen[k - 1] = 1
        stack.push(k - 1)
      }
      if (py + 1 < h && mark[k + w] && !seen[k + w]) {
        seen[k + w] = 1
        stack.push(k + w)
      }
      if (py > 0 && mark[k - w] && !seen[k - w]) {
        seen[k - w] = 1
        stack.push(k - w)
      }
    }
    if (cells.length >= minKeep || maxY > h * 0.78) {
      for (let c = 0; c < cells.length; c += 1) keep[cells[c]] = 1
    }
  }
  const dil = new Uint8Array(keep)
  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const i = py * w + px
      if (keep[i]) continue
      if (skipCell(px, py)) continue
      let hit = 0
      for (let dy = -1; dy <= 1 && !hit; dy += 1) {
        for (let dx = -1; dx <= 1 && !hit; dx += 1) {
          const xx = px + dx
          const yy = py + dy
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
          if (keep[yy * w + xx]) hit = 1
        }
      }
      if (hit) dil[i] = 1
    }
  }
  for (let i = 0; i < dil.length; i += 1) {
    if (!dil[i]) continue
    const p = i * 4
    baseBand.data[p] = newBand.data[p]
    baseBand.data[p + 1] = newBand.data[p + 1]
    baseBand.data[p + 2] = newBand.data[p + 2]
  }
  ctx.putImageData(baseBand, 0, y0)
  return c.toDataURL('image/jpeg', 0.92)
}

async function deskPasteLower(base, lower, fromY) {
  return deskPasteBand(base, lower, fromY, 1, { skipHands: 'top' })
}

async function deskPantsStainCount(display) {
  if (!display) return 0
  try {
    const img = await loadDeskImage(display)
    const w = Math.min(160, img.naturalWidth)
    const h = Math.min(240, img.naturalHeight)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    const x0 = Math.round(w * 0.36)
    const x1 = Math.round(w * 0.64)
    const y0 = Math.round(h * 0.58)
    const y1 = Math.round(h * 0.82)
    let n = 0
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * w + x) * 4
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const luma = r * 0.299 + g * 0.587 + b * 0.114
        const sat = Math.max(r, g, b) - Math.min(r, g, b)
        if (luma >= 150 && luma <= 176 && sat >= 18) n += 1
      }
    }
    return n
  } catch (_) {
    return 0
  }
}

async function deskPantsDarkened(source, display, srcLuma) {
  if (!source || !display) return false
  try {
    const srcL = Number.isFinite(srcLuma) ? srcLuma : await deskChestLuma(source, 0.58, 0.92)
    const pant = await deskJacketSideLuma(display, 0.58, 0.86, [[0.34, 0.66]])
    return srcL > 120 && pant < 80
  } catch (_) {
    return false
  }
}

async function deskShoesDarkened(source, display, srcLuma) {
  if (!source || !display) return false
  try {
    const srcL = Number.isFinite(srcLuma) ? srcLuma : await deskChestLuma(source, 0.58, 0.92)
    const shoes = await deskJacketSideLuma(display, 0.88, 0.98, [[0.38, 0.62]])
    return srcL > 120 && shoes < 80
  } catch (_) {
    return false
  }
}

async function deskClothesDarkened(source, display, srcLuma) {
  if (!source || !display) return false
  try {
    const srcL = Number.isFinite(srcLuma) ? srcLuma : await deskChestLuma(source, 0.58, 0.92)
    if (srcL <= 120) return false
    const side = await deskJacketSideLuma(display, 0.26, 0.46)
    const mid = await deskJacketSideLuma(display, 0.26, 0.46, [[0.42, 0.58]])
    return side < 80 || mid < 80
  } catch (_) {
    return false
  }
}

async function composeDeskSoloStill(src) {
  if (!src) return ''
  if (globalThis.DeskPipeline?.composePlate) {
    return globalThis.DeskPipeline.composePlate([{ src, heightFactor: 1 }], deskComposeKind())
  }
  return src
}

async function composeDeskCoupleStill(leftSrc, rightSrc) {
  const sizeEl = document.getElementById('size')
  if (sizeEl) sizeEl.value = 'landscape'
  if (typeof currentResult !== 'undefined' && currentResult) currentResult.size = 'landscape'
  if (globalThis.DeskPipeline?.composePlate) {
    const faceH = async (src) => {
      if (typeof deskStillFaceBoxes !== 'function') return 0
      const boxes = await deskStillFaceBoxes(src)
      const face = (boxes || []).slice().sort((a, b) => b.w * b.h - a.w * a.h)[0]
      return face && face.h > 0 ? face.h : 0
    }
    const [womanFaceH, manFaceH] = await Promise.all([faceH(leftSrc), faceH(rightSrc)])
    const dataUrl = await globalThis.DeskPipeline.composePlate(
      [
        { src: leftSrc, heightFactor: 1, slot: 'woman', faceH: womanFaceH },
        { src: rightSrc, heightFactor: 1.02, slot: 'man', faceH: manFaceH },
      ],
      'landscape',
    )
    const places = globalThis.DeskPipeline.lastPlacements || []
    if (places.length >= 2) {
      saveDeskCastLayout(places[0], places[1], places[0].cw, places[0].ch)
    }
    return dataUrl
  }
  const [leftCut, rightCut] = await Promise.all([deskIsolatePerson(leftSrc), deskIsolatePerson(rightSrc)])
  const [cw, ch] = deskComposeSize()
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  paintDeskStudio(ctx, cw, ch)
  const ground = Math.round(ch * 0.94)
  const draw = (cut, cx, heightFactor) => {
    const { w, h } = deskSourceSize(cut)
    const scale = deskFitBodyScale(cut, cw, ch, heightFactor)
    const dw = Math.round(w * scale)
    const dh = Math.round(h * scale)
    const x = Math.round(cx - dw / 2)
    const y = ground - dh
    ctx.drawImage(cut, x, y, dw, dh)
    return { x, y, w: dw, h: dh, cw, ch }
  }
  const womanPlace = draw(leftCut, cw * 0.46, 1)
  const manPlace = draw(rightCut, cw * 0.54, 1.04)
  saveDeskCastLayout(womanPlace, manPlace, cw, ch)
  return canvas.toDataURL('image/jpeg', 0.95)
}

function newDeskCastId(role) {
  return `cast-${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function captureDeskCastLock(role, dataUrl) {
  const id = newDeskCastId(role)
  const faces = await deskStillFaceBoxes(dataUrl)
  if (!faces || !faces.length) {
    return { id, ok: false, reason: 'undetected', face: null, person: null, pose: null, embed: null, dim: 0 }
  }
  const face = faces.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0]
  const runtime = globalThis.DeskLookRuntime
  if (!runtime || typeof runtime.embedCast !== 'function') {
    return { id, ok: false, reason: 'undetected', face, person: null, pose: null, embed: null, dim: 0 }
  }
  const emb = await runtime.embedCast(dataUrl, { ...face, slot: role })
  if (!emb?.ok || emb.dim !== 512 || !emb.vec) {
    return { id, ok: false, reason: 'undetected', face, person: null, pose: null, embed: null, dim: 0 }
  }
  const person = {
    x: Math.max(0, face.x - face.w * 0.35),
    y: Math.max(0, face.y - face.h * 0.7),
    w: Math.min(1 - Math.max(0, face.x - face.w * 0.35), face.w * 2.2),
    h: Math.min(1 - Math.max(0, face.y - face.h * 0.7), 1),
  }
  return {
    id,
    ok: true,
    reason: '',
    face,
    person,
    pose: { cx: face.x + face.w / 2, cy: face.y + face.h / 2 },
    embed: emb.vec,
    dim: emb.dim,
    embedEngine: 'insightface-buffalo_l',
  }
}

function deskFaceInSlot(faces, box) {
  if (!box || !faces?.length) return null
  return faces.find((f) => pointInNorm(box, f.x + f.w / 2, f.y + f.h / 2)) || null
}

function saveDeskCastLayout(womanRect, manRect, cw, ch) {
  const work = typeof currentDeskWork === 'function' ? currentDeskWork() : null
  const norm = (r, slot, castId) =>
    r
      ? {
          slot,
          castId: castId || '',
          x: r.x / cw,
          y: r.y / ch,
          w: r.w / cw,
          h: r.h / ch,
        }
      : null
  const layout = {
    sceneW: cw,
    sceneH: ch,
    woman: norm(womanRect, 'woman', work?.womanCastId || work?.womanCastLock?.id),
    man: norm(manRect, 'man', work?.manCastId || work?.manCastLock?.id),
  }
  if (typeof updateCurrentDeskWork === 'function') updateCurrentDeskWork({ castLayout: layout })
  return layout
}

function deskSoloWomanLayout() {
  const work = typeof currentDeskWork === 'function' ? currentDeskWork() : null
  return {
    sceneW: 1,
    sceneH: 1,
    woman: { slot: 'woman', castId: work?.womanCastId || work?.womanCastLock?.id || '', x: 0, y: 0, w: 1, h: 1 },
    man: null,
  }
}

/** 한 장에 이미 두 얼굴이면 왼쪽=남, 오른쪽=여. 2 한 장면으로 다시 붙이지 않는다. */
function deskLayoutFromSceneFaces(faces, work) {
  const list = (faces || []).filter((f) => f && f.w > 0 && f.h > 0).slice().sort((a, b) => a.x - b.x)
  if (list.length < 2) return null
  const left = list[0]
  const right = list[1]
  const box = (slot, face, castId) => ({
    slot,
    castId: castId || '',
    x: face.x,
    y: face.y,
    w: face.w,
    h: face.h,
  })
  return {
    sceneW: 1,
    sceneH: 1,
    woman: box('woman', right, work?.womanCastId || work?.womanCastLock?.id),
    man: box('man', left, work?.manCastId || work?.manCastLock?.id),
  }
}

function deskMwSideFaces() {
  return [
    { slot: 'man', x: 0.04, y: 0.06, w: 0.42, h: 0.55 },
    { slot: 'woman', x: 0.52, y: 0.06, w: 0.44, h: 0.55 },
  ]
}

function deskSplitOneFaceToMw(face) {
  if (!face) return deskMwSideFaces()
  if (face.w >= 0.28) {
    return [
      { slot: 'man', x: face.x, y: face.y, w: face.w / 2, h: face.h },
      { slot: 'woman', x: face.x + face.w / 2, y: face.y, w: face.w / 2, h: face.h },
    ]
  }
  const cx = face.x + face.w / 2
  if (cx >= 0.5) {
    return [deskMwSideFaces()[0], { ...face, slot: 'woman' }]
  }
  return [{ ...face, slot: 'man' }, deskMwSideFaces()[1]]
}

function deskAdoptCoupleStill(image, extra) {
  if (!image || typeof updateCurrentDeskWork !== 'function') return
  const work = typeof currentDeskWork === 'function' ? currentDeskWork() : null
  updateCurrentDeskWork({
    assembledPair: true,
    scene: image,
    peopleCount: 2,
    sourceKind: work?.man && work?.sourceKind === 'pair' ? 'pair' : 'scene',
    ...(work?.castPlate || work?.lookApplied === 'nude' ? {} : { castPlate: image }),
    ...(extra || {}),
  })
  if (typeof setTwoPeopleChecked === 'function') setTwoPeopleChecked(true)
}

function deskCoupleSplitX(woman, man) {
  if (!woman || !man) return null
  return (woman.x + woman.w / 2 + man.x + man.w / 2) / 2
}

function deskCoupleSplitFromFaces(faces) {
  const list = (faces || []).filter((f) => f && f.w > 0 && f.h > 0).slice().sort((a, b) => a.x - b.x)
  if (list.length >= 2) {
    return (list[0].x + list[0].w / 2 + list[1].x + list[1].w / 2) / 2
  }
  return 0.5
}

async function deskStampManHalfFromSource(srcUrl, outUrl, splitX) {
  if (!srcUrl || !outUrl) return outUrl
  const split = Number.isFinite(splitX) ? Math.min(0.72, Math.max(0.28, splitX)) : 0.5
  try {
    const srcImg = await loadDeskImage(srcUrl)
    const outImg = await loadDeskImage(outUrl)
    const w = srcImg.naturalWidth || 1
    const h = srcImg.naturalHeight || 1
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(outImg, 0, 0, w, h)
    const out = ctx.getImageData(0, 0, w, h)
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = w
    srcCanvas.height = h
    srcCanvas.getContext('2d').drawImage(srcImg, 0, 0, w, h)
    const src = srcCanvas.getContext('2d').getImageData(0, 0, w, h)
    let stamped = 0
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if ((x + 0.5) / w >= split) continue
        const i = (y * w + x) * 4
        out.data[i] = src.data[i]
        out.data[i + 1] = src.data[i + 1]
        out.data[i + 2] = src.data[i + 2]
        out.data[i + 3] = src.data[i + 3]
        stamped += 1
      }
    }
    if (!stamped) return outUrl
    ctx.putImageData(out, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return outUrl
  }
}

async function deskManHalfPasses(sourceUrl, resultUrl, splitX) {
  const split = Number.isFinite(splitX) ? Math.min(0.72, Math.max(0.28, splitX)) : 0.5
  try {
    const srcImg = await loadDeskImage(sourceUrl)
    const outImg = await loadDeskImage(resultUrl)
    const w = Math.max(1, Math.min(srcImg.naturalWidth || 1, 480))
    const h = Math.max(1, Math.round(((srcImg.naturalHeight || 1) * w) / (srcImg.naturalWidth || 1)))
    const grab = (img) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      return c.getContext('2d').getImageData(0, 0, w, h).data
    }
    const s = grab(srcImg)
    const o = grab(outImg)
    let n = 0
    let mad = 0
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if ((x + 0.5) / w >= split) continue
        const i = (y * w + x) * 4
        mad += (Math.abs(s[i] - o[i]) + Math.abs(s[i + 1] - o[i + 1]) + Math.abs(s[i + 2] - o[i + 2])) / 3
        n += 1
      }
    }
    if (n < 80) return { ok: false, reason: 'mw-ww' }
    if (mad / n > 14) return { ok: false, reason: 'mw-ww' }
    return { ok: true, mad: mad / n }
  } catch {
    return { ok: false, reason: 'mw-ww' }
  }
}

function deskOnManSide(nx, woman, man) {
  if (!man) return false
  const split = deskCoupleSplitX(woman, man)
  if (split == null) return pointInNorm(man, nx, 0.5)
  const manCx = man.x + man.w / 2
  return manCx < split ? nx < split : nx > split
}

function deskFacePixelBox(face, kind) {
  if (!face || face.w < 0.02 || face.h < 0.02) return null
  const woman = kind === 'woman'
  const padX = face.w * (woman ? 0.22 : 0.28)
  const padTop = face.h * (woman ? 0.42 : 0.35)
  const padBot = face.h * (woman ? 0.1 : 0.18)
  const x = Math.max(0, face.x - padX)
  const y = Math.max(0, face.y - padTop)
  return {
    x,
    y,
    w: Math.min(1 - x, face.w + padX * 2),
    h: Math.min(1 - y, face.h + padTop + padBot),
  }
}

async function deskStampCastFaceFromSource(srcUrl, outUrl, face, kind) {
  const box = deskFacePixelBox(face, kind || 'woman')
  if (!srcUrl || !outUrl || !box) return outUrl
  try {
    const srcImg = await loadDeskImage(srcUrl)
    const outImg = await loadDeskImage(outUrl)
    const w = srcImg.naturalWidth || 1
    const h = srcImg.naturalHeight || 1
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(outImg, 0, 0, w, h)
    const sx = Math.max(0, Math.round(box.x * w))
    const sy = Math.max(0, Math.round(box.y * h))
    const sw = Math.max(8, Math.min(w - sx, Math.round(box.w * w)))
    const sh = Math.max(8, Math.min(h - sy, Math.round(box.h * h)))
    ctx.drawImage(srcImg, sx, sy, sw, sh, sx, sy, sw, sh)
    return canvas.toDataURL('image/jpeg', 0.92)
  } catch {
    return outUrl
  }
}

async function deskLockCastFacesOnStill(stillUrl) {
  const work = typeof currentDeskWork === 'function' ? currentDeskWork() : null
  const plate = work?.castPlate
  if (!plate || !stillUrl) return stillUrl
  const layout = work?.castLayout
  const boxes =
    typeof deskStillFaceBoxes === 'function' ? await deskStillFaceBoxes(plate, { couple: true }) : []
  const tagged =
    typeof deskTagFacesToCastLayout === 'function' && layout
      ? deskTagFacesToCastLayout(boxes, layout)
      : boxes || []
  const woman =
    tagged.find((f) => f.slot === 'woman') ||
    (tagged.length > 1 ? tagged.slice().sort((a, b) => a.x - b.x)[1] : tagged[0])
  const man = tagged.find((f) => f.slot === 'man')
  let out = stillUrl
  if (woman) out = await deskStampCastFaceFromSource(plate, out, woman, 'woman')
  if (man) out = await deskStampCastFaceFromSource(plate, out, man, 'man')
  return out
}

async function deskStampFacesFromSource(srcUrl, outUrl, faces) {
  const list = (faces || []).filter((f) => f && f.w > 0 && f.h > 0)
  if (!srcUrl || !outUrl || !list.length) return outUrl
  try {
    const srcImg = await loadDeskImage(srcUrl)
    const outImg = await loadDeskImage(outUrl)
    const w = srcImg.naturalWidth || 1
    const h = srcImg.naturalHeight || 1
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(outImg, 0, 0, w, h)
    for (const face of list) {
      const box = deskFacePixelBox(face, face.slot === 'man' ? 'man' : 'woman') || deskInflateNormBox(face, 0.08)
      if (!box) continue
      const sx = Math.max(0, Math.round(box.x * w))
      const sy = Math.max(0, Math.round(box.y * h))
      const sw = Math.max(8, Math.round(box.w * w))
      const sh = Math.max(8, Math.round(box.h * h))
      ctx.drawImage(srcImg, sx, sy, sw, sh, sx, sy, sw, sh)
    }
    return canvas.toDataURL('image/png')
  } catch {
    return outUrl
  }
}

async function deskStampManFromSource(srcUrl, outUrl, layout) {
  if (!srcUrl || !outUrl || !layout?.man) return outUrl
  try {
    const srcImg = await loadDeskImage(srcUrl)
    const outImg = await loadDeskImage(outUrl)
    const w = srcImg.naturalWidth || 1
    const h = srcImg.naturalHeight || 1
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(outImg, 0, 0, w, h)
    const box = deskInflateNormBox(layout.man, 0.06) || layout.man
    const sx = Math.max(0, Math.round(box.x * w))
    const sy = Math.max(0, Math.round(box.y * h))
    const sw = Math.max(8, Math.min(w - sx, Math.round(box.w * w)))
    const sh = Math.max(8, Math.min(h - sy, Math.round(box.h * h)))
    ctx.drawImage(srcImg, sx, sy, sw, sh, sx, sy, sw, sh)
    return canvas.toDataURL('image/jpeg', 0.92)
  } catch {
    return outUrl
  }
}

async function deskManSidePasses(sourceUrl, resultUrl, layout) {
  if (!layout?.man || !layout?.woman) return { ok: false, reason: 'mw-ww' }
  try {
    const srcImg = await loadDeskImage(sourceUrl)
    const outImg = await loadDeskImage(resultUrl)
    const w = Math.max(1, Math.min(srcImg.naturalWidth || 1, 480))
    const h = Math.max(1, Math.round(((srcImg.naturalHeight || 1) * w) / (srcImg.naturalWidth || 1)))
    const grab = (img) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      return c.getContext('2d').getImageData(0, 0, w, h).data
    }
    const s = grab(srcImg)
    const o = grab(outImg)
    let n = 0
    let mad = 0
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const nx = (x + 0.5) / w
        const ny = (y + 0.5) / h
        if (!pointInNorm(layout.man, nx, ny)) continue
        const i = (y * w + x) * 4
        mad += (Math.abs(s[i] - o[i]) + Math.abs(s[i + 1] - o[i + 1]) + Math.abs(s[i + 2] - o[i + 2])) / 3
        n += 1
      }
    }
    if (n < 80) return { ok: false, reason: 'mw-ww' }
    if (mad / n > 14) return { ok: false, reason: 'mw-ww' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'mw-ww' }
  }
}

function deskLayoutLinked(layout, needCouple) {
  if (!layout?.woman || layout.woman.w < 0.04 || layout.woman.h < 0.04) return false
  if (needCouple && (!layout.man || layout.man.w < 0.04 || layout.man.h < 0.04)) return false
  return true
}

function pointInNorm(box, x, y) {
  if (!box) return false
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h
}

function deskInflateNormBox(box, pad) {
  if (!box) return null
  const extraY = pad * 1.5
  const x = Math.max(0, box.x - pad)
  const y = Math.max(0, box.y - extraY)
  return {
    ...box,
    x,
    y,
    w: Math.min(1 - x, box.w + pad * 2),
    h: Math.min(1 - y, box.h + pad + extraY),
  }
}

function deskTagFacesToCastLayout(faces, layout) {
  if (!layout?.woman || !faces?.length) return []
  const womanBox = deskInflateNormBox(layout.woman, 0.07)
  const manBox = layout.man ? deskInflateNormBox(layout.man, 0.07) : null
  const tagged = []
  for (const box of faces) {
    const cx = box.x + box.w / 2
    const cy = box.y + box.h / 2
    const inW = pointInNorm(womanBox, cx, cy)
    const inM = manBox ? pointInNorm(manBox, cx, cy) : false
    let slot = ''
    if (inW && !inM) slot = 'woman'
    else if (inM && !inW) slot = 'man'
    else if (inW && inM) {
      const dw = Math.hypot(cx - (layout.woman.x + layout.woman.w / 2), cy - (layout.woman.y + layout.woman.h / 2))
      const dm = Math.hypot(cx - (layout.man.x + layout.man.w / 2), cy - (layout.man.y + layout.man.h / 2))
      slot = dw <= dm ? 'woman' : 'man'
    }
    if (slot) tagged.push({ ...box, slot })
  }
  const womanHits = tagged.filter((f) => f.slot === 'woman')
  const manHits = tagged.filter((f) => f.slot === 'man')
  if (layout.man && faces.length >= 2 && (womanHits.length !== 1 || manHits.length !== 1)) {
    const scored = faces
      .map((box) => {
        const cx = box.x + box.w / 2
        const cy = box.y + box.h / 2
        const dw = Math.hypot(cx - (layout.woman.x + layout.woman.w / 2), cy - (layout.woman.y + layout.woman.h / 2))
        const dm = Math.hypot(cx - (layout.man.x + layout.man.w / 2), cy - (layout.man.y + layout.man.h / 2))
        return { box, slot: dw <= dm ? 'woman' : 'man', dw, dm }
      })
      .sort((a, b) => Math.min(a.dw, a.dm) - Math.min(b.dw, b.dm))
    const bySlot = { woman: null, man: null }
    for (const one of scored) {
      if (bySlot[one.slot]) continue
      bySlot[one.slot] = { ...one.box, slot: one.slot }
    }
    if (bySlot.woman && bySlot.man) return [bySlot.woman, bySlot.man]
  }
  return tagged
}

async function buildWomanClothesMaskDataUrl(sceneUrl, layout) {
  if (!sceneUrl || !layout?.woman) return { ok: false, reason: 'no_layout' }
  const img = await loadDeskImage(sceneUrl)
  const w = img.naturalWidth || 1
  const h = img.naturalHeight || 1
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const pix = ctx.getImageData(0, 0, w, h)
  const d = pix.data
  const faces = await deskStillFaceBoxes(sceneUrl)
  if (!faces || !faces.length) return { ok: false, reason: 'undetected' }
  const womanFaces = faces.filter((f) => pointInNorm(layout.woman, f.x + f.w / 2, f.y + f.h / 2))
  if (womanFaces.length !== 1) return { ok: false, reason: 'woman_face_unlink' }
  if (layout.man) {
    const manFaces = faces.filter((f) => pointInNorm(layout.man, f.x + f.w / 2, f.y + f.h / 2))
    if (manFaces.length !== 1) return { ok: false, reason: 'man_face_unlink' }
  } else if (faces.length !== 1) {
    return { ok: false, reason: 'cast_people' }
  }
  const face = womanFaces[0]
  const fx0 = Math.round((face.x + face.w * 0.25) * w)
  const fy0 = Math.round((face.y + face.h * 0.28) * h)
  const fx1 = Math.round((face.x + face.w * 0.75) * w)
  const fy1 = Math.round((face.y + face.h * 0.72) * h)
  let sr = 0
  let sg = 0
  let sb = 0
  let sn = 0
  for (let y = fy0; y < fy1; y += 2) {
    for (let x = fx0; x < fx1; x += 2) {
      const i = (y * w + x) * 4
      sr += d[i]
      sg += d[i + 1]
      sb += d[i + 2]
      sn += 1
    }
  }
  if (!sn) return { ok: false, reason: 'no_skin_sample' }
  sr /= sn
  sg /= sn
  sb /= sn
  const hairTop = face.y - face.h * 0.55
  const neckBot = face.y + face.h * 1.28
  const facePadX = face.w * 0.22
  const mask = ctx.createImageData(w, h)
  const m = mask.data
  let white = 0
  let womanPx = 0
  let invade = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4
      const nx = x / w
      const ny = y / h
      const inWoman = pointInNorm(layout.woman, nx, ny)
      const inMan = layout.man ? pointInNorm(layout.man, nx, ny) : false
      if (inWoman) womanPx += 1
      const dr = d[i] - sr
      const dg = d[i + 1] - sg
      const db = d[i + 2] - sb
      const skin = dr * dr + dg * dg + db * db < 42 * 42 && d[i] > d[i + 2] - 8
      let keep = true
      if (!inWoman || inMan) keep = true
      else {
        const inHead =
          ny >= hairTop &&
          ny <= neckBot &&
          nx >= face.x - facePadX &&
          nx <= face.x + face.w + facePadX
        keep = inHead || skin || d[i + 3] < 20
      }
      if (keep) {
        m[i] = 0
        m[i + 1] = 0
        m[i + 2] = 0
        m[i + 3] = 255
      } else {
        m[i] = 255
        m[i + 1] = 255
        m[i + 2] = 255
        m[i + 3] = 255
        white += 1
        if (skin || (dr * dr + dg * dg + db * db < 38 * 38 && d[i] > d[i + 2] - 8)) invade += 1
      }
    }
  }
  const ratio = white / Math.max(womanPx, 1)
  if (white < 80 || ratio < 0.04 || ratio > 0.48) {
    return { ok: false, reason: 'mask_not_clothes', white, ratio, womanPx }
  }
  if (invade / Math.max(white, 1) > 0.02) {
    return { ok: false, reason: 'mask_invade', white, invade, ratio }
  }
  ctx.putImageData(mask, 0, 0)
  const out = document.createElement('canvas')
  out.width = Math.min(768, w)
  out.height = Math.min(1024, h)
  const octx = out.getContext('2d')
  octx.filter = 'blur(4px)'
  octx.drawImage(canvas, 0, 0, out.width, out.height)
  octx.filter = 'none'
  return {
    ok: true,
    dataUrl: out.toDataURL('image/png'),
    white,
    ratio,
    invade,
    fullDataUrl: canvas.toDataURL('image/png'),
  }
}

async function compositeDeskClothesResult(srcUrl, genUrl, maskUrl, featherPx) {
  if (!srcUrl || !genUrl || !maskUrl) return { ok: false, reason: 'protect', protectIdentical: false }
  try {
    const srcImg = await loadDeskImage(srcUrl)
    const genImg = await loadDeskImage(genUrl)
    const maskImg = await loadDeskImage(maskUrl)
    const w = srcImg.naturalWidth || 1
    const h = srcImg.naturalHeight || 1
    const grab = (img, nearest) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      ctx.imageSmoothingEnabled = !nearest
      ctx.drawImage(img, 0, 0, w, h)
      return ctx.getImageData(0, 0, w, h)
    }
    const src = grab(srcImg, false)
    const gen = grab(genImg, false)
    const mask = grab(maskImg, true)
    const r = Number.isFinite(featherPx) ? Math.min(8, Math.max(3, Math.round(featherPx))) : 5
    const n = w * h
    const md = mask.data
    const out = ctxImage(w, h)
    const s = src.data
    const g = gen.data
    const o = out.data
    // 엔진이 사진 전체 톤을 조금 옮겨 놓으면 마스크 경계에 단차가 생긴다.
    // 마스크 바깥 띠는 원본과 같은 내용이어야 하므로, 거기서 잰 차이만 되돌린다.
    const tone = [0, 0, 0]
    let ringN = 0
    const sum = [0, 0, 0]
    for (let p = 0; p < n; p += 1) {
      const i = p * 4
      if (md[i] >= 128) continue
      const x = p % w
      const y = (p - x) / w
      let touches = false
      if (x >= r && md[(p - r) * 4] >= 128) touches = true
      else if (x + r < w && md[(p + r) * 4] >= 128) touches = true
      else if (y >= r && md[(p - r * w) * 4] >= 128) touches = true
      else if (y + r < h && md[(p + r * w) * 4] >= 128) touches = true
      if (!touches) continue
      sum[0] += s[i] - g[i]
      sum[1] += s[i + 1] - g[i + 1]
      sum[2] += s[i + 2] - g[i + 2]
      ringN += 1
    }
    if (ringN >= 64) {
      for (let c = 0; c < 3; c += 1) {
        tone[c] = Math.max(-24, Math.min(24, Math.round(sum[c] / ringN)))
      }
    }
    const gv = (i, c) => {
      const v = g[i + c] + tone[c]
      return v < 0 ? 0 : v > 255 ? 255 : v
    }
    let protectN = 0
    let protectMax = 0
    for (let p = 0; p < n; p += 1) {
      const i = p * 4
      const x = p % w
      const y = (p - x) / w
      let t = 0
      if (md[i] >= 128) {
        let dBlack = r
        const x0 = Math.max(0, x - r)
        const x1 = Math.min(w - 1, x + r)
        const y0 = Math.max(0, y - r)
        const y1 = Math.min(h - 1, y + r)
        for (let yy = y0; yy <= y1; yy += 1) {
          for (let xx = x0; xx <= x1; xx += 1) {
            if (md[(yy * w + xx) * 4] >= 128) continue
            const d = Math.hypot(xx - x, yy - y)
            if (d < dBlack) dBlack = d
          }
        }
        t = dBlack >= r ? 1 : dBlack / r
      }
      if (t <= 0) {
        o[i] = s[i]
        o[i + 1] = s[i + 1]
        o[i + 2] = s[i + 2]
        o[i + 3] = s[i + 3]
        protectN += 1
        const mad = (Math.abs(o[i] - s[i]) + Math.abs(o[i + 1] - s[i + 1]) + Math.abs(o[i + 2] - s[i + 2])) / 3
        if (mad > protectMax) protectMax = mad
      } else if (t >= 1) {
        o[i] = gv(i, 0)
        o[i + 1] = gv(i, 1)
        o[i + 2] = gv(i, 2)
        o[i + 3] = 255
      } else {
        o[i] = Math.round(s[i] * (1 - t) + gv(i, 0) * t)
        o[i + 1] = Math.round(s[i + 1] * (1 - t) + gv(i, 1) * t)
        o[i + 2] = Math.round(s[i + 2] * (1 - t) + gv(i, 2) * t)
        o[i + 3] = 255
      }
    }
    for (let p = 0; p < n; p += 1) {
      const i = p * 4
      if (md[i] < 128) continue
      const x = p % w
      const y = (p - x) / w
      let bound = false
      const x0 = Math.max(0, x - 2)
      const x1 = Math.min(w - 1, x + 2)
      const y0 = Math.max(0, y - 2)
      const y1 = Math.min(h - 1, y + 2)
      for (let yy = y0; yy <= y1 && !bound; yy += 1) {
        for (let xx = x0; xx <= x1; xx += 1) {
          if (md[(yy * w + xx) * 4] < 128) bound = true
        }
      }
      if (!bound) continue
      const outL = (o[i] + o[i + 1] + o[i + 2]) / 3
      const srcL = (s[i] + s[i + 1] + s[i + 2]) / 3
      if (outL > 78 || srcL < 120 || srcL < outL + 28) continue
      if (s[i] <= 85 || s[i] + 8 < s[i + 1] || s[i] <= s[i + 2] + 6) continue
      o[i] = s[i]
      o[i + 1] = s[i + 1]
      o[i + 2] = s[i + 2]
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').putImageData(out, 0, 0)
    return {
      ok: true,
      dataUrl: canvas.toDataURL('image/png'),
      protectIdentical: protectN > 0 && protectMax === 0,
      protectN,
      protectMax,
    }
  } catch {
    return { ok: false, reason: 'protect', protectIdentical: false }
  }
}

function ctxImage(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c.getContext('2d').createImageData(w, h)
}

async function countDeskSceneFaces(imageUrl, waitMs = 4000, opts) {
  if (!imageUrl || typeof globalThis.detectSceneFaceBoxes !== 'function') return 0
  const work = Promise.resolve()
    .then(async () => {
      const stable =
        typeof globalThis.ensureStableDataUrl === 'function'
          ? await globalThis.ensureStableDataUrl(imageUrl)
          : imageUrl
      const boxes = await globalThis.detectSceneFaceBoxes(stable, 2, {
        guessIfMissing: Boolean(opts?.guessIfMissing),
        mergeIou: typeof opts?.mergeIou === 'number' ? opts.mergeIou : 0.55,
      })
      const minW = opts?.couple ? 0.018 : 0.03
      const minH = opts?.couple ? 0.022 : 0.035
      const list = Array.isArray(boxes) ? boxes.filter((b) => b && b.w >= minW && b.h >= minH) : []
      if (list.length < 2) return list.length
      const sorted = list.slice().sort((a, b) => a.x - b.x)
      const a = sorted[0]
      const b = sorted[1]
      const sameRow = Math.abs((a.y + a.h / 2) - (b.y + b.h / 2)) < Math.max(a.h, b.h) * 0.4
      const touching = Math.abs(a.x + a.w - b.x) < 0.08
      const splitOne = sameRow && touching && Math.abs(a.h - b.h) < 0.1 && a.w + b.w >= 0.28
      return splitOne ? 1 : list.length
    })
    .catch(() => 0)
  if (opts?.noTimeout) return work
  let settled = false
  const timed = new Promise((resolve) => {
    window.setTimeout(() => {
      if (!settled) resolve(-1)
    }, Math.max(500, waitMs))
  })
  const n = await Promise.race([
    work.then((v) => {
      settled = true
      return v
    }),
    timed,
  ])
  return n
}

async function deskStillFaceBoxes(imageUrl, opts) {
  if (!imageUrl || typeof globalThis.detectSceneFaceBoxes !== 'function') return null
  try {
    const stable =
      typeof globalThis.ensureStableDataUrl === 'function'
        ? await globalThis.ensureStableDataUrl(imageUrl)
        : imageUrl
    const boxes = await globalThis.detectSceneFaceBoxes(stable, 2, {
      guessIfMissing: false,
      mergeIou: opts?.couple ? 0.32 : 0.55,
    })
    const minW = opts?.couple ? 0.018 : 0.03
    const minH = opts?.couple ? 0.022 : 0.035
    return (Array.isArray(boxes) ? boxes : []).filter((b) => b && b.w >= minW && b.h >= minH)
  } catch {
    return null
  }
}
globalThis.deskStillFaceBoxes = deskStillFaceBoxes

async function deskFaceHist(imageUrl, box) {
  if (!imageUrl || !box) return null
  try {
    const img = await loadDeskImage(imageUrl)
    const w = img.naturalWidth || 1
    const h = img.naturalHeight || 1
    const sx = Math.max(0, Math.round(box.x * w))
    const sy = Math.max(0, Math.round(box.y * h))
    const sw = Math.max(8, Math.round(box.w * w))
    const sh = Math.max(8, Math.round(box.h * h))
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 32, 32)
    const data = ctx.getImageData(0, 0, 32, 32).data
    const hist = new Array(16).fill(0)
    let r = 0
    let g = 0
    let b = 0
    const n = 32 * 32
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      const y = Math.round((0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 16)
      hist[Math.max(0, Math.min(15, y))] += 1
    }
    return { hist, r: r / n, g: g / n, b: b / n }
  } catch {
    return null
  }
}

function deskHistCorr(a, b) {
  if (!a?.hist || !b?.hist) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < 16; i += 1) {
    dot += a.hist[i] * b.hist[i]
    na += a.hist[i] * a.hist[i]
    nb += b.hist[i] * b.hist[i]
  }
  const hist = na && nb ? dot / Math.sqrt(na * nb) : 0
  const color =
    1 -
    Math.min(
      1,
      (Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b)) / (3 * 80),
    )
  return hist * 0.65 + color * 0.35
}

async function deskFaceDescriptor(imageUrl, box) {
  if (!imageUrl || !box) return null
  try {
    const img = await loadDeskImage(imageUrl)
    const w = img.naturalWidth || 1
    const h = img.naturalHeight || 1
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    ctx.drawImage(
      img,
      Math.max(0, box.x * w),
      Math.max(0, box.y * h),
      Math.max(8, box.w * w),
      Math.max(8, box.h * h),
      0,
      0,
      32,
      32,
    )
    const data = ctx.getImageData(0, 0, 32, 32).data
    const vec = []
    let sum = 0
    for (let i = 0; i < data.length; i += 4) {
      const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      vec.push(y)
      sum += y
    }
    const mean = sum / vec.length
    return vec.map((v) => v - mean)
  } catch {
    return null
  }
}

function deskVecCos(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

async function deskProtectPixelDiff(sourceUrl, resultUrl, maskUrl) {
  if (!maskUrl) return { ok: true, reason: 'protect', skipped: true, mad: 0 }
  if (!sourceUrl || !resultUrl) return { ok: false, reason: 'protect', mad: 1 }
  try {
    const src = await loadDeskImage(sourceUrl)
    const out = await loadDeskImage(resultUrl)
    const mask = await loadDeskImage(maskUrl)
    const w = 96
    const h = 128
    const grab = (img) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, w, h)
      return ctx.getImageData(0, 0, w, h).data
    }
    const a = grab(src)
    const b = grab(out)
    const m = grab(mask)
    let sum = 0
    let n = 0
    let hot = 0
    for (let i = 0; i < m.length; i += 4) {
      if (m[i] >= 128) continue
      const mad = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3
      sum += mad
      n += 1
      if (mad > 0) hot += 1
    }
    if (!n) return { ok: false, reason: 'protect', mad: 1 }
    const mean = sum / n
    return { ok: mean === 0 && hot === 0, reason: 'protect', mad: mean, hot: hot / n }
  } catch {
    return { ok: false, reason: 'protect', mad: 1 }
  }
}

async function deskLookVisualPasses(sourceUrl, resultUrl, maskUrl, visualOpts) {
  if (!maskUrl) return { ok: true, reason: '', skipped: true }
  const visualFn = globalThis.DeskLookLib?.gateLookVisual
  if (typeof visualFn !== 'function') return { ok: false, reason: 'clothes_goal' }
  try {
    const src = await loadDeskImage(sourceUrl)
    const out = await loadDeskImage(resultUrl)
    const maskImg = await loadDeskImage(maskUrl)
    const w = 192
    const h = 256
    const grab = (img, gray) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, w, h)
      const data = ctx.getImageData(0, 0, w, h).data
      if (!gray) return new Uint8Array(data)
      const m = new Uint8Array(w * h)
      for (let p = 0, i = 0; p < m.length; p++, i += 4) m[p] = data[i] >= 128 ? 255 : 0
      return m
    }
    const gate = visualFn({
      src: grab(src, false),
      out: grab(out, false),
      mask: grab(maskImg, true),
      width: w,
      height: h,
      looseNude: visualOpts?.looseNude === true,
    })
    if (!gate.ok) {
      // 왜 떨어졌는지 숫자로 남긴다. 이게 없으면 다음 수정이 추측이 된다.
      console.info(
        'desk look gate',
        JSON.stringify({
          reason: gate.reason,
          failReasons: gate.failReasons,
          seam: gate.seam,
          silhouette: gate.silhouette,
          regions: gate.regions,
        }),
      )
    }
    return gate
  } catch {
    return { ok: false, reason: 'clothes_goal' }
  }
}

function deskProtectSkipsFaceBox(protect) {
  return Boolean(protect && protect.ok && protect.skipped !== true)
}

/** 거부 문구에 붙일 짧은 숫자. 콘솔을 열지 않고도 어디가 걸렸는지 보이게. */
function deskVisualDetail(visual) {
  if (!visual) return ''
  const r2 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : '?')
  const seam = visual.seam || {}
  const sil = visual.silhouette || {}
  const up = visual.regions?.upper || {}
  const low = visual.regions?.lower || {}
  if (visual.reason === 'mask_seam') {
    return `단차 ${r2(seam.lumRel)} (한도 1.05) · 원본단차 ${r2(seam.srcLumJump)} → 결과 ${r2(seam.outLumJump)} · 질감 ${r2(seam.texRatio)} · 잔상 ${r2(seam.remnantMaxRun)}`
  }
  if (visual.reason === 'silhouette') {
    return `몸너비 ${r2(sil.outWidth)} / 기준 ${r2(sil.bodyRef)} (허용 ${r2(sil.bodyMin)}~${r2(sil.clothingWidth)})`
  }
  return `상의 변화 ${r2(up.mad)} 닮음 ${r2(up.corr)} · 하의 변화 ${r2(low.mad)} 닮음 ${r2(low.corr)} (변화 24↑, 닮음 0.88↓ 필요)`
}

async function deskStillPasses(sourceUrl, resultUrl, expectPeople, maskUrl, layout, gateOpts) {
  const expect = expectPeople >= 2 ? 2 : 1
  const workEarly = typeof currentDeskWork === 'function' ? currentDeskWork() : null
  const slots = layout || workEarly?.castLayout
  // VTON 은 마스크 밖도 다시 그리므로 화소 동일 검사는 뜻이 없다. 합성을 안 하니
  // 이음매·실루엣도 생기지 않는다. 남는 질문은 둘뿐 — 같은 사람인가, 옷이 바뀌었는가.
  const nativeIdentity = gateOpts?.nativeIdentity === true
  const protect = gateOpts?.protectIdentical
    ? { ok: true, skipped: false }
    : maskUrl && !nativeIdentity
      ? await deskProtectPixelDiff(sourceUrl, resultUrl, maskUrl)
      : { ok: true, skipped: true }
  const protectLocked = deskProtectSkipsFaceBox(protect)
  if (protectLocked) {
    const visual = await deskLookVisualPasses(sourceUrl, resultUrl, maskUrl, gateOpts)
    if (!visual.ok) {
      const detail = deskVisualDetail(visual)
      if (visual.reason === 'silhouette') return { ok: false, reason: 'silhouette', detail }
      if (visual.reason === 'mask_seam') return { ok: false, reason: 'mask_seam', detail }
      return { ok: false, reason: 'clothes_goal', detail }
    }
    if (expect >= 2 && slots?.man) {
      const manGate = await deskManSidePasses(sourceUrl, resultUrl, slots)
      if (!manGate.ok) return { ok: false, reason: 'mw-ww' }
    }
    return { ok: true }
  }
  const outBoxes = await deskStillFaceBoxes(resultUrl)
  if (!outBoxes || !outBoxes.length) return { ok: false, reason: 'undetected' }
  if (outBoxes.length !== expect) {
    return {
      ok: false,
      reason: outBoxes.length > expect ? 'extra' : expect >= 2 ? 'mw-ww' : 'faces',
    }
  }
  const srcBoxes = await deskStillFaceBoxes(sourceUrl)
  if (!srcBoxes || !srcBoxes.length) return { ok: false, reason: 'undetected' }
  if (srcBoxes.length !== expect) return { ok: false, reason: 'cast_people' }
  const work = workEarly
  const pairs = []
  if (expect >= 2) {
    if (!deskLayoutLinked(slots, true)) return { ok: false, reason: 'cast_people' }
    const srcW = deskFaceInSlot(srcBoxes, slots.woman)
    const outW = deskFaceInSlot(outBoxes, slots.woman)
    const srcM = deskFaceInSlot(srcBoxes, slots.man)
    const outM = deskFaceInSlot(outBoxes, slots.man)
    if (!srcW || !outW || !srcM || !outM) return { ok: false, reason: 'undetected' }
    pairs.push([srcW, outW, work?.womanCastLock?.embed], [srcM, outM, work?.manCastLock?.embed])
  } else {
    const srcMain = deskFaceInSlot(srcBoxes, slots?.woman) || srcBoxes.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0]
    const outMain = deskFaceInSlot(outBoxes, slots?.woman) || outBoxes.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0]
    if (!srcMain || !outMain) return { ok: false, reason: 'undetected' }
    pairs.push([srcMain, outMain, work?.womanCastLock?.embed || work?.manCastLock?.embed])
  }
  for (const [srcBox, outBox, castEmbed] of pairs) {
    if (!protectLocked) {
      const dx = srcBox.x + srcBox.w / 2 - (outBox.x + outBox.w / 2)
      const dy = srcBox.y + srcBox.h / 2 - (outBox.y + outBox.h / 2)
      if (Math.hypot(dx, dy) > 0.18) return { ok: false, reason: 'pose' }
      const scale = (outBox.w * outBox.h) / Math.max(0.0001, srcBox.w * srcBox.h)
      if (scale > 1.85 || scale < 0.45) return { ok: false, reason: 'pose' }
    }
    const runtime = globalThis.DeskLookRuntime
    if (!runtime || typeof runtime.embedCast !== 'function') return { ok: false, reason: 'undetected' }
    const embedBox = protectLocked ? srcBox : outBox
    const left = await runtime.embedCast(sourceUrl, srcBox)
    const right = await runtime.embedCast(resultUrl, embedBox)
    if (!left?.ok || !right?.ok || left.dim !== 512 || right.dim !== 512) return { ok: false, reason: 'undetected' }
    if (deskVecCos(left.vec, right.vec) < 0.35) return { ok: false, reason: 'embed' }
    if (Array.isArray(castEmbed) && castEmbed.length === 512 && deskVecCos(castEmbed, right.vec) < 0.35) {
      return { ok: false, reason: 'embed' }
    }
  }
  if (maskUrl && !nativeIdentity && !protect.ok) return { ok: false, reason: 'protect' }
  const visual = await deskLookVisualPasses(sourceUrl, resultUrl, maskUrl, gateOpts)
  if (!visual.ok) {
    const detail = deskVisualDetail(visual)
    if (nativeIdentity) {
      // 합성을 안 하니 이음매(mask_seam)는 생길 수가 없다. 그러나 실루엣은 다르다 —
      // 몸이 원본보다 홀쭉해지거나 옷이 부풀어 다른 몸이 되는 것은 여전히 잡아야 한다.
      const live = (visual.failReasons?.length ? visual.failReasons : [visual.reason]).filter(
        (why) => why && why !== 'mask_seam',
      )
      if (!live.length) return { ok: true }
      return { ok: false, reason: live[0], detail }
    }
    if (visual.reason === 'silhouette') return { ok: false, reason: 'silhouette', detail }
    if (visual.reason === 'mask_seam') return { ok: false, reason: 'mask_seam', detail }
    return { ok: false, reason: 'clothes_goal', detail }
  }
  return { ok: true }
}

async function resolveDeskFrame(opts = {}) {
  const work = typeof currentDeskWork === 'function' ? currentDeskWork() : null
  const womanId = work?.woman || ''
  const manId = work?.man || ''
  const woman = work?.womanLock || womanId
  const man = manId
  const scene =
    (typeof currentResult !== 'undefined' ? currentResult.imageUrl : '') || work?.scene || ''
  const fromScene = opts.from === 'scene' || (opts.from !== 'cast' && Boolean(scene))
  let image = fromScene ? scene || woman || man : woman || man || scene
  if (!image) return { ok: false, image: '', couple: false, people: 0, message: '여 칸이나 남 칸에 사진을 넣으세요.' }
  const needCouple = opts.needCouple === true
  const countOpts = { mergeIou: 0.45, noTimeout: true, couple: needCouple || Boolean(womanId && manId) }
  const count =
    typeof countDeskSceneFaces === 'function' ? await countDeskSceneFaces(image, 12000, countOpts) : 0
  let faces = count < 0 ? 0 : count
  if (faces < 2 && womanId) {
    const n =
      typeof countDeskSceneFaces === 'function' ? await countDeskSceneFaces(womanId, 12000, countOpts) : 0
    if (n >= 2) {
      image = womanId
      faces = n
    }
  }
  const twoChecked = typeof deskTwoPeopleChecked === 'function' && deskTwoPeopleChecked()
  if (faces >= 2) {
    if (typeof deskAdoptCoupleStill === 'function') deskAdoptCoupleStill(image)
    return { ok: true, image, couple: true, people: 2 }
  }
  if (work?.assembledPair || twoChecked) {
    const pairImage = work?.scene || image
    if (pairImage) return { ok: true, image: pairImage, couple: true, people: 2 }
  }
  if ((needCouple || (womanId && manId)) && faces < 2 && womanId && manId && typeof composeDeskCoupleStill === 'function') {
    try {
      const composed = await composeDeskCoupleStill(womanId, manId)
      if (composed) {
        if (typeof applyDeskScenePixels === 'function') applyDeskScenePixels(composed, '두 사람 시작')
        if (typeof updateCurrentDeskWork === 'function') {
          updateCurrentDeskWork({ assembledPair: true, scene: composed, castPlate: composed, lookApplied: '' })
        }
        image = composed
        faces = 2
      }
    } catch (err) {
      console.warn('desk couple compose failed', err)
    }
  }
  const couple = faces >= 2 || Boolean(work?.assembledPair)
  if (needCouple && !couple) {
    return {
      ok: false,
      image,
      couple: false,
      people: 1,
      message:
        womanId && manId
          ? '두 사람이 한 장에 없습니다. 먼저 1 몸 잇기 다음 2 한 장면을 누르세요. 혼자 벗기로 보내지 않습니다.'
          : '키스·포옹은 한 장에 두 사람이 있어야 합니다. 여와 남을 넣거나 허그 한 장을 여 칸에 넣으세요.',
    }
  }
  return { ok: true, image, couple, people: couple ? 2 : 1 }
}

function applyDeskScenePixels(dataUrl, title) {
  showResult(dataUrl, title, false, {
    accepted: true,
    prompt: currentResult.prompt || '',
    size: currentResult.size || document.getElementById('size')?.value || 'story',
    itemId: currentResult.itemId,
    mood: currentResult.mood,
    engine: currentResult.engine || 'cast',
    genMode: currentResult.genMode || 'fashion',
  })
  currentResult.imageDataUrl = dataUrl
  currentResult.imageUrl = dataUrl
}

async function ensureDeskCoupleInScene() {
  const work = currentDeskWork()
  const scene = currentResult?.imageUrl || work?.scene || work?.woman || work?.man || ''
  if (!scene) {
    return { ok: false, message: '지금 장이나 여 칸 사진이 있어야 키스·포옹·지퍼를 찍습니다.' }
  }
  const faces = typeof countDeskSceneFaces === 'function' ? await countDeskSceneFaces(scene, 8000) : 0
  if (faces >= 2) {
    setTwoPeopleChecked(true)
    return { ok: true }
  }
  if (work?.woman && work?.man) {
    const left = faces <= 1 ? scene : work.woman
    const composed = await composeDeskCoupleStill(left, work.man)
    if (!composed) {
      return { ok: false, message: '두 사람을 한 장에 붙이지 못했습니다. 2 한 장면을 먼저 누르세요.' }
    }
    applyDeskScenePixels(composed, '두 사람 시작')
    setTwoPeopleChecked(true)
    return { ok: true, composed: true }
  }
  return { ok: false, message: '키스·포옹은 한 장에 두 사람이 있어야 합니다. 여와 남을 넣거나 허그 한 장을 여 칸에 넣으세요.' }
}

function syncDeskStageEmpty() {
  const empty = document.getElementById('adult-desk-stage-empty')
  if (!empty) return
  const assemble = document.getElementById('desk-assemble')
  if (assemble && !assemble.hidden) {
    empty.hidden = true
    return
  }
  const hasShot = Boolean(currentResult?.imageUrl || currentResult?.videoUrl)
  empty.hidden = hasShot
}

function placeAdultDeskNodes() {
  const host = document.getElementById('studio-area')
  const stage = document.getElementById('adult-desk-stage')
  const keep = document.getElementById('adult-desk-keep')
  const result = document.getElementById('result-section')
  const gallery = document.getElementById('admin-gallery')
  const formPanel = document.getElementById('generate-form')?.closest('section.panel')
  if (!host) return
  if (getAppArea() === 'admin') {
    if (stage && result && result.parentElement !== stage) stage.appendChild(result)
    if (keep && gallery && gallery.parentElement !== keep) keep.appendChild(gallery)
    syncDeskStageEmpty()
  } else {
    if (result && formPanel && result.parentElement !== host) formPanel.after(result)
    if (gallery && gallery.parentElement !== host) host.appendChild(gallery)
    const animate = document.getElementById('animate-panel')
    const video = document.getElementById('video-result')
    if (animate && video && video.parentElement !== animate) animate.appendChild(video)
  }
}

function initAdultDesk() {
  // 옷 칸은 나체 녹이기만. 갈아입히기(VTON)는 몸을 다시 그려서 뺐다.
  const looks = [{ id: 'nude', label: '나체', garment: '나체', text: '나체' }]
  const deskLookNoun = () => '옷 녹이기'
  const places = [
    { id: 'hotel', label: '호텔', text: '호텔 룸' },
    { id: 'bed', label: '침실', text: '침실' },
    { id: 'bath', label: '욕실', text: '욕실' },
    { id: 'living', label: '거실', text: '거실' },
    { id: 'hall', label: '복도', text: '호텔 복도' },
    { id: 'roof', label: '야경', text: '도시 야경 옥상' },
    { id: 'studio', label: '스튜디오', text: '흰 스튜디오' },
  ]
  const poses = [
    { id: 'stand', label: '서기', text: '서서' },
    { id: 'sit', label: '앉기', text: '앉아' },
    { id: 'lie', label: '눕기', text: '침대에 누워' },
    { id: 'hug', label: '포옹', text: '서로 안기게' },
    { id: 'lean', label: '기대기', text: '벽에 기대어' },
    { id: 'window', label: '창가', text: '창가에 서서' },
    { id: 'back', label: '뒤돌아', text: '살짝 뒤돌아보며' },
    { id: 'over', label: '숙이기', text: '허리를 살짝 숙이며' },
    { id: 'kneel', label: '무릎', text: '무릎을 꿇고' },
    { id: 'cross', label: '다리꼬기', text: '다리를 꼬고 앉아' },
  ]
  const moves = [
    {
      id: 'kiss',
      label: '키스',
      motion: '키스. 두 사람이 서로 적극적으로 입술을 맞대고 키스한다. 옷은 그대로. 같은 두 얼굴. 서양인 교체 금지. 원본 구도 유지.',
      motionCouple:
        '키스. 원본 남자가 원본 여자와 입맞춤. 남자는 남자로 유지. 여여 키스 금지. 같은 두 얼굴. 옆모습이면 옆모습 유지. 정면 새 모델 금지. 원본 포옹·구도 유지. 새 사람 금지.',
    },
    { id: 'hug', label: '포옹', motion: '두 사람이 가볍게 서로 안는다. 옷은 그대로. 같은 두 얼굴. 옆모습이면 옆모습 유지. 정면 새 모델 금지. 원본 구도 유지.' },
    { id: 'come', label: '다가가기', motion: '그가 그녀에게 한 걸음 다가간다. 옷은 그대로.' },
    { id: 'turn', label: '고개', motion: '고개를 아주 조금. 같은 얼굴. 옆모습이면 옆모습 유지. 정면 새 모델 금지. 옷은 그대로.' },
    { id: 'walk', label: '걷기', motion: '천천히 몇 걸음 걷는다. 옷은 그대로.' },
    { id: 'look', label: '돌아보기', motion: '고개만 살짝. 카메라 정면으로 돌리지 말 것. 같은 얼굴. 새 모델 금지. 옷은 그대로.' },
    { id: 'smile', label: '미소', motion: '살짝 미소 짓는다. 옷은 그대로.' },
    {
      id: 'undress',
      label: '벗기',
      motion: '옷벗김. 혼자. 원본 구도 유지. 클로즈업 금지.',
      motionCouple:
        '옷벗김. 여자만 나체. 남자 옷은 유지. 같은 두 얼굴. 원본 구도 유지. 클로즈업 금지.',
    },
    {
      id: 'breast',
      label: '가슴',
      motion:
        '혼자. 자신의 가슴을 양손으로 주무른다. 지금 옷 유지. 끝까지 양손이 가슴에 있다. 옷 다시 입히기 금지. 원본 구도 유지. 새 사람 금지.',
      motionCouple: '남자가 여자의 가슴을 만진다. 같은 두 사람. 새 사람 금지. 원본 구도 유지. 클로즈업 금지.',
    },
    {
      id: 'hands',
      label: '손',
      motion:
        '혼자. 왼손은 가슴을, 오른손은 보지를 만진다. 지금 옷 유지. 끝까지 그 손. 옷 다시 입히기 금지. 원본 구도 유지. 새 사람 금지.',
      motionCouple: '남자가 한 손은 여자의 가슴을, 한 손은 보지를 동시에 만진다. 같은 두 사람. 새 사람 금지.',
    },
    { id: 'zipper', label: '지퍼', motion: '여자가 남자 바지 지퍼만 내린다. 바지는 유지. 여자 배·피부·가랑이에 지퍼를 그리지 말 것.', motionCouple: '남자 바지 지퍼만 내린다. 여자는 지금 몸 그대로. 여자 몸에 지퍼 금지. 자지 금지. 같은 두 얼굴.' },
  ]
  const packs = { look: looks, place: places, pose: poses, move: moves }
  const MULTI = new Set(['pose', 'move'])
  const MOVE_MAX = 4

  const state = {
    look: 'nude',
    place: 'hotel',
    pose: ['stand'],
    move: [],
    job: 'still',
    len: 15,
  }

  const pickedIds = (key) => (MULTI.has(key) ? state[key] : [state[key]])

  const fill = (rootId, items, key) => {
    const root = document.getElementById(rootId)
    if (!root) return
    const picked = pickedIds(key)
    root.innerHTML = items
      .map((item) => {
        const idx = picked.indexOf(item.id)
        const on = idx >= 0
        const num =
          MULTI.has(key) && on && picked.length > 1
            ? `<span class="desk-card__n">${idx + 1}</span>`
            : ''
        return `<button type="button" class="desk-card${on ? ' is-on' : ''}" data-desk-pick="${key}" data-id="${item.id}">${num}${item.label}</button>`
      })
      .join('')
  }
  const fillAll = () => {
    fill('desk-looks', looks, 'look')
    fill('desk-looks-move', looks, 'look')
    fill('desk-places', places, 'place')
    fill('desk-poses', poses, 'pose')
    fill('desk-moves', moves, 'move')
  }
  fillAll()

  const pickText = (list, id) => list.find((x) => x.id === id)?.text || ''
  const pickMotions = () =>
    state.move.map((id) => moves.find((item) => item.id === id)).filter(Boolean)

  const ensureDeskNudeMove = () => {
    if (state.look !== 'nude') return
    const actionIds = new Set(['kiss', 'hug', 'come', 'breast', 'hands', 'zipper'])
    if (state.move.some((id) => actionIds.has(id))) return
    if (state.move.some((id) => id === 'undress')) return
    state.move = ['undress', ...state.move]
    fill('desk-moves', moves, 'move')
  }

  const deskLookKind = () => 'nude'

  const compileDeskMove = (couple, picked) => {
    const ids = new Set(picked.map((one) => one.id))
    const nude = state.look === 'nude' || ids.has('undress')
    const alreadyNude =
      currentDeskWork()?.lookApplied === 'nude' ||
      /이미\s*나체|나체\s*유지|fully\s*nude|already\s*nude|옷을 녹여 나체/i.test(currentResult.prompt || '')
    const pubic =
      '치골에만 성긴 실제 곱슬 음모. 민무늬·역삼각·검정 팬티·흰 팬티·끈팬티 금지. 브라·팬티 없음.'
    const finish = (text) => {
      let out = String(text || '').replace(/\s{2,}/g, ' ').trim()
      if (nude) {
        out = out.replace(/옷은 그대로\.?\s*/g, '').replace(/지금 옷 유지\.?\s*/g, '')
      }
      if (couple && !/남자는 남자로/.test(out)) out = `${out} 남자는 남자로. 여여 금지.`
      return out.replace(/\s{2,}/g, ' ').trim()
    }
    if (ids.has('zipper')) {
      return finish(
        couple
          ? alreadyNude || nude
            ? `남자 바지 지퍼만 손으로 내린다. 여자는 나체 유지. ${pubic} 여자 배·피부·가랑이에 지퍼·솔기 금지. 두 머리 유지. 배만 확대 금지. 자지 금지. 같은 두 얼굴. 원본 구도 유지.`
            : '여자가 남자 바지 지퍼만 내린다. 남자 바지는 유지. 여자 몸에 지퍼를 그리지 말 것. 두 머리 유지. 배만 확대 금지. 같은 두 얼굴.'
          : '혼자 장에는 지퍼를 그리지 말 것. 원본 구도 유지.',
      )
    }
    if (couple && ids.has('kiss') && nude) {
      return finish(
        alreadyNude
          ? `원본 남자가 원본 여자와 입맞춤. 남자는 남자로(짧은 머리, 납작한 가슴). 여자는 이미 완전 나체 유지. ${pubic} 치마를 발목으로 내리지 말 것. 남자 옷은 유지. 여여 키스 금지. 같은 두 얼굴. 원본 구도 유지. 클로즈업 금지.`
          : `원본 남자가 원본 여자와 입맞춤. 남자는 남자로(짧은 머리, 납작한 가슴). 여자는 이미 나체여야 함. 영상에서 치마를 내리거나 검정 팬티를 그리지 말 것. ${pubic} 남자 옷은 유지. 여여 키스 금지. 같은 두 얼굴. 원본 구도 유지. 클로즈업 금지.`,
      )
    }
    if (couple && ids.has('kiss')) {
      return finish(
        '키스. 원본 남자가 원본 여자와 입맞춤. 남자는 남자로 유지. 여여 키스 금지. 같은 두 얼굴. 원본 구도 유지. 클로즈업 금지.',
      )
    }
    if (couple && ids.has('hug') && nude) {
      return finish(
        alreadyNude
          ? `원본 남자가 원본 여자를 안는다. 남자는 남자로. 여자는 나체 유지. ${pubic} 여여 금지. 같은 두 얼굴. 원본 구도 유지. 클로즈업 금지.`
          : `원본 남자가 원본 여자를 안는다. 여자 옷만 녹여 나체. ${pubic} 남자 옷은 유지. 남자는 남자로. 여여 금지. 같은 두 얼굴. 원본 구도 유지. 클로즈업 금지.`,
      )
    }
    if (!couple && ids.has('undress') && (ids.has('breast') || ids.has('hands'))) {
      return finish(
        ids.has('hands')
          ? `옷벗김 후 왼손은 가슴을, 오른손은 보지를 만진다. ${pubic} 혼자. 원본 구도 유지. 새 사람 금지.`
          : `옷벗김 후 자신의 가슴을 양손으로 주무른다. ${pubic} 혼자. 원본 구도 유지. 새 사람 금지.`,
      )
    }
    if (ids.has('hands') && nude) {
      return finish(
        alreadyNude
          ? couple
            ? `남자가 한 손은 여자의 가슴을, 한 손은 보지를 만진다. 여자는 이미 나체 유지. ${pubic} 같은 두 사람. 새 사람 금지.`
            : `혼자. 왼손은 가슴을, 오른손은 보지를 만진다. 이미 나체 유지. ${pubic} 원본 구도 유지. 새 사람 금지.`
          : couple
            ? `남자가 한 손은 여자의 가슴을, 한 손은 보지를 만진다. 여자 옷만 녹여 나체. ${pubic} 남자 옷은 유지. 같은 두 사람. 새 사람 금지.`
            : `옷벗김 후 왼손은 가슴을, 오른손은 보지를 만진다. ${pubic} 혼자. 원본 구도 유지. 새 사람 금지.`,
      )
    }
    if (ids.has('breast') && nude) {
      return finish(
        alreadyNude
          ? couple
            ? `남자가 여자의 가슴을 만진다. 여자는 이미 나체 유지. ${pubic} 같은 두 사람. 새 사람 금지. 원본 구도 유지. 클로즈업 금지.`
            : `혼자. 자신의 가슴을 양손으로 주무른다. 이미 나체 유지. ${pubic} 원본 구도 유지. 새 사람 금지.`
          : couple
            ? `남자가 여자의 가슴을 만진다. 여자 옷만 녹여 나체. ${pubic} 남자 옷은 유지. 같은 두 사람. 새 사람 금지. 원본 구도 유지. 클로즈업 금지.`
            : `옷벗김 후 자신의 가슴을 양손으로 주무른다. ${pubic} 혼자. 원본 구도 유지. 새 사람 금지.`,
      )
    }
    if (couple && nude) {
      return finish(
        alreadyNude
          ? `이미 나체 유지. CAST 그 여자(그 얼굴·그 머리). CAST 그 남자(짧은 머리, 납작한 가슴, 정장). 남자 옷 유지. ${pubic} 새 모델 금지. 남자를 여자로 바꾸기 금지. 여여 금지. 같은 두 얼굴. 원본 구도 유지.`
          : `CAST 여자 옷만 녹여 나체. ${pubic} CAST 남자는 남자로 유지(짧은 머리, 납작한 가슴). 남자 정장은 한 올도 벗기지 말 것. 두 번째 여자 금지. 성별 바꾸기 금지. 여여 금지. 같은 두 얼굴. 원본 구도 유지. 클로즈업 금지.`,
      )
    }
    if (nude && !couple && state.len <= 5 && picked.length === 1 && ids.has('undress')) {
      return finish(
        currentResult.isShortsEndFrame
          ? `옷벗김. ${pubic} 혼자. 다음 겹만.`
          : `옷벗김. ${pubic} 혼자. 한 겹만.`,
      )
    }
    if (nude && !couple) return finish(`옷벗김. ${pubic} 혼자. 원본 구도 유지. 클로즈업 금지.`)
    return finish(
      picked.map((one) => (couple && one.motionCouple ? one.motionCouple : one.motion)).join(' '),
    )
  }

  const deskActionFromPicked = (picked) => {
    const ids = new Set((picked || []).map((one) => one.id))
    if (ids.has('kiss')) return 'kiss'
    if (ids.has('hug') || ids.has('come')) return 'hug'
    if (ids.has('breast') || ids.has('hands')) return 'breast'
    return 'none'
  }

  const meltMotionForLook = (couple) => {
    const look = looks.find((item) => item.id === state.look) || looks[0]
    const clothes = look.garment || look.label || String(look.text || '')
    if (look.id === 'nude') {
      return couple
        ? '이 사진 같은 두 사람. 여자 옷만 녹여 나체. 남자 옷은 유지. 자세·구도 유지. 남자는 남자로. 여여 금지. 새 사람 금지.'
        : '이 사진 같은 사람. 지금 옷만 녹여 나체. 얼굴·몸·자세 유지. 새 사람 금지. 서서 다시 찍기 금지.'
    }
    if (couple) {
      return `이 사진 같은 두 사람. 여자만 ${clothes}로 갈아입는다. 남자 옷은 유지. 얼굴·몸·자세·구도 유지. 새 사람 금지.`
    }
    return `이 사진 같은 사람. ${clothes}로 갈아입는다. 얼굴·몸·자세 유지. 새 사람 금지. 서서 다시 찍기 금지.`
  }

  const compileStill = () => {
    const look = pickText(looks, state.look)
    const place = pickText(places, state.place)
    const pose = state.pose.map((id) => pickText(poses, id)).filter(Boolean).join(', ')
    const work = currentDeskWork()
    if (work?.man && !work?.woman) {
      return [
        '올린 성인 한국 남자 그대로, 전신',
        '머리와 얼굴이 프레임 안에 보임',
        place,
        pose,
        'ONLY the source man. Do not draw a second adult.',
      ].join(', ')
    }
    if (deskLockedCast(work).couple) {
      const womanLook = look
        .replace(/,?\s*화보 사진/g, '')
        .replace(/성인 한국 여성/, '여자')
      return [
        '성인 한국 남자와 성인 한국 여자가 함께 있는 전신 화보',
        '두 사람 모두 머리와 얼굴이 프레임 안에 보임',
        `${womanLook}, 남자는 셔츠`,
        place,
        pose,
        '두 명. 한 명만 그리기 금지. 머리 잘림 금지.',
      ].join(', ')
    }
    return [
      look,
      '혼자 한 명의 성인 한국 여성만, 전신',
      '머리와 얼굴이 프레임 안에 보임',
      place,
      pose,
      state.pose.includes('lie') ? '침대에 누운 전신. 서서 찍기 금지.' : '',
      'ONLY one woman. Do not draw a second adult or extra face.',
    ]
      .filter(Boolean)
      .join(', ')
  }

  const compileLookOnly = (coupleInScene = false) => {
    const look = pickText(looks, state.look)
    const nude = state.look === 'nude'
    const couple = coupleInScene === true
    if (couple) {
      if (nude) {
        return '원본을 그 자리에서만 고친다. 여 칸에서 온 사람만 옷을 녹여 나체. 팬티·검정 팬티 없음. 남 칸에서 온 사람은 그대로. 위치 추측 금지. 여여·성별 바꾸기·새 얼굴 금지.'
      }
      return `원본을 그 자리에서만 고친다. 여 칸에서 온 사람만 옷을 ${look}으로 녹인다. 남 칸에서 온 사람은 그대로. 위치 추측 금지. 여여·성별 바꾸기·새 얼굴 금지.`
    }
    if (nude) {
      return '원본을 그 자리에서만 고친다. 얼굴·머리·몸매·자세·방 유지. 옷을 녹여 나체. 팬티·검정 팬티 없음. 새 사람·흰 스튜디오·마른 화보 모델 금지.'
    }
    return `원본을 그 자리에서만 고친다. 얼굴·머리·몸·자세·구도 유지. 옷만 ${look}으로 녹인다. 새 사람·흰 스튜디오·화보 모델 금지.`
  }

  const compilePlaceOnly = (coupleInScene = false) => {
    const place = pickText(places, state.place)
    const couple = coupleInScene === true
    const stand = state.pose.includes('stand')
    const sit = state.pose.includes('sit')
    const lie = state.pose.includes('lie')
    const hug = state.pose.includes('hug')
    const extras = state.pose
      .filter((id) => id !== 'stand' && id !== 'sit' && id !== 'lie' && id !== 'hug')
      .map((id) => pickText(poses, id))
      .filter(Boolean)
    const pose = couple
      ? [
          hug ? '지금 떨어져 선 두 사람을 가볍게 서로 안기게 한다. 옷은 유지. 둘 다 얼굴이 보임.' : '',
          !hug && stand && sit ? '선 자세를 바꿔 여자는 앉히고 남자는 옆에 서게 한다. 한 장. 둘 다 얼굴이 보임.' : '',
          !hug && stand && !sit && !lie ? '두 사람 모두 서서. 한 장.' : '',
          !hug && sit && !stand && !lie ? '지금 선 자세를 바꿔 두 사람 모두 앉힌다. 소파나 침대에 앉아. 서서 유지 금지.' : '',
          !hug && lie ? '지금 선 자세를 바꿔 두 사람 모두 침대에 눕힌다. 서서 찍기 금지.' : '',
          ...extras,
        ]
          .filter(Boolean)
          .join(', ')
      : [
          sit && !lie ? '지금 선 자세를 바꿔 앉힌다. 소파나 침대에 앉아. 서서 유지 금지.' : '',
          lie ? '지금 선 자세를 바꿔 침대에 눕힌다. 전신. 서서 찍기 금지.' : '',
          !sit && !lie
            ? state.pose
                .filter((id) => id !== 'hug')
                .map((id) => pickText(poses, id))
                .filter(Boolean)
                .join(', ')
            : extras.join(', '),
        ]
          .filter(Boolean)
          .join(', ')
    return [place, pose, sit || lie || hug ? '얼굴은 같은 사람' : '방은 바꾸고 얼굴은 유지']
      .filter(Boolean)
      .join(', ')
  }

  const setDeskStepOn = (step, on) => {
    document.querySelectorAll(`[data-desk-step="${step}"]`).forEach((btn) => {
      btn.disabled = !on
      btn.setAttribute('aria-disabled', on ? 'false' : 'true')
    })
  }

  const setDeskCardsOn = (rootId, on) => {
    const root = document.getElementById(rootId)
    if (!root) return
    root.classList.toggle('is-off', !on)
  }

  let deskGateSeq = 0
  let deskStillRunning = false
  const deskLeadIsReady = async (url, markedFull) => {
    if (!url) return false
    if (markedFull) return true
    if (typeof deskLooksStandingFull === 'function' && (await deskLooksStandingFull(url))) return true
    const size = await deskImageSize(url)
    const tall = size.h / Math.max(size.w, 1) >= 1.2
    let face = null
    if (typeof globalThis.estimateFaceBoxFromImage === 'function') {
      face = await globalThis.estimateFaceBoxFromImage(url)
    }
    const feet = await deskFootClusters(url)
    return Boolean(tall && face && face.h <= 0.16 && face.y < 0.2 && feet >= 2)
  }

  const syncDeskGates = async () => {
    const seq = ++deskGateSeq
    const work = currentDeskWork()
    const hasWoman = Boolean(work?.woman || work?.womanFace)
    const hasMan = Boolean(work?.man || work?.manFace)
    const hasCast = hasWoman || hasMan
    const womanReady = hasWoman ? await deskLeadIsReady(work.woman, work.womanFull) : false
    const manReady = hasMan ? await deskLeadIsReady(work.man, work.manFull) : false
    if (seq !== deskGateSeq) return
    const needBody =
      (hasWoman && !womanReady) || (hasMan && !manReady)
    const bothReady = hasWoman && hasMan && womanReady && manReady
    const oneReady = (hasWoman && womanReady && !hasMan) || (hasMan && manReady && !hasWoman)
    const scene = currentResult?.imageUrl || work?.scene || ''
    let coupleScene = Boolean(work?.assembledPair)
    if (!coupleScene && typeof countDeskSceneFaces === 'function') {
      const probe = scene || work?.woman || ''
      if (probe) {
        coupleScene = (await countDeskSceneFaces(probe, 6000, { couple: true })) >= 2
        if (seq !== deskGateSeq) return
      }
    }
    const canBody = hasCast
    const canTogether = bothReady
    const canOutfit = hasCast || Boolean(scene)
    const canMove = hasCast || Boolean(scene)
    setDeskStepOn('body', canBody)
    if (deskStillRunning) return
    setDeskStepOn('together', canTogether)
    setDeskStepOn('look', true)
    setDeskStepOn('shape', hasWoman)
    setDeskStepOn('mini', hasWoman)
    setDeskStepOn('place', canOutfit)
    const togetherBtn = document.querySelector('[data-desk-step="together"]')
    if (togetherBtn) togetherBtn.hidden = !hasWoman || !hasMan
    const assembleOpen = document.getElementById('desk-assemble-open')
    if (assembleOpen) {
      const canAssemble = hasCast && !needBody
      assembleOpen.hidden = state.job !== 'still'
      assembleOpen.disabled = !canAssemble
      assembleOpen.setAttribute('aria-disabled', canAssemble ? 'false' : 'true')
    }
    const stillPacks = document.getElementById('desk-still-packs')
    if (stillPacks) stillPacks.classList.toggle('is-off', !canOutfit)
    setDeskCardsOn('desk-looks', canOutfit)
    setDeskCardsOn('desk-places', canOutfit)
    setDeskCardsOn('desk-poses', canOutfit)
    setDeskCardsOn('desk-looks-move', canMove)
    setDeskCardsOn('desk-moves', canMove)
    const videoPacks = document.getElementById('desk-video-packs')
    if (videoPacks) videoPacks.classList.toggle('is-off', !canMove)
    const run = document.getElementById('desk-run')
    if (run && state.job === 'video') run.disabled = !canMove
    const hint = document.getElementById('desk-still-hint')
    if (hint) {
      if (!canOutfit) hint.textContent = '여 칸에 사진을 넣거나 장면 사진을 올리세요. 그다음 옷 녹이기입니다.'
      else if (needBody) hint.textContent = '증명·상반신은 1 몸 잇기 또는 옷 녹이기를 누르면 같은 사람으로 몸을 이은 뒤 녹입니다. 미니·몸 보기도 잇은 뒤에 합니다.'
      else if (coupleScene) hint.textContent = '이미 한 장에 두 사람입니다. 옷 녹이기·미니·몸 보기는 여자만입니다. 벗기 찍기는 그 다음입니다.'
      else if (bothReady && !coupleScene) hint.textContent = '두 칸에 따로 넣은 사진이면 먼저 2 한 장면을 누른 뒤 옷 녹이기입니다. 미니·몸 보기는 여 칸만 봅니다.'
      else hint.textContent = '옷 녹이기는 여자만 나체입니다. 미니는 42번보다 단과 타이트함을 10% 올립니다. 몸 보기는 아이보리 운동복입니다.'
    }
  }

  const syncJobUi = () => {
    document.querySelectorAll('[data-desk-job]').forEach((btn) => {
      btn.classList.toggle('is-on', btn.getAttribute('data-desk-job') === state.job)
    })
    const stillPacks = document.getElementById('desk-still-packs')
    const videoPacks = document.getElementById('desk-video-packs')
    const stillSteps = document.getElementById('desk-still-steps')
    if (stillPacks) stillPacks.hidden = state.job !== 'still'
    if (stillSteps) stillSteps.hidden = state.job !== 'still'
    if (videoPacks) videoPacks.hidden = state.job !== 'video'
    const assembleOpen = document.getElementById('desk-assemble-open')
    if (assembleOpen) assembleOpen.hidden = state.job !== 'still'
    const assemblePanel = document.getElementById('desk-assemble')
    if (assemblePanel && state.job !== 'still') {
      assemblePanel.hidden = true
      syncDeskStageEmpty()
    }
    const run = document.getElementById('desk-run')
    if (run) {
      run.hidden = state.job !== 'video'
      if (state.job === 'video') {
        const labels = state.move
          .map((id) => moves.find((item) => item.id === id)?.label)
          .filter(Boolean)
        run.textContent =
          state.look === 'nude'
            ? '벗기 찍기'
            : labels.length
              ? `움직이기 · ${labels.join('·')}`
              : '움직이기'
      }
    }
    const lookRun = document.getElementById('desk-look-run')
    if (lookRun) lookRun.textContent = deskLookNoun()
    const lookStamp = `옷 · ${window.__DESK_BUILD || ''}`
    const lookKicker = document.getElementById('desk-look-kicker')
    if (lookKicker) lookKicker.textContent = lookStamp
    const lookKickerMove = document.getElementById('desk-look-kicker-move')
    if (lookKickerMove) lookKickerMove.textContent = lookStamp
    void syncDeskGates()
  }

  const syncCastSlot = (role) => {
    const work = currentDeskWork()
    const url =
      (role === 'man' ? work?.man || work?.manFace : work?.woman || work?.womanFace) || ''
    const img = document.getElementById(`desk-cast-${role}-img`)
    const empty = document.getElementById(`desk-cast-${role}-empty`)
    if (!img || !empty) return
    if (url) {
      img.src = url
      img.hidden = false
      empty.hidden = true
    } else {
      img.removeAttribute('src')
      img.hidden = true
      empty.hidden = false
    }
  }

  const syncWorkUi = () => {
    const work = ensureDeskWork()
    const title = document.getElementById('desk-work-title')
    if (title && document.activeElement !== title) title.value = work?.title || ''
    const list = document.getElementById('desk-work-list')
    if (list) {
      const store = readDeskWorks()
      list.innerHTML = store.works
        .map(
          (item) =>
            `<button type="button" class="desk-work-chip${item.id === store.currentId ? ' is-on' : ''}" data-desk-work="${item.id}">${String(item.title || '작품').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))}</button>`,
        )
        .join('')
    }
    syncCastSlot('woman')
    syncCastSlot('man')
    syncTwoPeopleForMoves()
    void syncDeskGates()
  }

  document.getElementById('adult-desk')?.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('[data-desk-view]')
    if (viewBtn) {
      localStorage.setItem('storymag-desk-view', viewBtn.getAttribute('data-desk-view') === 'keep' ? 'keep' : 'make')
      syncAdminWorkspaceUi()
      return
    }
    const jobBtn = event.target.closest('[data-desk-job]')
    if (jobBtn) {
      state.job = jobBtn.getAttribute('data-desk-job') === 'video' ? 'video' : 'still'
      if (state.job === 'video') ensureDeskNudeMove()
      syncJobUi()
      return
    }
    const lenBtn = event.target.closest('[data-desk-len]')
    if (lenBtn) {
      const pickedLen = Number(lenBtn.getAttribute('data-desk-len'))
      state.len = pickedLen === 5 || pickedLen === 10 || pickedLen === 15 ? pickedLen : 15
      document.querySelectorAll('[data-desk-len]').forEach((btn) => {
        btn.classList.toggle('is-on', Number(btn.getAttribute('data-desk-len')) === state.len)
      })
      return
    }
    const card = event.target.closest('[data-desk-pick]')
    if (card) {
      const key = card.getAttribute('data-desk-pick')
      const id = card.getAttribute('data-id')
      if (key && id && packs[key]) {
        if (MULTI.has(key)) {
          const list = state[key]
          const idx = list.indexOf(id)
          if (idx >= 0) {
            list.splice(idx, 1)
          } else if (key === 'move' && list.length >= MOVE_MAX) {
            setFormStatus(`움직임은 한 번에 ${MOVE_MAX}개까지입니다. 고른 걸 끄고 다시 고르세요.`, true)
          } else {
            if (key === 'pose' && (id === 'stand' || id === 'sit' || id === 'lie' || id === 'hug')) {
              ;['stand', 'sit', 'lie', 'hug'].forEach((drop) => {
                if (drop === id) return
                const dropAt = list.indexOf(drop)
                if (dropAt >= 0) list.splice(dropAt, 1)
              })
            }
            list.push(id)
          }
        } else {
          state[key] = id
        }
        fill(
          key === 'look'
            ? 'desk-looks'
            : key === 'place'
              ? 'desk-places'
              : key === 'pose'
                ? 'desk-poses'
                : 'desk-moves',
          packs[key],
          key,
        )
        if (key === 'look') fill('desk-looks-move', looks, 'look')
        if (key === 'look' && id === 'nude') ensureDeskNudeMove()
        syncJobUi()
        // desk pick selects only — 옷 녹이기·벗기 찍기를 눌러야 시작
      }
    }
    const workChip = event.target.closest('[data-desk-work]')
    if (workChip) {
      selectDeskWork(workChip.getAttribute('data-desk-work'))
      syncWorkUi()
      restoreDeskWorkScene()
    }
  })

  let castTarget = 'woman'
  const applyDeskCastFile = async (role, file) => {
    if (!isImageFileLike(file)) {
      setFormStatus('이미지 파일만 넣을 수 있습니다.', true)
      return
    }
    try {
      let dataUrl = await prepareImageDataUrl(file, 1280)
      try {
        dataUrl = await compactDeskScene(dataUrl, 1280, 0.86)
      } catch {
        /* use prepared jpeg */
      }
      updateCurrentDeskWork({
        [role]: dataUrl,
        [`${role}Face`]: dataUrl,
        [`${role}Full`]: false,
        [`${role}CastId`]: '',
        [`${role}CastLock`]: null,
        pair: role === 'man' ? 'mw' : currentDeskWork()?.man ? currentDeskWork()?.pair || 'mw' : currentDeskWork()?.pair,
      })
      const faces =
        typeof countDeskSceneFaces === 'function'
          ? await countDeskSceneFaces(dataUrl, 8000, { mergeIou: 0.4, noTimeout: true, couple: true })
          : 0
      if (faces >= 2) {
        if (role === 'man') {
          syncWorkUi()
          setFormStatus('한 장에 두 사람이면 여 칸에 넣으세요. 남 칸은 남자 한 명만입니다.', true)
          return
        }
        updateCurrentDeskWork({
          woman: dataUrl,
          womanLock: dataUrl,
          womanFace: dataUrl,
          womanFull: true,
          man: '',
          manFace: '',
          manCastId: '',
          manCastLock: null,
          manFull: false,
        })
        showResult(dataUrl, '두 사람 장면', false, {
          accepted: true,
          prompt: currentResult.prompt || '',
          size: sizeField?.value || 'story',
          genMode: 'fashion',
          engine: 'cast',
        })
        deskAdoptCoupleStill(dataUrl)
        syncWorkUi()
        void syncDeskGates()
        setFormStatus('여 칸에 한 장입니다. 남 칸은 비웁니다. 나체를 고른 뒤 옷 녹이기를 누르세요.', false)
        return
      }
      const lock = await captureDeskCastLock(role, dataUrl)
      updateCurrentDeskWork({
        [`${role}CastId`]: lock.id,
        [`${role}CastLock`]: lock,
      })
      if (!lock.ok) {
        syncWorkUi()
        setFormStatus('얼굴을 확인하지 못해 CAST로 잠그지 않습니다. 추측하지 않습니다.', true)
        return
      }
      const both = Boolean(currentDeskWork()?.woman && currentDeskWork()?.man)
      updateCurrentDeskWork(
        both
          ? deskMwPatch({ sourceKind: 'pair', castLayout: null })
          : {
              peopleCount: 1,
              sourceKind: 'portrait',
              sourceCast: '',
              verifiedSourceCast: '',
              pair: '',
              womanLock: role === 'woman' ? '' : currentDeskWork()?.womanLock || '',
              castLayout: role === 'woman' ? deskSoloWomanLayout() : currentDeskWork()?.castLayout || null,
            },
      )
      syncWorkUi()
      setDeskStepOn('body', true)
      void syncDeskGates()
      setFormStatus(role === 'man' ? '남 얼굴을 작품에 넣었습니다.' : '여 얼굴을 작품에 넣었습니다.', false)
    } catch (err) {
      setFormStatus(`얼굴을 넣지 못했습니다: ${err instanceof Error ? err.message : String(err)}`, true)
    }
  }
  const applyDeskSceneFile = async (file) => {
    if (!isImageFileLike(file)) {
      setFormStatus('이미지 파일만 넣을 수 있습니다.', true)
      return
    }
    const uploaded = await loadImageFromFile(file)
    if (!uploaded) return
    const full =
      typeof globalThis.ensureStableDataUrl === 'function'
        ? (await globalThis.ensureStableDataUrl(uploaded)) || uploaded
        : uploaded
    updateCurrentDeskWork({
      woman: full,
      womanLock: full,
      womanFull: true,
    })
    showResult(full, '장면 사진', false, {
      accepted: true,
      prompt: currentResult.prompt || '',
      size: sizeField?.value || 'story',
      genMode: 'fashion',
      engine: 'cast',
    })
    syncWorkUi()
    void syncDeskGates()
    setFormStatus('여 칸에 넣었습니다. 옷 칸을 고른 뒤 위 단추를 누르세요.', false)
    try {
      const found = await captureDeskLeadsFromScene(full)
      syncWorkUi()
      if (found.count >= 2) {
        deskAdoptCoupleStill(full)
        setFormStatus(
          '이미 한 장에 두 사람입니다. 붙이지 않습니다. 왼쪽이 남, 오른쪽이 여입니다. 나체·벗기를 누르세요.',
          false,
        )
      } else if (found.count === 1) {
        setFormStatus('여 칸에 넣었습니다. 옷 칸을 고른 뒤 위 단추를 누르세요.', false)
      }
    } catch (err) {
      setFormStatus(
        `여 칸에는 넣었습니다. 얼굴 자르기만 실패: ${err instanceof Error ? err.message : String(err)}`,
        true,
      )
    }
  }
  window.__deskApplyCastFile = applyDeskCastFile
  window.__deskApplySceneFile = applyDeskSceneFile

  const nextDeskCastRole = () => {
    const work = currentDeskWork()
    if (window.__deskPasteCast === 'woman' || window.__deskPasteCast === 'man') return window.__deskPasteCast
    if (!work?.woman) return 'woman'
    if (!work?.man) return 'man'
    return window.__deskLastCast === 'man' ? 'man' : 'woman'
  }

  window.__deskTakeCastFiles = async (files, preferredRole) => {
    const list = (files || []).filter(isImageFileLike).slice(0, 2)
    if (!list.length) {
      setFormStatus('이미지 파일만 넣을 수 있습니다. Ctrl+V 또는 칸에 끌어다 놓으세요.', true)
      return
    }
    if (list.length >= 2) {
      await applyDeskCastFile('woman', list[0])
      await applyDeskCastFile('man', list[1])
      return
    }
    const role = preferredRole === 'man' || preferredRole === 'woman' ? preferredRole : nextDeskCastRole()
    window.__deskLastCast = role
    window.__deskPasteCast = role
    await applyDeskCastFile(role, list[0])
  }

  const applyDeskClipboard = async (target) => {
    window.__deskLastCast = target === 'scene' ? window.__deskLastCast : target
    if (target === 'woman' || target === 'man') window.__deskPasteCast = target
    try {
      const file = await readClipboardImageFile()
      if (!file) {
        setFormStatus('복사한 사진을 Ctrl+V로 붙이거나, 칸에 끌어다 놓으세요.', true)
        return
      }
      if (target === 'scene') {
        window.__deskLastCast = ''
        await applyDeskSceneFile(file)
        return
      }
      await applyDeskCastFile(target, file)
    } catch {
      setFormStatus('복사한 사진을 Ctrl+V로 붙이거나, 칸에 끌어다 놓으세요.', true)
    }
  }
  document.getElementById('desk-cast-paste-w')?.addEventListener('click', () => {
    void applyDeskClipboard('woman')
  })
  document.getElementById('desk-cast-paste-m')?.addEventListener('click', () => {
    void applyDeskClipboard('man')
  })
  document.getElementById('desk-scene-paste')?.addEventListener('click', () => {
    void applyDeskClipboard('scene')
  })

  const wireDeskDrop = (el, onFiles) => {
    if (!el) return
    el.addEventListener('dragenter', (event) => {
      event.preventDefault()
      event.stopPropagation()
      el.classList.add('is-drag')
    })
    el.addEventListener('dragover', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
      el.classList.add('is-drag')
    })
    el.addEventListener('dragleave', (event) => {
      if (el.contains(event.relatedTarget)) return
      el.classList.remove('is-drag')
    })
    el.addEventListener('drop', (event) => {
      event.preventDefault()
      event.stopPropagation()
      el.classList.remove('is-drag')
      const files = pickImageFilesFromDataTransfer(event.dataTransfer)
      if (files.length) void onFiles(files)
    })
  }

  document.getElementById('desk-cast-woman')?.addEventListener('pointerenter', () => {
    window.__deskPasteCast = 'woman'
    window.__deskLastCast = 'woman'
  })
  document.getElementById('desk-cast-man')?.addEventListener('pointerenter', () => {
    window.__deskPasteCast = 'man'
    window.__deskLastCast = 'man'
  })
  document.getElementById('adult-desk-stage')?.addEventListener('pointerenter', () => {
    window.__deskPasteCast = ''
  })
  document.querySelector('.adult-desk__person')?.addEventListener('pointerleave', () => {
    window.__deskPasteCast = ''
  })
  ;['desk-cast-woman', 'desk-cast-man'].forEach((id) => {
    document.getElementById(id)?.addEventListener('paste', (event) => {
      const files = pickImageFilesFromDataTransfer(event.clipboardData)
      if (!files.length) return
      event.preventDefault()
      event.stopPropagation()
      const role = id === 'desk-cast-man' ? 'man' : 'woman'
      window.__deskLastCast = role
      window.__deskPasteCast = role
      void window.__deskTakeCastFiles(files, role)
    })
  })
  ;['desk-cast-paste-w', 'desk-cast-paste-m'].forEach((id) => {
    document.getElementById(id)?.addEventListener('paste', (event) => {
      const files = pickImageFilesFromDataTransfer(event.clipboardData)
      if (!files.length) return
      event.preventDefault()
      event.stopPropagation()
      const role = id.endsWith('-m') ? 'man' : 'woman'
      window.__deskLastCast = role
      window.__deskPasteCast = role
      void window.__deskTakeCastFiles(files, role)
    })
  })

  document.getElementById('desk-cast-woman')?.addEventListener('click', () => {
    castTarget = 'woman'
    window.__deskLastCast = 'woman'
    window.__deskPasteCast = 'woman'
    document.getElementById('desk-cast-input')?.click()
  })
  document.getElementById('desk-cast-man')?.addEventListener('click', () => {
    castTarget = 'man'
    window.__deskLastCast = 'man'
    window.__deskPasteCast = 'man'
    document.getElementById('desk-cast-input')?.click()
  })
  document.getElementById('desk-cast-input')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await applyDeskCastFile(castTarget, file)
  })
  wireDeskDrop(document.getElementById('desk-cast-woman'), (files) => window.__deskTakeCastFiles(files, 'woman'))
  wireDeskDrop(document.getElementById('desk-cast-man'), (files) => window.__deskTakeCastFiles(files, 'man'))
  wireDeskDrop(document.querySelector('.desk-cast'), (files) => window.__deskTakeCastFiles(files))
  wireDeskDrop(document.getElementById('desk-cast-paste-w'), (files) => window.__deskTakeCastFiles(files, 'woman'))
  wireDeskDrop(document.getElementById('desk-cast-paste-m'), (files) => window.__deskTakeCastFiles(files, 'man'))
  wireDeskDrop(document.querySelector('.adult-desk__person'), (files) => {
    const hit = window.__deskPasteCast === 'man' ? 'man' : window.__deskPasteCast === 'woman' ? 'woman' : ''
    void window.__deskTakeCastFiles(files, hit)
  })
  wireDeskDrop(document.getElementById('desk-scene-paste'), (files) => applyDeskSceneFile(files[0]))
  wireDeskDrop(document.getElementById('desk-scene-upload'), (files) => applyDeskSceneFile(files[0]))
  document.getElementById('desk-work-new')?.addEventListener('click', () => {
    createDeskWork()
    clearDeskStage()
    syncWorkUi()
    setFormStatus('이전 작품을 지우고 새로 시작합니다. CAST를 넣은 뒤 이어달리세요.', false)
  })
  document.getElementById('desk-work-title')?.addEventListener('change', (event) => {
    const title = String(event.target.value || '').trim() || currentDeskWork()?.title || '작품'
    updateCurrentDeskWork({ title })
    syncWorkUi()
  })
  document.getElementById('desk-scene-new')?.addEventListener('click', () => {
    clearDeskWorkScene()
    state.job = 'still'
    syncJobUi()
    setFormStatus('지금 장을 비웠습니다. CAST는 그대로입니다. 장면 사진을 올리거나 새 사진을 만드세요.', false)
  })
  document.getElementById('desk-scene-upload')?.addEventListener('click', () => {
    document.getElementById('desk-scene-input')?.click()
  })
  document.getElementById('desk-scene-input')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await applyDeskSceneFile(file)
  })
  document.getElementById('desk-leads-from-scene')?.addEventListener('click', async () => {
    if (!currentResult?.imageUrl) {
      setFormStatus('가운데에 장면 사진이 있어야 합니다. 먼저 장면을 올리세요.', true)
      return
    }
    setFormStatus('장면에서 주연 얼굴을 찾는 중…', false)
    try {
      const found = await captureDeskLeadsFromScene(currentResult.imageUrl)
      syncWorkUi()
      if (found.count >= 2) {
        setFormStatus('이 사진의 두 사람을 주연으로 넣었습니다. 왼쪽이 남, 오른쪽이 여입니다. 바뀌었으면 여↔남을 누르세요.', false)
      } else if (found.count === 1) {
        setFormStatus('한 사람을 주연으로 넣었습니다.', false)
      } else {
        setFormStatus('얼굴을 찾지 못했습니다. 장면은 그대로입니다.', true)
      }
    } catch (err) {
      setFormStatus(`주연으로 넣지 못했습니다: ${err instanceof Error ? err.message : String(err)}`, true)
    }
  })
  document.getElementById('desk-cast-swap')?.addEventListener('click', () => {
    swapDeskCastSlots()
    syncWorkUi()
    setFormStatus('여와 남을 바꿨습니다.', false)
  })
  document.getElementById('desk-two-people')?.addEventListener('change', () => {
    syncTwoPeopleForMoves()
  })

  document.getElementById('desk-advanced-toggle')?.addEventListener('click', () => {
    document.body.classList.toggle('desk-advanced-on')
    const on = document.body.classList.contains('desk-advanced-on')
    const btn = document.getElementById('desk-advanced-toggle')
    if (btn) btn.textContent = on ? '도구 숨기기' : '도구 더 보기'
    if (on) setAdminPanel('faceswap')
    else syncAdminWorkspaceUi()
  })

  const deskHasTwoLeads = () => deskLockedCast(currentDeskWork()).couple

  const dropSoloCoupleMoves = () => {
    return []
  }

  const setTwoPeopleBoxes = (on) => {
    if (on) setTwoPeopleChecked(true)
  }

  const syncTwoPeopleForMoves = () => {
    const deskTwo = document.getElementById('desk-two-people')
    const animateTwo = document.getElementById('animate-two-people')
    if (deskTwo && animateTwo) animateTwo.checked = deskTwo.checked
  }

  const ensureDeskSceneFromCast = () => {
    if (currentResult?.imageUrl) return true
    if (restoreDeskWorkScene()) return true
    const work = currentDeskWork()
    const url = work?.woman || work?.man || ''
    if (!url) return false
    showResult(url, '주연 사진', false, {
      accepted: true,
      prompt: currentResult.prompt || '',
      size: sizeField?.value || 'story',
      genMode: 'fashion',
      engine: 'cast',
    })
    shortsFaceIdStill = deskIdPhoto(work, 'woman') || deskIdPhoto(work, 'man') || url
    return Boolean(currentResult.imageUrl)
  }

  let deskMoveRunning = false
  const pinDeskMoveCast = () => {
    const work = currentDeskWork()
    if (!work) return
    const scene = currentResult?.imageUrl || work.scene || ''
    if (scene) {
      currentResult.imageUrl = scene
      if (String(scene).startsWith('data:')) currentResult.imageDataUrl = scene
      return
    }
    const lead = work.womanLock || work.woman || work.man
    if (!lead) return
    currentResult.imageUrl = lead
    if (String(lead).startsWith('data:')) currentResult.imageDataUrl = lead
  }

  const deskStillLooksClothed = async (src) => {
    const runtime = globalThis.DeskLookRuntime
    if (!src || !runtime || typeof runtime.prepare !== 'function') return null
    try {
      const faces =
        typeof deskStillFaceBoxes === 'function' ? await deskStillFaceBoxes(src, { couple: true }) : []
      const prepared = await runtime.prepare(src, {
        faces: Array.isArray(faces) ? faces : [],
        needCouple: Boolean(faces && faces.length >= 2),
      })
      if (!prepared?.ok || !prepared.labels || !prepared.labels.length) return null
      const clothes = new Set(['Upper-clothes', 'Skirt', 'Pants', 'Dress'])
      let n = 0
      for (let i = 0; i < prepared.labels.length; i += 1) {
        if (clothes.has(prepared.labels[i])) n += 1
      }
      const area = Math.max(1, (prepared.width || 1) * (prepared.height || 1))
      return n >= area * 0.018
    } catch (_) {
      return null
    }
  }

  const runDeskMoveQueue = async () => {
    console.info('desk shorts', window.__DESK_BUILD || '')
    if (deskMoveRunning) {
      setFormStatus('지금 찍는 중입니다.', true)
      return
    }
    ensureDeskNudeMove()
    let picked = pickMotions()
    if (state.look === 'nude' && !picked.some((one) => one.id === 'undress')) {
      const actionIds = new Set(['kiss', 'hug', 'come', 'breast', 'hands', 'zipper'])
      if (!picked.some((one) => actionIds.has(one.id))) {
        const undress = moves.find((item) => item.id === 'undress')
        if (undress) picked = [undress, ...picked]
      }
    }
    if (!picked.length) {
      setFormStatus('동작을 하나 이상 고르세요. 나체면 벗기가 자동입니다.', true)
      return
    }
    if (!ensureDeskSceneFromCast()) {
      setFormStatus('여 칸이나 남 칸에 사진을 넣거나, 장면 사진을 올리세요.', true)
      return
    }
    pinDeskMoveCast()
    deskMoveRunning = true
    try {
    if (animatePanel) animatePanel.hidden = false
    const coupleIds = new Set(['kiss', 'hug', 'come', 'zipper'])
    const workNow = currentDeskWork()
    const twoChecked = typeof deskTwoPeopleChecked === 'function' && deskTwoPeopleChecked()
    const castCouple =
      Boolean(workNow?.woman && workNow?.man) ||
      Boolean(workNow?.assembledPair) ||
      twoChecked
    const wantCouple =
      picked.some((one) => coupleIds.has(one.id)) ||
      twoChecked ||
      (castCouple && picked.some((one) => one.id === 'undress' || one.id === 'breast' || one.id === 'hands'))
    let frame = await resolveDeskFrame({
      from: 'scene',
      needCouple: wantCouple,
    })
    if (!frame.ok && wantCouple && workNow?.woman && workNow?.man && !workNow.assembledPair) {
      setFormStatus('두 사람을 한 장에 붙인 뒤 여자만 벗깁니다…', false)
      const together =
        typeof ensureDeskCoupleScene === 'function' ? await ensureDeskCoupleScene() : ''
      if (together) {
        frame = await resolveDeskFrame({ from: 'scene', needCouple: true })
      } else {
        return
      }
    }
    if (!frame.ok) {
      if (wantCouple || (castCouple && picked.some((one) => one.id === 'undress'))) {
        setFormStatus(
          frame.message || '두 사람 장에서 여자만 벗깁니다. 혼자 벗기로 보내지 않습니다.',
          true,
        )
        return
      }
      // 두 사람 동작만 못 찍는 경우라면 혼자 동작은 그대로 찍는다.
      const solo = picked.filter((one) => !coupleIds.has(one.id))
      const soloFrame = solo.length ? await resolveDeskFrame({ from: 'scene' }) : null
      if (!soloFrame?.ok) {
        setFormStatus(frame.message || '지금 장이 없습니다.', true)
        return
      }
      const dropped = picked.filter((one) => coupleIds.has(one.id)).map((one) => one.label)
      picked = solo
      frame = soloFrame
      setFormStatus(`${dropped.join('·')}는 두 사람이 필요해 뺐습니다. 혼자 동작만 찍습니다…`, false)
    }
    const workBeforePunch = currentDeskWork()
    const plateStill = Boolean(workBeforePunch?.castPlate && workBeforePunch.scene === workBeforePunch.castPlate)
    const clothedHint = frame?.ok && frame.image ? await deskStillLooksClothed(frame.image) : null
    const needsMelt =
      state.look === 'nude' &&
      (workBeforePunch?.lookApplied !== 'nude' || plateStill || clothedHint === true)
    if (needsMelt && frame?.ok && frame.image && typeof globalThis.DeskPipeline?.punchStudioCard === 'function') {
      try {
        const punched = await globalThis.DeskPipeline.punchStudioCard(frame.image)
        if (punched) {
          frame = { ...frame, image: punched }
          updateCurrentDeskWork({ scene: punched })
          currentResult.imageUrl = punched
          if (String(punched).startsWith('data:')) currentResult.imageDataUrl = punched
        }
      } catch (err) {
        console.warn('desk punch studio card failed', err)
      }
    }
    if (needsMelt) {
      const two = Boolean(castCouple || frame.couple || twoChecked)
      setFormStatus(
        two
          ? '여자 옷만 녹인 뒤 그 얼굴로 찍습니다. 남자는 그대로입니다…'
          : '옷을 녹여 얼굴을 잠근 뒤 찍습니다. 머리 없는 장은 보내지 않습니다…',
        false,
      )
      await runDeskStepLook()
      if (currentDeskWork()?.lookApplied !== 'nude') {
        const hint = document.getElementById('desk-status') || document.getElementById('form-status')
        const now = hint && String(hint.textContent || '').trim()
        if (!now || /녹인 뒤 그 얼굴|옷을 녹여 얼굴을/.test(now)) {
          setFormStatus(
            `여자 옷을 먼저 녹이지 못해 쇼츠를 보내지 않습니다. 옷 입은 한 장면을 바로 벗기면 얼굴이 바뀝니다. (${window.__DESK_BUILD || ''})`,
            true,
          )
        }
        return
      }
      pinDeskMoveCast()
      frame = await resolveDeskFrame({ from: 'scene', needCouple: two })
      if (!frame.ok) {
        setFormStatus(frame.message || '녹인 장이 없습니다.', true)
        return
      }
    }
    if (state.look === 'nude' && frame?.ok && frame.image) {
      const stillOn = await deskStillLooksClothed(frame.image)
      if (stillOn === true) {
        setFormStatus('여자가 아직 옷·팬티입니다. 검정 팬티가 생기므로 쇼츠를 보내지 않습니다.', true)
        return
      }
    }
    if (frame?.ok && frame.image && (castCouple || frame.couple || twoChecked)) {
      const locked = await deskLockCastFacesOnStill(frame.image)
      if (locked) frame = { ...frame, image: locked }
    }
    const ACTION_IDS = new Set(['kiss', 'hug', 'come', 'breast', 'hands', 'zipper', 'walk', 'turn', 'look', 'smile'])
    const actionHead = picked.find((one) => ACTION_IDS.has(one.id))
    const head = actionHead || picked[0]
    const rest = picked.filter((one) => one.id !== head.id && one.id !== 'undress')
    const clipPicked = [head]
    const labels = head.label
    currentResult.imageUrl = frame.image
    if (String(frame.image).startsWith('data:')) currentResult.imageDataUrl = frame.image
    const coupleInStill = Boolean(frame.couple || castCouple)
    if (coupleInStill) {
      setTwoPeopleBoxes(true)
      ensureDeskWork()
      const live = currentDeskWork()
      deskLockMwWomanScene(live, { sourceKind: live?.man ? 'pair' : 'scene' })
      updateCurrentDeskWork(deskMwPatch({ sourceKind: live?.man ? 'pair' : 'scene' }))
    }
    const savedPrompt = currentResult.prompt
    const alreadyNude =
      currentDeskWork()?.lookApplied === 'nude' ||
      /이미\s*나체|나체\s*유지|fully\s*nude|already\s*nude|옷을 녹여 나체/i.test(savedPrompt || '')
    const onlyUndress = !alreadyNude && head.id === 'undress'
    const motion = compileDeskMove(coupleInStill, clipPicked)
    setFormStatus(`${labels} 한 편 찍는 중…`, false)
    const identityStill = currentResult.imageDataUrl || currentResult.imageUrl
    const prevVideoUrl =
      currentResult.isShortsEndFrame && currentResult.videoUrl ? currentResult.videoUrl : ''
    const clip = await requestAnimate({
      motionOverride: motion,
      durationSec: state.len,
      persist: !prevVideoUrl,
      keepBusy: Boolean(prevVideoUrl),
      statusPrefix: `[${labels}] `,
        sourcePeople: coupleInStill ? 2 : 1,
        sourceCast: coupleInStill ? 'mw' : undefined,
        sourceBust: alreadyNude ? false : undefined,
    })
    if (!clip.ok || !clip.videoUrl) {
      setAnimateBusy(false)
      return
    }
    if (prevVideoUrl) {
      setFormStatus('이전 편 뒤에 이번 편을 이어붙이는 중…', false)
      setAnimateStatus('이전 편 뒤에 이번 편을 이어붙이는 중…', false)
      try {
        await appendAndPersistDeskShorts(
          prevVideoUrl,
          clip.videoUrl,
          savedPrompt,
          `${labels}`,
        )
        setFormStatus('이전 편과 이번 편을 한 파일로 저장했습니다.', false)
      } catch (mergeErr) {
        const draft = buildYoutubeShortsDraft({
          prompt: savedPrompt,
          motion: motion,
          genMode: currentResult.genMode,
        })
        updateGalleryItemVideo(currentResult.itemId, clip.videoUrl, draft)
        persistImageToPermanentStorage(clip.videoUrl).then((permanentUrl) => {
          if (!permanentUrl) return
          applyPersistedVideoUrl(currentResult.itemId, clip.videoUrl, permanentUrl)
        })
        setFormStatus(
          `이번 편은 됐지만 이어붙이기에 실패했습니다: ${
            mergeErr instanceof Error ? mergeErr.message : String(mergeErr)
          }`,
          true,
        )
      } finally {
        setAnimateBusy(false)
      }
    }
    const undressed =
      alreadyNude || picked.some((one) => one.id === 'undress') || /옷벗김|undress|strip/i.test(motion)
    if (identityStill) {
      currentResult.imageUrl = identityStill
      if (String(identityStill).startsWith('data:')) currentResult.imageDataUrl = identityStill
      currentResult.isShortsEndFrame = false
      const stillImg = document.getElementById('result-image')
      if (stillImg && stillImg.src !== identityStill) stillImg.src = identityStill
      const vid = document.getElementById('result-video')
      if (vid && clip.videoUrl) {
        vid.src = clip.videoUrl
        vid.hidden = false
      }
      currentResult.videoUrl = clip.videoUrl
      state.move = rest.map((next) => next.id)
      fill('desk-moves', moves, 'move')
      syncJobUi()
      setFormStatus(
        rest.length
          ? `${labels} 한 편은 붙였습니다. 가운데 정지화는 같은 얼굴 그대로입니다. 남은 ${rest.map((next) => next.label).join('·')}는 이 장에서 누르세요.`
          : `${labels} 한 편은 붙였습니다. 가운데 정지화는 같은 얼굴 그대로입니다.`,
        false,
      )
      setAnimateBusy(false)
      return
    }
    let endFrame = null
    try {
      endFrame = await captureVideoEndFrame(clip.videoUrl)
    } catch (err) {
      console.warn('desk next-cut frame failed', err)
    }
    if (endFrame?.startsWith('data:image/')) {
      const endFaces = await countDeskSceneFaces(endFrame, 8000)
      if (!endFaces || endFaces < 1) {
        setFormStatus(
          `${labels} 끝에 얼굴이 없습니다. 가운데는 시작 장 그대로입니다. 머리 없는 몸은 쓰지 마세요.`,
          true,
        )
        state.move = rest.map((next) => next.id)
        fill('desk-moves', moves, 'move')
        syncJobUi()
        setAnimateBusy(false)
        return
      }
      if (!coupleInStill && endFaces >= 2) {
        setFormStatus(
          `${labels} 영상에 없는 남자가 생겼습니다. 가운데 장은 바꾸지 않았습니다. 이 편은 쓰지 말고 다시 누르세요.`,
          true,
        )
        state.move = rest.map((next) => next.id)
        fill('desk-moves', moves, 'move')
        syncJobUi()
        return
      }
      if (coupleInStill && endFaces < 2) {
        setFormStatus(
          `${labels} 끝이 두 사람을 잃었습니다. 가운데는 바꾸지 않았습니다. 남은 동작은 두 사람이 보이는 장에서 누르세요.`,
          true,
        )
        state.move = rest.map((next) => next.id)
        fill('desk-moves', moves, 'move')
        syncJobUi()
        return
      }
      const work = currentDeskWork()
      const cast = deskLockedCast(work)
      const stampPhotos = coupleInStill
        ? cast.sceneInWomanSlot
          ? []
          : [
              work?.woman ? { dataUrl: work.womanFace || work.woman, gender: 'female' } : null,
              work?.man ? { dataUrl: work.manFace || work.man, gender: 'male' } : null,
            ].filter(Boolean)
        : [
            {
              dataUrl: work?.womanFace || work?.woman || deskCastPhotos()[0]?.dataUrl,
              gender: 'female',
            },
          ].filter((p) => p.dataUrl)
      if (stampPhotos.length >= 2 || (stampPhotos.length === 1 && !coupleInStill)) {
        setFormStatus('주연 얼굴을 맞추는 중…', false)
        try {
          const stamped = await applyDeskWorkFaces(endFrame, {
            photos: stampPhotos,
            skipFaceCount: true,
            preferPaste: false,
            skipPasteFallback: true,
            engineOrder: ['insight'],
            hardLimitSec: 28,
          })
          if (stamped?.url && !stamped.skipped && (stamped.locked || 0) > 0 && stamped.method !== 'paste') {
            endFrame = stamped.url
          }
        } catch (err) {
          console.warn('desk next-cut face stamp failed', err)
        }
      }
      showResult(endFrame, '다음 컷 시작', false, {
        size: currentResult.size,
        itemId: currentResult.itemId,
        videoUrl: currentResult.videoUrl || clip.videoUrl,
        prompt:
          onlyUndress && state.len <= 5
            ? '한 겹만 녹임. 아래 옷은 원본 유지.'
            : undressed
              ? `${savedPrompt || ''} · already nude continuity. If panty remains, melt it off now.`.trim()
              : savedPrompt || '',
        accepted: true,
        isShortsEndFrame: true,
        mood: currentResult.mood,
        engine: currentResult.engine,
        genMode: currentResult.genMode,
      })
      currentResult.imageDataUrl = endFrame
      currentResult.imageUrl = endFrame
      const lead = deskIdPhoto(currentDeskWork(), 'woman') || deskIdPhoto(currentDeskWork(), 'man')
      if (lead) shortsFaceIdStill = lead
    }
    state.move = rest.map((next) => next.id)
    fill('desk-moves', moves, 'move')
    syncJobUi()
    if (rest.length) {
      setFormStatus(
        `${labels} 한 편이 끝났습니다. 남은 ${rest.map((next) => next.label).join('·')}를 다시 누르면 이 편 뒤에 이어 붙여 저장합니다.`,
        false,
      )
    } else if (!prevVideoUrl) {
      setFormStatus(`${labels} 한 편이 끝났습니다.`, false)
    }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : err && typeof err === 'object' && err.message
            ? String(err.message)
            : '두 사람 장을 만들지 못했습니다. 1 몸 잇기 다음 2 한 장면을 누르세요.'
      setFormStatus(msg, true)
      console.warn('desk shorts failed', err)
    } finally {
      deskMoveRunning = false
    }
  }

  const deskImageSize = (url) =>
    new Promise((resolve) => {
      if (!url) return resolve({ w: 0, h: 0 })
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => resolve({ w: 0, h: 0 })
      img.src = url
    })

  const deskBandPersonRatio = (url, y0n, y1n) =>
    new Promise((resolve) => {
      if (!url) {
        resolve(0)
        return
      }
      const img = new Image()
      if (/^https?:\/\//i.test(url)) img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const w = Math.min(64, img.naturalWidth)
          const h = Math.min(64, img.naturalHeight)
          if (!w || !h) {
            resolve(0)
            return
          }
          const c = document.createElement('canvas')
          c.width = w
          c.height = h
          const ctx = c.getContext('2d', { willReadFrequently: true })
          ctx.drawImage(img, 0, 0, w, h)
          const y0 = Math.max(0, Math.floor(h * y0n))
          const y1 = Math.min(h, Math.floor(h * y1n))
          const hh = Math.max(1, y1 - y0)
          const { data } = ctx.getImageData(0, y0, w, hh)
          let person = 0
          const n = data.length / 4
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] < 228 || data[i + 1] < 228 || data[i + 2] < 228) person += 1
          }
          resolve(person / Math.max(n, 1))
        } catch {
          resolve(0)
        }
      }
      img.onerror = () => resolve(0)
      img.src = url
    })

  const deskLowerPersonSpan = (url) =>
    new Promise((resolve) => {
      if (!url) {
        resolve(1)
        return
      }
      const img = new Image()
      if (/^https?:\/\//i.test(url)) img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const w = Math.min(96, img.naturalWidth)
          const h = Math.min(128, img.naturalHeight)
          if (!w || !h) {
            resolve(1)
            return
          }
          const c = document.createElement('canvas')
          c.width = w
          c.height = h
          const ctx = c.getContext('2d', { willReadFrequently: true })
          ctx.drawImage(img, 0, 0, w, h)
          const { data } = ctx.getImageData(0, 0, w, h)
          const at = (x, y) => {
            const i = (y * w + x) * 4
            return [data[i], data[i + 1], data[i + 2]]
          }
          const luma = (p) => p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114
          const sat = (p) => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2])
          const corners = [at(1, 1), at(w - 2, 1), at(1, h - 2), at(w - 2, h - 2)]
          const bg = corners.reduce((s, p) => s + luma(p), 0) / corners.length
          const isStudio = (p) => sat(p) < 28 && Math.abs(luma(p) - bg) < 30
          let best = 0
          for (const yn of [0.72, 0.82, 0.9]) {
            const y = Math.max(0, Math.min(h - 1, Math.round(h * yn)))
            let x0 = -1
            let x1 = -1
            for (let x = 0; x < w; x += 1) {
              if (isStudio(at(x, y))) continue
              if (x0 < 0) x0 = x
              x1 = x
            }
            if (x0 >= 0) best = Math.max(best, (x1 - x0 + 1) / w)
          }
          resolve(best)
        } catch {
          resolve(1)
        }
      }
      img.onerror = () => resolve(1)
      img.src = url
    })

  const deskLowerBandStats = async (src, y0, ySpan) => {
    const img = await loadDeskImage(src)
    const w = img.naturalWidth
    const h = img.naturalHeight
    const sy = Math.floor(h * y0)
    const sh = Math.max(1, Math.floor(h * ySpan))
    const c = document.createElement('canvas')
    c.width = 32
    c.height = 32
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, sy, w, sh, 0, 0, 32, 32)
    const data = ctx.getImageData(0, 0, 32, 32).data
    let sum = 0
    let sum2 = 0
    let n = 0
    for (let i = 0; i < data.length; i += 4) {
      const y = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      sum += y
      sum2 += y * y
      n += 1
    }
    const mean = sum / Math.max(n, 1)
    return { mean, variance: sum2 / Math.max(n, 1) - mean * mean }
  }

  const deskMissingShoes = async (src) => {
    if (!src) return true
    const view = (await deskUnletterbox(src)) || src
    const img = await loadDeskImage(view)
    const w = Math.min(160, img.naturalWidth)
    const h = Math.min(240, img.naturalHeight)
    if (!w || !h) return true
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    let n = 0
    let dark = 0
    const y0 = Math.round(h * 0.88)
    const x0 = Math.round(w * 0.28)
    const x1 = Math.round(w * 0.72)
    for (let y = y0; y < h; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * w + x) * 4
        const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
        n += 1
        if (luma < 55) dark += 1
      }
    }
    return !n || dark / n < 0.02
  }

  const deskUnletterbox = async (src) => {
    if (!src) return src
    const img = await loadDeskImage(src)
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    if (!iw || !ih) return src
    const w = Math.min(200, iw)
    const h = Math.min(300, ih)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    const colDark = (x0, x1) => {
      let n = 0
      let d = 0
      for (let y = 0; y < h; y += 2) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * w + x) * 4
          const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
          n += 1
          if (luma < 70) d += 1
        }
      }
      return n ? d / n : 0
    }
    if (colDark(0, Math.max(1, Math.round(w * 0.08))) < 0.7) return src
    if (colDark(Math.round(w * 0.92), w) < 0.7) return src
    const x0 = Math.round(iw * 0.1)
    const cw = Math.max(8, iw - x0 * 2)
    const out = document.createElement('canvas')
    out.width = cw
    out.height = ih
    out.getContext('2d').drawImage(img, x0, 0, cw, ih, 0, 0, cw, ih)
    return out.toDataURL('image/jpeg', 0.92)
  }

  const deskFootClusters = (url) =>
    new Promise((resolve) => {
      if (!url) {
        resolve(0)
        return
      }
      const img = new Image()
      if (/^https?:\/\//i.test(url)) img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const w = Math.min(96, img.naturalWidth)
          const h = Math.min(128, img.naturalHeight)
          if (!w || !h) {
            resolve(0)
            return
          }
          const c = document.createElement('canvas')
          c.width = w
          c.height = h
          const ctx = c.getContext('2d', { willReadFrequently: true })
          ctx.drawImage(img, 0, 0, w, h)
          const { data } = ctx.getImageData(0, 0, w, h)
          const at = (x, y) => {
            const i = (y * w + x) * 4
            return [data[i], data[i + 1], data[i + 2]]
          }
          const luma = (p) => p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114
          const sat = (p) => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2])
          const corners = [at(1, 1), at(w - 2, 1), at(1, h - 2), at(w - 2, h - 2)]
          const bg = corners.reduce((s, p) => s + luma(p), 0) / corners.length
          const isStudio = (p) => sat(p) < 28 && Math.abs(luma(p) - bg) < 30
          let best = 0
          for (const yn of [0.86, 0.91, 0.95]) {
            const y = Math.max(0, Math.min(h - 1, Math.round(h * yn)))
            let runs = 0
            let on = false
            let run = 0
            for (let x = 0; x < w; x += 1) {
              const hit = !isStudio(at(x, y))
              if (hit) {
                run += 1
                if (!on && run >= 2) {
                  runs += 1
                  on = true
                }
              } else {
                on = false
                run = 0
              }
            }
            if (runs > best) best = runs
          }
          resolve(best)
        } catch {
          resolve(0)
        }
      }
      img.onerror = () => resolve(0)
      img.src = url
    })

  const deskPhotoNeedsBodyExtend = async (dataUrl) => {
    if (!dataUrl) return false
    const stable =
      typeof globalThis.ensureStableDataUrl === 'function'
        ? await globalThis.ensureStableDataUrl(dataUrl)
        : dataUrl
    const view = (await deskUnletterbox(stable)) || stable
    const size = await deskImageSize(view)
    const ratio = size.h / Math.max(size.w, 1)
    let face = null
    if (typeof globalThis.detectSceneFaceBoxes === 'function') {
      const boxes = await globalThis.detectSceneFaceBoxes(view, 1, {
        guessIfMissing: false,
        localOnly: true,
      })
      if (boxes.length) face = boxes.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0]
    }
    if (!face && typeof globalThis.estimateFaceBoxFromImage === 'function') {
      face = await globalThis.estimateFaceBoxFromImage(view, { scanTop: 0.5, centerOnly: true })
    }
    const feet = await deskFootClusters(view)
    const lower = await deskLowerBandStats(view, 0.68, 0.26)
    if (await deskMissingShoes(view)) return true
    const standing =
      Boolean(face && face.h < 0.22 && face.y < 0.28 && face.y + face.h < 0.42) &&
      (feet >= 2 || lower.variance >= 18)
    if (standing) return false
    if (face && (face.h >= 0.22 || face.y + face.h >= 0.45)) return true
    if (feet < 2 && (!face || face.h >= 0.18)) return true
    if (ratio < 1.15 && (!face || face.h >= 0.2)) return true
    return !face
  }

  const deskManHemTooHigh = async (dataUrl) => {
    if (!dataUrl) return false
    try {
      const img = await loadDeskImage(dataUrl)
      const iw = img.naturalWidth
      const ih = img.naturalHeight
      if (!iw || !ih) return false
      const c = document.createElement('canvas')
      c.width = iw
      c.height = ih
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(0, 0, iw, ih)
      const lumaAt = (x, y) => {
        const i = (Math.max(0, Math.min(ih - 1, y)) * iw + Math.max(0, Math.min(iw - 1, x))) * 4
        return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      }
      const cx = Math.round(iw / 2)
      let headTop = 2
      for (let y = 2; y < ih * 0.2; y += 1) {
        if (lumaAt(cx, y) < 175) {
          headTop = y
          break
        }
      }
      let chin = headTop + Math.round(ih * 0.13)
      for (let y = headTop + Math.round(ih * 0.09); y < headTop + Math.round(ih * 0.2); y += 1) {
        if (lumaAt(cx, y) < 55) {
          chin = y - 3
          break
        }
      }
      const faceH = Math.max(8, chin - headTop)
      const neck = chin + Math.round(faceH * 0.1)
      let lastButton = 0
      for (let y = neck + Math.round(faceH * 0.4); y < neck + Math.round(faceH * 3.2); y += 1) {
        for (let x = cx - 18; x < cx + 18; x += 1) {
          const L = lumaAt(x, y)
          if (L > 88 && lumaAt(x - 3, y) < 52 && lumaAt(x + 3, y) < 52) {
            lastButton = y
            y += 6
            break
          }
        }
      }
      if (!lastButton) return false
      let peak = 0
      let cliff = 0
      for (let y = Math.round(ih * 0.35); y < Math.round(ih * 0.72); y += 1) {
        let left = -1
        let right = -1
        for (let x = Math.round(iw * 0.12); x < Math.round(iw * 0.88); x += 1) {
          if (lumaAt(x, y) < 80) {
            if (left < 0) left = x
            right = x
          }
        }
        const ww = left < 0 ? 0 : right - left
        if (ww > peak) peak = ww
        if (!cliff && peak > 200 && ww < peak * 0.78) cliff = y
      }
      if (!cliff) return false
      const hem = lastButton + Math.round(faceH * 1.05)
      return cliff - hem > ih * 0.08
    } catch (_) {
      return false
    }
  }

  const ensureDeskLeadBody = async (src, gender, label, force, idPhoto, opts) => {
    if (!src) return src
    const isMan = gender === 'male' || gender === 'man'
    let needExtend = await deskPhotoNeedsBodyExtend(src)
    if (!needExtend && isMan && (await deskManHemTooHigh(src))) needExtend = true
    if (!needExtend) {
      const standing =
        typeof deskLooksStandingFull === 'function' ? await deskLooksStandingFull(src) : false
      if (!standing) return src
      try {
        const isMan = gender === 'male' || gender === 'man'
        if (isMan && typeof globalThis.fitKoreanManCanon === 'function') {
          src = (await globalThis.fitKoreanManCanon(src)) || src
        } else if (!isMan && typeof globalThis.fitKoreanWomanCanon === 'function') {
          src = (await globalThis.fitKoreanWomanCanon(src)) || src
        }
        return src
      } catch (_) {
        return src
      }
    }
    if (typeof globalThis.extendOneIdBody !== 'function') return src
    setFormStatus(`${label} 사진을 서서 전신으로 잇는 중…`, false)
    const faceSrc =
      typeof compactDeskScene === 'function'
        ? await compactDeskScene(idPhoto || src, 1024, 0.84)
        : idPhoto || src
    const body =
      typeof compactDeskScene === 'function' ? await compactDeskScene(src, 1024, 0.84) : src
    let ext = null
    try {
      ext = await globalThis.extendOneIdBody(body, gender, 1, 1, {
        faceSrc,
        deadline: opts?.deadline,
        forcePhoto: true,
      })
    } catch (err) {
      setFormStatus(`${label} 몸 잇기 실패: ${deskErrText(err)}`, true)
      return src
    }
    if (ext?.auth || !ext?.display) return src
    return ext.display
  }

  const showDeskStepResult = async (imageUrl, title, prompt, opts) => {
    const prev = typeof currentResult !== 'undefined' ? currentResult.imageUrl : ''
    const assemblingCouple = Boolean(opts?.assembleCouple)
    if (
      !assemblingCouple &&
      prev &&
      imageUrl &&
      prev !== imageUrl &&
      typeof deskManHalfPasses === 'function'
    ) {
      const prevSize = typeof deskImageSize === 'function' ? await deskImageSize(prev) : null
      const nextSize = typeof deskImageSize === 'function' ? await deskImageSize(imageUrl) : null
      const prevWide = Boolean(prevSize && prevSize.w > prevSize.h * 1.08)
      const nextWide = Boolean(nextSize && nextSize.w > nextSize.h * 1.08)
      const firstPlate = !prevWide && nextWide && currentDeskWork()?.woman && currentDeskWork()?.man
      const bothPortrait =
        Boolean(prevSize && nextSize && prevSize.h >= prevSize.w * 1.02 && nextSize.h >= nextSize.w * 1.02)
      const keepMan =
        !opts?.skipManLock &&
        !firstPlate &&
        !bothPortrait &&
        (prevWide || (typeof deskTwoPeopleChecked === 'function' && deskTwoPeopleChecked()))
      if (keepMan) {
        const layout = currentDeskWork()?.castLayout
        const manOk = layout?.man
          ? await deskManSidePasses(prev, imageUrl, layout)
          : await deskManHalfPasses(prev, imageUrl, deskCoupleSplitFromFaces(null))
        if (!manOk.ok) {
          setFormStatus('남자가 없어져 저장하지 않습니다. 가운데는 원본입니다.', true)
          return false
        }
      }
    }
    const couple = Boolean(currentDeskWork()?.woman && currentDeskWork()?.man)
    if (typeof placeAdultDeskNodes === 'function') placeAdultDeskNodes()
    showResult(imageUrl, title, false, {
      size: assemblingCouple ? 'landscape' : sizeField?.value || (couple ? 'landscape' : 'story'),
      itemId: null,
      prompt,
      accepted: false,
      mood: moodField?.value || '',
      engine: 'desk-still',
      genMode: 'fashion',
      reviseRound: 0,
    })
    if (typeof syncAdminWorkspaceUi === 'function') syncAdminWorkspaceUi()
    const stage = document.getElementById('adult-desk-stage')
    const img = document.getElementById('result-image')
    const section = document.getElementById('result-section')
    if (section) section.hidden = false
    if (img && imageUrl) {
      img.hidden = false
      if (img.src !== imageUrl) img.src = imageUrl
    }
    stage?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const id = deskIdPhoto(currentDeskWork(), 'woman') || deskIdPhoto(currentDeskWork(), 'man')
    if (id) shortsFaceIdStill = id
    return true
  }

  const stabilizeDeskStill = async (imageUrl) => {
    if (!imageUrl) return ''
    if (String(imageUrl).startsWith('data:image/')) return imageUrl
    if (typeof globalThis.ensureStableDataUrl !== 'function') return imageUrl
    try {
      return (await globalThis.ensureStableDataUrl(imageUrl)) || ''
    } catch (err) {
      console.warn('desk still preview failed', err)
      return ''
    }
  }

  const runDeskKontextStep = async (images, description, deskStep, title, doneText, opts) => {
    if (typeof globalThis.postTaleSceneJob !== 'function') {
      setFormStatus('장면 엔진을 불러오지 못했습니다.', true)
      return
    }
    const work = currentDeskWork()
    const cast = deskLockedCast(work)
    let sourcePeople = 1
    if (opts?.deskCouple === true) sourcePeople = 2
    else if (opts?.deskCouple === false) sourcePeople = 1
    else {
      sourcePeople = images.length >= 2 ? 2 : 1
      if (sourcePeople === 1 && images[0] && typeof countDeskSceneFaces === 'function') {
        const n = await countDeskSceneFaces(images[0], 8000, { mergeIou: 0.45 })
        if (n >= 2) sourcePeople = 2
      }
    }
    if (sourcePeople >= 2 && work?.woman) {
      deskLockMwWomanScene(currentDeskWork(), { sourceKind: work?.man ? 'pair' : 'scene' })
      setTwoPeopleChecked(true)
    }
    if (deskStep === 'look' && images[0]) {
      const srcFaces =
        typeof countDeskSceneFaces === 'function'
          ? await countDeskSceneFaces(images[0], 8000, { couple: true, mergeIou: 0.45 })
          : 0
      const dim = typeof deskImageSize === 'function' ? await deskImageSize(images[0]) : null
      const wide = Boolean(dim && dim.w > dim.h * 1.08)
      if (srcFaces >= 2 || wide) {
        setFormStatus('두 사람이 있는 장은 통째로 보내지 않습니다. 가운데는 원본입니다.', true)
        return
      }
    }
    const deskLook = typeof opts?.deskLook === 'string' ? opts.deskLook : deskLookKind()
    const deskAction =
      typeof opts?.deskAction === 'string'
        ? opts.deskAction
        : deskStep === 'place' && state.pose.includes('hug')
          ? 'hug'
          : 'none'
    const adultStill =
      state.look === 'nude' ||
      state.look === 'silk' ||
      /나체|누드|nude|naked|전라|슬립|slip|실크|노브라|란제리|lingerie|옷벗|벗기|가슴|breast|보지|주무르/i.test(
        String(description || ''),
      )
    let aspectRatio = '3:4'
    try {
      const dim = images[0] && typeof deskImageSize === 'function' ? await deskImageSize(images[0]) : null
      if (dim?.w && dim?.h) {
        const ratio = dim.h / Math.max(dim.w, 1)
        if (dim.w > dim.h * 1.08) aspectRatio = '16:9'
        else if (Math.abs(dim.w - dim.h) / Math.max(dim.w, 1) < 0.08) aspectRatio = '1:1'
        else if (ratio < 1.62) aspectRatio = '3:4'
        else aspectRatio = '9:16'
      }
    } catch (_) {
      /* 원본 비율을 못 읽으면 세로 유지 */
    }
    if (sourcePeople >= 2) {
      ensureDeskWork()
      const liveWork = currentDeskWork()
      deskLockMwWomanScene(liveWork, { sourceKind: liveWork?.man ? 'pair' : 'scene' })
      updateCurrentDeskWork(deskMwPatch({ sourceKind: liveWork?.man ? 'pair' : 'scene' }))
      setTwoPeopleChecked(true)
    }
    const liveCast = deskLockedCast(currentDeskWork())
    const gender0 = sourcePeople >= 2 ? 'female' : liveCast.genders[0]
    const gender1 = sourcePeople >= 2 ? 'male' : liveCast.genders[1]
    const sourceCast = sourcePeople >= 2 ? 'mw' : liveCast.sourceCast || undefined
    setFormStatus(`${title} 그리는 중…`, false)
    const job = await globalThis.postTaleSceneJob(
      {
        composeMode: 'desk-still',
        deskStep,
        images,
        description,
        photoreal: true,
        refKind: 'body',
        aspectRatio,
        gender0,
        gender1,
        sourcePeople,
        sourceCast,
        adultStill,
        forceReplicate: Boolean(opts?.forceReplicate),
        clothesMask: typeof opts?.clothesMask === 'string' ? opts.clothesMask : undefined,
        deskCastLayout: opts?.deskCastLayout || undefined,
        deskLookVerify: opts?.deskLookVerify || undefined,
        lookInpaintBoost: Boolean(opts?.lookInpaintBoost),
        deskLook,
        deskCouple: sourcePeople >= 2,
        deskAction,
      },
      title,
      160,
    )
    if (!job || job.auth || !job.imageUrl) return
    setFormStatus('그린 장을 가운데에 붙이는 중…', false)
    const stable = await stabilizeDeskStill(job.imageUrl)
    if (!stable) {
      setFormStatus('그림이 안 붙었습니다. 같은 버튼을 다시 누르세요.', true)
      return
    }
    if (typeof isNearlyBlackImage === 'function' && (await isNearlyBlackImage(stable))) {
      const sitLiePlace =
        deskStep === 'place' && /앉아|앉히|앉힌|앉혀|눕|누워|포옹|안기게|서로 안/i.test(String(description || ''))
      if (!opts?.forceReplicate && ((adultStill && deskStep === 'cut') || sitLiePlace)) {
        setFormStatus('검열 빈 장이라 같은 사람으로 한 번만 다시 그립니다…', false)
        return runDeskKontextStep(images, description, deskStep, title, doneText, {
          ...opts,
          forceReplicate: true,
        })
      }
      setFormStatus(
        deskStep === 'cut'
          ? '엔진이 빈 장을 냈습니다. 다음 컷만 다시 누르세요. 몸 잇기는 누르지 마세요.'
          : deskStep === 'look'
            ? '엔진이 빈 장을 냈습니다. 가운데는 원본입니다. 옷을 다시 고르세요.'
            : '엔진이 빈 장을 냈습니다. 이어서 다시 보내지 않습니다. 증명사진이면 1 몸 잇기만 누르세요.',
        true,
      )
      return
    }
    let shown = stable
    let protectIdentical = false
    const expectPeople = sourcePeople >= 2 ? 2 : 1
    // VTON 은 얼굴·자세·배경을 스스로 남기고 해상도도 그대로 돌려준다(실측 ArcFace 0.964,
    // 얼굴칸 이동 0.1%, 880×1184 → 880×1184). 여기에 마스크 합성을 덮으면 마스크 밖에 남은
    // 원래 청바지·소매가 되살아나 톱니로 보인다 — 멀쩡한 결과를 우리가 망가뜨렸다.
    // 그래서 합성을 건너뛰고, 같은 사람인지는 아래 얼굴 검사로 본다.
    const nativeIdentity = job.engine === 'fal-fashn-tryon'
    if (deskStep === 'look' && !nativeIdentity) {
      const maskForComp = opts?.clothesMaskFull || opts?.clothesMask
      if (!maskForComp || typeof compositeDeskClothesResult !== 'function') {
        setFormStatus('의상 마스크가 없어 결과를 붙이지 않습니다. 가운데는 원본입니다.', true)
        return
      }
      const comp = await compositeDeskClothesResult(
        images[0],
        stable,
        maskForComp,
        deskLook === 'silk' ? 6 : 5,
      )
      if (!comp.ok || !comp.protectIdentical) {
        if (!opts?._retried) {
          setFormStatus('보호 영역이 원본과 달라 한 번만 다시 그립니다. 얼굴을 붙이지 않습니다.', false)
          return runDeskKontextStep(images, description, deskStep, title, doneText, {
            ...opts,
            _retried: true,
          })
        }
        setFormStatus('보호 영역 화소가 바뀌어 저장하지 않습니다. 가운데는 원본입니다.', true)
        return
      }
      shown = comp.dataUrl
      protectIdentical = true
      const coupleLayout = currentDeskWork()?.castLayout
      if (coupleLayout?.man && typeof deskStampManFromSource === 'function') {
        shown = await deskStampManFromSource(images[0], shown, coupleLayout)
        const manHalf = await deskManSidePasses(images[0], shown, coupleLayout)
        if (!manHalf.ok) {
          setFormStatus('남자가 여자로 바뀌어 저장하지 않습니다. 가운데는 원본입니다.', true)
          return
        }
        const faceBoxes = [coupleLayout.woman, coupleLayout.man].filter(Boolean)
        if (faceBoxes.length) shown = await deskStampFacesFromSource(images[0], shown, faceBoxes)
      }
    }
    if (typeof deskStillPasses === 'function' && (deskStep === 'look' || deskStep === 'place')) {
      const gate = await deskStillPasses(
        images[0],
        shown,
        expectPeople,
        opts?.clothesMaskFull || opts?.clothesMask,
        currentDeskWork()?.castLayout,
        { protectIdentical, nativeIdentity, looseNude: deskLook === 'nude' },
      )
      const lookRetryOk = { protect: 1, undetected: 1, embed: 1, faces: 1, extra: 1, 'mw-ww': 1, cast_people: 1 }
      // 옷이 안 바뀌는 건 엔진의 무작위라 다시 뽑으면 달라진다.
      // 반면 mask_seam·silhouette 은 같은 마스크에서 매번 같게 걸리므로(실측 3/3)
      // 다시 뽑아도 소용없다 — 돈만 든다.
      const lookVisualRetryOk = { clothes_goal: 1 }
      const attempt = Number(opts?._attempt) || 1
      const lastAttempt = deskStep === 'look' && lookVisualRetryOk[gate.reason] ? 3 : 2
      const mayRetry =
        deskStep === 'place' ||
        (deskStep === 'look' && (lookRetryOk[gate.reason] || lookVisualRetryOk[gate.reason]))
      if (!gate.ok && attempt < lastAttempt && mayRetry) {
        setFormStatus(`결과가 기준에 못 미쳐 다시 그립니다 (${attempt + 1}/${lastAttempt}).`, false)
        return runDeskKontextStep(images, description, deskStep, title, doneText, {
          ...opts,
          _attempt: attempt + 1,
          _retried: true,
          lookInpaintBoost: deskStep === 'look' && gate.reason === 'clothes_goal' ? true : opts?.lookInpaintBoost,
        })
      }
      if (!gate.ok) {
        const gateWhy =
          gate.reason === 'mw-ww'
            ? '남자가 여자로 바뀌거나 한 명만 나와 저장하지 않습니다. 가운데는 원본입니다.'
            : gate.reason === 'extra'
              ? '새 사람이 생겨 저장하지 않습니다. 가운데는 원본입니다.'
              : gate.reason === 'crop' || gate.reason === 'pose'
                ? '자세·위치가 바뀌어 저장하지 않습니다. 가운데는 원본입니다.'
                : gate.reason === 'protect'
                  ? '보호 영역 화소가 바뀌어 저장하지 않습니다. 가운데는 원본입니다.'
                  : gate.reason === 'embed'
                    ? '얼굴이 원본과 달라 저장하지 않습니다. 가운데는 원본입니다.'
                    : gate.reason === 'clothes_goal'
                      ? '옷이 바뀌지 않아 저장하지 않습니다. 가운데는 원본입니다.'
                      : gate.reason === 'silhouette'
                        ? '몸 실루엣이 바뀌어 저장하지 않습니다. 가운데는 원본입니다.'
                        : gate.reason === 'mask_seam'
                          ? '옷 경계가 이어지지 않아 저장하지 않습니다. 가운데는 원본입니다.'
                          : '얼굴·인원을 확인하지 못해 저장하지 않습니다. 가운데는 원본입니다.'
        setFormStatus(gate.detail ? `${gateWhy} ${gate.detail}` : gateWhy, true)
        return
      }
    }
    showDeskStepResult(shown, title, description)
    if (deskStep === 'look') {
      updateCurrentDeskWork({ lookApplied: deskLook, scene: shown })
    }
    const img = document.getElementById('result-image')
    const painted = await new Promise((resolve) => {
      if (!img) return resolve(false)
      if (img.complete && img.naturalWidth > 8) return resolve(true)
      const timer = window.setTimeout(() => resolve(img.naturalWidth > 8), 8000)
      img.onload = () => {
        window.clearTimeout(timer)
        resolve(img.naturalWidth > 8)
      }
      img.onerror = () => {
        window.clearTimeout(timer)
        resolve(false)
      }
    })
    if (!painted) {
      setFormStatus('그림이 안 붙었습니다. 같은 버튼을 다시 누르세요.', true)
      return
    }
    setFormStatus(doneText, false)
    void syncDeskGates()
  }

  const setDeskStillBusy = (busy) => {
    document.querySelectorAll('#desk-still-steps [data-desk-step]').forEach((btn) => {
      const step = btn.getAttribute('data-desk-step')
      if (!btn.dataset.idleLabel) btn.dataset.idleLabel = btn.textContent || ''
      btn.classList.toggle('is-busy', busy)
      if (step === 'body') {
        btn.disabled = false
        btn.textContent = busy ? '잇는 중…' : btn.dataset.idleLabel
        btn.setAttribute('aria-busy', busy ? 'true' : 'false')
      } else {
        btn.disabled = busy
      }
    })
    const deskRun = document.getElementById('desk-run')
    if (generateButton) generateButton.disabled = busy
    if (deskRun) deskRun.disabled = busy
    const nextCut = document.getElementById('result-engine')
    if (nextCut && typeof getAppArea === 'function' && getAppArea() === 'admin') {
      nextCut.disabled = busy
    }
    if (!busy) void syncDeskGates()
  }

  const deskSceneBase = () => currentResult?.imageUrl || currentDeskWork()?.scene || ''

  const deskLooksStandingFull = async (dataUrl) => {
    if (!dataUrl) return false
    const stable =
      typeof globalThis.ensureStableDataUrl === 'function'
        ? await globalThis.ensureStableDataUrl(dataUrl)
        : dataUrl
    const view = (await deskUnletterbox(stable)) || stable
    const face =
      typeof globalThis.estimateFaceBoxFromImage === 'function'
        ? await globalThis.estimateFaceBoxFromImage(view, { scanTop: 0.5, centerOnly: true })
        : null
    if (await deskMissingShoes(view)) return false
    const feet = await deskFootClusters(view)
    const lower = await deskLowerBandStats(view, 0.68, 0.26)
    return Boolean(
      face &&
        face.h < 0.22 &&
        face.y < 0.28 &&
        face.y + face.h < 0.42 &&
        (feet >= 2 || lower.variance >= 18),
    )
  }

  const runDeskStepBody = async () => {
    const work = currentDeskWork()
    if (!work?.woman && !work?.womanFace && !work?.man && !work?.manFace) {
      setFormStatus('여 칸이나 남 칸에 사진을 넣으세요.', true)
      return
    }
    setFormStatus(
      work.woman && work.man ? '여·남 증명사진을 전신으로 잇는 중…' : '증명사진을 전신으로 잇는 중…',
      false,
    )
    const patch = {}
    let last = ''
    let did = 0
    let failed = false
    let coupleScene = false
    if (work.woman || work.womanFace) {
      const id = deskIdPhoto(work, 'woman')
      const needExtend = id ? await deskPhotoNeedsBodyExtend(id) : false
      const faces =
        id && typeof countDeskSceneFaces === 'function'
          ? await countDeskSceneFaces(id, work.man ? 4000 : 2000)
          : 0
      // 증명·상반신 큰 얼굴을 둘로 쪼개 '남녀 한 장'으로 건너뛰지 않는다.
      if (faces >= 2 && !needExtend && !work.man) {
        if (id && !/^data:image\/png/i.test(id)) patch.womanFace = id
        patch.woman = id
        patch.womanFull = true
        patch.peopleCount = 2
        patch.sourceKind = 'scene'
        if (work.verifiedSourceCast === 'mw') {
          Object.assign(patch, deskMwPatch())
        } else {
          patch.sourceCast = ''
          patch.verifiedSourceCast = ''
        }
        did += 1
        last = id
        coupleScene = true
        setTwoPeopleChecked(true)
      } else if (work.womanFull && work.woman && work.woman !== id) {
        last = work.woman
      } else {
        if (id && !/^data:image\/png/i.test(id)) patch.womanFace = id
        const manId = work.man ? deskIdPhoto(work, 'man') : ''
        const manReady = Boolean(
          work.man &&
            manId &&
            work.man !== manId &&
            (await deskLeadIsReady(work.man, work.manFull)),
        )
        const manEngine = Boolean(work.man && manId && !manReady)
        const deadline = { deadline: window.__deskBodyDeadline }
        if (manEngine) {
          if (manId && !/^data:image\/png/i.test(manId)) patch.manFace = manId
          const [wNext, mNext] = await Promise.all([
            ensureDeskLeadBody(id, 'female', '여', false, id, deadline),
            ensureDeskLeadBody(manId, 'male', '남', false, manId, deadline),
          ])
          if (wNext && wNext !== id) {
            patch.woman = wNext
            patch.womanFull = true
            did += 1
            last = wNext
          } else if (wNext && !needExtend) {
            last = wNext
          } else {
            last = work.woman
            failed = true
          }
          if (mNext && mNext !== manId) {
            patch.man = mNext
            patch.manFull = true
            did += 1
            last = mNext
          } else {
            last = last || work.man
            failed = true
          }
        } else {
          const next = await ensureDeskLeadBody(id, 'female', '여', false, id, deadline)
          if (next && next !== id) {
            patch.woman = next
            patch.womanFull = true
            did += 1
            last = next
            if (!work.man) {
              patch.peopleCount = 1
              patch.sourceKind = 'cast'
              patch.sourceCast = ''
              patch.verifiedSourceCast = ''
              setTwoPeopleChecked(false)
            }
          } else if (next && !needExtend) {
            last = next
          } else {
            last = work.woman
            failed = true
          }
        }
      }
    }
    if (work.man && !patch.man && !window.__deskStepAbort?.signal?.aborted) {
      const id = deskIdPhoto(work, 'man')
      if (id && !/^data:image\/png/i.test(id)) patch.manFace = id
      const manNeed = id ? await deskPhotoNeedsBodyExtend(id) : false
      const manCropped = work.man ? await deskManHemTooHigh(work.man) : false
      if (
        work.man &&
        work.man !== id &&
        (await deskLeadIsReady(work.man, work.manFull)) &&
        !manCropped &&
        typeof globalThis.fitKoreanManCanon === 'function'
      ) {
        try {
          let nextMan = work.man
          const fitted = await globalThis.fitKoreanManCanon(work.man)
          if (fitted) nextMan = fitted
          if (nextMan && nextMan !== work.man) {
            patch.man = nextMan
            patch.manFull = true
            did += 1
            last = nextMan
          } else {
            last = last || work.man
          }
        } catch (_) {
          last = last || work.man
        }
      } else {
        const next = await ensureDeskLeadBody(id, 'male', '남', false, id, {
          deadline: window.__deskBodyDeadline,
        })
        if (next && next !== id) {
          patch.man = next
          patch.manFull = true
          did += 1
          last = next
        } else if (next && !manNeed) {
          last = last || next
        } else {
          last = last || work.man
          failed = true
        }
      }
    }
    if (window.__deskStepAbort?.signal?.aborted) return
    if (Object.keys(patch).length) {
      if (work.verifiedSourceCast === 'mw') Object.assign(patch, deskMwPatch(patch))
      if (work.peopleCount && !patch.peopleCount) patch.peopleCount = work.peopleCount
      if (work.sourceKind && !patch.sourceKind) patch.sourceKind = work.sourceKind
      updateCurrentDeskWork(patch)
    }
    syncWorkUi()
    if (failed && !did) {
      const deskStatus = document.getElementById('desk-status')
      const already = /보내지 못했습니다|세션이 만료|extend_body|전신이 안 붙|다른 사람|provider_content/i.test(
        deskStatus?.textContent || '',
      )
      if (!already) {
        setFormStatus(deskBodyFail('전신이 안 붙었습니다. 옷·자세는 보내지 않았습니다. 1 몸 잇기만 다시 누르세요.'), true)
      }
      return
    }
    if (failed && did) {
      setFormStatus('한쪽만 이었고 한쪽은 실패했습니다. 실패한 칸만 1 몸 잇기를 다시 누르세요.', true)
      if (last) showDeskStepResult(last, '몸 잇기', '같은 얼굴로 이은 전신', { skipManLock: true })
      return
    }
    const couple = Boolean(work.woman && work.man)
    if (coupleScene && !work.man) {
      showDeskStepResult(last, '두 사람 장면', compileLookOnly(true))
      setFormStatus('여 칸이 남녀 한 장입니다. 몸을 따로 잇지 않습니다. 이 장으로 여자 옷만 고르세요.', false)
      return
    }
    if (!did) {
      if (last) showDeskStepResult(last, '이미 전신', compileStill())
      setFormStatus(
        couple ? '이미 반신·전신입니다. 다음 걸음은 한 장면입니다.' : '이미 반신·전신입니다. 이 몸으로 옷을 고르세요.',
        false,
      )
      return
    }
    showDeskStepResult(last, '몸 잇기', '같은 얼굴로 이은 전신', { skipManLock: true })
    setFormStatus(
      couple
        ? '같은 얼굴로 몸을 이었습니다. 다음 걸음은 한 장면입니다.'
        : '같은 얼굴로 몸을 이었습니다. 이 몸으로 옷을 고르세요.',
      false,
    )
  }

  const ensureDeskCoupleScene = async () => {
    const work = currentDeskWork()
    const ready =
      currentResult?.imageUrl || work?.scene || work?.womanLock || work?.woman || ''
    const readyFaces =
      ready && typeof countDeskSceneFaces === 'function'
        ? await countDeskSceneFaces(ready, 8000, { mergeIou: 0.45, couple: true })
        : 0
    if (readyFaces >= 2) {
      deskAdoptCoupleStill(ready)
      if (typeof applyDeskScenePixels === 'function') applyDeskScenePixels(ready, '두 사람 시작')
      setTwoPeopleChecked(true)
      void syncDeskGates()
      setFormStatus('이미 한 장에 두 사람입니다. 붙이지 않습니다. 이 장으로 갑니다.', false)
      return ready
    }
    if (!work?.woman || !work?.man) return ''
    const womanFaces =
      typeof countDeskSceneFaces === 'function'
        ? await countDeskSceneFaces(work.woman, 8000, { mergeIou: 0.45, couple: true })
        : 0
    if (womanFaces >= 2) {
      deskAdoptCoupleStill(work.woman)
      if (typeof applyDeskScenePixels === 'function') applyDeskScenePixels(work.woman, '두 사람 시작')
      setTwoPeopleChecked(true)
      void syncDeskGates()
      setFormStatus('이미 한 장에 두 사람입니다. 붙이지 않습니다. 이 장으로 갑니다.', false)
      return work.woman
    }
    const womanReady = await deskLeadIsReady(work.woman, work.womanFull)
    const manReady = await deskLeadIsReady(work.man, work.manFull)
    if (!womanReady || !manReady) {
      setFormStatus('먼저 1 몸 잇기를 누르세요. 한 장면은 몸을 이은 뒤에만 보냅니다.', true)
      return ''
    }
    if (typeof deskLooksLikeHintPlate === 'function') {
      if ((await deskLooksLikeHintPlate(work.woman)) || (await deskLooksLikeHintPlate(work.man))) {
        setFormStatus('힌트 판이 남은 전신은 한 장면으로 붙이지 않습니다. 1 몸 잇기만 다시 누르세요.', true)
        return ''
      }
    }
    if (sizeField && !sizeField.dataset.userPicked) sizeField.value = 'landscape'
    setFormStatus('배경을 지우고 전신 키를 맞춰 한 장에 붙이는 중…', false)
    const composed =
      typeof composeDeskCoupleStill === 'function'
        ? await composeDeskCoupleStill(work.woman, work.man)
        : ''
    if (!composed) {
      setFormStatus('한 장에 붙이지 못했습니다. PNG 조립으로 다시 넣어 보세요.', true)
      return ''
    }
    if (typeof deskLooksLikeHintPlate === 'function' && (await deskLooksLikeHintPlate(composed))) {
      setFormStatus('한 장면에 힌트 판이 남아 저장하지 않습니다. 가운데는 원본입니다.', true)
      return ''
    }
    const shown = await showDeskStepResult(composed, '한 장면', '같은 두 사람. 배경 지우고 전신 키를 맞춰 붙임.', {
      assembleCouple: true,
    })
    if (shown === false) return ''
    if (typeof updateCurrentDeskWork === 'function') {
      updateCurrentDeskWork({ assembledPair: true, scene: composed, castPlate: composed, lookApplied: '' })
    }
    setTwoPeopleChecked(true)
    void syncDeskGates()
    setFormStatus('한 장에 붙였습니다. 얼굴은 그대로입니다. 옷·장소는 이 장으로 고르세요.', false)
    return deskSceneBase()
  }

  const runDeskStepTogether = async () => {
    const work = currentDeskWork()
    if (!work?.woman || !work?.man) {
      setFormStatus('한 장면은 여 칸과 남 칸에 사진이 둘 다 있어야 합니다.', true)
      return
    }
    await ensureDeskCoupleScene()
  }

  const runDeskWomanCropLook = async (lead, lookDescription, faces) => {
    if (typeof globalThis.postTaleSceneJob !== 'function') {
      setFormStatus('장면 엔진을 불러오지 못했습니다.', true)
      return
    }
    setFormStatus(`남자는 그대로 두고 여자 ${deskLookNoun()} 중…`, false)
    const stableLead =
      typeof compactDeskScene === 'function' ? await compactDeskScene(lead, 1920, 0.92) : lead
    const hold = currentDeskWork()
    if (hold?.assembledPair && !hold.castPlate) {
      updateCurrentDeskWork({ castPlate: stableLead })
    }
    const crop = await cropDeskWomanFromFaces(stableLead, faces)
    if (!crop) {
      setFormStatus('여자만 잘라내지 못해 보내지 않습니다. 한 장 전체를 다시 그리지 않습니다.', true)
      return false
    }
    const solo = compileLookOnly(false)
    const cropLayout = {
      sceneW: 1,
      sceneH: 1,
      woman: { slot: 'woman', x: 0, y: 0, w: 1, h: 1 },
      man: null,
    }
    const remapFaceToCrop = (box) => {
      if (!box || !crop.fullW || !crop.sw) return null
      const x0 = Number(box.x) * crop.fullW
      const y0 = Number(box.y) * crop.fullH
      const x1 = (Number(box.x) + Number(box.w)) * crop.fullW
      const y1 = (Number(box.y) + Number(box.h)) * crop.fullH
      const nx = (x0 - crop.sx) / crop.sw
      const ny = (y0 - crop.sy) / Math.max(crop.sh, 1)
      const nw = (x1 - x0) / crop.sw
      const nh = (y1 - y0) / Math.max(crop.sh, 1)
      if (!Number.isFinite(nx + ny + nw + nh) || nw < 0.04 || nh < 0.04) return null
      if (nx + nw < 0.02 || nx > 0.98) return null
      const x = Math.max(0, Math.min(0.9, nx))
      const y = Math.max(0, Math.min(0.9, ny))
      return { x, y, w: Math.max(0.05, Math.min(1 - x, nw)), h: Math.max(0.05, Math.min(1 - y, nh)), slot: 'woman' }
    }
    const cropFaces =
      typeof deskStillFaceBoxes === 'function' ? await deskStillFaceBoxes(crop.dataUrl, { couple: false }) : []
    const womanFromFull =
      (Array.isArray(faces) && faces.find((f) => f.slot === 'woman')) ||
      (Array.isArray(faces) && faces.slice().sort((a, b) => a.x - b.x)[faces.length > 1 ? 1 : 0]) ||
      null
    const cropFace = (cropFaces && cropFaces[0]) || remapFaceToCrop(womanFromFull)
    if (!cropFace) {
      setFormStatus('자른 장에서 여자 얼굴을 확인하지 못해 보내지 않습니다.', true)
      return false
    }
    const taggedCrop = [{ ...cropFace, slot: 'woman' }]
    const runtime = globalThis.DeskLookRuntime
    if (!runtime || typeof runtime.prepare !== 'function') {
      setFormStatus('의상 파싱을 불러오지 못해 보내지 않습니다.', true)
      return false
    }
    setFormStatus('자른 여자 옷만 확인하는 중…', false)
    const prepared = await runtime.prepare(crop.dataUrl, {
      faces: taggedCrop,
      layout: cropLayout,
      needCouple: false,
    })
    if (!prepared?.ok) {
      setFormStatus(
        prepared?.reason === 'undetected'
          ? '자른 장에서 얼굴을 확인하지 못해 보내지 않습니다.'
          : '자른 장의 의상 파싱을 확인하지 못해 보내지 않습니다.',
        true,
      )
      return false
    }
    const preflight = globalThis.DeskLookLib?.runDeskLookPreflight
    if (typeof preflight !== 'function') {
      setFormStatus('LOOK 게이트를 불러오지 못해 보내지 않습니다.', true)
      return false
    }
    const clothesReplace = deskLookKind() === 'silk'
    let srcRgba = null
    if (clothesReplace) {
      try {
        const srcImg = await loadDeskImage(crop.dataUrl)
        const srcCanvas = document.createElement('canvas')
        srcCanvas.width = prepared.width
        srcCanvas.height = prepared.height
        srcCanvas.getContext('2d').drawImage(srcImg, 0, 0, prepared.width, prepared.height)
        srcRgba = new Uint8Array(
          srcCanvas.getContext('2d').getImageData(0, 0, prepared.width, prepared.height).data,
        )
      } catch (_) {
        setFormStatus('자른 장 원본 화소를 읽지 못해 보내지 않습니다.', true)
        return false
      }
    }
    const pre = preflight({
      labels: prepared.labels,
      width: prepared.width,
      height: prepared.height,
      layout: cropLayout,
      faces: taggedCrop,
      embeds: prepared.embeds,
      embedOk: prepared.embedOk !== false,
      vton: clothesReplace,
      allowTogether: deskLookKind() === 'nude',
      srcRgba,
    })
    if (!pre.ok) {
      setFormStatus(
        pre.reason === 'mask_too_small'
          ? '자른 장 의상 영역이 너무 작아 보내지 않습니다.'
          : pre.reason === 'clothes_regions'
            ? '상의와 하의를 한꺼번에 열지 않습니다. 가운데는 원본입니다.'
            : pre.reason === 'mask_invade'
              ? '마스크가 피부·배경을 침범해 보내지 않습니다.'
              : pre.reason === 'undetected'
                ? '자른 장에서 얼굴을 확인하지 못해 보내지 않습니다.'
                : '자른 장 의상 마스크를 확인하지 못해 보내지 않습니다.',
        true,
      )
      return false
    }
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = prepared.width || 1
    maskCanvas.height = prepared.height || 1
    const mctx = maskCanvas.getContext('2d')
    const imgd = mctx.createImageData(maskCanvas.width, maskCanvas.height)
    for (let i = 0; i < pre.mask.length; i += 1) {
      const v = pre.mask[i]
      imgd.data[i * 4] = v
      imgd.data[i * 4 + 1] = v
      imgd.data[i * 4 + 2] = v
      imgd.data[i * 4 + 3] = 255
    }
    mctx.putImageData(imgd, 0, 0)
    let engineMask = pre.mask
    if (deskLookKind() === 'nude') {
      const bodyMelt = globalThis.DeskLookLib?.assembleNudeBodyMask
      const clothMelt = globalThis.DeskLookLib?.assembleNudeInpaintMask
      const bodyMask =
        typeof bodyMelt === 'function'
          ? bodyMelt({
              width: prepared.width,
              height: prepared.height,
              woman: cropLayout.woman,
              man: null,
              faces: taggedCrop,
            })
          : null
      if (bodyMask?.ok && bodyMask.mask?.length === pre.mask.length) {
        engineMask = bodyMask.mask
      } else if (typeof clothMelt === 'function') {
        const nudeMask = clothMelt({
          labels: prepared.labels,
          width: prepared.width,
          height: prepared.height,
          woman: cropLayout.woman,
          man: null,
          faces: taggedCrop,
        })
        if (nudeMask?.ok && nudeMask.mask?.length === pre.mask.length) engineMask = nudeMask.mask
      }
    }
    const engCanvas = document.createElement('canvas')
    engCanvas.width = maskCanvas.width
    engCanvas.height = maskCanvas.height
    const ectx = engCanvas.getContext('2d')
    const engImg = ectx.createImageData(engCanvas.width, engCanvas.height)
    for (let i = 0; i < engineMask.length; i += 1) {
      const v = engineMask[i]
      engImg.data[i * 4] = v
      engImg.data[i * 4 + 1] = v
      engImg.data[i * 4 + 2] = v
      engImg.data[i * 4 + 3] = 255
    }
    ectx.putImageData(engImg, 0, 0)
    const cropMask = engCanvas.toDataURL('image/png')
    let maskSha = ''
    if (globalThis.crypto?.subtle) {
      const buf = await globalThis.crypto.subtle.digest('SHA-256', engineMask)
      maskSha = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
    }
    const modelSha = prepared.segformerSha256 && prepared.recSha256
      ? { segformerSha256: prepared.segformerSha256, recSha256: prepared.recSha256 }
      : globalThis.DeskLookOnnx?.loadedSha
    if (!maskSha) {
      setFormStatus('의상 마스크 SHA를 만들지 못해 보내지 않습니다.', true)
      return false
    }
    if (!modelSha?.segformerSha256 || !modelSha?.recSha256) {
      setFormStatus('의상 모델 SHA를 확인하지 못해 보내지 않습니다.', true)
      return false
    }
    let aspectRatio = '3:4'
    if (crop.sw > crop.sh * 1.08) aspectRatio = '16:9'
    else if (Math.abs(crop.sw - crop.sh) / Math.max(crop.sw, 1) < 0.08) aspectRatio = '1:1'
    const adultStill =
      state.look === 'nude' ||
      state.look === 'silk' ||
      /나체|누드|nude|naked|전라|슬립|slip|실크/i.test(String(lookDescription || ''))
    const payload = {
      composeMode: 'desk-still',
      deskStep: 'look',
      images: [crop.dataUrl],
      description: solo,
      photoreal: true,
      refKind: 'body',
      aspectRatio,
      gender0: 'female',
      sourcePeople: 1,
      adultStill,
      deskLook: deskLookKind(),
      deskCouple: false,
      deskAction: 'none',
      clothesMask: cropMask,
      deskCastLayout: cropLayout,
      deskLookVerify: {
        ...pre.verify,
        ok: true,
        maskSha256: maskSha,
        segformerSha256: modelSha.segformerSha256,
        recSha256: modelSha.recSha256,
      },
    }
    const paintOnce = async (boost) => {
      const job = await globalThis.postTaleSceneJob(
        { ...payload, lookInpaintBoost: Boolean(boost) },
        deskLookNoun(),
        160,
      )
      if (!job || job.auth || !job.imageUrl) {
        return { auth: Boolean(job?.auth), painted: '', sent: false }
      }
      const painted = await stabilizeDeskStill(job.imageUrl)
      if (!painted) return { painted: '', sent: true }
      if (typeof isNearlyBlackImage === 'function' && (await isNearlyBlackImage(painted))) {
        return { painted: '', sent: true }
      }
      return { painted, sent: true }
    }
    let attempt = await paintOnce(true)
    if (attempt.auth) return false
    if (!attempt.painted) {
      if (!attempt.sent) return false
      setFormStatus('여자 옷만 보냈는데 결과가 없습니다. 가운데는 원본입니다. 낯선 결과는 저장하지 않습니다.', true)
      return false
    }
    const gateCrop = async (painted) => {
      if (typeof deskLookVisualPasses !== 'function') return { ok: false, reason: 'clothes_goal' }
      return deskLookVisualPasses(crop.dataUrl, painted, cropMask, { looseNude: true })
    }
    let visual = await gateCrop(attempt.painted)
    if (!visual.ok && visual.reason === 'clothes_goal') {
      setFormStatus('옷이 그대로라 한 번 더 녹입니다…', false)
      const again = await paintOnce(true)
      if (again.auth) return false
      if (again.painted) {
        attempt = again
        visual = await gateCrop(attempt.painted)
      }
    }
    if (!visual.ok) {
      setFormStatus('옷이 바뀌지 않아 저장하지 않습니다. 가운데는 원본입니다.', true)
      return false
    }
    const finishCoupleStill = async (painted) => {
      let next = await pasteDeskRectOntoFull(stableLead, painted, crop)
      const workNow = currentDeskWork()
      const layout = workNow?.castLayout
      const womanFace =
        (faces || []).find((f) => f.slot === 'woman') ||
        (Array.isArray(faces) && faces.length
          ? faces.slice().sort((a, b) => a.x - b.x)[faces.length > 1 ? 1 : 0]
          : null)
      const manFace = (faces || []).find((f) => f.slot === 'man')
      if (womanFace) next = await deskStampCastFaceFromSource(stableLead, next, womanFace, 'woman')
      if (layout?.man) {
        next = await deskStampManFromSource(stableLead, next, layout)
      }
      if (manFace) next = await deskStampCastFaceFromSource(stableLead, next, manFace, 'man')
      return { shown: next, manOk: { ok: true }, sameFrame: true }
    }
    const finished = await finishCoupleStill(attempt.painted)
    if (!finished?.shown) {
      setFormStatus('남자는 원본인데 여자 옷을 붙이지 못했습니다. 가운데는 원본입니다.', true)
      return false
    }
    const shown = finished.shown
    showDeskStepResult(shown, deskLookNoun(), lookDescription, { skipManLock: true })
    updateCurrentDeskWork({ lookApplied: deskLookKind(), scene: shown })
    setFormStatus(`남자는 원본 화소입니다. 여자만 ${deskLookNoun()} 했습니다.`, false)
    void syncDeskGates()
    return true
  }

  const runDeskFreeOutfit = async (kind) => {
    const spec =
      kind === 'mini'
        ? {
            deskLook: 'mini',
            noun: '미니',
            description: '미니. 짧은 타이트 스커트를 10% 더 짧고 더 붙게. 같은 얼굴.',
            poll: '미니를 줄이는 중',
            title: '미니',
            promptLabel: '42 기준 · 10% 짧고 타이트',
            done: '42번보다 단과 타이트함을 10% 올렸습니다. 가운데가 그 장입니다.',
          }
        : {
            deskLook: 'shape',
            noun: '몸 보기',
            description: '몸 보기. 아이보리 운동복. 같은 얼굴. 손이 보이게.',
            poll: '팔·몸 비율을 보는 중',
            title: '몸 보기',
            promptLabel: '아이보리 운동복 · 팔 길이',
            done: '아이보리 운동복입니다. 겉옷 검정은 되고 속옷 검정은 없습니다. 가운데가 그 장입니다.',
          }
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      if (typeof showPinGate === 'function') showPinGate('로그인이 필요해요.')
      return
    }
    const work = currentDeskWork()
    if (!work?.woman) {
      setFormStatus(`여 칸에 여자 사진을 넣으세요. ${spec.noun}는 여자만입니다.`, true)
      return
    }
    const lookId = deskIdPhoto(work, 'woman') || work.woman
    const scene = (typeof currentResult !== 'undefined' && currentResult.imageUrl) || work.scene || ''
    let src = work.woman
    if (scene && (await deskLooksStandingFull(scene))) src = scene
    const alreadyFull = Boolean(work.womanFull) || (await deskLooksStandingFull(src))
    if (!alreadyFull && lookId && (await deskPhotoNeedsBodyExtend(src))) {
      const extended = await ensureDeskLeadBody(lookId, 'female', '여', false, lookId, {
        deadline: window.__deskBodyDeadline,
      })
      if (!extended) {
        setFormStatus(deskBodyFail(`전신이 안 붙었습니다. ${spec.noun}는 하지 않았습니다. 1 몸 잇기만 다시 누르세요.`), true)
        return
      }
      if (extended === lookId && !(await deskLooksStandingFull(extended))) {
        setFormStatus(deskBodyFail(`전신이 안 붙었습니다. ${spec.noun}는 하지 않았습니다. 1 몸 잇기만 다시 누르세요.`), true)
        return
      }
      updateCurrentDeskWork({ woman: extended, womanFull: true })
      src = extended
    } else if (alreadyFull && !work.womanFull) {
      updateCurrentDeskWork({ womanFull: true })
    }
    try {
      if (!String(src).startsWith('data:') && typeof globalThis.ensureStableDataUrl === 'function') {
        src = (await globalThis.ensureStableDataUrl(src)) || src
      }
      src = typeof compactDeskScene === 'function' ? await compactDeskScene(src, 1400, 0.84) : src
    } catch (err) {
      setFormStatus(
        `이 사진을 엔진에 넣지 못했습니다. 여 칸에 파일을 다시 넣으세요. ${
          err instanceof Error ? err.message : String(err)
        }`,
        true,
      )
      return
    }
    if (!String(src).startsWith('data:')) {
      setFormStatus('이 사진을 엔진에 넣지 못했습니다. 여 칸에 파일을 다시 넣으세요.', true)
      return
    }
    if (typeof globalThis.postTaleSceneJob !== 'function') {
      setFormStatus('장면 엔진을 불러오지 못했습니다.', true)
      return
    }
    const job = await globalThis.postTaleSceneJob(
      {
        composeMode: 'free-still',
        deskLook: spec.deskLook,
        images: [src],
        description: spec.description,
        photoreal: true,
        aspectRatio: '3:4',
        gender0: 'female',
        sourcePeople: 1,
      },
      spec.poll,
      180,
    )
    if (!job || job.auth || !job.imageUrl) return
    const stable = await stabilizeDeskStill(job.imageUrl)
    if (!stable) {
      setFormStatus('그림이 안 붙었습니다. 같은 버튼을 다시 누르세요.', true)
      return
    }
    if (typeof isNearlyBlackImage === 'function' && (await isNearlyBlackImage(stable))) {
      setFormStatus('엔진이 빈 장을 냈습니다. 가운데는 원본입니다.', true)
      return
    }
    if (await deskMissingShoes(stable)) {
      setFormStatus(
        `${spec.noun}가 전신을 잘라 저장하지 않습니다. 가운데는 원본입니다. 같은 버튼을 다시 누르세요.`,
        true,
      )
      return
    }
    if (lookId && typeof deskFacesHold === 'function') {
      const hold = await deskFacesHold(lookId, stable)
      if (!hold.ok) {
        setFormStatus(
          `${spec.noun}가 다른 얼굴이라 저장하지 않습니다. 가운데는 원본입니다.`,
          true,
        )
        return
      }
    }
    const ok = await showDeskStepResult(stable, spec.title, spec.promptLabel, { skipManLock: true })
    if (!ok) return
    updateCurrentDeskWork({ scene: stable })
    setFormStatus(spec.done, false)
    void syncDeskGates()
  }

  const runDeskStepShape = async () => runDeskFreeOutfit('shape')
  const runDeskStepMini = async () => runDeskFreeOutfit('mini')

  const runDeskStepLook = async () => {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      if (typeof showPinGate === 'function') showPinGate('로그인이 필요해요.')
      return
    }
    const sceneHint =
      (typeof currentResult !== 'undefined' ? currentResult.imageUrl : '') ||
      currentDeskWork()?.scene ||
      ''
    let sceneLooksCouple =
      typeof deskTwoPeopleChecked === 'function' && deskTwoPeopleChecked()
    if (sceneHint) {
      const hintFaces =
        typeof deskStillFaceBoxes === 'function' ? await deskStillFaceBoxes(sceneHint, { couple: true }) : []
      const hintSize = typeof deskImageSize === 'function' ? await deskImageSize(sceneHint) : null
      const hintWide = Boolean(hintSize && hintSize.w > hintSize.h * 1.08)
      if ((hintFaces && hintFaces.length >= 2) || hintWide) sceneLooksCouple = true
    }
    const frame = await resolveDeskFrame({
      from:
        sceneLooksCouple || currentDeskWork()?.assembledPair
          ? 'scene'
          : 'cast',
    })
    if (!frame.ok || !frame.image) {
      setFormStatus(frame.message || '여 칸에 사진을 넣으세요. 그 사진 위에만 옷을 녹입니다.', true)
      return
    }
    const lookWork = currentDeskWork()
    const lookId = deskIdPhoto(lookWork, 'woman') || deskIdPhoto(lookWork, 'man')
    const lookLead = lookWork?.woman || lookWork?.man || frame.image
    const lookAlreadyFull =
      Boolean(lookWork?.womanFull || lookWork?.manFull) || (await deskLooksStandingFull(lookLead))
    if (!lookAlreadyFull && lookId && (await deskPhotoNeedsBodyExtend(lookLead))) {
      const g = lookWork?.woman ? 'female' : 'male'
      const lab = lookWork?.woman ? '여' : '남'
      const extended = await ensureDeskLeadBody(lookId, g, lab, false, lookId, {
        deadline: window.__deskBodyDeadline,
      })
      if (!extended) {
        setFormStatus(deskBodyFail('전신이 안 붙었습니다. 옷은 녹이지 않았습니다. 1 몸 잇기만 다시 누르세요.'), true)
        return
      }
      if (extended === lookId && !(await deskLooksStandingFull(extended))) {
        setFormStatus(deskBodyFail('전신이 안 붙었습니다. 옷은 녹이지 않았습니다. 1 몸 잇기만 다시 누르세요.'), true)
        return
      }
      if (lookWork?.woman) updateCurrentDeskWork({ woman: extended, womanFull: true })
      else updateCurrentDeskWork({ man: extended, manFull: true })
      frame.image = extended
    }
    let splitSrc = sceneLooksCouple && sceneHint ? sceneHint : frame.image
    try {
      if (
        !String(splitSrc).startsWith('data:') &&
        typeof globalThis.ensureStableDataUrl === 'function'
      ) {
        splitSrc = (await globalThis.ensureStableDataUrl(splitSrc)) || splitSrc
      }
      splitSrc =
        typeof compactDeskScene === 'function' ? await compactDeskScene(splitSrc, 1400, 0.84) : splitSrc
    } catch (err) {
      setFormStatus(
        `이 사진을 엔진에 넣지 못했습니다. 여 칸에 파일을 다시 넣으세요. ${
          err instanceof Error ? err.message : String(err)
        }`,
        true,
      )
      return
    }
    if (!String(splitSrc).startsWith('data:')) {
      setFormStatus('이 사진은 주소만 있습니다. 여 칸에 사진 파일을 다시 넣으세요.', true)
      return
    }
    const work = currentDeskWork()
    const sceneFacesEarly =
      typeof deskStillFaceBoxes === 'function' ? await deskStillFaceBoxes(splitSrc, { couple: true }) : []
    const sceneCouple = Boolean(sceneFacesEarly && sceneFacesEarly.length >= 2)
    const userCouple = typeof deskTwoPeopleChecked === 'function' && deskTwoPeopleChecked()
    const srcSize = typeof deskImageSize === 'function' ? await deskImageSize(splitSrc) : null
    const wideScene = Boolean(srcSize && srcSize.w > srcSize.h * 1.08)
    const pairSlots = Boolean(work?.woman && work?.man) && (sceneCouple || userCouple || wideScene)
    const twoBox = userCouple || wideScene
    if (!sceneCouple) {
      if (work?.woman && !work.womanCastLock?.ok) {
        const lock = await captureDeskCastLock('woman', work.woman)
        updateCurrentDeskWork({ womanCastId: lock.id, womanCastLock: lock })
        if (!lock.ok) {
          setFormStatus('여 CAST 얼굴을 확인하지 못해 보내지 않습니다.', true)
          return
        }
      }
    } else {
      const womanFace = work?.womanFace || work?.woman
      if (womanFace && !work?.womanCastLock?.ok) {
        const lock = await captureDeskCastLock('woman', womanFace)
        if (lock.ok) updateCurrentDeskWork({ womanCastId: lock.id, womanCastLock: lock })
      }
    }
    const needCouple = sceneCouple || userCouple || wideScene
    let layout = work?.castLayout
    if (needCouple) {
      const plateOk = Boolean(work?.assembledPair && deskLayoutLinked(layout, true))
      if (sceneCouple) {
        if (!deskLayoutLinked(layout, true) && !plateOk) {
          layout = deskLayoutFromSceneFaces(sceneFacesEarly, work)
          if (!layout) {
            setFormStatus('얼굴을 확인하지 못해 보내지 않습니다.', true)
            return
          }
          updateCurrentDeskWork({
            castLayout: layout,
            assembledPair: true,
            peopleCount: 2,
            sourceKind: pairSlots && work?.sourceKind === 'pair' ? 'pair' : 'scene',
            scene: splitSrc,
          })
        }
        setTwoPeopleChecked(true)
        const taggedSides = deskTagFacesToCastLayout(sceneFacesEarly, layout)
        const sides = taggedSides.length >= 2 ? taggedSides : sceneFacesEarly
        return runDeskWomanCropLook(splitSrc, compileLookOnly(true), sides)
      }
      if (plateOk) {
        setTwoPeopleChecked(true)
        const taggedSides = deskTagFacesToCastLayout(sceneFacesEarly, layout)
        return runDeskWomanCropLook(splitSrc, compileLookOnly(true), taggedSides.length ? taggedSides : sceneFacesEarly)
      }
      const sides = deskSplitOneFaceToMw(sceneFacesEarly && sceneFacesEarly[0])
      layout = deskLayoutFromSceneFaces(sides, work) || {
        sceneW: 1,
        sceneH: 1,
        woman: sides.find((f) => f.slot === 'woman'),
        man: sides.find((f) => f.slot === 'man'),
      }
      updateCurrentDeskWork({
        castLayout: layout,
        assembledPair: true,
        peopleCount: 2,
        sourceKind: pairSlots && work?.sourceKind === 'pair' ? 'pair' : 'scene',
        scene: splitSrc,
      })
      setTwoPeopleChecked(true)
      setFormStatus('두 얼굴 좌표가 약합니다. 왼쪽 남·오른쪽 여로 여자만 잘라 녹입니다.', false)
      return runDeskWomanCropLook(splitSrc, compileLookOnly(true), sides)
    } else {
      const faces = sceneFacesEarly
      if (!faces || !faces.length) {
        setFormStatus('얼굴을 확인하지 못해 보내지 않습니다. 위치를 추측하지 않습니다.', true)
        return
      }
      layout = deskSoloWomanLayout()
      updateCurrentDeskWork({ castLayout: layout })
    }
    if (await deskPhotoNeedsBodyExtend(splitSrc)) {
      setFormStatus(
        '상반신은 보이는 체형만 유지합니다. 전신 확장은 1 몸 잇기이며 CAST 몸매 유지가 아닙니다.',
        false,
      )
    }
    const description = compileLookOnly(needCouple)
    if (descriptionField) descriptionField.value = description
    setFormStatus('여 칸 의상 영역을 확인하는 중…', false)
    const tagged = []
    const sceneFaces =
      typeof deskStillFaceBoxes === 'function' ? await deskStillFaceBoxes(splitSrc, { couple: needCouple }) : []
    if (!sceneFaces || !sceneFaces.length) {
      setFormStatus('얼굴을 확인하지 못해 보내지 않습니다.', true)
      return
    }
    tagged.push(...deskTagFacesToCastLayout(sceneFaces, layout))
    if (needCouple && tagged.filter((f) => f.slot === 'woman').length === 1 && tagged.filter((f) => f.slot === 'man').length === 1) {
      const expanded =
        typeof globalThis.DeskLookLib?.lookLayoutFromFaces === 'function'
          ? globalThis.DeskLookLib.lookLayoutFromFaces(tagged)
          : null
      if (expanded?.woman && expanded?.man) {
        layout = {
          sceneW: layout?.sceneW || 1,
          sceneH: layout?.sceneH || 1,
          woman: { ...expanded.woman, slot: 'woman', castId: layout?.woman?.castId || '' },
          man: { ...expanded.man, slot: 'man', castId: layout?.man?.castId || '' },
        }
        updateCurrentDeskWork({ castLayout: layout })
      }
    }
    const womanHits = tagged.filter((f) => f.slot === 'woman')
    const manHits = tagged.filter((f) => f.slot === 'man')
    if (needCouple) {
      if (womanHits.length !== 1 || manHits.length !== 1) {
        setFormStatus('얼굴을 확인하지 못해 보내지 않습니다. CAST에 연결하지 못했습니다.', true)
        return
      }
    } else if (womanHits.length !== 1 || manHits.length) {
      setFormStatus('얼굴을 확인하지 못해 보내지 않습니다.', true)
      return
    }
    const runtime = globalThis.DeskLookRuntime
    if (!runtime || typeof runtime.prepare !== 'function') {
      setFormStatus('의상 파싱을 불러오지 못해 보내지 않습니다. 밝기 추정으로 대체하지 않습니다.', true)
      return
    }
    const prepared = await runtime.prepare(splitSrc, { faces: tagged, layout, needCouple })
    if (!prepared?.ok) {
      setFormStatus(
        prepared?.reason === 'undetected'
          ? '얼굴을 확인하지 못해 보내지 않습니다.'
          : '의상 파싱을 확인하지 못해 보내지 않습니다.',
        true,
      )
      return
    }
    const preflight = globalThis.DeskLookLib?.runDeskLookPreflight
    if (typeof preflight !== 'function') {
      setFormStatus('LOOK 게이트를 불러오지 못해 보내지 않습니다.', true)
      return
    }
    const clothesReplace = deskLookKind() === 'silk'
    let srcRgba = null
    if (clothesReplace) {
      try {
        const srcImg = await loadDeskImage(splitSrc)
        const srcCanvas = document.createElement('canvas')
        srcCanvas.width = prepared.width
        srcCanvas.height = prepared.height
        srcCanvas.getContext('2d').drawImage(srcImg, 0, 0, prepared.width, prepared.height)
        srcRgba = new Uint8Array(
          srcCanvas.getContext('2d').getImageData(0, 0, prepared.width, prepared.height).data,
        )
      } catch (_) {
        setFormStatus('원본 화소를 읽지 못해 보내지 않습니다.', true)
        return
      }
    }
    const pre = preflight({
      labels: prepared.labels,
      width: prepared.width,
      height: prepared.height,
      layout,
      faces: tagged,
      embeds: prepared.embeds,
      embedOk: prepared.embedOk !== false,
      vton: clothesReplace,
      allowTogether: deskLookKind() === 'nude',
      srcRgba,
    })
    if (!pre.ok) {
      setFormStatus(
        pre.reason === 'mask_too_small'
          ? '의상 영역이 너무 작아 보내지 않습니다. 피부·손을 넓혀 열지 않습니다.'
          : pre.reason === 'clothes_regions'
            ? '상의와 하의를 한꺼번에 열지 않습니다. 가운데는 원본입니다.'
            : pre.reason === 'woman_face_unlink' || pre.reason === 'man_face_unlink'
            ? 'CAST 출처와 얼굴 좌표가 맞지 않아 보내지 않습니다.'
            : pre.reason === 'undetected'
              ? '얼굴을 확인하지 못해 보내지 않습니다.'
              : pre.reason === 'mask_invade'
                ? '마스크가 피부·배경을 침범해 보내지 않습니다.'
                : '의상 마스크를 확인하지 못해 유료 엔진에 보내지 않습니다.',
        true,
      )
      return
    }
    let engineMask = pre.mask
    if (deskLookKind() === 'nude') {
      const bodyMelt = globalThis.DeskLookLib?.assembleNudeBodyMask
      const clothMelt = globalThis.DeskLookLib?.assembleNudeInpaintMask
      const bodyMask =
        typeof bodyMelt === 'function'
          ? bodyMelt({
              width: prepared.width,
              height: prepared.height,
              woman: layout?.woman,
              man: layout?.man,
              faces: tagged,
            })
          : null
      if (bodyMask?.ok && bodyMask.mask?.length === pre.mask.length) {
        engineMask = bodyMask.mask
      } else if (typeof clothMelt === 'function') {
        const nudeMask = clothMelt({
          labels: prepared.labels,
          width: prepared.width,
          height: prepared.height,
          woman: layout?.woman,
          man: layout?.man,
          faces: tagged,
        })
        if (nudeMask?.ok && nudeMask.mask?.length === pre.mask.length) engineMask = nudeMask.mask
      }
    }
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = engineMask.length && prepared.width ? prepared.width : 1
    maskCanvas.height = prepared.height || 1
    const mctx = maskCanvas.getContext('2d')
    const imgd = mctx.createImageData(maskCanvas.width, maskCanvas.height)
    for (let i = 0; i < engineMask.length; i += 1) {
      const v = engineMask[i]
      imgd.data[i * 4] = v
      imgd.data[i * 4 + 1] = v
      imgd.data[i * 4 + 2] = v
      imgd.data[i * 4 + 3] = 255
    }
    mctx.putImageData(imgd, 0, 0)
    const engineDataUrl = maskCanvas.toDataURL('image/png')
    const tightCanvas = document.createElement('canvas')
    tightCanvas.width = maskCanvas.width
    tightCanvas.height = maskCanvas.height
    const tctx = tightCanvas.getContext('2d')
    const tightImg = tctx.createImageData(tightCanvas.width, tightCanvas.height)
    for (let i = 0; i < pre.mask.length; i += 1) {
      const v = pre.mask[i]
      tightImg.data[i * 4] = v
      tightImg.data[i * 4 + 1] = v
      tightImg.data[i * 4 + 2] = v
      tightImg.data[i * 4 + 3] = 255
    }
    tctx.putImageData(tightImg, 0, 0)
    const fullDataUrl = tightCanvas.toDataURL('image/png')
    let maskSha = ''
    if (globalThis.crypto?.subtle) {
      const buf = await globalThis.crypto.subtle.digest('SHA-256', engineMask)
      maskSha = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
    }
    const modelSha = prepared.segformerSha256 && prepared.recSha256
      ? { segformerSha256: prepared.segformerSha256, recSha256: prepared.recSha256 }
      : globalThis.DeskLookOnnx?.loadedSha
    if (!modelSha?.segformerSha256 || !modelSha?.recSha256) {
      setFormStatus('의상 모델 SHA를 확인하지 못해 보내지 않습니다.', true)
      return
    }
    await runDeskKontextStep(
      [splitSrc],
      description,
      'look',
      deskLookNoun(),
      `${deskLookNoun()} 했습니다. 다음 걸음은 장소입니다.`,
      {
        deskLook: deskLookKind(),
        deskCouple: needCouple,
        deskAction: 'none',
        clothesMask: engineDataUrl,
        clothesMaskFull: deskLookKind() === 'nude' ? engineDataUrl : fullDataUrl,
        deskCastLayout: layout,
        deskLookVerify: {
          ...pre.verify,
          maskSha256: maskSha,
          segformerSha256: modelSha.segformerSha256,
          recSha256: modelSha.recSha256,
        },
      },
    )
  }

  const runDeskStepPlace = async () => {
    const work = currentDeskWork()
    let scene = deskSceneBase()
    if (work?.woman && work?.man) {
      const womanReady = await deskLeadIsReady(work.woman, work.womanFull)
      const manReady = await deskLeadIsReady(work.man, work.manFull)
      if (!womanReady || !manReady) {
        setFormStatus('먼저 1 몸 잇기를 누르세요. 장소는 몸을 이은 뒤에만 보냅니다.', true)
        return
      }
      if (!work.assembledPair || !scene) {
        scene = await ensureDeskCoupleScene()
        if (!scene) return
      }
    }
    if (!scene) {
      const lead = work?.woman || work?.man
      if (!lead) {
        setFormStatus('여 칸에 증명사진을 넣으세요. 몸을 이은 뒤 그 몸으로 자세를 잡습니다.', true)
        return
      }
      if (!(await deskLeadIsReady(lead, work?.womanFull || work?.manFull))) {
        setFormStatus('먼저 1 몸 잇기를 누르세요. 자세는 몸을 이은 뒤에만 보냅니다.', true)
        return
      }
      scene = lead
    } else if (
      !work?.assembledPair &&
      !(await deskLeadIsReady(scene, work?.womanFull || work?.manFull))
    ) {
      setFormStatus('먼저 1 몸 잇기를 누르세요. 증명사진으로는 장소를 보내지 않습니다.', true)
      return
    }
    if (scene) {
      currentResult.imageUrl = scene
      if (String(scene).startsWith('data:')) currentResult.imageDataUrl = scene
    }
    const frame = await resolveDeskFrame({ from: 'scene' })
    if (!frame.ok || !frame.image) {
      setFormStatus(frame.message || '여 칸에 증명사진을 넣으세요. 몸을 이은 뒤 그 몸으로 자세를 잡습니다.', true)
      return
    }
    const description = compilePlaceOnly(frame.couple)
    if (descriptionField) descriptionField.value = description
    const compact =
      typeof compactDeskScene === 'function' ? await compactDeskScene(frame.image, 1920, 0.92) : frame.image
    await runDeskKontextStep(
      [compact],
      description,
      'place',
      state.pose.includes('sit') || state.pose.includes('lie') || state.pose.includes('hug')
        ? '앉아·눕기·포옹'
        : '장소',
      state.pose.includes('sit') || state.pose.includes('lie') || state.pose.includes('hug')
        ? '자세를 바꿨습니다. 얼굴은 다시 붙입니다.'
        : '장소를 바꿨습니다. 움직이려면 움직이기를 누르세요.',
      {
        deskLook: deskLookKind(),
        deskCouple: frame.couple,
        deskAction: state.pose.includes('hug') ? 'hug' : 'none',
      },
    )
  }

  const compileNextCut = (coupleInScene = false) => {
    if (state.job === 'video') {
      const pickedRaw = pickMotions()
      if (!pickedRaw.length) return ''
      const poseOnly = pickedRaw.filter((item) => item.id !== 'undress')
      const picked = poseOnly.length ? poseOnly : pickedRaw
      const couple = coupleInScene === true
      const motion = compileDeskMove(couple, picked)
      return `다음 컷 정지 화보. ${motion}`
    }
    return [compilePlaceOnly(coupleInScene), '같은 사람. 같은 옷. 원본 구도 유지. 클로즈업 금지.']
      .filter(Boolean)
      .join(' ')
  }

  const syncDeskNextCutButton = () => {
    if (typeof getAppArea === 'function' && getAppArea() !== 'admin') return
    const engine = document.getElementById('result-engine')
    if (!engine) return
    if (!currentResult?.imageUrl && !currentDeskWork()?.scene) return
    engine.hidden = false
    engine.textContent = '다음 컷 시작'
  }

  const runDeskNextCut = async () => {
    if (!ensureDeskSceneFromCast()) {
      setFormStatus('먼저 지금 장이 있어야 다음 컷을 그립니다.', true)
      return
    }
    const coupleIds = new Set(['kiss', 'hug', 'come', 'zipper'])
    const picked = pickMotions()
    if (state.job === 'video' && !picked.length) {
      setFormStatus('오른쪽에서 동작을 고른 뒤 다음 컷 시작을 누르세요.', true)
      return
    }
    const needCouple = state.job === 'video' && picked.some((one) => coupleIds.has(one.id))
    const frame = await resolveDeskFrame({ from: 'scene', needCouple })
    if (!frame.ok) {
      setFormStatus(frame.message || '먼저 지금 장이 있어야 다음 컷을 그립니다.', true)
      return
    }
    if (frame.couple) setTwoPeopleBoxes(true)
    const description = compileNextCut(frame.couple)
    if (!description) {
      setFormStatus('다음 컷에 쓸 동작이나 장소가 없습니다.', true)
      return
    }
    setDeskStillBusy(true)
    try {
      if (descriptionField) descriptionField.value = description
      const compact =
        typeof compactDeskScene === 'function' ? await compactDeskScene(frame.image, 1920, 0.92) : frame.image
      const item = state.job === 'video' ? picked[0] : null
      await runDeskKontextStep(
        [compact],
        description,
        'cut',
        '다음 컷',
        item
          ? `${item.label} 다음 컷을 그렸습니다. 이 장으로 움직이려면 움직이기를 누르세요.`
          : '다음 컷을 그렸습니다. 이 장으로 움직이려면 움직이기를 누르세요.',
        {
          deskLook: deskLookKind(),
          deskCouple: frame.couple,
          deskAction: deskActionFromPicked(picked),
        },
      )
    } catch (err) {
      setFormStatus(`다음 컷 실패: ${err instanceof Error ? err.message : String(err)}`, true)
    } finally {
      setDeskStillBusy(false)
    }
  }

  async function runDeskStillCard(key) {
    if (deskStillRunning) {
      setFormStatus('지금 그리는 중이니 끝날 때까지 기다리세요.', true)
      return
    }
    const work = currentDeskWork()
    const scene = deskSceneBase()
    const lead = work?.woman || work?.man
    if (!scene && !lead) {
      setFormStatus('여 칸에 사진을 넣으세요.', true)
      return
    }
    if (key === 'look') return runDeskStep('look')
    if (scene && (await deskPhotoNeedsBodyExtend(scene))) {
      setFormStatus('먼저 옷을 골라 몸을 잇거나 1 몸 잇기를 누르세요. 방·자세는 전신 장 위에서만 바꿉니다.', true)
      return
    }
    if (!scene) {
      if (await deskPhotoNeedsBodyExtend(lead)) {
        setFormStatus('먼저 옷을 골라 몸을 잇거나 1 몸 잇기를 누르세요. 방·자세는 전신 장 위에서만 바꿉니다.', true)
        return
      }
    }
    if (work?.woman && work?.man) {
      let faces = 0
      if (scene && typeof countDeskSceneFaces === 'function') {
        faces = await countDeskSceneFaces(scene, 8000)
      }
      if (!scene || faces < 2) {
        setFormStatus('두 사람이면 먼저 2 한 장면을 누르세요.', true)
        return
      }
    }
    return runDeskStep('place')
  }

  const runDeskStep = async (step) => {
    if (deskStillRunning) {
      setFormStatus('지금 작업 중입니다. 가운데에 경과 초가 보입니다. 끝날 때까지 기다리세요.', true)
      return
    }
    deskStillRunning = true
    setDeskStillBusy(true)
    const workNow = currentDeskWork()
    const waitText =
      step === 'body'
        ? '증명사진을 전신으로 잇는 중'
        : step === 'together'
          ? '두 사람을 한 장에 붙이는 중'
          : step === 'look'
            ? '옷을 녹이는 중'
            : step === 'shape'
              ? '팔·몸 비율을 보는 중'
              : step === 'mini'
                ? '미니를 줄이는 중'
                : step === 'place'
                  ? '장소·자세를 그리는 중'
                  : '작업 중'
    const maxSec =
      step === 'body' ? (workNow?.woman && workNow?.man ? 420 : 360) : step === 'look' ? 240 : 180
    const abort = new AbortController()
    window.__deskStepAbort = abort
    window.__deskBodyDeadline = Date.now() + maxSec * 1000
    window.__deskStepTimerOn = true
    const stopTimer = startProgressTimer(setFormStatus, waitText, {
      maxSec,
      keepWaiting: step === 'body' || step === 'look' || step === 'shape' || step === 'mini',
      onMax: (sec) => {
        setFormStatus(
          step === 'body'
            ? `전신 잇기 ${sec}초를 넘겼습니다. 엔진이 아직 그리는 중이면 기다립니다.`
            : `작업 ${sec}초를 넘겼습니다. 엔진이 아직 그리는 중이면 기다립니다.`,
          false,
        )
      },
    })
    window.__deskStopStepTimer = () => {
      stopTimer()
      window.__deskStepTimerOn = false
      window.__deskStopStepTimer = null
    }
    try {
      if (step === 'body') await runDeskStepBody()
      else if (step === 'together') await runDeskStepTogether()
      else if (step === 'look') await runDeskStepLook()
      else if (step === 'shape') await runDeskStepShape()
      else if (step === 'mini') await runDeskStepMini()
      else if (step === 'place') await runDeskStepPlace()
    } catch (err) {
      if (typeof window.__deskStopStepTimer === 'function') window.__deskStopStepTimer()
      if (!abort.signal.aborted) setFormStatus(`걸음 실패: ${deskErrText(err)}`, true)
    } finally {
      if (typeof window.__deskStopStepTimer === 'function') window.__deskStopStepTimer()
      window.__deskStepAbort = null
      window.__deskBodyDeadline = 0
      deskStillRunning = false
      setDeskStillBusy(false)
    }
  }

  document.getElementById('desk-still-packs')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-desk-step]')
    if (!btn) return
    if (deskStillRunning) {
      setFormStatus('지금 작업 중입니다. 가운데에 경과 초가 보입니다. 끝날 때까지 기다리세요.', true)
      return
    }
    if (btn.disabled) return
    void runDeskStep(btn.getAttribute('data-desk-step')).catch((err) => {
      if (!deskStillRunning) setFormStatus(`걸음 실패: ${deskErrText(err)}`, true)
    })
  })

  document.getElementById('desk-still-steps')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-desk-step]')
    if (!btn) return
    if (deskStillRunning) {
      setFormStatus('지금 작업 중입니다. 가운데에 경과 초가 보입니다. 끝날 때까지 기다리세요.', true)
      return
    }
    if (btn.disabled) return
    void runDeskStep(btn.getAttribute('data-desk-step')).catch((err) => {
      if (!deskStillRunning) setFormStatus(`걸음 실패: ${deskErrText(err)}`, true)
    })
  })

  document.getElementById('desk-run')?.addEventListener('click', async () => {
    if (state.job === 'still') return
    await runDeskMoveQueue()
  })

  document.getElementById('result-engine')?.addEventListener('click', () => {
    if (typeof getAppArea === 'function' && getAppArea() !== 'admin') return
    if (document.getElementById('result-engine')?.disabled) return
    void runDeskNextCut()
  })

  const initDeskAssemble = () => {
    const panel = document.getElementById('desk-assemble')
    const canvas = document.getElementById('desk-assemble-canvas')
    const input = document.getElementById('desk-assemble-input')
    const sizeBtn = document.getElementById('desk-assemble-size')
    if (!panel || !canvas) return
    const ctx = canvas.getContext('2d')
    const layers = []
    let selected = -1
    let landscape = false
    let drag = null
    const dims = () => (landscape ? [1920, 1248] : [1248, 1920])
    const paint = () => {
      const [cw, ch] = dims()
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
      }
      paintDeskStudio(ctx, cw, ch)
      layers.forEach((layer, i) => {
        ctx.drawImage(layer.img, layer.x, layer.y, layer.w, layer.h)
        if (i === selected) {
          ctx.strokeStyle = '#e8b4ff'
          ctx.lineWidth = 3
          ctx.strokeRect(layer.x, layer.y, layer.w, layer.h)
        }
      })
    }
    const addFromUrl = async (url, urlSlot) => {
      if (!url) {
        setFormStatus('넣을 사진이 없습니다.', true)
        return
      }
      if (layers.length >= 3) {
        setFormStatus('세 장까지입니다. 하나를 빼고 넣으세요.', true)
        return
      }
      const img = await deskIsolatePerson(url)
      const [cw, ch] = dims()
      const { w: iw, h: ih } = deskSourceSize(img)
      const first = layers[0]
      let scale = first
        ? first.h / Math.max(ih, 1)
        : deskFitBodyScale(img, cw, ch, 1)
      scale = Math.min(scale, (ch * 0.88) / Math.max(ih, 1), (cw * 0.46) / Math.max(iw, 1))
      const w = Math.round(iw * scale)
      const h = Math.round(ih * scale)
      const slots = [0.28, 0.72, 0.5]
      layers.push({
        img,
        slot: urlSlot || '',
        x: Math.round(cw * (slots[layers.length] || 0.5) - w / 2),
        y: Math.round(ch * 0.93 - h),
        w,
        h,
      })
      selected = layers.length - 1
      paint()
    }
    const localPoint = (event) => {
      const box = canvas.getBoundingClientRect()
      return {
        x: ((event.clientX - box.left) * canvas.width) / Math.max(box.width, 1),
        y: ((event.clientY - box.top) * canvas.height) / Math.max(box.height, 1),
      }
    }
    const hit = (x, y) => {
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        const layer = layers[i]
        if (x >= layer.x && x <= layer.x + layer.w && y >= layer.y && y <= layer.y + layer.h) return i
      }
      return -1
    }
    const scaleSelected = (factor) => {
      if (selected < 0) return
      const layer = layers[selected]
      const nw = Math.max(40, layer.w * factor)
      const nh = Math.max(40, layer.h * factor)
      layer.x += (layer.w - nw) / 2
      layer.y += (layer.h - nh) / 2
      layer.w = nw
      layer.h = nh
      paint()
    }
    const open = async () => {
      panel.hidden = false
      const empty = document.getElementById('adult-desk-stage-empty')
      if (empty) empty.hidden = true
      const result = document.getElementById('result-section')
      if (result) result.hidden = true
      paint()
      const work = currentDeskWork()
      if (!layers.length) {
        if (work?.woman) await addFromUrl(work.woman)
        if (work?.man) await addFromUrl(work.man)
      }
      setFormStatus('배경을 지운 뒤 전신 키를 맞춰 붙입니다. 위치는 끌어 옮기세요.', false)
    }
    const close = () => {
      panel.hidden = true
      const result = document.getElementById('result-section')
      if (result && currentResult?.imageUrl) result.hidden = false
      syncDeskStageEmpty()
    }
    document.getElementById('desk-assemble-open')?.addEventListener('click', () => {
      void open()
    })
    document.getElementById('desk-assemble-close')?.addEventListener('click', close)
    sizeBtn?.addEventListener('click', () => {
      landscape = !landscape
      sizeBtn.textContent = landscape ? '가로' : '세로'
      paint()
    })
    document.getElementById('desk-assemble-smaller')?.addEventListener('click', () => scaleSelected(0.9))
    document.getElementById('desk-assemble-bigger')?.addEventListener('click', () => scaleSelected(1.1))
    document.getElementById('desk-assemble-add')?.addEventListener('click', () => input?.click())
    const addFromFile = async (file) => {
      if (!isImageFileLike(file)) {
        setFormStatus('이미지 파일만 넣을 수 있습니다.', true)
        return
      }
      const url =
        typeof prepareImageDataUrl === 'function' ? await prepareImageDataUrl(file, 2200) : URL.createObjectURL(file)
      await addFromUrl(url)
    }
    window.__deskAssembleAddFile = addFromFile
    panel.addEventListener('dragover', (event) => {
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
      panel.classList.add('is-drag')
    })
    panel.addEventListener('dragleave', (event) => {
      if (panel.contains(event.relatedTarget)) return
      panel.classList.remove('is-drag')
    })
    panel.addEventListener('drop', (event) => {
      event.preventDefault()
      event.stopPropagation()
      panel.classList.remove('is-drag')
      const files = pickImageFilesFromDataTransfer(event.dataTransfer)
      files.forEach((file) => void addFromFile(file))
    })
    panel.addEventListener('paste', (event) => {
      const files = pickImageFilesFromDataTransfer(event.clipboardData)
      if (!files.length) return
      event.preventDefault()
      event.stopPropagation()
      files.forEach((file) => void addFromFile(file))
    })
    input?.addEventListener('change', async () => {
      const files = [...(input.files || [])].slice(0, 3 - layers.length)
      input.value = ''
      for (const file of files) {
        if (!isImageFileLike(file)) continue
        const url =
          typeof prepareImageDataUrl === 'function' ? await prepareImageDataUrl(file, 2200) : URL.createObjectURL(file)
        await addFromUrl(url)
      }
    })
    document.getElementById('desk-assemble-cast-w')?.addEventListener('click', () => {
      void addFromUrl(currentDeskWork()?.woman, 'woman')
    })
    document.getElementById('desk-assemble-cast-m')?.addEventListener('click', () => {
      void addFromUrl(currentDeskWork()?.man, 'man')
    })
    document.getElementById('desk-assemble-now')?.addEventListener('click', () => {
      void addFromUrl(currentResult?.imageUrl)
    })
    document.getElementById('desk-assemble-drop')?.addEventListener('click', () => {
      if (selected < 0) return
      layers.splice(selected, 1)
      selected = layers.length - 1
      paint()
    })
    document.getElementById('desk-assemble-apply')?.addEventListener('click', () => {
      if (!layers.length) {
        setFormStatus('먼저 PNG를 넣으세요.', true)
        return
      }
      const [cw, ch] = dims()
      const out = document.createElement('canvas')
      out.width = cw
      out.height = ch
      const octx = out.getContext('2d')
      octx.imageSmoothingEnabled = true
      octx.imageSmoothingQuality = 'high'
      paintDeskStudio(octx, cw, ch)
      layers.forEach((layer) => octx.drawImage(layer.img, layer.x, layer.y, layer.w, layer.h))
      let url = ''
      try {
        url = out.toDataURL('image/jpeg', 0.95)
      } catch {
        setFormStatus('이 장은 붙일 수 없습니다. PNG를 다시 넣으세요.', true)
        return
      }
      const pair = layers.length >= 2
      if (sizeField && !sizeField.dataset.userPicked) sizeField.value = landscape ? 'landscape' : 'story'
      const womanL = layers.find((layer) => layer.slot === 'woman')
      const manL = layers.find((layer) => layer.slot === 'man')
      if (typeof updateCurrentDeskWork === 'function') {
        const layout =
          womanL && manL
            ? {
                sceneW: cw,
                sceneH: ch,
                woman: { slot: 'woman', x: womanL.x / cw, y: womanL.y / ch, w: womanL.w / cw, h: womanL.h / ch },
                man: { slot: 'man', x: manL.x / cw, y: manL.y / ch, w: manL.w / cw, h: manL.h / ch },
              }
            : womanL
              ? {
                  sceneW: cw,
                  sceneH: ch,
                  woman: { slot: 'woman', x: womanL.x / cw, y: womanL.y / ch, w: womanL.w / cw, h: womanL.h / ch },
                  man: null,
                }
              : null
        updateCurrentDeskWork({ assembledPair: pair, castLayout: layout })
      }
      close()
      showDeskStepResult(url, 'PNG 조립', '수동 조립. 같은 사람.')
      if (pair) setTwoPeopleChecked(true)
      void syncDeskGates()
      setFormStatus('한 장으로 붙였습니다. 옷·장소는 이 장으로 고르세요.', false)
    })
    canvas.addEventListener('pointerdown', (event) => {
      const p = localPoint(event)
      selected = hit(p.x, p.y)
      if (selected < 0) {
        paint()
        return
      }
      const layer = layers[selected]
      drag = { i: selected, dx: p.x - layer.x, dy: p.y - layer.y }
      canvas.setPointerCapture(event.pointerId)
      paint()
    })
    canvas.addEventListener('pointermove', (event) => {
      if (!drag) return
      const p = localPoint(event)
      const layer = layers[drag.i]
      if (!layer) return
      layer.x = p.x - drag.dx
      layer.y = p.y - drag.dy
      paint()
    })
    canvas.addEventListener('pointerup', () => {
      drag = null
    })
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault()
        scaleSelected(event.deltaY < 0 ? 1.06 : 0.94)
      },
      { passive: false },
    )
  }
  initDeskAssemble()

  window.syncDeskWorkUi = syncWorkUi
  window.syncDeskNextCutButton = syncDeskNextCutButton
  window.deskPhotoNeedsBodyExtend = deskPhotoNeedsBodyExtend
  syncJobUi()
  syncWorkUi()
  restoreDeskWorkScene()
  syncDeskNextCutButton()
}

bootAuth()
renderGallery()
initAdultDesk()
void hydrateStorymagStores()
