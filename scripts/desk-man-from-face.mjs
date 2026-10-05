#!/usr/bin/env node
/** 12 CAST. 얼굴 유지, 가슴~가랑이 늘려 팔·재킷이 골반까지. 14번 옆구리 살 없음. */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PIC = 'C:\\Users\\UserK\\Desktop\\그림모음'
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-man-from-face')
mkdirSync(OUT, { recursive: true })

const { default: sharp } = await import('sharp')
const src = await sharp(path.join(PIC, '12.jfif')).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
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

const cx = w / 2
let headTop = Math.round(h * 0.03)
let feet = Math.round(h * 0.97)
for (let y = 3; y < h * 0.18; y += 1) {
  if (luma(cx, y) < 160) {
    headTop = Math.max(2, y - 2)
    break
  }
}
for (let y = h - 3; y > h * 0.72; y -= 1) {
  let dark = 0
  for (let x = Math.round(w * 0.32); x < Math.round(w * 0.68); x += 1) {
    if (luma(x, y) < 78) dark += 1
  }
  if (dark > 10) {
    feet = Math.min(h - 2, y + 2)
    break
  }
}
let chin = headTop + Math.round(h * 0.16)
for (let y = headTop + Math.round(h * 0.1); y < h * 0.32; y += 1) {
  if (luma(cx, y) < 40) {
    chin = y - 4
    break
  }
}
const faceH = chin - headTop
const neck = Math.min(feet - 40, chin + Math.round(faceH * 0.12))
const bodyH = feet - neck
const personH = feet - headTop
const chest = neck + Math.round(bodyH * 0.08)
const oldCrotch = neck + Math.round(bodyH * 0.48)
const torso = oldCrotch - neck
const targetTorso = Math.min(Math.round(personH * 0.42), Math.round(faceH * 2.85))
const add = Math.min(Math.max(0, targetTorso - torso), Math.round(personH * 0.11))
const legsH = feet - oldCrotch
let newCrotch = oldCrotch + add
let newFeet = newCrotch + legsH
if (newFeet > Math.round(h * 0.978)) {
  newCrotch = Math.min(newCrotch, Math.round(h * 0.978) - Math.round(legsH * 0.88))
  newFeet = Math.round(h * 0.978)
}

const out = Buffer.alloc(w * h * 4)
for (let i = 0; i < out.length; i += 4) {
  out[i] = 236
  out[i + 1] = 236
  out[i + 2] = 238
  out[i + 3] = 255
}
function sample(sx, sy) {
  const x = Math.max(0, Math.min(w - 1, sx))
  const y = Math.max(0, Math.min(h - 1, sy))
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const pick = (xx, yy) => px(xx, yy)
  const a = pick(x0, y0)
  const b = pick(x0 + 1, y0)
  const c = pick(x0, y0 + 1)
  const d = pick(x0 + 1, y0 + 1)
  return [0, 1, 2].map((k) =>
    Math.round((a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy),
  )
}
function put(x, y, rgb) {
  const i = (y * w + x) * 4
  out[i] = rgb[0]
  out[i + 1] = rgb[1]
  out[i + 2] = rgb[2]
  out[i + 3] = 255
}

for (let y = 0; y < chest; y += 1) {
  for (let x = 0; x < w; x += 1) put(x, y, sample(x, y))
}
const srcMid = oldCrotch - chest
const destMid = newCrotch - chest
for (let y = 0; y < destMid; y += 1) {
  const sy = chest + (y / Math.max(destMid - 1, 1)) * srcMid
  const dy = chest + y
  for (let x = 0; x < w; x += 1) put(x, dy, sample(x, sy))
}
const destLegs = newFeet - newCrotch
for (let y = 0; y < destLegs; y += 1) {
  const sy = oldCrotch + (y / Math.max(destLegs - 1, 1)) * legsH
  const dy = newCrotch + y
  if (dy >= h) break
  for (let x = 0; x < w; x += 1) put(x, dy, sample(x, sy))
}

const shoulderMul = 1.12
const peakY = neck + Math.round(bodyH * 0.08)
const chestY = neck + Math.round(bodyH * 0.22)
const waistY = neck + Math.round(bodyH * 0.4)
const seated = Buffer.from(out)
function put2(x, y, rgb) {
  const i = (y * w + x) * 4
  seated[i] = rgb[0]
  seated[i + 1] = rgb[1]
  seated[i + 2] = rgb[2]
  seated[i + 3] = 255
}
function sampleOut(sx, sy) {
  const x = Math.max(0, Math.min(w - 1, sx))
  const y = Math.max(0, Math.min(h - 1, sy))
  const i = (Math.round(y) * w + Math.round(x)) * 4
  return [out[i], out[i + 1], out[i + 2]]
}
const smooth = (t) => t * t * (3 - 2 * t)
for (let y = neck; y < waistY; y += 1) {
  let s = 1
  if (y <= peakY) s = 1 + (shoulderMul - 1) * smooth((y - neck) / Math.max(peakY - neck, 1))
  else if (y <= chestY) s = shoulderMul
  else s = shoulderMul + (1 - shoulderMul) * smooth((y - chestY) / Math.max(waistY - chestY, 1))
  for (let x = 0; x < w; x += 1) {
    const sx = cx + (x - cx) / s
    put2(x, y, sampleOut(sx, y))
  }
}

const destPic = path.join(PIC, '16-man-canon.jpg')
await sharp(seated, { raw: { width: w, height: h, channels: 4 } }).jpeg({ quality: 92 }).toFile(path.join(OUT, '12-from-face.jpg'))
await sharp(seated, { raw: { width: w, height: h, channels: 4 } }).jpeg({ quality: 92 }).toFile(destPic)
console.log({
  headTop,
  chin,
  neck,
  chest,
  oldCrotch,
  newCrotch,
  add,
  newFeet,
  destPic,
})
