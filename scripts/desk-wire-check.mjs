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
      ? '원본을 그 자리에서만 고친다. 여 칸에서 온 사람만 옷을 녹여 나체. 남 칸에서 온 사람은 그대로. 위치 추측 금지. 여여·성별 바꾸기·새 얼굴 금지.'
      : `원본을 그 자리에서만 고친다. 여 칸에서 온 사람만 옷을 ${look}으로 녹인다. 남 칸에서 온 사람은 그대로. 위치 추측 금지. 여여·성별 바꾸기·새 얼굴 금지.`
  }
  if (nude) {
    return '원본을 그 자리에서만 고친다. 얼굴·머리·몸매·자세·방 유지. 옷을 녹여 나체. 팬티 없음. 새 사람·흰 스튜디오·마른 화보 모델 금지.'
  }
  if (lookId === 'silk') {
    return '원본을 그 자리에서만 고친다. 얼굴·머리·몸매·자세·방 유지. 옷만 얇은 실크 슬립 한 장 노브라로 녹인다. 팬티 따로 없음. 새 사람·흰 스튜디오·화보 모델 금지.'
  }
  return `원본을 그 자리에서만 고친다. 얼굴·머리·몸·자세·구도 유지. 옷만 ${look}으로 녹인다. 새 사람·흰 스튜디오·화보 모델 금지.`
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
  ['look/nude-couple', 'look', compileLook('nude', true), true, { engine: true, do: /\[DO\] Edit in place/, panty: /panty OFF/, pubic: /Korean-30s pubic/, black: /FAILED black panty/, man: /CAST man-slot/, apart: /FORBIDDEN two women/, her: /CAST woman-slot/ }],
  ['look/nude-solo', 'look', compileLook('nude', false), false, { engine: true, do: /\[DO\] Edit in place/, panty: /panty OFF/, studio: /white studio/, face: /same source face/, thong: /ZERO thong/ }],
  // 슬립은 옷 갈아입히기다. 나체 문구가 섞이면 엔진이 몸을 다시 그린다.
  ['look/slip-solo', 'look', compileLook('silk', false), false, { engine: true, do: /\[DO\] Edit in place/, swap: /change her outfit to one silk slip dress/i, body: /Keep her own shoulder width, waist and hips/i, noNude: /FORBIDDEN[^[]*nudity/i, hem: /hem below the knee/i }],
  ['look/jeans-solo', 'look', compileLook('jeans', false), false, { engine: false, do: /\[DO\] Edit source in place/ }],
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
const zipNude = '남자 바지 지퍼만 손으로 내린다. 여자는 나체 유지. 여자 배·피부·가랑이에 지퍼·솔기 금지. 자지 금지. 같은 두 얼굴. 원본 구도 유지.'
const wan = [
  ['wan/undress-couple', undressCouple, { ww: false, nude: true, manKeep: true }],
  ['wan/melt-nude', meltNude, { nude: true, manKeep: true }],
  ['wan/hug', hugMove, { nude: false }],
  ['wan/zipper-nude', zipNude, { zipperHis: true, noBodyZip: true }],
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
  const zipperHis = /HIS (?:pants )?zipper/i.test(p)
  const noBodyZip = /FORBIDDEN a zipper.*(?:her|belly|skin|crotch)/i.test(p)
  const bad = [
    over && 'over1500',
    want.ww === false && ww && '여여',
    want.nude && !panty && 'no-panty-line',
    want.manKeep && !manKeep && 'man-clothes',
    want.zipperHis && !zipperHis && 'no-his-zipper',
    want.noBodyZip && !noBodyZip && 'no-body-zip-forbid',
    want.noBodyZip && !/BOTH heads/i.test(p) && 'no-heads-lock',
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
  const inPlace = /Edit(?: source)? in place/i.test(p)
  const preserveHim = /CAST man-slot/i.test(p)
  const editHer = /CAST woman-slot/i.test(p)
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

{
  const kissP = m.buildDeskStillPrompt(
    '다음 컷 정지 화보. 키스. 원본 남자가 원본 여자와 입맞춤. 여여 키스 금지.',
    true,
    'cut',
  )
  const bad = [
    !/Source MAN kisses source WOMAN/i.test(kissP) && 'man-kiss',
    !/FORBIDDEN two women/i.test(kissP) && 'no-ww',
    kissP.length > m.DESK_STILL_PROMPT_MAX && 'over',
  ].filter(Boolean)
  if (bad.length) failed += 1
  console.log(`${bad.length ? 'FAIL' : 'ok  '} cut/kiss-mw  ${kissP.length}c${bad.length ? '  missing=' + bad.join(',') : ''}`)
}

{
  const kissNude = m.buildDeskStillPrompt(
    '다음 컷 정지 화보. 키스. 원본 남자가 원본 여자와 입맞춤. 여자는 완전 나체. 브라·팬티 없음. 여여 키스 금지.',
    true,
    'cut',
  )
  const bad = [
    !/LEFT=source MAN stays male/i.test(kissNude) && 'man-left',
    !/fully nude/i.test(kissNude) && 'her-nude',
    !/panty OFF/i.test(kissNude) && 'panty',
    !/FORBIDDEN two women/i.test(kissNude) && 'no-ww',
    kissNude.length > m.DESK_STILL_PROMPT_MAX && 'over',
  ].filter(Boolean)
  if (bad.length) failed += 1
  console.log(`${bad.length ? 'FAIL' : 'ok  '} cut/kiss-nude-mw  ${kissNude.length}c${bad.length ? '  missing=' + bad.join(',') : ''}`)
}

{
  const kissNudeHint = m.buildDeskStillPrompt('키스', true, 'cut', {
    look: 'nude',
    action: 'kiss',
    couple: true,
  })
  const intent = m.parseDeskIntent('키스', false, 'cut', { look: 'nude', action: 'kiss', couple: true })
  const soloIntent = m.parseDeskIntent('키스', true, 'look', { look: 'nude', action: 'none', couple: false })
  const bad = [
    intent.look !== 'nude' && 'intent-look',
    intent.action !== 'kiss' && 'intent-action',
    intent.couple !== true && 'intent-couple',
    soloIntent.couple !== false && 'solo-wins',
    !/LEFT=source MAN stays male/i.test(kissNudeHint) && 'man-left',
    !/fully nude/i.test(kissNudeHint) && 'her-nude',
    !/FORBIDDEN two women/i.test(kissNudeHint) && 'no-ww',
    kissNudeHint.length > m.DESK_STILL_PROMPT_MAX && 'over',
  ].filter(Boolean)
  if (bad.length) failed += 1
  console.log(`${bad.length ? 'FAIL' : 'ok  '} intent/kiss-nude-hints  ${kissNudeHint.length}c${bad.length ? '  missing=' + bad.join(',') : ''}`)
}

console.log('')
console.log('CAST lock — 미검증 mw 금지, 여여 금지')
{
  const { readFileSync } = await import('node:fs')
  const app = readFileSync(path.join(ROOT, 'public/app.js'), 'utf8')
  const html = readFileSync(path.join(ROOT, 'public/index.html'), 'utf8')
  const css = readFileSync(path.join(ROOT, 'public/style.css'), 'utf8')
  const lock = app.slice(app.indexOf('function deskLockedCast'), app.indexOf('function deskCastUnverified'))
  const kontext = app.slice(app.indexOf('const runDeskKontextStep'), app.indexOf('const setDeskStillBusy'))
  const look = app.slice(app.indexOf('const runDeskStepLook'), app.indexOf('const runDeskStepPlace'))
  const lookOnly = app.slice(app.indexOf('const compileLookOnly'), app.indexOf('const compilePlaceOnly'))
  const tale = readFileSync(path.join(ROOT, 'functions/api/tale-scene.ts'), 'utf8')
  const checks = [
    ['lock-mw-only', /w\.verifiedSourceCast === 'mw'/.test(lock) && !/sourceCast === 'ww'/.test(lock)],
    ['lock-no-infer-pair', !/storedPair \|\| \(bothSlots/.test(lock)],
    ['kontext-send-mw', /sourcePeople >= 2 \? 'mw'/.test(kontext)],
    ['kontext-no-gender-fallback', !/gender0 \|\| 'female'/.test(kontext) && !/genders\[0\] \|\| 'female'/.test(kontext)],
    ['kontext-lock-mw-scene', /deskLockMwWomanScene/.test(kontext)],
    ['look-lock-mw-scene', /castLayout/.test(look) && /DeskLookRuntime/.test(look) && /runDeskLookPreflight/.test(look)],
    ['look-no-clear-mw', !/verifiedSourceCast: ''/.test(look)],
    ['no-abort-copy', !/구성을 확인하지 못해/.test(app)],
    ['pair-face-lock', /function deskScenePairFacePhotos/.test(app)],
    ['look-no-oval-paste', !/preferPaste: pairPhotos.length === 1/.test(app)],
    ['look-no-right-guess', !/cropTry/.test(look) && /clothesMask/.test(look) && /deskLayoutLinked/.test(look)],
    ['look-clear-leftover-man', /castLayout: null/.test(app)],
    ['woman-crop-unused-in-look', !/runDeskWomanCropLook\(/.test(look)],
    ['no-look-paid-retry', /adultStill && deskStep === 'cut'/.test(app) && !/adultStill && \(deskStep === 'cut' \|\| deskStep === 'look'\)/.test(app)],
    ['look-run-hidden', /id="desk-look-run"[^>]*\bhidden\b/.test(html) && /id="desk-place-run"[^>]*\bhidden\b/.test(html)],
    ['look-auto-card', /void runDeskStillCard\(key\)/.test(app) && !/armDeskPickGuard/.test(app)],
    ['look-no-confirm-gate', !/look_button_required/.test(tale)],
    ['look-confirm-client', /deskLook,/.test(app) && /deskCouple:/.test(app)],
    ['solo-look-keep', /deskStillPasses/.test(kontext) && !/applyDeskWorkFaces/.test(kontext)],
    ['move-nude-undress', /ensureDeskNudeMove/.test(app) && /pinDeskMoveCast/.test(app) && /key === 'look' && id === 'nude'/.test(app)],
    ['move-kiss-nude-mw', /여자는 완전 나체/.test(app) && /여여 키스 금지/.test(app)],
    // 버전 문자열은 배포마다 바뀐다. 특정 값이 아니라 캐시 무력화가 걸려 있는지만 본다.
    ['cache-verify', (html.match(/app\.js\?v=/g) || []).length === 1],
    ['look-parse-scripts', /desk-look-models\.js\?v=/.test(html) && /desk-look-preflight\.js\?v=/.test(html) && /desk-look-onnx\.js/.test(html) && /desk-look-runtime\.js/.test(html) && /onnxruntime-web/.test(html)],
    ['look-inpaint', /fal-look-inpaint/.test(tale) && /verifyLookInpaintPayload/.test(tale) && /look_mask_required/.test(readFileSync(path.join(ROOT, 'functions/lib/desk-look-server-verify.ts'), 'utf8')) && /look_model_sha/.test(readFileSync(path.join(ROOT, 'functions/lib/desk-look-server-verify.ts'), 'utf8')) && /look_inpaint_failed/.test(tale) && !/rightHalfOnly: intent.couple/.test(tale)],
    ['look-no-rect-fallback', !/buildWomanClothesMaskDataUrl/.test(look) && !/SEG_LOCAL/.test(readFileSync(path.join(ROOT, 'public/desk-look-onnx.js'), 'utf8')) && !/resolve\/main\//.test(readFileSync(path.join(ROOT, 'public/desk-look-onnx.js'), 'utf8'))],
    ['look-mask-too-small', /mask_too_small/.test(look) && /MASK_MIN_WHITE/.test(readFileSync(path.join(ROOT, 'functions/lib/desk-clothes-parse.ts'), 'utf8'))],
    ['look-no-luma-cast', /embedCast/.test(app.slice(app.indexOf('async function captureDeskCastLock'), app.indexOf('function deskFaceInSlot'))) && !/deskFaceDescriptor/.test(app.slice(app.indexOf('async function captureDeskCastLock'), app.indexOf('function deskFaceInSlot')))],
    ['look-no-face-stamp', /deskStillPasses/.test(app) && !/deskStep !== 'look' && typeof applyDeskWorkFaces/.test(app)],
    ['look-no-woman-stamp', !/desk woman crop face stamp failed/.test(app)],
    ['look-validate', /function deskStillPasses/.test(app) && /reason: 'undetected'/.test(app) && /reason: 'embed'/.test(app) && /reason: 'protect'/.test(app) && /reason: 'clothes_goal'/.test(app) && /reason: 'silhouette'/.test(app) && /reason: 'mask_seam'/.test(app)],
    ['look-undetected-fail', /if \(!outBoxes \|\| !outBoxes.length\) return \{ ok: false, reason: 'undetected' \}/.test(app)],
    ['look-no-click-guard', !/deskPickGuardUntil/.test(app) && !/#desk-still-packs\.is-off \[data-desk-pick\][\s\S]{0,120}pointer-events:\s*none/.test(css)],
    ['look-composite', /function compositeDeskClothesResult/.test(app) && /protectIdentical/.test(kontext) && /clothesMaskFull/.test(look)],
    // 옷이 안 바뀐 것(clothes_goal)만 한 번 더 뽑는다. 이음매·실루엣은 다시 뽑아도 같다.
    ['look-retry-once', /deskStep === 'place' \|\|\s*\(deskStep === 'look' && \(lookRetryOk\[gate\.reason\] \|\| lookVisualRetryOk\[gate\.reason\]\)\)/.test(kontext)],
    ['look-no-visual-retry', /const lookRetryOk = \{ protect: 1/.test(kontext) && !/lookRetryOk = \{[^}]*clothes_goal/.test(kontext)],
    ['look-visual-gate', /function deskLookVisualPasses/.test(app) && /gateLookVisual/.test(app) && /clothes_regions/.test(app) && /WHITE_MAD_MIN/.test(readFileSync(path.join(ROOT, 'functions/lib/desk-look-visual-gate.ts'), 'utf8')) && /BODY_CRUSH_RATIO/.test(readFileSync(path.join(ROOT, 'functions/lib/desk-look-visual-gate.ts'), 'utf8')) && /change_only/.test(readFileSync(path.join(ROOT, 'functions/lib/desk-look-visual-gate.ts'), 'utf8'))],
    ['cast-ids', /function captureDeskCastLock/.test(app) && /womanCastId/.test(app) && /castId/.test(app)],
    ['mask-invade', /reason: 'mask_invade'/.test(app)],
    ['no-right-sort-gate', /function deskFaceInSlot/.test(app) && !/srcSorted = srcBoxes.slice\(\)\.sort\(\(a, b\) => a\.x - b\.x\)/.test(app)],
    ['body-no-unverified-mw', !/verifiedSourceCast === 'mw' \|\| work\.man/.test(app) && !/sourceCast === 'ww' \? 'ww'/.test(app)],
    ['frame-resolver', /function resolveDeskFrame/.test(app) && /from === 'scene'/.test(app)],
    ['move-compiler', /const compileDeskMove/.test(app) && /replace\(\/옷은 그대로/.test(app)],
    ['look-only-faces', /coupleInScene === true/.test(lookOnly) && !/deskTwoPeopleChecked/.test(lookOnly)],
    ['intent-payload', /deskLook,/.test(app) && /deskCouple:/.test(app) && /deskAction/.test(app)],
    ['pin-keeps-scene', /currentResult\?\.imageUrl \|\| work\.scene/.test(app)],
    ['server-no-regex-couple', !/두\\s\*주연이 함께/.test(tale)],
  ]
  const bad = checks.filter(([, ok]) => !ok).map(([k]) => k)
  if (bad.length) failed += 1
  console.log(`${bad.length ? 'FAIL' : 'ok  '} cast/verified-mw${bad.length ? '  missing=' + bad.join(',') : ''}`)
}

console.log(failed ? `\n${failed} wire(s) broken` : '\nall wires connected')
process.exit(failed ? 1 : 0)
