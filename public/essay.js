/**
 * 에세이 아키텍트 데스크
 * 흐름: 초안 → 진단 → (수정·도움) → AI 최종 원고 생성 → 사용자 승인
 */
;(() => {
  const STORAGE_KEY = 'storymagEssayDesk'

  const essayArea = document.getElementById('essay-area')
  const draftEl = document.getElementById('essay-draft')
  const pdfInput = document.getElementById('essay-pdf-input')
  const pdfLabel = document.getElementById('essay-pdf-label')
  const pdfStatusEl = document.getElementById('essay-pdf-status')
  const pdfChunkNavEl = document.getElementById('essay-pdf-chunk-nav')
  const pdfChunkPrevBtn = document.getElementById('essay-pdf-chunk-prev')
  const pdfChunkNextBtn = document.getElementById('essay-pdf-chunk-next')
  const pdfChunkIndicatorEl = document.getElementById('essay-pdf-chunk-indicator')
  const pdfChunkHintEl = document.getElementById('essay-pdf-chunk-hint')
  const audienceEl = document.getElementById('essay-audience')
  const revisionEl = document.getElementById('essay-revision')
  const finalEl = document.getElementById('essay-final')
  const generatedEl = document.getElementById('essay-generated')
  const critiqueEl = document.getElementById('essay-critique')
  const critiqueWrap = document.getElementById('essay-critique-wrap')
  const helpEl = document.getElementById('essay-help')
  const helpWrap = document.getElementById('essay-help-wrap')
  const statusEl = document.getElementById('essay-status')
  const helpStatusEl = document.getElementById('essay-help-status')
  const rewriteStatusEl = document.getElementById('essay-rewrite-status')
  const helpCountEl = document.getElementById('essay-help-count')
  const approveBadge = document.getElementById('essay-approve-badge')
  const critiqueBtn = document.getElementById('essay-critique-button')
  const helpBtn = document.getElementById('essay-help-button')
  const rewriteBtn = document.getElementById('essay-rewrite-button')
  const approveBtn = document.getElementById('essay-approve-button')
  const unapproveBtn = document.getElementById('essay-unapprove-button')
  const copyGeneratedBtn = document.getElementById('essay-copy-generated')
  const clearBtn = document.getElementById('essay-clear-button')
  const copyBtn = document.getElementById('essay-copy-critique')
  const saveBtn = document.getElementById('essay-save-local')
  const downloadBtn = document.getElementById('essay-download')

  const state = {
    stage: /** @type {'revision' | 'final'} */ ('revision'),
    helpCount: 0,
    critiqueText: '',
    approved: false,
    approvedAt: '',
  }

  function setStatus(el, message, isError) {
    if (!el) return
    el.hidden = !message
    el.textContent = message || ''
    el.classList.toggle('form__status--error', Boolean(isError))
  }

  function syncHelpCount() {
    if (helpCountEl) helpCountEl.textContent = `도움 요청 ${state.helpCount}회`
  }

  function syncApproveUi() {
    const hasGenerated = Boolean((generatedEl?.value || '').trim())
    if (approveBtn) approveBtn.disabled = !hasGenerated || state.approved
    if (unapproveBtn) unapproveBtn.hidden = !state.approved
    if (approveBadge) {
      approveBadge.hidden = !hasGenerated && !state.approved
      approveBadge.textContent = state.approved ? '승인됨' : '미승인'
      approveBadge.classList.toggle('essay-approve-badge--ok', state.approved)
    }
    if (finalEl) {
      finalEl.readOnly = true
      finalEl.classList.toggle('essay-textarea--approved', state.approved)
    }
    if (generatedEl) {
      generatedEl.readOnly = state.approved
    }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      if (draftEl && data.draft) draftEl.value = data.draft
      if (audienceEl && data.audience) audienceEl.value = data.audience
      if (revisionEl && data.revision) revisionEl.value = data.revision
      if (generatedEl && data.generated) generatedEl.value = data.generated
      if (finalEl && data.final) finalEl.value = data.final
      if (data.critiqueText && critiqueEl && critiqueWrap) {
        state.critiqueText = data.critiqueText
        critiqueEl.textContent = data.critiqueText
        critiqueWrap.hidden = false
      }
      state.helpCount = Number(data.helpCount) || 0
      state.approved = Boolean(data.approved)
      state.approvedAt = data.approvedAt || ''
      syncHelpCount()
      syncApproveUi()
    } catch {
      /* ignore */
    }
  }

  function saveLocal(silent) {
    const payload = {
      draft: draftEl?.value || '',
      audience: audienceEl?.value || '',
      revision: revisionEl?.value || '',
      generated: generatedEl?.value || '',
      final: finalEl?.value || '',
      critiqueText: state.critiqueText,
      helpCount: state.helpCount,
      approved: state.approved,
      approvedAt: state.approvedAt,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    if (!silent) setStatus(rewriteStatusEl || statusEl, '브라우저에 저장했어요.', false)
  }

  function authReady() {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      if (typeof showPinGate === 'function') showPinGate('로그인이 필요해요.')
      return false
    }
    return true
  }

  function headers() {
    if (typeof authHeaders === 'function') return authHeaders()
    return { 'Content-Type': 'application/json' }
  }

  function errMsg(code) {
      const mapped = {
        draft_too_short: '초안이 너무 짧아요. 조금 더 붙여 넣어 주세요.',
        draft_too_long: '원고가 너무 길어요. 1만 2천 자 이하로 나눠 주세요.',
        revision_too_short: '수정 중인 원고가 너무 짧아요.',
        critique_required: '먼저 「수술대에 올리기」로 진단을 받은 뒤 최종 원고를 생성할 수 있어요.',
      }
    if (mapped[code]) return mapped[code]
    if (typeof authErrorMessage === 'function') return authErrorMessage(code)
    return `오류: ${code || 'unknown'}`
  }

  const PDF_MAX_BYTES = 15 * 1024 * 1024 // 15MB — 양이 많지 않은 PDF만 지원
  const PDF_MAX_PAGES = 400 // 글자 추출은 가벼워서 전체 문서를 다 읽고, 넘치는 분량은 조각으로 나눈다
  const PDF_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.js'
  const OCR_LANGS = 'kor+eng'
  const OCR_MIN_TEXT_LEN = 6 // 이보다 짧으면 텍스트 레이어가 없다고 보고 OCR 시도
  const OCR_MAX_PAGES = 25 // OCR은 페이지당 시간이 걸려서 상한을 둔다
  const OCR_SCALE = 2.2 // 인식률을 위해 확대 렌더링

  let ocrWorkerPromise = null
  let pdfChunks = []
  let pdfChunkIndex = 0
  let pdfSourceName = ''

  /** 긴 텍스트를 문단(빈 줄) → 문장 → 공백 경계 순으로 최대한 자연스럽게 끝나도록 maxLen 이하 조각으로 나눈다. */
  function splitTextIntoChunks(text, maxLen) {
    const chunks = []
    let remaining = text.trim()
    while (remaining.length > maxLen) {
      const window = remaining.slice(0, maxLen)
      let cut = window.lastIndexOf('\n\n')
      if (cut < maxLen * 0.4) cut = window.lastIndexOf('. ')
      if (cut < maxLen * 0.4) cut = window.lastIndexOf(' ')
      if (cut < maxLen * 0.2) cut = maxLen
      chunks.push(remaining.slice(0, cut).trim())
      remaining = remaining.slice(cut).trim()
    }
    if (remaining) chunks.push(remaining)
    return chunks.length ? chunks : ['']
  }

  function updateChunkNavUi() {
    const multi = pdfChunks.length > 1
    if (pdfChunkNavEl) pdfChunkNavEl.hidden = !multi
    if (pdfChunkHintEl) pdfChunkHintEl.hidden = !multi
    if (!multi) return
    if (pdfChunkIndicatorEl) pdfChunkIndicatorEl.textContent = `${pdfChunkIndex + 1} / ${pdfChunks.length} 조각`
    if (pdfChunkPrevBtn) pdfChunkPrevBtn.disabled = pdfChunkIndex === 0
    if (pdfChunkNextBtn) pdfChunkNextBtn.disabled = pdfChunkIndex === pdfChunks.length - 1
  }

  function loadChunkIntoDraft(idx, { appendMode = false } = {}) {
    if (!draftEl || !pdfChunks[idx]) return
    const chunkText = pdfChunks[idx]
    draftEl.value = appendMode ? `${draftEl.value.trim()}\n\n${chunkText}`.trim() : chunkText
    draftEl.dispatchEvent(new Event('input', { bubbles: true }))
    pdfChunkIndex = idx
    updateChunkNavUi()
    const multiInfo = pdfChunks.length > 1 ? ` · ${idx + 1}/${pdfChunks.length}번째 조각을 초안에 넣었어요.` : ''
    setStatus(pdfStatusEl, `${pdfSourceName}${multiInfo}`, false)
    saveLocal(true)
  }

  pdfChunkPrevBtn?.addEventListener('click', () => {
    if (pdfChunkIndex > 0) loadChunkIntoDraft(pdfChunkIndex - 1)
  })
  pdfChunkNextBtn?.addEventListener('click', () => {
    if (pdfChunkIndex < pdfChunks.length - 1) loadChunkIntoDraft(pdfChunkIndex + 1)
  })

  function getOcrWorker() {
    if (!window.Tesseract) return Promise.reject(new Error('tesseract_missing'))
    if (!ocrWorkerPromise) {
      ocrWorkerPromise = window.Tesseract.createWorker(OCR_LANGS)
    }
    return ocrWorkerPromise
  }

  async function terminateOcrWorker() {
    if (!ocrWorkerPromise) return
    const pending = ocrWorkerPromise
    ocrWorkerPromise = null
    try {
      const worker = await pending
      await worker.terminate()
    } catch {
      /* ignore */
    }
  }

  async function ocrPage(page) {
    const viewport = page.getViewport({ scale: OCR_SCALE })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
    const worker = await getOcrWorker()
    const { data } = await worker.recognize(canvas)
    return (data?.text || '').replace(/[ \t]+/g, ' ').trim()
  }

  async function extractPdfText(file, onProgress) {
    const pdfjsLib = window.pdfjsLib
    if (!pdfjsLib) throw new Error('pdfjs_missing')
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC
    }
    const buffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
    const readPages = Math.min(pdf.numPages, PDF_MAX_PAGES)
    const chunks = []
    let ocrPages = 0
    let ocrSkipped = 0
    for (let i = 1; i <= readPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      let pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .trim()

      if (pageText.length < OCR_MIN_TEXT_LEN) {
        if (ocrPages < OCR_MAX_PAGES) {
          onProgress?.(`OCR로 스캔 페이지를 읽는 중… (${i}/${readPages}쪽)`)
          try {
            pageText = await ocrPage(page)
            ocrPages += 1
          } catch {
            pageText = ''
          }
        } else {
          ocrSkipped += 1
          pageText = ''
        }
      } else {
        onProgress?.(`글자를 읽는 중… (${i}/${readPages}쪽)`)
      }
      if (pageText) chunks.push(pageText)
    }
    return { text: chunks.join('\n\n'), totalPages: pdf.numPages, readPages, ocrPages, ocrSkipped }
  }

  async function handlePdfUpload(file) {
    if (!file) return
    const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    if (!looksLikePdf) {
      setStatus(pdfStatusEl, 'PDF 파일만 올릴 수 있어요.', true)
      return
    }
    if (file.size > PDF_MAX_BYTES) {
      setStatus(pdfStatusEl, `파일이 너무 커요. ${Math.round(PDF_MAX_BYTES / (1024 * 1024))}MB 이하 · 양이 많지 않은 PDF만 지원해요.`, true)
      return
    }

    let appendMode = false
    if (draftEl && draftEl.value.trim()) {
      appendMode = !window.confirm(
        '초안에 이미 내용이 있어요.\n\n확인 → PDF 텍스트로 덮어쓰기\n취소 → 기존 내용 뒤에 이어붙이기',
      )
    }

    if (pdfInput) pdfInput.disabled = true
    if (pdfLabel) pdfLabel.classList.add('ai-help-btn--busy')
    setStatus(pdfStatusEl, 'PDF를 여는 중…', false)
    try {
      const { text, totalPages, readPages, ocrPages, ocrSkipped } = await extractPdfText(
        file,
        (msg) => setStatus(pdfStatusEl, msg, false),
      )
      if (!text) {
        pdfChunks = []
        updateChunkNavUi()
        setStatus(
          pdfStatusEl,
          '텍스트를 찾지 못했어요. OCR로도 글자를 인식하지 못한 스캔본이에요(사진 품질이 낮거나 손글씨일 수 있어요).',
          true,
        )
        return
      }
      if (draftEl) {
        const combined = appendMode ? `${draftEl.value.trim()}\n\n${text}`.trim() : text
        const maxLen = Number(draftEl.getAttribute('maxlength')) || 12000
        pdfChunks = splitTextIntoChunks(combined, Math.max(1000, maxLen - 200))
        const pageInfo =
          totalPages > readPages ? `${readPages}/${totalPages}쪽(상한으로 뒷부분 제외)` : `${totalPages}쪽`
        const ocrInfo = ocrPages > 0 ? ` · OCR ${ocrPages}쪽 인식` : ''
        const skipInfo = ocrSkipped > 0 ? ` · OCR 상한(${OCR_MAX_PAGES}쪽) 초과로 ${ocrSkipped}쪽 건너뜀` : ''
        const chunkInfo =
          pdfChunks.length > 1
            ? ` · 글이 길어서 ${maxLen.toLocaleString('ko-KR')}자 단위로 ${pdfChunks.length}조각으로 나눴어요`
            : ' 불러왔어요'
        pdfSourceName = `${file.name} · ${pageInfo}${ocrInfo}${skipInfo}${chunkInfo}`
        loadChunkIntoDraft(0)
      }
      saveLocal(true)
    } catch (err) {
      const isWorkerIssue = err && (err.message === 'pdfjs_missing' || err.message === 'tesseract_missing')
      setStatus(
        pdfStatusEl,
        isWorkerIssue
          ? 'PDF/OCR 라이브러리를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.'
          : '이 PDF에서 글자를 읽지 못했어요. 파일이 손상됐거나 암호가 걸려 있을 수 있어요.',
        true,
      )
    } finally {
      if (pdfInput) pdfInput.disabled = false
      if (pdfLabel) pdfLabel.classList.remove('ai-help-btn--busy')
      terminateOcrWorker()
    }
  }

  pdfInput?.addEventListener('change', () => {
    const file = pdfInput.files && pdfInput.files[0]
    handlePdfUpload(file).finally(() => {
      pdfInput.value = ''
    })
  })

  async function runCritique() {
    const draft = (draftEl?.value || '').trim()
    if (!draft) {
      setStatus(statusEl, '초안을 입력해 주세요.', true)
      return
    }
    if (!authReady()) return

    critiqueBtn.disabled = true
    setStatus(statusEl, '수술대 준비 중… 편집장이 해체하고 있습니다.', false)
    try {
      const response = await fetch('/api/essay', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          phase: 'critique',
          draft,
          audience: audienceEl?.value || '',
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
      if (!revisionEl?.value.trim() && draftEl) {
        revisionEl.value = draftEl.value
      }
      saveLocal(true)
      setStatus(
        statusEl,
        data.debugError ? `${data.message || '진단 완료.'} [원인: ${data.debugError}]` : data.message || '진단 완료.',
        Boolean(data.debugError),
      )
      critiqueWrap?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      syncRewriteGate()
    } catch {
      setStatus(statusEl, '네트워크 오류가 났어요.', true)
    } finally {
      critiqueBtn.disabled = false
    }
  }

  async function runHelp() {
    const revision = (revisionEl?.value || '').trim()
    if (!revision) {
      setStatus(helpStatusEl, '수정 중인 원고를 입력해 주세요.', true)
      return
    }
    if (!authReady()) return

    helpBtn.disabled = true
    setStatus(helpStatusEl, '짧게 점검하는 중…', false)
    try {
      const response = await fetch('/api/essay', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          phase: 'help',
          draft: draftEl?.value || '',
          revision,
          audience: audienceEl?.value || '',
          stage: state.stage,
          critiqueExcerpt: state.critiqueText.slice(0, 1200),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        if (typeof clearAllAuth === 'function') clearAllAuth()
        if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
        return
      }
      if (!response.ok || !data.ok) {
        setStatus(helpStatusEl, errMsg(data.error), true)
        return
      }
      state.helpCount += 1
      syncHelpCount()
      if (helpEl) helpEl.textContent = data.text || ''
      if (helpWrap) helpWrap.hidden = false
      saveLocal(true)
      setStatus(
        helpStatusEl,
        data.debugError ? `${data.message || '점검 완료.'} [원인: ${data.debugError}]` : data.message || '점검 완료.',
        Boolean(data.debugError),
      )
    } catch {
      setStatus(helpStatusEl, '네트워크 오류가 났어요.', true)
    } finally {
      helpBtn.disabled = false
    }
  }

  function syncRewriteGate() {
    const ready = state.critiqueText.trim().length >= 40
    if (rewriteBtn) {
      rewriteBtn.disabled = !ready
      rewriteBtn.title = ready
        ? 'Claude로 최종 원고를 통째로 생성합니다'
        : '먼저 수술대 진단이 필요합니다'
    }
  }

  async function runRewrite() {
    const draft = (draftEl?.value || '').trim()
    const revision = (revisionEl?.value || '').trim()
    if (!draft && !revision) {
      setStatus(rewriteStatusEl, '초안 또는 수정고가 필요해요.', true)
      return
    }
    if (state.critiqueText.trim().length < 40) {
      setStatus(rewriteStatusEl, errMsg('critique_required'), true)
      syncRewriteGate()
      return
    }
    if (!authReady()) return
    if (state.approved) {
      if (!window.confirm('이미 승인된 원고가 있어요. 새로 생성하면 승인 상태가 풀립니다. 계속할까요?')) {
        return
      }
      state.approved = false
      state.approvedAt = ''
    }

    rewriteBtn.disabled = true
    setStatus(rewriteStatusEl, 'Claude가 최종 원고를 통째로 쓰는 중…', false)
    try {
      const response = await fetch('/api/essay', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          phase: 'rewrite',
          draft: draft || revision,
          revision,
          audience: audienceEl?.value || '',
          critiqueExcerpt: state.critiqueText.slice(0, 2000),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        if (typeof clearAllAuth === 'function') clearAllAuth()
        if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
        return
      }
      if (!response.ok || !data.ok) {
        setStatus(rewriteStatusEl, errMsg(data.error), true)
        return
      }
      if (generatedEl) generatedEl.value = data.text || ''
      state.approved = false
      state.approvedAt = ''
      syncApproveUi()
      saveLocal(true)
      setStatus(
        rewriteStatusEl,
        data.debugError
          ? `${data.message || '생성 완료.'} [원인: ${data.debugError}]`
          : data.message || '생성 완료. 검토 후 승인하세요.',
        Boolean(data.debugError),
      )
      generatedEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch {
      setStatus(rewriteStatusEl, '네트워크 오류가 났어요.', true)
    } finally {
      syncRewriteGate()
    }
  }

  function approveManuscript() {
    const text = (generatedEl?.value || '').trim()
    if (!text) {
      setStatus(rewriteStatusEl, '승인할 원고가 없어요. 먼저 생성해 주세요.', true)
      return
    }
    if (!window.confirm('이 원고를 최종본으로 승인할까요?')) return
    state.approved = true
    state.approvedAt = new Date().toISOString()
    if (finalEl) finalEl.value = text
    syncApproveUi()
    saveLocal(true)
    setStatus(
      rewriteStatusEl,
      `승인했습니다. (${new Date(state.approvedAt).toLocaleString('ko-KR')})`,
      false,
    )
  }

  function unapproveManuscript() {
    if (!window.confirm('승인을 취소하고 다시 손볼까요?')) return
    state.approved = false
    state.approvedAt = ''
    syncApproveUi()
    saveLocal(true)
    setStatus(rewriteStatusEl, '승인을 취소했어요. 수정 후 다시 승인할 수 있어요.', false)
  }

  function downloadRecord() {
    const lines = [
      '# Storymag 에세이 아키텍트 기록',
      `저장 시각: ${new Date().toLocaleString('ko-KR')}`,
      `타겟 독자: ${(audienceEl?.value || '').trim() || '일반 성인 에세이 독자'}`,
      `수정 중 AI 도움 요청: 총 ${state.helpCount}회`,
      `최종 승인: ${state.approved ? `예 (${state.approvedAt || ''})` : '아니오(미승인)'}`,
      '',
      '## 초안',
      draftEl?.value || '',
      '',
      '## 편집장 진단',
      state.critiqueText || '(없음)',
      '',
      '## 수정/작업 원고',
      revisionEl?.value || '',
      '',
      '## AI 생성 최종 원고(검토본)',
      generatedEl?.value || '(없음)',
      '',
      '## 승인된 최종 원고',
      finalEl?.value || '(미승인)',
      '',
      '## 마지막 온디맨드 점검',
      helpEl?.textContent || '(없음)',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `essay-architect-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  critiqueBtn?.addEventListener('click', () => runCritique())
  helpBtn?.addEventListener('click', () => runHelp())
  rewriteBtn?.addEventListener('click', () => runRewrite())
  approveBtn?.addEventListener('click', () => approveManuscript())
  unapproveBtn?.addEventListener('click', () => unapproveManuscript())
  generatedEl?.addEventListener('input', () => {
    if (state.approved) {
      state.approved = false
      state.approvedAt = ''
    }
    syncApproveUi()
  })
  copyGeneratedBtn?.addEventListener('click', async () => {
    const text = generatedEl?.value || ''
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      setStatus(rewriteStatusEl, '생성된 원고를 복사했어요.', false)
    } catch {
      setStatus(rewriteStatusEl, '복사에 실패했어요.', true)
    }
  })
  clearBtn?.addEventListener('click', () => {
    if (!window.confirm('초안·진단·수정·생성·승인 입력을 모두 비울까요? (로컬 저장도 지워집니다)')) {
      return
    }
    ;[draftEl, audienceEl, revisionEl, finalEl, generatedEl].forEach((el) => {
      if (el) el.value = ''
    })
    if (critiqueEl) critiqueEl.textContent = ''
    if (helpEl) helpEl.textContent = ''
    if (critiqueWrap) critiqueWrap.hidden = true
    if (helpWrap) helpWrap.hidden = true
    state.critiqueText = ''
    state.helpCount = 0
    state.approved = false
    state.approvedAt = ''
    syncHelpCount()
    syncApproveUi()
    syncRewriteGate()
    localStorage.removeItem(STORAGE_KEY)
    setStatus(statusEl, '비웠어요.', false)
    setStatus(helpStatusEl, '', false)
    setStatus(rewriteStatusEl, '', false)
  })
  copyBtn?.addEventListener('click', async () => {
    const text = state.critiqueText || critiqueEl?.textContent || ''
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setStatus(statusEl, '진단 결과를 복사했어요.', false)
    } catch {
      setStatus(statusEl, '복사에 실패했어요.', true)
    }
  })
  saveBtn?.addEventListener('click', () => saveLocal(false))
  downloadBtn?.addEventListener('click', downloadRecord)

  loadLocal()
  syncHelpCount()
  syncApproveUi()
  syncRewriteGate()

  window.StorymagEssay = {
    isActive: () => essayArea && !essayArea.hidden,
    onShow: () => {
      loadLocal()
      syncRewriteGate()
    },
  }
})()
