#!/usr/bin/env node
// 얼린 8월 27일자 자유 스튜디오 경로가 지금의 lib 들과 아직 맞물리는지 본다.
// (tsc 가 없는 저장소라 import 이름이 살아 있는지만 정적으로 확인한다.)
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const files = [
  'functions/api/free-refine.ts',
  'functions/api/free-generate.ts',
  'functions/api/free-animate.ts',
]

const exportsOf = (path) => {
  const src = readFileSync(path, 'utf8')
  const names = new Set()
  for (const m of src.matchAll(
    /^export\s+(?:async\s+)?(?:const|let|function|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/gm,
  )) {
    names.add(m[1])
  }
  for (const m of src.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const piece of m[1].split(',')) {
      const name = piece.trim().split(/\s+as\s+/).pop()?.trim()
      if (name) names.add(name)
    }
  }
  return names
}

const missing = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'(\.\.[^']+)'/g)) {
    const target = resolve(dirname(file), m[2]) + '.ts'
    let have
    try {
      have = exportsOf(target)
    } catch {
      missing.push(`${file}: 파일 없음 ${m[2]}`)
      continue
    }
    for (const piece of m[1].split(',')) {
      const name = piece.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
      if (name && !have.has(name)) missing.push(`${file}: ${m[2]} 에 ${name} 없음`)
    }
  }
}

if (missing.length) {
  console.error('BROKEN\n' + missing.join('\n'))
  process.exit(1)
}
console.log(`aug27 free wires connected (${files.length} routes)`)
