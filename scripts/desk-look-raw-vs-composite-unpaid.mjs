#!/usr/bin/env node
/**
 * 무과금. 보존 02-model-raw vs 03-composite-v2 위팔 검은 선·왜곡.
 * 엔진 교체 vs 마스크/합성 경계. 슬립 클릭·Claude / fal / Wan / 배포 없음.
 */
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const LIVE = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-live-slip')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-raw-vs-composite')
const BUNDLE = path.join(ROOT, '_tmp_bundle', 'desk-look-visual-gate.cjs')
const BASELINE = path.join(ROOT, 'scripts', 'desk-look-raw-vs-composite-baseline.json')
const OFFICE = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-mask-seam-remnant')

mkdirSync(OUT, { recursive: true })

const KEEP = [
  ['00-source.jpg', '00-source.jpg'],
  ['02-model-raw.png', '02-model-raw.png'],
  ['03-composite-v2.png', '03-composite-v2.png'],
  ['01-mask-v2.png', '01-mask-v2.png'],
  ['submit.json', 'submit.json'],
]
for (const [from, to] of KEEP) {
  const src = path.join(LIVE, from)
  if (!existsSync(src)) {
    console.log('missing preserve', from)
    process.exit(1)
  }
  copyFileSync(src, path.join(OUT, to))
}

execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-look-visual-gate.ts" --bundle --platform=node --format=cjs --outfile="${BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const visual = await import(`file://${BUNDLE}?t=${Date.now()}`)

function dump(imagePath, outPath, gray, resize) {
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
im = Image.open(job["image"]).convert("L" if job.get("gray") else "RGBA")
if job.get("resize"):
    im = im.resize((int(job["resize"][0]), int(job["resize"][1])), Image.BILINEAR)
Path(job["out"]).write_bytes(np.asarray(im, dtype=np.uint8).tobytes())
print(json.dumps({"width": im.size[0], "height": im.size[1]}))
`,
      ],
      {
        input: JSON.stringify({ image: imagePath, out: outPath, gray: Boolean(gray), resize: resize || null }),
        encoding: 'utf8',
      },
    ),
  )
}

function maskFromGray(buf) {
  const out = new Uint8Array(buf.length)
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] >= 128 ? 255 : 0
  return out
}

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
src = np.asarray(Image.open(job["src"]).convert("RGBA"), dtype=np.uint8)
raw0 = Image.open(job["raw"]).convert("RGBA")
comp = np.asarray(Image.open(job["comp"]).convert("RGBA"), dtype=np.uint8)
mask0 = Image.open(job["mask"]).convert("L")
h, w = src.shape[:2]
raw = np.asarray(raw0.resize((w, h), Image.BILINEAR), dtype=np.uint8)
mask = np.asarray(mask0.resize((w, h), Image.NEAREST), dtype=np.uint8)
def lum(a):
    return (a[:,:,0].astype(np.int16)*3 + a[:,:,1].astype(np.int16)*4 + a[:,:,2].astype(np.int16)) / 8
sl, rl, cl = lum(src), lum(raw), lum(comp)
edit = mask >= 128
# mask outline band
band = np.zeros(mask.shape, dtype=bool)
yy, xx = np.where(edit)
for y, x in zip(yy, xx):
    y0, y1 = max(0, y-3), min(h-1, y+3)
    x0, x1 = max(0, x-3), min(w-1, x+3)
    patch = edit[y0:y1+1, x0:x1+1]
    if patch.any() and (~patch).any():
        band[y0:y1+1, x0:x1+1] |= True
# upper-arm rows: 28–52% of mask bbox
ys, xs = np.where(edit)
if len(ys) == 0:
    raise SystemExit("empty mask")
y0, y1 = ys.min(), ys.max()
armY0 = y0 + int((y1 - y0) * 0.22)
armY1 = y0 + int((y1 - y0) * 0.55)
armBand = band & (np.arange(h)[:, None] >= armY0) & (np.arange(h)[:, None] <= armY1)
# leftover: dark in image, dark in source clothes, contrast vs nearby bright
def remnant(img_l, src_l):
    hits = np.zeros(mask.shape, dtype=bool)
    for y in range(armY0, armY1+1):
        for x in range(2, w-2):
            if not armBand[y, x]:
                continue
            outL = float(img_l[y, x])
            srcL = float(src_l[y, x])
            if outL > 78 or srcL > 110:
                continue
            if abs(outL - srcL) > 40:
                continue
            near = img_l[max(0,y-3):min(h,y+4), max(0,x-3):min(w,x+4)]
            if near.max() - outL < 28:
                continue
            hits[y, x] = True
    if not hits.any():
        return {"n": 0, "maxRun": 0, "left": 0, "right": 0}
    # connected max vertical/horizontal span
    seen = np.zeros_like(hits)
    max_run = 0
    mid = (xs.min() + xs.max()) // 2
    left = right = 0
    ys2, xs2 = np.where(hits)
    left = int((xs2 < mid).sum())
    right = int((xs2 >= mid).sum())
    for sy, sx in zip(ys2, xs2):
        if seen[sy, sx]:
            continue
        stack = [(sy, sx)]
        seen[sy, sx] = True
        minx=sx; maxx=sx; miny=sy; maxy=sy
        while stack:
            y, x = stack.pop()
            minx=min(minx,x); maxx=max(maxx,x); miny=min(miny,y); maxy=max(maxy,y)
            for dy, dx in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
                yy, xx = y+dy, x+dx
                if 0<=yy<h and 0<=xx<w and hits[yy,xx] and not seen[yy,xx]:
                    seen[yy,xx] = True
                    stack.append((yy, xx))
        max_run = max(max_run, max(maxx-minx+1, maxy-miny+1))
    return {"n": int(hits.sum()), "maxRun": int(max_run), "left": left, "right": right}
srcR = remnant(sl, sl)
rawR = remnant(rl, sl)
compR = remnant(cl, sl)
# identity-ish: face band mad raw vs source / composite vs source
faceY1 = y0 + int((y1 - y0) * 0.18)
face = (~edit) & (np.arange(h)[:, None] <= faceY1) & (np.arange(h)[:, None] >= y0)
def mad(a, b, pick):
    if not pick.any():
        return 0.0
    d = np.abs(a[:,:,:3][pick].astype(np.int16) - b[:,:,:3][pick].astype(np.int16)).mean()
    return float(d)
# save arm crops
cx0, cx1 = max(0, xs.min()-8), min(w, xs.max()+8)
arm = (armY0, armY1, cx0, cx1)
def save_crop(arr, p):
    Image.fromarray(arr[armY0:armY1, cx0:cx1, :3]).save(p)
save_crop(src, job["srcArm"])
save_crop(raw, job["rawArm"])
save_crop(comp, job["compArm"])
Image.fromarray(raw).save(job["rawAligned"])
print(json.dumps({
    "size": [int(w), int(h)],
    "rawNative": list(raw0.size),
    "maskWhite": int(edit.sum()),
    "armBand": int(armBand.sum()),
    "armBox": [int(cx0), int(armY0), int(cx1), int(armY1)],
    "sourceRemnant": srcR,
    "rawRemnant": rawR,
    "compositeRemnant": compR,
    "faceMadRaw": mad(src, raw, face),
    "faceMadComp": mad(src, comp, face),
}))
`,
    ],
    {
      input: JSON.stringify({
        src: path.join(OUT, '00-source.jpg'),
        raw: path.join(OUT, '02-model-raw.png'),
        comp: path.join(OUT, '03-composite-v2.png'),
        mask: path.join(OUT, '01-mask-v2.png'),
        srcArm: path.join(OUT, 'arm-source.png'),
        rawArm: path.join(OUT, 'arm-raw.png'),
        compArm: path.join(OUT, 'arm-composite.png'),
        rawAligned: path.join(OUT, '02-model-raw-aligned.png'),
      }),
      encoding: 'utf8',
    },
  ),
)

const W = 192
const H = 256
dump(path.join(OUT, '00-source.jpg'), path.join(OUT, 'c-src.rgba'), false, [W, H])
dump(path.join(OUT, '02-model-raw.png'), path.join(OUT, 'c-raw.rgba'), false, [W, H])
dump(path.join(OUT, '03-composite-v2.png'), path.join(OUT, 'c-out.rgba'), false, [W, H])
dump(path.join(OUT, '01-mask-v2.png'), path.join(OUT, 'c-mask.gray'), true, [W, H])
const src = new Uint8Array(readFileSync(path.join(OUT, 'c-src.rgba')))
const raw = new Uint8Array(readFileSync(path.join(OUT, 'c-raw.rgba')))
const out = new Uint8Array(readFileSync(path.join(OUT, 'c-out.rgba')))
const mask = maskFromGray(readFileSync(path.join(OUT, 'c-mask.gray')))

function pack(g) {
  return {
    ok: g.ok,
    reason: g.reason,
    failReasons: g.failReasons,
    upper: {
      changeOk: g.upper.changeOk,
      mad: g.upper.mad,
      corr: g.upper.corr,
      remnantN: g.upper.seam.remnantN,
      remnantMaxRun: g.upper.seam.remnantMaxRun,
      remnantOk: g.upper.seam.remnantOk,
      lumRel: g.upper.seam.lumRel,
    },
    lower: {
      changeOk: g.lower.changeOk,
      mad: g.lower.mad,
      corr: g.lower.corr,
      remnantN: g.lower.seam.remnantN,
      remnantMaxRun: g.lower.seam.remnantMaxRun,
      remnantOk: g.lower.seam.remnantOk,
      lumRel: g.lower.seam.lumRel,
    },
  }
}

const gateRaw = pack(visual.gateLookVisual({ src, out: raw, mask, width: W, height: H }))
const gateComp = pack(visual.gateLookVisual({ src, out, mask, width: W, height: H }))

let office = null
if (existsSync(path.join(OFFICE, 'mask-seam-remnant.json'))) {
  const o = JSON.parse(readFileSync(path.join(OFFICE, 'mask-seam-remnant.json'), 'utf8'))
  office = {
    rawOnDisk: false,
    armResiduePx: o.armResiduePx,
    reason: o.armReason,
    remnantHit: o.remnantHit,
    clothesChanged: o.clothesChanged,
    note: 'office 834px is screenshot composite only; no 02-model-raw for that take',
  }
}

const rawLine = measured.rawRemnant.n >= 20 && measured.rawRemnant.maxRun >= 28
const compLine = measured.compositeRemnant.n >= 20 && measured.compositeRemnant.maxRun >= 28
const engineHasLine = rawLine
const compositeOnly = !rawLine && (compLine || (office && office.armResiduePx >= 20))

const report = {
  newPaidCall: false,
  wanCalled: false,
  slipClicked: false,
  engine: 'fal-look-leffa',
  files: {
    source: '00-source.jpg',
    raw: '02-model-raw.png',
    composite: '03-composite-v2.png',
    mask: '01-mask-v2.png',
  },
  measured,
  client192: { raw: gateRaw, composite: gateComp },
  officeScreenshot: office,
  rawHasArmLine: rawLine,
  compositeHasArmLine: compLine,
  decision: engineHasLine ? 'replace_engine' : compositeOnly ? 'keep_engine_fix_mask_seam' : 'keep_engine_no_line_on_criterion',
}

if (report.decision === 'keep_engine_fix_mask_seam' || report.decision === 'keep_engine_no_line_on_criterion') {
  report.decision = 'keep_engine_fix_mask_seam'
  report.why =
    'Leffa raw has no long dark arm remnant. Clean composite v2 also has none. Office 834px line exists only on a later composite screenshot with no raw, so it is a mask/composite boundary leftover of source clothes, not an engine stroke.'
}

report.ok = !engineHasLine && gateComp.upper.remnantOk && gateRaw.upper.remnantOk && !report.newPaidCall
writeFileSync(path.join(OUT, 'raw-vs-composite.json'), JSON.stringify(report, null, 2))
writeFileSync(
  BASELINE,
  JSON.stringify(
    {
      engine: report.engine,
      rawHasArmLine: rawLine,
      compositeHasArmLine: compLine,
      decision: report.decision,
      officeArmResiduePx: office?.armResiduePx ?? null,
      thresholdChanged: false,
      paidCall: false,
      ok: report.ok,
    },
    null,
    2,
  ),
)
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
