/**
 * 탈의·가슴 노출 등 텍스트 수정 시 올가미 없이 쓸 "얼굴 보존 / 몸통 수정" 마스크.
 * 검정=유지(얼굴), 흰=수정(목 아래). fal/replicate inpaint가 이미지 크기에 맞춰 리사이즈한다.
 */

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i]!
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
    }
  }
  return (c ^ 0xffffffff) >>> 0
}

function u32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff])
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  const len = u32(data.length)
  const body = new Uint8Array(4 + data.length)
  body.set(typeBytes, 0)
  body.set(data, 4)
  const crc = u32(crc32(body))
  const out = new Uint8Array(12 + data.length)
  out.set(len, 0)
  out.set(body, 4)
  out.set(crc, 8 + data.length)
  return out
}

/** 비압축 grayscale PNG (filter None). */
function encodeGrayPng(width: number, height: number, pixels: Uint8Array): Uint8Array {
  const raw = new Uint8Array((width + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (width + 1)
    raw[row] = 0
    raw.set(pixels.subarray(y * width, y * width + width), row + 1)
  }
  // zlib 비압축 블록들
  const maxBlock = 65535
  const chunks: number[] = [0x78, 0x01]
  let offset = 0
  while (offset < raw.length) {
    const size = Math.min(maxBlock, raw.length - offset)
    const last = offset + size >= raw.length ? 1 : 0
    chunks.push(last, size & 0xff, (size >> 8) & 0xff, ~size & 0xff, (~size >> 8) & 0xff)
    for (let i = 0; i < size; i++) chunks.push(raw[offset + i]!)
    offset += size
  }
  // Adler-32
  let s1 = 1
  let s2 = 0
  for (let i = 0; i < raw.length; i++) {
    s1 = (s1 + raw[i]!) % 65521
    s2 = (s2 + s1) % 65521
  }
  const adler = ((s2 << 16) | s1) >>> 0
  chunks.push((adler >>> 24) & 0xff, (adler >>> 16) & 0xff, (adler >>> 8) & 0xff, adler & 0xff)

  const ihdr = new Uint8Array(13)
  ihdr.set(u32(width), 0)
  ihdr.set(u32(height), 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 0 // grayscale
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const parts = [
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', Uint8Array.from(chunks)),
    pngChunk('IEND', new Uint8Array(0)),
  ]
  let total = 0
  for (const p of parts) total += p.length
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * @param faceKeepRatio 상단 이 비율(0~1)은 검정(얼굴 유지). 화보 반신 기본 0.34.
 */
export function buildFacePreserveBodyMaskDataUrl(options?: {
  width?: number
  height?: number
  /** 상단 얼굴 보존 비율 (기본 0.34 — 허리 위 초상에서 턱·목 위) */
  faceKeepRatio?: number
}): string {
  const width = Math.max(64, Math.min(1536, options?.width ?? 768))
  const height = Math.max(64, Math.min(1536, options?.height ?? 1024))
  const faceKeepRatio = Math.min(0.48, Math.max(0.22, options?.faceKeepRatio ?? 0.34))
  const cutY = Math.floor(height * faceKeepRatio)
  const pixels = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    const v = y < cutY ? 0 : 255
    pixels.fill(v, y * width, y * width + width)
  }
  const png = encodeGrayPng(width, height, pixels)
  return `data:image/png;base64,${bytesToBase64(png)}`
}

/**
 * 음모/체모만 수정 — 얼굴·가슴은 검정(유지), 하복부~치골 밴드만 흰(수정).
 * 반신 나체 기준: 대략 높이 52%~90%.
 */
export function buildPubicRegionMaskDataUrl(options?: {
  width?: number
  height?: number
  yStartRatio?: number
  yEndRatio?: number
}): string {
  const width = Math.max(64, Math.min(1536, options?.width ?? 768))
  const height = Math.max(64, Math.min(1536, options?.height ?? 1024))
  const y0 = Math.floor(height * Math.min(0.7, Math.max(0.4, options?.yStartRatio ?? 0.52)))
  const y1 = Math.floor(height * Math.min(0.98, Math.max(0.75, options?.yEndRatio ?? 0.9)))
  const pixels = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    const v = y >= y0 && y < y1 ? 255 : 0
    pixels.fill(v, y * width, y * width + width)
  }
  const png = encodeGrayPng(width, height, pixels)
  return `data:image/png;base64,${bytesToBase64(png)}`
}

/**
 * 유두·유륜만 수정 — 얼굴·하체는 검정, 가슴 밴드만 흰.
 */
export function buildBreastDetailMaskDataUrl(options?: {
  width?: number
  height?: number
}): string {
  const width = Math.max(64, Math.min(1536, options?.width ?? 768))
  const height = Math.max(64, Math.min(1536, options?.height ?? 1024))
  const y0 = Math.floor(height * 0.28)
  const y1 = Math.floor(height * 0.58)
  const pixels = new Uint8Array(width * height)
  for (let y = y0; y < y1; y++) {
    pixels.fill(255, y * width, y * width + width)
  }
  const png = encodeGrayPng(width, height, pixels)
  return `data:image/png;base64,${bytesToBase64(png)}`
}

/**
 * 귀걸이만 수정 — 얼굴·몸·배경은 검정(유지), 귀 부근만 흰(수정).
 * 정면: 좌우 가장자리. 옆모습: 귀가 화면 중앙~중측에 있어 중앙 밴드도 포함(실측 실패 수정).
 */
export function buildEarJewelryMaskDataUrl(options?: {
  width?: number
  height?: number
}): string {
  const width = Math.max(64, Math.min(1536, options?.width ?? 768))
  const height = Math.max(64, Math.min(1536, options?.height ?? 1024))
  const y0 = Math.floor(height * 0.1)
  const y1 = Math.floor(height * 0.52)
  const sideW = Math.floor(width * 0.38)
  const centerX0 = Math.floor(width * 0.22)
  const centerX1 = Math.floor(width * 0.78)
  const centerY0 = Math.floor(height * 0.14)
  const centerY1 = Math.floor(height * 0.46)
  const pixels = new Uint8Array(width * height)
  for (let y = y0; y < y1; y++) {
    const row = y * width
    for (let x = 0; x < sideW; x++) pixels[row + x] = 255
    for (let x = width - sideW; x < width; x++) pixels[row + x] = 255
  }
  // 옆모습 귀(머리 옆선) — 중앙 가로대
  for (let y = centerY0; y < centerY1; y++) {
    const row = y * width
    for (let x = centerX0; x < centerX1; x++) pixels[row + x] = 255
  }
  const png = encodeGrayPng(width, height, pixels)
  return `data:image/png;base64,${bytesToBase64(png)}`
}

/**
 * 시계·팔찌 — 얼굴/옷은 유지, 손목이 자주 오는 구간만 흰.
 * (턱 근처 손 · 옆구리 손 · 바닥에 짚은 손 — 전신 화보 포즈 기준)
 */
export function buildWristJewelryMaskDataUrl(options?: {
  width?: number
  height?: number
}): string {
  const width = Math.max(64, Math.min(1536, options?.width ?? 768))
  const height = Math.max(64, Math.min(1536, options?.height ?? 1024))
  const pixels = new Uint8Array(width * height)
  const fillRect = (x0: number, y0: number, x1: number, y1: number) => {
    const xa = Math.max(0, Math.floor(x0))
    const ya = Math.max(0, Math.floor(y0))
    const xb = Math.min(width, Math.ceil(x1))
    const yb = Math.min(height, Math.ceil(y1))
    for (let y = ya; y < yb; y++) {
      const row = y * width
      for (let x = xa; x < xb; x++) pixels[row + x] = 255
    }
  }
  // 얼굴 근처로 올린 손목(턱·가슴 높이)
  fillRect(width * 0.28, height * 0.22, width * 0.72, height * 0.52)
  // 옆구리·허벅지 쪽 손목
  fillRect(width * 0.08, height * 0.38, width * 0.42, height * 0.78)
  fillRect(width * 0.58, height * 0.38, width * 0.92, height * 0.78)
  // 바닥에 짚은 손(전신 좌식)
  fillRect(width * 0.1, height * 0.62, width * 0.55, height * 0.92)
  const png = encodeGrayPng(width, height, pixels)
  return `data:image/png;base64,${bytesToBase64(png)}`
}

/**
 * 목걸이 추가/제거 — 목·쇄골·가슴 상단만 흰.
 */
export function buildNeckJewelryMaskDataUrl(options?: {
  width?: number
  height?: number
}): string {
  const width = Math.max(64, Math.min(1536, options?.width ?? 768))
  const height = Math.max(64, Math.min(1536, options?.height ?? 1024))
  const pixels = new Uint8Array(width * height)
  const x0 = Math.floor(width * 0.22)
  const x1 = Math.floor(width * 0.78)
  const y0 = Math.floor(height * 0.14)
  const y1 = Math.floor(height * 0.42)
  for (let y = y0; y < y1; y++) {
    const row = y * width
    for (let x = x0; x < x1; x++) pixels[row + x] = 255
  }
  const png = encodeGrayPng(width, height, pixels)
  return `data:image/png;base64,${bytesToBase64(png)}`
}

/**
 * 손목 + 목걸이 영역 합집합 (시계/팔찌 + 목걸이 제거 한 번에).
 */
export function buildWristAndNeckJewelryMaskDataUrl(options?: {
  width?: number
  height?: number
}): string {
  const width = Math.max(64, Math.min(1536, options?.width ?? 768))
  const height = Math.max(64, Math.min(1536, options?.height ?? 1024))
  const pixels = new Uint8Array(width * height)
  const fillRect = (x0: number, y0: number, x1: number, y1: number) => {
    const xa = Math.max(0, Math.floor(x0))
    const ya = Math.max(0, Math.floor(y0))
    const xb = Math.min(width, Math.ceil(x1))
    const yb = Math.min(height, Math.ceil(y1))
    for (let y = ya; y < yb; y++) {
      const row = y * width
      for (let x = xa; x < xb; x++) pixels[row + x] = 255
    }
  }
  fillRect(width * 0.28, height * 0.22, width * 0.72, height * 0.52)
  fillRect(width * 0.08, height * 0.38, width * 0.42, height * 0.78)
  fillRect(width * 0.58, height * 0.38, width * 0.92, height * 0.78)
  fillRect(width * 0.1, height * 0.62, width * 0.55, height * 0.92)
  fillRect(width * 0.22, height * 0.14, width * 0.78, height * 0.42)
  const png = encodeGrayPng(width, height, pixels)
  return `data:image/png;base64,${bytesToBase64(png)}`
}
