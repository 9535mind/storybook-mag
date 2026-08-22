/**
 * 포토샵형 톡톡톡 다각형 올가미 (점 찍기 → 닫기 → 마스크).
 * 닫힌 선택: 새 올가미는 안 생김. 꼭짓점·변을 드래그해 닫힌 채로 다듬기 가능.
 * window.StorymagPolyLasso 로 노출.
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
   *   onClosed?: () => void
   *   getImageSize?: () => { w: number, h: number }
   *   getExtraMenuItems?: () => Array<{ label: string, action: () => void }>
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
    /** 닫힌 뒤 true — 새 드래프트 금지, 꼭짓점 드래그만 허용 */
    let locked = false
    let ignoreNextPointerDown = false
    /** @type {null | { regionIndex: number, pointIndex: number }} */
    let dragVertex = null
    /** @type {number} */
    let hoverPointIndex = -1
    /** @type {number} */
    let hoverEdgeIndex = -1

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
      // 가장자리로 클램프하지 않음 — 누르면 점이 변으로 붙으며 올가미 모양이 찌그러짐
      return {
        x: (event.clientX - bounds.left) * scaleX,
        y: (event.clientY - bounds.top) * scaleY,
      }
    }

    /** 화면에서 거의 같은 크기의 히트 반경 (캔버스 좌표) */
    function hitRadius() {
      const bounds = canvas.getBoundingClientRect()
      const scale = canvas.width / Math.max(1, bounds.width)
      return Math.max(10, Math.min(28, 14 * scale))
    }

    function copyPoints(points) {
      return points.map((p) => ({ x: p.x, y: p.y }))
    }

    function clearDraft() {
      draft = []
      emit()
    }

    function clearAll() {
      regions = []
      draft = []
      nextId = 1
      locked = false
      ignoreNextPointerDown = false
      dragVertex = null
      hoverPointIndex = -1
      hoverEdgeIndex = -1
      emit()
    }

    function unlockAndRedraw() {
      clearAll()
      status('올가미를 다시 그으세요. 닫으면 꼭짓점을 잡아 당길 수 있어요.', false)
    }

    function undoLastPoint() {
      if (locked) {
        status('닫힌 선택은 꼭짓점을 드래그해 다듬으세요. 다시 그리려면 Esc.', true)
        return false
      }
      if (draft.length) {
        draft.pop()
        status(
          draft.length ? `점 ${draft.length}개 · 계속 찍거나 닫으세요.` : '점이 없어요. 좌클릭으로 시작하세요.',
        )
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
      if (locked && regions.length) {
        status('닫힌 선택: 흰 점을 잡아 당기거나, 변 가운데를 끌어 튀어나오게 하세요.', false)
        return false
      }
      if (draft.length < 3) {
        status('점을 3개 이상 찍은 뒤 닫아 주세요.', true)
        return false
      }
      regions = [{ id: nextId, points: copyPoints(draft) }]
      nextId += 1
      draft = []
      locked = true
      ignoreNextPointerDown = true
      window.setTimeout(() => {
        ignoreNextPointerDown = false
      }, 350)
      status(
        '선택 닫힘 · 흰 점/변을 드래그해 다듬기 · 우클릭 「쓸 조각」/「버릴 조각」',
        false,
      )
      emit()
      if (typeof options.onClosed === 'function') options.onClosed()
      return true
    }

    function distPoint(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y)
    }

    /** 선분 AB 위 最近点과 거리 */
    function distToSegment(p, a, b) {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len2 = dx * dx + dy * dy
      if (len2 < 1e-6) return { dist: distPoint(p, a), t: 0, qx: a.x, qy: a.y }
      let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
      t = Math.max(0, Math.min(1, t))
      const qx = a.x + t * dx
      const qy = a.y + t * dy
      return { dist: Math.hypot(p.x - qx, p.y - qy), t, qx, qy }
    }

    /**
     * @returns {null | { kind: 'vertex', pointIndex: number } | { kind: 'edge', edgeIndex: number, qx: number, qy: number }}
     */
    function hitTestLocked(p) {
      if (!regions.length) return null
      const pts = regions[0].points
      const r = hitRadius()
      let bestV = -1
      let bestVd = r
      for (let i = 0; i < pts.length; i += 1) {
        const d = distPoint(p, pts[i])
        if (d <= bestVd) {
          bestVd = d
          bestV = i
        }
      }
      if (bestV >= 0) return { kind: 'vertex', pointIndex: bestV }

      const edgeHit = r * 0.85
      let bestE = -1
      let bestEd = edgeHit
      let bestQ = { x: 0, y: 0 }
      for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i]
        const b = pts[(i + 1) % pts.length]
        const seg = distToSegment(p, a, b)
        // 끝점 근처는 꼭짓점으로만
        if (seg.t < 0.12 || seg.t > 0.88) continue
        if (seg.dist <= bestEd) {
          bestEd = seg.dist
          bestE = i
          bestQ = { x: seg.qx, y: seg.qy }
        }
      }
      if (bestE >= 0) return { kind: 'edge', edgeIndex: bestE, qx: bestQ.x, qy: bestQ.y }
      return null
    }

    function updateHover(p) {
      hoverPointIndex = -1
      hoverEdgeIndex = -1
      if (!locked || !regions.length) return
      const hit = hitTestLocked(p)
      if (!hit) return
      if (hit.kind === 'vertex') hoverPointIndex = hit.pointIndex
      else hoverEdgeIndex = hit.edgeIndex
    }

    function draw(ctx) {
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      regions.forEach((region, index) => {
        drawPoly(ctx, region.points, index + 1, false, locked)
      })
      if (draft.length) {
        drawPoly(ctx, draft, regions.length + 1, true, false)
      }
    }

    function drawPoly(ctx, points, label, isDraft, isLocked) {
      if (!points.length) return
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y)
      if (!isDraft && points.length >= 3) ctx.closePath()

      ctx.fillStyle = isDraft
        ? 'rgba(250, 204, 21, 0.18)'
        : isLocked
          ? 'rgba(52, 211, 153, 0.22)'
          : 'rgba(56, 189, 248, 0.22)'
      if (!isDraft && points.length >= 3) ctx.fill()

      // 선은 채움(자르기 경계) 안쪽에만 — 바깥 stroke가 “다른 올가미”처럼 보이던 문제 방지
      ctx.strokeStyle = isDraft ? '#facc15' : isLocked ? '#34d399' : '#38bdf8'
      ctx.lineWidth = isLocked ? 2.5 : 2
      if (!isDraft && points.length >= 3) {
        ctx.save()
        ctx.clip()
        ctx.stroke()
        ctx.restore()
      } else {
        ctx.stroke()
      }

      // 닫힌 상태: 변 중간 핸들(밀고 당기기용)
      if (isLocked && points.length >= 3) {
        for (let i = 0; i < points.length; i += 1) {
          const a = points[i]
          const b = points[(i + 1) % points.length]
          const mx = (a.x + b.x) / 2
          const my = (a.y + b.y) / 2
          ctx.beginPath()
          ctx.arc(mx, my, hoverEdgeIndex === i ? 5 : 3.5, 0, Math.PI * 2)
          ctx.fillStyle = hoverEdgeIndex === i ? '#fde047' : 'rgba(253, 224, 71, 0.85)'
          ctx.fill()
          ctx.strokeStyle = '#0f172a'
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      points.forEach((p, i) => {
        const hot = hoverPointIndex === i || dragVertex?.pointIndex === i
        ctx.beginPath()
        ctx.arc(p.x, p.y, hot ? 6.5 : isLocked ? 5 : 3.5, 0, Math.PI * 2)
        ctx.fillStyle = i === 0 ? '#f472b6' : hot ? '#fef08a' : '#fff'
        ctx.fill()
        ctx.strokeStyle = '#0f172a'
        ctx.lineWidth = hot ? 2 : 1
        ctx.stroke()
      })

      const cx = points.reduce((s, p) => s + p.x, 0) / points.length
      const cy = points.reduce((s, p) => s + p.y, 0) / points.length
      const text = isLocked ? `${label}·조절` : String(label)
      ctx.font = 'bold 13px sans-serif'
      ctx.fillStyle = '#0f172a'
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 3
      ctx.strokeText(text, cx - 16, cy + 4)
      ctx.fillText(text, cx - 16, cy + 4)
    }

    /**
     * @param {number} [maxSide]
     * @param {{ expandPx?: number, blurPx?: number, pointsList?: Pt[][] }} [opts]
     */
    function buildMaskDataUrl(maxSide, opts) {
      const o = opts || {}
      const fromOpts = Array.isArray(o.pointsList) ? o.pointsList : null
      const polys =
        fromOpts && fromOpts.length
          ? fromOpts
          : regions.map((r) => r.points).filter((pts) => pts.length >= 3)
      if (!polys.length) return null
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
      const expandPx = Math.max(0, Math.round(Number(o.expandPx) || 0))
      const blurPx = Math.max(0, Number(o.blurPx) || 2.5)

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
      for (const points of polys) {
        if (points.length < 3) continue
        sctx.beginPath()
        sctx.moveTo(points[0].x * scaleX, points[0].y * scaleY)
        for (let i = 1; i < points.length; i += 1) {
          sctx.lineTo(points[i].x * scaleX, points[i].y * scaleY)
        }
        sctx.closePath()
        sctx.fill()
      }
      if (expandPx > 0) {
        sctx.filter = `blur(${expandPx}px)`
        sctx.drawImage(soft, 0, 0)
        sctx.filter = 'none'
        const img = sctx.getImageData(0, 0, outW, outH)
        const d = img.data
        for (let i = 0; i < d.length; i += 4) {
          const on = d[i] > 40 || d[i + 1] > 40 || d[i + 2] > 40
          d[i] = d[i + 1] = d[i + 2] = on ? 255 : 0
          d[i + 3] = 255
        }
        sctx.putImageData(img, 0, 0)
      }
      if (blurPx > 0) {
        sctx.filter = `blur(${blurPx}px)`
        sctx.drawImage(soft, 0, 0)
        sctx.filter = 'none'
      }

      ctx.drawImage(soft, 0, 0)
      return mask.toDataURL('image/png')
    }

    function onPointerDown(event) {
      if (!enabled || event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()

      if (ignoreNextPointerDown) {
        ignoreNextPointerDown = false
        return
      }

      const p = pointerToCanvas(event)

      if (locked) {
        const hit = hitTestLocked(p)
        if (hit?.kind === 'vertex') {
          dragVertex = { regionIndex: 0, pointIndex: hit.pointIndex }
          canvas.setPointerCapture?.(event.pointerId)
          canvas.style.cursor = 'grabbing'
          status('꼭짓점 이동 중… 놓으면 형태가 유지됩니다.', false)
          emit()
          return
        }
        if (hit?.kind === 'edge') {
          // 변 위에 점 추가 후 그 점을 당김 → 그 부분만 밀고 당기기
          const pts = regions[0].points
          const insertAt = hit.edgeIndex + 1
          pts.splice(insertAt, 0, { x: hit.qx, y: hit.qy })
          dragVertex = { regionIndex: 0, pointIndex: insertAt }
          canvas.setPointerCapture?.(event.pointerId)
          canvas.style.cursor = 'grabbing'
          status('변을 잡아 당기는 중… 그 부분만 밀리거나 당겨집니다.', false)
          emit()
          return
        }
        status(
          '흰 점(꼭짓점) 또는 노란 점(변)을 드래그해 다듬으세요. 우클릭 → 쓸/버리기.',
          false,
        )
        return
      }

      if (draft.length >= 3 && Math.hypot(p.x - draft[0].x, p.y - draft[0].y) < 14) {
        closeDraft()
        return
      }
      draft.push(p)
      status(`점 ${draft.length}개 · 더블클릭/Enter로 닫기 → 닫은 뒤 점·변 드래그 조절`, false)
      emit()
    }

    function onPointerMove(event) {
      if (!enabled) return
      const p = pointerToCanvas(event)

      if (dragVertex && regions[dragVertex.regionIndex]) {
        event.preventDefault()
        const pts = regions[dragVertex.regionIndex].points
        const i = dragVertex.pointIndex
        if (pts[i]) {
          pts[i].x = p.x
          pts[i].y = p.y
          emit()
        }
        return
      }

      if (locked) {
        updateHover(p)
        const hit = hitTestLocked(p)
        canvas.style.cursor = hit ? 'grab' : 'crosshair'
        emit()
      }
    }

    function onPointerUp(event) {
      if (!dragVertex) return
      dragVertex = null
      canvas.style.cursor = locked ? 'crosshair' : ''
      try {
        canvas.releasePointerCapture?.(event.pointerId)
      } catch {
        /* ignore */
      }
      status(
        '조절 반영됨 · 더 다듬거나 우클릭 「쓸 조각」/「버릴 조각」',
        false,
      )
      emit()
    }

    function onDblClick(event) {
      if (!enabled) return
      event.preventDefault()
      if (locked) return
      if (draft.length > 3) draft.pop()
      ignoreNextPointerDown = true
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
        if (dragVertex) {
          dragVertex = null
          return
        }
        if (locked) {
          unlockAndRedraw()
        } else {
          clearDraft()
          status('그리는 중 선택을 취소했어요.', false)
        }
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
      const extra =
        typeof options.getExtraMenuItems === 'function' ? options.getExtraMenuItems() || [] : []
      const items = locked
        ? [
            ...extra,
            { label: '다시 그리기 (Esc)', action: () => unlockAndRedraw() },
            { label: '선택 지우기', action: () => clearAll() },
          ]
        : [
            ...extra,
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
        // 좌표는 유지 — 끄면서 clearAll 하면 우클릭 직후 자르기 점이 사라질 수 있음
        dragVertex = null
        hoverPointIndex = -1
        hoverEdgeIndex = -1
        canvas.style.cursor = ''
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('dblclick', onDblClick)
    canvas.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown)

    return {
      setEnabled,
      clearAll,
      clearDraft,
      undoLastPoint,
      closeDraft,
      unlockAndRedraw,
      draw,
      buildMaskDataUrl,
      getRegions: () => regions.map((r) => ({ id: r.id, points: copyPoints(r.points) })),
      getDraftCount: () => draft.length,
      isLocked: () => locked,
      destroy() {
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerup', onPointerUp)
        canvas.removeEventListener('pointercancel', onPointerUp)
        canvas.removeEventListener('dblclick', onDblClick)
        canvas.removeEventListener('contextmenu', onContextMenu)
        window.removeEventListener('keydown', onKeyDown)
        hideMenu()
      },
    }
  }

  global.StorymagPolyLasso = { create: createPolyLasso }
})(typeof window !== 'undefined' ? window : globalThis)
