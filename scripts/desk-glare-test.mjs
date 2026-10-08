#!/usr/bin/env node
/**
 * 머리 뒤 조명 번짐 조각 제거(trimHeadGlare) 시험.
 * 사용자가 만든 한 장면 결과에서 남자를 오려(배경색을 투명으로) 처리 전/후를 마젠타 배경에 그려 저장한다. 엔진 호출 없음.
 * 사용: DESK_LOOP_BASE=https://... node scripts/desk-glare-test.mjs <한장면.jpg> <출력폴더>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const [src, outDir] = process.argv.slice(2)
const BASE = process.env.DESK_LOOP_BASE || 'https://storymag.pages.dev'
mkdirSync(outDir, { recursive: true })
const b64 = 'data:image/jpeg;base64,' + readFileSync(src).toString('base64')
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.DeskPipeline && typeof window.DeskPipeline.trimHeadGlare === 'function', {
  timeout: 20000,
})
const res = await page.evaluate(async (url) => {
  const img = await new Promise((ok, no) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = no
    i.src = url
  })
  // 남자 영역(오른쪽 사람)만 떼고, 배경 회색을 투명으로 만든다
  const X0 = 960
  const W = 380
  const c = document.createElement('canvas')
  c.width = W
  c.height = img.naturalHeight
  const cx = c.getContext('2d', { willReadFrequently: true })
  cx.drawImage(img, X0, 0, W, img.naturalHeight, 0, 0, W, img.naturalHeight)
  const id = cx.getImageData(0, 0, W, c.height)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    if (Math.hypot(d[i] - 66, d[i + 1] - 71, d[i + 2] - 77) < 20) d[i + 3] = 0
  }
  cx.putImageData(id, 0, 0)
  const mk = (cv) => {
    const o = document.createElement('canvas')
    o.width = 380
    o.height = 260
    const x = o.getContext('2d')
    x.fillStyle = '#ff00ff'
    x.fillRect(0, 0, 380, 260)
    x.drawImage(cv, 0, 80, 380, 260, 0, 0, 380, 260)
    return o.toDataURL('image/png')
  }
  const before = mk(c)
  window.DeskPipeline.trimHeadGlare(c)
  const after = mk(c)
  // 머리카락이 남았는지: 처리 후 머리 구역의 불투명 화소 수 비교는 호출 쪽에서 눈으로 본다
  return { before, after }
}, b64)
writeFileSync(path.join(outDir, 'before.png'), Buffer.from(res.before.split(',')[1], 'base64'))
writeFileSync(path.join(outDir, 'after.png'), Buffer.from(res.after.split(',')[1], 'base64'))
await browser.close()
console.log('saved', outDir)
