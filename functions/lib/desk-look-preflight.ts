/** LOOK 호출 전 게이트. 진단과 같은 파싱 결과를 운영 경로에서 쓴다. */

import {
  assembleClothesParseMask,
  assembleNudeBodyMask,
  assembleNudeInpaintMask,
  assembleVtonIdentityMask,
  diagnoseClothesRegions,
  parseInvasionCounts,
  MASK_MIN_WHITE,
} from './desk-clothes-parse'

export { assembleNudeBodyMask, assembleNudeInpaintMask } from './desk-clothes-parse'

export { assembleVtonIdentityMask } from './desk-clothes-parse'

export { gateLookVisual } from './desk-look-visual-gate'
export { diagnoseClothesRegions } from './desk-clothes-parse'

export type NormBox = { slot?: string; x: number; y: number; w: number; h: number; castId?: string }
export type DeskFace = NormBox & { slot: string }
export type DeskEmbed = { slot: string; dim: number; vec?: number[] }

export function coupleSplitX(a: NormBox, b: NormBox): number {
  return (a.x + a.w / 2 + b.x + b.w / 2) / 2
}

function clipBoxToSide(box: NormBox, splitX: number, faceCx: number): NormBox {
  const gap = 0.004
  if (faceCx >= splitX) {
    const x = Math.max(box.x, splitX + gap)
    return { ...box, x, w: Math.max(0.06, box.x + box.w - x) }
  }
  return { ...box, w: Math.max(0.06, Math.min(box.x + box.w, splitX - gap) - box.x) }
}

export function personBoxFromFace(face: DeskFace, splitX?: number): NormBox {
  const x = Math.max(0, face.x - face.w * 0.55)
  const y = Math.max(0, face.y - face.h * 0.75)
  const box: NormBox = {
    slot: face.slot,
    x,
    y,
    w: Math.min(1 - x, face.w * 2.8),
    h: Math.min(1 - y, Math.max(face.h * 6.2, 0.6)),
  }
  if (typeof splitX === 'number' && Number.isFinite(splitX)) {
    return clipBoxToSide(box, splitX, face.x + face.w / 2)
  }
  return box
}

export function lookLayoutFromFaces(faces: DeskFace[]): { woman: NormBox; man: NormBox | null } {
  const womanFace = faces.find((f) => f.slot === 'woman')
  const manFace = faces.find((f) => f.slot === 'man')
  if (!womanFace) {
    return { woman: { slot: 'woman', x: 0, y: 0, w: 1, h: 1 }, man: null }
  }
  if (!manFace) return { woman: { slot: 'woman', x: 0, y: 0, w: 1, h: 1 }, man: null }
  const splitX = coupleSplitX(womanFace, manFace)
  return { woman: personBoxFromFace(womanFace, splitX), man: personBoxFromFace(manFace, splitX) }
}

function inBox(box: NormBox | null | undefined, x: number, y: number): boolean {
  if (!box) return false
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h
}

export function linkCastFaces(
  faces: DeskFace[],
  layout: { woman?: NormBox | null; man?: NormBox | null },
  needCouple: boolean,
): { ok: boolean; reason: string } {
  if (!faces.length) return { ok: false, reason: 'undetected' }
  const womanFaces = faces.filter((f) => inBox(layout.woman, f.x + f.w / 2, f.y + f.h / 2) && f.slot === 'woman')
  if (womanFaces.length !== 1) return { ok: false, reason: 'woman_face_unlink' }
  if (needCouple) {
    if (!layout.man) return { ok: false, reason: 'cast_people' }
    const manFaces = faces.filter((f) => inBox(layout.man, f.x + f.w / 2, f.y + f.h / 2) && f.slot === 'man')
    if (manFaces.length !== 1) return { ok: false, reason: 'man_face_unlink' }
  } else if (faces.some((f) => f.slot === 'man') || faces.length !== 1) {
    return { ok: false, reason: 'cast_people' }
  }
  return { ok: true, reason: '' }
}

function embedCosine(a?: number[], b?: number[]): number {
  if (!a || !b || a.length !== b.length || !a.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

export function checkCastEmbeds(
  embeds: DeskEmbed[] | null | undefined,
  needCouple: boolean,
): { ok: boolean; reason: string } {
  if (!embeds || !embeds.length) return { ok: false, reason: 'undetected' }
  const woman = embeds.find((e) => e.slot === 'woman')
  if (!woman || woman.dim !== 512 || !woman.vec?.length) return { ok: false, reason: 'undetected' }
  if (needCouple) {
    const man = embeds.find((e) => e.slot === 'man')
    if (!man || man.dim !== 512 || !man.vec?.length) return { ok: false, reason: 'undetected' }
    if (embedCosine(woman.vec, man.vec) >= 0.99) return { ok: false, reason: 'undetected' }
  }
  return { ok: true, reason: '' }
}

export function runDeskLookPreflight(input: {
  labels: string[]
  width: number
  height: number
  layout: { woman?: NormBox | null; man?: NormBox | null }
  faces: DeskFace[]
  embeds?: DeskEmbed[] | null
  embedOk?: boolean
  vton?: boolean
  allowTogether?: boolean
  srcRgba?: Uint8Array | null
}): {
  ok: boolean
  reason: string
  mask: Uint8Array
  white: number
  whiteUpper: number
  whiteLower: number
  regions: { upper: number; lower: number; together: boolean }
  layout: { woman?: NormBox | null; man?: NormBox | null }
  verify: {
    ok: boolean
    reason: string
    maskWhite: number
    maskMinWhite: number
    maskWhiteUpper: number
    maskWhiteLower: number
    clothesRegionsTogether: boolean
    embedEngineExpected: 'insightface-buffalo_l'
    faceSlots: string[]
  }
} {
  const needCouple = Boolean(input.layout.man)
  const empty = new Uint8Array(Math.max(0, input.width * input.height))
  const link = linkCastFaces(input.faces, input.layout, needCouple)
  const clothes = assembleClothesParseMask({
    labels: input.labels,
    width: input.width,
    height: input.height,
    woman: input.layout.woman,
    man: input.layout.man,
  })
  const identity = input.vton
    ? assembleVtonIdentityMask({
        labels: input.labels,
        width: input.width,
        height: input.height,
        woman: input.layout.woman,
        man: input.layout.man,
        srcRgba: input.srcRgba,
      })
    : null
  const assembled = identity
    ? { mask: identity.mask, white: identity.white, whiteUpper: clothes.whiteUpper, whiteLower: clothes.whiteLower, ok: identity.ok, reason: identity.reason }
    : clothes
  const invade = parseInvasionCounts(input.labels, clothes.mask)
  const regions = diagnoseClothesRegions(clothes.whiteUpper, clothes.whiteLower)
  let reason = !link.ok ? link.reason : assembled.reason
  let ok = link.ok && assembled.ok
  if (ok && !input.vton && regions.together && !input.allowTogether) {
    ok = false
    reason = 'clothes_regions'
  }
  if (ok && !input.vton && (invade.background > 0 || invade.skin > 0)) {
    ok = false
    reason = 'mask_invade'
  }
  if (ok) {
    if (input.embedOk === false) {
      ok = false
      reason = 'undetected'
    } else {
      const embedGate = checkCastEmbeds(input.embeds, needCouple)
      if (!embedGate.ok) {
        ok = false
        reason = embedGate.reason
      }
    }
  }
  const verify = {
    ok,
    reason,
    maskWhite: assembled.white,
    maskMinWhite: MASK_MIN_WHITE,
    maskWhiteUpper: assembled.whiteUpper,
    maskWhiteLower: assembled.whiteLower,
    clothesRegionsTogether: regions.together,
    embedEngineExpected: 'insightface-buffalo_l' as const,
    faceSlots: input.embeds?.map((e) => e.slot) || [],
  }
  return {
    ok,
    reason,
    mask: assembled.mask.length ? assembled.mask : empty,
    white: assembled.white,
    whiteUpper: assembled.whiteUpper,
    whiteLower: assembled.whiteLower,
    regions,
    layout: input.layout,
    verify,
  }
}

export function buildLookPayload(input: {
  source: string
  clothesMask: string
  layout: { woman?: NormBox | null; man?: NormBox | null }
  verify: Record<string, unknown>
  maskSha256: string
  segformerSha256?: string
  recSha256?: string
  description: string
  deskLook: string
  deskCouple: boolean
}): Record<string, unknown> {
  return {
    composeMode: 'desk-still',
    deskStep: 'look',
    images: [input.source],
    clothesMask: input.clothesMask,
    deskCastLayout: input.layout,
    deskLookVerify: {
      ...input.verify,
      maskSha256: input.maskSha256,
      segformerSha256: input.segformerSha256 || '',
      recSha256: input.recSha256 || '',
    },
    description: input.description,
    deskLook: input.deskLook,
    deskCouple: input.deskCouple,
    deskAction: 'none',
    photoreal: true,
    refKind: 'body',
  }
}
