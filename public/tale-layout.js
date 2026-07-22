/** AI 동화 편집 · 페이지 조판(3단계) — 그림+텍스트 레이어를 페이지에 배치하고 PNG/PDF로 내보낸다. */
;(() => {
  const STORAGE_KEY = 'storymagTaleLayout'
  const canvas = document.getElementById('layout-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const CANVAS_W = canvas.width
  const CANVAS_H = canvas.height
  const HANDLE_R = 12

  const pageIndicator = document.getElementById('layout-page-indicator')
  const prevBtn = document.getElementById('layout-page-prev')
  const nextBtn = document.getElementById('layout-page-next')
  const addPageBtn = document.getElementById('layout-page-add')
  const deletePageBtn = document.getElementById('layout-page-delete')
  const addImageFromEditorBtn = document.getElementById('layout-add-image-from-editor')
  const imageInput = document.getElementById('layout-image-input')
  const addTextBtn = document.getElementById('layout-add-text')
  const templateTopBottomBtn = document.getElementById('layout-template-top-bottom')
  const templateFullbleedBtn = document.getElementById('layout-template-fullbleed')
  const templateSplitBtn = document.getElementById('layout-template-split')
  const templateSpreadCheckbox = document.getElementById('layout-template-spread')
  const inspector = document.getElementById('layout-inspector')
  const textFields = document.getElementById('layout-text-fields')
  const textContentEl = document.getElementById('layout-text-content')
  const textSizeRange = document.getElementById('layout-text-size')
  const textLineHeightRange = document.getElementById('layout-text-line-height')
  const textParagraphGapRange = document.getElementById('layout-text-paragraph-gap')
  const textColorInput = document.getElementById('layout-text-color')
  const alignButtons = Array.from(document.querySelectorAll('#layout-text-fields [data-align]'))
  const layerFrontBtn = document.getElementById('layout-layer-front')
  const layerBackBtn = document.getElementById('layout-layer-back')
  const layerDeleteBtn = document.getElementById('layout-layer-delete')
  const exportPagePngBtn = document.getElementById('layout-export-page-png')
  const exportPdfBtn = document.getElementById('layout-export-pdf')
  const aiSplitBtn = document.getElementById('layout-ai-split')
  const statusEl = document.getElementById('layout-status')

  function setStatus(message, isError) {
    if (!statusEl) return
    statusEl.hidden = !message
    statusEl.textContent = message || ''
    statusEl.classList.toggle('form__status--error', Boolean(isError))
  }

  // ---- 데이터 모델 ----
  // layer(image): { id, type:'image', x, y, w, h, src(dataURL), imgEl }
  // layer(text):  { id, type:'text', x, y, w, h, text, fontSize, color, align, backdrop }
  let pages = [{ layers: [] }]
  let pageIndex = 0
  let selectedLayerId = null
  let nextLayerId = 1
  let dragState = null

  const DEFAULT_LINE_HEIGHT = 1.35
  const DEFAULT_PARAGRAPH_GAP = 8
  const AUTO_FIT_MIN_FONT = 10
  const LINE_ASCENT_RATIO = 0.78
  const BIG_MARKUP_MULT = 1.4
  const SMALL_MARKUP_MULT = 0.75

  function currentPage() {
    return pages[pageIndex]
  }

  function getSelectedLayer() {
    return currentPage().layers.find((l) => l.id === selectedLayerId) || null
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v))
  }

  // ---- 렌더링 ----
  /** **크게**(1.4배) / ~작게~(0.75배) 인라인 마크업을 문자 단위 토큰으로 변환. 마크업 기호는 결과에서 제거. */
  function parseInlineMarkup(raw) {
    const tokens = []
    let i = 0
    while (i < raw.length) {
      if (raw[i] === '*' && raw[i + 1] === '*') {
        const end = raw.indexOf('**', i + 2)
        if (end !== -1) {
          for (const ch of raw.slice(i + 2, end)) tokens.push({ ch, mult: BIG_MARKUP_MULT })
          i = end + 2
          continue
        }
      }
      if (raw[i] === '~') {
        const end = raw.indexOf('~', i + 1)
        if (end !== -1) {
          for (const ch of raw.slice(i + 1, end)) tokens.push({ ch, mult: SMALL_MARKUP_MULT })
          i = end + 1
          continue
        }
      }
      tokens.push({ ch: raw[i], mult: 1 })
      i += 1
    }
    return tokens
  }

  function fontString(size) {
    return `${Math.max(1, Math.round(size))}px "Pretendard", "Noto Sans KR", sans-serif`
  }

  function wrapTokensToLines(targetCtx, tokens, maxWidth, baseFontSize) {
    const lines = []
    let current = []
    let currentWidth = 0
    for (const tok of tokens) {
      targetCtx.font = fontString(baseFontSize * tok.mult)
      const chWidth = targetCtx.measureText(tok.ch).width
      if (current.length && currentWidth + chWidth > maxWidth) {
        lines.push(current)
        current = []
        currentWidth = 0
      }
      current.push(tok)
      currentWidth += chWidth
    }
    lines.push(current)
    return lines
  }

  function measureLine(targetCtx, tokens, baseFontSize) {
    let width = 0
    let maxMult = 1
    for (const tok of tokens) {
      targetCtx.font = fontString(baseFontSize * tok.mult)
      width += targetCtx.measureText(tok.ch).width
      if (tok.mult > maxMult) maxMult = tok.mult
    }
    return { width, maxMult }
  }

  /**
   * \n(문단) → 인라인 마크업 → 줄바꿈까지 반영해 레이아웃을 계산한다.
   * 상자 높이보다 글이 길면 최소 크기(10px)까지 기본 글자 크기를 줄여 항상 상자 안에 맞춘다.
   */
  function layoutTextLayer(targetCtx, layer, maxWidth, maxHeight) {
    const lineHeightRatio = layer.lineHeight || DEFAULT_LINE_HEIGHT
    const paragraphGap = layer.paragraphSpacing ?? DEFAULT_PARAGRAPH_GAP
    const rawParagraphs = String(layer.text || '').split('\n')
    const preferredSize = layer.fontSize || 28

    function build(baseFontSize) {
      const perParagraphLines = rawParagraphs.map((raw) => {
        const tokens = parseInlineMarkup(raw)
        return tokens.length ? wrapTokensToLines(targetCtx, tokens, maxWidth, baseFontSize) : [[]]
      })
      const lines = []
      let totalHeight = 0
      perParagraphLines.forEach((paragraphLines, pIdx) => {
        paragraphLines.forEach((tokens) => {
          const { width, maxMult } = measureLine(targetCtx, tokens, baseFontSize)
          const height = baseFontSize * maxMult * lineHeightRatio
          lines.push({ tokens, width, height, ascent: baseFontSize * maxMult * LINE_ASCENT_RATIO })
          totalHeight += height
        })
        if (pIdx < perParagraphLines.length - 1) totalHeight += paragraphGap
      })
      return { lines, totalHeight }
    }

    let fontSize = preferredSize
    let layout = build(fontSize)
    while (layout.totalHeight > maxHeight && fontSize > AUTO_FIT_MIN_FONT) {
      fontSize -= 1
      layout = build(fontSize)
    }
    return { fontSize, lines: layout.lines, totalHeight: layout.totalHeight }
  }

  function drawLayerOn(targetCtx, layer) {
    if (layer.type === 'image') {
      if (layer.imgEl && layer.imgEl.complete) {
        targetCtx.drawImage(layer.imgEl, layer.x, layer.y, layer.w, layer.h)
      }
      return
    }
    targetCtx.save()
    if (layer.backdrop) {
      targetCtx.fillStyle = 'rgba(0, 0, 0, 0.45)'
      targetCtx.fillRect(layer.x, layer.y, layer.w, layer.h)
    }
    targetCtx.fillStyle = layer.color || '#1c1730'
    targetCtx.textBaseline = 'alphabetic'
    const innerPad = 14
    const maxWidth = Math.max(20, layer.w - innerPad * 2)
    const maxHeight = Math.max(20, layer.h - innerPad * 2)
    const { fontSize, lines, totalHeight } = layoutTextLayer(targetCtx, layer, maxWidth, maxHeight)
    const align = layer.align || 'center'
    let y = layer.y + layer.h / 2 - totalHeight / 2
    for (const line of lines) {
      const startX =
        align === 'left'
          ? layer.x + innerPad
          : align === 'right'
            ? layer.x + layer.w - innerPad - line.width
            : layer.x + layer.w / 2 - line.width / 2
      let cx = startX
      const baselineY = y + line.ascent
      for (const tok of line.tokens) {
        targetCtx.font = fontString(fontSize * tok.mult)
        targetCtx.fillText(tok.ch, cx, baselineY)
        cx += targetCtx.measureText(tok.ch).width
      }
      y += line.height
    }
    targetCtx.restore()
  }

  function paintPage(targetCtx, page, w, h) {
    targetCtx.fillStyle = '#ffffff'
    targetCtx.fillRect(0, 0, w, h)
    for (const layer of page.layers) drawLayerOn(targetCtx, layer)
  }

  function render() {
    paintPage(ctx, currentPage(), CANVAS_W, CANVAS_H)
    const selected = getSelectedLayer()
    if (selected) drawSelectionHandles(selected)
    syncPageIndicator()
  }

  function drawSelectionHandles(layer) {
    ctx.save()
    ctx.strokeStyle = '#b478ff'
    ctx.lineWidth = 2
    ctx.setLineDash([7, 5])
    ctx.strokeRect(layer.x, layer.y, layer.w, layer.h)
    ctx.setLineDash([])
    ctx.fillStyle = '#b478ff'
    ctx.beginPath()
    ctx.arc(layer.x + layer.w, layer.y + layer.h, HANDLE_R, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#1c1730'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  }

  function syncPageIndicator() {
    if (pageIndicator) pageIndicator.textContent = `${pageIndex + 1} / ${pages.length} 페이지`
    if (prevBtn) prevBtn.disabled = pageIndex === 0
    if (nextBtn) nextBtn.disabled = pageIndex === pages.length - 1
    if (deletePageBtn) deletePageBtn.disabled = pages.length <= 1
  }

  // ---- 선택/인스펙터 ----
  function selectLayer(id) {
    selectedLayerId = id
    const layer = id ? getSelectedLayer() : null
    if (inspector) inspector.hidden = !layer
    if (layer && layer.type === 'text') {
      if (textFields) textFields.hidden = false
      if (textContentEl) textContentEl.value = layer.text || ''
      if (textSizeRange) textSizeRange.value = String(layer.fontSize || 28)
      if (textLineHeightRange) textLineHeightRange.value = String(layer.lineHeight || DEFAULT_LINE_HEIGHT)
      if (textParagraphGapRange) textParagraphGapRange.value = String(layer.paragraphSpacing ?? DEFAULT_PARAGRAPH_GAP)
      if (textColorInput) textColorInput.value = layer.color && layer.color.startsWith('#') ? layer.color : '#ffffff'
      alignButtons.forEach((btn) =>
        btn.classList.toggle('tale-img-tool--active', btn.dataset.align === (layer.align || 'center')),
      )
    } else if (textFields) {
      textFields.hidden = true
    }
    render()
  }

  textContentEl?.addEventListener('input', () => {
    const layer = getSelectedLayer()
    if (!layer) return
    layer.text = textContentEl.value
    render()
    persist()
  })
  textSizeRange?.addEventListener('input', () => {
    const layer = getSelectedLayer()
    if (!layer) return
    layer.fontSize = Number(textSizeRange.value) || 28
    render()
  })
  textSizeRange?.addEventListener('change', () => persist())
  textLineHeightRange?.addEventListener('input', () => {
    const layer = getSelectedLayer()
    if (!layer) return
    layer.lineHeight = Number(textLineHeightRange.value) || DEFAULT_LINE_HEIGHT
    render()
  })
  textLineHeightRange?.addEventListener('change', () => persist())
  textParagraphGapRange?.addEventListener('input', () => {
    const layer = getSelectedLayer()
    if (!layer) return
    layer.paragraphSpacing = Number(textParagraphGapRange.value)
    render()
  })
  textParagraphGapRange?.addEventListener('change', () => persist())
  textColorInput?.addEventListener('input', () => {
    const layer = getSelectedLayer()
    if (!layer) return
    layer.color = textColorInput.value
    render()
    persist()
  })
  alignButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const layer = getSelectedLayer()
      if (!layer) return
      layer.align = btn.dataset.align
      alignButtons.forEach((b) => b.classList.toggle('tale-img-tool--active', b === btn))
      render()
      persist()
    })
  })

  layerFrontBtn?.addEventListener('click', () => {
    const layers = currentPage().layers
    const idx = layers.findIndex((l) => l.id === selectedLayerId)
    if (idx === -1) return
    const [layer] = layers.splice(idx, 1)
    layers.push(layer)
    render()
    persist()
  })
  layerBackBtn?.addEventListener('click', () => {
    const layers = currentPage().layers
    const idx = layers.findIndex((l) => l.id === selectedLayerId)
    if (idx === -1) return
    const [layer] = layers.splice(idx, 1)
    layers.unshift(layer)
    render()
    persist()
  })
  layerDeleteBtn?.addEventListener('click', () => {
    const layers = currentPage().layers
    const idx = layers.findIndex((l) => l.id === selectedLayerId)
    if (idx === -1) return
    layers.splice(idx, 1)
    selectLayer(null)
    persist()
  })

  // ---- 포인터(마우스·터치): 이동 / 크기 조절 ----
  function pointerPos(event) {
    const rect = canvas.getBoundingClientRect()
    const point = event.touches?.[0] || event.changedTouches?.[0] || event
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    return { x: (point.clientX - rect.left) * scaleX, y: (point.clientY - rect.top) * scaleY }
  }

  function hitTestHandle(layer, pos) {
    return Math.hypot(pos.x - (layer.x + layer.w), pos.y - (layer.y + layer.h)) <= HANDLE_R + 6
  }

  function hitTestLayer(pos) {
    const layers = currentPage().layers
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i]
      if (pos.x >= l.x && pos.x <= l.x + l.w && pos.y >= l.y && pos.y <= l.y + l.h) return l
    }
    return null
  }

  function onPointerDown(event) {
    const pos = pointerPos(event)
    const selected = getSelectedLayer()
    if (selected && hitTestHandle(selected, pos)) {
      dragState = { mode: 'resize', layer: selected, startPos: pos, startW: selected.w, startH: selected.h }
      return
    }
    const hit = hitTestLayer(pos)
    if (hit) {
      if (hit.id !== selectedLayerId) selectLayer(hit.id)
      dragState = { mode: 'move', layer: hit, startPos: pos, startX: hit.x, startY: hit.y }
    } else if (selectedLayerId !== null) {
      selectLayer(null)
    }
  }

  function onPointerMove(event) {
    if (!dragState) return
    event.preventDefault()
    const pos = pointerPos(event)
    const dx = pos.x - dragState.startPos.x
    const dy = pos.y - dragState.startPos.y
    if (dragState.mode === 'move') {
      dragState.layer.x = clamp(dragState.startX + dx, -dragState.layer.w + 24, CANVAS_W - 24)
      dragState.layer.y = clamp(dragState.startY + dy, -dragState.layer.h + 24, CANVAS_H - 24)
    } else {
      dragState.layer.w = clamp(dragState.startW + dx, 40, CANVAS_W * 1.4)
      dragState.layer.h = clamp(dragState.startH + dy, 40, CANVAS_H * 1.4)
    }
    render()
  }

  function onPointerUp() {
    if (dragState) {
      dragState = null
      persist()
    }
  }

  canvas.addEventListener('mousedown', onPointerDown)
  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('mouseup', onPointerUp)
  canvas.addEventListener('touchstart', onPointerDown, { passive: true })
  canvas.addEventListener('touchmove', onPointerMove, { passive: false })
  canvas.addEventListener('touchend', onPointerUp)

  // ---- 페이지 내비게이션 ----
  prevBtn?.addEventListener('click', () => {
    if (pageIndex <= 0) return
    pageIndex -= 1
    selectLayer(null)
  })
  nextBtn?.addEventListener('click', () => {
    if (pageIndex >= pages.length - 1) return
    pageIndex += 1
    selectLayer(null)
  })
  addPageBtn?.addEventListener('click', () => {
    pages.splice(pageIndex + 1, 0, { layers: [] })
    pageIndex += 1
    selectLayer(null)
    persist()
  })
  deletePageBtn?.addEventListener('click', () => {
    if (pages.length <= 1) return
    if (!window.confirm('이 페이지를 삭제할까요?')) return
    pages.splice(pageIndex, 1)
    pageIndex = Math.max(0, pageIndex - 1)
    selectLayer(null)
    persist()
  })

  // ---- 레이어 추가 ----
  function addImageLayerFromDataUrl(dataUrl) {
    const img = new Image()
    img.onload = () => {
      const maxW = CANVAS_W * 0.86
      const maxH = CANVAS_H * 0.6
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
      const w = img.naturalWidth * ratio
      const h = img.naturalHeight * ratio
      const layer = {
        id: nextLayerId++,
        type: 'image',
        x: (CANVAS_W - w) / 2,
        y: (CANVAS_H - h) / 2,
        w,
        h,
        src: dataUrl,
        imgEl: img,
      }
      currentPage().layers.unshift(layer) // 그림은 뒤쪽(텍스트보다 아래)에 오도록 맨 뒤에 배치
      selectLayer(layer.id)
      persist()
      setStatus('그림을 추가했어요.', false)
    }
    img.onerror = () => setStatus('그림을 불러오지 못했어요.', true)
    img.src = dataUrl
  }

  addImageFromEditorBtn?.addEventListener('click', () => {
    const helper = window.StorymagTaleImage
    if (!helper || !helper.hasImage()) {
      setStatus('먼저 위쪽 「그림 편집」에서 그림을 불러와 주세요.', true)
      return
    }
    const dataUrl = helper.getDataUrl()
    if (!dataUrl) {
      setStatus('그림을 가져오지 못했어요.', true)
      return
    }
    addImageLayerFromDataUrl(dataUrl)
  })

  imageInput?.addEventListener('change', () => {
    const file = imageInput.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setStatus('이미지 파일만 올릴 수 있어요.', true)
      return
    }
    const reader = new FileReader()
    reader.onload = () => addImageLayerFromDataUrl(String(reader.result))
    reader.onerror = () => setStatus('파일을 읽지 못했어요.', true)
    reader.readAsDataURL(file)
  })

  addTextBtn?.addEventListener('click', () => {
    const layer = {
      id: nextLayerId++,
      type: 'text',
      x: CANVAS_W * 0.1,
      y: CANVAS_H * 0.75,
      w: CANVAS_W * 0.8,
      h: CANVAS_H * 0.18,
      text: '여기에 글을 입력하세요',
      fontSize: 28,
      lineHeight: DEFAULT_LINE_HEIGHT,
      paragraphSpacing: DEFAULT_PARAGRAPH_GAP,
      color: '#1c1730',
      align: 'center',
    }
    currentPage().layers.push(layer)
    selectLayer(layer.id)
    persist()
  })

  // ---- 그림책 템플릿 ----
  function findFirstLayerOnPage(pageIdx, type) {
    return pages[pageIdx].layers.find((l) => l.type === type) || null
  }

  function ensureTextLayerOnPage(pageIdx) {
    let text = findFirstLayerOnPage(pageIdx, 'text')
    if (!text) {
      text = {
        id: nextLayerId++,
        type: 'text',
        text: '여기에 글을 입력하세요',
        fontSize: 28,
        lineHeight: DEFAULT_LINE_HEIGHT,
        paragraphSpacing: DEFAULT_PARAGRAPH_GAP,
        color: '#1c1730',
        align: 'center',
        x: 0,
        y: 0,
        w: 0,
        h: 0,
      }
      pages[pageIdx].layers.push(text)
    }
    return text
  }

  function bringLayerToFront(pageIdx, layer) {
    const layers = pages[pageIdx].layers
    const idx = layers.findIndex((l) => l.id === layer.id)
    if (idx !== -1) layers.splice(idx, 1)
    layers.push(layer)
  }

  /** 한 페이지 안에서 그림/글을 템플릿대로 배치. */
  function applyTemplateToPage(pageIdx, name) {
    const img = findFirstLayerOnPage(pageIdx, 'image')
    const text = ensureTextLayerOnPage(pageIdx)
    if (name === 'top-bottom') {
      if (img) {
        img.x = CANVAS_W * 0.05
        img.y = CANVAS_H * 0.04
        img.w = CANVAS_W * 0.9
        img.h = CANVAS_H * 0.56
      }
      text.x = CANVAS_W * 0.08
      text.y = CANVAS_H * 0.64
      text.w = CANVAS_W * 0.84
      text.h = CANVAS_H * 0.32
      text.backdrop = false
      text.color = '#1c1730'
    } else if (name === 'fullbleed') {
      if (img) {
        img.x = 0
        img.y = 0
        img.w = CANVAS_W
        img.h = CANVAS_H
      }
      text.x = CANVAS_W * 0.06
      text.y = CANVAS_H * 0.74
      text.w = CANVAS_W * 0.88
      text.h = CANVAS_H * 0.2
      text.backdrop = true
      text.color = '#ffffff'
    } else if (name === 'split') {
      if (img) {
        img.x = 0
        img.y = 0
        img.w = CANVAS_W * 0.5
        img.h = CANVAS_H
      }
      text.x = CANVAS_W * 0.56
      text.y = CANVAS_H * 0.08
      text.w = CANVAS_W * 0.38
      text.h = CANVAS_H * 0.84
      text.backdrop = false
      text.color = '#1c1730'
    }
    bringLayerToFront(pageIdx, text)
    return { img, text }
  }

  function ensureNextPageExists() {
    if (pageIndex + 1 >= pages.length) {
      pages.push({ layers: [] })
    }
  }

  /** 맞쪽 전용 「좌우 분할」: 그림은 이 페이지 전체, 글은 다음 페이지 전체를 채운다(펼침면 구성). */
  function applySplitAsSpread() {
    ensureNextPageExists()
    const leftIdx = pageIndex
    const rightIdx = pageIndex + 1
    const img = findFirstLayerOnPage(leftIdx, 'image')
    const text = ensureTextLayerOnPage(rightIdx)
    if (img) {
      img.x = 0
      img.y = 0
      img.w = CANVAS_W
      img.h = CANVAS_H
    }
    text.x = CANVAS_W * 0.08
    text.y = CANVAS_H * 0.1
    text.w = CANVAS_W * 0.84
    text.h = CANVAS_H * 0.8
    text.backdrop = false
    text.color = '#1c1730'
    bringLayerToFront(rightIdx, text)
    return { rightIdx, text }
  }

  function applyTemplate(name) {
    const spread = Boolean(templateSpreadCheckbox?.checked)
    if (spread && name === 'split') {
      const { rightIdx, text } = applySplitAsSpread()
      pageIndex = rightIdx
      selectLayer(text.id)
      persist()
      setStatus('맞쪽 구성: 그림은 이 페이지, 글은 다음 페이지 전체를 채웠어요.', false)
      return
    }
    if (spread) {
      ensureNextPageExists()
      const { img, text } = applyTemplateToPage(pageIndex, name)
      applyTemplateToPage(pageIndex + 1, name)
      selectLayer(text.id)
      persist()
      setStatus(
        img
          ? '맞쪽(이 페이지 + 다음 페이지)에 템플릿을 적용했어요.'
          : '텍스트 위치를 배치했어요. (그림을 추가하면 같은 템플릿으로 자동 배치됩니다)',
        false,
      )
      return
    }
    const { img, text } = applyTemplateToPage(pageIndex, name)
    selectLayer(text.id)
    persist()
    setStatus(
      img ? '템플릿을 적용했어요.' : '텍스트 위치를 배치했어요. (그림을 추가하면 같은 템플릿으로 자동 배치됩니다)',
      false,
    )
  }

  templateTopBottomBtn?.addEventListener('click', () => applyTemplate('top-bottom'))
  templateFullbleedBtn?.addEventListener('click', () => applyTemplate('fullbleed'))
  templateSplitBtn?.addEventListener('click', () => applyTemplate('split'))

  // ---- 내보내기: PNG(현재 페이지) / PDF(전체 페이지) ----
  function renderPageToCanvas(page) {
    const c = document.createElement('canvas')
    c.width = CANVAS_W
    c.height = CANVAS_H
    paintPage(c.getContext('2d'), page, CANVAS_W, CANVAS_H)
    return c
  }

  exportPagePngBtn?.addEventListener('click', () => {
    renderPageToCanvas(currentPage()).toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tale-page-${pageIndex + 1}-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  })

  exportPdfBtn?.addEventListener('click', async () => {
    exportPdfBtn.disabled = true
    setStatus('PDF를 만드는 중…', false)
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm')
      const JsPdfCtor = mod.jsPDF || mod.default
      const orientation = CANVAS_W >= CANVAS_H ? 'landscape' : 'portrait'
      const pdf = new JsPdfCtor({ orientation, unit: 'px', format: [CANVAS_W, CANVAS_H] })
      pages.forEach((page, i) => {
        const dataUrl = renderPageToCanvas(page).toDataURL('image/png')
        if (i > 0) pdf.addPage([CANVAS_W, CANVAS_H], orientation)
        pdf.addImage(dataUrl, 'PNG', 0, 0, CANVAS_W, CANVAS_H)
      })
      pdf.save(`tale-book-${Date.now()}.pdf`)
      setStatus(`${pages.length}페이지를 PDF로 내보냈어요.`, false)
    } catch {
      setStatus('PDF 생성에 실패했어요. 네트워크 상태를 확인해 주세요.', true)
    } finally {
      exportPdfBtn.disabled = false
    }
  })

  // ---- AI 텍스트 분량 배치(4단계) ----
  function authReadyLocal() {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      if (typeof showPinGate === 'function') showPinGate('로그인이 필요해요.')
      return false
    }
    return true
  }
  function authHeadersLocal() {
    return typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' }
  }

  aiSplitBtn?.addEventListener('click', async () => {
    const sourceText = (
      document.getElementById('tale-final')?.value ||
      document.getElementById('tale-revision')?.value ||
      document.getElementById('tale-draft')?.value ||
      ''
    ).trim()
    if (sourceText.length < 20) {
      setStatus('먼저 위쪽 「AI 동화 편집」의 초안·수정고·최종본 중 하나에 글을 채워 주세요.', true)
      return
    }
    if (!authReadyLocal()) return
    const targetPageCount = pages.length >= 2 ? pages.length : 6
    aiSplitBtn.disabled = true
    aiSplitBtn.classList.add('ai-help-btn--busy')
    setStatus(`글을 ${targetPageCount}페이지로 나누는 중…`, false)
    try {
      const response = await fetch('/api/desk', {
        method: 'POST',
        headers: authHeadersLocal(),
        body: JSON.stringify({
          desk: 'tale',
          phase: 'layout-suggest',
          draft: sourceText,
          pageCount: targetPageCount,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        if (typeof clearAllAuth === 'function') clearAllAuth()
        if (typeof showPinGate === 'function') showPinGate('세션이 만료됐어요. 다시 로그인해 주세요.')
        return
      }
      if (!response.ok || !data.ok || !Array.isArray(data.pages)) {
        setStatus('페이지 나누기에 실패했어요.', true)
        return
      }
      while (pages.length < data.pages.length) pages.push({ layers: [] })
      data.pages.forEach((pageText, i) => {
        let textLayer = pages[i].layers.find((l) => l.type === 'text')
        if (!textLayer) {
          textLayer = {
            id: nextLayerId++,
            type: 'text',
            x: CANVAS_W * 0.08,
            y: CANVAS_H * 0.66,
            w: CANVAS_W * 0.84,
            h: CANVAS_H * 0.3,
            fontSize: 28,
            lineHeight: DEFAULT_LINE_HEIGHT,
            paragraphSpacing: DEFAULT_PARAGRAPH_GAP,
            color: '#1c1730',
            align: 'center',
          }
          pages[i].layers.push(textLayer)
        }
        textLayer.text = pageText
      })
      pageIndex = 0
      selectLayer(null)
      persist()
      setStatus(
        data.source === 'heuristic'
          ? `엔진 응답 실패로 균등 분배로 대체했어요 [원인: ${data.debugError || 'unknown'}]`
          : `${data.pages.length}페이지로 나눠 각 페이지 글에 채웠어요.`,
        data.source === 'heuristic',
      )
    } catch {
      setStatus('네트워크 오류가 났어요.', true)
    } finally {
      aiSplitBtn.disabled = false
      aiSplitBtn.classList.remove('ai-help-btn--busy')
    }
  })

  // ---- 로컬 저장/복원 ----
  function persist() {
    try {
      const data = {
        pageIndex,
        nextLayerId,
        pages: pages.map((p) => ({
          layers: p.layers.map((l) =>
            l.type === 'image'
              ? { id: l.id, type: 'image', x: l.x, y: l.y, w: l.w, h: l.h, src: l.src }
              : {
                  id: l.id,
                  type: 'text',
                  x: l.x,
                  y: l.y,
                  w: l.w,
                  h: l.h,
                  text: l.text,
                  fontSize: l.fontSize,
                  lineHeight: l.lineHeight || DEFAULT_LINE_HEIGHT,
                  paragraphSpacing: l.paragraphSpacing ?? DEFAULT_PARAGRAPH_GAP,
                  color: l.color,
                  align: l.align,
                  backdrop: Boolean(l.backdrop),
                },
          ),
        })),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      setStatus('로컬 저장 공간이 부족해서 이번 변경은 저장되지 않았어요. (그림 수를 줄여 보세요)', true)
    }
  }

  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      if (!data?.pages?.length) return
      nextLayerId = Number(data.nextLayerId) || 1
      const restored = data.pages.map((p) => ({
        layers: (p.layers || []).map((l) => {
          if (l.type === 'image' && l.src) {
            const img = new Image()
            img.onload = () => render()
            img.src = l.src
            return { ...l, imgEl: img }
          }
          return l
        }),
      }))
      pages = restored.length ? restored : pages
      pageIndex = clamp(Number(data.pageIndex) || 0, 0, pages.length - 1)
    } catch {
      /* ignore */
    }
  }

  loadPersisted()
  render()

  window.StorymagTaleLayout = { onShow: () => render() }
})()
