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
export const TOUCH_ACTION_VERBS_KO =
  '만지|만져|만진|만졌|만질|쓰다듬|어루만지|어루만져|어루만진|어루만졌|스치|스쳐|' +
  '주무르|주물러|주물렀|주무른|문지르|문질러|문질렀|문지른|비비|비벼|비빈|비볐|' +
  '꼬집|비틀어|비틀고|비틀었|비트는|비튼|누르|눌러|눌렀|누른|짓누르|짓눌러|짓누른|' +
  '움켜쥐|잡아당기|잡아당겨|당기|당겨|당긴|당겼|쥐어짜|쥐어짠|' +
  '긁어|긁고|긁는|깨물어|깨물고|깨무는|깨물었|튕기|튕겨|튕긴|튕겼|찌르|찔러|찔렀|찌른'

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
  if (/주무르|주물러|주물렀/i.test(t)) return 'kneading and squeezing'
  if (/쓰다듬|어루만지|어루만져|어루만진|어루만졌|스치|스쳐/i.test(t)) return 'gently stroking'
  return 'squeezing and stroking continuously'
}

/**
 * I2V 모션: 애무·눕기·올라타기 등 Wan이 무시하기 쉬운 성인 동작을 영어 동작 지시로 증폭.
 * (단순 번역만 넣으면 "subtle camera / limbs only" 잠금에 밀려 안 먹히는 실측)
 */
export function amplifyAdultMotionForVideo(motion: string): {
  addon: string
  wantsPartner: boolean
  wantsPoseChange: boolean
} {
  const t = polishKoreanPromptText(motion || '')
  const bits: string[] = []
  let wantsPartner = false
  let wantsPoseChange = false

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

  // 보지/크롯치 애무 — 가슴 애무로 오인되면 허벅지만 스치는 실패가 남음(실측)
  const crotchTouch = new RegExp(
    `(?:보지|음부|성기|클리토리스|클리|외음|사타구니|가랑이|크롯치|crotch|pussy|vulva|clit(?:oris)?|labia|mons)\\s*(?:을|를|을\\s*|를\\s*)?(?:${TOUCH_ACTION_VERBS_KO}|애무|자극)|(?:${TOUCH_ACTION_VERBS_KO}|애무)\\s*(?:는\\s*|고\\s*)?(?:보지|음부|성기|크롯치)|fondl(?:e|es|ing)\\s*(?:her\\s*)?(?:crotch|pussy|vulva|clit)|rub(?:s|bing)?\\s*(?:her\\s*)?(?:crotch|pussy|vulva)|finger(?:s|ing)?\\s*(?:her\\s*)?(?:crotch|pussy|vulva|clit)|pinch(?:es|ing)?\\s*(?:her\\s*)?(?:clit|labia)|press(?:es|ing)?\\s*(?:her\\s*)?(?:crotch|pussy|vulva|clit)`,
    'i',
  ).test(t)
  if (crotchTouch) {
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
      'PANTY OFF FIRST: panties/thong/briefs must be fully removed before the fondling — bare crotch with adult pubic hair visible under the hand',
      'FORBIDDEN: hand hovering near the hip/thigh without touching genitals; hand only on outer thigh; fondling over panties; ending still wearing underwear',
      'LAST FRAME: hand still contacting bare crotch — do not return to the source still pose',
    )
  }

  // 가슴 만짐/애무 — 「만지면서」활용형·가슴+만지 조합을 명시적으로 (키스만 되고 손은 빠지는 실측)
  // 보지 애무만 있을 때는 가슴으로 가로채지 않음.
  const breastTouch =
    !crotchTouch &&
    new RegExp(
      `(?:가슴|젖|유방|젖가슴)\\s*(?:을|를)?\\s*(?:${TOUCH_ACTION_VERBS_KO}|애무)|만지면서|만져주|만지작|주무르면서|주물러주|애무하|caress(?:es|ing)?\\s*(?:her\\s*)?(?:breast|chest)|fondl(?:e|es|ing)\\s*(?:her\\s*)?(?:breast|chest)|hand(?:s)?\\s*(?:on|cupping)\\s*(?:her\\s*)?(?:breast|chest|boob)|pinch(?:es|ing)?\\s*(?:her\\s*)?(?:breast|nipple)|twist(?:s|ing)?\\s*(?:her\\s*)?nipple|squeez(?:e|es|ing)\\s*(?:her\\s*)?(?:breast|chest)|bit(?:e|es|ing)\\s*(?:her\\s*)?nipple`,
      'i',
    ).test(t)
  if (breastTouch) {
    wantsPoseChange = true
    // 크롯치 애무와 동일 규칙 — 파트너 명시가 없으면 본인 손으로 본다.
    // 예전엔 무조건 wantsPartner=true였어서 "자신의 가슴을 주무른다"(자가 애무) 같은
    // 솔로 요청에도 coupleRequested가 켜져 "남자가 보이면…" 같은 무관한 문구가 섞였다.
    if (/파트너|남자|남친|애인|상대|partner|man\s+hand|his\s+hand/i.test(t)) {
      wantsPartner = true
    }
    const verbPhrase = detectTouchVerbPhrase(t)
    bits.push(
      `sustained breast play for most of the clip: hand stays on her bare breast, ${verbPhrase} continuously — not a one-second tap`,
    )
  }

  // 키스·기타 애무 (파트너 동작이 흔한 케이스)
  // 「키스」단어만 보고 무조건 입-입으로 고정하면 「보지에 키스」/「가슴에 키스」같이
  // 대상 부위가 명시된 요청이 무시되는 실측이 있었다 — 대상이 명시되면 그 부위로 분기.
  if (/딥\s*키스|키스|입\s*(?:을\s*)?맞추|입맞춤|kiss(?:es|ing)?/i.test(t)) {
    wantsPartner = true
    wantsPoseChange = true
    const kissTarget = detectKissBodyTarget(t)
    const kissVulva = kissTarget === 'vulva'
    // 가슴을 손으로 만지는 동작(breastTouch)이 이미 별도로 감지·처리됐으면, 이 문장의
    // "가슴"은 키스 대상이 아니라 손터치 대상이다 — 입-입 딥키스 쪽으로 남겨둔다
    // ("가슴을 만지고 입술에 딮키스한다" 실측 오분류 수정, 2026-08-28).
    const kissBreast = kissTarget === 'breast' && !breastTouch
    if (kissVulva) {
      bits.push(
        'mandatory mouth-to-vulva kissing for most of the clip — a consenting adult partner\'s lips and mouth make continuous oral contact with her bare vulva/genitals, not a hand touch, not a peck elsewhere',
        'last frame still kissing the bare vulva — do not return to the source still pose',
      )
    } else if (kissBreast) {
      bits.push(
        'mandatory mouth-to-breast kissing for most of the clip — a consenting adult partner\'s lips make continuous oral contact with her bare breast/nipple, not a hand-only touch, not a peck elsewhere',
        'last frame still kissing the bare breast/nipple — do not return to the source still pose',
      )
    } else {
      bits.push(
        'mandatory deep mouth-to-mouth kissing for most of the clip — lips locked together, heads leaning in, continuous kiss (not a quick peck, not faces apart)',
        'slight natural teeth OK if lips part; no wide Hollywood grin',
        'last frame still kissing — do not return to the source still pose',
      )
    }
    if (/나체|누드|nude|naked|전라|topless/i.test(t)) {
      bits.push('kissing while fully nude, bare breasts visible')
    }
  }
  if (
    !breastTouch &&
    !crotchTouch &&
    new RegExp(`애무|caress|fondl|grope|${TOUCH_ACTION_VERBS_KO}|rub(?:s|bing)?\\s*(?:her\\s*)?(?:breast|body|chest)`, 'i').test(
      t,
    )
  ) {
    if (!/스스로|혼자|self[\s-]?touch|masturbat/i.test(t)) wantsPartner = true
    wantsPoseChange = true
    const verbPhrase = detectTouchVerbPhrase(t)
    bits.push(
      `hands actively caressing the body with continuous touching — ${verbPhrase}, not a static hand pose`,
      'END POSE: keep the intimate contact through the last frame — do not return to the source still pose',
    )
  }

  return { addon: bits.join('. '), wantsPartner, wantsPoseChange }
}
