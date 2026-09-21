#!/usr/bin/env node
/**
 * 무과금. clothes_goal 측정값·기준·마스크 정렬을 기록한다.
 * 임계값 완화 없음. Claude / fal / Wan / 배포 없음.
 */
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const LIVE = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-live-slip')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-clothes-goal-repro')
const BUNDLE = path.join(ROOT, '_tmp_bundle', 'desk-look-visual-gate.cjs')
const BASELINE = path.join(ROOT, 'scripts', 'desk-look-clothes-goal-baseline.json')
const APP = path.join(ROOT, 'public', 'app.js')

mkdirSync(OUT, { recursive: true })

const KEEP = [
  ['00-source.jpg', '00-source.jpg'],
  ['02-model-raw.png', '02-model-raw.png'],
  ['03-composite-v2.png', '03-composite-v2.png'],
  ['01-mask-v2.png', '01-mask-v2.png'],
  ['submit.json', 'submit.json'],
  ['report.json', 'report.json'],
  ['react-notes.txt', 'react-notes.txt'],
]
for (const [from, to] of KEEP) {
  const src = path.join(LIVE, from)
  if (!existsSync(src)) {
    console.log('missing preserve', from)
    process.exit(1)
  }
  copyFileSync(src, path.join(OUT, to))
}

const appSrc = readFileSync(APP, 'utf8')
if (!/function deskLookVisualPasses/.test(appSrc) || !/width: w,\s*height: h/.test(appSrc)) {
  console.log('app.js deskLookVisualPasses missing')
  process.exit(1)
}

execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-look-visual-gate.ts" --bundle --platform=node --format=cjs --outfile="${BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const visual = await import(`file://${BUNDLE}?t=${Date.now()}`)

function meta(imagePath) {
  return lastJson(
    execFileSync(
      'py',
      [
        '-3',
        '-c',
        `
import json, sys
from PIL import Image
job = json.loads(sys.stdin.read())
im = Image.open(job["image"])
print(json.dumps({"width": im.size[0], "height": im.size[1], "mode": im.mode}))
`,
      ],
      { input: JSON.stringify({ image: imagePath }), encoding: 'utf8' },
    ),
  )
}

function dump(imagePath, outPath, gray, resize, resample) {
  return lastJson(
    execFileSync(
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
im = Image.open(job["image"])
im = im.convert("L" if job.get("gray") else "RGBA")
if job.get("resize"):
    how = Image.NEAREST if job.get("resample") == "nearest" else Image.BILINEAR
    im = im.resize((int(job["resize"][0]), int(job["resize"][1])), how)
Path(job["out"]).write_bytes(np.asarray(im, dtype=np.uint8).tobytes())
print(json.dumps({"width": im.size[0], "height": im.size[1]}))
`,
      ],
      {
        input: JSON.stringify({
          image: imagePath,
          out: outPath,
          gray: Boolean(gray),
          resize: resize || null,
          resample: resample || 'bilinear',
        }),
        encoding: 'utf8',
      },
    ),
  )
}

function maskFromGray(buf) {
  const out = new Uint8Array(buf.length)
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] >= 128 ? 255 : 0
  return out
}

function invertMask(mask) {
  const out = new Uint8Array(mask.length)
  for (let i = 0; i < mask.length; i++) out[i] = mask[i] >= 128 ? 0 : 255
  return out
}

function whiteFrac(mask) {
  let n = 0
  for (let i = 0; i < mask.length; i++) if (mask[i] >= 128) n += 1
  return { n, frac: mask.length ? n / mask.length : 0 }
}

function maskInterior(src, out, mask) {
  let n = 0
  let sum = 0
  let mx = 0
  let srcLum = 0
  let outLum = 0
  const sl = []
  const ol = []
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    if (mask[p] < 128) continue
    const mad = (Math.abs(src[i] - out[i]) + Math.abs(src[i + 1] - out[i + 1]) + Math.abs(src[i + 2] - out[i + 2])) / 3
    sum += mad
    n += 1
    if (mad > mx) mx = mad
    const s = (src[i] * 3 + src[i + 1] * 4 + src[i + 2]) / 8
    const o = (out[i] * 3 + out[i + 1] * 4 + out[i + 2]) / 8
    srcLum += s
    outLum += o
    sl.push(s)
    ol.push(o)
  }
  return {
    n,
    mad: n ? sum / n : 0,
    max: mx,
    srcLum: n ? srcLum / n : 0,
    outLum: n ? outLum / n : 0,
    corr: pearson(sl, ol),
  }
}

function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length)
  if (n < 32) return 1
  let sx = 0
  let sy = 0
  for (let i = 0; i < n; i++) {
    sx += xs[i]
    sy += ys[i]
  }
  const mx = sx / n
  const my = sy / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx
    const b = ys[i] - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 1
}

const SRC = path.join(OUT, '00-source.jpg')
const RAW = path.join(OUT, '02-model-raw.png')
const COMP = path.join(OUT, '03-composite-v2.png')
const MASK = path.join(OUT, '01-mask-v2.png')

const srcMeta = meta(SRC)
const rawMeta = meta(RAW)
const compMeta = meta(COMP)
const maskMeta = meta(MASK)

const W = 192
const H = 256
dump(SRC, path.join(OUT, 'client-src.rgba'), false, [W, H], 'bilinear')
dump(COMP, path.join(OUT, 'client-out.rgba'), false, [W, H], 'bilinear')
dump(RAW, path.join(OUT, 'client-raw.rgba'), false, [W, H], 'bilinear')
dump(MASK, path.join(OUT, 'client-mask.gray'), true, [W, H], 'bilinear')
dump(SRC, path.join(OUT, 'full-src.rgba'), false, [srcMeta.width, srcMeta.height], 'bilinear')
dump(COMP, path.join(OUT, 'full-out.rgba'), false, [srcMeta.width, srcMeta.height], 'bilinear')
dump(MASK, path.join(OUT, 'full-mask.gray'), true, [srcMeta.width, srcMeta.height], 'nearest')

const clientSrc = new Uint8Array(readFileSync(path.join(OUT, 'client-src.rgba')))
const clientOut = new Uint8Array(readFileSync(path.join(OUT, 'client-out.rgba')))
const clientRaw = new Uint8Array(readFileSync(path.join(OUT, 'client-raw.rgba')))
const clientMask = maskFromGray(readFileSync(path.join(OUT, 'client-mask.gray')))
const fullSrc = new Uint8Array(readFileSync(path.join(OUT, 'full-src.rgba')))
const fullOut = new Uint8Array(readFileSync(path.join(OUT, 'full-out.rgba')))
const fullMask = maskFromGray(readFileSync(path.join(OUT, 'full-mask.gray')))

const thresholds = {
  WHITE_MAD_MIN: visual.WHITE_MAD_MIN,
  WHITE_CORR_MAX: visual.WHITE_CORR_MAX,
  MASK_MIN_WHITE: visual.MASK_MIN_WHITE ?? 1500,
  BODY_CRUSH_RATIO: visual.BODY_CRUSH_RATIO,
  client: { width: W, height: H, resample: 'bilinear', maskThreshold: 128 },
}
const failWhen = {
  clothes_goal:
    'region.n >= MASK_MIN_WHITE && !(mad >= WHITE_MAD_MIN && corr <= WHITE_CORR_MAX)',
  silhouette: 'rows>=8 && (outWidth+0.5 < bodyRef*BODY_CRUSH_RATIO || outWidth > clothingWidth*1.22)',
  mask_seam: 'n>=24 && (lumRel > 1.05 || texRatio < 0.42)',
}

function packGate(label, src, out, mask, width, height) {
  const gate = visual.gateLookVisual({ src, out, mask, width, height })
  const interior = maskInterior(src, out, mask)
  return {
    label,
    width,
    height,
    maskWhite: whiteFrac(mask),
    interior,
    eyeChangedInMask: interior.n >= thresholds.MASK_MIN_WHITE && interior.mad >= thresholds.WHITE_MAD_MIN,
    gate: {
      ok: gate.ok,
      reason: gate.reason,
      failReasons: gate.failReasons,
      upper: {
        present: gate.upper.present,
        n: gate.upper.n,
        mad: gate.upper.mad,
        corr: gate.upper.corr,
        changeOk: gate.upper.changeOk,
        failReasons: gate.upper.failReasons,
      },
      lower: {
        present: gate.lower.present,
        n: gate.lower.n,
        mad: gate.lower.mad,
        corr: gate.lower.corr,
        changeOk: gate.lower.changeOk,
        failReasons: gate.lower.failReasons,
      },
    },
  }
}

const client = packGate('client192-composite', clientSrc, clientOut, clientMask, W, H)
const clientRawGate = packGate('client192-leffa-raw', clientSrc, clientRaw, clientMask, W, H)
const full = packGate('fullres-nearest-mask', fullSrc, fullOut, fullMask, srcMeta.width, srcMeta.height)
const swapped = packGate('client192-swapped-src-out', clientOut, clientSrc, clientMask, W, H)
const inverted = packGate('client192-inverted-mask', clientSrc, clientOut, invertMask(clientMask), W, H)

const sameAspect =
  Math.abs(srcMeta.width / srcMeta.height - maskMeta.width / maskMeta.height) < 0.02 &&
  Math.abs(srcMeta.width / srcMeta.height - compMeta.width / compMeta.height) < 0.02
const polarityLooksEditWhite = client.maskWhite.frac > 0.04 && client.maskWhite.frac < 0.55
const orderNotInverted = client.interior.mad > 0 && Math.abs(client.interior.mad - swapped.interior.mad) < 0.001
const jacketToSlipLighter = full.interior.outLum - full.interior.srcLum > 12

let class_ = 'unknown'
if (full.eyeChangedInMask && client.gate.failReasons.includes('clothes_goal')) class_ = 'measurement_false_positive'
else if (!full.eyeChangedInMask && client.gate.failReasons.includes('clothes_goal')) class_ = 'true_no_change'
else if (full.eyeChangedInMask && !client.gate.failReasons.includes('clothes_goal')) class_ = 'change_detected'
else if (client.gate.reason === 'silhouette') class_ = 'changed_but_silhouette'
else class_ = client.gate.ok ? 'gate_pass' : `gate_${client.gate.reason || 'fail'}`

const report = {
  newPaidCall: false,
  wanCalled: false,
  claudeFaceBoxCalled: false,
  thresholdChanged: false,
  latestInpaintRunOnDisk: false,
  preserved: KEEP.map(([, to]) => to),
  files: {
    source: '00-source.jpg',
    leffaRaw: '02-model-raw.png',
    composite: '03-composite-v2.png',
    mask: '01-mask-v2.png',
  },
  alignment: {
    source: srcMeta,
    leffaRaw: rawMeta,
    composite: compMeta,
    mask: maskMeta,
    sameAspect,
    polarityLooksEditWhite,
    srcOutSwapMadEqual: orderNotInverted,
    maskWhiteClient: client.maskWhite,
    maskWhiteFull: full.maskWhite,
  },
  thresholds,
  failWhen,
  client192: client,
  leffaRaw192: clientRawGate,
  fullres: full,
  controls: { swapped, inverted },
  jacketToSlipLighter,
  class: class_,
  ok: sameAspect && polarityLooksEditWhite && full.eyeChangedInMask && jacketToSlipLighter,
}

writeFileSync(path.join(OUT, 'clothes-goal-measure.json'), JSON.stringify(report, null, 2))
writeFileSync(
  BASELINE,
  JSON.stringify(
    {
      criterion: '03-composite-v2.png',
      class: report.class,
      fullMad: Number(full.interior.mad.toFixed(3)),
      clientReason: client.gate.reason,
      clientClothesGoal: client.gate.failReasons.includes('clothes_goal'),
      thresholdChanged: false,
      ok: report.ok,
    },
    null,
    2,
  ),
)
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
