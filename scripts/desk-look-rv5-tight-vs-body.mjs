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

const srcBuf = await sharp(path.join(ROOT, 'tmp-faceswap-test', 'desk-look-paid-upper-only', '00-source.jpg'))
  .resize(768, 1024, { fit: 'cover' })
  .jpeg({ quality: 84 })
  .toBuffer()
const ww = 768
const hh = 1024

function inJacket(nx, ny) {
  return nx > 0.28 && nx < 0.72 && ny > 0.22 && ny < 0.52
}
function inJeans(nx, ny) {
  return nx > 0.34 && nx < 0.66 && ny > 0.5 && ny < 0.86
}

const tight = Buffer.alloc(ww * hh)
const body = Buffer.alloc(ww * hh)
for (let y = 0; y < hh; y++) {
  for (let x = 0; x < ww; x++) {
    const nx = x / ww
    const ny = y / hh
    const clothes = inJacket(nx, ny) || inJeans(nx, ny)
    tight[y * ww + x] = clothes ? 255 : 0
    const face = ny < 0.22
    body[y * ww + x] = !face && nx > 0.26 && nx < 0.74 && ny > 0.2 && ny < 0.88 ? 255 : 0
  }
}

async function waitImage(job) {
  if (job.imageUrl) return job.imageUrl
  const t0 = Date.now()
  while (Date.now() - t0 < 180000) {
    await new Promise((r) => setTimeout(r, 2500))
    const st = await rep.checkReplicateImage({ apiToken, predictionId: job.predictionId })
    if (st.status === 'succeeded' && st.imageUrl) return st.imageUrl
    if (st.status === 'failed') throw new Error(st.error || 'failed')
  }
  throw new Error('timeout')
}

function madOn(srcRgb, outRgb, mask) {
  let n = 0
  let sum = 0
  for (let i = 0; i < ww * hh; i++) {
    if (mask[i] < 128) continue
    const o = i * 3
    sum +=
      (Math.abs(srcRgb[o] - outRgb[o]) + Math.abs(srcRgb[o + 1] - outRgb[o + 1]) + Math.abs(srcRgb[o + 2] - outRgb[o + 2])) / 3
    n += 1
  }
  return { n, mad: n ? sum / n : 0, changed: n ? sum / n >= 24 : false }
}

const prompt =
  'Photoreal. Edit ONLY the white-masked clothes. Melt those garments to bare adult skin of the same woman. Jacket OFF, shirt OFF, jeans OFF, panty OFF. Bare breasts with nipples, bare belly. Same pose, same crop. No new person, no lingerie, no leotard, no swimsuit.'
const negative = 'clothes, jacket, shirt, jeans, bra, panty, swimsuit, leotard, lingerie, new face, child'

const rows = []
for (const t of [
  { id: 'tight', mask: tight },
  { id: 'body', mask: body },
]) {
  const started = Date.now()
  const maskPng = await sharp(t.mask, { raw: { width: ww, height: hh, channels: 1 } }).png().toBuffer()
  writeFileSync(path.join(OUT, `cmp-${t.id}-mask.png`), maskPng)
  try {
    const job = await rep.startReplicateInpaint({
      apiToken,
      imageUrl: `data:image/jpeg;base64,${srcBuf.toString('base64')}`,
      maskUrl: `data:image/png;base64,${maskPng.toString('base64')}`,
      prompt,
      negativePrompt: negative,
      strength: 0.88,
      modelOwner: 'lucataco',
      modelName: 'realistic-vision-v5-inpainting',
    })
    const url = await waitImage(job)
    const genBuf = Buffer.from(await (await fetch(url)).arrayBuffer())
    await sharp(genBuf).png().toFile(path.join(OUT, `cmp-${t.id}-gen.png`))
    const srcRgb = await sharp(srcBuf).resize(ww, hh).removeAlpha().raw().toBuffer()
    const outRgb = await sharp(genBuf).resize(ww, hh, { fit: 'fill' }).removeAlpha().raw().toBuffer()
    const clothes = madOn(srcRgb, outRgb, tight)
    const row = { id: t.id, ok: true, ms: Date.now() - started, ...clothes }
    rows.push(row)
    console.log(JSON.stringify(row))
  } catch (error) {
    const row = { id: t.id, ok: false, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) }
    rows.push(row)
    console.log(JSON.stringify(row))
  }
}
writeFileSync(path.join(OUT, 'cmp-tight-vs-body.json'), JSON.stringify(rows, null, 2))
process.exit(rows.some((r) => r.id === 'body' && r.changed) ? 0 : 1)
