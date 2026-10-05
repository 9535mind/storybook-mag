/** LOOK inpaint 직전 Worker 재검사. ONNX 추론 없음. 불일치 시 유료 호출 금지. */

import { MASK_MIN_WHITE } from './desk-clothes-parse'
import { isApprovedLookModelSha } from './desk-look-models'
import { dataUrlToBytes, decodePngGray, hardMask, imageDataUrlSize, sha256Hex } from './desk-png'

export type LookCastBox = { x?: unknown; y?: unknown; w?: unknown; h?: unknown }

function asBox(box: LookCastBox | null | undefined): { x: number; y: number; w: number; h: number } | null {
  if (!box || typeof box !== 'object') return null
  const x = Number(box.x)
  const y = Number(box.y)
  const w = Number(box.w)
  const h = Number(box.h)
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null
  if (w < 0.04 || h < 0.04) return null
  return { x, y, w, h }
}

function inBox(box: { x: number; y: number; w: number; h: number }, nx: number, ny: number): boolean {
  return nx >= box.x && nx <= box.x + box.w && ny >= box.y && ny <= box.y + box.h
}

export async function verifyLookInpaintPayload(input: {
  source?: string
  clothesMask?: string
  deskCastLayout?: { woman?: LookCastBox | null; man?: LookCastBox | null } | null
  deskLookVerify?: {
    ok?: boolean
    maskSha256?: string
    segformerSha256?: string
    recSha256?: string
  } | null
}): Promise<{ ok: true } | { ok: false; error: string; status: 400 }> {
  const source = typeof input.source === 'string' ? input.source : ''
  const maskUrl = typeof input.clothesMask === 'string' ? input.clothesMask : ''
  const verify = input.deskLookVerify
  const layout = input.deskCastLayout
  if (!source.startsWith('data:image/') || !maskUrl.startsWith('data:image/')) {
    return { ok: false, error: 'look_mask_required', status: 400 }
  }
  if (!verify || verify.ok !== true || typeof verify.maskSha256 !== 'string' || verify.maskSha256.length < 16) {
    return { ok: false, error: 'look_verify_required', status: 400 }
  }
  const woman = asBox(layout?.woman)
  if (!woman) return { ok: false, error: 'look_cast_required', status: 400 }
  if (!isApprovedLookModelSha(verify.segformerSha256, verify.recSha256)) {
    return { ok: false, error: 'look_model_sha', status: 400 }
  }
  let srcSize: { width: number; height: number }
  let decoded: { width: number; height: number; gray: Uint8Array }
  try {
    srcSize = imageDataUrlSize(source)
    decoded = await decodePngGray(dataUrlToBytes(maskUrl))
  } catch {
    return { ok: false, error: 'look_size_mismatch', status: 400 }
  }
  if (srcSize.width !== decoded.width || srcSize.height !== decoded.height) {
    return { ok: false, error: 'look_size_mismatch', status: 400 }
  }
  if (srcSize.width > srcSize.height * 1.12) {
    return { ok: false, error: 'look_couple_full', status: 400 }
  }
  const mask = hardMask(decoded.gray)
  const sha = await sha256Hex(mask)
  if (sha !== verify.maskSha256.toLowerCase()) {
    return { ok: false, error: 'look_mask_sha', status: 400 }
  }
  let white = 0
  const man = asBox(layout?.man)
  const { width, height } = decoded
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (mask[p]! < 128) continue
      white += 1
      const nx = (x + 0.5) / width
      const ny = (y + 0.5) / height
      if (!inBox(woman, nx, ny) || (man && inBox(man, nx, ny))) {
        return { ok: false, error: 'look_mask_cast', status: 400 }
      }
    }
  }
  if (white < MASK_MIN_WHITE) return { ok: false, error: 'look_mask_too_small', status: 400 }
  return { ok: true }
}
