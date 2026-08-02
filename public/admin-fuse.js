/**
 * 관리자 합성 — 슬롯·배치·포인트 맞춤·올가미 컷/구멍·머리 교체·픽셀 확정.
 * window.StorymagAdminFuse.init(deps)
 */
;(function (global) {
  /**
   * @param {{
   *   getCurrentResult: () => any
   *   showResult: Function
   *   setAdminPanel: (p: string) => void
   *   setFormStatus: (msg: string, err?: boolean) => void
   *   moodField?: HTMLSelectElement | null
   * }} deps
   */
  function init(deps) {
    const canvas = document.getElementById('admin-fuse-canvas')
    const lassoCanvas = document.getElementById('admin-fuse-lasso')
    const fileInput = document.getElementById('admin-fuse-file-input')
    const statusEl = document.getElementById('admin-fuse-status')
    const commitBtn = document.getElementById('admin-fuse-commit')
    const fromResultBtn = document.getElementById('admin-fuse-from-result')
    const cutBtn = document.getElementById('admin-fuse-cut')
    const punchBtn = document.getElementById('admin-fuse-punch')
    const helperBtn = document.getElementById('admin-fuse-head-help')
    if (!canvas || !fileInput || !lassoCanvas) return

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
    let headHelpStep = 0
    /**
     * 포인트 맞춤: 옮길 레이어 위 src 2점 → 목표 dst 2점
     * @type {null | { layerId: number, src: Array<{x:number,y:number}>, dst: Array<{x:number,y:number}> }}
     */
    let alignSession = null

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
        btn.querySelector('img')?.remove()
        if (layer?.img?.src) {
          const img = document.createElement('img')
          img.src = layer.img.src
          img.alt = ''
          btn.appendChild(img)
        }
        if (label) {
          if (idx === 0) label.textContent = '1 몸/배경'
          else if (idx === 1) label.textContent = '2 머리원본'
          else label.textContent = String(idx + 1)
        }
        btn.classList.toggle('admin-fuse-slot--active', idx === activeSlot)
      })
    }

    function layerCenter(layer) {
      return { x: layer.x + layer.w / 2, y: layer.y + layer.h / 2 }
    }

    function drawLayer(layer) {
      if (!ctx) return
      const c = layerCenter(layer)
      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.rotate(layer.rotation || 0)
      if (layer.flipX) ctx.scale(-1, 1)
      ctx.drawImage(layer.img, -layer.w / 2, -layer.h / 2, layer.w, layer.h)
      ctx.restore()
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

    function redrawFuse() {
      if (!ctx) return
      ctx.fillStyle = '#020617'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      layers.forEach((layer) => {
        drawLayer(layer)
        if (layer.id === selectedId) strokeLayerBounds(layer)
      })
      if (tool === 'align') drawAlignMarks()
      if (fuseLasso && tool === 'lasso') {
        const lctx = lassoCanvas.getContext('2d')
        fuseLasso.draw(lctx)
      }
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
      lassoCanvas.style.width = canvas.style.width || '100%'
      lassoCanvas.style.height = 'auto'
    }

    function canvasPointsToNatural(layer, points) {
      return points.map((p) => {
        const local = canvasToLayerLocal(layer, p)
        const nx = (local.x / Math.max(1, layer.w)) * layer.img.naturalWidth
        const ny = (local.y / Math.max(1, layer.h)) * layer.img.naturalHeight
        return {
          x: Math.max(0, Math.min(layer.img.naturalWidth, nx)),
          y: Math.max(0, Math.min(layer.img.naturalHeight, ny)),
        }
      })
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
      const img = await loadImage(url)
      layers = layers.filter((l) => l.slot !== slotIndex)
      const maxW = canvas.width * (slotIndex === 0 ? 1 : 0.55)
      const maxH = canvas.height * (slotIndex === 0 ? 1 : 0.55)
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
      const w = Math.max(40, Math.round(img.naturalWidth * scale))
      const h = Math.max(40, Math.round(img.naturalHeight * scale))
      const x = slotIndex === 0 ? 0 : Math.round((canvas.width - w) / 2)
      const y = slotIndex === 0 ? 0 : Math.round((canvas.height - h) / 2)
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
      setFuseStatus(`슬롯 ${slotIndex + 1}에 올렸어요.`, false)
      return layer
    }

    function ensureFuseLasso() {
      if (fuseLasso) return fuseLasso
      if (!global.StorymagPolyLasso?.create) return null
      fuseLasso = global.StorymagPolyLasso.create(lassoCanvas, {
        onChange: () => redrawFuse(),
        onStatus: (msg, isError) => setFuseStatus(msg, isError),
        getImageSize: () => ({ w: canvas.width, h: canvas.height }),
      })
      return fuseLasso
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

    function applyAlignTransform() {
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
        if (alignSession.dst.length === 2) applyAlignTransform()
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
          '올가미: 레이어를 고른 뒤 점을 찍고 닫으세요. 그다음 「잘라 새 레이어」또는 「구멍 뚫기」.',
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

    async function cutSelectionToNewLayer(punchSource) {
      const layer = selectedLayer()
      if (!layer) {
        setFuseStatus('먼저 자를 레이어를 클릭해 선택하세요.', true)
        return
      }
      const points = getClosedPoly()
      if (!points || points.length < 3) {
        setFuseStatus('올가미로 영역을 닫아 주세요 (점 3개+ → Enter).', true)
        return
      }

      const natPts = canvasPointsToNatural(layer, points)
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      natPts.forEach((p) => {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      })
      const pad = 4
      minX = Math.max(0, Math.floor(minX) - pad)
      minY = Math.max(0, Math.floor(minY) - pad)
      maxX = Math.min(layer.img.naturalWidth, Math.ceil(maxX) + pad)
      maxY = Math.min(layer.img.naturalHeight, Math.ceil(maxY) + pad)
      const outW = Math.max(1, maxX - minX)
      const outH = Math.max(1, maxY - minY)

      const soft = document.createElement('canvas')
      soft.width = outW
      soft.height = outH
      const sctx = soft.getContext('2d')
      if (!sctx) return

      sctx.beginPath()
      sctx.moveTo(natPts[0].x - minX, natPts[0].y - minY)
      for (let i = 1; i < natPts.length; i += 1) {
        sctx.lineTo(natPts[i].x - minX, natPts[i].y - minY)
      }
      sctx.closePath()
      sctx.fillStyle = '#fff'
      sctx.fill()
      sctx.filter = 'blur(1.8px)'
      sctx.drawImage(soft, 0, 0)
      sctx.filter = 'none'

      const out = document.createElement('canvas')
      out.width = outW
      out.height = outH
      const octx = out.getContext('2d')
      if (!octx) return
      octx.drawImage(layer.img, minX, minY, outW, outH, 0, 0, outW, outH)
      octx.globalCompositeOperation = 'destination-in'
      octx.drawImage(soft, 0, 0)
      octx.globalCompositeOperation = 'source-over'

      const dataUrl = out.toDataURL('image/png')
      const scaleX = layer.w / layer.img.naturalWidth
      const scaleY = layer.h / layer.img.naturalHeight
      const dispW = Math.max(24, Math.round(outW * scaleX))
      const dispH = Math.max(24, Math.round(outH * scaleY))
      // 회전된 레이어에서 잘린 조각은 축정렬 bbox로 올린다(회전은 리셋 후 포인트 맞춤으로 재배치).
      const c = layerCenter(layer)
      let dispX = Math.round(c.x - dispW / 2)
      let dispY = Math.round(c.y - dispH / 2)

      if (punchSource) {
        await punchHoleInLayer(layer, points)
      }

      const img = await loadImage(dataUrl)
      const slot = nextFreeSlot
      nextFreeSlot += 1
      const newLayer = {
        id: nextLayerId,
        slot,
        img,
        x: dispX,
        y: dispY,
        w: dispW,
        h: dispH,
        flipX: false,
        rotation: 0,
      }
      nextLayerId += 1
      layers.push(newLayer)
      selectedId = newLayer.id
      ensureFuseLasso()?.clearAll()
      paintSlotButtons()
      redrawFuse()
      setTool('move')
      setFuseStatus(
        punchSource
          ? '잘라내 새 레이어로 올렸어요. 「포인트 맞춤」또는 드래그로 위치를 맞추세요.'
          : '선택 부분을 새 레이어로 복사했어요. (원본은 그대로)',
        false,
      )
      if (headHelpStep === 2) {
        headHelpStep = 3
        setFuseStatus(
          '머리 교체 ③: 「포인트 맞춤」으로 눈·턱을 맞추거나, (선택) 몸에서 옛 머리 「구멍 뚫기」 후 「픽셀로 확정」.',
          false,
        )
      }
    }

    async function punchHoleInLayer(layer, canvasPoints) {
      const natPts = canvasPointsToNatural(layer, canvasPoints)
      const c = document.createElement('canvas')
      c.width = layer.img.naturalWidth
      c.height = layer.img.naturalHeight
      const cctx = c.getContext('2d')
      if (!cctx) return
      cctx.drawImage(layer.img, 0, 0)

      const mask = document.createElement('canvas')
      mask.width = c.width
      mask.height = c.height
      const mctx = mask.getContext('2d')
      if (!mctx) return
      mctx.fillStyle = '#fff'
      mctx.beginPath()
      mctx.moveTo(natPts[0].x, natPts[0].y)
      for (let i = 1; i < natPts.length; i += 1) mctx.lineTo(natPts[i].x, natPts[i].y)
      mctx.closePath()
      mctx.fill()
      mctx.filter = 'blur(2px)'
      mctx.drawImage(mask, 0, 0)
      mctx.filter = 'none'

      cctx.globalCompositeOperation = 'destination-out'
      cctx.drawImage(mask, 0, 0)
      cctx.globalCompositeOperation = 'source-over'

      layer.img = await loadImage(c.toDataURL('image/png'))
    }

    async function punchSelected() {
      const layer = selectedLayer()
      if (!layer) {
        setFuseStatus('구멍을 뚫을 레이어를 선택하세요.', true)
        return
      }
      const points = getClosedPoly()
      if (!points || points.length < 3) {
        setFuseStatus('올가미로 지울 영역을 닫아 주세요.', true)
        return
      }
      await punchHoleInLayer(layer, points)
      ensureFuseLasso()?.clearAll()
      paintSlotButtons()
      redrawFuse()
      setTool('move')
      setFuseStatus('선택 영역을 투명하게 뚫었어요.', false)
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

    document.querySelectorAll('[data-fuse-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSlot = Number(btn.getAttribute('data-fuse-slot')) || 0
        const existing = layers.find((l) => l.slot === activeSlot)
        if (existing) selectedId = existing.id
        paintSlotButtons()
        redrawFuse()
        fileInput.click()
      })
    })

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      fileInput.value = ''
      if (!file) return
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          await placeImage(String(reader.result), activeSlot)
        } catch (err) {
          setFuseStatus(err?.message || '불러오기 실패', true)
        }
      }
      reader.readAsDataURL(file)
    })

    fromResultBtn?.addEventListener('click', async () => {
      const current = deps.getCurrentResult?.()
      if (!current?.imageUrl) {
        setFuseStatus('먼저 화보를 생성한 뒤 가져오세요.', true)
        return
      }
      try {
        await placeImage(current.imageUrl, activeSlot)
      } catch (err) {
        setFuseStatus(err?.message || '결과 불러오기 실패', true)
      }
    })

    cutBtn?.addEventListener('click', () => {
      void cutSelectionToNewLayer(true)
    })
    punchBtn?.addEventListener('click', () => {
      void punchSelected()
    })
    document.getElementById('admin-fuse-copy')?.addEventListener('click', () => {
      void cutSelectionToNewLayer(false)
    })

    helperBtn?.addEventListener('click', () => {
      headHelpStep = 1
      setTool('move')
      setFuseStatus(
        '머리 교체 ①: 슬롯1에 몸/배경, 슬롯2에 머리 원본 → ② 올가미로 머리 잘라 새 레이어 → ③ 「포인트 맞춤」으로 눈·턱 맞추기.',
        false,
      )
      headHelpStep = 2
    })

    canvas.addEventListener('pointerdown', (event) => {
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
      if (!drag || tool !== 'move') return
      const layer = layers.find((l) => l.id === drag.id)
      if (!layer) return
      const p = pointer(event, canvas)
      layer.x = Math.round(p.x - drag.ox)
      layer.y = Math.round(p.y - drag.oy)
      redrawFuse()
    })

    canvas.addEventListener('pointerup', () => {
      drag = null
    })

    canvas.addEventListener(
      'wheel',
      (event) => {
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
      },
      { passive: false },
    )

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

    commitBtn?.addEventListener('click', () => {
      if (!layers.length) {
        setFuseStatus('슬롯에 그림을 하나 이상 넣어 주세요.', true)
        return
      }
      if (tool === 'lasso' || tool === 'align') setTool('move')
      redrawFuse()
      const dataUrl = canvas.toDataURL('image/png')
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
      setFuseStatus('픽셀로 확정했어요. 화보 만들기에서 다듬기·숏츠로 이어가세요.', false)
      deps.setFormStatus?.('합성 결과를 결과 패널에 올렸어요.', false)
      headHelpStep = 0
    })

    setTool('move')
    paintSlotButtons()
    redrawFuse()
  }

  global.StorymagAdminFuse = { init }
})(typeof window !== 'undefined' ? window : globalThis)
