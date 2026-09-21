/** 사용자 원본 얼굴 → 전신 + InsightFace 정체성 실측 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'try-stand-same')
const BASE = process.env.STORYMAG_BASE || ''
const SHOT =
  'C:/Users/UserK/.cursor/projects/c-Users-UserK-Desktop-PLATFORM-fashion-magazine/assets/c__Users_UserK_AppData_Roaming_Cursor_User_workspaceStorage_445c76ae849c56e27af6a45e9bef9d4d_images_image-a6efcdb9-5dfe-456f-b23a-94489d65a0e8.png'

function loadCreds() {
  const note = path.join(ROOT, '핀패스.txt')
  const n = fs.existsSync(note) ? fs.readFileSync(note, 'utf8') : ''
  const pin = (n.match(/^핀\s+(\S+)/m) || [])[1]?.trim()
  const password = (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim()
  if (!pin) {
    const t = fs.readFileSync(path.join(ROOT, '.dev.vars'), 'utf8')
    return { pin: (t.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim(), password }
  }
  return { pin, password }
}

function toDataUrl(buf, mime = 'image/jpeg') {
  return `data:${mime};base64,${buf.toString('base64')}`
}

async function loginSession(password) {
  if (!password) return ''
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password }),
  })
  const data = await r.json().catch(() => ({}))
  if (!data.ok || !data.token) throw new Error(`login_failed_${r.status}`)
  return data.token
}

async function api(pathname, body, auth) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth?.token) headers['x-session-token'] = auth.token
  if (auth?.pin) headers['x-admin-pin'] = auth.pin
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { http: res.status, data }
}

async function poll(auth, extra, label, pathName) {
  const started = Date.now()
  for (let i = 0; i < 70; i += 1) {
    await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 2500))
    const { http, data } = await api(pathName, extra, auth)
    const sec = Math.round((Date.now() - started) / 1000)
    console.log(`  [${label}] poll ${sec}s http=${http} status=${data.status}`)
    if (data.status === 'succeeded' && data.imageUrl) return data.imageUrl
    if (data.status === 'failed' || data.ok === false) {
      throw new Error(data.message || data.error || 'failed')
    }
    if (sec > 220) throw new Error('poll_timeout')
  }
  throw new Error('poll_exhausted')
}

async function postTale(auth, payload, label) {
  const { http, data } = await api('/api/tale-scene', payload, auth)
  console.log(`  [${label}] submit http=${http} ok=${data.ok} ${data.error || data.pending || 'immediate'}`)
  if (!data.ok) throw new Error(data.message || data.error || `http_${http}`)
  if (data.imageUrl) return data.imageUrl
  if (data.pending) {
    return poll(auth, { statusUrl: data.statusUrl, responseUrl: data.responseUrl }, label, '/api/tale-scene-status')
  }
  throw new Error('no_image')
}

async function postSwap(auth, payload, label) {
  const { http, data } = await api('/api/face-swap', payload, auth)
  console.log(`  [${label}] submit http=${http} ok=${data.ok} ${data.error || data.pending || 'immediate'}`)
  if (!data.ok) throw new Error(data.message || data.error || `http_${http}`)
  if (data.imageUrl) return data.imageUrl
  if (data.pending) {
    return poll(
      auth,
      {
        statusUrl: data.statusUrl,
        responseUrl: data.responseUrl,
        predictionId: data.predictionId,
        engine: data.engine,
        baseImageUrl: data.baseImageUrl,
      },
      label,
      '/api/face-swap-status',
    )
  }
  throw new Error('no_image')
}

async function saveUrl(url, dest) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`download_${r.status}`)
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
}

async function buildStudioBust(buf) {
  const meta = await sharp(buf).metadata()
  const cw = 768
  const ch = 1152
  const scale = Math.min((ch * 0.42) / Math.max(meta.height, 1), (cw * 0.52) / Math.max(meta.width, 1))
  const dw = Math.max(8, Math.round(meta.width * scale))
  const dh = Math.max(8, Math.round(meta.height * scale))
  const dx = Math.round((cw - dw) / 2)
  const dy = Math.round(ch * 0.04)
  const resized = await sharp(buf).resize(dw, dh).jpeg({ quality: 92 }).toBuffer()
  return sharp({
    create: { width: cw, height: ch, channels: 3, background: { r: 236, g: 236, b: 236 } },
  })
    .composite([{ input: resized, left: dx, top: dy }])
    .jpeg({ quality: 92 })
    .toBuffer()
}

async function main() {
  if (!BASE) throw new Error('set STORYMAG_BASE')
  fs.mkdirSync(OUT, { recursive: true })
  const original = await sharp(SHOT).extract({ left: 8, top: 70, width: 400, height: 238 }).jpeg({ quality: 94 }).toBuffer()
  fs.writeFileSync(path.join(OUT, '0-original.jpg'), original)
  const studio = await buildStudioBust(original)
  fs.writeFileSync(path.join(OUT, '0-studio.jpg'), studio)
  const creds = loadCreds()
  const token = await loginSession(creds.password)
  const auth = { pin: creds.pin, token }
  console.log('=== extend with identity ===')
  const standUrl = await postTale(
    auth,
    {
      composeMode: 'extend-body',
      images: [toDataUrl(studio), toDataUrl(original)],
      description: '같은 옷으로 허리 다리 신발까지',
      photoreal: true,
      refKind: 'face',
      gender0: 'female',
      aspectRatio: '3:4',
      extendStyle: 'stand',
    },
    'stand',
  )
  const standPath = path.join(OUT, '1-stand.jpg')
  await saveUrl(standUrl, standPath)
  console.log('=== insight face lock ===')
  const lockedUrl = await postSwap(
    auth,
    {
      engine: 'insight',
      targetSide: 'gender',
      targetImage: toDataUrl(fs.readFileSync(standPath)),
      face0: toDataUrl(original),
      gender0: 'female',
      upscale: false,
      workflowType: 'user_hair',
    },
    'insight',
  )
  const lockedPath = path.join(OUT, '2-locked.jpg')
  await saveUrl(lockedUrl, lockedPath)
  console.log(`saved ${lockedPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
