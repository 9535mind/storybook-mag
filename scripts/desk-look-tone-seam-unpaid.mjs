#!/usr/bin/env node
/**
 * 무과금. 합성 톤 보정: 엔진이 전체 톤을 옮겨도 마스크 경계에 단차가 남지 않아야 한다.
 * 드리프트가 없으면 아무것도 바꾸지 않아야 한다.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8')

/** app.js 합성 루프와 같은 계산. */
function composite(s, g, md, w, h, r) {
  const n = w * h
  const sum = [0, 0, 0]
  let ringN = 0
  for (let p = 0; p < n; p += 1) {
    const i = p * 4
    if (md[i] >= 128) continue
    const x = p % w
    const y = (p - x) / w
    let touches = false
    if (x >= r && md[(p - r) * 4] >= 128) touches = true
    else if (x + r < w && md[(p + r) * 4] >= 128) touches = true
    else if (y >= r && md[(p - r * w) * 4] >= 128) touches = true
    else if (y + r < h && md[(p + r * w) * 4] >= 128) touches = true
    if (!touches) continue
    sum[0] += s[i] - g[i]
    sum[1] += s[i + 1] - g[i + 1]
    sum[2] += s[i + 2] - g[i + 2]
    ringN += 1
  }
  const tone = [0, 0, 0]
  if (ringN >= 64) {
    for (let c = 0; c < 3; c += 1) tone[c] = Math.max(-24, Math.min(24, Math.round(sum[c] / ringN)))
  }
  const gv = (i, c) => {
    const v = g[i + c] + tone[c]
    return v < 0 ? 0 : v > 255 ? 255 : v
  }
  const o = new Uint8Array(n * 4)
  for (let p = 0; p < n; p += 1) {
    const i = p * 4
    if (md[i] < 128) {
      o[i] = s[i]
      o[i + 1] = s[i + 1]
      o[i + 2] = s[i + 2]
      o[i + 3] = 255
      continue
    }
    o[i] = gv(i, 0)
    o[i + 1] = gv(i, 1)
    o[i + 2] = gv(i, 2)
    o[i + 3] = 255
  }
  return { o, tone, ringN }
}

const W = 64
const H = 64
function build(drift, garmentDelta) {
  const s = new Uint8Array(W * H * 4)
  const g = new Uint8Array(W * H * 4)
  const md = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const p = y * W + x
      const i = p * 4
      const inMask = x >= 20 && x < 44 && y >= 16 && y < 48
      const base = 140
      s[i] = s[i + 1] = s[i + 2] = base
      s[i + 3] = 255
      // 엔진 출력: 전체에 drift, 마스크 안은 새 옷이라 garmentDelta 만큼 더 다름
      const v = base + drift + (inMask ? garmentDelta : 0)
      g[i] = g[i + 1] = g[i + 2] = Math.max(0, Math.min(255, v))
      g[i + 3] = 255
      md[i] = md[i + 1] = md[i + 2] = inMask ? 255 : 0
      md[i + 3] = 255
    }
  }
  return { s, g, md }
}

/** 경계 한 칸 안팎의 밝기 단차. 옷 자체의 변화(garmentDelta)는 빼고 본다. */
function seamStep(o, md, garmentDelta) {
  let worst = 0
  for (let y = 1; y < H - 1; y += 1) {
    for (let x = 1; x < W - 1; x += 1) {
      const p = y * W + x
      if (md[p * 4] < 128) continue
      const left = p - 1
      if (md[left * 4] >= 128) continue
      const step = Math.abs(o[p * 4] - o[left * 4] - garmentDelta)
      if (step > worst) worst = step
    }
  }
  return worst
}

const clean = build(0, 30)
const cleanOut = composite(clean.s, clean.g, clean.md, W, H, 5)
const drifted = build(12, 30)
const driftedOut = composite(drifted.s, drifted.g, drifted.md, W, H, 5)
const noDriftUntouched = cleanOut.tone.every((t) => t === 0)
const driftMeasured = driftedOut.tone.every((t) => t === -12)
const driftedSeam = seamStep(driftedOut.o, drifted.md, 30)
const cleanSeam = seamStep(cleanOut.o, clean.md, 30)
/** 보정이 없었다면 경계에 drift 만큼(12) 단차가 남는다. */
const uncorrectedSeam = (() => {
  const { s, g, md } = build(12, 30)
  const o = new Uint8Array(W * H * 4)
  for (let p = 0; p < W * H; p += 1) {
    const i = p * 4
    const take = md[i] >= 128 ? g : s
    o[i] = take[i]
    o[i + 1] = take[i + 1]
    o[i + 2] = take[i + 2]
  }
  return seamStep(o, md, 30)
})()

const wiredTone = APP.includes('const tone = [0, 0, 0]') && APP.includes('Math.max(-24, Math.min(24,')
const wiredRing = APP.includes('if (ringN >= 64)')
const wiredUse = APP.includes('o[i] = gv(i, 0)') && APP.includes('s[i] * (1 - t) + gv(i, 0) * t')
const wiredLog = APP.includes("console.info(\n        'desk look gate',") || APP.includes("'desk look gate'")

const report = {
  newPaidCall: false,
  noDriftUntouched,
  driftMeasured,
  cleanSeam,
  driftedSeam,
  uncorrectedSeam,
  seamHealedByTone: driftedSeam === 0,
  wiredTone,
  wiredRing,
  wiredUse,
  wiredLog,
}
report.ok =
  noDriftUntouched &&
  driftMeasured &&
  cleanSeam === 0 &&
  driftedSeam === 0 &&
  uncorrectedSeam === 12 &&
  wiredTone &&
  wiredRing &&
  wiredUse &&
  wiredLog
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
