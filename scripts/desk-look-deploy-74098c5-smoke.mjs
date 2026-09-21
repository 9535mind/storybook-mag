#!/usr/bin/env node
/**
 * 74098c5 제한 배포. 소매 마스크 반영·화면만. 슬립 클릭·유료 호출 없음.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-deploy-74098c5')
const BASE = process.env.STORYMAG_BASE || 'https://storymag.mindstory.kr'
const PAGES = 'https://b1db216d.storymag.pages.dev'
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

function inspectPre(text) {
  return {
    hasSleeve: /releasedSleeve/.test(text),
    limbLocked: /VTON_IDENTITY_PROTECT_LABELS[\s\S]{0,240}Left-arm/.test(text) || /"Left-arm"[\s\S]{0,80}"Right-arm"[\s\S]{0,40}"Bag"/.test(text),
    hasRemnant: /function regionBoundaryRemnant/.test(text),
  }
}

const notes = []
const pageerrors = []
const preRes = await fetch(`${BASE}/desk-look-preflight.js?v=20260919look`, { cache: 'no-store' })
const pre = inspectPre(await preRes.text())
notes.push('preflight ' + JSON.stringify({ status: preRes.status, ...pre }))
const pagesPre = inspectPre(await (await fetch(`${PAGES}/desk-look-preflight.js?v=20260919look`, { cache: 'no-store' })).text())

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
page.on('pageerror', (err) => {
  pageerrors.push(err.message)
  notes.push(`pageerror: ${err.message}`)
})
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(1200)
await page.screenshot({ path: path.join(OUT, '01-open.png'), fullPage: true })
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
    lookText: looks.map((b) => b.textContent.trim()),
  }
})
notes.push('desk ' + JSON.stringify(desk))
await browser.close()
const react300 = pageerrors.some((m) => /Minified React error #300|#300/i.test(m))
const report = {
  url: BASE,
  pagesUrl: PAGES,
  commit: '74098c594b6841925a73233371cdddaf281f8abc',
  slipClicked: false,
  paidCallsThisStep: 0,
  react300,
  ...pre,
  pagesPre,
  lookHasSilk: desk.lookText.includes('슬립'),
  loginOk: desk.appHidden === false,
  ok:
    !react300 &&
    desk.appHidden === false &&
    desk.lookText.includes('슬립') &&
    pre.hasSleeve &&
    pre.hasRemnant &&
    pagesPre.hasSleeve,
}
writeFileSync(path.join(OUT, 'notes.txt'), notes.join('\n') + '\n')
writeFileSync(path.join(OUT, 'smoke.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
