#!/usr/bin/env node
/** 서서 전신에 몸 보기를 내가 누른다. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', process.env.DESK_LOOP_OUT || 'desk-shape-mw161')
const BASE = process.env.DESK_LOOP_BASE || 'https://ef5c8af4.storymag.pages.dev'
const ID =
  process.env.DESK_LOOP_ID ||
  path.join(ROOT, 'tmp-faceswap-test', 'desk-body-mw161', 'result.jpg')
mkdirSync(OUT, { recursive: true })

function loadCreds() {
  const note = existsSync(path.join(ROOT, '핀패스.txt')) ? readFileSync(path.join(ROOT, '핀패스.txt'), 'utf8') : ''
  const vars = existsSync(path.join(ROOT, '.dev.vars')) ? readFileSync(path.join(ROOT, '.dev.vars'), 'utf8') : ''
  return {
    pin: (note.match(/^핀\s+(\S+)/m) || [])[1]?.trim() || (vars.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim() || '',
    password: (note.match(/패스워드\s+(\S+)/) || [])[1]?.trim() || '',
  }
}

const notes = []
const pageerrors = []
const consoleErrors = []
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
page.on('pageerror', (err) => pageerrors.push(err.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})

const snap = async () =>
  page.evaluate(() => {
    const shape = document.querySelector('[data-desk-step="shape"]')
    const img = document.getElementById('desk-cast-woman-img')
    const result = document.getElementById('result-image')
    return {
      build: window.__DESK_BUILD || '',
      status: document.getElementById('desk-status')?.textContent || '',
      form: document.querySelector('.form__status')?.textContent || '',
      shapeDisabled: Boolean(shape?.disabled),
      shapeBusy: Boolean(shape?.classList.contains('is-busy')),
      shapeText: shape?.textContent?.trim() || '',
      womanSrc: Boolean(img?.src && !img.hidden),
      resultSrc: Boolean(result?.src && !result.hidden),
    }
  })

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForTimeout(1200)
const creds = loadCreds()
if (await page.locator('#pin-gate').isVisible().catch(() => false)) {
  await page.fill('#auth-email', 'admin')
  await page.fill('#auth-password', creds.password || creds.pin)
  await page.click('#auth-submit')
  await page.waitForTimeout(2500)
}
const deskTab = page.locator('#app-area-admin')
if (await deskTab.isVisible().catch(() => false)) await deskTab.click()
await page.waitForTimeout(600)
const newWork = page.locator('#desk-work-new')
if (await newWork.isVisible().catch(() => false)) await newWork.click()
await page.waitForTimeout(500)
await page.waitForFunction(() => typeof window.__deskApplyCastFile === 'function', { timeout: 20000 })

const idBuf = readFileSync(ID)
const applied = await page.evaluate(
  async ({ b64, name }) => {
    const raw = atob(b64)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
    const file = new File([bytes], name, { type: 'image/jpeg' })
    await window.__deskApplyCastFile('woman', file)
    return { ok: true }
  },
  { b64: idBuf.toString('base64'), name: 'standing.jpg' },
)
notes.push('apply ' + JSON.stringify(applied))

const castDeadline = Date.now() + 60000
let afterCast = await snap()
while (Date.now() < castDeadline) {
  afterCast = await snap()
  if (/여 얼굴을 작품에 넣었습니다|얼굴을 확인하지 못해|얼굴을 넣지 못했습니다/.test(`${afterCast.status} ${afterCast.form}`)) {
    break
  }
  if (afterCast.womanSrc && !afterCast.shapeDisabled) break
  await page.waitForTimeout(1500)
}
const gateDeadline = Date.now() + 20000
while (Date.now() < gateDeadline && afterCast.shapeDisabled) {
  await page.waitForTimeout(1000)
  afterCast = await snap()
}
notes.push('afterCast ' + JSON.stringify(afterCast))
await page.screenshot({ path: path.join(OUT, '01-after-cast.png'), fullPage: true })

const shapeBtn = page.locator('#desk-shape-run')
let clicked = false
await shapeBtn.click({ force: true })
clicked = true
notes.push('clicked shape')

let final = afterCast
if (clicked) {
  const deadline = Date.now() + 240000
  while (Date.now() < deadline) {
    final = await snap()
    notes.push('poll ' + JSON.stringify(final))
    const text = `${final.status} ${final.form}`
    if (/아이보리 운동복|다른 얼굴|전신을 잘라|빈 장|저장하지 않습니다|보내지 못했습니다/i.test(text) && !final.shapeBusy) {
      break
    }
    await page.waitForTimeout(4000)
  }
}

await page.screenshot({ path: path.join(OUT, '02-after-shape.png'), fullPage: true })
const resultSrc = await page.evaluate(() => document.getElementById('result-image')?.src || '')
if (resultSrc.startsWith('data:image')) {
  const m = resultSrc.match(/^data:image\/\w+;base64,(.+)$/)
  if (m) writeFileSync(path.join(OUT, 'result.jpg'), Buffer.from(m[1], 'base64'))
} else if (/^https?:\/\//.test(resultSrc)) {
  const r = await fetch(resultSrc)
  if (r.ok) writeFileSync(path.join(OUT, 'result.jpg'), Buffer.from(await r.arrayBuffer()))
}
await browser.close()

const text = `${afterCast.status} ${afterCast.form} ${final.status} ${final.form}`
const ok =
  /20261005mw231/.test(afterCast.build) &&
  clicked &&
  /아이보리 운동복/.test(text) &&
  !/다른 얼굴|전신을 잘라|빈 장|저장하지 않습니다/.test(`${final.status} ${final.form}`)
const report = { base: BASE, ok, clicked, afterCast, final, pageerrors, consoleErrors: consoleErrors.slice(0, 20) }
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
writeFileSync(path.join(OUT, 'notes.txt'), notes.join('\n') + '\n')
console.log(JSON.stringify(report, null, 2))
if (!ok) process.exit(1)
