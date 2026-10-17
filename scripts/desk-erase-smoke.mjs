#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-erase-mw244')
const BASE = process.env.DESK_LOOP_BASE || 'https://ffddbc85.storymag.pages.dev'
const ID =
  process.env.DESK_LOOP_ID ||
  'C:/Users/UserK/.cursor/projects/c-Users-UserK-Desktop-PLATFORM-fashion-magazine/assets/c__Users_UserK_AppData_Roaming_Cursor_User_workspaceStorage_445c76ae849c56e27af6a45e9bef9d4d_images_image-13886c0e-d130-49c1-aecb-2816ca907a4f.png'
mkdirSync(OUT, { recursive: true })

function loadCreds() {
  const note = existsSync(path.join(ROOT, '핀패스.txt')) ? readFileSync(path.join(ROOT, '핀패스.txt'), 'utf8') : ''
  const vars = existsSync(path.join(ROOT, '.dev.vars')) ? readFileSync(path.join(ROOT, '.dev.vars'), 'utf8') : ''
  return {
    pin: (note.match(/^핀\s+(\S+)/m) || [])[1]?.trim() || (vars.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim() || '',
    password: (note.match(/패스워드\s+(\S+)/) || [])[1]?.trim() || '',
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
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
await page.waitForTimeout(400)
await page.waitForFunction(() => typeof window.__deskApplyCastFile === 'function', { timeout: 20000 })

const idBuf = readFileSync(ID)
await page.evaluate(
  async ({ b64, name }) => {
    const raw = atob(b64)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
    await window.__deskApplyCastFile('woman', new File([bytes], name, { type: 'image/png' }))
  },
  { b64: idBuf.toString('base64'), name: 'cast.png' },
)
await page.waitForTimeout(2500)
await page.locator('#desk-cast-erase').click({ force: true })
await page.waitForTimeout(2500)
const snap = await page.evaluate(() => {
  const bar = document.getElementById('desk-erase-bar')
  const canvas = document.getElementById('region-canvas')
  return {
    build: window.__DESK_BUILD || '',
    status: document.getElementById('desk-status')?.textContent || '',
    eraseBtn: Boolean(document.getElementById('desk-cast-erase')),
    barOn: Boolean(bar && !bar.hidden),
    canvasOn: Boolean(canvas && !canvas.hidden),
    erasing: Boolean(window.__deskErasing),
  }
})
await page.screenshot({ path: path.join(OUT, 'erase-open.png'), fullPage: true })
await browser.close()
const ok = /20261005mw244/.test(snap.build) && snap.eraseBtn && snap.barOn && snap.erasing
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ base: BASE, ok, snap }, null, 2))
console.log(JSON.stringify({ base: BASE, ok, snap }, null, 2))
if (!ok) process.exit(1)
