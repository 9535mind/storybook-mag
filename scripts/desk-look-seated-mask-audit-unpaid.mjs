#!/usr/bin/env node
/**
 * 무과금. 주어진 CAST 사진에서 VTON 마스크가 라벨별로 얼마나 열리는지.
 * fal / Claude / Wan / 배포 없음.
 */
import { execFileSync, execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseClothesLabels } from './desk-look-backend-node.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = process.argv[2]
const NAME = process.argv[3] || 'seated'
if (!SRC) {
  console.log('usage: node scripts/desk-look-seated-mask-audit-unpaid.mjs <image> [name]')
  process.exit(1)
}
const OUT = path.join(ROOT, 'tmp-faceswap-test', `desk-look-mask-audit-${NAME}`)
const BUNDLE = path.join(ROOT, '_tmp_bundle', 'desk-clothes-parse.cjs')
mkdirSync(OUT, { recursive: true })

execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-clothes-parse.ts" --bundle --platform=node --format=cjs --outfile="${BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const parseMod = await import(`file://${BUNDLE}?t=${Date.now()}`)
const { width, height, labels } = parseClothesLabels(SRC, path.join(OUT, 'labels.u8'), parseMod.CLOTHES_PARSE_LABELS)

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
im = Image.open(job["image"]).convert("RGBA")
Path(job["out"]).write_bytes(np.asarray(im, dtype=np.uint8).tobytes())
print(json.dumps({"width": im.size[0], "height": im.size[1]}))
`,
  ],
  { input: JSON.stringify({ image: SRC, out: path.join(OUT, 'src.rgba') }), encoding: 'utf8' },
)
const rgba = new Uint8Array(readFileSync(path.join(OUT, 'src.rgba')))

const identity = parseMod.assembleVtonIdentityMask({
  labels,
  width,
  height,
  woman: { x: 0, y: 0, w: 1, h: 1 },
  man: null,
  srcRgba: rgba,
})

const total = {}
const edited = {}
for (let p = 0; p < labels.length; p++) {
  const lab = labels[p]
  total[lab] = (total[lab] || 0) + 1
  if (identity.mask[p] >= 128) edited[lab] = (edited[lab] || 0) + 1
}
const byLabel = Object.keys(total)
  .sort((a, b) => (edited[b] || 0) - (edited[a] || 0))
  .map((lab) => ({
    label: lab,
    total: total[lab],
    edited: edited[lab] || 0,
    frac: Number((((edited[lab] || 0) / total[lab]) * 100).toFixed(1)),
  }))

const keep = ['Left-arm', 'Right-arm', 'Left-leg', 'Right-leg', 'Face', 'Hair', 'Background']
const report = {
  newPaidCall: false,
  wanCalled: false,
  image: SRC,
  width,
  height,
  white: identity.white,
  whiteBody: identity.whiteBody,
  releasedSleeve: identity.releasedSleeve,
  releasedClothesColor: identity.releasedClothesColor,
  releasedGaps: identity.releasedGaps,
  releasedNeck: identity.releasedNeck,
  whiteBleed: identity.whiteBleed,
  identityLeak: byLabel.filter((r) => keep.includes(r.label)),
  byLabel,
}
writeFileSync(path.join(OUT, 'mask-audit.json'), JSON.stringify(report, null, 2))
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/face-preserve-mask.ts" --bundle --platform=node --format=cjs --outfile="${path.join(ROOT, '_tmp_bundle', 'face-preserve-mask.cjs')}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const maskPng = await import(`file://${path.join(ROOT, '_tmp_bundle', 'face-preserve-mask.cjs')}?t=${Date.now()}`)
writeFileSync(path.join(OUT, 'mask.png'), maskPng.encodeGrayPng(width, height, identity.mask))
console.log(JSON.stringify(report, null, 2))
