/**
 * 관리자 합성 — 슬롯·배치·포인트 맞춤·올가미 컷/구멍·머리 교체·픽셀 확정.
 * window.StorymagAdminFuse.init(deps)
 */
;(function (global) {
  /**
   * @param {{
   *   getCurrentResult: () => any
   *   getGalleryItems?: () => Array<{ imageUrl?: string, imageDataUrl?: string, id?: string }>
   *   showResult: Function
   *   setAdminPanel: (p: string) => void
   *   setFormStatus: (msg: string, err?: boolean) => void
   *   moodField?: HTMLSelectElement | null
   *   authHeaders?: (extra?: Record<string, string>) => Record<string, string>
   *   isLoggedIn?: () => boolean
   *   showPinGate?: (msg?: string) => void
   * }} deps
   */
  function init(deps) {
    const canvas = document.getElementById('admin-fuse-canvas')
    const lassoCanvas = document.getElementById('admin-fuse-lasso')
    const fileInput = document.getElementById('admin-fuse-file-input')
    const statusEl = document.getElementById('admin-fuse-status')
    const commitBtn = document.getElementById('admin-fuse-commit')
    const dropzone = document.getElementById('admin-fuse-dropzone')
    const canvasScroll = document.getElementById('admin-fuse-canvas-scroll')
    const zoomInBtn = document.getElementById('admin-fuse-zoom-in')
    const zoomOutBtn = document.getElementById('admin-fuse-zoom-out')
    const zoomResetBtn = document.getElementById('admin-fuse-zoom-reset')
    const zoomLabel = document.getElementById('admin-fuse-zoom-label')
    const dropOverlay = document.getElementById('admin-fuse-drop-overlay')
    const pickDialog = document.getElementById('admin-fuse-pick-dialog')
    const pickTitle = document.getElementById('admin-fuse-pick-title')
    const pickCloseBtn = document.getElementById('admin-fuse-pick-close')
    const loadFileBtn = document.getElementById('admin-fuse-load-file')
    const pasteBtn = document.getElementById('admin-fuse-paste')
    const pasteCatcher = document.getElementById('admin-fuse-paste-catcher')
    const fromResultBtn = document.getElementById('admin-fuse-from-result')
    const fromGalleryBtn = document.getElementById('admin-fuse-from-gallery')
    const cameraBtn = document.getElementById('admin-fuse-camera')
    const galleryDialog = document.getElementById('admin-fuse-gallery-dialog')
    const galleryGrid = document.getElementById('admin-fuse-gallery-grid')
    const cameraDialog = document.getElementById('admin-fuse-camera-dialog')
    const cameraVideo = document.getElementById('admin-fuse-camera-video')
    const cameraShotBtn = document.getElementById('admin-fuse-camera-shot')
    const cameraCloseBtn = document.getElementById('admin-fuse-camera-close')
    const cutBtn = document.getElementById('admin-fuse-cut')
    const punchBtn = document.getElementById('admin-fuse-punch')
    const sharpenBtn = document.getElementById('admin-fuse-sharpen')
    const cleanupBtn = document.getElementById('admin-fuse-cleanup')
    const helperBtn = document.getElementById('admin-fuse-head-help')
    const stepPrevBtn = document.getElementById('admin-fuse-step-prev')
    const stepNextBtn = document.getElementById('admin-fuse-step-next')
    const aiFinishBtn = document.getElementById('admin-fuse-ai-finish')
    const aiFinishBtn2 = document.getElementById('admin-fuse-ai-finish-2')
    const stepGuideEl = document.getElementById('admin-fuse-step-guide')
    const fusePanel = document.getElementById('admin-fuse-panel')
    const aiPolishBtn = document.getElementById('admin-fuse-ai-polish')
    const aiMatteBtn = document.getElementById('admin-fuse-ai-matte')
    const aiUndoBtn = document.getElementById('admin-fuse-ai-undo')
    const faceSizeInput = document.getElementById('admin-fuse-face-size')
    const yawSelect = document.getElementById('admin-fuse-yaw')
    const yawFaceBtn = document.getElementById('admin-fuse-yaw-face')
    const yawBodyBtn = document.getElementById('admin-fuse-yaw-body')
    const edgeInput = document.getElementById('admin-fuse-edge')
    const skinInput = document.getElementById('admin-fuse-skin')
    const lightInput = document.getElementById('admin-fuse-light')
    const brightInput = document.getElementById('admin-fuse-bright')
    const satInput = document.getElementById('admin-fuse-sat')
    const polishNoteInput = document.getElementById('admin-fuse-polish-note')
    const resetBtn = document.getElementById('admin-fuse-reset')
    if (!canvas || !fileInput || !lassoCanvas) return

    /** @type {MediaStream | null} */
    let cameraStream = null
    let dropDepth = 0
    /** AI 손보기 직전 평탄 스냅샷 (되돌리기) */
    let polishUndoDataUrl = null
    let polishBusy = false
    /** 화면 줌 (레이어 크기와 별개 — 올가미 정교 작업용) */
    let viewZoom = 1
    const VIEW_ZOOM_MIN = 0.5
    const VIEW_ZOOM_MAX = 4
    let spacePanHeld = false
    /** @type {null | { x: number, y: number, sl: number, st: number }} */
    let viewPan = null
    /** 자른 직후 올가미 검증용 초록 점선 */
    /** @type {null | Array<{x:number,y:number}>} */
    let ghostCutPoly = null
    let ghostCutTimer = 0

    const ctx = canvas.getContext('2d')
    /** @type {Array<{ id: number, slot: number, img: HTMLImageElement, x: number, y: number, w: number, h: number, flipX: boolean, rotation: number }>} */
    let layers = []
    let nextLayerId = 1
    let nextFreeSlot = 3
    let activeSlot = 0
    let drag = null
    let selectedId = null
    /** @type {'move' | 'lasso' | 'align'} */
    let tool = 'move'
    let fuseLasso = null
    let headHelpStep = 1
    /**
     * 포인트 맞춤: 옮길 레이어 위 src 2점 → 목표 dst 2점
     * @type {null | { layerId: number, src: Array<{x:number,y:number}>, dst: Array<{x:number,y:number}> }}
     */
    let alignSession = null

    const FUSE_STEP_GUIDES = {
      1: '① 재료: 1칸에 몸·장면, 2칸에 붙일 얼굴을 넣으세요. (불러오기·Ctrl+V·드롭)',
      2: '② 몸 얼굴 버리기(선택·권장): 미리 지우면 더 깨끗해요. 몸 선택 → 옛 얼굴 올가미 → 「버릴 조각」. 건너뛰고 ③으로 가도 됩니다.',
      3: '③ 붙일 얼굴 쓰기(필수): 붙일 얼굴 레이어 선택 → 올가미 → 「그린 올가미 그대로 자르기」',
      4: '④ 자투리: 「쓸 조각」하면 원본 사진 껍데기는 자동 삭제됩니다. 남은 게 있으면 「남은 조각 치우기」.',
      5: '⑤ 맞추기(필수): 자른 얼굴 → 「맞추기」눈·턱 2쌍. 맞추면 몸통 옛 머리는 자동으로 뚫립니다(직접 안 잘라도 됨).',
      6: '⑥ 다듬기: 「AI로 자연스럽게」=올가미 자국·목 이음만(몸·얼굴 유지). 끝나면 「AI 최종 완성」→「픽셀로 확정」.',
    }

    function setFuseStep(step, { announce = true } = {}) {
      const n = Math.min(6, Math.max(1, Math.round(Number(step) || 1)))
      headHelpStep = n
      document.querySelectorAll('[data-fuse-step]').forEach((el) => {
        const s = Number(el.getAttribute('data-fuse-step'))
        el.classList.toggle('is-active', s === n)
        el.classList.toggle('is-done', s < n)
      })
      if (stepGuideEl) stepGuideEl.textContent = FUSE_STEP_GUIDES[n] || FUSE_STEP_GUIDES[1]
      if (!announce) return
      if (n === 2) {
        setTool('lasso')
        const body = layers.find((l) => l.slot === 0)
        if (body) {
          selectedId = body.id
          activeSlot = 0
        }
        // 붙일 얼굴이 몸 위에 겹치면 올가미가 헷갈리니 잠시 옆으로
        const face = layers.find((l) => l.slot === 1)
        if (body && face && pointInLayer(body, layerCenter(face))) {
          face.x = Math.max(8, canvas.width - face.w - 8)
          face.y = 8
        }
        paintSlotButtons()
        redrawFuse()
      } else if (n === 3) {
        setTool('lasso')
        const face = layers.find((l) => l.slot === 1) || layers.find((l) => l.slot !== 0)
        if (face) {
          selectedId = face.id
          activeSlot = face.slot
        }
        paintSlotButtons()
        redrawFuse()
      } else if (n === 4) {
        setTool('lasso')
      } else if (n === 5) {
        setTool('align')
      } else if (n === 6) {
        setTool('move')
      } else {
        setTool('move')
      }
      setFuseStatus(FUSE_STEP_GUIDES[n], false)
    }

    function resetFuseWorkspace({ confirmAsk = true } = {}) {
      if (polishBusy) {
        setFuseStatus('AI 손보기가 끝날 때까지 기다려 주세요.', true)
        return false
      }
      if (confirmAsk && layers.length) {
        const ok = window.confirm('재료 칸(1·2·3)과 그림판을 모두 비우고 처음부터 시작할까요?')
        if (!ok) return false
      }
      layers = []
      nextLayerId = 1
      nextFreeSlot = 3
      activeSlot = 0
      selectedId = null
      drag = null
      alignSession = null
      polishUndoDataUrl = null
      dropDepth = 0
      if (aiUndoBtn) aiUndoBtn.hidden = true
      ensureFuseLasso()?.clearAll?.()
      setViewZoom(1)
      setFuseStep(1, { announce: false })
      clearSlotDropStyles()
      dropzone?.classList.remove('admin-fuse-canvas-wrap--drop')
      setTool('move')
      paintSlotButtons()
      redrawFuse()
      setFuseStatus('새로 시작했어요. 1 몸·장면 → 2 붙일 얼굴 순으로 칸을 눌러 넣으세요.', false)
      return true
    }

    function setFuseStatus(message, isError) {
      if (!statusEl) return
      statusEl.hidden = !message
      statusEl.textContent = message || ''
      statusEl.className = isError ? 'form__status form__status--error' : 'form__status'
    }

    function selectedLayer() {
      return layers.find((l) => l.id === selectedId) || null
    }

    function paintSlotButtons() {
      document.querySelectorAll('[data-fuse-slot]').forEach((btn) => {
        const idx = Number(btn.getAttribute('data-fuse-slot'))
        const layer = layers.find((l) => l.slot === idx)
        const label = btn.querySelector('.admin-fuse-slot__label')
        const filled = Boolean(layer?.img?.src)
        btn.querySelector('img')?.remove()
        if (filled) {
          const img = document.createElement('img')
          img.src = layer.img.src
          img.alt = ''
          btn.appendChild(img)
        }
        if (label) {
          if (idx === 0) label.textContent = '1 몸·장면'
          else if (idx === 1) label.textContent = '2 붙일 얼굴'
          else label.textContent = '3 더 쓰기'
        }
        btn.classList.toggle('admin-fuse-slot--active', idx === activeSlot)
        btn.classList.toggle('admin-fuse-slot--empty', !filled)
        btn.title = filled
          ? '클릭=선택 · 더블클릭=사진 바꾸기 · Ctrl+V'
          : '클릭하면 사진 넣는 방법 선택 · 드롭·Ctrl+V도 가능'
      })
    }

    function slotPlainName(idx) {
      if (idx === 0) return '1 몸·장면'
      if (idx === 1) return '2 붙일 얼굴'
      return '3 더 쓰기'
    }

    function openPickDialog(slotIndex) {
      activeSlot = Number(slotIndex) || 0
      paintSlotButtons()
      if (pickTitle) pickTitle.textContent = `${slotPlainName(activeSlot)}에 사진 넣기`
      if (pickDialog?.showModal) pickDialog.showModal()
      else setFuseStatus('사진 넣기 창을 열 수 없어요. Ctrl+V 또는 끌어다 놓기를 쓰세요.', true)
    }

    function closePickDialog() {
      if (pickDialog?.open) pickDialog.close()
    }

    function selectSlot(idx, { openPickerIfEmpty = false, forceOpenPicker = false, openFileIfEmpty = false } = {}) {
      activeSlot = Number(idx) || 0
      const existing = layers.find((l) => l.slot === activeSlot)
      if (existing) selectedId = existing.id
      paintSlotButtons()
      redrawFuse()
      if (forceOpenPicker) {
        openPickDialog(activeSlot)
        return
      }
      // 빈 칸: 바로 파일 불러오기 (제스처 유지). 다른 방법은 더블클릭/상단 버튼.
      if (openFileIfEmpty && !existing) {
        fileInput.click()
        return
      }
      if (openPickerIfEmpty && !existing) openPickDialog(activeSlot)
    }

    function layerCenter(layer) {
      return { x: layer.x + layer.w / 2, y: layer.y + layer.h / 2 }
    }

    function drawLayerTo(targetCtx, layer) {
      if (!targetCtx || !layer?.img) return
      const c = layerCenter(layer)
      targetCtx.save()
      targetCtx.imageSmoothingEnabled = true
      targetCtx.imageSmoothingQuality = 'high'
      targetCtx.translate(c.x, c.y)
      targetCtx.rotate(layer.rotation || 0)
      if (layer.flipX) targetCtx.scale(-1, 1)
      targetCtx.drawImage(layer.img, -layer.w / 2, -layer.h / 2, layer.w, layer.h)
      targetCtx.restore()
    }

    function drawLayer(layer) {
      drawLayerTo(ctx, layer)
    }

    /** 지정 레이어만 그린 캔버스 스냅샷 (버릴 조각 때 붙일 얼굴이 베이면 안 됨) */
    function exportOnlyLayersDataUrl(layerList, mime = 'image/jpeg', quality = 0.95) {
      const c = document.createElement('canvas')
      c.width = canvas.width
      c.height = canvas.height
      const cctx = c.getContext('2d')
      if (!cctx) return canvas.toDataURL(mime, quality)
      cctx.fillStyle = '#020617'
      cctx.fillRect(0, 0, c.width, c.height)
      for (const layer of layerList) drawLayerTo(cctx, layer)
      return c.toDataURL(mime, quality)
    }

    async function setLayerFromFullCanvasUrl(layer, url) {
      const img = await loadImage(url)
      layer.img = img
      layer.x = 0
      layer.y = 0
      layer.w = canvas.width
      layer.h = canvas.height
      layer.rotation = 0
      layer.flipX = false
    }

    /** 버릴 조각 직후 → 붙일 얼굴 선택 + 올가미 (연속 동작) */
    function continueToKeepFaceStep() {
      const face =
        layers.find((l) => l.slot === 1) ||
        layers.find((l) => l.slot !== 0 && l.id !== selectedId) ||
        layers.find((l) => l.slot !== 0)
      if (!face) {
        setFuseStep(3, { announce: false })
        setTool('move')
        setFuseStatus(
          '② 몸 얼굴 버리기 완료. 그런데 붙일 얼굴이 없어요. 2칸에 얼굴을 다시 넣은 뒤 올가미 「쓸 조각」하세요.',
          true,
        )
        activeSlot = 1
        paintSlotButtons()
        return
      }
      selectedId = face.id
      activeSlot = typeof face.slot === 'number' ? face.slot : 1
      paintSlotButtons()
      redrawFuse()
      setFuseStep(3, { announce: false })
      setTool('lasso')
      if (viewZoom < 1.25) setViewZoom(1.5)
      setFuseStatus(
        '② 완료 → ③ 지금 「붙일 얼굴」이 선택됨. 줌된 상태에서 쓸 얼굴만 올가미 → 우클릭 「쓸 조각」.',
        false,
      )
    }

    /** 몸·장면 + 얼굴 조각만 남김 (증명사진 자투리·유령 실루엣 제거). 몸통(slot0)은 절대 삭제 안 함. */
    function keepOnlyBodyAndPiece(piece) {
      if (!piece || piece.slot === 0) return
      const keep = new Set([piece.id])
      for (const l of layers) {
        if (l.slot === 0) keep.add(l.id)
      }
      if (![...keep].some((id) => layers.some((l) => l.id === id && l.slot === 0))) {
        // 몸통이 없으면 자투리만 건드리지 않음 (몸 날리는 사고 방지)
        return
      }
      const before = layers.length
      layers = layers.filter((l) => keep.has(l.id) || l.slot === 0)
      selectedId = piece.id
      if (before !== layers.length) {
        paintSlotButtons()
        redrawFuse()
      }
    }

    /** 쓸 조각 직후 → 자투리 제거 + 자른 위치 유지 후 맞추기 안내 */
    function continueAfterKeepPiece(piece) {
      // 원본 얼굴 사진이 구멍만 뚫린 채 남으면 “올가미 유령 인물”이 됨 → 즉시 제거
      keepOnlyBodyAndPiece(piece)
      selectedId = piece.id
      paintSlotButtons()
      redrawFuse()
      setFuseStep(5, { announce: false })
      setTool('align')
      setFuseStatus(
        '얼굴 조각만 남겼어요(원본 사진·자투리 삭제). 「맞추기」로 눈·턱 2쌍 → 몸 옛 얼굴 자동 제거.',
        false,
      )
    }

    /**
     * 새 얼굴 조각 아래의 몸 옛 머리만 좁게 뚫는 타원.
     * 조각 전체 bbox를 크게 잡으면 몸통·옷까지 날아감 → 윗부분(머리)만.
     */
    function headMaskPointsFromLayer(layer, inflate = 1.02) {
      const rot = layer.rotation || 0
      const cos = Math.cos(rot)
      const sin = Math.sin(rot)
      // 중심을 조각 상단 42% 지점으로 — 어깨·가슴은 마스크 밖
      const c = {
        x: layer.x + layer.w / 2,
        y: layer.y + layer.h * 0.4,
      }
      const hw = (layer.w / 2) * inflate * 0.88
      const hh = (layer.h / 2) * inflate * 0.62
      const pts = []
      const n = 20
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2
        const lx = Math.cos(a) * hw
        const ly = Math.sin(a) * hh
        pts.push({
          x: Math.max(0, Math.min(canvas.width, c.x + lx * cos - ly * sin)),
          y: Math.max(0, Math.min(canvas.height, c.y + lx * sin + ly * cos)),
        })
      }
      return pts
    }

    /**
     * 맞추기 직후 옛 머리 처리.
     * 예전: 몸통에 구멍을 뚫음 → 검은 구멍·반투명·유령 겹침의 주원인.
     * 지금: 구멍 안 뚫음. 새 얼굴이 덮고, 자투리만 치움. 이음은 「AI로 자연스럽게」.
     */
    async function eraseBodyFaceUnderPiece(pieceLayer) {
      const body = layers.find((l) => l.slot === 0)
      if (!body?.img || !pieceLayer?.img || pieceLayer.id === body.id || pieceLayer.slot === 0) {
        return false
      }
      keepOnlyBodyAndPiece(pieceLayer)
      return true
    }

    /** 언샤프 마스크 — 선택 레이어 픽셀을 선명하게 (AI 없음) */
    async function sharpenSelectedLayer(amount = 0.75) {
      const layer = layers.find((l) => l.id === selectedId)
      if (!layer?.img) {
        setFuseStatus('먼저 레이어를 선택하세요.', true)
        return
      }
      const src = layer.img
      const w = src.naturalWidth || src.width
      const h = src.naturalHeight || src.height
      if (w < 8 || h < 8) {
        setFuseStatus('이미지가 너무 작아 선명화할 수 없어요.', true)
        return
      }
      const base = document.createElement('canvas')
      base.width = w
      base.height = h
      const bctx = base.getContext('2d', { willReadFrequently: true })
      if (!bctx) return
      bctx.imageSmoothingEnabled = true
      bctx.imageSmoothingQuality = 'high'
      bctx.drawImage(src, 0, 0)
      const sharp = bctx.getImageData(0, 0, w, h)

      const blurC = document.createElement('canvas')
      blurC.width = w
      blurC.height = h
      const blurCtx = blurC.getContext('2d')
      if (!blurCtx) return
      blurCtx.filter = 'blur(1.2px)'
      blurCtx.drawImage(base, 0, 0)
      const blurred = blurCtx.getImageData(0, 0, w, h)

      const d = sharp.data
      const b = blurred.data
      const threshold = 3
      for (let i = 0; i < d.length; i += 4) {
        for (let c = 0; c < 3; c += 1) {
          const diff = d[i + c] - b[i + c]
          if (Math.abs(diff) > threshold) {
            d[i + c] = Math.max(0, Math.min(255, Math.round(d[i + c] + diff * amount)))
          }
        }
      }
      bctx.putImageData(sharp, 0, 0)
      layer.img = await loadImage(base.toDataURL('image/png'))
      redrawFuse()
      paintSlotButtons()
      setFuseStatus('선택한 레이어를 선명하게 했어요. 더 세게 하려면 다시 누르세요.', false)
    }

    function strokeLayerBounds(layer) {
      if (!ctx) return
      const c = layerCenter(layer)
      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.rotate(layer.rotation || 0)
      ctx.strokeStyle = '#facc15'
      ctx.lineWidth = 2
      ctx.strokeRect(-layer.w / 2 + 0.5, -layer.h / 2 + 0.5, layer.w - 1, layer.h - 1)
      ctx.restore()
    }

    /** 캔버스 점 → 레이어 로컬(좌상단 기준, 표시 크기) */
    function canvasToLayerLocal(layer, p) {
      const c = layerCenter(layer)
      let dx = p.x - c.x
      let dy = p.y - c.y
      const ang = -(layer.rotation || 0)
      const cos = Math.cos(ang)
      const sin = Math.sin(ang)
      let lx = dx * cos - dy * sin
      let ly = dx * sin + dy * cos
      if (layer.flipX) lx = -lx
      return { x: lx + layer.w / 2, y: ly + layer.h / 2 }
    }

    function pointInLayer(layer, p) {
      const local = canvasToLayerLocal(layer, p)
      return local.x >= 0 && local.y >= 0 && local.x <= layer.w && local.y <= layer.h
    }

    function drawAlignMarks() {
      if (!ctx || !alignSession) return
      const marks = [
        ...alignSession.src.map((p, i) => ({ p, label: `A${i + 1}`, color: '#38bdf8' })),
        ...alignSession.dst.map((p, i) => ({ p, label: `B${i + 1}`, color: '#f472b6' })),
      ]
      marks.forEach(({ p, label, color }) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#fff'
        ctx.stroke()
        ctx.font = 'bold 12px sans-serif'
        ctx.fillStyle = '#fff'
        ctx.fillText(label, p.x + 10, p.y - 8)
      })
      if (alignSession.src.length === 2) {
        ctx.beginPath()
        ctx.moveTo(alignSession.src[0].x, alignSession.src[0].y)
        ctx.lineTo(alignSession.src[1].x, alignSession.src[1].y)
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      if (alignSession.dst.length === 2) {
        ctx.beginPath()
        ctx.moveTo(alignSession.dst[0].x, alignSession.dst[0].y)
        ctx.lineTo(alignSession.dst[1].x, alignSession.dst[1].y)
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.85)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }

    /** 어두운 안내 오버레이: 빈 캔버스+드래그 중에만. 레이어가 있으면 절대 표시하지 않음. */
    function syncDropOverlay() {
      if (!dropOverlay) return
      const show = layers.length === 0 && dropDepth > 0
      dropOverlay.hidden = !show
      // author CSS display:flex 가 [hidden]을 이기는 경우 대비 — inline !important
      dropOverlay.style.setProperty('display', show ? 'flex' : 'none', 'important')
    }

    function redrawFuse() {
      if (!ctx) return
      ctx.fillStyle = '#020617'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      if (!layers.length) {
        ctx.fillStyle = 'rgba(254, 249, 195, 0.85)'
        ctx.font = '600 28px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = '600 26px sans-serif'
        ctx.fillText('위 칸을 눌러 사진을 넣으세요', canvas.width / 2, canvas.height / 2 - 16)
        ctx.font = '500 20px sans-serif'
        ctx.fillStyle = 'rgba(203, 213, 225, 0.9)'
        ctx.fillText('1 몸·장면 → 2 붙일 얼굴', canvas.width / 2, canvas.height / 2 + 22)
      }
      layers.forEach((layer) => {
        drawLayer(layer)
        if (layer.id === selectedId) strokeLayerBounds(layer)
      })
      if (tool === 'align') drawAlignMarks()
      if (ghostCutPoly?.length >= 3 && ctx) {
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(ghostCutPoly[0].x, ghostCutPoly[0].y)
        for (let i = 1; i < ghostCutPoly.length; i += 1) {
          ctx.lineTo(ghostCutPoly[i].x, ghostCutPoly[i].y)
        }
        ctx.closePath()
        ctx.strokeStyle = '#34d399'
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])
        ctx.stroke()
        ctx.restore()
      }
      if (fuseLasso && tool === 'lasso') {
        const lctx = lassoCanvas.getContext('2d')
        fuseLasso.draw(lctx)
      }
      syncDropOverlay()
    }

    function hitLayer(x, y) {
      const p = { x, y }
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        if (pointInLayer(layers[i], p)) return layers[i]
      }
      return null
    }

    function pointer(event, el) {
      const target = el || canvas
      const bounds = target.getBoundingClientRect()
      return {
        x: ((event.clientX - bounds.left) * target.width) / Math.max(1, bounds.width),
        y: ((event.clientY - bounds.top) * target.height) / Math.max(1, bounds.height),
      }
    }

    function syncLassoSize() {
      if (lassoCanvas.width !== canvas.width || lassoCanvas.height !== canvas.height) {
        lassoCanvas.width = canvas.width
        lassoCanvas.height = canvas.height
      }
      // 본 캔버스가 화면에 그려진 픽셀 박스와 1:1 (%, auto 스트레치 금지)
      const dw = Math.max(1, canvas.clientWidth || canvas.getBoundingClientRect().width)
      const dh = Math.max(1, canvas.clientHeight || canvas.getBoundingClientRect().height)
      lassoCanvas.style.left = '0'
      lassoCanvas.style.top = '0'
      lassoCanvas.style.width = `${Math.round(dw)}px`
      lassoCanvas.style.height = `${Math.round(dh)}px`
    }

    /** 긴 변 최대 2048. 원본보다 캔버스만 키우지 않음(작아 보이는 사고 방지) */
    const FUSE_MAX_SIDE = 2048
    const FUSE_MIN_SIDE = 320
    /** 창 최소/최대화 직후 휠을 줌으로 오인하는 것 차단 */
    let ignoreWheelUntil = 0

    function setFuseCanvasSize(nextW, nextH) {
      const w = Math.max(FUSE_MIN_SIDE, Math.min(FUSE_MAX_SIDE, Math.round(nextW)))
      const h = Math.max(FUSE_MIN_SIDE, Math.min(FUSE_MAX_SIDE, Math.round(nextH)))
      if (canvas.width === w && canvas.height === h) {
        syncLassoSize()
        return
      }
      const sx = w / Math.max(1, canvas.width)
      const sy = h / Math.max(1, canvas.height)
      layers.forEach((layer) => {
        layer.x = Math.round(layer.x * sx)
        layer.y = Math.round(layer.y * sy)
        layer.w = Math.max(24, Math.round(layer.w * sx))
        layer.h = Math.max(24, Math.round(layer.h * sy))
      })
      canvas.width = w
      canvas.height = h
      syncLassoSize()
      applyViewZoomCss()
      redrawFuse()
    }

    /**
     * 원본/AI 픽셀 크기에 캔버스를 맞춤.
     * ※ 작은 사진을 1080으로 부풀린 뒤 scale≤1로 올리면 검은 여백+꼬마 사진이 됨 → 업스케일 금지.
     */
    function fitFuseCanvasToImage(img) {
      if (!img?.naturalWidth) return
      const fitScale = Math.min(
        FUSE_MAX_SIDE / img.naturalWidth,
        FUSE_MAX_SIDE / img.naturalHeight,
        1,
      )
      const w = Math.max(FUSE_MIN_SIDE, Math.round(img.naturalWidth * fitScale))
      const h = Math.max(FUSE_MIN_SIDE, Math.round(img.naturalHeight * fitScale))
      setFuseCanvasSize(w, h)
    }

    /** 몸·장면 레이어를 캔버스에 꽉 채움(검은 여백·꼬마 사진 복구) */
    function fitBodyLayerToCanvas() {
      const body = layers.find((l) => l.slot === 0)
      if (!body?.img) return false
      const scale = Math.min(
        canvas.width / Math.max(1, body.img.naturalWidth),
        canvas.height / Math.max(1, body.img.naturalHeight),
      )
      body.w = Math.max(40, Math.round(body.img.naturalWidth * scale))
      body.h = Math.max(40, Math.round(body.img.naturalHeight * scale))
      body.x = Math.round((canvas.width - body.w) / 2)
      body.y = Math.round((canvas.height - body.h) / 2)
      body.rotation = 0
      return true
    }

    function baseWrapWidth() {
      // 100% = 스크롤 영역 가로를 꽉 채움 (예전 420px 고정이 오른쪽 빈칸의 원인)
      if (!canvasScroll) return 560
      return Math.max(280, canvasScroll.clientWidth || 560)
    }

    function applyViewZoomCss() {
      if (!dropzone) return
      const w = Math.round(baseWrapWidth() * viewZoom)
      dropzone.style.width = `${w}px`
      dropzone.style.maxWidth = 'none'
      // 줌아웃 시 왼쪽에만 붙지 않고 가운데
      dropzone.style.marginLeft = viewZoom < 1 ? 'auto' : '0'
      dropzone.style.marginRight = viewZoom < 1 ? 'auto' : '0'
      if (zoomLabel) zoomLabel.textContent = `${Math.round(viewZoom * 100)}%`
      syncLassoSize()
    }

    /**
     * @param {number} next
     * @param {{ clientX?: number, clientY?: number } | null} [pivot]
     */
    function setViewZoom(next, pivot) {
      const z = Math.min(VIEW_ZOOM_MAX, Math.max(VIEW_ZOOM_MIN, Math.round(next * 100) / 100))
      if (!canvasScroll) {
        viewZoom = z
        applyViewZoomCss()
        return
      }
      const rect = canvasScroll.getBoundingClientRect()
      const cx = typeof pivot?.clientX === 'number' ? pivot.clientX : rect.left + rect.width / 2
      const cy = typeof pivot?.clientY === 'number' ? pivot.clientY : rect.top + rect.height / 2
      const relX = canvasScroll.scrollLeft + (cx - rect.left)
      const relY = canvasScroll.scrollTop + (cy - rect.top)
      const ratio = z / Math.max(0.01, viewZoom)
      viewZoom = z
      applyViewZoomCss()
      canvasScroll.scrollLeft = Math.max(0, relX * ratio - (cx - rect.left))
      canvasScroll.scrollTop = Math.max(0, relY * ratio - (cy - rect.top))
    }

    function bumpViewZoom(dir, pivot) {
      const step = viewZoom < 1 ? 0.1 : viewZoom < 2 ? 0.25 : 0.5
      setViewZoom(viewZoom + (dir < 0 ? -step : step), pivot)
    }

    function canvasPointsToNatural(layer, points) {
      // 클램프 금지 — 바깥 점을 가장자리로 밀어붙이면 올가미 모양이 달라짐
      return points.map((p) => {
        const local = canvasToLayerLocal(layer, p)
        return {
          x: (local.x / Math.max(1, layer.w)) * layer.img.naturalWidth,
          y: (local.y / Math.max(1, layer.h)) * layer.img.naturalHeight,
        }
      })
    }

    /** 투명 픽셀 bbox (잘린 조각 크롭용) */
    function alphaBBox(ctx, w, h, threshold = 8) {
      const data = ctx.getImageData(0, 0, w, h).data
      let minX = w
      let minY = h
      let maxX = -1
      let maxY = -1
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          if (data[(y * w + x) * 4 + 3] > threshold) {
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
          }
        }
      }
      if (maxX < 0) return null
      return { minX, minY, maxX, maxY }
    }

    function loadImage(url) {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('이미지를 불러오지 못했어요.'))
        img.src = url
      })
    }

    async function placeImage(url, slotIndex) {
      dropDepth = 0
      const img = await loadImage(url)
      layers = layers.filter((l) => l.slot !== slotIndex)

      let w
      let h
      let x
      let y

      if (slotIndex === 0) {
        // 첫 가져오기: 캔버스=사진 비율, 몸통은 캔버스 가득(가운데)
        fitFuseCanvasToImage(img)
        const scale = Math.min(
          canvas.width / Math.max(1, img.naturalWidth),
          canvas.height / Math.max(1, img.naturalHeight),
        )
        w = Math.max(40, Math.round(img.naturalWidth * scale))
        h = Math.max(40, Math.round(img.naturalHeight * scale))
        x = Math.round((canvas.width - w) / 2)
        y = Math.round((canvas.height - h) / 2)
      } else {
        // 얼굴: 몸 옆에 적당한 크기로 (이후 드래그·휠·핀치로 조절)
        const body = layers.find((l) => l.slot === 0)
        const targetW = body
          ? Math.max(64, Math.round(body.w * 0.34))
          : Math.max(64, Math.round(canvas.width * 0.4))
        const scale = targetW / Math.max(1, img.naturalWidth)
        w = Math.max(48, Math.round(img.naturalWidth * scale))
        h = Math.max(48, Math.round(img.naturalHeight * scale))
        if (body) {
          x = Math.min(canvas.width - w - 8, Math.round(body.x + body.w + 10))
          if (x < 8) x = Math.max(8, Math.round(body.x + body.w * 0.55))
          y = Math.round(Math.max(8, body.y + body.h * 0.06))
        } else {
          x = Math.round((canvas.width - w) / 2)
          y = Math.round((canvas.height - h) / 2)
        }
      }

      const layer = {
        id: nextLayerId,
        slot: slotIndex,
        img,
        x,
        y,
        w,
        h,
        flipX: false,
        rotation: 0,
      }
      nextLayerId += 1
      if (slotIndex === 0) layers.unshift(layer)
      else layers.push(layer)
      selectedId = layer.id
      paintSlotButtons()
      redrawFuse()
      const hasBody = layers.some((l) => l.slot === 0)
      const hasFace = layers.some((l) => l.slot === 1)
      if (hasBody && hasFace && headHelpStep <= 1) {
        setFuseStep(2, { announce: false })
        setFuseStatus(
          '① 재료 완료. 드래그=위치 · 휠/핀치=크기. 몸 옛 얼굴은 건너뛰고 ③ 얼굴 자르기로 가도 됩니다.',
          false,
        )
      } else {
        setFuseStatus(
          slotIndex === 0
            ? '몸·장면을 캔버스에 가득 올렸어요. 드래그·휠·핀치로 조절한 뒤 2칸에 얼굴을 넣으세요.'
            : '붙일 얼굴을 옆에 배치했어요. 드래그·휠·두 손가락 핀치로 크기·위치를 맞추세요.',
          false,
        )
      }
      return layer
    }

    function ensureFuseLasso() {
      if (fuseLasso) return fuseLasso
      if (!global.StorymagPolyLasso?.create) return null
      fuseLasso = global.StorymagPolyLasso.create(lassoCanvas, {
        onChange: () => redrawFuse(),
        onStatus: (msg, isError) => setFuseStatus(msg, isError),
        getImageSize: () => ({ w: canvas.width, h: canvas.height }),
        onClosed: () => {
          setFuseStatus(
            '올가미 닫힘(초록). 흰 점·노란 점(변)을 드래그해 다듬은 뒤 우클릭 「쓸/버릴 조각」.',
            false,
          )
        },
        getExtraMenuItems: () => {
          const hasSel = Boolean(getClosedPoly())
          if (!hasSel) return []
          return [
            {
              label: '쓸 조각 · 그린 올가미 그대로 자르기',
              action: () => {
                // 메뉴 클릭 순간 점 복사 (이후 clear/도구전환에 안 잃게)
                const poly = (getClosedPoly() || []).map((p) => ({ x: p.x, y: p.y }))
                void fuseKeepSelectionAi({ guided: false, poly })
              },
            },
            {
              label: '쓸 조각 · 자른 뒤 테두리만 AI(모양 고정)',
              action: () => {
                const poly = (getClosedPoly() || []).map((p) => ({ x: p.x, y: p.y }))
                void fuseKeepSelectionAi({ guided: true, poly })
              },
            },
            {
              label: '버릴 조각 · 배경으로 메우기',
              action: () => {
                const poly = (getClosedPoly() || []).map((p) => ({ x: p.x, y: p.y }))
                void fuseDiscardSelectionAi({ poly })
              },
            },
          ]
        },
      })
      return fuseLasso
    }

    function fuseAuthHeaders() {
      return deps.authHeaders?.() || { 'Content-Type': 'application/json' }
    }

    async function uploadDataUrl(dataUrl) {
      const upRes = await fetch('/api/upload-image', {
        method: 'POST',
        headers: fuseAuthHeaders(),
        body: JSON.stringify({ dataUrl }),
      })
      const upData = await upRes.json().catch(() => ({}))
      if (upRes.status === 401) {
        deps.showPinGate?.('세션이 만료됐어요. 다시 로그인해 주세요.')
        throw new Error('unauthorized')
      }
      if (!upData.ok || !upData.imageUrl) {
        throw new Error(upData.message || upData.error || 'upload_failed')
      }
      return upData.imageUrl
    }

    /** 흰 후광 줄이기 — 알파를 안쪽으로 조금 침식 */
    function erodeAlphaCanvas(sourceCanvas, px = 2) {
      const w = sourceCanvas.width
      const h = sourceCanvas.height
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      const octx = out.getContext('2d')
      const sctx = sourceCanvas.getContext('2d')
      if (!octx || !sctx) return sourceCanvas
      const img = sctx.getImageData(0, 0, w, h)
      const dst = octx.createImageData(w, h)
      const src = img.data
      const d = dst.data
      const r = Math.max(1, Math.round(px))
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const i = (y * w + x) * 4
          let minA = src[i + 3]
          if (minA > 0) {
            for (let dy = -r; dy <= r; dy += 1) {
              for (let dx = -r; dx <= r; dx += 1) {
                const xx = x + dx
                const yy = y + dy
                if (xx < 0 || yy < 0 || xx >= w || yy >= h) {
                  minA = 0
                  break
                }
                minA = Math.min(minA, src[(yy * w + xx) * 4 + 3])
              }
              if (minA === 0) break
            }
          }
          d[i] = src[i]
          d[i + 1] = src[i + 1]
          d[i + 2] = src[i + 2]
          d[i + 3] = minA
        }
      }
      octx.putImageData(dst, 0, 0)
      return out
    }

    /** 알파를 바깥으로 넓힘 — AI 잔머리가 올가미 밖으로 아주 조금 나올 여유 */
    function dilateAlphaCanvas(sourceCanvas, px = 2) {
      const w = sourceCanvas.width
      const h = sourceCanvas.height
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      const octx = out.getContext('2d')
      const sctx = sourceCanvas.getContext('2d')
      if (!octx || !sctx) return sourceCanvas
      const img = sctx.getImageData(0, 0, w, h)
      const dst = octx.createImageData(w, h)
      const src = img.data
      const d = dst.data
      const r = Math.max(1, Math.round(px))
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const i = (y * w + x) * 4
          let maxA = src[i + 3]
          let br = src[i]
          let bg = src[i + 1]
          let bb = src[i + 2]
          for (let dy = -r; dy <= r; dy += 1) {
            for (let dx = -r; dx <= r; dx += 1) {
              const xx = x + dx
              const yy = y + dy
              if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
              const j = (yy * w + xx) * 4
              if (src[j + 3] > maxA) {
                maxA = src[j + 3]
                br = src[j]
                bg = src[j + 1]
                bb = src[j + 2]
              }
            }
          }
          d[i] = br
          d[i + 1] = bg
          d[i + 2] = bb
          d[i + 3] = maxA
        }
      }
      octx.putImageData(dst, 0, 0)
      return out
    }

    function imageToCanvas(img) {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth || img.width
      c.height = img.naturalHeight || img.height
      const cctx = c.getContext('2d')
      if (cctx) cctx.drawImage(img, 0, 0)
      return c
    }

    /**
     * 올가미 알파(모양)는 절대 안 바꿈. 흰 후광 RGB만 AI로 살짝 보정.
     */
    function blendLassoGuidedMatte(exactCanvas, aiImage) {
      const w = exactCanvas.width
      const h = exactCanvas.height
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      const octx = out.getContext('2d')
      const exctx = exactCanvas.getContext('2d')
      if (!octx || !exctx) return exactCanvas

      const aiCanvas = document.createElement('canvas')
      aiCanvas.width = w
      aiCanvas.height = h
      const actx = aiCanvas.getContext('2d')
      if (!actx) return exactCanvas
      actx.drawImage(aiImage, 0, 0, w, h)

      const exact = exctx.getImageData(0, 0, w, h)
      const ai = actx.getImageData(0, 0, w, h)
      const edge = erodeAlphaCanvas(exactCanvas, 3).getContext('2d')?.getImageData(0, 0, w, h)
      if (!edge) return exactCanvas

      const dst = octx.createImageData(w, h)
      const e = exact.data
      const a = ai.data
      const c = edge.data
      const d = dst.data
      for (let i = 0; i < d.length; i += 4) {
        const exactA = e[i + 3]
        // 모양 = 올가미 알파 고정 (늘리거나 줄이지 않음)
        if (exactA < 8) {
          d[i + 3] = 0
          continue
        }
        d[i + 3] = exactA
        const onEdge = c[i + 3] < 40
        const nearWhite = e[i] > 230 && e[i + 1] > 230 && e[i + 2] > 230
        if (onEdge && nearWhite && a[i + 3] > 40) {
          d[i] = a[i]
          d[i + 1] = a[i + 1]
          d[i + 2] = a[i + 2]
        } else {
          d[i] = e[i]
          d[i + 1] = e[i + 1]
          d[i + 2] = e[i + 2]
        }
      }
      octx.putImageData(dst, 0, 0)
      return out
    }

    /**
     * @param {{ guided?: boolean, poly?: Array<{x:number,y:number}> }} [opts]
     * guided 기본 false — 화면에 그린 올가미와 동일한 자르기
     */
    async function fuseKeepSelectionAi(opts) {
      if (deps.isLoggedIn && !deps.isLoggedIn()) {
        deps.showPinGate?.('로그인이 필요해요.')
        return
      }
      const guided = Boolean(opts?.guided)
      const poly = (opts?.poly || getClosedPoly() || []).map((p) => ({ x: p.x, y: p.y }))
      if (poly.length < 3) {
        setFuseStatus('올가미로 영역을 닫은 뒤 다시 시도하세요.', true)
        return
      }
      try {
        setFuseStatus(
          guided
            ? '쓸 조각: 올가미 그대로 자른 뒤 흰 테두리만 AI 보정…'
            : '쓸 조각: 화면에 그린 올가미 그대로 자르는 중…',
          false,
        )
        const newLayer = await cutSelectionToNewLayer(true, { poly, preferFace: true })
        if (!newLayer?.img) return
        if (guided) {
          await refineLayerMatteAi(newLayer, { guided: true })
        }
        continueAfterKeepPiece(newLayer)
        setFuseStatus(
          guided
            ? '자르기 완료(모양=올가미 고정, 테두리만 AI). 맞추기로 이어가세요.'
            : '그린 올가미와 같은 모양으로 잘랐어요. 맞추기로 이어가세요.',
          false,
        )
      } catch (err) {
        if (err?.message === 'unauthorized') return
        setFuseStatus(err?.message || '자르기 실패', true)
      }
    }

    /**
     * AI 윤곽 정교화.
     * guided: 올가미(현재 알파) 안쪽은 유지하고 테두리만 AI — 모양이 통째로 바뀌지 않음.
     * @param {{ guided?: boolean }} [opts]
     */
    async function refineLayerMatteAi(layer, opts) {
      if (!layer?.img) throw new Error('레이어 없음')
      const guided = Boolean(opts?.guided)
      const exactCanvas = imageToCanvas(layer.img)
      const pad = 10
      const piece = document.createElement('canvas')
      piece.width = exactCanvas.width + pad * 2
      piece.height = exactCanvas.height + pad * 2
      const pctx = piece.getContext('2d')
      if (!pctx) throw new Error('canvas')
      pctx.clearRect(0, 0, piece.width, piece.height)
      pctx.drawImage(exactCanvas, pad, pad)
      const uploaded = await uploadDataUrl(piece.toDataURL('image/png'))

      setFuseStatus(
        guided ? 'AI가 올가미 가장자리(잔머리·후광)만 다듬는 중…' : 'AI 윤곽 정교화 중…',
        false,
      )
      const bgRes = await fetch('/api/remove-background', {
        method: 'POST',
        headers: fuseAuthHeaders(),
        body: JSON.stringify({ imageUrl: uploaded }),
      })
      const bgData = await bgRes.json().catch(() => ({}))
      let nextUrl = bgData.ok ? bgData.imageUrl : uploaded

      try {
        const refineRes = await fetch('/api/refine', {
          method: 'POST',
          headers: fuseAuthHeaders(),
          body: JSON.stringify({
            mode: 'text',
            genMode: 'fashion',
            imageUrl: nextUrl,
            baseDescription: 'cutout head/face piece; user lasso silhouette is the guide',
            revision: [
              guided
                ? 'EDGE MATTE ONLY: keep the overall silhouette close to the current cutout shape (user lasso).'
                : 'Precise cutout matte cleanup.',
              'Keep the EXACT same face identity, hair style, hair color, and expression.',
              'Remove white halo and jagged fringe at hair and jaw; soft hair strands OK.',
              'Do NOT invent a different head outline far from the current shape.',
              'Do NOT restyle hair or change the person. Background stays empty.',
            ].join(' '),
            mood: deps.moodField?.value || 'clean',
            size: 'portrait',
          }),
        })
        const refineData = await refineRes.json().catch(() => ({}))
        if (refineData.ok && refineData.imageUrl) nextUrl = refineData.imageUrl
      } catch {
        /* 배경제거만으로 진행 */
      }

      if (!bgData.ok && nextUrl === uploaded) {
        throw new Error(bgData.message || bgData.error || 'matte_failed')
      }

      const refined = await loadImage(nextUrl)
      let finalCanvas
      if (guided) {
        // AI 결과에서 패딩 영역 제거 후 올가미와 합성
        const aiFull = imageToCanvas(refined)
        const aiCrop = document.createElement('canvas')
        aiCrop.width = exactCanvas.width
        aiCrop.height = exactCanvas.height
        const ac = aiCrop.getContext('2d')
        if (ac) {
          // 패딩 보정: AI 출력이 pad 포함 크기일 수도, 원본 비율일 수도 있음
          if (aiFull.width >= exactCanvas.width + pad && aiFull.height >= exactCanvas.height + pad) {
            ac.drawImage(
              aiFull,
              pad,
              pad,
              exactCanvas.width,
              exactCanvas.height,
              0,
              0,
              exactCanvas.width,
              exactCanvas.height,
            )
          } else {
            ac.drawImage(aiFull, 0, 0, exactCanvas.width, exactCanvas.height)
          }
        }
        finalCanvas = blendLassoGuidedMatte(exactCanvas, aiCrop)
      } else {
        finalCanvas = document.createElement('canvas')
        finalCanvas.width = refined.naturalWidth
        finalCanvas.height = refined.naturalHeight
        const tctx = finalCanvas.getContext('2d')
        if (tctx) {
          tctx.drawImage(refined, 0, 0)
          finalCanvas = erodeAlphaCanvas(finalCanvas, 1)
        }
      }

      layer.img = await loadImage(finalCanvas.toDataURL('image/png'))
      const scale = Math.min(
        layer.w / Math.max(1, layer.img.naturalWidth),
        layer.h / Math.max(1, layer.img.naturalHeight),
        1,
      )
      const nw = Math.max(24, Math.round(layer.img.naturalWidth * scale))
      const nh = Math.max(24, Math.round(layer.img.naturalHeight * scale))
      const cx = layer.x + layer.w / 2
      const cy = layer.y + layer.h / 2
      layer.w = nw
      layer.h = nh
      layer.x = Math.round(cx - nw / 2)
      layer.y = Math.round(cy - nh / 2)
    }

    async function fuseAiMatteSelected() {
      if (deps.isLoggedIn && !deps.isLoggedIn()) {
        deps.showPinGate?.('로그인이 필요해요.')
        return
      }
      const layer = selectedLayer()
      if (!layer) {
        setFuseStatus('윤곽을 다듬을 얼굴 조각을 먼저 클릭해 선택하세요.', true)
        return
      }
      try {
        setFuseStatus('선택 조각 AI 윤곽 정교화(올가미 가이드) 중…', false)
        await refineLayerMatteAi(layer, { guided: true })
        paintSlotButtons()
        redrawFuse()
        setFuseStatus(
          '올가미를 따라 가장자리만 정교화했어요. 맞추기 또는 AI 최종 완성으로 이어가세요.',
          false,
        )
      } catch (err) {
        if (err?.message === 'unauthorized') return
        setFuseStatus(err?.message || '윤곽 정교화 실패', true)
      }
    }

    /**
     * 버릴 조각: 선택 레이어(보통 몸)만 메움 — 붙일 얼굴 레이어는 절대 지우지 않음.
     * 끝나면 자동으로 붙일 얼굴 선택 + 올가미(쓸 조각)로 이어짐.
     * @param {{ poly?: Array<{x:number,y:number}> }} [opts]
     */
    async function fuseDiscardSelectionAi(opts) {
      if (deps.isLoggedIn && !deps.isLoggedIn()) {
        deps.showPinGate?.('로그인이 필요해요.')
        return
      }
      const points = (opts?.poly || getClosedPoly() || []).map((p) => ({ x: p.x, y: p.y }))
      if (points.length < 3) {
        setFuseStatus('버릴 영역을 올가미로 닫은 뒤 우클릭하세요.', true)
        return
      }
      let layer = selectedLayer()
      // 연속 흐름: 선택이 없으면 몸·장면 우선
      if (!layer) {
        layer = layers.find((l) => l.slot === 0) || null
        if (layer) selectedId = layer.id
      }
      if (!layer) {
        setFuseStatus('지울 레이어(보통 몸·장면)를 먼저 클릭해 선택한 뒤 다시 시도하세요.', true)
        return
      }
      try {
        setFuseStatus('버릴 조각: 몸만 마스크·업로드 (붙일 얼굴은 유지)…', false)
        const maskDataUrl = ensureFuseLasso()?.buildMaskDataUrl?.(1280, {
          expandPx: 14,
          blurPx: 3,
          pointsList: [points],
        })
        if (!maskDataUrl) {
          setFuseStatus('마스크를 만들지 못했어요. 올가미를 다시 닫아 주세요.', true)
          return
        }
        // ★ 핵심: 전체 flat이 아니라 이 레이어만 export → 붙일 얼굴이 결과/레이어 목록에서 안 사라짐
        const bodyOnly = exportOnlyLayersDataUrl([layer], 'image/jpeg', 0.92)
        const imageUrl = await uploadDataUrl(bodyOnly)
        const current = deps.getCurrentResult?.() || {}
        const revision = [
          'Fill ONLY the masked region with a seamless continuation of the surrounding background',
          '(classroom, office, wall, furniture, floor, window — whatever is adjacent).',
          'Remove leftover head, hair, white halo, cutout fringe inside the mask.',
          'Do NOT leave a blank white rectangle or solid color block.',
          'Do NOT change unmasked people, faces, clothing, or camera framing.',
          'Photorealistic lighting and color match to neighbors.',
        ].join(' ')
        setFuseStatus('AI가 옛 머리 자리를 배경으로 메우는 중…', false)
        const refineRes = await fetch('/api/refine', {
          method: 'POST',
          headers: fuseAuthHeaders(),
          body: JSON.stringify({
            mode: 'region',
            genMode: 'fashion',
            imageUrl,
            maskDataUrl,
            baseDescription: current.prompt || 'fuse body scene',
            revision,
            mood: current.mood || deps.moodField?.value || 'clean',
            size: current.size || 'portrait',
            regionCount: 1,
          }),
        })
        const refineRaw = await refineRes.text()
        let refineData = {}
        try {
          refineData = refineRaw ? JSON.parse(refineRaw) : {}
        } catch {
          refineData = {}
        }
        if (refineRes.status === 401) {
          deps.showPinGate?.('세션이 만료됐어요. 다시 로그인해 주세요.')
          return
        }
        if (refineData.ok && refineData.imageUrl) {
          await setLayerFromFullCanvasUrl(layer, refineData.imageUrl)
          ensureFuseLasso()?.clearAll()
          paintSlotButtons()
          redrawFuse()
          continueToKeepFaceStep()
          return
        }

        setFuseStatus(
          `영역 메우기 1차 실패(${refineData.error || refineRes.status}) → 흰 칸 보정 재시도…`,
          false,
        )
        await punchHoleInLayer(layer, points)
        ensureFuseLasso()?.clearAll()
        paintSlotButtons()
        redrawFuse()
        const holeFlat = exportOnlyLayersDataUrl([layer], 'image/jpeg', 0.92)
        const holeUrl = await uploadDataUrl(holeFlat)
        const healRevision = [
          'There is a blank white rectangle or empty patch where a head was removed.',
          'Fill ONLY that white/empty hole with seamless continuation of the surrounding room background.',
          'No white block left. Keep the body and clothing unchanged.',
          'Photorealistic match to neighboring wall/furniture/floor.',
        ].join(' ')
        const healRes = await fetch('/api/refine', {
          method: 'POST',
          headers: fuseAuthHeaders(),
          body: JSON.stringify({
            mode: 'text',
            genMode: 'fashion',
            imageUrl: holeUrl,
            baseDescription: current.prompt || 'body scene with white hole',
            revision: healRevision,
            mood: current.mood || deps.moodField?.value || 'clean',
            size: current.size || 'portrait',
          }),
        })
        const healData = await healRes.json().catch(() => ({}))
        if (healData.ok && healData.imageUrl) {
          await setLayerFromFullCanvasUrl(layer, healData.imageUrl)
          paintSlotButtons()
          redrawFuse()
          continueToKeepFaceStep()
          return
        }
        // 구멍만 남은 경우에도 붙일 얼굴은 유지한 채 다음 단계로
        paintSlotButtons()
        redrawFuse()
        continueToKeepFaceStep()
        setFuseStatus(
          `배경 메우기는 덜 됐지만(구멍) 붙일 얼굴은 그대로입니다. 올가미 「쓸 조각」을 이어 하세요. (${healData.error || refineData.error || 'fail'})`,
          true,
        )
      } catch (err) {
        if (err?.message === 'unauthorized') return
        setFuseStatus(err?.message || '배경 메우기 실패', true)
      }
    }

    function clearAlignSession() {
      alignSession = null
    }

    function alignStatusText() {
      if (!alignSession) {
        return '포인트 맞춤: 먼저 옮길 레이어를 클릭해 선택하세요. (머리 조각 등)'
      }
      const nSrc = alignSession.src.length
      const nDst = alignSession.dst.length
      if (nSrc < 2) {
        return `포인트 맞춤 A${nSrc + 1}/2: 옮길 레이어 위에서 기준점 ${nSrc + 1}을 찍으세요. (예: 왼쪽 눈 → 오른쪽 눈, 또는 이마 → 턱)`
      }
      if (nDst < 2) {
        return `포인트 맞춤 B${nDst + 1}/2: 목표 위치(몸/배경)에서 같은 순서의 대응점을 찍으세요.`
      }
      return '맞추는 중…'
    }

    function dist(a, b) {
      const dx = b.x - a.x
      const dy = b.y - a.y
      return Math.hypot(dx, dy)
    }

    async function applyAlignTransform() {
      if (!alignSession || alignSession.src.length < 2 || alignSession.dst.length < 2) return
      const layer = layers.find((l) => l.id === alignSession.layerId)
      if (!layer) {
        setFuseStatus('맞춤 대상 레이어를 찾을 수 없어요.', true)
        clearAlignSession()
        return
      }
      const [a1, a2] = alignSession.src
      const [b1, b2] = alignSession.dst
      const srcLen = dist(a1, a2)
      const dstLen = dist(b1, b2)
      if (srcLen < 4 || dstLen < 4) {
        setFuseStatus('점이 너무 가깝습니다. 두 점을 더 멀리 찍어 다시 시도하세요.', true)
        clearAlignSession()
        redrawFuse()
        return
      }
      const s = dstLen / srcLen
      const dAngle =
        Math.atan2(b2.y - b1.y, b2.x - b1.x) - Math.atan2(a2.y - a1.y, a2.x - a1.x)
      const oldC = layerCenter(layer)
      const dx = (oldC.x - a1.x) * s
      const dy = (oldC.y - a1.y) * s
      const cos = Math.cos(dAngle)
      const sin = Math.sin(dAngle)
      const newC = {
        x: b1.x + dx * cos - dy * sin,
        y: b1.y + dx * sin + dy * cos,
      }
      layer.w = Math.max(24, Math.round(layer.w * s))
      layer.h = Math.max(24, Math.round(layer.h * s))
      layer.rotation = (layer.rotation || 0) + dAngle
      layer.x = Math.round(newC.x - layer.w / 2)
      layer.y = Math.round(newC.y - layer.h / 2)
      selectedId = layer.id
      clearAlignSession()
      setTool('move')
      redrawFuse()

      // 몸에 맞춘 뒤 → 자투리만 치움(몸통에 구멍 안 뚫음)
      const isFacePiece = layer.slot !== 0
      if (isFacePiece && layers.some((l) => l.slot === 0)) {
        await eraseBodyFaceUnderPiece(layer)
        selectedId = layer.id
        paintSlotButtons()
        redrawFuse()
        setFuseStep(6, { announce: false })
        setFuseStatus(
          '맞춤 완료(몸통 그대로). 옛 얼굴이 비치면 「버릴 조각」, 올가미 자국·목 이음은 「AI로 자연스럽게」.',
          false,
        )
        return
      }
      setFuseStatus('포인트를 맞춰 배치했어요. 미세 조정은 드래그·휠로.', false)
    }

    function beginAlignSession(layer) {
      alignSession = { layerId: layer.id, src: [], dst: [] }
      selectedId = layer.id
      setFuseStatus(alignStatusText(), false)
      redrawFuse()
    }

    function handleAlignClick(p) {
      if (!alignSession) {
        const hit = hitLayer(p.x, p.y)
        if (!hit) {
          setFuseStatus('옮길 레이어를 먼저 클릭해 선택하세요.', true)
          return
        }
        beginAlignSession(hit)
      }
      if (!alignSession) return

      if (alignSession.src.length < 2) {
        const layer = layers.find((l) => l.id === alignSession.layerId)
        if (!layer || !pointInLayer(layer, p)) {
          setFuseStatus('A점은 선택한(옮길) 레이어 위에 찍어야 합니다.', true)
          return
        }
        alignSession.src.push({ x: p.x, y: p.y })
        setFuseStatus(alignStatusText(), false)
        redrawFuse()
        return
      }

      if (alignSession.dst.length < 2) {
        alignSession.dst.push({ x: p.x, y: p.y })
        setFuseStatus(alignStatusText(), false)
        redrawFuse()
        if (alignSession.dst.length === 2) void applyAlignTransform()
      }
    }

    function setTool(next) {
      const prev = tool
      tool = next === 'lasso' ? 'lasso' : next === 'align' ? 'align' : 'move'
      document.querySelectorAll('[data-fuse-tool]').forEach((btn) => {
        const on = btn.getAttribute('data-fuse-tool') === tool
        btn.classList.toggle('admin-subnav__btn--active', on)
        btn.setAttribute('aria-pressed', on ? 'true' : 'false')
      })
      syncLassoSize()
      const lasso = ensureFuseLasso()
      canvas.classList.toggle('admin-fuse-canvas--align', tool === 'align')
      if (tool === 'lasso') {
        clearAlignSession()
        lassoCanvas.classList.add('admin-fuse-lasso--active')
        lasso?.setEnabled(true)
        setFuseStatus(
          '올가미: 그린 뒤 Enter로 닫고 우클릭 → 「그린 올가미 그대로 자르기」/ 「버릴 조각」.',
          false,
        )
      } else {
        lassoCanvas.classList.remove('admin-fuse-lasso--active')
        lasso?.setEnabled(false)
        const lctx = lassoCanvas.getContext('2d')
        if (lctx) lctx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height)
        if (tool === 'align') {
          if (prev !== 'align') clearAlignSession()
          const layer = selectedLayer()
          if (layer) beginAlignSession(layer)
          else setFuseStatus(alignStatusText(), false)
        } else {
          clearAlignSession()
          setFuseStatus('이동: 드래그로 배치 · 우클릭으로 레이어 조작.', false)
        }
      }
      redrawFuse()
    }

    function getClosedPoly() {
      const regions = ensureFuseLasso()?.getRegions?.() || []
      if (!regions.length) return null
      return regions[regions.length - 1].points
    }

    /** 레이캐스팅 — 캔버스 fill AA와 무관하게 올가미 경로 그대로 */
    function pointInPoly(x, y, poly) {
      let inside = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const xi = poly[i].x
        const yi = poly[i].y
        const xj = poly[j].x
        const yj = poly[j].y
        const intersect =
          yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0000001) + xi
        if (intersect) inside = !inside
      }
      return inside
    }

    function polyAabb(poly, w, h) {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const p of poly) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
      }
      return {
        minX: Math.max(0, Math.floor(minX)),
        minY: Math.max(0, Math.floor(minY)),
        maxX: Math.min(w - 1, Math.ceil(maxX)),
        maxY: Math.min(h - 1, Math.ceil(maxY)),
      }
    }

    /** 화면 좌표 폴리곤 → 이진(0/255) 마스크 (포인트인폴리곤, AA 없음) */
    function buildHardPolyMask(poly, w, h) {
      const mask = document.createElement('canvas')
      mask.width = w
      mask.height = h
      const mctx = mask.getContext('2d', { willReadFrequently: true })
      if (!mctx) return null
      const img = mctx.createImageData(w, h)
      const d = img.data
      const box = polyAabb(poly, w, h)
      for (let y = box.minY; y <= box.maxY; y += 1) {
        for (let x = box.minX; x <= box.maxX; x += 1) {
          if (!pointInPoly(x + 0.5, y + 0.5, poly)) continue
          const i = (y * w + x) * 4
          d[i] = 255
          d[i + 1] = 255
          d[i + 2] = 255
          d[i + 3] = 255
        }
      }
      mctx.putImageData(img, 0, 0)
      return mask
    }

    /**
     * 올가미 안에 픽셀이 가장 많은 레이어.
     * preferFace=true(쓸 조각)이면 몸통(slot0)은 절대 고르지 않음 —
     * 몸 얼굴을 잘라 쓰면 붙일 얼굴이 사라지고 “새 얼굴”처럼 보임.
     */
    function pickLayerUnderPoly(poly, preferFace) {
      if (!poly?.length || !layers.length) return null
      const box = polyAabb(poly, canvas.width, canvas.height)
      let best = null
      let bestScore = 0
      for (const layer of layers) {
        if (preferFace && layer.slot === 0) continue
        const tmp = document.createElement('canvas')
        tmp.width = canvas.width
        tmp.height = canvas.height
        const tctx = tmp.getContext('2d', { willReadFrequently: true })
        if (!tctx) continue
        drawLayerTo(tctx, layer)
        const data = tctx.getImageData(box.minX, box.minY, box.maxX - box.minX + 1, box.maxY - box.minY + 1).data
        const bw = box.maxX - box.minX + 1
        let score = 0
        for (let y = box.minY; y <= box.maxY; y += 1) {
          for (let x = box.minX; x <= box.maxX; x += 1) {
            if (!pointInPoly(x + 0.5, y + 0.5, poly)) continue
            const i = ((y - box.minY) * bw + (x - box.minX)) * 4
            if (data[i + 3] > 16) score += 1
          }
        }
        if (score > bestScore) {
          bestScore = score
          best = layer
        }
      }
      return bestScore > 0 ? best : null
    }

    /**
     * 화면에 그린 올가미 좌표 그대로 자름 (포인트인폴리곤 + 올가미 AABB).
     * @param {boolean} punchSource
     * @param {{ poly?: Array<{x:number,y:number}>, preferFace?: boolean }} [opts]
     */
    async function cutSelectionToNewLayer(punchSource, opts) {
      syncLassoSize()
      const poly = (opts?.poly || getClosedPoly() || []).map((p) => ({ x: p.x, y: p.y }))
      if (poly.length < 3) {
        setFuseStatus('올가미로 영역을 닫아 주세요 (점 3개+ → Enter).', true)
        return null
      }

      let layer = selectedLayer()
      if (opts?.preferFace) {
        // 쓸 조각: 몸통에서 자르기 금지 — 선택/자동선택 모두 얼굴 레이어만
        if (layer?.slot === 0) layer = null
        const best = pickLayerUnderPoly(poly, true)
        if (best) {
          layer = best
          selectedId = best.id
        }
        if (!layer || layer.slot === 0) {
          setFuseStatus(
            '쓸 조각은 「붙일 얼굴」사진 위에서만 자르세요. 얼굴 레이어를 클릭한 뒤 올가미를 다시 그리세요.',
            true,
          )
          return null
        }
      } else if (punchSource) {
        const best = pickLayerUnderPoly(poly, false)
        if (best) {
          layer = best
          selectedId = best.id
        }
      }
      if (!layer) {
        setFuseStatus('먼저 자를 레이어(붙일 얼굴)를 클릭해 선택하세요.', true)
        return null
      }

      const full = document.createElement('canvas')
      full.width = canvas.width
      full.height = canvas.height
      const fctx = full.getContext('2d', { willReadFrequently: true })
      if (!fctx) return null
      fctx.clearRect(0, 0, full.width, full.height)
      fctx.imageSmoothingEnabled = true
      fctx.imageSmoothingQuality = 'high'
      drawLayerTo(fctx, layer)
      const fullData = fctx.getImageData(0, 0, full.width, full.height)

      // 크롭 프레임 = 올가미 AABB (내용물 bbox가 아님 → 모양이 줄어들지 않음)
      const box = polyAabb(poly, full.width, full.height)
      const outW = Math.max(1, box.maxX - box.minX + 1)
      const outH = Math.max(1, box.maxY - box.minY + 1)
      const out = document.createElement('canvas')
      out.width = outW
      out.height = outH
      const octx = out.getContext('2d')
      if (!octx) return null
      const outImg = octx.createImageData(outW, outH)
      let opaque = 0
      for (let y = box.minY; y <= box.maxY; y += 1) {
        for (let x = box.minX; x <= box.maxX; x += 1) {
          if (!pointInPoly(x + 0.5, y + 0.5, poly)) continue
          const si = (y * full.width + x) * 4
          const di = ((y - box.minY) * outW + (x - box.minX)) * 4
          const a = fullData.data[si + 3]
          if (a < 8) continue
          outImg.data[di] = fullData.data[si]
          outImg.data[di + 1] = fullData.data[si + 1]
          outImg.data[di + 2] = fullData.data[si + 2]
          outImg.data[di + 3] = a
          opaque += 1
        }
      }
      if (opaque < 8) {
        setFuseStatus(
          '올가미 안에 붙일 얼굴 픽셀이 거의 없어요. 얼굴 사진 위를 올가미로 그린 뒤 다시 자르세요.',
          true,
        )
        return null
      }
      octx.putImageData(outImg, 0, 0)

      if (punchSource) {
        if (layer.slot === 0) {
          await punchHoleInLayer(layer, poly)
        } else {
          layers = layers.filter((l) => l.id !== layer.id)
        }
      }

      const img = await loadImage(out.toDataURL('image/png'))
      const slot = nextFreeSlot
      nextFreeSlot += 1
      const newLayer = {
        id: nextLayerId,
        slot,
        img,
        x: box.minX,
        y: box.minY,
        w: outW,
        h: outH,
        flipX: false,
        rotation: 0,
      }
      nextLayerId += 1
      layers.push(newLayer)
      selectedId = newLayer.id
      if (punchSource && newLayer.slot !== 0) {
        keepOnlyBodyAndPiece(newLayer)
      }

      // 검증용: 그린 올가미를 몇 초간 초록 선으로 유지
      ghostCutPoly = poly
      if (ghostCutTimer) window.clearTimeout(ghostCutTimer)
      ghostCutTimer = window.setTimeout(() => {
        ghostCutPoly = null
        redrawFuse()
      }, 5000)

      ensureFuseLasso()?.clearAll()
      paintSlotButtons()
      redrawFuse()
      setTool('move')
      setFuseStatus(
        punchSource
          ? '올가미 경계=자른 경계(초록 선 5초). 원본 얼굴 사진은 지웠어요.'
          : '선택 부분을 새 레이어로 복사했어요. (원본은 그대로)',
        false,
      )
      if (headHelpStep <= 3) {
        setFuseStep(4, { announce: false })
      }
      return newLayer
    }

    async function punchHoleInLayer(layer, canvasPoints) {
      // 화면 좌표 마스크로 레이어를 뚫음 (그린 올가미와 동일)
      const full = document.createElement('canvas')
      full.width = canvas.width
      full.height = canvas.height
      const fctx = full.getContext('2d')
      if (!fctx) return
      fctx.clearRect(0, 0, full.width, full.height)
      drawLayerTo(fctx, layer)

      const mask = buildHardPolyMask(canvasPoints, full.width, full.height)
      if (!mask) return

      fctx.globalCompositeOperation = 'destination-out'
      fctx.drawImage(mask, 0, 0)
      fctx.globalCompositeOperation = 'source-over'

      // 레이어 사각 영역만 다시 샘플 → natural 이미지로 베이크
      const nat = document.createElement('canvas')
      nat.width = layer.img.naturalWidth
      nat.height = layer.img.naturalHeight
      const nctx = nat.getContext('2d')
      if (!nctx) return
      nctx.drawImage(layer.img, 0, 0)

      // 레이어 표시 영역을 full에서 읽어 natural에 덮어씀
      const tmp = document.createElement('canvas')
      tmp.width = Math.max(1, Math.round(layer.w))
      tmp.height = Math.max(1, Math.round(layer.h))
      const tctx = tmp.getContext('2d')
      if (!tctx) return
      tctx.drawImage(
        full,
        layer.x,
        layer.y,
        layer.w,
        layer.h,
        0,
        0,
        tmp.width,
        tmp.height,
      )
      // 회전·플립이 있으면 단순 사각 샘플이 어긋날 수 있어, 회전 없을 때만 이 경로.
      // 회전 있으면 기존 natural 폴리곤 펀치로 폴백.
      if (Math.abs(layer.rotation || 0) > 0.001 || layer.flipX) {
        const natPts = canvasPointsToNatural(layer, canvasPoints)
        const c = document.createElement('canvas')
        c.width = layer.img.naturalWidth
        c.height = layer.img.naturalHeight
        const cctx = c.getContext('2d')
        if (!cctx) return
        cctx.drawImage(layer.img, 0, 0)
        const pm = document.createElement('canvas')
        pm.width = c.width
        pm.height = c.height
        const pmctx = pm.getContext('2d')
        if (!pmctx) return
        pmctx.fillStyle = '#fff'
        pmctx.beginPath()
        pmctx.moveTo(natPts[0].x, natPts[0].y)
        for (let i = 1; i < natPts.length; i += 1) pmctx.lineTo(natPts[i].x, natPts[i].y)
        pmctx.closePath()
        pmctx.fill()
        cctx.globalCompositeOperation = 'destination-out'
        cctx.drawImage(pm, 0, 0)
        layer.img = await loadImage(c.toDataURL('image/png'))
        return
      }

      nctx.clearRect(0, 0, nat.width, nat.height)
      nctx.drawImage(tmp, 0, 0, nat.width, nat.height)
      layer.img = await loadImage(nat.toDataURL('image/png'))
    }

    /**
     * 몸·장면(슬롯0) + 지금 선택한 조각만 남기고 나머지 레이어 삭제.
     * 머리만 자른 뒤 남은 증명사진 사각형 등을 치울 때 사용.
     */
    function cleanupLeftoverLayers({ silentConfirm = false } = {}) {
      if (!layers.length) {
        setFuseStatus('치울 레이어가 없어요.', true)
        return false
      }
      const keepIds = new Set()
      const body = layers.find((l) => l.slot === 0)
      if (body) keepIds.add(body.id)
      const selected = selectedLayer()
      if (selected) keepIds.add(selected.id)
      if (!selected && layers.length > 1) {
        setFuseStatus(
          '남길 조각을 먼저 클릭해 고른 뒤 「남은 조각 치우기」를 누르세요. (몸·장면은 자동으로 남습니다)',
          true,
        )
        return false
      }
      if (keepIds.size === 0) {
        setFuseStatus('남길 레이어를 선택해 주세요.', true)
        return false
      }
      const before = layers.length
      const removed = layers.filter((l) => !keepIds.has(l.id))
      if (!removed.length) {
        if (!silentConfirm) {
          setFuseStatus('치울 남은 조각이 없어요. 몸·장면과 선택 조각만 있습니다.', false)
        }
        return true
      }
      if (!silentConfirm) {
        const ok = window.confirm(
          `몸·장면과 지금 고른 조각만 남기고, 나머지 ${removed.length}개를 지울까요?\n(증명사진 원본·안 쓰는 레이어)`,
        )
        if (!ok) return false
      }
      layers = layers.filter((l) => keepIds.has(l.id))
      if (alignSession && !layers.some((l) => l.id === alignSession.layerId)) {
        clearAlignSession()
      }
      if (selectedId != null && !layers.some((l) => l.id === selectedId)) {
        selectedId = layers[layers.length - 1]?.id ?? null
      }
      paintSlotButtons()
      redrawFuse()
      setTool('move')
      setFuseStep(5, { announce: false })
      setFuseStatus(
        `④ 버릴 조각 ${removed.length}개 치움 (${before} → ${layers.length}). ⑤ 맞추기 후 ⑥ AI 최종 완성.`,
        false,
      )
      return true
    }

    async function punchSelected() {
      // 「옛 머리 지우기」= 올가미로 지정한 부분만 투명하게 뚫음 (버튼만 누르면 변화 없음)
      const layer = selectedLayer()
      if (!layer) {
        setTool('lasso')
        setFuseStatus(
          '옛 머리 지우기: ① 몸·장면 레이어를 클릭해 선택 ② 올가미로 지울 머리 그리기 ③ 다시 「옛 머리 지우기」.',
          true,
        )
        return
      }
      const points = getClosedPoly()
      if (!points || points.length < 3) {
        setTool('lasso')
        setFuseStatus(
          '아직 지울 영역이 없어요. 올가미로 옛 머리 위를 따라 그린 뒤(닫기) 다시 「옛 머리 지우기」를 누르세요.',
          true,
        )
        return
      }
      await punchHoleInLayer(layer, points)
      ensureFuseLasso()?.clearAll()
      paintSlotButtons()
      redrawFuse()
      setTool('move')
      setFuseStatus('옛 머리 자리를 뚫었어요. 그 위에 붙인 얼굴 조각을 올리세요.', false)
    }

    function scaleLayer(layer, factor) {
      const c = layerCenter(layer)
      layer.w = Math.max(24, Math.round(layer.w * factor))
      layer.h = Math.max(24, Math.round(layer.h * factor))
      layer.x = Math.round(c.x - layer.w / 2)
      layer.y = Math.round(c.y - layer.h / 2)
    }

    function rotateLayer(layer, deltaRad) {
      layer.rotation = (layer.rotation || 0) + deltaRad
    }

    function showContextMenu(clientX, clientY, layer) {
      document.querySelectorAll('.poly-lasso-menu[data-fuse-menu]').forEach((el) => el.remove())
      const menu = document.createElement('div')
      menu.className = 'poly-lasso-menu'
      menu.setAttribute('data-fuse-menu', '1')
      const actions = [
        {
          label: '앞으로',
          run: () => {
            layers = layers.filter((l) => l.id !== layer.id)
            layers.push(layer)
          },
        },
        {
          label: '뒤로',
          run: () => {
            layers = layers.filter((l) => l.id !== layer.id)
            layers.unshift(layer)
          },
        },
        {
          label: '조금 키우기',
          run: () => scaleLayer(layer, 1.08),
        },
        {
          label: '조금 줄이기',
          run: () => scaleLayer(layer, 1 / 1.08),
        },
        {
          label: '조금 시계방향',
          run: () => rotateLayer(layer, (5 * Math.PI) / 180),
        },
        {
          label: '조금 반시계',
          run: () => rotateLayer(layer, (-5 * Math.PI) / 180),
        },
        {
          label: '좌우 반전',
          run: () => {
            layer.flipX = !layer.flipX
          },
        },
        {
          label: '삭제',
          run: () => {
            layers = layers.filter((l) => l.id !== layer.id)
            selectedId = null
            if (alignSession?.layerId === layer.id) clearAlignSession()
          },
        },
      ]
      actions.forEach((item) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'poly-lasso-menu__item'
        b.textContent = item.label
        b.addEventListener('click', () => {
          item.run()
          menu.remove()
          paintSlotButtons()
          redrawFuse()
        })
        menu.appendChild(b)
      })
      document.body.appendChild(menu)
      menu.style.left = `${Math.min(clientX, window.innerWidth - 160)}px`
      menu.style.top = `${Math.min(clientY, window.innerHeight - 200)}px`
      const close = () => {
        menu.remove()
        document.removeEventListener('click', close, true)
      }
      window.setTimeout(() => document.addEventListener('click', close, true), 0)
    }

    document.querySelectorAll('[data-fuse-tool]').forEach((btn) => {
      btn.addEventListener('click', () => setTool(btn.getAttribute('data-fuse-tool') || 'move'))
    })

    function isFusePanelOpen() {
      return Boolean(fusePanel && !fusePanel.hidden)
    }

    function nextImportSlot() {
      for (let i = 0; i < 3; i += 1) {
        if (!layers.some((l) => l.slot === i)) return i
      }
      return activeSlot
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(reader.error || new Error('read failed'))
        reader.readAsDataURL(file)
      })
    }

    /** Windows 붙여넣기·드롭은 type/name 이 비는 경우가 많음 */
    function isImageFile(file) {
      if (!file) return false
      if (String(file.type || '').startsWith('image/')) return true
      if (/\.(png|jpe?g|webp|gif|bmp|avif|heic|jfif)$/i.test(String(file.name || ''))) return true
      // 캡처 붙여넣기: name="", type="" 인데 size만 있는 File/Blob
      if (file.size > 32 && !String(file.type || '') && !String(file.name || '')) return true
      return false
    }

    function pickImageFiles(dt) {
      if (!dt) return []
      const out = []
      const seen = new Set()
      const push = (f) => {
        if (!f || !isImageFile(f)) return
        const key = `${f.name || 'paste'}|${f.size}|${f.lastModified || 0}`
        if (seen.has(key)) return
        seen.add(key)
        // MIME 비어 있으면 image/png 로 보정 (FileReader·서버 친화)
        if (!f.type && f.size > 0) {
          try {
            out.push(new File([f], f.name || 'paste.png', { type: 'image/png' }))
            return
          } catch {
            /* fall through */
          }
        }
        out.push(f)
      }
      if (dt.files?.length) {
        for (const f of dt.files) push(f)
      }
      if (dt.items?.length) {
        for (const item of dt.items) {
          const mime = String(item.type || '')
          if (mime.startsWith('image/') || item.kind === 'file') {
            push(item.getAsFile?.())
          }
        }
      }
      return out
    }

    function extractImageUrlFromDataTransfer(dt) {
      if (!dt?.getData) return ''
      const uriList = String(dt.getData('text/uri-list') || '')
        .split('\n')
        .map((s) => s.trim())
        .find((s) => s && !s.startsWith('#') && /^(https?:|data:image\/)/i.test(s))
      if (uriList) return uriList
      const plain = String(dt.getData('text/plain') || '').trim()
      if (/^(https?:\/\/\S+|data:image\/)/i.test(plain)) return plain.split(/\s+/)[0]
      const html = String(dt.getData('text/html') || '')
      const m = html.match(/<img[^>]+src=["']([^"']+)["']/i)
      if (m?.[1] && /^(https?:|data:image\/|blob:)/i.test(m[1])) return m[1]
      return ''
    }

    async function importFiles(files) {
      const list = Array.from(files || []).filter(isImageFile)
      if (!list.length) {
        setFuseStatus('이미지 파일이 없어요. PNG/JPEG/WEBP/GIF을 드롭하거나 Ctrl+V 하세요.', true)
        return
      }
      let slot = activeSlot
      for (let i = 0; i < list.length; i += 1) {
        if (i > 0) slot = nextImportSlot()
        activeSlot = slot
        try {
          const dataUrl = await readFileAsDataUrl(list[i])
          await placeImage(dataUrl, slot)
        } catch (err) {
          setFuseStatus(err?.message || '불러오기 실패', true)
          return
        }
      }
      setFuseStatus(
        list.length > 1
          ? `${list.length}장을 슬롯에 올려 그림판에 표시했어요.`
          : `슬롯 ${activeSlot + 1}에 올려 그림판에 표시했어요.`,
        false,
      )
    }

    async function importDataTransfer(dt, slotIndex) {
      if (slotIndex != null) activeSlot = Number(slotIndex) || 0
      const files = pickImageFiles(dt)
      if (files.length) {
        await importFiles(files)
        return
      }
      const url = extractImageUrlFromDataTransfer(dt)
      if (url) {
        await importFromUrlOrData(url, '끌어온 이미지')
        return
      }
      setFuseStatus('이미지 파일·그림을 이 칸에 놓아 주세요.', true)
    }

    async function importFromUrlOrData(url, label) {
      if (!url) {
        setFuseStatus(`${label || '이미지'}를 찾을 수 없어요.`, true)
        return
      }
      try {
        await placeImage(url, activeSlot)
        setFuseStatus(`${label || '이미지'}를 슬롯 ${activeSlot + 1}·그림판에 넣었어요.`, false)
      } catch (err) {
        setFuseStatus(err?.message || '가져오기 실패', true)
      }
    }

    function clearPasteCatcher() {
      if (pasteCatcher) pasteCatcher.innerHTML = ''
    }

    async function pasteFromClipboard(event) {
      setFuseStatus('붙여넣는 중…', false)
      const fromEvent = event?.clipboardData ? pickImageFiles(event.clipboardData) : []
      if (fromEvent.length) {
        await importFiles(fromEvent)
        clearPasteCatcher()
        return true
      }
      const urlFromEvent = event?.clipboardData ? extractImageUrlFromDataTransfer(event.clipboardData) : ''
      if (urlFromEvent) {
        await importFromUrlOrData(urlFromEvent, '붙여넣은 이미지')
        clearPasteCatcher()
        return true
      }

      // paste 이벤트 안 HTML에 인라인 img/data URL
      if (event?.clipboardData) {
        const html = String(event.clipboardData.getData('text/html') || '')
        const dataM = html.match(/src=["'](data:image\/[^"']+)["']/i)
        if (dataM?.[1]) {
          await importFromUrlOrData(dataM[1], '붙여넣은 이미지')
          clearPasteCatcher()
          return true
        }
      }

      // 버튼 클릭 경로: Async Clipboard API
      try {
        if (navigator.clipboard?.read) {
          const items = await navigator.clipboard.read()
          for (const item of items) {
            const types = item.types || []
            const type =
              types.find((t) => String(t).startsWith('image/')) ||
              types.find((t) => /^(png|jpeg|jpg|webp|gif)$/i.test(String(t)))
            if (!type) continue
            const mime = String(type).startsWith('image/')
              ? String(type)
              : `image/${String(type).toLowerCase() === 'jpg' ? 'jpeg' : String(type).toLowerCase()}`
            const blob = await item.getType(mime)
            const file = new File([blob], 'paste.png', { type: blob.type || mime || 'image/png' })
            await importFiles([file])
            clearPasteCatcher()
            return true
          }
        }
      } catch (err) {
        // 권한 거부 시 캐처에 포커스해 Ctrl+V 유도
        pasteCatcher?.focus?.()
        setFuseStatus(
          '노란 칸이 보이면 바로 Ctrl+V 하세요. (또는 주소창 자물쇠 → 클립보드 허용)',
          true,
        )
        return false
      }

      pasteCatcher?.focus?.()
      setFuseStatus(
        `그림을 복사한 뒤 노란 칸(또는 「붙여넣기」)에서 Ctrl+V — 칸 ${activeSlot + 1}`,
        true,
      )
      return false
    }

    function armPasteCatcher() {
      if (!pasteCatcher) {
        void pasteFromClipboard()
        return
      }
      clearPasteCatcher()
      pasteCatcher.focus()
      setFuseStatus('노란 칸에 포커스됨 → 지금 Ctrl+V 로 그림을 붙이세요.', false)
      // 권한이 있으면 버튼만으로도 시도
      void pasteFromClipboard()
    }

    async function runFusePick(kind) {
      if (kind === 'file') {
        // showModal 닫은 뒤에는 파일창이 막히는 브라우저가 있음 → 닫기 전에 클릭
        fileInput.click()
        closePickDialog()
        return
      }
      closePickDialog()
      if (kind === 'paste') {
        armPasteCatcher()
        return
      }
      if (kind === 'gallery') {
        openGalleryPicker()
        return
      }
      if (kind === 'camera') {
        void openCamera()
        return
      }
      if (kind === 'result') {
        const current = deps.getCurrentResult?.()
        const url = current?.imageDataUrl || current?.imageUrl
        if (!url) {
          setFuseStatus('지금 보고 있는 결과 사진이 없어요. 먼저 화보를 만들거나 불러오세요.', true)
          return
        }
        await importFromUrlOrData(url, '지금 결과')
      }
    }

    function clearSlotDropStyles() {
      document.querySelectorAll('.admin-fuse-slot--drop').forEach((el) => {
        el.classList.remove('admin-fuse-slot--drop')
      })
    }

    function slotFromEventTarget(target) {
      const el = target?.closest?.('[data-fuse-slot]')
      if (!el) return null
      return Number(el.getAttribute('data-fuse-slot')) || 0
    }

    const tray = document.getElementById('admin-fuse-tray')

    document.querySelectorAll('[data-fuse-slot]').forEach((slotEl) => {
      const idx = () => Number(slotEl.getAttribute('data-fuse-slot')) || 0
      slotEl.addEventListener('click', () => {
        selectSlot(idx(), { openFileIfEmpty: true })
      })
      slotEl.addEventListener('dblclick', (event) => {
        event.preventDefault()
        selectSlot(idx(), { forceOpenPicker: true })
      })
      slotEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          selectSlot(idx(), { openFileIfEmpty: true })
        }
      })
    })

    // 트레이 단위 드롭 — 칸(button→div) 어디서든 동작, Windows type="" 대응
    ;['dragenter', 'dragover'].forEach((type) => {
      tray?.addEventListener(type, (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
        clearSlotDropStyles()
        const slotIdx = slotFromEventTarget(event.target)
        const slotEl =
          slotIdx == null
            ? null
            : tray.querySelector(`[data-fuse-slot="${slotIdx}"]`)
        if (slotEl) slotEl.classList.add('admin-fuse-slot--drop')
      })
    })
    tray?.addEventListener('dragleave', (event) => {
      if (tray.contains(event.relatedTarget)) return
      clearSlotDropStyles()
    })
    tray?.addEventListener('drop', (event) => {
      event.preventDefault()
      event.stopPropagation()
      clearSlotDropStyles()
      if (event.target?.closest?.('#admin-fuse-reset')) return
      const slotIdx = slotFromEventTarget(event.target)
      void importDataTransfer(event.dataTransfer, slotIdx == null ? activeSlot : slotIdx)
    })

    resetBtn?.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      resetFuseWorkspace({ confirmAsk: true })
    })

    function stopCamera() {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop())
        cameraStream = null
      }
      if (cameraVideo) cameraVideo.srcObject = null
    }

    async function openCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setFuseStatus('이 브라우저에서는 카메라를 쓸 수 없어요.', true)
        return
      }
      try {
        stopCamera()
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cameraVideo) {
          cameraVideo.srcObject = cameraStream
          await cameraVideo.play().catch(() => {})
        }
        cameraDialog?.showModal?.()
        setFuseStatus('카메라를 켰어요. 촬영해 슬롯에 넣으세요.', false)
      } catch (err) {
        setFuseStatus(err?.message || '카메라 권한이 필요해요.', true)
      }
    }

    function openGalleryPicker() {
      const items = (deps.getGalleryItems?.() || []).filter(
        (it) => it?.imageUrl || it?.imageDataUrl,
      )
      if (!galleryGrid || !galleryDialog) return
      galleryGrid.replaceChildren()
      if (!items.length) {
        setFuseStatus('갤러리에 가져올 그림이 없어요.', true)
        return
      }
      items.slice(0, 60).forEach((item) => {
        const src = item.imageDataUrl || item.imageUrl
        const btn = document.createElement('button')
        btn.type = 'button'
        const img = document.createElement('img')
        img.src = src
        img.alt = ''
        btn.appendChild(img)
        btn.addEventListener('click', async () => {
          galleryDialog.close?.()
          await importFromUrlOrData(src, '갤러리 이미지')
        })
        galleryGrid.appendChild(btn)
      })
      galleryDialog.showModal?.()
    }

    pickDialog?.querySelectorAll('[data-fuse-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        void runFusePick(btn.getAttribute('data-fuse-pick'))
      })
    })
    pickCloseBtn?.addEventListener('click', () => closePickDialog())

    loadFileBtn?.addEventListener('click', () => {
      fileInput.click()
    })
    pasteBtn?.addEventListener('click', () => {
      armPasteCatcher()
    })
    pasteCatcher?.addEventListener('paste', (event) => {
      if (!isFusePanelOpen()) return
      event.preventDefault()
      event.stopPropagation()
      void pasteFromClipboard(event)
    })
    fromResultBtn?.addEventListener('click', async () => {
      await runFusePick('result')
    })
    fromGalleryBtn?.addEventListener('click', () => {
      openGalleryPicker()
    })
    cameraBtn?.addEventListener('click', () => {
      void openCamera()
    })

    cameraCloseBtn?.addEventListener('click', () => {
      stopCamera()
      cameraDialog?.close?.()
    })
    cameraDialog?.addEventListener('close', () => stopCamera())
    cameraShotBtn?.addEventListener('click', async () => {
      if (!cameraVideo || !cameraVideo.videoWidth) {
        setFuseStatus('카메라 화면이 아직 준비되지 않았어요.', true)
        return
      }
      const snap = document.createElement('canvas')
      snap.width = cameraVideo.videoWidth
      snap.height = cameraVideo.videoHeight
      const sctx = snap.getContext('2d')
      if (!sctx) return
      sctx.drawImage(cameraVideo, 0, 0)
      stopCamera()
      cameraDialog?.close?.()
      await importFromUrlOrData(snap.toDataURL('image/jpeg', 0.92), '카메라로 찍은 사진')
    })

    fileInput.addEventListener('change', async () => {
      const files = fileInput.files ? Array.from(fileInput.files) : []
      fileInput.value = ''
      if (!files.length) return
      await importFiles(files)
    })

    // 끌어다 놓기 — 어두운 문구는 드래그 중에만
    dropzone?.addEventListener('dragenter', (event) => {
      event.preventDefault()
      dropDepth = 1
      dropzone.classList.add('admin-fuse-canvas-wrap--drop')
      syncDropOverlay()
    })
    dropzone?.addEventListener('dragover', (event) => {
      event.preventDefault()
      dropDepth = 1
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    })
    dropzone?.addEventListener('dragleave', (event) => {
      event.preventDefault()
      const related = event.relatedTarget
      if (related && dropzone.contains(related)) return
      dropDepth = 0
      dropzone.classList.remove('admin-fuse-canvas-wrap--drop')
      syncDropOverlay()
    })
    dropzone?.addEventListener('drop', (event) => {
      event.preventDefault()
      dropDepth = 0
      dropzone.classList.remove('admin-fuse-canvas-wrap--drop')
      syncDropOverlay()
      void importDataTransfer(event.dataTransfer, activeSlot)
    })
    window.addEventListener('dragend', () => {
      dropDepth = 0
      clearSlotDropStyles()
      dropzone?.classList.remove('admin-fuse-canvas-wrap--drop')
      syncDropOverlay()
    })

    // 합성 패널이 열려 있을 때 Ctrl+V — clipboardData가 비어도 clipboard.read 시도
    document.addEventListener(
      'paste',
      (event) => {
        if (!isFusePanelOpen()) return
        event.preventDefault()
        event.stopPropagation()
        void pasteFromClipboard(event)
      },
      true,
    )

    cutBtn?.addEventListener('click', () => {
      void cutSelectionToNewLayer(true)
    })
    punchBtn?.addEventListener('click', () => {
      void punchSelected()
    })
    sharpenBtn?.addEventListener('click', () => {
      void sharpenSelectedLayer()
    })
    cleanupBtn?.addEventListener('click', () => {
      cleanupLeftoverLayers()
    })
    document.getElementById('admin-fuse-copy')?.addEventListener('click', () => {
      void cutSelectionToNewLayer(false)
    })

    helperBtn?.addEventListener('click', () => {
      setFuseStep(1)
    })
    stepPrevBtn?.addEventListener('click', () => {
      setFuseStep(headHelpStep - 1)
    })
    stepNextBtn?.addEventListener('click', () => {
      setFuseStep(headHelpStep + 1)
    })
    document.querySelectorAll('[data-fuse-step]').forEach((el) => {
      el.addEventListener('click', () => {
        setFuseStep(Number(el.getAttribute('data-fuse-step')))
      })
    })

    /** @type {Map<number, PointerEvent>} */
    const activePointers = new Map()
    /** @type {null | { mode: 'layer'|'view', startDist: number, startW?: number, startH?: number, cx?: number, cy?: number, layerId?: number, startZoom?: number }} */
    let pinchSession = null

    function pointerPairDist(a, b) {
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }

    function endPinch() {
      pinchSession = null
    }

    function onPinchPointersChanged() {
      if (activePointers.size < 2) {
        endPinch()
        return
      }
      const pts = [...activePointers.values()]
      const dist = Math.max(8, pointerPairDist(pts[0], pts[1]))
      const mid = {
        clientX: (pts[0].clientX + pts[1].clientX) / 2,
        clientY: (pts[0].clientY + pts[1].clientY) / 2,
      }
      if (!pinchSession) {
        drag = null
        const layer = tool === 'move' ? selectedLayer() : null
        if (layer) {
          pinchSession = {
            mode: 'layer',
            startDist: dist,
            startW: layer.w,
            startH: layer.h,
            cx: layer.x + layer.w / 2,
            cy: layer.y + layer.h / 2,
            layerId: layer.id,
          }
        } else {
          pinchSession = { mode: 'view', startDist: dist, startZoom: viewZoom }
        }
        return
      }
      const ratio = dist / Math.max(8, pinchSession.startDist)
      if (pinchSession.mode === 'layer') {
        const layer = layers.find((l) => l.id === pinchSession.layerId)
        if (!layer) return
        layer.w = Math.max(24, Math.round((pinchSession.startW || layer.w) * ratio))
        layer.h = Math.max(24, Math.round((pinchSession.startH || layer.h) * ratio))
        layer.x = Math.round((pinchSession.cx || 0) - layer.w / 2)
        layer.y = Math.round((pinchSession.cy || 0) - layer.h / 2)
        redrawFuse()
      } else {
        setViewZoom((pinchSession.startZoom || 1) * ratio, mid)
      }
    }

    function trackPinchPointerDown(event) {
      activePointers.set(event.pointerId, event)
      if (activePointers.size >= 2) {
        event.preventDefault()
        onPinchPointersChanged()
      }
    }

    function trackPinchPointerMove(event) {
      if (!activePointers.has(event.pointerId)) return
      activePointers.set(event.pointerId, event)
      if (activePointers.size >= 2) {
        event.preventDefault()
        onPinchPointersChanged()
      }
    }

    function trackPinchPointerUp(event) {
      activePointers.delete(event.pointerId)
      if (activePointers.size < 2) endPinch()
    }

    canvas.addEventListener('pointerdown', (event) => {
      trackPinchPointerDown(event)
      if (activePointers.size >= 2) return
      if (event.button !== 0) return
      const p = pointer(event, canvas)

      if (tool === 'align') {
        handleAlignClick(p)
        return
      }

      if (tool !== 'move') return
      const hit = hitLayer(p.x, p.y)
      if (!hit) {
        selectedId = null
        redrawFuse()
        return
      }
      selectedId = hit.id
      drag = { id: hit.id, ox: p.x - hit.x, oy: p.y - hit.y }
      canvas.setPointerCapture(event.pointerId)
      redrawFuse()
    })

    canvas.addEventListener('pointermove', (event) => {
      trackPinchPointerMove(event)
      if (activePointers.size >= 2 || pinchSession) return
      if (!drag || tool !== 'move') return
      const layer = layers.find((l) => l.id === drag.id)
      if (!layer) return
      const p = pointer(event, canvas)
      layer.x = Math.round(p.x - drag.ox)
      layer.y = Math.round(p.y - drag.oy)
      redrawFuse()
    })

    canvas.addEventListener('pointerup', (event) => {
      trackPinchPointerUp(event)
      drag = null
    })
    canvas.addEventListener('pointercancel', (event) => {
      trackPinchPointerUp(event)
      drag = null
    })

    // 올가미 캔버스에서도 핀치(화면 줌 / 선택 레이어 크기)
    lassoCanvas.addEventListener(
      'pointerdown',
      (event) => {
        trackPinchPointerDown(event)
      },
      { capture: true },
    )
    lassoCanvas.addEventListener(
      'pointermove',
      (event) => {
        trackPinchPointerMove(event)
      },
      { capture: true },
    )
    lassoCanvas.addEventListener(
      'pointerup',
      (event) => {
        trackPinchPointerUp(event)
      },
      { capture: true },
    )
    lassoCanvas.addEventListener(
      'pointercancel',
      (event) => {
        trackPinchPointerUp(event)
      },
      { capture: true },
    )

    function onFuseWheel(event) {
      // 창 최소/최대화·스냅 직후 들어오는 휠/핀치는 무시 (줌으로 오인 방지)
      if (Date.now() < ignoreWheelUntil) {
        event.preventDefault()
        return
      }
      const wantViewZoom =
        event.ctrlKey ||
        event.metaKey ||
        tool === 'lasso' ||
        tool === 'align' ||
        !selectedLayer()
      if (wantViewZoom) {
        event.preventDefault()
        bumpViewZoom(event.deltaY < 0 ? 1 : -1, {
          clientX: event.clientX,
          clientY: event.clientY,
        })
        return
      }
      if (tool !== 'move') return
      const layer = selectedLayer()
      if (!layer) return
      event.preventDefault()
      if (event.shiftKey) {
        rotateLayer(layer, ((event.deltaY < 0 ? 3 : -3) * Math.PI) / 180)
      } else {
        scaleLayer(layer, event.deltaY < 0 ? 1.05 : 1 / 1.05)
      }
      redrawFuse()
    }

    canvas.addEventListener('wheel', onFuseWheel, { passive: false })
    lassoCanvas.addEventListener('wheel', onFuseWheel, { passive: false })
    canvasScroll?.addEventListener('wheel', (event) => {
      // 스크롤 영역 빈곳에서도 Ctrl/올가미 줌
      if (event.ctrlKey || event.metaKey || tool === 'lasso' || tool === 'align') {
        onFuseWheel(event)
      }
    }, { passive: false })

    zoomInBtn?.addEventListener('click', () => bumpViewZoom(1))
    zoomOutBtn?.addEventListener('click', () => bumpViewZoom(-1))
    zoomResetBtn?.addEventListener('click', () => {
      setViewZoom(1)
      if (canvasScroll) {
        canvasScroll.scrollLeft = 0
        canvasScroll.scrollTop = 0
      }
      // 꼬마 사진+큰 검은 여백이면 몸 레이어도 캔버스에 다시 맞춤
      const body = layers.find((l) => l.slot === 0)
      if (body?.img) {
        const cover =
          body.w * body.h < canvas.width * canvas.height * 0.45 ||
          body.w < canvas.width * 0.5 ||
          body.h < canvas.height * 0.5
        if (cover) {
          fitFuseCanvasToImage(body.img)
          fitBodyLayerToCanvas()
          paintSlotButtons()
          redrawFuse()
        }
      }
      setFuseStatus(
        '화면 100% · 몸·장면을 캔버스에 맞췄어요. 올가미할 때만 + 로 확대하세요.',
        false,
      )
    })

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space' && !event.repeat) {
        const tag = String(event.target?.tagName || '').toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return
        if (!fusePanel || fusePanel.hidden) return
        spacePanHeld = true
        event.preventDefault()
      }
    })
    window.addEventListener('keyup', (event) => {
      if (event.code === 'Space') {
        spacePanHeld = false
        viewPan = null
        canvasScroll?.classList.remove('admin-fuse-canvas-scroll--panning')
      }
    })

    function beginViewPan(event) {
      if (!canvasScroll) return false
      const middle = event.button === 1
      if (!middle && !spacePanHeld) return false
      event.preventDefault()
      viewPan = {
        x: event.clientX,
        y: event.clientY,
        sl: canvasScroll.scrollLeft,
        st: canvasScroll.scrollTop,
      }
      canvasScroll.classList.add('admin-fuse-canvas-scroll--panning')
      canvasScroll.setPointerCapture?.(event.pointerId)
      return true
    }

    function moveViewPan(event) {
      if (!viewPan || !canvasScroll) return
      canvasScroll.scrollLeft = viewPan.sl - (event.clientX - viewPan.x)
      canvasScroll.scrollTop = viewPan.st - (event.clientY - viewPan.y)
    }

    function endViewPan(event) {
      if (!viewPan) return
      viewPan = null
      canvasScroll?.classList.remove('admin-fuse-canvas-scroll--panning')
      try {
        canvasScroll?.releasePointerCapture?.(event.pointerId)
      } catch {
        /* ignore */
      }
    }

    ;[canvasScroll, canvas, lassoCanvas].forEach((el) => {
      el?.addEventListener('pointerdown', (event) => {
        if (beginViewPan(event)) event.stopPropagation()
      })
      el?.addEventListener('pointermove', moveViewPan)
      el?.addEventListener('pointerup', endViewPan)
      el?.addEventListener('pointercancel', endViewPan)
    })
    canvasScroll?.addEventListener('auxclick', (event) => {
      if (event.button === 1) event.preventDefault()
    })

    canvas.addEventListener('contextmenu', (event) => {
      if (tool === 'align') {
        event.preventDefault()
        clearAlignSession()
        const hit = hitLayer(pointer(event, canvas).x, pointer(event, canvas).y)
        if (hit) beginAlignSession(hit)
        else setFuseStatus(alignStatusText(), false)
        redrawFuse()
        return
      }
      if (tool !== 'move') return
      event.preventDefault()
      const p = pointer(event, canvas)
      const hit = hitLayer(p.x, p.y)
      if (hit) selectedId = hit.id
      const layer = selectedLayer()
      if (!layer) {
        setFuseStatus('레이어를 선택한 뒤 우클릭하세요.', true)
        return
      }
      showContextMenu(event.clientX, event.clientY, layer)
    })

    window.addEventListener('keydown', (event) => {
      if (tool !== 'align') return
      if (event.key === 'Escape') {
        clearAlignSession()
        setTool('move')
        setFuseStatus('포인트 맞춤을 취소했어요.', false)
      }
    })

    function exportFlatDataUrl(mime = 'image/jpeg', quality = 0.95) {
      if (tool === 'lasso' || tool === 'align') setTool('move')
      const prevSelected = selectedId
      selectedId = null
      ensureFuseLasso()?.clearAll?.()
      redrawFuse()
      if (ctx) {
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
      }
      const dataUrl = canvas.toDataURL(mime, quality)
      selectedId = prevSelected
      redrawFuse()
      return dataUrl
    }

    /**
     * AI용 불투명 평탄 내보내기.
     * 투명·구멍·검정 캔버스가 보이면 AI가 유령/반투명 괴물을 만듦 → 항상 불투명 JPEG.
     */
    function exportOpaqueFlatDataUrl(quality = 0.95) {
      if (tool === 'lasso' || tool === 'align') setTool('move')
      const prevSelected = selectedId
      selectedId = null
      ensureFuseLasso()?.clearAll?.()
      const c = document.createElement('canvas')
      c.width = canvas.width
      c.height = canvas.height
      const cctx = c.getContext('2d')
      if (!cctx) {
        selectedId = prevSelected
        return exportFlatDataUrl('image/jpeg', quality)
      }
      // 중성 배경(검정 금지) 위에 레이어 합성
      cctx.fillStyle = '#9ca3af'
      cctx.fillRect(0, 0, c.width, c.height)
      cctx.imageSmoothingEnabled = true
      cctx.imageSmoothingQuality = 'high'
      for (const layer of layers) drawLayerTo(cctx, layer)
      selectedId = prevSelected
      redrawFuse()
      return c.toDataURL('image/jpeg', quality)
    }

    /** AI 손보기/최종 — 불투명 JPEG만 (투명 PNG 금지) */
    function exportFlatForAi() {
      return exportOpaqueFlatDataUrl(0.95)
    }

    /** 얼굴 조각 주변(머리+목) 마스크 — 흰=수정 영역 */
    function buildFaceSeamMaskDataUrl(faceLayer) {
      if (!faceLayer) return null
      const pts = headMaskPointsFromLayer(faceLayer, 1.28)
      if (!pts || pts.length < 3) return null
      return (
        ensureFuseLasso()?.buildMaskDataUrl?.(1280, {
          expandPx: 22,
          blurPx: 5,
          pointsList: [pts],
        }) || null
      )
    }

    /** 마스크 흰 영역에만 AI 결과를 얹음(나머지=원본 그대로) */
    async function compositeMaskedAi(baseDataUrl, aiImageUrl, maskDataUrl) {
      const base = await loadImage(baseDataUrl)
      const ai = await loadImage(aiImageUrl)
      const maskImg = await loadImage(maskDataUrl)
      const w = base.naturalWidth
      const h = base.naturalHeight
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      const octx = out.getContext('2d')
      if (!octx) return baseDataUrl
      octx.fillStyle = '#9ca3af'
      octx.fillRect(0, 0, w, h)
      octx.drawImage(base, 0, 0, w, h)

      const piece = document.createElement('canvas')
      piece.width = w
      piece.height = h
      const pctx = piece.getContext('2d')
      if (!pctx) return baseDataUrl
      pctx.drawImage(ai, 0, 0, w, h)
      // AI 투명 픽셀은 쓰지 않음
      pctx.globalCompositeOperation = 'destination-in'
      pctx.drawImage(maskImg, 0, 0, w, h)
      pctx.globalCompositeOperation = 'source-over'
      octx.drawImage(piece, 0, 0)
      return out.toDataURL('image/jpeg', 0.95)
    }

    function syncPolishLabels() {
      const faceEl = document.getElementById('admin-fuse-face-size-val')
      const edgeEl = document.getElementById('admin-fuse-edge-val')
      const skinEl = document.getElementById('admin-fuse-skin-val')
      const lightEl = document.getElementById('admin-fuse-light-val')
      const brightEl = document.getElementById('admin-fuse-bright-val')
      const satEl = document.getElementById('admin-fuse-sat-val')
      const face = Number(faceSizeInput?.value || 0)
      const edge = Number(edgeInput?.value || 0)
      const skin = Number(skinInput?.value || 1)
      const light = Number(lightInput?.value || 1)
      const bright = Number(brightInput?.value || 0)
      const sat = Number(satInput?.value || 0)
      if (faceEl) {
        faceEl.textContent = face === 0 ? '그대로' : face > 0 ? `크게 ${face}` : `작게 ${Math.abs(face)}`
      }
      if (edgeEl) edgeEl.textContent = ['끔', '중간', '강함'][edge] || '강함'
      if (skinEl) skinEl.textContent = ['약함', '중간', '강함'][skin] || '중간'
      if (lightEl) lightEl.textContent = ['약함', '맞춤', '강함'][light] || '맞춤'
      if (brightEl) {
        brightEl.textContent =
          bright === 0 ? '그대로' : bright > 0 ? `밝게 ${bright}` : `어둡게 ${Math.abs(bright)}`
      }
      if (satEl) {
        satEl.textContent = sat === 0 ? '그대로' : sat > 0 ? `진하게 ${sat}` : `옅게 ${Math.abs(sat)}`
      }
    }

    function getYawMode() {
      const v = String(yawSelect?.value || 'off')
      if (v === 'face' || v === 'body') return v
      return 'off'
    }

    /** @param {'off'|'face'|'body'|null} [forceYaw] */
    function buildPolishRevision(forceYaw) {
      const face = Number(faceSizeInput?.value || 0)
      const yaw = forceYaw == null ? getYawMode() : forceYaw
      const edge = Number(edgeInput?.value || 0)
      const skin = Number(skinInput?.value || 1)
      const light = Number(lightInput?.value || 1)
      const bright = Number(brightInput?.value || 0)
      const sat = Number(satInput?.value || 0)
      const note = String(polishNoteInput?.value || '').trim()
      const parts = [
        'LOCAL head-swap seam cleanup on this already-composited photo.',
        'CRITICAL IDENTITY LOCK: keep the EXACT same face identity, age, hair style/color/length as in THIS input — no different person.',
        'CRITICAL FACE LOCK: the attached cut-out face pixels are the identity — do NOT replace with a different face, beauty filter, or regenerated portrait.',
        'CRITICAL BODY LOCK: keep the full torso, clothing, arms, hands, and background — NEVER delete, blank out, or fade the body.',
        'CRITICAL QUALITY: preserve input sharpness — no soft muddy full re-render, no empty/black result.',
        'FORBIDDEN: deleting the person, blank canvas, beauty face swap, new face, inventing a second person, white/black wipe.',
      ]
      if (yaw === 'off') {
        parts.push(
          'SEAM ONLY: remove hard lasso cut edges, white halo, jagged matte fringe around the attached head;',
          'fill any awkward hole/gap where the old body head was removed with matching neck/shoulder/background;',
          'blend neck join and skin tone locally. Do not redesign the face or body.',
        )
      }
      // 좌우 roll(기울기)이 아니라 yaw(정면↔측면). 사용자 피드백 반영.
      if (yaw === 'face') {
        parts.push(
          'YAW FIX — FACE TO MATCH BODY: the BODY is in three-quarter / side view facing away from camera-center, but the HEAD is glued on frontally.',
          'Rotate ONLY the head/yaw so the face turns to the SAME side angle as the shoulders/torso (three-quarter view). Rebuild a natural neck.',
          'Do NOT only tilt left-right (roll). This is a turn of the head toward the body direction. Same person.',
        )
      } else if (yaw === 'body') {
        parts.push(
          'YAW FIX — BODY TO CAMERA: the torso/shoulders are three-quarter / side-on while the face looks at camera.',
          'Rotate the TORSO and shoulders toward the camera so the body becomes more frontal to match the face. Keep the same outfit and identity.',
          'Do NOT only tilt the image. Turn the body. Keep background room mostly intact.',
        )
      }
      if (edge >= 1) {
        parts.push(
          edge >= 2
            ? 'EDGE (strong): remove hard cut outline, white halo, passport fringe, any white rectangle behind the head; soft photoreal hair into the scene.'
            : 'EDGE (mild): soften hard cut edges at jaw and hairline; remove white halo.',
        )
      }
      if (face > 0) {
        parts.push(`Slightly enlarge only the attached head (~${face * 6}%).`)
      } else if (face < 0) {
        parts.push(`Slightly shrink only the attached head (~${Math.abs(face) * 6}%).`)
      }
      if (skin >= 1) {
        parts.push(
          skin >= 2
            ? 'Strong skin-tone match: face/neck to chest — no pale face patch on tanned body.'
            : 'Mild skin-tone match on attached face/neck to body.',
        )
      }
      if (light >= 1) {
        parts.push(
          light >= 2
            ? 'Strong lighting match on attached face to body (direction, shadow softness).'
            : 'Mild lighting match on attached face to body.',
        )
      }
      if (bright !== 0) {
        parts.push(
          bright > 0
            ? `Slightly brighten only the attached face (level ${bright}).`
            : `Slightly darken only the attached face (level ${Math.abs(bright)}).`,
        )
      }
      if (sat !== 0) {
        parts.push(
          sat > 0
            ? `Slightly raise saturation only on the attached face (level ${sat}).`
            : `Slightly lower saturation only on the attached face (level ${Math.abs(sat)}).`,
        )
      }
      if (note) parts.push(`User note (keep identity): ${note}`)
      return parts.join(' ').slice(0, 780)
    }

    /** 이미지가 거의 검거나 비어 있으면 false (AI가 전부 날린 결과 감지) */
    function fuseImageHasContent(img) {
      if (!img?.naturalWidth) return false
      const sw = 48
      const sh = 48
      const c = document.createElement('canvas')
      c.width = sw
      c.height = sh
      const cctx = c.getContext('2d', { willReadFrequently: true })
      if (!cctx) return true
      cctx.drawImage(img, 0, 0, sw, sh)
      const data = cctx.getImageData(0, 0, sw, sh).data
      let lit = 0
      let dark = 0
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3]
        if (a < 20) {
          dark += 1
          continue
        }
        const lum = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11
        if (lum > 18) lit += 1
        else dark += 1
      }
      const total = sw * sh
      // 내용이 너무 적거나(8% 미만) 거의 전부 어두우면 실패로 본다
      return lit >= total * 0.08 && lit >= dark * 0.15
    }

    /** AI/PNG 투명도를 없애 불투명 JPEG 이미지로 */
    async function loadImageForcedOpaque(url) {
      const raw = await loadImage(url)
      const c = document.createElement('canvas')
      c.width = raw.naturalWidth
      c.height = raw.naturalHeight
      const cctx = c.getContext('2d')
      if (!cctx) return raw
      cctx.fillStyle = '#9ca3af'
      cctx.fillRect(0, 0, c.width, c.height)
      cctx.drawImage(raw, 0, 0)
      return loadImage(c.toDataURL('image/jpeg', 0.96))
    }

    async function replaceCanvasWithImage(url) {
      const img = await loadImageForcedOpaque(url)
      if (!fuseImageHasContent(img)) {
        throw new Error('ai_result_empty')
      }
      const prev = {
        layers: layers.slice(),
        nextLayerId,
        nextFreeSlot,
        selectedId,
        activeSlot,
        cw: canvas.width,
        ch: canvas.height,
      }
      try {
        layers = []
        nextLayerId = 1
        nextFreeSlot = 3
        fitFuseCanvasToImage(img)
        const scale = Math.min(
          canvas.width / img.naturalWidth,
          canvas.height / img.naturalHeight,
        )
        const w = Math.max(40, Math.round(img.naturalWidth * scale))
        const h = Math.max(40, Math.round(img.naturalHeight * scale))
        const layer = {
          id: nextLayerId,
          slot: 0,
          img,
          x: Math.round((canvas.width - w) / 2),
          y: Math.round((canvas.height - h) / 2),
          w,
          h,
          flipX: false,
          rotation: 0,
        }
        nextLayerId += 1
        layers.push(layer)
        selectedId = layer.id
        activeSlot = 0
        paintSlotButtons()
        redrawFuse()
      } catch (err) {
        layers = prev.layers
        nextLayerId = prev.nextLayerId
        nextFreeSlot = prev.nextFreeSlot
        selectedId = prev.selectedId
        activeSlot = prev.activeSlot
        if (canvas.width !== prev.cw || canvas.height !== prev.ch) {
          canvas.width = prev.cw
          canvas.height = prev.ch
          syncLassoSize()
        }
        paintSlotButtons()
        redrawFuse()
        throw err
      }
    }

    /**
     * AI 결과가 원본보다 뭉개질 때: 차이 큰 곳(경계·이음)만 약하게 AI, 본문은 원본 유지.
     * mix를 낮게 잡아 “전부 사라짐/다른 얼굴”을 막는다.
     * @returns {Promise<string>} data URL (png)
     */
    async function blendPreserveDetail(baseDataUrl, aiImageUrl) {
      const base = await loadImage(baseDataUrl)
      const ai = await loadImage(aiImageUrl)
      const w = base.naturalWidth
      const h = base.naturalHeight
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const cctx = c.getContext('2d')
      if (!cctx) return baseDataUrl

      cctx.imageSmoothingEnabled = true
      cctx.imageSmoothingQuality = 'high'
      cctx.drawImage(base, 0, 0, w, h)
      const baseData = cctx.getImageData(0, 0, w, h)

      cctx.clearRect(0, 0, w, h)
      cctx.drawImage(ai, 0, 0, w, h)
      const aiData = cctx.getImageData(0, 0, w, h)

      // AI가 거의 빈 화면이면 원본 그대로
      if (!fuseImageHasContent(ai)) return baseDataUrl

      const out = cctx.createImageData(w, h)
      const b = baseData.data
      const a = aiData.data
      const d = out.data
      for (let i = 0; i < d.length; i += 4) {
        const dr = Math.abs(a[i] - b[i])
        const dg = Math.abs(a[i + 1] - b[i + 1])
        const db = Math.abs(a[i + 2] - b[i + 2])
        const da = Math.abs(a[i + 3] - b[i + 3])
        const diff = dr + dg + db + da * 0.5
        // 원본 우선: 경계·이음만 최대 ~55%까지 AI
        let mix = 0
        if (diff > 32) mix = Math.min(0.5, (diff - 32) / 140)
        if (diff > 110) mix = Math.min(0.62, mix + 0.12)
        // AI 픽셀이 거의 검으면(내용 삭제) 원본 유지
        const aiLum = a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11
        if (a[i + 3] < 20 || (aiLum < 12 && b[i + 3] > 40)) mix = 0
        const inv = 1 - mix
        d[i] = Math.round(b[i] * inv + a[i] * mix)
        d[i + 1] = Math.round(b[i + 1] * inv + a[i + 1] * mix)
        d[i + 2] = Math.round(b[i + 2] * inv + a[i + 2] * mix)
        d[i + 3] = Math.round(b[i + 3] * inv + a[i + 3] * mix)
      }
      cctx.putImageData(out, 0, 0)
      const merged = c.toDataURL('image/png')
      const check = await loadImage(merged)
      if (!fuseImageHasContent(check)) return baseDataUrl
      return merged
    }

    function buildFinalFinishRevision() {
      const yaw = getYawMode()
      const note = String(polishNoteInput?.value || '').trim()
      const parts = [
        'FINAL head-swap finish on this already-composited photo.',
        'CRITICAL IDENTITY LOCK: keep the EXACT same face identity, age, hair style/color/length — no different person.',
        'CRITICAL: EXACTLY ONE person. Erase any ghost/duplicate/semi-transparent second face or lasso-shaped leftover silhouette next to the head — fill with seamless background only.',
        'CRITICAL FACE LOCK: keep the attached cut-out face EXACTLY — same eyes, nose, mouth, hair. Do NOT invent a new face.',
        'CRITICAL BODY LOCK: keep the torso, clothing, arms, and pose from the input — do NOT delete or replace the body.',
        'CRITICAL QUALITY: keep input sharpness — do NOT make the whole photo soft, muddy, or low-resolution.',
        'ONLY local fixes: neck join, jaw/hairline seam, white halo/passport crumbs, remove ghost cutouts. Do not re-draw clothing fabric.',
        'Match skin tone and local lighting on the attached face/neck only.',
        'FORBIDDEN: new face, new hairstyle, beauty face swap, inventing people, deleting body, blank white blocks, full-scene re-render.',
      ]
      if (yaw === 'face') {
        parts.push(
          'Also yaw the head to three-quarter / side to match the torso direction (not left-right roll only).',
        )
      } else if (yaw === 'body') {
        parts.push(
          'Also turn the torso more frontal toward camera to match the face (not image tilt).',
        )
      }
      if (note) parts.push(`User note: ${note}`)
      return parts.join(' ').slice(0, 780)
    }

    /**
     * @param {'off'|'face'|'body'|null} [forceYaw]
     * @param {{ final?: boolean }} [opts]
     */
    async function runAiPolish(forceYaw, opts) {
      if (polishBusy) return false
      if (!layers.length) {
        setFuseStatus('먼저 재료 칸에 사진을 넣고 배치하세요.', true)
        return false
      }
      const final = Boolean(opts?.final)
      const yaw = forceYaw == null ? getYawMode() : forceYaw
      // 자투리만 제거(몸통은 절대 삭제 안 함). 몸+얼굴 조각이 있을 때만.
      const bodyExists = layers.some((l) => l.slot === 0)
      const faceForClean =
        (selectedLayer() && selectedLayer().slot !== 0 && selectedLayer()) ||
        layers.find((l) => l.slot !== 0)
      if (bodyExists && faceForClean) keepOnlyBodyAndPiece(faceForClean)
      if (!bodyExists) {
        setFuseStatus('몸·장면이 없어요. 몸통을 다시 넣은 뒤 AI로 자연스럽게를 눌러 주세요.', true)
        return false
      }
      if (!final && layers.length >= 2 && yaw === 'off') {
        const proceed = window.confirm(
          'AI로 자연스럽게\n\n· 올가미 자국·흰 테두리\n· 목 이음·옛 머리 구멍\n· 피부톤·경계만 다듬습니다\n\n얼굴·몸통은 유지됩니다. 계속할까요?',
        )
        if (!proceed) return false
      }
      if (deps.isLoggedIn && !deps.isLoggedIn()) {
        deps.showPinGate?.('로그인이 필요해요.')
        return false
      }
      const headers = deps.authHeaders?.() || { 'Content-Type': 'application/json' }
      polishBusy = true
      if (aiPolishBtn) aiPolishBtn.disabled = true
      if (aiFinishBtn) aiFinishBtn.disabled = true
      if (aiFinishBtn2) aiFinishBtn2.disabled = true
      if (yawFaceBtn) yawFaceBtn.disabled = true
      if (yawBodyBtn) yawBodyBtn.disabled = true
      if (commitBtn) commitBtn.disabled = true
      const started = Date.now()
      const yawLabel = final
        ? '최종 완성'
        : yaw === 'face'
          ? '얼굴을 측면으로'
          : yaw === 'body'
            ? '몸을 정면으로'
            : '경계·피부·조도'
      const tick = window.setInterval(() => {
        const sec = Math.round((Date.now() - started) / 1000)
        setFuseStatus(`AI ${yawLabel} 중… ${sec}초`, false)
      }, 1000)
      try {
        const beforeUrl = exportFlatForAi()
        polishUndoDataUrl = beforeUrl
        if (aiUndoBtn) aiUndoBtn.hidden = false

        const upRes = await fetch('/api/upload-image', {
          method: 'POST',
          headers,
          body: JSON.stringify({ dataUrl: beforeUrl }),
        })
        const upData = await upRes.json().catch(() => ({}))
        if (upRes.status === 401) {
          deps.showPinGate?.('세션이 만료됐어요. 다시 로그인해 주세요.')
          return false
        }
        if (!upData.ok || !upData.imageUrl) {
          setFuseStatus(`업로드 실패: ${upData.message || upData.error || upRes.status}`, true)
          return false
        }

        const current = deps.getCurrentResult?.() || {}
        const polishSize =
          canvas.height >= canvas.width ? 'portrait' : current.size || 'landscape'
        // 「AI로 자연스럽게」(yaw off): 전체 재생성 금지 → 얼굴 주변만 region 수정
        const seamOnly = !final && yaw === 'off'
        const faceLayer =
          (selectedLayer() && selectedLayer().slot !== 0 && selectedLayer()) ||
          layers.find((l) => l.slot !== 0)
        const seamMask = seamOnly ? buildFaceSeamMaskDataUrl(faceLayer) : null

        let refinePayload
        if (seamOnly && seamMask) {
          refinePayload = {
            mode: 'region',
            genMode: 'fashion',
            imageUrl: upData.imageUrl,
            maskDataUrl: seamMask,
            baseDescription: current.prompt || 'fuse head-swap composite',
            revision: [
              'Edit ONLY the masked seam around the attached head.',
              'Remove hard lasso cut edges, white halo, jagged fringe.',
              'Blend neck join and local skin tone. Fill tiny gaps under the chin only.',
              'CRITICAL: keep the exact same face identity and the full opaque body/clothing outside the mask.',
              'FORBIDDEN: ghost double face, transparency, deleting torso, blank/black holes, new person.',
            ].join(' ').slice(0, 780),
            mood: current.mood || deps.moodField?.value || 'clean',
            size: polishSize,
            regionCount: 1,
          }
        } else {
          const revision = final ? buildFinalFinishRevision() : buildPolishRevision(yaw)
          refinePayload = {
            mode: 'text',
            genMode: 'fashion',
            imageUrl: upData.imageUrl,
            baseDescription: current.prompt || 'fuse head-swap composite',
            revision: [
              revision,
              'Keep a fully opaque photoreal result — no transparency, no ghost doubles, no blank holes.',
              'Keep full resolution detail — sharp face and fabric.',
            ]
              .join(' ')
              .slice(0, 780),
            mood: current.mood || deps.moodField?.value || 'clean',
            size: polishSize,
          }
        }

        const refineRes = await fetch('/api/refine', {
          method: 'POST',
          headers,
          body: JSON.stringify(refinePayload),
        })
        const refineRaw = await refineRes.text()
        let refineData = {}
        try {
          refineData = refineRaw ? JSON.parse(refineRaw) : {}
        } catch {
          refineData = {}
        }
        if (refineRes.status === 401) {
          deps.showPinGate?.('세션이 만료됐어요. 다시 로그인해 주세요.')
          return false
        }
        if (!refineData.ok || !refineData.imageUrl) {
          setFuseStatus(
            `AI ${yawLabel} 실패: ${refineData.message || refineData.error || refineRes.status}`,
            true,
          )
          return false
        }

        setFuseStatus(`AI ${yawLabel} 결과를 원본과 안전하게 합성 중…`, false)
        let mergedUrl
        if (seamOnly && seamMask) {
          // 마스크 밖은 100% 원본 — 몸통/얼굴 통째 소실 방지
          mergedUrl = await compositeMaskedAi(beforeUrl, refineData.imageUrl, seamMask)
        } else {
          mergedUrl = await blendPreserveDetail(beforeUrl, refineData.imageUrl)
        }
        try {
          await replaceCanvasWithImage(mergedUrl)
        } catch (applyErr) {
          if (applyErr?.message === 'ai_result_empty') {
            setFuseStatus(
              'AI가 화면을 비워 버려 적용하지 않았어요. 이전 합성은 그대로입니다.',
              true,
            )
            return false
          }
          throw applyErr
        }
        setTool('move')
        if (final) {
          setFuseStep(6, { announce: false })
          setFuseStatus(
            'AI 최종 완성 완료. 확인 후 「픽셀로 확정」. 어색하면 「손보기 되돌리기」.',
            false,
          )
        } else {
          setFuseStatus(
            yaw === 'face'
              ? '얼굴→측면 완료. 어색하면 「손보기 되돌리기」또는 「몸→정면」을 시도하세요.'
              : yaw === 'body'
                ? '몸→정면 완료. 어색하면 「손보기 되돌리기」또는 「얼굴→측면」을 시도하세요.'
                : '자연스럽게 다듬었어요(올가미 자국·목 이음). 몸·얼굴은 유지됩니다. 어색하면 「손보기 되돌리기」.',
            false,
          )
        }
        return true
      } catch (err) {
        if (err?.message === 'ai_result_empty') {
          setFuseStatus('AI 결과가 비어 적용하지 않았어요. 이전 화면을 유지합니다.', true)
        } else {
          setFuseStatus(err?.message || 'AI 손보기 중 오류가 났어요.', true)
        }
        return false
      } finally {
        window.clearInterval(tick)
        polishBusy = false
        if (aiPolishBtn) aiPolishBtn.disabled = false
        if (aiFinishBtn) aiFinishBtn.disabled = false
        if (aiFinishBtn2) aiFinishBtn2.disabled = false
        if (yawFaceBtn) yawFaceBtn.disabled = false
        if (yawBodyBtn) yawBodyBtn.disabled = false
        if (commitBtn) commitBtn.disabled = false
      }
    }

    async function runAiFinalFinish() {
      if (polishBusy) return
      if (!layers.length) {
        setFuseStatus('재료와 얼굴 배치를 끝낸 뒤 「AI 최종 완성」을 누르세요.', true)
        setFuseStep(1)
        return
      }
      setFuseStep(6, { announce: false })
      // 몸 + 얼굴 조각만 — 자투리가 AI에 들어가면 유령 인물로 나옴
      const facePiece =
        selectedLayer() && selectedLayer().slot !== 0
          ? selectedLayer()
          : layers.find((l) => l.slot !== 0)
      if (facePiece) {
        selectedId = facePiece.id
        keepOnlyBodyAndPiece(facePiece)
      }
      const ok = window.confirm(
        'AI 최종 완성할까요?\n\n· 경계·흰 자국·배경 메움\n· 피부톤·조도\n· 측면(요) 맞춤(위에서 고른 값)\n\n맞추기까지 끝났는지 확인하세요.',
      )
      if (!ok) return
      // 최종은 슬라이더를 강하게
      if (edgeInput) edgeInput.value = '2'
      if (skinInput) skinInput.value = '2'
      if (lightInput) lightInput.value = '2'
      syncPolishLabels()
      await runAiPolish(getYawMode(), { final: true })
    }

    ;[faceSizeInput, edgeInput, skinInput, lightInput, brightInput, satInput].forEach((el) => {
      el?.addEventListener('input', syncPolishLabels)
    })
    syncPolishLabels()

    aiMatteBtn?.addEventListener('click', () => {
      void fuseAiMatteSelected()
    })
    yawFaceBtn?.addEventListener('click', () => {
      if (yawSelect) yawSelect.value = 'face'
      void runAiPolish('face')
    })
    yawBodyBtn?.addEventListener('click', () => {
      if (yawSelect) yawSelect.value = 'body'
      void runAiPolish('body')
    })
    aiPolishBtn?.addEventListener('click', () => {
      void runAiPolish()
    })
    aiFinishBtn?.addEventListener('click', () => {
      void runAiFinalFinish()
    })
    aiFinishBtn2?.addEventListener('click', () => {
      void runAiFinalFinish()
    })
    aiUndoBtn?.addEventListener('click', async () => {
      if (!polishUndoDataUrl) return
      try {
        await replaceCanvasWithImage(polishUndoDataUrl)
        setFuseStatus('AI 손보기 전 상태로 되돌렸어요.', false)
      } catch (err) {
        setFuseStatus(err?.message || '되돌리기 실패', true)
      }
    })

    commitBtn?.addEventListener('click', () => {
      if (!layers.length) {
        setFuseStatus('슬롯에 그림을 하나 이상 넣어 주세요.', true)
        return
      }
      if (polishBusy) {
        setFuseStatus('AI 손보기가 끝날 때까지 기다려 주세요.', true)
        return
      }
      const dataUrl = exportFlatDataUrl('image/png')
      const current = deps.getCurrentResult?.() || {}
      deps.setAdminPanel?.('fashion')
      deps.showResult?.(dataUrl, '픽셀 합성 (AI 없음)', false, {
        genMode: 'fashion',
        size: current.size || 'portrait',
        prompt: current.prompt || 'fuse composite',
        reviseRound: (current.reviseRound || 0) + 1,
        mood: current.mood || deps.moodField?.value,
      })
      const dl = document.getElementById('result-download')
      if (dl) dl.download = 'fuse-composite.png'
      setFuseStatus('픽셀로 확정했어요. 필요하면 화보에서 추가 다듬기·숏츠로 이어가세요.', false)
      deps.setFormStatus?.('합성 결과를 결과 패널에 올렸어요.', false)
      setFuseStep(6, { announce: false })
    })

    setTool('move')
    paintSlotButtons()
    applyViewZoomCss()
    syncLassoSize()
    setFuseStep(1, { announce: false })
    redrawFuse()
    let resizeTimer = 0
    window.addEventListener('resize', () => {
      if (!fusePanel || fusePanel.hidden) return
      // 창 최소/최대화 때 나오는 휠·핀치를 줌으로 먹지 않음
      ignoreWheelUntil = Date.now() + 800
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        // 화면 표시 폭만 갱신 — viewZoom·레이어 크기는 건드리지 않음
        applyViewZoomCss()
        syncLassoSize()
      }, 50)
    })
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        syncLassoSize()
        if (tool === 'lasso' && fuseLasso) {
          const lctx = lassoCanvas.getContext('2d')
          fuseLasso.draw(lctx)
        }
      })
      ro.observe(canvas)
    }
  }

  global.StorymagAdminFuse = { init }
})(typeof window !== 'undefined' ? window : globalThis)
