/** PNG → 회색 마스크. Worker에서 ONNX 없이 크기·흰 화소만 읽는다. */

async function inflateZlib(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate')
  const stream = new Blob([bytes]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function readU32(buf: Uint8Array, i: number): number {
  return ((buf[i]! << 24) | (buf[i + 1]! << 16) | (buf[i + 2]! << 8) | buf[i + 3]!) >>> 0
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function unfilter(raw: Uint8Array, width: number, height: number, bpp: number): Uint8Array {
  const stride = width * bpp
  const out = new Uint8Array(stride * height)
  let src = 0
  for (let y = 0; y < height; y++) {
    const type = raw[src++]!
    const row = y * stride
    const prev = y === 0 ? null : out.subarray((y - 1) * stride, y * stride)
    for (let x = 0; x < stride; x++) {
      const v = raw[src++]!
      const a = x >= bpp ? out[row + x - bpp]! : 0
      const b = prev ? prev[x]! : 0
      const c = prev && x >= bpp ? prev[x - bpp]! : 0
      let recon = v
      if (type === 1) recon = (v + a) & 255
      else if (type === 2) recon = (v + b) & 255
      else if (type === 3) recon = (v + ((a + b) >> 1)) & 255
      else if (type === 4) recon = (v + paeth(a, b, c)) & 255
      else if (type !== 0) throw new Error('png_filter')
      out[row + x] = recon
    }
  }
  return out
}

export async function decodePngGray(png: Uint8Array): Promise<{ width: number; height: number; gray: Uint8Array }> {
  if (png.length < 24 || png[0] !== 137 || png[1] !== 80) throw new Error('png_sig')
  let i = 8
  let width = 0
  let height = 0
  let bit = 0
  let color = 0
  const idat: number[] = []
  while (i + 8 <= png.length) {
    const len = readU32(png, i)
    i += 4
    const type = String.fromCharCode(png[i]!, png[i + 1]!, png[i + 2]!, png[i + 3]!)
    i += 4
    const data = png.subarray(i, i + len)
    i += len + 4
    if (type === 'IHDR') {
      width = readU32(data, 0)
      height = readU32(data, 4)
      bit = data[8]!
      color = data[9]!
    } else if (type === 'IDAT') {
      for (let k = 0; k < data.length; k++) idat.push(data[k]!)
    } else if (type === 'IEND') break
  }
  if (!width || !height || bit !== 8) throw new Error('png_ihdr')
  const inflated = await inflateZlib(Uint8Array.from(idat))
  const bpp = color === 0 ? 1 : color === 2 ? 3 : color === 4 ? 2 : color === 6 ? 4 : 0
  if (!bpp) throw new Error('png_color')
  const recon = unfilter(inflated, width, height, bpp)
  const gray = new Uint8Array(width * height)
  for (let p = 0; p < width * height; p++) {
    if (bpp === 1) gray[p] = recon[p]!
    else {
      const o = p * bpp
      gray[p] = Math.round((recon[o]! + recon[o + 1]! + recon[o + 2]!) / 3)
    }
  }
  return { width, height, gray }
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('data_url')
  const b64 = dataUrl.slice(comma + 1)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function imageDataUrlSize(dataUrl: string): { width: number; height: number } {
  const bytes = dataUrlToBytes(dataUrl)
  if (bytes[0] === 137 && bytes[1] === 80) {
    return { width: readU32(bytes, 16), height: readU32(bytes, 20) }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i += 1
        continue
      }
      const marker = bytes[i + 1]!
      if (marker === 0xd8 || marker === 0xd9) {
        i += 2
        continue
      }
      const len = (bytes[i + 2]! << 8) | bytes[i + 3]!
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { height: (bytes[i + 5]! << 8) | bytes[i + 6]!, width: (bytes[i + 7]! << 8) | bytes[i + 8]! }
      }
      i += 2 + len
    }
  }
  throw new Error('image_size')
}

function hexSha(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const digest = await crypto.subtle.digest('SHA-256', copy)
  return hexSha(digest)
}

export function hardMask(gray: Uint8Array): Uint8Array {
  const out = new Uint8Array(gray.length)
  for (let i = 0; i < gray.length; i++) out[i] = gray[i]! >= 128 ? 255 : 0
  return out
}
