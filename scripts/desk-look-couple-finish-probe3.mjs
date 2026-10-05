#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-couple-finish')

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

const prev = readFileSync(path.join(OUT, '06-woman-gen.png'))
const couple = readFileSync(path.join(OUT, '00-couple.jpg'))
const { width: ww, height: hh } = await sharp(prev).metadata()
const { width: fw, height: fh } = await sharp(couple).metadata()
const sx = fw - ww
const maskRaw = Buffer.alloc(ww * hh)
for (let y = 0; y < hh; y++) {
  for (let x = 0; x < ww; x++) {
    const ny = y / hh
    const nx = x / ww
    maskRaw[y * ww + x] = ny > 0.4 && ny < 0.92 && nx > 0.1 && nx < 0.9 ? 255 : 0
  }
}
const maskPng = await sharp(maskRaw, { raw: { width: ww, height: hh, channels: 1 } }).png().toBuffer()
const started = Date.now()
const job = await rep.startReplicateInpaint({
  apiToken,
  imageUrl: `data:image/png;base64,${prev.toString('base64')}`,
  maskUrl: `data:image/png;base64,${maskPng.toString('base64')}`,
  prompt:
    'Photoreal. Same face, same hair, same pose, same crop. Remove the remaining white sweater completely. Full nude torso, bare breasts with nipples. No leftover fabric, no hole-in-sweater, no sleeve.',
  negativePrompt: 'sweater, blouse, shirt, leftover fabric, hole cutout, new face, two women, child',
  strength: 0.93,
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
const genBuf = Buffer.from(await (await fetch(imageUrl)).arrayBuffer())
await sharp(genBuf).png().toFile(path.join(OUT, '09-pass2.png'))
const pasted = await sharp(couple)
  .composite([{ input: await sharp(genBuf).resize(ww, hh, { fit: 'fill' }).jpeg({ quality: 88 }).toBuffer(), left: sx, top: 0 }])
  .toBuffer()
const manKeep = await sharp(couple).extract({ left: 0, top: 0, width: sx, height: fh }).toBuffer()
await sharp(pasted).composite([{ input: manKeep, left: 0, top: 0 }]).png().toFile(path.join(OUT, '10-final.png'))
const src = await sharp(readFileSync(path.join(OUT, '01-woman.jpg'))).resize(ww, hh).removeAlpha().raw().toBuffer()
const out = await sharp(genBuf).resize(ww, hh, { fit: 'fill' }).removeAlpha().raw().toBuffer()
let n = 0
let sum = 0
for (let i = 0; i < ww * hh; i++) {
  if (maskRaw[i] < 128) continue
  const o = i * 3
  sum += (Math.abs(src[o] - out[o]) + Math.abs(src[o + 1] - out[o + 1]) + Math.abs(src[o + 2] - out[o + 2])) / 3
  n += 1
}
console.log(JSON.stringify({ ok: true, ms: Date.now() - started, womanMad: n ? sum / n : 0 }))
