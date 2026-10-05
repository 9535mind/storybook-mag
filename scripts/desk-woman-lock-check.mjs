#!/usr/bin/env node
/**
 * 여자 몸 잇기 잠금 점검(2026-10-05 수정 상태). 배포 전에 돌려서 코드에서 유지되는지 확인한다.
 * 규칙: .cursor/rules/desk-woman-body-extend.mdc  (태그 desk-woman-extend-mw186)
 * 사용: node scripts/desk-woman-lock-check.mjs   (실패하면 종료 코드 1)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const app = readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8')
const tale = readFileSync(path.join(ROOT, 'functions', 'api', 'tale-scene.ts'), 'utf8')

const checks = [
  ['단색 배경 판정 함수가 있다', /async function idPhotoLooksPlain\(/.test(app)],
  ['배경 기준 표준편차 30·좌우 차 35', /std < 30 && Math\.abs\(ls \/ Math\.max\(1, ln\) - rs \/ Math\.max\(1, rn\)\) < 35/.test(app)],
  ['엄격 조건: 단색 배경이 아니면 얼굴 얹기를 건너뜀', /opts\?\.strict && !\(await idPhotoLooksPlain\(sourceUrl\)\)/.test(app)],
  ['엄격 조건: 일치도 0.8 미만이면 건너뜀', /opts\?\.strict && fine\.score < 0\.8/.test(app)],
  ['여자도 얼굴 얹기를 시도(엄격 조건, 머리 1.0)', /isManHold \? undefined : \{ strict: true/.test(app) && /__deskHeadShrinkWoman/.test(app) && /__deskPixelHeadWoman/.test(app)],
  ['얼굴 얹기가 안 되면 교체 엔진으로 넘어간다', /specs = \[\s*\{ engine: 'insight', gender \}/.test(app)],
  ['단색 증명사진 여자는 faceHold 를 건너뛴다', /\|\| plainSource\)\)/.test(app)],
  ['여자는 얼굴 뒤 fitKoreanWomanCanon 을 거친다', /const fitted = await fitKoreanWomanCanon\(result\.display\)/.test(app)],
  ['팔 보정이 측정 기반이다(손끝 0.36 미만이면 0.385로)', /async function shortenWomanArmsInPlace/.test(app) && /floorH >= 0\.36/.test(app) && /\(0\.385 - floorH\) \* Hc/.test(app)],
  ['팔 보정: 최대 20%까지만 줄이고 길지 않으면 그대로', /Math\.max\(0\.8, Math\.min\(1, \(L - delta\) \/ L\)\)/.test(app) && /log\.skip = 'arms_ok'/.test(app)],
  ['옛 열 띠 팔 보정(직사각형 이음새)이 없다', !/Math\.round\(iw \* 0\.292\)/.test(app)],
  ['일상 사진 여자는 장면 이어 그리기 경로를 탄다', /isWomanBody && !drawn && !plainSource && window\.__deskWomanContinue !== false/.test(app)],
  ['이어 그리기: 3:4 캔버스 + 원본 화소 복원', /buildBodyContinueCanvas\(source, \[864, 1152\], \{ faceH \}\)/.test(app) && /\(0\.18 \* ch\) \/ headFrac \/ ih/.test(app) && /restoreOriginalPhotoOnContinued\(alt\.display, prepared, source\)/.test(app)],
  ['이어 그리기: 보호 마스크 90%·가장자리 부드럽게', /Math\.round\(dh \* 0\.9\)/.test(app) && /1 - md\[i\] \/ 255/.test(app)],
  ['이어 그리기 시간은 최대 110초', /'continue', undefined, 110\)/.test(app) && /Math\.min\(capSec \|\| 200, left\)/.test(app)],
  ['이어 그리기 최대 2번, 실패하면 가짜 얼굴로 대신하지 않고 멈춘다', /attempt < 2/.test(app) && /가짜 얼굴로 대신하지 않습니다/.test(app) && /__deskWomanContinueFallback/.test(app)],
  ['멈춘 이유를 일반 실패 문구가 덮어쓰지 않는다(deskBodyFail)', /function deskBodyFail\(defaultText\)/.test(app) && /window\.__deskBodyStop = \{ at: Date\.now\(\), text: stop \}/.test(app) && (app.match(/deskBodyFail\(/g) || []).length >= 6],
  ['이어 그리기 복원 탐색 범위(확대 0.7~1.7, 이동 ±150px)', /\[0\.7, 0\.78, 0\.86, 0\.94, 1, 1\.07, 1\.15, 1\.25, 1\.36, 1\.5, 1\.7\]/.test(app) && /oy = -50; oy <= 50; oy \+= 3/.test(app)],
  ['이어 그리기 결과가 그려졌는지(unpainted) 검사', /tryLog\.paint < 4/.test(app) && /'unpainted'/.test(app)],
  ['여자 서서 전신: 증명사진의 옷 그대로(검정 정장 강제 없음)', !/Black office blazer/.test(tale) && /Keep EXACTLY the clothes visible in the identity image: the same top and the same jacket if she wears one/.test(tale)],
  [
    '낡은 얼굴 붙이기 함수가 없다(타원 스티커·원본 얼굴 도장)',
    ['stampOriginalFaceOnExtend', 'keepOriginalIdOnExtend', 'insightLockOntoTarget', 'cropHeadFromSide', 'faceSwapSourceFromPhoto', 'stampDeskCastFaces'].every(
      (n) => !new RegExp('\\b' + n + '\\b').test(app),
    ),
  ],
  [
    '여자 이어 그리기·서서 전신 줄에 베이지 판·타원 스티커·카탈로그 모델 문구가 없다',
    !/Keep the exact same clothes already in the photograph[^`]*(catalog model|beige plate|oval)/.test(tale) &&
      !/Same face as the identity image\.[^\n]*(beige plate|oval face sticker)/.test(tale),
  ],
  ['종아리를 굵게 그리라는 문구가 없다', !/Thick healthy thighs and calves/.test(tale) && /slim calves that taper to slim ankles/.test(tale)],
  ['서버 이어 그리기 모드 문구(좌우 여백 포함)', /stretched empty space below it and at both sides/.test(tale)],
  ['남자 경로는 엄격 조건 없이 그대로', /isManHold \? undefined/.test(app)],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`)
  if (!ok) failed += 1
}
console.log(failed ? `\n여자 잠금 위반 ${failed}건. desk-woman-body-extend.mdc 를 확인하세요.` : '\n여자 몸 잇기 잠금 유지됨.')
process.exit(failed ? 1 : 0)
