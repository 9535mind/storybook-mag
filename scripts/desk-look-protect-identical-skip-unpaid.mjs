#!/usr/bin/env node
/**
 * 무과금. 전 화소 protectIdentical이면 96×128·Claude face-box·자세 Leffa 재호출을 건너뛰고 저장.
 * 보호 1화소 변경은 우회하지 않고 기존 검사로 들어간다.
 * Claude / fal / Wan / 배포 없음.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-live-slip')
const LABELS = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire', 'woman-full-labels.u8')
const APP = path.join(ROOT, 'public', 'app.js')
const BASELINE = path.join(ROOT, 'scripts', 'desk-look-protect-identical-skip-baseline.json')

function deskProtectSkipsFaceBox(protect) {
  return Boolean(protect && protect.ok && protect.skipped !== true)
}

function parseLookRetryOk(appSrc) {
  const m = appSrc.match(/const lookRetryOk = \{([^}]+)\}/)
  if (!m) return null
  const obj = {}
  for (const part of m[1].split(',')) {
    const kv = part.trim()
    const mm = kv.match(/^(?:'([^']+)'|(\w+))\s*:\s*(\d+)/)
    if (mm) obj[mm[1] || mm[2]] = Number(mm[3])
  }
  return obj
}

function simulateLookAfterComposite({ protectIdentical, lookRetryOk }) {
  const skip96 = protectIdentical === true
  const protect = skip96 ? { ok: true, skipped: false } : { ok: false, skipped: false }
  const skipFaceBox = deskProtectSkipsFaceBox(protect)
  const claudeFaceBoxCalls = skipFaceBox ? 0 : 1
  const leffaRetryOnPose = skipFaceBox || !lookRetryOk?.pose ? 0 : 1
  return {
    skip96,
    skipFaceBox,
    claudeFaceBoxCalls,
    leffaRetryOnPose,
    save: skipFaceBox,
    route: skipFaceBox ? 'save' : 'existing',
  }
}

const appSrc = readFileSync(APP, 'utf8')
const lookRetryOk = parseLookRetryOk(appSrc)
if (!lookRetryOk) {
  console.log('app.js missing lookRetryOk')
  process.exit(1)
}
if (Object.prototype.hasOwnProperty.call(lookRetryOk, 'pose')) {
  console.log('app.js lookRetryOk still retries on pose')
  process.exit(1)
}
if (!/gateOpts\?\.protectIdentical/.test(appSrc)) {
  console.log('app.js missing protectIdentical short-circuit')
  process.exit(1)
}
if (!/protectIdentical = true/.test(appSrc)) {
  console.log('app.js LOOK does not lock protectIdentical after composite')
  process.exit(1)
}
if (!/if \(protectLocked\) \{[\s\S]*?return \{ ok: true \}/.test(appSrc)) {
  console.log('app.js does not skip 96 and face-box when protect is locked')
  process.exit(1)
}
if (!/:\s*maskUrl\s*\n\s*\?\s*await deskProtectPixelDiff/.test(appSrc)) {
  console.log('app.js dropped the general 96×128 protect path')
  process.exit(1)
}
if (!/if \(!protectLocked\) \{[\s\S]*reason: 'pose'/.test(appSrc)) {
  console.log('app.js dropped pose compare on the general path')
  process.exit(1)
}

const needed = ['src.rgba', 'out-v2.rgba', 'mask-v2-hard.gray', '03-composite-v2.png']
for (const name of needed) {
  if (!existsSync(path.join(OUT, name))) {
    console.log('missing', name)
    process.exit(1)
  }
}
if (!existsSync(LABELS)) {
  console.log('missing labels')
  process.exit(1)
}

const facts = JSON.parse(
  readFileSync(path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit', 'woman-full', 'facts.json'), 'utf8'),
)
const width = facts.width
const height = facts.height

const measured = lastJson(
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
w, h = job["w"], job["h"]
src = np.frombuffer(Path(job["src"]).read_bytes(), dtype=np.uint8).reshape((h, w, 4)).copy()
out = np.frombuffer(Path(job["out"]).read_bytes(), dtype=np.uint8).reshape((h, w, 4)).copy()
mask = np.frombuffer(Path(job["mask"]).read_bytes(), dtype=np.uint8).reshape((h, w))
labels = np.frombuffer(Path(job["labels"]).read_bytes(), dtype=np.uint8).reshape((h, w))
face_id = 11
def full_protect(a, b):
    prot = mask < 128
    n = int(prot.sum())
    d = np.abs(a[:,:,:3].astype(np.int16) - b[:,:,:3].astype(np.int16)).mean(axis=2)
    mx = float(d[prot].max()) if n else 1.0
    hot = int((d[prot] > 0).sum())
    return {"n": n, "hot": hot, "max": mx, "identical": n > 0 and mx == 0}
def nearest96(a, b):
    aa = np.asarray(Image.fromarray(a, "RGBA").resize((96, 128), Image.NEAREST))
    bb = np.asarray(Image.fromarray(b, "RGBA").resize((96, 128), Image.NEAREST))
    mm = np.asarray(Image.fromarray(mask, "L").resize((96, 128), Image.NEAREST))
    prot = mm < 128
    n = int(prot.sum())
    d = np.abs(aa[:,:,:3].astype(np.int16) - bb[:,:,:3].astype(np.int16)).mean(axis=2)
    hot = int((d[prot] > 0).sum())
    return {"n": n, "hot": hot, "ok": n > 0 and hot == 0}
v2 = full_protect(src, out)
v296 = nearest96(src, out)
tamper = None
changed = None
for y in range(h):
    for x in range(w):
        if mask[y, x] >= 128 or int(labels[y, x]) != face_id:
            continue
        alt = out.copy()
        alt[y, x, 0] = np.uint8(255 - int(alt[y, x, 0]))
        chk = full_protect(src, alt)
        if not chk["identical"] and chk["hot"] >= 1:
            tamper = chk
            changed = {"x": int(x), "y": int(y), "label": "Face"}
            Path(job["tamper"]).write_bytes(alt.tobytes())
            break
    if tamper:
        break
print(json.dumps({"v2": v2, "v296": v296, "tamper": tamper, "changed": changed}))
`,
    ],
    {
      input: JSON.stringify({
        src: path.join(OUT, 'src.rgba'),
        out: path.join(OUT, 'out-v2.rgba'),
        mask: path.join(OUT, 'mask-v2-hard.gray'),
        labels: LABELS,
        tamper: path.join(OUT, 'out-v2-face-1px.rgba'),
        w: width,
        h: height,
      }),
      encoding: 'utf8',
    },
  ),
)

if (!measured.v2 || !measured.tamper || !measured.changed) {
  console.log('could not build 1px protect control', measured)
  process.exit(1)
}

const v2 = simulateLookAfterComposite({
  protectIdentical: measured.v2.identical,
  lookRetryOk,
})
const face1px = simulateLookAfterComposite({
  protectIdentical: measured.tamper.identical,
  lookRetryOk,
})

const report = {
  newPaidCall: false,
  wanCalled: false,
  claudeFaceBoxCalled: v2.claudeFaceBoxCalls > 0,
  leffaRetryOnPose: v2.leffaRetryOnPose,
  criterion: '03-composite-v2.png',
  lookRetryHasPose: false,
  v2: {
    ...measured.v2,
    nearest96hot: measured.v296.hot,
    ...v2,
  },
  face1px: {
    ...measured.tamper,
    changed: measured.changed,
    ...face1px,
  },
}
report.ok =
  measured.v2.identical === true &&
  measured.v2.hot === 0 &&
  v2.skip96 === true &&
  v2.skipFaceBox === true &&
  v2.claudeFaceBoxCalls === 0 &&
  v2.leffaRetryOnPose === 0 &&
  v2.save === true &&
  v2.route === 'save' &&
  measured.tamper.identical === false &&
  measured.tamper.hot >= 1 &&
  face1px.skip96 === false &&
  face1px.skipFaceBox === false &&
  face1px.claudeFaceBoxCalls === 1 &&
  face1px.route === 'existing' &&
  face1px.save === false

writeFileSync(path.join(OUT, 'protect-identical-skip-repro.json'), JSON.stringify(report, null, 2))
writeFileSync(
  BASELINE,
  JSON.stringify(
    {
      criterion: '03-composite-v2.png',
      v2identical: measured.v2.identical,
      v2route: v2.route,
      v2claude: v2.claudeFaceBoxCalls,
      v2leffaRetryOnPose: v2.leffaRetryOnPose,
      face1pxidentical: measured.tamper.identical,
      face1pxroute: face1px.route,
      ok: report.ok,
    },
    null,
    2,
  ),
)
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
