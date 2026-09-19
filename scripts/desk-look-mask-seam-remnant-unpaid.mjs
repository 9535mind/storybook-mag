#!/usr/bin/env node
/**
 * 무과금. 기존 lumRel 유지 + 마스크 외곽 잔상 seam.
 * 4장 기준 + 위팔 검은 선. 임계값 완화·저장 강제·Claude / fal / Wan / 배포 없음.
 */
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const LIVE = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-live-slip')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-mask-seam-remnant')
const BUNDLE = path.join(ROOT, '_tmp_bundle', 'desk-look-visual-gate.cjs')
const BASELINE = path.join(ROOT, 'scripts', 'desk-look-mask-seam-remnant-baseline.json')
const GATE = path.join(ROOT, 'functions', 'lib', 'desk-look-visual-gate.ts')
const SHOT =
  'C:\\Users\\UserK\\.cursor\\projects\\c-Users-UserK-Desktop-PLATFORM-fashion-magazine\\assets\\c__Users_UserK_AppData_Roaming_Cursor_User_workspaceStorage_445c76ae849c56e27af6a45e9bef9d4d_images_image-04147b29-8f1f-4ba3-bd50-91fcf12d6745.png'

mkdirSync(OUT, { recursive: true })
mkdirSync(path.dirname(BUNDLE), { recursive: true })

const KEEP = [
  ['00-source.jpg', '00-source.jpg'],
  ['02-model-raw.png', '02-model-raw.png'],
  ['03-composite-v2.png', '03-composite-v2.png'],
  ['01-mask-v2.png', '01-mask-v2.png'],
]
for (const [from, to] of KEEP) {
  const src = path.join(LIVE, from)
  if (!existsSync(src)) {
    console.log('missing preserve', from)
    process.exit(1)
  }
  copyFileSync(src, path.join(OUT, to))
}
if (!existsSync(SHOT)) {
  console.log('missing attached slip screenshot')
  process.exit(1)
}
copyFileSync(SHOT, path.join(OUT, 'attached-desk.png'))

const gateSrc = readFileSync(GATE, 'utf8')
const hasLumRel = /SEAM_LUM_REL_MAX = 1\.05/.test(gateSrc) && /SEAM_TEX_MIN = 0\.42/.test(gateSrc)
const hasBand = /function regionBoundaryRemnant/.test(gateSrc) && /SEAM_BAND_PX/.test(gateSrc)
const orderClothesSeamSil =
  /failReasons\.push\('clothes_goal'\)[\s\S]*failReasons\.push\('mask_seam'\)[\s\S]*failReasons\.push\('silhouette'\)/.test(
    gateSrc,
  ) && /VISUAL_REASON_ORDER[\s\S]*clothes_goal[\s\S]*mask_seam[\s\S]*silhouette/.test(gateSrc)
const noThresholdLoosen =
  /WHITE_MAD_MIN = 24/.test(gateSrc) &&
  /WHITE_CORR_MAX = 0\.88/.test(gateSrc) &&
  /BODY_CRUSH_RATIO = 0\.82/.test(gateSrc) &&
  /MASK_MIN_WHITE/.test(gateSrc)

execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-look-visual-gate.ts" --bundle --platform=node --format=cjs --outfile="${BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
execSync(
  'node_modules\\.bin\\esbuild functions/lib/desk-look-preflight.ts --bundle --format=iife --global-name=DeskLookLib --outfile=public/desk-look-preflight.js',
  { cwd: ROOT, stdio: 'pipe' },
)
const visual = await import(`file://${BUNDLE}?t=${Date.now()}`)

function dump(imagePath, outPath, gray, resize, resample) {
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
im = Image.open(job["image"])
im = im.convert("L" if job.get("gray") else "RGBA")
if job.get("resize"):
    how = Image.NEAREST if job.get("resample") == "nearest" else Image.BILINEAR
    im = im.resize((int(job["resize"][0]), int(job["resize"][1])), how)
Path(job["out"]).write_bytes(np.asarray(im, dtype=np.uint8).tobytes())
print(json.dumps({"width": im.size[0], "height": im.size[1]}))
`,
      ],
      {
        input: JSON.stringify({
          image: imagePath,
          out: outPath,
          gray: Boolean(gray),
          resize: resize || null,
          resample: resample || 'bilinear',
        }),
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

const cropped = lastJson(
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
im = np.asarray(Image.open(job["shot"]).convert("RGBA"), dtype=np.uint8)
h, w = im.shape[:2]
gray = im[:,:,:3].mean(axis=2)
x0 = int(w * 0.42)
out = im[:, x0:]
col = out[:,:,:3].mean(axis=(0,2))
row = out[:,:,:3].mean(axis=(1,2))
cx = np.where(col > 28)[0]
cy = np.where(row > 28)[0]
out = out[cy[0]:cy[-1]+1, cx[0]:cx[-1]+1]
left = im[:, : int(w * 0.28)]
mask_l = left[:,:,:3].mean(axis=2) > 18
ys2, xs2 = np.where(mask_l)
src = left[ys2.min():ys2.max()+1, xs2.min():xs2.max()+1]
src_im = Image.fromarray(src).convert("RGB").resize((384, 512), Image.BILINEAR)
out_im = Image.fromarray(out).convert("RGB").resize((384, 512), Image.BILINEAR)
src_a = np.asarray(src_im, dtype=np.uint8)
out_a = np.asarray(out_im, dtype=np.uint8)
def lum(a):
    return (a[:,:,0].astype(np.int16)*3 + a[:,:,1].astype(np.int16)*4 + a[:,:,2].astype(np.int16)) / 8
sl = lum(src_a)
ol = lum(out_a)
bg = ol[2, 2]
person = np.abs(ol - bg) > 18
yy = np.arange(512)[:, None]
edit = person & (yy > 90) & (yy < 430) & (sl < 210)
mask = np.where(edit, 255, 0).astype(np.uint8)
arm = np.zeros_like(mask)
for y in range(1, 511):
    for x in range(1, 383):
        if not person[y, x] or ol[y, x] > 70:
            continue
        if person[y, x-1] and person[y, x+1] and person[y-1, x] and person[y+1, x]:
            continue
        if 110 < y < 360:
            arm[y, x] = 255
Path(job["src"]).write_bytes(np.dstack([src_a, np.full((512,384), 255, np.uint8)]).tobytes())
Path(job["out"]).write_bytes(np.dstack([out_a, np.full((512,384), 255, np.uint8)]).tobytes())
Path(job["mask"]).write_bytes(mask.tobytes())
Path(job["arm"]).write_bytes(arm.tobytes())
Image.fromarray(src_a).save(job["srcPng"])
Image.fromarray(out_a).save(job["outPng"])
Image.fromarray(mask, "L").save(job["maskPng"])
print(json.dumps({
    "srcBox": [int(xs2.min()), int(ys2.min()), int(xs2.max()), int(ys2.max())],
    "outCrop": [int(x0+cx[0]), int(cy[0]), int(out_a.shape[1]), int(out_a.shape[0])],
    "maskWhite": int((mask>=128).sum()),
    "armResiduePx": int((arm>=128).sum()),
}))
`,
    ],
    {
      input: JSON.stringify({
        shot: SHOT,
        src: path.join(OUT, 'arm-src.rgba'),
        out: path.join(OUT, 'arm-out.rgba'),
        mask: path.join(OUT, 'arm-mask.gray'),
        arm: path.join(OUT, 'arm-residue.gray'),
        srcPng: path.join(OUT, '00-source-crop.png'),
        outPng: path.join(OUT, '03-composite-crop.png'),
        maskPng: path.join(OUT, '01-mask-est.png'),
      }),
      encoding: 'utf8',
    },
  ),
)

function downClient(srcRgba, outRgba, maskGray, prefix, w, h) {
  lastJson(
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
src = np.frombuffer(Path(job["src"]).read_bytes(), dtype=np.uint8).reshape((job["h"], job["w"], 4))
out = np.frombuffer(Path(job["out"]).read_bytes(), dtype=np.uint8).reshape((job["h"], job["w"], 4))
mask = np.frombuffer(Path(job["mask"]).read_bytes(), dtype=np.uint8).reshape((job["h"], job["w"]))
s = np.asarray(Image.fromarray(src, "RGBA").resize((192, 256), Image.BILINEAR))
o = np.asarray(Image.fromarray(out, "RGBA").resize((192, 256), Image.BILINEAR))
m = np.asarray(Image.fromarray(mask, "L").resize((192, 256), Image.BILINEAR))
Path(job["s"]).write_bytes(s.tobytes())
Path(job["o"]).write_bytes(o.tobytes())
Path(job["m"]).write_bytes(((m >= 128).astype(np.uint8) * 255).tobytes())
print("{}")
`,
      ],
      {
        input: JSON.stringify({
          src: srcRgba,
          out: outRgba,
          mask: maskGray,
          s: path.join(OUT, `${prefix}-src.rgba`),
          o: path.join(OUT, `${prefix}-out.rgba`),
          m: path.join(OUT, `${prefix}-mask.gray`),
          w,
          h,
        }),
        encoding: 'utf8',
      },
    ),
  )
}

const W = 192
const H = 256
dump(path.join(OUT, '00-source.jpg'), path.join(OUT, 'v2-src.rgba'), false, [W, H], 'bilinear')
dump(path.join(OUT, '03-composite-v2.png'), path.join(OUT, 'v2-out.rgba'), false, [W, H], 'bilinear')
dump(path.join(OUT, '02-model-raw.png'), path.join(OUT, 'v2-raw.rgba'), false, [W, H], 'bilinear')
dump(path.join(OUT, '01-mask-v2.png'), path.join(OUT, 'v2-mask.gray'), true, [W, H], 'bilinear')
downClient(path.join(OUT, 'arm-src.rgba'), path.join(OUT, 'arm-out.rgba'), path.join(OUT, 'arm-mask.gray'), 'arm192', 384, 512)

function packSeam(s) {
  return {
    n: s.n,
    lumRel: s.lumRel,
    texRatio: s.texRatio,
    srcLumJump: s.srcLumJump,
    outLumJump: s.outLumJump,
    torn: s.n >= 24 && s.lumRel > visual.SEAM_LUM_REL_MAX,
    mashed: s.n >= 24 && s.srcTexWhite >= 2 && s.texRatio < visual.SEAM_TEX_MIN,
    remnantN: s.remnantN,
    remnantMaxRun: s.remnantMaxRun,
    remnantElong: s.remnantElong,
    remnantOk: s.remnantOk,
    ok: s.ok,
  }
}

function packGate(g) {
  return {
    ok: g.ok,
    reason: g.reason,
    failReasons: g.failReasons,
    upper: {
      present: g.upper.present,
      n: g.upper.n,
      mad: g.upper.mad,
      corr: g.upper.corr,
      changeOk: g.upper.changeOk,
      failReasons: g.upper.failReasons,
      silhouette: {
        ok: g.upper.silhouette.ok,
        crushed: g.upper.silhouette.crushed,
        exploded: g.upper.silhouette.exploded,
        outWidth: g.upper.silhouette.outWidth,
        bodyRef: g.upper.silhouette.bodyRef,
        bodyMin: g.upper.silhouette.bodyMin,
        clothingWidth: g.upper.silhouette.clothingWidth,
      },
      seam: packSeam(g.upper.seam),
    },
    lower: {
      present: g.lower.present,
      n: g.lower.n,
      mad: g.lower.mad,
      corr: g.lower.corr,
      changeOk: g.lower.changeOk,
      failReasons: g.lower.failReasons,
      silhouette: {
        ok: g.lower.silhouette.ok,
        crushed: g.lower.silhouette.crushed,
        exploded: g.lower.silhouette.exploded,
        outWidth: g.lower.silhouette.outWidth,
        bodyRef: g.lower.silhouette.bodyRef,
        bodyMin: g.lower.silhouette.bodyMin,
        clothingWidth: g.lower.silhouette.clothingWidth,
      },
      seam: packSeam(g.lower.seam),
    },
  }
}

const v2src = new Uint8Array(readFileSync(path.join(OUT, 'v2-src.rgba')))
const v2out = new Uint8Array(readFileSync(path.join(OUT, 'v2-out.rgba')))
const v2raw = new Uint8Array(readFileSync(path.join(OUT, 'v2-raw.rgba')))
const v2mask = maskFromGray(readFileSync(path.join(OUT, 'v2-mask.gray')))
const armSrc = new Uint8Array(readFileSync(path.join(OUT, 'arm192-src.rgba')))
const armOut = new Uint8Array(readFileSync(path.join(OUT, 'arm192-out.rgba')))
const armMask = maskFromGray(readFileSync(path.join(OUT, 'arm192-mask.gray')))
const armNativeSrc = new Uint8Array(readFileSync(path.join(OUT, 'arm-src.rgba')))
const armNativeOut = new Uint8Array(readFileSync(path.join(OUT, 'arm-out.rgba')))
const armNativeMask = maskFromGray(readFileSync(path.join(OUT, 'arm-mask.gray')))

const v2 = packGate(visual.gateLookVisual({ src: v2src, out: v2out, mask: v2mask, width: W, height: H }))
const raw = packGate(visual.gateLookVisual({ src: v2src, out: v2raw, mask: v2mask, width: W, height: H }))
const arm192 = packGate(visual.gateLookVisual({ src: armSrc, out: armOut, mask: armMask, width: W, height: H }))
const armNative = packGate(
  visual.gateLookVisual({ src: armNativeSrc, out: armNativeOut, mask: armNativeMask, width: 384, height: 512 }),
)

const clothesChanged = v2.upper.changeOk && (!v2.lower.present || v2.lower.changeOk)
const armSeam =
  (arm192.reason === 'mask_seam' || armNative.reason === 'mask_seam') &&
  (arm192.failReasons.includes('mask_seam') || armNative.failReasons.includes('mask_seam'))
const armReason = arm192.reason === 'mask_seam' ? arm192.reason : armNative.reason
const remnantHit =
  !arm192.upper.seam.remnantOk ||
  !arm192.lower.seam.remnantOk ||
  !armNative.upper.seam.remnantOk ||
  !armNative.lower.seam.remnantOk
const v2RemnantPass = v2.upper.seam.remnantOk && (!v2.lower.present || v2.lower.seam.remnantOk)
const lumRelUnchanged =
  visual.SEAM_LUM_REL_MAX === 1.05 &&
  visual.SEAM_TEX_MIN === 0.42 &&
  visual.WHITE_MAD_MIN === 24 &&
  visual.WHITE_CORR_MAX === 0.88 &&
  visual.BODY_CRUSH_RATIO === 0.82

const report = {
  newPaidCall: false,
  wanCalled: false,
  claudeFaceBoxCalled: false,
  thresholdChanged: !lumRelUnchanged,
  resultSaved: false,
  files: {
    source: '00-source.jpg',
    leffaRaw: '02-model-raw.png',
    composite: '03-composite-v2.png',
    mask: '01-mask-v2.png',
  },
  reasonOrder: visual.VISUAL_REASON_ORDER,
  orderClothesSeamSil,
  hasBand,
  hasLumRel,
  noThresholdLoosen,
  thresholds: {
    WHITE_MAD_MIN: visual.WHITE_MAD_MIN,
    WHITE_CORR_MAX: visual.WHITE_CORR_MAX,
    SEAM_LUM_REL_MAX: visual.SEAM_LUM_REL_MAX,
    SEAM_TEX_MIN: visual.SEAM_TEX_MIN,
    BODY_CRUSH_RATIO: visual.BODY_CRUSH_RATIO,
    SEAM_BAND_PX: visual.SEAM_BAND_PX,
    SEAM_REMNANT_DARK: visual.SEAM_REMNANT_DARK,
    SEAM_REMNANT_CLOTHES_MAX: visual.SEAM_REMNANT_CLOTHES_MAX,
    SEAM_REMNANT_CONTRAST: visual.SEAM_REMNANT_CONTRAST,
    SEAM_REMNANT_MIN_RUN: visual.SEAM_REMNANT_MIN_RUN,
    SEAM_REMNANT_MIN_ELONG: visual.SEAM_REMNANT_MIN_ELONG,
  },
  crop: cropped,
  criterionV2: v2,
  modelRaw: raw,
  armGhost192: arm192,
  armGhostNative: armNative,
  clothesChanged,
  armResiduePx: cropped.armResiduePx,
  armReason,
  remnantHit,
  v2RemnantPass,
  desired: {
    clothesChangePass: true,
    armGhostMaskSeam: true,
    cleanV2VisualPass: true,
    doNotLoosen: true,
    noPaidCall: true,
  },
}

report.ok =
  clothesChanged &&
  armSeam &&
  armReason === 'mask_seam' &&
  remnantHit &&
  v2.ok &&
  v2RemnantPass &&
  orderClothesSeamSil &&
  hasBand &&
  hasLumRel &&
  noThresholdLoosen &&
  lumRelUnchanged &&
  !report.resultSaved &&
  cropped.armResiduePx >= 20

writeFileSync(path.join(OUT, 'mask-seam-remnant.json'), JSON.stringify(report, null, 2))
writeFileSync(
  BASELINE,
  JSON.stringify(
    {
      clothesChanged,
      armReason,
      remnantHit,
      v2Ok: v2.ok,
      v2Reason: v2.reason,
      v2RemnantPass,
      reasonOrder: visual.VISUAL_REASON_ORDER,
      thresholdChanged: report.thresholdChanged,
      ok: report.ok,
    },
    null,
    2,
  ),
)
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
