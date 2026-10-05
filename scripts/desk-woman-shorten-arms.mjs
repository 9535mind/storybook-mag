#!/usr/bin/env node
/** 26 양팔 같은 손 끝. 스커트 x 구간은 절대 안 씀. */
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const SRC = 'C:\\Users\\UserK\\Desktop\\그림모음\\26.jpg'
const OUT = 'C:\\Users\\UserK\\Desktop\\그림모음\\28.jpg'
const { default: sharp } = await import('sharp')

const src = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const w = src.info.width
const h = src.info.height
const data = src.data
const out = Buffer.from(data)

function at(buf, x, y) {
  const i = (Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4
  return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]
}
function set(x, y, p) {
  const i = (y * w + x) * 4
  out[i] = p[0]
  out[i + 1] = p[1]
  out[i + 2] = p[2]
  out[i + 3] = p[3]
}
function luma(p) {
  return p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114
}
function sat(p) {
  return Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2])
}
function studio(p) {
  return sat(p) < 22 && luma(p) > 150
}
function isSkin(p) {
  return p[0] > 95 && p[1] > 60 && p[2] > 45 && p[0] > p[1] + 8 && p[0] > p[2]
}

const bg = at(data, 8, 8)
const elbow = Math.round(h * 0.4)
const skirtL = Math.round(w * 0.336)
const skirtR = Math.round(w * 0.612)

function handBottom(x0, x1) {
  let y1 = 0
  for (let y = Math.round(h * 0.48); y < Math.round(h * 0.64); y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (isSkin(at(data, x, y))) y1 = Math.max(y1, y)
    }
  }
  return y1
}

const bands = [
  [Math.round(w * 0.292), Math.round(w * 0.338)],
  [Math.round(w * 0.61), Math.round(w * 0.648)],
]
const handL = handBottom(bands[0][0], bands[0][1])
const handR = handBottom(bands[1][0], bands[1][1])
const target = Math.round(elbow + (Math.min(handL, handR) - elbow) * 0.9)
console.log({ handL: +(handL / h).toFixed(3), handR: +(handR / h).toFixed(3), target: +(target / h).toFixed(3) })

function inSkirt(x) {
  return x >= skirtL && x <= skirtR
}

for (const [x0, x1] of bands) {
  const hand = x0 < w / 2 ? handL : handR
  const scale = (target - elbow) / Math.max(8, hand - elbow)
  for (let x = x0; x < x1; x += 1) {
    if (inSkirt(x)) continue
    for (let y = elbow; y <= hand + 14 && y < h; y += 1) {
      if (inSkirt(x)) continue
      if (y <= target) {
        const srcY = elbow + (y - elbow) / scale
        const y0 = Math.floor(srcY)
        const t = srcY - y0
        const a = at(data, x, y0)
        const b = at(data, x, y0 + 1)
        if (studio(a) && studio(b)) continue
        set(x, y, [
          Math.round(a[0] + (b[0] - a[0]) * t),
          Math.round(a[1] + (b[1] - a[1]) * t),
          Math.round(a[2] + (b[2] - a[2]) * t),
          255,
        ])
      } else {
        const toward = x < w / 2 ? at(data, x + 6, y) : at(data, x - 6, y)
        if (luma(toward) < 80) continue
        const cur = at(data, x, y)
        if (studio(cur)) continue
        if (isSkin(cur) || luma(cur) < 70) set(x, y, bg)
      }
    }
  }
}

const jpeg = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
  .jpeg({ quality: 94 })
  .toBuffer()
writeFileSync(OUT, jpeg)
writeFileSync(path.join('tmp-faceswap-test', 'desk-id-extend-verify', '05-arms-even.jpg'), jpeg)
console.log('saved', OUT, jpeg.length)
