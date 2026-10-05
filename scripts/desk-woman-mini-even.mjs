#!/usr/bin/env node
/** 26→31. 팔·손은 원본. 가운데 스커트만 짧고 타이트하게 사진으로 줄인다. */
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const SRC = 'C:\\Users\\UserK\\Desktop\\그림모음\\26.jpg'
const OUT = 'C:\\Users\\UserK\\Desktop\\그림모음\\31.jpg'
const { default: sharp } = await import('sharp')

const img = sharp(SRC)
const meta = await img.metadata()
const w = meta.width
const h = meta.height
const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const out = Buffer.from(data)

function at(x, y) {
  const xx = Math.max(0, Math.min(w - 1, Math.round(x)))
  const yy = Math.max(0, Math.min(h - 1, Math.round(y)))
  const i = (yy * w + xx) * 4
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
}
function set(x, y, p) {
  const i = (y * w + x) * 4
  out[i] = p[0]
  out[i + 1] = p[1]
  out[i + 2] = p[2]
  out[i + 3] = 255
}

const bg = at(8, 8)
const hip = Math.round(h * 0.518)
const oldHem = Math.round(h * 0.688)
const newHem = Math.round(h * 0.548)
const feet = Math.round(h * 0.986)
const x0 = Math.round(w * 0.338)
const x1 = Math.round(w * 0.662)
const tight = 0.74
const cx = (x0 + x1) / 2

function isSkin(p) {
  return p[0] > 95 && p[1] > 60 && p[2] > 45 && p[0] > p[1] + 8 && p[0] > p[2]
}
function keepHand(x, y) {
  return y > h * 0.5 && y < h * 0.62 && isSkin(at(x, y))
}

for (let y = hip; y < feet; y += 1) {
  for (let x = x0; x < x1; x += 1) {
    if (keepHand(x, y)) continue
    set(x, y, bg)
  }
}

const skirtH = oldHem - hip
const newSkirtH = newHem - hip
for (let y = 0; y < newSkirtH; y += 1) {
  const srcY = hip + (y / Math.max(1, newSkirtH - 1)) * (skirtH - 1)
  for (let x = x0; x < x1; x += 1) {
    if (keepHand(x, hip + y)) continue
    const sx = cx + (x - cx) / tight
    if (sx < x0 || sx > x1) continue
    set(x, hip + y, at(sx, srcY))
  }
}

const destLegsH = feet - newHem
const srcLegsH = feet - oldHem
for (let y = 0; y < destLegsH; y += 1) {
  const dy = newHem + y
  const srcY = oldHem + (y / Math.max(1, destLegsH - 1)) * (srcLegsH - 1)
  for (let x = x0; x < x1; x += 1) {
    if (keepHand(x, dy)) continue
    set(x, dy, at(x, srcY))
  }
}

const jpeg = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
  .jpeg({ quality: 94 })
  .toBuffer()
writeFileSync(OUT, jpeg)
writeFileSync(path.join('tmp-faceswap-test', 'desk-id-extend-verify', '08-mini-photo.jpg'), jpeg)
console.log('saved', OUT, jpeg.length, { hip, newHem, oldHem })
