#!/usr/bin/env node
/**
 * 무과금. "옷이 녹았는가" 판정만 따로 검사한다.
 * mad = 화소 차이 크기, corr = 원래 옷 무늬와의 상관.
 * 비슷한 색 옷으로 바꾸면 mad는 작고 corr만 무너진다 — 그걸 통과시키되
 * 안 바뀐 것과 톤만 옮긴 것은 계속 막아야 한다.
 */
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(path.join(ROOT, '_tmp_bundle'), { recursive: true })
const out = path.join(ROOT, '_tmp_bundle', 'visual-gate.cjs')
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-look-visual-gate.ts" --bundle --platform=node --format=cjs --outfile="${out}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const gate = await import(`file://${out}?t=${Date.now()}`)

const N = 5000 // 마스크 최소 화소를 넘는 값
const cases = [
  // 사용자가 실제로 거절당한 값. 슬립으로 제대로 바뀐 결과다.
  { name: 'live-slip-lower', mad: 21.08, corr: 0.11, want: true },
  { name: 'live-slip-upper', mad: 25.21, corr: 0.51, want: true },
  // 기록된 실패. 옷이 거의 그대로다.
  { name: 'recorded-fail-composite-upper', mad: 13.7, corr: 0.885, want: false },
  { name: 'recorded-fail-composite-lower', mad: 9.11, corr: 0.833, want: false },
  { name: 'recorded-fail-modelraw-upper', mad: 14.1, corr: 0.881, want: false },
  { name: 'recorded-fail-modelraw-lower', mad: 9.66, corr: 0.816, want: false },
  // 아무것도 안 바뀐 경우.
  { name: 'identical', mad: 0, corr: 1, want: false },
  // 톤만 옮긴 경우. 무늬는 그대로라 corr이 높다.
  { name: 'tone-shift-only', mad: 15, corr: 0.95, want: false },
  // 무늬는 무너졌는데 차이가 너무 작은 경우. 잡음일 수 있으니 막는다.
  { name: 'decorrelated-but-tiny', mad: 6, corr: 0.1, want: false },
  // 확실히 큰 변화.
  { name: 'strong-change', mad: 30, corr: 0.6, want: true },
  // 마스크가 거의 안 열린 영역은 판정하지 않는다.
  { name: 'region-too-small', n: 10, mad: 0, corr: 1, want: true },
]

const rows = cases.map((c) => {
  const got = gate.changeOk({ n: c.n ?? N, mad: c.mad, corr: c.corr })
  return { ...c, n: c.n ?? N, got, pass: got === c.want }
})

const report = {
  newPaidCall: false,
  thresholds: {
    WHITE_MAD_MIN: gate.WHITE_MAD_MIN,
    WHITE_CORR_MAX: gate.WHITE_CORR_MAX,
    WHITE_CORR_STRONG: gate.WHITE_CORR_STRONG,
    WHITE_MAD_FLOOR: gate.WHITE_MAD_FLOOR,
  },
  rows,
  failed: rows.filter((r) => !r.pass).map((r) => r.name),
  ok: rows.every((r) => r.pass),
}
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
