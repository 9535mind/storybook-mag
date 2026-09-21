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
let afterPhoto = {}
if (tabVisible) {
  await page.click('#app-area-free')
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(OUT, '02-free-tab.png'), fullPage: false })
  // 사진을 올리면 그림을 안 만들어도 움직이기가 열려야 한다.
  await page
    .setInputFiles('#free-photo', {
      name: 'probe.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
    })
    .catch(() => {})
  await page.waitForTimeout(900)
  afterPhoto = await page.evaluate(() => ({
    moveRowShown: document.getElementById('free-move-wrap')?.offsetParent !== null,
    fromLabel: document.getElementById('free-move-from')?.textContent?.trim() || '',
    // 몸매 투영은 사진이 있을 때만 눌린다.
    projectEnabled: document.getElementById('free-project')?.disabled === false,
  }))
  // 24초를 고르면 후반 움직임 칸이 열려야 한다 (두 클립 이어 붙이기).
  // 움직이기 칸이 보이는 지금(사진 있음) 확인해야 select 를 누를 수 있다.
  await page.selectOption('#free-move-sec', '24').catch(() => {})
  await page.waitForTimeout(300)
  afterPhoto.dualRowShownAt24 = await page.evaluate(
    () => document.getElementById('free-move-dual')?.hidden === false,
  )
  await page.screenshot({ path: path.join(OUT, '03-free-aug27.png'), fullPage: true })
  await page.selectOption('#free-move-sec', '15').catch(() => {})

  await page.click('#free-photo-clear').catch(() => {})
  await page.waitForTimeout(500)

  panel = await page.evaluate(() => ({
    areaShown: document.getElementById('free-area')?.hidden === false,
    deskHidden: document.getElementById('studio-area')?.hidden === true,
    hasText: Boolean(document.getElementById('free-text')),
    hasPhoto: Boolean(document.getElementById('free-photo')),
    hasRun: Boolean(document.getElementById('free-run')),
    // 사진을 안 올렸으면 미리보기 줄이 아예 안 보여야 한다.
    photoRowHidden: document.getElementById('free-photo-wrap')?.offsetParent === null,
    // 그림이 없으면 움직이기 칸도 숨어 있어야 한다.
    moveRowHidden: document.getElementById('free-move-wrap')?.offsetParent === null,
    hasMoveRun: Boolean(document.getElementById('free-move-run')),
    title: document.getElementById('app-title')?.textContent?.trim() || '',
    // 일러스트 탭 안내문이 새어 나오면 안 된다.
    strayHint: document.getElementById('gen-mode-hint')?.offsetParent !== null,
    hasGuide: (document.querySelector('.free-guide')?.children.length || 0) >= 3,
    // 8월 27일자 기능이 다 붙었는지
    hasProject: Boolean(document.getElementById('free-project')),
    projectDisabledWithoutPhoto: document.getElementById('free-project')?.disabled === true,
    hasMoveProject: Boolean(document.getElementById('free-move-project')),
    lengths: [...(document.getElementById('free-move-sec')?.options || [])].map((o) => Number(o.value)),
    sizes: [...(document.getElementById('free-size')?.options || [])].map((o) => o.value),
    // 움직이기 칸 자체가 숨어 있을 수 있으니 hidden 속성으로 본다.
    dualRowHidden: document.getElementById('free-move-dual')?.hidden === true,
    tabActive: document.getElementById('app-area-free')?.classList.contains('app__area-btn--active'),
  }))
  // 빈 글로 누르면 엔진을 안 부르고 안내만 떠야 한다.
  await page.click('#free-run')
  await page.waitForTimeout(600)
  panel.emptyGuard = await page.evaluate(() => document.getElementById('free-status')?.textContent?.trim() || '')

}

// 얼린 8월 27일자 경로가 살아 있는지 (401 = 있음, 404 = 배포 안 됨)
const routes = {}
for (const name of ['free-refine', 'free-generate', 'free-animate']) {
  const res = await page.request.post(`${BASE}/api/${name}`, { data: {}, failOnStatusCode: false })
  routes[name] = res.status()
}

const report = {
  base: BASE,
  tabVisible,
  ...panel,
  photoOpensMove: afterPhoto?.moveRowShown === true,
  moveFromLabel: afterPhoto?.fromLabel || '',
  projectEnabledWithPhoto: afterPhoto?.projectEnabled === true,
  dualRowShownAt24: afterPhoto?.dualRowShownAt24 === true,
  routes,
  pageerrors,
  ok:
    tabVisible &&
    panel.areaShown === true &&
    panel.deskHidden === true &&
    panel.hasText === true &&
    panel.hasRun === true &&
    panel.tabActive === true &&
    panel.photoRowHidden === true &&
    panel.moveRowHidden === true &&
    panel.hasMoveRun === true &&
    panel.strayHint === false &&
    panel.hasGuide === true &&
    afterPhoto?.moveRowShown === true &&
    afterPhoto?.projectEnabled === true &&
    /올린 사진/.test(afterPhoto?.fromLabel || '') &&
    /적어/.test(panel.emptyGuard || '') &&
    panel.hasProject === true &&
    panel.projectDisabledWithoutPhoto === true &&
    panel.hasMoveProject === true &&
    [10, 12, 15, 18, 24, 30].every((sec) => (panel.lengths || []).includes(sec)) &&
    ['portrait', 'story', 'square', 'landscape'].every((s) => (panel.sizes || []).includes(s)) &&
    panel.dualRowHidden === true &&
    afterPhoto?.dualRowShownAt24 === true &&
    Object.values(routes).every((code) => code === 401) &&
    pageerrors.length === 0,
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
process.exit(report.ok ? 0 : 1)
