#!/usr/bin/env node
/** 무과금. 엔진에 나가는 문자열에 영어·한글이 아닌 말이 섞여 있는지 전수 검사. */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { globSync } from 'node:fs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILES = [
  'functions/lib/content-policy.ts',
  'functions/lib/desk-still-prompt.ts',
  'functions/lib/nude-intent.ts',
  'functions/lib/nude-anatomy-locks.ts',
  'functions/lib/nude-reveal-locks.ts',
  'functions/lib/kiss-touch-motion.ts',
  'functions/lib/desk-look-server-verify.ts',
  'functions/api/tale-scene.ts',
  'functions/api/animate.ts',
  'public/app.js',
]

// 한글·ASCII 외의 라틴 확장 문자. 노르웨이어 æøå, 독일어 äöü, 프랑스어 éèç 등.
// ×, ° 같은 기호는 UI 표기라 제외. 라틴 확장 "글자"만 본다.
const FOREIGN = /[\u00C0-\u024F]/
const NORDIC_WORD =
  /\b(ingen|klærne|klaerne|skåret|skaaret|nattkjole|tynn|truse|bryst|silken|flytende|smelt)\b/i

const hits = []
for (const rel of FILES) {
  let text = ''
  try {
    text = readFileSync(path.join(ROOT, rel), 'utf8')
  } catch {
    continue
  }
  const lines = text.split(/\r?\n/)
  lines.forEach((line, idx) => {
    if (!/['"`]/.test(line)) return
    const foreign = FOREIGN.test(line) ? (line.match(FOREIGN) || [])[0] : ''
    const nordic = NORDIC_WORD.test(line) ? (line.match(NORDIC_WORD) || [])[0] : ''
    if (!foreign && !nordic) return
    hits.push({ file: rel, line: idx + 1, foreign, nordic, text: line.trim().slice(0, 160) })
  })
}

const report = { newPaidCall: false, files: FILES.length, hits: hits.length, list: hits, ok: hits.length === 0 }
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
