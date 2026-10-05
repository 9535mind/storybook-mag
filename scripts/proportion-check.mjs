#!/usr/bin/env node
/** fixManProportions 오프라인 시험 (API 없음). 사용: node scripts/proportion-check.mjs 입력.jpg 결과.png */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [input, outFile] = process.argv.slice(2)
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
const src = ['loadHtmlImage', 'fixManProportions'].map(grab).join('\n')
const b64 = (f) => 'data:image/' + (f.toLowerCase().endsWith('png') ? 'png' : 'jpeg') + ';base64,' + readFileSync(f).toString('base64')
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
})
const page = await browser.newPage()
await page.setContent('<html><body></body></html>')
const res = await page.evaluate(
  async ({ src, u }) => {
    window.__deskPropLog = null
    const t = performance.now()
    const url = await new Function(`${src}; return fixManProportions`)()(u)
    return { url, log: window.__deskPropLog, ms: Math.round(performance.now() - t) }
  },
  { src, u: b64(input) },
)
console.log(JSON.stringify({ ...res, url: res.url === b64(input) ? 'unchanged' : res.url.length }))
if (res.url && res.url.startsWith('data:image/png')) writeFileSync(outFile, Buffer.from(res.url.split(',')[1], 'base64'))
await browser.close()
