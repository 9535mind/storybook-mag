#!/usr/bin/env node
/**
 * 운영 실검증 1회: LOOK 슬립이 FASHN VTON 으로 나가는지, 합성 없이도 같은 사람인지.
 * 클라이언트 새 동작 그대로 — 합성하지 않고 엔진 원본을 그대로 쓴다.
 * 재시도·Wan·나체 경로 없음.
 */
import { createHash } from 'node:crypto'
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-live-vton')
const LOCK = path.join(OUT, 'paid-once.lock')
const SRC = path.join(ROOT, 'tmp-faceswap-test', 'try-stand', '1-stand.jpg')
const LABELS = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire', 'woman-full-labels.u8')
const BUNDLE = path.join(ROOT, '_tmp_bundle')
const BASE = process.env.STORYMAG_BASE || 'https://storymag.mindstory.kr'
const COST_USD = 0.075

mkdirSync(OUT, { recursive: true })
mkdirSync(BUNDLE, { recursive: true })

if (existsSync(LOCK) && !process.argv.includes('--force')) {
  console.log('LOCK already spent. no second paid call.')
  process.exit(1)
}

function loadCreds() {
  const note = path.join(ROOT, '핀패스.txt')
  const n = existsSync(note) ? readFileSync(note, 'utf8') : ''
  const pinFromNote = (n.match(/^핀\s+(\S+)/m) || [])[1]?.trim() || ''
  const password = (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim() || ''
  const varsPath = path.join(ROOT, '.dev.vars')
  const text = existsSync(varsPath) ? readFileSync(varsPath, 'utf8') : ''
  return { pin: pinFromNote || (text.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim() || '', password }
}

function esbuild(entry, outfile) {
  execSync(`node_modules\\.bin\\esbuild "${entry}" --bundle --platform=node --format=cjs --outfile="${outfile}"`, {
    cwd: ROOT,
    stdio: 'pipe',
  })
}

function pyRgba(imagePath, rawPath, resize) {
  return lastJson(
    execFileSync(
      'py',
      [
        '-3',
        '-c',
        `
import json, sys
from PIL import Image
import numpy as np
from pathlib import Path
job = json.loads(sys.stdin.read())
im = Image.open(job["image"]).convert("RGBA")
if job.get("resize"):
    im = im.resize((int(job["resize"][0]), int(job["resize"][1])), Image.BILINEAR)
Path(job["out"]).write_bytes(np.asarray(im, dtype=np.uint8).tobytes())
print(json.dumps({"width": im.size[0], "height": im.size[1]}))
`,
      ],
      { input: JSON.stringify({ image: imagePath, out: rawPath, resize: resize || null }), encoding: 'utf8', timeout: 60000 },
    ),
  )
}

async function loginSession(password, pin) {
  if (password) {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin', password }),
    })
    const data = await r.json().catch(() => ({}))
    if (data.ok && data.token) return { token: data.token, pin }
  }
  if (!pin) throw new Error('login_failed')
  return { pin }
}

async function api(pathname, body, auth) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth?.token) headers['x-session-token'] = auth.token
  if (auth?.pin) headers['x-admin-pin'] = auth.pin
  const res = await fetch(`${BASE}${pathname}`, { method: 'POST', headers, body: JSON.stringify(body) })
  return { http: res.status, data: await res.json().catch(() => ({})) }
}

async function poll(auth, extra) {
  const started = Date.now()
  for (let i = 0; i < 70; i += 1) {
    await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 2500))
    const { http, data } = await api('/api/tale-scene-status', extra, auth)
    if (data.status === 'succeeded' && data.imageUrl) return data
    if (data.status === 'failed' || data.ok === false) throw new Error(data.message || data.error || `poll_${http}`)
    if (Date.now() - started > 220000) throw new Error('poll_timeout')
  }
  throw new Error('poll_exhausted')
}

esbuild('functions/lib/desk-look-preflight.ts', path.join(BUNDLE, 'desk-look-preflight.cjs'))
esbuild('functions/lib/desk-clothes-parse.ts', path.join(BUNDLE, 'desk-clothes-parse.cjs'))
esbuild('functions/lib/desk-look-models.ts', path.join(BUNDLE, 'desk-look-models.cjs'))
esbuild('functions/lib/face-preserve-mask.ts', path.join(BUNDLE, 'face-preserve-mask.cjs'))
esbuild('functions/lib/desk-look-visual-gate.ts', path.join(BUNDLE, 'desk-look-visual-gate.cjs'))

const stamp = Date.now()
const look = await import(`file://${path.join(BUNDLE, 'desk-look-preflight.cjs')}?t=${stamp}`)
const parseMod = await import(`file://${path.join(BUNDLE, 'desk-clothes-parse.cjs')}?t=${stamp}`)
const models = await import(`file://${path.join(BUNDLE, 'desk-look-models.cjs')}?t=${stamp}`)
const maskPng = await import(`file://${path.join(BUNDLE, 'face-preserve-mask.cjs')}?t=${stamp}`)
const visual = await import(`file://${path.join(BUNDLE, 'desk-look-visual-gate.cjs')}?t=${stamp}`)

copyFileSync(SRC, path.join(OUT, '00-source.jpg'))
const srcMeta = pyRgba(SRC, path.join(OUT, 'src.rgba'), null)
const srcRgba = new Uint8Array(readFileSync(path.join(OUT, 'src.rgba')))
const labels = Array.from(readFileSync(LABELS), (id) => parseMod.CLOTHES_PARSE_LABELS[id] || 'Background')

const faces = [{ slot: 'woman', x: 0.39, y: 0.07, w: 0.2, h: 0.13 }]
const layout = look.lookLayoutFromFaces(faces)
const pre = look.runDeskLookPreflight({
  labels,
  width: srcMeta.width,
  height: srcMeta.height,
  layout,
  faces,
  embeds: [{ slot: 'woman', dim: 512, vec: Array(512).fill(0.01) }],
  embedOk: true,
  vton: true,
  srcRgba,
})
if (!pre.ok) {
  console.log('preflight_fail', pre.reason)
  process.exit(1)
}

const maskBuf = maskPng.encodeGrayPng(srcMeta.width, srcMeta.height, pre.mask)
writeFileSync(path.join(OUT, '01-mask.png'), maskBuf)
const payload = look.buildLookPayload({
  source: `data:image/jpeg;base64,${readFileSync(SRC).toString('base64')}`,
  clothesMask: `data:image/png;base64,${Buffer.from(maskBuf).toString('base64')}`,
  layout,
  verify: { ...pre.verify, ok: true },
  maskSha256: createHash('sha256').update(pre.mask).digest('hex'),
  segformerSha256: models.DESK_LOOK_MODELS.segformer.sha256,
  recSha256: models.DESK_LOOK_MODELS.rec.sha256,
  description: '슬립 한 겹 노브라',
  deskLook: 'silk',
  deskCouple: false,
})

writeFileSync(LOCK, new Date().toISOString())
const creds = loadCreds()
const auth = await loginSession(creds.password, creds.pin)
const submit = await api('/api/tale-scene', payload, auth)
writeFileSync(path.join(OUT, 'submit.json'), JSON.stringify(submit, null, 2))

let result = submit.data
if (!result.ok) {
  console.log('FAIL', JSON.stringify({ http: submit.http, error: result.error, message: result.message, detail: result.detail }))
  process.exit(1)
}
if (!result.imageUrl && result.pending) {
  const polled = await poll(auth, { statusUrl: result.statusUrl, responseUrl: result.responseUrl })
  result = { ...result, ...polled }
}
if (!result.imageUrl) {
  console.log('FAIL no_image')
  process.exit(1)
}

// 클라이언트 새 동작: 합성하지 않는다. 엔진 원본이 곧 결과다.
const rawPath = path.join(OUT, '02-result.png')
writeFileSync(rawPath, Buffer.from(await (await fetch(result.imageUrl)).arrayBuffer()))
const outMeta = pyRgba(rawPath, path.join(OUT, 'out.rgba'), [srcMeta.width, srcMeta.height])
const outRgba = new Uint8Array(readFileSync(path.join(OUT, 'out.rgba')))
const gate = visual.gateLookVisual({
  src: srcRgba,
  out: outRgba,
  mask: pre.mask,
  width: srcMeta.width,
  height: srcMeta.height,
  labels,
})

const arc = lastJson(
  execFileSync('py', ['-3', path.join(ROOT, 'scripts', 'desk-arcface-compare.py')], {
    input: JSON.stringify({ src: path.join(OUT, '00-source.jpg'), out: rawPath }),
    encoding: 'utf8',
    timeout: 300000,
  }),
)

const report = {
  url: BASE,
  paidCallsThisStep: 1,
  costUsd: COST_USD,
  retry: false,
  wanCalled: false,
  nudePathTouched: false,
  composited: false,
  engine: result.engine || '',
  engineIsVton: result.engine === 'fal-fashn-tryon',
  imageUrl: result.imageUrl,
  sameSize: outMeta.width === srcMeta.width && outMeta.height === srcMeta.height,
  faceCosine: arc?.cosine ?? null,
  faceMoved: arc?.dist ?? null,
  faceScale: arc?.scale ?? null,
  outFaces: arc?.outCount ?? null,
  clothesChanged: gate.upper.changeOk && gate.lower.changeOk,
  upper: { mad: +gate.upper.mad.toFixed(2), corr: +gate.upper.corr.toFixed(2) },
  lower: { mad: +gate.lower.mad.toFixed(2), corr: +gate.lower.corr.toFixed(2) },
}
report.ok =
  report.engineIsVton &&
  report.sameSize &&
  report.outFaces === 1 &&
  typeof report.faceCosine === 'number' &&
  report.faceCosine >= 0.35 &&
  report.clothesChanged
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
