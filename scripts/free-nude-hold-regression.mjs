#!/usr/bin/env node
/**
 * 무과금 회귀.
 *
 * 증상: 옷 입은 사진으로 「나체로 키스하면서 가슴 만지기」 15초를 시키면
 *       3초에 벗었다가 11초에 옷이 되살아난다.
 * 원인: 시작 프레임이 옷 입은 사진이라 엔진이 뒤에서 그리로 되돌아간다.
 * 고침: 나체를 먼저 정지화로 확정하고, 움직임에서 "벗는다"를 빼서
 *       클립 전체를 동작에 쓰게 한다.
 *
 * 여기서는 (1) 자유 스튜디오가 움직임 문구를 그렇게 바꾸는지,
 * (2) 그 문구가 8월 27일 사본에서 탈의 걸음 없는 프롬프트가 되는지 본다.
 */
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fails = []

// ── 1. 클라이언트의 문구 바꾸기 규칙을 그대로 꺼내 쓴다 ────────────────────
const client = readFileSync(path.join(ROOT, 'public', 'free-studio.js'), 'utf8')
const holdSrc = client.match(/const holdNude = \(text\) => \{[\s\S]*?\n  \}/)
if (!holdSrc) {
  console.error('BROKEN: free-studio.js 에서 holdNude 를 찾지 못했습니다.')
  process.exit(1)
}
// eslint-disable-next-line no-new-func
const holdNude = new Function(`${holdSrc[0].replace('const holdNude =', 'return')}`)()

const rewrites = [
  ['나체로 키스하면서 가슴 만지기', '키스하면서 가슴 만지기'],
  ['옷을 벗고 키스한다', '키스한다'],
  ['알몸으로 천천히 돌아선다', '천천히 돌아선다'],
  ['누드로 가슴을 만진다', '가슴을 만진다'],
]
for (const [before, afterCore] of rewrites) {
  const out = holdNude(before)
  if (!out.startsWith('이미 완전 나체 유지.')) fails.push(`"${before}" → 나체 유지 머리말 없음: ${out}`)
  if (!out.includes(afterCore)) fails.push(`"${before}" → 동작이 사라짐: ${out}`)
  if (/나체로|알몸|누드로|옷을 벗/.test(out.replace('이미 완전 나체 유지.', ''))) {
    fails.push(`"${before}" → 벗는 말이 남음: ${out}`)
  }
}

// ── 2. 그 문구가 실제로 탈의 걸음 없는 프롬프트를 만드는지 ────────────────
mkdirSync(path.join(ROOT, '_tmp_bundle'), { recursive: true })
const bundle = path.join(ROOT, '_tmp_bundle', 'policy-aug27-regression.cjs')
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/aug27/content-policy.ts" --bundle --platform=node --format=cjs --outfile="${bundle}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const policy = await import(`file://${bundle}?t=${Date.now()}`)

const build = (motion) =>
  policy.buildAnimationPrompt({ motion, durationSec: 15, sourcePeople: 2, genMode: 'fashion' })

const before = build('나체로 키스하면서 가슴 만지기')
const after = build(holdNude('나체로 키스하면서 가슴 만지기'))

// 고치기 전: 앞 8초를 벗는 데 쓴다 (그래서 동작이 뒤로 밀리고 되입기가 난다)
if (!/BEAT 1 \(first 8s/.test(before)) {
  fails.push('전제가 깨졌습니다 — 통짜 주문이 더는 8초 탈의 걸음을 만들지 않습니다.')
}
// 고친 뒤: 탈의 걸음이 사라지고 클립 전체가 동작이어야 한다
if (/pulls off ALL clothes/.test(after)) fails.push('고친 뒤에도 탈의 걸음이 남아 있습니다.')
if (!/already fully nude/.test(after)) fails.push('고친 뒤에 「이미 나체」 전제가 없습니다.')
if (!/BEAT 2 \(rest of clip\)/.test(after)) fails.push('고친 뒤에 클립 전체가 동작이 아닙니다.')
for (const must of [/kiss/i, /breast/i, /clothes back on/i]) {
  if (!must.test(after)) fails.push(`고친 뒤 프롬프트에 ${must} 가 빠졌습니다.`)
}
if (after.length > 1500) fails.push(`프롬프트가 ${after.length}자 — Wan fast 한도(1500) 초과.`)

if (fails.length) {
  console.error('FAIL\n' + fails.map((f) => ` - ${f}`).join('\n'))
  process.exit(1)
}
console.log(`nude-hold ok · 통짜 ${before.length}자(8초 탈의) → 고침 ${after.length}자(탈의 걸음 없음)`)
