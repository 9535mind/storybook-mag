/**
 * 얼굴·장면 3종 스모크 테스트 (로컬 Pages + .dev.vars)
 * 1) 얼굴 바꾸기(하드 덮어쓰기)  2) 얼굴로 장면  3) 전신·반신으로 장면
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const ASSETS =
  'C:/Users/UserK/.cursor/projects/c-Users-UserK-Desktop-PLATFORM-fashion-magazine/assets'
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'try3')
const BASE = process.env.STORYMAG_BASE || 'http://127.0.0.1:8788'

function loadEnv() {
  const t = fs.readFileSync(path.join(ROOT, '.dev.vars'), 'utf8')
  const pin = (t.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim()
  return { pin }
}

function toDataUrl(buf, mime = 'image/jpeg') {
  return `data:${mime};base64,${buf.toString('base64')}`
}

async function fileDataUrl(name, maxDim = 1200) {
  const p = path.join(ASSETS, name)
  let img = sharp(p)
  const m = await img.metadata()
  const long = Math.max(m.width || 1, m.height || 1)
  if (long > maxDim) {
    img = img.resize({
      width: m.width >= m.height ? maxDim : undefined,
      height: m.height > m.width ? maxDim : undefined,
      fit: 'inside',
    })
  }
  const buf = await img.jpeg({ quality: 88 }).toBuffer()
  return toDataUrl(buf)
}

async function api(pathname, body, pin) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': pin,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { http: res.status, data }
}

async function pollScene(statusUrl, responseUrl, pin, label) {
  const started = Date.now()
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 2500))
    const { http, data } = await api(
      '/api/tale-scene-status',
      { statusUrl, responseUrl },
      pin,
    )
    const sec = Math.round((Date.now() - started) / 1000)
    console.log(`  [${label}] poll ${sec}s http=${http} status=${data.status} pending=${data.pending}`)
    if (data.status === 'succeeded' && data.imageUrl) return data.imageUrl
    if (data.status === 'failed' || data.ok === false) {
      throw new Error(data.message || data.error || 'scene_failed')
    }
    if (sec > 200) throw new Error('poll_timeout')
  }
  throw new Error('poll_exhausted')
}

async function saveRemote(url, name) {
  const res = await fetch(url)
  const buf = Buffer.from(await res.arrayBuffer())
  const ct = (res.headers.get('content-type') || '').toLowerCase()
  const looksHtml =
    ct.includes('text/html') ||
    buf.slice(0, 64).toString('utf8').trimStart().toLowerCase().startsWith('<!doctype') ||
    buf.slice(0, 64).toString('utf8').trimStart().toLowerCase().startsWith('<html')
  if (!res.ok || looksHtml || buf.length < 2000) {
    throw new Error(`bad_image http=${res.status} ct=${ct} bytes=${buf.length} url=${url.slice(0, 80)}`)
  }
  // fal 안전필터가 검은 PNG를 주는 경우(실측 ~10KB 단색)
  try {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let bright = 0
    const step = Math.max(1, Math.floor((info.width * info.height) / 4000))
    for (let i = 0; i < info.width * info.height; i += step) {
      const o = i * info.channels
      if (data[o] + data[o + 1] + data[o + 2] > 40) bright += 1
    }
    if (bright < 8) throw new Error('nearly_black_image (fal blanked)')
  } catch (e) {
    if (String(e.message || e).includes('nearly_black')) throw e
  }
  const out = path.join(OUT, name)
  fs.writeFileSync(out, buf)
  console.log('  saved', out, buf.length, url.slice(0, 72))
  return out
}

async function test1HardReplace() {
  console.log('\n=== 1) 얼굴 바꾸기 (하드 덮어쓰기) ===')
  const target = await sharp(path.join(ASSETS, 'couple-fashion-photo.png'))
    .resize(1024, null, { fit: 'inside' })
    .jpeg()
    .toBuffer()
  const idMan = await sharp(path.join(ASSETS, 'sample-id-photo-man.png'))
    .resize(512, 512, { fit: 'cover' })
    .jpeg()
    .toBuffer()
  const idWoman = await sharp(path.join(ASSETS, 'sample-id-photo-woman.png'))
    .resize(512, 512, { fit: 'cover' })
    .jpeg()
    .toBuffer()
  const meta = await sharp(target).metadata()
  const W = meta.width
  const H = meta.height
  const cut = Math.round(W * 0.54)
  const left = await sharp(target).extract({ left: 0, top: 0, width: cut, height: H }).toBuffer()
  const right = await sharp(target)
    .extract({ left: W - cut, top: 0, width: cut, height: H })
    .toBuffer()

  async function paste(half, idBuf, box) {
    const hm = await sharp(half).metadata()
    const dw = Math.round(box.w * hm.width)
    const dh = Math.round(box.h * hm.height)
    const dx = Math.round(box.x * hm.width)
    const dy = Math.round(box.y * hm.height)
    const patch = await sharp(idBuf).resize(dw, dh, { fit: 'cover' }).png().toBuffer()
    const svg = Buffer.from(
      `<svg width="${dw}" height="${dh}" xmlns="http://www.w3.org/2000/svg">
        <defs><radialGradient id="g" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stop-color="white"/><stop offset="78%" stop-color="white"/>
          <stop offset="100%" stop-color="black"/>
        </radialGradient></defs>
        <ellipse cx="${dw / 2}" cy="${dh / 2}" rx="${dw * 0.48}" ry="${dh * 0.52}" fill="url(#g)"/>
      </svg>`,
    )
    const masked = await sharp(patch).composite([{ input: svg, blend: 'dest-in' }]).png().toBuffer()
    return sharp(half)
      .composite([{ input: masked, left: Math.max(0, dx), top: Math.max(0, dy) }])
      .jpeg()
      .toBuffer()
  }

  const leftOut = await paste(left, idMan, { x: 0.5, y: 0.06, w: 0.36, h: 0.36 })
  const rightOut = await paste(right, idWoman, { x: 0.02, y: 0.04, w: 0.48, h: 0.42 })
  const result = await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([
      { input: leftOut, left: 0, top: 0 },
      { input: rightOut, left: W - cut, top: 0 },
    ])
    .jpeg({ quality: 90 })
    .toBuffer()
  const out = path.join(OUT, '1-face-swap-hard.jpg')
  fs.writeFileSync(out, result)
  console.log('  OK', out)
  return out
}

async function testScene(pin, label, images, description, refKind, outName) {
  console.log(`\n=== ${label} ===`)
  console.log('  desc:', description)
  const { http, data } = await api(
    '/api/tale-scene',
    {
      images,
      description,
      photoreal: true,
      refKind,
      aspectRatio: '9:16',
      gender0: 'female',
      gender1: images.length > 1 ? 'male' : undefined,
    },
    pin,
  )
  console.log('  submit', http, data.ok, data.error || data.pending || 'immediate')
  if (!data.ok) throw new Error(data.message || data.error || `http_${http}`)
  let url = data.imageUrl
  if (!url && data.pending) {
    url = await pollScene(data.statusUrl, data.responseUrl, pin, label)
  }
  if (!url) throw new Error('no_image')
  return saveRemote(url, outName)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { pin } = loadEnv()
  if (!pin) throw new Error('no_admin_pin')

  // health
  try {
    const ping = await fetch(BASE + '/')
    console.log('server', BASE, ping.status)
  } catch (e) {
    console.error('서버가 안 떠 있어요. wrangler pages dev 를 먼저 켜 주세요.', e.message)
    process.exit(1)
  }

  const r1 = await test1HardReplace()

  const faceWoman = await fileDataUrl('sample-id-photo-woman.png', 900)
  const faceMan = await fileDataUrl('sample-id-photo-man.png', 900)
  const bodyCouple = await fileDataUrl('couple-fashion-photo.png', 1100)
  const bodyWoman = await fileDataUrl('test-source-clothed.png', 1100).catch(() =>
    fileDataUrl('korean-couple-fashion-photo.png', 1100),
  )

  let r2 = null
  let r3 = null
  try {
    r2 = await testScene(
      pin,
      '2) 얼굴로 장면',
      [faceWoman],
      '해변에서 흰 원피스를 입고 웃으며 걷는 전신 사진, 자연광, 실사',
      'face',
      '2-face-to-scene.jpg',
    )
  } catch (e) {
    console.error('  FAIL 2:', e.message)
  }

  try {
    r3 = await testScene(
      pin,
      '3) 전신·반신으로 장면',
      [bodyWoman],
      '저녁 네온 거리, 같은 체형으로 코트를 입고 걷기, 전신, 실사',
      'body',
      '3-body-to-scene.jpg',
    )
  } catch (e) {
    console.error('  FAIL 3:', e.message)
  }

  // optional 2-person face scene
  try {
    await testScene(
      pin,
      '2b) 얼굴로 장면 (2명)',
      [faceWoman, faceMan],
      '카페 창가에서 두 사람이 커피를 마시며 이야기하는 사진, 자연광',
      'face',
      '2b-face-to-scene-couple.jpg',
    )
  } catch (e) {
    console.error('  FAIL 2b:', e.message)
  }

  console.log('\n=== SUMMARY ===')
  console.log('1 face-swap:', r1 ? 'OK' : 'FAIL')
  console.log('2 face-scene:', r2 ? 'OK' : 'FAIL')
  console.log('3 body-scene:', r3 ? 'OK' : 'FAIL')
  console.log('outdir:', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
