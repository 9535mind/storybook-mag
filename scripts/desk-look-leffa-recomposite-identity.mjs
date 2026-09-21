#!/usr/bin/env node
/**
 * 무과금. 기존 Leffa 원출력만 정체성 보호로 다시 합성.
 * 새 Fal 호출·Wan·배포 없음.
 */
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const FOLDER = process.argv[2] || 'desk-look-paid-leffa-slip'
const OUT = path.join(ROOT, 'tmp-faceswap-test', FOLDER)
const LABELS = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire', 'woman-full-labels.u8')
const BUNDLE = path.join(ROOT, '_tmp_bundle')
const SRC_RGBA = path.join(OUT, 'src.rgba')
const GEN_RGBA = path.join(OUT, 'gen.rgba')
const RAW = path.join(OUT, '02-model-raw.png')
const OLD_COMP = path.join(OUT, '03-composite.png')
const OLD_COMP_KEEP = path.join(OUT, '03-composite-clothes-mask.png')
const OLD_MASK_KEEP = path.join(OUT, '01-protect-mask-clothes.png')
const NEW_MASK = path.join(OUT, '01-protect-mask.png')
const NEW_COMP = path.join(OUT, '03-composite.png')

if (!existsSync(SRC_RGBA) || !existsSync(GEN_RGBA) || !existsSync(RAW) || !existsSync(LABELS)) {
  console.log('missing existing leffa outputs or labels')
  process.exit(1)
}

function esbuild(entry, outfile) {
  execSync(`node_modules\\.bin\\esbuild "${entry}" --bundle --platform=node --format=cjs --outfile="${outfile}"`, {
    cwd: ROOT,
    stdio: 'pipe',
  })
}

esbuild('functions/lib/desk-clothes-parse.ts', path.join(BUNDLE, 'desk-clothes-parse.cjs'))
esbuild('functions/lib/face-preserve-mask.ts', path.join(BUNDLE, 'face-preserve-mask.cjs'))
esbuild('functions/lib/desk-clothes-composite.ts', path.join(BUNDLE, 'desk-clothes-composite.cjs'))

const parseMod = await import(`file://${path.join(BUNDLE, 'desk-clothes-parse.cjs')}?t=${Date.now()}`)
const maskPng = await import(`file://${path.join(BUNDLE, 'face-preserve-mask.cjs')}?t=${Date.now()}`)
const comp = await import(`file://${path.join(BUNDLE, 'desk-clothes-composite.cjs')}?t=${Date.now()}`)

const facts = JSON.parse(
  readFileSync(path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit', 'woman-full', 'facts.json'), 'utf8'),
)
const width = facts.width
const height = facts.height
const labels = Array.from(readFileSync(LABELS), (id) => parseMod.CLOTHES_PARSE_LABELS[id] || 'Background')
const srcRgba = new Uint8Array(readFileSync(SRC_RGBA))
const genRgba = new Uint8Array(readFileSync(GEN_RGBA))
if (srcRgba.length !== width * height * 4 || genRgba.length !== width * height * 4) {
  console.log('rgba size mismatch, no paid fallback')
  process.exit(1)
}

const identity = parseMod.assembleVtonIdentityMask({
  labels,
  width,
  height,
  woman: { x: 0, y: 0, w: 1, h: 1 },
  man: null,
  srcRgba,
})
if (!identity.ok) {
  console.log('identity mask too small', identity.reason)
  process.exit(1)
}

if (existsSync(OLD_COMP) && !existsSync(OLD_COMP_KEEP)) renameSync(OLD_COMP, OLD_COMP_KEEP)
const identityPrev = path.join(OUT, '03-composite-identity-v1.png')
if (existsSync(OLD_COMP) && !existsSync(identityPrev)) copyFileSync(OLD_COMP, identityPrev)
const oldMask = path.join(OUT, '01-protect-mask.png')
if (existsSync(oldMask) && !existsSync(OLD_MASK_KEEP)) copyFileSync(oldMask, OLD_MASK_KEEP)

const outRgba = comp.compositeProtectRgba(srcRgba, genRgba, identity.mask, width, height, 6)
writeFileSync(NEW_MASK, maskPng.encodeGrayPng(width, height, identity.mask))
writeFileSync(NEW_COMP, comp.encodeRgbPng(width, height, outRgba))
writeFileSync(path.join(OUT, 'out.rgba'), outRgba)

const black = comp.protectRegionMad(srcRgba, outRgba, identity.mask, width, height, 5)
let faceN = 0
let faceMax = 0
let faceSum = 0
let hairN = 0
let hairMax = 0
for (let p = 0; p < width * height; p++) {
  if (identity.mask[p] >= 128) continue
  const lab = labels[p] || ''
  if (lab !== 'Face' && lab !== 'Hair') continue
  const i = p * 4
  const mad =
    (Math.abs(srcRgba[i] - outRgba[i]) +
      Math.abs(srcRgba[i + 1] - outRgba[i + 1]) +
      Math.abs(srcRgba[i + 2] - outRgba[i + 2])) /
    3
  if (lab === 'Face') {
    faceN += 1
    faceSum += mad
    if (mad > faceMax) faceMax = mad
  } else {
    hairN += 1
    if (mad > hairMax) hairMax = mad
  }
}

const prev = existsSync(path.join(OUT, 'report.json'))
  ? JSON.parse(readFileSync(path.join(OUT, 'report.json'), 'utf8'))
  : {}
const report = {
  ...prev,
  paidCallsThisStep: prev.paidCallsThisStep || 1,
  newPaidCall: false,
  connectedScene: false,
  savedWorks: false,
  wanCalled: false,
  deploy: false,
  retry: false,
  recomposite: 'vton_identity_seams',
  garmentLength: 'leffa_mini_not_knee_ref',
  maskWhite: identity.white,
  maskWhiteBody: identity.whiteBody,
  maskWhiteBleed: identity.whiteBleed,
  handProtect: identity.handProtect,
  releasedNeck: identity.releasedNeck,
  releasedCuff: identity.releasedCuff,
  releasedClothesColor: identity.releasedClothesColor,
  releasedIslands: identity.releasedIslands,
  protectBlack: black,
  faceProtect: { n: faceN, mad: faceN ? faceSum / faceN : 1, max: faceMax, identical: faceN > 0 && faceMax === 0 },
  hairProtectMax: hairMax,
  nudeNotCovered: true,
  ok: black.identical === true && faceN > 0 && faceMax === 0,
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))

const board = lastJson(
  execFileSync(
    'py',
    [
      '-3',
      '-c',
      `
import json, sys
from PIL import Image, ImageDraw
job = json.loads(sys.stdin.read())
w, h = job["size"]
gap = 16
board = Image.new("RGB", (w * 4 + gap * 5, h + 72), (245, 245, 245))
d = ImageDraw.Draw(board)
x = gap
for p, lab in zip(job["paths"], job["labels"]):
    im = Image.open(p).convert("RGB").resize((w, h))
    board.paste(im, (x, 48))
    d.text((x, 12), lab, fill=(20, 20, 20))
    x += w + gap
board.save(job["out"])
print(json.dumps({"ok": True}))
`,
    ],
    {
      cwd: ROOT,
      input: JSON.stringify({
        paths: [path.join(OUT, '00-source.jpg'), path.join(OUT, '01-garment.png'), RAW, NEW_COMP],
        labels: ['00 source', '01 garment ref', '02 model-raw Leffa', '03 composite identity'],
        size: [440, 592],
        out: path.join(OUT, 'review-board.png'),
      }),
      encoding: 'utf8',
    },
  ),
)

console.log(
  JSON.stringify(
    {
      ok: report.ok,
      newPaidCall: false,
      wanCalled: false,
      deploy: false,
      maskWhite: identity.white,
      whiteBody: identity.whiteBody,
      whiteBleed: identity.whiteBleed,
      handProtect: identity.handProtect,
      releasedNeck: identity.releasedNeck,
      releasedCuff: identity.releasedCuff,
      releasedClothesColor: identity.releasedClothesColor,
      releasedIslands: identity.releasedIslands,
      protectBlack: { mad: black.mad, max: black.max, identical: black.identical },
      faceIdentical: report.faceProtect.identical,
      reviewBoard: board.ok === true,
    },
    null,
    2,
  ),
)
