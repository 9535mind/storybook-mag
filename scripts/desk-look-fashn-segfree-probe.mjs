#!/usr/bin/env node
/**
 * 승인: FASHN segmentation_free 두 값 비교 2회.
 * true 면 사람 파싱을 끄므로 원래 소매·바지 자리를 드레스 천으로 덮어 흰 소매·흰 레깅스가
 * 생긴다(실측). false 면 파싱이 원래 옷 자리를 알아내 맨살로 비우는지 본다.
 * 재시도·Wan·배포 없음.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-fashn-segfree')
const LOCK = path.join(OUT, 'paid-once.lock')
const SRC = path.join(ROOT, 'tmp-faceswap-test', 'try-stand', '1-stand.jpg')
const GARMENT = path.join(ROOT, 'public', 'desk-look-garment-slip.png')
const MODEL = 'fal-ai/fashn/tryon/v1.6'

mkdirSync(OUT, { recursive: true })
if (existsSync(LOCK) && !process.argv.includes('--force')) {
  console.log('LOCK already spent. no second paid run.')
  process.exit(1)
}

const falKey = (readFileSync(path.join(ROOT, '.dev.vars'), 'utf8').match(/^FAL_KEY=(.*)$/m) || [])[1]
  ?.trim()
  .replace(/^["']|["']$/g, '')
if (!falKey) {
  console.log('no_fal_key')
  process.exit(1)
}

async function upload(file, name) {
  const bytes = readFileSync(file)
  const init = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', {
    method: 'POST',
    headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: name, content_type: name.endsWith('.png') ? 'image/png' : 'image/jpeg' }),
  })
  const info = await init.json()
  await fetch(info.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': name.endsWith('.png') ? 'image/png' : 'image/jpeg' },
    body: bytes,
  })
  return info.file_url
}

const humanUrl = await upload(SRC, `segfree-human-${Date.now()}.jpg`)
const garmentUrl = await upload(GARMENT, `segfree-slip-${Date.now()}.png`)
writeFileSync(LOCK, new Date().toISOString())

async function run(segmentationFree) {
  const body = {
    model_image: humanUrl,
    garment_image: garmentUrl,
    category: 'one-pieces',
    mode: 'quality',
    garment_photo_type: 'flat-lay',
    moderation_level: 'permissive',
    num_samples: 1,
    segmentation_free: segmentationFree,
    output_format: 'png',
  }
  const submit = await fetch(`https://queue.fal.run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const submitted = await submit.json().catch(() => ({}))
  if (!submit.ok) throw new Error(JSON.stringify(submitted).slice(0, 300))
  let imageUrl = submitted.images?.[0]?.url || submitted.image?.url || ''
  const started = Date.now()
  while (!imageUrl && Date.now() - started < 240000) {
    await new Promise((r) => setTimeout(r, 2500))
    const st = await fetch(submitted.status_url, { headers: { Authorization: `Key ${falKey}` } })
    const data = await st.json().catch(() => ({}))
    if (data?.status === 'COMPLETED') {
      const res = await fetch(submitted.response_url, { headers: { Authorization: `Key ${falKey}` } })
      const out = await res.json().catch(() => ({}))
      imageUrl = out?.images?.[0]?.url || out?.image?.url || ''
      break
    }
    if (data?.status === 'FAILED') throw new Error(JSON.stringify(data).slice(0, 300))
  }
  if (!imageUrl) throw new Error('no_image')
  const file = path.join(OUT, `segfree-${segmentationFree}.png`)
  writeFileSync(file, Buffer.from(await (await fetch(imageUrl)).arrayBuffer()))
  return { segmentationFree, file, requestId: submitted.request_id || '' }
}

const results = []
for (const segFree of [false, true]) {
  try {
    const r = await run(segFree)
    // 팔뚝·종아리가 맨살인지 숫자로. 흰 천이 덮이면 밝기가 배경보다 크게 뜬다.
    const skin = lastJson(
      execFileSync(
        'py',
        [
          '-3',
          '-c',
          `
import json, sys
from PIL import Image
import numpy as np
job = json.loads(sys.stdin.read())
im = np.asarray(Image.open(job["img"]).convert("RGB"), dtype=float)
h, w = im.shape[:2]
def patch(cx, cy, s=0.035):
    px, py = int(cx*w), int(cy*h)
    r = int(s*min(w,h))
    return im[max(0,py-r):py+r, max(0,px-r):px+r].reshape(-1,3).mean(axis=0)
face = patch(0.50, 0.14)
out = {}
for name, cx, cy in [("forearmL",0.345,0.47),("forearmR",0.655,0.47),("calfL",0.455,0.86),("calfR",0.545,0.86)]:
    p = patch(cx, cy)
    # 살빛은 R>G>B 로 기울고, 흰 천은 세 채널이 붙고 얼굴보다 훨씬 밝다.
    warm = float(p[0]-p[2])
    out[name] = {"lum": round(float(p.mean()),1), "warm": round(warm,1),
                 "vsFace": round(float(p.mean()-face.mean()),1)}
out["face"] = {"lum": round(float(face.mean()),1), "warm": round(float(face[0]-face[2]),1)}
print(json.dumps(out))
`,
        ],
        { input: JSON.stringify({ img: r.file }), encoding: 'utf8', timeout: 60000 },
      ),
    )
    const limbs = ['forearmL', 'forearmR', 'calfL', 'calfR']
    // 맨살: 따뜻하고(warm>10) 얼굴보다 크게 밝지 않다(vsFace<35)
    const bare = limbs.filter((k) => skin[k].warm > 10 && skin[k].vsFace < 35)
    results.push({ ...r, skin, bareLimbs: bare.length, bare })
    console.log(`segmentation_free=${segFree} bareLimbs=${bare.length}/4 ${JSON.stringify(skin)}`)
  } catch (err) {
    results.push({ segmentationFree: segFree, error: err instanceof Error ? err.message : String(err) })
    console.log(`segmentation_free=${segFree} FAIL`, err instanceof Error ? err.message : err)
  }
}

execFileSync(
  'py',
  [
    '-3',
    '-c',
    `
import json, sys
from PIL import Image
from pathlib import Path
job = json.loads(sys.stdin.read())
tiles = [(l,p) for l,p in job["tiles"] if Path(p).exists()]
h = 620
ims = []
for label, p in tiles:
    im = Image.open(p).convert("RGB")
    ims.append(im.resize((int(im.width*h/im.height), h), Image.LANCZOS))
board = Image.new("RGB", (sum(i.width for i in ims), h), "white")
x = 0
for im in ims:
    board.paste(im, (x,0)); x += im.width
board.save(job["out"])
`,
  ],
  {
    input: JSON.stringify({
      out: path.join(OUT, 'board.png'),
      tiles: [
        ['source', SRC],
        ...results.filter((r) => r.file).map((r) => [`segfree=${r.segmentationFree}`, r.file]),
      ],
    }),
    encoding: 'utf8',
    timeout: 120000,
  },
)

writeFileSync(
  path.join(OUT, 'report.json'),
  JSON.stringify({ paidCallsThisStep: results.length, costUsd: 0.075 * results.length, model: MODEL, results }, null, 2),
)
console.log(JSON.stringify({ paidCallsThisStep: results.length, costUsd: 0.075 * results.length }, null, 2))
