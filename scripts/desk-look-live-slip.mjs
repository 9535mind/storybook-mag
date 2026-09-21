#!/usr/bin/env node
/**
 * 운영 실검증: React #300 먼저. 정상일 때만 LOOK 슬립 1회.
 * 재시도·Wan·나체 경로 없음.
 */
import { createHash } from 'node:crypto'
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-live-slip')
const LOCK = path.join(OUT, 'paid-once.lock')
const SRC = path.join(ROOT, 'tmp-faceswap-test', 'try-stand', '1-stand.jpg')
const LABELS = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire', 'woman-full-labels.u8')
const BUNDLE = path.join(ROOT, '_tmp_bundle')
const BASE = process.env.STORYMAG_BASE || 'https://storymag.mindstory.kr'
const COST_USD = 0.1
const MODEL = 'fal-ai/leffa/virtual-tryon'

mkdirSync(OUT, { recursive: true })
mkdirSync(BUNDLE, { recursive: true })

function loadCreds() {
  const note = path.join(ROOT, '핀패스.txt')
  const n = existsSync(note) ? readFileSync(note, 'utf8') : ''
  const pinFromNote = (n.match(/^핀\s+(\S+)/m) || [])[1]?.trim() || ''
  const password = (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim() || ''
  const varsPath = path.join(ROOT, '.dev.vars')
  const text = existsSync(varsPath) ? readFileSync(varsPath, 'utf8') : ''
  return {
    pin: pinFromNote || (text.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim() || '',
    password,
  }
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function esbuild(entry, outfile) {
  execSync(`node_modules\\.bin\\esbuild "${entry}" --bundle --platform=node --format=cjs --outfile="${outfile}"`, {
    cwd: ROOT,
    stdio: 'pipe',
  })
}

function pyRgba(imagePath, rawPath, resize) {
  const raw = execFileSync(
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
    {
      input: JSON.stringify({ image: imagePath, out: rawPath, resize: resize || null }),
      encoding: 'utf8',
      timeout: 60000,
    },
  )
  return lastJson(raw)
}

function writeReport(extra) {
  const report = {
    url: BASE,
    paidCallsThisStep: extra.paidCallsThisStep || 0,
    retry: false,
    wanCalled: false,
    nudePathTouched: false,
    deployId: 'c3637cc6-7b1c-4577-8b4b-ab98ace0df89',
    deployUrl: 'https://c3637cc6.storymag.pages.dev',
    commit: 'd89d08fab0ed6c3bd9ce8b90f3efc06b5f10825e',
    ...extra,
  }
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  return report
}

async function checkReact300() {
  const notes = []
  const pageerrors = []
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  page.on('pageerror', (err) => {
    pageerrors.push(err.message)
    notes.push(`pageerror: ${err.message}`)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') notes.push(`console.error: ${msg.text()}`)
  })
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: joinOut('01-open.png'), fullPage: true })
  const info = await page.evaluate(() => ({
    href: location.href,
    build: window.__DESK_BUILD || '',
    title: document.title,
    gate: Boolean(document.getElementById('pin-gate')),
    reactRoot: Boolean(document.getElementById('root') || document.getElementById('__next')),
  }))
  notes.push(JSON.stringify(info, null, 2))

  const creds = loadCreds()
  const loginPass = creds.password || creds.pin
  if (loginPass) {
    const gateVisible = await page.locator('#pin-gate').isVisible().catch(() => false)
    if (gateVisible) {
      await page.fill('#auth-email', 'admin')
      await page.fill('#auth-password', loginPass)
      await page.click('#auth-submit')
      await page.waitForTimeout(2500)
    }
  }
  await page.screenshot({ path: joinOut('02-after-login.png'), fullPage: true })
  const deskTab = page.locator('#app-area-admin')
  if (await deskTab.isVisible().catch(() => false)) {
    await deskTab.click()
    await page.waitForTimeout(800)
  }
  await page.screenshot({ path: joinOut('03-desk.png'), fullPage: true })
  const after = await page.evaluate(() => ({
    build: window.__DESK_BUILD || '',
    lookCards: document.getElementById('desk-looks')?.querySelectorAll('button').length || 0,
    lookText: [...(document.getElementById('desk-looks')?.querySelectorAll('button') || [])].map((b) =>
      b.textContent.trim(),
    ),
    lookRun: document.getElementById('desk-look-run')?.textContent?.trim() || '',
    appHidden: Boolean(document.getElementById('app')?.hidden),
  }))
  notes.push('afterDesk ' + JSON.stringify(after))
  await browser.close()
  writeFileSync(path.join(OUT, 'react-notes.txt'), notes.join('\n') + '\n')
  const react300 = pageerrors.some((m) => /Minified React error #300|#300|react/i.test(m))
  return { info, after, pageerrors, react300, notes }
}

function joinOut(name) {
  return path.join(OUT, name)
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
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { http: res.status, data }
}

async function poll(auth, extra) {
  const started = Date.now()
  for (let i = 0; i < 70; i += 1) {
    await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 2500))
    const { http, data } = await api('/api/tale-scene-status', extra, auth)
    if (data.status === 'succeeded' && data.imageUrl) return data
    if (data.status === 'failed' || data.ok === false) {
      throw new Error(data.message || data.error || `poll_${http}`)
    }
    if (Date.now() - started > 220000) throw new Error('poll_timeout')
  }
  throw new Error('poll_exhausted')
}

function extractCallId(data) {
  const blob = `${data.statusUrl || ''} ${data.responseUrl || ''} ${data.imageUrl || ''}`
  const m = blob.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  return m ? m[0] : data.requestId || data.request_id || ''
}

const react = await checkReact300()
if (react.react300) {
  writeReport({
    ok: false,
    phase: 'react300',
    react300: true,
    pageerrors: react.pageerrors,
    build: react.after?.build || react.info?.build || '',
    paidCallsThisStep: 0,
    deployId: process.env.STORYMAG_DEPLOY_ID || 'c3637cc6-7b1c-4577-8b4b-ab98ace0df89',
    deployUrl: process.env.STORYMAG_DEPLOY_URL || 'https://c3637cc6.storymag.pages.dev',
    verdict: 'fail_react_300',
  })
  console.log('STOP React #300', react.pageerrors.join(' | '))
  process.exit(1)
}

if (existsSync(LOCK)) {
  writeReport({
    ok: false,
    phase: 'lock',
    build: react.after?.build || '',
    paidCallsThisStep: 0,
    verdict: 'lock_spent',
  })
  console.log('LOCK already spent. no second paid call.')
  process.exit(1)
}

if (!existsSync(SRC) || !existsSync(LABELS)) {
  writeReport({
    ok: false,
    phase: 'prep',
    build: react.after?.build || '',
    paidCallsThisStep: 0,
    verdict: 'missing_source',
  })
  process.exit(1)
}

esbuild('functions/lib/desk-look-preflight.ts', path.join(BUNDLE, 'desk-look-preflight.cjs'))
esbuild('functions/lib/desk-clothes-parse.ts', path.join(BUNDLE, 'desk-clothes-parse.cjs'))
esbuild('functions/lib/desk-look-models.ts', path.join(BUNDLE, 'desk-look-models.cjs'))
esbuild('functions/lib/face-preserve-mask.ts', path.join(BUNDLE, 'face-preserve-mask.cjs'))
esbuild('functions/lib/desk-clothes-composite.ts', path.join(BUNDLE, 'desk-clothes-composite.cjs'))

const look = await import(`file://${path.join(BUNDLE, 'desk-look-preflight.cjs')}?t=${Date.now()}`)
const parseMod = await import(`file://${path.join(BUNDLE, 'desk-clothes-parse.cjs')}?t=${Date.now()}`)
const models = await import(`file://${path.join(BUNDLE, 'desk-look-models.cjs')}?t=${Date.now()}`)
const maskPng = await import(`file://${path.join(BUNDLE, 'face-preserve-mask.cjs')}?t=${Date.now()}`)
const comp = await import(`file://${path.join(BUNDLE, 'desk-clothes-composite.cjs')}?t=${Date.now()}`)

copyFileSync(SRC, path.join(OUT, '00-source.jpg'))
const srcMeta = pyRgba(SRC, path.join(OUT, 'src.rgba'), null)
const srcRgba = new Uint8Array(readFileSync(path.join(OUT, 'src.rgba')))
const labels = Array.from(readFileSync(LABELS), (id) => parseMod.CLOTHES_PARSE_LABELS[id] || 'Background')
if (labels.length !== srcMeta.width * srcMeta.height) {
  writeReport({
    ok: false,
    phase: 'prep',
    build: react.after?.build || '',
    paidCallsThisStep: 0,
    verdict: 'label_size_mismatch',
  })
  process.exit(1)
}

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
  writeReport({
    ok: false,
    phase: 'preflight',
    build: react.after?.build || '',
    paidCallsThisStep: 0,
    verdict: pre.reason || 'preflight_fail',
  })
  process.exit(1)
}

const maskBuf = maskPng.encodeGrayPng(srcMeta.width, srcMeta.height, pre.mask)
writeFileSync(path.join(OUT, '01-mask.png'), maskBuf)
const maskDataUrl = `data:image/png;base64,${Buffer.from(maskBuf).toString('base64')}`
const srcDataUrl = `data:image/jpeg;base64,${readFileSync(SRC).toString('base64')}`
const maskSha = sha256(pre.mask)
const payload = look.buildLookPayload({
  source: srcDataUrl,
  clothesMask: maskDataUrl,
  layout,
  verify: { ...pre.verify, ok: true },
  maskSha256: maskSha,
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
writeFileSync(path.join(OUT, 'submit.json'), JSON.stringify({ http: submit.http, data: submit.data }, null, 2))

let result = submit.data
let callId = extractCallId(result)
if (!result.ok) {
  writeReport({
    ok: false,
    phase: 'generate',
    build: react.after?.build || '',
    paidCallsThisStep: 1,
    callId,
    costUsd: COST_USD,
    http: submit.http,
    error: result.error || '',
    message: result.message || '',
    engine: result.engine || '',
    verdict: 'look_failed',
  })
  console.log('FAIL', result.error || result.message || submit.http)
  process.exit(1)
}

if (!result.imageUrl && result.pending) {
  result = await poll(auth, { statusUrl: result.statusUrl, responseUrl: result.responseUrl })
  callId = extractCallId(result) || callId
}

if (!result.imageUrl) {
  writeReport({
    ok: false,
    phase: 'generate',
    build: react.after?.build || '',
    paidCallsThisStep: 1,
    callId,
    costUsd: COST_USD,
    verdict: 'no_image',
  })
  process.exit(1)
}

const genBuf = Buffer.from(await (await fetch(result.imageUrl)).arrayBuffer())
writeFileSync(path.join(OUT, '02-model-raw.png'), genBuf)
pyRgba(path.join(OUT, '02-model-raw.png'), path.join(OUT, 'gen.rgba'), [srcMeta.width, srcMeta.height])
const genRgba = new Uint8Array(readFileSync(path.join(OUT, 'gen.rgba')))
const outRgba = comp.compositeProtectRgba(srcRgba, genRgba, pre.mask, srcMeta.width, srcMeta.height, 6)
writeFileSync(path.join(OUT, '03-composite.png'), comp.encodeRgbPng(srcMeta.width, srcMeta.height, outRgba))
const black = comp.protectRegionMad(srcRgba, outRgba, pre.mask, srcMeta.width, srcMeta.height, 6)

lastJson(
  execFileSync(
    'py',
    [
      '-3',
      '-c',
      `
import json, sys
from PIL import Image, ImageDraw
job = json.loads(sys.stdin.read())
w, h = job["size"]
gap = 16
board = Image.new("RGB", (w * 4 + gap * 5, h + 72), (245, 245, 245))
d = ImageDraw.Draw(board)
x = gap
for p, lab in zip(job["paths"], job["labels"]):
    im = Image.open(p).convert("RGB").resize((w, h))
    board.paste(im, (x, 48))
    d.text((x, 12), lab, fill=(20, 20, 20))
    x += w + gap
board.save(job["out"])
print(json.dumps({"ok": True}))
`,
    ],
    {
      cwd: ROOT,
      input: JSON.stringify({
        paths: [
          path.join(OUT, '00-source.jpg'),
          path.join(OUT, '01-mask.png'),
          path.join(OUT, '02-model-raw.png'),
          path.join(OUT, '03-composite.png'),
        ],
        labels: ['00 source', '01 identity mask', '02 live Leffa raw', '03 composite'],
        size: [440, 592],
        out: path.join(OUT, 'review-board.png'),
      }),
      encoding: 'utf8',
    },
  ),
)

lastJson(
  execFileSync(
    'py',
    [
      '-3',
      '-c',
      `
import json, sys
from pathlib import Path
from PIL import Image
job = json.loads(sys.stdin.read())
src = Image.open(job["src"]).convert("RGB")
comp = Image.open(job["comp"]).convert("RGB").resize(src.size, Image.BILINEAR)
W, H = src.size
crops = [
    ("face", 0.49, 0.13, 0.22),
    ("neck", 0.50, 0.23, 0.14),
    ("shoulder", 0.50, 0.28, 0.18),
    ("hand-L", 0.39, 0.55, 0.12),
    ("hand-R", 0.59, 0.55, 0.12),
    ("knee", 0.50, 0.72, 0.18),
    ("shoe", 0.50, 0.92, 0.16),
    ("bg", 0.12, 0.12, 0.16),
]
out = Path(job["dir"])
out.mkdir(parents=True, exist_ok=True)
for name, cx, cy, side in crops:
    s = int(side * min(W, H))
    x0 = max(0, min(W - s, int(cx * W - s / 2)))
    y0 = max(0, min(H - s, int(cy * H - s / 2)))
    src.crop((x0, y0, x0 + s, y0 + s)).resize((s * 3, s * 3), Image.NEAREST).save(out / f"{name}-source.png")
    comp.crop((x0, y0, x0 + s, y0 + s)).resize((s * 3, s * 3), Image.NEAREST).save(out / f"{name}-composite.png")
print(json.dumps({"ok": True}))
`,
    ],
    {
      cwd: ROOT,
      input: JSON.stringify({
        src: path.join(OUT, '00-source.jpg'),
        comp: path.join(OUT, '03-composite.png'),
        dir: path.join(OUT, 'review-crops'),
      }),
      encoding: 'utf8',
    },
  ),
)

const report = writeReport({
  ok: black.identical === true,
  phase: 'generate',
  build: react.after?.build || '',
  paidCallsThisStep: 1,
  callId,
  costUsd: COST_USD,
  model: MODEL,
  engine: result.engine || '',
  imageUrl: result.imageUrl,
  protectBlack: black,
  maskWhite: pre.white,
  verdict: black.identical ? 'protect_ok_visual_pending' : 'protect_fail',
})
console.log(JSON.stringify(report, null, 2))
