#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-body-mw150-recolor-probe')
mkdirSync(OUT, { recursive: true })

function envVal(key) {
  const line = readFileSync(path.join(ROOT, '.dev.vars'), 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`))
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : ''
}

const BUNDLE = path.join(ROOT, '_tmp_bundle', 'fal-client.recolor-probe.cjs')
execSync(
  `node_modules\\.bin\\esbuild functions/lib/fal-client.ts --bundle --platform=node --format=cjs --outfile="${BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const fal = await import(`file://${BUNDLE}?t=${Date.now()}`)
const { default: sharp } = await import('sharp')

const srcPath = path.join(ROOT, 'tmp-faceswap-test', 'desk-body-mw149', 'result.jpg')
const srcBuf = await sharp(srcPath).resize(768, 1024, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer()
const { data, info } = await sharp(srcBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const w = info.width
const h = info.height
const mark = Buffer.alloc(w * h)
let n = 0
for (let y = Math.round(h * 0.28); y < h; y += 1) {
  for (let x = Math.round(w * 0.26); x < Math.round(w * 0.74); x += 1) {
    const i = (y * w + x) * 4
    const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    if (luma >= 78) continue
    mark[y * w + x] = 255
    n += 1
  }
}
const dilated = Buffer.alloc(w * h)
for (let y = 0; y < h; y += 1) {
  for (let x = 0; x < w; x += 1) {
    let on = mark[y * w + x]
    if (!on) {
      for (let dy = -2; dy <= 2 && !on; dy += 1) {
        for (let dx = -2; dx <= 2 && !on; dx += 1) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
          if (mark[yy * w + xx]) on = 255
        }
      }
    }
    dilated[y * w + x] = on
  }
}
const maskPng = await sharp(dilated, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer()
writeFileSync(path.join(OUT, 'mask.png'), maskPng)
writeFileSync(path.join(OUT, 'src.jpg'), srcBuf)

const job = await fal.submitFalInpaint({
  falKey: envVal('FAL_KEY'),
  imageUrl: `data:image/jpeg;base64,${srcBuf.toString('base64')}`,
  maskUrl: `data:image/png;base64,${maskPng.toString('base64')}`,
  prompt: [
    'Photoreal photograph. Edit ONLY the white masked clothes.',
    'Recolor the outfit to #e6d4be cream ivory. Same zip knit or top fabric, same color family on pants and shoes.',
    'Do not change the face, hair, or head. Same woman, same standing pose.',
    'FORBIDDEN a new face, a black office suit, a catalog model, a beige plate.',
  ].join(' '),
  negativePrompt: 'new face, different person, black blazer, black trousers, black pumps, oval sticker',
  strength: 0.9,
})

async function waitImage(submitted) {
  if (submitted.imageUrl) return submitted.imageUrl
  const t0 = Date.now()
  while (Date.now() - t0 < 180000) {
    await new Promise((r) => setTimeout(r, 2500))
    const st = await fal.checkFalKontextMultiImage({
      falKey: envVal('FAL_KEY'),
      statusUrl: submitted.statusUrl,
      responseUrl: submitted.responseUrl,
    })
    if (st.imageUrl) return st.imageUrl
    if (st.status === 'failed') throw new Error(st.error || 'failed')
  }
  throw new Error('timeout')
}

const url = await waitImage(job)
const out = Buffer.from(await (await fetch(url)).arrayBuffer())
writeFileSync(path.join(OUT, 'out.jpg'), out)
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ n, url, pending: !job.imageUrl }, null, 2))
console.log(JSON.stringify({ n, url: url.slice(0, 80), bytes: out.length }, null, 2))
