#!/usr/bin/env node
/**
 * 무과금. LOOK 두 갈래가 서로 섞이지 않는지 본다. Wan 불변.
 *
 * 나체: 마스크 안만 그리는 inpaint 0.85.
 * 슬립: 말로 옷을 설명하지 않고 옷 사진을 입히는 VTON(FASHN). 마스크·강도·부정 프롬프트 없음.
 *   인페인팅으로 슬립을 그리면 같은 마스크·같은 글에도 캐미솔·조끼·타이츠가 섞여 나왔다
 *   (3번에 1번 성공). VTON 은 목표 옷이 그림으로 고정된다(실측 3/3).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tale = readFileSync(path.join(ROOT, 'functions/api/tale-scene.ts'), 'utf8')
const look = tale.slice(tale.indexOf('const nudeStill'), tale.indexOf("if (step === 'look') {", tale.indexOf('look_inpaint_required')))
const client = readFileSync(path.join(ROOT, 'functions/lib/fal-client.ts'), 'utf8')
const app = readFileSync(path.join(ROOT, 'public/app.js'), 'utf8')

// 나체는 Flux가 아니라 Realistic Vision 마스크 인페인트. Flux는 수영복, SDXL은 옷복사(실측).
const nudeInpaint =
  /startReplicateInpaint/.test(look) &&
  /replicate-look-inpaint/.test(look) &&
  /realistic-vision-v5-inpainting/.test(look) &&
  /Melt those garments to bare adult skin/.test(look)
const nudeMasked = /maskUrl: clientMask/.test(look) && /nudeStill/.test(look)
const nudeBoost = /lookInpaintBoost/.test(look) && /0\.93/.test(look)

// 슬립은 VTON 으로 간다.
const slipTryon = /if \(slipStill\)/.test(look) && /submitFalFashnTryon/.test(look)
const slipGarmentPhoto = /desk-look-garment-slip\.png/.test(look)
const slipOnePiece = /category: 'one-pieces'/.test(look)
// 슬립이 인페인팅 가지로 다시 새지 않는다.
const slipNotInpaint = !/slipStill \? 0\.82/.test(look) && !/slipStill[\s\S]{0,160}Local edit ONLY/.test(look)
const tryonModel = /fal-ai\/fashn\/tryon\/v1\.6/.test(client)
// 사람 파싱을 켜야 원래 소매·바지 자리가 맨살로 비워진다. 끄면 흰 레깅스가 생긴다.
const tryonParsesBody = /segmentation_free: false/.test(client)

// VTON 결과에 마스크 합성을 덮지 않는다. 덮으면 마스크 밖 원래 옷이 되살아난다.
const noCompositeOnTryon = /const nativeIdentity = job\.engine === 'fal-fashn-tryon'/.test(app) &&
  /deskStep === 'look' && !nativeIdentity/.test(app)
// 합성을 건너뛴 대신 같은 사람인지는 얼굴 검사가 본다.
const identityStillChecked = /nativeIdentity, looseNude:/.test(app) && /reason: 'embed'/.test(app)
// VTON 경로에서도 몸 실루엣은 계속 본다. 이음매만 빼고.
// (빼면 몸이 원본보다 홀쭉해지거나 다른 몸이 되어도 그냥 저장된다.)
const bodyShapeStillChecked = /why !== 'mask_seam'/.test(app) && !/visual\.reason !== 'clothes_goal'/.test(app)

const wanFrozen = !/wan-2\.2/.test(look)

const ok =
  nudeInpaint &&
  nudeMasked &&
  nudeBoost &&
  slipTryon &&
  slipGarmentPhoto &&
  slipOnePiece &&
  slipNotInpaint &&
  tryonModel &&
  tryonParsesBody &&
  noCompositeOnTryon &&
  identityStillChecked &&
  bodyShapeStillChecked &&
  wanFrozen
const report = {
  nudeInpaint,
  nudeMasked,
  nudeBoost,
  slipTryon,
  slipGarmentPhoto,
  slipOnePiece,
  slipNotInpaint,
  tryonModel,
  tryonParsesBody,
  noCompositeOnTryon,
  identityStillChecked,
  bodyShapeStillChecked,
  wanFrozen,
  ok,
}
console.log(JSON.stringify(report, null, 2))
if (!ok) process.exit(1)
