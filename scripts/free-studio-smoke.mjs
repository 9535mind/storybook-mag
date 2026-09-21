#!/usr/bin/env node
/**
 * 무과금. 자유 스튜디오 탭이 운영에서 실제로 보이고 열리는지 브라우저로 확인.
 * 그림은 만들지 않는다 (엔진 호출 없음).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'free-studio-smoke')
const BASE = process.env.STORYMAG_BASE || 'https://storymag.mindstory.kr'
mkdirSync(OUT, { recursive: true })

function loadCreds() {
  const note = path.join(ROOT, '핀패스.txt')
  const n = existsSync(note) ? readFileSync(note, 'utf8') : ''
  const vars = existsSync(path.join(ROOT, '.dev.vars')) ? readFileSync(path.join(ROOT, '.dev.vars'), 'utf8') : ''
  return {
    pin: (n.match(/^핀\s+(\S+)/m) || [])[1]?.trim() || (vars.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim() || '',
    password: (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim() || '',
  }
}

const creds = loadCreds()
const pageerrors = []
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
page.on('pageerror', (err) => pageerrors.push(err.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') pageerrors.push(`console: ${msg.text()}`)
})

await page.goto(BASE, { waitUntil: 'networkidle' })
const loginPass = creds.password || creds.pin
if (loginPass && (await page.locator('#pin-gate').isVisible().catch(() => false))) {
  await page.fill('#auth-email', 'admin')
  await page.fill('#auth-password', loginPass)
  await page.click('#auth-submit')
  await page.waitForTimeout(3500)
}
await page.screenshot({ path: path.join(OUT, '01-after-login.png'), fullPage: false })

const tabVisible = await page.locator('#app-area-free').isVisible().catch(() => false)
let panel = {}
if (tabVisible) {
  await page.click('#app-area-free')
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(OUT, '02-free-tab.png'), fullPage: false })
  panel = await page.evaluate(() => ({
    areaShown: document.getElementById('free-area')?.hidden === false,
    deskHidden: document.getElementById('studio-area')?.hidden === true,
    hasText: Boolean(document.getElementById('free-text')),
    hasPhoto: Boolean(document.getElementById('free-photo')),
    hasRun: Boolean(document.getElementById('free-run')),
    // 사진을 안 올렸으면 미리보기 줄이 아예 안 보여야 한다.
    photoRowHidden: document.getElementById('free-photo-wrap')?.offsetParent === null,
    title: document.getElementById('app-title')?.textContent?.trim() || '',
    tabActive: document.getElementById('app-area-free')?.classList.contains('app__area-btn--active'),
  }))
  // 빈 글로 누르면 엔진을 안 부르고 안내만 떠야 한다.
  await page.click('#free-run')
  await page.waitForTimeout(600)
  panel.emptyGuard = await page.evaluate(() => document.getElementById('free-status')?.textContent?.trim() || '')
}

const report = {
  base: BASE,
  tabVisible,
  ...panel,
  pageerrors,
  ok:
    tabVisible &&
    panel.areaShown === true &&
    panel.deskHidden === true &&
    panel.hasText === true &&
    panel.hasRun === true &&
    panel.tabActive === true &&
    panel.photoRowHidden === true &&
    /적어/.test(panel.emptyGuard || '') &&
    pageerrors.length === 0,
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
process.exit(report.ok ? 0 : 1)
