#!/usr/bin/env node
/**
 * 무과금. 운영 슬립 원출력 유지. 밑단 틈·손목 마스크만 다시 합성.
 */
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-live-slip')
const LABELS = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire', 'woman-full-labels.u8')
const BUNDLE = path.join(ROOT, '_tmp_bundle')
const SRC_RGBA = path.join(OUT, 'src.rgba')
const GEN_RGBA = path.join(OUT, 'gen.rgba')

if (!existsSync(SRC_RGBA) || !existsSync(GEN_RGBA) || !existsSync(LABELS)) {
  console.log('missing live-slip rgba or labels')
  process.exit(1)
}

mkdirSync(BUNDLE, { recursive: true })

function esbuild(entry, outfile, extra = '--platform=node --format=cjs') {
  execSync(`node_modules\\.bin\\esbuild "${entry}" --bundle ${extra} --outfile="${outfile}"`, {
    cwd: ROOT,
    stdio: 'pipe',
  })
}

esbuild('functions/lib/desk-clothes-parse.ts', path.join(BUNDLE, 'desk-clothes-parse.cjs'))
esbuild('functions/lib/face-preserve-mask.ts', path.join(BUNDLE, 'face-preserve-mask.cjs'))
esbuild('functions/lib/desk-clothes-composite.ts', path.join(BUNDLE, 'desk-clothes-composite.cjs'))
esbuild(
  'functions/lib/desk-look-preflight.ts',
  path.join(ROOT, 'public', 'desk-look-preflight.js'),
  '--format=iife --global-name=DeskLookLib',
)

const parseMod = await import(`file://${path.join(BUNDLE, 'desk-clothes-parse.cjs')}?t=${Date.now()}`)
const maskPng = await import(`file://${path.join(BUNDLE, 'face-preserve-mask.cjs')}?t=${Date.now()}`)
const comp = await import(`file://${path.join(BUNDLE, 'desk-clothes-composite.cjs')}?t=${Date.now()}`)

const facts = JSON.parse(
  readFileSync(path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit', 'woman-full', 'facts.json'), 'utf8'),
)
const width = facts.width
const height = facts.height
const labels = Array.from(readFileSync(LABELS), (id) => parseMod.CLOTHES_PARSE_LABELS[id] || 'Background')
const srcRgba = new Uint8Array(readFileSync(SRC_RGBA))
const genRgba = new Uint8Array(readFileSync(GEN_RGBA))

const identity = parseMod.assembleVtonIdentityMask({
  labels,
  width,
  height,
  woman: { x: 0, y: 0, w: 1, h: 1 },
  man: null,
  srcRgba,
})
if (!identity.ok) {
  console.log('identity mask too small', identity.reason)
  process.exit(1)
}

writeFileSync(path.join(OUT, '01-mask-v2.png'), maskPng.encodeGrayPng(width, height, identity.mask))
const outRgba = comp.compositeProtectRgba(srcRgba, genRgba, identity.mask, width, height, 6)
writeFileSync(path.join(OUT, '03-composite-v2.png'), comp.encodeRgbPng(width, height, outRgba))
const black = comp.protectRegionMad(srcRgba, outRgba, identity.mask, width, height, 6)

lastJson(
  execFileSync(
    'py',
    [
      '-3',
      '-c',
      `
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw
job = json.loads(sys.stdin.read())
src = Image.open(job["src"]).convert("RGB")
old = Image.open(job["old"]).convert("RGB").resize(src.size, Image.BILINEAR)
new = Image.open(job["new"]).convert("RGB").resize(src.size, Image.BILINEAR)
mask = Image.open(job["mask"]).convert("L").resize(src.size, Image.NEAREST)
W, H = src.size
crops = [
    ("hem", 0.50, 0.70, 0.16),
    ("wrist-L", 0.39, 0.55, 0.12),
    ("wrist-R", 0.59, 0.55, 0.12),
    ("face", 0.49, 0.13, 0.22),
    ("shoe", 0.50, 0.92, 0.16),
]
out = Path(job["dir"])
out.mkdir(parents=True, exist_ok=True)
for name, cx, cy, side in crops:
    s = int(side * min(W, H))
    x0 = max(0, min(W - s, int(cx * W - s / 2)))
    y0 = max(0, min(H - s, int(cy * H - s / 2)))
    box = (x0, y0, x0 + s, y0 + s)
    src.crop(box).resize((s * 3, s * 3), Image.NEAREST).save(out / f"{name}-source.png")
    old.crop(box).resize((s * 3, s * 3), Image.NEAREST).save(out / f"{name}-v1.png")
    new.crop(box).resize((s * 3, s * 3), Image.NEAREST).save(out / f"{name}-v2.png")
gap = 16
board = Image.new("RGB", (W * 4 + gap * 5, H + 72), (245, 245, 245))
d = ImageDraw.Draw(board)
x = gap
for p, lab in zip(
    [job["src"], job["mask"], job["old"], job["new"]],
    ["00 source", "01 mask v2", "03 live v1 kept", "03 composite v2"],
):
    im = Image.open(p).convert("RGB").resize((W // 2, H // 2) if False else (440, 592))
    board.paste(im, (x, 48))
    d.text((x, 12), lab, fill=(20, 20, 20))
    x += 440 + gap
board.save(job["board"])
print(json.dumps({"ok": True}))
`,
    ],
    {
      cwd: ROOT,
      input: JSON.stringify({
        src: path.join(OUT, '00-source.jpg'),
        old: path.join(OUT, '03-composite.png'),
        new: path.join(OUT, '03-composite-v2.png'),
        mask: path.join(OUT, '01-mask-v2.png'),
        dir: path.join(OUT, 'maskfix-crops'),
        board: path.join(OUT, 'maskfix-board.png'),
      }),
      encoding: 'utf8',
    },
  ),
)

const live = JSON.parse(readFileSync(path.join(OUT, 'report.json'), 'utf8'))
live.verdict = 'conditional_hold'
live.closeLookSilk = false
live.qualityHold = {
  hemCenterArtifact: true,
  wristJewelryUncertain: true,
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(live, null, 2))

const report = {
  newPaidCall: false,
  wanCalled: false,
  liveKept: ['00-source.jpg', '01-mask.png', '02-model-raw.png', '03-composite.png'],
  callId: live.callId,
  deployId: live.deployId,
  handProtect: identity.handProtect,
  releasedGaps: identity.releasedGaps,
  releasedCuff: identity.releasedCuff,
  protectBlack: black,
  ok: black.identical === true,
}
writeFileSync(path.join(OUT, 'maskfix-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
