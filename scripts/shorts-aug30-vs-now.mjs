#!/usr/bin/env node
/**
 * 무과금. 8월 말(ba461c6, 2026-08-30) 쇼츠 프롬프트와 지금 것을 같은 입력으로 나란히 비교.
 * 「그때는 됐는데 지금은 안 된다」를 느낌이 아니라 글자 수와 문장으로 본다.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OLD = path.resolve(ROOT, '..', '_wt-aug30')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'shorts-aug30-vs-now')
mkdirSync(OUT, { recursive: true })

async function load(rootDir, label) {
  const outfile = path.join(OUT, `${label}.mjs`)
  await esbuild.build({
    entryPoints: [path.join(rootDir, 'functions/lib/content-policy.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile,
    logLevel: 'silent',
  })
  return import(`file://${outfile}`)
}

const [oldMod, newMod] = await Promise.all([load(OLD, 'aug30'), load(ROOT, 'now')])

// 완성 체크포인트가 「된다」고 적어 둔 바로 그 동작들.
const cases = [
  ['혼자 · 벗어서 나체 · 15초', { motion: '옷을 벗어 완전 나체가 된다', durationSec: 15, sourcePeople: 1 }],
  ['혼자 · 가슴 만지기 · 15초', { motion: '나체로 자기 가슴을 천천히 만진다', durationSec: 15, sourcePeople: 1 }],
  ['커플 · 키스 · 15초', { motion: '두 사람이 키스한다. 여자는 나체', durationSec: 15, sourcePeople: 2 }],
  ['커플 · 포옹 · 12초', { motion: '뒤에서 안는다. 여자 옷만 벗긴다', durationSec: 12, sourcePeople: 2 }],
  ['혼자 · 옷 입은 채 미소 · 10초', { motion: '살짝 미소 짓는다', durationSec: 10, sourcePeople: 1 }],
]

const rows = []
for (const [name, input] of cases) {
  const call = (mod) => {
    try {
      // sourcePeople 은 8월 말에는 없던 칸이다. 넘겨도 그쪽은 무시한다.
      const text = mod.buildAnimationPrompt({ ...input, rawMotion: input.motion })
      return typeof text === 'string' ? text : String(text?.prompt || '')
    } catch (error) {
      return `((실패: ${error instanceof Error ? error.message : 'unknown'}))`
    }
  }
  const before = call(oldMod)
  const after = call(newMod)
  rows.push({ name, beforeLen: before.length, afterLen: after.length, before, after })
}

const WAN_SAFE = 1500
console.log('8월 말(08-30) → 지금 · Wan 프롬프트 길이 (약 1500자 넘으면 순응도 급락)\n')
for (const r of rows) {
  const flag = r.afterLen > WAN_SAFE ? '  ⚠ 한도 넘음' : ''
  const delta = r.afterLen - r.beforeLen
  console.log(
    `${r.name}\n  8월 말 ${String(r.beforeLen).padStart(5)}자  →  지금 ${String(r.afterLen).padStart(5)}자  (${delta >= 0 ? '+' : ''}${delta})${flag}`,
  )
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(rows, null, 2))
console.log(`\n전문은 ${path.relative(ROOT, path.join(OUT, 'report.json'))}`)
