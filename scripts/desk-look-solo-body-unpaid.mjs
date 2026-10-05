#!/usr/bin/env node
/**
 * 무과금. 혼자 선 장: 얼굴 아래 몸 마스크 + 나체 게이트(상의 녹으면 통과).
 * 기존 RV5 몸 마스크 생성물로 합성·게이트만 잰다. Wan 불변.
 */
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-nude-probe')
const BUNDLE = path.join(ROOT, '_tmp_bundle', 'desk-look-preflight.cjs')
mkdirSync(path.dirname(BUNDLE), { recursive: true })
execSync(
  `node_modules\\.bin\\esbuild functions/lib/desk-look-preflight.ts --bundle --platform=node --format=cjs --outfile="${BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
execSync(
  `node_modules\\.bin\\esbuild functions/lib/desk-look-preflight.ts --bundle --format=iife --global-name=DeskLookLib --outfile=public/desk-look-preflight.js`,
  { cwd: ROOT, stdio: 'pipe' },
)
const look = await import(`file://${BUNDLE}?t=${Date.now()}`)
const { default: sharp } = await import('sharp')

const SRC = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-paid-upper-only', '00-source.jpg')
const GEN = path.join(OUT, 'cmp-body-gen.png')
const W = 192
const H = 256
const srcRgb = await sharp(SRC).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer()
const outRgb = await sharp(GEN).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer()
const face = { x: 0.42, y: 0.07, w: 0.16, h: 0.13, slot: 'woman' }
const body = look.assembleNudeBodyMask({
  width: W,
  height: H,
  woman: { x: 0, y: 0, w: 1, h: 1 },
  man: null,
  faces: [face],
})
const tightGate = look.gateLookVisual({
  src: srcRgb,
  out: outRgb,
  mask: body.mask,
  width: W,
  height: H,
})
const looseGate = look.gateLookVisual({
  src: srcRgb,
  out: outRgb,
  mask: body.mask,
  width: W,
  height: H,
  looseNude: true,
})
await sharp(body.mask, { raw: { width: W, height: H, channels: 1 } })
  .png()
  .toFile(path.join(OUT, 'solo-body-mask.png'))
const report = {
  white: body.white,
  maskOk: body.ok,
  tightOk: tightGate.ok,
  tightReason: tightGate.reason,
  looseOk: looseGate.ok,
  looseReason: looseGate.reason,
  upperMad: looseGate.regions?.upper?.mad,
  lowerMad: looseGate.regions?.lower?.mad,
  ok: body.ok && looseGate.ok && looseGate.regions?.upper?.mad >= 24,
}
writeFileSync(path.join(OUT, 'solo-body-unpaid.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
