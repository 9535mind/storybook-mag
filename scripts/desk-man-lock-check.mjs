#!/usr/bin/env node
/**
 * 남자 증명사진 몸 잇기 합격(잠금) 점검. 배포 전에 돌려서 합격 상태가 코드에서 유지되는지 확인한다.
 * 규칙: .cursor/rules/desk-man-body-extend.mdc  (태그 desk-man-extend-mw174)
 * 사용: node scripts/desk-man-lock-check.mjs   (실패하면 종료 코드 1)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const app = readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8')
const tale = readFileSync(path.join(ROOT, 'functions', 'api', 'tale-scene.ts'), 'utf8')

const checks = [
  ['원본 얼굴 얹기 함수가 있다', /async function pastePixelHeadOnStanding\(/.test(app)],
  ['얼굴 얹기가 남자 기본 켜짐', /window\.__deskPixelHead !== false && \(gender === 'male' \|\| gender === 'man'\)/.test(app)],
  ['머리 배율 기본 0.95', /window\.__deskHeadShrink\) > 0 \? Number\(window\.__deskHeadShrink\) : 0\.95/.test(app)],
  ['어깨 배율 기본 0.95', /window\.__deskShoulderScale\) > 0 \? Number\(window\.__deskShoulderScale\) : 0\.95/.test(app)],
  ['옛 어깨 넓히기 캐논은 꺼져 있다', /if \(window\.__deskManCanon === true\) \{\s*const fitted = await fitKoreanManCanon/.test(app)],
  ['남자는 비율 보정을 거친다', /result\.display = await fixManProportions\(result\.display\)/.test(app)],
  ['남자는 어깨 축소를 거친다', /result\.display = await narrowManShoulders\(result\.display\)/.test(app)],
  ['다리 37~43% 는 그대로, 37% 미만이면 늘림(0.40 기준)', /\(0\.4 - legs\) \/ 0\.12/.test(app) && /legs >= 0\.37 && !longLegs/.test(app)],
  ['다리가 43%보다 길면 40%로 줄인다(서양식 하체 방지)', /const longLegs = !log\.assumed && legs > 0\.43/.test(app) && /0\.4 \* \(Hc - L1\) - shoeLen/.test(app)],
  ['다리 사이 틈을 색 패턴으로 찾는다(배경색 비의존)', /같은 색 다리 - 다른 색 틈 - 같은 색 다리/.test(app)],
  ['얼굴 얹은 남자는 faceHold 를 건너뛴다', /opts\?\.face !== false && !pixelWillRun/.test(app)],
  ['잔해 오탐 구조 확인(debrisBlocks)이 있다', /const debrisBlocks = async/.test(app)],
  ['깃 윗선을 열마다 끊는다', /collarCols/.test(app)],
  ['머리 윤곽 안쪽 채우기(볼록 껍질)', /볼록 껍질/.test(app)],
  ['서버 이어그리기 프롬프트가 남자는 증명사진 옷 그대로(성별별 분기)', !/gender === 'man' \? 'Same clothes as image 2, no added jacket or tie, standing head to shoes\.' : 'Black office blazer/.test(tale) === false],
  ['서버 남자 옷 규칙: 재킷·넥타이를 만들지 않는다', /Do NOT add a jacket, blazer, suit coat, or tie/.test(tale)],
  ['서버 남자 비율 문구: 다리 약 40%(더 길지 않게)·신발 전체', /legs about 40 percent of total height, not longer/.test(tale)],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`)
  if (!ok) failed += 1
}
console.log(failed ? `\n잠금 위반 ${failed}건. desk-man-body-extend.mdc 를 확인하세요.` : '\n남자 몸 잇기 잠금 유지됨.')
process.exit(failed ? 1 : 0)
