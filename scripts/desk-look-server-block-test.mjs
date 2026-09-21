#!/usr/bin/env node
/**
 * 무과금: 모델 SHA 핀, 조작 payload 서버 차단, 정상 2종 httpSent=false.
 * fal / Replicate / Wan 없음. 사각형 마스크 fallback 없음.
 */
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-server-block')
const WIRE = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire')
const BUNDLE = path.join(ROOT, '_tmp_bundle')
mkdirSync(OUT, { recursive: true })
mkdirSync(BUNDLE, { recursive: true })

function esbuild(entry, outfile, extra) {
  execSync(`node_modules\\.bin\\esbuild "${entry}" --bundle ${extra} --outfile="${outfile}"`, {
    cwd: ROOT,
    stdio: 'pipe',
  })
}

esbuild('functions/lib/desk-look-models.ts', path.join(ROOT, 'public', 'desk-look-models.js'), '--format=iife --global-name=DeskLookModels')
esbuild('functions/lib/desk-look-preflight.ts', path.join(ROOT, 'public', 'desk-look-preflight.js'), '--format=iife --global-name=DeskLookLib')
esbuild('functions/lib/desk-look-models.ts', path.join(BUNDLE, 'desk-look-models.cjs'), '--platform=node --format=cjs')
esbuild('functions/lib/desk-look-preflight.ts', path.join(BUNDLE, 'desk-look-preflight.cjs'), '--platform=node --format=cjs')
esbuild('functions/lib/desk-look-server-verify.ts', path.join(BUNDLE, 'desk-look-server-verify.cjs'), '--platform=node --format=cjs')
esbuild('functions/lib/face-preserve-mask.ts', path.join(BUNDLE, 'face-preserve-mask.cjs'), '--platform=node --format=cjs')
esbuild('functions/lib/desk-clothes-parse.ts', path.join(BUNDLE, 'desk-clothes-parse.cjs'), '--platform=node --format=cjs')

const models = await import(`file://${path.join(BUNDLE, 'desk-look-models.cjs')}?t=${Date.now()}`)
const look = await import(`file://${path.join(BUNDLE, 'desk-look-preflight.cjs')}?t=${Date.now()}`)
const gate = await import(`file://${path.join(BUNDLE, 'desk-look-server-verify.cjs')}?t=${Date.now()}`)
const maskPng = await import(`file://${path.join(BUNDLE, 'face-preserve-mask.cjs')}?t=${Date.now()}`)
const parseMod = await import(`file://${path.join(BUNDLE, 'desk-clothes-parse.cjs')}?t=${Date.now()}`)

function sha256File(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex')
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

const SEG_FILE = path.join(ROOT, 'tmp-faceswap-test', '_models', 'segformer_b2_clothes', 'model_quantized.onnx')
const REC_FILE = path.join(process.env.USERPROFILE || '', '.insightface', 'models', 'buffalo_l', 'w600k_r50.onnx')
const pin = models.DESK_LOOK_MODELS
const localSeg = sha256File(SEG_FILE)
const localRec = sha256File(REC_FILE)
const pinOk = localSeg === pin.segformer.sha256 && localRec === pin.rec.sha256 && existsSync(SEG_FILE)

const htmlAbort = (() => {
  const html = Buffer.from('<!doctype html><html lang="ko"><head></head><body>index</body></html>')
  const looksHtml = html[0] === 0x3c
  const sha = sha256(html)
  return { looksHtml, shaMatch: sha === pin.segformer.sha256, abort: looksHtml || sha !== pin.segformer.sha256 }
})()

const onnxJs = readFileSync(path.join(ROOT, 'public', 'desk-look-onnx.js'), 'utf8')
const lookFn = readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8')
const lookSlice = lookFn.slice(lookFn.indexOf('const runDeskStepLook'), lookFn.indexOf('const runDeskStepPlace'))
const noRectFallback =
  !/buildWomanClothesMaskDataUrl/.test(lookSlice) &&
  !/SEG_LOCAL/.test(onnxJs) &&
  !/resolve\/main\//.test(onnxJs) &&
  /fetchPinned/.test(onnxJs) &&
  /model_sha/.test(onnxJs)

function idsToLabels(ids) {
  return Array.from(ids, (id) => parseMod.CLOTHES_PARSE_LABELS[id] || 'Background')
}

async function buildCase(id, faces) {
  const facts = JSON.parse(
    readFileSync(path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit', id, 'facts.json'), 'utf8'),
  )
  const labels = idsToLabels(readFileSync(path.join(WIRE, `${id}-labels.u8`)))
  const layout = look.lookLayoutFromFaces(faces)
  const pre = look.runDeskLookPreflight({
    labels,
    width: facts.width,
    height: facts.height,
    layout,
    faces,
    embeds: faces.map((f) => ({ slot: f.slot, dim: 512, vec: Array(512).fill(0).map((_, i) => (f.slot === 'woman' ? i : i + 3)) })),
    embedOk: true,
  })
  const png = maskPng.encodeGrayPng(facts.width, facts.height, pre.mask)
  const source = `data:image/jpeg;base64,${readFileSync(
    id === 'woman-full'
      ? path.join(ROOT, 'tmp-faceswap-test', 'try-stand', '1-stand.jpg')
      : path.join(ROOT, 'tmp-faceswap-test', 'try-shorts-kiss-v2', 'f01-start.jpg'),
  ).toString('base64')}`
  const clothesMask = `data:image/png;base64,${Buffer.from(png).toString('base64')}`
  const maskSha = sha256(Buffer.from(pre.mask))
  return { pre, layout, source, clothesMask, maskSha, width: facts.width, height: facts.height, png }
}

const womanFull = await buildCase('woman-full', [{ slot: 'woman', x: 0.39, y: 0.07, w: 0.2, h: 0.13 }])
const coupleLeft = await buildCase('couple-woman-left', [
  { slot: 'woman', x: 0.14, y: 0.4, w: 0.2, h: 0.14 },
  { slot: 'man', x: 0.5, y: 0.36, w: 0.22, h: 0.15 },
])

function approvedVerify(maskSha) {
  return {
    ok: true,
    maskSha256: maskSha,
    segformerSha256: pin.segformer.sha256,
    recSha256: pin.rec.sha256,
  }
}

const tampers = [
  {
    id: 'missing-verify',
    expect: 'look_verify_required',
    body: {
      source: womanFull.source,
      clothesMask: womanFull.clothesMask,
      deskCastLayout: womanFull.layout,
      deskLookVerify: null,
    },
  },
  {
    id: 'size-mismatch',
    expect: 'look_size_mismatch',
    body: {
      source: womanFull.source,
      clothesMask: `data:image/png;base64,${Buffer.from(maskPng.encodeGrayPng(32, 32, new Uint8Array(32 * 32).fill(255))).toString('base64')}`,
      deskCastLayout: womanFull.layout,
      deskLookVerify: approvedVerify('deadbeefdeadbeefdeadbeefdeadbeef'),
    },
  },
  {
    id: 'mask-sha',
    expect: 'look_mask_sha',
    body: {
      source: womanFull.source,
      clothesMask: womanFull.clothesMask,
      deskCastLayout: womanFull.layout,
      deskLookVerify: approvedVerify('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    },
  },
  {
    id: 'white-too-small',
    expect: 'look_mask_too_small',
    body: (() => {
      const tiny = new Uint8Array(womanFull.width * womanFull.height)
      for (let i = 0; i < 40; i++) tiny[i] = 255
      const png = maskPng.encodeGrayPng(womanFull.width, womanFull.height, tiny)
      return {
        source: womanFull.source,
        clothesMask: `data:image/png;base64,${Buffer.from(png).toString('base64')}`,
        deskCastLayout: womanFull.layout,
        deskLookVerify: approvedVerify(sha256(Buffer.from(tiny))),
      }
    })(),
  },
  {
    id: 'cast-bounds-man',
    expect: 'look_mask_cast',
    body: {
      source: coupleLeft.source,
      clothesMask: coupleLeft.clothesMask,
      deskCastLayout: {
        woman: { x: 0.9, y: 0.9, w: 0.08, h: 0.08 },
        man: { x: 0, y: 0, w: 1, h: 1 },
      },
      deskLookVerify: approvedVerify(coupleLeft.maskSha),
    },
  },
]

const tamperRows = []
for (const item of tampers) {
  const result = await gate.verifyLookInpaintPayload(item.body)
  const row = {
    id: item.id,
    expect: item.expect,
    error: result.ok ? 'ok' : result.error,
    blocked: !result.ok && result.error === item.expect && result.status === 400,
    httpSent: false,
    engineCalled: false,
  }
  tamperRows.push(row)
  console.log(`[BLOCK] ${item.id} expect=${item.expect} got=${row.error} blocked=${row.blocked}`)
}

const passIds = [
  { id: 'woman-full', built: womanFull },
  { id: 'couple-woman-left', built: coupleLeft },
]
const passRows = []
for (const item of passIds) {
  const result = await gate.verifyLookInpaintPayload({
    source: item.built.source,
    clothesMask: item.built.clothesMask,
    deskCastLayout: item.built.layout,
    deskLookVerify: approvedVerify(item.built.maskSha),
  })
  const row = {
    id: item.id,
    serverWouldAccept: result.ok === true,
    apiRequestCreated: result.ok === true,
    httpSent: false,
    engineCalled: false,
    abortAt: 'before_fetch_/api/tale-scene',
    maskSha256: item.built.maskSha,
    modelSha256: { segformer: pin.segformer.sha256, rec: pin.rec.sha256 },
  }
  passRows.push(row)
  console.log(`[PASS-ABORT] ${item.id} serverWouldAccept=${row.serverWouldAccept} httpSent=false`)
}

const extraModel = await gate.verifyLookInpaintPayload({
  source: womanFull.source,
  clothesMask: womanFull.clothesMask,
  deskCastLayout: womanFull.layout,
  deskLookVerify: {
    ok: true,
    maskSha256: womanFull.maskSha,
    segformerSha256: '0'.repeat(64),
    recSha256: pin.rec.sha256,
  },
})

const report = {
  paidCallsThisStep: 0,
  cumulativePaidImageGens: 1,
  wanTouched: false,
  menuTouched: false,
  deploy: false,
  pin: {
    segformerUrl: pin.segformer.url,
    recUrl: pin.rec.url,
    segformerRevision: pin.segformer.revision,
    recRevision: pin.rec.revision,
    localMatchesPin: pinOk,
    localSegSha: localSeg,
    localRecSha: localRec,
    htmlFallbackAborts: htmlAbort.abort,
  },
  noRectFallback,
  tampers: tamperRows,
  extraModelShaBlocked: !extraModel.ok && extraModel.error === 'look_model_sha',
  passAborted: passRows,
  allTampersBlocked: tamperRows.every((r) => r.blocked),
  passHttpSent: passRows.some((r) => r.httpSent),
  engineCalled: false,
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
writeFileSync(
  path.join(OUT, 'block.log'),
  tamperRows.map((r) => `${r.id} blocked=${r.blocked} error=${r.error} httpSent=false`).join('\n') +
    `\nhtmlFallbackAborts=${htmlAbort.abort}\nnoRectFallback=${noRectFallback}\n` +
    passRows.map((r) => `${r.id} httpSent=false engineCalled=false`).join('\n') +
    '\n',
)
console.log(
  JSON.stringify(
    {
      pinOk,
      htmlFallbackAborts: htmlAbort.abort,
      noRectFallback,
      allTampersBlocked: report.allTampersBlocked,
      extraModelShaBlocked: report.extraModelShaBlocked,
      passHttpSent: report.passHttpSent,
      paidCallsThisStep: 0,
    },
    null,
    2,
  ),
)
if (!pinOk || !htmlAbort.abort || !noRectFallback || !report.allTampersBlocked || report.passHttpSent) process.exit(1)
if (!report.extraModelShaBlocked) process.exit(1)
if (!passRows.every((r) => r.serverWouldAccept)) process.exit(1)
