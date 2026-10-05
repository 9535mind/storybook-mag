#!/usr/bin/env node
/** pastePixelHeadOnStanding 오프라인 시험: 앱 함수를 그대로 잘라 브라우저에서 돌린다 (API 호출 없음).
 *  사용: node scripts/pixel-head-check.mjs 원본.jpg 생성전신.jpg 결과.png */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [orig, standing, outFile] = process.argv.slice(2)
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
const names = ['loadHtmlImage', 'canvasHasTransparency', 'floodKeyStudio', 'dropStudioIslands', 'defringeCutout', 'pastePixelHeadOnStanding']
const src = names.map(grab).join('\n')
const b64 = (f) => 'data:image/' + (f.toLowerCase().endsWith('png') ? 'png' : 'jpeg') + ';base64,' + readFileSync(f).toString('base64')
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
})
const page = await browser.newPage()
await page.setContent('<html><body></body></html>')
const res = await page.evaluate(
  async ({ src, o, st }) => {
    const t = performance.now()
    const r = await new Function(`${src}; return pastePixelHeadOnStanding`)()(st, o)
    return { url: r.url, log: r.log, ms: Math.round(performance.now() - t) }
  },
  { src, o: b64(orig), st: b64(standing) },
)
console.log(JSON.stringify({ ...res, url: res.url ? res.url.length : 0 }))
if (res.url) writeFileSync(outFile, Buffer.from(res.url.split(',')[1], 'base64'))
await browser.close()
