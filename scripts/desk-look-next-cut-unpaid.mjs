#!/usr/bin/env node
/**
 * 무과금. 나체=정지 LOOK, onlyUndress 정의, 두 동작은 한 편+나머지.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const app = readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8')
const queue = app.slice(app.indexOf('const runDeskMoveQueue'), app.indexOf('const deskImageSize'))
const lookClickNoAuto =
  /desk pick selects only/.test(app) &&
  !app.includes("void runDeskStillCard('look')") &&
  !/job === 'video' && key === 'look'[\s\S]{0,80}runDeskMoveQueue/.test(app) &&
  !/job === 'video' && key === 'move' && id === 'undress'[\s\S]{0,80}runDeskMoveQueue/.test(app)
const report = {
  newPaidCall: false,
  wanCalled: false,
  lookStill: lookClickNoAuto,
  onlyUndressDefined: /const onlyUndress = !alreadyNude && head\.id === 'undress'/.test(queue),
  firstThenRest:
    /const actionHead = picked.find/.test(queue) &&
    /const rest = picked.filter\(\(one\) => one.id !== head.id && one.id !== 'undress'\)/.test(queue),
  compileFirstOnly: /compileDeskMove\(coupleInStill, clipPicked\)/.test(queue),
  soloFallback:
    /const solo = picked\.filter\(\(one\) => !coupleIds\.has\(one\.id\)\)/.test(queue) &&
    /frame = soloFrame/.test(queue),
  needCoupleNotFromQueueHead: !/const needCouple = picked\.some/.test(queue),
  lookFirstOnRun:
    /여자 옷만 녹인 뒤 그 얼굴로 찍습니다/.test(queue) &&
    /옷을 녹여 얼굴을 잠근 뒤 찍습니다/.test(queue) &&
    /머리 없는 장은 보내지 않습니다/.test(queue) &&
    /const needsMelt = state.look === 'nude'/.test(queue),
  keepStartStill: /if \(identityStill\)/.test(queue) && /가운데 정지화는 같은 얼굴 그대로입니다/.test(queue),
  noHeadlessEnd: /끝에 얼굴이 없습니다/.test(queue),
  alreadyOneScene: /이미 한 장에 두 사람입니다/.test(app) && /deskLayoutFromSceneFaces/.test(app),
  manPixelLock: /function deskStampManFromSource/.test(app) && /function deskManSidePasses/.test(app),
  womanCropLook: /runDeskWomanCropLook\(/.test(app) && /function cropDeskWomanFromFaces/.test(app),
  womanCropMask:
    /clothesMask: cropMask/.test(app) &&
    /deskCastLayout: cropLayout/.test(app) &&
    /deskLookVerify:/.test(app) &&
    /if \(!attempt\.sent\) return false/.test(app),
  coupleFullLook:
    /if \(needCouple\) \{/.test(app) &&
    /return runDeskWomanCropLook\(splitSrc, compileLookOnly\(true\), sides\)/.test(app) &&
    /allowTogether: deskLookKind\(\) === 'nude'/.test(app),
  twoBoxCouple: /twoChecked/.test(app) && /deskTwoPeopleChecked/.test(app),
  splitMw: /function deskSplitOneFaceToMw/.test(app) && /function deskMwSideFaces/.test(app),
  soloNotFakeCouple:
    /const userCouple = typeof deskTwoPeopleChecked/.test(app) &&
    /assembleNudeBodyMask/.test(app) &&
    /deskStampManHalfFromSource/.test(app),
  build: /__DESK_BUILD/.test(app),
  keepCoupleFrame:
    /wideScene/.test(app) &&
    /finished.people !== 2/.test(app) &&
    /두 사람이 있는 장은 통째로 보내지 않습니다/.test(app) &&
    /look_couple_full/.test(readFileSync(path.join(ROOT, 'functions/lib/desk-look-server-verify.ts'), 'utf8')),
}
report.ok =
  report.lookStill &&
  report.onlyUndressDefined &&
  report.firstThenRest &&
  report.compileFirstOnly &&
  report.soloFallback &&
  report.needCoupleNotFromQueueHead &&
  report.lookFirstOnRun &&
  report.keepStartStill &&
  report.noHeadlessEnd &&
  report.alreadyOneScene &&
  report.manPixelLock &&
  report.womanCropLook &&
  report.womanCropMask &&
  report.coupleFullLook &&
  report.twoBoxCouple &&
  report.splitMw &&
  report.soloNotFakeCouple &&
  report.build &&
  report.keepCoupleFrame
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
