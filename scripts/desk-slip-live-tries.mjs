#!/usr/bin/env node
/**
 * 유료. 화면과 같은 경로(로그인 → /api/tale-scene → 합성 → 게이트)를 최대 3번 돌려서
 * 실제로 몇 번 만에 통과하는지 잰다. 앱의 자동 재시도와 같은 판정을 쓴다.
 */
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WT = 'C:\\Users\\UserK\\Desktop\\PLATFORM\\storymag-74098c5'
const LIVE = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-live-slip')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-slip-live-tries')
const BUNDLE = path.join(ROOT, '_tmp_bundle')
const MAX = Number(process.env.TRIES || 3)
mkdirSync(OUT, { recursive: true })

const bundle = (rel, name) => {
  const o = path.join(BUNDLE, name)
  execSync(
    `node_modules\\.bin\\esbuild "${path.join(WT, rel)}" --bundle --platform=node --format=cjs --outfile="${o}"`,
    { cwd: ROOT, stdio: 'pipe' },
  )
  return o
}
const gate = await import(`file://${bundle('functions/lib/desk-look-visual-gate.ts', 'tries-gate.cjs')}?t=${Date.now()}`)
const parse = await import(`file://${bundle('functions/lib/desk-clothes-parse.ts', 'tries-parse.cjs')}?t=${Date.now()}`)

const py = (image, out, size) =>
  JSON.parse(
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
im = Image.open(job["image"]).convert("RGBA")
if job.get("size"):
    im = im.resize((int(job["size"][0]), int(job["size"][1])), Image.BILINEAR)
Path(job["out"]).write_bytes(np.asarray(im, dtype=np.uint8).tobytes())
print(json.dumps({"width": im.size[0], "height": im.size[1]}))
`,
      ],
      { cwd: ROOT, input: JSON.stringify({ image, out, size }), encoding: 'utf8' },
    ),
  )

// 원본과 마스크는 회차마다 같다. 한 번만 준비한다.
const meta = py(path.join(LIVE, '00-source.jpg'), path.join(OUT, 'src.rgba'), null)
const W = meta.width
const H = meta.height
const src = new Uint8Array(readFileSync(path.join(OUT, 'src.rgba')))
py(path.join(LIVE, '01-mask.png'), path.join(OUT, 'mask.rgba'), [W, H])
const maskRgba = new Uint8Array(readFileSync(path.join(OUT, 'mask.rgba')))
const mask = new Uint8Array(W * H)
for (let p = 0; p < W * H; p += 1) mask[p] = maskRgba[p * 4] >= 128 ? 255 : 0

const labels = Array.from(
  readFileSync(path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire', 'woman-full-labels.u8')),
  (id) => parse.CLOTHES_PARSE_LABELS[id] || 'Background',
)
const upper = new Uint8Array(W * H)
const lower = new Uint8Array(W * H)
for (let p = 0; p < W * H; p += 1) {
  if (mask[p] < 128) continue
  const lab = labels[p] || 'Background'
  if (parse.isClothesUpperLabel(lab)) upper[p] = 255
  else if (parse.isClothesLowerLabel(lab)) lower[p] = 255
}

const r2 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null)
const tries = []
let passedAt = 0
for (let i = 1; i <= MAX; i += 1) {
  execSync('node scripts/desk-look-live-slip.mjs', { cwd: ROOT, stdio: 'pipe' })
  const shot = path.join(OUT, `try-${i}.png`)
  copyFileSync(path.join(LIVE, '03-composite.png'), shot)
  py(shot, path.join(OUT, `try-${i}.rgba`), [W, H])
  const out = new Uint8Array(readFileSync(path.join(OUT, `try-${i}.rgba`)))
  const g = gate.gateLookVisual({ src, out, mask, width: W, height: H, upperMask: upper, lowerMask: lower })
  tries.push({
    attempt: i,
    ok: g.ok,
    reason: g.reason || '',
    upper: { mad: r2(g.regions?.upper?.mad), corr: r2(g.regions?.upper?.corr) },
    lower: { mad: r2(g.regions?.lower?.mad), corr: r2(g.regions?.lower?.corr) },
    file: shot,
  })
  console.log(`try ${i}: ${g.ok ? 'PASS' : `fail:${g.reason}`}`)
  // 앱도 통과하면 거기서 멈춘다.
  if (g.ok) {
    passedAt = i
    break
  }
  try {
    execSync('powershell -NoProfile -Command "Remove-Item -Force tmp-faceswap-test/desk-look-live-slip/paid-once.lock"', {
      cwd: ROOT,
      stdio: 'pipe',
    })
  } catch {}
}

execFileSync(
  'py',
  [
    '-3',
    '-c',
    `
import json, sys
from PIL import Image, ImageDraw
job = json.loads(sys.stdin.read())
w, h = 400, 538
gap = 14
n = len(job["paths"])
board = Image.new("RGB", (w * n + gap * (n + 1), h + 60), (245, 245, 245))
d = ImageDraw.Draw(board)
x = gap
for p, lab in zip(job["paths"], job["labels"]):
    board.paste(Image.open(p).convert("RGB").resize((w, h)), (x, 42))
    d.text((x, 14), lab, fill=(20, 20, 20))
    x += w + gap
board.save(job["out"])
print("ok")
`,
  ],
  {
    cwd: ROOT,
    input: JSON.stringify({
      paths: [path.join(LIVE, '00-source.jpg'), ...tries.map((t) => t.file)],
      labels: ['source', ...tries.map((t) => `try ${t.attempt} ${t.ok ? 'PASS' : t.reason}`)],
      out: path.join(OUT, 'tries-board.png'),
    }),
    encoding: 'utf8',
  },
)

const report = {
  newPaidCall: true,
  paidCallsThisStep: tries.length,
  maxTries: MAX,
  passedAtAttempt: passedAt,
  ok: passedAt > 0,
  tries,
  board: path.join(OUT, 'tries-board.png'),
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
