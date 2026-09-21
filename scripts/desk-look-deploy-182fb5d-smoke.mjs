#!/usr/bin/env node
/**
 * 182fb5d 제한 배포 후 잔상 게이트 반영·화면 안정만.
 * 슬립 클릭·Claude·fal·Wan 없음.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-deploy-182fb5d')
const BASE = process.env.STORYMAG_BASE || 'https://storymag.mindstory.kr'
const PAGES = process.env.STORYMAG_PAGES || 'https://181eb996.storymag.pages.dev'
mkdirSync(OUT, { recursive: true })

function loadCreds() {
  const note = path.join(ROOT, '핀패스.txt')
  const n = existsSync(note) ? readFileSync(note, 'utf8') : ''
  const pinFromNote = (n.match(/^핀\s+(\S+)/m) || [])[1]?.trim() || ''
  const password = (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim() || ''
  const vars = existsSync(path.join(ROOT, '.dev.vars')) ? readFileSync(path.join(ROOT, '.dev.vars'), 'utf8') : ''
  return {
    pin: pinFromNote || (vars.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim() || '',
    password,
  }
}

function inspectPreflight(text) {
  return {
    hasRemnant: /function regionBoundaryRemnant/.test(text),
    reasonOrder: /VISUAL_REASON_ORDER = \["clothes_goal", "mask_seam", "silhouette"\]/.test(text),
    lumRelKept: /SEAM_LUM_REL_MAX = 1\.05/.test(text) && /SEAM_TEX_MIN = 0\.42/.test(text),
    whiteKept: /WHITE_MAD_MIN = 24/.test(text) && /WHITE_CORR_MAX = 0\.88/.test(text),
    bodyKept: /BODY_CRUSH_RATIO = 0\.82/.test(text),
  }
}

function inspectAppJs(text) {
  return {
    build: (text.match(/__DESK_BUILD\s*=\s*'([^']+)'/) || [])[1] || '',
    lookTimerInApp: /startProgressTimer\(setFormStatus, '옷 녹이는 중'\)/.test(text),
  }
}

const notes = []
const pageerrors = []

const preRes = await fetch(`${BASE}/desk-look-preflight.js?v=20260919look`, { cache: 'no-store' })
const preText = await preRes.text()
const preInspect = inspectPreflight(preText)
notes.push('preflight ' + JSON.stringify({ status: preRes.status, ...preInspect }))

const pagesPre = await fetch(`${PAGES}/desk-look-preflight.js?v=20260919look`, { cache: 'no-store' })
const pagesInspect = inspectPreflight(await pagesPre.text())
notes.push('pages-preflight ' + JSON.stringify({ status: pagesPre.status, ...pagesInspect }))

const appRes = await fetch(`${BASE}/app.js?v=20260919look`, { cache: 'no-store' })
const appInspect = inspectAppJs(await appRes.text())
notes.push('app.js ' + JSON.stringify({ status: appRes.status, ...appInspect }))

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
page.on('pageerror', (err) => {
  pageerrors.push(err.message)
  notes.push(`pageerror: ${err.message}`)
})
page.on('console', (msg) => {
  if (msg.type() === 'error') notes.push(`console.error: ${msg.text()}`)
})

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(1500)
await page.screenshot({ path: path.join(OUT, '01-open.png'), fullPage: true })
const open = await page.evaluate(() => ({
  href: location.href,
  build: window.__DESK_BUILD || '',
  gate: Boolean(document.getElementById('pin-gate')),
}))
notes.push('open ' + JSON.stringify(open))

const creds = loadCreds()
const loginPass = creds.password || creds.pin
if (loginPass && (await page.locator('#pin-gate').isVisible().catch(() => false))) {
  await page.fill('#auth-email', 'admin')
  await page.fill('#auth-password', loginPass)
  await page.click('#auth-submit')
  await page.waitForTimeout(2500)
}
await page.screenshot({ path: path.join(OUT, '02-after-login.png'), fullPage: true })

const deskTab = page.locator('#app-area-admin')
if (await deskTab.isVisible().catch(() => false)) await deskTab.click()
await page.waitForTimeout(800)
await page.screenshot({ path: path.join(OUT, '03-desk.png'), fullPage: true })

const desk = await page.evaluate(() => {
  const looks = [...(document.getElementById('desk-looks')?.querySelectorAll('button') || [])]
  return {
    build: window.__DESK_BUILD || '',
    appHidden: Boolean(document.getElementById('app')?.hidden),
    lookCards: looks.length,
    lookText: looks.map((b) => b.textContent.trim()),
    woman: Boolean(document.getElementById('desk-cast-woman')),
    man: Boolean(document.getElementById('desk-cast-man')),
  }
})
notes.push('desk ' + JSON.stringify(desk))
await browser.close()

const react300 = pageerrors.some((m) => /Minified React error #300|#300/i.test(m))
const report = {
  url: BASE,
  pagesUrl: PAGES,
  commit: '182fb5d1c9dc7d704bcde445b119a4466124ba02',
  paidCallsThisStep: 0,
  slipClicked: false,
  react300,
  pageerrors,
  build: desk.build || open.build,
  ...appInspect,
  ...preInspect,
  pagesPreflight: pagesInspect,
  lookCards: desk.lookCards,
  lookHasSilk: desk.lookText.includes('슬립'),
  loginOk: desk.appHidden === false,
  ok:
    !react300 &&
    desk.appHidden === false &&
    desk.lookText.includes('슬립') &&
    preInspect.hasRemnant &&
    preInspect.reasonOrder &&
    preInspect.lumRelKept &&
    preInspect.whiteKept &&
    preInspect.bodyKept &&
    pagesInspect.hasRemnant &&
    !appInspect.lookTimerInApp,
}
writeFileSync(path.join(OUT, 'notes.txt'), notes.join('\n') + '\n')
writeFileSync(path.join(OUT, 'smoke.json'), JSON.stringify(report, null, 2))
writeFileSync(
  path.join(OUT, 'deploy.json'),
  JSON.stringify(
    {
      commit: '182fb5d1c9dc7d704bcde445b119a4466124ba02',
      includes: ['041a9ed protectIdentical skip', '182fb5d mask_seam remnant + reason order'],
      compileShim: 'worktree-only missing exports; nude/Wan/timer dirty not deployed',
      pagesUrl: PAGES,
      opsUrl: BASE,
      build: '20260919look',
      slipClicked: false,
      paidCallsThisStep: 0,
    },
    null,
    2,
  ),
)
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
