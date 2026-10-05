#!/usr/bin/env node
/** 38. 19 몸통만 손 높이까지. 팔은 그대로. */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PIC = 'C:\\Users\\UserK\\Desktop\\그림모음'
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-man-19-hip')
mkdirSync(OUT, { recursive: true })

const { default: sharp } = await import('sharp')
const src = await sharp(path.join(PIC, '19.jfif')).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const w = src.info.width
const h = src.info.height
const data = src.data

function px(x, y) {
  const i = (Math.max(0, Math.min(h - 1, Math.round(y))) * w + Math.max(0, Math.min(w - 1, Math.round(x)))) * 4
  return [data[i], data[i + 1], data[i + 2]]
}
function luma(x, y) {
  const [r, g, b] = px(x, y)
  return r * 0.299 + g * 0.587 + b * 0.114
}

const cx = Math.round(w / 2)
let headTop = 2
for (let y = 2; y < h * 0.2; y += 1) {
  if (luma(cx, y) < 175) {
    headTop = y
    break
  }
}
let chin = headTop + Math.round(h * 0.13)
for (let y = headTop + Math.round(h * 0.09); y < headTop + Math.round(h * 0.2); y += 1) {
  if (luma(cx, y) < 55) {
    chin = y - 3
    break
  }
}
const faceH = chin - headTop
const neck = chin + Math.round(faceH * 0.1)
const chest = neck + Math.round(faceH * 0.45)

let lastButton = 0
for (let y = neck + Math.round(faceH * 0.4); y < neck + Math.round(faceH * 3.2); y += 1) {
  for (let x = cx - 18; x < cx + 18; x += 1) {
    const L = luma(x, y)
    if (L > 88 && luma(x - 3, y) < 52 && luma(x + 3, y) < 52) {
      lastButton = y
      y += 6
      break
    }
  }
}

let peak = 0
let cliff = 0
for (let y = Math.round(h * 0.35); y < Math.round(h * 0.72); y += 1) {
  let left = -1
  let right = -1
  for (let x = Math.round(w * 0.12); x < Math.round(w * 0.88); x += 1) {
    if (luma(x, y) < 80) {
      if (left < 0) left = x
      right = x
    }
  }
  const ww = left < 0 ? 0 : right - left
  if (ww > peak) peak = ww
  if (!cliff && peak > 200 && ww < peak * 0.78) cliff = y
}

const oldHem = lastButton > chest ? lastButton + Math.round(faceH * 1.05) : chest + Math.round(faceH * 1.6)
const targetHem = Math.max(oldHem + Math.round(faceH * 0.55), cliff - Math.round(h * 0.012))
const srcMid = Math.max(8, oldHem - chest)
const destMid = Math.max(10, targetHem - chest)
const x0 = Math.round(w * 0.34)
const x1 = Math.round(w * 0.66)
const fade = Math.round(w * 0.035)

const out = Buffer.from(data)
function sample(sx, sy) {
  const x = Math.max(0, Math.min(w - 1, sx))
  const y = Math.max(0, Math.min(h - 1, sy))
  const x0s = Math.floor(x)
  const y0s = Math.floor(y)
  const fx = x - x0s
  const fy = y - y0s
  const pick = (xx, yy) => px(xx, yy)
  const a = pick(x0s, y0s)
  const b = pick(x0s + 1, y0s)
  const c = pick(x0s, y0s + 1)
  const d = pick(x0s + 1, y0s + 1)
  return [0, 1, 2].map((k) =>
    Math.round((a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy),
  )
}
function mix(x, y, rgb, a) {
  const i = (y * w + x) * 4
  out[i] = Math.round(out[i] * (1 - a) + rgb[0] * a)
  out[i + 1] = Math.round(out[i + 1] * (1 - a) + rgb[1] * a)
  out[i + 2] = Math.round(out[i + 2] * (1 - a) + rgb[2] * a)
}

for (let y = 0; y < destMid; y += 1) {
  const sy = chest + (y / Math.max(destMid - 1, 1)) * srcMid
  const dy = chest + y
  for (let x = x0; x < x1; x += 1) {
    let a = 1
    if (x < x0 + fade) a = (x - x0) / fade
    if (x > x1 - fade) a = Math.min(a, (x1 - x) / fade)
    mix(x, dy, sample(x, sy), a)
  }
}

const destPic = path.join(PIC, '20-man-hip.jpg')
const tmpPic = path.join(OUT, '19-hip.jpg')
await sharp(out, { raw: { width: w, height: h, channels: 4 } }).jpeg({ quality: 92 }).toFile(tmpPic)
await sharp(out, { raw: { width: w, height: h, channels: 4 } }).jpeg({ quality: 92 }).toFile(destPic)
console.log({
  headTop,
  lastButton,
  oldHem,
  cliff,
  targetHem,
  add: targetHem - oldHem,
  destPic,
})
