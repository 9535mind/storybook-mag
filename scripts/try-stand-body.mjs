/** 몸 잇기: 상반신 → Kontext 전신 실측 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'try-stand')
const BASE = process.env.STORYMAG_BASE || ''
const SRC = path.join(ROOT, 'tmp-faceswap-test', 'woman-face-id.jpg')

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

async function pollScene(statusUrl, responseUrl, auth, label) {
  const started = Date.now()
  for (let i = 0; i < 70; i += 1) {
    await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 2500))
    const { http, data } = await api('/api/tale-scene-status', { statusUrl, responseUrl }, auth)
    const sec = Math.round((Date.now() - started) / 1000)
    console.log(`  [${label}] poll ${sec}s http=${http} status=${data.status} pending=${data.pending}`)
    if (data.status === 'succeeded' && data.imageUrl) return data.imageUrl
    if (data.status === 'failed' || data.ok === false) {
      throw new Error(data.message || data.error || 'scene_failed')
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
  if (data.pending) return pollScene(data.statusUrl, data.responseUrl, auth, label)
  throw new Error('no_image')
}

async function saveUrl(url, dest) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`download_${r.status}`)
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
}

async function buildStudioBust(file) {
  const src = await sharp(file).rotate().jpeg({ quality: 92 }).toBuffer()
  const meta = await sharp(src).metadata()
  const cw = 768
  const ch = 1152
  const scale = Math.min((ch * 0.42) / Math.max(meta.height, 1), (cw * 0.52) / Math.max(meta.width, 1))
  const dw = Math.max(8, Math.round(meta.width * scale))
  const dh = Math.max(8, Math.round(meta.height * scale))
  const dx = Math.round((cw - dw) / 2)
  const dy = Math.round(ch * 0.04)
  const resized = await sharp(src).resize(dw, dh).jpeg({ quality: 92 }).toBuffer()
  const wall = await sharp({
    create: { width: cw, height: ch, channels: 3, background: { r: 236, g: 236, b: 236 } },
  })
    .composite([{ input: resized, left: dx, top: dy }])
    .jpeg({ quality: 92 })
    .toBuffer()
  return wall
}

async function main() {
  if (!BASE) throw new Error('set STORYMAG_BASE')
  fs.mkdirSync(OUT, { recursive: true })
  const creds = loadCreds()
  const token = await loginSession(creds.password)
  const auth = { pin: creds.pin, token }
  const studio = await buildStudioBust(SRC)
  fs.writeFileSync(path.join(OUT, '0-studio-bust.jpg'), studio)
  console.log('=== stand from studio bust ===')
  const url = await postTale(
    auth,
    {
      composeMode: 'extend-body',
      images: [toDataUrl(studio)],
      description: '같은 옷으로 허리 다리 신발까지',
      photoreal: true,
      refKind: 'face',
      gender0: 'female',
      aspectRatio: '3:4',
      extendStyle: 'stand',
    },
    'stand',
  )
  const dest = path.join(OUT, '1-stand.jpg')
  await saveUrl(url, dest)
  const info = await sharp(dest).metadata()
  console.log(`saved ${dest} ${info.width}x${info.height}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
