#!/usr/bin/env node
/**
 * 승인: Leffa dresses 1회. 슬립 참고장 + 여성 전신. 재시도·Wan·배포 없음.
 */
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-paid-leffa-slip')
const LOCK = path.join(OUT, 'paid-once.lock')
const SRC = path.join(ROOT, 'tmp-faceswap-test', 'try-stand', '1-stand.jpg')
const GARMENT_SRC = path.join(
  process.env.USERPROFILE || '',
  '.cursor',
  'projects',
  'c-Users-UserK-Desktop-PLATFORM-fashion-magazine',
  'assets',
  'slip-ref-hidden.png',
)
const LABELS = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire', 'woman-full-labels.u8')
const BUNDLE = path.join(ROOT, '_tmp_bundle')
const MODEL = 'fal-ai/leffa/virtual-tryon'
const COST_USD = 0.1

mkdirSync(OUT, { recursive: true })
mkdirSync(BUNDLE, { recursive: true })

if (existsSync(LOCK)) {
  console.log('LOCK already spent. no second paid call.')
  process.exit(1)
}
if (!existsSync(GARMENT_SRC) || !existsSync(SRC) || !existsSync(LABELS)) {
  console.log('missing source, garment, or labels')
  process.exit(1)
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

esbuild('functions/lib/desk-clothes-parse.ts', path.join(BUNDLE, 'desk-clothes-parse.cjs'))
esbuild('functions/lib/face-preserve-mask.ts', path.join(BUNDLE, 'face-preserve-mask.cjs'))
esbuild('functions/lib/desk-clothes-composite.ts', path.join(BUNDLE, 'desk-clothes-composite.cjs'))
esbuild('functions/lib/fal-client.ts', path.join(BUNDLE, 'fal-client.cjs'))

const parseMod = await import(`file://${path.join(BUNDLE, 'desk-clothes-parse.cjs')}?t=${Date.now()}`)
const maskPng = await import(`file://${path.join(BUNDLE, 'face-preserve-mask.cjs')}?t=${Date.now()}`)
const comp = await import(`file://${path.join(BUNDLE, 'desk-clothes-composite.cjs')}?t=${Date.now()}`)
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
if (assembled.white < 1500) {
  console.log('clothes mask too small, not calling paid')
  process.exit(1)
}

copyFileSync(SRC, path.join(OUT, '00-source.jpg'))
copyFileSync(GARMENT_SRC, path.join(OUT, '01-garment.png'))
writeFileSync(path.join(OUT, '01-protect-mask.png'), maskPng.encodeGrayPng(facts.width, facts.height, assembled.mask))

const humanData = `data:image/jpeg;base64,${readFileSync(SRC).toString('base64')}`
const garmentData = `data:image/png;base64,${readFileSync(GARMENT_SRC).toString('base64')}`
const humanUrl = await fal.uploadDataUrlToFal(falKey, humanData, `leffa-human-${Date.now()}.jpg`, {
  maxBytes: 8_000_000,
})
const garmentUrl = await fal.uploadDataUrlToFal(falKey, garmentData, `leffa-slip-${Date.now()}.png`, {
  maxBytes: 8_000_000,
})

const requestBody = {
  human_image_url: humanUrl,
  garment_image_url: garmentUrl,
  garment_type: 'dresses',
  output_format: 'png',
  enable_safety_checker: false,
}
writeFileSync(
  path.join(OUT, 'request.json'),
  JSON.stringify({ model: MODEL, garment_type: 'dresses', costUsd: COST_USD, keys: Object.keys(requestBody) }, null, 2),
)

writeFileSync(LOCK, new Date().toISOString())
let paidCalls = 0
let requestId = ''
let imageUrl = ''
try {
  const submit = await fetch(`https://queue.fal.run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })
  const submitted = await submit.json().catch(() => ({}))
  paidCalls = 1
  requestId = submitted.request_id || ''
  if (!submit.ok) throw new Error(JSON.stringify(submitted).slice(0, 400))
  if (submitted.image?.url) imageUrl = submitted.image.url
  else if (submitted.images?.[0]?.url) imageUrl = submitted.images[0].url
  else if (submitted.status_url && submitted.response_url) {
    const started = Date.now()
    while (Date.now() - started < 180000) {
      await new Promise((r) => setTimeout(r, 2500))
      const st = await fetch(submitted.status_url, { headers: { Authorization: `Key ${falKey}` } })
      const data = await st.json().catch(() => ({}))
      if (data?.status === 'COMPLETED') {
        const res = await fetch(submitted.response_url, { headers: { Authorization: `Key ${falKey}` } })
        const body = await res.json().catch(() => ({}))
        imageUrl = body?.image?.url || body?.images?.[0]?.url || ''
        break
      }
      if (data?.status === 'FAILED') throw new Error(JSON.stringify(data).slice(0, 400))
    }
  }
} catch (err) {
  writeFileSync(
    path.join(OUT, 'report.json'),
    JSON.stringify({
      paidCallsThisStep: paidCalls,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      model: MODEL,
      costUsd: COST_USD,
      connectedScene: false,
      wanCalled: false,
      deploy: false,
      retry: false,
    }, null, 2),
  )
  console.log('FAIL', err instanceof Error ? err.message : err)
  process.exit(1)
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
      costUsd: COST_USD,
      connectedScene: false,
      wanCalled: false,
      deploy: false,
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
const outRgba = comp.compositeProtectRgba(srcRgba, genRgba, assembled.mask, srcMeta.width, srcMeta.height, 5)
writeFileSync(path.join(OUT, '03-composite.png'), comp.encodeRgbPng(srcMeta.width, srcMeta.height, outRgba))
const black = comp.protectRegionMad(srcRgba, outRgba, assembled.mask, srcMeta.width, srcMeta.height, 5)

const report = {
  paidCallsThisStep: 1,
  callId: requestId,
  model: MODEL,
  garment_type: 'dresses',
  costUsd: COST_USD,
  maskWhite: assembled.white,
  protectBlack: black,
  connectedScene: false,
  savedWorks: false,
  wanCalled: false,
  deploy: false,
  retry: false,
  lookKind: 'clothes_replace_slip',
  nudeNotCovered: true,
  ok: black.identical === true,
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(
  JSON.stringify(
    {
      ok: report.ok,
      callId: requestId,
      costUsd: COST_USD,
      paidCallsThisStep: 1,
      garment_type: 'dresses',
      protectBlack: { mad: black.mad, max: black.max, identical: black.identical },
      connectedScene: false,
    },
    null,
    2,
  ),
)
