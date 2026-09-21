#!/usr/bin/env node
/** 무과금. 「벗기」가 Wan 에 실제로 뭘 보내는지 전문 출력. */
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(path.join(ROOT, '_tmp_bundle'), { recursive: true })
const out = path.join(ROOT, '_tmp_bundle', 'content-policy-dump.cjs')
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/content-policy.ts" --bundle --platform=node --format=cjs --outfile="${out}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const policy = await import(`file://${out}?t=${Date.now()}`)

const cases = [
  ['벗기 10초 (슬립 시작 프레임)', '옷벗김. 혼자. 원본 구도 유지. 클로즈업 금지.', 10],
  ['벗기 5초 한 겹', '옷벗김. 혼자. 한 겹만.', 5],
  ['옷 녹이기 → 슬립', '이 사진 같은 사람. 지금 옷만 슬립으로 천천히 녹인다. 얼굴·몸·자세 유지. 새 사람 금지. 서서 다시 찍기 금지.', 10],
]

for (const [label, motion, durationSec] of cases) {
  const prompt = policy.buildAnimationPrompt({ motion, durationSec, sourcePeople: 1, genMode: 'fashion' })
  console.log(`\n${'='.repeat(70)}\n${label}  (${prompt.length}자)\n${'='.repeat(70)}`)
  console.log(prompt)
  const hits = [
    ['Keep source clothes', /Keep source clothes/i],
    ['Do not undress', /Do not undress/i],
    ['Keep the source outfit', /Keep the source outfit/i],
    ['nude/bare', /\bnude\b|\bbare\b/i],
    ['slip', /\bslip\b/i],
  ].filter(([, re]) => re.test(prompt))
  console.log('\n  >> 걸린 문구: ' + (hits.map(([n]) => n).join(', ') || '없음'))
}
