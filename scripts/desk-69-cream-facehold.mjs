#!/usr/bin/env node
/** 69(11 얼굴·검정 정장)에서 얼굴은 두고 옷만 11 크림으로. */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-69-cream')
mkdirSync(OUT, { recursive: true })

function readFalKey() {
  const varsPath = path.join(ROOT, '.dev.vars')
  if (!existsSync(varsPath)) return ''
  const line = readFileSync(varsPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('FAL_KEY='))
  return line ? line.slice('FAL_KEY='.length).trim().replace(/^["']|["']$/g, '') : ''
}

const falKey = readFalKey()
if (!falKey) {
  console.log('skip: no_fal_key')
  process.exit(1)
}

const FAL_BUNDLE = path.join(ROOT, '_tmp_bundle', 'fal-client.probe.cjs')
execSync(
  `node_modules\\.bin\\esbuild functions/lib/fal-client.ts --bundle --platform=node --format=cjs --outfile="${FAL_BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const fal = await import(`file://${FAL_BUNDLE}?t=${Date.now()}`)
const { default: sharp } = await import('sharp')

const srcPath = existsSync(path.join(ROOT, 'tmp-faceswap-test', 'desk-body-mw133-prod', 'result.jpg'))
  ? path.join(ROOT, 'tmp-faceswap-test', 'desk-body-mw133-prod', 'result.jpg')
  : 'C:/Users/UserK/Desktop/그림모음/69.jpg'
const meta = await sharp(srcPath).metadata()
const w = Math.min(meta.width || 800, 900)
const h = Math.round(((meta.height || 1200) * w) / (meta.width || 800))
const srcBuf = await sharp(srcPath).resize(w, h).jpeg({ quality: 88 }).toBuffer()
writeFileSync(path.join(OUT, '00-src.jpg'), srcBuf)

const maskRaw = Buffer.alloc(w * h)
for (let y = 0; y < h; y += 1) {
  for (let x = 0; x < w; x += 1) {
    const ny = y / h
    const nx = x / w
    maskRaw[y * w + x] = ny > 0.26 && ny < 0.97 && nx > 0.18 && nx < 0.82 ? 255 : 0
  }
}
const maskPng = await sharp(maskRaw, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer()
writeFileSync(path.join(OUT, '01-mask.png'), maskPng)

const submitted = await fal.submitFalInpaint({
  falKey,
  imageUrl: `data:image/jpeg;base64,${srcBuf.toString('base64')}`,
  maskUrl: `data:image/png;base64,${maskPng.toString('base64')}`,
  prompt:
    'Photoreal. Same exact woman, same face, same hair, same standing pose. Change only the black office blazer, black trousers, and black pumps into a cream ivory half-zip knit and matching light pants and light shoes. Keep the face pixels. FORBIDDEN a new face, a black suit, a beige plate.',
  negativePrompt: 'new face, catalog model, black blazer, black trousers, black pumps, oval sticker',
  strength: 0.62,
})

async function waitImage(job, ms = 120000) {
  if (job?.imageUrl) return job.imageUrl
  if (!job?.statusUrl) return ''
  const started = Date.now()
  while (Date.now() - started < ms) {
    await new Promise((r) => setTimeout(r, 2500))
    const st = await fetch(job.statusUrl, { headers: { Authorization: `Key ${falKey}` } })
    const data = await st.json().catch(() => ({}))
    if (data?.status === 'COMPLETED') {
      const res = await fetch(job.responseUrl, { headers: { Authorization: `Key ${falKey}` } })
      const body = await res.json().catch(() => ({}))
      return body?.images?.[0]?.url || body?.image?.url || ''
    }
    if (data?.status === 'FAILED' || data?.status === 'CANCELLED') return ''
  }
  return ''
}

const imageUrl = await waitImage(submitted)
if (!imageUrl) {
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ok: false, submitted }, null, 2))
  console.log(JSON.stringify({ ok: false, submitted }))
  process.exit(1)
}
const bin = Buffer.from(await (await fetch(imageUrl)).arrayBuffer())
writeFileSync(path.join(OUT, 'result.jpg'), bin)
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ok: true, bytes: bin.length }, null, 2))
console.log(JSON.stringify({ ok: true, bytes: bin.length }))
