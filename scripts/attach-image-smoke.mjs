#!/usr/bin/env node
/**
 * 무과금. 각 탭에 파일·붙이기 단추가 있고, 작은 PNG 를 paste 이벤트로 넣으면 미리보기가 생기는지 본다.
 * 엔진 호출 없음.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'attach-image-smoke')
const BASE = process.env.STORYMAG_BASE || 'https://storymag.mindstory.kr'
mkdirSync(OUT, { recursive: true })

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function loadCreds() {
  const note = path.join(ROOT, '핀패스.txt')
  const n = existsSync(note) ? readFileSync(note, 'utf8') : ''
  const vars = existsSync(path.join(ROOT, '.dev.vars')) ? readFileSync(path.join(ROOT, '.dev.vars'), 'utf8') : ''
  return {
    password:
      (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim() ||
      (n.match(/^핀\s+(\S+)/m) || [])[1]?.trim() ||
      (vars.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim() ||
      '',
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

await page.goto(BASE, { waitUntil: 'networkidle' })
if (creds.password && (await page.locator('#pin-gate').isVisible().catch(() => false))) {
  await page.fill('#auth-email', 'admin')
  await page.fill('#auth-password', creds.password)
  await page.click('#auth-submit')
  await page.waitForTimeout(2800)
}

const pasteTiny = async (selector) =>
  page.evaluate(
    ({ sel, b64 }) => {
      const bin = atob(b64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      const file = new File([arr], 'probe.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      const el = document.querySelector(sel)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    },
    { sel: selector, b64: PNG },
  )

const clickTab = async (area) => {
  const tab = page.locator(`[data-app-area="${area}"]`)
  if (!(await tab.isVisible().catch(() => false))) return false
  await tab.click()
  await page.waitForTimeout(500)
  return true
}

const report = { base: BASE, tabs: {}, pageerrors }

if (await clickTab('free')) {
  await pasteTiny('#free-area')
  await page.waitForTimeout(700)
  await page.evaluate(() => {
    document.getElementById('free-photo-clear')?.click()
  })
  await page.waitForTimeout(300)
  await pasteTiny('#free-text')
  await page.waitForTimeout(700)
  report.tabs.free = await page.evaluate(() => ({
    pasteBtn: Boolean(document.getElementById('free-photo-paste')),
    textPaste: Boolean(document.getElementById('free-text-paste')),
    textDrop: Boolean(document.getElementById('free-text-drop')),
    preview: Boolean(document.getElementById('free-photo-preview')?.src?.startsWith('data:image')),
    dropClass: document.getElementById('free-area')?.classList.contains('attach-drop'),
  }))
  await page.screenshot({ path: path.join(OUT, 'free.png'), fullPage: false })
}

if (await clickTab('observe')) {
  await pasteTiny('#observe-area')
  await page.waitForTimeout(700)
  report.tabs.observe = await page.evaluate(() => ({
    pasteBtn: Boolean(document.getElementById('observe-image-paste')),
    preview: document.getElementById('observe-preview')?.hidden === false,
    dropClass: document.getElementById('observe-area')?.classList.contains('attach-drop'),
  }))
  await page.screenshot({ path: path.join(OUT, 'observe.png'), fullPage: false })
}

if (await clickTab('tale')) {
  await pasteTiny('#tale-area')
  await page.waitForTimeout(700)
  report.tabs.tale = await page.evaluate(() => ({
    pasteBtn: Boolean(document.getElementById('tale-img-paste')),
    layoutPaste: Boolean(document.getElementById('layout-image-paste')),
    canvasShown: document.getElementById('tale-img-wrap')?.hidden === false,
    dropClass: document.getElementById('tale-area')?.classList.contains('attach-drop'),
  }))
  await page.screenshot({ path: path.join(OUT, 'tale.png'), fullPage: false })
}

if (await clickTab('essay')) {
  report.tabs.essay = await page.evaluate(() => ({
    pasteBtn: Boolean(document.getElementById('essay-pdf-paste')),
    file: Boolean(document.getElementById('essay-pdf-input')),
    dropClass: document.getElementById('essay-area')?.classList.contains('attach-drop'),
  }))
}

if (await clickTab('studio')) {
  report.tabs.studio = await page.evaluate(() => ({
    fileBtn: Boolean(document.getElementById('load-image-button')),
    dropzone: Boolean(document.getElementById('description-dropzone')),
    pasteHint: /Ctrl\+V/.test(document.querySelector('.description-dropzone__hint')?.textContent || ''),
  }))
}

if (await clickTab('admin')) {
  const deskOpen = await page.locator('#desk-cast-paste-w').isVisible().catch(() => false)
  report.tabs.desk = {
    womanPaste: deskOpen,
    manPaste: await page.locator('#desk-cast-paste-m').isVisible().catch(() => false),
  }
}

report.ok =
  report.tabs.free?.preview === true &&
  report.tabs.free?.pasteBtn === true &&
  report.tabs.free?.textPaste === true &&
  report.tabs.free?.textDrop === true &&
  report.tabs.observe?.preview === true &&
  report.tabs.observe?.pasteBtn === true &&
  report.tabs.tale?.pasteBtn === true &&
  report.tabs.tale?.layoutPaste === true &&
  report.tabs.tale?.canvasShown === true &&
  report.tabs.essay?.pasteBtn === true &&
  report.tabs.essay?.dropClass === true &&
  report.tabs.studio?.fileBtn === true &&
  report.tabs.studio?.pasteHint === true &&
  report.tabs.desk?.womanPaste === true &&
  pageerrors.length === 0

writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
process.exit(report.ok ? 0 : 1)
