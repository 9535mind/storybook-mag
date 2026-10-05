#!/usr/bin/env node
/** 화소 칠하기 대신 Kontext/desk-still. 실패작은 그림모음에 넣지 않는다. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TMP = path.join(ROOT, 'tmp-faceswap-test', 'desk-id-hand-draw')
const BASE = process.env.STORYMAG_BASE || 'https://6931f080.storymag.pages.dev'
const GALLERY = 'C:\\Users\\UserK\\Desktop\\그림모음'
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
    console.log(label, i, p.data.status || p.data.error || p.data.pending)
    if (p.data.status === 'succeeded' && p.data.imageUrl) return p.data.imageUrl
    if (p.data.imageUrl && p.data.ok !== false && !p.data.pending) return p.data.imageUrl
    if (p.data.status === 'failed' || p.data.ok === false) throw new Error(p.data.message || p.data.error || `${label}_fail`)
  }
  throw new Error(`${label}_timeout`)
}

const { default: sharp } = await import('sharp')
const auth = await login(loadCreds())

async function asJpeg(file) {
  return sharp(file).rotate().resize({ width: 880, height: 1184, fit: 'inside' }).jpeg({ quality: 90 }).toBuffer()
}

async function runJob(name, file, body) {
  const buf = await asJpeg(file)
  const submit = await api('/api/tale-scene', { ...body, images: [toDataUrl(buf)] }, auth)
  console.log('submit', name, submit.http, submit.data.ok, submit.data.error || submit.data.pending || 'ok', submit.data.message || '')
  if (!submit.data.ok) throw new Error(submit.data.message || submit.data.error || name)
  const url = await waitScene(submit, auth, name)
  const img = Buffer.from(await (await fetch(url)).arrayBuffer())
  const dest = path.join(TMP, `${name}.jpg`)
  writeFileSync(dest, img)
  console.log('saved', dest, img.length)
  return dest
}

const jobs = [
  runJob('39-27-mini', path.join(GALLERY, '27.jpg'), {
    composeMode: 'free-still',
    photoreal: true,
    aspectRatio: '3:4',
    description:
      'Same exact Korean woman, same face, same hair, same black blazer, same V-neck top, same pose, same gray studio. Change ONLY the knee skirt into a tight black micro mini, hem high on the thigh so both hands are fully visible. Natural arm length. Photoreal. FORBIDDEN different face, beige plate, white rectangle, oval sticker.',
  }).catch((e) => console.log('fail', e.message)),
  runJob('40-27-nude', path.join(GALLERY, '27.jpg'), {
    composeMode: 'free-still',
    photoreal: true,
    aspectRatio: '3:4',
    description:
      'Same exact Korean woman, same face, same hair, same standing pose, same studio. Remove every garment. Fully nude adult woman, bare breasts, bare belly, bare hips. Hands visible at her sides so arm length can be judged. Photoreal. FORBIDDEN different face, beige fill, dress-shaped slab, lingerie.',
  }).catch((e) => {
    console.log('nude27 kontext fail', e.message)
    return runJob('40-27-nude', path.join(GALLERY, '27.jpg'), {
      composeMode: 'desk-still',
      deskStep: 'place',
      deskLook: 'nude',
      deskCouple: false,
      photoreal: true,
      aspectRatio: '3:4',
      description: '나체 전신. 같은 얼굴. 서서 팔 내려 손이 보이게. 옷 없음.',
    })
  }).catch((e) => console.log('fail', e.message)),
  runJob('41-5-nude', path.join(GALLERY, '5.jfif'), {
    composeMode: 'free-still',
    photoreal: true,
    aspectRatio: '3:4',
    description:
      'Same exact woman, same face, same short dark hair, same standing pose, same white studio, same flat shoes. Remove the pink sweater and black skirt. Fully nude adult woman. Hands visible at sides. Photoreal. FORBIDDEN different face, beige plate, leftover pink knit.',
  }).catch((e) => console.log('fail', e.message)),
  runJob('42-3-nude', path.join(GALLERY, '3.png'), {
    composeMode: 'free-still',
    photoreal: true,
    aspectRatio: '3:4',
    description:
      'Same exact adult man, same face, same gray hair, same standing pose, same white studio, same black shoes. Remove the navy suit. Fully nude adult man, flat male chest, no breasts. Hands visible at sides. Photoreal. FORBIDDEN a woman, beige plate, leftover navy jacket.',
  }).catch((e) => console.log('fail', e.message)),
]

await Promise.all(jobs)
console.log('done', TMP)
