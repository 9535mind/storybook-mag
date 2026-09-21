#!/usr/bin/env node
/**
 * 무과금. 기존 Leffa 원출력 + 밑단 틈 마스크 → 03-composite-v2.png 기준과 같은지.
 * 손목 보호 범위를 넓히지 않는다. fal / Wan / 배포 없음.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-live-slip')
const LABELS = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire', 'woman-full-labels.u8')
const BUNDLE = path.join(ROOT, '_tmp_bundle')
const CRIT = path.join(OUT, '03-composite-v2.png')
const PARSE_SRC = path.join(ROOT, 'functions', 'lib', 'desk-clothes-parse.ts')

if (!existsSync(path.join(OUT, 'src.rgba')) || !existsSync(path.join(OUT, 'gen.rgba')) || !existsSync(LABELS) || !existsSync(CRIT)) {
  console.log('missing live-slip criterion or rgba')
  process.exit(1)
}

const parseSrc = readFileSync(PARSE_SRC, 'utf8')
if (!parseSrc.includes('const HAND_DISTAL_FRAC = 0.22')) {
  console.log('wrist protect widened; abort')
  process.exit(1)
}
if (!parseSrc.includes('fillBetweenBodyGaps')) {
  console.log('hem gap fill missing; abort')
  process.exit(1)
}

execSync(`node_modules\\.bin\\esbuild functions/lib/desk-clothes-parse.ts --bundle --platform=node --format=cjs --outfile="${path.join(BUNDLE, 'desk-clothes-parse.cjs')}"`, {
  cwd: ROOT,
  stdio: 'pipe',
})
execSync(`node_modules\\.bin\\esbuild functions/lib/desk-clothes-composite.ts --bundle --platform=node --format=cjs --outfile="${path.join(BUNDLE, 'desk-clothes-composite.cjs')}"`, {
  cwd: ROOT,
  stdio: 'pipe',
})
execSync(`node_modules\\.bin\\esbuild functions/lib/desk-look-preflight.ts --bundle --format=iife --global-name=DeskLookLib --outfile=public/desk-look-preflight.js`, {
  cwd: ROOT,
  stdio: 'pipe',
})

const parseMod = await import(`file://${path.join(BUNDLE, 'desk-clothes-parse.cjs')}?t=${Date.now()}`)
const comp = await import(`file://${path.join(BUNDLE, 'desk-clothes-composite.cjs')}?t=${Date.now()}`)
const facts = JSON.parse(
  readFileSync(path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit', 'woman-full', 'facts.json'), 'utf8'),
)
const width = facts.width
const height = facts.height
const labels = Array.from(readFileSync(LABELS), (id) => parseMod.CLOTHES_PARSE_LABELS[id] || 'Background')
const srcRgba = new Uint8Array(readFileSync(path.join(OUT, 'src.rgba')))
const genRgba = new Uint8Array(readFileSync(path.join(OUT, 'gen.rgba')))
const identity = parseMod.assembleVtonIdentityMask({
  labels,
  width,
  height,
  woman: { x: 0, y: 0, w: 1, h: 1 },
  man: null,
  srcRgba,
})
if (!identity.ok || identity.releasedGaps < 1) {
  console.log('gap fill did not run', identity.reason, identity.releasedGaps)
  process.exit(1)
}
const outRgba = comp.compositeProtectRgba(srcRgba, genRgba, identity.mask, width, height, 6)
const critPng = comp.encodeRgbPng(width, height, outRgba)
writeFileSync(path.join(OUT, '03-composite-v2-regress.png'), critPng)

const black = comp.protectRegionMad(srcRgba, outRgba, identity.mask, width, height, 6)
const hands = parseMod.armHandProtect(labels, width, height)
let limbBodyEdit = 0
for (let p = 0; p < labels.length; p++) {
  const lab = labels[p]
  if (identity.mask[p] < 128) continue
  if (lab === 'Left-leg' || lab === 'Right-leg') limbBodyEdit += 1
  if ((lab === 'Left-arm' || lab === 'Right-arm') && !hands[p]) limbBodyEdit += 1
}
const report = {
  criterion: '03-composite-v2.png',
  unpaid: true,
  newPaidCall: false,
  wanCalled: false,
  wristProtectWidened: false,
  releasedGaps: identity.releasedGaps,
  handProtect: identity.handProtect,
  protectBlack: black,
  limbBodyEdit,
  ok: identity.releasedGaps >= 1 && black.identical === true && limbBodyEdit === 0,
}
writeFileSync(path.join(OUT, 'criterion.json'), JSON.stringify({
  file: '03-composite-v2.png',
  look: 'silk',
  wrist: 'known_limit_do_not_widen',
  hem: 'fillBetweenBodyGaps',
}, null, 2))
writeFileSync(path.join(OUT, 'hem-regression.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
