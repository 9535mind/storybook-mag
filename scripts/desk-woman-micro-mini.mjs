#!/usr/bin/env node
/** 9번. fitWomanMini와 같게: 검정 치마만 베이지로, 팬티라인까지 줄이고 조임. */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PIC = 'C:\\Users\\UserK\\Desktop\\그림모음'
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-woman-mini')
mkdirSync(OUT, { recursive: true })

const { default: sharp } = await import('sharp')
const { data, info } = await sharp(path.join(PIC, '9.PNG'))
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const w = info.width
const h = info.height

function at(buf, x, y) {
  const xx = Math.max(0, Math.min(w - 1, Math.round(x)))
  const yy = Math.max(0, Math.min(h - 1, Math.round(y)))
  const i = (yy * w + xx) * 4
  return [buf[i], buf[i + 1], buf[i + 2]]
}
function luma(r, g, b) {
  return r * 0.299 + g * 0.587 + b * 0.114
}
function sat(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

const cx = w / 2
function isBlack(buf, x, y) {
  const [r, g, b] = at(buf, x, y)
  return luma(r, g, b) < 55 && sat(r, g, b) < 32
}
function blackSpan(buf, y) {
  let left = -1
  let right = -1
  for (let x = Math.round(w * 0.22); x < Math.round(w * 0.78); x += 1) {
    if (!isBlack(buf, x, y)) continue
    if (left < 0) left = x
    right = x
  }
  return { left, right, width: left < 0 ? 0 : right - left + 1 }
}

let skirtTop = -1
let oldHem = -1
for (let y = Math.round(h * 0.44); y < Math.round(h * 0.7); y += 1) {
  if (blackSpan(data, y).width < 80) continue
  if (skirtTop < 0) skirtTop = y
  oldHem = y
}
const newHem = skirtTop + Math.max(16, Math.round((oldHem - skirtTop) * 0.3))
const [br, bg, bb] = at(data, 8, 8)
const beige = [186, 164, 132]
const painted = Buffer.from(data)
for (let y = skirtTop; y <= oldHem; y += 1) {
  for (let x = 0; x < w; x += 1) {
    if (!isBlack(data, x, y)) continue
    const i = (y * w + x) * 4
    const [r, g, b] = at(data, x, y)
    const yv = luma(r, g, b)
    const t = Math.min(1, yv / 55)
    painted[i] = Math.round(beige[0] * (0.88 + t * 0.12))
    painted[i + 1] = Math.round(beige[1] * (0.88 + t * 0.12))
    painted[i + 2] = Math.round(beige[2] * (0.88 + t * 0.12))
  }
}

const out = Buffer.from(data)
function put(x, y, rgb) {
  if (x < 0 || y < 0 || x >= w || y >= h) return
  const i = (y * w + x) * 4
  out[i] = rgb[0]
  out[i + 1] = rgb[1]
  out[i + 2] = rgb[2]
  out[i + 3] = 255
}
function sample(buf, sx, sy) {
  const x0 = Math.floor(sx)
  const y0 = Math.floor(sy)
  const fx = sx - x0
  const fy = sy - y0
  const a = at(buf, x0, y0)
  const b = at(buf, x0 + 1, y0)
  const c = at(buf, x0, y0 + 1)
  const d = at(buf, x0 + 1, y0 + 1)
  return [0, 1, 2].map((k) =>
    Math.round((a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy),
  )
}

for (let y = skirtTop; y < h; y += 1) {
  for (let x = 0; x < w; x += 1) put(x, y, [br, bg, bb])
}

const tight = 0.84
const skirtH = oldHem - skirtTop
const newSkirtH = newHem - skirtTop
for (let y = 0; y < newSkirtH; y += 1) {
  const sy = skirtTop + (y / Math.max(newSkirtH - 1, 1)) * skirtH
  const dy = skirtTop + y
  for (let x = 0; x < w; x += 1) {
    const sx = cx + (x - cx) / tight
    const rgb = sample(painted, sx, sy)
    const src = sample(data, sx, sy)
    if (luma(...src) > 70 && sat(...src) < 18) continue
    if (luma(...rgb) > 210) continue
    put(x, dy, rgb)
  }
}

const legsH = h - 2 - oldHem
const destLegs = h - 2 - newHem
for (let y = 0; y < destLegs; y += 1) {
  const sy = oldHem + (y / Math.max(destLegs - 1, 1)) * legsH
  const dy = newHem + y
  for (let x = 0; x < w; x += 1) {
    const rgb = sample(data, x, sy)
    if (Math.abs(rgb[0] - br) < 8 && Math.abs(rgb[1] - bg) < 8 && Math.abs(rgb[2] - bb) < 8) continue
    if (luma(...rgb) > 200 && sat(...rgb) < 14) continue
    put(x, dy, rgb)
  }
}

const destPic = path.join(PIC, '15-woman-mini.jpg')
await sharp(out, { raw: { width: w, height: h, channels: 4 } }).jpeg({ quality: 92 }).toFile(path.join(OUT, '9-mini.jpg'))
await sharp(out, { raw: { width: w, height: h, channels: 4 } }).jpeg({ quality: 92 }).toFile(destPic)
console.log({ skirtTop, oldHem, newHem, destPic })
