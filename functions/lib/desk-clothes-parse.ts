/** SegFormer-b2-clothes 라벨. 흰=의상만. */

export const CLOTHES_PARSE_LABELS = [
  'Background',
  'Hat',
  'Hair',
  'Sunglasses',
  'Upper-clothes',
  'Skirt',
  'Pants',
  'Dress',
  'Belt',
  'Left-shoe',
  'Right-shoe',
  'Face',
  'Left-leg',
  'Right-leg',
  'Left-arm',
  'Right-arm',
  'Bag',
  'Scarf',
] as const

export type ClothesParseLabel = (typeof CLOTHES_PARSE_LABELS)[number]

export const CLOTHES_UPPER_LABELS: readonly ClothesParseLabel[] = ['Upper-clothes', 'Dress', 'Belt', 'Scarf']
export const CLOTHES_LOWER_LABELS: readonly ClothesParseLabel[] = ['Skirt', 'Pants']

export const CLOTHES_EDIT_LABELS: readonly ClothesParseLabel[] = [
  ...CLOTHES_UPPER_LABELS,
  ...CLOTHES_LOWER_LABELS,
]

export const CLOTHES_PROTECT_LABELS: readonly ClothesParseLabel[] = [
  'Background',
  'Hat',
  'Hair',
  'Sunglasses',
  'Left-shoe',
  'Right-shoe',
  'Face',
  'Left-leg',
  'Right-leg',
  'Left-arm',
  'Right-arm',
  'Bag',
]

/** VTON: 얼굴·몸·배경은 잠그고 의상 라벨만 연다. */
export const VTON_IDENTITY_PROTECT_LABELS: readonly ClothesParseLabel[] = [
  'Background',
  'Hat',
  'Hair',
  'Sunglasses',
  'Face',
  'Left-shoe',
  'Right-shoe',
  'Left-leg',
  'Right-leg',
  'Left-arm',
  'Right-arm',
  'Bag',
]

export const VTON_MODEL_BODY_LABELS: readonly ClothesParseLabel[] = [
  'Upper-clothes',
  'Skirt',
  'Pants',
  'Dress',
  'Belt',
  'Scarf',
]

/** 199px 상반신 조각은 편집 불가. 억지로 키우지 않고 호출 전 중단. */
export const MASK_MIN_WHITE = 1500

export function isClothesEditLabel(label: string): boolean {
  return (CLOTHES_EDIT_LABELS as readonly string[]).includes(label)
}

export function isClothesUpperLabel(label: string): boolean {
  return (CLOTHES_UPPER_LABELS as readonly string[]).includes(label)
}

export function isClothesLowerLabel(label: string): boolean {
  return (CLOTHES_LOWER_LABELS as readonly string[]).includes(label)
}

export function diagnoseClothesRegions(whiteUpper: number, whiteLower: number): {
  upper: number
  lower: number
  together: boolean
} {
  return {
    upper: whiteUpper,
    lower: whiteLower,
    together: whiteUpper >= MASK_MIN_WHITE && whiteLower >= MASK_MIN_WHITE,
  }
}

const ARM_LABELS = new Set(['Left-arm', 'Right-arm'])
const LEG_LABELS = new Set(['Left-leg', 'Right-leg'])

function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = xs.slice().sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** 어깨·팔·다리 외곽. 의상 폭이 아님. */
export function bodyGuidesFromLabels(
  labels: string[],
  width: number,
  height: number,
): {
  shoulder: number
  hip: number
  armRows: number
  legRows: number
  yShoulder: number
  yHip: number
} {
  const armSpans: number[] = []
  const legSpans: number[] = []
  const armYs: number[] = []
  const legYs: number[] = []
  for (let y = 0; y < height; y++) {
    let arm0 = width
    let arm1 = -1
    let leg0 = width
    let leg1 = -1
    for (let x = 0; x < width; x++) {
      const lab = labels[y * width + x] || ''
      if (ARM_LABELS.has(lab)) {
        if (x < arm0) arm0 = x
        if (x > arm1) arm1 = x
      }
      if (LEG_LABELS.has(lab)) {
        if (x < leg0) leg0 = x
        if (x > leg1) leg1 = x
      }
    }
    if (arm1 >= 0) {
      armSpans.push(arm1 - arm0 + 1)
      armYs.push(y)
    }
    if (leg1 >= 0) {
      legSpans.push(leg1 - leg0 + 1)
      legYs.push(y)
    }
  }
  const shoulder = median(armSpans)
  const hip = median(legSpans)
  return {
    shoulder,
    hip,
    armRows: armSpans.length,
    legRows: legSpans.length,
    yShoulder: median(armYs),
    yHip: median(legYs),
  }
}

export function assembleClothesRegionMasks(options: {
  labels: string[]
  width: number
  height: number
  woman?: { x: number; y: number; w: number; h: number } | null
  man?: { x: number; y: number; w: number; h: number } | null
}): {
  mask: Uint8Array
  upper: Uint8Array
  lower: Uint8Array
  white: number
  whiteUpper: number
  whiteLower: number
  ok: boolean
  reason: string
} {
  const { labels, width, height, woman, man } = options
  const n = width * height
  const empty = {
    mask: new Uint8Array(n),
    upper: new Uint8Array(n),
    lower: new Uint8Array(n),
    white: 0,
    whiteUpper: 0,
    whiteLower: 0,
    ok: false,
    reason: 'parse_size',
  }
  if (labels.length !== n) return empty
  const splitX =
    woman && man ? (woman.x + woman.w / 2 + man.x + man.w / 2) / 2 : null
  const manCx = man ? man.x + man.w / 2 : 0
  const onManSide = (nx: number) => {
    if (man && pointIn(man, nx, 0.5)) return true
    if (splitX == null || !man) return false
    return manCx < splitX ? nx < splitX : nx > splitX
  }
  const mask = new Uint8Array(n)
  const upper = new Uint8Array(n)
  const lower = new Uint8Array(n)
  let white = 0
  let whiteUpper = 0
  let whiteLower = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      const nx = (x + 0.5) / width
      const ny = (y + 0.5) / height
      if (onManSide(nx)) continue
      if (man && pointIn(man, nx, ny)) continue
      if (woman && !pointIn(woman, nx, ny)) continue
      const lab = labels[p] || ''
      if (!isClothesEditLabel(lab)) continue
      mask[p] = 255
      white += 1
      if (isClothesUpperLabel(lab)) {
        upper[p] = 255
        whiteUpper += 1
      }
      if (isClothesLowerLabel(lab)) {
        lower[p] = 255
        whiteLower += 1
      }
    }
  }
  const ok = white >= MASK_MIN_WHITE
  return { mask, upper, lower, white, whiteUpper, whiteLower, ok, reason: ok ? '' : 'mask_too_small' }
}

const HAND_ARM_SPAN_FRAC = 0.08
/** 손목 장식은 알려진 제한. 이 값을 키우면 재킷 소매·청바지가 슬립에 붙는다. */
const HAND_DISTAL_FRAC = 0.22
const BODY_SPAN_LABELS = new Set([
  'Upper-clothes',
  'Skirt',
  'Pants',
  'Dress',
  'Belt',
  'Scarf',
  'Left-leg',
  'Right-leg',
])
const VTON_CLOTHES_BLEED_PX = 12
const VTON_FACE_CLOTHES_CLEAR_PX = 22
const VTON_SHOE_PANTS_CLEAR_PX = 12
const VTON_SLEEVE_CLEAR_PX = 12
const VTON_ARM_DARK_DELTA = 36
const VTON_ISLAND_MIN = 240
const VTON_CLOTHES_COLOR_DIST = 36
const VTON_DENIM_COLOR_DIST = 40
const CLOTHES_NEAR_LABELS = new Set(['Upper-clothes', 'Dress', 'Belt', 'Scarf', 'Skirt', 'Pants'])
const PANTS_NEAR_LABELS = new Set(['Pants', 'Skirt'])

export function armHandProtect(labels: string[], width: number, height: number): Uint8Array {
  const n = width * height
  const hands = new Uint8Array(n)
  for (const name of ARM_LABELS) {
    let y0 = height
    let y1 = -1
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((labels[y * width + x] || '') !== name) continue
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
    if (y1 < 0) continue
    const span = y1 - y0 + 1
    const cut = span <= height * HAND_ARM_SPAN_FRAC ? y0 : y1 - Math.floor(span * HAND_DISTAL_FRAC)
    for (let y = cut; y <= y1; y++) {
      for (let x = 0; x < width; x++) {
        if ((labels[y * width + x] || '') === name) hands[y * width + x] = 1
      }
    }
  }
  return hands
}

function nearAnyLabel(
  labels: string[],
  width: number,
  height: number,
  x: number,
  y: number,
  names: Set<string>,
  radius: number,
): boolean {
  const x0 = Math.max(0, x - radius)
  const x1 = Math.min(width - 1, x + radius)
  const y0 = Math.max(0, y - radius)
  const y1 = Math.min(height - 1, y + radius)
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      if (!names.has(labels[yy * width + xx] || '')) continue
      if (Math.hypot(xx - x, yy - y) <= radius) return true
    }
  }
  return false
}

function labeledMedianRgb(
  rgba: Uint8Array,
  labels: string[],
  name: string,
): { r: number; g: number; b: number; n: number } {
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  for (let p = 0; p < labels.length; p++) {
    if ((labels[p] || '') !== name) continue
    const i = p * 4
    rs.push(rgba[i]!)
    gs.push(rgba[i + 1]!)
    bs.push(rgba[i + 2]!)
  }
  return { r: median(rs), g: median(gs), b: median(bs), n: rs.length }
}

function isSkinLike(rgba: Uint8Array, p: number): boolean {
  const i = p * 4
  const r = rgba[i]!
  const g = rgba[i + 1]!
  const b = rgba[i + 2]!
  return r > 85 && r + 8 >= g && r > b + 6 && (r + g + b) / 3 > 75
}

function pixLum(rgba: Uint8Array, p: number): number {
  const i = p * 4
  return (rgba[i]! + rgba[i + 1]! + rgba[i + 2]!) / 3
}

function armInteriorLum(
  rgba: Uint8Array,
  labels: string[],
  width: number,
  height: number,
  hands: Uint8Array,
): number {
  const xs: number[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (!ARM_LABELS.has(labels[p] || '')) continue
      if (hands[p]) continue
      if (nearAnyLabel(labels, width, height, x, y, CLOTHES_NEAR_LABELS, VTON_SLEEVE_CLEAR_PX)) continue
      xs.push(pixLum(rgba, p))
    }
  }
  return median(xs)
}

function rgbDist(rgba: Uint8Array, p: number, sample: { r: number; g: number; b: number }): number {
  const i = p * 4
  return Math.hypot(rgba[i]! - sample.r, rgba[i + 1]! - sample.g, rgba[i + 2]! - sample.b)
}

/** 반지름은 사진 크기에 맞춘다. 208px 조각에서 12px는 얼굴·배경까지 먹는다. */
function scaledRadius(width: number, height: number, max: number): number {
  return Math.max(2, Math.min(max, Math.round(Math.min(width, height) * 0.015)))
}

function clothesBBox(labels: string[], width: number, height: number): { y0: number; y1: number } | null {
  let y0 = height
  let y1 = -1
  for (let p = 0; p < labels.length; p++) {
    if (!CLOTHES_NEAR_LABELS.has(labels[p] || '')) continue
    const y = (p / width) | 0
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return y1 < 0 ? null : { y0, y1 }
}

/** 옷 세로 구간 안의 배경 틈만. 앉은 자세의 의자·다리 사이까지 칠하지 않는다. */
function fillBetweenBodyGaps(
  mask: Uint8Array,
  labels: string[],
  width: number,
  height: number,
  woman?: { x: number; y: number; w: number; h: number } | null,
  man?: { x: number; y: number; w: number; h: number } | null,
): number {
  const box = clothesBBox(labels, width, height)
  if (!box) return 0
  let filled = 0
  for (let y = box.y0; y <= box.y1; y++) {
    let x0 = width
    let x1 = -1
    for (let x = 0; x < width; x++) {
      const nx = (x + 0.5) / width
      const ny = (y + 0.5) / height
      if (man && pointIn(man, nx, ny)) continue
      if (woman && !pointIn(woman, nx, ny)) continue
      if (!BODY_SPAN_LABELS.has(labels[y * width + x] || '')) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
    }
    if (x1 < 0 || x1 - x0 < 8) continue
    for (let x = x0; x <= x1; x++) {
      const p = y * width + x
      const nx = (x + 0.5) / width
      const ny = (y + 0.5) / height
      if (man && pointIn(man, nx, ny)) continue
      if (woman && !pointIn(woman, nx, ny)) continue
      if (mask[p]! >= 128) continue
      if ((labels[p] || '') !== 'Background') continue
      mask[p] = 255
      filled += 1
    }
  }
  return filled
}

function dropSmallProtectIslands(
  mask: Uint8Array,
  labels: string[],
  width: number,
  height: number,
  minArea: number,
): number {
  const n = width * height
  const seen = new Uint8Array(n)
  let dropped = 0
  const qx = new Int32Array(n)
  const qy = new Int32Array(n)
  for (let start = 0; start < n; start++) {
    if (mask[start]! >= 128 || seen[start]) continue
    let head = 0
    let tail = 0
    qx[tail] = start % width
    qy[tail] = (start / width) | 0
    tail += 1
    seen[start] = 1
    const cells: number[] = []
    while (head < tail) {
      const x = qx[head]!
      const y = qy[head]!
      head += 1
      const p = y * width + x
      cells.push(p)
      const nbs = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]
      for (const [xx, yy] of nbs) {
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue
        const q = yy * width + xx
        if (seen[q] || mask[q]! >= 128) continue
        seen[q] = 1
        qx[tail] = xx
        qy[tail] = yy
        tail += 1
      }
    }
    if (cells.length >= minArea) continue
    for (const p of cells) {
      const lab = labels?.[p] || ''
      if ((VTON_IDENTITY_PROTECT_LABELS as readonly string[]).includes(lab)) continue
      mask[p] = 255
      dropped += 1
    }
  }
  return dropped
}

function bleedEditIntoBackground(
  mask: Uint8Array,
  labels: string[],
  width: number,
  height: number,
  radius: number,
  woman?: { x: number; y: number; w: number; h: number } | null,
  man?: { x: number; y: number; w: number; h: number } | null,
): number {
  if (radius <= 0) return 0
  const extra: number[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      const nx = (x + 0.5) / width
      const ny = (y + 0.5) / height
      if (man && pointIn(man, nx, ny)) continue
      if (woman && !pointIn(woman, nx, ny)) continue
      if (mask[p]! >= 128) continue
      if ((labels[p] || '') !== 'Background') continue
      let near = false
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(width - 1, x + radius)
      const y0 = Math.max(0, y - radius)
      const y1 = Math.min(height - 1, y + radius)
      for (let yy = y0; yy <= y1 && !near; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          if (mask[yy * width + xx]! < 128) continue
          if (Math.hypot(xx - x, yy - y) <= radius) near = true
        }
      }
      if (near) extra.push(p)
    }
  }
  for (const p of extra) mask[p] = 255
  return extra.length
}

/**
 * VTON 합성. 흰=의상, 검정=원본 얼굴·몸·배경·손·신발.
 * 일반 inpaint 의상 마스크와 섞지 않는다.
 */
export function assembleVtonIdentityMask(options: {
  labels: string[]
  width: number
  height: number
  woman?: { x: number; y: number; w: number; h: number } | null
  man?: { x: number; y: number; w: number; h: number } | null
  srcRgba?: Uint8Array | null
}): {
  mask: Uint8Array
  white: number
  whiteBody: number
  whiteBleed: number
  handProtect: number
  releasedNeck: number
  releasedCuff: number
  releasedClothesColor: number
  releasedSleeve: number
  releasedIslands: number
  releasedGaps: number
  ok: boolean
  reason: string
} {
  const { labels, width, height, woman, man, srcRgba } = options
  const n = width * height
  const empty = {
    mask: new Uint8Array(n),
    white: 0,
    whiteBody: 0,
    whiteBleed: 0,
    handProtect: 0,
    releasedNeck: 0,
    releasedCuff: 0,
    releasedClothesColor: 0,
    releasedSleeve: 0,
    releasedIslands: 0,
    releasedGaps: 0,
    ok: false,
    reason: 'parse_size',
  }
  if (labels.length !== n) return empty
  const hands = armHandProtect(labels, width, height)
  const sleeveClearPx = scaledRadius(width, height, VTON_SLEEVE_CLEAR_PX)
  const jacket = srcRgba && srcRgba.length === n * 4 ? labeledMedianRgb(srcRgba, labels, 'Upper-clothes') : { r: 0, g: 0, b: 0, n: 0 }
  const armMed = srcRgba && srcRgba.length === n * 4 ? armInteriorLum(srcRgba, labels, width, height, hands) : 0
  const denim = srcRgba && srcRgba.length === n * 4 ? labeledMedianRgb(srcRgba, labels, 'Pants') : { r: 0, g: 0, b: 0, n: 0 }
  let pantsY1 = -1
  for (let p = 0; p < n; p++) {
    const lab = labels[p] || ''
    const y = (p / width) | 0
    if (lab === 'Pants' || lab === 'Skirt') {
      if (y > pantsY1) pantsY1 = y
    }
  }
  const mask = new Uint8Array(n)
  let whiteBody = 0
  let handProtect = 0
  let releasedNeck = 0
  let releasedCuff = 0
  let releasedClothesColor = 0
  let releasedSleeve = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      const nx = (x + 0.5) / width
      const ny = (y + 0.5) / height
      if (man && pointIn(man, nx, ny)) continue
      if (woman && !pointIn(woman, nx, ny)) continue
      const lab = labels[p] || ''
      if ((CLOTHES_EDIT_LABELS as readonly string[]).includes(lab)) {
        mask[p] = 255
        whiteBody += 1
        continue
      }
      if ((VTON_MODEL_BODY_LABELS as readonly string[]).includes(lab) && !hands[p]) {
        mask[p] = 255
        whiteBody += 1
        continue
      }
      const jacketLike = jacket.n > 0 && srcRgba ? rgbDist(srcRgba, p, jacket) <= VTON_CLOTHES_COLOR_DIST : false
      const denimLike = denim.n > 0 && srcRgba ? rgbDist(srcRgba, p, denim) <= VTON_DENIM_COLOR_DIST : false
      // 얼굴·머리는 절대 열지 않는다. 검은 상의는 검은 머리와 색이 같아 색 비교로 머리를 먹는다.
      if (lab === 'Face' || lab === 'Hair' || lab === 'Hat' || lab === 'Sunglasses') continue
      if (lab === 'Left-shoe' || lab === 'Right-shoe') {
        const cuffBand = pantsY1 >= 0 && y <= pantsY1
        const cuffTouch = nearAnyLabel(labels, width, height, x, y, PANTS_NEAR_LABELS, VTON_SHOE_PANTS_CLEAR_PX)
        if (cuffBand || cuffTouch) {
          mask[p] = 255
          releasedCuff += 1
          continue
        }
      }
      // 옷감으로 볼 수 있는 화소만. 피부는 어떤 색 비교로도 열지 않는다.
      const skinHere = srcRgba ? isSkinLike(srcRgba, p) : true
      const garmentLike =
        !skinHere &&
        (jacketLike ||
          denimLike ||
          (Boolean(srcRgba) &&
            pixLum(srcRgba!, p) <= Math.min(110, armMed > 0 ? armMed - VTON_ARM_DARK_DELTA : 110)))
      if (hands[p]) {
        if (garmentLike) {
          mask[p] = 255
          releasedClothesColor += 1
          continue
        }
        handProtect += 1
        continue
      }
      if (ARM_LABELS.has(lab) && garmentLike) {
        if (nearAnyLabel(labels, width, height, x, y, CLOTHES_NEAR_LABELS, sleeveClearPx)) {
          mask[p] = 255
          releasedSleeve += 1
          continue
        }
      }
    }
  }
  const releasedGaps = fillBetweenBodyGaps(mask, labels, width, height, woman, man)
  const whiteBleed = bleedEditIntoBackground(
    mask,
    labels,
    width,
    height,
    scaledRadius(width, height, VTON_CLOTHES_BLEED_PX),
    woman,
    man,
  )
  const releasedIslands = dropSmallProtectIslands(mask, labels, width, height, VTON_ISLAND_MIN)
  let white = 0
  for (let i = 0; i < n; i++) if (mask[i]! >= 128) white += 1
  const ok = white >= MASK_MIN_WHITE
  return {
    mask,
    white,
    whiteBody,
    whiteBleed,
    handProtect,
    releasedNeck,
    releasedCuff,
    releasedClothesColor,
    releasedSleeve,
    releasedIslands,
    releasedGaps,
    ok,
    reason: ok ? '' : 'mask_too_small',
  }
}

function pointIn(box: { x: number; y: number; w: number; h: number } | null | undefined, nx: number, ny: number): boolean {
  if (!box) return false
  return nx >= box.x && nx <= box.x + box.w && ny >= box.y && ny <= box.y + box.h
}

/**
 * labelMap[p] = 클래스 이름. woman 칸 안의 의상만 흰.
 * 피부·머리·팔·다리·배경·남 CAST는 검정.
 */
export function assembleClothesParseMask(options: {
  labels: string[]
  width: number
  height: number
  woman?: { x: number; y: number; w: number; h: number } | null
  man?: { x: number; y: number; w: number; h: number } | null
}): { mask: Uint8Array; white: number; whiteUpper: number; whiteLower: number; ok: boolean; reason: string } {
  const assembled = assembleClothesRegionMasks(options)
  return {
    mask: assembled.mask,
    white: assembled.white,
    whiteUpper: assembled.whiteUpper,
    whiteLower: assembled.whiteLower,
    ok: assembled.ok,
    reason: assembled.reason,
  }
}

/**
 * 나체: 의상 파싱을 믿지 않는다. 흰 니트는 Background로 빠져 옷 마스크가 비고,
 * 합성 때 원본 옷이 다시 붙는다(실측 MAD≈2). 얼굴 아래 몸 칸만 연다.
 */
export function assembleNudeBodyMask(options: {
  width: number
  height: number
  woman?: { x: number; y: number; w: number; h: number } | null
  man?: { x: number; y: number; w: number; h: number } | null
  faces?: Array<{ slot?: string; x: number; y: number; w: number; h: number }>
}): { mask: Uint8Array; white: number; ok: boolean; reason: string } {
  const { width, height, woman, man, faces } = options
  const n = width * height
  const mask = new Uint8Array(n)
  const face =
    (faces || []).find((f) => f.slot === 'woman') ||
    (faces || []).slice().sort((a, b) => b.w * b.h - a.w * a.h)[0]
  if (!face || face.w < 0.03 || face.h < 0.03) {
    return { mask, white: 0, ok: false, reason: 'mask_too_small' }
  }
  const chin = Math.min(0.92, face.y + face.h * 0.82)
  let bx: number
  let bw: number
  if (face.w >= 0.22) {
    bx = 0.05
    bw = 0.9
  } else {
    const cx = face.x + face.w / 2
    const half = Math.min(0.42, Math.max(0.3, face.w * 1.55))
    bx = Math.max(0, cx - half)
    bw = Math.min(1 - bx, half * 2)
  }
  const faceX0 = face.x - face.w * 0.22
  const faceY0 = face.y - face.h * 0.55
  const faceX1 = face.x + face.w * 1.22
  const faceY1 = face.y + face.h * 0.88
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x + 0.5) / width
      const ny = (y + 0.5) / height
      if (ny < chin) continue
      if (nx < bx || nx > bx + bw) continue
      if (man && pointIn(man, nx, ny)) continue
      if (woman && woman.w < 0.95 && !pointIn(woman, nx, ny)) continue
      if (nx >= faceX0 && nx <= faceX1 && ny >= faceY0 && ny <= faceY1) continue
      mask[y * width + x] = 255
    }
  }
  let white = 0
  for (let i = 0; i < n; i += 1) if (mask[i]! >= 128) white += 1
  return { mask, white, ok: white >= MASK_MIN_WHITE, reason: white >= MASK_MIN_WHITE ? '' : 'mask_too_small' }
}

const NUDE_INPAINT_PROTECT = new Set(['Background', 'Hat', 'Hair', 'Sunglasses', 'Face', 'Bag'])

/**
 * 나체 인페인트용. 옷 실루엣만 열면 엔진이 같은 옷을 다시 그린다(실측 MAD≈2).
 * 여자 칸 안에서 옷을 잇고 넓히되 얼굴·남자·배경은 검게 둔다.
 * 합성·clothes_goal 은 여전히 옷만 흰 마스크를 쓴다.
 */
export function assembleNudeInpaintMask(options: {
  labels: string[]
  width: number
  height: number
  woman?: { x: number; y: number; w: number; h: number } | null
  man?: { x: number; y: number; w: number; h: number } | null
  faces?: Array<{ x: number; y: number; w: number; h: number }>
}): { mask: Uint8Array; white: number; ok: boolean; reason: string } {
  const clothes = assembleClothesParseMask(options)
  const { width, height, labels, woman, man, faces } = options
  const n = width * height
  const seed = new Uint8Array(clothes.mask)
  for (let x = 0; x < width; x += 1) {
    let y0 = -1
    let y1 = -1
    for (let y = 0; y < height; y += 1) {
      if (seed[y * width + x]! < 128) continue
      if (y0 < 0) y0 = y
      y1 = y
    }
    if (y0 < 0 || y1 - y0 < 4) continue
    for (let y = y0; y <= y1; y += 1) {
      const p = y * width + x
      const nx = (x + 0.5) / width
      const ny = (y + 0.5) / height
      if (man && pointIn(man, nx, ny)) continue
      if (woman && !pointIn(woman, nx, ny)) continue
      if (NUDE_INPAINT_PROTECT.has(labels[p] || '')) continue
      seed[p] = 255
    }
  }
  const rad = Math.max(6, Math.round(Math.min(width, height) * 0.028))
  const grown = new Uint8Array(seed)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (seed[y * width + x]! < 128) continue
      for (let dy = -rad; dy <= rad; dy += 1) {
        for (let dx = -rad; dx <= rad; dx += 1) {
          if (dx * dx + dy * dy > rad * rad) continue
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue
          const p = yy * width + xx
          const nx = (xx + 0.5) / width
          const ny = (yy + 0.5) / height
          if (man && pointIn(man, nx, ny)) continue
          if (woman && !pointIn(woman, nx, ny)) continue
          if (NUDE_INPAINT_PROTECT.has(labels[p] || '')) continue
          grown[p] = 255
        }
      }
    }
  }
  for (const face of faces || []) {
    const padX = (face.w || 0) * 0.35
    const padTop = (face.h || 0) * 0.55
    const padBot = (face.h || 0) * 0.28
    const x0 = Math.max(0, Math.floor((face.x - padX) * width))
    const y0 = Math.max(0, Math.floor((face.y - padTop) * height))
    const x1 = Math.min(width, Math.ceil((face.x + face.w + padX) * width))
    const y1 = Math.min(height, Math.ceil((face.y + face.h + padBot) * height))
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) grown[y * width + x] = 0
    }
  }
  let white = 0
  for (let i = 0; i < n; i += 1) if (grown[i]! >= 128) white += 1
  return { mask: grown, white, ok: white >= MASK_MIN_WHITE, reason: white >= MASK_MIN_WHITE ? '' : 'mask_too_small' }
}

export function parseInvasionCounts(
  labels: string[],
  mask: Uint8Array,
): { background: number; skin: number; hair: number; otherPersonGuess: number } {
  let background = 0
  let skin = 0
  let hair = 0
  let otherPersonGuess = 0
  for (let p = 0; p < mask.length; p++) {
    if (mask[p]! < 128) continue
    const lab = labels[p] || ''
    if (lab === 'Background') background += 1
    if (lab === 'Hair' || lab === 'Hat') hair += 1
    if (lab === 'Face' || lab === 'Left-arm' || lab === 'Right-arm' || lab === 'Left-leg' || lab === 'Right-leg') {
      skin += 1
    }
    if (!isClothesEditLabel(lab)) otherPersonGuess += 1
  }
  return { background, skin, hair, otherPersonGuess }
}
