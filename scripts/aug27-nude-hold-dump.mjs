#!/usr/bin/env node
/**
 * 무과금. 「나체로 키스하면서 가슴 만지기」 15초가 왜 11초쯤에 다시 옷을 입는지 보려고
 * 8월 27일 사본과 지금 코드가 각각 Wan 에 뭘 보내는지 그대로 뽑는다.
 */
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(path.join(ROOT, '_tmp_bundle'), { recursive: true })

const load = async (src, tag) => {
  const out = path.join(ROOT, '_tmp_bundle', `policy-${tag}.cjs`)
  execSync(
    `node_modules\\.bin\\esbuild "${src}" --bundle --platform=node --format=cjs --outfile="${out}"`,
    { cwd: ROOT, stdio: 'pipe' },
  )
  return import(`file://${out}?t=${Date.now()}`)
}

const aug27 = await load('functions/lib/aug27/content-policy.ts', 'aug27')
const now = await load('functions/lib/content-policy.ts', 'now')

const DUR = 15

const probes = [
  ['벗는 걸음(BEAT1 탈의)', /peels? to nude|pulls? off ALL clothes|remove ALL clothes|undress/i],
  ['이미 나체 전제', /already (fully )?nude|이미 완전 나체|stays? nude from the first frame/i],
  ['되입기 금지', /clothes back on|re-?dress|clothes returning/i],
  ['마지막 프레임 잠금', /LAST FRAME|last frame/i],
  ['가슴 만지기', /breast/i],
  ['키스', /kiss/i],
]

// 옷 입은 사진에서 통째로 시키는 지금 방식 vs 나체 그림에서 동작만 시키는 방식
const cases = [
  ['옷 사진 + 통짜 주문', '나체로 키스하면서 가슴 만지기'],
  ['나체 그림 + 동작만', '이미 완전 나체 유지. 키스하면서 가슴 만지기.'],
]

for (const [tag, policy] of [
  ['8월 27일 사본 (자유 스튜디오)', aug27],
  ['지금 코드 (Desk)', now],
]) {
  for (const [caseName, motion] of cases) {
    let prompt = ''
    try {
      prompt = policy.buildAnimationPrompt({
        motion,
        durationSec: DUR,
        sourcePeople: 2,
        genMode: 'fashion',
      })
    } catch (error) {
      prompt = `!! ${error instanceof Error ? error.message : error}`
    }
    console.log(`\n${'='.repeat(78)}`)
    console.log(`${tag} · ${caseName} · ${DUR}초 · ${prompt.length}자`)
    console.log('='.repeat(78))
    console.log(prompt)
    console.log('-'.repeat(78))
    for (const [label, re] of probes) {
      console.log(`  ${re.test(prompt) ? '있음' : '없음 '}  ${label}`)
    }
  }
}
