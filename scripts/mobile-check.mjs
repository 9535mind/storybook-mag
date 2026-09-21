import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'tmp-faceswap-test', 'mobile-check')
mkdirSync(outDir, { recursive: true })

const url = process.env.STORYMAG_URL || 'https://7101f45d.storymag.pages.dev'
const user = process.env.STORYMAG_USER || ''
const pass = process.env.STORYMAG_PASS || ''

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})

const notes = []
const shot = async (name) => {
  const file = join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  notes.push(`${name}: ${page.url()}`)
}

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForTimeout(1500)
await shot('01-phone-gate')

const gate = await page.locator('#pin-gate').isVisible().catch(() => false)
if (gate && user && pass) {
  await page.fill('#auth-email', user)
  await page.fill('#auth-password', pass)
  await page.click('#auth-submit')
  await page.waitForTimeout(2500)
  await shot('02-after-login')
}

const deskTab = page.locator('#app-area-admin')
if (await deskTab.isVisible().catch(() => false)) {
  await deskTab.click()
  await page.waitForTimeout(800)
  await shot('03-desk')
  const steps = page.locator('#desk-still-steps')
  const stepsVisible = await steps.isVisible().catch(() => false)
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  const order = await page.evaluate(() => {
    const make = document.querySelector('.adult-desk__make')
    if (!make) return []
    const items = [...make.children]
      .filter((el) => getComputedStyle(el).display !== 'none')
      .map((el) => ({
        name: el.id || el.className.split(' ')[0],
        y: Math.round(el.getBoundingClientRect().top),
        h: Math.round(el.getBoundingClientRect().height),
      }))
      .sort((a, b) => a.y - b.y)
    return items.map((el) => `${el.name}@${el.y}h${el.h}`)
  })
  const box = stepsVisible ? await steps.boundingBox() : null
  notes.push(`deskTab: visible`)
  notes.push(`stepsVisible: ${stepsVisible}`)
  notes.push(`overflowX: ${overflowX}`)
  notes.push(`stack: ${order.join(' > ')}`)
  notes.push(`stepsY: ${box ? Math.round(box.y) : 'none'}`)
} else {
  notes.push('deskTab: hidden (not admin or still on gate)')
}

await browser.close()
writeFileSync(join(outDir, 'notes.txt'), notes.join('\n') + '\n')
console.log(notes.join('\n'))
