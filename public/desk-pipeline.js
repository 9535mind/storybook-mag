/**
 * Desk 정지화 파이프라인 — 얼굴은 픽셀, 엔진은 옷·방만.
 * 한 장면은 Flux로 만들지 않는다. 오려서 키를 맞춘 뒤 붙인다.
 */
(function (global) {
  const JPEG = 0.95

  function load(src) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('desk_pipeline_load'))
      img.src = src
    })
  }

  function sourceSize(src) {
    return {
      w: src.naturalWidth || src.width || 1,
      h: src.naturalHeight || src.height || 1,
    }
  }

  function composeSize(kind) {
    if (kind === 'landscape') return [1920, 1248]
    if (kind === 'square') return [1536, 1536]
    return [1248, 1920]
  }

  function paintStudio(ctx, cw, ch) {
    if (typeof global.paintSeamlessStudio === 'function') {
      global.paintSeamlessStudio(ctx, cw, ch)
      return
    }
    const wall = ctx.createLinearGradient(0, 0, 0, ch)
    wall.addColorStop(0, '#3f4449')
    wall.addColorStop(0.72, '#4a5056')
    wall.addColorStop(1, '#32363a')
    ctx.fillStyle = wall
    ctx.fillRect(0, 0, cw, ch)
  }

  async function isolate(src) {
    let canvas = null
    if (typeof global.isolateOutpaintedPerson === 'function') {
      try {
        const cut = await global.isolateOutpaintedPerson(src, '', { localOnly: true })
        if (cut && cut.width > 24 && cut.height > 24) canvas = cut
      } catch (err) {
        console.warn('desk pipeline isolate failed', err)
      }
    }
    if (!canvas) {
      const img = await load(src)
      canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
    }
    let face = null
    try {
      if (typeof global.estimateFaceBoxFromImage === 'function') {
        face = await global.estimateFaceBoxFromImage(src)
      }
    } catch (_) {
      face = null
    }
    punchStudioFill(canvas, face)
    await punchIdCardAroundFace(canvas, src)
    // 흰 배경에 흰 옷이면 색 채우기가 옷까지 지우고 머리 주변 흰 조각도 남는다. 서버 배경 제거로 먼저 오려 보고, 몸통이 더 온전할 때만 쓴다
    if (typeof global.isolateOutpaintedPerson === 'function') {
      try {
        const remote = await global.isolateOutpaintedPerson(src, '', { localOnly: false })
        if (remote && remote.width > 24 && remote.height > 24 && torsoCoverage(remote) >= torsoCoverage(canvas)) {
          return remote
        }
      } catch (err) {
        console.warn('desk pipeline remote isolate failed', err)
      }
    }
    return canvas
  }

  /** 오린 사람 가운데 몸통 칸(가로 가운데 30%, 세로 30~70%)에서 남은 화소 비율. 사람이면 거의 1이다. */
  function torsoCoverage(cut) {
    const w = cut.width || 1
    const h = cut.height || 1
    const x0 = Math.floor(w * 0.35)
    const x1 = Math.ceil(w * 0.65)
    const y0 = Math.floor(h * 0.3)
    const y1 = Math.ceil(h * 0.7)
    const d = cut.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, x1 - x0, y1 - y0).data
    let on = 0
    let all = 0
    for (let i = 3; i < d.length; i += 16) {
      all += 1
      if (d[i] >= 40) on += 1
    }
    return all ? on / all : 1
  }

  function personBox(cut) {
    const w = cut.width || 1
    const h = cut.height || 1
    const ctx = cut.getContext('2d', { willReadFrequently: true })
    const d = ctx.getImageData(0, 0, w, h).data
    let minX = w
    let minY = h
    let maxX = 0
    let maxY = 0
    const corner = (x, y) => {
      const i = (y * w + x) * 4
      return [d[i], d[i + 1], d[i + 2]]
    }
    const refs = [corner(2, 2), corner(w - 3, 2), corner(2, h - 3), corner(w - 3, h - 3)]
    const isPerson = (r, g, b, a) => {
      if (a < 28) return false
      const sat = Math.max(r, g, b) - Math.min(r, g, b)
      const y = r * 0.299 + g * 0.587 + b * 0.114
      if (y > 246 && sat < 16) return false
      if (y > 78 && y < 220 && sat < 16) return false
      for (let i = 0; i < refs.length; i += 1) {
        if (sat < 24 && Math.hypot(r - refs[i][0], g - refs[i][1], b - refs[i][2]) < 34) return false
      }
      return true
    }
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4
        if (!isPerson(d[i], d[i + 1], d[i + 2], d[i + 3])) continue
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
    if (maxX <= minX || maxY <= minY) return { x: 0, y: 0, w, h }
    return {
      x: Math.max(0, minX - 2),
      y: Math.max(0, minY - 2),
      w: Math.min(w - Math.max(0, minX - 2), maxX - minX + 5),
      h: Math.min(h - Math.max(0, minY - 2), maxY - minY + 5),
    }
  }

  function keepPersonColumn(x, y, w, h, face) {
    if (!face || !(face.w > 0.03) || !(face.h > 0.03)) return false
    const nx = x / w
    const ny = y / h
    const cx = face.x + face.w / 2
    const chin = face.y + face.h
    const headTop = Math.max(0, face.y - face.h * 0.55)
    if (ny < headTop) return false
    if (ny <= chin + face.h * 0.22) return Math.abs(nx - cx) <= face.w * 1.2
    const t = Math.min(1, (ny - chin) / Math.max(0.12, 0.96 - chin))
    const half = face.w * (1.5 - t * 0.75)
    return Math.abs(nx - cx) <= half
  }

  function punchStudioFill(canvas, face) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const w = canvas.width
    const h = canvas.height
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const at = (x, y) => {
      const i = (y * w + x) * 4
      return [d[i], d[i + 1], d[i + 2], d[i + 3]]
    }
    const luma = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114
    const satOf = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b)
    const edgeStudio = (r, g, b, a) => {
      if (a < 12) return true
      const s = satOf(r, g, b)
      if (s > 22) return false
      const y = luma(r, g, b)
      return y > 48
    }
    const seen = new Uint8Array(w * h)
    const q = []
    const push = (x, y, kind) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return
      const si = y * w + x
      if (seen[si]) return
      const [r, g, b, a] = at(x, y)
      if (a < 12) {
        seen[si] = 1
        q.push(x, y, kind)
        return
      }
      if (satOf(r, g, b) > 22) return
      const yv = luma(r, g, b)
      if (kind === 0) {
        if (yv < 48 || yv > 200) return
        if (keepPersonColumn(x, y, w, h, face) && yv > 160) return
      } else if (yv < 195) return
      seen[si] = 1
      q.push(x, y, kind)
    }
    const seed = (x, y) => {
      const [r, g, b, a] = at(x, y)
      if (!edgeStudio(r, g, b, a)) return
      const yv = luma(r, g, b)
      const kind = yv > 200 ? 1 : 0
      if (kind === 0 && yv > 200) return
      const si = y * w + x
      if (seen[si]) return
      seen[si] = 1
      q.push(x, y, kind)
    }
    for (let x = 0; x < w; x += 1) {
      seed(x, 0)
      seed(x, h - 1)
    }
    for (let y = 0; y < h; y += 1) {
      seed(0, y)
      seed(w - 1, y)
    }
    let qi = 0
    while (qi < q.length) {
      const x = q[qi]
      const y = q[qi + 1]
      const kind = q[qi + 2]
      qi += 3
      d[(y * w + x) * 4 + 3] = 0
      push(x - 1, y, kind)
      push(x + 1, y, kind)
      push(x, y - 1, kind)
      push(x, y + 1, kind)
    }
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4
        if (d[i + 3] < 12) continue
        if (keepPersonColumn(x, y, w, h, face)) continue
        const s = satOf(d[i], d[i + 1], d[i + 2])
        const yv = luma(d[i], d[i + 1], d[i + 2])
        if (yv > 230 && s < 16) d[i + 3] = 0
      }
    }
    const grayFringe = (r, g, b, a) => {
      if (a < 12) return false
      const s = satOf(r, g, b)
      const y = luma(r, g, b)
      return y > 236 && s < 10
    }
    for (let pass = 0; pass < 3; pass += 1) {
      const next = []
      for (let y = 1; y < h - 1; y += 1) {
        for (let x = 1; x < w - 1; x += 1) {
          const i = (y * w + x) * 4
          if (d[i + 3] < 12) continue
          if (keepPersonColumn(x, y, w, h, face)) continue
          if (!grayFringe(d[i], d[i + 1], d[i + 2], d[i + 3])) continue
          let hole = false
          for (let dy = -1; dy <= 1 && !hole; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              if (!dx && !dy) continue
              if (d[((y + dy) * w + (x + dx)) * 4 + 3] < 12) {
                hole = true
                break
              }
            }
          }
          if (hole) next.push(i)
        }
      }
      for (let k = 0; k < next.length; k += 1) d[next[k] + 3] = 0
    }
    ctx.putImageData(img, 0, 0)
  }

  async function punchIdCardAroundFace(canvas, src, faceOverride) {
    let face = faceOverride || null
    if (!face) {
      try {
        if (typeof global.estimateFaceBoxFromImage === 'function') {
          face = await global.estimateFaceBoxFromImage(src)
        }
      } catch (_) {
        /* 얼굴 칸 없이 상단 박스만 */
      }
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const w = canvas.width
    const h = canvas.height
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const fx = face && face.w > 0.04 ? face.x : 0.28
    const fy = face && face.h > 0.03 ? face.y : 0.03
    const fw = face && face.w > 0.04 ? face.w : 0.4
    const fh = face && face.h > 0.03 ? face.h : 0.14
    const keepFace = (x, y) => {
      const nx = x / w
      const ny = y / h
      const cx = fx + fw / 2
      const cy = fy + fh * 0.52
      const rx = Math.max(fw * 0.82, 0.07)
      const ry = Math.max(fh * 1.05, 0.07)
      const dx = (nx - cx) / rx
      const dy = (ny - cy) / ry
      return dx * dx + dy * dy <= 1
    }
    const keepBody = (x, y) => {
      if (keepFace(x, y)) return true
      const nx = x / w
      const ny = y / h
      const cx = fx + fw / 2
      const chin = fy + fh
      if (ny < fy - fh * 0.35) return false
      if (ny <= chin + fh * 0.18) return Math.abs(nx - cx) <= fw * 0.72
      const t = Math.min(1, (ny - chin) / Math.max(0.08, fh * 2.2))
      const half = fw * (0.9 + t * 0.9)
      return Math.abs(nx - cx) <= half
    }
    const y0 = 0
    const y1 = Math.min(h, Math.round((fy + fh * 2.6) * h))
    const x0 = 0
    const x1 = w
    const at = (x, y) => {
      const i = (y * w + x) * 4
      return [d[i], d[i + 1], d[i + 2]]
    }
    const refs = []
    const add = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return
      if (keepFace(x, y)) return
      const p = at(x, y)
      const yv = p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114
      if (yv < 150) return
      refs.push(p)
    }
    add(x0 + 2, y0 + 2)
    add(x1 - 3, y0 + 2)
    add(x0 + 2, Math.round((y0 + y1) * 0.45))
    add(x1 - 3, Math.round((y0 + y1) * 0.45))
    add(x0 + 2, y1 - 3)
    add(x1 - 3, y1 - 3)
    const wall = (r, g, b) => {
      const yv = r * 0.299 + g * 0.587 + b * 0.114
      if (yv < 78) return false
      const sat = Math.max(r, g, b) - Math.min(r, g, b)
      if (sat > 36) return false
      if (yv > 232 && yv < 246 && sat < 18) return false
      for (let i = 0; i < refs.length; i += 1) {
        if (Math.hypot(r - refs[i][0], g - refs[i][1], b - refs[i][2]) < 48) return true
      }
      return sat < 18 && yv > 78 && yv < 232
    }
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        if (keepBody(x, y)) continue
        const i = (y * w + x) * 4
        if (d[i + 3] < 12) continue
        if (wall(d[i], d[i + 1], d[i + 2])) d[i + 3] = 0
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  async function loadPlain(src) {
    const img = await load(src)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d').drawImage(img, 0, 0)
    let face = null
    try {
      if (typeof global.estimateFaceBoxFromImage === 'function') {
        face = await global.estimateFaceBoxFromImage(src)
      }
    } catch (_) {
      /* 얼굴 없이 흰 배경만 지운다 */
    }
    punchStudioFill(canvas, face)
    await punchIdCardAroundFace(canvas, src, face)
    return canvas
  }

  async function punchStudioCard(src) {
    const img = await load(src)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d').drawImage(img, 0, 0)
    let faces = []
    try {
      if (typeof global.deskStillFaceBoxes === 'function') {
        faces = (await global.deskStillFaceBoxes(src, { couple: true })) || []
      }
    } catch (_) {
      faces = []
    }
    if (!faces.length) {
      let face = null
      try {
        if (typeof global.estimateFaceBoxFromImage === 'function') {
          face = await global.estimateFaceBoxFromImage(src)
        }
      } catch (_) {
        face = null
      }
      punchStudioFill(canvas, face)
      await punchIdCardAroundFace(canvas, src, face)
    } else {
      punchStudioFill(canvas, faces[0])
      for (let i = 0; i < faces.length; i += 1) {
        await punchIdCardAroundFace(canvas, src, faces[i])
      }
    }
    const filled = document.createElement('canvas')
    filled.width = canvas.width
    filled.height = canvas.height
    const fctx = filled.getContext('2d')
    paintStudio(fctx, filled.width, filled.height)
    fctx.drawImage(canvas, 0, 0)
    return filled.toDataURL('image/jpeg', JPEG)
  }

  /**
   * people: [{ src, heightFactor }]
   * kind: story | landscape | square
   */
  async function composePlate(people, kind, opts) {
    const list = (people || []).filter((p) => p && p.src)
    if (!list.length) return ''
    const cuts = await Promise.all(
      list.map(async (p, i) => {
        return opts?.pasteAsIs ? await loadPlain(p.src) : await isolate(p.src)
      }),
    )
    const [cw, ch] = composeSize(kind)
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    paintStudio(ctx, cw, ch)
    const ground = Math.round(ch * 0.96)
    const maxW = list.length === 1 ? cw * 0.58 : cw * 0.4
    const xs = list.length === 1 ? [0.5] : list.length === 2 ? [0.46, 0.54] : [0.22, 0.5, 0.78]
    const cropPerson = (cut, box) => {
      const pad = 6
      const sx = Math.max(0, Math.round(box.x - pad))
      const sy = Math.max(0, Math.round(box.y - pad))
      const sw = Math.min(cut.width - sx, Math.round(box.w + pad * 2))
      const sh = Math.min(cut.height - sy, Math.round(box.h + pad * 2))
      const piece = document.createElement('canvas')
      piece.width = Math.max(1, sw)
      piece.height = Math.max(1, sh)
      piece.getContext('2d').drawImage(cut, sx, sy, piece.width, piece.height, 0, 0, piece.width, piece.height)
      const pctx = piece.getContext('2d', { willReadFrequently: true })
      const img = pctx.getImageData(0, 0, piece.width, piece.height)
      const pd = img.data
      const pw = piece.width
      const ph = piece.height
      for (let y = 0; y < ph; y += 1) {
        for (let x = 0; x < pw; x += 1) {
          const i = (y * pw + x) * 4
          if (pd[i + 3] < 28) continue
          const sat = Math.max(pd[i], pd[i + 1], pd[i + 2]) - Math.min(pd[i], pd[i + 1], pd[i + 2])
          const yv = pd[i] * 0.299 + pd[i + 1] * 0.587 + pd[i + 2] * 0.114
          if (yv > 78 && yv < 175 && sat < 16) pd[i + 3] = 0
          const edge = x < 5 || y < 5 || x > pw - 6 || y > ph - 6
          if (edge && yv > 200 && sat < 16) pd[i + 3] = 0
        }
      }
      pctx.putImageData(img, 0, 0)
      return piece
    }
    const layouts = cuts.map((cut, i) => {
      const rawBox = personBox(cut)
      const piece = cropPerson(cut, rawBox)
      const box = { x: 0, y: 0, w: piece.width, h: piece.height }
      const factor = list[i].heightFactor || 1
      const plate = list.length === 2 ? 0.86 : 0.9
      const targetH = ch * plate * factor
      const scale = Math.min(targetH / Math.max(box.h, 1), maxW / Math.max(box.w, 1))
      const cx = cw * (xs[i] || 0.5)
      const x = Math.round(cx - (box.w / 2) * scale)
      const y = ground - Math.round(box.h * scale)
      return {
        cut: piece,
        box,
        scale,
        x,
        y,
        cx,
        dw: Math.round(piece.width * scale),
        dh: Math.round(piece.height * scale),
        slot: list[i].slot || '',
        faceH: Number(list[i].faceH) || 0,
      }
    })
    if (layouts.length === 2) {
      const h0 = layouts[0].box.h * layouts[0].scale
      const h1 = layouts[1].box.h * layouts[1].scale
      const want = Math.max(h0, h1)
      layouts.forEach((p) => {
        const adj = want / Math.max(p.box.h * p.scale, 1)
        const maxScale = Math.min((ch * 0.9) / Math.max(p.box.h, 1), maxW / Math.max(p.box.w, 1))
        p.scale = Math.min(p.scale * adj, maxScale)
        p.dw = Math.round(p.cut.width * p.scale)
        p.dh = Math.round(p.cut.height * p.scale)
        p.x = Math.round(p.cx - (p.box.w / 2) * p.scale)
        p.y = ground - Math.round(p.box.h * p.scale)
      })
    }
    if (layouts.length === 2) {
      const a = layouts[0]
      const b = layouts[1]
      const gap = Math.round(cw * 0.028)
      const span = a.dw + b.dw + gap
      a.cx = Math.round((cw - span) / 2 + a.dw / 2)
      b.cx = Math.round(a.cx + a.dw / 2 + gap + b.dw / 2)
      a.x = Math.round(a.cx - a.dw / 2)
      b.x = Math.round(b.cx - b.dw / 2)
      a.y = ground - a.dh
      b.y = ground - b.dh
    }
    const placements = []
    layouts.forEach((p) => {
      ctx.drawImage(p.cut, p.x, p.y, p.dw, p.dh)
      placements.push({ x: p.x, y: p.y, w: p.dw, h: p.dh, cw, ch, slot: p.slot })
    })
    global.DeskPipeline.lastPlacements = placements
    return canvas.toDataURL('image/jpeg', JPEG)
  }

  global.DeskPipeline = {
    composePlate,
    composeSize,
    isolate,
    punchStudioCard,
    lastPlacements: [],
    MAX_EDGE: 1920,
    JPEG,
  }
})(typeof window !== 'undefined' ? window : globalThis)
