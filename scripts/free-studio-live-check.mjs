#!/usr/bin/env node
/** 무과금. 자유 스튜디오 조각이 운영에 실제로 올라갔는지 본다. */
const BASE = process.argv[2] || 'https://storymag.mindstory.kr'

const html = await (await fetch(BASE + '/')).text()
const version = (html.match(/app\.js\?v=([0-9a-zA-Z]+)/) || [])[1] || ''
const js = await (await fetch(`${BASE}/app.js?v=${version}`)).text()
const freeJsTag = (html.match(/free-studio\.js\?v=([0-9a-zA-Z]+)/) || [])[1] || ''
const freeJs = freeJsTag ? await (await fetch(`${BASE}/free-studio.js?v=${freeJsTag}`)).text() : ''

const checks = [
  ['탭 단추가 HTML 에 있음', html.includes('id="app-area-free"')],
  ['탭 칸(panel)이 HTML 에 있음', html.includes('id="free-area"')],
  ['free-studio.js 실림', Boolean(freeJsTag)],
  ['free-studio.js 내용 받아짐', freeJs.includes("composeMode: 'free-still'")],
  ['APP_AREAS 에 free 등록', /APP_AREAS = \[[^\]]*'free'/.test(js)],
  ['관리자일 때 탭 보이기 배선', js.includes("getElementById('app-area-free')")],
  ['free 칸 숨김/보임 배선', js.includes("area !== 'free'")],
]

let bad = 0
console.log(`app.js v = ${version} · free-studio.js v = ${freeJsTag || '(없음)'}`)
for (const [name, ok] of checks) {
  if (!ok) bad += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
}
console.log(bad ? `\n${bad}건 반영 안 됨` : '\n전부 반영됨')
process.exit(bad ? 1 : 0)
