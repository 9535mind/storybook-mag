#!/usr/bin/env node
/** 5=미니·나체, 3=남자라 나체만. 엔진 없음. 검증 실패하면 저장하지 않음. */
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const { default: sharp } = await import('sharp')
const OUT = 'C:\\Users\\UserK\\Desktop\\그림모음'
const TMP = path.join('tmp-faceswap-test', 'desk-id-hand-draw')

const luma = (p) => p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114
const sat = (p) => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2])
function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

async function load(p) {
  const { data, info } = await sharp(p).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data: Buffer.from(data), w: info.width, h: info.height }
}
function at(img, x, y) {
  const xx = Math.max(0, Math.min(img.w - 1, Math.round(x)))
  const yy = Math.max(0, Math.min(img.h - 1, Math.round(y)))
  const i = (yy * img.w + xx) * 3
  return [img.data[i], img.data[i + 1], img.data[i + 2]]
}
function set(img, x, y, p) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return
  const i = (y * img.w + x) * 3
  img.data[i] = p[0]
  img.data[i + 1] = p[1]
  img.data[i + 2] = p[2]
}
function clone(img) {
  return { data: Buffer.from(img.data), w: img.w, h: img.h }
}

function isBg5(p) {
  return p[0] > 228 && p[1] > 228 && p[2] > 228
}
function isSkin5(p) {
  return p[0] > 150 && p[1] > 100 && p[2] > 85 && p[0] > p[2] + 8 && p[0] > p[1] && luma(p) < 230 && sat(p) > 18
}
function isPink(p) {
  if (isBg5(p) || isSkin5(p)) return false
  return p[0] > 175 && p[1] > 145 && p[2] > 165 && p[0] + 8 >= p[1]
}
function isBlack(p) {
  return luma(p) < 48 && sat(p) < 36
}
function isBg3(p) {
  return luma(p) > 210 && sat(p) < 18
}
function isNavy(p) {
  return luma(p) < 70 && (p[2] + 8 >= p[0] || luma(p) < 28)
}
function isSkin3(p) {
  return p[0] > 95 && p[1] > 60 && p[2] > 45 && p[0] > p[1] && p[0] > p[2] && luma(p) > 80 && luma(p) < 210
}

function faceLock(src, out, y1) {
  let mad = 0
  let n = 0
  for (let y = 0; y < y1; y += 2) {
    for (let x = Math.round(src.w * 0.28); x < src.w * 0.72; x += 2) {
      const a = at(src, x, y)
      const b = at(out, x, y)
      mad += (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3
      n += 1
    }
  }
  return n ? mad / n : 99
}

function handY(img, x0, x1, skinFn) {
  let y1 = 0
  for (let y = Math.round(img.h * 0.46); y < Math.round(img.h * 0.66); y += 1) {
    for (let x = x0; x < x1; x += 1) if (skinFn(at(img, x, y))) y1 = Math.max(y1, y)
  }
  return y1
}

function gapOk(img, y, skinFn, bgFn) {
  const mid = at(img, Math.round(img.w * 0.5), y)
  const L = at(img, Math.round(img.w * 0.43), y)
  const R = at(img, Math.round(img.w * 0.57), y)
  const centerOpen = bgFn(mid) || luma(mid) > 200
  const legs = skinFn(L) || luma(L) < 80
  const legsR = skinFn(R) || luma(R) < 80
  return { centerOpen, legs: legs && legsR, mid: luma(mid), L: luma(L), R: luma(R) }
}

async function save(img, dest) {
  const buf = await sharp(img.data, { raw: { width: img.w, height: img.h, channels: 3 } })
    .jpeg({ quality: 94 })
    .toBuffer()
  writeFileSync(dest, buf)
  return dest
}

function paintSkin(base, y, x, L, R, light, dark) {
  const u = (x - (L + R) / 2) / Math.max(6, (R - L) / 2)
  const t = Math.max(0, Math.min(1, (y / base.h - 0.2) / 0.45))
  let p = mix(light, dark, t * 0.45)
  const shade = 0.88 + 0.16 * (1 - Math.abs(u)) + 0.03 * Math.sin((y / base.h) * 10)
  return [
    Math.max(40, Math.min(255, Math.round(p[0] * shade))),
    Math.max(32, Math.min(255, Math.round(p[1] * shade * 0.96))),
    Math.max(28, Math.min(255, Math.round(p[2] * shade * 0.92))),
  ]
}

function draw5Mini(src) {
  const out = clone(src)
  const { w, h } = src
  let top = h
  let bot = 0
  for (let y = Math.round(h * 0.42); y < Math.round(h * 0.68); y += 1) {
    for (let x = Math.round(w * 0.3); x < Math.round(w * 0.7); x += 1) {
      if (isBlack(at(src, x, y))) {
        top = Math.min(top, y)
        bot = Math.max(bot, y)
      }
    }
  }
  const newHem = Math.round(top + (bot - top) * 0.55)
  const cx = w * 0.5
  console.log('5skirt', { top: +(top / h).toFixed(3), bot: +(bot / h).toFixed(3), newHem: +(newHem / h).toFixed(3) })
  for (let y = top; y <= bot + 8 && y < h; y += 1) {
    let Ls = -1
    let Rs = -1
    for (let x = Math.round(w * 0.28); x < Math.round(w * 0.72); x += 1) {
      if (isBlack(at(src, x, Math.min(bot, y)))) {
        if (Ls < 0) Ls = x
        Rs = x
      }
    }
    if (Ls < 0) continue
    const slim = y <= newHem ? 0.82 : 1
    const L1 = Math.round(cx + (Ls - cx) * slim)
    const R1 = Math.round(cx + (Rs - cx) * slim)
    for (let x = Math.round(w * 0.28); x < Math.round(w * 0.72); x += 1) {
      const cur = at(src, x, y)
      if (isSkin5(cur)) continue
      if (!isBlack(cur)) continue
      if (y > newHem || x < L1 || x > R1) {
        const t = (y - newHem) / Math.max(1, bot - newHem)
        const srcY = bot + 6 + t * (h * 0.18)
        const leg = at(src, x, srcY)
        if (isSkin5(leg)) set(out, x, y, leg)
        else set(out, x, y, at(src, 8, 8))
      }
    }
  }
  return out
}

function draw5Nude(src) {
  const out = clone(src)
  const { w, h } = src
  const neck = at(src, Math.round(w * 0.5), Math.round(h * 0.2))
  const arm = at(src, Math.round(w * 0.3), Math.round(h * 0.56))
  const thigh = at(src, Math.round(w * 0.43), Math.round(h * 0.7))
  const light = isSkin5(neck) ? neck : isSkin5(arm) ? arm : thigh
  const dark = isSkin5(thigh) ? thigh : light

  for (let y = Math.round(h * 0.18); y < Math.round(h * 0.88); y += 1) {
    const pinks = []
    const blacks = []
    for (let x = Math.round(w * 0.18); x < Math.round(w * 0.82); x += 1) {
      const p = at(src, x, y)
      if (isPink(p)) pinks.push(x)
      else if (isBlack(p) && y > h * 0.4 && y < h * 0.66) blacks.push(x)
    }
    const spans = (xs) => {
      const out = []
      let a = -1
      let prev = -9
      for (const x of xs) {
        if (a < 0) a = x
        if (x > prev + 2) {
          if (prev >= a) out.push([a, prev])
          a = x
        }
        prev = x
      }
      if (a >= 0) out.push([a, prev])
      return out
    }
    const pSpans = spans(pinks)
    const bSpans = spans(blacks)
    const cx = w * 0.5
    const waist = 0.078 + 0.03 * Math.cos(((y / h - 0.38) / 0.12) * Math.PI)
    const tHalf = Math.round(w * (y < h * 0.46 ? 0.11 : Math.max(0.075, waist)))

    const paintSpan = (a, b, mode) => {
      let L = a
      let R = b
      if (mode === 'torso') {
        L = Math.max(a, Math.round(cx - tHalf))
        R = Math.min(b, Math.round(cx + tHalf))
      }
      for (let x = L; x <= R; x += 1) {
        const cur = at(src, x, y)
        if (isSkin5(cur) || isBg5(cur)) continue
        let p = paintSkin(src, y, x, L, R, light, dark)
        if (mode === 'torso' && y > h * 0.3 && y < h * 0.42) {
          const u = (x - cx) / Math.max(6, (R - L) / 2)
          const bust = Math.exp(-((u + 0.32) ** 2) / 0.11) + Math.exp(-((u - 0.32) ** 2) / 0.11)
          p = mix(p, [Math.min(255, p[0] + 18), p[1], p[2]], bust * 0.35)
          if (bust > 0.7 && y > h * 0.355 && y < h * 0.385) p = mix(p, [140, 85, 80], 0.28)
        }
        if (mode === 'hip' && y > h * 0.52 && y < h * 0.57 && Math.abs(x - cx) < w * 0.04) {
          p = mix(p, [55, 40, 36], 0.3)
        }
        set(out, x, y, p)
      }
    }

    if (pSpans.length >= 3) {
      paintSpan(pSpans[0][0], pSpans[0][1], 'arm')
      paintSpan(pSpans[pSpans.length - 1][0], pSpans[pSpans.length - 1][1], 'arm')
      for (let i = 1; i < pSpans.length - 1; i += 1) paintSpan(pSpans[i][0], pSpans[i][1], 'torso')
    } else if (pSpans.length === 2) {
      paintSpan(pSpans[0][0], pSpans[0][1], pSpans[0][1] < cx ? 'arm' : 'torso')
      paintSpan(pSpans[1][0], pSpans[1][1], pSpans[1][0] > cx ? 'arm' : 'torso')
    } else if (pSpans.length === 1) {
      const [a, b] = pSpans[0]
      if (b - a > w * 0.22) {
        paintSpan(a, b, 'torso')
        if (a < cx - tHalf - 4) paintSpan(a, Math.round(cx - tHalf - 2), 'arm')
        if (b > cx + tHalf + 4) paintSpan(Math.round(cx + tHalf + 2), b, 'arm')
      } else paintSpan(a, b, a < w * 0.4 || b > w * 0.6 ? 'arm' : 'torso')
    }
    for (const [a, b] of bSpans) paintSpan(a, b, 'hip')
  }
  return out
}

function draw3Nude(src) {
  const out = clone(src)
  const { w, h } = src
  const face = at(src, Math.round(w * 0.5), Math.round(h * 0.16))
  const hand = (() => {
    for (let y = Math.round(h * 0.52); y < Math.round(h * 0.6); y += 1) {
      for (let x = Math.round(w * 0.22); x < Math.round(w * 0.32); x += 1) {
        const p = at(src, x, y)
        if (isSkin3(p)) return p
      }
    }
    return face
  })()
  const light = isSkin3(face) ? face : hand
  const dark = mix(light, [90, 70, 60], 0.35)

  for (let y = Math.round(h * 0.2); y < Math.round(h * 0.9); y += 1) {
    const xs = []
    for (let x = Math.round(w * 0.16); x < Math.round(w * 0.84); x += 1) {
      const p = at(src, x, y)
      if (isBg3(p) || isSkin3(p)) continue
      if (isNavy(p) || luma(p) < 80) xs.push(x)
    }
    const spans = []
    let a = -1
    let prev = -9
    for (const x of xs) {
      if (a < 0) a = x
      if (x > prev + 3) {
        if (prev >= a) spans.push([a, prev])
        a = x
      }
      prev = x
    }
    if (a >= 0) spans.push([a, prev])

    const cx = w * 0.5
    const tHalf = Math.round(w * (y < h * 0.48 ? 0.12 : y < h * 0.56 ? 0.09 : 0.11))
    const paint = (L, R, mode) => {
      for (let x = L; x <= R; x += 1) {
        const cur = at(src, x, y)
        if (isBg3(cur) || isSkin3(cur)) continue
        if (!(isNavy(cur) || luma(cur) < 80)) continue
        set(out, x, y, paintSkin(src, y, x, L, R, light, dark))
      }
    }
    if (y >= h * 0.58) {
      for (const [L, R] of spans) paint(L, R, 'leg')
    } else if (spans.length >= 3) {
      paint(spans[0][0], spans[0][1], 'arm')
      paint(spans[spans.length - 1][0], spans[spans.length - 1][1], 'arm')
      const tL = Math.round(cx - tHalf)
      const tR = Math.round(cx + tHalf)
      paint(tL, tR, 'torso')
    } else {
      for (const [L, R] of spans) {
        if (R < cx - w * 0.08 || L > cx + w * 0.08) paint(L, R, 'arm')
        else paint(Math.max(L, Math.round(cx - tHalf)), Math.min(R, Math.round(cx + tHalf)), 'torso')
      }
    }
  }
  return out
}

function verify5Mini(src, out) {
  const face = faceLock(src, out, Math.round(src.h * 0.2))
  const hL = handY(out, Math.round(src.w * 0.24), Math.round(src.w * 0.36), isSkin5)
  const hR = handY(out, Math.round(src.w * 0.64), Math.round(src.w * 0.76), isSkin5)
  const srcHem = handY(src, Math.round(src.w * 0.4), Math.round(src.w * 0.6), isBlack)
  const outHem = (() => {
    let y1 = 0
    for (let y = Math.round(src.h * 0.42); y < Math.round(src.h * 0.7); y += 1) {
      if (isBlack(at(out, Math.round(src.w * 0.5), y))) y1 = y
    }
    return y1
  })()
  const gap = gapOk(out, Math.round(src.h * 0.62), isSkin5, isBg5)
  const shoe = luma(at(out, Math.round(src.w * 0.46), Math.round(src.h * 0.95)))
  const ok = face < 1.5 && hL > src.h * 0.5 && hR > src.h * 0.5 && outHem < srcHem - 4 && shoe < 80
  return { ok, face, hL: +(hL / src.h).toFixed(3), hR: +(hR / src.h).toFixed(3), srcHem: +(srcHem / src.h).toFixed(3), outHem: +(outHem / src.h).toFixed(3), gap, shoe }
}

function verifyNude(src, out, skinFn, bgFn, who) {
  const face = faceLock(src, out, Math.round(src.h * 0.18))
  const hL = handY(out, Math.round(src.w * 0.22), Math.round(src.w * 0.36), skinFn)
  const hR = handY(out, Math.round(src.w * 0.64), Math.round(src.w * 0.78), skinFn)
  const chest = at(out, Math.round(src.w * 0.5), Math.round(src.h * 0.34))
  const gapY = Math.round(src.h * (who === 'man' ? 0.7 : 0.64))
  const gap = gapOk(out, gapY, skinFn, bgFn)
  const shoe = luma(at(out, Math.round(src.w * 0.46), Math.round(src.h * 0.95)))
  const plate =
    Math.abs(luma(at(out, Math.round(src.w * 0.5), Math.round(src.h * 0.32))) -
      luma(at(out, Math.round(src.w * 0.5), Math.round(src.h * 0.48)))) < 4
  const ok = face < 2 && !bgFn(chest) && luma(chest) > 70 && luma(chest) < 230 && !plate && shoe < 90
  return { ok, face, hL: +(hL / src.h).toFixed(3), hR: +(hR / src.h).toFixed(3), chest: Math.round(luma(chest)), gap, plate, shoe }
}

const src5 = await load(path.join(OUT, '5.jfif'))
const src3 = await load(path.join(OUT, '3.png'))
const mini5 = draw5Mini(src5)
const nude5 = draw5Nude(src5)
const nude3 = draw3Nude(src3)
const vMini = verify5Mini(src5, mini5)
const v5 = verifyNude(src5, nude5, isSkin5, isBg5, 'woman')
const v3 = verifyNude(src3, nude3, (p) => isSkin3(p) || (p[0] > 70 && p[0] > p[2]), isBg3, 'man')
console.log('verify mini5', vMini)
console.log('verify nude5', v5)
console.log('verify nude3', v3)

await save(mini5, path.join(TMP, '36-5-mini.jpg'))
await save(nude5, path.join(TMP, '37-5-nude.jpg'))
await save(nude3, path.join(TMP, '38-3-nude.jpg'))
if (vMini.ok) await save(mini5, path.join(OUT, '36.jpg'))
if (v5.ok) await save(nude5, path.join(OUT, '37.jpg'))
if (v3.ok) await save(nude3, path.join(OUT, '38.jpg'))
console.log('copied', { '36': vMini.ok, '37': v5.ok, '38': v3.ok })
