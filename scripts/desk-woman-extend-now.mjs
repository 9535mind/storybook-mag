#!/usr/bin/env node
/** 39. 여 칸 2번 붙여 몸 잇기. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PIC = 'C:\\Users\\UserK\\Desktop\\그림모음'
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-woman-extend-now')
const BASE = process.env.STORYMAG_BASE || 'https://2348c57b.storymag.pages.dev'
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

const creds = loadCreds()
const auth = await login(creds)
const srcPath = existsSync(path.join(PIC, '2.png')) ? path.join(PIC, '2.png') : path.join(PIC, '9.PNG')
const ident = await sharp(srcPath).rotate().resize({ width: 768, height: 1024, fit: 'inside' }).jpeg({ quality: 88 }).toBuffer()
const meta = await sharp(ident).metadata()
const cw = 768
const ch = 1152
const faceH = Math.round(ch * 0.16)
const scale = faceH / Math.max(meta.height * 0.22, 1)
const dw = Math.max(8, Math.round(meta.width * Math.min(scale, 0.28)))
const dh = Math.max(8, Math.round(meta.height * Math.min(scale, 0.28)))
const faceTop = await sharp(ident)
  .extract({
    left: Math.round(meta.width * 0.18),
    top: 0,
    width: Math.max(32, Math.round(meta.width * 0.64)),
    height: Math.max(32, Math.round(meta.height * 0.28)),
  })
  .resize(Math.round(cw * 0.22), Math.round(ch * 0.16), { fit: 'cover' })
  .jpeg({ quality: 88 })
  .toBuffer()
const faceMeta = await sharp(faceTop).metadata()
const layout = await sharp({
  create: { width: cw, height: ch, channels: 3, background: { r: 236, g: 236, b: 238 } },
})
  .composite([
    {
      input: faceTop,
      left: Math.round((cw - faceMeta.width) / 2),
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
    description: '같은 니트 상의, 아이보리·베이지 타이트 초미니, 밑단은 팬티라인. 검정·A라인 금지, 한국 7등신',
    photoreal: true,
    extendMedium: 'photo',
    refKind: 'face',
    gender0: 'female',
    aspectRatio: '3:4',
    extendStyle: 'stand',
  },
  auth,
)
console.log('submit', submit.http, submit.data.ok, submit.data.error || submit.data.pending || 'ok')
if (!submit.data.ok) throw new Error(submit.data.message || submit.data.error || `http_${submit.http}`)
let url = submit.data.imageUrl
if (!url && submit.data.pending) {
  for (let i = 0; i < 70; i += 1) {
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
writeFileSync(path.join(PIC, '21-woman-extend.jpg'), buf)
console.log('saved', path.join(PIC, '21-woman-extend.jpg'), buf.length)
