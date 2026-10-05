#!/usr/bin/env node
/** 12 CAST. 13처럼 허리 들어가고 재킷이 골반을 덮은 뒤 다리. 14 배 실패(짧은 재킷+배) 금지. */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PIC = 'C:\\Users\\UserK\\Desktop\\그림모음'
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-man-pelvis')
mkdirSync(OUT, { recursive: true })

const { default: sharp } = await import('sharp')

async function loadFile(p, name) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { name, data, w: info.width, h: info.height }
}

function px(img, x, y) {
  const i = (y * img.w + x) * 4
  return [img.data[i], img.data[i + 1], img.data[i + 2]]
}

function lumaAt(img, x, y) {
  const [r, g, b] = px(img, x, y)
  return r * 0.299 + g * 0.587 + b * 0.114
}

function isNavy(img, x, y) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return false
  const [r, g, b] = px(img, x, y)
  const yv = r * 0.299 + g * 0.587 + b * 0.114
  return yv < 92 && b >= r - 8 && b >= g - 4
}

function navySpan(img, y) {
  let left = -1
  let right = -1
  const x0 = Math.round(img.w * 0.12)
  const x1 = Math.round(img.w * 0.88)
  for (let x = x0; x < x1; x += 1) {
    if (isNavy(img, x, y)) {
      if (left < 0) left = x
      right = x
    }
  }
  if (left < 0) return { left: 0, right: 0, w: 0 }
  return { left, right, w: right - left + 1 }
}

function navyCore(img, y) {
  const cx = Math.round(img.w * 0.5)
  let left = cx
  let right = cx
  while (left > img.w * 0.18 && isNavy(img, left, y)) left -= 1
  while (right < img.w * 0.82 && isNavy(img, right, y)) right += 1
  return { left, right, w: Math.max(0, right - left) }
}

function measureNavy(img) {
  const cx = Math.round(img.w * 0.5)
  let headTop = Math.round(img.h * 0.03)
  for (let y = 3; y < img.h * 0.18; y += 1) {
    if (lumaAt(img, cx, y) < 160) {
      headTop = Math.max(2, y - 2)
      break
    }
  }
  let feet = Math.round(img.h * 0.96)
  for (let y = img.h - 3; y > img.h * 0.72; y -= 1) {
    let dark = 0
    for (let x = Math.round(img.w * 0.32); x < Math.round(img.w * 0.68); x += 1) {
      if (lumaAt(img, x, y) < 78) dark += 1
    }
    if (dark > 10) {
      feet = Math.min(img.h - 2, y + 2)
      break
    }
  }
  let chin = headTop + Math.round(img.h * 0.15)
  for (let y = headTop + Math.round(img.h * 0.1); y < img.h * 0.32; y += 1) {
    if (lumaAt(img, cx, y) < 40) {
      chin = y - 4
      break
    }
  }
  const neck = Math.min(feet - 40, chin + Math.round((chin - headTop) * 0.14))
  const bodyH = feet - neck
  const personH = feet - headTop
  const rows = []
  for (let y = neck; y < feet; y += 4) {
    const span = navySpan(img, y)
    const core = navyCore(img, y)
    rows.push({ y, yn: +(y / img.h).toFixed(3), span: span.w, core: core.w })
  }
  const chestY = neck + Math.round(bodyH * 0.18)
  const waistY = neck + Math.round(bodyH * 0.3)
  let hemY = neck + Math.round(bodyH * 0.46)
  let bestDrop = 0
  const chestW = navyCore(img, chestY).w
  for (let y = neck + Math.round(bodyH * 0.34); y < neck + Math.round(bodyH * 0.58); y += 1) {
    const wNow = navyCore(img, y).w
    const wNext = navyCore(img, Math.min(feet - 1, y + 10)).w
    const drop = wNow - wNext
    if (drop > bestDrop && wNow > chestW * 0.35) {
      bestDrop = drop
      hemY = y
    }
  }
  let crotchY = hemY + Math.round(bodyH * 0.04)
  for (let y = hemY; y < hemY + Math.round(bodyH * 0.18); y += 1) {
    const mid = lumaAt(img, cx, y)
    const gapL = !isNavy(img, cx - 18, y) && lumaAt(img, cx - 18, y) > 150
    const gapR = !isNavy(img, cx + 18, y) && lumaAt(img, cx + 18, y) > 150
    if (mid < 55 && (gapL || gapR)) {
      crotchY = y
      break
    }
  }
  return {
    name: img.name,
    headTop: +(headTop / img.h).toFixed(3),
    chin: +(chin / img.h).toFixed(3),
    neck: +(neck / img.h).toFixed(3),
    chest: +(chestY / img.h).toFixed(3),
    waist: +(waistY / img.h).toFixed(3),
    hem: +(hemY / img.h).toFixed(3),
    crotch: +(crotchY / img.h).toFixed(3),
    feet: +(feet / img.h).toFixed(3),
    headFrac: +((neck - headTop) / personH).toFixed(3),
    waistToHem: +((hemY - waistY) / personH).toFixed(3),
    hemToFeet: +((feet - hemY) / personH).toFixed(3),
    chestW: +(navyCore(img, chestY).w / img.w).toFixed(3),
    waistW: +(navyCore(img, waistY).w / img.w).toFixed(3),
    hemW: +(navyCore(img, hemY).w / img.w).toFixed(3),
    px: { headTop, chin, neck, chestY, waistY, hemY, crotchY, feet, personH, bodyH },
    rows: rows.filter((_, i) => i % 6 === 0),
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function sample(img, sx, sy) {
  const x = Math.max(0, Math.min(img.w - 1, sx))
  const y = Math.max(0, Math.min(img.h - 1, sy))
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(img.w - 1, x0 + 1)
  const y1 = Math.min(img.h - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0
  const pick = (xx, yy) => px(img, xx, yy)
  const a = pick(x0, y0)
  const b = pick(x1, y0)
  const c = pick(x0, y1)
  const d = pick(x1, y1)
  const out = [0, 0, 0]
  for (let k = 0; k < 3; k += 1) {
    const top = a[k] * (1 - fx) + b[k] * fx
    const bot = c[k] * (1 - fx) + d[k] * fx
    out[k] = Math.round(top * (1 - fy) + bot * fy)
  }
  return out
}

const names = ['12.jfif', '13.jfif', '10.PNG', '11.jfif', '3.png']
const reports = []
const imgs = {}
for (const n of names) {
  imgs[n] = await loadFile(path.join(PIC, n), n)
  reports.push(measureNavy(imgs[n]))
}
writeFileSync(path.join(OUT, 'measure.json'), JSON.stringify(reports, null, 2))
console.log(JSON.stringify(reports.map(({ rows, px, ...r }) => r), null, 2))

const src = imgs['12.jfif']
const m = reports.find((r) => r.name === '12.jfif').px
const waist = m.waistY
const hem = m.hemY
const crotch = Math.max(hem + 8, m.crotchY)
const feet = m.feet
const personH = m.personH
const oldHip = crotch - waist
const targetHip = Math.round(personH * 0.12)
const newCrotch = oldHip >= targetHip ? crotch : waist + targetHip
const legsH = feet - crotch
const maxFeet = Math.round(src.h * 0.978)
let newFeet = newCrotch + legsH
if (newFeet > maxFeet) newFeet = maxFeet
const destLegs = Math.max(8, newFeet - newCrotch)
const destHip = newCrotch - waist
const cx = src.w / 2

const out = Buffer.alloc(src.w * src.h * 4)
for (let i = 0; i < out.length; i += 4) {
  out[i] = 236
  out[i + 1] = 236
  out[i + 2] = 238
  out[i + 3] = 255
}

function put(dx, dy, rgb) {
  if (dx < 0 || dy < 0 || dx >= src.w || dy >= src.h) return
  const i = (dy * src.w + dx) * 4
  out[i] = rgb[0]
  out[i + 1] = rgb[1]
  out[i + 2] = rgb[2]
  out[i + 3] = 255
}

for (let y = 0; y < waist; y += 1) {
  for (let x = 0; x < src.w; x += 1) put(x, y, sample(src, x, y))
}

for (let y = 0; y < destHip; y += 1) {
  const t = y / Math.max(destHip - 1, 1)
  const sy = waist + t * oldHip
  const dy = waist + y
  for (let x = 0; x < src.w; x += 1) put(x, dy, sample(src, x, sy))
}

for (let y = 0; y < destLegs; y += 1) {
  const t = y / Math.max(destLegs - 1, 1)
  const sy = crotch + t * legsH
  const dy = newCrotch + y
  for (let x = 0; x < src.w; x += 1) put(x, dy, sample(src, x, sy))
}

function isSkin(img, x, y) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return false
  const [r, g, b] = px(img, x, y)
  const yv = r * 0.299 + g * 0.587 + b * 0.114
  const s = Math.max(r, g, b) - Math.min(r, g, b)
  if (isNavy(img, x, y)) return false
  return yv > 72 && yv < 205 && r > 85 && r >= g - 8 && r > b + 8 && s > 14
}

function findPalms(img) {
  const y0 = Math.round(img.h * 0.42)
  const y1 = Math.round(img.h * 0.64)
  const hits = []
  for (let y = y0; y < y1; y += 1) {
    let ln = 0
    let rn = 0
    let lMax = -1
    let rMin = img.w
    for (let x = Math.round(img.w * 0.08); x < Math.round(img.w * 0.36); x += 1) {
      if (isSkin(img, x, y)) {
        ln += 1
        if (x > lMax) lMax = x
      }
    }
    for (let x = Math.round(img.w * 0.64); x < Math.round(img.w * 0.92); x += 1) {
      if (isSkin(img, x, y)) {
        rn += 1
        if (x < rMin) rMin = x
      }
    }
    if (ln >= 3 && rn >= 3) hits.push({ y, lMax, rMin, n: ln + rn })
  }
  if (!hits.length) {
    return { y: Math.round(img.h * 0.52), leftIn: Math.round(img.w * 0.28), rightIn: Math.round(img.w * 0.72), n: 0 }
  }
  const yMax = hits[hits.length - 1].y
  const band = hits.filter((h) => h.y >= yMax - 16)
  const mid = band[Math.floor(band.length / 2)]
  return { y: mid.y, leftIn: mid.lMax, rightIn: mid.rMin, n: mid.n }
}

function mapBodyY(sy) {
  if (sy <= waist) return sy
  if (sy < crotch) return waist + ((sy - waist) / Math.max(oldHip, 1)) * destHip
  return newCrotch + ((sy - crotch) / Math.max(legsH, 1)) * destLegs
}

const srcPalms = findPalms(src)
const palms = {
  y: Math.round(mapBodyY(srcPalms.y)),
  leftIn: srcPalms.leftIn,
  rightIn: srcPalms.rightIn,
  n: srcPalms.n,
  srcY: srcPalms.y,
}
const midImg = { name: 'mid', data: out, w: src.w, h: src.h }
const seatY = palms.y + Math.round(src.h * 0.032)
const core = navyCore(midImg, Math.min(midImg.h - 2, seatY))
const gapL = Math.max(12, palms.leftIn - 20)
const gapR = Math.min(src.w - 12, palms.rightIn + 20)
const targetHalf = Math.max(core.w * 0.62, Math.min(cx - gapL, gapR - cx))
const peak = core.w > 12 ? Math.min(1.26, Math.max(1.18, (targetHalf * 2) / core.w)) : 1.2
const sigma = src.h * 0.052
const y0 = Math.max(waist, palms.y - Math.round(src.h * 0.01))
const y1 = Math.min(newFeet - 8, seatY + Math.round(sigma * 2.4))
const seated = Buffer.from(out)
function put2(dx, dy, rgb) {
  if (dx < 0 || dy < 0 || dx >= src.w || dy >= src.h) return
  const i = (dy * src.w + dx) * 4
  seated[i] = rgb[0]
  seated[i + 1] = rgb[1]
  seated[i + 2] = rgb[2]
  seated[i + 3] = 255
}
for (let y = y0; y < y1; y += 1) {
  const dist = (y - seatY) / sigma
  const bump = Math.exp(-dist * dist)
  const scaleX = 1 + (peak - 1) * bump
  if (scaleX < 1.015) continue
  for (let x = gapL; x < gapR; x += 1) {
    const sx = cx + (x - cx) / scaleX
    put2(x, y, sample(midImg, sx, y))
  }
}

const destPic = path.join(PIC, '14-man-pelvis.jpg')
const destTmp = path.join(OUT, '12-pelvis.jpg')
await sharp(seated, { raw: { width: src.w, height: src.h, channels: 4 } }).jpeg({ quality: 92 }).toFile(destTmp)
await sharp(seated, { raw: { width: src.w, height: src.h, channels: 4 } }).jpeg({ quality: 92 }).toFile(destPic)

const a = await sharp(path.join(PIC, '3.png')).resize(440, 592, { fit: 'fill' }).jpeg().toBuffer()
const b = await sharp(destPic).resize(440, 592, { fit: 'fill' }).jpeg().toBuffer()
const c = await sharp(path.join(PIC, '13.jfif')).resize(440, 592, { fit: 'fill' }).jpeg().toBuffer()
const strip = await sharp({
  create: { width: 1320, height: 592, channels: 3, background: { r: 230, g: 230, b: 232 } },
})
  .composite([
    { input: a, left: 0, top: 0 },
    { input: b, left: 440, top: 0 },
    { input: c, left: 880, top: 0 },
  ])
  .jpeg({ quality: 90 })
  .toFile(path.join(OUT, 'compare-12-14-13.jpg'))

const drawn = await loadFile(destPic, '14-man-pelvis.jpg')
const after = measureNavy(drawn)
console.log('draw', {
  waist,
  hem,
  crotch,
  palms,
  seatY,
  peak: +peak.toFixed(3),
  oldHip,
  targetHip,
  newCrotch,
  newFeet,
  after: {
    waist: after.waist,
    hem: after.hem,
    crotch: after.crotch,
    waistToHem: after.waistToHem,
    waistW: after.waistW,
    hemW: after.hemW,
  },
})
console.log('wrote', destPic)
