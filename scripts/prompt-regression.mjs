#!/usr/bin/env node
/**
 * 프롬프트 빌더 회귀 테스트.
 *
 * functions/lib/content-policy.ts (및 관련 lib 모듈)를 esbuild로 CJS 번들해서 Node에서
 * 직접 호출하고, 이번 세션에서 실측으로 확인된 대표 시나리오들의 출력을 스냅샷과 비교한다.
 *
 * 사용법:
 *   node scripts/prompt-regression.mjs            결과를 baseline과 비교(다르면 exit 1)
 *   node scripts/prompt-regression.mjs --update   현재 출력을 새 baseline으로 저장
 *
 * 목적: content-policy.ts를 여러 파일로 쪼개거나 로직을 통합할 때, "겉보기엔 순수 이동인데
 * 실제로는 동작이 바뀌었는지"를 사람이 눈으로 다시 검증하지 않고 자동으로 잡아낸다.
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BUNDLE_DIR = path.join(ROOT, '_tmp_bundle')
const BUNDLE_FILE = path.join(BUNDLE_DIR, 'content-policy.cjs')
const BASELINE_FILE = path.join(__dirname, 'prompt-regression-baseline.json')

if (!existsSync(BUNDLE_DIR)) mkdirSync(BUNDLE_DIR, { recursive: true })

execSync(
  `node_modules\\.bin\\esbuild "functions/lib/content-policy.ts" --bundle --platform=node --format=cjs --outfile="${BUNDLE_FILE}"`,
  { cwd: ROOT, stdio: 'inherit' },
)

const mod = await import(`file://${BUNDLE_FILE}?t=${Date.now()}`)

function hash(s) {
  return createHash('sha256').update(String(s)).digest('hex').slice(0, 16)
}

/** 결과가 너무 길면(대형 프롬프트) 전체를 저장하는 대신 길이+해시만 기록해 baseline 파일을 가볍게 유지한다. */
function summarize(value) {
  if (typeof value === 'string' && value.length > 300) {
    return { __type: 'long-string', length: value.length, words: value.trim().split(/\s+/).filter(Boolean).length, hash: hash(value) }
  }
  return value
}

const landmarksSample = {
  nippleL: { x: 0.38, y: 0.42 },
  nippleR: { x: 0.62, y: 0.43 },
  moundL: { x: 0.37, y: 0.4 },
  moundR: { x: 0.63, y: 0.41 },
  navel: { x: 0.5, y: 0.62 },
  breastRadius: 0.09,
}

const cases = [
  // --- content policy ---
  ['evaluateContentPolicy/nude-ok', () => mod.evaluateContentPolicy('나체로 침대에 누워있다')],
  ['evaluateContentPolicy/minor-blocked', () => mod.evaluateContentPolicy('여고생이 나체로')],
  ['evaluateContentPolicy/nonconsensual-blocked', () => mod.evaluateContentPolicy('강간 장면')],
  ['evaluateContentPolicy/negated-minor-ok', () => mod.evaluateContentPolicy('not a teen, adult woman')],
  ['evaluateTaleScenePolicy/child-ok', () => mod.evaluateTaleScenePolicy('어린이가 토끼와 논다')],
  ['evaluateTaleScenePolicy/adult-blocked', () => mod.evaluateTaleScenePolicy('나체로 섹스하는 장면')],

  // --- korean text polishing ---
  ['polishKoreanPromptText/typo-fix', () => mod.polishKoreanPromptText('가습을 만져본다 하고 잇다')],
  ['polishKoreanPromptText/empty', () => mod.polishKoreanPromptText('')],

  // --- nude intent detection ---
  ['wantsNudeOrUndress/basic', () => mod.wantsNudeOrUndress('옷을 벗겨줘')],
  ['wantsNudeOrUndress/striped-false-positive-guard', () => mod.wantsNudeOrUndress('striped dress')],
  ['wantsUndressAction/basic', () => mod.wantsUndressAction('천천히 벗어')],
  ['wantsDressAction/basic', () => mod.wantsDressAction('가운을 입는다')],
  ['wantsFullNude/body-project', () => mod.wantsFullNude('몸매 투영')],
  ['isBodyProjectRequest/phrase', () => mod.isBodyProjectRequest('나체가 된다.')],
  ['isBodyProjectRequest/flag', () => mod.isBodyProjectRequest('', true)],
  ['isClothingChangeRevision/swap', () => mod.isClothingChangeRevision('바지를 스커트로 바꿔줘')],

  // --- jewelry / accessory ---
  ['wantsJewelryAccessoryRefine/earring', () => mod.wantsJewelryAccessoryRefine('귀걸이 추가해줘')],
  ['buildJewelryAccessoryRefinePrompt/butterfly', () => mod.buildJewelryAccessoryRefinePrompt('나비 귀걸이 추가해줘')],
  ['buildWristWatchRefinePrompt/watch+bracelet', () => mod.buildWristWatchRefinePrompt('손목시계랑 팔찌 추가')],
  ['buildNecklaceRefinePrompt/remove', () => mod.buildNecklaceRefinePrompt('목걸이 제거해줘')],
  ['buildWristAndNecklaceRefinePrompt/combo', () => mod.buildWristAndNecklaceRefinePrompt('시계 추가, 목걸이는 제거')],
  ['wantsSplitCompositeFix/basic', () => mod.wantsSplitCompositeFix('좌우로 갈라진 사진 하나로 합쳐줘')],
  ['buildSplitCompositeFixPrompt/basic', () => mod.buildSplitCompositeFixPrompt('반반 나뉜 옷 색 통일해줘')],

  // --- pubic hair / anatomy locks ---
  ['wantsExplicitPubicShave/false', () => mod.wantsExplicitPubicShave('나체로 서 있다')],
  ['wantsExplicitPubicShave/true', () => mod.wantsExplicitPubicShave('음모 제모해줘')],
  ['buildFemaleAdultAnatomyLock/default', () => mod.buildFemaleAdultAnatomyLock('나체')],
  ['buildFemaleAdultAnatomyLock/large-bust', () => mod.buildFemaleAdultAnatomyLock('큰 가슴')],
  ['buildAdultPubicHairLock/default', () => mod.buildAdultPubicHairLock('')],
  ['buildAdultPubicHairLock/shaved', () => mod.buildAdultPubicHairLock('음모 제모')],
  ['buildRealisticPubicHairRefinePrompt/default', () => mod.buildRealisticPubicHairRefinePrompt('음모 더 자연스럽게')],
  ['buildNippleAreolaRefinePrompt/larger', () => mod.buildNippleAreolaRefinePrompt('유두 좀 더 크게')],

  // --- bust height override ---
  ['buildBustHeightPreferenceLine/high', () => mod.buildBustHeightPreferenceLine('high')],
  ['buildBustHeightPreferenceLine/low', () => mod.buildBustHeightPreferenceLine('low')],
  ['buildBustHeightPreferenceLine/auto', () => mod.buildBustHeightPreferenceLine('auto')],
  ['buildClothingSilhouetteBodyLock/no-override', () => mod.buildClothingSilhouetteBodyLock('큰 가슴, 잘록한 허리')],
  ['buildClothingSilhouetteBodyLock/low-override', () => mod.buildClothingSilhouetteBodyLock('큰 가슴', 'low')],

  // --- body landmarks ---
  ['normalizeBodyLandmarks/full', () => mod.normalizeBodyLandmarks(landmarksSample)],
  ['normalizeBodyLandmarks/null', () => mod.normalizeBodyLandmarks(null)],
  ['normalizeBodyLandmarks/one-side', () => mod.normalizeBodyLandmarks({ nippleL: { x: 0.4, y: 0.4 } })],
  ['buildBodyLandmarkCoordsLock/full', () => mod.buildBodyLandmarkCoordsLock(mod.normalizeBodyLandmarks(landmarksSample))],
  ['buildEqualBeatSeconds/2parts', () => mod.buildEqualBeatSeconds(15, 2)],
  ['buildEqualBeatSeconds/3parts', () => mod.buildEqualBeatSeconds(20, 3)],

  // --- motion / kiss-target detection (오늘 고친 버그 포함) ---
  [
    'amplifyAdultMotionForVideo/kiss-breast-touch-lips',
    () => mod.amplifyAdultMotionForVideo('나체로 여자의 가슴을 만지고 입술에 딮키스한다'),
  ],
  ['amplifyAdultMotionForVideo/kiss-vulva', () => mod.amplifyAdultMotionForVideo('그녀의 보지에 입맞춤한다')],
  ['amplifyAdultMotionForVideo/kiss-breast-only', () => mod.amplifyAdultMotionForVideo('그녀의 가슴에 입맞춤한다')],
  ['amplifyAdultMotionForVideo/knead-breast', () => mod.amplifyAdultMotionForVideo('가슴을 주무른다')],
  ['amplifyAdultMotionForVideo/undress', () => mod.amplifyAdultMotionForVideo('천천히 옷을 벗는다')],

  // --- fashion prompt ---
  [
    'buildFashionMagazinePrompt/basic',
    () =>
      mod.buildFashionMagazinePrompt({
        description: '흰 원피스를 입고 스튜디오에서 포즈를 취한다',
        mood: 'elegant',
        size: 'square',
      }),
  ],
  [
    'buildFashionNegativePrompt/nude',
    () => mod.buildFashionNegativePrompt('나체로 침대에 눕는다'),
  ],
  [
    'buildFashionNegativePrompt/lingerie',
    () => mod.buildFashionNegativePrompt('레이스 란제리 차림'),
  ],

  // --- refine / nude identity prompts (오늘 압축한 부분) ---
  [
    'buildNudeIdentityRefinePrompt/body-project',
    () => mod.buildNudeIdentityRefinePrompt('몸매 투영', '흰 블라우스와 청바지를 입은 20대 여성', 'low'),
  ],
  [
    'buildNudeIdentityRefinePrompt/general-nude',
    () => mod.buildNudeIdentityRefinePrompt('옷을 다 벗겨줘', '검은 원피스를 입은 여성'),
  ],
  [
    'buildNudeBecomesDefinitionLock/with-landmarks-and-height',
    () => mod.buildNudeBecomesDefinitionLock('', landmarksSample, 'mid'),
  ],
  [
    'buildAnimationPrompt/body-project-shorts',
    () =>
      mod.buildAnimationPrompt({
        motion: '몸매 투영',
        baseDescription: '흰 블라우스를 입은 20대 여성이 서 있다',
        bodyProject: true,
        bustHeight: 'low',
      }),
  ],
  [
    'buildAnimationPrompt/kiss-breast-touch-lips',
    () =>
      mod.buildAnimationPrompt({
        motion: '나체로 여자의 가슴을 만지고 입술에 딮키스한다',
        baseDescription: '나체 상태의 20대 여성',
      }),
  ],
  // 커플(2인) 소스 사진 얼굴 드리프트 방지 — 2026-08-28 실측: 증명사진이 아니라 전신/반신
  // 합성 사진으로 커플 데이트 쇼츠를 만들면 인물 중 한쪽 얼굴이 다른 사람으로 바뀌는 사고.
  [
    'buildAnimationPrompt/couple-clothed-date-has-face-lock',
    () =>
      mod.buildAnimationPrompt({
        motion: '남녀가 팔짱을 끼고 걷는다',
        baseDescription: '20대 남녀 커플이 도심 거리에서 팔짱을 끼고 데이트하는 모습',
      }).includes('TWO PEOPLE, TWO SEPARATE FACES'),
  ],
  [
    'buildAnimationPrompt/solo-implied-partner-no-couple-face-lock',
    () =>
      mod.buildAnimationPrompt({
        motion: '나체로 여자의 가슴을 만지고 입술에 딮키스한다',
        baseDescription: '나체 상태의 20대 여성',
      }).includes('TWO PEOPLE, TWO SEPARATE FACES'),
  ],
]

const results = {}
for (const [name, fn] of cases) {
  try {
    results[name] = summarize(fn())
  } catch (err) {
    results[name] = { __error: String(err && err.message ? err.message : err) }
  }
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE_FILE, JSON.stringify(results, null, 2) + '\n')
  console.log(`Baseline updated: ${BASELINE_FILE} (${Object.keys(results).length} cases)`)
  process.exit(0)
}

if (!existsSync(BASELINE_FILE)) {
  console.error(`No baseline found at ${BASELINE_FILE}. Run with --update first.`)
  process.exit(1)
}

const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))
let mismatches = 0
const allNames = new Set([...Object.keys(baseline), ...Object.keys(results)])
for (const name of allNames) {
  const before = JSON.stringify(baseline[name])
  const after = JSON.stringify(results[name])
  if (before !== after) {
    mismatches++
    console.error(`MISMATCH: ${name}`)
    console.error(`  before: ${before}`)
    console.error(`  after:  ${after}`)
  }
}

if (mismatches === 0) {
  console.log(`OK — ${allNames.size} cases match baseline exactly.`)
  process.exit(0)
} else {
  console.error(`${mismatches} / ${allNames.size} cases differ from baseline.`)
  process.exit(1)
}
