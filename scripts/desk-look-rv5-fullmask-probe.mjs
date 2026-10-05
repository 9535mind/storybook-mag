#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-nude-probe')
mkdirSync(OUT, { recursive: true })

function envVal(key) {
  const line = readFileSync(path.join(ROOT, '.dev.vars'), 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`))
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : ''
}

const apiToken = envVal('REPLICATE_API_TOKEN')
const BUNDLE = path.join(ROOT, '_tmp_bundle', 'replicate-client.probe.cjs')
execSync(
  `node_modules\\.bin\\esbuild functions/lib/replicate-client.ts --bundle --platform=node --format=cjs --outfile="${BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const rep = await import(`file://${BUNDLE}?t=${Date.now()}`)
const { default: sharp } = await import('sharp')

const srcPath = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-paid-upper-only', '00-source.jpg')
const srcBuf = await sharp(srcPath).resize(768, 1024, { fit: 'cover' }).jpeg({ quality: 84 }).toBuffer()
const { width: w, height: h } = await sharp(srcBuf).metadata()
const ww = w || 768
const hh = h || 1024
const maskRaw = Buffer.alloc(ww * hh)
for (let y = 0; y < hh; y++) {
  for (let x = 0; x < ww; x++) {
    const nx = x / ww
    const ny = y / hh
    maskRaw[y * ww + x] = nx > 0.2 && nx < 0.8 && ny > 0.2 && ny < 0.9 ? 255 : 0
  }
}
const maskPng = await sharp(maskRaw, { raw: { width: ww, height: hh, channels: 1 } }).png().toBuffer()
writeFileSync(path.join(OUT, 'rv5-full-mask.png'), maskPng)

const started = Date.now()
const job = await rep.startReplicateInpaint({
  apiToken,
  imageUrl: `data:image/jpeg;base64,${srcBuf.toString('base64')}`,
  maskUrl: `data:image/png;base64,${maskPng.toString('base64')}`,
  prompt:
    'photoreal adult woman, same standing pose, same crop, same face. melt ALL clothes to full nude. jacket OFF, shirt OFF, jeans OFF, panty OFF. bare breasts with nipples, bare belly, bare hips, bare legs. no leftover fabric, no sweater at waist.',
  negativePrompt: 'clothes, jacket, shirt, jeans, pants, bra, panty, swimsuit, leotard, lingerie, sweater, new face, child',
  strength: 0.9,
  modelOwner: 'lucataco',
  modelName: 'realistic-vision-v5-inpainting',
})
let imageUrl = job.imageUrl || ''
if (!imageUrl && job.predictionId) {
  const t0 = Date.now()
  while (Date.now() - t0 < 180000) {
    await new Promise((r) => setTimeout(r, 2500))
    const st = await rep.checkReplicateImage({ apiToken, predictionId: job.predictionId })
    if (st.status === 'succeeded' && st.imageUrl) {
      imageUrl = st.imageUrl
      break
    }
    if (st.status === 'failed') {
      console.log(JSON.stringify({ ok: false, error: st.error }))
      process.exit(1)
    }
  }
}
if (!imageUrl) {
  console.log(JSON.stringify({ ok: false, error: 'no_image' }))
  process.exit(1)
}
const genBuf = Buffer.from(await (await fetch(imageUrl)).arrayBuffer())
await sharp(genBuf).png().toFile(path.join(OUT, 'rv5-full-gen.png'))
const srcRgb = await sharp(srcBuf).resize(ww, hh).removeAlpha().raw().toBuffer()
const outRgb = await sharp(genBuf).resize(ww, hh, { fit: 'fill' }).removeAlpha().raw().toBuffer()
let n = 0
let sum = 0
for (let i = 0; i < ww * hh; i++) {
  if (maskRaw[i] < 128) continue
  const o = i * 3
  sum += (Math.abs(srcRgb[o] - outRgb[o]) + Math.abs(srcRgb[o + 1] - outRgb[o + 1]) + Math.abs(srcRgb[o + 2] - outRgb[o + 2])) / 3
  n += 1
}
const mad = n ? sum / n : 0
const report = { ok: true, ms: Date.now() - started, n, mad, changed: mad >= 24 }
writeFileSync(path.join(OUT, 'rv5-full-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
process.exit(report.changed ? 0 : 1)
