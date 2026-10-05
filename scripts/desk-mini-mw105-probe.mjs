#!/usr/bin/env node
/** 유료 1장. 42번 미니보다 단·타이트 10% 강한 서버 경로. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TMP = path.join(ROOT, 'tmp-faceswap-test', 'desk-mini-mw105')
const BASE = process.env.STORYMAG_BASE || 'https://storymag.mindstory.kr'
const SRC = process.env.MINI_SRC || 'C:\\Users\\UserK\\Desktop\\그림모음\\42.png'
mkdirSync(TMP, { recursive: true })

function loadCreds() {
  const note = path.join(ROOT, '핀패스.txt')
  const n = existsSync(note) ? readFileSync(note, 'utf8') : ''
  const vars = existsSync(path.join(ROOT, '.dev.vars')) ? readFileSync(path.join(ROOT, '.dev.vars'), 'utf8') : ''
  return {
    pin: (n.match(/^핀\s+(\S+)/m) || [])[1]?.trim() || (vars.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim(),
    password: (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim(),
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

const { default: sharp } = await import('sharp')
const auth = await login(loadCreds())
const buf = await sharp(SRC).rotate().resize({ width: 880, height: 1184, fit: 'inside' }).jpeg({ quality: 90 }).toBuffer()
const submit = await api(
  '/api/tale-scene',
  {
    composeMode: 'free-still',
    deskLook: 'mini',
    photoreal: true,
    aspectRatio: '3:4',
    gender0: 'female',
    sourcePeople: 1,
    description: '미니. 짧은 타이트 스커트를 10% 더 짧고 더 붙게. 같은 얼굴.',
    images: [`data:image/jpeg;base64,${buf.toString('base64')}`],
  },
  auth,
)
const prompt = String(submit.data.prompt || '')
const report = {
  http: submit.http,
  ok: submit.data.ok,
  error: submit.data.error || '',
  message: submit.data.message || '',
  hem10: /hem 10%/i.test(prompt),
  cling10: /cling 10%/i.test(prompt),
  promptHead: prompt.slice(0, 200),
}
console.log(JSON.stringify(report, null, 2))
if (!submit.data.ok) {
  writeFileSync(path.join(TMP, 'report.json'), JSON.stringify({ ...report, submit: submit.data }, null, 2))
  process.exit(1)
}
let url = submit.data.imageUrl
if (!url && submit.data.pending) {
  for (let i = 0; i < 90; i += 1) {
    await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 2500))
    const p = await api(
      '/api/tale-scene-status',
      { statusUrl: submit.data.statusUrl, responseUrl: submit.data.responseUrl },
      auth,
    )
    console.log('poll', i, p.data.status || p.data.error || p.data.pending)
    if (p.data.status === 'succeeded' && p.data.imageUrl) {
      url = p.data.imageUrl
      break
    }
    if (p.data.imageUrl && p.data.ok !== false && !p.data.pending) {
      url = p.data.imageUrl
      break
    }
    if (p.data.status === 'failed' || p.data.ok === false) {
      throw new Error(p.data.message || p.data.error || 'poll_fail')
    }
  }
}
if (!url) throw new Error('no_image')
const img = Buffer.from(await (await fetch(url)).arrayBuffer())
writeFileSync(path.join(TMP, 'mini.jpg'), img)
writeFileSync(path.join(TMP, 'report.json'), JSON.stringify({ ...report, url, bytes: img.length }, null, 2))
console.log('saved', path.join(TMP, 'mini.jpg'), img.length)
