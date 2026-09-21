/**
 * 패션 매거진 스튜디오 — 성인 놀이터 정책.
 *
 * 성인 대상 장면(누드·란제리·에로·노골적 표현 포함)은 요청대로 허용.
 * 유일한 하드 차단: 미성년(로리/쇼타 포함), 비동의·강간, 실존 인물 딥페이크.
 */

export type { ContentPolicyVerdict } from './content-policy-check'
export { evaluateContentPolicy, evaluateTaleScenePolicy } from './content-policy-check'
import { polishKoreanPromptText } from './korean-text'
export { polishKoreanPromptText, normalizeOtbeotgimTerms } from './korean-text'
import {
  type BodyLandmarks,
  normalizeBodyLandmarks,
  buildBodyLandmarkCoordsLock,
  buildBodyLandmarkCoordsLockShort,
} from './body-landmarks-lock'
export type { BodyLandmarks } from './body-landmarks-lock'
export {
  normalizeBodyLandmarks,
  buildBodyLandmarkCoordsLock,
  buildBodyLandmarkCoordsLockShort,
} from './body-landmarks-lock'
import {
  wantsJewelryAccessoryRefine,
  buildJewelryAccessoryRefinePrompt,
} from './jewelry-refine-prompt'
export {
  wantsJewelryAccessoryRefine,
  wantsWristAccessoryRefine,
  wantsNecklaceRefine,
  wantsNecklaceRemove,
  buildJewelryAccessoryRefinePrompt,
  buildWristWatchRefinePrompt,
  buildNecklaceRefinePrompt,
  buildWristAndNecklaceRefinePrompt,
  wantsSplitCompositeFix,
  buildSplitCompositeFixPrompt,
} from './jewelry-refine-prompt'
import {
  defaultEthnicityTag,
  mentionsHumanSubject,
  defaultEthnicitySentence,
} from './ethnicity-defaults'
export {
  defaultEthnicityTag,
  mentionsHumanSubject,
  defaultEthnicitySentence,
} from './ethnicity-defaults'
import { buildSoftMouthFaceLock, buildFaceFrozenLock, buildCoupleFaceLock, buildHeteroManWomanCastLock, buildSourcePairCastLock, wantsHeteroManWomanCast, isExplicitTwoWomenCast } from './face-locks'
export { buildSoftMouthFaceLock, buildFaceFrozenLock, buildCoupleFaceLock, buildHeteroManWomanCastLock, buildSourcePairCastLock, wantsHeteroManWomanCast, isExplicitTwoWomenCast } from './face-locks'
import { DYNAMIC_ACTION_PATTERN, resolveDanceTag, isDanceRevision } from './dance-scene-tags'
export { resolveDanceTag, isDanceRevision } from './dance-scene-tags'
import { describesAnimalSubject } from './animal-scene-detect'
export { describesAnimalSubject } from './animal-scene-detect'
import {
  wantsExplicitPubicShave,
  KOREAN_THIRTIES_PUBIC,
  buildFemaleAdultAnatomyLock,
  buildAdultPubicHairLock,
  buildWanPubicLine,
  buildStillNudeAdultPubicLine,
  buildStillNudeAdultBustLine,
  buildWanFemaleSexLock,
  buildNudeAnatomyVisibilityLock,
  buildNudeBodyShapeContinuityLock,
  buildNudeCensorFogBanLock,
  buildSingleContinuousShotLock,
  buildClothingSilhouetteBodyLock,
  buildBustHeightPreferenceLine,
  mentionsCoupleOrSecondPerson,
  stripDefaultContinuityEchoes,
} from './nude-anatomy-locks'
export { KOREAN_TWENTIES_PUBIC, KOREAN_THIRTIES_PUBIC } from './nude-anatomy-locks'
export type { BustHeightPreference } from './nude-anatomy-locks'
import {
  buildBodyLandmarkNudeRevealLock,
  buildKoreanTwentiesLookLock,
  buildKoreanMaleBodyHairLock,
} from './nude-reveal-locks'
export {
  buildUnderbustGarmentRemnantBanLock,
  buildPantyLayerBanLock,
  buildBodyLandmarkNudeRevealLock,
  buildKoreanTwentiesLookLock,
  buildKoreanMaleBodyHairLock,
} from './nude-reveal-locks'
import {
  wantsNudeOrUndress,
  wantsUnderwearLook,
  wantsSlipOrSilkLook,
  wantsDeskUncensoredStill,
  wantsDeskAdultCut,
  wantsDeskSitOrLie,
  wantsDeskPoseChange,
  deskStillUsesAdultReplicate,
  wantsUndressAction,
  wantsOtbeotgim,
  wantsPantyMeltOnly,
  OTBEOTGIM_WAN_LINE,
  OTBEOTGIM_BEAT1_LINE,
  PANTY_MELT_FAIL,
  SILK_MATCH_LINGERIE_LINE,
  COUPLE_MAN_SHIRT_ONLY,
  wantsDressAction,
  NUDE_STATE_WORD_PATTERN,
  stripNudeBecomesPhrase,
  resolveNudeIntent,
  wantsFullNude,
  isClothingChangeRevision,
  NUDE_BECOMES_PHRASE,
  BODY_PROJECT_REVISION,
  hasNudeBecomesPhrase,
  isBodyProjectRequest,
  buildEqualBeatSeconds,
  motionExplicitNudeHoldOnly,
  motionForcesBecomeNude,
  ensureNudeHoldMotionPhrase,
} from './nude-intent'
export { buildDeskStillPrompt, deskStillNegativePrompt, DESK_STILL_PROMPT_MAX, parseDeskIntent, parseDeskLookKind, parseDeskActionKind } from './desk-still-prompt'
export {
  wantsNudeOrUndress,
  wantsUnderwearLook,
  wantsSlipOrSilkLook,
  wantsDeskUncensoredStill,
  wantsDeskAdultCut,
  wantsDeskSitOrLie,
  wantsDeskPoseChange,
  deskStillUsesAdultReplicate,
  wantsUndressAction,
  wantsOtbeotgim,
  OTBEOTGIM_WAN_LINE,
  OTBEOTGIM_BEAT1_LINE,
  SILK_MATCH_LINGERIE_LINE,
  COUPLE_MAN_SHIRT_ONLY,
  wantsPantyMeltOnly,
  wantsDressAction,
  NUDE_STATE_WORD_PATTERN,
  stripNudeBecomesPhrase,
  resolveNudeIntent,
  wantsFullNude,
  isClothingChangeRevision,
  NUDE_BECOMES_PHRASE,
  BODY_PROJECT_REVISION,
  hasNudeBecomesPhrase,
  isBodyProjectRequest,
  buildEqualBeatSeconds,
  motionExplicitNudeHoldOnly,
  motionForcesBecomeNude,
  ensureNudeHoldMotionPhrase,
} from './nude-intent'
import {
  TOUCH_ACTION_VERBS_KO,
  detectKissBodyTarget,
  detectKissIntensity,
  kissIntensityActionLine,
  detectTouchVerbPhrase,
  detectSplitHandTargets,
  amplifyAdultMotionForVideo,
  wantsMaleGenitalHand,
  MAN_ZIPPER_HAND_LINE,
  wantsBackHug,
  isSoloSelfTouch,
} from './kiss-touch-motion'
export {
  detectKissBodyTarget,
  detectKissIntensity,
  kissIntensityActionLine,
  detectTouchVerbPhrase,
  detectSplitHandTargets,
  amplifyAdultMotionForVideo,
  wantsMaleGenitalHand,
  MAN_ZIPPER_HAND_LINE,
  wantsBackHug,
  isSoloSelfTouch,
} from './kiss-touch-motion'
export {
  wantsPubicHairOnlyRefine,
  wantsExplicitPubicShave,
  buildFemaleAdultAnatomyLock,
  buildAdultPubicHairLock,
  buildWanPubicLine,
  buildStillNudeAdultPubicLine,
  buildStillNudeAdultBustLine,
  wantsStillWomanNudeOrPubic,
  buildStillWomanNudeNoPantyLock,
  buildWanFemaleSexLock,
  buildRealisticPubicHairRefinePrompt,
  wantsNippleAreolaRefine,
  buildNippleAreolaRefinePrompt,
  buildBustHeightPreferenceLine,
  buildClothingSilhouetteBodyLock,
  buildNudeBodyShapeContinuityLock,
  buildNudeCensorFogBanLock,
  buildSingleContinuousShotLock,
  buildNudeAnatomyVisibilityLock,
  stripDefaultContinuityEchoes,
  mentionsCoupleOrSecondPerson,
} from './nude-anatomy-locks'

/**
 * SDXL 계열 negative prompt.
 * 얼굴 클로즈업 / 캐주얼 티 / 비즈니스 정장으로 의상이 바뀌는 실패를 강하게 억제한다.
 * (누드 요청 시에는 buildFashionNegativePrompt가 outfit 강제 항목을 제거한다.)
 */
/** 수정 반복 시 얼굴이 하얗게/흑갈색으로 드리프트·서양인 치환되는 실패 패턴 (철칙 금지). */
export const IDENTITY_DRIFT_NEGATIVE = [
  'different person, different face, face swap, identity change',
  'pale white face, chalky white skin, ghostly pale, overexposed bleached face, porcelain doll bleach',
  'muddy dark brown skin, blackish brown face, burned dark skin, orange fake tan, uneven skin darkening',
  'caucasian face when source is asian, western european facial features, wrong ethnicity',
  'changed body type, slimmed down body, bulked up body, different breast size, different hip shape',
].join(', ')

export const DEFAULT_NEGATIVE_PROMPT = [
  'worst quality, low quality, blurry, deformed, bad anatomy, extra limbs, extra fingers',
  'watermark, text, logo',
  'extreme close-up, headshot only, face-only crop, cropped at shoulders, tight facial portrait',
  'cropped feet, cut off feet, cut off head, ankles cropped, incomplete body',
  'plain white t-shirt, casual cotton tee, hoodie, jeans, sneakers',
  'business suit, blazer, office suit, corporate attire, formal pant suit, grey suit, grey wrap dress',
  'missing outfit, outfit not visible, clothing ignored, wrong clothing, ignored prompt, prompt ignored',
  'empty grey studio backdrop only when urban setting was requested',
  'unrelated subject, different scene than requested',
  // 증명사진·패널 콜라주만 금지 (한 장면 속 여러 인물/동물은 허용)
  'contact sheet, triptych, multiple panels, split screen collage, passport photos, ID photo strip, duplicated identical portraits side by side',
  IDENTITY_DRIFT_NEGATIVE,
  'wide toothy grin, exaggerated teeth, Hollywood smile, dental smile, mouth stretched open, too many teeth showing',
].join(', ')

const OUTFIT_FORCE_NEGATIVE =
  /missing outfit,\s*outfit not visible,\s*clothing ignored,\s*wrong clothing,\s*/i

/** 화보 네거티브 — 속옷·누드·거울 요청에 맞춰 이탈 억제 */
/**
 * @param descriptionOrBase 화면 전체 컨텍스트(거울·배경·귀걸이·춤 등 옷 이외의 판별에 계속
 * 이 전체 텍스트를 쓴다) — refine.ts처럼 revision을 따로 넘기지 않으면 이 값 하나로 전부
 * 판단한다(기존 동작과 동일, generate.ts의 단일 description 호출과 하위 호환).
 * @param revision (선택) 이번 수정 지시만 별도로 넘기면, 최종 누드 판별(wantsFullNude)만
 * revision·base를 분리해서 정확히 계산한다 — descriptionOrBase가 이미 "baseDescription
 * ${revision}" 형태로 합쳐져 있어도, base의 "치마를 입고 있다" 같은 서술 때문에 이번
 * revision의 순수 탈의 지시가 상쇄되는 사고를 막는다(wantsFullNude 주석 참고).
 */
/**
 * 얼굴·체형·피부톤 철칙 잠금 (짧음 — SDXL CLIP 예산 안).
 * 사용자가 피부/체형을 바꾸라고 한 항목만 잠금에서 뺀다.
 * 화보 수정에서는 항상 호출 — 사용자가 「같은 얼굴」을 적지 않아도 적용된다.
 */
export function buildIroncladIdentityLock(revision: string, baseDescription = ''): string {
  const rev = polishKoreanPromptText(revision || '')
  const revisionTargetsSkinTone = /피부\s*(색|톤)|태닝|skin\s*tone|\btan\b|하얗|검게|어둡게/i.test(rev)
  const revisionTargetsBody =
    /체형|몸매|살\s*빼|살\s*찌|다이어트|가슴\s*(키우|줄이|크게|작게)|잘록한\s*허리|엉덩이\s*(키우|줄이)|body\s*type|lose\s*weight|gain\s*weight|breast\s*(size|enlarge|reduce)/i.test(
      rev,
    )
  const coupleRequested = mentionsCoupleOrSecondPerson(`${baseDescription} ${rev}`)
  const bits = [
    'IRONCLAD: same person, same face identity — preserve exact facial features from source',
    !revisionTargetsSkinTone &&
      'same natural East Asian / Korean skin tone — not pale white, not muddy dark brown',
    !revisionTargetsBody && 'same body type and proportions',
    'same lighting on face, no bleach, no darken',
    coupleRequested
      ? 'if a second person is present in the source, keep them exactly as they are — only change what the requested edit targets'
      : 'exactly one woman, never invent a second person or side-by-side twin',
    buildKoreanTwentiesLookLock(`${baseDescription} ${rev}`),
    buildSoftMouthFaceLock(),
  ].filter((v): v is string => Boolean(v))
  if (baseDescription && !revisionTargetsSkinTone) {
    bits.push('match source photo colorimetry')
  }
  return bits.join(', ') + '.'
}

export function buildFashionNegativePrompt(descriptionOrBase: string, revision?: string): string {
  const description = revision === undefined ? descriptionOrBase : `${descriptionOrBase} ${revision}`.trim()
  const extras: string[] = []
  let base = DEFAULT_NEGATIVE_PROMPT

  // 1인 초상 수정에서 원본·결과 나란히 / 복제 인물이 나오는 실측 억제 (커플·두 명 요청은 제외)
  if (!mentionsCoupleOrSecondPerson(description)) {
    extras.push(
      'two people, second person, extra person, another woman, twin sister, clone face',
      'diptych, before and after split, side by side two portraits, dual portrait collage',
      'mirrored twin panels, left-right duplicate face, split canvas two versions, comparison layout',
      'vertical seam down torso, half-and-half clothing colors, left side different outfit from right, split-color garment',
    )
  }
  // 전신→상체 줌인 억제. base 설명에「전신」이 있어도 빼면 안 됨 — 이번 revision이
  // 아래로 확장일 때만 이 네거티브를 끈다.
  if (revision === undefined || !isFramingExtendRevision(revision)) {
    extras.push(
      'zoomed-in crop tighter than source, bust-only shot when source showed more body',
      'unexpected upper-body crop, head and shoulders only when source was full body or three-quarter',
    )
  }

  // wantsNudeOrUndress가 아니라 wantsFullNude를 쓴다 — "바지를 벗기고 치마를 입혀라"
  // 같은 옷 교체 요청까지 wantsNudeOrUndress만으로 판단하면 "옷을 입지 말라"는 네거티브를
  // 추가해버려서 사용자가 명시적으로 요청한 착의(치마)와 정반대로 충돌하는 사고가 있었다.
  if (wantsFullNude(revision ?? descriptionOrBase, revision === undefined ? '' : descriptionOrBase)) {
    // "missing outfit"은 누드(=의상 없음)와 정면 충돌 → 제거
    base = base.replace(OUTFIT_FORCE_NEGATIVE, '')
    extras.push(
      'clothes, clothing, dressed, wearing clothes, fully clothed',
      'bathrobe, bath robe, kimono robe, wrap robe, dressing gown, coat, shirt, dress',
      'lingerie, underwear, bra, panties, thong, briefs, bikini bottom, covering the body with fabric',
      'panties still on, underwear left on, clothes at ankles, fabric on crotch',
      // 유두·체모 검열/뭉개기 금지
      'censored nipples, covered nipples, no nipples, blank breasts, barbie doll body',
      'censored crotch, mosaic genitals, blurred pubic area, missing pubic detail when nude',
      'pasties, nipple tape, strategic covering, steam censor',
      // 탈의 img2img가 강할수록 얼굴 치환·복제 인물이 잘 생김
      'different face from source, new face, face morph, identity swap',
      'wide toothy grin, exaggerated teeth, Hollywood smile, mouth stretched open',
    )
  } else if (wantsUnderwearLook(description)) {
    extras.push(
      'bathrobe, bath robe, kimono robe, wrap robe, dressing gown, overcoat, trench coat',
      'white dress shirt, collared blouse, button-up shirt, sweater, cardigan, grey robe',
      'black bra, black panties, black lingerie, black underwear, black thong',
    )
  }
  // 이 조건은 반드시 "거울을 요청하지 않았을 때"만 걸려야 한다. amplifyClothingAndScene은
  // 거울이 언급되면 정반대로 "mirror or vanity glass readable in the scene, NOT a plain
  // empty studio without a mirror"를 양성 프롬프트에 넣는다 — 예전엔 이 negative가 조건을
  // 뒤집지 않고 그대로 "거울 언급 시" 걸려서, 사용자가 거울 장면을 요청해도 양성/음성
  // 프롬프트가 서로 정반대를 강요하는 자기모순이 있었다(실측: 거울·창밖 야경 요청이 거의
  // 항상 무시되고 텅 빈 스튜디오만 나옴). 거울을 요청하지 않았을 때만 "거울 헐루시네이션
  // 방지" 용도로 이 negative를 건다.
  if (!/거울|mirror/i.test(description)) {
    extras.push('no mirror, missing mirror, plain seamless studio mugshot without mirror')
  }
  // 흰 배경을 요청했는데도 회색/베이지로 새는 사례가 실측으로 반복 확인됨 — 색상 이탈을 직접 억제.
  if (/흰\s*배경|흰색\s*배경|백색\s*배경|white\s*background|클린\s*화이트/i.test(description)) {
    // "흰 배경의 스튜디오 + 창밖 도시 야경"처럼 실내는 화이트인데 창 너머로 어두운 밤 도시가
    // 보이는 조합은 실제로 흔한 사진 구성인데, "dark background/colored background"를 무조건
    // 넣으면 amplifyClothingAndScene이 넣는 "도시 배경·거리 조명" 양성 지시와 충돌해서 창밖
    // 야경 자체가 억제되는 사고가 있었다. 도시/야경 요청이 함께 있으면 그 두 항목만 뺀다
    // (벽 색이 회색/베이지로 새는 건 여전히 막되, 창 너머 어두운 야경은 허용).
    // "city"/"urban"이 경계 없으면 "electricity"("city" 포함), "suburban"("urban" 포함)
    // 같은 흔한 단어에도 오발동한다 — \b로 좁힌다.
    const wantsCityOrNight = /도시|시티|어반|거리|야경|\burban\b|\bcity\b|\bstreet\b/i.test(description)
    const whiteBgExtras = wantsCityOrNight
      ? 'grey background, gray background, beige background, tan background, brown background, off-white background, cream background'
      : 'grey background, gray background, beige background, tan background, brown background, dark background, colored background, off-white background, cream background'
    extras.push(whiteBgExtras)
  }
  // "한쪽 귀만 보이고 반대쪽은 안 보임" 같은 좌우 비대칭 액세서리 묘사가 실측에서 양쪽 다 보이는
  // 대칭형으로 뭉개지는 경우가 반복 확인됨 — 대칭 귀걸이를 직접 억제.
  if (/귀[^.]{0,30}(가려|보이지\s*않|안\s*보임|관찰되지\s*않|없다|없음)/.test(description)) {
    extras.push('matching earrings on both ears, symmetric pair of earrings, two identical earrings, earring visible on both sides')
  }
  // amplifyClothingAndScene의 역동적 포즈 태그와 짝을 맞춰, 같은 조건에서 정적 포즈로
  // 새는 것을 직접 억제한다.
  if (DYNAMIC_ACTION_PATTERN.test(description)) {
    extras.push(
      'static pose, standing still, calm posed portrait, looking back over the shoulder, relaxed stationary stance, studio glamour pose without motion, frozen with no motion blur',
    )
  }
  // 춤 요청인데 팔이 몸에 붙은 뻣뻣한 정자세로 새는 실패가 실측으로 반복 확인됨 — 위
  // DYNAMIC_ACTION_PATTERN(달리기/질주 계열) negative와는 별도로 춤 전용 억제를 건다.
  if (isDanceRevision(description)) {
    extras.push(
      'static standing pose, stiff arms at sides, arms glued to body, calm posed portrait, awkward frozen unnatural dance pose, motionless stance',
    )
  }
  return extras.length ? `${base}, ${extras.join(', ')}` : base
}

/**
 * 「허리/무릎/발목까지 그려줘」「전신으로」「발 보이게」— 크롭을 넓혀 같은 사람을 더 보여 달라는 요청.
 * 순수 T2I·일반 img2img로는 얼굴이 바뀌거나 구도가 안 넓어짐 → 아웃페인트 우선.
 */
export function isFramingExtendRevision(revision: string): boolean {
  const r = polishKoreanPromptText(revision)
  return /허리|반신|상반신|하반신|가슴\s*아래|배꼽|골반|무릎|발목|발끝|발\s*까지|다리\s*까지|허벅지|전신|풀\s*바디|풀바디|full\s*body|머리부터|발끝까지|머리\s*부터\s*발|크롭|잘린|잘려|잘림|보이게\s*그려|더\s*그려|아래로\s*그려|아래까지|발\s*보여|발\s*나오게|waist|torso|midriff|half[\s-]?body|feet\s*visible|head\s*to\s*toe|show\s*(the\s*)?(feet|ankles|knees|waist)|uncrop|outpaint|확장/i.test(
    r,
  )
}

/** 아웃페인트 픽셀 — 요청 범위에 따라 아래로(필요 시 좌우) 확장량. */
export function resolveFramingExpandPixels(revision: string): {
  expand_top: number
  expand_bottom: number
  expand_left: number
  expand_right: number
} {
  const r = polishKoreanPromptText(revision)
  if (/전신|풀\s*바디|풀바디|발끝|발목|발\s*까지|머리부터|head\s*to\s*toe|feet\s*visible/i.test(r)) {
    return { expand_top: 64, expand_bottom: 1400, expand_left: 160, expand_right: 160 }
  }
  if (/무릎|허벅지|다리\s*까지|knees?/i.test(r)) {
    return { expand_top: 48, expand_bottom: 1100, expand_left: 120, expand_right: 120 }
  }
  // 허리·반신·상반신 (증명사진 → 허리까지)
  return { expand_top: 32, expand_bottom: 720, expand_left: 80, expand_right: 80 }
}

/** 화보 모드: 전신·의상처럼 img2img로 얼굴이 깨지기 쉬운 큰 수정 */
export function isStructuralRefineRevision(revision: string): boolean {
  const r = polishKoreanPromptText(revision)
  const pattern = new RegExp(
    [
      '전신', '풀\\s*바디', '풀바디', 'full\\s*body', '머리부터', '발끝까지',
      '속옷', '란제리', 'underwear', 'lingerie', '브래지', '팬티', '거울', '차림으로',
      '누드', '나체', 'nude', '다시\\s*그려', '재생성', '탈의',
      '유두', '유방', '젖꼭지', 'topless',
    ].join('|'),
    'i',
  )
  // 특정 의류를 "벗다·제거·없애다"(탈의), "입다·착용하다"(착의), "A 대신 B로/A를 B로 바꿔"
  // (교체)해 달라는 요청은 무엇이든 실제로는 의상이 통째로 바뀌는 만큼 큰 수정이다 — 이걸
  // 놓치면 낮은 strength(0.28)로만 처리되다가 반영이 거의 안 되는 문제가 있었다.
  // isClothingChangeRevision 하나로 세 가지 표현 방식을 전부 통틀어 판별한다(뒤에서
  // nudeRevision과 함께 얼굴 보존 고강도 경로(strength 0.6·정밀모드)로 승격시킨다).
  return pattern.test(r) || isClothingChangeRevision(r) || isFramingExtendRevision(r)
}

/** 프레이밍 확장 수정용 — 같은 사람·같은 옷으로 아래로 확장 (하반신만/나체 발명 금지). */
export function buildFramingExtendRefineAddon(revision: string, baseDescription = ''): string {
  const corpus = `${baseDescription} ${revision}`
  const wantsNude = wantsFullNude(revision, baseDescription)
  const r = polishKoreanPromptText(revision)
  const target = /전신|발목|발끝|풀\s*바디|feet|head\s*to\s*toe/i.test(r)
    ? 'full body head-to-toe including knees, ankles and feet'
    : /무릎|허벅지|knees?/i.test(r)
      ? 'three-quarter or full-leg framing including knees'
      : 'waist-up / half-body framing showing from head down to the waist'
  return [
    'FRAMING EXTEND: keep the EXACT SAME face and person from the source photo — do not redesign the face.',
    `Widen the canvas downward to ${target}. Preserve the original head/shoulders pixels.`,
    'NOT a new passport photo, NOT the same tight headshot crop again, NOT a different woman, NOT headless.',
    wantsNude
      ? buildNudeAnatomyVisibilityLock(corpus)
      : 'Keep the original outfit and sweater/clothes — do NOT undress, do NOT invent nudity.',
  ]
    .filter(Boolean)
    .join(' ')
}

/** "귀걸이 추가해줘"/"나비 넣어줘"처럼 원본에 없던 새 물체·요소를 더하는 수정인지 판별한다.
 * img2img는 strength(디노이징 강도)가 낮을수록 원본 구조를 강하게 보존하는데, 그 특성 때문에
 * "존재하지 않던 새 물체를 그려 넣어라" 같은 요청은 색상/질감 변경보다 훨씬 더 많은 자유도가
 * 필요하다 — 낮은 strength로는 모델이 새 물체를 안정적으로 합성하지 못하고 무시하거나(수정이
 * "안 먹힘") 반대로 전체 구도가 무너지는 실측 사례가 확인됐다. 그래서 이런 요청만 따로 감지해
 * strength를 한 단계 올려서(구조 변경 없이) 새 요소가 실제로 그려질 여지를 준다. */
export function isAdditiveRefineRevision(revision: string): boolean {
  const r = polishKoreanPromptText(revision)
  // "목걸이를 채워줘"/"귀걸이 착용시켜줘"/"목도리 둘러줘"처럼 장신구·소품을 몸에 걸치게
  // 하는 표현들도 "새 물체를 그려 넣어라"와 동일한 부류다 — 실측으로 이 표현들이 위
  // 키워드에 안 걸려서 낮은 strength로 처리되다가, 목걸이 같은 새 물체를 억지로 끼워
  // 넣으려는 시도 때문에 얼굴·의상까지 통째로 무너지는 "구도 붕괴" 사고가 확인됐다
  // (추가하려는 시도 자체는 반영됐지만 그 대가로 무관한 부분까지 크게 바뀜).
  // "옷을 입혀줘/입는 걸로"처럼 누드 상태에서 옷을 다시 입히는 요청도 같은 부류다(맨살에
  // 없던 천 재질을 새로 그려 넣는 것) — 빠져 있으면 같은 구도 붕괴 위험이 있다.
  return /추가|넣어|넣기|넣다|덧붙|그려\s*넣|올려\s*줘|씌워|더해|채워|채우|착용|달아|달아줘|매줘|둘러|두르|걸어\s*줘|입혀|입혀줘|입는|입을|입었|add\b|insert\b|put\b.*\bin\b/i.test(
    r,
  )
}

/** 자유 모드: 동물·소품·구도 추가 등 장면 구성 변경 → 반드시 장면 재생성 */
export function isFreeSceneRevision(revision: string, baseDescription = ''): boolean {
  const r = polishKoreanPromptText(`${baseDescription}\n${revision}`)
  if (!revision.trim()) return false
  // 동물·다중 주체·위치 관계·장면 동사
  if (describesAnimalSubject(r)) {
    return true
  }
  if (/위에|아래|등에|등에\s*타|타고|안[자줘]|앉아|들고|함께|추가|넣어|장면|들판|가로질러|달린|뛰는|쫓/i.test(r)) {
    return true
  }
  // 자유 모드 텍스트 수정은 기본적으로 장면 재생성(아래 refine.ts에서 강제)
  return true
}

/** 자유 일러스트 수정용 설명 병합 */
export function mergeFreeRevisionDescription(base: string, revision: string): string {
  const b = polishKoreanPromptText(base)
  const r = polishKoreanPromptText(revision)
  // 수정문이 이미 완결 장면이면(거실·엎드림·책 등) 수정문을 주 브리프로 사용
  const revisionIsFullScene =
    r.length >= 12 &&
    /[이가은는]/.test(r) &&
    (/거실|엎드|책|들판|달리|앉아|대학|입학|토끼|개구리|장면/.test(r) || r.length >= 20)
  if (revisionIsFullScene) {
    return [
      r,
      b && !r.includes(b.slice(0, Math.min(12, b.length)))
        ? `이전 맥락(참고): ${b}`
        : '',
      'Render the FULL scene from the Korean brief: environment, pose, props, and character must all be visible. NOT a passport/ID headshot, NOT a studio face-only crop.',
    ]
      .filter(Boolean)
      .join(' ')
  }
  if (!b) return r
  if (!r) return b
  return [
    b,
    `수정 반영(원 장면을 유지한 채 반드시 적용): ${r}`,
    'Keep subjects and setting; apply the revision exactly. Show full scene (pose, place, props). NOT face-only portrait, NOT passport photo.',
  ].join(' ')
}

/**
 * CLIP 예산(~70단어) 안에서 최대한 비용 대비 효과를 내려고, 화면비 라벨("2:3 vertical" 등)처럼
 * 프롬프트 텍스트로는 사실상 아무 시각 정보도 안 되는 표현은 빼고(화면비는 width/height로 이미 결정됨),
 * 같은 뜻을 반복하지 않는 짧은 태그로만 구성한다.
 */
/**
 * 태그체로 압축된 구도 힌트. "face-only crop 금지" 같은 부정 지시는 이미
 * DEFAULT_NEGATIVE_PROMPT(negative prompt)에 같은 내용이 들어 있어서 여기 긍정 프롬프트에
 * 중복으로 넣지 않는다 — 어차피 CLIP은 "Do NOT ~" 부정을 잘 못 알아듣고, negative prompt
 * 슬롯이 그 역할을 전담하도록 이미 설계돼 있다(위 buildFashionMagazinePrompt 주석 참고).
 * 중복을 빼는 것만으로 케이스별 5~6단어를 아꼈다.
 */
function resolveFramingHint(size: string | undefined): string {
  if (size === 'landscape') return 'full outfit, head to mid-thigh, background visible'
  if (size === 'square') return 'waist-up or three-quarter shot, outfit and pose visible'
  if (size === 'story') return 'full body, head to toe, feet visible, outfit readable'
  return 'full body, head to toe, feet visible, entire outfit visible'
}

/**
 * 한국어 의상/장소 키워드를 영어 강제 지시로 보강 (모델이 정장·스튜디오로 이탈하는 경우 억제).
 * @param revision (선택) buildFashionNegativePrompt와 동일한 이유로, revision을 따로
 * 넘기면 누드 판별(wantsFullNude)만 base와 분리해서 정확히 계산한다.
 */
function amplifyClothingAndScene(descriptionOrBase: string, revision?: string): string {
  const description = revision === undefined ? descriptionOrBase : `${descriptionOrBase} ${revision}`.trim()
  const extras: string[] = []
  // wantsFullNude — "바지를 벗기고 치마를 입혀라" 같은 옷 교체 요청까지 "no clothing, bare
  // skin" 태그를 강제로 붙이면 사용자가 명시한 착의 지시(치마)와 정반대로 충돌한다.
  const nude = wantsFullNude(revision ?? descriptionOrBase, revision === undefined ? '' : descriptionOrBase)

  // 누드/탈의는 의상 강제보다 우선 — "속옷제거"가 속옷 착용으로 오인되지 않게
  if (nude) {
    extras.push(
      'adult nude, bare skin, no clothing, no lingerie, no underwear, no bra, no panties, no bathrobe, no robe',
      'garments removed / undressed as requested — do NOT keep fabric covering the body',
      buildNudeAnatomyVisibilityLock(description),
    )
  } else {
    // "실크/슬립"(재질을 명시)과 "드레스/dress"(그냥 의상 종류)를 분리한다. 예전엔 이 둘을
    // 한 정규식으로 묶어서, "실크"를 언급한 적이 없는 그냥 "니트 원피스" 같은 설명도
    // "dress"라는 단어 하나만으로 "glossy silk fabric"을 강제로 덧씌워버렸다 — refine.ts가
    // baseDescription으로 이전 생성의 압축된 영어 프롬프트(currentResult.prompt)를 재사용하는데,
    // "원피스"가 Claude 압축 과정에서 "dress"로 번역되기만 해도(재질 언급 없이) 이 규칙이
    // 오발동해서, 수정 요청과 무관하게 의상 재질이 니트 → 광택 실크로 통째로 바뀌는 사고가
    // 실측으로 확인됐다. 재질(실크/슬립)을 실제로 언급했을 때만 재질을 강제한다.
    const wantsSilkOrSlip = /실크|슬립|slip|silk/i.test(description)
    // "dress"에 경계가 없으면 "address"("dress" 포함)에도 오발동한다("she addresses the
    // camera" 같은 번역문에서 실제 확인) — \b로 좁힌다(dressed/dressing 등 파생형은 유지).
    const wantsDressGarment = /드레스|\bdress/i.test(description)
    // 아래 태그들은 "NOT 업무복/가운" 같은 부정 문구를 길게 반복해 왔는데, 그 내용은 이미
    // DEFAULT_NEGATIVE_PROMPT(business suit/blazer/bathrobe 등)에 포함돼 있다 — positive
    // 프롬프트 쪽 예산이 다중 키워드 상황에서 특히 귀해서, 중복되는 부정 문구를 걷어내고
    // 옷 종류/재질만 짧게 못박는다.
    if (wantsSilkOrSlip) {
      extras.push(
        'wearing a one-piece glossy silk slip nightdress, spaghetti straps, no bra, no separate panties showing as a two-piece lingerie set',
      )
    } else if (wantsDressGarment) {
      extras.push('wearing a dress')
    }
  }
  const isLaceLingerie = !nude && /란제리|레이스\s*브래지|lingerie|lace\s*bra|thong|탠가/i.test(description)
  if (isLaceLingerie) {
    // 거울/야경/흰배경 같은 다른 "장면 정의" 태그와 한 문장에 자주 겹쳐서 amplify 예산을
    // 같이 나눠 써야 하는 경우가 많다 — 의미 손실 없이 3단어를 줄인 짧은 버전을 쓴다.
    extras.push(
      `wearing ivory/cream silk lingerie (bra, panties), not black. ${SILK_MATCH_LINGERIE_LINE}`,
    )
  } else if (wantsUnderwearLook(description)) {
    // wantsUnderwearLook은 "란제리/lingerie"도 함께 매칭하는 더 넓은 판정이라, 위 레이스
    // 태그와 동시에 걸리면 같은 내용을 두 번 말하며 예산을 낭비했다 — 더 구체적인 레이스
    // 태그가 이미 걸렸으면 이 일반형 속옷 태그는 건너뛴다(제거·누드 요청 제외는 함수 내부에서 처리됨).
    extras.push(
      `wearing only ivory/cream silk underwear (bra and panties), skin visible, NOT a bathrobe, NOT black lingerie. ${SILK_MATCH_LINGERIE_LINE}`,
    )
  }
  // 아래부터는 "장면을 정의하는" 구조적 요소(거울/배경/도시/야경)를 먼저 배치한다 —
  // capWordsSimple이 예산 초과 시 뒤쪽부터 자르므로, 상대적으로 덜 치명적인 자세/표정
  // 같은 장식적 디테일(오블리크 앵글, 감상하는 시선, 자신감 포즈)은 이 함수 맨 뒤로
  // 옮겨서 다중 키워드가 겹치는 밀도 높은 요청에서도 배경 요소가 먼저 살아남게 한다.
  if (/거울|mirror/i.test(description)) {
    // "posed in front of... mirror visible in frame"(9단어)는 거울/야경/흰배경이 겹칠 때
    // 예산을 많이 차지했다 — 같은 의미를 6단어로 줄인다.
    extras.push('in front of a mirror, mirror visible')
  }
  const wantsCityOrNightHere = /도시|시티|어반|거리|야경|\burban\b|\bcity\b|\bstreet\b/i.test(description)
  const wantsNightHere = /야경|밤\s*풍경|저녁\s*풍경|night\s*view|night\s*skyline|nighttime/i.test(description)
  // "야경"(밤의 도시 풍경)은 그냥 "도시/거리" 태그만으로는 낮인지 밤인지 애매해서, 실측으로
  // 밝은 낮 시간 창문으로 나오는 경우가 반복 확인됐다("street lights"만 있으면 낮에도
  // 가로등이 있을 수 있다고 해석되는 듯함). 야경 요청이면 도시+야간을 한 태그로 합쳐서
  // (둘 다 걸릴 때 따로따로 두 번 "도시" 얘기를 반복해 예산을 낭비하지 않게) 시간대까지
  // 한 번에 못박는다. 거울과 마찬가지로 "장면을 정의하는" 핵심 요소라서 흰 배경 디테일
  // (덜 중요)보다 앞에 배치해 예산이 부족할 때 먼저 살아남게 한다.
  if (wantsNightHere) {
    // 예전 문구(12단어: "nighttime city view through the window, dark sky with glowing
    // city lights")는 란제리+거울+흰배경과 한 문장에 겹치면 amplify 예산 초과로 뒷부분
    // ("dark sky..." 이후)이 통째로 잘려나가는 사고가 실측으로 확인됐다 — 같은 의미를
    // 8단어로 줄여 겹침 상황에서도 끝까지 살아남게 한다.
    extras.push('night city skyline through window, dark sky, city lights')
  } else if (wantsCityOrNightHere) {
    extras.push('city buildings visible through window, not grey studio wall')
  }
  if (/흰\s*배경|흰색\s*배경|백색\s*배경|white\s*background|클린\s*화이트/i.test(description)) {
    // "흰 배경 + 창밖 야경"처럼 실내는 화이트인데 창 너머는 어두운 밤인 조합을 요청했을 때,
    // 아래 "NOT dark backdrop"이 뒤에서 추가되는 야경 태그("dark night sky")와 정반대로
    // 충돌해서 서로를 지워버리는 사고가 있었다 — 야경/도시가 함께 요청되면 그 문구만 뺀다.
    extras.push(
      wantsCityOrNightHere
        ? 'white interior walls, not grey'
        : 'pure white seamless studio background, not grey, not beige, not dark',
    )
  }
  if (/귀[^.]{0,30}(가려|보이지\s*않|안\s*보임|관찰되지\s*않|없다|없음)/.test(description)) {
    extras.push('asymmetric single earring, only one ear shows an earring')
  }
  if (/시스루\s*뱅|앞머리|see-?through\s*bang/i.test(description)) {
    extras.push('delicate see-through bangs across the forehead')
  }
  // 자세/표정 계열 장식적 디테일 — 예산이 부족하면 이 아래부터 먼저 잘려도 배경/의상 같은
  // 핵심 장면 요소보다 실손실이 적다.
  if (/비스듬|oblique|diagonal/i.test(description)) {
    extras.push('oblique / three-quarter angle stance')
  }
  if (/몸매|감상|admiring/i.test(description)) {
    extras.push('admiring her own figure in the mirror')
  }
  if (/자신감|포즈|confident|pose/i.test(description)) {
    extras.push('confident fashion pose')
  }
  // 예전엔 "밝|투명|clear|bright" 아무 데서나 매칭했다 — "머리색을 밝은 갈색으로"나 "change
  // hair color to bright red"처럼 머리색·의상 색 묘사에 쓴 "밝은"/"bright"에도 걸려서, 얼굴/
  // 화장과 전혀 무관한 리비전에도 "얼굴을 화사하게 바꿔라" 지시가 끼어드는 사고가 있었다
  // (실측: 머리색만 바꿔달라 했는데 얼굴까지 달라지는 원인 중 하나였다). 피부/안색/얼굴 근처에서
  // 밝기를 언급했을 때만 매칭하도록 좁힌다.
  if (
    /피부[^,.]{0,10}(밝|맑|투명)|안색[^,.]{0,10}(밝|맑)|(밝|맑|투명)[^,.]{0,10}(피부|안색|얼굴)|clear\s*skin|bright\s*skin|clear\s*complexion|bright\s*complexion|luminous\s*skin/i.test(
      description,
    )
  ) {
    extras.push('bright clear luminous face, natural makeup')
  }
  // "힘차게 달린다/페달을 밟는다" 같은 동작 묘사를 줘도 모델이 정적인 화보 포즈(뒤돌아보는
  // 시선, 발끝만 살짝 든 자세)로 뭉개는 경우가 실측으로 반복 확인됐다 — 매번 사용자가
  // "몸을 앞으로 숙이고, 근육에 힘이 들어가고, 배경이 흐려지고…" 식으로 직접 풀어써야 하는
  // 건 불편하므로, 동작 관련 단어를 감지하면 이 역동성 태그를 자동으로 붙인다.
  if (DYNAMIC_ACTION_PATTERN.test(description)) {
    extras.push(
      'dynamic mid-action pose captured in motion, body leaning forward into the movement, muscles visibly engaged and tensed, motion blur in the background suggesting speed, hair and loose fabric blown backward by the wind, dramatic low action-photography angle',
      'NOT a static standing pose, NOT a calm posed portrait, NOT looking back over the shoulder, NOT frozen mid-stride with no motion cues',
    )
  }
  // 춤 요청 — 장르가 있으면 그 장르 전용 자세, 없으면 범용 댄스 자세 태그.
  const danceTag = resolveDanceTag(description)
  if (danceTag) {
    extras.push(danceTag)
  }
  // 태그 스타일로 이어붙일 수 있게 쉼표로만 구분한다("Hard constraints:" 같은 지시문 단어는
  // CLIP한테는 그냥 토큰 낭비라 뺀다 — CLIP은 문장을 "이해"하지 못하고 토큰 뭉치로만 본다).
  return extras.length ? `, ${extras.join(', ')}` : ''
}

/** 한국어 동물명 → 영어 종 고정 (여우/개로 치환되는 실패 억제). */
const FREE_ANIMAL_SPECIES: Array<{ pattern: RegExp; en: string; not?: string }> = [
  { pattern: /원숭이|monkey|macaque|primate/i, en: 'real monkeys (primates with monkey faces and fur)', not: 'NOT a fox, NOT a dog, NOT a shiba, NOT a cat, NOT a human' },
  { pattern: /침팬지|chimpanzee|chimp/i, en: 'real chimpanzees', not: 'NOT a monkey of wrong species, NOT a fox' },
  { pattern: /고릴라|gorilla/i, en: 'real gorillas' },
  { pattern: /사자|lion/i, en: 'a real lion', not: 'NOT a tiger hybrid' },
  { pattern: /호랑이|tiger/i, en: 'a real tiger', not: 'NOT a lion hybrid' },
  { pattern: /고양이|cat(?!tle)/i, en: 'a real cat' },
  { pattern: /강아지|개\b|puppy|dog\b/i, en: 'a real dog' },
  { pattern: /여우|fox/i, en: 'a real fox' },
  { pattern: /곰\b|bear\b/i, en: 'a real bear' },
  { pattern: /토끼|rabbit|bunny/i, en: 'a real rabbit' },
  { pattern: /새\b|bird\b/i, en: 'a real bird' },
  { pattern: /말\b|horse\b/i, en: 'a real horse' },
  { pattern: /코끼리|elephant/i, en: 'a real elephant' },
  { pattern: /펭귄|penguin/i, en: 'a real penguin' },
]

/** 자유 모드: 장면 키워드를 영어 강제 지시로 보강. 성인 요청은 순화하지 않는다. */
function amplifyFreeScene(description: string): string {
  const extras: string[] = []
  const hasLion = /사자|lion/i.test(description)
  const hasTiger = /호랑이|tiger/i.test(description)
  const hasMonkey = /원숭이|monkey|macaque|primate|침팬지|chimpanzee/i.test(description)

  if (/싸우|격투|싸움|fight|fighting|combat|brawl/i.test(description)) {
    extras.push('two subjects actively fighting / physical combat in frame, dynamic action pose, NOT a calm portrait')
  }
  if (/축구|soccer|football|킥|드리블|골대|공\s*차/i.test(description)) {
    extras.push(
      'soccer/football match in progress: a round soccer ball must be clearly visible, athletic kicking or dribbling action, NOT a still portrait',
    )
  }
  if (/농구|basketball/i.test(description)) {
    extras.push('basketball action with a visible basketball in frame')
  }
  if (/야구|baseball/i.test(description)) {
    extras.push('baseball action with a visible baseball in frame')
  }
  if (/달리|뛰|레이스|runn?ing|race/i.test(description)) {
    extras.push('subjects in motion / running, dynamic body language')
  }
  const danceTag = resolveDanceTag(description)
  if (danceTag) {
    extras.push(danceTag)
  }

  // 종 고정 — 요청한 동물만, 다른 종으로 바꾸지 말 것
  const matchedSpecies = FREE_ANIMAL_SPECIES.filter((s) => s.pattern.test(description))
  for (const species of matchedSpecies) {
    extras.push(`${species.en} must be clearly recognizable${species.not ? `, ${species.not}` : ''}`)
  }

  // 사자+호랑이 동시 → 하이브리드(라이거)로 합쳐지는 실패를 강하게 막는다.
  if (hasLion && hasTiger) {
    extras.push(
      'TWO separate animals in the SAME scene: one real lion AND one real tiger as distinct creatures side by side or facing each other',
      'NOT a liger, NOT a hybrid, NOT a single animal with mixed features, NOT a face close-up of one creature',
    )
  }

  // 두 마리 / 엄마·새끼
  if (/두\s*마리|2\s*마리|둘이|two\s+(monkeys|animals|lions|tigers)/i.test(description)) {
    extras.push('exactly TWO animals visible together in one scene, both fully readable')
  }
  if (/엄마|어미|mother|모성/i.test(description) && /아기|새끼|infant|baby|cub|pup/i.test(description)) {
    extras.push(
      'an adult mother animal AND a small infant/baby of the SAME species together',
      'NOT two identical adult faces stacked, NOT a duplicated clone portrait',
    )
  }
  if (/젖.{0,8}먹|수유|모유|breastfeed|nurs(?:e|ing)|feeding\s*(milk|infant)/i.test(description)) {
    extras.push(
      'nursing / breastfeeding moment: mother feeding milk to the infant, bodies and interaction clearly shown',
      'natural wildlife documentary style, tender parental care, NOT a face-only collage',
    )
  }

  if (hasMonkey) {
    extras.push(
      'subjects must look like monkeys/primates (flat primate faces, monkey ears, monkey fur) — NEVER foxes, NEVER dogs, NEVER shiba inu',
    )
  }

  if (/남자와\s*여자|남녀|man\s+and\s+woman|couple\s+fight/i.test(description)) {
    extras.push('both an adult man AND an adult woman must appear together in the same image')
  }
  if (/우주|galaxy|space|planet/i.test(description)) {
    extras.push('outer space / cosmic scenery as requested, stars or planets visible')
  }
  if (/지구|earth|globe/i.test(description)) {
    extras.push('planet Earth clearly visible as requested')
  }
  if (nude) {
    if (/(뒷모습|후면|등\s*뒤|back\s*view|rear)/i.test(description)) {
      extras.push('adult nude from the BACK, rear three-quarter view, bare skin, no clothing')
    } else if (/(옆|비스듬|측면|side\s*view|profile)/i.test(description)) {
      extras.push('adult nude in SIDE / three-quarter view standing at an angle, bare skin, no clothing')
    } else {
      extras.push(
        'adult nude as requested: bare skin, no clothes, no lingerie, no underwear — do not keep garments',
      )
    }
  } else if (/란제리|lingerie|야한|에로|섹시|nsfw|porn|explicit/i.test(description)) {
    extras.push('adult sensual / erotic content as requested — do not censor or clothe over the brief')
  }
  if (matchedSpecies.length > 0 || /동물|animal|wildlife/i.test(description)) {
    const wantsAnthro =
      /반인반수|반인\s*반수|수인(?:화)?|인화|의인화|anthro|anthropomorphic|furry|kemono/i.test(
        description,
      )
    if (wantsAnthro) {
      extras.push(
        'anthropomorphic half-beast (반인반수) form as explicitly requested',
      )
    } else {
      extras.push(
        'REAL animals as main subjects with natural animal anatomy',
        'NOT anthropomorphic, NOT furry/kemono, NOT animal head on human body, NOT bipedal animal in suit/clothes, NOT human fashion model with animal face',
      )
    }
  }

  const isSceneShot =
    /싸우|격투|축구|농구|야구|달리|뛰|soccer|football|fight|running|action|젖\s*을?\s*먹|수유|두\s*마리|엄마|새끼|아기/i.test(
      description,
    ) ||
    isDanceRevision(description) ||
    (hasLion && hasTiger) ||
    hasMonkey
  if (isSceneShot) {
    extras.push(
      'full-scene shot showing bodies and interaction, NOT extreme face close-up, NOT headshot-only stack',
    )
  }

  return extras.length ? ` Mandatory scene facts: ${extras.join('; ')}.` : ''
}

/**
 * @deprecated free 모드 프롬프트는 `compileResponsiveFreePrompt`(scene-compiler)가 단일 소스.
 * 호출 시 즉시 실패시켜 드리프트를 막는다.
 */
export function buildFreePrompt(_input: {
  description: string
  size?: string
  revision?: string
}): string {
  throw new Error('deprecated_use_compileResponsiveFreePrompt')
}

/**
 * 몸매 투영 — 착의 → 실루엣 예측 → 옷이 약하게 보이며 페이드로 녹음 → 같은 체형.
 */
export function buildNudeBecomesDefinitionLock(
  _corpus = '',
  landmarks?: BodyLandmarks | null,
  bustHeight?: string,
): string {
  // 실측(2026-08-27): 이 함수가 buildPantyLayerBanLock·buildUnderbustGarmentRemnantBanLock·
  // buildClothingSilhouetteBodyLock·buildBodyLandmarkNudeRevealLock을 전부 이어붙이면서
  // buildBodyLandmarkNudeRevealLock이 내부적으로 앞의 두 락을 다시 호출해 팬티/언더버스트
  // 문단이 2~3중 중복되어 8,000~11,000자까지 폭주했다. leanIntimate/plainNudeOnly(쇼츠)는
  // 이미 짧게 압축돼 있었는데 이 「몸매 투영」 정지 이미지 경로만 압축이 안 된 채 남아
  // 있었던 것이 유두 스와이럴/타겟 무늬·돌 같은 얼굴·가슴 위치 드리프트의 실제 원인.
  // 아래는 같은 내용을 중복 없이 한 번씩만 짧게 담은 버전.
  const step1 = landmarks
    ? 'Use the locked left/right coords on THIS photo for breast mound and nipple placement — do not re-guess or drift to neck/shoulder.'
    : 'Predict nipple (유두) height from shoulder → upper-arm → elbow landmarks on the clothed bust mound (often mid-upper-arm, not automatically under the collarbone); navel (배꼽) on the torso midline at the natural waist; pubic mound under the fabric.'
  return [
    'BODY PROJECTION = landmark reveal, not a new body. Same face, same body, same pose, same person count — do not invent anyone.',
    buildFaceFrozenLock(),
    landmarks ? buildBodyLandmarkCoordsLock(landmarks) : '',
    step1,
    'Remove ALL clothing completely and keep it off: top/bra, pants/jeans/skirt/shorts, belt/waistband, AND panties/thong/briefs — every layer leaves the body, none stay on. FAILED: topless but still in pants, belt/waistband remnant under the breasts, or any panty layer left on.',
    bustHeight && bustHeight !== 'auto'
      ? 'BUST: match clothed chest as baseline; if ambiguous, soft +½~1 cup only — FORBIDDEN +2–3 cups.'
      : 'BUST: match clothed chest as baseline; if ambiguous, soft +½~1 cup only — FORBIDDEN +2–3 cups; if arm/elbow landmarks are unclear, default to a slightly LOWER natural bust placement rather than a lifted perky one.',
    buildBustHeightPreferenceLine(bustHeight),
    'Nipples/areola: plain natural skin, soft pinkish-brown — FORBIDDEN spiral, swirl, ring, target, pinwheel, tattoo, or any printed graphic pattern on the breast.',
    `Pubic: ${KOREAN_THIRTIES_PUBIC}.`,
    'Bare skin must be continuous from underbust through navel to crotch — ZERO belt/strap/buckle remnant under the breasts, ZERO brown horizontal band on the abdomen.',
    'FORBIDDEN foggy blur, mosaic, or censor smear over the crotch — sharp uncensored bare skin with the compact mons patch visible.',
    'Keep waist/hip as clothed; for bust, clear silhouette = same size, ambiguous = about half to one cup fuller — never flat-under and never hugely oversized.',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * 쇼츠 몸매 투영 — 유두·배꼽 타점 고정 후 옷만 약하게 녹여 같은 몸을 드러냄.
 */
export function buildNudeBecomesAnimationPrompt(input: {
  motion: string
  clipRole?: 'single' | 'dual-a' | 'dual-b'
  prompt?: string
  landmarks?: BodyLandmarks | null
  /** 실제 클립 길이(초) — BEAT 구간을 "3등분 약속"(2동작=반반)에 맞춰 구체적 초로 표기 */
  durationSec?: number
  /** 사용자가 UI에서 직접 고른 가슴 높이(high/mid/low) — 없으면(auto) 기존 추정 로직 사용 */
  bustHeight?: string
}): string {
  // Wan I2V ignores long essays; belt/bra/panties stick to source pixels.
  // Lead with USER coords, then a short beat script that bans lingerie stop.
  const corpus = `${input.prompt || ''} ${input.motion || ''}`
  const landmarks = input.landmarks ? normalizeBodyLandmarks(input.landmarks) : null
  const coords = landmarks ? buildBodyLandmarkCoordsLock(landmarks) : ''
  const endCloseUp = wantsRequestedZoom(input.motion || '')
  const isDualA = input.clipRole === 'dual-a'
  // 몸매 투영은 기본적으로 "탈의(용해)" + "나체 유지" 두 동작 → 3등분 약속에 따라 반반.
  // 단, dual-a(24/30초 듀얼의 전반부)는 이 클립 하나가 오로지 탈의만 전담하고
  // (후반 나체 유지는 별도 clip인 dual-b가 맡는다 — 끝 프레임만 캡처해 이어붙임),
  // 그 마지막 프레임이 그대로 dual-b의 소스 사진이 된다. 그래서 반반으로 시간을
  // 아끼기보다 탈의(용해)에 클립의 2/3을 몰아주고, 마지막 1/3만 "되돌아가지 않기"
  // 잠금용 버퍼로 쓴다 — 실측: 반반으로는 클립 끝까지 완전 탈의를 못 마치는 경우가 있었다.
  const bounds = isDualA
    ? buildEqualBeatSeconds(input.durationSec, 3)
    : buildEqualBeatSeconds(input.durationSec, 2)
  const total = bounds[bounds.length - 1]
  const dissolveDeadline = isDualA ? bounds[2] : bounds[1]
  const holdStart = wanHoldStartSec(total)

  // → 구역형(MOTION/TIME/BODY/CAM/END) + 1500자 예산
  return assembleWanSections([
    wanSection(
      'MOTION',
      'Same Korean woman as source — clothes dissolve off while she stays standing; no new person, no dance/walk-away.',
    ),
    wanSection(
      'TIME',
      isDualA
        ? `BEAT1 0–${dissolveDeadline}s: dissolve top+bra+trousers+belt → full nude (ZERO belt/panties). BEAT2 ${dissolveDeadline}–${holdStart}s: stay nude. HOLD ${holdStart}–${total}s: FREEZE still nude. ${WAN_END_NO_SNAPBACK}`
        : `BEAT1 0–${dissolveDeadline}s: dissolve top+bra+trousers+belt → full nude. BEAT2 ${dissolveDeadline}–${holdStart}s: stay nude. HOLD ${holdStart}–${total}s: FREEZE still nude. ${WAN_END_NO_SNAPBACK}`,
    ),
    wanSection(
      'BODY',
      [
        coords ? `TAJEOM: ${coords}` : 'Estimate nipple/navel under clothing from real torso — never on face/neck.',
        'Bust: match clothed width; if hard to read, soft +½~1 cup only — FORBIDDEN +2–3 cups or flat under-size.',
        buildBustHeightPreferenceLine(input.bustHeight),
        buildWanPubicLine(`${input.prompt || ''} ${input.motion || ''}`),
      ]
        .filter(Boolean)
        .join(' '),
    ),
    wanSection(
      'CAM',
      buildShortsCameraLock({
        clipRole: input.clipRole,
        undressOrNude: true,
        endCloseUp,
      }),
    ),
    wanSection('END', buildWanEndHold({ durationSec: total, mode: 'nude' })),
  ])
}

// 무드 셀렉터: 필름·사진 질감(조명/컬러그레이딩) 축으로 재설계 — "패션 사진" 형용사만
// 다르던 이전 방식(에디토리얼/글래머/시크/로맨틱)은 SDXL류 엔진에게 시각적으로 잘 구분되지
// 않아, 실제 결과물 차이가 크게 나는 조명·필름 질감 축으로 바꿨다. 화보/자유 일러스트 양쪽
// 모드가 공유하는 단일 소스. 이전 값(editorial/glamour/chic/romantic)은 과거에 저장된 갤러리
// 항목을 다시 수정할 때 깨지지 않도록 하위 호환 별칭으로 남겨둔다.
// 태그체로 압축(관사/중복 형용사 제거) — SDXL_TAG_SYSTEM(translate.ts)이 사용자 description에
// 적용하는 것과 같은 원칙: 문장이 아니라 쉼표 구분 태그로, 의미가 살아남는 한 단어를 최대한 뺀다.
export const MOOD_LOOK_TAGS: Record<string, string> = {
  clean: 'clean digital photography, crisp detail, neutral color grade',
  vintage: 'vintage 35mm film photography, film grain, warm analog grade',
  cinematic: 'cinematic anamorphic photography, dramatic framing, teal-orange grade',
  pastel: 'soft pastel photography, dreamy light, high-key pastel palette',
  // 하위 호환 별칭
  editorial: 'clean digital photography, crisp detail, neutral color grade',
  glamour: 'cinematic anamorphic photography, dramatic framing, teal-orange grade',
  chic: 'clean digital photography, crisp detail, neutral color grade',
  romantic: 'soft pastel photography, dreamy light, high-key pastel palette',
}

export function resolveMoodTag(mood: string | undefined): string {
  return MOOD_LOOK_TAGS[mood || ''] || MOOD_LOOK_TAGS.clean
}

/** 화보풍 프롬프트 — 표현력을 죽이는 순화는 하지 않는다. */
/**
 * SDXL/Juggernaut의 CLIP 텍스트 인코더는 ~77토큰(대략 영어 60~70단어)을 넘으면 뒷부분을 조용히
 * 잘라서 버리고, "Do NOT ~" 같은 부정 지시문도 잘 못 알아듣는다(부정어를 무시하고 그 단어 자체에
 * 끌리는 경향). 그래서 예전처럼 긴 지시문 문장을 여러 개 이어붙이는 건 (1) 대부분 예산 밖으로
 * 잘려서 버려지고 (2) 설령 안 잘려도 "하지 마라" 부분이 잘 안 먹히는 이중 손해였다.
 * 지금은: 실제 시각 정보(description, 이미 SDXL 태그 형태로 압축돼 들어옴)를 맨 앞에 두고,
 * 뒤에는 짧은 태그만 붙인다. 금지 사항(옷 대체·순화 금지 등)은 여기서 빼고 negative prompt로
 * 옮겼다 — negative prompt는 별도의 77토큰 예산이라 "공짜로" 더 쓸 수 있고, 애초에 모델이
 * "빼야 할 것"을 처리하도록 설계된 슬롯이라 부정 지시가 실제로 더 잘 먹힌다.
 */
/** 단어 수 추정(SDXL ~77토큰 예산 근사용) — 공백 기준 분리. */
function countWords(text: string): number {
  return (text || '').trim().split(/\s+/).filter(Boolean).length
}

/** capWords(translate.ts)와 같은 단순 절삭 — content-policy.ts는 다른 모듈을 import하지 않는
 * 독립 모듈로 유지하려고 로컬에 하나 더 둔다. */
function capWordsSimple(text: string, maxWords: number): string {
  if (maxWords <= 0) return ''
  const words = (text || '').trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text.trim()
  return words.slice(0, maxWords).join(' ').replace(/[,;\s]+$/, '')
}

const SDXL_HARD_BUDGET_WORDS = 70
// "단어 수"는 실제 토큰 수와 1:1이 아니다(쉼표·복수음절 단어가 토큰을 더 씀) — 그 오차를
// 흡수할 안전 여유.
const SDXL_TOKEN_SAFETY_MARGIN_WORDS = 5
// 안전 여유를 뺀 실제 배분 대상 예산.
const SDXL_WORKING_BUDGET_WORDS = SDXL_HARD_BUDGET_WORDS - SDXL_TOKEN_SAFETY_MARGIN_WORDS
// description이 최소한 이만큼은 받도록 보장하는 하한. ethnicityTag/moodTag/framing/
// qualitySuffix 같은 "고정" 태그만 해도 실측으로 33~45단어를 차지해서(무드/사이즈 조합에
// 따라 다름), 이 하한을 여유 있게(예: 30) 잡으면 고정 태그+하한만으로 이미 65를 넘는
// 조합이 나온다 — 그래서 20으로 보수적으로 잡는다.
const SDXL_MIN_DESCRIPTION_WORDS = 20
// suffix가 비어 있어도(=amplify가 짧을 때) description에 65를 통째로 주지 않는 상한.
const SDXL_MAX_DESCRIPTION_WORDS = 60

/**
 * description 예약분(SDXL_MIN_DESCRIPTION_WORDS)을 항상 고정으로 지키면, amplify가
 * 정말 많이 필요한 경우(예: 거울+란제리+흰배경+도시+야경처럼 키워드 5~6개가 한 문장에
 * 겹치는 실측 사례) amplify가 8단어 안팎으로 짜부라져서 장면을 정의하는 핵심 요소(배경·
 * 거울·야경)가 통째로 잘려나가는 문제가 확인됐다. 이런 경우는 대개 description 원문
 * 자체가 amplify가 다시 설명해주는 내용과 크게 중복되므로(예: "거울 앞에서...도시의
 * 야경" 문장이 그대로 mirror/city/night amplify로 매칭됨), description 예약분을
 * 양보해도 실손실이 적다 — amplify가 실제로 필요로 하는 양(자르기 전 원본 길이)에 맞춰
 * description 예약분을 단계적으로 줄인다.
 */
function resolveMinDescriptionWords(rawAmplifyWords: number): number {
  // 실측(란제리+거울+흰배경+야경 4개 겹침 = rawAmplify 40대 중반)으로 기존 ">40 → 12"
  // 구간이 여전히 부족해서, 거울/야경 태그 자체가 amplify 안에서 중간에 잘리는 사고가
  // 있었다 — 브래킷을 더 촘촘하고 공격적으로 나눠 amplify 쪽에 더 넉넉히 양보한다.
  if (rawAmplifyWords > 55) return 6
  if (rawAmplifyWords > 35) return 9
  if (rawAmplifyWords > 22) return 12
  return SDXL_MIN_DESCRIPTION_WORDS
}

/**
 * buildFashionMagazinePrompt가 압축된 description 뒤에 붙이는 고정/조건부 태그들을 계산한다.
 * amplify(의상/장면 보강)도 압축 전 원문(rawDescription) 기준으로 판별한다 — 압축된 영어
 * 태그만 보면 "실크", "거울", "비스듬" 같은 한글 키워드가 압축 과정에서 잘려나가 매칭이
 * 빠질 수 있다(위 ethnicityTag/nude와 같은 이유).
 *
 * ethnicityTag/nudeFlag/moodTag/framing/qualitySuffix는 항상 그대로 붙는 "고정" 몫이고,
 * amplify만 매칭되는 키워드 수에 따라 크게 늘어나는 유일한 가변 항목이다(키워드가 여러 개
 * 겹치면 — 예: 란제리+거울+비스듬+흰배경+도시 — 그 자체로 100단어를 넘을 수 있다). 그래서
 * 고정 몫을 먼저 계산하고, description의 최소 몫(SDXL_MIN_DESCRIPTION_WORDS)을 지킬 수
 * 있는 만큼만 amplify에 남겨준다(넘치면 뒤쪽 — 상대적으로 덜 중요한 장식적 디테일 — 부터 자른다).
 * 이렇게 하면 suffix 총합 + description 최소 몫이 항상 SDXL_WORKING_BUDGET_WORDS를 넘지 않는다.
 */
function buildFashionPromptSuffixParts(input: {
  mood: string
  size?: string
  rawDescription: string
}): { ethnicityTag: string; amplify: string; nudeFlag: string; moodTag: string; framing: string; qualitySuffix: string } {
  const ethnicitySource = polishKoreanPromptText(input.rawDescription)
  // wantsFullNude — 옷 교체 요청("바지를 벗고 치마만 입혀라")까지 "no bra, no panties"를
  // 양성 프롬프트에 박아버리면 착의 지시와 충돌한다(amplifyClothingAndScene과 동일 이유).
  const nude = wantsFullNude(ethnicitySource)
  const ethnicityTag = defaultEthnicityTag(ethnicitySource)
  // 누드 요청 시 "no bra, no panties"까지 양성(positive) 프롬프트에 직접 못박아 둔다.
  // 예전엔 negative prompt(lingerie, underwear, bra, panties)에만 의존했는데, Lightning
  // 계열(스텝 8·CFG 2~4로 낮음)은 negative 프롬프트 순응도가 약해서, 학습 데이터 편향으로
  // 속옷을 입혀버리는 사고가 실측으로 반복 확인됐다 — 보통 더 잘 지켜지는 양성 프롬프트에도
  // 같은 지시를 중복으로 넣어 이탈 확률을 낮춘다.
  const nudeFlag = nude
    ? `adult nude, bare skin, no bra, no panties, ${buildNudeAnatomyVisibilityLock(ethnicitySource)}`
    : ''
  const moodTag = resolveMoodTag(input.mood)
  const framing = resolveFramingHint(input.size)
  const qualitySuffix = 'photorealistic, natural skin, sharp focus, 8k'
  const rawAmplify = amplifyClothingAndScene(ethnicitySource).replace(/^,\s*/, '')

  const fixedWords =
    countWords(ethnicityTag) + countWords(nudeFlag) + countWords(moodTag) + countWords(framing) + countWords(qualitySuffix)
  const minDescriptionWords = resolveMinDescriptionWords(countWords(rawAmplify))
  const amplifyBudget = Math.max(0, SDXL_WORKING_BUDGET_WORDS - fixedWords - minDescriptionWords)
  const amplify = capWordsSimple(rawAmplify, amplifyBudget)

  return { ethnicityTag, amplify, nudeFlag, moodTag, framing, qualitySuffix }
}

/**
 * compileSdxlTagPrompt(translate.ts)에 넘길 description 압축 예산을 동적으로 계산한다.
 * 예전엔 55로 고정했었는데, 화보 프롬프트가 압축된 description 뒤에 붙이는 인종/의상보강/
 * 무드/구도/품질 태그(suffix)의 실제 길이는 상황마다 크게 다르다. 특별한 키워드가 없으면
 * suffix가 짧아 description에 더 많은 예산을 줄 수 있고, 반대로 의상/장면 키워드가 여러 개
 * 겹치면(예: 란제리+거울+비스듬+흰배경) suffix 하나만 30단어를 넘길 수도 있어 55 고정은
 * 위험했다 — description이 55를 다 채우면, 뒤에 붙는 suffix가 모델의 CLIP 인코더에 의해
 * "어디가 잘렸는지 알 수도, 통제할 수도 없이" 조용히 잘려나간다(우리 capWords가 우선순위
 * 순서대로 자르는 것과 달리).
 */
export function resolveFashionDescriptionWordBudget(input: {
  mood: string
  size?: string
  rawDescription: string
}): number {
  const suffixWords = estimateFashionSuffixWords(input)
  const available = SDXL_WORKING_BUDGET_WORDS - suffixWords
  // buildFashionPromptSuffixParts와 같은 기준(원본 amplify 길이에 따른 적응형 하한)을 써야
  // 한다 — 여기서 옛 고정값(SDXL_MIN_DESCRIPTION_WORDS)으로 다시 올려버리면, amplify가
  // 실제로 더 받아간 몫만큼 총합이 다시 예산을 넘어서는 불일치가 생긴다.
  const ethnicitySource = polishKoreanPromptText(input.rawDescription)
  const rawAmplifyWords = countWords(amplifyClothingAndScene(ethnicitySource))
  const minDescriptionWords = resolveMinDescriptionWords(rawAmplifyWords)
  return Math.max(minDescriptionWords, Math.min(SDXL_MAX_DESCRIPTION_WORDS, available))
}

/** buildFashionPromptSuffixParts가 계산하는 고정/조건부 태그들의 단어 수 총합. */
export function estimateFashionSuffixWords(input: { mood: string; size?: string; rawDescription: string }): number {
  const parts = buildFashionPromptSuffixParts(input)
  return Object.values(parts).reduce((sum, p) => sum + countWords(p), 0)
}

export function buildFashionMagazinePrompt(input: {
  description: string
  mood: string
  size?: string
  /** 원본(압축·번역 전) 한글 설명. 인종·누드·의상보강 판별은 이 원문 기준으로 해야 한다 —
   * 단어 압축 과정에서 "일본인 여성" 같은 명시적 언급이 잘려나가면, 압축된 영어 텍스트만
   * 보고 판별할 경우 사용자가 명시한 인종이 기본값(한국인)으로 뒤집히는 버그가 있었다.
   * 넘겨주면 이 원문으로 판별하고, 안 넘기면(하위호환) 기존처럼 description 자체로 판별한다. */
  rawDescription?: string
}): string {
  const description = polishKoreanPromptText(input.description)
  const ethnicitySource = input.rawDescription ? polishKoreanPromptText(input.rawDescription) : description
  const suffix = buildFashionPromptSuffixParts({
    mood: input.mood,
    size: input.size,
    rawDescription: ethnicitySource,
  })

  // 커플/2인 사진을 요청했는데 "one woman"을 맨 앞에 박아두면 정면으로 충돌해서 모델이
  // 한 사람만 그리거나 어색한 합성을 내는 사고가 실측됨 — 커플 요청이면 인원수 단정 없이
  // "이중 인화/분할 스크린 금지"만 남긴다.
  const suffixCoupleRequested = mentionsCoupleOrSecondPerson(ethnicitySource)
  const parts = [
    // 생성에서도 좌우 이중 초상(diptych) 실측 억제 — 맨 앞
    suffixCoupleRequested
      ? 'single photo, not a diptych or split screen'
      : 'single frame one woman portrait photo, not a diptych or split screen',
    description,
    // 짧은 태그라 앞쪽에 둬야 77토큰 예산에서 잘리지 않고 반영됨
    suffix.ethnicityTag,
    suffix.amplify,
    suffix.nudeFlag,
    suffix.moodTag,
    suffix.framing,
    suffix.qualitySuffix,
  ].filter(Boolean)
  return parts.join(', ')
}

/**
 * 화보(fashion) 프롬프트만. free는 generate.ts → scene-compiler.
 * mode==='free'면 명시적으로 실패 (이중 경로 방지).
 */
export function buildGenerationPrompt(input: {
  description: string
  mood: string
  size?: string
  revision?: string
  mode?: string
}): string {
  if (input.mode === 'free') {
    throw new Error('free_mode_requires_scene_compiler')
  }
  return buildFashionMagazinePrompt(input)
}

/** 자유 일러스트용 — 짧게 유지 (과도한 금지 키워드는 엔진 오탐 유발). */
export const FREE_NEGATIVE_PROMPT = [
  'worst quality, low quality, blurry, deformed, bad anatomy, extra limbs, extra fingers',
  'watermark, text, logo',
  'ignored prompt, unrelated scene, wrong subject, wrong animal species',
  'solo fashion model studio portrait when animals or action were requested',
  'calm ID photo pose when fighting or action was requested',
  'extreme face close-up, headshot only, duplicated stacked faces, clone faces',
  // 증명사진·패널 콜라주만 금지 (한 장면 속 여러 동물/인물은 허용)
  'contact sheet, triptych, multiple panels, split screen collage, passport photos, ID photo strip, duplicated identical portraits side by side',
  'fox, shiba inu, dog face when monkey was requested',
  'liger, lion-tiger hybrid, merged lion and tiger into one creature',
  'missing soccer ball when soccer was requested',
  'underage human, loli, shota',
].join(', ')

const ANTHRO_NEGATIVE =
  'anthropomorphic, anthro, furry, kemono, animal head on human body, humanoid animal, bipedal animal in suit, animal wearing clothes, suited fox, fashion fox'

/** 요청 동물에 맞춰 negative를 추가로 붙인다. */
export function buildFreeNegativePrompt(description: string): string {
  const extras: string[] = []
  const wantsAnthro =
    /반인반수|반인\s*반수|수인(?:화)?|인화|의인화|anthro|anthropomorphic|furry|kemono/i.test(
      description,
    )
  const hasAnimal = /여우|사자|호랑이|고양이|강아지|원숭이|당나귀|곰|토끼|늑대|동물|fox|lion|tiger|cat|dog|monkey|animal/i.test(
    description,
  )
  if (hasAnimal && !wantsAnthro) extras.push(ANTHRO_NEGATIVE)
  if (/원숭이|monkey|macaque|primate|침팬지/i.test(description)) {
    extras.push('fox, red fox, shiba inu, dog, puppy, feline face, human baby')
  }
  if (/사자|lion/i.test(description) && /호랑이|tiger/i.test(description)) {
    extras.push('liger, hybrid cat, single animal only')
  }
  if (/젖\s*을?\s*먹|수유|breastfeed|nurs/i.test(description)) {
    extras.push('two identical adult faces, mirrored clone portrait, no infant')
  }
  if (isDanceRevision(description)) {
    extras.push('static standing pose, stiff arms at sides, arms glued to body, motionless stance, awkward frozen unnatural dance pose')
  }
  return extras.length ? `${FREE_NEGATIVE_PROMPT}, ${extras.join(', ')}` : FREE_NEGATIVE_PROMPT
}

/**
 * 전신 나체 텍스트 수정 전용 — CLIP ~77토큰 안에 탈의 지시가 앞에 오도록 짧게.
 * 몸매 투영이면 공식 정의(얼굴·체형 고정 + 옷 페이드 용해)를 최우선.
 */
/** 올가미로 사람·사물 지우고 배경 메우기 (탈의·장신구 제거와 구분) */
export function wantsObjectEraseRevision(revision: string): boolean {
  const t = polishKoreanPromptText(revision || '')
  if (!t) return false
  if (wantsFullNude(t) || wantsNudeOrUndress(t)) return false
  if (wantsJewelryAccessoryRefine(t) && /목걸이|귀걸이|시계|팔찌|necklace|earring|watch|bracelet/i.test(t)) {
    return false
  }
  return (
    /Erase the masked subject|content-aware\s*fill|object\s*erase/i.test(t) ||
    /선택(?:한)?\s*(?:사람|사물|인물|영역).{0,12}(?:지우|지워|제거|없애)/i.test(t) ||
    /(?:사람|인물|사물).{0,10}(?:을|를)?\s*(?:완전히\s*)?(?:지우|지워|제거|없애)/i.test(t) ||
    (/(?:옆|다른)\s*(?:사람|인물)/i.test(t) && /지우|지워|제거|없애/i.test(t)) ||
    /배경(?:으로|에)?\s*메워|자연스럽게\s*메워/i.test(t) ||
    /지워\s*줘|지우기|지워(?:요|라)?$|remove\s*(?:the\s*)?(?:masked|selected)\s*(?:person|people|object)/i.test(t)
  )
}

export function buildNudeIdentityRefinePrompt(
  revision: string,
  baseDescription = '',
  bustHeight?: string,
): string {
  const rev = stripDefaultContinuityEchoes(polishKoreanPromptText(revision || ''))
  const specialized = isBodyProjectRequest(revision) || isBodyProjectRequest(rev)
  if (specialized) {
    return [
      buildNudeBecomesDefinitionLock(`${baseDescription || ''} ${rev}`, null, bustHeight),
      'Fade-melt fabric only — nude skin appears at predicted nipple(유두) and navel(배꼽) anchors on the identical body. Not a new model, not a smile-only touch-up.',
      'Same background and framing. Photorealistic adult photo.',
    ].join(' ')
  }
  // 일반 나체/탈의 (「나체가 되어」등)
  // 주의: "shells, jewels, veils, wraps" 처럼 구체적인 명사를 긍정 프롬프트에 나열하면
  // SDXL류 모델이 "제거하라"는 주변 문맥은 무시하고 그 명사 자체를 그릴 시각 개념으로
  // 받아들여, 크롯치 위에 오히려 보석 장식 랩(jeweled wrap)을 새로 그려 넣는 사고가
  // 실측으로 확인됐다(예전 문장의 의도와 정반대 결과). 긍정 프롬프트에는 추상적인
  // 지시만 남기고, 구체적인 장식 명사는 아래 negative prompt 쪽에서 금지어로만 쓴다.
  return [
    'FULL NUDE: same face and same body as source; remove all clothes — bare breasts and bare crotch, ZERO panties, ZERO fabric or decoration of any kind covering the crotch or chest.',
    wantsOtbeotgim(rev)
      ? '옷벗김: dissolve the blouse on the source bust pixels. Nude bust stays at that height. FORBIDDEN a new higher sports-bra.'
      : '',
    'This applies no matter how the original outfit looked — plain, formal, costume, fantasy, or illustrated/fairy-tale style — none of it is a fixed part of the body, all of it comes off completely, leaving plain bare skin (no replacement garment, no decorative covering).',
    'Nipples/areola: plain natural skin, soft pinkish-brown — FORBIDDEN spiral, swirl, ring, target, pinwheel, tattoo, or any printed graphic pattern on the breast.',
    buildBustHeightPreferenceLine(bustHeight),
    buildNudeBodyShapeContinuityLock(`${baseDescription || ''} ${rev}`),
    wantsHeteroManWomanCast(rev)
      ? buildHeteroManWomanCastLock()
      : 'Keep any other person in the source — only undress the woman; do not turn a man into a woman.',
    'Same background and framing. Photorealistic adult photo.',
    rev ? `User: ${rev}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/** 텍스트 수정 / 영역 수정용 프롬프트. genMode=free면 사람 얼굴 락을 쓰지 않는다. */
export function buildRefinePrompt(input: {
  baseDescription: string
  revision: string
  mode: 'text' | 'region'
  genMode?: 'free' | 'fashion'
}): string {
  const base = polishKoreanPromptText(input.baseDescription)
  const revision = polishKoreanPromptText(input.revision)
  // genMode='fashion'이라도 실제 서술이 동물/사물 장면이면 "성인 여성 얼굴 유지" 문구를 쓰지 않는다
  // (관리자가 화보 탭에서 동물 그림을 만들었다가 나중에 그 그림을 수정하는 경우가 실제로 있다).
  const free = input.genMode === 'free' || describesAnimalSubject(`${base} ${revision}`)
  // base/revision을 따로 넘긴다 — amplifyClothingAndScene 내부의 누드 판별(wantsFullNude)만
  // 분리해서 정확히 계산하고, 나머지(거울·배경·귀걸이 등) 판별은 그대로 base+revision
  // 전체 컨텍스트를 본다(기존과 동일).
  const revisionAmplify = free ? '' : amplifyClothingAndScene(base, revision)
  const freeEthnicity =
    free && mentionsHumanSubject(`${base} ${revision}`) ? defaultEthnicitySentence(`${base} ${revision}`) : ''

  // 전신 나체: 긴 일반 refine 프롬프트 대신 짧은 전용(탈의 지시가 CLIP 앞에 오도록)
  if (!free && input.mode === 'text' && wantsFullNude(revision, base)) {
    return buildNudeIdentityRefinePrompt(revision, base)
  }

  // 전신 나체 전용 락은 위에서 이미 return. 여기 일반 수정에 FULL NUDE 캐스트를 넣으면
  // 옷 입은 키스/커플 수정도 나체로 바뀐다.
  const heteroCast =
    !free && wantsHeteroManWomanCast(`${revision} ${base}`)
      ? 'CAST: keep the source man as a man and the source woman as a woman. FORBIDDEN gender-swap or two women replacing the couple.'
      : ''

  if (free) {
    if (input.mode === 'region') {
      return [
        'Local edit of an existing illustration/photo. ONLY change the masked white areas.',
        `Local change: ${revision}.`,
        'Do NOT replace animals with a human fashion model. Preserve species, pose, and unmasked scene.',
        freeEthnicity,
        base ? `Scene context: ${base}.` : '',
        'Photorealistic seamless inpaint, same lighting.',
      ]
        .filter(Boolean)
        .join(' ')
    }
    return [
      'Edit the SAME scene. Keep original subjects (animals/objects) and setting.',
      `Apply exactly: ${revision}.`,
      // wantsFullNude(revision, base) — "치마를 벗기고 바지를 입혀라" 같은 옷 교체 요청까지
      // "bare skin, remove garments" 지시를 넣으면 착의 지시와 정반대로 충돌한다. base를
      // 같이 넘겨서 이전 라운드에 확립된 누드 상태는 계속 승계되게 한다.
      wantsFullNude(revision, base)
        ? `Adult full nude: bare skin — remove robe/bra/pants/skirt/panties/thong completely; bare crotch, no underwear or decoration left on. This applies no matter how the illustrated garment looks — ordinary clothes, gown, cloak/cape, corset, or any fantasy/decorative fairy-tale costume — none of it is a fixed part of the character design, all of it comes off completely leaving plain bare skin (no replacement garment, no decorative covering). ${buildNudeAnatomyVisibilityLock(`${base} ${revision}`)}`
        : 'CRITICAL: Do NOT invent a human woman, fashion model, bathrobe, or studio portrait.',
      freeEthnicity,
      base ? `Original scene (must still hold): ${base}.` : '',
      'Photorealistic illustration fidelity to the brief.',
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (input.mode === 'region') {
    if (wantsJewelryAccessoryRefine(revision)) {
      return buildJewelryAccessoryRefinePrompt(revision)
    }
    // 올가미 지우기 — 사람/사물 삭제 후 배경 메움 (탈의·누드와 구분)
    if (wantsObjectEraseRevision(revision)) {
      return [
        'OBJECT ERASE / empty background fill: ONLY the masked WHITE area.',
        'Delete the person or object under the mask completely.',
        'Fill with EMPTY wall/banner/floor matching neighbors — no humans in the hole.',
        'FORBIDDEN: inventing any new person, face, body, woman, or man inside the mask.',
        'FORBIDDEN: moving another person from the photo into the erased area.',
        'Preserve ALL unmasked pixels exactly.',
        'Photorealistic seamless inpaint.',
      ].join(' ')
    }
    return [
      'Local edit of an existing photo. ONLY change the masked white areas.',
      `Local change: ${revision}.${revisionAmplify}`,
      'Follow the revision exactly, including adult / nude / erotic changes when requested.',
      wantsFullNude(revision, base)
        ? `Adult full nude inside the mask: remove garment AND panties/thong — bare breasts and bare crotch, no underwear redrawn. ${buildNudeAnatomyVisibilityLock(`${base} ${revision}`)}`
        : '',
      'Do NOT invent a new person, new face, new body, or new scene outside the mask.',
      'Do NOT invent a surgical face mask, medical mask, or new buildings in the background.',
      buildIroncladIdentityLock(revision, base),
      'Preserve unmasked pixels exactly — same woman.',
      base ? `Context: ${base}.` : '',
      'Photorealistic seamless inpaint, same lighting and color grade — no pale bleach, no dark muddy skin.',
    ]
      .filter(Boolean)
      .join(' ')
  }
  // IDENTITY LOCK 문구가 리비전이 실제로 바꾸려는 속성까지 "그대로 유지하라"고 동시에
  // 지시하면 모델에게 자기모순된 신호를 준다 — 예: "머리색을 빨간색으로 바꿔줘"인데
  // 잠금 문구엔 "same hair"가 그대로 박혀 있는 식. 실측으로 이런 모순이 있으면 모델이
  // 지시 전체의 신뢰도를 낮게 보고 얼굴·의상까지 필요 이상으로 크게 갈아엎는 경향이
  // 확인됐다. 리비전이 실제로 겨냥하는 속성만 잠금 목록에서 뺀다.
  const revisionTargetsHair = /머리\s*(색|카락|스타일)|염색|dye|hair\s*color/i.test(revision)
  const revisionTargetsEyes = /눈\s*(색|동자)|eye\s*color|colored\s*contacts?/i.test(revision)
  const revisionTargetsLips = /입술\s*색|립스틱|lipstick|lip\s*color/i.test(revision)
  const revisionTargetsSkinTone = /피부\s*(색|톤)|태닝|skin\s*tone|\btan\b|하얗|검게|어둡게/i.test(revision)
  // 「허리까지 그려줘」의 허리는 체형 변경이 아님 — 체형 키워드만 잠금 해제
  const revisionTargetsBody =
    /체형|몸매|살\s*빼|살\s*찌|다이어트|가슴\s*(키우|줄이|크게|작게)|잘록한\s*허리|엉덩이\s*(키우|줄이)|body\s*type|lose\s*weight|gain\s*weight|breast\s*(size|enlarge|reduce)/i.test(
      revision,
    )
  const revisionTargetsPubic = /음모|치모|제모|민무늬|pubic|shav(e|ed)|wax/i.test(revision)
  const identityLockAttributes = [
    !revisionTargetsEyes && 'same eyes',
    'same nose',
    !revisionTargetsLips && 'same lips',
    !revisionTargetsHair && 'same hair',
    !revisionTargetsSkinTone && 'same natural Korean skin tone (not pale white, not dark brown)',
    !revisionTargetsBody && 'same body type',
    !revisionTargetsPubic && wantsFullNude(revision, base) && 'same pubic detail as source',
  ].filter((v): v is string => Boolean(v))

  // 이 문장형 프롬프트는 그대로 SDXL/Juggernaut(CLIP ~77토큰≈65~70단어) img2img 엔진에
  // 들어가는데, 예전엔 단어 예산 제한이 전혀 없었다 — 실측으로 재보니 고정 지시문만 합쳐도
  // 100단어를 넘어서, "원본 참고문(Original brief)"이나 "배경 유지"/"란제리 안전문구" 같은
  // 뒤쪽 문장이 CLIP 인코더에 의해 조용히 잘려나가고 있었다(수정을 반복할수록 base가
  // 길어져 더 심해짐 — "수정할수록 얼굴/의상이 이상하게 무너진다"는 반복 신고의 핵심
  // 원인 중 하나). 고정 문구를 최대한 짧게 줄이고, revision은 절대 자르지 않은 채
  // amplify/base(원본 참고문 — 어차피 img2img는 원본 이미지 픽셀을 직접 보므로 텍스트
  // 손실의 피해가 상대적으로 적다)에 남는 예산을 나눠서 CLIP 한도 안에서 핵심 안전
  // 지시(배경 유지·가운 방지·란제리)가 항상 살아남게 한다.
  // SINGLE FRAME을 맨 앞에 — 실측: 비교 UI 스크린샷·정밀모델에서 좌우 이중 초상이 한 장에 박힘.
  // 단, 소스가 실제 커플(2인) 사진이면 "one woman/one subject" 잠금이 실제 사진 내용과
  // 정면으로 충돌해서 나체화 자체가 잘 안 먹히는 사고가 실측됨 — 커플일 땐 "이중 인화/좌우
  // 비교 스샷 금지"만 남기고 인원수 단정 문구는 뺀다.
  const refineCoupleRequested = mentionsCoupleOrSecondPerson(`${base} ${revision}`)
  const imgEditPrefix = refineCoupleRequested
    ? 'SINGLE PHOTO ONLY (not a comparison layout): FORBIDDEN diptych, split screen, before-after collage, two side-by-side panels of the SAME person.'
    : 'SINGLE FRAME ONLY: one photo, one woman. FORBIDDEN: diptych, split screen, side-by-side twin, before-after collage, two panels.'
  const identityLockSentence = `${buildIroncladIdentityLock(revision, base)} IDENTITY LOCK: same face, ${identityLockAttributes.join(', ')}.`
  const applyPrefix = 'ONLY apply this change:'
  const framingCastNote = refineCoupleRequested
    ? 'Same camera framing and crop as the source (full-body stays full-body; no bust zoom). Keep every person from the source in frame — do not remove or duplicate anyone.'
    : 'Same camera framing and crop as the source (full-body stays full-body; no bust zoom). Still exactly one subject in one frame.'
  const bgAndPoseNote = 'Keep background and pose unchanged unless the change requires it.'
  const bathrobeNote = 'Do not add a bathrobe, kimono, or coat unless requested.'
  const nudeOrLingerieNote = wantsFullNude(revision, base)
    ? `CRITICAL FULL NUDE: remove ALL garments — robe, gown, sweater, bra, pants, skirt, AND panties/thong/briefs/underwear. Bare breasts with visible nipples AND bare crotch (no fabric on hips/mons). End state: fully nude adult woman, zero underwear remnant.${
        wantsHeteroManWomanCast(`${revision} ${base}`)
          ? ` ${buildHeteroManWomanCastLock()}`
          : refineCoupleRequested
            ? ' If a second person (e.g. a man) is in the source, he stays fully clothed and unchanged — only the woman becomes nude.'
            : ''
      } ${buildNudeAnatomyVisibilityLock(`${base} ${revision}`)}`
    : 'If lingerie/underwear is requested, show it, never a robe.'
  const contextPrefix = 'Context (must still hold):'
  const photoNote = refineCoupleRequested
    ? 'Photorealistic, same lighting.'
    : 'Photorealistic, same lighting. Reminder: single frame, not a dual portrait.'

  // 모든 고정 문구 단어 수를 먼저 합산하고, revision(절대 안 자름)을 뺀 나머지만
  // amplify/base에 나눠준다 (CLIP ~77토큰 예산).
  const fixedWords =
    countWords(imgEditPrefix) +
    countWords(identityLockSentence) +
    countWords(applyPrefix) +
    countWords(framingCastNote) +
    countWords(bgAndPoseNote) +
    countWords(bathrobeNote) +
    countWords(nudeOrLingerieNote) +
    countWords(heteroCast) +
    countWords(contextPrefix) +
    countWords(photoNote)
  const remainingForAmplifyAndBase = Math.max(0, SDXL_WORKING_BUDGET_WORDS - fixedWords - countWords(revision))
  const amplifyBudget = Math.min(countWords(revisionAmplify), Math.ceil(remainingForAmplifyAndBase * 0.6), 15)
  const cappedAmplify = capWordsSimple(revisionAmplify.replace(/^,\s*/, ''), amplifyBudget)
  const baseBudget = Math.max(0, remainingForAmplifyAndBase - countWords(cappedAmplify))
  const cappedBase = capWordsSimple(base, baseBudget)

  return [
    `${imgEditPrefix} ${identityLockSentence}`,
    `${applyPrefix} ${revision}.${cappedAmplify ? ` ${cappedAmplify}.` : ''}`,
    framingCastNote,
    heteroCast,
    bgAndPoseNote,
    bathrobeNote,
    nudeOrLingerieNote,
    cappedBase ? `${contextPrefix} ${cappedBase}.` : '',
    photoNote,
  ]
    .filter(Boolean)
    .join(' ')
}

// 화보 설명(원본 + 수정 라운드마다 누적되는 텍스트)은 최대 3000자까지 허용되지만, 영상
// 모델에게는 "정체성/의상 참고용" 참고문일 뿐이다. 수정을 여러 번 거친 이미지일수록 이 텍스트가
// 계속 길어지고, 그 안에 새 포즈·동작 서술이 섞여 있는 경우가 많아서(예: "자전거를 타고" 같은
// 동작 문구) 실제로 요청한 모션 힌트와 은근히 경쟁하며 순응도를 떨어뜨리는 사고가 실측으로
// 확인됐다("2차/3차 수정 이후 만든 쇼츠일수록 모션이 잘 안 먹힌다"). 참고문은 짧게 잘라서
// 정체성·의상·배경 같은 핵심만 남기고, 뒤에 누적된 최근 수정 문구의 비중을 줄인다.
const ANIMATION_CONTINUITY_MAX_CHARS = 180
/** Wan 2.2 I2V fast 실측: ~1500자 넘으면 순응도 급락 → 하드 상한 */
const WAN_I2V_PROMPT_MAX_CHARS = 1500

/**
 * 쇼츠 프롬프트 구역 — 나열이 아니라 역할이 있는 칸.
 * priority 낮을수록 보존 우선(예산 초과 시 큰 숫자부터 삭제).
 * 1 MOTION  2 TIME  3 END(종결·원본 복귀 금지)  4 CAST  5 BODY  6 CAM  7 ID
 * 실측: 15초 클립 후반에 원본 복장/포즈로 되돌아감 → END를 TIME 바로 다음으로 보존하고
 * HOLD 구간을 더 길게(마지막 3~4초) 잡는다.
 */
type WanSectionKey = 'MOTION' | 'TIME' | 'CAST' | 'BODY' | 'CAM' | 'END' | 'ID'
type WanSection = { key: WanSectionKey; text: string; priority: number }

const WAN_SECTION_PRIORITY: Record<WanSectionKey, number> = {
  MOTION: 1,
  TIME: 2,
  END: 3,
  CAST: 4,
  BODY: 5,
  CAM: 6,
  ID: 7,
}

function resolveClipTotalSec(durationSec?: number): number {
  return Math.max(2, Math.round(Number(durationSec) || 15))
}

/**
 * HOLD 시작 시각 — 원본 스냅백이 보통 끝 1~2초에 생기므로
 * 그보다 앞부터 종결 상태를 고정한다 (15초 → 11–15초).
 */
function wanHoldStartSec(totalSec: number): number {
  if (totalSec >= 12) return totalSec - 4
  if (totalSec >= 8) return totalSec - 3
  return Math.max(0, totalSec - 2)
}

const WAN_END_NO_SNAPBACK =
  'CRITICAL END LOCK: the source photo is START FRAME ONLY. FORBIDDEN in the final seconds: morphing/fading/resetting back to the opening still — no original clothes returning, no stiff side-by-side smile, no undoing the hug/kiss/fondle/nude. FREEZE the climax end-state through the LAST FRAME.'

/**
 * 종결 고정 — 요청한 상태(나체·포옹·가슴 애무 등)로 끝까지 유지, 원본 스냅백 금지.
 * mode: nude | action | motion | dress
 */
function buildWanEndHold(opts: {
  durationSec?: number
  mode: 'nude' | 'action' | 'motion' | 'dress' | 'clothed' | 'swap'
  actionHint?: string
  holdStartSec?: number
}): string {
  const total = resolveClipTotalSec(opts.durationSec)
  const hold =
    typeof opts.holdStartSec === 'number' && Number.isFinite(opts.holdStartSec)
      ? Math.max(0, Math.min(total, Math.round(opts.holdStartSec)))
      : wanHoldStartSec(total)
  const window = `HOLD ${hold}–${total}s (last ${total - hold}s) AND the very last frame`
  if (opts.mode === 'nude') {
    return `${window}: stay fully nude — bare breasts, bare crotch with a neat Korean-30s pubic patch, ZERO panties/clothes. FAILED hairless crotch. ${WAN_END_NO_SNAPBACK}`
  }
  if (opts.mode === 'dress') {
    return `${window}: keep the requested garment on — do not undress again. FORBIDDEN snapback to nude or the opening still.`
  }
  if (opts.mode === 'swap') {
    return `${window}: freeze wearing the new garment. FORBIDDEN the source clothes coming back, going nude, or snapback to the opening still.`
  }
  if (opts.mode === 'clothed') {
    return `${window}: freeze MOTION end-state, clothes stay on. FORBIDDEN snapback to the opening still.`
  }
  if (opts.mode === 'action') {
    const hint = opts.actionHint
      ? ` Keep exactly: ${opts.actionHint}.`
      : ' Keep hug / kiss / breast-touch / nude climax as requested.'
    return `${window}: keep the action end-state frozen.${hint} ${WAN_END_NO_SNAPBACK}`
  }
  return `${window}: keep the MOTION end-state frozen (embrace stays embrace, fondle stays fondle, nude stays nude). ${WAN_END_NO_SNAPBACK}`
}

/**
 * 옷 입은 일반 쇼츠 TIME — 나체 경로와 같은 BEAT 칸.
 * 장문 END LOCK을 TIME에 또 붙이면 MOTION이 묻혀 Wan이 미소 클로즈업으로 도망간다(실측).
 */
function buildClothedWanTime(opts: {
  motion: string
  durationSec?: number
  dressAction?: boolean
  /** 옷을 벗기는 게 아니라 다른 옷으로 바꾸는 요청. 옷 유지 문장을 붙이면 안 된다. */
  garmentSwap?: string
}): string {
  const total = resolveClipTotalSec(opts.durationSec)
  const hold = wanHoldStartSec(total)
  if (opts.dressAction) {
    return `BEAT1 0–${hold}s: put on the requested garment. HOLD ${hold}–${total}s: keep it on, freeze. FORBIDDEN undressing again.`
  }
  const mid = Math.max(1, Math.round(hold / 2))
  if (opts.garmentSwap) {
    const act = truncateContinuityText((opts.motion || '').trim(), 160)
    return [
      'TWO beats then freeze — do not merge:',
      `BEAT1 0–${mid}s: the source clothes dissolve away and ${opts.garmentSwap} forms on her body.`,
      `BEAT2 ${mid}–${hold}s: the new garment is fully on${act ? ` while she continues: ${act}` : '; fabric settles on the same body'}.`,
      `HOLD ${hold}–${total}s: FREEZE wearing it. FORBIDDEN the source clothes returning.`,
    ].join(' ')
  }
  const act = truncateContinuityText(
    (opts.motion || 'natural soft movement, same pose family as the source').trim(),
    220,
  )
  return [
    'TWO beats then freeze — do not merge:',
    `BEAT1 0–${mid}s: begin — ${act}. Keep source clothes.`,
    `BEAT2 ${mid}–${hold}s: continue the same action; it must stay visible.`,
    `HOLD ${hold}–${total}s: FREEZE that clothed end-state.`,
  ].join(' ')
}

function truncateContinuityText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const slice = text.slice(0, maxLen)
  const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(', '), slice.lastIndexOf(' '))
  const cut = lastBreak > maxLen * 0.5 ? lastBreak : maxLen
  return slice.slice(0, cut).trim()
}

function wanSection(key: WanSectionKey, text: string | false | null | undefined): WanSection | null {
  const t = typeof text === 'string' ? text.replace(/\s{2,}/g, ' ').trim() : ''
  if (!t) return null
  return { key, text: t, priority: WAN_SECTION_PRIORITY[key] }
}

/** 구역 조립 후 1500자 초과면 ID→CAM→BODY→CAST 순으로 버린다(MOTION·TIME·END 보존). */
function assembleWanSections(sections: Array<WanSection | null | undefined>): string {
  let kept = sections.filter((s): s is WanSection => Boolean(s && s.text))
  const render = (list: WanSection[]) =>
    list
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((s) => `[${s.key}] ${s.text}`)
      .join('\n')

  let out = render(kept)
  if (out.length <= WAN_I2V_PROMPT_MAX_CHARS) return out

  while (kept.length > 1 && out.length > WAN_I2V_PROMPT_MAX_CHARS) {
    const maxPri = Math.max(...kept.map((s) => s.priority))
    // END(3)까지는 유지 — 후반 원본 복귀 방지에 필수
    if (maxPri <= WAN_SECTION_PRIORITY.END) break
    const dropAt = kept.findIndex((s) => s.priority === maxPri)
    if (dropAt < 0) break
    kept = kept.filter((_, i) => i !== dropAt)
    out = render(kept)
  }
  if (out.length <= WAN_I2V_PROMPT_MAX_CHARS) return out
  return truncateContinuityText(out, WAN_I2V_PROMPT_MAX_CHARS)
}

/** @deprecated 구역 조립 전용 — assembleWanSections 사용. 단순 배열용 폴백. */
function finalizeWanI2vPrompt(parts: string[]): string {
  const motionish = parts.filter(Boolean)
  if (!motionish.length) return ''
  // 레거시 호출: 전체를 MOTION 한 칸으로 넣고 예산만 적용
  return assembleWanSections([wanSection('MOTION', motionish.join(' '))])
}

/**
 * 얼굴·체형·나체·음모 등 "기본 구조"를 소스와 같게 묶는 잠금 문구.
 * 텍스트에 힌트가 있으면 구체화하고, 없어도 I2V/수정이 구조를 갈아엎지 못하게 최소 잠금을 건다.
 * (모션이 바꾸라고 한 속성 — 예: 착의 — 은 호출 쪽에서 빼거나 덮어쓴다.)
 */
export function buildAdultStructureLock(
  text: string,
  opts?: {
    forNudeHold?: boolean
    allowPoseChange?: boolean
    skipIdentityAndSexLocks?: boolean
    bustHeight?: string
  },
): string {
  const t = polishKoreanPromptText(text || '')
  const bits: string[] = [
    'STRUCTURE LOCK from the source image: same face identity, same age look',
    'same natural East Asian / Korean skin tone — not pale white, not muddy dark brown',
    'same body type and silhouette (shoulders, waist, hips, breast size/shape, limb proportions)',
    buildClothingSilhouetteBodyLock(t, opts?.bustHeight),
  ]
  // skipIdentityAndSexLocks: 호출부가 이미 buildKoreanTwentiesLookLock/buildFemaleAdultAnatomyLock을
  // 앞에서 직접 넣었을 때 — 여기서 또 넣으면 통째로 중복되어 프롬프트가 과도하게 길어지고
  // (15,000자대) Wan I2V가 얼굴을 녹이거나 엉뚱한 그래픽을 그리는 붕괴 증상으로 이어짐(실측).
  if (!opts?.skipIdentityAndSexLocks) {
    bits.push(buildKoreanTwentiesLookLock(t))
  }
  // 남성이 실제로 언급될 때만 — couple만으로 남성 털 락을 걸면 여여 장면이 남성화되는 회귀
  if (
    /남자|남성|남녀|남친|남자와|man\b|male\b|boyfriend/i.test(t) &&
    !/여성\s*두|여자\s*둘|두\s*여성|두\s*여자|two\s*women|both\s*women|여여/i.test(t)
  ) {
    bits.push(buildKoreanMaleBodyHairLock())
  }

  if (/글래머|글래머러스|글래머체|풍만|글래머\s*몸|curvy|voluptuous|hourglass/i.test(t)) {
    bits.push('curvy glamorous figure — keep that body type, do not slim her down')
  } else if (/슬림|마른|날씬|가느다란|slim|slender|thin\b/i.test(t)) {
    bits.push('slim slender figure — keep that body type, do not bulk her up')
  } else if (/탄탄|근육|운동|athletic|fit\b|toned/i.test(t)) {
    bits.push('athletic toned figure — keep muscle tone and proportions')
  } else if (/통통|포동|플러스|chubby|plus[\s-]?size|plump/i.test(t)) {
    bits.push('soft fuller figure — keep that body type')
  }

  if (/큰\s*가슴|풍만\s*가슴|거유|large\s*breasts?|busty/i.test(t)) {
    bits.push('same large breast size/shape as source — never shrink to barbie/tiny breasts when nude')
  } else if (/작은\s*가슴|빈유|small\s*breasts?/i.test(t)) {
    bits.push('same small breast size/shape as source')
  }
  // 키스·파트너 등장 시 가슴이 커지거나 위치가 바뀌는 드리프트 실측
  bits.push(
    'BREAST PIXEL LOCK from source still: same breast volume, shape, cleavage spacing, and vertical placement on the ribcage — do not enlarge, shrink, lift to the collarbone, or drop toward the belly',
  )
  if (/가는\s*허리|얇은\s*허리|잘록|개미\s*허리|slim\s*waist|narrow\s*waist|wasp\s*waist/i.test(t)) {
    bits.push('same slim narrow waist as source / clothed silhouette')
  }

  if (opts?.forNudeHold || wantsFullNude(t) || /음모|치모|누드|나체|nude|naked/i.test(t)) {
    bits.push(
      ...(opts?.skipIdentityAndSexLocks ? [] : [buildFemaleAdultAnatomyLock(t)]),
      'nude anatomy continuity: same woman, female breasts and bare hips/crotch — no underwear redrawn',
      // I2V는 과도한 음모 장문이 안전필터·순응도 모두 해침 → 짧게
      opts?.forNudeHold
        ? 'adult nude crotch, neat Korean-30s pubic patch on the mons (slightly fuller than 20s, still tidy), no panties'
        : buildAdultPubicHairLock(t),
    )
  }

  bits.push(
    opts?.allowPoseChange
      ? 'Do NOT morph into a different woman or different face. Pose MAY change for the motion (kiss lean-in, hand on breast, undress) and MUST STAY in that new pose at the end — FORBIDDEN returning to the exact source still pose.'
      : 'Do NOT morph into a different woman, different face, or different body. Small natural motion is OK; do not hard-reset to a different identity.',
  )
  return bits.join('. ') + '.'
}

/**
 * 쇼츠 카메라 — 기본은 원본 구도 고정. 줌/클로즈업은 모션에 사용자가 적을 때만.
 * 「head AND feet」를 무조건 쓰면, 허벅지까지인 원본(실측)을 전신으로 재프레이밍하다가
 * 가슴 동작에서 상체 줌인으로 도망간다.
 */
export function buildShortsCameraLock(input: {
  clipRole?: 'single' | 'dual-a' | 'dual-b'
  undressOrNude?: boolean
  endCloseUp?: boolean
  sourceBust?: boolean
}): string {
  if (input.sourceBust === true && input.undressOrNude === true && input.clipRole !== 'dual-b') {
    return 'CAMERA: slow ZOOM OUT / pull-back from this ID/bust crop to standing FULL BODY, head-to-shoes. Face stays visible the whole time. Body scale matches this face. Clothes come off DURING the pull-back. FORBIDDEN zoom-in, tilt-down, chest-only crop, cutting the head off. End wide: full body in frame.'
  }
  if (input.endCloseUp === true) {
    return input.undressOrNude === true
      ? 'CAMERA: keep source crop while clothes come off. After she is nude, slowly push in toward the requested action (user asked for zoom). Face may grow only then.'
      : 'CAMERA: may slowly push in because the user asked for zoom/close-up. Do not zoom unless that was asked.'
  }
  const base =
    'CAMERA: NO zoom, NO tilt-down, NO push-in. Keep EXACT source crop. Same head size, same amount of body visible as the source. FORBIDDEN chest close-up, neck-down crop, cutting the head off.'
  return input.undressOrNude === true
    ? `${base} Nude only what that crop already shows. FORBIDDEN covering breasts with both hands.`
    : base
}

/** 모션에 「클로즈업으로 끝내」「줌인 유지」 등 — 종결만 클로즈 */
export function wantsEndCloseUp(motion: string): boolean {
  const t = polishKoreanPromptText(motion || '')
  return /클로즈\s*업\s*(으로\s*)?(끝|종|마무리)|줌\s*인\s*(으로\s*)?(끝|유지|종)|줌인\s*상태|클로즈업\s*상태|가까이\s*(에서\s*)?(끝|마무리)|close[\s-]?up\s*(end|ending|finish|hold)|end\s*(on\s*)?(a\s*)?close[\s-]?up|stay\s*zoomed|keep\s*zoomed|no\s*zoom[\s-]?out/i.test(
    t,
  )
}

/** 사용자가 줌/클로즈업을 요청했는지 — 안 적으면 줌 금지 */
export function wantsRequestedZoom(motion: string): boolean {
  const t = polishKoreanPromptText(motion || '')
  if (!t) return false
  if (wantsEndCloseUp(t)) return true
  return /줌\s*인|줌인|클로즈\s*업|클로즈업|가까이\s*(다가|찍|보여)|zoom[\s-]?in|close[\s-]?up|push[\s-]?in/i.test(
    t,
  )
}

/** 정지 이미지를 짧은 영상으로 바꿀 때 쓰는 I2V 모션 프롬프트.
 *  clipRole: single=한 클립(줌 연출 없음) · dual-a=24/30 전반 · dual-b=후반 */
export function buildAnimationPrompt(input: {
  prompt?: string
  motion?: string
  /**
   * 오염되지 않은 사용자 원문 모션(ensureNudeHoldMotionPhrase의 팬티금지/포그금지
   * 상용구가 붙기 전). 상용구에 "crotch"/"크롯치" 단어가 항상 포함돼 있어서, 이게 없으면
   * 가슴/키스 요청도 크롯치 애무로 뒤집히는 부위 오판 회귀가 생긴다(실측). 부위·동작
   * 판별(가슴/보지/키스 대상)은 반드시 이 값으로 한다 — 없으면 motion으로 폴백.
   */
  rawMotion?: string
  clipRole?: 'single' | 'dual-a' | 'dual-b'
  landmarks?: BodyLandmarks | null
  /** 「몸매 투영」버튼 — 번역으로 한글 트리거가 희석돼도 become 경로 고정 */
  bodyProject?: boolean
  /** 실제 클립 길이(초) — BEAT 타임라인을 "3등분 약속"에 맞춰 구체적 초로 표기 */
  durationSec?: number
  /** 사용자가 UI에서 직접 고른 가슴 높이(high/mid/low) — 없으면(auto) 기존 추정 로직 사용 */
  bustHeight?: string
  /** 지금장 얼굴 수. 있으면 모션 문구보다 우선 — 1이면 상대를 만들지 않음 */
  sourcePeople?: 1 | 2
  /** 증명/상반신 소스 — 벗기는 줌인이 아니라 줌아웃으로 전신을 연다 */
  sourceBust?: boolean
  /** ww = 여여. 있으면 남녀 강제·여여 금지를 쓰지 않음 */
  sourceCast?: 'ww' | 'mw'
  /** 일러스트(free) 소스는 컷아웃·검은 배경을 흰 스튜디오로 바꾸지 않음 */
  genMode?: 'free' | 'fashion'
}): string {
  const fullOriginal = polishKoreanPromptText(input.prompt ?? '')
  const clipRole = input.clipRole === 'dual-a' || input.clipRole === 'dual-b' ? input.clipRole : 'single'
  const landmarks = input.landmarks ? normalizeBodyLandmarks(input.landmarks) : null
  // 참고문은 짧게 줄여서 모션 힌트와의 경쟁을 줄이지만, 누드/탈의 판별(sourceIsNude)은
  // 원문 전체로 해야 한다 — 여러 번 수정을 거치며 누적된 텍스트는 "누드로 바꿔줘" 같은
  // 문구가 뒤쪽(잘려 나가는 부분)에 있을 수 있어서, 잘린 텍스트만 보면 이미 누드인 원본을
  // "옷을 입은 상태"로 잘못 판정해 되레 옷을 입혀버리는 사고가 날 수 있다.
  const motion = polishKoreanPromptText(input.motion ?? '')
  // 부위/동작(가슴 vs 보지 vs 키스 대상) 판별 전용 — 팬티금지 상용구 오염이 없는 원문.
  const detectionMotion = polishKoreanPromptText(input.rawMotion ?? input.motion ?? '')
  const intimate = amplifyAdultMotionForVideo(detectionMotion)
  // 단일 판별기 — 누적 base의 몸매 투영 잔여만으로 매번 탈의 강제하지 않음
  const nudeIntent = resolveNudeIntent({
    motion,
    prompt: fullOriginal,
    base: fullOriginal,
    bodyProject: input.bodyProject === true,
  })
  const forceBecomeNude =
    nudeIntent.mode === 'become' || (!motion.trim() && isBodyProjectRequest(fullOriginal))
  const holdOnly = nudeIntent.mode === 'hold'
  const continuityText = stripNudeBecomesPhrase(fullOriginal)
  const sourceIsNude =
    !forceBecomeNude &&
    (holdOnly ||
      /현재\s*나체|옷\s*없음/.test(continuityText) ||
      (/fully\s*nude|already\s*(fully\s*)?nude|bare\s*breasts?\s*,\s*visible\s*nipples?/i.test(
        continuityText,
      ) &&
        !NUDE_STATE_WORD_PATTERN.test(motion)))
  const undressAction =
    forceBecomeNude ||
    wantsUndressAction(motion) ||
    wantsOtbeotgim(detectionMotion) ||
    (wantsNudeOrUndress(motion) && !sourceIsNude)
  const clothesPeel = wantsOtbeotgim(`${detectionMotion} ${motion}`)
  const bustAnchor = landmarks ? buildBodyLandmarkCoordsLockShort(landmarks) : ''
  const dressAction = !undressAction && wantsDressAction(motion)
  const staysNude = sourceIsNude && !undressAction && !dressAction
  const forcedPeople = input.sourcePeople === 1 || input.sourcePeople === 2 ? input.sourcePeople : null
  const coupleRequested =
    forcedPeople === 1
      ? false
      : forcedPeople === 2
        ? true
        : intimate.wantsPartner ||
          /남녀|남여|둘\s*다|남자와|여성과|커플|서로|partner|couple|both\s*adults|man\s+and\s+woman/i.test(
            `${motion} ${detectionMotion}`,
          )
  // 지금장 인원(sourcePeople)이 있으면 그 값이 우선. 문구·체크박스로 없는 상대를 만들지 않음.
  const twoPeopleInSource =
    forcedPeople === 1
      ? false
      : forcedPeople === 2
        ? true
        : /남녀|남여|둘\s*다|남자와|여성과|커플|서로|both\s*adults|man\s+and\s+woman|couple|사진에는 두 사람/i.test(
            `${detectionMotion} ${motion}`,
          )

  // 몸매 투영 버튼만 become 단축. 옷벗김 타점은 leanIntimate에 좌표만 붙인다 —
  // landmarks가 있으면 주무르기 경로를 가로채던 실측을 막는다.
  if (input.bodyProject === true) {
    return buildNudeBecomesAnimationPrompt({
      motion: motion || '몸매 투영',
      clipRole,
      prompt: fullOriginal,
      landmarks,
      durationSec: input.durationSec,
      bustHeight: input.bustHeight,
    })
  }

  // 백허그: 나체/탈의 여부와 무관하게 전용 경로 — leanIntimate 밖(기본 경로)으로
  // 빠지면 TIME 비트가 약해지고, "exact source framing" 카메라가 옆서기 원본에 고정됨(실측).
  const wantsBackHugPoseEarly =
    intimate.wantsBackHug === true ||
    wantsBackHug(detectionMotion) ||
    wantsBackHug(motion)
  if (wantsBackHugPoseEarly) {
    const kissIntensityBh = detectKissIntensity(detectionMotion) || detectKissIntensity(motion) || 'kiss'
    const wantsKissBh = detectKissIntensity(detectionMotion) != null || detectKissIntensity(motion) != null
    const wantsBreastBh =
      intimate.addon.includes('breast fondling') ||
      intimate.addon.includes('breast play') ||
      new RegExp(`(?:가슴|젖|유방)\\s*(?:을|를)?\\s*(?:${TOUCH_ACTION_VERBS_KO}|애무)|breast\\s*fondl`, 'i').test(
        detectionMotion,
      )
    const touchVerbPhraseBh = detectTouchVerbPhrase(detectionMotion)
    const threeAction = wantsKissBh && wantsBreastBh
    // 탈의+3동작은 시간이 부족하므로: 탈의는 BEAT1에 흡수, 동작은 2~3비트
    const nBeats = (threeAction ? 3 : 2) as 2 | 3
    const totalBh = resolveClipTotalSec(input.durationSec)
    // BEAT1(포즈 형성)에 시간을 더 줌 — 옆서기→뒤로 이동이 가장 어려움
    const bhBounds =
      nBeats === 3
        ? [0, Math.max(3, Math.round(totalBh * 0.38)), Math.max(5, Math.round(totalBh * 0.68)), totalBh]
        : [0, Math.max(4, Math.round(totalBh * 0.45)), totalBh]
    const t1 = `0–${bhBounds[1]}s`
    const t2 = `${bhBounds[1]}–${bhBounds[2]}s`
    const t3 = nBeats >= 3 ? `${bhBounds[2]}–${bhBounds[3]}s` : ''
    const poseLock =
      'POSE every second: man stands DIRECTLY BEHIND her (his chest on her BACK). His head is over/behind her shoulder. BOTH arms wrap her torso from behind. FORBIDDEN: beside her, side-hug, hand-only on hip, face-to-face, passport stance.'
    const camBh =
      'CAMERA: keep a WIDE shot showing both full upper bodies. Bodies may RECOMPOSE inside the frame so he moves from beside her to BEHIND her — that rearrange is REQUIRED. FORBIDDEN face-only close-up; FORBIDDEN freezing the opening side-by-side stance.'
    let beat1: string
    let beat2: string
    let beat3 = ''
    if (undressAction && threeAction) {
      beat1 = `BEAT1 (${t1}): clothes off → full nude AND he steps from beside/front to DIRECTLY BEHIND her into back-hug. ${poseLock} No kiss/breast yet.`
      beat2 = `BEAT2 (${t2}): HOLD back-hug. She tilts head back. ${kissIntensityActionLine(kissIntensityBh, { backHug: true })} Hands not on breasts yet.`
      beat3 = `BEAT3 (${t3}): HOLD back-hug. Both hands around onto her bare breasts, ${touchVerbPhraseBh} continuously.`
    } else if (undressAction) {
      beat1 = `BEAT1 (${t1}): undress to full nude while he moves BEHIND her into back-hug. ${poseLock}`
      beat2 = wantsKissBh
        ? `BEAT2 (${t2}): HOLD back-hug. She tilts head back. ${kissIntensityActionLine(kissIntensityBh, { backHug: true })}`
        : wantsBreastBh
          ? `BEAT2 (${t2}): HOLD back-hug. Hands on bare breasts from behind, ${touchVerbPhraseBh}.`
          : `BEAT2 (${t2}): HOLD nude back-hug to the end. ${poseLock}`
    } else if (threeAction) {
      beat1 = `BEAT1 (${t1}): CRITICAL pose change — he MOVES BEHIND her now (leave side-by-side). Chest to her back, both arms wrap. ${poseLock} Kiss/breast NOT yet.`
      beat2 = `BEAT2 (${t2}): KEEP behind her. She tilts head back. ${kissIntensityActionLine(kissIntensityBh, { backHug: true })} Hands not on breasts yet.`
      beat3 = `BEAT3 (${t3}): KEEP behind her. Both hands cup bare breasts from behind, ${touchVerbPhraseBh}.`
    } else if (wantsKissBh) {
      beat1 = `BEAT1 (${t1}): he MOVES BEHIND her into back-hug (leave side-by-side). ${poseLock}`
      beat2 = `BEAT2 (${t2}): KEEP behind. She tilts head back. ${kissIntensityActionLine(kissIntensityBh, { backHug: true })}`
    } else if (wantsBreastBh) {
      beat1 = `BEAT1 (${t1}): he MOVES BEHIND her into back-hug. ${poseLock}`
      beat2 = `BEAT2 (${t2}): KEEP behind. Hands on bare breasts from behind, ${touchVerbPhraseBh}.`
    } else {
      beat1 = `BEAT1 (${t1}): he MOVES BEHIND her into back-hug (leave side-by-side). ${poseLock}`
      beat2 = `BEAT2 (${t2}): HOLD back-hug — he never returns to her side.`
    }
    const holdStartBh = wanHoldStartSec(totalBh)
    const lastBh = wantsBreastBh
      ? 'still back-hug, hands on her breasts from behind'
      : wantsKissBh
        ? 'still back-hug, still kissing over her shoulder, head tilted back'
        : 'still back-hug — man behind her'
    const nudeHint =
      undressAction || staysNude
        ? 'She is / becomes fully nude.'
        : 'Keep her outfit unless undress was requested.'
    return assembleWanSections([
      wanSection(
        'MOTION',
        [
          'BACK-HUG ONLY: man BEHIND woman, chest-to-back, arms wrapped from behind for the WHOLE clip.',
          nudeHint,
          poseLock,
        ].join(' '),
      ),
      wanSection(
        'TIME',
        [
          nBeats >= 3 ? 'THREE beats — pose change first, then actions; never merge:' : 'TWO beats — pose change first; never merge:',
          beat1,
          beat2,
          beat3,
          `HOLD ${holdStartBh}–${totalBh}s: FREEZE ${lastBh}. ${WAN_END_NO_SNAPBACK}`,
        ]
          .filter(Boolean)
          .join(' '),
      ),
      wanSection(
        'CAST',
        twoPeopleInSource || coupleRequested
          ? `${buildCoupleFaceLock()} Same two adults; man stays behind her.`
          : 'Two adults: man behind woman.',
      ),
      wanSection(
        'BODY',
        [
          staysNude || undressAction ? 'Same breast size (ambiguous: +½–1 cup max).' : 'Same body proportions as source.',
          buildBustHeightPreferenceLine(input.bustHeight),
          staysNude || undressAction ? buildWanPubicLine(`${detectionMotion} ${fullOriginal}`) : '',
        ]
          .filter(Boolean)
          .join(' '),
      ),
      wanSection('CAM', camBh),
      wanSection('END', buildWanEndHold({ durationSec: totalBh, mode: 'action', actionHint: lastBh })),
    ])
  }

  // 나체+키스/만짐: 장문 잠금이 Wan에서 키스·나체를 죽이고 "툭 만짐"만 남는 실측
  // → 짧은 동작 타임라인 전용 프롬프트로 보낸다.
  // "그냥 나체가 되어 선다"처럼 동작 없는 순수 탈의 요청도 예전엔 이 짧은 경로를 안 타고
  // 아래 "기본 경로"(13,000자대 장문)로 빠졌는데, 실측 결과 그 장문 경로는 Wan이 거의
  // 통째로 무시하고 "미소 짓는 클로즈업 인물영상"을 기본값으로 뱉어버려 탈의가 0%였다.
  // → undressAction/staysNude면 동작 유무와 무관하게 전부 이 짧은 경로로 통일한다.
  // 옷 입은 커플 키스 — leanIntimate(나체)로 보내면 1초 만에 남자 삭제+여자 나체가 됨(실측)
  const clothedCoupleKiss =
    twoPeopleInSource &&
    detectKissIntensity(detectionMotion) != null &&
    !undressAction &&
    !staysNude &&
    !clothesPeel &&
    !wantsNudeOrUndress(detectionMotion)

  if (clothedCoupleKiss) {
    const total = resolveClipTotalSec(input.durationSec)
    const hold = wanHoldStartSec(total)
    const mid = Math.max(1, Math.round(hold / 2))
    return assembleWanSections([
      wanSection(
        'MOTION',
        'BOTH source adults stay in frame. Passionate mouth-to-mouth kiss. Mouths stay locked through the last frame. Keep source clothes. FORBIDDEN pulling faces apart, releasing the bodies, or the opening still. FORBIDDEN nude or undress. FORBIDDEN the man disappearing. FORBIDDEN a solo woman.',
      ),
      wanSection(
        'TIME',
        `BEAT1 0–${mid}s: they start kissing — both visible, clothes on. BEAT2 ${mid}–${hold}s: keep kissing, mouths locked, bodies pressed. HOLD ${hold}–${total}s: FREEZE both still kissing, mouths locked, clothes on. FORBIDDEN unclenching.`,
      ),
      wanSection(
        'CAST',
        `${buildCoupleFaceLock()} BOTH stay visible every second. He stays male. FORBIDDEN deleting the man.`,
      ),
      wanSection('BODY', 'Same two bodies and source clothes. Do not undress.'),
      wanSection('CAM', 'CAMERA: source crop. Both faces in frame. NO zoom.'),
      wanSection(
        'END',
        `Last frames: mouths still locked, bodies still pressed, still kissing, clothes on, man still in frame. FORBIDDEN pulling apart. FORBIDDEN the opening still. FORBIDDEN solo woman. FORBIDDEN nude.`,
      ),
    ])
  }

  // 옷 입은 커플 지퍼 — leanIntimate로 보내면 바지가 녹고 자지가 그려짐(실측). 키스와 같이 전용 경로.
  const clothedCoupleZipper =
    (intimate.wantsMaleGenitalHand === true || wantsMaleGenitalHand(detectionMotion)) &&
    forcedPeople !== 1 &&
    !undressAction &&
    !staysNude &&
    !clothesPeel &&
    !wantsNudeOrUndress(detectionMotion)

  if (clothedCoupleZipper) {
    const total = resolveClipTotalSec(input.durationSec)
    const hold = wanHoldStartSec(total)
    const mid = Math.max(1, Math.round(hold / 2))
    return assembleWanSections([
      wanSection(
        'MOTION',
        `BOTH source adults stay in frame. ${MAN_ZIPPER_HAND_LINE} Keep source clothes. Pants stay on. FORBIDDEN nude or undress. FORBIDDEN penis. FORBIDDEN the man disappearing. FORBIDDEN a solo woman.`,
      ),
      wanSection(
        'TIME',
        `BEAT1 0–${mid}s: she pulls HIS zipper slider DOWN, fly opens — both visible, clothes on. BEAT2 ${mid}–${hold}s: zipper stays down, her hand on the open fly, pants on. HOLD ${hold}–${total}s: FREEZE zipper down, her hand there, clothes on.`,
      ),
      wanSection(
        'CAST',
        `${buildCoupleFaceLock()} BOTH stay visible every second. He stays male. FORBIDDEN deleting the man.`,
      ),
      wanSection('BODY', 'Same two bodies and source clothes. Pants stay on. Do not undress.'),
      wanSection('CAM', 'CAMERA: source crop. Both faces in frame. NO zoom.'),
      wanSection(
        'END',
        `Last frames: HIS zipper still down, her hand on the open fly, clothes on, man still in frame. FORBIDDEN zipper back up. FORBIDDEN penis. FORBIDDEN solo woman. FORBIDDEN nude.`,
      ),
    ])
  }

  const pantyMeltOnly = wantsPantyMeltOnly(`${detectionMotion} ${motion}`)
  if (pantyMeltOnly) {
    const total = resolveClipTotalSec(input.durationSec)
    const holdStart = wanHoldStartSec(total)
    return assembleWanSections([
      wanSection(
        'MOTION',
        `Same woman, exact source pose. Melt the remaining panty/thong until bare skin. ${SILK_MATCH_LINGERIE_LINE} FORBIDDEN adding clothes. FORBIDDEN standing up if she is sitting. Face stays in frame. No second adult.`,
      ),
      wanSection(
        'TIME',
        `BEAT1 0–${holdStart}s: panty dissolves to bare skin. HOLD ${holdStart}–${total}s: FREEZE same pose, fully nude, panty gone. ${WAN_END_NO_SNAPBACK}`,
      ),
      wanSection('CAST', 'Only the source woman — do not invent a partner.'),
      wanSection('BODY', 'Same body as source. Bare skin where the panty was. ZERO new fabric.'),
      wanSection('CAM', 'CAMERA: exact source crop. FACE in frame. FORBIDDEN zoom.'),
      wanSection('END', buildWanEndHold({ durationSec: total, mode: 'nude' })),
    ])
  }

  const zipperAsk = /지퍼|zipper|unzip|(?:pants\s*)?fly/i.test(detectionMotion)
  const nudeCoupleZipper =
    zipperAsk &&
    forcedPeople !== 1 &&
    (staysNude || /이미\s*(?:완전\s*)?나체|여자는 나체|나체 유지/i.test(detectionMotion))
  if (nudeCoupleZipper) {
    const total = resolveClipTotalSec(input.durationSec)
    const hold = wanHoldStartSec(total)
    const mid = Math.max(1, Math.round(hold / 2))
    return assembleWanSections([
      wanSection(
        'MOTION',
        `She stays nude as source — bare skin. ${MAN_ZIPPER_HAND_LINE} FORBIDDEN a zipper, seam, or fly drawn on her belly, skin, or crotch.`,
      ),
      wanSection(
        'TIME',
        `BEAT1 0–${mid}s: she pulls HIS pants zipper down. BEAT2 ${mid}–${hold}s: her hand on HIS open fly. HOLD ${hold}–${total}s: freeze. She still nude, no zipper on her.`,
      ),
      wanSection('CAST', `${buildCoupleFaceLock()} He stays male, dressed. She stays the source woman.`),
      wanSection('BODY', 'Her skin has NO zipper. His pants stay on, fly open.'),
      wanSection('CAM', 'CAMERA: source crop. BOTH heads in every frame. FORBIDDEN belly close-up, FORBIDDEN cropping heads. NO zoom.'),
      wanSection(
        'END',
        'Last frames: HIS zipper down, her hand on HIS fly. FORBIDDEN zipper on her body. FORBIDDEN penis. FORBIDDEN losing the man.',
      ),
    ])
  }

  const leanIntimate = undressAction || staysNude

  if (leanIntimate) {
    const wantsKiss = detectKissIntensity(detectionMotion) != null
    const kissIntensity = detectKissIntensity(detectionMotion) || 'kiss'
    const splitHands = detectSplitHandTargets(detectionMotion)
    // 「Last frame bare crotch」「to BARE crotch」는 탈의 끝 상태 — 보지 애무가 아님.
    // 그 단어만으로 wantsCrotch가 켜지면 5초 벗기가 아래 확대·손 애무로 새어 나감(실측).
    const crotchDetect = detectionMotion
      .replace(/last\s+frame\s+bare\s+crotch/gi, ' ')
      .replace(/to\s+bare\s+crotch/gi, ' ')
      .replace(/freeze\s+bare\s+crotch/gi, ' ')
      .replace(/bare\s+crotch\s+first/gi, ' ')
      .replace(/bare\s+breasts?(?:\s*[+,]\s*|\s+and\s+)bare\s+crotch/gi, ' ')
      .replace(/bare\s+hips\/crotch/gi, ' ')
    const wantsCrotch =
      Boolean(splitHands && (splitHands.left === 'vulva' || splitHands.right === 'vulva')) ||
      intimate.addon.includes('CROTCH FONDLE') ||
      intimate.addon.includes('SPLIT HANDS') ||
      intimate.addon.includes('TWO HANDS') ||
      /보지|음부|클리|외음|크롯치|crotch|pussy|vulva|clit/i.test(crotchDetect)
    const wantsMaleHand =
      intimate.wantsMaleGenitalHand === true || wantsMaleGenitalHand(detectionMotion)
    const wantsBreast =
      Boolean(splitHands && (splitHands.left === 'breast' || splitHands.right === 'breast')) ||
      intimate.addon.includes('breast fondling') ||
      intimate.addon.includes('breast play') ||
      intimate.addon.includes('SPLIT HANDS') ||
      intimate.addon.includes('TWO HANDS') ||
      new RegExp(
        `(?:가슴|젖|유방)\\s*(?:을|를)?\\s*(?:${TOUCH_ACTION_VERBS_KO}|애무)|breast\\s*fondl|knead(?:s|ing)?\\s*(?:her\\s*)?(?:own\\s*)?(?:breast|chest)`,
        'i',
      ).test(detectionMotion)
    const soloSplitHands =
      Boolean(splitHands) && !intimate.wantsPartner && !twoPeopleInSource
    const soloSelfBreast =
      wantsBreast &&
      !soloSplitHands &&
      isSoloSelfTouch(detectionMotion) &&
      !intimate.wantsPartner
    // 옷벗김 후 가슴 주무르기: 겹벗김(브라·팬티 유지)으로 가면 팬티가 끝까지 남고
    // 손은 가리기만 한다(일러스트 15초 실측). 먼저 완전 나체, 그다음 주무른다.
    const peelThenKnead = soloSelfBreast && undressAction
    const peelLayers = clothesPeel && !peelThenKnead
    const selfKneadLock =
      'BOTH her own hands knead and squeeze her bare breasts — nipples stay visible between fingers. FORBIDDEN modest covering, palms hiding nipples, or hands only resting on the chest.'
    const sourceScaleLock =
      input.genMode === 'free'
        ? 'Keep the source crop, subject scale, and cutout/illustration look. Black void stays black. FORBIDDEN filling the frame, zoom-in, a white photo studio, or a different person.'
        : 'Keep the source crop, subject scale, and background. FORBIDDEN filling the frame, zoom-in, a white studio, or a different person.'
    const allowZoom = wantsRequestedZoom(detectionMotion)
    const touchVerbPhrase = detectTouchVerbPhrase(detectionMotion)
    // 상호 만짐: 남자→여 가슴 + 여자→남 자지 (정책 금지가 아니라 예전엔 경로가 없어서 무시됨)
    const mutualBreastHandjob = wantsBreast && wantsMaleHand
    const twoWomenAsk =
      input.sourceCast === 'ww' || isExplicitTwoWomenCast(`${detectionMotion} ${fullOriginal}`)
    const pairTouch = wantsKiss || wantsBreast || wantsCrotch || wantsMaleHand
    const sourcePairIntimate =
      twoPeopleInSource && !twoWomenAsk && (pairTouch || undressAction || staysNude)
    const pairUndressOnly = twoPeopleInSource && undressAction && !pairTouch && twoWomenAsk
    if (pairUndressOnly) {
      const total = resolveClipTotalSec(input.durationSec)
      const holdStart = wanHoldStartSec(total)
      const beatEnd = Math.max(4, Math.min(holdStart - 1, Math.round(total * 0.7)))
      return assembleWanSections([
        wanSection(
          'MOTION',
          'Undress EVERY woman in this photo to full nude. Same two faces, same crop. FORBIDDEN hugging, touching, fondling, kissing, or holding the other. FORBIDDEN one woman staying dressed while touching the other. FORBIDDEN inventing a man. If a man is truly in the photo he keeps his clothes and does not touch.',
        ),
        wanSection(
          'TIME',
          `BEAT1 0–${beatEnd}s: both women lose ALL clothes (top, bra, pants, panties). Hands stay off each other. HOLD ${holdStart}–${total}s: FREEZE both fully nude, not touching. ${WAN_END_NO_SNAPBACK}`,
        ),
        wanSection(
          'CAST',
          twoWomenAsk
            ? 'Same two source women. They stay two women. FORBIDDEN turning one into a man. FORBIDDEN a new person.'
            : 'Same two source faces. If both are women they stay two women. FORBIDDEN inventing a man. FORBIDDEN a new person.',
        ),
        wanSection(
          'BODY',
          [
            'Same breast size/height and waist-hip as source.',
            buildBustHeightPreferenceLine(input.bustHeight),
            buildWanPubicLine(`${detectionMotion} ${fullOriginal}`),
          ]
            .filter(Boolean)
            .join(' '),
        ),
        wanSection('CAM', 'CAMERA: exact source crop. Both faces in frame. FORBIDDEN zoom.'),
        wanSection(
          'END',
          `Last frames: both women fully nude, hands off each other. FORBIDDEN hug or fondle. FORBIDDEN snapback to clothes.`,
        ),
      ])
    }
    const plainNudeOnly =
      !twoPeopleInSource &&
      !intimate.wantsPartner &&
      !intimate.addon &&
      !wantsKiss &&
      !wantsCrotch &&
      !wantsBreast &&
      !wantsMaleHand &&
      !new RegExp(`${TOUCH_ACTION_VERBS_KO}|애무`, 'i').test(detectionMotion)
    if (plainNudeOnly) {
      const bounds = undressAction ? buildEqualBeatSeconds(input.durationSec, 2) : null
      const half = bounds ? bounds[1] : 0
      const total = bounds ? bounds[2] : resolveClipTotalSec(input.durationSec)
      const holdStart = wanHoldStartSec(total)
      // 「나체」「fully nude」처럼 상태 단어만 오면 MOTION이 빈약해 Wan이 탈의를 놓침
      // → TIME의 비트와 맞춰 MOTION을 동작 문장으로 승격한다.
      const nudeStateOnly = /^(?:fully\s*)?(?:nude|naked)\.?$|^(?:나체|누드|전라)\.?$/i.test(
        motion.trim(),
      )
      const deskShort = total <= 6
      const nextLayerOnly = /다음\s*겹만/.test(`${detectionMotion} ${motion}`)
      const bustPullBack = input.sourceBust === true && undressAction && clipRole !== 'dual-b'
      const peelBeat1End = deskShort
        ? 4
        : total <= 10
          ? 3
          : Math.min(holdStart - 2, Math.max(3, Math.round(total * 0.35)))
      const peelHoldStart = deskShort ? 4 : total <= 10 ? total - 2 : holdStart
      const motionLine = undressAction
        ? clothesPeel
          ? deskShort
            ? nextLayerOnly
              ? bustPullBack
                ? `${bustAnchor} NEXT LAYER only. Slow ZOOM OUT to standing full body matching this face. Melt the current remaining outer garment while pulling back. Face stays in. FORBIDDEN zoom-in or tilt-down.`
                : `${bustAnchor} NEXT LAYER only. Melt the current remaining outer garment (skirt if skirt remains; panty only if it is the last layer). Same pose. ${SILK_MATCH_LINGERIE_LINE} FORBIDDEN standing up. Face in frame.`
              : bustPullBack
                ? `${bustAnchor} ONE LAYER. Slow ZOOM OUT from this bust to standing full body, same person, same body scale as the face. Melt the outer garment while the camera pulls back. KEEP source skirt/bottoms. Face stays in frame. FORBIDDEN zoom-in, tilt-down, cutting the head, a second adult.`
                : `${bustAnchor} ONE LAYER only. Melt the current outer garment slowly. KEEP source skirt/bottoms. ${SILK_MATCH_LINGERIE_LINE} FORBIDDEN instant topless. Exact source pose. If sitting, stay sitting. Face in frame. FORBIDDEN a second adult.`
            : bustPullBack
              ? `${bustAnchor} ${OTBEOTGIM_WAN_LINE} Slow ZOOM OUT to standing full body matching this face. Face stays in frame. FORBIDDEN zoom-in, tilt-down, covering breasts.`
              : `${bustAnchor} ${OTBEOTGIM_WAN_LINE} Face stays in frame. FORBIDDEN covering breasts. FORBIDDEN tilt-down.`
          : nudeStateOnly || !motion.trim()
            ? bustPullBack
              ? 'Same woman. Slow ZOOM OUT to standing full body while removing clothes. Face stays in. FORBIDDEN zoom-in or tilt-down.'
              : 'Same woman removes ALL clothes (top, bra, pants, panties) until fully nude — keep source pose, face stays in frame, no dance/walk-away. FORBIDDEN covering breasts with hands. FORBIDDEN tilting the camera down to hide her head.'
            : `${motion} Face stays in frame at source crop. Keep source pose. FORBIDDEN covering breasts with hands. FORBIDDEN tilt-down neck-only.`
        : nudeStateOnly || !motion.trim()
          ? 'Stay fully nude for the whole clip — same woman as source, face in frame.'
          : motion
      return assembleWanSections([
        wanSection('MOTION', motionLine),
        wanSection(
          'TIME',
          undressAction
            ? clothesPeel
              ? deskShort
                ? nextLayerOnly
                  ? bustPullBack
                    ? `BEAT1 0–4s: pull-back to full body AND melt only the next remaining layer. Head stays in. HOLD 4–${total}s: FREEZE standing full body in that new state. FORBIDDEN zoom-in.`
                    : `BEAT1 0–4s: melt only the next remaining layer. Same pose. ${SILK_MATCH_LINGERIE_LINE} HOLD 4–${total}s: FREEZE that new state. FORBIDDEN standing up or zoom.`
                  : bustPullBack
                    ? `BEAT1 0–4s: camera PULLS BACK to standing full body (head to shoes) while melting the outer/top only. Skirt stays. Face stays in. HOLD 4–${total}s: FREEZE that full-body frame. FORBIDDEN zoom-in or tilt-down.`
                    : `BEAT1 0–4s: KEEP source clothes. Melt the outer/top only, slowly. Skirt stays. If a bra shows, ivory/cream silk. FAILED black bra. Ivory panty under the skirt. FAILED instant topless or commando. HOLD 4–${total}s: FREEZE sitting, top gone, source skirt still on. FORBIDDEN standing up or zoom.`
                : bustPullBack
                  ? `BEAT1 0–${peelBeat1End}s: pull-back to full body. ${OTBEOTGIM_BEAT1_LINE} BEAT2 ${peelBeat1End}–${peelHoldStart}s: bra off, skirt to thighs, ivory panty still on, then panty OFF last, still full body. ${PANTY_MELT_FAIL} HOLD ${peelHoldStart}–${total}s: FREEZE standing full body, face visible, fully nude.`
                  : `BEAT1 0–${peelBeat1End}s: ${OTBEOTGIM_BEAT1_LINE} BEAT2 ${peelBeat1End}–${peelHoldStart}s: bra off, skirt to thighs, ivory panty still on, then panty OFF last. ${PANTY_MELT_FAIL} HOLD ${peelHoldStart}–${total}s: FREEZE same crop, face visible, fully nude, neat Korean-30s pubic patch on mons, ZERO fabric.`
              : `BEAT1 0–${half}s: remove ALL clothes → full nude. BEAT2 ${half}–${holdStart}s: stay nude (bare breasts, bare crotch, ZERO panties). HOLD ${holdStart}–${total}s: FREEZE still nude. ${WAN_END_NO_SNAPBACK}`
            : `0–${holdStart}s: fully nude entire time. HOLD ${holdStart}–${total}s: FREEZE still nude. ${WAN_END_NO_SNAPBACK}`,
        ),
        wanSection(
          'CAST',
          twoWomenAsk
            ? buildCoupleFaceLock()
            : twoPeopleInSource
              ? buildSourcePairCastLock()
              : coupleRequested
                ? 'If a man is in the source, keep him male; only undress who the motion names.'
                : 'Only the source woman — do not invent a partner.',
        ),
        wanSection(
          'BODY',
          [
            'Same breast size/height and waist-hip as source; natural jiggle only.',
            buildBustHeightPreferenceLine(input.bustHeight),
            buildWanPubicLine(`${detectionMotion} ${fullOriginal}`),
          ]
            .filter(Boolean)
            .join(' '),
        ),
        wanSection(
          'CAM',
          bustPullBack
            ? buildShortsCameraLock({
                clipRole,
                undressOrNude: true,
                sourceBust: true,
              })
            : 'CAMERA: exact source crop. FACE stays in frame. FORBIDDEN zoom, tilt-down, neck-down, covering breasts with hands.',
        ),
        wanSection(
          'END',
          buildWanEndHold({
            durationSec: total,
            mode: 'nude',
            holdStartSec: clothesPeel && !deskShort ? peelHoldStart : undefined,
          }),
        ),
      ])
    }

    // 키스 "대상 부위" — 「키스」단어만 보고 무조건 입-입으로 고정하면, 「보지에 키스」/
    // 「가슴에 키스」요청이 반영 안 되고(입-입 키스로 대체) 결국 크롯치 오판과 겹쳐
    // "손으로 만지기"만 남는 실측이 있었다. 명시된 대상이 있으면 그 부위 키스로 분기한다.
    // 단, wantsBreast(가슴 손터치)가 이미 따로 감지됐으면 "가슴을 만지고 입술에 키스"처럼
    // 가슴은 손터치 대상이고 키스는 입에 하는 별개 동작이므로 가슴 키스로 오분류하지 않는다
    // (실측: "가슴을 만지고 입술에 딮키스한다"가 입-가슴 키스로 잘못 나옴, 2026-08-28).
    const kissTarget = wantsKiss ? detectKissBodyTarget(detectionMotion) : null
    const kissTargetVulva = kissTarget === 'vulva'
    const kissTargetBreast = kissTarget === 'breast' && !wantsBreast
    // 순서가 있는 3단계 요청 — "가슴을 만진다 그리고 키스한다"처럼 두 동작을 접속사로
    // 잇는 경우, 이전엔 무조건 "동시에"(가슴 만지며 키스)로 뭉쳐버렸다. 접속사뿐 아니라
    // "빤 다음", "키스한 후", "만진 후", "애무하고 나서"처럼 동사 뒤에 「후/다음/뒤/나서」가
    // 바로 붙는 한국어 연결형도 순서 신호로 인식한다.
    const sequentialConnector =
      /그리고|그\s*다음|그\s*후|이어서|다음\s*으로|이후에?|순서대로|단계별로|차례로|and\s+then|after\s+that|then\s+(?:she\s+)?kiss|(?:빨|빤|키스|애무|입\s*(?:을\s*)?맞추|입\s*맞춰|만지|만져|만진|만졌|주무르|주물러|문지르|문질러|비비|비벼|꼬집|비틀|누르|눌러|움켜쥐|긁어|긁고|깨물어|깨물고|찌르|찔러)[가-힣]{0,3}\s*(?:다음|후|뒤|나서)(?:에)?/i.test(
        detectionMotion,
      )
    const sequentialBreastThenKiss =
      wantsBreast && wantsKiss && !kissTargetVulva && !kissTargetBreast && sequentialConnector
    // 상호: 가슴 만짐 + 자지 만짐 — 접속사 있으면 순차, 없으면 동시
    const sequentialMutualHand =
      mutualBreastHandjob && sequentialConnector && !sequentialBreastThenKiss
    const simultaneousMutualHand = mutualBreastHandjob && !sequentialConnector
    // 3등분/반반:
    // - 탈의 + 가슴→키스 = 3비트
    // - 이미 나체 + 가슴→키스 | 가슴→자지 = 2비트 (탈의 시간 없음)
    // - 탈의 + 단일/동시상호 = 2비트
    const threeWayWithUndress = undressAction && sequentialBreastThenKiss
    const twoWayAlreadyNude =
      !undressAction && (sequentialBreastThenKiss || sequentialMutualHand)
    const beatBounds = threeWayWithUndress
      ? buildEqualBeatSeconds(input.durationSec, 3)
      : undressAction || twoWayAlreadyNude
        ? buildEqualBeatSeconds(input.durationSec, 2)
        : null
    const clipTotal = resolveClipTotalSec(input.durationSec)
    const holdStart = wanHoldStartSec(clipTotal)
    const beat1TimeLabel = beatBounds ? `0–${beatBounds[1]}s` : 'first third'
    // BEAT2를 클립 끝까지 쓰면 HOLD와 겹쳐 마지막에 원본 선 자세로 스냅백됨(실측 15초).
    const beat2TimeLabel = !beatBounds
      ? `until ${holdStart}s`
      : threeWayWithUndress
        ? `${beatBounds[1]}–${beatBounds[2]}s`
        : `${beatBounds[1]}–${holdStart}s`
    const beat3TimeLabel =
      beatBounds && threeWayWithUndress ? `${beatBounds[2]}–${holdStart}s` : ''
    const sourceMan = sourcePairIntimate || twoPeopleInSource
    const manHand = sourceMan ? "the source MAN's hand" : 'her own hand'
    const manKiss = sourceMan ? 'the source MAN kisses' : 'she'
    const maleHandBeat = (label: string) =>
      `BEAT (${label}): ${MAN_ZIPPER_HAND_LINE}`
    const zoneEn = (z: 'breast' | 'vulva') => (z === 'breast' ? 'bare breast' : 'bare vulva/crotch')
    const splitHandBeat =
      wantsBreast && wantsCrotch && !wantsKiss && !wantsMaleHand
        ? splitHands
          ? soloSplitHands
            ? `BEAT 2 (${beat2TimeLabel}): ONLY if FULL NUDE. HER LEFT hand on her ${zoneEn(splitHands.left)}; HER RIGHT hand ON her ${zoneEn(splitHands.right)} — not thigh/hip. FORBIDDEN a partner.`
            : `BEAT 2 (${beat2TimeLabel}): HIS LEFT hand on her ${zoneEn(splitHands.left)}; HIS RIGHT hand on her ${zoneEn(splitHands.right)} — both at once, ${touchVerbPhrase}. ZERO panties. FORBIDDEN swapping left/right, FORBIDDEN both hands on one area.`
          : `BEAT 2 (${beat2TimeLabel}): one ${manHand} on her bare breast AND the other on her bare vulva at the same time — ${touchVerbPhrase}. ZERO panties.`
        : ''
    const crotchBeat = wantsCrotch
      ? intimate.wantsPartner
        ? `BEAT 2 (${beat2TimeLabel}): ${manHand} ON her bare vulva/crotch — ${touchVerbPhrase} the bare genitals with continuous skin contact. ZERO panties. FORBIDDEN hand only on thigh/hip.`
        : `BEAT 2 (${beat2TimeLabel}): her own hand ON her bare vulva/crotch — ${touchVerbPhrase} the bare genitals with continuous skin contact. ZERO panties. FORBIDDEN hand hovering on thigh without touching genitals.`
      : ''
    // 이미 나체 + 순차: BEAT1=가슴, BEAT2=키스 또는 자지
    const beat1AlreadyNudeAction = twoWayAlreadyNude
      ? `BEAT1 (${beat1TimeLabel}): ${manHand} on her bare breast, ${touchVerbPhrase} continuously — second action has NOT started yet.`
      : ''
    const beat2 = kissTargetVulva
      ? `BEAT 2 (${beat2TimeLabel}): ${manKiss} her bare vulva directly with his mouth — lips and mouth make continuous contact with the bare genitals. This is an ORAL kiss, NOT a hand touch — FORBIDDEN substituting a hand-only fondle for the requested mouth-to-vulva kiss.`
      : kissTargetBreast
        ? `BEAT 2 (${beat2TimeLabel}): ${manKiss} her bare breast and nipple directly with his mouth — lips make continuous contact with the nipple. This is an ORAL kiss on the breast, NOT a hand-only touch.`
        : sequentialMutualHand
          ? maleHandBeat(beat2TimeLabel)
          : twoWayAlreadyNude && sequentialBreastThenKiss
            ? `BEAT2 (${beat2TimeLabel}): hand leaves breast; ${kissIntensityActionLine(kissIntensity)}.`
            : threeWayWithUndress
              ? `BEAT 2 (${beat2TimeLabel}, right after undress finishes): ${manHand} on her bare breast, ${touchVerbPhrase} continuously — clear hand-to-skin contact. Kissing has NOT started yet in this beat.`
              : splitHandBeat
                ? splitHandBeat
                : wantsCrotch
                ? crotchBeat
                : simultaneousMutualHand
                  ? `BEAT (${beat2TimeLabel}): MUTUAL — HIS hand on HER bare breast; ${MAN_ZIPPER_HAND_LINE}`
                  : wantsMaleHand && !wantsBreast
                    ? maleHandBeat(beat2TimeLabel)
                    : wantsKiss && wantsBreast
                      ? `BEAT 2 (${beat2TimeLabel}): ${kissIntensityActionLine(kissIntensity)} while his hand continuously ${touchVerbPhrase} her bare breast. Kiss AND breast touch both stay visible — not a one-tap.`
                      : wantsKiss
                        ? sourcePairIntimate
                          ? `BEAT 2 (${beat2TimeLabel}): ${kissIntensityActionLine(kissIntensity)} — already fully nude. FORBIDDEN kissing clothed.`
                          : `BEAT 2 (${beat2TimeLabel}): ${kissIntensityActionLine(kissIntensity)}.`
                        : wantsBreast
                          ? soloSelfBreast
                            ? allowZoom
                              ? `BEAT 2 (${beat2TimeLabel}): ONLY after FULL NUDE (ZERO pants/bra/panty). ${selfKneadLock} Same bust as source. FORBIDDEN a partner.`
                              : `BEAT 2 (${beat2TimeLabel}): ONLY after FULL NUDE (ZERO pants/bra/panty). ${selfKneadLock} Same crop. FORBIDDEN zoom. FORBIDDEN a partner.`
                            : `BEAT 2 (${beat2TimeLabel}): a hand continuously ${touchVerbPhrase} her bare breast — sustained contact, not a tap; the breast tissue jiggles/bounces naturally with each motion, not stiff.`
                          : intimate.addon
                            ? `BEAT 2 (${beat2TimeLabel}): ${intimate.addon}`
                            : `BEAT 2 (${beat2TimeLabel}): hold the fully nude pose exactly as described in the motion below — bare breasts and bare vulva stay clearly visible, no new action invented beyond what the motion text says.`
    const beat3 = threeWayWithUndress
      ? `BEAT 3 (${beat3TimeLabel}): the hand leaves her breast; ${kissIntensityActionLine(kissIntensity)} for the rest of the clip until the last frame.`
      : ''
    const lastFrame = sequentialMutualHand || simultaneousMutualHand || wantsMaleHand
      ? `HIS zipper still down, her hand on the open fly, pants on. ${MAN_ZIPPER_HAND_LINE}`
      : sourcePairIntimate && undressAction && !wantsKiss
        ? `she fully nude BARE crotch (FAILED black panty), he still in his source clothes, ${COUPLE_MAN_SHIRT_ONLY} MAN still in frame — NOT a solo woman`
      : sourcePairIntimate && wantsKiss
        ? 'still mouth-to-mouth kiss, both FULLY nude (no shirt, no briefs), MAN still male — NOT side-by-side clothed standing'
      : sequentialBreastThenKiss
        ? kissIntensity === 'peck'
          ? 'still fully nude, lips just after a soft peck'
          : 'still fully nude, still passionately kissing her mouth (not a hand on the breast)'
        : kissTargetVulva
          ? 'fully nude, mouth still on bare vulva, ZERO panties'
          : kissTargetBreast
            ? 'fully nude, mouth still on bare breast/nipple, ZERO panties'
            : splitHands && wantsBreast && wantsCrotch
              ? 'fully nude, LEFT hand and RIGHT hand still on the two assigned places, ZERO panties'
            : wantsCrotch
              ? 'fully nude, hand still on bare crotch/vulva, ZERO panties'
              : soloSelfBreast
                ? allowZoom
                  ? 'still kneading, ZERO panties'
                  : 'still kneading, same crop, ZERO panties'
              : 'still fully nude (bare breasts + bare crotch, ZERO panties), holding the requested action'
    const timeBits = [
      threeWayWithUndress
        ? 'THREE beats (~equal thirds) — do not merge:'
        : twoWayAlreadyNude
          ? 'TWO beats (already nude — NO undress time) — do not merge:'
          : simultaneousMutualHand
            ? 'MUTUAL fondling — both hands active together:'
            : undressAction
              ? 'TWO beats — do not merge:'
              : '',
      twoWayAlreadyNude
        ? beat1AlreadyNudeAction
        : undressAction
          ? sourcePairIntimate
            ? `BEAT1 (${beat1TimeLabel}): SHE peels to nude, panty OFF last. ${COUPLE_MAN_SHIRT_ONLY}`
            : peelThenKnead
              ? `BEAT1 (${beat1TimeLabel}): remove ALL clothes → full nude. Panty OFF. Bare crotch FIRST. Hands stay OFF the chest until beat 2. FACE in source crop.`
            : peelLayers
              ? `BEAT1 (${beat1TimeLabel}): ${OTBEOTGIM_BEAT1_LINE}`
              : `BEAT1 (${beat1TimeLabel}): remove ALL clothes → full nude. Bare crotch FIRST (ZERO panties) before beat 2 starts. FACE in source crop. FORBIDDEN tilt-down or hiding breasts.`
          : wantsMaleHand || wantsBreast || wantsKiss || wantsCrotch
            ? twoPeopleInSource
              ? 'Start from the source couple pose — keep both adults. FORBIDDEN a third person.'
              : 'Start from the source photo — same person only. FORBIDDEN inventing anyone.'
            : 'Start already fully nude — bare breasts, bare crotch, ZERO panties/fog.',
      beat2,
      beat3,
      soloSplitHands
        ? `LAST ${holdStart}–${clipTotal}s: KEEP HER left/right on the two places (${lastFrame}). ZERO panties. FORBIDDEN snapback.`
        : soloSelfBreast
          ? `LAST ${holdStart}–${clipTotal}s: KEEP kneading to the last frame (${lastFrame}). FORBIDDEN putting clothes back on. FORBIDDEN snapback to the opening still.`
          : `HOLD ${holdStart}–${clipTotal}s: FREEZE end-state (${lastFrame}).`,
    ]
      .filter(Boolean)
      .join(' ')

    return assembleWanSections([
      wanSection(
        'MOTION',
        soloSplitHands
          ? undressAction
            ? `${allowZoom ? 'SAME CROP until fully nude, then zoom as asked.' : 'SAME CROP: exact source framing, NO zoom.'} ${bustAnchor} ${OTBEOTGIM_WAN_LINE} After bare crotch: HER LEFT hand on her ${zoneEn(splitHands.left)}, HER RIGHT hand ON her ${zoneEn(splitHands.right)} — not thigh. No partner. FORBIDDEN snapback.`
            : `${allowZoom ? 'BODY LOCK: same bust as source.' : 'SAME CROP, NO zoom.'} HER LEFT hand on her ${zoneEn(splitHands.left)}; HER RIGHT hand on her ${zoneEn(splitHands.right)}. ZERO panties. No partner.`
          : soloSelfBreast
          ? undressAction
            ? allowZoom
              ? `${sourceScaleLock} SAME CROP until fully nude (pants and panty OFF), then zoom as asked. ${bustAnchor} After ZERO panties, ${selfKneadLock} Do not invent a partner. Source clothes GONE. FORBIDDEN snapback.`
              : `${sourceScaleLock} ${bustAnchor} First ALL clothes OFF including panty. Then ${selfKneadLock} Do not invent a partner. Source clothes GONE. FORBIDDEN snapback.`
            : allowZoom
              ? `BODY LOCK: same bust/waist/hips as source. ${selfKneadLock} Camera may push in as asked. Do not invent a partner. ZERO panties. Last frame still kneading.`
              : `${sourceScaleLock} BODY LOCK: same bust/waist/hips as source. ${selfKneadLock} Do not invent a partner. ZERO panties. FORBIDDEN snapback to the opening still.`
          : sourcePairIntimate && undressAction && !wantsKiss
          ? `Keep BOTH source adults. She undresses to bare crotch. ${PANTY_MELT_FAIL} ${COUPLE_MAN_SHIRT_ONLY} Man stays visible and male. FORBIDDEN deleting the man or a solo woman.`
          : sourcePairIntimate && wantsKiss
          ? 'Keep BOTH source faces. Source MAN+WOMAN kiss mouth-to-mouth, both fully nude (no shirt/briefs/jeans). He stays male. NOT two women. Last frames stay kissing nude — FORBIDDEN clothes back on or pulling apart.'
          : wantsHeteroManWomanCast(detectionMotion)
          ? [
              'Keep BOTH source faces. The source MAN kisses the source WOMAN; his hand on her bare breast. NOT two women kissing. NOT a new person.',
              'Woman is FULL NUDE (no pants/belt).',
              motion || 'Man kisses woman and fondles her breast.',
            ].join(' ')
          : wantsMaleHand
            ? [motion || MAN_ZIPPER_HAND_LINE, 'She stays female. FORBIDDEN drawing a penis.'].join(' ')
            : twoPeopleInSource
              ? motion || 'Keep both source adults and follow the motion.'
              : motion || 'Follow the intimate action on the same woman as the source.',
      ),
      wanSection('TIME', timeBits),
      wanSection(
        'CAST',
        sourcePairIntimate
          ? buildSourcePairCastLock()
          : wantsHeteroManWomanCast(detectionMotion)
          ? buildHeteroManWomanCastLock()
          : wantsMaleHand
            ? `Two adults. ${MAN_ZIPPER_HAND_LINE} She stays female. FORBIDDEN futa / penis.`
            : undressAction && twoPeopleInSource
              ? `${buildSourcePairCastLock()} FORBIDDEN turning him into a second woman.`
              : twoPeopleInSource
                ? buildCoupleFaceLock()
                : soloSplitHands || soloSelfBreast
                  ? 'Only the source woman — do not invent a partner. HER OWN hands only.'
                  : 'Only the people in the source photo. FORBIDDEN inventing a partner, extra person, or new face.',
      ),
      wanSection(
        'BODY',
        sourcePairIntimate && wantsKiss
          ? 'Same body proportions as source. Bare crotch, ZERO panties.'
          : [
              wantsMaleHand ? buildWanFemaleSexLock() : '',
              peelLayers
                ? 'Same bust volume as the clothed mound — FORBIDDEN smaller breasts. Pants and belt must be gone.'
                : 'Same breast size/height and waist-hip as source.',
              peelLayers ? bustAnchor : '',
              buildBustHeightPreferenceLine(input.bustHeight),
              buildWanPubicLine(`${detectionMotion} ${fullOriginal}`),
            ]
              .filter(Boolean)
              .join(' '),
      ),
      wanSection(
        'CAM',
        soloSelfBreast
          ? buildShortsCameraLock({
              clipRole,
              undressOrNude: true,
              endCloseUp: allowZoom,
            })
          : 'CAMERA: source crop, FACE in frame. FORBIDDEN tilt-down, neck-only, modest both-hands covering.',
      ),
      wanSection(
        'END',
        buildWanEndHold({ durationSec: clipTotal, mode: 'action', actionHint: lastFrame }),
      ),
    ])
  }

  // ── 기본 경로 (옷 입은 일반 모션) — MOTION/TIME/CAST 칸 + BEAT. 나체 lock 금지.
  const continuityBrief = truncateContinuityText(
    fullOriginal
      .replace(/\b(?:wearing|wears|dressed in)\s+[^.,;]+/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim(),
    ANIMATION_CONTINUITY_MAX_CHARS,
  )
  const defaultTotal = resolveClipTotalSec(input.durationSec)
  // 「옷 녹이기」는 벗기는 게 아니라 다른 옷으로 바꾸는 요청이다.
  // 여기에 옷 유지 문장을 붙이면 Wan은 영어를 따르고 한국어 요청을 버린다(실측: 변화 없음).
  const garmentSwap =
    !undressAction && !staysNude && !dressAction && wantsSlipOrSilkLook(detectionMotion)
      ? 'one thin silk slip dress with spaghetti straps, no bra'
      : ''
  const clothedMotion = garmentSwap
    ? [
        `Change ONLY her outfit: the source clothes dissolve and become ${garmentSwap}.`,
        motion ? `She also does this, wearing the slip: ${motion}` : '',
        'Same face, same body, same pose, same room, same light.',
        intimate.addon ? `Detail: ${intimate.addon}` : '',
        'FORBIDDEN nudity, bra, separate panty, new person, white studio, standing rebuild.',
      ]
        .filter(Boolean)
        .join(' ')
    : [
        'Keep source clothes.',
        motion || 'Natural soft movement, same pose family as the source.',
        intimate.addon ? `Detail: ${intimate.addon}` : '',
        'Do not undress.',
      ]
        .filter(Boolean)
        .join(' ')
  return assembleWanSections([
    wanSection('MOTION', clothedMotion),
    wanSection(
      'TIME',
      buildClothedWanTime({
        motion: motion || 'natural soft movement, same pose family as the source',
        durationSec: input.durationSec,
        dressAction,
        garmentSwap,
      }),
    ),
    wanSection(
      'CAST',
      twoPeopleInSource
        ? buildCoupleFaceLock()
        : 'Same person(s) as source — do not invent extras.',
    ),
    wanSection(
      'BODY',
      garmentSwap
        ? 'Same face and body proportions as the source image. She ends wearing the new slip.'
        : 'Same face and body proportions as the source image. Keep the source outfit.',
    ),
    wanSection('CAM', 'CAMERA: static, exact source framing, NO zoom for the whole clip.'),
    wanSection(
      'END',
      buildWanEndHold({
        durationSec: defaultTotal,
        mode: garmentSwap ? 'swap' : dressAction ? 'dress' : 'clothed',
      }),
    ),
    wanSection('ID', continuityBrief ? `Brief identity: ${continuityBrief}` : ''),
  ])
}
