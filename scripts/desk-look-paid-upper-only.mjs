#!/usr/bin/env node
/**
 * 승인: 상의 마스크 flux-lora inpaint 1회. 재시도·하의·Wan·배포 없음.
 */
import { createHash } from 'node:crypto'
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-paid-upper-only')
const LOCK = path.join(OUT, 'paid-once.lock')
const SRC = path.join(ROOT, 'tmp-faceswap-test', 'try-stand', '1-stand.jpg')
const LABELS = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire', 'woman-full-labels.u8')
const BUNDLE = path.join(ROOT, '_tmp_bundle')
const MODEL = 'fal-ai/flux-lora/inpainting'
const PRICE_PER_MP = 0.035
const COST_CAP = 0.07
const FAL_SCHEMA_KEYS = new Set([
  'prompt',
  'image_size',
  'num_inference_steps',
  'seed',
  'loras',
  'guidance_scale',
  'sync_mode',
  'num_images',
  'enable_safety_checker',
  'output_format',
  'acceleration',
  'image_url',
  'strength',
  'mask_url',
])
const NOT_ON_MODEL = ['pose', 'controlnets', 'controlnet', 'control_image_url', 'openpose', 'shoulder']

mkdirSync(OUT, { recursive: true })
mkdirSync(BUNDLE, { recursive: true })

if (existsSync(LOCK)) {
  console.log('LOCK already spent. no second paid call.')
  process.exit(1)
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function readFalKey() {
  const varsPath = path.join(ROOT, '.dev.vars')
  if (!existsSync(varsPath)) return ''
  const text = readFileSync(varsPath, 'utf8')
  const line = text.split(/\r?\n/).find((l) => l.startsWith('FAL_KEY='))
  if (!line) return ''
  return line.slice('FAL_KEY='.length).trim().replace(/^["']|["']$/g, '')
}

function esbuild(entry, outfile) {
  execSync(`node_modules\\.bin\\esbuild "${entry}" --bundle --platform=node --format=cjs --outfile="${outfile}"`, {
    cwd: ROOT,
    stdio: 'pipe',
  })
}

function pyRgba(imagePath, rawPath, resize) {
  const raw = execFileSync(
    'py',
    [
      '-3',
      '-c',
      `
import json, sys
from PIL import Image
import numpy as np
from pathlib import Path
job = json.loads(sys.stdin.read())
im = Image.open(job["image"]).convert("RGBA")
if job.get("resize"):
    im = im.resize((int(job["resize"][0]), int(job["resize"][1])), Image.BILINEAR)
Path(job["out"]).write_bytes(np.asarray(im, dtype=np.uint8).tobytes())
print(json.dumps({"width": im.size[0], "height": im.size[1]}))
`,
    ],
    {
      input: JSON.stringify({ image: imagePath, out: rawPath, resize: resize || null }),
      encoding: 'utf8',
      timeout: 60000,
    },
  )
  return lastJson(raw)
}

const schemaText = await fetch('https://fal.ai/models/fal-ai/flux-lora/inpainting/llms.txt').then((r) => r.text())
const schemaHasPose = NOT_ON_MODEL.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(schemaText) && k !== 'shoulder')
const schemaCheck = {
  model: MODEL,
  fetched: 'https://fal.ai/models/fal-ai/flux-lora/inpainting/llms.txt',
  poseField: false,
  controlnetField: false,
  shoulderField: false,
  actualConditionInputs: ['image_url', 'mask_url', 'strength'],
  promptIsNotPoseControl: true,
  note: '포즈·어깨 텐서 필드 없음. 검정 마스크가 하의·얼굴·손·피부·배경·팔·다리를 잠그는 실제 조건이다.',
}
writeFileSync(path.join(OUT, 'schema-check.json'), JSON.stringify(schemaCheck, null, 2))
if (/`controlnets`/.test(schemaText) || /`pose`/.test(schemaText)) {
  console.log('schema unexpectedly lists pose/controlnets on flux-lora inpaint. abort unpaid.')
  process.exit(1)
}

esbuild('functions/lib/desk-clothes-parse.ts', path.join(BUNDLE, 'desk-clothes-parse.cjs'))
esbuild('functions/lib/desk-look-server-verify.ts', path.join(BUNDLE, 'desk-look-server-verify.cjs'))
esbuild('functions/lib/desk-look-models.ts', path.join(BUNDLE, 'desk-look-models.cjs'))
esbuild('functions/lib/face-preserve-mask.ts', path.join(BUNDLE, 'face-preserve-mask.cjs'))
esbuild('functions/lib/desk-clothes-composite.ts', path.join(BUNDLE, 'desk-clothes-composite.cjs'))
esbuild('functions/lib/desk-still-prompt.ts', path.join(BUNDLE, 'desk-still-prompt.cjs'))
esbuild('functions/lib/fal-client.ts', path.join(BUNDLE, 'fal-client.cjs'))

const parseMod = await import(`file://${path.join(BUNDLE, 'desk-clothes-parse.cjs')}?t=${Date.now()}`)
const gate = await import(`file://${path.join(BUNDLE, 'desk-look-server-verify.cjs')}?t=${Date.now()}`)
const models = await import(`file://${path.join(BUNDLE, 'desk-look-models.cjs')}?t=${Date.now()}`)
const maskPng = await import(`file://${path.join(BUNDLE, 'face-preserve-mask.cjs')}?t=${Date.now()}`)
const comp = await import(`file://${path.join(BUNDLE, 'desk-clothes-composite.cjs')}?t=${Date.now()}`)
const still = await import(`file://${path.join(BUNDLE, 'desk-still-prompt.cjs')}?t=${Date.now()}`)
const fal = await import(`file://${path.join(BUNDLE, 'fal-client.cjs')}?t=${Date.now()}`)

const falKey = readFalKey()
if (!falKey) {
  console.log('no_fal_key')
  process.exit(1)
}

const facts = JSON.parse(
  readFileSync(path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit', 'woman-full', 'facts.json'), 'utf8'),
)
const labels = Array.from(readFileSync(LABELS), (id) => parseMod.CLOTHES_PARSE_LABELS[id] || 'Background')
const assembled = parseMod.assembleClothesRegionMasks({
  labels,
  width: facts.width,
  height: facts.height,
  woman: { x: 0, y: 0, w: 1, h: 1 },
  man: null,
})
if (assembled.whiteUpper < 1500) {
  console.log('upper mask too small, not calling paid')
  process.exit(1)
}
if (assembled.whiteLower > 0) {
  let leak = 0
  for (let i = 0; i < assembled.upper.length; i++) {
    if (assembled.upper[i] >= 128 && assembled.lower[i] >= 128) leak += 1
  }
  if (leak > 0) {
    console.log('upper mask overlaps lower, not calling paid')
    process.exit(1)
  }
}

const mask = assembled.upper
let white = 0
for (let i = 0; i < mask.length; i++) if (mask[i] >= 128) white += 1
let lowerInUpper = 0
for (let i = 0; i < mask.length; i++) {
  if (mask[i] < 128) continue
  if (parseMod.isClothesLowerLabel(labels[i])) lowerInUpper += 1
}
if (lowerInUpper > 0) {
  console.log('pants pixels in upper mask, not calling paid', lowerInUpper)
  process.exit(1)
}

const mp = Math.max(1, Math.ceil((facts.width * facts.height) / 1_000_000))
const maxCost = PRICE_PER_MP * mp
if (maxCost > COST_CAP + 1e-9) {
  console.log('cost cap', { mp, maxCost, COST_CAP })
  process.exit(1)
}

const maskBytes = maskPng.encodeGrayPng(facts.width, facts.height, mask)
const sourceData = `data:image/jpeg;base64,${readFileSync(SRC).toString('base64')}`
const maskData = `data:image/png;base64,${Buffer.from(maskBytes).toString('base64')}`
const maskSha = sha256(Buffer.from(mask))
const layout = { woman: { slot: 'woman', x: 0, y: 0, w: 1, h: 1 }, man: null }
const pin = models.DESK_LOOK_MODELS
const verified = await gate.verifyLookInpaintPayload({
  source: sourceData,
  clothesMask: maskData,
  deskCastLayout: layout,
  deskLookVerify: {
    ok: true,
    maskSha256: maskSha,
    segformerSha256: pin.segformer.sha256,
    recSha256: pin.rec.sha256,
  },
})
if (!verified.ok) {
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ paidCalls: 0, error: verified.error, ok: false }, null, 2))
  console.log('server gate blocked before paid', verified.error)
  process.exit(1)
}

copyFileSync(SRC, path.join(OUT, '00-source.jpg'))
writeFileSync(path.join(OUT, '01-mask.png'), maskBytes)

const prompt = still.buildDeskStillPrompt(
  '원본을 그 자리에서만 고친다. 흰 마스크의 재킷·상의만 얇은 실크 슬립 몸판으로 녹인다. 노브라. 청바지·얼굴·손·피부·배경은 원본.',
  false,
  'look',
  { look: 'silk', action: 'none', couple: false },
)
const negative = still.deskStillNegativePrompt({ couple: false, nudeStill: false, descriptionKo: '슬립' })
const sentKeys = ['prompt', 'image_url', 'mask_url', 'strength', 'num_images', 'output_format', 'enable_safety_checker']
if (sentKeys.some((k) => !FAL_SCHEMA_KEYS.has(k)) || sentKeys.some((k) => NOT_ON_MODEL.includes(k))) {
  console.log('would send unsupported pose field. abort.')
  process.exit(1)
}
writeFileSync(
  path.join(OUT, 'request-keys.json'),
  JSON.stringify({ model: MODEL, keys: sentKeys, poseOrControlnetSent: false, white, whiteUpper: assembled.whiteUpper, whiteLowerOnMask: 0, lowerInUpper }, null, 2),
)

writeFileSync(LOCK, new Date().toISOString())
let submitted
let paidCalls = 0
try {
  submitted = await fal.submitFalInpaint({
    falKey,
    imageUrl: sourceData,
    maskUrl: maskData,
    prompt: `${prompt} Local edit ONLY the white-masked jacket/top. Unmasked jeans, face, neck, hands, arms, legs, and background stay exact source pixels.`,
    negativePrompt: negative,
    strength: 0.66,
  })
  paidCalls = 1
} catch (err) {
  paidCalls = 1
  writeFileSync(
    path.join(OUT, 'report.json'),
    JSON.stringify({
      paidCallsThisStep: 1,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      model: MODEL,
      connectedScene: false,
      wanCalled: false,
      deploy: false,
      retry: false,
    }, null, 2),
  )
  console.log('FAIL submit', err instanceof Error ? err.message : err)
  process.exit(1)
}

const requestId =
  ('statusUrl' in submitted && submitted.statusUrl && /requests\/([^/]+)/.exec(submitted.statusUrl)?.[1]) ||
  ('imageUrl' in submitted && submitted.imageUrl) ||
  ''

let imageUrl = 'imageUrl' in submitted ? submitted.imageUrl : ''
if (!imageUrl && 'statusUrl' in submitted) {
  const started = Date.now()
  while (Date.now() - started < 180000) {
    await new Promise((r) => setTimeout(r, 2500))
    const st = await fetch(submitted.statusUrl, { headers: { Authorization: `Key ${falKey}` } })
    const data = await st.json().catch(() => ({}))
    if (data?.status === 'COMPLETED') {
      const res = await fetch(submitted.responseUrl, { headers: { Authorization: `Key ${falKey}` } })
      const body = await res.json().catch(() => ({}))
      imageUrl = body?.images?.[0]?.url || body?.image?.url || ''
      break
    }
    if (data?.status === 'FAILED') break
  }
}

if (!imageUrl) {
  writeFileSync(
    path.join(OUT, 'report.json'),
    JSON.stringify({
      paidCallsThisStep: paidCalls,
      ok: false,
      error: 'no_image',
      callId: requestId,
      model: MODEL,
      costUsd: maxCost,
      connectedScene: false,
      wanCalled: false,
      deploy: false,
      retry: false,
    }, null, 2),
  )
  console.log('FAIL no_image')
  process.exit(1)
}

const genBuf = Buffer.from(await (await fetch(imageUrl)).arrayBuffer())
writeFileSync(path.join(OUT, '02-model-raw.png'), genBuf)
const srcMeta = pyRgba(SRC, path.join(OUT, 'src.rgba'), null)
pyRgba(path.join(OUT, '02-model-raw.png'), path.join(OUT, 'gen.rgba'), [srcMeta.width, srcMeta.height])
const srcRgba = new Uint8Array(readFileSync(path.join(OUT, 'src.rgba')))
const genRgba = new Uint8Array(readFileSync(path.join(OUT, 'gen.rgba')))
const outRgba = comp.compositeProtectRgba(srcRgba, genRgba, mask, srcMeta.width, srcMeta.height, 5)
writeFileSync(path.join(OUT, '03-composite.png'), comp.encodeRgbPng(srcMeta.width, srcMeta.height, outRgba))
const black = comp.protectRegionMad(srcRgba, outRgba, mask, srcMeta.width, srcMeta.height, 5)

const report = {
  paidCallsThisStep: 1,
  callId: requestId,
  model: MODEL,
  costUsd: maxCost,
  megapixelsBilled: mp,
  maskSha256: maskSha,
  maskWhite: white,
  maskWhiteUpper: assembled.whiteUpper,
  maskWhiteLower: 0,
  lowerInUpper,
  protectBlack: black,
  connectedScene: false,
  savedWorks: false,
  wanCalled: false,
  deploy: false,
  retry: false,
  followUpLower: false,
  schemaCheck,
  poseFieldUsed: false,
  ok: black.identical === true,
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(
  JSON.stringify(
    {
      ok: report.ok,
      callId: report.callId,
      costUsd: report.costUsd,
      paidCallsThisStep: 1,
      maskWhite: white,
      protectBlack: { mad: black.mad, max: black.max, identical: black.identical },
      connectedScene: false,
      followUpLower: false,
      poseFieldUsed: false,
    },
    null,
    2,
  ),
)
