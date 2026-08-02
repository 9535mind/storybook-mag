/**
 * 관리자 합성 — 슬롯·배치·올가미 컷/구멍·머리 교체·픽셀 확정.
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
    /** @type {Array<{ id: number, slot: number, img: HTMLImageElement, x: number, y: number, w: number, h: number, flipX: boolean }>} */
    let layers = []
    let nextLayerId = 1
    let nextFreeSlot = 3
    let activeSlot = 0
    let drag = null
    let selectedId = null
    /** @type {'move' | 'lasso'} */
    let tool = 'move'
    let fuseLasso = null
    let headHelpStep = 0

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

    function redrawFuse() {
      if (!ctx) return
      ctx.fillStyle = '#020617'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      layers.forEach((layer) => {
        ctx.save()
        if (layer.flipX) {
          ctx.translate(layer.x + layer.w, layer.y)
          ctx.scale(-1, 1)
          ctx.drawImage(layer.img, 0, 0, layer.w, layer.h)
        } else {
          ctx.drawImage(layer.img, layer.x, layer.y, layer.w, layer.h)
        }
        ctx.restore()
        if (layer.id === selectedId) {
          ctx.strokeStyle = '#facc15'
          ctx.lineWidth = 2
          ctx.strokeRect(layer.x + 0.5, layer.y + 0.5, layer.w - 1, layer.h - 1)
        }
      })
      if (fuseLasso && tool === 'lasso') {
        const lctx = lassoCanvas.getContext('2d')
        fuseLasso.draw(lctx)
      }
    }

    function hitLayer(x, y) {
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        const L = layers[i]
        if (x >= L.x && x <= L.x + L.w && y >= L.y && y <= L.y + L.h) return L
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
        let lx = ((p.x - layer.x) / Math.max(1, layer.w)) * layer.img.naturalWidth
        let ly = ((p.y - layer.y) / Math.max(1, layer.h)) * layer.img.naturalHeight
        if (layer.flipX) lx = layer.img.naturalWidth - lx
        return {
          x: Math.max(0, Math.min(layer.img.naturalWidth, lx)),
          y: Math.max(0, Math.min(layer.img.naturalHeight, ly)),
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
      const layer = { id: nextLayerId, slot: slotIndex, img, x, y, w, h, flipX: false }
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

    function setTool(next) {
      tool = next === 'lasso' ? 'lasso' : 'move'
      document.querySelectorAll('[data-fuse-tool]').forEach((btn) => {
        const on = btn.getAttribute('data-fuse-tool') === tool
        btn.classList.toggle('admin-subnav__btn--active', on)
        btn.setAttribute('aria-pressed', on ? 'true' : 'false')
      })
      syncLassoSize()
      const lasso = ensureFuseLasso()
      if (tool === 'lasso') {
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
        setFuseStatus('이동: 드래그로 배치 · 우클릭으로 레이어 조작.', false)
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
      let dispX = Math.round(layer.x + minX * scaleX)
      let dispY = Math.round(layer.y + minY * scaleY)
      if (layer.flipX) {
        dispX = Math.round(layer.x + layer.w - (minX + outW) * scaleX)
      }

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
          ? '잘라내 새 레이어로 올렸어요. 드래그로 위치를 맞추세요.'
          : '선택 부분을 새 레이어로 복사했어요. (원본은 그대로)',
        false,
      )
      if (headHelpStep === 2) {
        headHelpStep = 3
        setFuseStatus(
          '머리 교체 ③: (선택) 몸 레이어를 고르고 옛 머리를 올가미 → 「구멍 뚫기」. 끝나면 「픽셀로 확정」.',
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
      const cx = layer.x + layer.w / 2
      const cy = layer.y + layer.h / 2
      layer.w = Math.max(24, Math.round(layer.w * factor))
      layer.h = Math.max(24, Math.round(layer.h * factor))
      layer.x = Math.round(cx - layer.w / 2)
      layer.y = Math.round(cy - layer.h / 2)
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
        '머리 교체 ①: 슬롯1에 몸/배경, 슬롯2에 머리 원본을 넣으세요. ② 슬롯2 선택 → 올가미로 머리 → 「잘라 새 레이어」.',
        false,
      )
      headHelpStep = 2
    })

    canvas.addEventListener('pointerdown', (event) => {
      if (tool !== 'move' || event.button !== 0) return
      const p = pointer(event, canvas)
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

    canvas.addEventListener('wheel', (event) => {
      if (tool !== 'move') return
      const layer = selectedLayer()
      if (!layer) return
      event.preventDefault()
      scaleLayer(layer, event.deltaY < 0 ? 1.05 : 1 / 1.05)
      redrawFuse()
    }, { passive: false })

    canvas.addEventListener('contextmenu', (event) => {
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

    commitBtn?.addEventListener('click', () => {
      if (!layers.length) {
        setFuseStatus('슬롯에 그림을 하나 이상 넣어 주세요.', true)
        return
      }
      if (tool === 'lasso') setTool('move')
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
