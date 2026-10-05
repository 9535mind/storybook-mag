#!/usr/bin/env node
/** 무과금. 운영 app.js에 지금 고친 배선이 실제로 올라갔는지. */
const BASE = process.env.BASE || 'https://storymag.mindstory.kr'
const v = process.env.V || '20260919next'
const text = await (await fetch(`${BASE}/app.js?v=${v}`, { cache: 'no-store' })).text()
const lines = text.split('\n')
const report = {
  bytes: text.length,
  build: (text.match(/__DESK_BUILD = '([^']+)'/) || [])[1] || '',
  nudeGoesStill: text.includes("void runDeskStillCard('look')"),
  pickSelectsOnly: /desk pick selects only/.test(text),
  nudeGoesShorts: /key === 'look' && id === 'nude'\)\s*\{\s*void runDeskMoveQueue/.test(text),
  onlyUndress: text.includes("const onlyUndress = !alreadyNude && head.id === 'undress'"),
  headRest: text.includes('const [head, ...rest] = picked'),
  shortsLogLine: lines.findIndex((l) => l.includes("console.info('desk shorts'")) + 1,
}
console.log(JSON.stringify(report, null, 2))
