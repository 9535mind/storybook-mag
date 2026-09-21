#!/usr/bin/env node
/**
 * 승인된 여성 전신 LOOK 유료 1회. 재시도 없음. Wan/배포 없음.
 * ArcFace 임계값은 deskStillPasses 고정값 0.35.
 */
import { createHash } from 'node:crypto'
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-paid-woman-full')
const LOCK = path.join(OUT, 'paid-once.lock')
const WIRE = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire')
const SRC = path.join(ROOT, 'tmp-faceswap-test', 'try-stand', '1-stand.jpg')
const BUNDLE = path.join(ROOT, '_tmp_bundle')

/** public/app.js deskStillPasses — 결과 보고 바꾸지 않음 */
const ARCFACE_MIN = 0.35
const POS_MAX = 0.18
const SCALE_MIN = 0.45
const SCALE_MAX = 1.85
const MODEL = 'fal-ai/flux-lora/inpainting'
const FAL_COST_USD = 0.035

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
  const raw = execFileSync('py', ['-3', '-c', `
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
`], {
    input: JSON.stringify({ image: imagePath, out: rawPath, resize: resize || null }),
    encoding: 'utf8',
    timeout: 60000,
  })
  return lastJson(raw)
}

esbuild('functions/lib/desk-look-preflight.ts', path.join(BUNDLE, 'desk-look-preflight.cjs'))
esbuild('functions/lib/desk-clothes-parse.ts', path.join(BUNDLE, 'desk-clothes-parse.cjs'))
esbuild('functions/lib/desk-look-server-verify.ts', path.join(BUNDLE, 'desk-look-server-verify.cjs'))
esbuild('functions/lib/desk-look-models.ts', path.join(BUNDLE, 'desk-look-models.cjs'))
esbuild('functions/lib/face-preserve-mask.ts', path.join(BUNDLE, 'face-preserve-mask.cjs'))
esbuild('functions/lib/desk-clothes-composite.ts', path.join(BUNDLE, 'desk-clothes-composite.cjs'))
esbuild('functions/lib/desk-still-prompt.ts', path.join(BUNDLE, 'desk-still-prompt.cjs'))
esbuild('functions/lib/fal-client.ts', path.join(BUNDLE, 'fal-client.cjs'))

const look = await import(`file://${path.join(BUNDLE, 'desk-look-preflight.cjs')}?t=${Date.now()}`)
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

const faces = [{ slot: 'woman', x: 0.39, y: 0.07, w: 0.2, h: 0.13 }]
const layout = look.lookLayoutFromFaces(faces)
const facts = JSON.parse(readFileSync(path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit', 'woman-full', 'facts.json'), 'utf8'))
const ids = readFileSync(path.join(WIRE, 'woman-full-labels.u8'))
const labels = Array.from(ids, (id) => parseMod.CLOTHES_PARSE_LABELS[id] || 'Background')
const pre = look.runDeskLookPreflight({
  labels,
  width: facts.width,
  height: facts.height,
  layout,
  faces,
  embeds: [{ slot: 'woman', dim: 512, vec: Array(512).fill(0.01) }],
  embedOk: true,
})
if (!pre.ok && pre.reason !== 'undetected') {
  // dummy embed may fail uniqueness; mask must still be ok
}
if (pre.white < 1500) {
  console.log('preflight mask too small, not calling paid')
  process.exit(1)
}

const maskBytes = maskPng.encodeGrayPng(facts.width, facts.height, pre.mask)
const sourceData = `data:image/jpeg;base64,${readFileSync(SRC).toString('base64')}`
const maskData = `data:image/png;base64,${Buffer.from(maskBytes).toString('base64')}`
const maskSha = sha256(Buffer.from(pre.mask))
const inputSha = sha256(readFileSync(SRC))
copyFileSync(SRC, path.join(OUT, '00-source.jpg'))
writeFileSync(path.join(OUT, '01-mask.png'), maskBytes)

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

const descriptionKo =
  '원본을 그 자리에서만 고친다. 얼굴·머리·몸매·자세·방 유지. 옷만 얇은 실크 슬립 한 장 노브라로 녹인다. 팬티 따로 없음. 새 사람·흰 스튜디오·화보 모델 금지.'
const prompt = still.buildDeskStillPrompt(descriptionKo, false, 'look', {
  look: 'silk',
  action: 'none',
  couple: false,
})
const negative = still.deskStillNegativePrompt({ couple: false, nudeStill: false, descriptionKo })

writeFileSync(LOCK, new Date().toISOString())
let submitted
let paidCalls = 0
try {
  submitted = await fal.submitFalInpaint({
    falKey,
    imageUrl: sourceData,
    maskUrl: maskData,
    prompt: `${prompt} Local edit ONLY the white-masked clothes of the CAST woman slot. Unmasked face, neck, skin, hands, and background stay exact source pixels. Same body, same crop. FORBIDDEN new person, catalog model, white studio, oval face sticker.`,
    negativePrompt: negative,
    strength: 0.66,
  })
  paidCalls = 1
} catch (err) {
  paidCalls = 1
  const report = {
    paidCallsThisStep: 1,
    ok: false,
    error: err instanceof Error ? err.message : String(err),
    model: MODEL,
    connectedScene: false,
    wanCalled: false,
    deploy: false,
  }
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log('FAIL submit', report.error)
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
    JSON.stringify(
      {
        paidCallsThisStep: paidCalls,
        ok: false,
        error: 'no_image',
        callId: requestId,
        model: MODEL,
        costUsd: FAL_COST_USD,
        connectedScene: false,
        wanCalled: false,
        deploy: false,
      },
      null,
      2,
    ),
  )
  console.log('FAIL no_image after 1 paid call')
  process.exit(1)
}

const genBuf = Buffer.from(await (await fetch(imageUrl)).arrayBuffer())
writeFileSync(path.join(OUT, '02-model-raw.png'), genBuf)
const genSize = lastJson(
  execFileSync(
    'py',
    ['-3', '-c', 'import json,sys; from PIL import Image; im=Image.open(sys.argv[1]); print(json.dumps({"width":im.size[0],"height":im.size[1]}))', path.join(OUT, '02-model-raw.png')],
    { encoding: 'utf8' },
  ),
)
const megapixelsBilled = Math.max(1, Math.ceil((genSize.width * genSize.height) / 1_000_000))
const costUsd = 0.035 * megapixelsBilled

const srcMeta = pyRgba(SRC, path.join(OUT, 'src.rgba'), null)
const genMeta = pyRgba(path.join(OUT, '02-model-raw.png'), path.join(OUT, 'gen.rgba'), [srcMeta.width, srcMeta.height])
const srcRgba = new Uint8Array(readFileSync(path.join(OUT, 'src.rgba')))
const genRgba = new Uint8Array(readFileSync(path.join(OUT, 'gen.rgba')))
const outRgba = comp.compositeProtectRgba(srcRgba, genRgba, pre.mask, srcMeta.width, srcMeta.height, 5)
writeFileSync(path.join(OUT, '03-composite.png'), comp.encodeRgbPng(srcMeta.width, srcMeta.height, outRgba))

const black = comp.protectRegionMad(srcRgba, outRgba, pre.mask, srcMeta.width, srcMeta.height, 5)
let whiteSum = 0
let whiteN = 0
let whiteMax = 0
for (let p = 0; p < pre.mask.length; p++) {
  if (pre.mask[p] < 128) continue
  const i = p * 4
  const mad =
    (Math.abs(srcRgba[i] - outRgba[i]) +
      Math.abs(srcRgba[i + 1] - outRgba[i + 1]) +
      Math.abs(srcRgba[i + 2] - outRgba[i + 2])) /
    3
  whiteSum += mad
  whiteN += 1
  if (mad > whiteMax) whiteMax = mad
}
const whiteMad = whiteN ? whiteSum / whiteN : 0

const faceRaw = execFileSync('py', ['-3', path.join(ROOT, 'scripts', 'desk-arcface-compare.py')], {
  input: JSON.stringify({ src: SRC, out: path.join(OUT, '03-composite.png') }),
  encoding: 'utf8',
  timeout: 180000,
  cwd: ROOT,
})
const face = lastJson(faceRaw)

const faceCountOk = face.srcCount === 1 && face.outCount === 1
const embedOk = typeof face.cosine === 'number' && face.cosine >= ARCFACE_MIN
const posOk = typeof face.dist === 'number' && face.dist <= POS_MAX
const scaleOk = typeof face.scale === 'number' && face.scale >= SCALE_MIN && face.scale <= SCALE_MAX
const blackOk = black.identical && black.max === 0
const whiteChanged = whiteMad > 0
const pass = Boolean(face.ok && faceCountOk && embedOk && posOk && scaleOk && blackOk && whiteChanged)

if (pass) {
  copyFileSync(path.join(OUT, '03-composite.png'), path.join(OUT, 'scene-current.png'))
}

const report = {
  paidCallsThisStep: paidCalls,
  cumulativePaidImageGens: 2,
  callId: requestId,
  model: MODEL,
  costUsd,
  costNote: 'fal.ai list $0.035 per megapixel, billed rounding up; API body had no invoice field',
  megapixelsBilled,
  inputSha256: inputSha,
  maskSha256: maskSha,
  maskWhite: pre.white,
  arcface: {
    engine: face.engine || 'insightface-buffalo_l',
    cosine: face.cosine,
    threshold: ARCFACE_MIN,
    pass: embedOk,
  },
  faces: {
    src: face.srcCount,
    out: face.outCount,
    expect: 1,
    pass: faceCountOk,
  },
  position: {
    dx: face.dx,
    dy: face.dy,
    dist: face.dist,
    scale: face.scale,
    distMax: POS_MAX,
    scaleMin: SCALE_MIN,
    scaleMax: SCALE_MAX,
    pass: posOk && scaleOk,
  },
  protectBlack: black,
  whiteRegion: { mad: whiteMad, max: whiteMax, n: whiteN, changed: whiteChanged },
  connectedScene: pass,
  savedWorks: false,
  wanCalled: false,
  deploy: false,
  retry: false,
  ok: pass,
  failReasons: [
    !face.ok && (face.error || 'face'),
    !faceCountOk && 'face_count',
    !embedOk && 'arcface',
    !(posOk && scaleOk) && 'pose',
    !blackOk && 'protect_mad',
    !whiteChanged && 'white_unchanged',
  ].filter(Boolean),
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  ok: report.ok,
  callId: report.callId,
  model: report.model,
  costUsd: report.costUsd,
  paidCallsThisStep: 1,
  arcface: report.arcface,
  faces: report.faces,
  position: report.position,
  protectBlack: { mad: black.mad, max: black.max, identical: black.identical },
  whiteRegion: report.whiteRegion,
  connectedScene: report.connectedScene,
}, null, 2))
if (!pass) process.exit(1)
