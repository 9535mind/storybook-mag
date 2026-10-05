#!/usr/bin/env node
/** 장면 이어 그리기 캔버스·복원 오프라인 시험 (API 없음). 사용: node scripts/continue-canvas-check.mjs 원본사진 출력폴더 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [input, outDir] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const app = readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8')
const grab = (name) => {
  const m = new RegExp(String.raw`\n  (async )?function ${name}\b`).exec(app)
  if (!m) throw new Error('missing ' + name)
  const i = app.indexOf('{', app.indexOf(')', m.index)); let d = 0
  for (let k = i; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && --d === 0) return app.slice(m.index, k + 1) }
}
const src = ['loadHtmlImage', 'samplePhotoBottomRgb', 'buildBodyContinueCanvas', 'restoreProtectedExtendPixels'].map(grab).join('\n')
const b64 = (f) => 'data:image/' + (f.toLowerCase().endsWith('png') ? 'png' : 'jpeg') + ';base64,' + readFileSync(f).toString('base64')
const br = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' })
const page = await br.newPage(); await page.setContent('<html></html>')
const res = await page.evaluate(async ({ src, u }) => {
  const f = new Function(src + '; return { buildBodyContinueCanvas, restoreProtectedExtendPixels, loadHtmlImage }')()
  const prepared = await f.buildBodyContinueCanvas(u, [864, 1152], { faceH: 0.45 })
  // 모델 출력 대신: 캔버스를 880x1184 로 늘려 전체를 어둡게(= 원본 영역도 바뀐 것처럼)
  const img = await f.loadHtmlImage(prepared.image)
  const c = document.createElement('canvas'); c.width = 880; c.height = 1184
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, 880, 1184)
  x.fillStyle = 'rgba(0,0,255,0.35)'; x.fillRect(0, 0, 880, 1184)
  const fake = c.toDataURL('image/jpeg', 0.92)
  const restored = await f.restoreProtectedExtendPixels(fake, prepared)
  return { prepared: { image: prepared.image, mask: prepared.mask, dx: prepared.dx, dw: prepared.dw, dh: prepared.dh, cw: prepared.cw, ch: prepared.ch }, fake, restored }
}, { src, u: b64(input) })
const w = (n, d) => writeFileSync(path.join(outDir, n), Buffer.from(d.split(',')[1], 'base64'))
w('canvas.jpg', res.prepared.image); w('mask.png', res.prepared.mask); w('fake.jpg', res.fake); w('restored.jpg', res.restored)
console.log(JSON.stringify({ layout: { dx: res.prepared.dx, dw: res.prepared.dw, dh: res.prepared.dh, cw: res.prepared.cw, ch: res.prepared.ch } }))
await br.close()
