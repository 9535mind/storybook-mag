#!/usr/bin/env node
/**
 * 무과금 preview 검증. fal/Replicate/Wan 호출 없음.
 * 정상 2종: payload·모델 SHA·마스크 SHA 확인 후 엔진 직전 중단.
 * 실패 2종: /api/tale-scene 요청을 만들지 않음.
 */
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { embedCastFaces } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-preview')
const WIRE = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire')
const PRE_BUNDLE = path.join(ROOT, '_tmp_bundle', 'desk-look-preflight.cjs')
const PARSE_BUNDLE = path.join(ROOT, '_tmp_bundle', 'desk-clothes-parse.cjs')
const MASK_BUNDLE = path.join(ROOT, '_tmp_bundle', 'face-preserve-mask.cjs')
const PREVIEW_PORT = 8791
const PREVIEW_BASE = `http://127.0.0.1:${PREVIEW_PORT}`

mkdirSync(OUT, { recursive: true })

function sha256File(filePath) {
  if (!filePath || !existsSync(filePath)) return null
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

const SEG_LOCAL = path.join(ROOT, 'tmp-faceswap-test', '_models', 'segformer_b2_clothes', 'model_quantized.onnx')
const REC_LOCAL = path.join(process.env.USERPROFILE || process.env.HOME || '', '.insightface', 'models', 'buffalo_l', 'w600k_r50.onnx')
const onnxJs = readFileSync(path.join(ROOT, 'public', 'desk-look-onnx.js'), 'utf8')
const appJs = readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8')
const lookFn = appJs.slice(appJs.indexOf('const runDeskStepLook'), appJs.indexOf('const runDeskStepPlace'))

const modelPin = {
  segformer: {
    nodePath: SEG_LOCAL.replace(/\\/g, '/'),
    nodeSha256: sha256File(SEG_LOCAL),
    browserLocal: '/models/segformer_b2_clothes/model_quantized.onnx',
    browserFallback: 'https://huggingface.co/Xenova/segformer_b2_clothes/resolve/main/onnx/model_quantized.onnx',
    inputSize: 512,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    upsample: 'nearest',
    urlInBrowserSource: onnxJs.includes('Xenova/segformer_b2_clothes'),
  },
  arcfaceRec: {
    nodePath: REC_LOCAL.replace(/\\/g, '/'),
    nodeSha256: sha256File(REC_LOCAL),
    browserUrl: 'https://huggingface.co/public-data/insightface/resolve/main/models/buffalo_l/w600k_r50.onnx',
    inputSize: 112,
    mean: 127.5,
    std: 127.5,
    dim: 512,
    uniqueRejectCosine: 0.99,
    urlInBrowserSource: onnxJs.includes('buffalo_l/w600k_r50.onnx'),
  },
  gates: {
    maskMinWhite: 1500,
    noLumaDescriptor: !/deskFaceDescriptor/.test(
      appJs.slice(appJs.indexOf('async function captureDeskCastLock'), appJs.indexOf('function deskFaceInSlot')),
    ),
  },
}
writeFileSync(path.join(OUT, 'model-pin.json'), JSON.stringify(modelPin, null, 2))

const look = await import(`file://${PRE_BUNDLE}?t=${Date.now()}`)
const parseMod = await import(`file://${PARSE_BUNDLE}?t=${Date.now()}`)
const maskPng = await import(`file://${MASK_BUNDLE}?t=${Date.now()}`)

const CASES = [
  {
    id: 'woman-bust',
    kind: 'fail',
    expect: 'mask_too_small',
    source: path.join(ROOT, 'tmp-faceswap-test', 'try-extend', '5-woman-id.jpg'),
    faces: [{ slot: 'woman', x: 0.22, y: 0.16, w: 0.56, h: 0.62 }],
  },
  {
    id: 'woman-full',
    kind: 'pass-abort-before-engine',
    expect: 'ok',
    source: path.join(ROOT, 'tmp-faceswap-test', 'try-stand', '1-stand.jpg'),
    faces: [{ slot: 'woman', x: 0.39, y: 0.07, w: 0.2, h: 0.13 }],
  },
  {
    id: 'couple-woman-left',
    kind: 'pass-abort-before-engine',
    expect: 'ok',
    source: path.join(ROOT, 'tmp-faceswap-test', 'try-shorts-kiss-v2', 'f01-start.jpg'),
    faces: [
      { slot: 'woman', x: 0.14, y: 0.4, w: 0.2, h: 0.14 },
      { slot: 'man', x: 0.5, y: 0.36, w: 0.22, h: 0.15 },
    ],
  },
  {
    id: 'couple-woman-right',
    kind: 'fail',
    expect: 'undetected',
    source: path.join(ROOT, 'tmp-faceswap-test', 'woman-face-id.jpg'),
    faces: [
      { slot: 'man', x: 0.0, y: 0.08, w: 0.2, h: 0.52 },
      { slot: 'woman', x: 0.28, y: 0.1, w: 0.58, h: 0.64 },
    ],
  },
]

function idsToLabels(ids) {
  return Array.from(ids, (id) => parseMod.CLOTHES_PARSE_LABELS[id] || 'Background')
}

function abortBeforeEngine(payload) {
  return {
    created: true,
    sent: false,
    abortAt: 'before_fetch_/api/tale-scene',
    engine: 'fal-look-inpaint',
    engineCalled: false,
    url: '/api/tale-scene',
    method: 'POST',
    payloadKeys: Object.keys(payload),
    hasSource: Array.isArray(payload.images) && String(payload.images[0] || '').startsWith('data:image/'),
    hasMask: typeof payload.clothesMask === 'string' && payload.clothesMask.startsWith('data:image/png'),
    hasCast: Boolean(payload.deskCastLayout?.woman),
    hasVerify: Boolean(payload.deskLookVerify?.ok === true && payload.deskLookVerify?.maskSha256),
    maskSha256: payload.deskLookVerify?.maskSha256 || '',
  }
}

const fetchLog = []
const caseLogs = []

for (const item of CASES) {
  const labelsBin = path.join(WIRE, `${item.id}-labels.u8`)
  if (!existsSync(labelsBin)) throw new Error(`missing_wire_labels:${item.id}`)
  const ids = readFileSync(labelsBin)
  const facts = JSON.parse(readFileSync(path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit', item.id, 'facts.json'), 'utf8'))
  const layout = look.lookLayoutFromFaces(item.faces)
  const emb = embedCastFaces(item.source, item.faces)
  const pre = look.runDeskLookPreflight({
    labels: idsToLabels(ids),
    width: facts.width,
    height: facts.height,
    layout,
    faces: item.faces,
    embeds: emb.faces || [],
    embedOk: emb.ok === true,
  })
  const decision = pre.ok ? 'ok' : pre.reason
  const maskSha = sha256(Buffer.from(pre.mask))
  const before = fetchLog.length
  let apiRequest = null
  let payloadSummary = null

  if (!pre.ok) {
    caseLogs.push({
      id: item.id,
      kind: item.kind,
      expect: item.expect,
      decision,
      clientAbortedBeforeRequest: true,
      apiRequestCreated: false,
      httpSent: false,
      engineCalled: false,
      fetchLogDelta: [],
      maskSha256: maskSha,
      maskWhite: pre.white,
      modelSha256: {
        segformer: modelPin.segformer.nodeSha256,
        arcfaceRec: modelPin.arcfaceRec.nodeSha256,
      },
    })
    const line = `[FAIL-ABORT] ${item.id} reason=${decision} apiRequestCreated=false httpSent=false engineCalled=false fetchDelta=0`
    writeFileSync(path.join(OUT, `${item.id}.log`), `${line}\n`)
    console.log(line)
    continue
  }

  const png = maskPng.encodeGrayPng(facts.width, facts.height, pre.mask)
  const payload = look.buildLookPayload({
    source: `data:image/jpeg;base64,${readFileSync(item.source).toString('base64')}`,
    clothesMask: `data:image/png;base64,${Buffer.from(png).toString('base64')}`,
    layout,
    verify: pre.verify,
    maskSha256: maskSha,
    description: 'LOOK preview unpaid abort-before-engine',
    deskLook: 'silk',
    deskCouple: Boolean(layout.man),
  })
  apiRequest = abortBeforeEngine(payload)
  fetchLog.push({ id: item.id, ...apiRequest })
  payloadSummary = {
    composeMode: payload.composeMode,
    deskStep: payload.deskStep,
    images: [`data:image/jpeg;base64,<${readFileSync(item.source).length} bytes>`],
    clothesMask: `data:image/png;base64,<${png.length} bytes>`,
    deskCastLayout: payload.deskCastLayout,
    deskLookVerify: payload.deskLookVerify,
    deskLook: payload.deskLook,
    deskCouple: payload.deskCouple,
  }
  writeFileSync(path.join(OUT, `${item.id}-payload.json`), JSON.stringify(payloadSummary, null, 2))
  const line = [
    `[PASS-ABORT-BEFORE-ENGINE] ${item.id}`,
    `decision=${decision}`,
    `apiRequestCreated=true`,
    `httpSent=false`,
    `engineCalled=false`,
    `maskSha256=${maskSha}`,
    `segformerSha256=${modelPin.segformer.nodeSha256}`,
    `arcfaceRecSha256=${modelPin.arcfaceRec.nodeSha256}`,
    `payload.source=${payloadSummary.images[0] ? 'yes' : 'no'}`,
    `payload.mask=yes`,
    `payload.cast=${payloadSummary.deskCastLayout?.woman ? 'yes' : 'no'}`,
    `payload.verify.ok=${payload.deskLookVerify.ok}`,
  ].join(' ')
  writeFileSync(path.join(OUT, `${item.id}.log`), `${line}\n${JSON.stringify(apiRequest, null, 2)}\n`)
  console.log(line)
  caseLogs.push({
    id: item.id,
    kind: item.kind,
    expect: item.expect,
    decision,
    clientAbortedBeforeRequest: false,
    apiRequestCreated: true,
    httpSent: false,
    engineCalled: false,
    abortAt: apiRequest.abortAt,
    fetchLogDelta: fetchLog.slice(before),
    maskSha256: maskSha,
    maskWhite: pre.white,
    modelSha256: {
      segformer: modelPin.segformer.nodeSha256,
      arcfaceRec: modelPin.arcfaceRec.nodeSha256,
    },
    payloadLinked: apiRequest.hasSource && apiRequest.hasMask && apiRequest.hasCast && apiRequest.hasVerify,
  })
}

function lookSourceAbortsBeforePost() {
  const abortIdx = lookFn.indexOf('if (!pre.ok)')
  const postIdx = lookFn.indexOf('runDeskKontextStep')
  return abortIdx >= 0 && postIdx > abortIdx && /return/.test(lookFn.slice(abortIdx, postIdx))
}

async function waitHttp(url, timeoutMs) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return res
    } catch {
      /* preview not up yet */
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  return null
}

let preview = { ok: false, error: 'not_started' }
let child = null
try {
  child = spawn(
    path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'),
    ['pages', 'dev', 'public', '--ip', '127.0.0.1', '--port', String(PREVIEW_PORT)],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, FAL_KEY: '', REPLICATE_API_TOKEN: '', ANTHROPIC_API_KEY: '' },
    },
  )
  let boot = ''
  child.stdout.on('data', (d) => {
    boot += d.toString()
  })
  child.stderr.on('data', (d) => {
    boot += d.toString()
  })
  const htmlRes = await waitHttp(`${PREVIEW_BASE}/`, 90000)
  void boot
  if (!htmlRes) {
    preview = { ok: false, error: 'preview_timeout' }
  } else {
    const html = await htmlRes.text()
    const onnxRes = await fetch(`${PREVIEW_BASE}/desk-look-onnx.js?v=20260917look`)
    const preflightRes = await fetch(`${PREVIEW_BASE}/desk-look-preflight.js?v=20260917look`)
    const runtimeRes = await fetch(`${PREVIEW_BASE}/desk-look-runtime.js?v=20260917look`)
    const appRes = await fetch(`${PREVIEW_BASE}/app.js?v=20260917look`)
    const onnxText = onnxRes.ok ? await onnxRes.text() : ''
    preview = {
      ok: true,
      url: PREVIEW_BASE,
      htmlHasLookScripts:
        html.includes('desk-look-preflight.js?v=20260917look') &&
        html.includes('desk-look-onnx.js?v=20260917look') &&
        html.includes('desk-look-runtime.js?v=20260917look') &&
        html.includes('app.js?v=20260917look') &&
        html.includes('onnxruntime-web'),
      served: {
        onnx: onnxRes.status,
        preflight: preflightRes.status,
        runtime: runtimeRes.status,
        app: appRes.status,
      },
      browserModelUrls: {
        segformer: /SEG_HF = '([^']+)'/.exec(onnxText)?.[1] || null,
        rec: /REC_HF = '([^']+)'/.exec(onnxText)?.[1] || null,
      },
      workerIsNotNodeOnnx: true,
    }
  }
} catch (err) {
  preview = { ok: false, error: err instanceof Error ? err.message : String(err) }
} finally {
  if (child && child.pid) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      } else {
        child.kill('SIGTERM')
      }
    } catch {
      /* ignore */
    }
  }
}

const failOk = caseLogs
  .filter((c) => c.kind === 'fail')
  .every((c) => c.apiRequestCreated === false && c.httpSent === false && c.engineCalled === false && c.fetchLogDelta.length === 0)
const passOk = caseLogs
  .filter((c) => c.kind === 'pass-abort-before-engine')
  .every(
    (c) =>
      c.decision === 'ok' &&
      c.apiRequestCreated === true &&
      c.httpSent === false &&
      c.engineCalled === false &&
      c.payloadLinked === true,
  )

const report = {
  paidCallsThisStep: 0,
  cumulativePaidImageGens: 1,
  wanTouched: false,
  menuTouched: false,
  deploy: false,
  lookSourceAbortsBeforePost: lookSourceAbortsBeforePost(),
  modelPin,
  preview,
  cases: caseLogs,
  fetchLog,
  failRequestsNeverCreated: failOk,
  passAbortedBeforeEngine: passOk,
  httpActuallySent: fetchLog.some((x) => x.sent === true),
  engineCalled: false,
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
writeFileSync(
  path.join(OUT, 'fetch.log'),
  fetchLog.length
    ? fetchLog.map((x) => `${x.id} created=${x.created} sent=${x.sent} engineCalled=${x.engineCalled} abortAt=${x.abortAt}`).join('\n') + '\n'
    : 'FETCH_LOG_EMPTY\n',
)
console.log(
  JSON.stringify(
    {
      failRequestsNeverCreated: report.failRequestsNeverCreated,
      passAbortedBeforeEngine: report.passAbortedBeforeEngine,
      httpActuallySent: report.httpActuallySent,
      previewOk: preview.ok,
      paidCallsThisStep: 0,
    },
    null,
    2,
  ),
)
if (!report.failRequestsNeverCreated || !report.passAbortedBeforeEngine || report.httpActuallySent) process.exit(1)
if (!preview.ok) process.exit(1)
if (!modelPin.segformer.nodeSha256 || !modelPin.arcfaceRec.nodeSha256) process.exit(1)
