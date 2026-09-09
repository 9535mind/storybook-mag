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
  ['wantsUnderwearLook/lace-bra', () => mod.wantsUnderwearLook('레이스 브래지어')],
  [
    'wantsUnderwearLook/slip-no-bra-is-false',
    () => mod.wantsUnderwearLook('실크 슬립만 입은 성인 한국 여성, 브래지어 없이 슬립 한 겹, 화보 사진'),
  ],
  [
    'wantsDeskUncensoredStill/slip-true',
    () =>
      mod.wantsDeskUncensoredStill(
        '실크 슬립 원피스만 입은 성인 한국 여성, 노브라, 슬립 한 겹, 브라팬티 세트 아님, 화보 사진',
      ),
  ],
  ['wantsDeskUncensoredStill/jeans-false', () => mod.wantsDeskUncensoredStill('흰 티와 청바지를 입은 성인 한국 여성, 화보 사진')],
  ['wantsDeskUncensoredStill/nude-true', () => mod.wantsDeskUncensoredStill('나체의 성인 한국 여성, 화보 사진')],
  ['wantsSlipOrSilkLook/slip-true', () => mod.wantsSlipOrSilkLook('실크 슬립 원피스만 입은 성인 한국 여성, 노브라')],
  ['wantsNudeOrUndress/striped-false-positive-guard', () => mod.wantsNudeOrUndress('striped dress')],
  ['wantsUndressAction/basic', () => mod.wantsUndressAction('천천히 벗어')],
  ['wantsOtbeotgim/canonical', () => mod.wantsOtbeotgim('옷벗김')],
  ['wantsOtbeotgim/겹벗김', () => mod.wantsOtbeotgim('겹벗김')],
  ['wantsOtbeotgim/한겹씩-제거', () => mod.wantsOtbeotgim('한겹씩 제거')],
  ['wantsOtbeotgim/옷을-하나씩-벗기', () => mod.wantsOtbeotgim('옷을 하나씩 벗기')],
  ['wantsOtbeotgim/peel-one-layer', () => mod.wantsOtbeotgim('peel one layer at a time')],
  ['wantsUndressAction/한겹씩-제거', () => mod.wantsUndressAction('한겹씩 제거')],
  [
    'polishKoreanPromptText/옷벗김-synonyms',
    () => ({
      layer: mod.polishKoreanPromptText('한겹씩 벗겨 가슴을 주무른다'),
      oneByOne: mod.polishKoreanPromptText('옷을 하나씩 제거한 뒤 선다'),
      peel: mod.polishKoreanPromptText('peel one layer at a time then knead'),
    }),
  ],
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
  [
    'buildWanPubicLine/default-visible-curls',
    () => {
      const p = mod.buildWanPubicLine('옷벗김. 혼자.')
      return {
        curls: /dark curly triangle|곱슬/i.test(p),
        noHairless: /FAILED hairless/i.test(p),
        notShavedDefault: !/smooth shaved as requested/i.test(p),
      }
    },
  ],
  ['buildStillWomanNudeNoPantyLock/pubic', () => mod.buildStillWomanNudeNoPantyLock('키스하고 여인은 나체에 음모가 보이게')],
  ['buildStillWomanNudeNoPantyLock/clothed', () => mod.buildStillWomanNudeNoPantyLock('팔짱 끼고 데이트')],
  ['buildStillNudeAdultPubicLine/default', () => mod.buildStillNudeAdultPubicLine('음모')],
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
  [
    'amplifyAdultMotionForVideo/solo-self-knead-breast',
    () => {
      const r = mod.amplifyAdultMotionForVideo('나체가 된 여성은 자신의 가슴을 주무른다')
      return {
        wantsPartner: r.wantsPartner,
        selfTouch: /SELF-TOUCH|her own/i.test(r.addon),
      }
    },
  ],
  [
    'amplifyAdultMotionForVideo/split-hands-left-breast-right-vulva',
    () => mod.amplifyAdultMotionForVideo('남자의 왼손은 가슴을 오른손은 보지를 만진다'),
  ],
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
    'buildFashionMagazinePrompt/underwear-silk-not-black',
    () => {
      const p = mod.buildFashionMagazinePrompt({
        description: '속옷만 입은 성인 한국 여성',
        mood: 'elegant',
        size: 'story',
        rawDescription: '속옷만 입은 성인 한국 여성',
      })
      const neg = mod.buildFashionNegativePrompt('속옷만 입은 성인 한국 여성')
      return {
        silkMatch: /silk underwear|silk matching|matching the outfit colors/i.test(p),
        noBlackPos: /NOT black lingerie|FAILED black bra/i.test(p),
        noBlackNeg: /black bra, black panties/i.test(neg),
      }
    },
  ],
  [
    'buildFashionNegativePrompt/nude',
    () => mod.buildFashionNegativePrompt('나체로 침대에 눕는다'),
  ],
  [
    'buildFashionNegativePrompt/lingerie',
    () => mod.buildFashionNegativePrompt('레이스 란제리 차림'),
  ],
  [
    'mentionsCoupleOrSecondPerson/solo-forbidden-couple-word',
    () =>
      mod.mentionsCoupleOrSecondPerson(
        'ONLY one woman. FORBIDDEN a man, a second person, couple, twin, or extra face.',
      ),
  ],
  [
    'mentionsCoupleOrSecondPerson/real-couple',
    () => mod.mentionsCoupleOrSecondPerson('성인 한국 남자와 성인 한국 여자가 함께 있는 전신 화보'),
  ],
  [
    'buildFashionNegativePrompt/desk-solo-slip-keeps-two-people-neg',
    () => {
      const desc =
        '실크 슬립만 입은 성인 한국 여성, 혼자 한 명의 성인 한국 여성만, 전신, ONLY one woman. FORBIDDEN a man, a second person, couple, twin, or extra face.'
      const neg = mod.buildFashionNegativePrompt(desc)
      return {
        couple: mod.mentionsCoupleOrSecondPerson(desc),
        hasTwoPeopleNeg: /two people/i.test(neg),
      }
    },
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
  // 옷 입은 일반 쇼츠 — 구역+BEAT 압축 (2026-09-01). 나체 경로와 같은 소통 형식.
  [
    'buildAnimationPrompt/clothed-couple-has-beats',
    () => {
      const p = mod.buildAnimationPrompt({
        motion: '남녀가 팔짱을 끼고 걷는다',
        prompt: '20대 남녀 커플이 도심 거리에서 팔짱을 끼고 데이트하는 모습',
        durationSec: 15,
      })
      return {
        length: p.length,
        hasMotion: p.includes('[MOTION]'),
        hasTimeBeat: /\[TIME\][\s\S]*BEAT1/.test(p),
        hasCoupleLock: p.includes('TWO PEOPLE, TWO SEPARATE FACES'),
        keepsClothes: /Keep source clothes/i.test(p),
        noNudeLock: !/bare breasts|ZERO panties|fully nude/i.test(p),
        underWanBudget: p.length <= 1500,
      }
    },
  ],
  [
    'buildAnimationPrompt/clothed-solo-no-couple-lock',
    () => {
      const p = mod.buildAnimationPrompt({
        motion: '거리를 걷는다',
        prompt: '흰 원피스를 입은 20대 여성이 서 있다',
        durationSec: 12,
      })
      return {
        length: p.length,
        hasBeat: /BEAT1/.test(p),
        coupleLock: p.includes('TWO PEOPLE, TWO SEPARATE FACES'),
        underWanBudget: p.length <= 1500,
      }
    },
  ],
  [
    'buildAnimationPrompt/couple-nude-kiss-keeps-man',
    () => {
      const p = mod.buildAnimationPrompt({
        motion:
          '나체로 서로 키스하는 장면 (남녀만: 소스 남자가 여자와 키스. 남자는 남자로 유지. 여여 키스 금지. 둘 다 전신 나체) (사진에는 두 사람이 함께 있다 — 커플)',
        prompt: '20대 남녀 커플이 나란히 선 전신',
        durationSec: 15,
      })
      return {
        length: p.length,
        keepsMan: /stays a MAN|MAN stays (?:a MAN|male)|He stays male/i.test(p),
        forbidsTwoWomen: /FORBIDDEN two women|NOT two women|turning him into a second woman/i.test(p),
        bothNude: /BOTH (?:fully nude|become fully nude|undress|strip)/i.test(p),
        noWomanOnlyUndress: !/he stays clothed; only the woman becomes nude/i.test(p),
        noSoloWomanMotion: !/same woman as the source/i.test(p),
        noPartialClothes: /no shirt\/briefs|FAILED if any clothes remain|FAILED if she still has a shirt/i.test(p),
        beat2BeforeHold: /BEAT 2 \(8–11s\)/.test(p) || /BEAT2 \(8–11s\)/.test(p) || /8–11s/.test(p),
        hasCast: /\[CAST\]/.test(p),
        keepsSourceFaces: /copy BOTH source faces|Keep BOTH source faces/i.test(p),
        noInventedPartner: !/consenting adult partner/i.test(p),
        underWanBudget: p.length <= 1500,
      }
    },
  ],
  [
    'buildAnimationPrompt/solo-self-breast-nude',
    () => {
      const p = mod.buildAnimationPrompt({
        motion: '나체가 된 여성은 자신의 가슴을 주무른다',
        rawMotion: '나체가 된 여성은 자신의 가슴을 주무른다',
        prompt: '노란 원피스를 입은 20대 여성이 서 있다',
        durationSec: 15,
      })
      return {
        length: p.length,
        herOwnHands: /HER OWN|her own hands/i.test(p),
        knead: /knead|squeez/i.test(p),
        undressBeat: /remove ALL clothes|full nude|옷벗김|pants\+belt|PANTS|peel ONE layer/i.test(p),
        noPartnerCast: /do not invent a partner/i.test(p),
        noHeartOverClothes: /FORBIDDEN keeping|source (?:dress|clothes)/i.test(p),
        noCoupleLock: !p.includes('TWO PEOPLE, TWO SEPARATE FACES'),
        keepsSourceCrop: /SAME CROP|exact source|NO zoom/i.test(p),
        noForcedFeet: !/head AND feet/i.test(p),
        endsOnKnead: /KEEP kneading|LAST FRAME|last frame/i.test(p),
        noPanties: /ZERO panties|panties\/thong OFF/i.test(p),
        underWanBudget: p.length <= 1500,
      }
    },
  ],
  [
    'buildAnimationPrompt/5s-solo-undress-has-beat2-no-partner',
    () => {
      const p = mod.buildAnimationPrompt({
        motion: '옷벗김. 혼자.',
        rawMotion: '옷벗김. 혼자.',
        prompt: '흰 셔츠와 빨간 치마를 입은 20대 여성이 앉아 있다',
        durationSec: 5,
        sourcePeople: 1,
      })
      return {
        sameSit: /exact source pose|stay sitting|FORBIDDEN standing/i.test(p),
        oneLayer: /ONE LAYER only|Melt the outer\/top only/i.test(p),
        keepSkirt: /KEEP source skirt|source skirt still on/i.test(p),
        noFullNudeHold: !/fully nude, panty gone/i.test(p),
        noInvent: /Only the source woman|do not invent a partner/i.test(p),
        noCoupleSuffix: !/사진에는 두 사람/.test(p),
        noKissPath: !/PASSIONATE KISS|mouth-kisses|MAN hand on WOMAN/i.test(p),
        noCrotchHand: !/hand ON her bare vulva|hand still on bare crotch/i.test(p),
        underWanBudget: p.length <= 1500,
      }
    },
  ],
  [
    'buildAnimationPrompt/id-bust-5s-undress-zoom-out',
    () => {
      const p = mod.buildAnimationPrompt({
        motion: '옷벗김. 혼자. 한 겹만.',
        rawMotion: '옷벗김. 혼자. 한 겹만.',
        prompt: '검정 재킷을 입은 증명사진',
        durationSec: 5,
        sourcePeople: 1,
        sourceBust: true,
      })
      return {
        zoomOut: /ZOOM OUT|PULLS BACK|pull-back/i.test(p),
        fullBody: /full body|head-to-shoes|head to shoes/i.test(p),
        noExactCrop: !/exact source crop/i.test(p),
        noZoomIn: /FORBIDDEN zoom-in/i.test(p),
        underWanBudget: p.length <= 1500,
      }
    },
  ],
  [
    'buildAnimationPrompt/10s-solo-undress-bra-then-bare',
    () => {
      const p = mod.buildAnimationPrompt({
        motion: '옷벗김. 혼자.',
        rawMotion: '옷벗김. 혼자.',
        prompt: '흰 셔츠와 빨간 치마를 입은 20대 여성이 앉아 있다',
        durationSec: 10,
        sourcePeople: 1,
      })
      return {
        braLayer: /silk bra matching the top color|silk BRA matching/i.test(p),
        beat2HasTime: /BEAT2 3–8s/i.test(p),
        pantyOffNotSwap: /panty OFF to bare|Mid panty = silk/i.test(p),
        noSheerAsNude: /black\/beige\/sheer|FAILED black bra\/panty/i.test(p),
        silkNotBlack: /silk matching|NOT black|not black/i.test(p),
        pubicVisible: /dark curly (?:pubic )?triangle|곱슬|FAILED hairless/i.test(p),
        holdNude: /HOLD 8–10s:.*fully nude/i.test(p),
        noInvent: /Only the source woman|do not invent a partner/i.test(p),
        underWanBudget: p.length <= 1500,
      }
    },
  ],
  [
    'buildAnimationPrompt/solo-still-ignores-couple-words',
    () => {
      const p = mod.buildAnimationPrompt({
        motion: '옷벗김. 혼자. 사진에는 두 사람이 함께 있다 — 커플. No kiss.',
        rawMotion: '옷벗김. 혼자. 사진에는 두 사람이 함께 있다 — 커플. No kiss.',
        prompt: '커플 화보',
        durationSec: 5,
        sourcePeople: 1,
      })
      return {
        noInvent: /Only the source woman|do not invent a partner/i.test(p),
        noKissPath: !/PASSIONATE KISS|mouth-kisses|Keep BOTH source/i.test(p),
        soloCast: /Only the source woman/i.test(p),
      }
    },
  ],
  [
    'buildAnimationPrompt/panty-melt-only-no-new-panty',
    () => {
      const p = mod.buildAnimationPrompt({
        motion: '이미 나체. 혼자. 남은 팬티를 벗긴다. 자세 그대로.',
        rawMotion: '이미 나체. 혼자. 남은 팬티를 벗긴다. 자세 그대로.',
        prompt: 'already nude continuity',
        durationSec: 5,
        sourcePeople: 1,
      })
      return {
        melts: /panty dissolves|Melt the remaining panty/i.test(p),
        noNewPanty: /FAILED black bra, black panty|FORBIDDEN a new black panty/i.test(p),
        noInvent: /Only the source woman/i.test(p),
        noKissPath: !/PASSIONATE KISS/i.test(p),
        underWanBudget: p.length <= 1500,
      }
    },
  ],
  [
    'detectKissIntensity/no-kiss-is-not-a-kiss',
    () => ({
      denied: mod.detectKissIntensity('옷벗김. No kiss. Do not add a second adult.') == null,
      asked: mod.detectKissIntensity('두 사람이 서로 키스한다') === 'kiss',
    }),
  ],
  [
    'buildAnimationPrompt/옷벗김-synonyms-same-peel',
    () => {
      const a = mod.buildAnimationPrompt({
        motion: '옷벗김',
        rawMotion: '옷벗김',
        prompt: '코트를 입은 20대 여성이 서 있다',
        durationSec: 15,
      })
      const b = mod.buildAnimationPrompt({
        motion: '한겹씩 벗겨',
        rawMotion: '한겹씩 벗겨',
        prompt: '코트를 입은 20대 여성이 서 있다',
        durationSec: 15,
      })
      return {
        aHasPeel: /옷벗김|SOURCE clothes|Nude only at the end/i.test(a),
        bHasPeel: /옷벗김|SOURCE clothes|Nude only at the end/i.test(b),
        samePeelToken: /옷벗김/.test(a) && /옷벗김/.test(b),
        noJumpAll: !/remove ALL clothes → full nude/.test(a),
        noInstantTopless: /skip-bra topless|FAILED (?:instant|skip-bra) topless|instant topless/i.test(a),
        braShows: /silk BRA matching|silk bra matching/i.test(a),
        noReplacementPanty: /FAILED black bra\/panty|black\/beige\/sheer|silk matching skirt/i.test(a),
        underWanBudget: a.length <= 1500 && b.length <= 1500,
      }
    },
  ],
  [
    'buildAnimationPrompt/옷벗김-landmark-keeps-knead',
    () => {
      const p = mod.buildAnimationPrompt({
        motion: '옷벗김 후 자신의 가슴을 주무른다',
        rawMotion: '옷벗김 후 자신의 가슴을 주무른다',
        prompt: '블라우스를 입은 20대 여성이 서 있다',
        durationSec: 15,
        landmarks: landmarksSample,
      })
      return {
        hasAnchor: /BUST ANCHOR|L 38\.0%,42\.0%|38\.0%/.test(p),
        knead: /knead|squeez/i.test(p),
        pantsMustGo: /pants on|top\+pants|SOURCE clothes/i.test(p),
        noNewBlackPanty: /FAILED black bra\/panty|black panty/i.test(p),
        notBecomeOnly: !/BEAT1 0–\d+s: dissolve top\+bra\+trousers/i.test(p),
        underWanBudget: p.length <= 1500,
      }
    },
  ],
  [
    'buildAnimationPrompt/couple-undress-keeps-man',
    () => {
      const p = mod.buildAnimationPrompt({
        motion: '옷벗김 (사진에는 두 사람이 함께 있다 — 커플)',
        rawMotion: '옷벗김 (사진에는 두 사람이 함께 있다 — 커플)',
        prompt: '스튜디오에서 남녀가 가까이 서 있다',
        durationSec: 15,
      })
      return {
        bothStay: /Keep BOTH source adults/i.test(p),
        manShirtOnly: /shirt off only|pants stay/i.test(p),
        noPenis: /FORBIDDEN penis/i.test(p),
        noBothNude: !/BOTH strip all|his shirt\+jeans\+briefs/i.test(p),
        manStays: /Man stays|FORBIDDEN deleting the man/i.test(p),
        noSoloEnd: /NOT a solo woman|FORBIDDEN[\s\S]{0,40}solo woman/i.test(p),
        underWanBudget: p.length <= 1500,
      }
    },
  ],
  [
    'buildAnimationPrompt/clothed-couple-kiss-keeps-both',
    () => {
      const p = mod.buildAnimationPrompt({
        motion:
          '두 사람이 서로 적극적으로 키스한다. passionate mouth-to-mouth kiss, same two faces, same clothes',
        rawMotion:
          '두 사람이 서로 적극적으로 키스한다. passionate mouth-to-mouth kiss, same two faces, same clothes',
        prompt: '스튜디오에서 남녀가 가까이 서 있다',
        durationSec: 15,
      })
      return {
        bothStay: /BOTH source adults stay|BOTH stay visible/i.test(p),
        keepsClothes: /Keep source clothes|Do not undress/i.test(p),
        noNudeLock: !/fully nude|ZERO panties|bare crotch/i.test(p),
        noManGone: /FORBIDDEN (?:the man disappearing|deleting the man)/i.test(p),
        hasKiss: /kiss/i.test(p),
        underWanBudget: p.length <= 1500,
      }
    },
  ],
  [
    'buildAnimationPrompt/옷벗김-split-hands-her-own',
    () => {
      const p = mod.buildAnimationPrompt({
        motion: '옷벗김 후 왼손은 가슴을 만지고 오른손은 보지를 만진다',
        rawMotion: '옷벗김 후 왼손은 가슴을 만지고 오른손은 보지를 만진다',
        prompt: '바지를 입은 20대 여성이 서 있다',
        durationSec: 15,
      })
      return {
        herLeft: /HER LEFT hand/i.test(p),
        herRight: /HER RIGHT hand/i.test(p),
        noHisHand: !/HIS LEFT hand/i.test(p),
        pantyFail: /FORBIDDEN a new black panty|bare crotch|ZERO fabric on crotch/i.test(p),
        noThighSlide: /not thigh|FORBIDDEN sliding/i.test(p),
        noPartner: /No partner|FORBIDDEN a partner/i.test(p),
        underWanBudget: p.length <= 1500,
      }
    },
  ],
  [
    'buildAnimationPrompt/solo-self-breast-zoom-when-asked',
    () => {
      const p = mod.buildAnimationPrompt({
        motion: '나체가 된 여성은 자신의 가슴을 주무른다 줌인',
        rawMotion: '나체가 된 여성은 자신의 가슴을 주무른다 줌인',
        prompt: '노란 원피스를 입은 20대 여성이 서 있다',
        durationSec: 15,
      })
      return {
        length: p.length,
        allowsZoom: /push in|zoom as asked/i.test(p),
        stillKnead: /knead|squeez/i.test(p),
        underWanBudget: p.length <= 1500,
      }
    },
  ],
  [
    'buildAnimationPrompt/couple-nude-breast-then-kiss-source-faces',
    () => {
      const p = mod.buildAnimationPrompt({
        motion:
          '나체가 된 여자의 가슴을 만진다 그리고 딮키스한다 (남녀만: 소스 남자가 여자와 키스·가슴 만짐. 남자는 남자로 유지. 여여 키스 금지. 둘 다 전신 나체) (사진에는 두 사람이 함께 있다 — 커플)',
        rawMotion: '나체가 된 여자의 가슴을 만진다 그리고 딮키스한다',
        prompt: 'indoor selfie of an older man and a young woman',
        durationSec: 15,
      })
      return {
        length: p.length,
        sourceManHand: /source MAN's hand/i.test(p),
        keepsSourceFaces: /copy BOTH source faces|Keep BOTH source faces/i.test(p),
        noInventedPartner: !/consenting adult partner/i.test(p),
        noExtraPeopleLeave: !/Extra people in the source leave/i.test(p),
        sequentialBeats: /BEAT1[\s\S]*BEAT 2[\s\S]*BEAT 3/i.test(p) || /THREE beats/i.test(p),
        underWanBudget: p.length <= 1500,
      }
    },
  ],
  [
    'buildAnimationPrompt/fashion-prompt-must-not-invent-couple',
    () => {
      const p = mod.buildAnimationPrompt({
        motion: '나체가 된 여자의 가슴을 만진다 그리고 딮키스한다',
        rawMotion: '나체가 된 여자의 가슴을 만진다 그리고 딮키스한다',
        prompt: '20대 남녀 커플 화보 스튜디오, man and woman editorial',
        durationSec: 15,
      })
      return {
        length: p.length,
        inventsPartner: /consenting adult partner|source MAN/i.test(p),
        coupleFaceLock: p.includes('TWO PEOPLE, TWO SEPARATE FACES'),
        forbidsInvent: /FORBIDDEN inventing a partner|do not invent a partner/i.test(p),
        underWanBudget: p.length <= 1500,
      }
    },
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
