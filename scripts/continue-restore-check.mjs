#!/usr/bin/env node
/** restoreOriginalPhotoOnContinued 오프라인 시험 (API 없음). 모델이 사진을 다른 크기·위치로 다시 그린 경우를 흉내 낸다.
 *  사용: node scripts/continue-restore-check.mjs 원본사진 출력폴더 */
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
const src = ['loadHtmlImage', 'samplePhotoBottomRgb', 'buildBodyContinueCanvas', 'restoreOriginalPhotoOnContinued'].map(grab).join('\n')
const b64 = (f) => 'data:image/' + (f.toLowerCase().endsWith('png') ? 'png' : 'jpeg') + ';base64,' + readFileSync(f).toString('base64')
const br = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' })
const page = await br.newPage(); await page.setContent('<html></html>')
const res = await page.evaluate(async ({ src, u }) => {
  const f = new Function(src + '; return { buildBodyContinueCanvas, restoreOriginalPhotoOnContinued, loadHtmlImage }')()
  const prepared = await f.buildBodyContinueCanvas(u, [864, 1152], { faceH: 0.45 })
  const canvasImg = await f.loadHtmlImage(prepared.image)
  const out = []
  // 경우: [이름, 확대 배율(가운데 위 기준), 가로 이동, 세로 이동]
  for (const [name, k, sx, sy] of [['same', 1, 0, 0], ['bigger1.15', 1.15, 0, 0], ['shift', 1, 14, 22], ['bigger1.3+shift', 1.3, -12, 10], ['far', 1.55, 70, 95], ['small0.8', 0.8, -40, 30]]) {
    const c = document.createElement('canvas'); c.width = 880; c.height = 1184
    const x = c.getContext('2d')
    x.fillStyle = '#7a6f66'; x.fillRect(0, 0, 880, 1184)
    // 모델 출력 흉내: 캔버스 전체를 위쪽 가운데 기준으로 k배 늘려 그린다(사진 내용이 그만큼 커지고 옮겨짐)
    const cx = 440, top = 0
    x.save(); x.translate(cx + sx, top + sy); x.scale(k * 880 / 864, k * 1184 / 1152); x.translate(-864 / 2, 0)
    x.drawImage(canvasImg, 0, 0); x.restore()
    x.fillStyle = 'rgba(0,0,255,0.25)'; x.fillRect(0, 700, 880, 484) // 아래쪽은 생성 영역처럼 색을 바꿈
    const fake = c.toDataURL('image/jpeg', 0.92)
    const r = await f.restoreOriginalPhotoOnContinued(fake, prepared, u)
    out.push({ name, log: r.log, ok: Boolean(r.url), url: r.url, fake })
  }
  return out
}, { src, u: b64(input) })
for (const r of res) {
  console.log(r.name, JSON.stringify({ ok: r.ok, ...r.log }))
  writeFileSync(path.join(outDir, `fake_${r.name}.jpg`), Buffer.from(r.fake.split(',')[1], 'base64'))
  if (r.url) writeFileSync(path.join(outDir, `restored_${r.name}.jpg`), Buffer.from(r.url.split(',')[1], 'base64'))
}
await br.close()
