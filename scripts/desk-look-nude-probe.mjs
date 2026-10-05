#!/usr/bin/env node
/**
 * 유료 1회. 나체 LOOK 인페인트를 에이전트가 직접 돌려 mad를 잰다. Wan 없음.
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-nude-probe')
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
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ok: false, skipped: 'no_fal_key' }, null, 2))
  console.log('skip: no_fal_key')
  process.exit(0)
}

const FAL_BUNDLE = path.join(ROOT, '_tmp_bundle', 'fal-client.probe.cjs')
execSync(
  `node_modules\\.bin\\esbuild functions/lib/fal-client.ts --bundle --platform=node --format=cjs --outfile="${FAL_BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const fal = await import(`file://${FAL_BUNDLE}?t=${Date.now()}`)
const { default: sharp } = await import('sharp')

const srcPath = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-paid-upper-only', '00-source.jpg')
if (!existsSync(srcPath)) {
  console.log('FAIL missing source')
  process.exit(1)
}

const srcMeta = await sharp(srcPath).metadata()
const w = Math.min(srcMeta.width || 800, 900)
const h = Math.round(((srcMeta.height || 1200) * w) / (srcMeta.width || 800))
const srcBuf = await sharp(srcPath).resize(w, h).jpeg({ quality: 84 }).toBuffer()
const srcData = `data:image/jpeg;base64,${srcBuf.toString('base64')}`

const maskRaw = Buffer.alloc(w * h)
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const nx = x / w
    const ny = y / h
    maskRaw[y * w + x] = nx > 0.28 && nx < 0.78 && ny > 0.28 && ny < 0.78 ? 255 : 0
  }
}
const maskPng = await sharp(maskRaw, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer()
const maskData = `data:image/png;base64,${maskPng.toString('base64')}`
writeFileSync(path.join(OUT, '00-src.jpg'), srcBuf)
writeFileSync(path.join(OUT, '01-mask.png'), maskPng)

const prompt =
  'Photoreal. Edit ONLY the white-masked clothes. Melt those garments to bare adult skin of the same woman. Same pose, same crop. No new person, no lingerie, no panty, no bodysuit, no white studio.'

async function waitImage(submitted, ms = 90000) {
  if (submitted?.imageUrl) return { imageUrl: submitted.imageUrl, via: 'direct' }
  if (!submitted?.statusUrl) return { imageUrl: '', via: 'none', submitted }
  const started = Date.now()
  while (Date.now() - started < ms) {
    await new Promise((r) => setTimeout(r, 2500))
    const st = await fetch(submitted.statusUrl, { headers: { Authorization: `Key ${falKey}` } })
    const data = await st.json().catch(() => ({}))
    if (data?.status === 'COMPLETED') {
      const res = await fetch(submitted.responseUrl, { headers: { Authorization: `Key ${falKey}` } })
      const body = await res.json().catch(() => ({}))
      return { imageUrl: body?.images?.[0]?.url || body?.image?.url || '', via: 'poll', status: data.status }
    }
    if (data?.status === 'FAILED' || data?.status === 'CANCELLED') {
      return { imageUrl: '', via: 'poll', status: data.status, detail: data.error || data.detail || '' }
    }
  }
  return { imageUrl: '', via: 'timeout' }
}

function maskMad(src, out, mask, width, height) {
  let n = 0
  let sum = 0
  for (let i = 0; i < width * height; i++) {
    if (mask[i] < 128) continue
    const o = i * 3
    sum += (Math.abs(src[o] - out[o]) + Math.abs(src[o + 1] - out[o + 1]) + Math.abs(src[o + 2] - out[o + 2])) / 3
    n += 1
  }
  return { n, mad: n ? sum / n : 0 }
}

const cases = [
  { id: 'lora-0.95', preferGeneral: false },
  { id: 'general-0.95', preferGeneral: true },
]
const results = []

for (const one of cases) {
  const started = Date.now()
  let submitErr = ''
  let submitted = null
  try {
    submitted = await fal.submitFalInpaint({
      falKey,
      imageUrl: srcData,
      maskUrl: maskData,
      prompt,
      negativePrompt: 'bra, panty, leftover clothes, new face, white studio',
      strength: 0.95,
      preferGeneral: one.preferGeneral,
    })
  } catch (err) {
    submitErr = err instanceof Error ? err.message : String(err)
  }
  const waited = submitErr ? { imageUrl: '' } : await waitImage(submitted)
  let mad = null
  if (waited.imageUrl) {
    const genBuf = Buffer.from(await (await fetch(waited.imageUrl)).arrayBuffer())
    writeFileSync(path.join(OUT, `${one.id}-gen.png`), genBuf)
    const srcRgb = await sharp(srcBuf).resize(w, h).removeAlpha().raw().toBuffer()
    const outRgb = await sharp(genBuf).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer()
    mad = maskMad(srcRgb, outRgb, maskRaw, w, h)
  }
  results.push({
    id: one.id,
    ms: Date.now() - started,
    submitErr,
    pending: Boolean(submitted && submitted.statusUrl),
    image: Boolean(waited.imageUrl),
    via: waited.via || '',
    status: waited.status || '',
    detail: waited.detail || '',
    mad,
    changed: Boolean(mad && mad.mad >= 24),
  })
}

const ok = results.some((r) => r.changed)
const report = { paidCalls: results.length, w, h, results, ok }
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
process.exit(ok ? 0 : 1)
