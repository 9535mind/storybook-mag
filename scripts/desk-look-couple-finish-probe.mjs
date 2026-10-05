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

const shot = path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/c-Users-UserK-Desktop-PLATFORM-fashion-magazine/assets/c__Users_UserK_AppData_Roaming_Cursor_User_workspaceStorage_445c76ae849c56e27af6a45e9bef9d4d_images_image-43b26c08-a232-4ef2-85ff-cc184d3ac753.png',
)
const meta = await sharp(shot).metadata()
const W = meta.width || 1
const H = meta.height || 1
// 스크린 위쪽 흰 카드 안 커플 장. 좌우 여백·아래 실패장을 잘라낸다.
const couple = await sharp(shot)
  .extract({
    left: Math.round(W * 0.18),
    top: Math.round(H * 0.07),
    width: Math.round(W * 0.48),
    height: Math.round(H * 0.42),
  })
  .resize(1280, 860, { fit: 'cover' })
  .jpeg({ quality: 88 })
  .toBuffer()
writeFileSync(path.join(OUT, '00-couple.jpg'), couple)

const full = await sharp(couple).metadata()
const fw = full.width || 1280
const fh = full.height || 860
const sx = Math.round(fw * 0.48)
const sw = fw - sx
const woman = await sharp(couple).extract({ left: sx, top: 0, width: sw, height: fh }).jpeg({ quality: 88 }).toBuffer()
writeFileSync(path.join(OUT, '01-woman.jpg'), woman)

const ww = sw
const hh = fh
const maskRaw = Buffer.alloc(ww * hh)
for (let y = 0; y < hh; y++) {
  for (let x = 0; x < ww; x++) {
    const ny = y / hh
    const nx = x / ww
    maskRaw[y * ww + x] = ny > 0.28 && ny < 0.92 && nx > 0.08 && nx < 0.92 ? 255 : 0
  }
}
const maskPng = await sharp(maskRaw, { raw: { width: ww, height: hh, channels: 1 } }).png().toBuffer()
writeFileSync(path.join(OUT, '02-mask.png'), maskPng)

const started = Date.now()
const job = await rep.startReplicateInpaint({
  apiToken,
  imageUrl: `data:image/jpeg;base64,${woman.toString('base64')}`,
  maskUrl: `data:image/png;base64,${maskPng.toString('base64')}`,
  prompt:
    'Photoreal. Same Korean woman, same face, same short black hair, same pose. Melt ONLY her white blouse to bare adult skin. Bare breasts with nipples. No new person. No second woman. Keep her face exact.',
  negativePrompt: 'two women, man, new face, smile change, blouse, shirt, bra, lingerie, swimsuit, child',
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
await sharp(genBuf).png().toFile(path.join(OUT, '03-woman-gen.png'))

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
const mad = n ? sum / n : 0

const pasted = await sharp(couple)
  .composite([{ input: await sharp(genBuf).resize(sw, fh, { fit: 'fill' }).jpeg({ quality: 88 }).toBuffer(), left: sx, top: 0 }])
  .png()
  .toBuffer()
const manKeep = await sharp(couple).extract({ left: 0, top: 0, width: sx, height: fh }).toBuffer()
const out = await sharp(pasted)
  .composite([{ input: manKeep, left: 0, top: 0 }])
  .png()
  .toFile(path.join(OUT, '04-final.png'))

const srcLeft = await sharp(couple).extract({ left: 0, top: 0, width: sx, height: fh }).removeAlpha().raw().toBuffer()
const outLeft = await sharp(path.join(OUT, '04-final.png')).extract({ left: 0, top: 0, width: sx, height: fh }).removeAlpha().raw().toBuffer()
let manSum = 0
const manN = srcLeft.length / 3
for (let i = 0; i < srcLeft.length; i += 3) {
  manSum += (Math.abs(srcLeft[i] - outLeft[i]) + Math.abs(srcLeft[i + 1] - outLeft[i + 1]) + Math.abs(srcLeft[i + 2] - outLeft[i + 2])) / 3
}
const manMad = manN ? manSum / manN : 0
const report = {
  ok: mad >= 24 && manMad < 2,
  ms: Date.now() - started,
  womanMad: mad,
  womanChanged: mad >= 24,
  manMad,
  manLocked: manMad < 2,
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
process.exit(report.ok ? 0 : 1)
