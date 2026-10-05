#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-couple-finish')
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

const couple = readFileSync(path.join(OUT, '00-couple.jpg'))
const woman = readFileSync(path.join(OUT, '01-woman.jpg'))
const { width: ww, height: hh } = await sharp(woman).metadata()
const { width: fw, height: fh } = await sharp(couple).metadata()
const sx = fw - ww
const maskRaw = Buffer.alloc(ww * hh)
for (let y = 0; y < hh; y++) {
  for (let x = 0; x < ww; x++) {
    const ny = y / hh
    const nx = x / ww
    maskRaw[y * ww + x] = ny > 0.42 && ny < 0.9 && nx > 0.12 && nx < 0.88 ? 255 : 0
  }
}
const maskPng = await sharp(maskRaw, { raw: { width: ww, height: hh, channels: 1 } }).png().toBuffer()
writeFileSync(path.join(OUT, '05-mask-facehold.png'), maskPng)

const started = Date.now()
const job = await rep.startReplicateInpaint({
  apiToken,
  imageUrl: `data:image/jpeg;base64,${woman.toString('base64')}`,
  maskUrl: `data:image/png;base64,${maskPng.toString('base64')}`,
  prompt:
    'Photoreal. Keep this exact face, hair, pose, crop. Melt the white sweater on the torso to bare adult skin. Bare breasts with nipples. Same woman. No new person.',
  negativePrompt: 'new face, different woman, two women, smile, open mouth, lean, crop change, bra, blouse leftover, child',
  strength: 0.86,
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
await sharp(genBuf).png().toFile(path.join(OUT, '06-woman-gen.png'))

const pasted = await sharp(couple)
  .composite([
    { input: await sharp(genBuf).resize(ww, hh, { fit: 'fill' }).jpeg({ quality: 88 }).toBuffer(), left: sx, top: 0 },
  ])
  .toBuffer()
const manKeep = await sharp(couple).extract({ left: 0, top: 0, width: sx, height: fh }).toBuffer()
await sharp(pasted).composite([{ input: manKeep, left: 0, top: 0 }]).png().toFile(path.join(OUT, '07-final.png'))

const womanRgb = await sharp(woman).resize(ww, hh).removeAlpha().raw().toBuffer()
const genRgb = await sharp(genBuf).resize(ww, hh, { fit: 'fill' }).removeAlpha().raw().toBuffer()
let n = 0
let sum = 0
for (let i = 0; i < ww * hh; i++) {
  if (maskRaw[i] < 128) continue
  const o = i * 3
  sum += (Math.abs(womanRgb[o] - genRgb[o]) + Math.abs(womanRgb[o + 1] - genRgb[o + 1]) + Math.abs(womanRgb[o + 2] - genRgb[o + 2])) / 3
  n += 1
}
const report = { ok: true, ms: Date.now() - started, womanMad: n ? sum / n : 0 }
writeFileSync(path.join(OUT, 'report2.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
