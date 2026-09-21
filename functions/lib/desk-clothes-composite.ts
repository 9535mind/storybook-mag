/** 원본 검정 + 생성 흰 강제 합성. 모델이 얼굴을 바꿔도 최종에는 못 들어온다. */

const FEATHER_PX = 5

export function clampFeather(n?: number): number {
  if (!Number.isFinite(n as number)) return FEATHER_PX
  return Math.min(8, Math.max(3, Math.round(n as number)))
}

/**
 * mask 0=protect, 255=edit.
 * 여밈은 흰 의상 안쪽으로만. 검정 보호 화소의 알파는 항상 0.
 */
export function featherMaskGray(mask: Uint8Array, width: number, height: number, featherPx?: number): Float32Array {
  const r = clampFeather(featherPx)
  const alpha = new Float32Array(width * height)
  for (let i = 0; i < mask.length; i++) alpha[i] = mask[i]! >= 128 ? 1 : 0
  if (r <= 0) return alpha
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (mask[i]! < 128) {
        alpha[i] = 0
        continue
      }
      let dBlack = r
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(width - 1, x + r)
      const y0 = Math.max(0, y - r)
      const y1 = Math.min(height - 1, y + r)
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          if (mask[yy * width + xx]! >= 128) continue
          const d = Math.hypot(xx - x, yy - y)
          if (d < dBlack) dBlack = d
        }
      }
      alpha[i] = dBlack >= r ? 1 : dBlack / r
    }
  }
  return alpha
}

/** RGBA = src*(1-a) + gen*a. a=0이면 src 바이트 그대로. */
export function compositeProtectRgba(
  src: Uint8Array,
  gen: Uint8Array,
  mask: Uint8Array,
  width: number,
  height: number,
  featherPx?: number,
): Uint8Array {
  const a = featherMaskGray(mask, width, height, featherPx)
  const out = new Uint8Array(src.length)
  for (let p = 0; p < width * height; p++) {
    const i = p * 4
    const t = a[p]!
    if (t <= 0) {
      out[i] = src[i]!
      out[i + 1] = src[i + 1]!
      out[i + 2] = src[i + 2]!
      out[i + 3] = src[i + 3]!
    } else if (t >= 1) {
      out[i] = gen[i]!
      out[i + 1] = gen[i + 1]!
      out[i + 2] = gen[i + 2]!
      out[i + 3] = gen[i + 3]!
    } else {
      out[i] = Math.round(src[i]! * (1 - t) + gen[i]! * t)
      out[i + 1] = Math.round(src[i + 1]! * (1 - t) + gen[i + 1]! * t)
      out[i + 2] = Math.round(src[i + 2]! * (1 - t) + gen[i + 2]! * t)
      out[i + 3] = 255
    }
  }
  healEditDarkSeam(src, out, mask, width, height)
  return out
}

/** 편집 칸의 어두운 외곽 획만 원본 피부로 덮는다. 보호 화소는 그대로. */
export function healEditDarkSeam(
  src: Uint8Array,
  out: Uint8Array,
  mask: Uint8Array,
  width: number,
  height: number,
): number {
  const r = 2
  let n = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (mask[p]! < 128) continue
      let bound = false
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(width - 1, x + r)
      const y0 = Math.max(0, y - r)
      const y1 = Math.min(height - 1, y + r)
      for (let yy = y0; yy <= y1 && !bound; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          if (mask[yy * width + xx]! < 128) bound = true
        }
      }
      if (!bound) continue
      const i = p * 4
      const outL = (out[i]! + out[i + 1]! + out[i + 2]!) / 3
      const srcL = (src[i]! + src[i + 1]! + src[i + 2]!) / 3
      if (outL > 78 || srcL < 120 || srcL < outL + 28) continue
      if (src[i]! <= 85 || src[i]! + 8 < src[i + 1]! || src[i]! <= src[i + 2]! + 6) continue
      out[i] = src[i]!
      out[i + 1] = src[i + 1]!
      out[i + 2] = src[i + 2]!
      n += 1
    }
  }
  return n
}

/** 마스크 검정 전체. 여밈이 검정을 침범하면 identical=false. */
export function protectRegionMad(
  src: Uint8Array,
  out: Uint8Array,
  mask: Uint8Array,
  width: number,
  height: number,
  _featherPx?: number,
): { mad: number; n: number; max: number; identical: boolean } {
  let sum = 0
  let n = 0
  let max = 0
  for (let p = 0; p < width * height; p++) {
    if (mask[p]! >= 128) continue
    const i = p * 4
    const mad =
      (Math.abs(src[i]! - out[i]!) +
        Math.abs(src[i + 1]! - out[i + 1]!) +
        Math.abs(src[i + 2]! - out[i + 2]!)) /
      3
    sum += mad
    n += 1
    if (mad > max) max = mad
  }
  const mean = n ? sum / n : 1
  return { mad: mean, n, max, identical: n > 0 && max === 0 }
}

function zlibUncompressed(raw: Uint8Array): number[] {
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
  let s1 = 1
  let s2 = 0
  for (let i = 0; i < raw.length; i++) {
    s1 = (s1 + raw[i]!) % 65521
    s2 = (s2 + s1) % 65521
  }
  const adler = ((s2 << 16) | s1) >>> 0
  chunks.push((adler >>> 24) & 0xff, (adler >>> 16) & 0xff, (adler >>> 8) & 0xff, adler & 0xff)
  return chunks
}

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i]!
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

function u32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff])
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  const body = new Uint8Array(4 + data.length)
  body.set(typeBytes, 0)
  body.set(data, 4)
  const crc = u32(crc32(body))
  const out = new Uint8Array(12 + data.length)
  out.set(u32(data.length), 0)
  out.set(body, 4)
  out.set(crc, 8 + data.length)
  return out
}

export function encodeRgbPng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const raw = new Uint8Array((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const o = row + 1 + x * 3
      raw[o] = rgba[i]!
      raw[o + 1] = rgba[i + 1]!
      raw[o + 2] = rgba[i + 2]!
    }
  }
  const ihdr = new Uint8Array(13)
  ihdr.set(u32(width), 0)
  ihdr.set(u32(height), 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const parts = [signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', Uint8Array.from(zlibUncompressed(raw))), pngChunk('IEND', new Uint8Array(0))]
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

/** 흰 마스크가 피부 표본과 너무 비슷하면 침범. */
export function maskInvadesSkin(
  rgba: Uint8Array,
  mask: Uint8Array,
  width: number,
  height: number,
  skin: { r: number; g: number; b: number },
  maxFrac = 0.02,
): { ok: boolean; frac: number; n: number } {
  let white = 0
  let hit = 0
  for (let p = 0; p < width * height; p++) {
    if (mask[p]! < 128) continue
    white += 1
    const i = p * 4
    const dr = rgba[i]! - skin.r
    const dg = rgba[i + 1]! - skin.g
    const db = rgba[i + 2]! - skin.b
    if (dr * dr + dg * dg + db * db < 38 * 38 && rgba[i]! > rgba[i + 2]! - 8) hit += 1
  }
  const frac = white ? hit / white : 1
  return { ok: white > 0 && frac <= maxFrac, frac, n: hit }
}
