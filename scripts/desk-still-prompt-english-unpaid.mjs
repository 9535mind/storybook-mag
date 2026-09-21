#!/usr/bin/env node
/**
 * 무과금. 엔진에 나가는 Desk 정지화 프롬프트는 영어여야 한다.
 * 슬립 문구가 노르웨이어로 들어가 있어서 Flux가 옷을 그대로 돌려준 적이 있다.
 * 길이 상한에서 단어 중간이 잘리면 마지막 지시가 반쪽이 된다. 그것도 막는다.
 */
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(path.join(ROOT, '_tmp_bundle'), { recursive: true })
const out = path.join(ROOT, '_tmp_bundle', 'desk-still-prompt.cjs')
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-still-prompt.ts" --bundle --platform=node --format=cjs --outfile="${out}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const mod = await import(`file://${out}?t=${Date.now()}`)

const LOOKS = [
  ['silk', '원본을 그 자리에서만 고친다. 옷만 얇은 실크 슬립 한 장 노브라로 녹인다.'],
  ['nude', '옷을 녹여 완전 나체로 만든다.'],
  ['clothes', '검은 드레스로 갈아입힌다.'],
]
const STEPS = ['look', 'place', 'cut', 'together']

/** 한글은 사용자 입력이라 그대로 새어 나올 수 있다. 그 외 비ASCII는 실수다. */
const NON_ASCII = /[^\x00-\x7F\uAC00-\uD7A3\u3131-\u318E]/
const NORDIC = /\b(ingen|klærne|klaerne|skåret|tynn|nattkjole|under silken|truse|bryst)\b/i

const rows = []
for (const step of STEPS) {
  for (const [look, ko] of LOOKS) {
    for (const couple of [false, true]) {
      const text = mod.buildDeskStillPrompt(ko, couple, step, { look, action: 'none', couple })
      rows.push({
        step,
        look,
        couple,
        chars: text.length,
        nonAscii: NON_ASCII.test(text) ? (text.match(NON_ASCII) || [])[0] : '',
        nordic: NORDIC.test(text) ? (text.match(NORDIC) || [])[0] : '',
        midWordCut: text.length >= mod.DESK_STILL_PROMPT_MAX - 2 && !/[.!?]$/.test(text),
        text,
      })
    }
  }
}

const bad = rows.filter((r) => r.nonAscii || r.nordic || r.midWordCut)
const report = {
  newPaidCall: false,
  checked: rows.length,
  max: mod.DESK_STILL_PROMPT_MAX,
  longest: Math.max(...rows.map((r) => r.chars)),
  ageKept: rows.filter((r) => r.text.includes('Adult 18+')).length,
  bad: bad.map((r) => ({ step: r.step, look: r.look, couple: r.couple, nonAscii: r.nonAscii, nordic: r.nordic, midWordCut: r.midWordCut })),
  ok: bad.length === 0,
}
console.log(JSON.stringify(report, null, 2))
if (!report.ok) {
  for (const r of bad) console.log(`${r.step}/${r.look}/${r.couple}: ${r.text}`)
  process.exit(1)
}
