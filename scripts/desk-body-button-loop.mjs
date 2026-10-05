#!/usr/bin/env node
/** 브라우저에서 여 얼굴 넣고 1 몸 잇기를 내가 누른다. 확실할 때만 성공. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', process.env.DESK_LOOP_OUT || 'desk-body-mw161')
const BASE = process.env.DESK_LOOP_BASE || 'https://storymag.mindstory.kr'
const ID =
  process.env.DESK_LOOP_ID ||
  path.join(ROOT, 'tmp-faceswap-test', 'desk-11-ident.jfif')
mkdirSync(OUT, { recursive: true })

function loadCreds() {
  const note = existsSync(path.join(ROOT, '핀패스.txt')) ? readFileSync(path.join(ROOT, '핀패스.txt'), 'utf8') : ''
  const vars = existsSync(path.join(ROOT, '.dev.vars')) ? readFileSync(path.join(ROOT, '.dev.vars'), 'utf8') : ''
  return {
    pin: (note.match(/^핀\s+(\S+)/m) || [])[1]?.trim() || (vars.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim() || '',
    password: (note.match(/패스워드\s+(\S+)/) || [])[1]?.trim() || '',
  }
}

function shot(name) {
  return path.join(OUT, name)
}

const notes = []
const pageerrors = []
const consoleErrors = []
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
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})

const snap = async () =>
  page.evaluate(() => {
    const body = document.querySelector('[data-desk-step="body"]')
    const img = document.getElementById('desk-cast-woman-img')
    const man = document.getElementById('desk-cast-man-img')
    const result = document.getElementById('result-image')
    return {
      href: location.href,
      build: window.__DESK_BUILD || '',
      gate: Boolean(document.getElementById('pin-gate') && !document.getElementById('pin-gate').hidden),
      appHidden: Boolean(document.getElementById('app')?.hidden),
      hasApply: typeof window.__deskApplyCastFile === 'function',
      status: document.getElementById('desk-status')?.textContent || '',
      form: document.querySelector('.form__status')?.textContent || '',
      hint: document.getElementById('desk-still-hint')?.textContent || '',
      bodyDisabled: Boolean(body?.disabled),
      bodyBusy: Boolean(body?.classList.contains('is-busy')),
      bodyText: body?.textContent?.trim() || '',
      womanSrc: Boolean(img?.src && !img.hidden),
      manSrc: Boolean(man?.src && !man.hidden),
      resultSrc: Boolean(result?.src && !result.hidden),
    }
  })

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForTimeout(1500)
await page.screenshot({ path: shot('00-open.png'), fullPage: true })
notes.push('open ' + JSON.stringify(await snap()))

const creds = loadCreds()
if (await page.locator('#pin-gate').isVisible().catch(() => false)) {
  await page.fill('#auth-email', 'admin')
  await page.fill('#auth-password', creds.password || creds.pin)
  await page.click('#auth-submit')
  await page.waitForTimeout(2500)
}
await page.screenshot({ path: shot('01-login.png'), fullPage: true })
notes.push('login ' + JSON.stringify(await snap()))

const deskTab = page.locator('#app-area-admin')
if (await deskTab.isVisible().catch(() => false)) await deskTab.click()
await page.waitForTimeout(800)
const newWork = page.locator('#desk-work-new')
if (await newWork.isVisible().catch(() => false)) await newWork.click()
await page.waitForTimeout(600)
await page.waitForFunction(() => typeof window.__deskApplyCastFile === 'function', { timeout: 20000 }).catch(() => {})
await page.screenshot({ path: shot('02-desk.png'), fullPage: true })
notes.push('desk ' + JSON.stringify(await snap()))

const ROLE = process.env.DESK_LOOP_ROLE === 'man' ? 'man' : 'woman'
const idBuf = readFileSync(ID)
const applied = await page.evaluate(async ({ b64, name, role }) => {
  if (typeof window.__deskApplyCastFile !== 'function') return { ok: false, reason: 'no_apply' }
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  const file = new File([bytes], name, { type: 'image/jpeg' })
  await window.__deskApplyCastFile(role, file)
  return { ok: true }
}, { b64: idBuf.toString('base64'), name: '00-ident.jpg', role: ROLE })
notes.push('apply ' + JSON.stringify(applied))

const castDeadline = Date.now() + 90000
let afterCast = await snap()
while (Date.now() < castDeadline) {
  afterCast = await snap()
  notes.push('cast-poll ' + JSON.stringify(afterCast))
  if (/여 얼굴을 작품에 넣었습니다|남 얼굴을 작품에 넣었습니다|얼굴을 확인하지 못해|얼굴을 넣지 못했습니다/.test(`${afterCast.status} ${afterCast.form}`)) break
  if ((afterCast.womanSrc || afterCast.manSrc) && !afterCast.bodyDisabled) break
  await page.waitForTimeout(2000)
}
await page.screenshot({ path: shot('03-after-cast.png'), fullPage: true })
notes.push('afterCast ' + JSON.stringify(afterCast))

let clicked = false
const bodyBtn = page.locator('[data-desk-step="body"]')
if (afterCast.bodyDisabled) {
  notes.push('FAIL body still disabled after face')
} else if (await bodyBtn.isDisabled()) {
  notes.push('FAIL playwright says disabled')
} else {
  await bodyBtn.click({ force: true })
  clicked = true
  notes.push('clicked body')
}

let early = null
if (clicked) {
  await page.waitForTimeout(8000)
  early = await snap()
  notes.push('early ' + JSON.stringify(early))
  await page.screenshot({ path: shot('04-early-body.png'), fullPage: true })
}

let final = early || afterCast
if (clicked) {
  const deadline = Date.now() + 420000
  while (Date.now() < deadline) {
    final = await snap()
    notes.push('poll ' + JSON.stringify(final))
    const text = `${final.status} ${final.form}`
    if (/loadHtmlImage|걸음 실패|ReferenceError/i.test(text)) break
    if (/이었습니다|전신이 안 붙|다른 사람|CAST 얼굴|저장하지 않습니다/i.test(text) && !final.bodyBusy) break
    await page.waitForTimeout(4000)
  }
}

await page.screenshot({ path: shot('05-after-body.png'), fullPage: true })
const debug = await page.evaluate(() => ({
  holdLog: window.__deskHoldLog || [],
  recolorLog: window.__deskRecolorLog || null,
  standing: typeof window.__deskLastStanding === 'string' ? window.__deskLastStanding.slice(0, 40) : '',
  standingLen: typeof window.__deskLastStanding === 'string' ? window.__deskLastStanding.length : 0,
}))
writeFileSync(path.join(OUT, 'hold-log.json'), JSON.stringify(debug, null, 2))
if (typeof (await page.evaluate(() => window.__deskLastStanding)) === 'string') {
  const standingSrc = await page.evaluate(() => window.__deskLastStanding || '')
  if (standingSrc.startsWith('data:image')) {
    const m = standingSrc.match(/^data:image\/\w+;base64,(.+)$/)
    if (m) writeFileSync(path.join(OUT, 'standing.jpg'), Buffer.from(m[1], 'base64'))
  }
}
const resultSrc = await page.evaluate(() => document.getElementById('result-image')?.src || '')
if (resultSrc.startsWith('data:image')) {
  const m = resultSrc.match(/^data:image\/\w+;base64,(.+)$/)
  if (m) writeFileSync(path.join(OUT, 'result.jpg'), Buffer.from(m[1], 'base64'))
} else if (/^https?:\/\//.test(resultSrc)) {
  try {
    const r = await fetch(resultSrc)
    if (r.ok) writeFileSync(path.join(OUT, 'result.jpg'), Buffer.from(await r.arrayBuffer()))
  } catch {
    /* ignore */
  }
}

await browser.close()

const allText = [afterCast.status, afterCast.form, final.status, final.form, ...pageerrors, ...consoleErrors].join('\n')
const loadHtmlCrash = /loadHtmlImage is not defined/i.test(allText)
const stepFail = /걸음 실패/i.test(`${final.status} ${final.form}`)
const bodyOn = (afterCast.womanSrc || afterCast.manSrc) && !afterCast.bodyDisabled
const extended = /이었습니다/.test(`${final.status} ${final.form}`)
const ok = /20261005mw207/.test(afterCast.build) && bodyOn && clicked && !loadHtmlCrash && !stepFail && extended
const report = {
  base: BASE,
  ok,
  loadHtmlCrash,
  stepFail,
  bodyOn,
  clicked,
  extended,
  applied,
  afterCast,
  early,
  final,
  holdLog: debug.holdLog,
  recolorLog: debug.recolorLog,
  standingLen: debug.standingLen,
  pageerrors,
  consoleErrors: consoleErrors.slice(0, 30),
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
writeFileSync(path.join(OUT, 'notes.txt'), notes.join('\n') + '\n')
console.log(JSON.stringify(report, null, 2))
if (!ok) process.exit(1)
