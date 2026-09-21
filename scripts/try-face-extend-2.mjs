/**
 * 사용자 전신 컷(타원 잔상 있는 샷)으로
 * 1) BiRefNet 분리 → 스튜디오 합성 → scene-bg
 * 2) 얼굴 크롭 → extend-body 재시도
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'try-extend')
const BASE = process.env.STORYMAG_BASE || 'https://160b5641.storymag.pages.dev'
const LEFTOVER = path.join(OUT, '0-leftover-birefnet.png')
const LEFTOVER_SRC =
  'C:/Users/UserK/.cursor/projects/c-Users-UserK-Desktop-PLATFORM-fashion-magazine/assets/c__Users_UserK_AppData_Roaming_Cursor_User_workspaceStorage_445c76ae849c56e27af6a45e9bef9d4d_images_image-f82c8131-aa64-43da-baff-6fc0ffd06397.png'

function loadPassword() {
  const n = fs.readFileSync(path.join(ROOT, '핀패스.txt'), 'utf8')
  return (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim()
}

function toDataUrl(buf, mime = 'image/jpeg') {
  return `data:${mime};base64,${buf.toString('base64')}`
}

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password: loadPassword() }),
  })
  const data = await r.json()
  if (!data.ok || !data.token) throw new Error(`login_${r.status}`)
  return data.token
}

async function api(pathname, body, token) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': token,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { http: res.status, data }
}

async function poll(statusUrl, responseUrl, token, label) {
  const started = Date.now()
  for (let i = 0; i < 70; i += 1) {
    await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 2500))
    const { http, data } = await api('/api/tale-scene-status', { statusUrl, responseUrl }, token)
    const sec = Math.round((Date.now() - started) / 1000)
    console.log(`  [${label}] poll ${sec}s http=${http} status=${data.status}`)
    if (data.status === 'succeeded' && data.imageUrl) return data.imageUrl
    if (data.status === 'failed' || data.ok === false) throw new Error(data.message || data.error)
    if (sec > 220) throw new Error('poll_timeout')
  }
  throw new Error('poll_exhausted')
}

async function postTale(token, payload, label) {
  const { http, data } = await api('/api/tale-scene', payload, token)
  console.log(`  [${label}] submit http=${http} ok=${data.ok} ${data.error || data.pending || 'immediate'}`)
  if (!data.ok) throw new Error(data.message || data.error || `http_${http}`)
  if (data.imageUrl) return data.imageUrl
  if (data.pending) return poll(data.statusUrl, data.responseUrl, token, label)
  throw new Error('no_image')
}

async function saveRemote(url, name) {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  fs.writeFileSync(path.join(OUT, name), buf)
  console.log('  saved', name, buf.length)
  return path.join(OUT, name)
}

async function isBlack(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let bright = 0
  const n = info.width * info.height
  const step = Math.max(1, Math.floor(n / 4000))
  for (let i = 0; i < n; i += step) {
    const o = i * info.channels
    if (data[o] + data[o + 1] + data[o + 2] > 40) bright += 1
  }
  return bright < 8
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const token = await login()
  console.log('session ok')

  // 1) 분리된 커플을 9:16 스튜디오에 올리고 배경 인페인트
  const cut = await sharp(LEFTOVER).ensureAlpha().png().toBuffer()
  const meta = await sharp(cut).metadata()
  const [cw, ch] = [768, 1365]
  const scale = Math.min((cw * 0.92) / meta.width, (ch * 0.88) / meta.height)
  const dw = Math.round(meta.width * scale)
  const dh = Math.round(meta.height * scale)
  const dx = Math.round((cw - dw) / 2)
  const dy = Math.round(ch - dh - ch * 0.04)
  const resized = await sharp(cut).resize(dw, dh).png().toBuffer()
  const composite = await sharp({
    create: { width: cw, height: ch, channels: 3, background: { r: 239, g: 239, b: 239 } },
  })
    .composite([{ input: resized, left: dx, top: dy }])
    .jpeg({ quality: 92 })
    .toBuffer()
  fs.writeFileSync(path.join(OUT, '4-studio-composite.jpg'), composite)

  const mask = Buffer.from(
    await sharp({
      create: { width: cw, height: ch, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite([{ input: resized, left: dx, top: dy, blend: 'dest-out' }])
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => {
        for (let p = 0; p < data.length; p += info.channels) {
          const keep = data[p] < 128
          const v = keep ? 0 : 255
          data[p] = v
          data[p + 1] = v
          data[p + 2] = v
        }
        return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
          .png()
          .toBuffer()
      }),
  )
  fs.writeFileSync(path.join(OUT, '4-studio-mask.png'), mask)

  console.log('\n=== scene-bg on clean cut ===')
  const bgUrl = await postTale(
    token,
    {
      composeMode: 'scene-bg',
      images: [toDataUrl(composite), toDataUrl(mask, 'image/png')],
      description: '두 사람이 나란히 서 있는 전신 사진, 실사',
      photoreal: true,
      refKind: 'face',
      aspectRatio: '9:16',
    },
    'scene-bg-clean',
  )
  const finalPath = await saveRemote(bgUrl, '4-final-clean.jpg')
  console.log('  final black?', await isBlack(finalPath))

  // 2) 원본에서 얼굴 크롭 → extend-body
  console.log('\n=== extend-body from leftover faces ===')
  const src = sharp(LEFTOVER_SRC)
  const sm = await src.metadata()
  const w = sm.width
  const h = sm.height
  const womanId = await sharp(LEFTOVER_SRC)
    .extract({
      left: Math.round(w * 0.08),
      top: Math.round(h * 0.12),
      width: Math.round(w * 0.38),
      height: Math.round(h * 0.28),
    })
    .jpeg({ quality: 90 })
    .toBuffer()
  const manId = await sharp(LEFTOVER_SRC)
    .extract({
      left: Math.round(w * 0.48),
      top: Math.round(h * 0.06),
      width: Math.round(w * 0.42),
      height: Math.round(h * 0.28),
    })
    .jpeg({ quality: 90 })
    .toBuffer()
  fs.writeFileSync(path.join(OUT, '5-woman-id.jpg'), womanId)
  fs.writeFileSync(path.join(OUT, '5-man-id.jpg'), manId)

  for (const job of [
    { buf: womanId, gender: 'female', tag: '5-woman' },
    { buf: manId, gender: 'male', tag: '5-man' },
  ]) {
    const meta2 = await sharp(job.buf).metadata()
    const canvas = await sharp({
      create: { width: 768, height: 1024, channels: 3, background: { r: 217, g: 217, b: 217 } },
    })
      .composite([
        {
          input: await sharp(job.buf)
            .resize({
              width: Math.round(768 * 0.55),
              height: Math.round(1024 * 0.42),
              fit: 'inside',
            })
            .jpeg()
            .toBuffer(),
          gravity: 'north',
        },
      ])
      .jpeg({ quality: 92 })
      .toBuffer()
    fs.writeFileSync(path.join(OUT, `${job.tag}-canvas.jpg`), canvas)
    console.log(`\n-- ${job.tag} ${meta2.width}x${meta2.height} --`)
    const url = await postTale(
      token,
      {
        composeMode: 'extend-body',
        images: [toDataUrl(canvas)],
        description: '두 사람이 나란히 서 있는 전신 사진, 실사',
        photoreal: true,
        refKind: 'face',
        gender0: job.gender,
      },
      `${job.tag} extend`,
    )
    const bodyPath = await saveRemote(url, `${job.tag}-body.jpg`)
    const black = await isBlack(bodyPath)
    console.log('  black?', black)
    if (!black) {
      const rb = await api('/api/remove-background', { imageUrl: url }, token)
      console.log('  birefnet', rb.http, rb.data.ok)
      if (rb.data.ok && rb.data.imageUrl) await saveRemote(rb.data.imageUrl, `${job.tag}-birefnet.png`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
