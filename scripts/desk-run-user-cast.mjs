#!/usr/bin/env node
/**
 * 사용자 그림모음 2·3·4·6을 여기서 직접 돌린다. 엔진 호출 없음.
 * 한 장면 회색 카드·어깨/얼굴 비를 재고, compose 결과를 저장한다.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PIC = 'C:\\Users\\UserK\\Desktop\\그림모음'
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-run-user-cast')
mkdirSync(OUT, { recursive: true })

const { default: sharp } = await import('sharp')

function luma(r, g, b) {
  return r * 0.299 + g * 0.587 + b * 0.114
}
function sat(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function isStudioPx(r, g, b, a, refs) {
  if (a < 28) return true
  const y = luma(r, g, b)
  const s = sat(r, g, b)
  if (s > 22) return false
  if (y > 246 && s < 14) return true
  if (y > 48 && y < 220 && s < 16) return true
  for (const ref of refs) {
    if (s < 24 && Math.hypot(r - ref[0], g - ref[1], b - ref[2]) < 34) return true
  }
  return false
}

function isPersonPx(r, g, b, a, refs) {
  if (a < 28) return false
  if (isStudioPx(r, g, b, a, refs)) return false
  return true
}

function cornerRefs(data, w, h) {
  const at = (x, y) => {
    const i = (y * w + x) * 4
    return [data[i], data[i + 1], data[i + 2]]
  }
  return [at(2, 2), at(w - 3, 2), at(2, h - 3), at(w - 3, h - 3)]
}

function personBox(data, w, h) {
  const refs = cornerRefs(data, w, h)
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4
      if (!isPersonPx(data[i], data[i + 1], data[i + 2], data[i + 3], refs)) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX <= minX || maxY <= minY) return { x: 0, y: 0, w, h, empty: true }
  return {
    x: Math.max(0, minX - 2),
    y: Math.max(0, minY - 2),
    w: Math.min(w - Math.max(0, minX - 2), maxX - minX + 5),
    h: Math.min(h - Math.max(0, minY - 2), maxY - minY + 5),
    empty: false,
  }
}

function punchStudio(data, w, h) {
  const at = (x, y) => {
    const i = (y * w + x) * 4
    return [data[i], data[i + 1], data[i + 2], data[i + 3]]
  }
  const edgeStudio = (r, g, b, a) => {
    if (a < 12) return true
    if (sat(r, g, b) > 22) return false
    return luma(r, g, b) > 48
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
    if (sat(r, g, b) > 22) return
    const yv = luma(r, g, b)
    if (kind === 0) {
      if (yv < 48 || yv > 200) return
      if (x > w * 0.3 && x < w * 0.7 && yv > 160) return
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
    data[(y * w + x) * 4 + 3] = 0
    push(x - 1, y, kind)
    push(x + 1, y, kind)
    push(x, y - 1, kind)
    push(x, y + 1, kind)
  }
}

function shoulderWidth(data, w, h, box) {
  const y0 = Math.round(box.y + box.h * 0.18)
  const y1 = Math.round(box.y + box.h * 0.32)
  const refs = cornerRefs(data, w, h)
  let best = 0
  let bestY = y0
  for (let y = y0; y <= y1; y += 1) {
    let x0 = w
    let x1 = 0
    for (let x = box.x; x < box.x + box.w; x += 1) {
      const i = (y * w + x) * 4
      if (!isPersonPx(data[i], data[i + 1], data[i + 2], data[i + 3], refs)) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
    }
    if (x1 > x0 + 4) {
      const ww = x1 - x0 + 1
      if (ww > best) {
        best = ww
        bestY = y
      }
    }
  }
  return { px: best, frac: best / w, y: bestY }
}

function faceGuess(data, w, h, box) {
  const refs = cornerRefs(data, w, h)
  const y0 = Math.round(box.y + box.h * 0.02)
  const y1 = Math.round(box.y + box.h * 0.22)
  const x0 = Math.round(box.x + box.w * 0.25)
  const x1 = Math.round(box.x + box.w * 0.75)
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const i = (y * w + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      if (a < 28) continue
      if (isStudioPx(r, g, b, a, refs)) continue
      const yv = luma(r, g, b)
      const s = sat(r, g, b)
      const skin = yv > 70 && yv < 230 && s > 12 && r > g && r > b - 10
      const hair = yv < 70 && s < 40
      if (!skin && !hair) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX <= minX) return { w: 0, h: 0, fracW: 0 }
  return { w: maxX - minX + 1, h: maxY - minY + 1, fracW: (maxX - minX + 1) / w }
}

async function loadRgba(file) {
  const img = sharp(file)
  const meta = await img.metadata()
  const w = meta.width
  const h = meta.height
  const data = Buffer.from(await img.ensureAlpha().raw().toBuffer())
  return { w, h, data }
}

function leftoverCard(data, w, h, box) {
  const refs = cornerRefs(data, w, h)
  let studio = 0
  let person = 0
  for (let y = box.y; y < box.y + box.h; y += 3) {
    for (let x = box.x; x < box.x + box.w; x += 3) {
      const i = (y * w + x) * 4
      if (isStudioPx(data[i], data[i + 1], data[i + 2], data[i + 3], refs)) studio += 1
      else if (data[i + 3] > 28) person += 1
    }
  }
  const n = studio + person
  return { studio, person, studioFrac: n ? studio / n : 0 }
}

async function measure(name, file) {
  const { w, h, data } = await loadRgba(file)
  const box = personBox(data, w, h)
  const sh = shoulderWidth(data, w, h, box)
  const face = faceGuess(data, w, h, box)
  const card = leftoverCard(data, w, h, { x: 0, y: 0, w, h })
  const ratio = face.w > 8 ? sh.px / face.w : 0
  return {
    name,
    w,
    h,
    box,
    boxFrac: { w: box.w / w, h: box.h / h },
    shoulderPx: sh.px,
    faceW: face.w,
    shoulderOverFace: Number(ratio.toFixed(3)),
    leftoverStudioFrac: Number(card.studioFrac.toFixed(3)),
  }
}

function blitRow(src, dest, sy, dy, scaleX, cx) {
  const w = src.w
  for (let x = 0; x < w; x += 1) {
    const sx = Math.min(w - 1, Math.max(0, Math.round(cx + (x - cx) * scaleX)))
    const si = (sy * w + sx) * 4
    const di = (dy * w + x) * 4
    dest[di] = src.data[si]
    dest[di + 1] = src.data[si + 1]
    dest[di + 2] = src.data[si + 2]
    dest[di + 3] = src.data[si + 3]
  }
}

function fitManLegs(src) {
  const box = personBox(src.data, src.w, src.h)
  const neck = Math.round(box.y + box.h * 0.15)
  const oldHip = Math.round(box.y + box.h * 0.6)
  const newHip = Math.round(box.y + box.h * 0.43)
  const feet = Math.round(box.y + box.h)
  if (newHip >= oldHip - 8) return src
  const dest = Buffer.from(src.data)
  const mapBand = (from0, from1, to0, to1) => {
    const fh = Math.max(1, from1 - from0)
    const th = Math.max(1, to1 - to0)
    for (let y = to0; y < to1; y += 1) {
      const sy = from0 + Math.min(fh - 1, Math.floor(((y - to0) / th) * fh))
      dest.set(src.data.subarray(sy * src.w * 4, (sy + 1) * src.w * 4), y * src.w * 4)
    }
  }
  mapBand(neck, oldHip, neck, newHip)
  mapBand(oldHip, feet, newHip, feet)
  src.data = dest
  return src
}

function fitWomanMini(src) {
  const box = personBox(src.data, src.w, src.h)
  const hip = Math.round(box.y + box.h * 0.46)
  const oldHem = Math.round(box.y + box.h * 0.64)
  const newHem = Math.round(box.y + box.h * 0.54)
  const feet = Math.round(box.y + box.h)
  const dest = Buffer.from(src.data)
  const skirtH = Math.max(1, oldHem - hip)
  const newSkirtH = Math.max(1, newHem - hip)
  for (let y = hip; y < newHem; y += 1) {
    const sy = hip + Math.min(skirtH - 1, Math.floor(((y - hip) / newSkirtH) * skirtH))
    dest.set(src.data.subarray(sy * src.w * 4, (sy + 1) * src.w * 4), y * src.w * 4)
  }
  const legH = Math.max(1, feet - oldHem)
  const newLegH = Math.max(1, feet - newHem)
  for (let y = newHem; y < feet; y += 1) {
    const sy = oldHem + Math.min(legH - 1, Math.floor(((y - newHem) / newLegH) * legH))
    dest.set(src.data.subarray(sy * src.w * 4, (sy + 1) * src.w * 4), y * src.w * 4)
  }
  src.data = dest
  return src
}

function compose(woman, man) {
  const cw = 1920
  const ch = 1248
  const out = Buffer.alloc(cw * ch * 4)
  for (let y = 0; y < ch; y += 1) {
    const t = y / ch
    const r = Math.round(63 + t * 10)
    const g = Math.round(68 + t * 8)
    const b = Math.round(73 + t * 6)
    for (let x = 0; x < cw; x += 1) {
      const i = (y * cw + x) * 4
      out[i] = r
      out[i + 1] = g
      out[i + 2] = b
      out[i + 3] = 255
    }
  }
  const prep = (src) => {
    const refs = cornerRefs(src.data, src.w, src.h)
    const box = personBox(src.data, src.w, src.h)
    const pad = 6
    const sx = Math.max(0, box.x - pad)
    const sy = Math.max(0, box.y - pad)
    const sw = Math.min(src.w - sx, box.w + pad * 2)
    const sh = Math.min(src.h - sy, box.h + pad * 2)
    const targetH = ch * 0.86
    const maxW = cw * 0.4
    const scale = Math.min(targetH / Math.max(sh, 1), maxW / Math.max(sw, 1))
    return { src, refs, box, sx, sy, sw, sh, scale, dw: Math.round(sw * scale), dh: Math.round(sh * scale) }
  }
  const left = prep(woman)
  const right = prep(man)
  const want = Math.max(left.dh, right.dh)
  ;[left, right].forEach((p) => {
    const adj = want / Math.max(p.dh, 1)
    p.scale *= adj
    p.dw = Math.round(p.sw * p.scale)
    p.dh = Math.round(p.sh * p.scale)
  })
  const gap = Math.round(cw * 0.028)
  const span = left.dw + right.dw + gap
  left.dx = Math.round((cw - span) / 2)
  right.dx = left.dx + left.dw + gap
  left.dy = Math.round(ch * 0.96 - left.dh)
  right.dy = Math.round(ch * 0.96 - right.dh)
  const stamp = (p) => {
    for (let y = 0; y < p.dh; y += 1) {
      const syy = p.sy + Math.min(p.sh - 1, Math.floor((y / p.dh) * p.sh))
      for (let x = 0; x < p.dw; x += 1) {
        const sxx = p.sx + Math.min(p.sw - 1, Math.floor((x / p.dw) * p.sw))
        const si = (syy * p.src.w + sxx) * 4
        if (p.src.data[si + 3] < 20) continue
        if (!isPersonPx(p.src.data[si], p.src.data[si + 1], p.src.data[si + 2], p.src.data[si + 3], p.refs)) continue
        const ox = p.dx + x
        const oy = p.dy + y
        if (ox < 0 || oy < 0 || ox >= cw || oy >= ch) continue
        const oi = (oy * cw + ox) * 4
        out[oi] = p.src.data[si]
        out[oi + 1] = p.src.data[si + 1]
        out[oi + 2] = p.src.data[si + 2]
        out[oi + 3] = 255
      }
    }
  }
  stamp(left)
  stamp(right)
  return { out, cw, ch, left, right }
}

const woman2 = await loadRgba(path.join(PIC, '2.png'))
const man3 = await loadRgba(path.join(PIC, '3.png'))
const m2 = await measure('2-woman', path.join(PIC, '2.png'))
const m3 = await measure('3-man', path.join(PIC, '3.png'))
const m4 = await measure('4-couple', path.join(PIC, '4.jfif'))
const m6 = await measure('6-woman', path.join(PIC, '6.jfif'))

const womanFit = fitWomanMini({ w: woman2.w, h: woman2.h, data: Buffer.from(woman2.data) })
const composed = compose(womanFit, man3)
await sharp(composed.out, { raw: { width: composed.cw, height: composed.ch, channels: 4 } })
  .jpeg({ quality: 92 })
  .toFile(path.join(OUT, 'compose-2-3.jpg'))
await sharp(composed.out, { raw: { width: composed.cw, height: composed.ch, channels: 4 } })
  .jpeg({ quality: 92 })
  .toFile(path.join(PIC, '8-compose.jpg'))

const mComp = await measure('compose-2-3', path.join(OUT, 'compose-2-3.jpg'))

const report = {
  measures: [m2, m3, m4, m6, mComp],
  composeLayout: {
    left: { dw: composed.left.dw, dh: composed.left.dh, dx: composed.left.dx, dy: composed.left.dy },
    right: { dw: composed.right.dw, dh: composed.right.dh, dx: composed.right.dx, dy: composed.right.dy },
  },
  fail4: m4.leftoverStudioFrac > 0.35,
  composeClean: mComp.leftoverStudioFrac < 0.22 && mComp.boxFrac.w < 0.92,
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
