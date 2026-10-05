#!/usr/bin/env node
/** 이은 전신에 증명 얼굴을 교체한다. 타원 스티커 아님. 그림모음에 넣지 않는다. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-id-extend-verify')
const BASE = process.env.STORYMAG_BASE || 'https://2ce685e2.storymag.pages.dev'
const BODY = path.join(OUT, '01-extend.jpg')
const FACE = path.join(OUT, '00-ident.jpg')
const ENGINES = (process.env.DESK_FACE_ENGINES || 'easel,insight,replicate').split(',').map((s) => s.trim())

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

async function waitImage(submit, auth) {
  let url = submit.data.imageUrl
  if (url) return url
  if (!submit.data.pending) throw new Error(submit.data.message || submit.data.error || 'no_pending')
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
    console.log('poll', submit.data.engine, i, p.http, p.data.status || p.data.error || p.data.pending)
    if (p.data.status === 'succeeded' && p.data.imageUrl) return p.data.imageUrl
    if (p.data.imageUrl && p.data.ok !== false && !p.data.pending) return p.data.imageUrl
    if (p.data.status === 'failed' || p.data.ok === false) {
      throw new Error(p.data.message || p.data.error || 'swap_failed')
    }
  }
  throw new Error('swap_timeout')
}

if (!existsSync(BODY) || !existsSync(FACE)) throw new Error('need 01-extend.jpg and 00-ident.jpg')
mkdirSync(OUT, { recursive: true })
const auth = await login(loadCreds())
const bodyUrl = toDataUrl(readFileSync(BODY))
const faceUrl = toDataUrl(readFileSync(FACE))

await Promise.all(
  ENGINES.map(async (engine) => {
    try {
      const submit = await api(
        '/api/face-swap',
        {
          targetImage: bodyUrl,
          face0: faceUrl,
          gender0: 'female',
          engine,
          workflowType: 'user_hair',
          upscale: true,
          keepFullBody: engine === 'kontext',
        },
        auth,
      )
      console.log('submit', engine, submit.http, submit.data.ok, submit.data.error || submit.data.pending || 'ok')
      if (!submit.data.ok) throw new Error(submit.data.message || submit.data.error || `http_${submit.http}`)
      const url = await waitImage(submit, auth)
      const img = await fetch(url)
      const buf = Buffer.from(await img.arrayBuffer())
      const dest = path.join(OUT, `03-${engine}.jpg`)
      writeFileSync(dest, buf)
      console.log('saved', dest, buf.length)
    } catch (err) {
      console.log('fail', engine, err instanceof Error ? err.message : String(err))
    }
  }),
)
