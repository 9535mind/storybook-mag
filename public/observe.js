/** 그림관찰과 표현 데스크 */
;(() => {
  const STORAGE_KEY = 'storymagObserveDesk'
  const gradeEl = document.getElementById('observe-grade')
  const observationEl = document.getElementById('observe-observation')
  const previewEl = document.getElementById('observe-preview')
  const imageInputEl = document.getElementById('observe-image-input')
  const imageLabelEl = document.getElementById('observe-image-label')
  const imagePasteBtn = document.getElementById('observe-image-paste')
  const imageStatusEl = document.getElementById('observe-image-status')
  const imageClearBtn = document.getElementById('observe-image-clear')
  const critiqueEl = document.getElementById('observe-critique')
  const critiqueWrap = document.getElementById('observe-critique-wrap')
  const modelAnswerEl = document.getElementById('observe-model-answer')
  const modelAnswerWrap = document.getElementById('observe-model-answer-wrap')
  const modelAnswerBtn = document.getElementById('observe-model-answer-button')
  const copyModelAnswerBtn = document.getElementById('observe-copy-model-answer')
  const tidyStatusEl = document.getElementById('observe-tidy-status')
  const questionsEl = document.getElementById('observe-questions')
  const questionsWrap = document.getElementById('observe-questions-wrap')
  const questionsBtn = document.getElementById('observe-questions-button')
  const copyQuestionsBtn = document.getElementById('observe-copy-questions')
  const detailEl = document.getElementById('observe-detail')
  const detailWrap = document.getElementById('observe-detail-wrap')
  const detailBtn = document.getElementById('observe-detail-button')
  const copyDetailBtn = document.getElementById('observe-copy-detail')
  const sendToStudioBtn = document.getElementById('observe-send-to-studio')
  const detailHistoryWrap = document.getElementById('observe-detail-history-wrap')
  const detailHistoryListEl = document.getElementById('observe-detail-history-list')
  const detailHistoryClearBtn = document.getElementById('observe-detail-history-clear')
  const statusEl = document.getElementById('observe-status')
  const critiqueBtn = document.getElementById('observe-critique-button')
  const clearBtn = document.getElementById('observe-clear-button')
  const restartBtn = document.getElementById('observe-restart-button')
  const copyBtn = document.getElementById('observe-copy-critique')
  const saveBtn = document.getElementById('observe-save-local')
  const downloadBtn = document.getElementById('observe-download')
  const useStudioBtn = document.getElementById('observe-use-studio-image')
  const areaEl = document.getElementById('observe-area')

  const IMAGE_MAX_BYTES = 15 * 1024 * 1024
  const IMAGE_MAX_DIM = 1400 // Claude Vision은 이 이상 확대해도 인식률이 크게 오르지 않아 리사이즈해서 비용·용량 절약
  const IMAGE_JPEG_QUALITY = 0.85

  const DETAIL_HISTORY_KEY = 'storymagObserveDetailHistory'
  const DETAIL_HISTORY_MAX = 20
  const DETAIL_HISTORY_THUMB_DIM = 480
  const DETAIL_HISTORY_THUMB_QUALITY = 0.7

  const AUTO_TIDY_DEBOUNCE_MS = 1400
  const AUTO_TIDY_MIN_CHARS = 4

  const state = {
    critiqueText: '',
    modelAnswerText: '',
    questionsText: '',
    detailText: '',
    imageDataUrl: '',
    autoTidyBaseline: '', // 마지막으로 자동 정리를 적용한 결과값 — 같은 값이면 재요청 안 함
    autoTidyRunning: false,
    autoTidyTimer: null,
    autoTidyToken: 0,
  }

  /** 이미지 파일/blob을 캔버스로 리사이즈해 JPEG data URL로 만든다 (Claude Vision·localStorage 용량 절약). */
  function resizeToDataUrl(blob, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.max(1, Math.round(img.naturalWidth * scale))
        const h = Math.max(1, Math.round(img.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('image_decode_failed'))
      }
      img.src = url
    })
  }

  /** 이미 dataURL인 이미지를 더 작은 썸네일로 다시 줄인다 (보관함 항목당 용량 절약). */
  function shrinkDataUrl(dataUrl, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.max(1, Math.round(img.naturalWidth * scale))
        const h = Math.max(1, Math.round(img.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('image_decode_failed'))
      img.src = dataUrl
    })
  }

  function setImageDataUrl(dataUrl) {
    state.imageDataUrl = dataUrl || ''
    if (previewEl) {
      if (state.imageDataUrl) {
        previewEl.hidden = false
        previewEl.src = state.imageDataUrl
      } else {
        previewEl.hidden = true
        previewEl.removeAttribute('src')
      }
    }
    if (imageClearBtn) imageClearBtn.hidden = !state.imageDataUrl
  }

  function setStatus(el, message, isError) {
    if (!el) return
    el.hidden = !message
    el.textContent = message || ''
    el.classList.toggle('form__status--error', Boolean(isError))
  }

  /** 어떤 엔진이 실제로 응답했는지 짧게 표시 (Claude 실패 시 대체 엔진으로 조용히 넘어가는 걸 눈에 보이게). */
  function engineLabel(data) {
    if (data?.source === 'workers-ai') return ' [대체 엔진: Cloudflare Workers AI/Llama — 이미지는 못 봄]'
    if (data?.source === 'claude' && data?.debugError) return ` [엔진: Claude · ${data.debugError}]`
    if (data?.source === 'claude') return ` [엔진: Claude${data.model ? ` (${data.model})` : ''}]`
    return ''
  }

  function loadLocal() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (!data) return
      if (gradeEl && data.grade) gradeEl.value = data.grade
      if (observationEl && data.observation) observationEl.value = data.observation
      if (data.imageDataUrl) setImageDataUrl(data.imageDataUrl)
      if (data.critiqueText && critiqueEl && critiqueWrap) {
        state.critiqueText = data.critiqueText
        critiqueEl.textContent = data.critiqueText
        critiqueWrap.hidden = false
      }
      if (data.modelAnswerText && modelAnswerEl && modelAnswerWrap) {
        state.modelAnswerText = data.modelAnswerText
        modelAnswerEl.textContent = data.modelAnswerText
        modelAnswerWrap.hidden = false
      }
      if (data.questionsText && questionsEl && questionsWrap) {
        state.questionsText = data.questionsText
        questionsEl.textContent = data.questionsText
        questionsWrap.hidden = false
      }
      if (data.detailText && detailEl && detailWrap) {
        state.detailText = data.detailText
        detailEl.value = data.detailText
        detailWrap.hidden = false
      }
    } catch {
      /* ignore */
    }
  }

  function saveLocal(silent) {
    try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        grade: gradeEl?.value || '',
        observation: observationEl?.value || '',
          imageDataUrl: state.imageDataUrl || '',
        critiqueText: state.critiqueText,
          modelAnswerText: state.modelAnswerText,
          questionsText: state.questionsText,
          detailText: state.detailText,
        savedAt: new Date().toISOString(),
      }),
    )
    if (!silent) setStatus(statusEl, '브라우저에 저장했어요.', false)
    } catch (err) {
      if (!silent || err?.name === 'QuotaExceededError') {
        setStatus(statusEl, '저장 용량이 가득 차서 그림 없이 글만 저장했어요.', true)
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              grade: gradeEl?.value || '',
              observation: observationEl?.value || '',
              imageDataUrl: '',
              critiqueText: state.critiqueText,
              modelAnswerText: state.modelAnswerText,
              questionsText: state.questionsText,
              detailText: state.detailText,
              savedAt: new Date().toISOString(),
            }),
          )
        } catch {
          /* ignore */
        }
      }
    }
  }

  function loadDetailHistory() {
    try {
      const list = JSON.parse(localStorage.getItem(DETAIL_HISTORY_KEY) || '[]')
      return Array.isArray(list) ? list : []
    } catch {
      return []
    }
  }

  /** 용량이 가득 차면 오래된 항목의 썸네일부터 지우고, 그래도 안 되면 개수를 줄여서 재시도한다. */
  function saveDetailHistory(list) {
    try {
      localStorage.setItem(DETAIL_HISTORY_KEY, JSON.stringify(list))
      return list
    } catch {
      const strippedOldFirst = list.map((entry, i) =>
        i >= Math.floor(list.length / 2) ? { ...entry, imageThumb: '' } : entry,
      )
      try {
        localStorage.setItem(DETAIL_HISTORY_KEY, JSON.stringify(strippedOldFirst))
        return strippedOldFirst
      } catch {
        const half = strippedOldFirst.slice(0, Math.max(1, Math.floor(strippedOldFirst.length / 2)))
        try {
          localStorage.setItem(DETAIL_HISTORY_KEY, JSON.stringify(half))
          return half
        } catch {
          return list
        }
      }
    }
  }

  function detailHistoryPreview(text) {
    const t = (text || '').replace(/\s+/g, ' ').trim()
    return t.length > 140 ? `${t.slice(0, 140)}…` : t || '(내용 없음)'
  }

  function formatSavedAt(iso) {
    try {
      const d = new Date(iso)
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    } catch {
      return ''
    }
  }

  function renderDetailHistory() {
    if (!detailHistoryListEl || !detailHistoryWrap) return
    const list = loadDetailHistory()
    detailHistoryWrap.hidden = list.length === 0
    detailHistoryListEl.innerHTML = ''
    list.forEach((entry) => {
      const li = document.createElement('li')
      li.className = 'observe-history-item'
      li.dataset.id = entry.id

      if (entry.imageThumb) {
        const img = document.createElement('img')
        img.className = 'observe-history-thumb'
        img.src = entry.imageThumb
        img.alt = '보관된 그림 미리보기'
        li.appendChild(img)
      } else {
        const placeholder = document.createElement('div')
        placeholder.className = 'observe-history-thumb observe-history-thumb--empty'
        placeholder.textContent = '이미지 없음'
        li.appendChild(placeholder)
      }

      const meta = document.createElement('div')
      meta.className = 'observe-history-meta'
      const dateEl = document.createElement('span')
      dateEl.className = 'observe-history-date'
      dateEl.textContent = formatSavedAt(entry.savedAt)
      const preview = document.createElement('p')
      preview.className = 'observe-history-preview'
      preview.textContent = detailHistoryPreview(entry.detailText)
      meta.appendChild(dateEl)
      meta.appendChild(preview)
      li.appendChild(meta)

      const actions = document.createElement('div')
      actions.className = 'observe-history-actions'
      const loadBtn = document.createElement('button')
      loadBtn.type = 'button'
      loadBtn.className = 'ai-help-btn'
      loadBtn.textContent = '불러오기'
      loadBtn.addEventListener('click', () => {
        if (observationEl) observationEl.value = entry.observation || observationEl.value
        state.detailText = entry.detailText || ''
        if (detailEl) detailEl.value = state.detailText
        if (detailWrap) detailWrap.hidden = false
        if (entry.imageThumb) setImageDataUrl(entry.imageThumb)
        saveLocal(true)
        setStatus(statusEl, '보관함에서 불러왔어요. (그림은 저장 당시의 축소본입니다)', false)
        detailWrap?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      const copyEntryBtn = document.createElement('button')
      copyEntryBtn.type = 'button'
      copyEntryBtn.className = 'ai-help-btn'
      copyEntryBtn.textContent = '복사'
      copyEntryBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(entry.detailText || '')
          setStatus(statusEl, '복사했어요.', false)
        } catch {
          setStatus(statusEl, '복사 실패', true)
        }
      })
      const studioBtn = document.createElement('button')
      studioBtn.type = 'button'
      studioBtn.className = 'ai-help-btn'
      studioBtn.textContent = '스튜디오로'
      studioBtn.addEventListener('click', () => sendDetailToStudio(entry.detailText))

      const deleteBtn = document.createElement('button')
      deleteBtn.type = 'button'
      deleteBtn.className = 'review-panel__secondary'
      deleteBtn.textContent = '삭제'
      deleteBtn.addEventListener('click', () => {
        const next = loadDetailHistory().filter((e) => e.id !== entry.id)
        saveDetailHistory(next)
        renderDetailHistory()
      })
      actions.appendChild(loadBtn)
      actions.appendChild(copyEntryBtn)
      actions.appendChild(studioBtn)
      actions.appendChild(deleteBtn)
      li.appendChild(actions)

      detailHistoryListEl.appendChild(li)
    })
  }

  async function addDetailHistoryEntry({ observation, detailText, grade, imageDataUrl }) {
    let imageThumb = ''
    if (imageDataUrl) {
      try {
        imageThumb = await shrinkDataUrl(imageDataUrl, DETAIL_HISTORY_THUMB_DIM, DETAIL_HISTORY_THUMB_QUALITY)
      } catch {
        imageThumb = ''
      }
    }
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: new Date().toISOString(),
      grade: grade || '',
      observation: observation || '',
      detailText: detailText || '',
      imageThumb,
    }
    const next = [entry, ...loadDetailHistory()].slice(0, DETAIL_HISTORY_MAX)
    saveDetailHistory(next)
    renderDetailHistory()
  }

  detailHistoryClearBtn?.addEventListener('click', () => {
    if (!window.confirm('보관함의 모든 상세본을 지울까요?')) return
    saveDetailHistory([])
    renderDetailHistory()
  })

  /** 상세본 전체 텍스트에서 "이미지 생성용 통합 프롬프트" 섹션만 뽑아낸다(없으면 전체 텍스트로 대체). */
  function extractStudioPrompt(text) {
    const raw = text || ''
    const match = raw.match(/###\s*이미지 생성용 통합 프롬프트\s*\n([\s\S]*)/)
    const picked = match ? match[1] : raw
    return picked.replace(/^\(.*?\)\s*\n?/, '').trim()
  }

  /** 상세본 프롬프트를 일러스트 스튜디오의 "캐릭터/컨셉 설명" 칸에 넣고 그 탭으로 이동시킨다. */
  /** 글자 수 제한에 걸리면 단어·문장 중간이 아니라 마지막 문장(또는 최소한 단어) 경계에서 자른다. */
  function truncateAtBoundary(text, maxChars) {
    if (text.length <= maxChars) return { text, truncated: false }
    const slice = text.slice(0, maxChars)
    // 뒤쪽 40% 구간에서 마지막 문장 종결부호(. ! ?)를 찾아 그 지점까지만 사용
    const searchStart = Math.floor(maxChars * 0.6)
    const tail = slice.slice(searchStart)
    const sentenceEnds = [...tail.matchAll(/[.!?](?=\s|$)/g)]
    if (sentenceEnds.length) {
      const last = sentenceEnds[sentenceEnds.length - 1]
      const cutAt = searchStart + last.index + 1
      return { text: slice.slice(0, cutAt).trim(), truncated: true }
    }
    // 문장 경계가 없으면 최소한 단어 중간은 피해서 마지막 공백에서 자른다
    const lastSpace = slice.lastIndexOf(' ')
    if (lastSpace > maxChars * 0.5) {
      return { text: slice.slice(0, lastSpace).trim(), truncated: true }
    }
    return { text: slice.trim(), truncated: true }
  }

  function sendDetailToStudio(text) {
    const prompt = extractStudioPrompt(text)
    if (!prompt) {
      setStatus(statusEl, '보낼 상세본 내용이 없어요.', true)
      return
    }
    const admin = typeof isAdminUser === 'function' && isAdminUser()
    // 그림 상세본 원고 자체가 3000자 미만으로 나오도록 바뀌었으니, 캐릭터/컨셉 설명 칸에도
    // 그 전체 분량을 그대로 반영한다. 실제 이미지 생성 모델에 넣기 직전에는 compileSdxlTagPrompt가
    // 한 번 더 자동으로 ~70단어 태그로 압축하므로, 여기서 미리 짧게 자를 필요는 없다.
    // 단, 서버 쪽 description 길이 한도는 관리자만 3000자이고 일반 사용자는 여전히 1200자이므로
    // (generate.ts의 maxDescriptionChars와 맞춤) 여기서도 그 기준을 그대로 따른다.
    const maxChars = admin ? 3000 : 1200
    const { text: finalPrompt, truncated } = truncateAtBoundary(prompt, maxChars)

    // 그림 상세본은 실사 인물 사진을 정밀 묘사한 글이라, "자유(동화 일러스트)" 모드의 장면 해석기로
    // 보내면 동물/의인화 캐릭터용 파서가 이목구비 위주로 잘못 읽어 뷰티 클로즈업처럼 엉뚱하게 나온다.
    // 관리자는 실사 화보용 「관리자전용(실사)」 모드로 보내야 원본 구도·조명이 그대로 반영된다.
    if (typeof setAppArea === 'function') setAppArea(admin ? 'admin' : 'studio')
    const descriptionEl = document.getElementById('description')
    if (descriptionEl) {
      descriptionEl.value = finalPrompt
      window.setTimeout(() => {
        descriptionEl.focus()
        descriptionEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    }
    if (typeof setFormStatus === 'function') {
      const modeNote = admin ? ' (관리자 페이지·실사 모드로 이동했어요)' : ''
      setFormStatus(
        truncated
          ? `그림 상세본을 불러왔어요(글자 수 제한 · 최대 ${maxChars}자 — 문장이 끊기지 않게 뒷부분 일부만 줄였어요)${modeNote}. 확인 후 「이미지 생성」을 눌러 주세요.`
          : `그림 상세본을 불러왔어요${modeNote}. 확인 후 「이미지 생성」을 눌러 주세요.`,
        false,
      )
    }
  }

  sendToStudioBtn?.addEventListener('click', () => sendDetailToStudio(state.detailText))

  function authReady() {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      if (typeof showPinGate === 'function') showPinGate('로그인이 필요해요.')
      return false
    }
    return true
  }

  function headers() {
    return typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' }
  }

  function errMsg(code) {
    const map = {
      observe_too_short: '그림을 올리거나, 관찰문을 조금 더 적어 주세요.',
      observe_image_invalid: '그림 데이터를 읽지 못했어요. 다시 올려 주세요.',
      observe_model_answer_needs_source: '모범답안을 만들려면 그림을 올리거나 관찰문에 무엇이 보이는지 적어 주세요.',
      observe_tidy_needs_text: '정리할 관찰문 내용을 먼저 적어 주세요.',
      observe_questions_needs_source: '그림을 올리거나, 관찰문을 조금 적어 주세요.',
      observe_detail_needs_source: '상세본을 만들려면 그림을 올리거나 관찰문에 무엇이 보이는지 적어 주세요.',
    }
    if (map[code]) return map[code]
    return typeof authErrorMessage === 'function' ? authErrorMessage(code) : `오류: ${code}`
  }

  async function runCritique() {
    if (!authReady()) return
    critiqueBtn.disabled = true
    setStatus(statusEl, '관찰문을 읽고 있어요…', false)
    try {
      const response = await fetch('/api/desk', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          desk: 'observe',
          phase: 'critique',
          observation: observationEl?.value || '',
          grade: gradeEl?.value || '',
          imageDataUrl: state.imageDataUrl || '',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        if (typeof clearAllAuth === 'function') clearAllAuth()
        if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
        return
      }
      if (!response.ok || !data.ok) {
        setStatus(statusEl, errMsg(data.error), true)
        return
      }
      state.critiqueText = data.text || ''
      if (critiqueEl) critiqueEl.textContent = state.critiqueText
      if (critiqueWrap) critiqueWrap.hidden = false
      saveLocal(true)
      if (data.source === 'heuristic') {
        setStatus(statusEl, `엔진 응답 실패로 임시본입니다 [원인: ${data.debugError || 'unknown'}]`, true)
      } else if (data.debugError && state.imageDataUrl) {
        setStatus(statusEl, `코칭 완료 — 다만 그림 분석은 실패해서 텍스트만으로 코칭했어요.${engineLabel(data)}`, false)
      } else {
        setStatus(statusEl, `코칭 완료${engineLabel(data)}`, false)
      }
      critiqueWrap?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      setStatus(statusEl, '네트워크 오류가 났어요.', true)
    } finally {
      critiqueBtn.disabled = false
    }
  }

  async function runModelAnswer() {
    if (!authReady()) return
    modelAnswerBtn.disabled = true
    setStatus(statusEl, 'AI가 모범답안을 쓰고 있어요…', false)
    try {
      const response = await fetch('/api/desk', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          desk: 'observe',
          phase: 'model-answer',
          observation: observationEl?.value || '',
          grade: gradeEl?.value || '',
          imageDataUrl: state.imageDataUrl || '',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        if (typeof clearAllAuth === 'function') clearAllAuth()
        if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
        return
      }
      if (!response.ok || !data.ok) {
        setStatus(statusEl, errMsg(data.error), true)
        return
      }
      state.modelAnswerText = data.text || ''
      if (modelAnswerEl) modelAnswerEl.textContent = state.modelAnswerText
      if (modelAnswerWrap) modelAnswerWrap.hidden = false
      saveLocal(true)
      if (data.source === 'heuristic') {
        setStatus(statusEl, `엔진 응답 실패로 임시본입니다 [원인: ${data.debugError || 'unknown'}]`, true)
      } else if (data.debugError && state.imageDataUrl) {
        setStatus(statusEl, `모범답안 완료 — 다만 그림 분석은 실패해서 메모만으로 썼어요.${engineLabel(data)}`, false)
      } else {
        setStatus(statusEl, `모범답안 완료${engineLabel(data)}`, false)
      }
      modelAnswerWrap?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      setStatus(statusEl, '네트워크 오류가 났어요.', true)
    } finally {
      modelAnswerBtn.disabled = false
    }
  }

  function setTidyStatus(message, isError) {
    if (!tidyStatusEl) return
    tidyStatusEl.hidden = !message
    tidyStatusEl.textContent = message || ''
    tidyStatusEl.className = isError ? 'form__hint form__hint--error' : 'form__hint'
  }

  /** 태그 입력창처럼: 타이핑을 멈추면(디바운스) 별도 버튼 없이 바로 문장으로 다듬어 그 자리에 반영한다. */
  async function runAutoTidy() {
    const raw = observationEl?.value || ''
    const trimmed = raw.trim()
    if (!authReady() || state.autoTidyRunning) return
    if (trimmed.length < AUTO_TIDY_MIN_CHARS) return
    if (trimmed === state.autoTidyBaseline.trim()) return // 이미 정리된 값과 같으면 재요청 안 함

    const myToken = ++state.autoTidyToken
    state.autoTidyRunning = true
    setTidyStatus('문장으로 정리하는 중…', false)
    try {
      const response = await fetch('/api/desk', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          desk: 'observe',
          phase: 'tidy',
          observation: raw,
          imageDataUrl: state.imageDataUrl || '',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (myToken !== state.autoTidyToken) return // 그 사이 사용자가 더 입력해서 최신 요청이 아니게 됨 — 버림
      if (response.status === 401) {
        if (typeof clearAllAuth === 'function') clearAllAuth()
        if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
        return
      }
      if (!response.ok || !data.ok) {
        setTidyStatus(errMsg(data.error), true)
        return
      }
      const tidied = (data.text || '').trim()
      if (tidied && observationEl) {
        observationEl.value = tidied
        state.autoTidyBaseline = tidied
        saveLocal(true)
      }
      if (data.source === 'heuristic') {
        setTidyStatus(`엔진 응답 실패로 원문 그대로 두었어요 [원인: ${data.debugError || 'unknown'}]`, true)
      } else {
        setTidyStatus(`문장으로 정리했어요${engineLabel(data)}`, false)
        window.setTimeout(() => {
          if (tidyStatusEl && tidyStatusEl.textContent.startsWith('문장으로 정리했어요')) setTidyStatus('', false)
        }, 3000)
      }
    } catch {
      if (myToken === state.autoTidyToken) setTidyStatus('네트워크 오류로 자동 정리를 못했어요.', true)
    } finally {
      if (myToken === state.autoTidyToken) state.autoTidyRunning = false
    }
  }

  function scheduleAutoTidy() {
    if (state.autoTidyTimer) window.clearTimeout(state.autoTidyTimer)
    state.autoTidyTimer = window.setTimeout(() => runAutoTidy(), AUTO_TIDY_DEBOUNCE_MS)
  }

  async function runQuestions() {
    if (!authReady()) return
    questionsBtn.disabled = true
    setStatus(statusEl, 'AI가 질문을 만드는 중…', false)
    try {
      const response = await fetch('/api/desk', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          desk: 'observe',
          phase: 'questions',
          observation: observationEl?.value || '',
          grade: gradeEl?.value || '',
          imageDataUrl: state.imageDataUrl || '',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        if (typeof clearAllAuth === 'function') clearAllAuth()
        if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
        return
      }
      if (!response.ok || !data.ok) {
        setStatus(statusEl, errMsg(data.error), true)
        return
      }
      state.questionsText = data.text || ''
      if (questionsEl) questionsEl.textContent = state.questionsText
      if (questionsWrap) questionsWrap.hidden = false
      saveLocal(true)
      if (data.source === 'heuristic') {
        setStatus(statusEl, `엔진 응답 실패로 임시본입니다 [원인: ${data.debugError || 'unknown'}]`, true)
      } else if (data.debugError && state.imageDataUrl) {
        setStatus(statusEl, `질문 완료 — 다만 그림 분석은 실패해서 일반 질문으로 대체했어요.${engineLabel(data)}`, false)
      } else {
        setStatus(statusEl, `질문 완료${engineLabel(data)}`, false)
      }
      questionsWrap?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      setStatus(statusEl, '네트워크 오류가 났어요.', true)
    } finally {
      questionsBtn.disabled = false
    }
  }

  async function runDetail() {
    if (!authReady()) return
    detailBtn.disabled = true
    setStatus(statusEl, 'AI가 그림 상세본을 쓰고 있어요…', false)
    try {
      const response = await fetch('/api/desk', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          desk: 'observe',
          phase: 'detail',
          observation: observationEl?.value || '',
          grade: gradeEl?.value || '',
          imageDataUrl: state.imageDataUrl || '',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        if (typeof clearAllAuth === 'function') clearAllAuth()
        if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
        return
      }
      if (!response.ok || !data.ok) {
        setStatus(statusEl, errMsg(data.error), true)
        return
      }
      state.detailText = data.text || ''
      if (detailEl) detailEl.value = state.detailText
      if (detailWrap) detailWrap.hidden = false
      saveLocal(true)
      if (data.source === 'heuristic') {
        setStatus(statusEl, `엔진 응답 실패로 임시본입니다 [원인: ${data.debugError || 'unknown'}]`, true)
      } else {
        // 실제 AI 응답일 때만 보관함에 새 항목으로 쌓는다 (임시본은 제외).
        addDetailHistoryEntry({
          observation: observationEl?.value || '',
          detailText: state.detailText,
          grade: gradeEl?.value || '',
          imageDataUrl: state.imageDataUrl || '',
        })
        if (data.debugError && state.imageDataUrl) {
          setStatus(statusEl, `상세본 완료 — 다만 그림 분석은 실패해서 메모만으로 썼어요.${engineLabel(data)}`, false)
        } else {
          setStatus(statusEl, `상세본 완료${engineLabel(data)}`, false)
        }
      }
      detailWrap?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      setStatus(statusEl, '네트워크 오류가 났어요.', true)
    } finally {
      detailBtn.disabled = false
    }
  }

  /** 파일 업로드·붙여넣기 공통 처리. */
  async function loadImageFile(file, sourceLabel) {
    if (!file.type.startsWith('image/')) {
      setStatus(imageStatusEl, '이미지 파일만 넣을 수 있어요.', true)
      return
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setStatus(imageStatusEl, `파일이 너무 커요. ${Math.round(IMAGE_MAX_BYTES / (1024 * 1024))}MB 이하로 넣어 주세요.`, true)
      return
    }
    imageLabelEl?.classList.add('ai-help-btn--busy')
    setStatus(imageStatusEl, '그림을 불러오는 중…', false)
    try {
      const dataUrl = await resizeToDataUrl(file, IMAGE_MAX_DIM, IMAGE_JPEG_QUALITY)
      setImageDataUrl(dataUrl)
      saveLocal(true)
      setStatus(imageStatusEl, `${sourceLabel} 그림을 불러왔어요. 이제 관찰문을 써 보세요.`, false)
    } catch {
      setStatus(imageStatusEl, '그림을 읽지 못했어요. 다른 파일로 시도해 주세요.', true)
    } finally {
      imageLabelEl?.classList.remove('ai-help-btn--busy')
    }
  }

  imageInputEl?.addEventListener('change', () => {
    const file = imageInputEl.files?.[0]
    imageInputEl.value = ''
    if (file) loadImageFile(file, '올린')
  })

  imageClearBtn?.addEventListener('click', () => {
    setImageDataUrl('')
    saveLocal(true)
    setStatus(imageStatusEl, '그림을 지웠어요.', false)
  })

  // 키보드 Ctrl+V 없이도, 버튼 클릭만으로 클립보드의 이미지를 직접 읽어온다.
  imagePasteBtn?.addEventListener('click', async () => {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      setStatus(imageStatusEl, '이 브라우저에서는 버튼으로 못 붙여요. 그림을 복사한 뒤 Ctrl+V를 눌러 주세요.', true)
      return
    }
    imagePasteBtn.disabled = true
    setStatus(imageStatusEl, '클립보드에서 그림을 찾는 중…', false)
    try {
      const clipboardItems = await navigator.clipboard.read()
      let file = null
      for (const item of clipboardItems) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (type) {
          const blob = await item.getType(type)
          file = new File([blob], `clipboard-${Date.now()}.png`, { type })
          break
        }
      }
      if (!file) {
        setStatus(imageStatusEl, '클립보드에 그림이 없어요. 이미지를 먼저 복사해 주세요.', true)
        return
      }
      await loadImageFile(file, '붙여넣은')
    } catch {
      setStatus(
        imageStatusEl,
        '클립보드를 읽지 못했어요(권한이 필요할 수 있어요). 이 화면에서 Ctrl+V를 대신 눌러 보세요.',
        true,
      )
    } finally {
      imagePasteBtn.disabled = false
    }
  })

  // 클립보드에 복사한 이미지를 이 패널 어디서든 Ctrl+V로 바로 넣을 수 있게.
  areaEl?.addEventListener('paste', (event) => {
    const items = event.clipboardData?.items
    if (!items) return
    const imageItem = Array.from(items).find((item) => item.type && item.type.startsWith('image/'))
    if (!imageItem) return
    const file = imageItem.getAsFile()
    if (!file) return
    event.preventDefault()
    loadImageFile(file, '붙여넣은')
  })

  useStudioBtn?.addEventListener('click', async () => {
    if (!authReady()) return
    const url =
      (typeof currentResult !== 'undefined' && currentResult?.imageUrl) ||
      document.getElementById('result-image')?.src ||
      ''
    if (!url || url.startsWith('data:,') || !url.trim()) {
      setStatus(statusEl, '스튜디오에 불러온 이미지가 없어요. 먼저 그림을 만들거나 갤러리에서 열어 주세요.', true)
      return
    }
    useStudioBtn.disabled = true
    setStatus(statusEl, '스튜디오 그림을 가져오는 중…', false)
    try {
      let dataUrl = url
      if (!url.startsWith('data:image')) {
        const res = await fetch('/api/media-bytes', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ imageUrl: url }),
        })
        const data = await res.json().catch(() => ({}))
        if (!data.ok || !data.dataUrl) {
          setStatus(statusEl, '스튜디오 그림을 가져오지 못했어요(만료됐을 수 있어요). 갤러리에서 다시 열어 주세요.', true)
          return
        }
        dataUrl = data.dataUrl
      }
      const resBlob = await fetch(dataUrl).then((r) => r.blob())
      const resized = await resizeToDataUrl(resBlob, IMAGE_MAX_DIM, IMAGE_JPEG_QUALITY)
      setImageDataUrl(resized)
      saveLocal(true)
    setStatus(statusEl, '스튜디오 이미지를 넣었어요.', false)
    } catch {
      setStatus(statusEl, '스튜디오 그림을 가져오지 못했어요.', true)
    } finally {
      useStudioBtn.disabled = false
    }
  })

  critiqueBtn?.addEventListener('click', () => runCritique())
  modelAnswerBtn?.addEventListener('click', () => runModelAnswer())
  questionsBtn?.addEventListener('click', () => runQuestions())
  detailBtn?.addEventListener('click', () => runDetail())
  // 상세본을 직접 고칠 수 있게(정책에 걸리는 표현 수정 등) — 수정 즉시 복사·스튜디오 전송·로컬 저장에 반영.
  detailEl?.addEventListener('input', () => {
    state.detailText = detailEl.value
    saveLocal(true)
  })
  observationEl?.addEventListener('input', () => scheduleAutoTidy())
  observationEl?.addEventListener('blur', () => {
    if (state.autoTidyTimer) window.clearTimeout(state.autoTidyTimer)
    runAutoTidy()
  })
  /** 그림·관찰문·코칭 결과·이미지를 모두 비운다. resetGrade가 true면 "대상" 선택도 기본값으로 되돌린다.
   *  (상세본 보관함은 별도 "전체 비우기" 버튼이 있으므로 여기서는 건드리지 않는다.) */
  function resetObserveDesk(resetGrade) {
    if (observationEl) observationEl.value = ''
    if (critiqueEl) critiqueEl.textContent = ''
    if (modelAnswerEl) modelAnswerEl.textContent = ''
    if (questionsEl) questionsEl.textContent = ''
    if (detailEl) detailEl.value = ''
    if (critiqueWrap) critiqueWrap.hidden = true
    if (modelAnswerWrap) modelAnswerWrap.hidden = true
    if (questionsWrap) questionsWrap.hidden = true
    if (detailWrap) detailWrap.hidden = true
    state.critiqueText = ''
    state.modelAnswerText = ''
    state.questionsText = ''
    state.detailText = ''
    state.autoTidyBaseline = ''
    if (state.autoTidyTimer) window.clearTimeout(state.autoTidyTimer)
    setTidyStatus('', false)
    setImageDataUrl('')
    if (resetGrade && gradeEl) {
      const defaultOption = gradeEl.querySelector('option[selected]')
      gradeEl.value = defaultOption ? defaultOption.value : gradeEl.options[0]?.value || ''
    }
    localStorage.removeItem(STORAGE_KEY)
  }

  clearBtn?.addEventListener('click', () => {
    if (!window.confirm('그림·관찰문 입력을 모두 비울까요?')) return
    resetObserveDesk(false)
    setStatus(statusEl, '비웠어요.', false)
  })
  restartBtn?.addEventListener('click', () => {
    if (!window.confirm('그림·관찰문·결과를 모두 비우고 새로 시작할까요?')) return
    resetObserveDesk(true)
    setStatus(statusEl, '새로 시작할 수 있어요. 그림을 올리고 관찰문을 적어 보세요.', false)
    observationEl?.focus()
    areaEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.critiqueText || '')
      setStatus(statusEl, '복사했어요.', false)
    } catch {
      setStatus(statusEl, '복사 실패', true)
    }
  })
  copyModelAnswerBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.modelAnswerText || '')
      setStatus(statusEl, '복사했어요.', false)
    } catch {
      setStatus(statusEl, '복사 실패', true)
    }
  })
  copyQuestionsBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.questionsText || '')
      setStatus(statusEl, '복사했어요.', false)
    } catch {
      setStatus(statusEl, '복사 실패', true)
    }
  })
  copyDetailBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.detailText || '')
      setStatus(statusEl, '복사했어요.', false)
    } catch {
      setStatus(statusEl, '복사 실패', true)
    }
  })
  saveBtn?.addEventListener('click', () => saveLocal(false))
  downloadBtn?.addEventListener('click', () => {
    const blob = new Blob(
      [
        `# 그림관찰과 표현 기록\n대상: ${gradeEl?.value || ''}\n그림 첨부: ${state.imageDataUrl ? '있음' : '없음'}\n\n## 관찰\n${observationEl?.value || ''}\n\n## 코칭\n${state.critiqueText}\n\n## AI 질문\n${state.questionsText}\n\n## AI 모범답안\n${state.modelAnswerText}\n\n## 그림 상세본\n${state.detailText}\n`,
      ],
      { type: 'text/markdown;charset=utf-8' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `observe-express-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  })

  loadLocal()
  renderDetailHistory()
  window.StorymagObserve = { onShow: () => loadLocal() }
})()
