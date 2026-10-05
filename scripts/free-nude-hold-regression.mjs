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
const holdSrc = client.match(/const holdNude = \(text, couple\) => \{[\s\S]*?\n  \}/)
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
  if (!out.includes('이미 완전 나체 유지.')) fails.push(`"${before}" → 나체 유지 머리말 없음: ${out}`)
  if (!/No zoom/.test(out)) fails.push(`"${before}" → 줌 금지가 없음: ${out}`)
  if (!out.includes(afterCore)) fails.push(`"${before}" → 동작이 사라짐: ${out}`)
  const rest = out.replace('이미 완전 나체 유지.', '').replace(/Same face, same glasses\. No zoom\.\s*/, '')
  if (/나체로|알몸|누드로|옷을 벗/.test(rest)) {
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

const lockBundle = path.join(ROOT, '_tmp_bundle', 'free-self-breast.cjs')
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/free-self-breast.ts" --bundle --platform=node --format=cjs --outfile="${lockBundle}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const { applyFreeSelfBreastLock, isFreeSelfBreastMotion } = await import(`file://${lockBundle}?t=${Date.now()}`)

const selfMotion = holdNude('나체로 자기 가슴 만지기')
if (!/her own hands knead/i.test(selfMotion)) {
  fails.push(`holdNude 자기가슴에 본인 손이 없음: ${selfMotion}`)
}
if (!/자기 가슴 만지기/.test(selfMotion)) {
  fails.push(`holdNude 자기가슴 원문이 사라짐: ${selfMotion}`)
}
const kissHold = holdNude('나체로 키스하면서 가슴 만지기')
if (/her own hands knead/i.test(kissHold)) {
  fails.push(`키스+가슴에 자기손 잠금이 붙으면 안 됨: ${kissHold}`)
}

const FREE_CAM =
  'WIDE SHOT LOCK: exact source framing every frame. Head and shoulders stay visible. Never zoom. Never a waist-down only crop. Never a chest-only crop. '
const fitWan = (promptLocked) => {
  const next = `${FREE_CAM}${promptLocked}`
  if (next.length <= 1500) return next
  const budget = 1500 - FREE_CAM.length
  const body = promptLocked.slice(0, Math.max(0, budget))
  const cut = body.lastIndexOf('.')
  return `${FREE_CAM}${(cut > 400 ? body.slice(0, cut + 1) : body).trim()}`
}

for (const people of [1, 2]) {
  const raw = policy.buildAnimationPrompt({
    motion: selfMotion,
    durationSec: 15,
    sourcePeople: people,
    genMode: 'fashion',
  })
  const locked = applyFreeSelfBreastLock(raw, selfMotion)
  const sent = fitWan(locked)
  if (/consenting adult partner/i.test(locked) && /his hand/i.test(locked)) {
    fails.push(`people=${people} 자기가슴이 파트너 손으로 남음`)
  }
  if (!/her own hands knead/i.test(locked)) {
    fails.push(`people=${people} BEAT2 에 본인 두 손이 없음:\n${locked}`)
  }
  if (/a hand continuously/i.test(locked)) {
    fails.push(`people=${people} 모호한 "a hand" 가 남음`)
  }
  if (!/LAST FRAME:.*her own hands still kneading/i.test(locked)) {
    fails.push(`people=${people} 마지막 프레임이 자기 손이 아님`)
  }
  if (!/her own hands knead/i.test(sent)) {
    fails.push(`people=${people} 1500자 자른 뒤 본인 손이 잘림 (${sent.length}자)`)
  }
}

const coupleBundle = path.join(ROOT, '_tmp_bundle', 'free-couple-lock.cjs')
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/free-couple-lock.ts" --bundle --platform=node --format=cjs --outfile="${coupleBundle}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const coupleLib = await import(`file://${coupleBundle}?t=${Date.now()}`)
const kissMotion = holdNude('나체로 키스하고 여자의 가슴을 만진다', true)
if (!/Same two faces/.test(kissMotion)) fails.push(`커플 holdNude 에 두 얼굴이 없음: ${kissMotion}`)
if (!/Mouth-to-mouth kiss/.test(kissMotion)) fails.push(`커플 holdNude 에 키스가 없음: ${kissMotion}`)
if (!/His hand on her bare breast/.test(kissMotion)) fails.push(`커플 holdNude 에 가슴 손이 없음: ${kissMotion}`)
if (/her own hands knead/i.test(kissMotion)) fails.push(`커플 키스에 자기손이 붙음: ${kissMotion}`)
const kissOnlyHold = holdNude('나체로 키스한다', true)
if (/His hand on her bare breast/.test(kissOnlyHold)) {
  fails.push(`키스만인데 가슴 손이 붙음: ${kissOnlyHold}`)
}
if (!/Mouth-to-mouth kiss/.test(kissOnlyHold)) fails.push(`키스만 holdNude 에 입맞춤이 없음: ${kissOnlyHold}`)
if (coupleLib.isFreeCoupleIntimateMotion('나체로 키스하고 여자의 가슴을 만진다') !== true) {
  fails.push('키스+여자가슴을 커플 동작으로 못 본다')
}
if (isFreeSelfBreastMotion('나체로 키스하고 여자의 가슴을 만진다')) {
  fails.push('키스+여자가슴을 자기손으로 오인')
}
const kissRaw = build(kissMotion)
const kissLocked = coupleLib.applyFreeCoupleIntimateLock(kissRaw, '나체로 키스하고 여자의 가슴을 만진다')
const kissCam = coupleLib.FREE_COUPLE_CAM
const kissSent = (() => {
  const next = `${kissCam}${kissLocked}`
  if (next.length <= 1500) return next
  const budget = 1500 - kissCam.length
  const body = kissLocked.slice(0, Math.max(0, budget))
  const cut = body.lastIndexOf('.')
  return `${kissCam}${(cut > 400 ? body.slice(0, cut + 1) : body).trim()}`
})()
if (!/CAST LOCK/.test(kissSent)) fails.push('커플 CAST 잠금이 없음')
if (!/bathroom/.test(kissSent)) fails.push('욕실 금지가 없음')
if (!/mouth-to-mouth kisses[\s\S]*hand stays on her bare breast/i.test(kissSent)) {
  fails.push(`커플 BEAT2 키스+가슴이 없음/잘림 (${kissSent.length}자)\n${kissSent}`)
}
if (/Same Korean woman:/.test(kissLocked)) fails.push('커플 프롬프트가 여자 혼자다')
if (/Head and shoulders stay visible/.test(kissSent)) fails.push('솔로 머리어깨 카메라가 커플에 남음')

const kissOnlyLocked = coupleLib.applyFreeCoupleIntimateLock(
  build(holdNude('나체로 키스한다', true)),
  '나체로 키스한다',
)
if (/hand stays on her bare breast/i.test(kissOnlyLocked)) {
  fails.push('키스만에 가슴 손이 BEAT2 로 붙음')
}
if (!/mouth-to-mouth kisses/i.test(kissOnlyLocked)) fails.push('키스만에 입맞춤 BEAT2 가 없음')

if (coupleLib.isFreeBreastKissMotion('나체로 가슴에 키스한다') !== true) {
  fails.push('가슴에 키스를 가슴키스 동작으로 못 본다')
}
if (coupleLib.isFreeBreastKissMotion('키스하고 여자의 가슴을 만진다') === true) {
  fails.push('입맞춤+가슴 만지기를 가슴키스로 오인')
}
const oralHold = holdNude('나체로 가슴에 키스한다', true)
if (!/His mouth stays on her bare breast|mouth stays on her bare breast/i.test(oralHold)) {
  fails.push(`가슴키스 holdNude 에 입으로 가슴이 없음: ${oralHold}`)
}
if (/Mouth-to-mouth kiss/.test(oralHold) && !/His mouth stays on her bare breast/.test(oralHold)) {
  fails.push('가슴키스 holdNude 가 입-입으로만 간다')
}
const oralLocked = coupleLib.applyFreeCoupleIntimateLock(
  build(oralHold),
  '나체로 가슴에 키스한다',
)
if (!/kisses her bare breast with his mouth/i.test(oralLocked)) {
  fails.push(`가슴키스 BEAT2 가 없음:\n${oralLocked}`)
}
if (/FORBIDDEN kissing her breast/i.test(oralLocked)) {
  fails.push('가슴키스인데 가슴 입맞춤을 금지한다')
}
const oralSent = (() => {
  const cam = coupleLib.FREE_BREAST_KISS_CAM
  const next = `${cam}${oralLocked}`
  if (next.length <= 1500) return next
  const budget = 1500 - cam.length
  const body = oralLocked.slice(0, Math.max(0, budget))
  const cut = body.lastIndexOf('.')
  return `${cam}${(cut > 400 ? body.slice(0, cut + 1) : body).trim()}`
})()
if (!/Intimate chest two-shot/i.test(oralSent)) fails.push('가슴키스 카메라가 가슴 투샷이 아님')
if (!/kisses her bare breast with his mouth/i.test(oralSent)) {
  fails.push(`가슴키스 동작이 1500자에서 잘림 (${oralSent.length}자)`)
}

const fromPhoto = coupleLib.buildFreeCoupleVideoPrompt('나체로 가슴에 키스한다')
if (!/East-Asian Korean/i.test(fromPhoto)) fails.push('커플 영상 프롬프트에 한국인 얼굴 잠금이 없음')
if (!/Caucasian/i.test(fromPhoto)) fails.push('커플 영상 프롬프트에 서양인 금지가 없음')
if (!/mouth stays on her bare breast/i.test(fromPhoto)) fails.push('커플 영상 프롬프트에 가슴 입맞춤이 없음')
if (/already fully nude/i.test(fromPhoto)) fails.push('옷 입은 원본인데 이미 나체라고 거짓말함')
if (fromPhoto.length > 1500) fails.push(`커플 영상 프롬프트가 ${fromPhoto.length}자`)

const fromNudeStill = coupleLib.buildFreeCoupleVideoPrompt(holdNude('나체로 가슴에 키스한다', true), {
  alreadyNude: true,
})
if (!/already fully nude/i.test(fromNudeStill)) fails.push('나체 장 쇼츠가 이미 나체를 유지하지 않음')
if (/She becomes fully nude/i.test(fromNudeStill)) fails.push('나체 장인데 다시 벗기라고 함')

if (fails.length) {
  console.error('FAIL\n' + fails.map((f) => ` - ${f}`).join('\n'))
  process.exit(1)
}
console.log(`nude-hold ok · 통짜 ${before.length}자(8초 탈의) → 고침 ${after.length}자(탈의 걸음 없음)`)
