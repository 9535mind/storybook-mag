#!/usr/bin/env node
/** ???. ??? ? ???? ? ?? ??? ?????? ??. */
const BUILD = process.argv[2] || '20260920fence'
const u = 'https://storymag.mindstory.kr'
const cb = Date.now()
const get = async (p) => (await fetch(`${u}${p}${p.includes('?') ? '&' : '?'}cb=${cb}`)).text()
const html = await get('/index.html')
const pf = await get(`/desk-look-preflight.js?v=${BUILD}`)
const app = await get(`/app.js?v=${BUILD}`)
const out = {
  newPaidCall: false,
  htmlPreflight: html.includes(`desk-look-preflight.js?v=${BUILD}`),
  htmlApp: html.includes(`app.js?v=${BUILD}`),
  build: (app.match(/__DESK_BUILD = '([^']+)'/) || [])[1] || null,
  faceHairLocked: pf.includes('lab === "Sunglasses") continue'),
  garmentLike: pf.includes('garmentLike'),
  skinGuard: pf.includes('!skinHere'),
  scaledRadius: pf.includes('scaledRadius'),
  clothesBBox: pf.includes('clothesBBox'),
  seamHeal: app.includes('if (outL > 78 || srcL < 120 || srcL < outL + 28) continue'),
  soloFallback: app.includes('\uB450 \uC0AC\uB78C\uC774 \uD544\uC694\uD574 \uBE90\uC2B5\uB2C8\uB2E4'),
  lookRowTwo:
    /const looks = \[\s*\{ id: 'silk'[^\]]*\{ id: 'nude'[^\]]*\]/s.test(app) && !app.includes("id: 'dress'"),
}
out.ok = Object.entries(out)
  .filter(([k]) => k !== 'newPaidCall' && k !== 'build' && k !== 'ok')
  .every(([, v]) => v === true)
console.log(JSON.stringify(out, null, 2))
process.exit(out.ok ? 0 : 1)
