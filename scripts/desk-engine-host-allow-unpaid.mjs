#!/usr/bin/env node
/**
 * 무과금. 우리가 부르는 엔진이 결과를 돌려주는 호스트가 미디어 허용 목록에 있는지.
 *
 * 없으면 생성은 성공하는데 화면에는 "그림이 안 붙었습니다" 로만 보인다(실측).
 * 서버·노드 검증은 프록시를 안 거치므로 이 결함을 잡지 못한다 — 그래서 여기서 잡는다.
 */
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE = path.join(ROOT, '_tmp_bundle')
mkdirSync(BUNDLE, { recursive: true })
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/media-url.ts" --bundle --platform=node --format=cjs --outfile="${path.join(BUNDLE, 'media-url.cjs')}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const { isAllowedMediaUrl } = await import(`file://${path.join(BUNDLE, 'media-url.cjs')}?t=${Date.now()}`)

const cases = [
  // 슬립 LOOK — FASHN 은 자기 CDN 으로 돌려준다. fal.ai 가 아니다.
  ['fashn-vton', 'https://cdn.fashn.ai/01a0be1b-dfdb-78c2-b479-60d0f9b32ada/output_0.png', true],
  // 나체 LOOK·그 밖 fal 경로
  ['fal-media', 'https://v3.fal.media/files/panda/Hoy3zhimzVKi3F2uoGBnh_result.png', true],
  ['fal-media-b', 'https://v3b.fal.media/files/b/monkey/5ZWXSKUuk9EilI1apFCeu_x.png', true],
  // 쇼츠
  ['replicate', 'https://replicate.delivery/pbxt/abc/out.mp4', true],
  // 영구 저장
  ['r2', 'https://pub-abc.r2.dev/storymag/x.png', true],
  // 임의 URL 은 계속 막혀야 한다 (SSRF·비용 남용)
  ['random-host', 'https://evil.example.com/x.png', false],
  ['localhost', 'https://localhost/x.png', false],
  ['private-ip', 'https://192.168.0.5/x.png', false],
  ['http-not-https', 'http://cdn.fashn.ai/x.png', false],
  // fashn.ai 를 흉내 낸 남의 도메인은 막혀야 한다
  ['lookalike', 'https://cdn.fashn.ai.evil.com/x.png', false],
]

const rows = cases.map(([name, url, want]) => {
  const got = isAllowedMediaUrl(url)
  return { name, want, got, ok: got === want }
})
const ok = rows.every((r) => r.ok)
console.log(JSON.stringify({ ok, rows }, null, 2))
if (!ok) process.exit(1)
