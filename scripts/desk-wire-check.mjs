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
const m = await import(`file://${BUNDLE_FILE}?t=${Date.now()}`)

const looks = {
  silk: '슬립 한 겹',
  nude: '나체',
  jeans: '흰 티와 청바지',
}

function compileLook(lookId, couple) {
  const look = looks[lookId]
  const nude = lookId === 'nude'
  if (couple) {
    return nude
      ? '원본을 그 자리에서만 고친다. 사람 수·얼굴·포옹·카메라·배경 유지. 사람 추가·교체·복제·성별 바꾸기 금지. 여자만 옷을 녹여 나체. 남자는 보존. 여여·흰 스튜디오 금지.'
      : `원본을 그 자리에서만 고친다. 사람 수·얼굴·포옹·카메라·배경 유지. 사람 추가·교체·복제·성별 바꾸기 금지. 여자만 옷을 ${look}으로 녹인다. 남자는 보존. 여여·흰 스튜디오 금지.`
  }
  return nude
    ? '이 사진 같은 사람. 옷을 녹여 나체가 된다. 얼굴·몸·자세·구도 유지. 새 사람·화보 모델 금지.'
    : `이 사진 같은 사람. 옷만 ${look}으로 녹인다. 얼굴·몸·자세·구도 유지. 새 사람·화보 모델 금지.`
}

function compilePlace(pose, couple) {
  const place = '호텔 룸'
  const hug = pose === 'hug'
  const sit = pose === 'sit'
  const lie = pose === 'lie'
  const poseLine = couple
    ? hug
      ? '지금 떨어져 선 두 사람을 가볍게 서로 안기게 한다. 옷은 유지. 둘 다 얼굴이 보임.'
      : sit
        ? '지금 선 자세를 바꿔 두 사람 모두 앉힌다. 소파나 침대에 앉아. 서서 유지 금지.'
        : lie
          ? '지금 선 자세를 바꿔 두 사람 모두 침대에 눕힌다. 서서 찍기 금지.'
          : '두 사람 모두 서서. 한 장.'
    : sit
      ? '지금 선 자세를 바꿔 앉힌다. 소파나 침대에 앉아. 서서 유지 금지.'
      : lie
        ? '지금 선 자세를 바꿔 침대에 눕힌다. 전신. 서서 찍기 금지.'
        : pose === 'hug'
          ? ''
          : '서서'
  return [place, poseLine, sit || lie || hug ? '얼굴은 같은 사람' : '방은 바꾸고 얼굴은 유지']
    .filter(Boolean)
    .join(', ')
}

const cases = [
  ['look/nude-couple', 'look', compileLook('nude', true), true, { engine: true, do: /\[DO\] Edit source in place/, panty: /panty OFF/, pubic: /Korean-30s pubic/, black: /FAILED black panty/, man: /He stays male/, apart: /FORBIDDEN two women, white studio/ }],
  ['look/nude-solo', 'look', compileLook('nude', false), false, { engine: true, do: /\[DO\] melt ALL clothes/, panty: /panty OFF/ }],
  ['look/slip-solo', 'look', compileLook('silk', false), false, { engine: true, do: /\[DO\] melt clothes into a pale slip/, ivory: /ivory, not black/ }],
  ['look/jeans-solo', 'look', compileLook('jeans', false), false, { engine: false, do: /\[DO\] melt clothes into the requested outfit/ }],
  ['place/hug-couple', 'place', compilePlace('hug', true), true, { engine: true, do: /\[DO\] light hug/, pose: true }],
  ['place/sit-solo', 'place', compilePlace('sit', false), false, { engine: true, do: /\[DO\] she SITS/, sit: true }],
  ['place/lie-couple', 'place', compilePlace('lie', true), true, { engine: true, do: /\[DO\] BOTH lie/ }],
  ['place/stand-couple', 'place', compilePlace('stand', true), true, { engine: false, do: /\[DO\] BOTH stand/ }],
]

let failed = 0
console.log('CARD → COMPILE → ENGINE → [DO]/BODY')
for (const [name, step, desc, couple, want] of cases) {
  const engine = m.deskStillUsesAdultReplicate(step, desc)
  const force = m.deskStillUsesAdultReplicate(step, desc, true)
  const p = m.buildDeskStillPrompt(desc, couple, step)
  const over = p.length > m.DESK_STILL_PROMPT_MAX
  const checks = [
    ['engine', engine === want.engine],
    ['force', want.engine ? force === true : true],
    ['budget', !over],
    ...Object.entries(want)
      .filter(([k]) => k !== 'engine')
      .map(([k, re]) => [k, re instanceof RegExp ? re.test(p) : Boolean(re)]),
  ]
  const bad = checks.filter(([, ok]) => !ok).map(([k]) => k)
  if (bad.length) failed += 1
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${name}  ${engine ? 'Replicate' : 'Kontext'}  ${p.length}c${bad.length ? '  missing=' + bad.join(',') : ''}`)
  if (bad.length) {
    console.log(`      desc: ${desc}`)
    console.log(`      prompt: ${p}`)
  }
}

const undressCouple = '옷벗김. 여자만 나체. 남자 옷은 유지. 같은 두 얼굴. 원본 구도 유지. 클로즈업 금지.'
const meltNude = '이 사진 같은 두 사람. 여자 옷만 녹여 나체. 남자 옷은 유지. 자세·구도 유지. 새 사람 금지.'
const hugMove = '두 사람이 가볍게 서로 안는다. 옷은 그대로. 같은 두 얼굴. 원본 구도 유지.'
const wan = [
  ['wan/undress-couple', undressCouple, { ww: false, nude: true, manKeep: true }],
  ['wan/melt-nude', meltNude, { nude: true, manKeep: true }],
  ['wan/hug', hugMove, { nude: false }],
]
console.log('')
console.log('VIDEO MOTION → Wan')
for (const [name, motion, want] of wan) {
  const p = m.buildAnimationPrompt({
    motion,
    rawMotion: motion,
    durationSec: 15,
    sourcePeople: 2,
    sourceCast: 'mw',
  })
  const over = p.length > 1500
  const ww = /여여|two women|both women/i.test(p)
  const panty = /panty OFF|ZERO panties|panty/i.test(p)
  const manKeep = /keeps source clothes|He keeps|ONLY SHE|man stays/i.test(p)
  const bad = [
    over && 'over1500',
    want.ww === false && ww && '여여',
    want.nude && !panty && 'no-panty-line',
    want.manKeep && !manKeep && 'man-clothes',
  ].filter(Boolean)
  if (bad.length) failed += 1
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${name}  ${p.length}c${bad.length ? '  ' + bad.join(',') : ''}`)
}

if (/여여/.test(undressCouple)) {
  failed += 1
  console.log('FAIL desk undress couple still says 여여')
}

console.log('')
console.log('여 슬롯 mw 커플 → 여자만 편집')
{
  const desc = compileLook('nude', true)
  const p = m.buildDeskStillPrompt(desc, true, 'look')
  const asset = {
    peopleCount: 2,
    sourceCast: 'mw',
    people: [
      { index: 0, gender: 'female', action: 'edit' },
      { index: 1, gender: 'male', action: 'preserve' },
    ],
    targetPersonIndex: 0,
    preservePersonIndexes: [1],
  }
  const regen = /female couple|both women|full-body studio|standing in a white studio/i.test(p)
  const inPlace = /Edit source in place/i.test(p)
  const preserveHim = /Preserve person 1 \(man\)/i.test(p)
  const editHer = /ONLY person 0 \(woman\)/i.test(p)
  const aspectSource = !/16:9/.test(p)
  const checks = [
    ['peopleCount', asset.peopleCount === 2],
    ['sourceCast', asset.sourceCast === 'mw'],
    ['edit-0', asset.people[0].action === 'edit'],
    ['preserve-1', asset.people[1].action === 'preserve'],
    ['in-place', inPlace],
    ['edit-her', editHer],
    ['preserve-him', preserveHim],
    ['no-regen', !regen],
    ['aspect-source', aspectSource],
    ['budget', p.length <= m.DESK_STILL_PROMPT_MAX],
  ]
  const bad = checks.filter(([, ok]) => !ok).map(([k]) => k)
  if (bad.length) failed += 1
  console.log(`${bad.length ? 'FAIL' : 'ok  '} look/mw-woman-slot  ${p.length}c${bad.length ? '  missing=' + bad.join(',') : ''}`)
  if (bad.length) console.log(`      prompt: ${p}`)
}

console.log('')
console.log('CAST lock — 미검증 mw 금지, 여여 금지')
{
  const { readFileSync } = await import('node:fs')
  const app = readFileSync(path.join(ROOT, 'public/app.js'), 'utf8')
  const html = readFileSync(path.join(ROOT, 'public/index.html'), 'utf8')
  const lock = app.slice(app.indexOf('function deskLockedCast'), app.indexOf('function deskCastUnverified'))
  const kontext = app.slice(app.indexOf('const runDeskKontextStep'), app.indexOf('const setDeskStillBusy'))
  const look = app.slice(app.indexOf('const runDeskStepLook'), app.indexOf('const runDeskStepPlace'))
  const checks = [
    ['lock-mw-only', /w\.verifiedSourceCast === 'mw'/.test(lock) && !/sourceCast === 'ww'/.test(lock)],
    ['lock-no-infer-pair', !/storedPair \|\| \(bothSlots/.test(lock)],
    ['kontext-abort-unless-mw', /liveCast\.sourceCast !== 'mw'/.test(kontext)],
    ['kontext-no-gender-fallback', !/gender0 \|\| 'female'/.test(kontext) && !/genders\[0\] \|\| 'female'/.test(kontext)],
    ['kontext-no-auto-mw', !/sourceCast: 'mw'/.test(kontext)],
    ['look-no-auto-mw', !/sourceCast: 'mw'/.test(look)],
    ['body-no-unverified-mw', !/verifiedSourceCast === 'mw' \|\| work\.man/.test(app) && !/sourceCast === 'ww' \? 'ww'/.test(app)],
    ['cache-verify', /app\.js\?v=20260916verify/.test(html) && (html.match(/app\.js\?v=/g) || []).length === 1],
  ]
  const bad = checks.filter(([, ok]) => !ok).map(([k]) => k)
  if (bad.length) failed += 1
  console.log(`${bad.length ? 'FAIL' : 'ok  '} cast/verified-mw${bad.length ? '  missing=' + bad.join(',') : ''}`)
}

console.log(failed ? `\n${failed} wire(s) broken` : '\nall wires connected')
process.exit(failed ? 1 : 0)
