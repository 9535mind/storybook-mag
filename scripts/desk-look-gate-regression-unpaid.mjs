#!/usr/bin/env node
/**
 * 기존 원본·원출력·합성본으로 LOOK 게이트 회귀표.
 * 성공 표본 없음. 게이트 완성이 아님. fal / Wan / 배포 없음.
 */
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastJson } from './desk-look-backend-node.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-gate-regression')
const BUNDLE = path.join(ROOT, '_tmp_bundle')
const PAID = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-paid-woman-full')
const AUDIT = path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit')
const PROOF = path.join(ROOT, 'tmp-faceswap-test', 'desk-composite-proof')

mkdirSync(OUT, { recursive: true })
mkdirSync(BUNDLE, { recursive: true })

function esbuild(entry, outfile, extra = '--platform=node --format=cjs') {
  execSync(`node_modules\\.bin\\esbuild "${entry}" --bundle ${extra} --outfile="${outfile}"`, {
    cwd: ROOT,
    stdio: 'pipe',
  })
}

esbuild('functions/lib/desk-look-visual-gate.ts', path.join(BUNDLE, 'desk-look-visual-gate.cjs'))
esbuild('functions/lib/desk-clothes-parse.ts', path.join(BUNDLE, 'desk-clothes-parse.cjs'))
esbuild('functions/lib/desk-look-preflight.ts', path.join(ROOT, 'public', 'desk-look-preflight.js'), '--format=iife --global-name=DeskLookLib')

const visual = await import(`file://${path.join(BUNDLE, 'desk-look-visual-gate.cjs')}?t=${Date.now()}`)
const parseMod = await import(`file://${path.join(BUNDLE, 'desk-clothes-parse.cjs')}?t=${Date.now()}`)

function dump(imagePath, rawPath, gray, resize) {
  const raw = execFileSync(
    'py',
    [
      '-3',
      '-c',
      `
import json, sys
from PIL import Image
import numpy as np
from pathlib import Path
job = json.loads(sys.stdin.read())
im = Image.open(job["image"])
if job.get("gray"):
    im = im.convert("L")
else:
    im = im.convert("RGBA")
if job.get("resize"):
    im = im.resize((int(job["resize"][0]), int(job["resize"][1])), Image.BILINEAR)
Path(job["out"]).write_bytes(np.asarray(im, dtype=np.uint8).tobytes())
print(json.dumps({"width": im.size[0], "height": im.size[1]}))
`,
    ],
    {
      input: JSON.stringify({ image: imagePath, out: rawPath, gray: Boolean(gray), resize: resize || null }),
      encoding: 'utf8',
      timeout: 60000,
    },
  )
  return lastJson(raw)
}

function maskFromGray(buf) {
  const out = new Uint8Array(buf.length)
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] >= 128 ? 255 : 0
  return out
}

function loadLabels(id) {
  const p = path.join(AUDIT, id, 'labels.u8')
  if (!existsSync(p)) return null
  const ids = readFileSync(p)
  return Array.from(ids, (id) => parseMod.CLOTHES_PARSE_LABELS[id] || 'Background')
}

function regionMasks(labels, width, height, layout) {
  if (!labels) return { upper: null, lower: null }
  return parseMod.assembleClothesRegionMasks({
    labels,
    width,
    height,
    woman: layout?.woman || { x: 0, y: 0, w: 1, h: 1 },
    man: layout?.man || null,
  })
}

function runCase(item) {
  const dir = path.join(OUT, item.id)
  mkdirSync(dir, { recursive: true })
  const srcMeta = dump(item.src, path.join(dir, 'src.rgba'), false, null)
  dump(item.out, path.join(dir, 'out.rgba'), false, [srcMeta.width, srcMeta.height])
  dump(item.mask, path.join(dir, 'mask.gray'), true, [srcMeta.width, srcMeta.height])
  const src = new Uint8Array(readFileSync(path.join(dir, 'src.rgba')))
  const out = new Uint8Array(readFileSync(path.join(dir, 'out.rgba')))
  const mask = maskFromGray(readFileSync(path.join(dir, 'mask.gray')))
  const labels = item.labelsId ? loadLabels(item.labelsId) : null
  if (labels && labels.length !== srcMeta.width * srcMeta.height) {
    throw new Error(`labels size ${item.id}`)
  }
  const regions = labels ? regionMasks(labels, srcMeta.width, srcMeta.height, item.layout) : null
  const gate = visual.gateLookVisual({
    src,
    out,
    mask,
    width: srcMeta.width,
    height: srcMeta.height,
    labels: labels || undefined,
    upperMask: regions?.upper,
    lowerMask: regions?.lower,
  })
  const body = labels ? parseMod.bodyGuidesFromLabels(labels, srcMeta.width, srcMeta.height) : null
  return { gate, body, width: srcMeta.width, height: srcMeta.height }
}

function checkExpect(item, gate) {
  const misses = []
  const u = gate.upper
  const l = gate.lower
  if (item.expectOverallFail === true && gate.ok) misses.push('overall_should_fail')
  if (item.expectOverallFail === false && !gate.ok) misses.push('overall_should_pass')
  for (const [name, r] of [
    ['upper', u],
    ['lower', l],
  ]) {
    const ex = item.expect?.[name]
    if (!ex) continue
    if (ex.present === true && !r.present) misses.push(`${name}_absent`)
    if (ex.clothesGoalFail === true && r.changeOk) misses.push(`${name}_clothes_goal_should_fail`)
    if (ex.clothesGoalFail === false && r.present && !r.changeOk) misses.push(`${name}_clothes_goal_should_pass_change`)
    if (ex.silhouettePass === true && r.present && !r.silhouette.ok) misses.push(`${name}_silhouette_false_fail`)
    if (ex.seamPass === true && r.present && !r.seam.ok) misses.push(`${name}_seam_false_fail`)
  }
  return misses
}

const CASES = [
  {
    id: 'visual_fail-composite',
    title: '유료 실패 합성 03-composite',
    kind: 'visual_fail',
    src: path.join(PAID, '00-source.jpg'),
    out: path.join(PAID, '03-composite.png'),
    mask: path.join(PAID, '01-mask.png'),
    labelsId: 'woman-full',
    expectOverallFail: true,
    expect: {
      upper: { present: true, clothesGoalFail: true, silhouettePass: true, seamPass: true },
      lower: { present: true, clothesGoalFail: true, silhouettePass: true, seamPass: true },
    },
  },
  {
    id: 'visual_fail-model-raw',
    title: '유료 실패 원출력 02-model-raw',
    kind: 'visual_fail_raw',
    src: path.join(PAID, '00-source.jpg'),
    out: path.join(PAID, '02-model-raw.png'),
    mask: path.join(PAID, '01-mask.png'),
    labelsId: 'woman-full',
    expectOverallFail: true,
    expect: {
      upper: { present: true, clothesGoalFail: true },
      lower: { present: true, clothesGoalFail: true },
    },
  },
  {
    id: 'protect-identity-woman-full',
    title: '원본=합성 (보호·경계 정상)',
    kind: 'protect_identity',
    src: path.join(PAID, '00-source.jpg'),
    out: path.join(PAID, '00-source.jpg'),
    mask: path.join(PAID, '01-mask.png'),
    labelsId: 'woman-full',
    expectOverallFail: true,
    expect: {
      upper: { present: true, clothesGoalFail: true, silhouettePass: true, seamPass: true },
      lower: { present: true, clothesGoalFail: true, silhouettePass: true, seamPass: true },
    },
  },
  {
    id: 'protect-audit-magenta-woman-full',
    title: '진단 합성 (흰=마젠타, 검정=원본)',
    kind: 'protect_rule',
    src: path.join(AUDIT, 'woman-full', '00-source.png'),
    out: path.join(AUDIT, 'woman-full', '04-composite-rule.png'),
    mask: path.join(AUDIT, 'woman-full', '02-mask-white.png'),
    labelsId: 'woman-full',
    expectOverallFail: null,
    expect: {
      upper: { present: true, clothesGoalFail: false, silhouettePass: true },
      lower: { present: true, clothesGoalFail: false, silhouettePass: true },
    },
  },
  {
    id: 'protect-identity-couple-left',
    title: '커플 원본=합성 (보호·경계 정상)',
    kind: 'protect_identity',
    src: path.join(AUDIT, 'couple-woman-left', '00-source.png'),
    out: path.join(AUDIT, 'couple-woman-left', '00-source.png'),
    mask: path.join(AUDIT, 'couple-woman-left', '02-mask-white.png'),
    labelsId: 'couple-woman-left',
    layout: JSON.parse(readFileSync(path.join(AUDIT, 'couple-woman-left', 'facts.json'), 'utf8')).layout,
    expectOverallFail: true,
    expect: {
      upper: { present: true, clothesGoalFail: true, silhouettePass: true, seamPass: true },
      lower: { present: true, clothesGoalFail: true, silhouettePass: true, seamPass: true },
    },
  },
]

if (existsSync(path.join(PROOF, 'src.png')) && existsSync(path.join(PROOF, 'out.png'))) {
  CASES.push({
    id: 'protect-proof-tiny',
    title: '합성 규칙 소형 보호본',
    kind: 'protect_rule',
    src: path.join(PROOF, 'src.png'),
    out: path.join(PROOF, 'out.png'),
    mask: path.join(PROOF, 'mask.png'),
    expectOverallFail: null,
    expect: {},
  })
}

const rows = []
for (const item of CASES) {
  if (!existsSync(item.src) || !existsSync(item.out) || !existsSync(item.mask)) {
    rows.push({ id: item.id, skipped: true, reason: 'missing_artifact' })
    continue
  }
  const { gate, body } = runCase(item)
  const misses = checkExpect(item, gate)
  const row = {
    id: item.id,
    title: item.title,
    kind: item.kind,
    complete: false,
    clothesGoalKind: 'change_only',
    ok: gate.ok,
    reason: gate.reason,
    failReasons: gate.failReasons,
    together: gate.regions.together,
    body,
    upper: {
      present: gate.upper.present,
      n: gate.upper.n,
      mad: gate.upper.mad,
      corr: gate.upper.corr,
      changeOk: gate.upper.changeOk,
      targetUnverified: true,
      silhouette: gate.upper.silhouette,
      seam: gate.upper.seam,
      failReasons: gate.upper.failReasons,
    },
    lower: {
      present: gate.lower.present,
      n: gate.lower.n,
      mad: gate.lower.mad,
      corr: gate.lower.corr,
      changeOk: gate.lower.changeOk,
      targetUnverified: true,
      silhouette: gate.lower.silhouette,
      seam: gate.lower.seam,
      failReasons: gate.lower.failReasons,
    },
    combinedDiagnosticNotUsedForPass: gate.regions.all,
    expectMisses: misses,
    rowOk: misses.length === 0,
  }
  rows.push(row)
  console.log(
    `${item.id} overall=${gate.ok ? 'pass' : 'fail:' + gate.reason} U mad=${gate.upper.mad.toFixed(2)} corr=${gate.upper.corr.toFixed(3)} sil=${gate.upper.silhouette.ok} seam=${gate.upper.seam.ok} | L mad=${gate.lower.mad.toFixed(2)} corr=${gate.lower.corr.toFixed(3)} sil=${gate.lower.silhouette.ok} seam=${gate.lower.seam.ok} misses=${misses.join(',') || 'none'}`,
  )
}

const visualFail = rows.find((r) => r.id === 'visual_fail-composite')
const identity = rows.filter((r) => r.kind === 'protect_identity')
const report = {
  paidCallsThisStep: 0,
  wanCalled: false,
  deploy: false,
  gateComplete: false,
  successSamplePresent: false,
  clothesGoalKind: 'change_only',
  note: 'clothes_goal는 변화량만 본다. 피부·슬립 목표 충족은 미검증. 성공 표본이 없어 게이트 완성이 아니다.',
  visualFailBlocked: visualFail && visualFail.ok === false && visualFail.rowOk === true,
  identitySilSeamHeld: identity.every((r) => r.rowOk === true),
  rows,
}

function num(v, d = 2) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '—'
}

function cell(r, side) {
  const x = r[side]
  if (!x || r.skipped) return '<td colspan="8">skip</td>'
  const fails = (x.failReasons || []).join(',') || (x.present ? 'ok' : 'absent')
  return `<td>${x.present ? 'yes' : 'no'}</td><td>${x.n}</td><td>${num(x.mad)}</td><td>${num(x.corr, 3)}</td><td>${num(x.silhouette?.outWidth, 1)} / ${num(x.silhouette?.bodyMin, 1)} / ${num(x.silhouette?.clothingWidth, 1)}</td><td>${x.silhouette?.ok ? 'pass' : 'fail'}</td><td>lumRel ${num(x.seam?.lumRel, 2)} tex ${num(x.seam?.texRatio, 2)}</td><td>${x.seam?.ok ? 'pass' : 'fail'} / ${fails}</td>`
}

const html = `<!doctype html>
<meta charset="utf-8">
<title>LOOK 게이트 회귀 — 미완성</title>
<style>
body{font:14px/1.4 sans-serif;margin:24px;color:#111}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f3f3f3}
.bad{background:#f8d0d0}
.ok{background:#e3f3e3}
.warn{background:#fff4cc}
</style>
<h1>LOOK 게이트 회귀표</h1>
<p><b>게이트 완성 아님.</b> 성공 표본 없음. clothes_goal는 변화량만 측정한다. 유료 호출 0 · 배포 금지.</p>
<p>visual_fail 차단: ${report.visualFailBlocked ? '성공' : '실패'} · 보호본 실루엣/seam 유지: ${report.identitySilSeamHeld ? '성공' : '실패'}</p>
<table>
<tr>
  <th>표본</th><th>전체</th>
  <th>상 present</th><th>상 n</th><th>상 MAD</th><th>상 corr</th><th>상 폭 out/bodyMin/옷</th><th>상 sil</th><th>상 seam</th><th>상 판정</th>
  <th>하 present</th><th>하 n</th><th>하 MAD</th><th>하 corr</th><th>하 폭 out/bodyMin/옷</th><th>하 sil</th><th>하 seam</th><th>하 판정</th>
  <th>기대</th>
</tr>
${rows
  .map((r) => {
    const cls = r.skipped ? '' : r.rowOk ? 'ok' : 'bad'
    return `<tr class="${cls}"><td>${r.id}<br>${r.title || ''}</td><td>${r.skipped ? 'skip' : r.ok ? 'pass' : 'fail:' + r.reason}</td>${cell(r, 'upper')}${cell(r, 'lower')}<td>${(r.expectMisses || []).join(', ') || 'match'}</td></tr>`
  })
  .join('\n')}
</table>
<p class="warn">자동 성공 판정은 미검증입니다. 피부·슬립으로 바뀐 성공 장이 오면 그때 목표 게이트를 붙입니다.</p>
`
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
writeFileSync(path.join(OUT, 'index.html'), html)
console.log(
  JSON.stringify(
    {
      paidCallsThisStep: 0,
      gateComplete: false,
      successSamplePresent: false,
      visualFailBlocked: report.visualFailBlocked,
      identitySilSeamHeld: report.identitySilSeamHeld,
      rowFails: rows.filter((r) => r.rowOk === false).map((r) => r.id),
    },
    null,
    2,
  ),
)
if (!report.visualFailBlocked || !report.identitySilSeamHeld) process.exit(1)
if (rows.some((r) => r.rowOk === false)) process.exit(1)
