#!/usr/bin/env node
/**
 * 무과금. 보호화소가 같으면 face-box를 건너뛰고,
 * 얼굴 보호 1화소가 바뀌면 건너뛰지 않는다.
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
const BASELINE = path.join(ROOT, 'scripts', 'desk-look-facebox-skip-baseline.json')

function deskProtectSkipsFaceBox(protect) {
  return Boolean(protect && protect.ok && protect.skipped !== true)
}

function deskLookFaceBoxRoute(protect) {
  return deskProtectSkipsFaceBox(protect) ? 'skip' : 'face-box'
}

const appSrc = readFileSync(APP, 'utf8')
if (!appSrc.includes('function deskProtectSkipsFaceBox(protect)')) {
  console.log('app.js missing deskProtectSkipsFaceBox')
  process.exit(1)
}
if (!/const protectLocked = deskProtectSkipsFaceBox\(protect\)/.test(appSrc)) {
  console.log('app.js does not route face-box through deskProtectSkipsFaceBox')
  process.exit(1)
}
if (!/if \(!protectLocked\) \{[\s\S]*reason: 'pose'/.test(appSrc)) {
  console.log('app.js still compares face-box pose when protect is locked')
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
def nearest_protect(a, b):
    aa = np.asarray(Image.fromarray(a, "RGBA").resize((96, 128), Image.NEAREST))
    bb = np.asarray(Image.fromarray(b, "RGBA").resize((96, 128), Image.NEAREST))
    mm = np.asarray(Image.fromarray(mask, "L").resize((96, 128), Image.NEAREST))
    prot = mm < 128
    n = int(prot.sum())
    d = np.abs(aa[:,:,:3].astype(np.int16) - bb[:,:,:3].astype(np.int16)).mean(axis=2)
    hot = int((d[prot] > 0).sum())
    return {"n": n, "hot": hot, "ok": n > 0 and hot == 0}
coord = np.zeros((h, w, 4), dtype=np.uint8)
xs = np.arange(w, dtype=np.uint32)
ys = np.arange(h, dtype=np.uint32)
coord[:,:,0] = (xs % 256).astype(np.uint8)
coord[:,:,1] = (xs // 256).astype(np.uint8)
coord[:,:,2] = (ys % 256)[:, None].astype(np.uint8)
coord[:,:,3] = (ys // 256)[:, None].astype(np.uint8)
sampled = np.asarray(Image.fromarray(coord, "RGBA").resize((96, 128), Image.NEAREST))
mm = np.asarray(Image.fromarray(mask, "L").resize((96, 128), Image.NEAREST))
v2 = nearest_protect(src, out)
tamper = None
changed = None
for dy in range(128):
    for dx in range(96):
        if mm[dy, dx] >= 128:
            continue
        sx = int(sampled[dy, dx, 0]) + int(sampled[dy, dx, 1]) * 256
        sy = int(sampled[dy, dx, 2]) + int(sampled[dy, dx, 3]) * 256
        if sx >= w or sy >= h:
            continue
        if mask[sy, sx] >= 128 or int(labels[sy, sx]) != face_id:
            continue
        alt = out.copy()
        alt[sy, sx, 0] = np.uint8(255 - int(alt[sy, sx, 0]))
        chk = nearest_protect(src, alt)
        if not chk["ok"] and chk["hot"] >= 1:
            tamper = chk
            changed = {"x": int(sx), "y": int(sy), "label": "Face"}
            Path(job["tamper"]).write_bytes(alt.tobytes())
            break
    if tamper:
        break
print(json.dumps({"v2": v2, "tamper": tamper, "changed": changed}))
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
  console.log('could not build 1px face-protect control', measured)
  process.exit(1)
}

const v2Protect = { ok: measured.v2.ok, skipped: false }
const tamperProtect = { ok: measured.tamper.ok, skipped: false }
const report = {
  newPaidCall: false,
  wanCalled: false,
  claudeFaceBoxCalled: false,
  criterion: '03-composite-v2.png',
  v2: {
    ...measured.v2,
    skipFaceBox: deskProtectSkipsFaceBox(v2Protect),
    route: deskLookFaceBoxRoute(v2Protect),
  },
  face1px: {
    ...measured.tamper,
    changed: measured.changed,
    skipFaceBox: deskProtectSkipsFaceBox(tamperProtect),
    route: deskLookFaceBoxRoute(tamperProtect),
  },
}
report.ok =
  report.v2.ok === true &&
  report.v2.hot === 0 &&
  report.v2.route === 'skip' &&
  report.v2.skipFaceBox === true &&
  report.face1px.ok === false &&
  report.face1px.hot >= 1 &&
  report.face1px.route === 'face-box' &&
  report.face1px.skipFaceBox === false

writeFileSync(path.join(OUT, 'facebox-skip-repro.json'), JSON.stringify(report, null, 2))
writeFileSync(
  BASELINE,
  JSON.stringify(
    {
      criterion: '03-composite-v2.png',
      v2hot: report.v2.hot,
      v2route: report.v2.route,
      face1pxhot: report.face1px.hot,
      face1pxroute: report.face1px.route,
      ok: report.ok,
    },
    null,
    2,
  ),
)
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
