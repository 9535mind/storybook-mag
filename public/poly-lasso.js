/**
 * 포토샵형 톡톡톡 다각형 올가미 (점 찍기 → 닫기 → 마스크).
 * 합성·다듬기 공통. window.StorymagPolyLasso 로 노출.
 */
;(function (global) {
  /**
   * @typedef {{ x: number, y: number }} Pt
   * @typedef {{ id: number, points: Pt[] }} PolyRegion
   */

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{
   *   onChange?: () => void
   *   onStatus?: (msg: string, isError?: boolean) => void
   *   getImageSize?: () => { w: number, h: number }
   * }} [opts]
   */
  function createPolyLasso(canvas, opts) {
    const options = opts || {}
    /** @type {PolyRegion[]} */
    let regions = []
    /** @type {Pt[]} */
    let draft = []
    let nextId = 1
    let enabled = false

    function status(msg, isError) {
      if (typeof options.onStatus === 'function') options.onStatus(msg, Boolean(isError))
    }

    function emit() {
      if (typeof options.onChange === 'function') options.onChange()
    }

    function pointerToCanvas(event) {
      const bounds = canvas.getBoundingClientRect()
      const scaleX = canvas.width / Math.max(1, bounds.width)
      const scaleY = canvas.height / Math.max(1, bounds.height)
      return {
        x: Math.max(0, Math.min(canvas.width, (event.clientX - bounds.left) * scaleX)),
        y: Math.max(0, Math.min(canvas.height, (event.clientY - bounds.top) * scaleY)),
      }
    }

    function clearDraft() {
      draft = []
      emit()
    }

    function clearAll() {
      regions = []
      draft = []
      nextId = 1
      emit()
    }

    function undoLastPoint() {
      if (draft.length) {
        draft.pop()
        status(draft.length ? `점 ${draft.length}개 · 계속 찍거나 닫으세요.` : '점이 없어요. 좌클릭으로 시작하세요.')
        emit()
        return true
      }
      if (regions.length) {
        regions.pop()
        status(`선택 ${regions.length}개 남음.`, false)
        emit()
        return true
      }
      return false
    }

    function closeDraft() {
      if (draft.length < 3) {
        status('점을 3개 이상 찍은 뒤 닫아 주세요.', true)
        return false
      }
      regions.push({ id: nextId, points: draft.slice() })
      nextId += 1
      draft = []
      status(`선택 ${regions.length}개 확정. 우클릭으로 더 조작할 수 있어요.`, false)
      emit()
      return true
    }

    function draw(ctx) {
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      regions.forEach((region, index) => {
        drawPoly(ctx, region.points, index + 1, false)
      })
      if (draft.length) {
        drawPoly(ctx, draft, regions.length + 1, true)
      }
    }

    function drawPoly(ctx, points, label, isDraft) {
      if (!points.length) return
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y)
      if (!isDraft && points.length >= 3) ctx.closePath()

      ctx.fillStyle = isDraft ? 'rgba(250, 204, 21, 0.18)' : 'rgba(56, 189, 248, 0.22)'
      if (!isDraft && points.length >= 3) ctx.fill()

      ctx.strokeStyle = isDraft ? '#facc15' : '#38bdf8'
      ctx.lineWidth = 2
      ctx.stroke()

      points.forEach((p, i) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = i === 0 ? '#f472b6' : '#fff'
        ctx.fill()
        ctx.strokeStyle = '#0f172a'
        ctx.lineWidth = 1
        ctx.stroke()
      })

      const cx = points.reduce((s, p) => s + p.x, 0) / points.length
      const cy = points.reduce((s, p) => s + p.y, 0) / points.length
      ctx.font = 'bold 14px sans-serif'
      ctx.fillStyle = '#0f172a'
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 3
      ctx.strokeText(String(label), cx - 4, cy + 4)
      ctx.fillText(String(label), cx - 4, cy + 4)
    }

    /**
     * 흰=수정 영역 마스크 (가장자리 살짝 블러 → inpaint가 더 매끈하게)
     */
    function buildMaskDataUrl(maxSide) {
      if (!regions.length) return null
      const size =
        typeof options.getImageSize === 'function'
          ? options.getImageSize()
          : { w: canvas.width, h: canvas.height }
      const natW = Math.max(1, size.w || canvas.width)
      const natH = Math.max(1, size.h || canvas.height)
      const cap = typeof maxSide === 'number' ? maxSide : 768
      const outScale = Math.min(1, cap / Math.max(natW, natH))
      const outW = Math.max(1, Math.round(natW * outScale))
      const outH = Math.max(1, Math.round(natH * outScale))
      const scaleX = outW / canvas.width
      const scaleY = outH / canvas.height

      const mask = document.createElement('canvas')
      mask.width = outW
      mask.height = outH
      const ctx = mask.getContext('2d')
      if (!ctx) return null
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, outW, outH)

      const soft = document.createElement('canvas')
      soft.width = outW
      soft.height = outH
      const sctx = soft.getContext('2d')
      if (!sctx) return null
      sctx.fillStyle = '#ffffff'
      for (const region of regions) {
        if (region.points.length < 3) continue
        sctx.beginPath()
        sctx.moveTo(region.points[0].x * scaleX, region.points[0].y * scaleY)
        for (let i = 1; i < region.points.length; i += 1) {
          sctx.lineTo(region.points[i].x * scaleX, region.points[i].y * scaleY)
        }
        sctx.closePath()
        sctx.fill()
      }
      // 가장자리 부드럽게 (AI 확정 느낌의 1차 처리)
      sctx.filter = 'blur(2.5px)'
      sctx.drawImage(soft, 0, 0)
      sctx.filter = 'none'

      ctx.drawImage(soft, 0, 0)
      return mask.toDataURL('image/png')
    }

    function onPointerDown(event) {
      if (!enabled || event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      const p = pointerToCanvas(event)
      // 첫 점 근처를 다시 찍으면 닫기
      if (
        draft.length >= 3 &&
        Math.hypot(p.x - draft[0].x, p.y - draft[0].y) < 12
      ) {
        closeDraft()
        return
      }
      draft.push(p)
      status(`점 ${draft.length}개 · 더블클릭/Enter로 닫기 · 우클릭 메뉴`, false)
      emit()
    }

    function onDblClick(event) {
      if (!enabled) return
      event.preventDefault()
      closeDraft()
    }

    function onContextMenu(event) {
      if (!enabled) return
      event.preventDefault()
      event.stopPropagation()
      showMenu(event.clientX, event.clientY)
    }

    function onKeyDown(event) {
      if (!enabled) return
      if (event.key === 'Enter') {
        event.preventDefault()
        closeDraft()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        clearDraft()
        status('그리는 중 선택을 취소했어요.', false)
      } else if (event.key === 'Backspace' || (event.ctrlKey && event.key === 'z')) {
        event.preventDefault()
        undoLastPoint()
      }
    }

    /** @type {HTMLDivElement | null} */
    let menuEl = null

    function hideMenu() {
      if (menuEl) {
        menuEl.remove()
        menuEl = null
      }
      document.removeEventListener('click', hideMenu, true)
    }

    function showMenu(x, y) {
      hideMenu()
      menuEl = document.createElement('div')
      menuEl.className = 'poly-lasso-menu'
      menuEl.setAttribute('role', 'menu')
      const items = [
        { label: '선택 닫기 (Enter)', action: () => closeDraft() },
        { label: '마지막 점 취소', action: () => undoLastPoint() },
        { label: '그리는 중 취소 (Esc)', action: () => clearDraft() },
        { label: '모든 선택 지우기', action: () => clearAll() },
      ]
      items.forEach((item) => {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'poly-lasso-menu__item'
        btn.setAttribute('role', 'menuitem')
        btn.textContent = item.label
        btn.addEventListener('click', (e) => {
          e.preventDefault()
          hideMenu()
          item.action()
        })
        menuEl.appendChild(btn)
      })
      document.body.appendChild(menuEl)
      const pad = 8
      const mw = menuEl.offsetWidth
      const mh = menuEl.offsetHeight
      menuEl.style.left = `${Math.min(x, window.innerWidth - mw - pad)}px`
      menuEl.style.top = `${Math.min(y, window.innerHeight - mh - pad)}px`
      window.setTimeout(() => document.addEventListener('click', hideMenu, true), 0)
    }

    function setEnabled(on) {
      enabled = Boolean(on)
      if (!enabled) {
        hideMenu()
        clearAll()
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('dblclick', onDblClick)
    canvas.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown)

    return {
      setEnabled,
      clearAll,
      clearDraft,
      undoLastPoint,
      closeDraft,
      draw,
      buildMaskDataUrl,
      getRegions: () => regions.slice(),
      getDraftCount: () => draft.length,
      destroy() {
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('dblclick', onDblClick)
        canvas.removeEventListener('contextmenu', onContextMenu)
        window.removeEventListener('keydown', onKeyDown)
        hideMenu()
      },
    }
  }

  global.StorymagPolyLasso = { create: createPolyLasso }
})(typeof window !== 'undefined' ? window : globalThis)
