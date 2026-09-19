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

function rgbDist(rgba: Uint8Array, p: number, sample: { r: number; g: number; b: number }): number {
  const i = p * 4
  return Math.hypot(rgba[i]! - sample.r, rgba[i + 1]! - sample.g, rgba[i + 2]! - sample.b)
}

/** 다리·몸통 사이의 배경 틈. 슬립 밑단 중앙에 원본 배경이 박히는 직사각형. */
function fillBetweenBodyGaps(
  mask: Uint8Array,
  labels: string[],
  width: number,
  height: number,
  woman?: { x: number; y: number; w: number; h: number } | null,
  man?: { x: number; y: number; w: number; h: number } | null,
): number {
  let filled = 0
  for (let y = 0; y < height; y++) {
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
  const jacket = srcRgba && srcRgba.length === n * 4 ? labeledMedianRgb(srcRgba, labels, 'Upper-clothes') : { r: 0, g: 0, b: 0, n: 0 }
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
      if (lab === 'Face' || lab === 'Hair' || lab === 'Hat') {
        if (nearAnyLabel(labels, width, height, x, y, CLOTHES_NEAR_LABELS, VTON_FACE_CLOTHES_CLEAR_PX)) {
          mask[p] = 255
          releasedNeck += 1
          continue
        }
        if (jacketLike) {
          mask[p] = 255
          releasedClothesColor += 1
          continue
        }
      }
      if (lab === 'Left-shoe' || lab === 'Right-shoe') {
        const cuffBand = pantsY1 >= 0 && y <= pantsY1
        const cuffTouch = nearAnyLabel(labels, width, height, x, y, PANTS_NEAR_LABELS, VTON_SHOE_PANTS_CLEAR_PX)
        if (cuffBand || cuffTouch) {
          mask[p] = 255
          releasedCuff += 1
          continue
        }
      }
      if (hands[p]) {
        if (denimLike || (srcRgba && !isSkinLike(srcRgba, p))) {
          mask[p] = 255
          releasedClothesColor += 1
          continue
        }
        handProtect += 1
        continue
      }
      if (ARM_LABELS.has(lab) && srcRgba && !isSkinLike(srcRgba, p)) {
        if (nearAnyLabel(labels, width, height, x, y, CLOTHES_NEAR_LABELS, VTON_SLEEVE_CLEAR_PX)) {
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
    VTON_CLOTHES_BLEED_PX,
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
