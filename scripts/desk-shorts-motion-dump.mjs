#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE_DIR = path.join(ROOT, '_tmp_bundle')
const BUNDLE_FILE = path.join(BUNDLE_DIR, 'content-policy.cjs')
if (!existsSync(BUNDLE_DIR)) mkdirSync(BUNDLE_DIR, { recursive: true })
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/content-policy.ts" --bundle --platform=node --format=cjs --outfile="${BUNDLE_FILE}"`,
  { cwd: ROOT, stdio: 'inherit' },
)
const mod = await import(`file://${BUNDLE_FILE}?t=${Date.now()}`)

const cases = [
  [
    'kiss-hold',
    '원본 남자가 원본 여자와 입맞춤. 남자는 남자로(짧은 머리, 납작한 가슴). 여자는 이미 완전 나체 유지. 치골에만 성긴 실제 곱슬 음모. 민무늬·역삼각·검정 팬티·흰 팬티·끈팬티 금지. 브라·팬티 없음. 치마를 발목으로 내리지 말 것. 남자 옷은 유지. 여여 키스 금지. 같은 두 얼굴. 원본 구도 유지. 클로즈업 금지.',
    2,
  ],
  [
    'kiss-both-ask',
    '나체로 서로 키스하는 장면 (남녀만: 소스 남자가 여자와 키스. 남자는 남자로 유지. 여여 키스 금지. 둘 다 전신 나체) (사진에는 두 사람이 함께 있다 — 커플)',
    2,
  ],
  [
    'hug-hold',
    '원본 남자가 원본 여자를 안는다. 남자는 남자로. 여자는 나체 유지. 치골에만 성긴 실제 곱슬 음모. 브라·팬티 없음. 민무늬·검정 팬티 금지. 여여 금지. 같은 두 얼굴. 원본 구도 유지. 클로즈업 금지.',
    2,
  ],
  [
    'hands-couple',
    '남자가 한 손은 여자의 가슴을, 한 손은 보지를 만진다. 여자는 이미 나체 유지. 치골에만 성긴 실제 곱슬 음모. 브라·팬티 없음. 민무늬·검정 팬티 금지. 같은 두 사람. 새 사람 금지.',
    2,
  ],
  [
    'breast-couple',
    '남자가 여자의 가슴을 만진다. 여자는 이미 나체 유지. 치골에만 성긴 실제 곱슬 음모. 브라·팬티 없음. 같은 두 사람. 새 사람 금지. 원본 구도 유지. 클로즈업 금지.',
    2,
  ],
  [
    'hands-solo',
    '혼자. 왼손은 가슴을, 오른손은 보지를 만진다. 이미 나체 유지. 치골에만 성긴 실제 곱슬 음모. 브라·팬티 없음. 민무늬·검정 팬티 금지. 원본 구도 유지. 새 사람 금지.',
    1,
  ],
  [
    'breast-solo',
    '혼자. 자신의 가슴을 양손으로 주무른다. 이미 나체 유지. 치골에만 성긴 실제 곱슬 음모. 브라·팬티 없음. 원본 구도 유지. 새 사람 금지.',
    1,
  ],
  [
    'undress-solo',
    '옷벗김. 치골에만 성긴 실제 곱슬 음모. 민무늬·역삼각·검정 팬티·흰 팬티·끈팬티 금지. 브라·팬티 없음. 혼자. 원본 구도 유지. 클로즈업 금지.',
    1,
  ],
  [
    'undress-couple',
    'CAST 여자 옷만 녹여 나체. 치골에만 성긴 실제 곱슬 음모. 민무늬·역삼각·검정 팬티·흰 팬티·끈팬티 금지. 브라·팬티 없음. CAST 남자는 남자로 유지(짧은 머리, 납작한 가슴). 남자 정장은 한 올도 벗기지 말 것. 두 번째 여자 금지. 성별 바꾸기 금지. 여여 금지. 같은 두 얼굴. 원본 구도 유지. 클로즈업 금지.',
    2,
  ],
  [
    'zipper',
    '남자 바지 지퍼만 손으로 내린다. 여자는 나체 유지. 치골에만 성긴 실제 곱슬 음모. 민무늬·역삼각·검정 팬티·흰 팬티·끈팬티 금지. 브라·팬티 없음. 여자 배·피부·가랑이에 지퍼·솔기 금지. 두 머리 유지. 배만 확대 금지. 자지 금지. 같은 두 얼굴. 원본 구도 유지.',
    2,
  ],
]

for (const [name, motion, people] of cases) {
  const p = mod.buildAnimationPrompt({
    motion,
    rawMotion: motion,
    prompt: '스튜디오에서 전신',
    durationSec: 15,
    sourcePeople: people,
  })
  const keys = [...p.matchAll(/\[([A-Z]+)\]/g)].map((m) => m[1]).join(',')
  const flags = {
    len: p.length,
    keys,
    peel: /remove ALL clothes|SHE peels|BEAT1[\s\S]{0,80}peel/i.test(p),
    hold: /already fully nude|NO undress|Start already fully nude/i.test(p),
    pubic: /Korean-30s pubic|pubic curls|음모/i.test(p),
    shaved: /smooth shaved/i.test(p),
    pantyBan: /ZERO panties|black panty|검정 팬티/i.test(p),
    bothNude: /both fully nude/i.test(p),
    manClothes: /HE keeps source clothes|HE clothed|source clothes|he still in/i.test(p),
    ww: /Undress EVERY woman|both women lose/i.test(p),
    kissSteal: /his hand on her bare breast/i.test(p) && !/가슴을 만진다/.test(motion),
  }
  const motionLine = (p.match(/\[MOTION\][\s\S]*?(?=\n\[|$)/) || [''])[0].slice(0, 280)
  const bodyLine = (p.match(/\[BODY\][\s\S]*?(?=\n\[|$)/) || [''])[0].slice(0, 220)
  console.log('\n===', name, JSON.stringify(flags))
  console.log(motionLine)
  console.log(bodyLine)
}
