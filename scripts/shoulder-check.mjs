#!/usr/bin/env node
/** narrowManShoulders 오프라인 시험 (API 없음). 사용: node scripts/shoulder-check.mjs 입력.png 결과.png [배율] */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [input, outFile, factor] = process.argv.slice(2)
const app = readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8')
const grab = (name) => {
  const m = new RegExp(String.raw`\n  (async )?function ${name}\b`).exec(app)
  if (!m) throw new Error('missing ' + name)
  const i = app.indexOf('{', app.indexOf(')', m.index))
  let depth = 0
  for (let k = i; k < app.length; k += 1) {
    if (app[k] === '{') depth += 1
    else if (app[k] === '}' && --depth === 0) return app.slice(m.index, k + 1)
  }
}
const src = ['loadHtmlImage', 'narrowManShoulders'].map(grab).join('\n')
const b64 = (f) => 'data:image/' + (f.toLowerCase().endsWith('png') ? 'png' : 'jpeg') + ';base64,' + readFileSync(f).toString('base64')
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
})
const page = await browser.newPage()
await page.setContent('<html><body></body></html>')
const res = await page.evaluate(
  async ({ src, u, f }) => {
    if (f) window.__deskShoulderScale = Number(f)
    const url = await new Function(`${src}; return narrowManShoulders`)()(u)
    return { url, log: window.__deskShoulderLog }
  },
  { src, u: b64(input), f: factor || '' },
)
console.log(JSON.stringify({ log: res.log, changed: res.url !== b64(input) }))
if (res.url) writeFileSync(outFile, Buffer.from(res.url.split(',')[1], 'base64'))
await browser.close()
