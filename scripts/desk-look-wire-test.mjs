#!/usr/bin/env node
/**
 * 무과금 통합: 진단 파서와 LOOK 운영 경로의 마스크 해시·판정이 같은지.
 * fal / Replicate / Wan / Anthropic 호출 없음.
 */
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { embedCastFaces, parseClothesLabels } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire')
const DIAG = path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit')
const BUNDLE_DIR = path.join(ROOT, '_tmp_bundle')
const PARSE_BUNDLE = path.join(BUNDLE_DIR, 'desk-clothes-parse.cjs')
const PRE_BUNDLE = path.join(BUNDLE_DIR, 'desk-look-preflight.cjs')
const MASK_BUNDLE = path.join(BUNDLE_DIR, 'face-preserve-mask.cjs')
const PUBLIC_PRE = path.join(ROOT, 'public', 'desk-look-preflight.js')

if (!existsSync(BUNDLE_DIR)) mkdirSync(BUNDLE_DIR, { recursive: true })
mkdirSync(OUT, { recursive: true })

function esbuild(entry, outfile, extra) {
  execSync(`node_modules\\.bin\\esbuild "${entry}" --bundle ${extra} --outfile="${outfile}"`, {
    cwd: ROOT,
    stdio: 'pipe',
  })
}

esbuild('functions/lib/desk-clothes-parse.ts', PARSE_BUNDLE, '--platform=node --format=cjs')
esbuild('functions/lib/desk-look-preflight.ts', PRE_BUNDLE, '--platform=node --format=cjs')
esbuild('functions/lib/face-preserve-mask.ts', MASK_BUNDLE, '--platform=node --format=cjs')
esbuild('functions/lib/desk-look-preflight.ts', PUBLIC_PRE, '--format=iife --global-name=DeskLookLib')

const parseMod = await import(`file://${PARSE_BUNDLE}?t=${Date.now()}`)
const look = await import(`file://${PRE_BUNDLE}?t=${Date.now()}`)
const maskPng = await import(`file://${MASK_BUNDLE}?t=${Date.now()}`)

const CASES = [
  {
    id: 'woman-bust',
    source: path.join(ROOT, 'tmp-faceswap-test', 'try-extend', '5-woman-id.jpg'),
    faces: [{ slot: 'woman', x: 0.22, y: 0.16, w: 0.56, h: 0.62 }],
    expect: 'mask_too_small',
  },
  {
    id: 'woman-full',
    source: path.join(ROOT, 'tmp-faceswap-test', 'try-stand', '1-stand.jpg'),
    faces: [{ slot: 'woman', x: 0.39, y: 0.07, w: 0.2, h: 0.13 }],
    expect: 'clothes_regions',
  },
  {
    id: 'couple-woman-left',
    source: path.join(ROOT, 'tmp-faceswap-test', 'try-shorts-kiss-v2', 'f01-start.jpg'),
    faces: [
      { slot: 'woman', x: 0.14, y: 0.4, w: 0.2, h: 0.14 },
      { slot: 'man', x: 0.5, y: 0.36, w: 0.22, h: 0.15 },
    ],
    expect: 'clothes_regions',
  },
  {
    id: 'couple-woman-right',
    source: path.join(ROOT, 'tmp-faceswap-test', 'woman-face-id.jpg'),
    faces: [
      { slot: 'man', x: 0.0, y: 0.08, w: 0.2, h: 0.52 },
      { slot: 'woman', x: 0.28, y: 0.1, w: 0.58, h: 0.64 },
    ],
    expect: 'undetected',
  },
]

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function idsToLabels(ids) {
  return Array.from(ids, (id) => parseMod.CLOTHES_PARSE_LABELS[id] || 'Background')
}

function runPath(labels, width, height, layout, faces, emb) {
  return look.runDeskLookPreflight({
    labels,
    width,
    height,
    layout,
    faces,
    embeds: emb.faces || [],
    embedOk: emb.ok === true,
  })
}

const rows = []
for (const item of CASES) {
  const diagFacts = JSON.parse(readFileSync(path.join(DIAG, item.id, 'facts.json'), 'utf8'))
  const layout = look.lookLayoutFromFaces(item.faces)
  const diagBin = path.join(DIAG, item.id, 'labels.u8')
  if (!existsSync(diagBin)) throw new Error(`missing_diag_labels:${item.id}`)
  const diagIds = readFileSync(diagBin)
  const opBin = path.join(OUT, `${item.id}-labels.u8`)
  const parsed = parseClothesLabels(item.source, opBin, parseMod.CLOTHES_PARSE_LABELS)
  const width = parsed.width
  const height = parsed.height
  if (width !== diagFacts.width || height !== diagFacts.height) {
    throw new Error(`size_mismatch:${item.id} op=${width}x${height} diag=${diagFacts.width}x${diagFacts.height}`)
  }
  const opLabels = parsed.labels
  const opIds = readFileSync(opBin)
  const emb = embedCastFaces(item.source, item.faces)
  const diagPre = runPath(idsToLabels(diagIds), width, height, layout, item.faces, emb)
  const opPre = runPath(opLabels, width, height, layout, item.faces, emb)
  const diagDecision = diagPre.ok ? 'ok' : diagPre.reason
  const opDecision = opPre.ok ? 'ok' : opPre.reason
  const png = maskPng.encodeGrayPng(width, height, opPre.mask)
  writeFileSync(path.join(OUT, `${item.id}-mask.png`), png)
  const clothesMask = `data:image/png;base64,${Buffer.from(png).toString('base64')}`
  const sourceData = `data:image/jpeg;base64,${readFileSync(item.source).toString('base64')}`
  const maskSha = sha256(Buffer.from(opPre.mask))
  const payload = look.buildLookPayload({
    source: sourceData,
    clothesMask,
    layout,
    verify: opPre.verify,
    maskSha256: maskSha,
    description: 'LOOK dry-run unpaid',
    deskLook: 'silk',
    deskCouple: Boolean(layout.man),
  })
  const wouldCallPaid = Boolean(opPre.ok && payload.deskLookVerify?.ok === true)
  const row = {
    id: item.id,
    expect: item.expect,
    diagnosticDecision: diagDecision,
    operationalDecision: opDecision,
    matchExpect: opDecision === item.expect && diagDecision === item.expect,
    labelsHashDiagnostic: sha256(diagIds),
    labelsHashOperational: sha256(opIds),
    labelsHashMatch: sha256(diagIds) === sha256(opIds),
    maskHashDiagnostic: sha256(Buffer.from(diagPre.mask)),
    maskHashOperational: maskSha,
    maskHashMatch: sha256(Buffer.from(diagPre.mask)) === maskSha,
    whiteDiagnostic: diagPre.white,
    whiteOperational: opPre.white,
    whiteUpper: opPre.whiteUpper,
    whiteLower: opPre.whiteLower,
    clothesRegionsTogether: opPre.regions?.together === true,
    embedOk: emb.ok === true,
    embedEngine: emb.engine || emb.error || '',
    payloadHasSource: Array.isArray(payload.images) && String(payload.images[0] || '').startsWith('data:image/'),
    payloadHasMask: typeof payload.clothesMask === 'string' && payload.clothesMask.startsWith('data:image/png'),
    payloadHasCast: Boolean(payload.deskCastLayout?.woman),
    payloadHasVerify: Boolean(payload.deskLookVerify?.maskSha256) && payload.deskLookVerify.maskSha256 === maskSha,
    wouldCallPaid,
    paidCalls: 0,
  }
  const payloadDump = {
    ...payload,
    images: [`data:image/jpeg;base64,<${readFileSync(item.source).length} bytes>`],
    clothesMask: `data:image/png;base64,<${png.length} bytes sha256=${maskSha}>`,
  }
  writeFileSync(path.join(OUT, `${item.id}-payload.json`), JSON.stringify(payloadDump, null, 2))
  rows.push(row)
  console.log(
    `${item.id} diag=${diagDecision} op=${opDecision} expect=${item.expect} labels=${row.labelsHashMatch} mask=${row.maskHashMatch} white=${opPre.white} upper=${opPre.whiteUpper} lower=${opPre.whiteLower} together=${row.clothesRegionsTogether} paid=0`,
  )
}

const report = {
  paidCallsThisStep: 0,
  cumulativePaidImageGens: 1,
  wanTouched: false,
  menuTouched: false,
  deploy: false,
  cases: rows,
  allHashMatch: rows.every((r) => r.labelsHashMatch && r.maskHashMatch),
  allDecisionMatch: rows.every((r) => r.matchExpect && r.diagnosticDecision === r.operationalDecision),
  allPayloadLinked: rows.every((r) => r.payloadHasSource && r.payloadHasMask && r.payloadHasCast && r.payloadHasVerify),
  noPaidCall: rows.every((r) => r.paidCalls === 0 && r.wouldCallPaid === false || r.expect === 'ok'),
}
report.unpaidOk = report.paidCallsThisStep === 0 && rows.every((r) => !r.wouldCallPaid || r.expect === 'ok')
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(
  JSON.stringify(
    {
      allHashMatch: report.allHashMatch,
      allDecisionMatch: report.allDecisionMatch,
      allPayloadLinked: report.allPayloadLinked,
      paidCallsThisStep: 0,
    },
    null,
    2,
  ),
)
if (!report.allHashMatch || !report.allDecisionMatch || !report.allPayloadLinked) process.exit(1)
