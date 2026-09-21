#!/usr/bin/env node
/**
 * 무과금 증명 이후 유료 inpaint 1회. 보호영역 동일성만 본다. Wan 없음.
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-composite-proof')
const BUNDLE_DIR = path.join(ROOT, '_tmp_bundle')
const COMP_BUNDLE = path.join(BUNDLE_DIR, 'desk-clothes-composite.cjs')
const MASK_BUNDLE = path.join(BUNDLE_DIR, 'face-preserve-mask.cjs')
const FAL_BUNDLE = path.join(BUNDLE_DIR, 'fal-client.cjs')

function readFalKey() {
  const varsPath = path.join(ROOT, '.dev.vars')
  if (!existsSync(varsPath)) return ''
  const text = readFileSync(varsPath, 'utf8')
  const line = text.split(/\r?\n/).find((l) => l.startsWith('FAL_KEY='))
  if (!line) return ''
  return line.slice('FAL_KEY='.length).trim().replace(/^["']|["']$/g, '')
}

const falKey = readFalKey()
if (!falKey) {
  writeFileSync(
    path.join(OUT, 'paid-report.json'),
    JSON.stringify({ paidCalls: 0, skipped: 'no_fal_key', ok: false }, null, 2),
  )
  console.log('skip paid: no_fal_key')
  process.exit(0)
}

if (!existsSync(COMP_BUNDLE) || !existsSync(MASK_BUNDLE)) {
  console.log('FAIL missing free-proof bundles')
  process.exit(1)
}

execSync(
  `node_modules\\.bin\\esbuild "functions/lib/fal-client.ts" --bundle --platform=node --format=cjs --outfile="${FAL_BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)

const comp = await import(`file://${COMP_BUNDLE}?t=${Date.now()}`)
const maskMod = await import(`file://${MASK_BUNDLE}?t=${Date.now()}`)
const fal = await import(`file://${FAL_BUNDLE}?t=${Date.now()}`)

const W = 64
const H = 96
const src = new Uint8Array(W * H * 4)
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
    mask[y * W + x] = !bg && y >= 24 && y < 64 ? 255 : 0
  }
}

const srcPng = comp.encodeRgbPng(W, H, src)
const maskPng = maskMod.encodeGrayPng(W, H, mask)
const srcData = `data:image/png;base64,${Buffer.from(srcPng).toString('base64')}`
const maskData = `data:image/png;base64,${Buffer.from(maskPng).toString('base64')}`

const submitted = await fal.submitFalInpaint({
  falKey,
  imageUrl: srcData,
  maskUrl: maskData,
  prompt: 'Replace the green clothing area with a red shirt. Do not change the face, skin, legs, or blue background.',
  negativePrompt: 'new face, extra person, changed background',
  strength: 0.72,
})

let imageUrl = 'imageUrl' in submitted ? submitted.imageUrl : ''
if (!imageUrl && 'statusUrl' in submitted) {
  const started = Date.now()
  while (Date.now() - started < 90000) {
    await new Promise((r) => setTimeout(r, 2500))
    const st = await fetch(submitted.statusUrl, { headers: { Authorization: `Key ${falKey}` } })
    const data = await st.json().catch(() => ({}))
    if (data?.status === 'COMPLETED') {
      const res = await fetch(submitted.responseUrl, { headers: { Authorization: `Key ${falKey}` } })
      const body = await res.json().catch(() => ({}))
      imageUrl = body?.images?.[0]?.url || body?.image?.url || ''
      break
    }
    if (data?.status === 'FAILED') break
  }
}

if (!imageUrl) {
  writeFileSync(
    path.join(OUT, 'paid-report.json'),
    JSON.stringify({ paidCalls: 1, ok: false, error: 'no_image' }, null, 2),
  )
  console.log('FAIL paid: no_image')
  process.exit(1)
}

const { default: sharp } = await import('sharp')
const genBuf = Buffer.from(await (await fetch(imageUrl)).arrayBuffer())
writeFileSync(path.join(OUT, 'paid-gen.png'), genBuf)
const genRaw = await sharp(genBuf).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer()
const gen = new Uint8Array(genRaw)
const out = comp.compositeProtectRgba(src, gen, mask, W, H, 5)
const stats = comp.protectRegionMad(src, out, mask, W, H, 5)
writeFileSync(path.join(OUT, 'paid-out.png'), comp.encodeRgbPng(W, H, out))
const report = { paidCalls: 1, protect: stats, ok: stats.identical, imageHost: new URL(imageUrl).host }
writeFileSync(path.join(OUT, 'paid-report.json'), JSON.stringify(report, null, 2))
console.log(stats.identical ? 'ok  paid-protect-identical' : 'FAIL paid-protect-identical')
console.log(JSON.stringify({ paidCalls: 1, identical: stats.identical, mad: stats.mad, max: stats.max, n: stats.n }))
if (!stats.identical) process.exit(1)
