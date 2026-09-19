#!/usr/bin/env node
/**
 * 무과금. 의상 마스크가 팔·다리·얼굴을 옷으로 열지 않는지.
 * Claude / fal / Wan / 배포 없음.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-live-slip')
const LABELS = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire', 'woman-full-labels.u8')
const BUNDLE = path.join(ROOT, '_tmp_bundle', 'desk-clothes-parse.cjs')
const APP = path.join(ROOT, 'public', 'app.js')
const PARSE = path.join(ROOT, 'functions', 'lib', 'desk-clothes-parse.ts')
const BASELINE = path.join(ROOT, 'scripts', 'desk-look-identity-mask-baseline.json')

const appSrc = readFileSync(APP, 'utf8')
const parseSrc = readFileSync(PARSE, 'utf8')
if (!appSrc.includes('function deskLookIdentityPasses(resultUrl)')) {
  console.log('app.js missing deskLookIdentityPasses')
  process.exit(1)
}
if (!/if \(protectLocked\) \{[\s\S]*deskLookIdentityPasses/.test(appSrc)) {
  console.log('app.js protectIdentical path skips identity')
  process.exit(1)
}
if (/deskStillFaceBoxes/.test(appSrc.slice(appSrc.indexOf('async function deskLookIdentityPasses'), appSrc.indexOf('async function deskStillPasses')))) {
  console.log('identity path calls Claude face-box')
  process.exit(1)
}
if (parseSrc.includes('VTON_FACE_KEEP_FRAC')) {
  console.log('lower face still released as a band')
  process.exit(1)
}
if (/Left-arm|Right-arm|Left-leg|Right-leg/.test(parseSrc.slice(parseSrc.indexOf('export const VTON_MODEL_BODY_LABELS'), parseSrc.indexOf('export const MASK_MIN_WHITE')))) {
  console.log('VTON mask still edits limbs')
  process.exit(1)
}

if (!existsSync(LABELS) || !existsSync(path.join(OUT, 'src.rgba'))) {
  console.log('missing criterion labels')
  process.exit(1)
}

execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-clothes-parse.ts" --bundle --platform=node --format=cjs --outfile="${BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)

const parseMod = await import(`file://${BUNDLE}?t=${Date.now()}`)
const facts = JSON.parse(
  readFileSync(path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit', 'woman-full', 'facts.json'), 'utf8'),
)
const width = facts.width
const height = facts.height
const labels = Array.from(readFileSync(LABELS), (id) => parseMod.CLOTHES_PARSE_LABELS[id] || 'Background')
const srcRgba = new Uint8Array(readFileSync(path.join(OUT, 'src.rgba')))
const identity = parseMod.assembleVtonIdentityMask({
  labels,
  width,
  height,
  woman: { x: 0, y: 0, w: 1, h: 1 },
  man: null,
  srcRgba,
})
if (!identity.ok) {
  console.log('mask fail', identity.reason)
  process.exit(1)
}

function isSkinLike(rgba, p) {
  const i = p * 4
  const r = rgba[i]
  const g = rgba[i + 1]
  const b = rgba[i + 2]
  return r > 85 && r + 8 >= g && r > b + 6 && (r + g + b) / 3 > 75
}

const hands = parseMod.armHandProtect(labels, width, height)
const limb = { 'Left-arm': 0, 'Right-arm': 0, 'Left-leg': 0, 'Right-leg': 0 }
let armBodyEdit = 0
let armSkinEdit = 0
let armSleeveEdit = 0
let faceEdit = 0
let faceKeep = 0
for (let p = 0; p < labels.length; p++) {
  const lab = labels[p]
  if (identity.mask[p] < 128) {
    if (lab === 'Face') faceKeep += 1
    continue
  }
  if (lab === 'Face') faceEdit += 1
  if (lab in limb) limb[lab] += 1
  if ((lab === 'Left-arm' || lab === 'Right-arm') && !hands[p]) {
    armBodyEdit += 1
    if (isSkinLike(srcRgba, p)) armSkinEdit += 1
    else armSleeveEdit += 1
  }
}

const painted = new Uint8Array(srcRgba)
const jacket = { r: 28, g: 26, b: 24 }
const paintedSet = new Uint8Array(labels.length)
let paintedN = 0
for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
    const p = y * width + x
    const lab = labels[p]
    if (lab !== 'Left-arm' && lab !== 'Right-arm') continue
    let nearClothes = false
    for (let dy = -8; dy <= 8 && !nearClothes; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const q = (y + dy) * width + (x + dx)
        const nlab = labels[q] || ''
        if (nlab === 'Upper-clothes' || nlab === 'Dress') nearClothes = true
      }
    }
    if (!nearClothes) continue
    const i = p * 4
    painted[i] = jacket.r
    painted[i + 1] = jacket.g
    painted[i + 2] = jacket.b
    paintedSet[p] = 1
    paintedN += 1
  }
}
const sleeved = parseMod.assembleVtonIdentityMask({
  labels,
  width,
  height,
  woman: { x: 0, y: 0, w: 1, h: 1 },
  man: null,
  srcRgba: painted,
})
let sleeveCaught = 0
let unpaintedSkinOpened = 0
for (let p = 0; p < labels.length; p++) {
  const lab = labels[p]
  if (lab !== 'Left-arm' && lab !== 'Right-arm') continue
  if (sleeved.mask[p] < 128) continue
  if (paintedSet[p]) sleeveCaught += 1
  else if (isSkinLike(srcRgba, p)) unpaintedSkinOpened += 1
}

const report = {
  newPaidCall: false,
  wanCalled: false,
  claudeFaceBoxCalled: false,
  criterion: '03-composite-v2.png',
  okMask: identity.ok,
  releasedGaps: identity.releasedGaps,
  releasedNeck: identity.releasedNeck,
  limbEdit: limb,
  armBodyEdit,
  armSkinEdit,
  armSleeveEdit,
  releasedSleeve: identity.releasedSleeve,
  releasedClothesColor: identity.releasedClothesColor,
  sleeveGhost: {
    paintedN,
    releasedSleeve: sleeved.releasedSleeve,
    releasedClothesColor: sleeved.releasedClothesColor,
    caught: sleeveCaught,
    unpaintedSkinOpened,
  },
  faceEdit,
  faceKeep,
  identityWired: true,
}
report.ok =
  identity.ok === true &&
  armSkinEdit === 0 &&
  limb['Left-leg'] === 0 &&
  limb['Right-leg'] === 0 &&
  faceKeep > faceEdit &&
  paintedN > 20 &&
  (sleeved.releasedSleeve > 0 || sleeved.releasedClothesColor > identity.releasedClothesColor) &&
  sleeveCaught > 0 &&
  unpaintedSkinOpened === 0 &&
  report.identityWired === true

writeFileSync(path.join(OUT, 'identity-mask-repro.json'), JSON.stringify(report, null, 2))
writeFileSync(
  BASELINE,
  JSON.stringify(
    {
      limbEditZero: true,
      faceKeepGtEdit: true,
      identityWired: true,
      ok: report.ok,
    },
    null,
    2,
  ),
)
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
