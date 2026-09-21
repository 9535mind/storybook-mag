#!/usr/bin/env node
/** 무과금. 슬립 한 장을 누르기 전, 운영이 내려주는 파일만 확인한다. 클릭·유료 호출 없음. */
const BASE = process.env.BASE || 'https://storymag.mindstory.kr'
const html = await (await fetch(`${BASE}/?ready=1`, { cache: 'no-store' })).text()
const ver = (name) => (html.match(new RegExp(`/${name}\\.js\\?v=([a-z0-9]+)`)) || [])[1] || ''
const get = async (name) => (await (await fetch(`${BASE}/${name}.js?v=${ver(name)}`, { cache: 'no-store' })).text())

const app = await get('app')
const pre = await get('desk-look-preflight')
const onnx = await get('desk-look-onnx')

const report = {
  newPaidCall: false,
  build: (app.match(/__DESK_BUILD = '([^']+)'/) || [])[1] || '',
  lookRow: /id: 'silk'[\s\S]{0,80}id: 'nude'/.test(app) && !/검은 드레스/.test(app),
  slipUsesLeffa: /deskLookKind\(\) === 'silk'/.test(app),
  sleeveOpened: /jacketLike \|\| !isSkinLike\(srcRgba, p\)/.test(pre),
  darkHemOpened: /darkHem/.test(pre),
  seamHealed: /srcL < 120/.test(app),
  maskNearest: /imageSmoothingEnabled = !nearest/.test(app),
  ortSingleThread: /numThreads = 1/.test(onnx),
  soloMoveFallback: /frame = soloFrame/.test(app),
}
report.ok = Object.entries(report)
  .filter(([k]) => k !== 'newPaidCall' && k !== 'build' && k !== 'ok')
  .every(([, v]) => v === true)
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
