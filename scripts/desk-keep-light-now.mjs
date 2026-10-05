#!/usr/bin/env node
/** 이미 나온 검은 정장 전신을 11 크림 집업으로 되돌린다. 몸 잇기 전체는 다시 안 돌린다. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-body-mw136')
const BASE = process.env.DESK_LOOP_BASE || 'https://storymag.mindstory.kr'
const STANDING =
  process.env.KEEP_LIGHT_SRC ||
  path.join(ROOT, 'tmp-faceswap-test', 'desk-body-mw135', 'result.jpg')
const ID = path.join(ROOT, 'tmp-faceswap-test', 'desk-11-ident.jfif')
mkdirSync(OUT, { recursive: true })

function loadPin() {
  const note = existsSync(path.join(ROOT, '핀패스.txt')) ? readFileSync(path.join(ROOT, '핀패스.txt'), 'utf8') : ''
  const vars = existsSync(path.join(ROOT, '.dev.vars')) ? readFileSync(path.join(ROOT, '.dev.vars'), 'utf8') : ''
  return (
    (note.match(/^핀\s+(\S+)/m) || [])[1]?.trim() ||
    (vars.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim() ||
    ''
  )
}

function dataUrl(file, mime) {
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`
}

const pin = loadPin()
const headers = {
  'Content-Type': 'application/json',
  'x-admin-pin': pin,
}

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin', password: pin }),
})
const loginJson = await login.json().catch(() => ({}))
if (loginJson.token) headers['x-session-token'] = loginJson.token

const { default: sharp } = await import('sharp')
const sample = await sharp(ID).resize(160, 240, { fit: 'cover' }).raw().toBuffer({ resolveWithObject: true })
let sr = 0
let sg = 0
let sb = 0
let sn = 0
for (let y = Math.round(240 * 0.58); y < Math.round(240 * 0.92); y += 1) {
  for (let x = Math.round(160 * 0.34); x < Math.round(160 * 0.66); x += 1) {
    const i = (y * 160 + x) * 3
    const r = sample.data[i]
    const g = sample.data[i + 1]
    const b = sample.data[i + 2]
    const luma = r * 0.299 + g * 0.587 + b * 0.114
    if (luma > 228 || luma < 28) continue
    sr += r
    sg += g
    sb += b
    sn += 1
  }
}
const hex =
  sn > 30
    ? `#${[Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')}`
    : ''

const started = await fetch(`${BASE}/api/tale-scene`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    composeMode: 'free-still',
    deskLook: 'extend-keep-light',
    images: [dataUrl(STANDING, 'image/jpeg'), dataUrl(ID, 'image/jpeg')],
    sourceClothHex: hex,
    photoreal: true,
    aspectRatio: '3:4',
    gender0: 'female',
    sourcePeople: 1,
    description: `match identity cloth color ${hex}`,
  }),
})
const first = await started.json().catch(() => ({}))
let imageUrl = first.imageUrl || ''
if (!imageUrl && first.pending && first.statusUrl) {
  const deadline = Date.now() + 180000
  while (Date.now() < deadline && !imageUrl) {
    await new Promise((r) => setTimeout(r, 3000))
    const poll = await fetch(`${BASE}/api/tale-scene-status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ statusUrl: first.statusUrl, responseUrl: first.responseUrl }),
    })
    const row = await poll.json().catch(() => ({}))
    if (row.imageUrl) imageUrl = row.imageUrl
    if (row.error) break
  }
}

if (!imageUrl) {
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ok: false, first }, null, 2))
  console.log(JSON.stringify({ ok: false, first }, null, 2))
  process.exit(1)
}

const bin = Buffer.from(await (await fetch(imageUrl)).arrayBuffer())
writeFileSync(path.join(OUT, 'result.jpg'), bin)
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ok: true, imageUrl, bytes: bin.length }, null, 2))
console.log(JSON.stringify({ ok: true, bytes: bin.length, out: path.join(OUT, 'result.jpg') }))
