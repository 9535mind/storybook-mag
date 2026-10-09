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
    devPin: (vars.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '') || '',
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
// DESK_LOOP_TRACE=1 : /api/tale-scene 요청 본문(그림은 파일로)과 응답을 trace-*.json 으로 남긴다
let traceN = 0
if (process.env.DESK_LOOP_TRACE) {
  page.on('request', (req) => {
    if (req.method() !== 'POST' || !/\/api\/tale-scene$/.test(req.url())) return
    try {
      const body = JSON.parse(req.postData() || '{}')
      const n = ++traceN
      const imgs = (body.images || []).map((src, i) => {
        const m = String(src).match(/^data:image\/(\w+);base64,(.+)$/)
        if (!m) return String(src).slice(0, 200)
        const f = `trace-${n}-img${i}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`
        writeFileSync(path.join(OUT, f), Buffer.from(m[2], 'base64'))
        return f
      })
      writeFileSync(path.join(OUT, `trace-${n}-req.json`), JSON.stringify({ ...body, images: imgs }, null, 1))
    } catch {}
  })
  page.on('response', async (res) => {
    if (!/\/api\/tale-scene(-status)?$/.test(res.url())) return
    try {
      const j = await res.json()
      if (j.prompt || j.imageUrl || j.status === 'failed') notes.push('trace-res ' + JSON.stringify({ u: res.url().split('/').pop(), ...j }).slice(0, 700))
    } catch {}
  })
}
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
  await page.fill('#auth-password', process.env.DESK_LOOP_USE_PIN ? creds.devPin : creds.password || creds.pin)
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


const apply = async (role, file) => {
  const buf = readFileSync(file)
  return page.evaluate(async ({ b64, role }) => {
    const raw = atob(b64)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
    await window.__deskApplyCastFile(role, new File([bytes], '00-ident.jpg', { type: 'image/jpeg' }))
    return true
  }, { b64: buf.toString('base64'), role })
}
await apply('woman', ID)
await page.waitForTimeout(8000)
await apply('man', MAN_ID)
await page.waitForTimeout(8000)
notes.push('cast ' + JSON.stringify(await snap()))
await page.screenshot({ path: shot('03-cast.png'), fullPage: true })

const waitDone = async (re, ms) => {
  const end = Date.now() + ms
  let f = await snap()
  while (Date.now() < end) {
    f = await snap()
    notes.push('poll ' + JSON.stringify(f))
    if (re.test(`${f.status} ${f.form}`) && !f.bodyBusy) break
    await page.waitForTimeout(4000)
  }
  return f
}
if (!process.env.DESK_LOOP_SKIP_BODY) await page.locator('[data-desk-step="body"]').click({ force: true })
const afterBody = process.env.DESK_LOOP_SKIP_BODY ? await snap() : await waitDone(/이었습니다|전신이 안 붙|다른 사람|저장하지 않습니다|이미 전신/, 600000)
await page.screenshot({ path: shot('04-after-body.png'), fullPage: true })
for (const [k, id] of [['woman', 'desk-cast-woman-img'], ['man', 'desk-cast-man-img']]) {
  const src = await page.evaluate(async (i) => {
    const el = document.getElementById(i)
    if (!el?.src) return ''
    if (el.src.startsWith('data:')) return el.src
    const r = await fetch(el.src)
    const b = await r.blob()
    return await new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b) })
  }, id)
  const m = src.match(/^data:image\/\w+;base64,(.+)$/)
  if (m) writeFileSync(path.join(OUT, 'cast-' + k + '.jpg'), Buffer.from(m[1], 'base64'))
}
const together = page.locator('[data-desk-step="together"]')
let afterTogether = afterBody
if (!(await together.isDisabled()) && !(await together.isHidden())) {
  await together.click({ force: true })
  await page.waitForTimeout(6000)
  afterTogether = await waitDone(/한 장면|이었습니다|하지 못|실패|저장하지 않습니다/, 300000)
}
await page.screenshot({ path: shot('05-after-together.png'), fullPage: true })
const resultSrc = await page.evaluate(() => document.getElementById('result-image')?.src || '')
if (resultSrc.startsWith('data:image')) {
  const m = resultSrc.match(/^data:image\/\w+;base64,(.+)$/)
  if (m) writeFileSync(path.join(OUT, 'result.jpg'), Buffer.from(m[1], 'base64'))
} else if (/^https?:\/\//.test(resultSrc)) {
  const r = await fetch(resultSrc)
  if (r.ok) writeFileSync(path.join(OUT, 'result.jpg'), Buffer.from(await r.arrayBuffer()))
}
// DESK_LOOP_POSES=arm,hug : 한 장면 뒤에 자세 카드를 하나씩 눌러 결과를 pose-<id>.jpg 로 저장한다
const poseResults = {}
const savePage = async (file) => {
  const src = await page.evaluate(() => document.getElementById('result-image')?.src || '')
  if (src.startsWith('data:image')) {
    const m = src.match(/^data:image\/\w+;base64,(.+)$/)
    if (m) writeFileSync(path.join(OUT, file), Buffer.from(m[1], 'base64'))
  } else if (/^https?:\/\//.test(src)) {
    const r = await fetch(src)
    if (r.ok) writeFileSync(path.join(OUT, file), Buffer.from(await r.arrayBuffer()))
  }
}
const poseIds = (process.env.DESK_LOOP_POSES || '').split(',').map((s) => s.trim()).filter(Boolean)
for (let i = 0; i < poseIds.length; i += 1) {
  const id = poseIds[i]
  if (i > 0) {
    // 앞 자세 결과 위에 겹치지 않게 한 장면부터 다시 만든다(오려 붙이기, 엔진 호출 없음)
    await together.click({ force: true })
    await page.waitForTimeout(6000)
    await waitDone(/한 장면|이었습니다|하지 못|실패|저장하지 않습니다/, 300000)
  }
  const card = page.locator(`[data-desk-pick="pose"][data-id="${id}"]`)
  if (!(await card.isVisible().catch(() => false))) {
    poseResults[id] = { error: 'card_not_visible' }
    continue
  }
  if (!(await card.evaluate((el) => el.classList.contains('is-on')))) await card.click({ force: true })
  await page.locator('[data-desk-step="place"]').click({ force: true })
  await page.waitForTimeout(6000)
  const after = await waitDone(/자세를 바꿨|바꿨습니다|이었습니다|하지 못|실패|저장하지 않습니다/, 420000)
  await page.screenshot({ path: shot(`06-pose-${id}.png`), fullPage: true })
  await savePage(`pose-${id}.jpg`)
  poseResults[id] = { status: after.status, form: after.form }
  if (await card.evaluate((el) => el.classList.contains('is-on'))) await card.click({ force: true })
}
await browser.close()
writeFileSync(path.join(OUT, 'notes.txt'), notes.join(String.fromCharCode(10)))
console.log(JSON.stringify({ afterBody, afterTogether, poseResults, pageerrors, consoleErrors: consoleErrors.slice(0, 10) }, null, 2))
