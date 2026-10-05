#!/usr/bin/env node
/** 70 가짜 얼굴에 11 증명 얼굴을 붙인다. 타원 스티커 아님. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-body-mw136-hold')
const BASE = process.env.DESK_LOOP_BASE || 'https://storymag.mindstory.kr'
const BODY = path.join(ROOT, 'tmp-faceswap-test', 'desk-body-mw135', 'result.jpg')
const FACE = path.join(ROOT, 'tmp-faceswap-test', 'desk-11-ident.jfif')
mkdirSync(OUT, { recursive: true })

function loadCreds() {
  const note = existsSync(path.join(ROOT, '핀패스.txt')) ? readFileSync(path.join(ROOT, '핀패스.txt'), 'utf8') : ''
  const vars = existsSync(path.join(ROOT, '.dev.vars')) ? readFileSync(path.join(ROOT, '.dev.vars'), 'utf8') : ''
  return {
    pin: (note.match(/^핀\s+(\S+)/m) || [])[1]?.trim() || (vars.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim() || '',
    password: (note.match(/패스워드\s+(\S+)/) || [])[1]?.trim() || '',
  }
}

const creds = loadCreds()
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin', password: creds.password || creds.pin }),
})
const auth = await login.json().catch(() => ({}))
const headers = {
  'Content-Type': 'application/json',
  'x-admin-pin': creds.pin,
}
if (auth.token) headers['x-session-token'] = auth.token

const submit = await fetch(`${BASE}/api/face-swap`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    targetImage: `data:image/jpeg;base64,${readFileSync(BODY).toString('base64')}`,
    face0: `data:image/jpeg;base64,${readFileSync(FACE).toString('base64')}`,
    gender0: 'female',
    engine: 'insight',
    workflowType: 'user_hair',
    upscale: true,
  }),
})
const first = await submit.json().catch(() => ({}))
let imageUrl = first.imageUrl || ''
if (!imageUrl && first.pending) {
  const deadline = Date.now() + 180000
  while (Date.now() < deadline && !imageUrl) {
    await new Promise((r) => setTimeout(r, 2500))
    const poll = await fetch(`${BASE}/api/face-swap-status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        engine: first.engine,
        baseImageUrl: first.baseImageUrl,
        statusUrl: first.statusUrl,
        responseUrl: first.responseUrl,
        predictionId: first.predictionId,
      }),
    })
    const row = await poll.json().catch(() => ({}))
    if (row.imageUrl && row.ok !== false && (row.status === 'succeeded' || !row.pending)) imageUrl = row.imageUrl
    if (row.status === 'failed' || row.ok === false) break
  }
}
if (!imageUrl) {
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ok: false, first }, null, 2))
  console.log(JSON.stringify({ ok: false, first }))
  process.exit(1)
}
const bin = Buffer.from(await (await fetch(imageUrl)).arrayBuffer())
writeFileSync(path.join(OUT, 'result.jpg'), bin)
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ok: true, bytes: bin.length }, null, 2))
console.log(JSON.stringify({ ok: true, bytes: bin.length }))
