#!/usr/bin/env node
/** 증명 얼굴 + 선 전신. 합격 후보만 tmp에 둔다. 그림모음에는 넣지 않는다. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-id-pass')
const PREV = path.join(ROOT, 'tmp-faceswap-test', 'desk-id-extend-verify')
const BASE = process.env.STORYMAG_BASE || 'https://6931f080.storymag.pages.dev'
const ID_CANDIDATES = [
  path.join(PREV, '00-ident.jpg'),
  path.join(
    'C:\\Users\\UserK\\.cursor\\projects\\c-Users-UserK-Desktop-PLATFORM-fashion-magazine\\assets',
    'c__Users_UserK_AppData_Roaming_Cursor_User_workspaceStorage_445c76ae849c56e27af6a45e9bef9d4d_images_image-0f3dff53-1df1-462b-adfb-94fbffbe4e01.png',
  ),
]
const BODY_26 = path.join(PREV, '03-insight.jpg')
const BODY_EXT = path.join(PREV, '01-extend.jpg')

mkdirSync(OUT, { recursive: true })
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

function toDataUrl(buf, mime = 'image/jpeg') {
  return `data:${mime};base64,${buf.toString('base64')}`
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
  const headers = {
    'Content-Type': 'application/json',
    'x-session-token': auth.token,
  }
  if (auth.pin) headers['x-admin-pin'] = auth.pin
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  return { http: res.status, data: await res.json().catch(() => ({})) }
}

async function waitScene(submit, auth, label) {
  let url = submit.data.imageUrl
  if (url) return url
  if (!submit.data.pending) throw new Error(submit.data.message || submit.data.error || `${label}_no_pending`)
  for (let i = 0; i < 90; i += 1) {
    await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 2500))
    const p = await api(
      '/api/tale-scene-status',
      { statusUrl: submit.data.statusUrl, responseUrl: submit.data.responseUrl },
      auth,
    )
    console.log('scene', label, i, p.data.status || p.data.error || p.data.pending)
    if (p.data.status === 'succeeded' && p.data.imageUrl) return p.data.imageUrl
    if (p.data.status === 'failed' || p.data.ok === false) throw new Error(p.data.message || p.data.error || `${label}_fail`)
  }
  throw new Error(`${label}_timeout`)
}

async function waitSwap(submit, auth, label) {
  let url = submit.data.imageUrl
  if (url) return url
  if (!submit.data.pending) throw new Error(submit.data.message || submit.data.error || `${label}_no_pending`)
  for (let i = 0; i < 80; i += 1) {
    await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 2500))
    const p = await api(
      '/api/face-swap-status',
      {
        engine: submit.data.engine,
        baseImageUrl: submit.data.baseImageUrl,
        statusUrl: submit.data.statusUrl,
        responseUrl: submit.data.responseUrl,
        predictionId: submit.data.predictionId,
      },
      auth,
    )
    console.log('swap', label, i, p.data.status || p.data.error || p.data.pending)
    if (p.data.status === 'succeeded' && p.data.imageUrl) return p.data.imageUrl
    if (p.data.imageUrl && p.data.ok !== false && !p.data.pending) return p.data.imageUrl
    if (p.data.status === 'failed' || p.data.ok === false) throw new Error(p.data.message || p.data.error || `${label}_fail`)
  }
  throw new Error(`${label}_timeout`)
}

async function saveUrl(url, name) {
  const img = await fetch(url)
  const buf = Buffer.from(await img.arrayBuffer())
  const dest = path.join(OUT, name)
  writeFileSync(dest, buf)
  console.log('saved', dest, buf.length)
  return dest
}

const idPath = ID_CANDIDATES.find((p) => existsSync(p))
if (!idPath) throw new Error('no_id')
const creds = loadCreds()
const auth = await login(creds)
const ident = await sharp(idPath).rotate().resize({ width: 1024, height: 1280, fit: 'inside' }).jpeg({ quality: 92 }).toBuffer()
writeFileSync(path.join(OUT, '00-ident.jpg'), ident)
const identUrl = toDataUrl(ident)

const jobs = []

jobs.push(
  (async () => {
    const meta = await sharp(ident).metadata()
    const cw = 768
    const ch = 1152
    const scale = Math.min((ch * 0.4) / Math.max(meta.height, 1), (cw * 0.78) / Math.max(meta.width, 1))
    const dw = Math.max(32, Math.round(meta.width * scale))
    const dh = Math.max(32, Math.round(meta.height * scale))
    const idPlaced = await sharp(ident).resize(dw, dh, { fit: 'fill' }).jpeg({ quality: 92 }).toBuffer()
    const hint = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}">
        <rect x="${Math.round(cw * 0.32)}" y="${Math.round(ch * 0.4)}" width="${Math.round(cw * 0.36)}" height="${Math.round(ch * 0.26)}" fill="#4a5056" fill-opacity="0.1"/>
        <rect x="${Math.round(cw * 0.38)}" y="${Math.round(ch * 0.64)}" width="${Math.round(cw * 0.1)}" height="${Math.round(ch * 0.22)}" fill="#4a5056" fill-opacity="0.1"/>
        <rect x="${Math.round(cw * 0.52)}" y="${Math.round(ch * 0.64)}" width="${Math.round(cw * 0.1)}" height="${Math.round(ch * 0.22)}" fill="#4a5056" fill-opacity="0.1"/>
      </svg>`,
    )
    const layout = await sharp({
      create: { width: cw, height: ch, channels: 3, background: { r: 74, g: 80, b: 86 } },
    })
      .composite([
        { input: hint, left: 0, top: 0 },
        { input: idPlaced, left: Math.round((cw - dw) / 2), top: Math.round(ch * 0.03) },
      ])
      .jpeg({ quality: 90 })
      .toBuffer()
    writeFileSync(path.join(OUT, '00-layout.jpg'), layout)
    const submit = await api(
      '/api/tale-scene',
      {
        composeMode: 'extend-body',
        images: [toDataUrl(layout), identUrl],
        description: '한 사람만. 같은 재킷·같은 머리. 잘린 아래만 잇는다. 두 사람·다른 여자·원피스·베이지 판 금지.',
        photoreal: true,
        extendMedium: 'photo',
        refKind: 'face',
        gender0: 'female',
        aspectRatio: '3:4',
        extendStyle: 'stand',
      },
      auth,
    )
    console.log('extend submit', submit.http, submit.data.ok, submit.data.error || submit.data.pending || 'ok')
    if (!submit.data.ok) throw new Error(submit.data.message || submit.data.error || 'extend_submit')
    const url = await waitScene(submit, auth, 'extend')
    await saveUrl(url, '01-extend.jpg')
    const hold = await api(
      '/api/face-swap',
      {
        targetImage: toDataUrl(readFileSync(path.join(OUT, '01-extend.jpg'))),
        face0: identUrl,
        gender0: 'female',
        engine: 'insight',
        workflowType: 'user_hair',
        upscale: true,
      },
      auth,
    )
    console.log('insight-new submit', hold.http, hold.data.ok, hold.data.error || hold.data.pending || 'ok')
    if (!hold.data.ok) throw new Error(hold.data.message || hold.data.error || 'insight_new')
    const held = await waitSwap(hold, auth, 'insight-new')
    await saveUrl(held, '02-insight-new.jpg')
  })().catch((err) => console.log('fail extend-chain', err instanceof Error ? err.message : String(err))),
)

for (const [name, bodyPath, engine] of [
  ['insight-26', BODY_26, 'insight'],
  ['kontext-26', BODY_26, 'kontext'],
  ['insight-ext', BODY_EXT, 'insight'],
]) {
  if (!existsSync(bodyPath)) continue
  jobs.push(
    (async () => {
      const submit = await api(
        '/api/face-swap',
        {
          targetImage: toDataUrl(readFileSync(bodyPath)),
          face0: identUrl,
          gender0: 'female',
          engine,
          workflowType: 'user_hair',
          upscale: true,
          keepFullBody: engine === 'kontext',
        },
        auth,
      )
      console.log('submit', name, submit.http, submit.data.ok, submit.data.error || submit.data.pending || 'ok')
      if (!submit.data.ok) throw new Error(submit.data.message || submit.data.error || name)
      const url = await waitSwap(submit, auth, name)
      await saveUrl(url, `03-${name}.jpg`)
    })().catch((err) => console.log('fail', name, err instanceof Error ? err.message : String(err))),
  )
}

await Promise.all(jobs)
console.log('done', OUT)
