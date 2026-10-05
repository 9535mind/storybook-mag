#!/usr/bin/env node
/** 스커트 밑단만 손 위로. 가린 구간은 아래 허벅지 화소로 잇는다. */
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const SRC = 'C:\\Users\\UserK\\Desktop\\그림모음\\26.jpg'
const OUT = 'C:\\Users\\UserK\\Desktop\\그림모음\\29.jpg'
const { default: sharp } = await import('sharp')

const src = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const w = src.info.width
const h = src.info.height
const data = src.data
const out = Buffer.from(data)

function at(x, y) {
  const i = (Math.max(0, Math.min(h - 1, Math.round(y))) * w + Math.max(0, Math.min(w - 1, Math.round(x)))) * 4
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
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
function isSkin(p) {
  return p[0] > 95 && p[1] > 60 && p[2] > 45 && p[0] > p[1] + 8 && p[0] > p[2]
}
function isSkirt(p) {
  return luma(p) < 48 && sat(p) < 30
}

function isStudio(p) {
  return sat(p) < 22 && luma(p) > 150
}

function sampleThigh(x, srcY) {
  const a = at(x, srcY)
  const b = at(x, srcY + 1)
  const f = srcY - Math.floor(srcY)
  const mix = [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
    255,
  ]
  if (!isStudio(mix) && luma(mix) > 40) return mix
  const mid = w / 2
  const prefer = x < mid ? [0.43, 0.41, 0.45, 0.54] : [0.54, 0.56, 0.52, 0.43]
  for (const xf of prefer) {
    const p = at(Math.round(w * xf), srcY)
    if (!isStudio(p) && luma(p) > 50) return p
  }
  return mix
}

const newHem = Math.round(h * 0.505)
const oldHem = Math.round(h * 0.688)
const crotch = Math.round(h * 0.555)
const thigh0 = Math.round(h * 0.695)
const thigh1 = Math.round(h * 0.84)

for (let y = newHem; y < oldHem; y += 1) {
  const t = (y - newHem) / Math.max(1, oldHem - newHem)
  const srcY = thigh0 + t * (thigh1 - thigh0)
  for (let x = Math.round(w * 0.3); x < Math.round(w * 0.7); x += 1) {
    const cur = at(x, y)
    if (isSkin(cur)) continue
    if (!isSkirt(cur)) continue
    const mix = sampleThigh(x, srcY)
    if (y >= crotch && isStudio(mix)) {
      const bg = at(8, 8)
      set(x, y, bg)
      continue
    }
    const fade = y < newHem + 4 ? (y - newHem) / 4 : 1
    set(x, y, [
      Math.round(cur[0] + (mix[0] - cur[0]) * fade),
      Math.round(cur[1] + (mix[1] - cur[1]) * fade),
      Math.round(cur[2] + (mix[2] - cur[2]) * fade),
      255,
    ])
  }
}

const jpeg = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
  .jpeg({ quality: 94 })
  .toBuffer()
writeFileSync(OUT, jpeg)
writeFileSync(path.join('tmp-faceswap-test', 'desk-id-extend-verify', '06-hem-up.jpg'), jpeg)
console.log('saved', OUT, jpeg.length)
