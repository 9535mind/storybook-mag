#!/usr/bin/env node
/**
 * 저장된 유료 1회 결과를 visual_fail로 기록. scene 연결 취소.
 * fal / Replicate / Wan / 배포 없음.
 */
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-paid-woman-full')
const BUNDLE = path.join(ROOT, '_tmp_bundle')
const SRC = path.join(OUT, '00-source.jpg')
const MASK = path.join(OUT, '01-mask.png')
const COMP = path.join(OUT, '03-composite.png')
const SCENE = path.join(OUT, 'scene-current.png')
const LABELS = path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit', 'woman-full', 'labels.u8')

function esbuild(entry, outfile) {
  execSync(`node_modules\\.bin\\esbuild "${entry}" --bundle --platform=node --format=cjs --outfile="${outfile}"`, {
    cwd: ROOT,
    stdio: 'pipe',
  })
}

esbuild('functions/lib/desk-look-visual-gate.ts', path.join(BUNDLE, 'desk-look-visual-gate.cjs'))
esbuild('functions/lib/desk-clothes-parse.ts', path.join(BUNDLE, 'desk-clothes-parse.cjs'))
esbuild('functions/lib/desk-look-preflight.ts', path.join(BUNDLE, 'desk-look-preflight.cjs'))

const visual = await import(`file://${path.join(BUNDLE, 'desk-look-visual-gate.cjs')}?t=${Date.now()}`)
const parseMod = await import(`file://${path.join(BUNDLE, 'desk-clothes-parse.cjs')}?t=${Date.now()}`)

function dump(imagePath, rawPath, gray, resize) {
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
im = Image.open(job["image"])
if job.get("gray"):
    im = im.convert("L")
else:
    im = im.convert("RGBA")
if job.get("resize"):
    im = im.resize((int(job["resize"][0]), int(job["resize"][1])), Image.BILINEAR)
Path(job["out"]).write_bytes(np.asarray(im, dtype=np.uint8).tobytes())
print(json.dumps({"width": im.size[0], "height": im.size[1]}))
`,
    ],
    {
      input: JSON.stringify({ image: imagePath, out: rawPath, gray: Boolean(gray), resize: resize || null }),
      encoding: 'utf8',
      timeout: 60000,
    },
  )
  return lastJson(raw)
}

function maskFromGray(buf) {
  const out = new Uint8Array(buf.length)
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] >= 128 ? 255 : 0
  return out
}

if (!existsSync(SRC) || !existsSync(MASK) || !existsSync(COMP)) {
  throw new Error('missing paid artifacts')
}

const full = dump(SRC, path.join(OUT, 'src.rgba'), false, null)
dump(COMP, path.join(OUT, 'out.rgba'), false, [full.width, full.height])
const maskMeta = dump(MASK, path.join(OUT, 'mask.gray'), true, [full.width, full.height])
if (maskMeta.width !== full.width || maskMeta.height !== full.height) {
  throw new Error(`mask size ${maskMeta.width}x${maskMeta.height} != ${full.width}x${full.height}`)
}

const src = new Uint8Array(readFileSync(path.join(OUT, 'src.rgba')))
const out = new Uint8Array(readFileSync(path.join(OUT, 'out.rgba')))
const mask = maskFromGray(readFileSync(path.join(OUT, 'mask.gray')))

let labels = null
let regionMasks = null
let regions = { upper: 0, lower: 0, together: false, white: 0 }
if (existsSync(LABELS)) {
  const ids = readFileSync(LABELS)
  labels = Array.from(ids, (id) => parseMod.CLOTHES_PARSE_LABELS[id] || 'Background')
  regionMasks = parseMod.assembleClothesRegionMasks({
    labels,
    width: full.width,
    height: full.height,
    woman: { x: 0, y: 0, w: 1, h: 1 },
    man: null,
  })
  regions = parseMod.diagnoseClothesRegions(regionMasks.whiteUpper, regionMasks.whiteLower)
  regions.white = regionMasks.white
}

const fullGate = visual.gateLookVisual({
  src,
  out,
  mask,
  width: full.width,
  height: full.height,
  labels: labels || undefined,
  upperMask: regionMasks?.upper,
  lowerMask: regionMasks?.lower,
})

const dw = 192
const dh = 256
dump(SRC, path.join(OUT, 'src-192.rgba'), false, [dw, dh])
dump(COMP, path.join(OUT, 'out-192.rgba'), false, [dw, dh])
dump(MASK, path.join(OUT, 'mask-192.gray'), true, [dw, dh])
const clientGate = visual.gateLookVisual({
  src: new Uint8Array(readFileSync(path.join(OUT, 'src-192.rgba'))),
  out: new Uint8Array(readFileSync(path.join(OUT, 'out-192.rgba'))),
  mask: maskFromGray(readFileSync(path.join(OUT, 'mask-192.gray'))),
  width: dw,
  height: dh,
})

if (existsSync(SCENE)) unlinkSync(SCENE)

const prev = existsSync(path.join(OUT, 'report.json'))
  ? JSON.parse(readFileSync(path.join(OUT, 'report.json'), 'utf8'))
  : {}

  const failReasons = [...new Set([...(fullGate.failReasons || []), ...(clientGate.failReasons || [])])]
  const report = {
    ...prev,
    ok: false,
    verdict: 'visual_fail',
    connectedScene: false,
    sceneCurrentUnlinked: !existsSync(SCENE),
    savedWorks: false,
    wanCalled: false,
    deploy: false,
    retry: false,
    paidCallsThisStep: prev.paidCallsThisStep || 1,
    protectOk: true,
    clothesMeltOk: false,
    autoApproveGate: 'fail',
    gateComplete: false,
    clothesGoalKind: 'change_only',
    regions,
  visual: {
    full: fullGate,
    client192x256: clientGate,
    whiteMadMin: visual.WHITE_MAD_MIN,
    whiteCorrMax: visual.WHITE_CORR_MAX,
    bodyCrushRatio: visual.BODY_CRUSH_RATIO,
    seamLumRelMax: visual.SEAM_LUM_REL_MAX,
  },
  failReasons: failReasons.length ? failReasons : ['visual_fail'],
}

writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
writeFileSync(path.join(OUT, 'visual-gate.json'), JSON.stringify(report.visual, null, 2))

const summary = {
  verdict: report.verdict,
  ok: report.ok,
  connectedScene: report.connectedScene,
  sceneExists: existsSync(SCENE),
  regions,
  full: {
    ok: fullGate.ok,
    reason: fullGate.reason,
    failReasons: fullGate.failReasons,
    mad: fullGate.regions.all.mad,
    corr: fullGate.regions.all.corr,
    upperMad: fullGate.upper.mad,
    lowerMad: fullGate.lower.mad,
    upperCorr: fullGate.upper.corr,
    lowerCorr: fullGate.lower.corr,
    upperSil: fullGate.upper.silhouette.ok,
    lowerSil: fullGate.lower.silhouette.ok,
    upperSeam: fullGate.upper.seam.ok,
    lowerSeam: fullGate.lower.seam.ok,
    together: fullGate.regions.together,
  },
  client192x256: {
    ok: clientGate.ok,
    reason: clientGate.reason,
    failReasons: clientGate.failReasons,
    mad: clientGate.regions.all.mad,
    upperSil: clientGate.upper.silhouette.ok,
    lowerSil: clientGate.lower.silhouette.ok,
  },
  paidCallsThisStep: 0,
  wanCalled: false,
  deploy: false,
}
console.log(JSON.stringify(summary, null, 2))
if (fullGate.ok || clientGate.ok || existsSync(SCENE) || report.connectedScene) process.exit(1)
if (!failReasons.includes('clothes_goal')) process.exit(1)
