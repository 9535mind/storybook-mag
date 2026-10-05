#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TMP = path.join(ROOT, 'tmp-faceswap-test', 'desk-id-hand-draw')
const BASE = process.env.STORYMAG_BASE || 'https://6931f080.storymag.pages.dev'
const GALLERY = 'C:\\Users\\UserK\\Desktop\\그림모음'
mkdirSync(TMP, { recursive: true })
const { default: sharp } = await import('sharp')

function loadCreds() {
  const note = path.join(ROOT, '핀패스.txt')
  const n = existsSync(note) ? readFileSync(note, 'utf8') : ''
  const vars = existsSync(path.join(ROOT, '.dev.vars')) ? readFileSync(path.join(ROOT, '.dev.vars'), 'utf8') : ''
  return {
    pin: (n.match(/^핀\s+(\S+)/m) || [])[1]?.trim() || (vars.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim(),
    password: (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim(),
  }
}
function toDataUrl(buf) {
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}
async function login(creds) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password: creds.password }),
  })
  const data = await r.json().catch(() => ({}))
  if (!data.ok || !data.token) throw new Error(`login_${r.status}`)
  return { token: data.token, pin: creds.pin }
}
async function api(pathname, body, auth) {
  const headers = { 'Content-Type': 'application/json', 'x-session-token': auth.token }
  if (auth.pin) headers['x-admin-pin'] = auth.pin
  const res = await fetch(`${BASE}${pathname}`, { method: 'POST', headers, body: JSON.stringify(body) })
  return { http: res.status, data: await res.json().catch(() => ({})) }
}
async function waitScene(submit, auth, label) {
  if (submit.data.imageUrl) return submit.data.imageUrl
  if (!submit.data.pending) throw new Error(submit.data.message || submit.data.error || `${label}_no_pending`)
  for (let i = 0; i < 90; i += 1) {
    await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 2500))
    const p = await api(
      submit.data.predictionId ? '/api/generate-status' : '/api/tale-scene-status',
      submit.data.predictionId
        ? { predictionId: submit.data.predictionId }
        : { statusUrl: submit.data.statusUrl, responseUrl: submit.data.responseUrl },
      auth,
    )
    console.log(label, i, p.data.status || p.data.error || p.data.pending, p.data.message || '')
    if (p.data.status === 'succeeded' && p.data.imageUrl) return p.data.imageUrl
    if (p.data.imageUrl && p.data.ok !== false && !p.data.pending) return p.data.imageUrl
    if (p.data.status === 'failed' || p.data.ok === false) throw new Error(p.data.message || p.data.error || `${label}_fail`)
  }
  throw new Error(`${label}_timeout`)
}

const auth = await login(loadCreds())
async function run(name, file, extra) {
  const buf = await sharp(file).rotate().resize({ width: 880, height: 1184, fit: 'inside' }).jpeg({ quality: 90 }).toBuffer()
  const submit = await api(
    '/api/tale-scene',
    {
      composeMode: 'desk-still',
      deskLook: 'nude',
      deskCouple: false,
      forceReplicate: true,
      photoreal: true,
      aspectRatio: '3:4',
      images: [toDataUrl(buf)],
      ...extra,
    },
    auth,
  )
  console.log('submit', name, submit.http, submit.data.ok, submit.data.engine || '', submit.data.error || submit.data.pending || 'ok', submit.data.message || '')
  if (!submit.data.ok) throw new Error(submit.data.message || submit.data.error || name)
  const url = await waitScene(submit, auth, name)
  const img = Buffer.from(await (await fetch(url)).arrayBuffer())
  const dest = path.join(TMP, `${name}.jpg`)
  writeFileSync(dest, img)
  console.log('saved', dest, img.length)
}

await Promise.all([
  run('40-27-nude', path.join(GALLERY, '27.jpg'), {
    description: '나체 전신. 같은 얼굴 같은 자세. 옷 전부 없음. 팔 내려 손 보이게.',
  }).catch((e) => console.log('fail 27', e.message)),
  run('41-5-nude', path.join(GALLERY, '5.jfif'), {
    description: '나체 전신. 같은 얼굴 같은 자세. 분홍 니트와 치마 없음. 팔 내려 손 보이게.',
  }).catch((e) => console.log('fail 5', e.message)),
  run('42-3-nude', path.join(GALLERY, '3.png'), {
    description: '남자 나체 전신. 같은 얼굴. 네이비 정장 없음. 남자 가슴. 팔 내려 손 보이게.',
  }).catch((e) => console.log('fail 3', e.message)),
])
