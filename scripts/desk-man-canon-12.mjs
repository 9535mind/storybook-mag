#!/usr/bin/env node
/** 12번을 10번 등신으로: 발 고정, 머리 축소, 목 아래·팔만 키움. 11번 허리 왜곡 없음. */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PIC = 'C:\\Users\\UserK\\Desktop\\그림모음'
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-man-canon')
mkdirSync(OUT, { recursive: true })

const { default: sharp } = await import('sharp')

const srcPath = path.join(PIC, '12.jfif')
const img = sharp(srcPath)
const meta = await img.metadata()
const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const w = info.width
const h = info.height

function luma(i) {
  return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
}

const cx = Math.round(w * 0.5)
let headTop = Math.round(h * 0.034)
let neck = Math.round(h * 0.22)
let feet = Math.round(h * 0.93)
for (let y = 4; y < h * 0.18; y += 1) {
  const i = (y * w + cx) * 4
  const yv = luma(i)
  const s = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2])
  if (yv < 158 && (s > 6 || yv < 140)) {
    headTop = Math.max(4, y - 4)
    break
  }
}
for (let y = headTop + Math.round(h * 0.12); y < h * 0.36; y += 1) {
  if (luma((y * w + cx) * 4) < 20) {
    neck = y
    break
  }
}
for (let y = h - 6; y > h * 0.72; y -= 1) {
  let dark = 0
  for (let x = Math.round(w * 0.3); x < Math.round(w * 0.7); x += 1) {
    if (luma((y * w + x) * 4) < 75) dark += 1
  }
  if (dark > 20) {
    feet = y
    break
  }
}

const headH = neck - headTop
const bodyH = feet - neck
const personH = feet - headTop
const frac = headH / personH
const targetFrac = 0.138
let headScale = Math.max(0.8, Math.min(0.94, targetFrac / frac))
const newHeadH = Math.round(headH * headScale)
const avail = feet - Math.round(h * 0.03)
let newBodyH = avail - newHeadH
if (newBodyH < bodyH * 1.02) newBodyH = Math.min(Math.round(bodyH * 1.16), avail - newHeadH)
const bodyScale = newBodyH / bodyH
const destNeck = feet - newBodyH
const destHeadTop = destNeck - newHeadH
const scaleX = bodyScale > 1.02 ? 1.1 : 1

console.log({
  headTop,
  neck,
  feet,
  frac: +frac.toFixed(3),
  heads: +(personH / headH).toFixed(2),
  headScale: +headScale.toFixed(3),
  bodyScale: +bodyScale.toFixed(3),
  destHeadTop,
  destNeck,
})

const out = Buffer.alloc(w * h * 4)
for (let i = 0; i < out.length; i += 4) {
  out[i] = 232
  out[i + 1] = 232
  out[i + 2] = 234
  out[i + 3] = 255
}
const sample = (sx, sy, dx, dy) => {
  const x = Math.max(0, Math.min(w - 1, Math.round(sx)))
  const y = Math.max(0, Math.min(h - 1, Math.round(sy)))
  const si = (y * w + x) * 4
  const di = (dy * w + dx) * 4
  out[di] = data[si]
  out[di + 1] = data[si + 1]
  out[di + 2] = data[si + 2]
  out[di + 3] = 255
}
for (let y = 0; y < newHeadH; y += 1) {
  const sy = headTop + (y / newHeadH) * headH
  const dy = destHeadTop + y
  if (dy < 0 || dy >= h) continue
  for (let x = 0; x < w; x += 1) sample(x, sy, x, dy)
}
for (let y = 0; y < newBodyH; y += 1) {
  const sy = neck + (y / newBodyH) * bodyH
  const dy = destNeck + y
  if (dy < 0 || dy >= h) continue
  for (let x = 0; x < w; x += 1) {
    const sx = cx + (x - cx) / scaleX
    sample(sx, sy, x, dy)
  }
}

const dest = path.join(OUT, '12-to-10.jpg')
await sharp(out, { raw: { width: w, height: h, channels: 4 } }).jpeg({ quality: 92 }).toFile(dest)
await sharp(out, { raw: { width: w, height: h, channels: 4 } }).jpeg({ quality: 92 }).toFile(path.join(PIC, '12-to-10.jpg'))
console.log('wrote', dest)
