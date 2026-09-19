#!/usr/bin/env node
/**
 * 무과금. 슬립은 성공, 위팔 원래 옷 경계 잔상.
 * clothes_goal 오탐 여부, mask_seam 가림, 판정 순서를 기록한다.
 * 임계값 완화·저장 강제·Claude / fal / Wan / 배포 없음.
 */
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-mask-seam-order')
const BUNDLE = path.join(ROOT, '_tmp_bundle', 'desk-look-visual-gate.cjs')
const BASELINE = path.join(ROOT, 'scripts', 'desk-look-mask-seam-order-baseline.json')
const APP = path.join(ROOT, 'public', 'app.js')
const GATE = path.join(ROOT, 'functions', 'lib', 'desk-look-visual-gate.ts')
const SHOT =
  'C:\\Users\\UserK\\.cursor\\projects\\c-Users-UserK-Desktop-PLATFORM-fashion-magazine\\assets\\c__Users_UserK_AppData_Roaming_Cursor_User_workspaceStorage_445c76ae849c56e27af6a45e9bef9d4d_images_image-04147b29-8f1f-4ba3-bd50-91fcf12d6745.png'

mkdirSync(OUT, { recursive: true })
if (existsSync(SHOT)) copyFileSync(SHOT, path.join(OUT, 'attached-desk.png'))

if (!existsSync(SHOT)) {
  console.log('missing attached slip screenshot')
  process.exit(1)
}

const appSrc = readFileSync(APP, 'utf8')
const gateSrc = readFileSync(GATE, 'utf8')
const toastClothesGoal = /gate\.reason === 'clothes_goal'[\s\S]{0,80}옷이 녹지 않아/.test(appSrc)
const reasonIsFirst = /reason: failReasons\[0\]/.test(gateSrc)
const pushOrder = ['clothes_goal', 'mask_seam', 'silhouette']
const scorePushesClothesFirst =
  /failReasons\.push\('clothes_goal'\)[\s\S]*failReasons\.push\('mask_seam'\)[\s\S]*failReasons\.push\('silhouette'\)/.test(
    gateSrc,
  )

execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-look-visual-gate.ts" --bundle --platform=node --format=cjs --outfile="${BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const visual = await import(`file://${BUNDLE}?t=${Date.now()}`)

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
# right result: brightest large panel
gray = im[:,:,:3].mean(axis=2)
# CAST thumb is small dark-dress figure on the left; result is large on the right
xs = np.where(gray.mean(axis=0) > 40)[0]
ys = np.where(gray.mean(axis=1) > 20)[0]
# result: right half, skip dark UI
x0 = int(w * 0.42)
out = im[:, x0:]
# trim near-black UI
col = out[:,:,:3].mean(axis=(0,2))
row = out[:,:,:3].mean(axis=(1,2))
cx = np.where(col > 28)[0]
cy = np.where(row > 28)[0]
out = out[cy[0]:cy[-1]+1, cx[0]:cx[-1]+1]
# CAST thumb: left column, first pale card
left = im[:, : int(w * 0.28)]
# find a compact non-black island
mask = left[:,:,:3].mean(axis=2) > 18
ys2, xs2 = np.where(mask)
src = left[ys2.min():ys2.max()+1, xs2.min():xs2.max()+1]
# drop leftover UI by taking the largest bright blob-ish center
src_im = Image.fromarray(src).convert("RGB")
out_im = Image.fromarray(out).convert("RGB")
out_im = out_im.resize((384, 512), Image.BILINEAR)
src_im = src_im.resize((384, 512), Image.BILINEAR)
src_a = np.asarray(src_im, dtype=np.uint8)
out_a = np.asarray(out_im, dtype=np.uint8)
# clothes mask: source dark-dress / non-skin mid body, or result slip (light garment)
def lum(a):
    return (a[:,:,0].astype(np.int16)*3 + a[:,:,1].astype(np.int16)*4 + a[:,:,2].astype(np.int16)) / 8
sl = lum(src_a)
ol = lum(out_a)
# person vs bg on result (monitor is brighter mid-gray, slip is very light)
bg = ol[2, 2]
person = np.abs(ol - bg) > 18
# edit = person minus likely face/hair top and likely hands (lower-middle)
yy = np.arange(512)[:, None]
edit = person & (yy > 90) & (yy < 430)
# keep only where source was also person-ish so CAST dress maps
src_person = sl < 210
edit = edit & src_person
mask = np.where(edit, 255, 0).astype(np.uint8)
# arm residue: dark outline on result arms (low lum next to person edge)
arm = np.zeros_like(mask)
for y in range(1, 511):
    for x in range(1, 383):
        if not person[y, x]:
            continue
        if ol[y, x] > 70:
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
        src: path.join(OUT, 'src.rgba'),
        out: path.join(OUT, 'out.rgba'),
        mask: path.join(OUT, 'mask.gray'),
        arm: path.join(OUT, 'arm-residue.gray'),
        srcPng: path.join(OUT, '00-source-crop.png'),
        outPng: path.join(OUT, '03-composite-crop.png'),
        maskPng: path.join(OUT, '01-mask-est.png'),
      }),
      encoding: 'utf8',
    },
  ),
)

const width = 384
const height = 512
const src = new Uint8Array(readFileSync(path.join(OUT, 'src.rgba')))
const out = new Uint8Array(readFileSync(path.join(OUT, 'out.rgba')))
const mask = new Uint8Array(readFileSync(path.join(OUT, 'mask.gray')))
const arm = new Uint8Array(readFileSync(path.join(OUT, 'arm-residue.gray')))

const gate = visual.gateLookVisual({ src, out, mask, width, height })
const W = 192
const H = 256

function down(rgba, gray) {
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
w, h = job["w"], job["h"]
if job.get("gray"):
    im = Image.fromarray(np.frombuffer(Path(job["buf"]).read_bytes(), dtype=np.uint8).reshape((h, w)), "L")
    im = im.resize((192, 256), Image.BILINEAR)
    Path(job["out"]).write_bytes((np.asarray(im) >= 128).astype(np.uint8).tobytes())
else:
    a = np.frombuffer(Path(job["buf"]).read_bytes(), dtype=np.uint8).reshape((h, w, 4))
    im = Image.fromarray(a, "RGBA").resize((192, 256), Image.BILINEAR)
    Path(job["out"]).write_bytes(np.asarray(im).tobytes())
print("{}")
`,
    ],
    {
      input: JSON.stringify({
        buf: gray ? path.join(OUT, 'mask.gray') : path.join(OUT, gray === false && arguments[0] === src ? 'src.rgba' : 'tmp'),
      }),
      encoding: 'utf8',
    },
  )
}

function writeBuf(p, bytes) {
  writeFileSync(p, bytes)
}

writeBuf(path.join(OUT, 'src.rgba'), src)
const client = lastJson(
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
w, h = 384, 512
src = np.frombuffer(Path(job["src"]).read_bytes(), dtype=np.uint8).reshape((h, w, 4))
out = np.frombuffer(Path(job["out"]).read_bytes(), dtype=np.uint8).reshape((h, w, 4))
mask = np.frombuffer(Path(job["mask"]).read_bytes(), dtype=np.uint8).reshape((h, w))
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
        src: path.join(OUT, 'src.rgba'),
        out: path.join(OUT, 'out.rgba'),
        mask: path.join(OUT, 'mask.gray'),
        s: path.join(OUT, 'client-src.rgba'),
        o: path.join(OUT, 'client-out.rgba'),
        m: path.join(OUT, 'client-mask.gray'),
      }),
      encoding: 'utf8',
    },
  ),
)

const csrc = new Uint8Array(readFileSync(path.join(OUT, 'client-src.rgba')))
const cout = new Uint8Array(readFileSync(path.join(OUT, 'client-out.rgba')))
const cmask = new Uint8Array(readFileSync(path.join(OUT, 'client-mask.gray')))
const clientGate = visual.gateLookVisual({ src: csrc, out: cout, mask: cmask, width: 192, height: 256 })

function packRegion(r) {
  return {
    present: r.present,
    n: r.n,
    mad: r.mad,
    corr: r.corr,
    changeOk: r.changeOk,
    failReasons: r.failReasons,
    silhouette: {
      ok: r.silhouette.ok,
      crushed: r.silhouette.crushed,
      exploded: r.silhouette.exploded,
      outWidth: r.silhouette.outWidth,
      bodyRef: r.silhouette.bodyRef,
      bodyMin: r.silhouette.bodyMin,
      clothingWidth: r.silhouette.clothingWidth,
    },
    seam: {
      ok: r.seam.ok,
      n: r.seam.n,
      lumRel: r.seam.lumRel,
      texRatio: r.seam.texRatio,
      srcLumJump: r.seam.srcLumJump,
      outLumJump: r.seam.outLumJump,
      torn: r.seam.n >= 24 && r.seam.lumRel > visual.SEAM_LUM_REL_MAX,
      mashed: r.seam.n >= 24 && r.seam.srcTexWhite >= 2 && r.seam.texRatio < visual.SEAM_TEX_MIN,
      remnantN: r.seam.remnantN,
      remnantMaxRun: r.seam.remnantMaxRun,
      remnantElong: r.seam.remnantElong,
      remnantOk: r.seam.remnantOk,
    },
  }
}

function packGate(g) {
  return {
    ok: g.ok,
    reason: g.reason,
    failReasons: g.failReasons,
    upper: packRegion(g.upper),
    lower: packRegion(g.lower),
  }
}

const clothesChanged = clientGate.upper.changeOk && (clientGate.lower.present ? clientGate.lower.changeOk : true)
const clothesGoalFired = clientGate.failReasons.includes('clothes_goal')
const seamFired = clientGate.failReasons.includes('mask_seam')
const silFired = clientGate.failReasons.includes('silhouette')
const clothesGoalHidesSeam = clothesGoalFired && seamFired && clientGate.reason === 'clothes_goal'
const armResidue = cropped.armResiduePx >= 20

const ALIGN = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-clothes-goal-repro')
let aligned = null
if (
  existsSync(path.join(ALIGN, 'client-src.rgba')) &&
  existsSync(path.join(ALIGN, 'client-out.rgba')) &&
  existsSync(path.join(ALIGN, 'client-mask.gray'))
) {
  const asrc = new Uint8Array(readFileSync(path.join(ALIGN, 'client-src.rgba')))
  const aout = new Uint8Array(readFileSync(path.join(ALIGN, 'client-out.rgba')))
  const amask = new Uint8Array(readFileSync(path.join(ALIGN, 'client-mask.gray')))
  aligned = packGate(visual.gateLookVisual({ src: asrc, out: aout, mask: amask, width: 192, height: 256 }))
}

const report = {
  newPaidCall: false,
  wanCalled: false,
  claudeFaceBoxCalled: false,
  thresholdChanged: false,
  resultSaved: false,
  attached: 'office-slip-arm-ghost',
  clothesGoal: 'false_positive',
  engine: 'slip_success_plus_arm_composite_fail',
  reasonOrder: pushOrder,
  scorePushesClothesFirst,
  toastUsesFirstReason: /gate\.reason === 'clothes_goal'/.test(appSrc) && toastClothesGoal,
  reasonIsFirstFail: reasonIsFirst,
  thresholds: {
    WHITE_MAD_MIN: visual.WHITE_MAD_MIN,
    WHITE_CORR_MAX: visual.WHITE_CORR_MAX,
    SEAM_LUM_REL_MAX: visual.SEAM_LUM_REL_MAX,
    SEAM_TEX_MIN: visual.SEAM_TEX_MIN,
    BODY_CRUSH_RATIO: visual.BODY_CRUSH_RATIO,
    MASK_MIN_WHITE: 1500,
  },
  failWhen: {
    clothes_goal: 'present && !(mad>=24 && corr<=0.88)  — pushed first',
    mask_seam: 'present && (lumRel>1.05 || texRatio<0.42 || remnant) — pushed second',
    silhouette: 'present && crushed|exploded — pushed third',
    toast: 'failReasons[0] only; later reasons hidden',
  },
  crop: cropped,
  native: packGate(gate),
  client192: packGate(clientGate),
  alignedLiveSlip192: aligned,
  armResiduePx: cropped.armResiduePx,
  clothesChanged,
  clothesGoalFired,
  silFired,
  seamFired,
  clothesGoalHidesSeam,
  classification: {
    clothes_goal: 'false_positive',
    actual: seamFired ? 'mask_seam' : silFired ? 'silhouette_not_mask_seam' : 'ungated_arm_residue',
  },
}

const passClothes = clothesChanged
const blockArmAsSeam = armResidue && seamFired && clientGate.reason === 'mask_seam'
report.desired = {
  clothesChangePass: true,
  clothesGoalFalsePositive: true,
  blockArmResidueAs: 'mask_seam',
  doNotSave: true,
  doNotLoosen: true,
}
report.ok = passClothes && blockArmAsSeam && scorePushesClothesFirst && !report.resultSaved && !clothesGoalFired

writeFileSync(path.join(OUT, 'mask-seam-order.json'), JSON.stringify(report, null, 2))
writeFileSync(
  BASELINE,
  JSON.stringify(
    {
      clothesGoal: 'false_positive',
      clothesChanged: passClothes,
      reasonOrder: pushOrder,
      clothesGoalHidesSeam: scorePushesClothesFirst,
      clientReason: clientGate.reason,
      seamFired,
      armResidue,
      thresholdChanged: false,
      ok: report.ok,
    },
    null,
    2,
  ),
)
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
