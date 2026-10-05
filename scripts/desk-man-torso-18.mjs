#!/usr/bin/env node
/** 37. 18 재킷 허리를 골반까지. 14 옆구리 살 없음. */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PIC = 'C:\\Users\\UserK\\Desktop\\그림모음'
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-man-torso-18')
mkdirSync(OUT, { recursive: true })

const { default: sharp } = await import('sharp')
const src = await sharp(path.join(PIC, '18.jfif')).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
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
let barTop = h
for (let y = h - 1; y > h * 0.88; y -= 1) {
  let n = 0
  let dark = 0
  for (let x = 0; x < w; x += 3) {
    n += 1
    if (luma(x, y) < 60) dark += 1
  }
  if (dark > n * 0.82) barTop = y
  else break
}
let headTop = Math.round(h * 0.03)
for (let y = 3; y < h * 0.18; y += 1) {
  if (luma(cx, y) < 170) {
    headTop = Math.max(2, y - 2)
    break
  }
}
let feet = Math.min(barTop - 3, Math.round(h * 0.94))
for (let y = Math.min(barTop - 3, h - 4); y > h * 0.72; y -= 1) {
  let dark = 0
  for (let x = Math.round(w * 0.4); x < Math.round(w * 0.6); x += 1) {
    if (luma(x, y) < 45) dark += 1
  }
  if (dark >= 12) {
    feet = y
    break
  }
}
let chin = headTop + Math.round(h * 0.14)
for (let y = headTop + Math.round(h * 0.09); y < headTop + Math.round(h * 0.2); y += 1) {
  if (luma(cx, y) < 55) {
    chin = y - 3
    break
  }
}
const faceH = chin - headTop
const neck = chin + Math.round(faceH * 0.1)
const bodyH = feet - neck
const personH = feet - headTop
const chest = neck + Math.round(bodyH * 0.08)
const chestY = neck + Math.round(bodyH * 0.16)
const jxs = [-0.1, -0.07, 0.07, 0.1].map((d) => Math.round(cx + d * w))
const inner = [cx - 20, cx - 8, cx, cx + 8, cx + 20]
let jacketL = 0
let jacketN = 0
for (const x of jxs) {
  const L = luma(x, chestY)
  if (L > 40 && L < 190) {
    jacketL += L
    jacketN += 1
  }
}
jacketL = jacketN ? jacketL / jacketN : luma(Math.round(w * 0.42), chestY)
let hem = 0
const y0 = Math.max(chest + Math.round(h * 0.06), headTop + Math.round(personH * 0.42))
const y1 = neck + Math.round(bodyH * 0.58)
for (let y = y0; y < y1; y += 1) {
  let pants = 0
  for (const x of inner) {
    const L = luma(x, y)
    if (L < 52 && jacketL - L > 36) pants += 1
  }
  if (pants < 2) continue
  let hold = 0
  for (let k = 0; k < 10; k += 1) {
    let p2 = 0
    for (const x of inner) {
      const L = luma(x, y + k)
      if (L < 52 && jacketL - L > 36) p2 += 1
    }
    if (p2 >= 2) hold += 1
  }
  if (hold >= 7) {
    hem = y
    break
  }
}
const oldCrotch = hem > chest + 8 ? hem : neck + Math.round(bodyH * 0.48)
const targetCrotch = Math.min(feet - Math.round(personH * 0.36), headTop + Math.round(personH * 0.62))
const add = Math.min(Math.max(0, targetCrotch - oldCrotch), Math.round(personH * 0.14))
const legsH = feet - oldCrotch
let newCrotch = oldCrotch + add
if (newCrotch + Math.round(legsH * 0.72) > feet) newCrotch = feet - Math.round(legsH * 0.72)
const newFeet = feet

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

const destPic = path.join(PIC, '19-man-torso.jpg')
const tmpPic = path.join(OUT, '18-torso.jpg')
await sharp(out, { raw: { width: w, height: h, channels: 4 } }).jpeg({ quality: 92 }).toFile(tmpPic)
await sharp(out, { raw: { width: w, height: h, channels: 4 } }).jpeg({ quality: 92 }).toFile(destPic)
console.log({
  headTop,
  chin,
  neck,
  chest,
  hem,
  oldCrotch,
  newCrotch,
  add,
  feet,
  barTop,
  jacketL: +jacketL.toFixed(1),
  destPic,
})
