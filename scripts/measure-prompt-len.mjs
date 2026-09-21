#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BUNDLE_DIR = path.join(ROOT, '_tmp_bundle')
const BUNDLE_FILE = path.join(BUNDLE_DIR, 'content-policy.cjs')
if (!existsSync(BUNDLE_DIR)) mkdirSync(BUNDLE_DIR, { recursive: true })
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/content-policy.ts" --bundle --platform=node --format=cjs --outfile="${BUNDLE_FILE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const mod = await import(`file://${BUNDLE_FILE}?t=${Date.now()}`)

const wanCases = [
  [
    'wan/couple-undress-15',
    {
      motion: '옷벗김. 여자만 나체. 남자 옷은 유지. 같은 두 얼굴. 원본 구도 유지. 클로즈업 금지.',
      rawMotion: '옷벗김. 여자만 나체. 남자 옷은 유지. 같은 두 얼굴. 원본 구도 유지. 클로즈업 금지.',
      durationSec: 15,
      sourcePeople: 2,
      sourceCast: 'mw',
    },
  ],
  [
    'wan/couple-melt-nude-15',
    {
      motion: '이 사진 같은 두 사람. 여자 옷만 녹여 나체. 남자 옷은 유지. 자세·구도 유지. 새 사람 금지.',
      rawMotion: '이 사진 같은 두 사람. 여자 옷만 녹여 나체. 남자 옷은 유지. 자세·구도 유지. 새 사람 금지.',
      durationSec: 15,
      sourcePeople: 2,
      sourceCast: 'mw',
    },
  ],
  [
    'wan/couple-hug-15',
    {
      motion: '두 사람이 가볍게 서로 안는다. 옷은 그대로. 같은 두 얼굴. 원본 구도 유지.',
      rawMotion: '두 사람이 가볍게 서로 안는다. 옷은 그대로. 같은 두 얼굴. 원본 구도 유지.',
      durationSec: 15,
      sourcePeople: 2,
      sourceCast: 'mw',
    },
  ],
  [
    'wan/solo-undress-5',
    {
      motion: '옷벗김. 혼자. 한 겹만.',
      rawMotion: '옷벗김. 혼자. 한 겹만.',
      durationSec: 5,
      sourcePeople: 1,
    },
  ],
  [
    'wan/solo-nude-melt-15',
    {
      motion: '이 사진 같은 사람. 지금 옷만 녹여 나체. 얼굴·몸·자세 유지. 새 사람 금지.',
      rawMotion: '이 사진 같은 사람. 지금 옷만 녹여 나체. 얼굴·몸·자세 유지. 새 사람 금지.',
      durationSec: 15,
      sourcePeople: 1,
    },
  ],
]

const stillCases = [
  [
    'still/look-nude-couple',
    '이 사진 같은 두 사람. 여자 옷을 녹여 나체가 된다. 남자 옷은 유지. 자세·구도 유지. 새 얼굴 금지.',
    true,
    'look',
  ],
  [
    'still/look-slip-solo',
    '이 사진 같은 사람. 옷만 슬립 한 겹으로 녹인다. 얼굴·몸·자세·구도 유지. 새 사람·화보 모델 금지.',
    false,
    'look',
  ],
  [
    'still/place-hug-couple',
    '호텔 룸, 지금 떨어져 선 두 사람을 가볍게 서로 안기게 한다. 옷은 유지. 둘 다 얼굴이 보임., 얼굴은 같은 사람',
    true,
    'place',
  ],
  [
    'still/place-sit-solo',
    '호텔 룸, 지금 선 자세를 바꿔 앉힌다. 소파나 침대에 앉아. 서서 유지 금지., 얼굴은 같은 사람',
    false,
    'place',
  ],
]

console.log(`DESK STILL (SDXL CLIP ~420, max ${mod.DESK_STILL_PROMPT_MAX})`)
for (const [name, text, couple, step] of stillCases) {
  const p = mod.buildDeskStillPrompt(text, couple, step)
  const over = p.length > mod.DESK_STILL_PROMPT_MAX
  console.log(`${over ? 'OVER' : 'ok  '} ${String(p.length).padStart(4)}  ${name}`)
  console.log(`      ${p}`)
}

console.log('')
console.log('WAN (hard 1500)')
for (const [name, input] of wanCases) {
  const p = mod.buildAnimationPrompt(input)
  const over = p.length > 1500
  console.log(
    `${over ? 'OVER' : 'ok  '} ${String(p.length).padStart(4)}  ${name}` +
      (over ? `  head=${p.slice(0, 80).replace(/\n/g, ' | ')}` : ''),
  )
  if (over) console.log(`      missing MOTION=${!p.includes('[MOTION]')} TIME=${!p.includes('[TIME]')}`)
}
