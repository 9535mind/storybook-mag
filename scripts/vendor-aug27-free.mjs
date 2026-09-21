#!/usr/bin/env node
// 8월 27일자(7b98822) 완성본을 자유 스튜디오 전용 경로로 얼려서 복제한다.
// Desk / 일러스트가 쓰는 현재 functions/api/*.ts 는 건드리지 않는다.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const AUG27 = '7b98822'
const root = resolve(process.cwd())

const show = (path) =>
  execFileSync('git', ['show', `${AUG27}:${path}`], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })

const write = (rel, text) => {
  const full = resolve(root, rel)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, text, 'utf8')
  return text.length
}

const banner = (what) =>
  `// ⚠ 8월 27일자 완성본(${AUG27})을 그대로 얼린 사본입니다. 자유 스튜디오 전용.\n` +
  `// Desk / 일러스트는 이 파일을 쓰지 않습니다. 여기를 "개선"하지 마세요 —\n` +
  `// 사용자가 이 시점의 나체·포즈 동작을 기준점으로 저장했습니다. (${what})\n`

/** content-policy 를 얼린 사본으로 돌리고, 요금 한도 키를 자유 스튜디오 몫으로 분리한다. */
const retarget = (src, rateKey) =>
  src
    .replace(/from '\.\.\/lib\/content-policy'/g, "from '../lib/aug27/content-policy'")
    .replace(/enforceRateLimit\(env, '[a-z-]+'/g, `enforceRateLimit(env, '${rateKey}'`)

// 1) 프롬프트 두뇌 — 외부 import 가 없는 단일 파일이라 통째로 얼린다.
const policy = show('functions/lib/content-policy.ts')
write('functions/lib/aug27/content-policy.ts', banner('프롬프트 두뇌') + policy)

// 2) 사진 + 지시문 → 한 장 (나체·포즈가 살아 있던 경로)
write(
  'functions/api/free-refine.ts',
  banner('사진 수정') + retarget(show('functions/api/refine.ts'), 'free-refine'),
)

// 3) 글만으로 한 장
write(
  'functions/api/free-generate.ts',
  banner('글로 생성') + retarget(show('functions/api/generate.ts'), 'free-generate'),
)

// 4) 쇼츠 — 엔진·길이·머지는 그대로, 프롬프트만 8월 27일자
write(
  'functions/api/free-animate.ts',
  banner('쇼츠') + retarget(show('functions/api/animate.ts'), 'free-animate'),
)

console.log(`vendored aug27 (${AUG27}) → functions/lib/aug27 + free-refine/free-generate/free-animate`)
