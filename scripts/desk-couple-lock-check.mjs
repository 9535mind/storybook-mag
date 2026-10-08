#!/usr/bin/env node
/**
 * 남녀 한 장면 합격(잠금) 점검. 배포 전에 돌려서 합격 상태가 코드에서 유지되는지 확인한다.
 * 규칙: .cursor/rules/desk-couple-compose.mdc  (태그 desk-couple-compose-mw237)
 * 사용: node scripts/desk-couple-lock-check.mjs   (실패하면 종료 코드 1)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pipe = readFileSync(path.join(ROOT, 'public', 'desk-pipeline.js'), 'utf8')
const app = readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8')

const checks = [
  ['서버 배경 제거를 먼저 쓴다', /isolateOutpaintedPerson\(src, '', \{ localOnly: false \}\)/.test(pipe)],
  [
    '서버 결과 채택 기준(몸통 75% 이상 또는 로컬보다 나음)',
    /torsoCoverage\(remote\) >= 0\.75 \|\| torsoCoverage\(remote\) >= torsoCoverage\(canvas\)/.test(pipe),
  ],
  ['원본으로 보정 함수가 있다', /async function restoreFromSource\(cut, src, face\)/.test(pipe)],
  [
    '머리카락 복원이 둘레 배경색과 비슷한 화소를 제외한다',
    /Math\.hypot\(od\[i\] - br, od\[i \+ 1\] - bg, od\[i \+ 2\] - bb\) < 40/.test(pipe),
  ],
  ['떠 있는 작은 조각을 지운다(최대 덩어리 2% 미만)', /sizes\[lb\] < biggest \* 0\.02/.test(pipe)],
  [
    '서버 결과는 색 기반 뒷정리를 건너뛴다',
    /const keepColors = Boolean\(cut\.fromRemote\)/.test(pipe) && /if \(keepColors\) continue/.test(pipe),
  ],
  ['서버 결과는 알파 기준으로 사람 상자를 잡는다', /if \(cut\.fromRemote\)/.test(pipe)],
  ['오린 위치를 남긴다(cropRect)', /out\.cropRect = \{/.test(app)],
  [
    '머리 뒤 조명 번짐 조각을 지운다(trimGlareData, 머리 구역 15%)',
    /function trimGlareData\(d, w, h\)/.test(pipe) &&
      /Math\.round\(h \* 0\.15\)/.test(pipe) &&
      /^\s+trimGlareData\(d, w, h\)\s*$/m.test(pipe),
  ],
  [
    '두 사람 윤곽 최단 거리를 CLOSE_PX(5)로 맞춘다',
    /const CLOSE_PX = 5/.test(pipe) && /const shift = near - CLOSE_PX/.test(pipe) && /rowEdge\(a, 'right'\)/.test(pipe),
  ],
  [
    'Desk 단계 결과는 버튼 없이 항상 화질 올리기(Real-ESRGAN 2배)를 거친다',
    /const deskForceUpscale = async \(src\)/.test(app) && /imageUrl = await deskForceUpscale\(imageUrl\)/.test(app) && /Math\.max\(size\.w, size\.h\) >= 2400/.test(app),
  ],
  ['한 장면은 엔진으로 다시 그리지 않고 composePlate로 붙인다', /DeskPipeline\.composePlate\(/.test(app)],
]

let bad = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`)
  if (!ok) bad += 1
}
console.log(bad ? `\n남녀 한 장면 잠금이 깨졌습니다 (${bad}건).` : '\n남녀 한 장면 잠금 유지됨.')
process.exit(bad ? 1 : 0)
