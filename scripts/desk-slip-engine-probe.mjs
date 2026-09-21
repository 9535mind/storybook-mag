#!/usr/bin/env node
/**
 * 유료 2회. 슬립이 안 나오는 원인이 프롬프트인지 강도인지 가른다.
 * 같은 사진·같은 마스크로 두 가지만 바꿔 본다.
 *   A 짧고 단순한 문장 + 강도 0.95
 *   B 지금 배포된 긴 문장 + 강도 0.95
 * 지금 배포본(긴 문장 + 0.82)은 이미 옷이 안 바뀌는 것으로 확인됨.
 */
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WT = 'C:\\Users\\UserK\\Desktop\\PLATFORM\\storymag-74098c5'
const LIVE = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-live-slip')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-slip-engine-probe')
const BUNDLE = path.join(ROOT, '_tmp_bundle')
mkdirSync(OUT, { recursive: true })

const LOCK = path.join(OUT, 'probe.lock')
if (existsSync(LOCK) && !process.argv.includes('--again')) {
  console.log(JSON.stringify({ skipped: 'lock', lock: LOCK, newPaidCall: false }, null, 2))
  process.exit(0)
}

const falKey = (readFileSync(path.join(ROOT, '.dev.vars'), 'utf8').match(/^FAL_KEY=(.*)$/m) || [])[1]?.trim()
if (!falKey) throw new Error('FAL_KEY missing in .dev.vars')

const out = path.join(BUNDLE, 'probe-fal-client.cjs')
execSync(
  `node_modules\\.bin\\esbuild "${path.join(WT, 'functions/lib/fal-client.ts')}" --bundle --platform=node --format=cjs --outfile="${out}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const fal = await import(`file://${out}?t=${Date.now()}`)

const srcDataUrl = `data:image/jpeg;base64,${readFileSync(path.join(LIVE, '00-source.jpg')).toString('base64')}`
const maskDataUrl = `data:image/png;base64,${readFileSync(path.join(LIVE, '01-mask.png')).toString('base64')}`

const DEPLOYED_PROMPT =
  '[DO] Edit in place. Same woman, body, hair, room. Melt the clothes into one thin silk slip. FORBIDDEN new face, white studio, catalog model. [BODY] one thin silk slip, bias cut, fluid drape. No bra, no straps but the slip straps. Bare breasts under silk. No separate panty. FAILED bra, camisole+panty. [KEEP] Adult 18+. same source face, same hair. same pose, crop, body, room. Local edit ONLY the white-masked clothes. The silk follows the existing torso and pose. Unmasked face, hair, hands, limbs, and background stay exact source pixels. FORBIDDEN new person, standing rebuild.'
const PLAIN_PROMPT =
  'She is wearing a thin ivory silk slip dress with thin shoulder straps. Bare shoulders and bare arms. Same woman, same pose, same room.'

// PLAIN 은 "slip dress" 한 마디라 엔진이 캐미솔+바지 두 벌로 해석할 때가 있다(실측).
// 한 벌이라는 것과 다리가 맨살이라는 것을 문장으로 박는다.
const DRESS_PROMPT =
  'She is wearing one single ivory silk slip dress. Thin spaghetti straps on bare shoulders, bias-cut silk falling in one unbroken piece from her shoulders down to below the knee. Her arms are bare skin and her lower legs are bare skin. Same woman, same face, same pose, same room, same light.'

// 0.95 는 슬립은 나오지만 몸을 다시 그려 뒤틀릴 때가 있다(실측). 안정한 강도를 찾는다.
const SWEEP = [0.72, 0.8, 0.88]
const variants = process.argv.includes('--dress')
  ? [
      { id: 'dress-0.88-a', prompt: DRESS_PROMPT, strength: 0.88 },
      { id: 'dress-0.88-b', prompt: DRESS_PROMPT, strength: 0.88 },
      { id: 'dress-0.88-c', prompt: DRESS_PROMPT, strength: 0.88 },
    ]
  : process.argv.includes('--sweep')
  ? SWEEP.flatMap((s) => [
      { id: `plain-${s}-a`, prompt: PLAIN_PROMPT, strength: s },
      { id: `plain-${s}-b`, prompt: PLAIN_PROMPT, strength: s },
    ])
  : [
      { id: 'A-plain-0.95', prompt: PLAIN_PROMPT, strength: 0.95 },
      { id: 'B-deployed-0.95', prompt: DEPLOYED_PROMPT, strength: 0.95 },
    ]

async function poll(job) {
  if ('imageUrl' in job && job.imageUrl) return job.imageUrl
  const headers = { Authorization: `Key ${falKey}` }
  for (let i = 0; i < 90; i += 1) {
    await new Promise((r) => setTimeout(r, 2000))
    const st = await (await fetch(job.statusUrl, { headers })).json()
    if (st.status === 'COMPLETED') {
      const res = await (await fetch(job.responseUrl, { headers })).json()
      return res?.images?.[0]?.url || res?.image?.url || ''
    }
    if (st.status === 'FAILED' || st.error) throw new Error(`fal failed: ${JSON.stringify(st).slice(0, 300)}`)
  }
  throw new Error('fal timeout')
}

writeFileSync(LOCK, new Date().toISOString())
const rows = []
for (const v of variants) {
  const job = await fal.submitFalInpaint({
    falKey,
    imageUrl: srcDataUrl,
    maskUrl: maskDataUrl,
    prompt: v.prompt,
    strength: v.strength,
  })
  const url = await poll(job)
  const file = path.join(OUT, `${v.id}.png`)
  writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()))
  rows.push({ ...v, promptChars: v.prompt.length, url, file })
  console.log(`${v.id} done`)
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
w, h = 420, 565
gap = 14
board = Image.new("RGB", (w * len(job["paths"]) + gap * (len(job["paths"]) + 1), h + 64), (245, 245, 245))
d = ImageDraw.Draw(board)
x = gap
for p, lab in zip(job["paths"], job["labels"]):
    board.paste(Image.open(p).convert("RGB").resize((w, h)), (x, 44))
    d.text((x, 14), lab, fill=(20, 20, 20))
    x += w + gap
board.save(job["out"])
print("ok")
`,
  ],
  {
    cwd: ROOT,
    input: JSON.stringify({
      paths: [path.join(LIVE, '00-source.jpg'), ...rows.map((r) => r.file)],
      labels: ['source', ...rows.map((r) => r.id)],
      out: path.join(
        OUT,
        process.argv.includes('--dress')
          ? 'dress-board.png'
          : process.argv.includes('--sweep')
            ? 'sweep-board.png'
            : 'probe-board.png',
      ),
    }),
    encoding: 'utf8',
  },
)

const report = { newPaidCall: true, paidCallsThisStep: variants.length, rows, board: path.join(OUT, 'probe-board.png') }
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
