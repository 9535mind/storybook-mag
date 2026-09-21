/**
 * 얼굴로 장면 / 전신으로 장면만 재시도 (검은 화면 검출 포함)
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const ASSETS =
  'C:/Users/UserK/.cursor/projects/c-Users-UserK-Desktop-PLATFORM-fashion-magazine/assets'
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'try3b')
const BASE = process.env.STORYMAG_BASE || 'http://127.0.0.1:8788'

const pin = (fs.readFileSync(path.join(ROOT, '.dev.vars'), 'utf8').match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim()
if (!pin) throw new Error('no_admin_pin')
fs.mkdirSync(OUT, { recursive: true })

async function fileDataUrl(name, maxDim = 900) {
  let img = sharp(path.join(ASSETS, name))
  const m = await img.metadata()
  const long = Math.max(m.width || 1, m.height || 1)
  if (long > maxDim) {
    img = img.resize({
      width: m.width >= m.height ? maxDim : undefined,
      height: m.height > m.width ? maxDim : undefined,
      fit: 'inside',
    })
  }
  return `data:image/jpeg;base64,${(await img.jpeg({ quality: 88 }).toBuffer()).toString('base64')}`
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
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 2000))
    const { data } = await api('/api/tale-scene-status', { statusUrl, responseUrl })
    const sec = Math.round((Date.now() - t0) / 1000)
    console.log(`  [${label}] ${sec}s ${data.status}`)
    if (data.status === 'succeeded' && data.imageUrl) return data.imageUrl
    if (data.status === 'failed') throw new Error(data.message || data.error || 'failed')
    if (sec > 200) throw new Error('poll_timeout')
  }
  throw new Error('poll_exhausted')
}

async function save(url, name) {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let bright = 0
  const step = Math.max(1, Math.floor((info.width * info.height) / 4000))
  for (let i = 0; i < info.width * info.height; i += step) {
    const o = i * info.channels
    if (data[o] + data[o + 1] + data[o + 2] > 40) bright += 1
  }
  console.log(`  ${name} bytes=${buf.length} bright=${bright} ${info.width}x${info.height}`)
  if (bright < 8) throw new Error('nearly_black_image')
  const out = path.join(OUT, name)
  fs.writeFileSync(out, buf)
  console.log('  OK', out)
  return out
}

async function run(label, images, description, refKind, outName) {
  console.log(`\n=== ${label} ===`)
  console.log('  desc:', description)
  const { http, data } = await api('/api/tale-scene', {
    images,
    description,
    photoreal: true,
    refKind,
    aspectRatio: '9:16',
    gender0: 'female',
  })
  console.log('  submit', http, data.ok, data.pending ? 'pending' : data.error || 'ok')
  if (data.prompt) console.log('  prompt head:', data.prompt.slice(0, 160).replace(/\n/g, ' | '))
  if (!data.ok) throw new Error(data.message || data.error || `http_${http}`)
  let url = data.imageUrl
  if (!url && data.pending) url = await poll(data.statusUrl, data.responseUrl, label)
  if (!url) throw new Error('no_image')
  return save(url, outName)
}

const face = await fileDataUrl('sample-id-photo-woman.png')
const body = await fileDataUrl('test-source-clothed.png', 1100).catch(() =>
  fileDataUrl('couple-fashion-photo.png', 1100),
)

let ok2 = false
let ok3 = false
try {
  await run(
    '2 face→scene',
    [face],
    '해변에서 흰 원피스를 입고 웃으며 걷는 전신 사진, 자연광, 실사',
    'face',
    '2-face-to-scene.jpg',
  )
  ok2 = true
} catch (e) {
  console.error('  FAIL 2:', e.message)
}

try {
  await run(
    '3 body→scene',
    [body],
    '저녁 네온 거리, 같은 체형으로 코트를 입고 걷기, 전신, 실사',
    'body',
    '3-body-to-scene.jpg',
  )
  ok3 = true
} catch (e) {
  console.error('  FAIL 3:', e.message)
}

console.log('\n=== SUMMARY ===')
console.log('2 face-scene:', ok2 ? 'OK' : 'FAIL')
console.log('3 body-scene:', ok3 ? 'OK' : 'FAIL')
console.log('outdir:', OUT)
process.exit(ok2 && ok3 ? 0 : 1)
