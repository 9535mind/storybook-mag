/**
 * 애무/터치/키스 동작 감지 + Wan I2V용 동작 증폭 문구.
 * content-policy.ts에서 분리 — polishKoreanPromptText 외 다른 모듈 의존 없음
 * (nude-intent.ts와도 서로 참조하지 않는 독립 클러스터로 확인됨).
 */
import { polishKoreanPromptText } from './korean-text'

/**
 * 애무/자극 동작 어휘 — "만지다" 한 단어로 뭉치지 않고 실제 요청한 구체 동작을 인식한다.
 * 한국어 활용형(축약·불규칙)까지 커버: 예) 만지다→만진다/만져(지+어=져 축약),
 * 누르다→눌러(르-불규칙), 비틀다→비트는(ㄹ 탈락), 당기다→당겨(기+어=겨 축약).
 * 어간이 자음으로 끝나는 동사(꼬집다·긁다·핥다 등)는 활용해도 어간이 안 사라져 안전하다.
 *
 * 주의(실측 버그): 「르-불규칙」 동사(주무르다·누르다·문지르다·찌르다·비틀다 등)는
 * 평서형 현재("-ㄴ다")에서 마지막 음절 "르"가 "ㄴ"과 합쳐져 "른/눈"처럼 변하고
 * 원래 어간 글자가 문자열에서 사라진다 — 예) "주무른다"에는 "주무르"가 문자 그대로
 * 들어있지 않다(주무르+ㄴ다 → 주무른다). 이 형태를 안 넣으면 "가슴을 주무른다" 같은
 * 아주 흔한 문장이 "동작 없음"으로 잘못 판정돼 모션 지시가 통째로 빠지는 사고가 난다.
 */
export type HandZone = 'breast' | 'vulva'

/**
 * 「왼손은 가슴, 오른손은 보지」처럼 손마다 부위를 나눈 요청.
 * 없으면 null — 예전에 가슴/보지 중 하나만 살리던 경로와 구분한다.
 */
export function detectSplitHandTargets(text: string): { left: HandZone; right: HandZone } | null {
  const t = polishKoreanPromptText(text || '')
  if (!t) return null
  const leftBreast =
    /왼손(?:은|을|이|로|으로)?\s*(?:가슴|젖|유방)/i.test(t) ||
    /left\s*hand(?:\s+is)?(?:\s+on)?(?:\s+her)?\s*(?:breast|chest|nipple)/i.test(t)
  const leftVulva =
    /왼손(?:은|을|이|로|으로)?\s*(?:보지|음부|외음|클리|크롯치)/i.test(t) ||
    /left\s*hand(?:\s+is)?(?:\s+on)?(?:\s+her)?\s*(?:pussy|vulva|crotch|clit)/i.test(t)
  const rightBreast =
    /오른손(?:은|을|이|로|으로)?\s*(?:가슴|젖|유방)/i.test(t) ||
    /right\s*hand(?:\s+is)?(?:\s+on)?(?:\s+her)?\s*(?:breast|chest|nipple)/i.test(t)
  const rightVulva =
    /오른손(?:은|을|이|로|으로)?\s*(?:보지|음부|외음|클리|크롯치)/i.test(t) ||
    /right\s*hand(?:\s+is)?(?:\s+on)?(?:\s+her)?\s*(?:pussy|vulva|crotch|clit)/i.test(t)
  if (leftBreast && rightVulva && !leftVulva && !rightBreast) return { left: 'breast', right: 'vulva' }
  if (leftVulva && rightBreast && !leftBreast && !rightVulva) return { left: 'vulva', right: 'breast' }
  return null
}

function zoneEn(z: HandZone): string {
  return z === 'breast' ? 'bare breast' : 'bare vulva/crotch'
}

export function buildSplitHandsLockLine(text: string): string {
  const split = detectSplitHandTargets(text)
  if (!split) return ''
  const t = polishKoreanPromptText(text || '')
  const solo = !/파트너|남자|남친|애인|상대|partner|man\s+hand|his\s+hand/i.test(t)
  const who = solo ? 'HER' : 'HIS'
  return [
    `SPLIT HANDS: ${who} LEFT hand stays on her ${zoneEn(split.left)}; ${who} RIGHT hand stays on her ${zoneEn(split.right)}.`,
    'Both contacts at the same time. FORBIDDEN swapping left/right. FORBIDDEN both hands on the same place.',
    'FORBIDDEN hand on hip/thigh or sliding from navel down the leg. Crotch hand stays ON vulva, not beside it.',
    solo ? 'No partner. Her own two hands only.' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export const TOUCH_ACTION_VERBS_KO =
  '만지|만져|만진|만졌|만질|만짐|만지고|만진다|만지작|쓰다듬|어루만지|어루만져|어루만진|어루만졌|스치|스쳐|' +
  '주무르|주물러|주물렀|주무른|주무름|문지르|문질러|문질렀|문지른|비비|비벼|비빈|비볐|' +
  '꼬집|비틀어|비틀고|비틀었|비트는|비튼|누르|눌러|눌렀|누른|짓누르|짓눌러|짓누른|' +
  '움켜쥐|잡아당기|잡아당겨|당기|당겨|당긴|당겼|쥐어짜|쥐어짠|' +
  '긁어|긁고|긁는|깨물어|깨물고|깨무는|깨물었|튕기|튕겨|튕긴|튕겼|찌르|찔러|찔렀|찌른'

/**
 * 키스 강도 구분 (제품 규칙):
 * - peck: 뽀뽀 / 가벼운 입맞춤 — 입술만 살짝 닿음
 * - kiss: 「키스」기본값 — 입술을 세게 맞대고 빠는 격한 키스 (혀 필수 아님)
 * - deep: 딥키스/딮키스/혀 — 혀가 보이는 프렌치 키스
 * - null: 키스 관련 단어 없음
 */
export type KissIntensity = 'peck' | 'kiss' | 'deep'

/** 「No kiss」「키스 금지」는 키스 요청이 아님 — 금지 문구의 kiss 단어가 경로를 뒤집음(실측). */
export function stripDeniedKissPhrases(text: string): string {
  return String(text || '')
    .replace(/\bno(?:t)?\s+(?:a\s+)?kiss(?:es|ing)?\b/gi, ' ')
    .replace(/\bforbidden\s+kiss(?:es|ing)?\b/gi, ' ')
    .replace(/키스\s*(?:금지|없이|말고|안\s*함|하지\s*마)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function detectKissIntensity(text: string): KissIntensity | null {
  const t = stripDeniedKissPhrases(polishKoreanPromptText(text || ''))
  if (!t) return null
  if (
    /딥\s*키스|딮\s*키스|혀\s*(?:를\s*)?(?:넣|섞|엉|맞)|french\s*kiss|tongue\s*kiss|with\s*(?:his\s*|her\s*)?tongue/i.test(
      t,
    )
  ) {
    return 'deep'
  }
  // 「키스」가 있으면 기본은 격한 입술 키스 (뽀뽀가 아님)
  if (/키스|kiss(?:es|ing)?/i.test(t)) return 'kiss'
  // 뽀뽀·입맞춤만 (키스 단어 없이)
  if (/뽀뽀|입\s*(?:을\s*)?맞추|입맞춤|peck|light\s*kiss|quick\s*kiss/i.test(t)) return 'peck'
  return null
}

/** Wan MOTION/TIME용 — 강도별 영어 동작 한 줄 */
export function kissIntensityActionLine(intensity: KissIntensity, opts?: { backHug?: boolean }): string {
  const back = opts?.backHug === true
  if (intensity === 'peck') {
    return back
      ? 'light peck from behind/over her shoulder — lips briefly touch, soft 뽀뽀, NOT a long sucking kiss'
      : 'light peck / soft lip touch (뽀뽀·가벼운 입맞춤) — brief contact only, NOT deep sucking'
  }
  if (intensity === 'deep') {
    return back
      ? 'DEEP KISS (딥키스) from behind: mouths locked over her shoulder through the LAST FRAME, tongues intertwining — FORBIDDEN pulling apart'
      : 'DEEP KISS (딥키스): mouths locked through the LAST FRAME, lips sucking hard, tongues intertwining — FORBIDDEN pulling faces apart'
  }
  // default 「키스」
  return back
    ? 'PASSIONATE KISS from behind: mouths locked over her shoulder through the LAST FRAME — NOT a peck; FORBIDDEN unclenching or standing apart'
    : 'PASSIONATE KISS: mouths locked through the LAST FRAME (서로 입술을 세게 빠는 키스) — FORBIDDEN pulling faces apart or the opening still'
}

/**
 * 「가슴을 만지고 입술에 딮키스한다」처럼 "가슴"(터치 대상)과 "키스/입술"(별개 동작의
 * 대상)이 한 문장에 같이 있으면, 예전 정규식(거리 8자 이내면 매칭)이 "가슴에 키스"로
 * 잘못 인식해 실제 요청(입-입 딥키스 + 손으로 가슴 터치)과 다르게 가슴에 입으로 키스하는
 * 결과가 나왔다(실측, 2026-08-28). "가슴을 만지고"의 "만지고"처럼 별도 터치 동사가 그
 * 사이에 끼어 있으면 "그 부위에 입맞춤"이 아니라 "손 터치 + (다른 대상) 키스"라는 뜻이므로,
 * 대상 부위와 키스 단어 사이에 터치 동사가 없을 때만 "그 부위 키스"로 판정한다.
 */
export function detectKissBodyTarget(text: string): 'vulva' | 'breast' | null {
  const kissWordRe = /입\s*(?:을\s*)?맞|입술|키스/
  const touchVerbRe = new RegExp(TOUCH_ACTION_VERBS_KO, 'i')
  // bodyPartRe는 'g' 없이 매번 새 substring에 exec — lastIndex 상태를 공유하지 않아 안전.
  const findTarget = (bodyPartRe: RegExp): boolean => {
    let searchFrom = 0
    while (searchFrom < text.length) {
      const remainder = text.slice(searchFrom)
      const bodyMatch = bodyPartRe.exec(remainder)
      if (!bodyMatch) return false
      const bodyEnd = searchFrom + bodyMatch.index + bodyMatch[0].length
      const after = text.slice(bodyEnd)
      const kissMatch = kissWordRe.exec(after)
      if (kissMatch) {
        const between = after.slice(0, kissMatch.index)
        // 조사(에/을/를 등)·공백·짧은 부사 정도만 허용 — 별도 터치 동사나 너무 먼 거리는
        // 「그 부위에 키스」가 아니라 별개 동작으로 본다.
        if (!touchVerbRe.test(between) && between.length <= 10) return true
      }
      searchFrom = bodyEnd
    }
    return false
  }
  if (
    findTarget(/보지|음부|성기|클리토리스|클리|외음|사타구니|가랑이/i) ||
    /kiss(?:es|ing)?\s*(?:her\s*)?(?:pussy|vulva|clit(?:oris)?)/i.test(text)
  ) {
    return 'vulva'
  }
  if (
    findTarget(/가슴|젖꼭지|유두|유방/i) ||
    /kiss(?:es|ing)?\s*(?:her\s*)?(?:breast|nipple)/i.test(text)
  ) {
    return 'breast'
  }
  return null
}

/** 사용자가 쓴 구체 동사를 그대로 영어 동작 묘사로 반영 — 전부 "fondling"으로 뭉개지 않는다. */
export function detectTouchVerbPhrase(t: string): string {
  if (/꼬집/i.test(t)) return 'pinching firmly between fingers'
  if (/비틀어|비틀고|비틀었|비트는|짓누르|짓눌러/i.test(t)) return 'twisting gently'
  if (/누르|눌러|눌렀/i.test(t)) return 'pressing firmly with fingertips'
  if (/움켜쥐|쥐어짜/i.test(t)) return 'gripping and squeezing tightly'
  if (/잡아당기|잡아당겨|당기|당겨|당긴|당겼/i.test(t)) return 'gripping and pulling'
  if (/긁어|긁고|긁는/i.test(t)) return 'scratching lightly with fingernails'
  if (/깨물어|깨물고|깨무는|깨물었/i.test(t)) return 'biting and nibbling gently'
  if (/튕기|튕겨|튕긴|튕겼/i.test(t)) return 'flicking with fingertips'
  if (/찌르|찔러|찔렀/i.test(t)) return 'pressing and poking with fingertips'
  if (/비비|비벼|비빈|비볐/i.test(t)) return 'rubbing in slow circles'
  if (/문지르|문질러|문질렀/i.test(t)) return 'rubbing firmly'
  if (/주무르|주물러|주물렀|주무른|주무름/i.test(t)) return 'kneading and squeezing'
  if (/쓰다듬|어루만지|어루만져|어루만진|어루만졌|스치|스쳐/i.test(t)) return 'gently stroking'
  if (/만지작|만짐|만지고|만진다|만지|만져|만진|만졌|만질/i.test(t)) {
    return 'squeezing and stroking continuously'
  }
  return 'squeezing and stroking continuously'
}

/** 자지 만짐 대체 — 지퍼를 내린다. 자지를 그리면 실패(실측). */
export const MAN_ZIPPER_HAND_LINE =
  'Her hand pulls HIS pants zipper slider DOWN until the fly is open. Pants stay on. FORBIDDEN penis, genitals, or a nude man.'

/**
 * 여성이 남성 가랑이를 손으로 — 자지 대신 지퍼.
 */
export function wantsMaleGenitalHand(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  if (!t) return false
  return (
    /(?:남자|남친|애인|파트너|그의?)\s*(?:의\s*)?(?:자지|좆|페니스|성기|지퍼|cock|dick|penis|zipper|fly)/i.test(t) ||
    /(?:자지|좆|페니스|지퍼)\s*(?:을|를|에)?\s*(?:만지|만져|만짐|만진|만졌|애무|넣|잡|쥐|쓰다듬|문지|비비|내리|내려|열고|연)/i.test(t) ||
    /(?:여자가?|그녀가?)\s*.{0,12}(?:자지|좆|페니스|지퍼|cock|dick|penis|zipper)/i.test(t) ||
    /hand\s*job|stroke(?:s|ing)?\s*(?:his\s*)?(?:cock|dick|penis)|(?:her\s*)?hand\s*(?:on|around|in|into)\s*(?:his\s*)?(?:cock|dick|penis|zipper|fly)|pulls?\s*(?:his\s*)?(?:pants\s*)?zipper\s*down|unzip(?:s|ping)?/i.test(
      t,
    )
  )
}

/**
 * 1인·자기 애무 — 「자신의 가슴을 주무른다」를 파트너 손으로 오인하면
 * Wan이 원본(옷 입은 채 가슴에 손)을 그대로 복제한다(실측 15초).
 */
export function isSoloSelfTouch(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  if (!t) return false
  return /자신(?:의|이|을|를)?|스스로|혼자|self[\s-]?touch|masturbat|her\s+own\s+(?:breast|chest|body)|own\s+breasts?/i.test(
    t,
  )
}

/**
 * 백허그 / 뒤에서 안기 — 옆구리 손만 올리는 옆서기로 대체되는 실측이 있어 별도 감지.
 */
export function wantsBackHug(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  if (!t) return false
  return /백\s*허그|뒤에서\s*(?:안|껴안|감싸|포옹)|뒤로\s*(?:안|껴안)|등\s*뒤에서|from\s*behind|back\s*hug|hug(?:s|ging)?\s*(?:her\s*)?from\s*behind|stands?\s*behind\s*her|embrace(?:s|d)?\s*(?:her\s*)?from\s*behind/i.test(
    t,
  )
}

/**
 * I2V 모션: 애무·눕기·올라타기 등 Wan이 무시하기 쉬운 성인 동작을 영어 동작 지시로 증폭.
 * (단순 번역만 넣으면 "subtle camera / limbs only" 잠금에 밀려 안 먹히는 실측)
 */
export function amplifyAdultMotionForVideo(motion: string): {
  addon: string
  wantsPartner: boolean
  wantsPoseChange: boolean
  wantsMaleGenitalHand: boolean
  wantsBackHug: boolean
} {
  const t = polishKoreanPromptText(motion || '')
  const bits: string[] = []
  let wantsPartner = false
  let wantsPoseChange = false
  const maleGenitalHand = wantsMaleGenitalHand(t)

  // 가슴/유두 빨기 — 빤다/빨아/빨아라/빨다 + 강도 부사("힘껏/세게/강하게/격하게") 반영
  if (
    /(?:가슴|젖|유방|유두|젖꼭지)\s*(?:을\s*|를\s*)?(?:빨|빤)|빨아(?:라|줘|요)?|빤다|빨며|빨고|빨다|suck(?:s|ing)?\s*(?:on\s*)?(?:her\s*)?(?:breast|nipple)/i.test(
      t,
    )
  ) {
    wantsPartner = true
    const intense = /힘껏|세게|강하게|격하게|거칠게|hard(?:er)?|vigorous(?:ly)?|forceful(?:ly)?/i.test(t)
    bits.push(
      intense
        ? 'VISIBLE oral contact on the bare breast and nipple: mouth and lips sealed on the nipple, vigorous/forceful rhythmic sucking with strong suction, breast soft tissue visibly moving with each hard suck — not a freeze, not staring without contact'
        : 'VISIBLE oral contact on the bare breast and nipple: mouth and lips sealed on the nipple, tongue and rhythmic sucking, breast soft tissue moving with each suck — not a freeze, not staring without contact',
    )
  }

  // 눕다 / 눕히다
  if (/눕|누워|lie\s*down|lying\s*(?:down|back)|lays?\s*(?:her\s*)?down|laid\s*(?:her\s*)?down/i.test(t)) {
    wantsPoseChange = true
    if (/눕히|눕혀|눕힌|lays?\s*her|laid\s*her/i.test(t)) wantsPartner = true
    bits.push(
      'FULL BODY pose change to lying on her back: she reclines onto the surface, head settles back, torso horizontal, legs rest — she must NOT stay standing for the whole clip',
    )
  }

  // 백허그 / 뒤에서 안기 — 옆서기+허리손만으로 대체되는 실측이 있어 포즈를 반복·강하게 잠금
  const backHug = wantsBackHug(t)
  if (backHug) {
    wantsPartner = true
    wantsPoseChange = true
    bits.push(
      'CRITICAL POSE LOCK — BACK-HUG for the WHOLE clip: the man stands DIRECTLY BEHIND the woman, his chest pressed to her BACK, his face over her shoulder or behind her head',
      'BOTH his arms wrap around her torso from BEHIND — not standing beside her, not side-by-side, not one hand only on her waist from the side',
      'FORBIDDEN: face-to-face square stance; standing next to her with a hand on her hip; side-hug; passport couple pose',
    )
  }

  // 고개 젖히기 (뒤로) — 백허그 키스/목선 노출과 자주 함께 씀
  const headTiltBack =
    /고개\s*(?:를\s*)?(?:젖|뒤로)|고개를?\s*뒤로|머리\s*(?:를\s*)?젖|목을\s*젖|tilt(?:s|ing)?\s*(?:her\s*)?head\s*back|leans?\s*(?:her\s*)?head\s*back|head\s*thrown\s*back|arches?\s*(?:her\s*)?neck/i.test(
      t,
    )
  if (headTiltBack) {
    wantsPoseChange = true
    bits.push(
      backHug
        ? 'while he stays BEHIND her: she tilts / arches her head backward onto his shoulder or toward his face, chin up, throat exposed'
        : 'she tilts / arches her head backward, chin up, throat exposed — not looking straight ahead the whole time',
    )
  }

  // 배 위에 올라탄다 / 걸터앉다
  if (
    /배\s*위|올라\s*타|올라탄|올라타|걸터|타고\s*앉|straddl|mount(?:s|ing)?(?:\s+(?:her|on))?|on\s*(?:her\s*)?(?:belly|stomach|abdomen|torso)/i.test(
      t,
    )
  ) {
    wantsPartner = true
    wantsPoseChange = true
    bits.push(
      'a second consenting adult straddles / sits astride on her belly or lower torso with clear weight and hip placement on the abdomen — not standing beside her, not a solo pose',
    )
  }

  // 자지 만짐 → 지퍼에 손. 자지를 그리면 여성 몸이나 바지 안에 새로 생김(실측).
  if (maleGenitalHand) {
    wantsPartner = true
    wantsPoseChange = true
    bits.push(MAN_ZIPPER_HAND_LINE, 'She stays female. Last frame: HIS zipper still down, her hand on the open fly.')
  }

  const splitHands = detectSplitHandTargets(t)
  const splitLine = buildSplitHandsLockLine(t)

  // 보지/크롯치 애무 — 가슴 애무로 오인되면 허벅지만 스치는 실패가 남음(실측)
  // 남성 성기 만짐과 구분: 「남자의 성기/자지」는 여기로 보내지 않음
  const crotchTouch =
    !maleGenitalHand &&
    (splitHands?.left === 'vulva' ||
      splitHands?.right === 'vulva' ||
      new RegExp(
        `(?:보지|음부|클리토리스|클리|외음|사타구니|가랑이|크롯치|crotch|pussy|vulva|clit(?:oris)?|labia|mons)\\s*(?:을|를|을\\s*|를\\s*)?(?:${TOUCH_ACTION_VERBS_KO}|애무|자극)|(?:${TOUCH_ACTION_VERBS_KO}|애무)\\s*(?:는\\s*|고\\s*)?(?:보지|음부|크롯치)|fondl(?:e|es|ing)\\s*(?:her\\s*)?(?:crotch|pussy|vulva|clit)|rub(?:s|bing)?\s*(?:her\\s*)?(?:crotch|pussy|vulva)|finger(?:s|ing)?\\s*(?:her\\s*)?(?:crotch|pussy|vulva|clit)|pinch(?:es|ing)?\\s*(?:her\\s*)?(?:clit|labia)|press(?:es|ing)?\\s*(?:her\\s*)?(?:crotch|pussy|vulva|clit)`,
        'i',
      ).test(t))
  const breastTouch =
    splitHands?.left === 'breast' ||
    splitHands?.right === 'breast' ||
    new RegExp(
      `(?:가슴|젖|유방|젖가슴)\\s*(?:을|를)?\\s*(?:${TOUCH_ACTION_VERBS_KO}|애무)|만지면서|만져주|만지작|주무르면서|주물러주|애무하|caress(?:es|ing)?\\s*(?:her\\s*)?(?:breast|chest)|fondl(?:e|es|ing)\\s*(?:her\\s*)?(?:breast|chest)|knead(?:s|ing)?\\s*(?:her\\s*)?(?:own\\s*)?(?:breast|chest)|hand(?:s)?\\s*(?:on|cupping)\\s*(?:her\\s*)?(?:breast|chest|boob)|pinch(?:es|ing)?\\s*(?:her\\s*)?(?:breast|nipple)|twist(?:s|ing)?\\s*(?:her\\s*)?nipple|squeez(?:e|es|ing)\\s*(?:her\\s*)?(?:breast|chest)|bit(?:e|es|ing)\\s*(?:her\\s*)?nipple`,
      'i',
    ).test(t)

  if (splitHands && splitLine) {
    wantsPartner = /파트너|남자|남친|애인|상대|partner|man\s+hand|his\s+hand/i.test(t)
    wantsPoseChange = true
    if (/나체|누드|nude|naked|전라|topless/i.test(t)) {
      bits.unshift(
        'FIRST remove ALL clothing from her — top AND pants/jeans/belt/panties → FULL NUDE (not topless-only)',
        'FORBIDDEN touching over a shirt; FORBIDDEN trousers or belt still on',
      )
    }
    bits.push(
      splitLine,
      'Bare crotch first — FORBIDDEN a new black panty/bikini. If fabric remains it is silk matching the skirt, not black. Neat Korean-30s pubic patch on the mons under the crotch hand',
      'LAST FRAME FREEZE: left and right hands STILL on those two places — source photo is START ONLY',
    )
  } else if (crotchTouch && breastTouch) {
    wantsPartner = /파트너|남자|남친|애인|상대|partner|man\s+hand|his\s+hand/i.test(t)
    wantsPoseChange = true
    const verbPhrase = detectTouchVerbPhrase(t)
    bits.push(
      `TWO HANDS: one partner hand on her bare breast AND the other on her bare vulva at the same time — ${verbPhrase}.`,
      'PANTY OFF FIRST: panties off, neat Korean-30s pubic patch on the mons under the crotch hand.',
      'LAST FRAME FREEZE: one hand still on breast, the other still on vulva.',
    )
  } else if (crotchTouch) {
    wantsPoseChange = true
    const verbPhrase = detectTouchVerbPhrase(t)
    // 파트너 명시 없으면 본인 손으로 (CAST LOCK과 충돌해 손이 허벅지로 도망가는 회귀 방지)
    if (/파트너|남자|남친|애인|상대|partner|man\s+hand|his\s+hand/i.test(t)) {
      wantsPartner = true
      bits.push(
        `CROTCH FONDLE: a consenting adult partner hand stays ON her bare vulva/crotch for most of the clip — ${verbPhrase} the bare genitals continuously with clear skin contact`,
      )
    } else {
      bits.push(
        `CROTCH FONDLE (self): her own hand stays ON her bare vulva/crotch for most of the clip — ${verbPhrase} the bare genitals with continuous skin contact`,
      )
    }
    bits.push(
      'PANTY OFF FIRST: panties/thong/briefs must be fully removed before the fondling — bare crotch with a neat Korean-30s pubic patch on the mons under the hand',
      'FORBIDDEN: hand hovering near the hip/thigh without touching genitals; hand only on outer thigh; fondling over panties; ending still wearing underwear',
      'LAST FRAME FREEZE: hand STILL on bare crotch through the final frame — source photo is START ONLY, never snap back to clothed/stiff opening pose',
    )
  }

  // 가슴 만짐 — 왼손/오른손 분할이면 위에서 이미 처리. 보지와 같이 써도 가슴을 버리지 않음.
  if (breastTouch && !splitHands && !crotchTouch) {
    wantsPoseChange = true
    const selfTouch = isSoloSelfTouch(t)
    if (
      !selfTouch &&
      /파트너|남자|남친|애인|상대|partner|man\s+hand|his\s+hand|여자(?:의)?\s*가슴|뒤에서/i.test(t)
    ) {
      wantsPartner = true
    }
    if (/나체|누드|nude|naked|전라|topless/i.test(t)) {
      bits.unshift(
        'FIRST remove ALL clothing from her — top AND pants/jeans/belt/panties → FULL NUDE (not topless-only)',
        'FORBIDDEN touching over a shirt; FORBIDDEN trousers or belt still on',
      )
    }
    const verbPhrase = detectTouchVerbPhrase(t)
    if (selfTouch) {
      bits.push(
        `SELF-TOUCH: BOTH her own hands ${verbPhrase} her own bare breasts — no partner`,
        'FORBIDDEN keeping source clothes; FORBIDDEN a polite hand-on-heart over a dress',
        'LAST FRAME FREEZE: her own hands STILL kneading her bare breasts — source photo is START ONLY',
      )
    } else {
      bits.push(
        backHug
          ? `from behind: both his hands reach around her torso onto her bare breasts, ${verbPhrase} continuously — back-hug breast fondle, not a face-to-face tap`
          : `sustained breast play for most of the clip: hand stays on her bare breast, ${verbPhrase} continuously — not a one-second tap`,
        'LAST FRAME FREEZE: hand(s) STILL on bare breast through the final frame — source photo is START ONLY, never snap back to the opening still',
      )
    }
  }

  // 키스·기타 애무 (파트너 동작이 흔한 케이스)
  const kissIntensity = detectKissIntensity(t)
  if (kissIntensity) {
    wantsPartner = true
    wantsPoseChange = true
    const kissTarget = detectKissBodyTarget(t)
    const kissVulva = kissTarget === 'vulva'
    const kissBreast = kissTarget === 'breast' && !breastTouch
    if (kissVulva) {
      bits.push(
        'mandatory mouth-to-vulva kissing for most of the clip — a consenting adult partner\'s lips and mouth make continuous oral contact with her bare vulva/genitals, not a hand touch, not a peck elsewhere',
        'LAST FRAME FREEZE: still kissing the bare vulva — source photo is START ONLY, never snap back to the opening still',
      )
    } else if (kissBreast) {
      bits.push(
        'mandatory mouth-to-breast kissing for most of the clip — a consenting adult partner\'s lips make continuous oral contact with her bare breast/nipple, not a hand-only touch, not a peck elsewhere',
        'LAST FRAME FREEZE: still kissing the bare breast/nipple — source photo is START ONLY, never snap back to the opening still',
      )
    } else if (backHug || headTiltBack) {
      bits.push(
        kissIntensityActionLine(kissIntensity, { backHug: backHug || false }),
        backHug
          ? 'he stays BEHIND her the whole time while kissing — FORBIDDEN face-to-face square stance'
          : 'she keeps her head tilted back during the kiss',
        'LAST FRAME FREEZE: still in that kissed / head-back / behind pose — source photo is START ONLY, never snap to a stiff side-by-side still',
      )
    } else {
      bits.push(
        kissIntensityActionLine(kissIntensity),
        kissIntensity === 'peck'
          ? 'brief soft contact only — faces may part after the peck'
          : 'slight natural teeth OK if lips part; no wide Hollywood grin',
        kissIntensity === 'peck'
          ? 'last frame may show lips just parting after the peck'
          : 'LAST FRAME FREEZE: still kissing — source photo is START ONLY, never snap back to the opening still',
      )
    }
    if (/나체|누드|nude|naked|전라|topless/i.test(t)) {
      bits.unshift(
        'FIRST remove ALL her clothes including pants/jeans/belt/panties — FULL NUDE not topless-only',
        'THEN intimate action on bare skin — FORBIDDEN leaving trousers or a belt on',
      )
    }
    if (
      /남자|남성|남친|\bman\b|his\s+hand/i.test(t) &&
      /여자|여성|\bwoman\b|her\s+breast/i.test(t) &&
      !/여여|두\s*여자|lesbian|two\s*women/i.test(t)
    ) {
      bits.unshift(
        'HETERO ONLY: MAN mouth-kisses WOMAN; MAN hand on WOMAN bare breast',
        'FORBIDDEN two women kissing each other — if a third woman is in the source, remove her from the frame',
        'The man must be the kisser in the foreground — FORBIDDEN man idle in background while women kiss',
      )
    }
  }
  if (
    !breastTouch &&
    !crotchTouch &&
    !maleGenitalHand &&
    new RegExp(`애무|caress|fondl|grope|${TOUCH_ACTION_VERBS_KO}|rub(?:s|bing)?\\s*(?:her\\s*)?(?:breast|body|chest)`, 'i').test(
      t,
    )
  ) {
    if (!/스스로|혼자|self[\s-]?touch|masturbat/i.test(t)) wantsPartner = true
    wantsPoseChange = true
    const verbPhrase = detectTouchVerbPhrase(t)
    bits.push(
      `hands actively caressing the body with continuous touching — ${verbPhrase}, not a static hand pose`,
      'END POSE FREEZE: intimate contact held through the last frame — source photo is START ONLY, never snap back to the opening still',
    )
  }

  return {
    addon: bits.join('. '),
    wantsPartner,
    wantsPoseChange,
    wantsMaleGenitalHand: maleGenitalHand,
    wantsBackHug: backHug,
  }
}
