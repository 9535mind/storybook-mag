#!/usr/bin/env node
/** 무과금. 거부 문구에 숫자가 붙는 빌드가 운영에 떠 있는지. */
const BUILD = process.argv[2] || '20260920why'
const cb = Date.now()
const app = await (await fetch(`https://storymag.mindstory.kr/app.js?v=${BUILD}&cb=${cb}`)).text()
const html = await (await fetch(`https://storymag.mindstory.kr/index.html?cb=${cb}`)).text()
const out = {
  newPaidCall: false,
  htmlApp: html.includes(`app.js?v=${BUILD}`),
  build: (app.match(/__DESK_BUILD = '([^']+)'/) || [])[1] || null,
  detailFn: app.includes('function deskVisualDetail'),
  seamDetail: app.includes('(한도 1.05)'),
  passesSeamDetail: app.includes("reason: 'mask_seam', detail"),
  onScreen: app.includes('setFormStatus(gate.detail ?'),
  gateLog: app.includes('desk look gate'),
  toneFix: app.includes('if (ringN >= 64)'),
}
out.ok = Object.entries(out)
  .filter(([k]) => !['newPaidCall', 'build', 'ok'].includes(k))
  .every(([, v]) => v === true)
console.log(JSON.stringify(out, null, 2))
process.exit(out.ok ? 0 : 1)
