/** LOOK 합성 후. 상의·하의를 따로 채점한다. 평균으로 상쇄하지 않는다. 목표 의상(피부·슬립)은 아직 검증하지 않는다. */

import { MASK_MIN_WHITE, bodyGuidesFromLabels } from './desk-clothes-parse'

/** 변화량만. 요청 의상으로 바뀌었는지는 보지 않음. 결과 보고 바꾸지 않음. */
export const WHITE_MAD_MIN = 24
export const WHITE_CORR_MAX = 0.88
/**
 * 원래 옷과 비슷한 밝기의 옷으로 바꾸면 화소 차이(mad)는 작게 나온다.
 * 하지만 무늬가 통째로 달라지므로 상관(corr)은 0 근처로 떨어진다.
 * 이때 mad만 보고 거절하면 제대로 바뀐 결과를 버린다(실측: 하의 mad 21, corr 0.11).
 */
export const WHITE_CORR_STRONG = 0.45
/** 상관이 낮아도 이만큼은 달라져야 한다. 잡음·톤 보정만으로 통과하지 않게. */
export const WHITE_MAD_FLOOR = 12
/** 추정 몸통보다 가늘면 붕괴. 헐렁한 옷이 몸 쪽으로 줄어드는 것은 허용. */
export const BODY_CRUSH_RATIO = 0.82
export const CLOTHING_EXPLODE_RATIO = 1.22
/** 원본 피부-옷 단차 대비 상대값. 고정 색차만으로 탈락시키지 않음. */
export const SEAM_LUM_REL_MAX = 1.05
export const SEAM_TEX_MIN = 0.42
/** 마스크 외곽 좁은 띠. lumRel 평균에 묻히는 얇은 잔상용. */
export const SEAM_BAND_PX = 3
export const SEAM_REMNANT_DARK = 78
export const SEAM_REMNANT_CLOTHES_MAX = 120
export const SEAM_REMNANT_CONTRAST = 28
export const SEAM_REMNANT_MIN_RUN = 28
export const SEAM_REMNANT_MIN_ELONG = 3.2

export type LookVisualReason = 'clothes_goal' | 'silhouette' | 'mask_seam' | ''
export const VISUAL_REASON_ORDER: LookVisualReason[] = ['clothes_goal', 'mask_seam', 'silhouette']

export type RegionSilhouette = {
  outWidth: number
  bodyRef: number
  bodyMin: number
  clothingWidth: number
  crushed: boolean
  exploded: boolean
  ok: boolean
  rows: number
}

export type RegionSeam = {
  n: number
  srcLumJump: number
  outLumJump: number
  srcChromaJump: number
  outChromaJump: number
  srcTexWhite: number
  outTexWhite: number
  lumRel: number
  texRatio: number
  remnantN: number
  remnantMaxRun: number
  remnantElong: number
  remnantOk: boolean
  ok: boolean
}

export type RegionVisual = {
  name: 'upper' | 'lower'
  present: boolean
  n: number
  mad: number
  max: number
  corr: number
  changeOk: boolean
  targetUnverified: true
  silhouette: RegionSilhouette
  seam: RegionSeam
  failReasons: LookVisualReason[]
}

export type LookVisualGate = {
  ok: boolean
  reason: LookVisualReason
  failReasons: LookVisualReason[]
  complete: false
  clothesGoalKind: 'change_only'
  upper: RegionVisual
  lower: RegionVisual
  regions: {
    together: boolean
    upper: { n: number; mad: number; corr: number }
    lower: { n: number; mad: number; corr: number }
    all: { n: number; mad: number; max: number; corr: number }
  }
  silhouette: RegionSilhouette
  seam: RegionSeam
}

function lum(rgba: Uint8Array, i: number): number {
  return (rgba[i]! * 3 + rgba[i + 1]! * 4 + rgba[i + 2]! * 1) / 8
}

function rgbMad(a: Uint8Array, b: Uint8Array, i: number): number {
  return (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!)) / 3
}

function chromaDist(a: Uint8Array, ia: number, b: Uint8Array, ib: number): number {
  const ar = a[ia]! - a[ia + 1]!
  const ab = a[ia]! - a[ia + 2]!
  const br = b[ib]! - b[ib + 1]!
  const bb = b[ib]! - b[ib + 2]!
  return Math.hypot(ar - br, ab - bb)
}

function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length)
  if (n < 32) return 1
  let sx = 0
  let sy = 0
  for (let i = 0; i < n; i++) {
    sx += xs[i]!
    sy += ys[i]!
  }
  const mx = sx / n
  const my = sy / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const a = xs[i]! - mx
    const b = ys[i]! - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 1
}

function whiteStats(
  src: Uint8Array,
  out: Uint8Array,
  pick: (p: number) => boolean,
  len: number,
): { n: number; mad: number; max: number; corr: number } {
  let n = 0
  let sum = 0
  let max = 0
  const sl: number[] = []
  const ol: number[] = []
  for (let p = 0; p < len; p++) {
    if (!pick(p)) continue
    const i = p * 4
    const mad = rgbMad(src, out, i)
    sum += mad
    n += 1
    if (mad > max) max = mad
    sl.push(lum(src, i))
    ol.push(lum(out, i))
  }
  return { n, mad: n ? sum / n : 0, max, corr: pearson(sl, ol) }
}

function cornerBg(rgba: Uint8Array, width: number, height: number): { r: number; g: number; b: number } {
  const pts = [
    [1, 1],
    [width - 2, 1],
    [1, height - 2],
    [width - 2, height - 2],
  ]
  let r = 0
  let g = 0
  let b = 0
  for (const [x, y] of pts) {
    const i = (y * width + x) * 4
    r += rgba[i]!
    g += rgba[i + 1]!
    b += rgba[i + 2]!
  }
  return { r: r / 4, g: g / 4, b: b / 4 }
}

function isPerson(rgba: Uint8Array, i: number, bg: { r: number; g: number; b: number }): boolean {
  const dr = rgba[i]! - bg.r
  const dg = rgba[i + 1]! - bg.g
  const db = rgba[i + 2]! - bg.b
  return dr * dr + dg * dg + db * db > 22 * 22
}

function whiteBBox(mask: Uint8Array, width: number, height: number): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = width
  let y0 = height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]! < 128) continue
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
  }
  if (x1 < 0) return null
  return { x0, y0, x1, y1 }
}

function rowSpan(rgba: Uint8Array, width: number, y: number, x0: number, x1: number, bg: { r: number; g: number; b: number }): number {
  let left = -1
  let right = -1
  for (let x = x0; x <= x1; x++) {
    if (!isPerson(rgba, (y * width + x) * 4, bg)) continue
    if (left < 0) left = x
    right = x
  }
  return left < 0 ? 0 : right - left + 1
}

function texAt(rgba: Uint8Array, width: number, height: number, x: number, y: number): number {
  let n = 0
  let sum = 0
  let sum2 = 0
  for (let yy = y - 1; yy <= y + 1; yy++) {
    for (let xx = x - 1; xx <= x + 1; xx++) {
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue
      const v = lum(rgba, (yy * width + xx) * 4)
      sum += v
      sum2 += v * v
      n += 1
    }
  }
  if (n < 4) return 0
  const mean = sum / n
  return Math.sqrt(Math.max(0, sum2 / n - mean * mean))
}

function ySplitMasks(mask: Uint8Array, width: number, height: number): { upper: Uint8Array; lower: Uint8Array } {
  const box = whiteBBox(mask, width, height)
  const upper = new Uint8Array(mask.length)
  const lower = new Uint8Array(mask.length)
  if (!box) return { upper, lower }
  const yMid = box.y0 + Math.floor((box.y1 - box.y0) * 0.48)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (mask[p]! < 128) continue
      if (y < yMid) upper[p] = 255
      else lower[p] = 255
    }
  }
  return { upper, lower }
}

function protectPersonSpan(
  src: Uint8Array,
  mask: Uint8Array,
  width: number,
  height: number,
  y0: number,
  y1: number,
  bg: { r: number; g: number; b: number },
): number {
  const spans: number[] = []
  for (let y = y0; y <= y1; y++) {
    let left = -1
    let right = -1
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (mask[p]! >= 128) continue
      if (!isPerson(src, p * 4, bg)) continue
      if (left < 0) left = x
      right = x
    }
    if (left >= 0) spans.push(right - left + 1)
  }
  if (!spans.length) return 0
  spans.sort((a, b) => a - b)
  return spans[Math.floor(spans.length / 2)]!
}

function regionSilhouette(
  src: Uint8Array,
  out: Uint8Array,
  region: Uint8Array,
  width: number,
  height: number,
  bodyRef: number,
): RegionSilhouette {
  const empty: RegionSilhouette = {
    outWidth: 0,
    bodyRef,
    bodyMin: bodyRef * BODY_CRUSH_RATIO,
    clothingWidth: 0,
    crushed: false,
    exploded: false,
    ok: true,
    rows: 0,
  }
  const box = whiteBBox(region, width, height)
  if (!box || bodyRef <= 1) return empty
  const bg = cornerBg(src, width, height)
  const pad = Math.max(2, Math.round(width * 0.04))
  const x0 = Math.max(0, box.x0 - pad)
  const x1 = Math.min(width - 1, box.x1 + pad)
  let srcSum = 0
  let outSum = 0
  let rows = 0
  for (let y = box.y0; y <= box.y1; y++) {
    let has = false
    for (let x = box.x0; x <= box.x1; x++) {
      if (region[y * width + x]! >= 128) {
        has = true
        break
      }
    }
    if (!has) continue
    srcSum += rowSpan(src, width, y, x0, x1, bg)
    outSum += rowSpan(out, width, y, x0, x1, bg)
    rows += 1
  }
  const clothingWidth = rows ? srcSum / rows : 0
  const outWidth = rows ? outSum / rows : 0
  const bodyMin = bodyRef * BODY_CRUSH_RATIO
  const crushed = rows >= 8 && outWidth + 0.5 < bodyMin
  const exploded = rows >= 8 && clothingWidth > 1 && outWidth > clothingWidth * CLOTHING_EXPLODE_RATIO
  return {
    outWidth,
    bodyRef,
    bodyMin,
    clothingWidth,
    crushed,
    exploded,
    ok: !crushed && !exploded,
    rows,
  }
}

function regionSeam(
  src: Uint8Array,
  out: Uint8Array,
  region: Uint8Array,
  width: number,
  height: number,
): RegionSeam {
  const neigh = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  let n = 0
  let srcLum = 0
  let outLum = 0
  let srcCh = 0
  let outCh = 0
  let srcTw = 0
  let outTw = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x
      if (region[p]! < 128) continue
      for (const [dx, dy] of neigh) {
        const qx = x + dx
        const qy = y + dy
        const q = qy * width + qx
        if (region[q]! >= 128) continue
        const iw = p * 4
        const ib = q * 4
        srcLum += Math.abs(lum(src, iw) - lum(src, ib))
        outLum += Math.abs(lum(out, iw) - lum(out, ib))
        srcCh += chromaDist(src, iw, src, ib)
        outCh += chromaDist(out, iw, out, ib)
        srcTw += texAt(src, width, height, x, y)
        outTw += texAt(out, width, height, x, y)
        n += 1
        break
      }
    }
  }
  const srcLumJump = n ? srcLum / n : 0
  const outLumJump = n ? outLum / n : 0
  const srcChromaJump = n ? srcCh / n : 0
  const outChromaJump = n ? outCh / n : 0
  const srcTexWhite = n ? srcTw / n : 0
  const outTexWhite = n ? outTw / n : 0
  const lumRel = Math.abs(outLumJump - srcLumJump) / Math.max(srcLumJump, 8)
  const texRatio = outTexWhite / Math.max(srcTexWhite, 0.8)
  const torn = n >= 24 && lumRel > SEAM_LUM_REL_MAX
  const mashed = n >= 24 && srcTexWhite >= 2 && texRatio < SEAM_TEX_MIN
  return {
    n,
    srcLumJump,
    outLumJump,
    srcChromaJump,
    outChromaJump,
    srcTexWhite,
    outTexWhite,
    lumRel,
    texRatio,
    remnantN: 0,
    remnantMaxRun: 0,
    remnantElong: 0,
    remnantOk: true,
    ok: !torn && !mashed,
  }
}

function medianLum(src: Uint8Array, pick: Uint8Array): number {
  const vals: number[] = []
  for (let p = 0; p < pick.length; p++) {
    if (pick[p]! < 128) continue
    vals.push(lum(src, p * 4))
  }
  if (!vals.length) return 255
  vals.sort((a, b) => a - b)
  return vals[vals.length >> 1]!
}

function regionBoundaryRemnant(
  src: Uint8Array,
  out: Uint8Array,
  region: Uint8Array,
  width: number,
  height: number,
): { n: number; maxRun: number; elong: number; ok: boolean } {
  const empty = { n: 0, maxRun: 0, elong: 0, ok: true }
  const box = whiteBBox(region, width, height)
  if (!box) return empty
  const clothesRef = medianLum(src, region)
  if (clothesRef > SEAM_REMNANT_CLOTHES_MAX) return empty
  const r = SEAM_BAND_PX
  const handCut = box.y0 + Math.floor((box.y1 - box.y0 + 1) * 0.78)
  const hits = new Uint8Array(width * height)
  let n = 0
  for (let y = Math.max(0, box.y0 - r); y <= Math.min(height - 1, Math.min(box.y1 + r, handCut)); y++) {
    for (let x = Math.max(0, box.x0 - r); x <= Math.min(width - 1, box.x1 + r); x++) {
      const p = y * width + x
      const hereEdit = region[p]! >= 128
      let onBound = false
      let bright = 0
      let brightN = 0
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(width - 1, x + r)
      const y0 = Math.max(0, y - r)
      const y1 = Math.min(height - 1, y + r)
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          if (Math.hypot(xx - x, yy - y) > r + 0.25) continue
          const q = yy * width + xx
          if ((region[q]! >= 128) !== hereEdit) onBound = true
          if (region[q]! < 128) continue
          const ql = lum(out, q * 4)
          if (ql >= SEAM_REMNANT_DARK + 18) {
            bright += ql
            brightN += 1
          }
        }
      }
      if (!onBound) continue
      const outL = lum(out, p * 4)
      const srcL = lum(src, p * 4)
      const near = brightN ? bright / brightN : 255
      if (outL > SEAM_REMNANT_DARK) continue
      if (srcL > 110) continue
      if (Math.abs(outL - srcL) > 40) continue
      if (outL > clothesRef + 24) continue
      if (near - outL < SEAM_REMNANT_CONTRAST) continue
      hits[p] = 255
      n += 1
    }
  }
  if (n < SEAM_REMNANT_MIN_RUN) return { n, maxRun: 0, elong: 0, ok: true }
  const seen = new Uint8Array(width * height)
  let maxRun = 0
  let bestElong = 0
  const qx = new Int32Array(n + 8)
  const qy = new Int32Array(n + 8)
  for (let start = 0; start < hits.length; start++) {
    if (hits[start]! < 128 || seen[start]) continue
    let head = 0
    let tail = 0
    qx[0] = start % width
    qy[0] = (start / width) | 0
    tail = 1
    seen[start] = 1
    let area = 0
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0
    while (head < tail) {
      const x = qx[head]!
      const y = qy[head]!
      head += 1
      area += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const xx = x + dx
        const yy = y + dy
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue
        const q = yy * width + xx
        if (seen[q] || hits[q]! < 128) continue
        seen[q] = 1
        qx[tail] = xx
        qy[tail] = yy
        tail += 1
      }
    }
    const bw = maxX - minX + 1
    const bh = maxY - minY + 1
    const run = Math.max(bw, bh)
    const elong = run / Math.max(1, Math.min(bw, bh))
    if (run > maxRun) {
      maxRun = run
      bestElong = elong
    }
    if (area >= SEAM_REMNANT_MIN_RUN && run >= SEAM_REMNANT_MIN_RUN && elong >= SEAM_REMNANT_MIN_ELONG) {
      return { n, maxRun: run, elong, ok: false }
    }
  }
  return { n, maxRun, elong: bestElong, ok: true }
}

export function changeOk(stats: { n: number; mad: number; corr: number }): boolean {
  if (stats.n < MASK_MIN_WHITE) return true
  if (stats.corr > WHITE_CORR_MAX) return false
  if (stats.mad >= WHITE_MAD_MIN) return true
  return stats.corr <= WHITE_CORR_STRONG && stats.mad >= WHITE_MAD_FLOOR
}

function scoreRegion(
  name: 'upper' | 'lower',
  src: Uint8Array,
  out: Uint8Array,
  region: Uint8Array,
  width: number,
  height: number,
  bodyRef: number,
): RegionVisual {
  const stats = whiteStats(src, out, (p) => region[p]! >= 128, width * height)
  const present = stats.n >= MASK_MIN_WHITE
  const sil = regionSilhouette(src, out, region, width, height, bodyRef)
  const seam = regionSeam(src, out, region, width, height)
  const remnant = regionBoundaryRemnant(src, out, region, width, height)
  seam.remnantN = remnant.n
  seam.remnantMaxRun = remnant.maxRun
  seam.remnantElong = remnant.elong
  seam.remnantOk = remnant.ok
  seam.ok = seam.ok && remnant.ok
  const changed = changeOk(stats)
  const failReasons: LookVisualReason[] = []
  if (present && !changed) failReasons.push('clothes_goal')
  if (present && !seam.ok) failReasons.push('mask_seam')
  if (present && !sil.ok) failReasons.push('silhouette')
  return {
    name,
    present,
    n: stats.n,
    mad: stats.mad,
    max: stats.max,
    corr: stats.corr,
    changeOk: changed,
    targetUnverified: true,
    silhouette: sil,
    seam,
    failReasons,
  }
}

export function gateLookVisual(input: {
  src: Uint8Array
  out: Uint8Array
  mask: Uint8Array
  width: number
  height: number
  labels?: string[]
  upperMask?: Uint8Array
  lowerMask?: Uint8Array
  /** 나체: 실루엣·이음매는 느슨. 옷이 그대로면 통과시키지 않는다. */
  looseNude?: boolean
}): LookVisualGate {
  const { src, out, mask, width, height, labels } = input
  const split =
    input.upperMask && input.lowerMask
      ? { upper: input.upperMask, lower: input.lowerMask }
      : ySplitMasks(mask, width, height)
  const bg = cornerBg(src, width, height)
  let shoulder = 0
  let hip = 0
  if (labels && labels.length === width * height) {
    const g = bodyGuidesFromLabels(labels, width, height)
    shoulder = g.shoulder
    hip = g.hip
  }
  const upperBox = whiteBBox(split.upper, width, height)
  if (shoulder < 8 && upperBox) {
    const y0 = upperBox.y0
    const y1 = upperBox.y0 + Math.max(4, Math.floor((upperBox.y1 - upperBox.y0) * 0.35))
    const pad = Math.max(2, Math.round(width * 0.04))
    const x0 = Math.max(0, upperBox.x0 - pad)
    const x1 = Math.min(width - 1, upperBox.x1 + pad)
    const spans: number[] = []
    for (let y = y0; y <= y1; y++) {
      const w = rowSpan(src, width, y, x0, x1, bg)
      if (w > 0) spans.push(w)
    }
    if (spans.length) {
      spans.sort((a, b) => a - b)
      shoulder = spans[Math.floor(spans.length / 2)]!
    } else {
      shoulder = protectPersonSpan(src, mask, width, height, y0, y1, bg)
    }
  }
  if (hip < 8) hip = shoulder > 8 ? shoulder * 0.78 : 0
  if (shoulder < 8 && hip >= 8) shoulder = hip / 0.78
  const upper = scoreRegion('upper', src, out, split.upper, width, height, shoulder)
  const lower = scoreRegion('lower', src, out, split.lower, width, height, hip)
  if (!upper.present && !lower.present) {
    const bodyRef = Math.max(shoulder, hip)
    const only = scoreRegion(upper.n >= lower.n ? 'upper' : 'lower', src, out, mask, width, height, bodyRef)
    if (only.name === 'upper') Object.assign(upper, only)
    else Object.assign(lower, only)
  }
  const all = whiteStats(src, out, (p) => mask[p]! >= 128, width * height)
  const failReasons: LookVisualReason[] = []
  for (const r of [upper, lower]) {
    for (const reason of r.failReasons) {
      if (input.looseNude && reason === 'mask_seam') continue
      if (!failReasons.includes(reason)) failReasons.push(reason)
    }
  }
  if (all.n < 8 && !failReasons.includes('clothes_goal')) failReasons.push('clothes_goal')
  failReasons.sort((a, b) => VISUAL_REASON_ORDER.indexOf(a) - VISUAL_REASON_ORDER.indexOf(b))
  const together = upper.present && lower.present
  return {
    ok: failReasons.length === 0,
    reason: failReasons[0] || '',
    failReasons,
    complete: false,
    clothesGoalKind: 'change_only',
    upper,
    lower,
    regions: {
      together,
      upper: { n: upper.n, mad: upper.mad, corr: upper.corr },
      lower: { n: lower.n, mad: lower.mad, corr: lower.corr },
      all,
    },
    silhouette: upper.failReasons.includes('silhouette') ? upper.silhouette : lower.silhouette,
    seam: upper.failReasons.includes('mask_seam') ? upper.seam : lower.seam,
  }
}
