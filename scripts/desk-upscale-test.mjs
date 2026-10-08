#!/usr/bin/env node
/** 화질 올리기(/api/upload-image + /api/upscale) 시험. 사용: UP_SRC=<이미지> UP_OUT=<폴더> node scripts/desk-upscale-test.mjs */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.DESK_LOOP_BASE || 'https://storymag.pages.dev'
const OUT = process.env.UP_OUT
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
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const creds = loadCreds()
if (await page.locator('#pin-gate').isVisible().catch(() => false)) {
  await page.fill('#auth-email', 'admin')
  await page.fill('#auth-password', creds.password || creds.pin)
  await page.click('#auth-submit')
  await page.waitForTimeout(2500)
}
const dataUrl = 'data:image/jpeg;base64,' + readFileSync(process.env.UP_SRC).toString('base64')
const res = await page.evaluate(async (du) => {
  const up = await fetch('/api/upload-image', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ dataUrl: du }) })
  const upData = await up.json().catch(() => ({}))
  if (!upData.imageUrl) return { step: 'upload', status: up.status, upData }
  const t0 = Date.now()
  const r = await fetch('/api/upscale', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ imageUrl: upData.imageUrl, scale: 2 }) })
  const d = await r.json().catch(() => ({}))
  return { step: 'upscale', status: r.status, d, ms: Date.now() - t0 }
}, dataUrl)
console.log(JSON.stringify(res))
if (res.d?.imageUrl) {
  const r = await fetch(res.d.imageUrl)
  writeFileSync(path.join(OUT, 'upscaled.png'), Buffer.from(await r.arrayBuffer()))
}
await browser.close()
