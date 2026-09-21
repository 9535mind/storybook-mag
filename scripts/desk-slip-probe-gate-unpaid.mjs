#!/usr/bin/env node
/** 무과금. 프로브에서 나온 슬립 결과가 합성·게이트를 통과하는지 본다. */
import { execFileSync, execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WT = 'C:\\Users\\UserK\\Desktop\\PLATFORM\\storymag-74098c5'
const LIVE = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-live-slip')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-slip-engine-probe')
const BUNDLE = path.join(ROOT, '_tmp_bundle')
mkdirSync(BUNDLE, { recursive: true })

const bundle = (rel, name) => {
  const o = path.join(BUNDLE, name)
  execSync(
    `node_modules\\.bin\\esbuild "${path.join(WT, rel)}" --bundle --platform=node --format=cjs --outfile="${o}"`,
    { cwd: ROOT, stdio: 'pipe' },
  )
  return o
}
const gate = await import(`file://${bundle('functions/lib/desk-look-visual-gate.ts', 'probe-gate.cjs')}?t=${Date.now()}`)
const comp = await import(`file://${bundle('functions/lib/desk-clothes-composite.ts', 'probe-comp.cjs')}?t=${Date.now()}`)
const parse = await import(`file://${bundle('functions/lib/desk-clothes-parse.ts', 'probe-parse.cjs')}?t=${Date.now()}`)

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
im = Image.open(job["image"]).convert(job.get("mode", "RGBA"))
if job.get("size"):
    im = im.resize((int(job["size"][0]), int(job["size"][1])), Image.BILINEAR)
Path(job["out"]).write_bytes(np.asarray(im, dtype=np.uint8).tobytes())
print(json.dumps({"width": im.size[0], "height": im.size[1]}))
`,
      ],
      { cwd: ROOT, input: JSON.stringify({ image, out, size, mode: 'RGBA' }), encoding: 'utf8' },
    ),
  )

const srcMeta = py(path.join(LIVE, '00-source.jpg'), path.join(OUT, 'src.rgba'), null)
const W = srcMeta.width
const H = srcMeta.height
const src = new Uint8Array(readFileSync(path.join(OUT, 'src.rgba')))

py(path.join(LIVE, '01-mask.png'), path.join(OUT, 'mask.rgba'), [W, H])
const maskRgba = new Uint8Array(readFileSync(path.join(OUT, 'mask.rgba')))
const mask = new Uint8Array(W * H)
for (let p = 0; p < W * H; p += 1) mask[p] = maskRgba[p * 4] >= 128 ? 255 : 0

const labels = Array.from(readFileSync(path.join(ROOT, 'tmp-faceswap-test', 'desk-look-wire', 'woman-full-labels.u8')), (id) =>
  parse.CLOTHES_PARSE_LABELS[id] || 'Background',
)
const upper = new Uint8Array(W * H)
const lower = new Uint8Array(W * H)
for (let p = 0; p < W * H; p += 1) {
  const lab = labels[p] || 'Background'
  if (mask[p] < 128) continue
  if (parse.isClothesUpperLabel?.(lab)) upper[p] = 255
  else if (parse.isClothesLowerLabel?.(lab)) lower[p] = 255
}

const rows = []
for (const name of ['02-model-raw', 'A-plain-0.95']) {
  const file = name === '02-model-raw' ? path.join(LIVE, `${name}.png`) : path.join(OUT, `${name}.png`)
  py(file, path.join(OUT, `${name}.rgba`), [W, H])
  const gen = new Uint8Array(readFileSync(path.join(OUT, `${name}.rgba`)))
  const out = comp.compositeProtectRgba(src, gen, mask, W, H, 6)
  writeFileSync(path.join(OUT, `${name}-composite.png`), comp.encodeRgbPng(W, H, out))
  const g = gate.gateLookVisual({
    src,
    out,
    mask,
    width: W,
    height: H,
    upperMask: upper.some ? upper : upper,
    lowerMask: lower,
  })
  const r2 = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)
  rows.push({
    name,
    ok: g.ok,
    reason: g.reason || '',
    upper: { mad: r2(g.regions?.upper?.mad), corr: r2(g.regions?.upper?.corr), n: g.regions?.upper?.n },
    lower: { mad: r2(g.regions?.lower?.mad), corr: r2(g.regions?.lower?.corr), n: g.regions?.lower?.n },
  })
}

const report = {
  newPaidCall: false,
  rows,
  /** 배포본은 막히고 짧은 문장은 통과해야 한다. */
  ok: rows[0]?.ok === false && rows[1]?.ok === true,
}
console.log(JSON.stringify(report, null, 2))
