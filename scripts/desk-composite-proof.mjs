#!/usr/bin/env node
/**
 * 무과금 증명: 의상 마스크 PNG + 최종 합성의 보호영역 바이트 동일.
 * fal / Replicate / Wan 호출 없음.
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-composite-proof')
const BUNDLE_DIR = path.join(ROOT, '_tmp_bundle')
const COMP_BUNDLE = path.join(BUNDLE_DIR, 'desk-clothes-composite.cjs')
const MASK_BUNDLE = path.join(BUNDLE_DIR, 'face-preserve-mask.cjs')

if (!existsSync(BUNDLE_DIR)) mkdirSync(BUNDLE_DIR, { recursive: true })
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-clothes-composite.ts" --bundle --platform=node --format=cjs --outfile="${COMP_BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/face-preserve-mask.ts" --bundle --platform=node --format=cjs --outfile="${MASK_BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)

const comp = await import(`file://${COMP_BUNDLE}?t=${Date.now()}`)
const maskMod = await import(`file://${MASK_BUNDLE}?t=${Date.now()}`)

const W = 64
const H = 96
const src = new Uint8Array(W * H * 4)
const gen = new Uint8Array(W * H * 4)
const mask = new Uint8Array(W * H)

function setPx(buf, x, y, r, g, b) {
  const i = (y * W + x) * 4
  buf[i] = r
  buf[i + 1] = g
  buf[i + 2] = b
  buf[i + 3] = 255
}

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const bg = x < 8 || x >= W - 8
    if (bg) setPx(src, x, y, 30, 40, 180)
    else if (y < 24) setPx(src, x, y, 180, 140, 120)
    else if (y < 64) setPx(src, x, y, 40, 140, 60)
    else setPx(src, x, y, 180, 140, 120)
    setPx(gen, x, y, 255, 0, 255)
    const clothes = !bg && y >= 24 && y < 64
    mask[y * W + x] = clothes ? 255 : 0
  }
}

const out = comp.compositeProtectRgba(src, gen, mask, W, H, 5)
const stats = comp.protectRegionMad(src, out, mask, W, H, 5)
const invade = comp.maskInvadesSkin(src, mask, W, H, { r: 180, g: 140, b: 120 }, 0.02)

let clothesHit = 0
let clothesN = 0
let faceChanged = 0
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    if (mask[y * W + x] >= 128) {
      clothesN += 1
      if (out[i] === 255 && out[i + 1] === 0 && out[i + 2] === 255) clothesHit += 1
    }
    if (y < 20 && x >= 10 && x < W - 10) {
      if (out[i] !== src[i] || out[i + 1] !== src[i + 1] || out[i + 2] !== src[i + 2]) faceChanged += 1
    }
  }
}

const ok = stats.identical && invade.ok && clothesHit === clothesN && faceChanged === 0
const report = {
  paidCalls: 0,
  width: W,
  height: H,
  protect: stats,
  invade,
  clothesReplaced: clothesHit,
  clothesN,
  faceChanged,
  ok,
}

writeFileSync(path.join(OUT, 'mask.png'), maskMod.encodeGrayPng(W, H, mask))
writeFileSync(path.join(OUT, 'src.png'), comp.encodeRgbPng(W, H, src))
writeFileSync(path.join(OUT, 'gen.png'), comp.encodeRgbPng(W, H, gen))
writeFileSync(path.join(OUT, 'out.png'), comp.encodeRgbPng(W, H, out))
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))

console.log(ok ? 'ok  protect-identical' : 'FAIL protect-identical')
console.log(JSON.stringify(report))
if (!ok) process.exit(1)
