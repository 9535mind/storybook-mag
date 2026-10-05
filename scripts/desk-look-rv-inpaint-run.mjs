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
    maskRaw[y * ww + x] = nx > 0.22 && nx < 0.78 && ny > 0.22 && ny < 0.72 ? 255 : 0
  }
}
const maskPng = await sharp(maskRaw, { raw: { width: ww, height: hh, channels: 1 } }).png().toBuffer()
const imageUrl = `data:image/jpeg;base64,${srcBuf.toString('base64')}`
const maskUrl = `data:image/png;base64,${maskPng.toString('base64')}`
const prompt =
  'photoreal adult woman, same standing pose, same crop. melt the jacket shirt jeans to full nude. bare breasts with nipples, bare belly, bare hips. no clothes, no bra, no panty, no swimsuit, no leotard.'
const negativePrompt = 'clothes, jacket, shirt, jeans, bra, panty, swimsuit, leotard, lingerie, new face, child'

const targets = [
  { id: 'rv5', owner: 'lucataco', name: 'realistic-vision-v5-inpainting', strength: 0.88 },
  { id: 'rv6', owner: 'asiryan', name: 'realistic-vision-v6.0-b1', strength: 0.88 },
]

async function waitImage(job) {
  if (job.imageUrl) return job.imageUrl
  if (!job.predictionId) return ''
  const t0 = Date.now()
  while (Date.now() - t0 < 180000) {
    await new Promise((r) => setTimeout(r, 2500))
    const st = await rep.checkReplicateImage({ apiToken, predictionId: job.predictionId })
    if (st.status === 'succeeded' && st.imageUrl) return st.imageUrl
    if (st.status === 'failed') throw new Error(st.error || 'failed')
  }
  throw new Error('timeout')
}

const results = []
for (const t of targets) {
  const started = Date.now()
  try {
    const job = await rep.startReplicateInpaint({
      apiToken,
      imageUrl,
      maskUrl,
      prompt,
      negativePrompt,
      strength: t.strength,
      modelOwner: t.owner,
      modelName: t.name,
    })
    const url = await waitImage(job)
    const genBuf = Buffer.from(await (await fetch(url)).arrayBuffer())
    await sharp(genBuf).png().toFile(path.join(OUT, `${t.id}-gen.png`))
    const srcRgb = await sharp(srcBuf).resize(ww, hh).removeAlpha().raw().toBuffer()
    const outRgb = await sharp(genBuf).resize(ww, hh, { fit: 'fill' }).removeAlpha().raw().toBuffer()
    let n = 0
    let sum = 0
    for (let i = 0; i < ww * hh; i++) {
      if (maskRaw[i] < 128) continue
      const o = i * 3
      sum +=
        (Math.abs(srcRgb[o] - outRgb[o]) +
          Math.abs(srcRgb[o + 1] - outRgb[o + 1]) +
          Math.abs(srcRgb[o + 2] - outRgb[o + 2])) /
        3
      n += 1
    }
    const mad = n ? sum / n : 0
    const row = { id: t.id, ok: true, ms: Date.now() - started, mad, changed: mad >= 24 }
    results.push(row)
    console.log(JSON.stringify(row))
  } catch (error) {
    const row = { id: t.id, ok: false, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) }
    results.push(row)
    console.log(JSON.stringify(row))
  }
}
writeFileSync(path.join(OUT, 'rv-run.json'), JSON.stringify(results, null, 2))
const pass = results.some((r) => r.ok && r.changed)
process.exit(pass ? 0 : 1)
