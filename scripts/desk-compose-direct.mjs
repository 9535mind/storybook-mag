#!/usr/bin/env node
/** 브라우저에서 여 얼굴 넣고 1 몸 잇기를 내가 누른다. 확실할 때만 성공. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', process.env.DESK_LOOP_OUT || 'desk-couple-mw222')
const BASE = process.env.DESK_LOOP_BASE || 'https://storymag.mindstory.kr'
const ID = process.env.DESK_LOOP_ID || path.join(ROOT, 'tmp-faceswap-test', 'desk-11-ident.jfif')
const MAN_ID = process.env.DESK_LOOP_MAN_ID
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



const b64 = (f) => 'data:image/' + (f.endsWith('.png') ? 'png' : 'jpeg') + ';base64,' + readFileSync(f).toString('base64')
const out = await page.evaluate(async ({ w, m }) => {
  const url = await window.DeskPipeline.composePlate(
    [{ src: w, heightFactor: 1, slot: 'woman' }, { src: m, heightFactor: 1.02, slot: 'man' }],
    'landscape',
  )
  return url
}, { w: b64(ID), m: b64(MAN_ID) })
const mm = out.match(/^data:image\/\w+;base64,(.+)$/)
writeFileSync(path.join(OUT, 'result.jpg'), Buffer.from(mm[1], 'base64'))
await browser.close()
console.log('saved', pageerrors, consoleErrors.slice(0, 5))
