#!/usr/bin/env node
/**
 * 커플 LOOK: 여자만 잘라 RV5 → 붙인 뒤 왼쪽 남자 원본 화소 잠금.
 * 남자 MAD 낮고 여자 옷이 바뀌면 통과. 여자 둘이면 실패.
 */
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
const PRE = path.join(ROOT, '_tmp_bundle', 'desk-look-preflight.cjs')
execSync(
  `node_modules\\.bin\\esbuild functions/lib/desk-look-preflight.ts --bundle --platform=node --format=cjs --outfile="${PRE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const rep = await import(`file://${BUNDLE}?t=${Date.now()}`)
const look = await import(`file://${PRE}?t=${Date.now()}`)
const { default: sharp } = await import('sharp')

const srcPath = path.join(OUT, '00-couple.jpg')
const srcMeta = await sharp(srcPath).metadata()
const fullW = srcMeta.width || 1024
const fullH = srcMeta.height || 768
const srcFull = await sharp(srcPath).resize(fullW, fullH).removeAlpha().raw().toBuffer()
const split = 0.48
const sx = Math.round(fullW * split)
const cropW = fullW - sx
const womanJpg = await sharp(srcPath).extract({ left: sx, top: 0, width: cropW, height: fullH }).jpeg({ quality: 88 }).toBuffer()
const ww = cropW
const hh = fullH
const face = { x: 0.28, y: 0.08, w: 0.36, h: 0.28, slot: 'woman' }
const body = look.assembleNudeBodyMask({
  width: ww,
  height: hh,
  woman: { x: 0, y: 0, w: 1, h: 1 },
  man: null,
  faces: [face],
})
const maskPng = await sharp(Buffer.from(body.mask), { raw: { width: ww, height: hh, channels: 1 } }).png().toBuffer()
writeFileSync(path.join(OUT, '10-mw-mask.png'), maskPng)
writeFileSync(path.join(OUT, '10-mw-woman.jpg'), womanJpg)

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

function madBand(a, b, w, h, x0, x1) {
  let n = 0
  let sum = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const nx = (x + 0.5) / w
      if (nx < x0 || nx >= x1) continue
      const i = (y * w + x) * 3
      sum += (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3
      n += 1
    }
  }
  return { n, mad: n ? sum / n : 0 }
}

const prompt =
  'Photoreal. Edit ONLY the white-masked clothes. Melt those garments to bare adult skin of the same woman. Sweater OFF, bra OFF, panty OFF. Bare breasts with nipples. Same pose, same crop, same face. No new person, no second woman, no lingerie, no swimsuit.'
const negative = 'clothes, sweater, bra, panty, swimsuit, new face, second woman, two women, child'

const started = Date.now()
const job = await rep.startReplicateInpaint({
  apiToken,
  imageUrl: `data:image/jpeg;base64,${womanJpg.toString('base64')}`,
  maskUrl: `data:image/png;base64,${maskPng.toString('base64')}`,
  prompt,
  negativePrompt: negative,
  strength: 0.88,
  modelOwner: 'lucataco',
  modelName: 'realistic-vision-v5-inpainting',
})
const url = await waitImage(job)
const genBuf = Buffer.from(await (await fetch(url)).arrayBuffer())
await sharp(genBuf).png().toFile(path.join(OUT, '10-mw-woman-gen.png'))
const genFit = await sharp(genBuf).resize(cropW, fullH, { fit: 'fill' }).jpeg({ quality: 88 }).toBuffer()
const pasted = await sharp(srcPath)
  .composite([{ input: genFit, left: sx, top: 0 }])
  .png()
  .toBuffer()
const left = await sharp(srcPath).extract({ left: 0, top: 0, width: sx, height: fullH }).toBuffer()
const locked = await sharp(pasted).composite([{ input: left, left: 0, top: 0 }]).png().toBuffer()
await sharp(locked).png().toFile(path.join(OUT, '10-mw-final.png'))
const outRgb = await sharp(locked).resize(fullW, fullH).removeAlpha().raw().toBuffer()
const man = madBand(srcFull, outRgb, fullW, fullH, 0, split)
const woman = madBand(srcFull, outRgb, fullW, fullH, split, 1)
const report = {
  ms: Date.now() - started,
  maskWhite: body.white,
  maskOk: body.ok,
  manMad: man.mad,
  womanMad: woman.mad,
  manLocked: man.mad <= 14,
  womanChanged: woman.mad >= 24,
  twoWomen: man.mad > 14,
  ok: body.ok && man.mad <= 14 && woman.mad >= 24,
}
writeFileSync(path.join(OUT, '10-mw-lock.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
