#!/usr/bin/env node
/**
 * 무과금. 후보 고르기 화면이 실제 브라우저에서 뜨고, 누르면 지금 장이 바뀌는지 본다.
 * 유료 엔진은 부르지 않는다 — 가짜 후보 석 장을 직접 넣는다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-pick-smoke')
const BASE = process.env.STORYMAG_BASE || 'https://storymag.mindstory.kr'
mkdirSync(OUT, { recursive: true })

function creds() {
  const note = path.join(ROOT, '핀패스.txt')
  const n = existsSync(note) ? readFileSync(note, 'utf8') : ''
  const vars = path.join(ROOT, '.dev.vars')
  const t = existsSync(vars) ? readFileSync(vars, 'utf8') : ''
  return {
    pin: (n.match(/^핀\s+(\S+)/m) || [])[1]?.trim() || (t.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim() || '',
    password: (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim() || '',
  }
}

// 후보 석 장 대신 쓸 색 타일. 눌렀을 때 어느 것이 골라졌는지 색으로 구분한다.
const tile = (hex) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect width="120" height="160" fill="${hex}"/></svg>`,
  ).toString('base64')}`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

const { pin, password } = creds()
const loginPass = password || pin
if (loginPass && (await page.locator('#pin-gate').isVisible().catch(() => false))) {
  await page.fill('#auth-email', 'admin')
  await page.fill('#auth-password', loginPass)
  await page.click('#auth-submit')
  await page.waitForTimeout(2500)
}
const deskTab = page.locator('#app-area-admin')
if (await deskTab.isVisible().catch(() => false)) await deskTab.click()
await page.waitForTimeout(800)
const loggedIn = !(await page.locator('#pin-gate').isVisible().catch(() => false))

const exposed = await page.evaluate(() => typeof window.showDeskLookPicker === 'function')

const rendered = await page.evaluate(
  ([a, b, c]) => {
    window.__picked = null
    const orig = window.showResult
    window.showResult = (url, ...rest) => {
      window.__picked = url
      if (typeof orig === 'function') {
        try {
          return orig(url, ...rest)
        } catch (e) {
          return null
        }
      }
      return null
    }
    window.showDeskLookPicker(
      [
        { shown: a, gate: { ok: true } },
        { shown: b, gate: { ok: false, reason: 'mask_seam' } },
        { shown: c, gate: { ok: true } },
      ],
      '슬립 한 겹 노브라',
      '옷 녹이기',
      '옷을 녹였습니다.',
    )
    const box = document.getElementById('desk-look-pick')
    return {
      boxPresent: Boolean(box),
      items: box ? box.querySelectorAll('.desk-look-pick__item').length : 0,
      caps: box ? [...box.querySelectorAll('.desk-look-pick__cap')].map((n) => n.textContent) : [],
      hasDrop: Boolean(box?.querySelector('.desk-look-pick__drop')),
      columns: box ? getComputedStyle(box.querySelector('.desk-look-pick__row')).gridTemplateColumns : '',
    }
  },
  [tile('#c8a882'), tile('#8aa3c8'), tile('#9bc88a')],
)
await page.locator('#desk-look-pick').scrollIntoViewIfNeeded().catch(() => {})
await page.waitForTimeout(300)
await page.locator('#desk-look-pick').screenshot({ path: path.join(OUT, '01-picker.png') }).catch(async () => {
  await page.screenshot({ path: path.join(OUT, '01-picker.png') })
})

// 두 번째(검사 걸린) 후보를 눌러 본다. 사람이 고르면 검사와 무관하게 저장되어야 한다.
const afterPick = await page.evaluate(() => {
  const items = document.querySelectorAll('#desk-look-pick .desk-look-pick__item')
  items[1]?.click()
  return {
    pickedUrl: String(window.__picked || '').slice(0, 40),
    boxGone: !document.getElementById('desk-look-pick'),
  }
})
await page.screenshot({ path: path.join(OUT, '02-after-pick.png') })

const expectSecond = tile('#8aa3c8').slice(0, 40)
const report = {
  newPaidCall: false,
  base: BASE,
  loggedIn,
  pickerExposed: exposed,
  ...rendered,
  pickedSecond: afterPick.pickedUrl === expectSecond,
  boxClosedAfterPick: afterPick.boxGone,
  pageErrors: errors.slice(0, 5),
}
report.ok =
  report.pickerExposed &&
  report.boxPresent &&
  report.items === 3 &&
  report.hasDrop &&
  report.pickedSecond &&
  report.boxClosedAfterPick &&
  errors.length === 0
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
if (!report.ok) process.exit(1)
