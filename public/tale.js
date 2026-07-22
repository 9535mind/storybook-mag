/** AI 동화 편집 데스크 */
;(() => {
  const STORAGE_KEY = 'storymagTaleDesk'
  const draftEl = document.getElementById('tale-draft')
  const gradeEl = document.getElementById('tale-grade')
  const revisionEl = document.getElementById('tale-revision')
  const finalEl = document.getElementById('tale-final')
  const critiqueEl = document.getElementById('tale-critique')
  const critiqueWrap = document.getElementById('tale-critique-wrap')
  const helpEl = document.getElementById('tale-help')
  const helpWrap = document.getElementById('tale-help-wrap')
  const statusEl = document.getElementById('tale-status')
  const helpStatusEl = document.getElementById('tale-help-status')
  const helpCountEl = document.getElementById('tale-help-count')
  const critiqueBtn = document.getElementById('tale-critique-button')
  const helpBtn = document.getElementById('tale-help-button')
  const clearBtn = document.getElementById('tale-clear-button')
  const copyBtn = document.getElementById('tale-copy-critique')
  const saveBtn = document.getElementById('tale-save-local')
  const downloadBtn = document.getElementById('tale-download')

  const state = { helpCount: 0, critiqueText: '' }

  function setStatus(el, message, isError) {
    if (!el) return
    el.hidden = !message
    el.textContent = message || ''
    el.classList.toggle('form__status--error', Boolean(isError))
  }

  /** 어떤 엔진이 실제로 응답했는지 짧게 표시 (Claude 실패 시 대체 엔진으로 조용히 넘어가는 걸 눈에 보이게). */
  function engineLabel(data) {
    if (data?.source === 'workers-ai') return ' [대체 엔진: Cloudflare Workers AI/Llama]'
    if (data?.source === 'claude' && data?.debugError) return ` [엔진: Claude · ${data.debugError}]`
    if (data?.source === 'claude') return ` [엔진: Claude${data.model ? ` (${data.model})` : ''}]`
    return ''
  }

  function syncHelpCount() {
    if (helpCountEl) helpCountEl.textContent = `도움 요청 ${state.helpCount}회`
  }

  function loadLocal() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (!data) return
      if (draftEl && data.draft) draftEl.value = data.draft
      if (gradeEl && data.grade) gradeEl.value = data.grade
      if (revisionEl && data.revision) revisionEl.value = data.revision
      if (finalEl && data.final) finalEl.value = data.final
      if (data.critiqueText && critiqueEl && critiqueWrap) {
        state.critiqueText = data.critiqueText
        critiqueEl.textContent = data.critiqueText
        critiqueWrap.hidden = false
      }
      state.helpCount = Number(data.helpCount) || 0
      syncHelpCount()
    } catch {
      /* ignore */
    }
  }

  function saveLocal(silent) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        draft: draftEl?.value || '',
        grade: gradeEl?.value || '',
        revision: revisionEl?.value || '',
        final: finalEl?.value || '',
        critiqueText: state.critiqueText,
        helpCount: state.helpCount,
        savedAt: new Date().toISOString(),
      }),
    )
    if (!silent) setStatus(statusEl, '브라우저에 저장했어요.', false)
  }

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
      draft_too_short: '동화 초안이 너무 짧아요.',
      draft_too_long: '원고가 너무 길어요.',
      revision_too_short: '수정 중인 원고가 너무 짧아요.',
    }
    if (map[code]) return map[code]
    return typeof authErrorMessage === 'function' ? authErrorMessage(code) : `오류: ${code}`
  }

  async function runCritique() {
    const draft = (draftEl?.value || '').trim()
    if (!draft) {
      setStatus(statusEl, '동화 초안을 입력해 주세요.', true)
      return
    }
    if (!authReady()) return
    critiqueBtn.disabled = true
    setStatus(statusEl, '동화 편집장이 읽는 중…', false)
    try {
      const response = await fetch('/api/desk', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          desk: 'tale',
          phase: 'critique',
          draft,
          grade: gradeEl?.value || '',
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
      if (revisionEl && !revisionEl.value.trim()) revisionEl.value = draftEl.value
      saveLocal(true)
      setStatus(
        statusEl,
        data.source === 'heuristic'
          ? `엔진 응답 실패로 임시본입니다 [원인: ${data.debugError || 'unknown'}]`
          : `편집 완료${engineLabel(data)}`,
        data.source === 'heuristic',
      )
      critiqueWrap?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      setStatus(statusEl, '네트워크 오류가 났어요.', true)
    } finally {
      critiqueBtn.disabled = false
    }
  }

  async function runHelp() {
    const revision = (revisionEl?.value || '').trim()
    if (!revision) {
      setStatus(helpStatusEl, '수정 중인 동화를 입력해 주세요.', true)
      return
    }
    if (!authReady()) return
    helpBtn.disabled = true
    setStatus(helpStatusEl, '짧게 점검 중…', false)
    try {
      const response = await fetch('/api/desk', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          desk: 'tale',
          phase: 'help',
          draft: draftEl?.value || '',
          revision,
          grade: gradeEl?.value || '',
        }),
      })
      const data = await response.json().catch(() => ({}))
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
        data.source === 'heuristic'
          ? `엔진 응답 실패로 임시본입니다 [원인: ${data.debugError || 'unknown'}]`
          : `점검 완료${engineLabel(data)}. 본 편집 기록에는 안 쌓여요.`,
        data.source === 'heuristic',
      )
    } catch {
      setStatus(helpStatusEl, '네트워크 오류가 났어요.', true)
    } finally {
      helpBtn.disabled = false
    }
  }

  critiqueBtn?.addEventListener('click', () => runCritique())
  helpBtn?.addEventListener('click', () => runHelp())
  clearBtn?.addEventListener('click', () => {
    if (!window.confirm('동화 입력을 모두 비울까요?')) return
    ;[draftEl, revisionEl, finalEl].forEach((el) => {
      if (el) el.value = ''
    })
    if (critiqueEl) critiqueEl.textContent = ''
    if (helpEl) helpEl.textContent = ''
    if (critiqueWrap) critiqueWrap.hidden = true
    if (helpWrap) helpWrap.hidden = true
    state.critiqueText = ''
    state.helpCount = 0
    syncHelpCount()
    localStorage.removeItem(STORAGE_KEY)
    setStatus(statusEl, '비웠어요.', false)
  })
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.critiqueText || '')
      setStatus(statusEl, '복사했어요.', false)
    } catch {
      setStatus(statusEl, '복사 실패', true)
    }
  })
  saveBtn?.addEventListener('click', () => saveLocal(false))
  downloadBtn?.addEventListener('click', () => {
    const blob = new Blob(
      [
        `# AI 동화 편집 기록\n학년: ${gradeEl?.value || ''}\n도움 요청: ${state.helpCount}회\n\n## 초안\n${draftEl?.value || ''}\n\n## 편집\n${state.critiqueText}\n\n## 수정고\n${revisionEl?.value || ''}\n\n## 최종\n${finalEl?.value || ''}\n`,
      ],
      { type: 'text/markdown;charset=utf-8' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tale-edit-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  })

  loadLocal()
  syncHelpCount()

  // ---- 그림 편집 (1단계: 불러오기·리사이즈·이동·회전 / 2단계: 마스크·컷아웃·배경 흐리기) ----
  // 서버/AI를 거치지 않는 순수 캔버스 편집 — 실존 인물 오탐·정책 차단 위험이 없다.
  // (AI 자동 배경 인식만 예외적으로 브라우저 내에서 세그멘테이션 모델을 돌리며, 서버로는 아무것도 전송하지 않는다.)
  const imgInput = document.getElementById('tale-img-input')
  const imgStatusEl = document.getElementById('tale-img-status')
  const imgWrap = document.getElementById('tale-img-wrap')
  const imgCanvas = document.getElementById('tale-img-canvas')
  const imgToolHint = document.getElementById('tale-img-tool-hint')
  const scaleRange = document.getElementById('tale-img-scale')
  const rotateRange = document.getElementById('tale-img-rotate')
  const brightnessRange = document.getElementById('tale-img-brightness')
  const saturationRange = document.getElementById('tale-img-saturation')
  const rotateLeftBtn = document.getElementById('tale-img-rotate-left')
  const rotateRightBtn = document.getElementById('tale-img-rotate-right')
  const imgResetBtn = document.getElementById('tale-img-reset')
  const imgDownloadBtn = document.getElementById('tale-img-download')
  const modeMoveBtn = document.getElementById('tale-img-mode-move')
  const modeMaskBtn = document.getElementById('tale-img-mode-mask')
  const modeEraseBtn = document.getElementById('tale-img-mode-erase')
  const brushRange = document.getElementById('tale-img-brush')
  const maskVisibleCheckbox = document.getElementById('tale-img-mask-visible')
  const blurRange = document.getElementById('tale-img-blur')
  const maskClearBtn = document.getElementById('tale-img-mask-clear')
  const cutoutApplyBtn = document.getElementById('tale-img-cutout-apply')
  const blurApplyBtn = document.getElementById('tale-img-blur-apply')
  const restoreOriginalBtn = document.getElementById('tale-img-restore-original')
  const autoBgBtn = document.getElementById('tale-img-autobg')
  const maskStatusEl = document.getElementById('tale-img-mask-status')
  const ctx2d = imgCanvas?.getContext('2d')

  const IMG_MAX_BYTES = 15 * 1024 * 1024
  const imgState = { img: null, originalImg: null, fitScale: 1, scale: 1, x: 0, y: 0, rotation: 0, hasMask: false }

  // 마스크는 화면에 보이는 캔버스와 동일한 크기의 별도 오프스크린 캔버스에 그린다.
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = imgCanvas ? imgCanvas.width : 900
  maskCanvas.height = imgCanvas ? imgCanvas.height : 900
  const maskCtx = maskCanvas.getContext('2d')

  let editMode = 'move' // 'move' | 'mask' | 'erase'
  let brushSize = Number(brushRange?.value) || 40
  let blurPx = Number(blurRange?.value) || 12
  let brightness = Number(brightnessRange?.value) || 100
  let saturation = Number(saturationRange?.value) || 100
  let maskVisible = maskVisibleCheckbox ? maskVisibleCheckbox.checked : true
  let dragging = false
  let dragStart = { x: 0, y: 0, imgX: 0, imgY: 0 }
  let lastPaintPos = null

  function normalizeAngle(deg) {
    let d = deg % 360
    if (d > 180) d -= 360
    if (d < -180) d += 360
    return d
  }

  function drawCheckerboard(ctx, w, h) {
    const size = 20
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        ctx.fillStyle = (Math.round(x / size) + Math.round(y / size)) % 2 === 0 ? '#2a2233' : '#211c2b'
        ctx.fillRect(x, y, size, size)
      }
    }
  }

  /**
   * imgState의 현재 변환(위치·회전·확대)을 그대로 적용해 임의의 이미지를 ctx에 그린다.
   * opts.colorFilter가 true면 명도/채도 조정을 함께 적용한다(마스크 등 색상 없는 소스에는 적용하지 않음).
   * ctx에 이미 다른 filter(예: 블러)가 설정돼 있으면 이어붙여서 함께 적용한다.
   */
  function drawTransformedOnto(ctx, sourceImage, opts = {}) {
    if (!imgCanvas) return
    const w = imgCanvas.width
    const h = imgCanvas.height
    const scale = imgState.fitScale * imgState.scale
    const dw = sourceImage.naturalWidth * scale
    const dh = sourceImage.naturalHeight * scale
    ctx.save()
    if (opts.colorFilter) {
      const existing = ctx.filter && ctx.filter !== 'none' ? `${ctx.filter} ` : ''
      ctx.filter = `${existing}brightness(${brightness}%) saturate(${saturation}%)`
    }
    ctx.translate(w / 2 + imgState.x, h / 2 + imgState.y)
    ctx.rotate((imgState.rotation * Math.PI) / 180)
    ctx.drawImage(sourceImage, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()
  }

  function drawMaskTintOverlay() {
    if (!ctx2d || !imgCanvas) return
    const w = imgCanvas.width
    const h = imgCanvas.height
    const tint = document.createElement('canvas')
    tint.width = w
    tint.height = h
    const tintCtx = tint.getContext('2d')
    tintCtx.fillStyle = 'rgb(180, 120, 255)'
    tintCtx.fillRect(0, 0, w, h)
    tintCtx.globalCompositeOperation = 'destination-in'
    tintCtx.drawImage(maskCanvas, 0, 0)
    ctx2d.save()
    ctx2d.globalAlpha = 0.5
    ctx2d.drawImage(tint, 0, 0)
    ctx2d.restore()
  }

  function drawImageStage() {
    if (!ctx2d || !imgCanvas) return
    const w = imgCanvas.width
    const h = imgCanvas.height
    ctx2d.clearRect(0, 0, w, h)
    drawCheckerboard(ctx2d, w, h)
    if (!imgState.img) return
    drawTransformedOnto(ctx2d, imgState.img, { colorFilter: true })
    if (maskVisible && imgState.hasMask) drawMaskTintOverlay()
  }

  function resetImageTransform() {
    if (!imgState.img || !imgCanvas) return
    const iw = imgState.img.naturalWidth
    const ih = imgState.img.naturalHeight
    imgState.fitScale = Math.min(imgCanvas.width / iw, imgCanvas.height / ih) * 0.9
    imgState.scale = 1
    imgState.x = 0
    imgState.y = 0
    imgState.rotation = 0
    brightness = 100
    saturation = 100
    if (scaleRange) scaleRange.value = '100'
    if (rotateRange) rotateRange.value = '0'
    if (brightnessRange) brightnessRange.value = '100'
    if (saturationRange) saturationRange.value = '100'
    drawImageStage()
  }

  function clearMask(silent) {
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
    imgState.hasMask = false
    drawImageStage()
    if (!silent) setStatus(maskStatusEl, '마스크를 초기화했어요.', false)
  }

  function loadImageIntoEditor(file, { keepAsOriginal = true } = {}) {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      imgState.img = image
      if (keepAsOriginal) imgState.originalImg = image
      if (imgWrap) imgWrap.hidden = false
      clearMask(true)
      resetImageTransform()
      setStatus(imgStatusEl, `불러왔어요 (${image.naturalWidth}×${image.naturalHeight}px)`, false)
      URL.revokeObjectURL(objectUrl)
    }
    image.onerror = () => {
      setStatus(imgStatusEl, '이미지를 읽을 수 없어요. 다른 파일로 시도해 주세요.', true)
      URL.revokeObjectURL(objectUrl)
    }
    image.src = objectUrl
  }

  imgInput?.addEventListener('change', () => {
    const file = imgInput.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setStatus(imgStatusEl, '이미지 파일만 올릴 수 있어요.', true)
      return
    }
    if (file.size > IMG_MAX_BYTES) {
      setStatus(imgStatusEl, '파일이 너무 커요. 15MB 이하로 올려 주세요.', true)
      return
    }
    loadImageIntoEditor(file)
  })

  scaleRange?.addEventListener('input', () => {
    imgState.scale = Number(scaleRange.value) / 100
    drawImageStage()
  })

  rotateRange?.addEventListener('input', () => {
    imgState.rotation = Number(rotateRange.value)
    drawImageStage()
  })

  brightnessRange?.addEventListener('input', () => {
    brightness = Number(brightnessRange.value) || 100
    drawImageStage()
  })

  saturationRange?.addEventListener('input', () => {
    saturation = Number(saturationRange.value) || 100
    drawImageStage()
  })

  rotateLeftBtn?.addEventListener('click', () => {
    if (!imgState.img) return
    imgState.rotation = normalizeAngle(imgState.rotation - 90)
    if (rotateRange) rotateRange.value = String(imgState.rotation)
    drawImageStage()
  })

  rotateRightBtn?.addEventListener('click', () => {
    if (!imgState.img) return
    imgState.rotation = normalizeAngle(imgState.rotation + 90)
    if (rotateRange) rotateRange.value = String(imgState.rotation)
    drawImageStage()
  })

  imgResetBtn?.addEventListener('click', () => {
    if (!imgState.img) return
    resetImageTransform()
    setStatus(imgStatusEl, '위치·크기·회전·명도·채도를 초기화했어요.', false)
  })

  /** 체커보드 없이 이미지(+마스크로 잘려나간 투명 영역)만 깨끗하게 렌더링 — 다운로드/타 모듈 전달용. */
  function renderCleanSnapshot() {
    const out = document.createElement('canvas')
    out.width = imgCanvas.width
    out.height = imgCanvas.height
    if (imgState.img) drawTransformedOnto(out.getContext('2d'), imgState.img, { colorFilter: true })
    return out
  }

  imgDownloadBtn?.addEventListener('click', () => {
    if (!imgState.img || !imgCanvas) {
      setStatus(imgStatusEl, '먼저 그림을 불러오세요.', true)
      return
    }
    renderCleanSnapshot().toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tale-image-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  })

  // ---- 편집 도구 모드 (이동 / 마스크 그리기 / 마스크 지우개) ----
  const modeButtons = [modeMoveBtn, modeMaskBtn, modeEraseBtn]
  const MODE_HINTS = {
    move: '캔버스 위에서 그림을 드래그하면 위치를 옮길 수 있어요. (마우스·터치 모두 지원)',
    mask: '붓으로 남길 부분(예: 인물)을 칠하세요. 칠한 부분만 컷아웃되거나 선명하게 유지돼요.',
    erase: '붓으로 마스크를 지울 수 있어요.',
  }

  function setEditMode(mode) {
    editMode = mode
    modeButtons.forEach((btn) => {
      if (btn) btn.classList.toggle('tale-img-tool--active', btn.dataset.mode === mode)
    })
    if (imgToolHint) imgToolHint.textContent = MODE_HINTS[mode] || MODE_HINTS.move
  }

  modeMoveBtn?.addEventListener('click', () => setEditMode('move'))
  modeMaskBtn?.addEventListener('click', () => setEditMode('mask'))
  modeEraseBtn?.addEventListener('click', () => setEditMode('erase'))

  brushRange?.addEventListener('input', () => {
    brushSize = Number(brushRange.value) || 40
  })

  blurRange?.addEventListener('input', () => {
    blurPx = Number(blurRange.value) || 12
  })

  maskVisibleCheckbox?.addEventListener('change', () => {
    maskVisible = Boolean(maskVisibleCheckbox.checked)
    drawImageStage()
  })

  maskClearBtn?.addEventListener('click', () => clearMask(false))

  // ---- 포인터(마우스·터치) 처리: 모드에 따라 이동 또는 마스크 페인팅 ----
  function pointerPos(event) {
    const rect = imgCanvas.getBoundingClientRect()
    const point = event.touches?.[0] || event.changedTouches?.[0] || event
    const scaleX = imgCanvas.width / rect.width
    const scaleY = imgCanvas.height / rect.height
    return { x: (point.clientX - rect.left) * scaleX, y: (point.clientY - rect.top) * scaleY }
  }

  function paintMaskStroke(from, to, erase) {
    const dist = Math.hypot(to.x - from.x, to.y - from.y)
    const steps = Math.max(1, Math.ceil(dist / 4))
    maskCtx.save()
    maskCtx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
    maskCtx.fillStyle = '#ffffff'
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = from.x + (to.x - from.x) * t
      const y = from.y + (to.y - from.y) * t
      maskCtx.beginPath()
      maskCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
      maskCtx.fill()
    }
    maskCtx.restore()
    if (!erase) imgState.hasMask = true
  }

  function startDrag(event) {
    if (!imgState.img) return
    dragging = true
    const pos = pointerPos(event)
    if (editMode === 'move') {
      dragStart = { x: pos.x, y: pos.y, imgX: imgState.x, imgY: imgState.y }
    } else {
      lastPaintPos = pos
      paintMaskStroke(pos, pos, editMode === 'erase')
      drawImageStage()
    }
  }

  function moveDrag(event) {
    if (!dragging) return
    event.preventDefault()
    const pos = pointerPos(event)
    if (editMode === 'move') {
      imgState.x = dragStart.imgX + (pos.x - dragStart.x)
      imgState.y = dragStart.imgY + (pos.y - dragStart.y)
    } else {
      paintMaskStroke(lastPaintPos || pos, pos, editMode === 'erase')
      lastPaintPos = pos
    }
    drawImageStage()
  }

  function endDrag() {
    dragging = false
    lastPaintPos = null
  }

  imgCanvas?.addEventListener('mousedown', startDrag)
  window.addEventListener('mousemove', moveDrag)
  window.addEventListener('mouseup', endDrag)
  imgCanvas?.addEventListener('touchstart', startDrag, { passive: true })
  imgCanvas?.addEventListener('touchmove', moveDrag, { passive: false })
  imgCanvas?.addEventListener('touchend', endDrag)

  // ---- 마스크 적용: 투명 배경 컷아웃 / 배경만 흐리게 ----
  function applyResultCanvasAsWorkingImage(canvas, message) {
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const image = new Image()
      image.onload = () => {
        imgState.img = image
        imgState.fitScale = 1
        imgState.scale = 1
        imgState.x = 0
        imgState.y = 0
        imgState.rotation = 0
        brightness = 100
        saturation = 100
        if (scaleRange) scaleRange.value = '100'
        if (rotateRange) rotateRange.value = '0'
        if (brightnessRange) brightnessRange.value = '100'
        if (saturationRange) saturationRange.value = '100'
        drawImageStage()
        setStatus(maskStatusEl, message, false)
        URL.revokeObjectURL(url)
      }
      image.src = url
    }, 'image/png')
  }

  cutoutApplyBtn?.addEventListener('click', () => {
    if (!imgState.img || !imgCanvas) {
      setStatus(maskStatusEl, '먼저 그림을 불러오세요.', true)
      return
    }
    if (!imgState.hasMask) {
      setStatus(maskStatusEl, '먼저 「마스크 그리기」로 남길 부분을 칠해 주세요.', true)
      return
    }
    const out = document.createElement('canvas')
    out.width = imgCanvas.width
    out.height = imgCanvas.height
    const octx = out.getContext('2d')
    drawTransformedOnto(octx, imgState.img, { colorFilter: true })
    octx.globalCompositeOperation = 'destination-in'
    octx.drawImage(maskCanvas, 0, 0)
    applyResultCanvasAsWorkingImage(out, '마스크 밖은 투명하게 잘라냈어요. 「PNG로 내보내기」로 저장할 수 있어요.')
  })

  blurApplyBtn?.addEventListener('click', () => {
    if (!imgState.img || !imgCanvas) {
      setStatus(maskStatusEl, '먼저 그림을 불러오세요.', true)
      return
    }
    if (!imgState.hasMask) {
      setStatus(maskStatusEl, '먼저 「마스크 그리기」로 선명하게 남길 부분을 칠해 주세요.', true)
      return
    }
    const out = document.createElement('canvas')
    out.width = imgCanvas.width
    out.height = imgCanvas.height
    const octx = out.getContext('2d')
    octx.filter = `blur(${blurPx}px)`
    drawTransformedOnto(octx, imgState.img, { colorFilter: true })
    octx.filter = 'none'

    const sharp = document.createElement('canvas')
    sharp.width = out.width
    sharp.height = out.height
    const sctx = sharp.getContext('2d')
    drawTransformedOnto(sctx, imgState.img, { colorFilter: true })
    sctx.globalCompositeOperation = 'destination-in'
    sctx.drawImage(maskCanvas, 0, 0)

    octx.drawImage(sharp, 0, 0)
    applyResultCanvasAsWorkingImage(out, '마스크로 남긴 부분은 선명하게, 배경은 흐리게 처리했어요.')
  })

  restoreOriginalBtn?.addEventListener('click', () => {
    if (!imgState.originalImg) {
      setStatus(maskStatusEl, '되돌릴 원본이 없어요.', true)
      return
    }
    imgState.img = imgState.originalImg
    resetImageTransform()
    clearMask(true)
    setStatus(maskStatusEl, '원본 이미지로 되돌렸어요. (마스크도 함께 초기화됐어요)', false)
  })

  // ---- 4단계(선택): AI 자동 배경 인식 — 클릭 시에만 라이브러리를 불러와 브라우저 안에서만 실행 ----
  // 서버로 이미지를 전송하지 않는 세그멘테이션(전경/배경 분류) 모델이라 실존 인물 정책 차단과 무관하다.
  function imageToPngBlob(image) {
    return new Promise((resolve, reject) => {
      try {
        const c = document.createElement('canvas')
        c.width = image.naturalWidth
        c.height = image.naturalHeight
        const cx = c.getContext('2d')
        cx.drawImage(image, 0, 0)
        c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('blob_failed'))), 'image/png')
      } catch (err) {
        reject(err)
      }
    })
  }

  autoBgBtn?.addEventListener('click', async () => {
    if (!imgState.img) {
      setStatus(maskStatusEl, '먼저 그림을 불러오세요.', true)
      return
    }
    autoBgBtn.disabled = true
    autoBgBtn.classList.add('ai-help-btn--busy')
    setStatus(maskStatusEl, 'AI가 배경을 인식하는 중… (처음 한 번은 모델을 내려받아 다소 걸려요)', false)
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal/+esm')
      const removeBackground = mod.removeBackground || mod.default
      const sourceBlob = await imageToPngBlob(imgState.img)
      const maskBlob = await removeBackground(sourceBlob, { output: { type: 'mask' } })
      const maskUrl = URL.createObjectURL(maskBlob)
      const maskImage = new Image()
      await new Promise((resolve, reject) => {
        maskImage.onload = resolve
        maskImage.onerror = () => reject(new Error('mask_image_load_failed'))
        maskImage.src = maskUrl
      })
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
      drawTransformedOnto(maskCtx, maskImage)
      imgState.hasMask = true
      URL.revokeObjectURL(maskUrl)
      maskVisible = true
      if (maskVisibleCheckbox) maskVisibleCheckbox.checked = true
      drawImageStage()
      setStatus(maskStatusEl, 'AI가 인식한 영역을 마스크에 반영했어요. 붓으로 다듬은 뒤 적용해 보세요.', false)
    } catch (err) {
      setStatus(
        maskStatusEl,
        'AI 배경 인식에 실패했어요 (네트워크 상태 확인, 또는 「마스크 그리기」로 직접 칠해 주세요).',
        true,
      )
    } finally {
      autoBgBtn.disabled = false
      autoBgBtn.classList.remove('ai-help-btn--busy')
    }
  })

  drawImageStage()

  // 페이지 조판(3단계)이 체커보드 없이 깨끗한 PNG를 가져다 쓸 수 있게 노출.
  window.StorymagTaleImage = {
    hasImage: () => Boolean(imgState.img),
    getDataUrl: () => (imgState.img ? renderCleanSnapshot().toDataURL('image/png') : null),
  }

  // ---- 이어지는 장면 만들기 (레퍼런스 이미지 기반 AI 생성) ----
  // 이미 그린 장면(들)을 참고 이미지로 넣어, 같은 캐릭터·화풍을 유지한 새 장면을 생성한다.
  const sceneRefsEl = document.getElementById('tale-scene-refs')
  const sceneRefInput = document.getElementById('tale-scene-ref-input')
  const sceneRefFromEditorBtn = document.getElementById('tale-scene-ref-from-editor')
  const sceneRefClearBtn = document.getElementById('tale-scene-ref-clear')
  const sceneDescEl = document.getElementById('tale-scene-desc')
  const sceneGenerateBtn = document.getElementById('tale-scene-generate')
  const sceneStatusEl = document.getElementById('tale-scene-status')
  const sceneResultWrap = document.getElementById('tale-scene-result-wrap')
  const sceneResultImg = document.getElementById('tale-scene-result-img')
  const sceneUseBtn = document.getElementById('tale-scene-use')

  const SCENE_MAX_REFS = 6
  const SCENE_MAX_FILE_BYTES = 15 * 1024 * 1024
  let sceneRefs = []
  let sceneResultDataUrl = null

  function renderSceneRefs() {
    if (!sceneRefsEl) return
    sceneRefsEl.innerHTML = ''
    sceneRefs.forEach((dataUrl, idx) => {
      const thumb = document.createElement('div')
      thumb.className = 'tale-scene-ref-thumb'
      const img = document.createElement('img')
      img.src = dataUrl
      img.alt = `참고 이미지 ${idx + 1}`
      const removeBtn = document.createElement('button')
      removeBtn.type = 'button'
      removeBtn.className = 'tale-scene-ref-remove'
      removeBtn.setAttribute('aria-label', '참고 이미지 삭제')
      removeBtn.textContent = '×'
      removeBtn.addEventListener('click', () => {
        sceneRefs.splice(idx, 1)
        renderSceneRefs()
      })
      thumb.appendChild(img)
      thumb.appendChild(removeBtn)
      sceneRefsEl.appendChild(thumb)
    })
  }

  function addSceneRef(dataUrl) {
    if (sceneRefs.length >= SCENE_MAX_REFS) {
      setStatus(sceneStatusEl, `참고 이미지는 최대 ${SCENE_MAX_REFS}장까지 넣을 수 있어요.`, true)
      return
    }
    sceneRefs.push(dataUrl)
    renderSceneRefs()
  }

  sceneRefInput?.addEventListener('change', () => {
    const files = Array.from(sceneRefInput.files || [])
    sceneRefInput.value = ''
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      if (file.size > SCENE_MAX_FILE_BYTES) {
        setStatus(sceneStatusEl, '파일이 너무 커요. 15MB 이하로 올려 주세요.', true)
        continue
      }
      const reader = new FileReader()
      reader.onload = () => addSceneRef(String(reader.result))
      reader.readAsDataURL(file)
    }
  })

  sceneRefFromEditorBtn?.addEventListener('click', () => {
    if (!imgState.img) {
      setStatus(sceneStatusEl, '먼저 위에서 그림을 불러오세요.', true)
      return
    }
    addSceneRef(renderCleanSnapshot().toDataURL('image/png'))
  })

  sceneRefClearBtn?.addEventListener('click', () => {
    sceneRefs = []
    renderSceneRefs()
  })

  function sceneErrMsg(code) {
    const map = {
      reference_image_required: '참고 이미지를 1장 이상 넣어 주세요.',
      too_many_reference_images: '참고 이미지가 너무 많아요. 개수를 줄여 주세요.',
      description_required: '어떤 장면을 그릴지 설명해 주세요.',
      description_too_long: '설명이 너무 길어요. 800자 이내로 줄여 주세요.',
      content_policy_blocked: '이 설명은 정책상 그릴 수 없어요. 표현을 바꿔 다시 시도해 주세요.',
      provider_content_blocked: '이미지 엔진이 이 장면을 안전 필터로 거절했어요. 설명을 조금 바꿔 다시 시도해 주세요.',
      reference_image_too_large: '참고 이미지 중 하나가 너무 커요. 더 작은 파일로 시도해 주세요.',
      fal_key_not_configured: '이미지 생성 엔진이 아직 설정되지 않았어요.',
    }
    if (map[code]) return map[code]
    return typeof authErrorMessage === 'function' ? authErrorMessage(code) : `오류: ${code || 'unknown'}`
  }

  sceneGenerateBtn?.addEventListener('click', async () => {
    const description = (sceneDescEl?.value || '').trim()
    if (sceneRefs.length === 0) {
      setStatus(sceneStatusEl, '참고 이미지를 1장 이상 넣어 주세요.', true)
      return
    }
    if (description.length < 4) {
      setStatus(sceneStatusEl, '어떤 장면을 그릴지 설명해 주세요.', true)
      return
    }
    if (!authReady()) return
    sceneGenerateBtn.disabled = true
    if (sceneResultWrap) sceneResultWrap.hidden = true
    sceneResultDataUrl = null
    setStatus(
      sceneStatusEl,
      `참고 이미지 ${sceneRefs.length}장을 바탕으로 새 장면을 그리는 중… (다소 걸릴 수 있어요)`,
      false,
    )
    try {
      const response = await fetch('/api/tale-scene', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ images: sceneRefs, description }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        if (typeof clearAllAuth === 'function') clearAllAuth()
        if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
        return
      }
      if (!response.ok || !data.ok || !data.imageUrl) {
        setStatus(sceneStatusEl, sceneErrMsg(data.error), true)
        return
      }
      setStatus(sceneStatusEl, '결과 이미지를 저장하는 중…', false)
      const bytesRes = await fetch('/api/media-bytes', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ imageUrl: data.imageUrl }),
      })
      const bytesData = await bytesRes.json().catch(() => ({}))
      if (!bytesData.ok || !bytesData.dataUrl) {
        setStatus(sceneStatusEl, '이미지는 생성됐지만 저장에 실패했어요. 다시 시도해 주세요.', true)
        return
      }
      sceneResultDataUrl = bytesData.dataUrl
      if (sceneResultImg) sceneResultImg.src = sceneResultDataUrl
      if (sceneResultWrap) sceneResultWrap.hidden = false
      setStatus(sceneStatusEl, '새 장면을 만들었어요. 마음에 들면 아래에서 그림 편집으로 불러오세요.', false)
    } catch {
      setStatus(sceneStatusEl, '네트워크 오류가 났어요.', true)
    } finally {
      sceneGenerateBtn.disabled = false
    }
  })

  sceneUseBtn?.addEventListener('click', () => {
    if (!sceneResultDataUrl) return
    const image = new Image()
    image.onload = () => {
      imgState.img = image
      imgState.originalImg = image
      if (imgWrap) imgWrap.hidden = false
      clearMask(true)
      resetImageTransform()
      setStatus(imgStatusEl, '새로 만든 장면을 그림 편집에 불러왔어요.', false)
      imgWrap?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    image.src = sceneResultDataUrl
  })

  window.StorymagTale = { onShow: () => loadLocal() }
})()
