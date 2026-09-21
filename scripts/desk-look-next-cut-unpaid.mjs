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
const lookClick = app.includes("state.job === 'video' && key === 'look' && id === 'nude'")
  && app.includes("void runDeskStillCard('look')")
  && !/job === 'video' && key === 'look' && id === 'nude'[\s\S]{0,80}runDeskMoveQueue/.test(app)
const report = {
  newPaidCall: false,
  wanCalled: false,
  lookStill: lookClick,
  onlyUndressDefined: /const onlyUndress = !alreadyNude && head\.id === 'undress'/.test(queue),
  firstThenRest: /const \[head, \.\.\.rest\] = picked/.test(queue) && !/const rest = \[\]/.test(queue),
  compileFirstOnly: /compileDeskMove\(coupleInStill, clipPicked\)/.test(queue),
  soloFallback:
    /const solo = picked\.filter\(\(one\) => !coupleIds\.has\(one\.id\)\)/.test(queue) &&
    /frame = soloFrame/.test(queue),
  needCoupleNotFromQueueHead: !/const needCouple = picked\.some/.test(queue),
  build: /20260920solo/.test(app),
}
report.ok =
  report.lookStill &&
  report.onlyUndressDefined &&
  report.firstThenRest &&
  report.compileFirstOnly &&
  report.soloFallback &&
  report.needCoupleNotFromQueueHead &&
  report.build
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
