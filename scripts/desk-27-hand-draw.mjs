#!/usr/bin/env node
/** 27을 커서 화소로만 그림. 엔진 없음. */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const SRC = 'C:\\Users\\UserK\\Desktop\\그림모음\\27.jpg'
const DIR = path.join('tmp-faceswap-test', 'desk-id-hand-draw')
mkdirSync(DIR, { recursive: true })
const { default: sharp } = await import('sharp')
const raw = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const w = raw.info.width
const h = raw.info.height
const src = raw.data

function idx(x, y) {
  return (Math.max(0, Math.min(h - 1, Math.round(y))) * w + Math.max(0, Math.min(w - 1, Math.round(x)))) * 4
}
function at(buf, x, y) {
  const i = idx(x, y)
  return [buf[i], buf[i + 1], buf[i + 2], 255]
}
function set(buf, x, y, p) {
  const i = (y * w + x) * 4
  buf[i] = p[0]
  buf[i + 1] = p[1]
  buf[i + 2] = p[2]
  buf[i + 3] = 255
}
function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    255,
  ]
}
const luma = (p) => p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114
const sat = (p) => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2])
const isSkin = (p) => p[0] > 88 && p[1] > 55 && p[2] > 38 && p[0] > p[1] + 6 && p[0] > p[2] && luma(p) > 70 && luma(p) < 230
const isStudio = (p) => sat(p) < 24 && luma(p) > 148
const isDark = (p) => luma(p) < 55 && sat(p) < 42

const bg = at(src, 8, 8)
const neck = at(src, Math.round(w * 0.5), Math.round(h * 0.195))
const thigh = at(src, Math.round(w * 0.44), Math.round(h * 0.76))
const wrist = at(src, Math.round(w * 0.31), Math.round(h * 0.57))

function spanDarkSkin(buf, y, a, b) {
  let L = -1
  let R = -1
  for (let x = a; x <= b; x += 1) {
    const p = at(buf, x, y)
    if (isStudio(p)) continue
    if (isDark(p) || isSkin(p)) {
      if (L < 0) L = x
      R = x
    }
  }
  return [L, R]
}

function handBottom(x0, x1) {
  let y1 = 0
  for (let y = Math.round(h * 0.48); y < Math.round(h * 0.66); y += 1) {
    for (let x = x0; x < x1; x += 1) if (isSkin(at(src, x, y))) y1 = Math.max(y1, y)
  }
  return y1
}

const elbow = Math.round(h * 0.4)
const bands = [
  [Math.round(w * 0.286), Math.round(w * 0.338)],
  [Math.round(w * 0.61), Math.round(w * 0.654)],
]
const handL = handBottom(bands[0][0], bands[0][1])
const handR = handBottom(bands[1][0], bands[1][1])
const targetHand = Math.round((Math.min(handL, handR) + h * 0.575) / 2)
console.log({ handL: +(handL / h).toFixed(3), handR: +(handR / h).toFixed(3), target: +(targetHand / h).toFixed(3) })

function evenArms(base) {
  const out = Buffer.from(base)
  for (const [x0, x1] of bands) {
    const hand = x0 < w / 2 ? handL : handR
    if (hand <= targetHand + 1) continue
    const scale = (targetHand - elbow) / Math.max(8, hand - elbow)
    for (let x = x0; x < x1; x += 1) {
      for (let y = elbow; y <= hand + 18 && y < Math.round(h * 0.7); y += 1) {
        if (y <= targetHand) {
          const srcY = elbow + (y - elbow) / scale
          set(out, x, y, mix(at(base, x, Math.floor(srcY)), at(base, x, Math.floor(srcY) + 1), srcY - Math.floor(srcY)))
        } else {
          const p = at(base, x, y)
          if (isDark(p) || isSkin(p)) set(out, x, y, bg)
        }
      }
    }
  }
  return out
}

function keepHand(base, x, y) {
  if (y < h * 0.5 || y > h * 0.64) return false
  return isSkin(at(base, x, y)) && (x < w * 0.36 || x > w * 0.64)
}

function drawMini(base) {
  const out = Buffer.from(base)
  const hip = Math.round(h * 0.508)
  const oldHem = Math.round(h * 0.688)
  const newHem = Math.round(h * 0.455)
  const shoeY = Math.round(h * 0.888)
  const cx = w * 0.5
  const x0 = Math.round(w * 0.345)
  const x1 = Math.round(w * 0.655)

  for (let y = hip; y < shoeY; y += 1) {
    let srcY
    if (y <= newHem) {
      const t = (y - hip) / Math.max(1, newHem - hip)
      srcY = hip + t * (oldHem - hip)
    } else {
      const t = (y - newHem) / Math.max(1, shoeY - newHem)
      srcY = oldHem + t * (shoeY - oldHem)
    }
    const [Ls, Rs] = spanDarkSkin(base, Math.round(srcY), x0, x1)
    if (Ls < 0) continue
    const slim = y <= newHem ? 0.72 : y < newHem + 8 ? 0.72 + ((y - newHem) / 8) * 0.28 : 1
    const L1 = Math.round(cx + (Ls - cx) * slim)
    const R1 = Math.round(cx + (Rs - cx) * slim)
    for (let x = x0; x < x1; x += 1) {
      if (keepHand(base, x, y)) continue
      const cur = at(base, x, y)
      if (x < L1 || x > R1) {
        if (isDark(cur)) set(out, x, y, bg)
        continue
      }
      const u = (x - L1) / Math.max(1, R1 - L1)
      const sample = at(base, Ls + u * (Rs - Ls), srcY)
      if (y <= newHem) {
        set(out, x, y, isStudio(sample) ? cur : sample)
      } else if (isSkin(sample)) {
        set(out, x, y, sample)
      } else if (isDark(cur) || isDark(sample)) {
        const legY = oldHem + 12 + ((y - newHem) / Math.max(1, shoeY - newHem)) * (shoeY - oldHem - 24)
        const leg = at(base, Ls + u * (Rs - Ls), legY)
        set(out, x, y, isSkin(leg) ? leg : isStudio(leg) ? bg : leg)
      }
    }
  }
  return out
}

function torsoWidth(y) {
  const t = (y / h - 0.22) / 0.36
  const shoulder = 0.118
  const waist = 0.078
  const hip = 0.11
  let k
  if (t < 0.35) k = shoulder
  else if (t < 0.62) k = shoulder + ((t - 0.35) / 0.27) * (waist - shoulder)
  else k = waist + ((t - 0.62) / 0.38) * (hip - waist)
  return k
}

function skinTone(y, x, L, R) {
  const t = Math.max(0, Math.min(1, (y - h * 0.2) / (h * 0.42)))
  let p = mix(neck, thigh, t * 0.55)
  p = mix(p, wrist, 0.18)
  const u = (x - (L + R) / 2) / Math.max(6, (R - L) / 2)
  const shade = 0.9 + 0.14 * (1 - Math.abs(u)) - 0.04 * Math.sin((y / h) * 12)
  p = [
    Math.max(50, Math.min(255, Math.round(p[0] * shade))),
    Math.max(40, Math.min(255, Math.round(p[1] * shade * 0.97))),
    Math.max(32, Math.min(255, Math.round(p[2] * shade * 0.93))),
    255,
  ]
  if (y > h * 0.31 && y < h * 0.43) {
    const bust = Math.exp(-((u + 0.34) ** 2) / 0.1) + Math.exp(-((u - 0.34) ** 2) / 0.1)
    const lift = 1 + bust * 0.08
    p = [Math.min(255, Math.round(p[0] * lift)), Math.min(255, Math.round(p[1] * lift * 0.97)), Math.min(255, Math.round(p[2] * lift * 0.94)), 255]
    if (bust > 0.75 && y > h * 0.36 && y < h * 0.39) p = mix(p, [128, 78, 72, 255], 0.32)
  }
  if (y > h * 0.525 && y < h * 0.568 && Math.abs(u) < 0.16) {
    p = mix(p, [48, 34, 28, 255], 0.34 * (1 - Math.abs(u) / 0.16))
  }
  return p
}

function drawNude(base) {
  const out = Buffer.from(base)
  const top = Math.round(h * 0.205)
  const shoeY = Math.round(h * 0.888)
  const cx = w * 0.5

  for (let y = top; y < shoeY; y += 1) {
    const half = Math.round(w * torsoWidth(y))
    const tL = Math.round(cx - half)
    const tR = Math.round(cx + half)
    const [aL, aR] = spanDarkSkin(base, y, Math.round(w * 0.2), Math.round(w * 0.4))
    const [bL, bR] = spanDarkSkin(base, y, Math.round(w * 0.6), Math.round(w * 0.8))

    const paint = (x0, x1, mode) => {
      if (x0 < 0 || x1 < x0) return
      for (let x = x0; x <= x1; x += 1) {
        const cur = at(base, x, y)
        if (isSkin(cur)) continue
        if (isStudio(cur)) continue
        if (!isDark(cur) && luma(cur) > 80) continue
        if (mode === 'torso') set(out, x, y, skinTone(y, x, tL, tR))
        else set(out, x, y, skinTone(y, x, x0, x1))
      }
    }

    paint(tL, tR, 'torso')
    if (y < h * 0.62) {
      if (aL >= 0) paint(aL, Math.min(aR, tL - 2), 'arm')
      if (bL >= 0) paint(Math.max(bL, tR + 2), bR, 'arm')
    }
  }
  return out
}

async function save(buf, dest) {
  const jpeg = await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).jpeg({ quality: 94 }).toBuffer()
  writeFileSync(dest, jpeg)
  console.log('saved', dest, jpeg.length)
}

const armed = evenArms(src)
const mini = drawMini(armed)
const nude = drawNude(armed)
await save(mini, path.join(DIR, '34-mini.jpg'))
await save(nude, path.join(DIR, '35-nude.jpg'))
await save(mini, 'C:\\Users\\UserK\\Desktop\\그림모음\\34.jpg')
await save(nude, 'C:\\Users\\UserK\\Desktop\\그림모음\\35.jpg')
