#!/usr/bin/env node
/** 무과금. 운영 도메인이 '옷 갈아입히기' 개편과 실루엣 검사를 실제로 주는지 본다. */
const BASE = process.argv[2] || 'https://storymag.mindstory.kr'

const html = await (await fetch(BASE + '/')).text()
const version = (html.match(/app\.js\?v=([0-9a-zA-Z]+)/) || [])[1] || ''
const js = await (await fetch(`${BASE}/app.js?v=${version}`)).text()

const checks = [
  ['단추 이름이 옷 갈아입히기', html.includes('>옷 갈아입히기<')],
  ['카드 이름이 옷 갈아입히기', js.includes("label: '옷 갈아입히기'")],
  ['프롬프트용 옷 이름 분리', js.includes("garment: '실크 슬립 원피스'")],
  ['동작 이름이 고른 칸을 따름', js.includes('const deskLookNoun =')],
  ['녹이기 문구가 갈아입히기에 안 붙음', !js.includes('옷만 슬립 한 겹으로 바꾼다')],
  ['VTON 에서도 몸 실루엣 검사', js.includes("why !== 'mask_seam'")],
]

let bad = 0
console.log(`app.js v = ${version}`)
for (const [name, ok] of checks) {
  if (!ok) bad += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
}
console.log(bad ? `\n${bad}건 반영 안 됨` : '\n전부 반영됨')
process.exit(bad ? 1 : 0)
