#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.STORYMAG_BASE || 'https://00fecf35.storymag.pages.dev'
const SRC = path.join('C:', 'Users', 'UserK', 'Desktop', '그림모음', '61.jpg')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-extend-mw114', '04-skirt.jpg')
const { default: sharp } = await import('sharp')

function loadCreds() {
  const note = existsSync(path.join(ROOT, '핀패스.txt')) ? readFileSync(path.join(ROOT, '핀패스.txt'), 'utf8') : ''
  const vars = existsSync(path.join(ROOT, '.dev.vars')) ? readFileSync(path.join(ROOT, '.dev.vars'), 'utf8') : ''
  return {
    pin: (note.match(/^핀\s+(\S+)/m) || [])[1]?.trim() || (vars.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim(),
    password: (note.match(/패스워드\s+(\S+)/) || [])[1]?.trim(),
  }
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

const auth = await login(loadCreds())
const buf = await sharp(SRC).jpeg({ quality: 90 }).toBuffer()
const submit = await api(
  '/api/tale-scene',
  {
    composeMode: 'free-still',
    deskLook: 'extend-skirt',
    photoreal: true,
    aspectRatio: '3:4',
    description: 'pencil',
    images: [`data:image/jpeg;base64,${buf.toString('base64')}`],
  },
  auth,
)
console.log('submit', submit.http, submit.data.ok, submit.data.error, String(submit.data.prompt || '').slice(0, 140))
if (!submit.data.ok) process.exit(1)
let url = submit.data.imageUrl
if (!url && submit.data.pending) {
  for (let i = 0; i < 80; i += 1) {
    await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 2500))
    const p = await api(
      '/api/tale-scene-status',
      { statusUrl: submit.data.statusUrl, responseUrl: submit.data.responseUrl },
      auth,
    )
    console.log('poll', i, p.data.status || p.data.error)
    if (p.data.status === 'succeeded' && p.data.imageUrl) {
      url = p.data.imageUrl
      break
    }
    if (p.data.status === 'failed' || p.data.ok === false) throw new Error(p.data.message || p.data.error)
  }
}
if (!url) throw new Error('no_image')
const out = await sharp(Buffer.from(await (await fetch(url)).arrayBuffer())).jpeg({ quality: 90 }).toBuffer()
writeFileSync(OUT, out)
console.log('saved', OUT, out.length)
