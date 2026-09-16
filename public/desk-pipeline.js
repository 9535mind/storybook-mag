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
    wall.addColorStop(0, '#f4f4f4')
    wall.addColorStop(0.72, '#ececec')
    wall.addColorStop(1, '#d8d8d8')
    ctx.fillStyle = wall
    ctx.fillRect(0, 0, cw, ch)
  }

  async function isolate(src) {
    if (typeof global.isolateOutpaintedPerson === 'function') {
      try {
        const cut = await global.isolateOutpaintedPerson(src)
        if (cut && cut.width > 24 && cut.height > 24) return cut
      } catch (err) {
        console.warn('desk pipeline isolate failed', err)
      }
    }
    const img = await load(src)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d').drawImage(img, 0, 0)
    return canvas
  }

  function fitBody(cut, cw, ch, heightFactor, maxW) {
    const { w, h } = sourceSize(cut)
    const targetH = ch * 0.86 * (heightFactor || 1)
    return Math.min(targetH / Math.max(h, 1), maxW / Math.max(w, 1), (ch * 0.9) / Math.max(h, 1))
  }

  /**
   * people: [{ src, heightFactor }]
   * kind: story | landscape | square
   */
  async function composePlate(people, kind) {
    const list = (people || []).filter((p) => p && p.src)
    if (!list.length) return ''
    const cuts = await Promise.all(list.map((p) => isolate(p.src)))
    const [cw, ch] = composeSize(kind)
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    paintStudio(ctx, cw, ch)
    const ground = Math.round(ch * 0.94)
    const maxW = list.length === 1 ? cw * 0.52 : cw * 0.4
    const xs = list.length === 1 ? [0.5] : list.length === 2 ? [0.34, 0.66] : [0.22, 0.5, 0.78]
    cuts.forEach((cut, i) => {
      const scale = fitBody(cut, cw, ch, list[i].heightFactor || 1, maxW)
      const { w, h } = sourceSize(cut)
      const dw = Math.round(w * scale)
      const dh = Math.round(h * scale)
      const cx = cw * (xs[i] || 0.5)
      const x = Math.round(cx - dw / 2)
      const y = ground - dh
      if (typeof global.drawFootContactShadow === 'function') {
        global.drawFootContactShadow(ctx, cx, ground, dw * 0.28, Math.max(10, dw * 0.045))
      }
      ctx.drawImage(cut, x, y, dw, dh)
    })
    return canvas.toDataURL('image/jpeg', JPEG)
  }

  global.DeskPipeline = {
    composePlate,
    composeSize,
    isolate,
    MAX_EDGE: 1920,
    JPEG,
  }
})(typeof window !== 'undefined' ? window : globalThis)
