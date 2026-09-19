#!/usr/bin/env node
/**
 * 무과금. 운영 02 Leffa raw로 보호영역 불일치를 재현한다.
 * fal / Wan / 배포 없음.
 */
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-live-slip')
const LABELS = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire', 'woman-full-labels.u8')
const BUNDLE = path.join(ROOT, '_tmp_bundle')

function esbuild(entry, outfile) {
  execSync(`node_modules\\.bin\\esbuild "${entry}" --bundle --platform=node --format=cjs --outfile="${outfile}"`, {
    cwd: ROOT,
    stdio: 'pipe',
  })
}

esbuild('functions/lib/desk-clothes-parse.ts', path.join(BUNDLE, 'desk-clothes-parse.cjs'))
esbuild('functions/lib/desk-clothes-composite.ts', path.join(BUNDLE, 'desk-clothes-composite.cjs'))
esbuild('functions/lib/face-preserve-mask.ts', path.join(BUNDLE, 'face-preserve-mask.cjs'))

const parseMod = await import(`file://${path.join(BUNDLE, 'desk-clothes-parse.cjs')}?t=${Date.now()}`)
const comp = await import(`file://${path.join(BUNDLE, 'desk-clothes-composite.cjs')}?t=${Date.now()}`)
const maskPng = await import(`file://${path.join(BUNDLE, 'face-preserve-mask.cjs')}?t=${Date.now()}`)

const facts = JSON.parse(
  readFileSync(path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit', 'woman-full', 'facts.json'), 'utf8'),
)
const width = facts.width
const height = facts.height
const labels = Array.from(readFileSync(LABELS), (id) => parseMod.CLOTHES_PARSE_LABELS[id] || 'Background')
const srcRgba = new Uint8Array(readFileSync(path.join(OUT, 'src.rgba')))
const genRgba = new Uint8Array(readFileSync(path.join(OUT, 'gen.rgba')))

const v2 = parseMod.assembleVtonIdentityMask({
  labels,
  width,
  height,
  woman: { x: 0, y: 0, w: 1, h: 1 },
  man: null,
  srcRgba,
})
if (!v2.ok) {
  console.log('v2 mask fail', v2.reason)
  process.exit(1)
}

function maskWithoutGaps() {
  const copy = parseMod.assembleVtonIdentityMask({
    labels,
    width,
    height,
    woman: { x: 0, y: 0, w: 1, h: 1 },
    man: null,
    srcRgba,
  })
  const out = new Uint8Array(copy.mask)
  for (let p = 0; p < out.length; p++) {
    if ((labels[p] || '') !== 'Background') continue
    const y = (p / width) | 0
    const x = p % width
    let left = false
    let right = false
    for (let xx = 0; xx < x; xx++) {
      const lab = labels[y * width + xx] || ''
      if (lab === 'Left-leg' || lab === 'Right-leg' || lab === 'Pants' || lab === 'Skirt' || lab === 'Dress') left = true
    }
    for (let xx = x + 1; xx < width; xx++) {
      const lab = labels[y * width + xx] || ''
      if (lab === 'Left-leg' || lab === 'Right-leg' || lab === 'Pants' || lab === 'Skirt' || lab === 'Dress') right = true
    }
    if (left && right) out[p] = 0
  }
  return out
}

const v1Mask = existsSync(path.join(OUT, '01-mask.png'))
  ? (() => {
      const raw = execFileSync(
        'py',
        [
          '-3',
          '-c',
          `
import json, sys
from PIL import Image
import numpy as np
job = json.loads(sys.stdin.read())
im = Image.open(job["image"]).convert("L").resize((job["w"], job["h"]), Image.NEAREST)
print(json.dumps({"n": im.size[0]*im.size[1]}))
open(job["out"], "wb").write(np.asarray(im, dtype=np.uint8).tobytes())
`,
        ],
        {
          input: JSON.stringify({
            image: path.join(OUT, '01-mask.png'),
            w: width,
            h: height,
            out: path.join(OUT, 'mask-v1-check.gray'),
          }),
          encoding: 'utf8',
        },
      )
      lastJson(raw)
      return Uint8Array.from(readFileSync(path.join(OUT, 'mask-v1-check.gray')), (b) => (b >= 128 ? 255 : 0))
    })()
  : maskWithoutGaps()

const outV2 = comp.compositeProtectRgba(srcRgba, genRgba, v2.mask, width, height, 6)
const checkV2 = comp.protectRegionMad(srcRgba, outV2, v2.mask, width, height, 6)
const checkV1onV2 = comp.protectRegionMad(srcRgba, outV2, v1Mask, width, height, 6)

function regionOf(lab) {
  if (lab === 'Face' || lab === 'Hair' || lab === 'Hat') return 'face'
  if (lab === 'Left-arm' || lab === 'Right-arm') return 'hand'
  if (lab === 'Left-shoe' || lab === 'Right-shoe') return 'shoes'
  if (lab === 'Background') return 'background'
  return 'other'
}

function mismatches(out, checkMask) {
  const hits = []
  const by = { face: 0, hand: 0, shoes: 0, background: 0, other: 0 }
  let x0 = width
  let y0 = height
  let x1 = -1
  let y1 = -1
  for (let p = 0; p < width * height; p++) {
    if (checkMask[p] >= 128) continue
    const i = p * 4
    const mad =
      (Math.abs(srcRgba[i] - out[i]) + Math.abs(srcRgba[i + 1] - out[i + 1]) + Math.abs(srcRgba[i + 2] - out[i + 2])) / 3
    if (mad <= 0) continue
    const x = p % width
    const y = (p / width) | 0
    const region = regionOf(labels[p] || '')
    by[region] += 1
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
    if (hits.length < 12) hits.push({ x, y, mad, label: labels[p] || '', region })
  }
  return {
    count: by.face + by.hand + by.shoes + by.background + by.other,
    first: hits[0] || null,
    samples: hits,
    bbox: hits.length ? { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null,
    byRegion: by,
  }
}

writeFileSync(path.join(OUT, 'mask-v2-hard.gray'), Buffer.from(v2.mask))
const bilinear2 = lastJson(
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
hard = np.frombuffer(Path(job["mask"]).read_bytes(), dtype=np.uint8).reshape((h, w))
im = Image.fromarray(hard, "L")
tiny = im.resize((max(8, w//4), max(8, h//4)), Image.BILINEAR)
back = tiny.resize((w, h), Image.BILINEAR)
arr = np.asarray(back, dtype=np.uint8)
Path(job["out"]).write_bytes(arr.tobytes())
print(json.dumps({"soft": int(np.sum((arr>=1)&(arr<=254))), "flip": int(np.sum(((hard>=128)!=(arr>=128))))}))
`,
    ],
    {
      input: JSON.stringify({
        mask: path.join(OUT, 'mask-v2-hard.gray'),
        w: width,
        h: height,
        out: path.join(OUT, 'mask-v2-bilinear.gray'),
      }),
      encoding: 'utf8',
    },
  ),
)

const softMask = Uint8Array.from(readFileSync(path.join(OUT, 'mask-v2-bilinear.gray')))
const outSoft = comp.compositeProtectRgba(srcRgba, genRgba, softMask, width, height, 6)
const checkSoftOnHard = comp.protectRegionMad(srcRgba, outSoft, v2.mask, width, height, 6)
const checkHardOnSoftComp = mismatches(outSoft, v2.mask)
const v1onV2 = mismatches(outV2, v1Mask)
const v2onV2 = mismatches(outV2, v2.mask)

writeFileSync(path.join(OUT, 'out-v2.rgba'), Buffer.from(outV2))
const down = lastJson(
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
def load_rgba(p):
    return Image.fromarray(np.frombuffer(Path(p).read_bytes(), dtype=np.uint8).reshape((h, w, 4)), "RGBA")
src = load_rgba(job["src"])
out = load_rgba(job["out"])
mask = Image.fromarray(np.frombuffer(Path(job["mask"]).read_bytes(), dtype=np.uint8).reshape((h, w)), "L")
def check(resample):
    a = np.asarray(src.resize((96, 128), resample), dtype=np.uint8)
    b = np.asarray(out.resize((96, 128), resample), dtype=np.uint8)
    m = np.asarray(mask.resize((96, 128), resample), dtype=np.uint8)
    prot = m < 128
    n = int(prot.sum())
    if n == 0:
        return {"n": 0, "hot": 0, "ok": False}
    d = np.abs(a[:,:,:3].astype(np.int16) - b[:,:,:3].astype(np.int16)).mean(axis=2)
    hot = int((d[prot] > 0).sum())
    return {"n": n, "hot": hot, "ok": hot == 0}
print(json.dumps({"bilinear96": check(Image.BILINEAR), "nearest96": check(Image.NEAREST)}))
`,
    ],
    {
      input: JSON.stringify({
        src: path.join(OUT, 'src.rgba'),
        out: path.join(OUT, 'out-v2.rgba'),
        mask: path.join(OUT, 'mask-v2-hard.gray'),
        w: width,
        h: height,
      }),
      encoding: 'utf8',
    },
  ),
)

const report = {
  newPaidCall: false,
  wanCalled: false,
  criterion: '03-composite-v2.png',
  v2self: { protect: checkV2, mismatches: v2onV2 },
  v1checkOnV2composite: { protect: checkV1onV2, mismatches: v1onV2 },
  bilinearMaskThenCheckHard: { protect: checkSoftOnHard, mismatches: checkHardOnSoftComp, ...bilinear2 },
  deskProtectPixelDiff: down,
}
writeFileSync(path.join(OUT, 'protect-repro.json'), JSON.stringify(report, null, 2))
writeFileSync(
  path.join(ROOT, 'scripts', 'desk-look-protect-repro-baseline.json'),
  JSON.stringify(
    {
      criterion: '03-composite-v2.png',
      v2selfMismatches: v2onV2.count,
      nearest96hot: down.nearest96.hot,
      bilinear96hot: down.bilinear96.hot,
      ok: v2onV2.count === 0 && down.nearest96.hot === 0,
    },
    null,
    2,
  ),
)
console.log(JSON.stringify(report, null, 2))
if (v2onV2.count !== 0 || down.nearest96.hot !== 0) process.exit(1)
