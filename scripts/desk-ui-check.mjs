import { chromium } from 'playwright-core'
const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.goto('https://storymag.pages.dev', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(2500)
console.log('build', await p.evaluate(() => window.__DESK_BUILD))
console.log('places el', await p.evaluate(() => !!document.getElementById('desk-places')))
for (const w of ['호텔', '침실', '욕실', '거실', '복도', '야경', '스튜디오']) console.log(w, await p.locator('.desk-card', { hasText: w }).count())
console.log('errors', JSON.stringify(errs))
await b.close()
