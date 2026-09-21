#!/usr/bin/env node
/**
 * 승인: 옷 사진을 받는 VTON 엔진 3종 비교 1회. 같은 원본·같은 슬립 사진·같은 마스크.
 * FASHN v1.6 / Leffa dresses / image-apps-v2. 재시도·Wan·배포 없음.
 */
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-vton-bakeoff')
const LOCK = path.join(OUT, 'paid-once.lock')
const SRC = path.join(ROOT, 'tmp-faceswap-test', 'try-stand', '1-stand.jpg')
const GARMENT = path.join(ROOT, 'public', 'desk-look-garment-slip.png')
const LABELS = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire', 'woman-full-labels.u8')
const FACTS = path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit', 'woman-full', 'facts.json')
const BUNDLE = path.join(ROOT, '_tmp_bundle')

const ENGINES = [
  {
    id: 'fashn16',
    label: 'FASHN v1.6',
    model: 'fal-ai/fashn/tryon/v1.6',
    costUsd: 0.075,
    body: (human, garment) => ({
      model_image: human,
      garment_image: garment,
      category: 'one-pieces',
      mode: 'quality',
      garment_photo_type: 'flat-lay',
      moderation_level: 'permissive',
      num_samples: 1,
      segmentation_free: true,
      output_format: 'png',
    }),
  },
  {
    id: 'leffa',
    label: 'Leffa dresses',
    model: 'fal-ai/leffa/virtual-tryon',
    costUsd: 0.1,
    body: (human, garment) => ({
      human_image_url: human,
      garment_image_url: garment,
      garment_type: 'dresses',
      output_format: 'png',
      enable_safety_checker: false,
    }),
  },
  {
    id: 'imageapps',
    label: 'image-apps-v2',
    model: 'fal-ai/image-apps-v2/virtual-try-on',
    costUsd: 0.04,
    body: (human, garment) => ({
      person_image_url: human,
      clothing_image_url: garment,
      preserve_pose: true,
      aspect_ratio: { ratio: '3:4' },
    }),
  },
]

mkdirSync(OUT, { recursive: true })
mkdirSync(BUNDLE, { recursive: true })

if (existsSync(LOCK) && !process.argv.includes('--force')) {
  console.log('LOCK already spent. no second paid run.')
  process.exit(1)
}
for (const p of [SRC, GARMENT, LABELS, FACTS]) {
  if (!existsSync(p)) {
    console.log('missing input:', p)
    process.exit(1)
  }
}

function readFalKey() {
  const varsPath = path.join(ROOT, '.dev.vars')
  if (!existsSync(varsPath)) return ''
  const line = readFileSync(varsPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('FAL_KEY='))
  return line ? line.slice('FAL_KEY='.length).trim().replace(/^["']|["']$/g, '') : ''
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
    { input: JSON.stringify({ image: imagePath, out: rawPath, resize: resize || null }), encoding: 'utf8', timeout: 60000 },
  )
  return lastJson(raw)
}

esbuild('functions/lib/desk-clothes-parse.ts', path.join(BUNDLE, 'desk-clothes-parse.cjs'))
esbuild('functions/lib/face-preserve-mask.ts', path.join(BUNDLE, 'face-preserve-mask.cjs'))
esbuild('functions/lib/desk-clothes-composite.ts', path.join(BUNDLE, 'desk-clothes-composite.cjs'))
esbuild('functions/lib/desk-look-visual-gate.ts', path.join(BUNDLE, 'desk-look-visual-gate.cjs'))
esbuild('functions/lib/fal-client.ts', path.join(BUNDLE, 'fal-client.cjs'))

const stamp = Date.now()
const parseMod = await import(`file://${path.join(BUNDLE, 'desk-clothes-parse.cjs')}?t=${stamp}`)
const maskPng = await import(`file://${path.join(BUNDLE, 'face-preserve-mask.cjs')}?t=${stamp}`)
const comp = await import(`file://${path.join(BUNDLE, 'desk-clothes-composite.cjs')}?t=${stamp}`)
const visual = await import(`file://${path.join(BUNDLE, 'desk-look-visual-gate.cjs')}?t=${stamp}`)
const fal = await import(`file://${path.join(BUNDLE, 'fal-client.cjs')}?t=${stamp}`)

const falKey = readFalKey()
if (!falKey) {
  console.log('no_fal_key')
  process.exit(1)
}

const facts = JSON.parse(readFileSync(FACTS, 'utf8'))
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
copyFileSync(GARMENT, path.join(OUT, '00-garment.png'))
writeFileSync(path.join(OUT, '00-protect-mask.png'), maskPng.encodeGrayPng(facts.width, facts.height, assembled.mask))

const srcMeta = pyRgba(SRC, path.join(OUT, 'src.rgba'), null)
const srcRgba = new Uint8Array(readFileSync(path.join(OUT, 'src.rgba')))

const humanData = `data:image/jpeg;base64,${readFileSync(SRC).toString('base64')}`
const garmentData = `data:image/png;base64,${readFileSync(GARMENT).toString('base64')}`
const humanUrl = await fal.uploadDataUrlToFal(falKey, humanData, `bakeoff-human-${stamp}.jpg`, { maxBytes: 8_000_000 })
const garmentUrl = await fal.uploadDataUrlToFal(falKey, garmentData, `bakeoff-slip-${stamp}.png`, { maxBytes: 8_000_000 })

writeFileSync(LOCK, new Date().toISOString())

function pickUrl(body) {
  return body?.image?.url || body?.images?.[0]?.url || ''
}

async function runEngine(engine) {
  const requestBody = engine.body(humanUrl, garmentUrl)
  const started = Date.now()
  const submit = await fetch(`https://queue.fal.run/${engine.model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })
  const submitted = await submit.json().catch(() => ({}))
  const callId = submitted.request_id || ''
  if (!submit.ok) throw new Error(`${submit.status} ${JSON.stringify(submitted).slice(0, 300)}`)

  let imageUrl = pickUrl(submitted)
  if (!imageUrl && submitted.status_url && submitted.response_url) {
    while (Date.now() - started < 240000) {
      await new Promise((r) => setTimeout(r, 2500))
      const st = await fetch(submitted.status_url, { headers: { Authorization: `Key ${falKey}` } })
      const data = await st.json().catch(() => ({}))
      if (data?.status === 'COMPLETED') {
        const res = await fetch(submitted.response_url, { headers: { Authorization: `Key ${falKey}` } })
        imageUrl = pickUrl(await res.json().catch(() => ({})))
        break
      }
      if (data?.status === 'FAILED') throw new Error(JSON.stringify(data).slice(0, 300))
    }
  }
  if (!imageUrl) throw new Error('no_image')

  const rawPath = path.join(OUT, `${engine.id}-raw.png`)
  writeFileSync(rawPath, Buffer.from(await (await fetch(imageUrl)).arrayBuffer()))
  pyRgba(rawPath, path.join(OUT, `${engine.id}.rgba`), [srcMeta.width, srcMeta.height])
  const genRgba = new Uint8Array(readFileSync(path.join(OUT, `${engine.id}.rgba`)))
  const outRgba = comp.compositeProtectRgba(srcRgba, genRgba, assembled.mask, srcMeta.width, srcMeta.height, 5)
  writeFileSync(path.join(OUT, `${engine.id}-composite.png`), comp.encodeRgbPng(srcMeta.width, srcMeta.height, outRgba))

  const black = comp.protectRegionMad(srcRgba, outRgba, assembled.mask, srcMeta.width, srcMeta.height, 5)
  const gate = visual.gateLookVisual({
    src: srcRgba,
    out: outRgba,
    mask: assembled.mask,
    width: srcMeta.width,
    height: srcMeta.height,
    labels,
  })
  return {
    ok: true,
    callId,
    elapsedMs: Date.now() - started,
    protectIdentical: black.identical === true,
    protectMad: black.mad,
    gateOk: gate.ok,
    gateReason: gate.reason || '',
    upper: { mad: +gate.upper.mad.toFixed(2), corr: +gate.upper.corr.toFixed(2), changeOk: gate.upper.changeOk },
    lower: { mad: +gate.lower.mad.toFixed(2), corr: +gate.lower.corr.toFixed(2), changeOk: gate.lower.changeOk },
    seamOk: gate.seam.ok,
    silhouetteOk: gate.silhouette.ok,
  }
}

const results = []
let paidCalls = 0
for (const engine of ENGINES) {
  paidCalls += 1
  process.stdout.write(`\n--- ${engine.label} (${engine.model}) ...`)
  try {
    const r = await runEngine(engine)
    results.push({ id: engine.id, label: engine.label, model: engine.model, costUsd: engine.costUsd, ...r })
    process.stdout.write(` done gate=${r.gateOk ? 'PASS' : r.gateReason}\n`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    results.push({ id: engine.id, label: engine.label, model: engine.model, costUsd: engine.costUsd, ok: false, error: message })
    process.stdout.write(` FAIL ${message}\n`)
  }
}

execFileSync(
  'py',
  [
    '-3',
    '-c',
    `
import json, sys
from PIL import Image
from pathlib import Path
job = json.loads(sys.stdin.read())
tiles = [p for p in job["tiles"] if Path(p[1]).exists()]
if not tiles:
    sys.exit(0)
h = 620
ims = []
for label, p in tiles:
    im = Image.open(p).convert("RGB")
    im = im.resize((int(im.width * h / im.height), h), Image.LANCZOS)
    ims.append(im)
board = Image.new("RGB", (sum(i.width for i in ims), h), "white")
x = 0
for im in ims:
    board.paste(im, (x, 0)); x += im.width
board.save(job["out"])
print(job["out"])
`,
  ],
  {
    input: JSON.stringify({
      out: path.join(OUT, 'board.png'),
      tiles: [
        ['source', path.join(OUT, '00-source.jpg')],
        ...results.filter((r) => r.ok).map((r) => [r.label, path.join(OUT, `${r.id}-composite.png`)]),
      ],
    }),
    encoding: 'utf8',
    timeout: 120000,
  },
)

const report = {
  paidCallsThisStep: paidCalls,
  costUsd: +ENGINES.reduce((s, e) => s + e.costUsd, 0).toFixed(3),
  source: path.relative(ROOT, SRC),
  garment: path.relative(ROOT, GARMENT),
  maskWhite: assembled.white,
  connectedScene: false,
  savedWorks: false,
  wanCalled: false,
  deploy: false,
  retry: false,
  results,
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(`\n${JSON.stringify(report, null, 2)}`)
