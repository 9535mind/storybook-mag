/**
 * CAST 여·남(셀카 두 사람)으로 포옹·무릎 앉기 두 장을 직접 뽑는다.
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-cast-poses')
const SELFIE = path.join(ROOT, 'tmp-faceswap-test', 'review-0648', 'exact0.jpg')
const BASE = process.env.STORYMAG_BASE || 'https://storymag.mindstory.kr'
const pin = (fs.readFileSync(path.join(ROOT, '.dev.vars'), 'utf8').match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim()
if (!pin) throw new Error('no_admin_pin')
fs.mkdirSync(OUT, { recursive: true })

async function cropPerson(extract, name) {
  const buf = await sharp(SELFIE).extract(extract).jpeg({ quality: 90 }).toBuffer()
  const out = path.join(OUT, name)
  fs.writeFileSync(out, buf)
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

async function api(pathname, body) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
    body: JSON.stringify(body),
  })
  return { http: res.status, data: await res.json().catch(() => ({})) }
}

async function poll(statusUrl, responseUrl, label) {
  const t0 = Date.now()
  for (let i = 0; i < 70; i += 1) {
    await new Promise((r) => setTimeout(r, 2500))
    const { data } = await api('/api/tale-scene-status', { statusUrl, responseUrl })
    const sec = Math.round((Date.now() - t0) / 1000)
    console.log(`  [${label}] ${sec}s ${data.status || data.error || '?'}`)
    if (data.status === 'succeeded' && data.imageUrl) return data.imageUrl
    if (data.status === 'failed') throw new Error(data.message || data.error || 'failed')
    if (sec > 220) throw new Error('poll_timeout')
  }
  throw new Error('poll_exhausted')
}

async function pollReplicate(predictionId, label) {
  const t0 = Date.now()
  for (let i = 0; i < 70; i += 1) {
    await new Promise((r) => setTimeout(r, 2500))
    const { data } = await api('/api/generate-status', { predictionId })
    const sec = Math.round((Date.now() - t0) / 1000)
    console.log(`  [${label}] ${sec}s ${data.status || data.error || '?'}`)
    if (data.imageUrl) return data.imageUrl
    if (data.status === 'failed' || data.ok === false) throw new Error(data.message || data.error || 'failed')
    if (sec > 220) throw new Error('poll_timeout')
  }
  throw new Error('poll_exhausted')
}

async function save(url, name) {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  const out = path.join(OUT, name)
  fs.writeFileSync(out, buf)
  console.log('  saved', out, buf.length)
  return out
}

async function run(label, description, outName) {
  console.log(`\n=== ${label} ===`)
  const { http, data } = await api('/api/tale-scene', {
    composeMode: 'desk-still',
    deskStep: 'place',
    images: [pairUrl],
    description,
    photoreal: true,
    refKind: 'body',
    aspectRatio: '16:9',
    gender0: 'female',
    gender1: 'male',
    sourcePeople: 2,
  })
  console.log('  submit', http, data.ok, data.engine || data.composeMode, data.error || '')
  if (!data.ok) throw new Error(data.message || data.error || `http_${http}`)
  let url = data.imageUrl
  if (!url && data.pending && data.predictionId) url = await pollReplicate(data.predictionId, label)
  if (!url && data.pending) url = await poll(data.statusUrl, data.responseUrl, label)
  if (!url) throw new Error('no_image')
  return save(url, outName)
}

const meta = await sharp(SELFIE).metadata()
const w = meta.width || 528
const h = meta.height || 736
const womanBuf = await sharp(SELFIE)
  .extract({
    left: Math.round(w * 0.34),
    top: Math.round(h * 0.08),
    width: Math.round(w * 0.64),
    height: Math.round(h * 0.88),
  })
  .resize({ height: 720, fit: 'inside' })
  .jpeg({ quality: 90 })
  .toBuffer()
const manBuf = await sharp(SELFIE)
  .extract({
    left: 0,
    top: 0,
    width: Math.round(w * 0.52),
    height: Math.round(h * 0.58),
  })
  .resize({ height: 720, fit: 'inside' })
  .jpeg({ quality: 90 })
  .toBuffer()
fs.writeFileSync(path.join(OUT, 'cast-woman.jpg'), womanBuf)
fs.writeFileSync(path.join(OUT, 'cast-man.jpg'), manBuf)
const womanMeta = await sharp(womanBuf).metadata()
const manMeta = await sharp(manBuf).metadata()
const pair = await sharp({
  create: { width: 1400, height: 832, channels: 3, background: { r: 214, g: 212, b: 206 } },
})
  .composite([
    { input: womanBuf, left: 40, top: Math.max(0, Math.round((832 - (womanMeta.height || 720)) / 2)) },
    {
      input: manBuf,
      left: 1400 - 40 - (manMeta.width || 400),
      top: Math.max(0, Math.round((832 - (manMeta.height || 720)) / 2)),
    },
  ])
  .jpeg({ quality: 90 })
  .toBuffer()
fs.writeFileSync(path.join(OUT, 'cast-pair.jpg'), pair)
const pairUrl = `data:image/jpeg;base64,${pair.toString('base64')}`
const woman = `data:image/jpeg;base64,${womanBuf.toString('base64')}`
const man = `data:image/jpeg;base64,${manBuf.toString('base64')}`
console.log('crops', w, h, 'base', BASE)

await run(
  'hug-camera',
  '두 주연이 가벼운 포옹. 서로 얼굴을 맞대지 않고 둘 다 카메라를 바라본다. 옷은 유지. 스튜디오.',
  '1-hug-camera.jpg',
)
await run(
  'lap-sit',
  '남자 모델 무릎에 여자 모델이 앉아 있다. 여자는 카메라를 향해 앉아 있다. 서로 맞보지 않는다. 옷은 유지. 스튜디오.',
  '2-lap-sit.jpg',
)
console.log('\nDONE')
