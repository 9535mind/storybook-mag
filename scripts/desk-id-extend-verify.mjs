#!/usr/bin/env node
/** 증명 몸 잇기를 여기서 돌리고 그림모음에는 넣지 않는다. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-id-extend-verify')
const BASE = process.env.STORYMAG_BASE || 'https://27cdbc4d.storymag.pages.dev'
const SRC =
  process.env.DESK_ID_SRC ||
  path.join(
    ROOT,
    '..',
    '..',
    '..',
    '.cursor',
    'projects',
    'c-Users-UserK-Desktop-PLATFORM-fashion-magazine',
    'assets',
    'c__Users_UserK_AppData_Roaming_Cursor_User_workspaceStorage_445c76ae849c56e27af6a45e9bef9d4d_images_image-0f3dff53-1df1-462b-adfb-94fbffbe4e01.png',
  )
const ID_FALLBACK = path.join(
  'C:\\Users\\UserK\\.cursor\\projects\\c-Users-UserK-Desktop-PLATFORM-fashion-magazine\\assets',
  'c__Users_UserK_AppData_Roaming_Cursor_User_workspaceStorage_445c76ae849c56e27af6a45e9bef9d4d_images_image-0f3dff53-1df1-462b-adfb-94fbffbe4e01.png',
)
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

const srcPath = existsSync(SRC) ? SRC : ID_FALLBACK
if (!existsSync(srcPath)) throw new Error(`no_id ${srcPath}`)

const creds = loadCreds()
const auth = await login(creds)
const ident = await sharp(srcPath).rotate().resize({ width: 768, height: 1024, fit: 'inside' }).jpeg({ quality: 88 }).toBuffer()
const meta = await sharp(ident).metadata()
const cw = 768
const ch = 1152
const scale = Math.min((ch * 0.36) / Math.max(meta.height, 1), (cw * 0.7) / Math.max(meta.width, 1))
const dw = Math.max(32, Math.round(meta.width * scale))
const dh = Math.max(32, Math.round(meta.height * scale))
const idPlaced = await sharp(ident).resize(dw, dh, { fit: 'fill' }).jpeg({ quality: 90 }).toBuffer()
const hint = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}">
    <rect x="${Math.round(cw * 0.32)}" y="${Math.round(ch * 0.38)}" width="${Math.round(cw * 0.36)}" height="${Math.round(ch * 0.28)}" fill="#4a5056" fill-opacity="0.1"/>
    <rect x="${Math.round(cw * 0.38)}" y="${Math.round(ch * 0.64)}" width="${Math.round(cw * 0.1)}" height="${Math.round(ch * 0.22)}" fill="#4a5056" fill-opacity="0.1"/>
    <rect x="${Math.round(cw * 0.52)}" y="${Math.round(ch * 0.64)}" width="${Math.round(cw * 0.1)}" height="${Math.round(ch * 0.22)}" fill="#4a5056" fill-opacity="0.1"/>
  </svg>`,
)
const layout = await sharp({
  create: { width: cw, height: ch, channels: 3, background: { r: 74, g: 80, b: 86 } },
})
  .composite([
    { input: hint, left: 0, top: 0 },
    {
      input: idPlaced,
      left: Math.round((cw - dw) / 2),
      top: Math.round(ch * 0.04),
    },
  ])
  .jpeg({ quality: 90 })
  .toBuffer()
writeFileSync(path.join(OUT, '00-layout.jpg'), layout)
writeFileSync(path.join(OUT, '00-ident.jpg'), ident)

const submit = await api(
  '/api/tale-scene',
  {
    composeMode: 'extend-body',
    images: [toDataUrl(layout), toDataUrl(ident)],
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
console.log('submit', submit.http, submit.data.ok, submit.data.error || submit.data.message || submit.data.pending || 'ok')
if (!submit.data.ok) throw new Error(submit.data.message || submit.data.error || `http_${submit.http}`)
let url = submit.data.imageUrl
if (!url && submit.data.pending) {
  for (let i = 0; i < 80; i += 1) {
    await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 2500))
    const p = await api(
      '/api/tale-scene-status',
      { statusUrl: submit.data.statusUrl, responseUrl: submit.data.responseUrl },
      auth,
    )
    console.log('poll', i, p.data.status, p.data.pending)
    if (p.data.status === 'succeeded' && p.data.imageUrl) {
      url = p.data.imageUrl
      break
    }
    if (p.data.status === 'failed' || p.data.ok === false) throw new Error(p.data.message || p.data.error)
  }
}
if (!url) throw new Error('no_image')
const img = await fetch(url)
const buf = Buffer.from(await img.arrayBuffer())
writeFileSync(path.join(OUT, '01-extend.jpg'), buf)
console.log('saved', path.join(OUT, '01-extend.jpg'), buf.length)
