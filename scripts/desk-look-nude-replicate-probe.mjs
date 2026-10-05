#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
if (!apiToken) {
  console.log(JSON.stringify({ ok: false, skipped: 'no_replicate' }))
  process.exit(0)
}

const BUNDLE = path.join(ROOT, '_tmp_bundle', 'replicate-client.probe.cjs')
execSync(
  `node_modules\\.bin\\esbuild functions/lib/replicate-client.ts --bundle --platform=node --format=cjs --outfile="${BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const rep = await import(`file://${BUNDLE}?t=${Date.now()}`)
const { default: sharp } = await import('sharp')

const srcPath = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-paid-upper-only', '00-source.jpg')
const srcBuf = await sharp(srcPath).resize(768, 1024, { fit: 'cover' }).jpeg({ quality: 84 }).toBuffer()
const srcData = `data:image/jpeg;base64,${srcBuf.toString('base64')}`
writeFileSync(path.join(OUT, 'rep-src.jpg'), srcBuf)

const started = Date.now()
const job = await rep.startReplicateImageToImage({
  apiToken,
  modelOwner: envVal('REPLICATE_MODEL_OWNER') || 'sdxl-based',
  modelName: envVal('REPLICATE_MODEL_NAME') || 'juggernaut-xl-lightning',
  imageUrl: srcData,
  prompt:
    'Photoreal adult woman, same face and pose. Clothes melted to bare adult skin. Bare breasts, no bra, no panty, no leotard, no swimsuit. Same studio background.',
  negativePrompt: 'bra, panty, leotard, swimsuit, bodysuit, leftover clothes, new face, two people, child',
  width: 768,
  height: 1024,
  strength: 0.48,
  minStrength: 0.16,
  disableSafetyChecker: true,
})

let imageUrl = job.imageUrl || ''
if (!imageUrl && job.predictionId) {
  const t0 = Date.now()
  while (Date.now() - t0 < 90000) {
    await new Promise((r) => setTimeout(r, 2500))
    const st = await rep.checkReplicateImage({ apiToken, predictionId: job.predictionId })
    if (st.status === 'succeeded' && st.imageUrl) {
      imageUrl = st.imageUrl
      break
    }
    if (st.status === 'failed') {
      writeFileSync(path.join(OUT, 'rep-report.json'), JSON.stringify({ ok: false, error: st.error, ms: Date.now() - started }, null, 2))
      console.log(JSON.stringify({ ok: false, error: st.error }))
      process.exit(1)
    }
  }
}

if (!imageUrl) {
  console.log(JSON.stringify({ ok: false, error: 'no_image', ms: Date.now() - started }))
  process.exit(1)
}

const genBuf = Buffer.from(await (await fetch(imageUrl)).arrayBuffer())
writeFileSync(path.join(OUT, 'rep-gen.png'), genBuf)
const srcRgb = await sharp(srcBuf).resize(192, 256).removeAlpha().raw().toBuffer()
const outRgb = await sharp(genBuf).resize(192, 256, { fit: 'fill' }).removeAlpha().raw().toBuffer()
let sum = 0
const n = 192 * 256
for (let i = 0; i < n; i++) {
  const o = i * 3
  sum += (Math.abs(srcRgb[o] - outRgb[o]) + Math.abs(srcRgb[o + 1] - outRgb[o + 1]) + Math.abs(srcRgb[o + 2] - outRgb[o + 2])) / 3
}
const report = { ok: true, ms: Date.now() - started, mad: sum / n, image: true }
writeFileSync(path.join(OUT, 'rep-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
