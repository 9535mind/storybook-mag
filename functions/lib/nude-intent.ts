/**
 * 나체/탈의 "의도" 판정 + 그 의도를 모션 문구에 반영하는 로직.
 *
 * 이 파일 하나로 묶은 이유(의도적 설계 — 억지로 더 쪼개지 않음):
 * resolveNudeIntent()는 motionExplicitNudeHoldOnly()/isBodyProjectRequest()를 부르고,
 * 반대로 motionForcesBecomeNude()/ensureNudeHoldMotionPhrase()는 wantsNudeOrUndress()·
 * wantsUndressAction()·wantsFullNude()를 다시 부른다 — 즉 "의도 판정"과 "모션 분류"가
 * 서로를 호출하는 진짜 순환 의존 관계다. 이걸 두 파일로 억지로 나누면 두 파일이 서로
 * import하는 순환 참조가 생기거나, 어느 한쪽이 미묘하게 복제돼 나중에 한쪽만 고치는
 * 사고로 이어진다. 대신 "나체 의도"라는 하나의 응집된 개념으로 인정하고 한 파일에 모아,
 * content-policy.ts 밖으로만 빼냈다 — 파일 수는 늘리지 않으면서 책임은 명확히 분리한다.
 *
 * 외부 의존은 polishKoreanPromptText 하나뿐이다.
 */
import { polishKoreanPromptText } from './korean-text'

// 한국어는 명사와 동사 사이에 조사(을/를/이/가/은/는/도/만)가 붙는 게 훨씬 자연스러운
// 말투다("속옷을 제거해줘", "가운만 입혀라") — 기존엔 \s*(공백만 허용)라 조사가 끼면
// 매칭에서 빠져서, 정밀모드 전환·negative prompt 조정이 통째로 안 걸리는 버그가 있었다.
// "옷을 다 벗겨줘"/"옷을 전부 벗어라"처럼 조사 뒤에 "다/전부/완전히" 같은 강조 부사가 한
// 번 더 끼는 것도 실제로 매우 흔하다 — 조사와 부사를 모두 선택적으로 허용하는 조각을
// 명사+동사 패턴 사이에 넣어 고친다.
const KO_PARTICLE_GAP =
  '(?:을|를|이|가|은|는|도|만)?\\s*(?:다|전부|모두|완전히|싹|모조리)?\\s*'

// 착의·탈의 요청에 등장하는 의류 명사 전체 목록. "가운/로브/옷"만 있던 예전엔 "브래지어를
// 벗겨줘", "치마를 제거해줘"처럼 세부 품목을 지칭하면 놓치는 사고가 있었다 — 사용자가
// 실제로 쓸 만한 상의/하의/속옷 명칭을 폭넓게 담아둔다. "브라(?!운)"은 "브라운"(색상)
// 오발동 방지(기존 wantsUnderwearLook과 동일 이유).
const KO_CLOTHING_NOUN =
  '옷|의상|복장|가운|로브|스웨터|가디건|속옷|언더웨어|상의|하의|티셔츠|셔츠|니트|블라우스|브래지어|브라(?!운)|바지|반바지|청바지|핫팬츠|팬츠|팬티|치마|치마바지|스커트|레깅스|쇼츠|드레스|원피스|자켓|재킷|코트|조끼|탑|스타킹|양말|코르셋|망토|케이프|베일|갑옷'

// "벗다"뿐 아니라 "제거/없애/지우다"도 실제로 쓰이는 탈의 표현이다. 동사 어간만 매칭해서
// 활용형(제거하다/제거해줘/제거하라, 없애다/없애줘/없애라, 지우다/지워줘/지워라, 벗다/
// 벗어/벗겨/벗기/벗김/벗을/벗었 등)을 활용형 하나하나 나열하지 않고 전부 커버한다.
// 주의: "없애"/"지우"는 모음 어간이라 평서형 "-ㄴ다"에서 어간 끝음절이 사라진다
// (없애+ㄴ다→없앤다, 지우+ㄴ다→지운다 — "없애"/"지우" 글자가 결과 문자열에 없음).
// "벗"·"제거"는 자음 종성(ㅅ)이거나 명사+하다 합성어라 이 문제가 없어 안전하다.
const KO_REMOVE_VERB_STEM = '(?:제거|없애|없앤|지워|지우|지운|벗)'

// 반대 방향(착의) 동사 어간 — 입다/착용하다/걸치다/두르다/씌우다의 모든 활용형을 어간만으로 커버.
// 주의: "걸치"/"두르"/"씌우"도 모음 어간이라 "-ㄴ다"에서 어간이 바뀐다
// (걸치+ㄴ다→걸친다, 두르+ㄴ다→두른다, 씌우+ㄴ다→씌운다) — 활용형을 추가로 넣어야 한다.
const KO_DRESS_VERB_STEM = '(?:입|착용|걸치|걸친|두르|두른|씌우|씌운)'

// "바꾸다/교체하다/변경하다/대체하다/A 대신 B" — 명사 바로 옆이 아니라 문장 뒤쪽에 오는
// 경우가 많아(예: "바지를 스커트로 바꿔줘") 인접 매칭 대신 문장 전체에서 별도로 검사한다.
// "바꾸다"는 어미가 붙으며 어간이 "바꿔/바꾼/바꿨"으로 불규칙 활용되므로(바꾸+어→바꿔)
// "바꾸" 어간 자체로는 매칭되지 않는다 — 활용형을 별도로 나열한다. 영어 표현(instead/
// swap/replace/change into)도 같이 커버한다 — buildRefinePrompt는 이미 번역된 영어
// revision 텍스트로 이 로직을 다시 타므로 한국어만 있으면 놓친다.
const KO_REPLACE_WORD_PATTERN =
  /바꾸|바꿔|바꾼|바꿨|바뀌|교체|변경|대체|대신|instead\s*of|\bswap(?:s|ping|ped)?\b|\breplace(?:s|d|ing)?\b|chang(?:e|es|ed|ing)\s*(?:into|to)/i

// 영어 의류 명사 목록 — KO_CLOTHING_NOUN과 동일한 역할이지만 영어 표현용. buildRefinePrompt는
// translateDescriptionForImagePrompt로 이미 영어로 번역된 revision을 다시 검사하므로, 한국어
// 패턴만 있으면 "take off the pants and put on the skirt" 같은 번역문을 전혀 못 잡는다.
const EN_CLOTHING_NOUN =
  '(?:clothes|clothing|dress|robe|bathrobe|kimono|lingerie|underwear|bra|panties|pants|jeans|trousers|skirt|shirt|blouse|jacket|coat|top|stockings|socks|outfit)'

// 의류 명사 + (조사) + 제거/착의 동사 어간 — "명사마다 동사마다" 조합을 일일이 나열하는 대신
// 하나의 조합 패턴으로 일반화한다(예: 상의를 벗겨줘 / 치마 제거해줘 / 팬티 없애줘 / 가운만
// 입혀라 모두 매칭).
const KO_UNDRESS_NOUN_VERB_PATTERN = `(?:${KO_CLOTHING_NOUN})${KO_PARTICLE_GAP}${KO_REMOVE_VERB_STEM}`
const KO_DRESS_NOUN_VERB_PATTERN = `(?:${KO_CLOTHING_NOUN})${KO_PARTICLE_GAP}${KO_DRESS_VERB_STEM}`

/** 누드·탈의·의류제거 의도 (성인 허용 — 순화하지 않음) */
export function wantsNudeOrUndress(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  const pattern = new RegExp(
    [
      '누드', '나체', 'nude', 'naked', '탈의',
      KO_UNDRESS_NOUN_VERB_PATTERN,
      // "strip(?:ping|ped)?"에 단어 경계(\b)가 없어서 "striped"(줄무늬 패턴 — 탈의와 무관한
      // 흔한 의상 묘사 단어)의 앞부분 "strip"만 부분일치로 걸려 오발동하는 사고가 실측으로
      // 확인됐다("striped dress" 같은 영어 압축 프롬프트가 이전 라운드 baseDescription으로
      // 재사용될 때 특히 위험). \b를 앞뒤로 둬서 "strip"/"stripping"/"stripped"(동사, 겹자음
      // pp)만 매칭되고 "striped"(명사 stripe+d, 단자음 p)는 매칭되지 않게 한다.
      'undress', 'disrobe', '\\bstrip(?:ping|ped)?\\b',
      `remove\\s*(?:her\\s*)?${EN_CLOTHING_NOUN}`,
      `take(?:s|ing)?\\s*off\\s*(?:her\\s*|the\\s*)?${EN_CLOTHING_NOUN}`,
      'fully\\s*nude', 'bare\\s*(?:skin|body)', '완전\\s*노출', '전라',
      // 「유방/유두 보여줘」「가슴 노출」— 누드·나체 단어 없이도 탈의 의도 (실측: 가운만 색 바뀜)
      '유두', '유방', '젖꼭지', 'topless', 'bare\\s*breasts?', 'visible\\s*nipples?',
      'show\\s*(?:her\\s*)?(?:breasts?|nipples?)', 'nipples?\\s*(?:visible|showing)',
      '가슴\\s*(?:을\\s*)?(?:보여|노출|드러내|내보여)',
      '가운\\s*(?:을\\s*)?(?:열어|벗|풀어|헤쳐)', '로브\\s*(?:을\\s*)?(?:열어|벗|풀어)',
      'open\\s*(?:her\\s*)?(?:robe|gown)', 'open\\s*the\\s*robe',
    ].join('|'),
    'i',
  )
  return pattern.test(t)
}

/** 속옷/란제리 ‘착용’ 요청 — 제거·누드 요청이면 false */
export function wantsUnderwearLook(text: string): boolean {
  if (wantsNudeOrUndress(text)) return false
  return /속옷|underwear|란제리|lingerie|팬티|panties|브라(?!운)|브래지/i.test(text || '')
}

/**
 * "탈의 동작"(영상 중 옷이 벗겨지는 전환)만 좁게 감지 — 누드/전라 같은 '상태' 단어는 제외한다.
 * wantsNudeOrUndress는 상태+동작을 모두 잡아서, 이미 누드인 소스 이미지에 '포즈만' 요청해도
 * true가 되어 "옷이 벗겨지는 동작" 프롬프트가 잘못 붙는 문제가 있었다. 모션 문구에 실제
 * "벗다/제거/탈의" 같은 동작 동사가 있을 때만 true로 판단한다.
 */
export function wantsUndressAction(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  const pattern = new RegExp(
    [
      // "벗겨"(사동형: 벗겨줘/벗겨주세요/벗겨봐)는 벗다의 흔한 캐주얼 요청 표현이다.
      // 모션 힌트 문구는 앞서 나온 베이스 설명에서 이미 의류가 특정돼 있어 "천천히 벗어"처럼
      // 명사 없이 동사만 오는 경우가 많다 — 그래서 "벗다" 활용형은 명사 없이도 단독으로
      // 인식하고(아래 4번째 줄), "제거/없애/지우다"처럼 더 범용적인 동사만 명사와 묶어서
      // 요구한다(KO_UNDRESS_NOUN_VERB_PATTERN — "제거" 혼자면 의류 제거인지 알 수 없음).
      '탈의', '벗는', '벗어', '벗기', '벗겨', '벗김', '벗을', '벗었',
      KO_UNDRESS_NOUN_VERB_PATTERN,
      // wantsNudeOrUndress와 동일한 이유로 \b 필요("striped" 오발동 방지).
      'undress', 'disrobe', '\\bstrip(?:ping|ped)?\\b', 'take\\s*off',
      'removes?\\s*(?:her\\s*)?(?:clothes|clothing|underwear|lingerie|robe|dress)',
    ].join('|'),
    'i',
  )
  return pattern.test(t)
}

/**
 * "착의 동작"(영상 중 옷을 입는 전환, 벗기의 반대) 감지.
 * 예전엔 이 방향(옷을 입는 동작)에 대응하는 감지가 전혀 없었다 — 그래서 소스 이미지가
 * 누드인데 모션 힌트로 "옷을 입는다/걸쳐 입는다"를 요청하면, undressAction=false에
 * staysNude=true로 판정되어 buildAnimationPrompt가 오히려 "끝까지 누드 유지, 어떤 옷도
 * 등장 금지"라는 정반대 지시를 강하게 박아넣는 사고가 있었다(요청한 동작과 반대로 동작).
 */
export function wantsDressAction(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  const pattern = new RegExp(
    [
      // "입"은 흔한 단어(입구/가입/수입 등)에도 등장해 명사 없이 단독으로는 못 쓰지만,
      // 아래 구체적 활용형(입는/입어/입기/입혀/입힌다/입힘/입을/입었)은 안전하게 단독 매칭된다.
      '입는', '입어', '입기', '입혀', '입힌다', '입힘', '입을', '입었',
      '착용', '걸치', '두르', '씌우',
      KO_DRESS_NOUN_VERB_PATTERN,
      '걸쳐\\s*입', '걸쳐\\s*걸치',
      'get(?:s|ting)?\\s*dressed', 'dress(?:es|ing)?\\s*(?:her)?self',
      `puts?\\s*on\\s*(?:her\\s*|a\\s*|the\\s*|only\\s*)?${EN_CLOTHING_NOUN}`,
      `wear(?:s|ing)?\\s*(?:a\\s*|the\\s*|only\\s*|just\\s*)?${EN_CLOTHING_NOUN}`,
      'wraps?\\s*(?:herself\\s*)?in\\s*(?:a\\s*|the\\s*)?(?:robe|dress|coat)',
    ].join('|'),
    'i',
  )
  return pattern.test(t)
}

export const NUDE_STATE_WORD_PATTERN =
  /누드|나체|nude|naked|fully\s*nude|bare\s*(?:skin|body|breasts?)|완전\s*노출|전라|유두|유방|젖꼭지|topless|visible\s*nipples?|가슴\s*(?:을\s*)?(?:보여|노출|드러내)/i

/** 누적 base에서 「나체가 된다.」/몸매투영 잔여를 제거 — 안 하면 /나체/에 걸려 이후 수정이 고착됨 */
export function stripNudeBecomesPhrase(text: string): string {
  return polishKoreanPromptText(text || '')
    .replace(/나체가\s*된다\.?/g, ' ')
    .replace(/나체가된다\.?/g, ' ')
    .replace(/몸매\s*투영/g, ' ')
    .replace(/나체\s*수정\s*요청됨[^.。]*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * 이번 요청의 나체 의도(단일 판별기).
 * - become + nudeBecomes: 「몸매 투영」버튼/문구 (체형 유지·옷 페이드 용해)
 * - become: 그 외 나체/탈의 → 일반 탈의
 * - hold: 「이미 나체 유지」또는 신뢰 마커
 */
export function resolveNudeIntent(input: {
  revision?: string
  motion?: string
  base?: string
  prompt?: string
  bodyProject?: boolean
}): { mode: 'become' | 'hold' | 'none'; nudeBecomes: boolean } {
  const revision = polishKoreanPromptText(input.revision || '')
  const motion = polishKoreanPromptText(input.motion || '')
  const base = polishKoreanPromptText(input.base || '')
  const prompt = polishKoreanPromptText(input.prompt || '')
  const active = motion || revision

  if (motionExplicitNudeHoldOnly(motion)) {
    return { mode: 'hold', nudeBecomes: false }
  }
  if (
    input.bodyProject === true ||
    isBodyProjectRequest(revision) ||
    isBodyProjectRequest(motion)
  ) {
    return { mode: 'become', nudeBecomes: true }
  }
  if (active && wantsDressAction(active)) {
    return { mode: 'none', nudeBecomes: false }
  }
  if (active && (wantsUndressAction(active) || wantsNudeOrUndress(active))) {
    return { mode: 'become', nudeBecomes: false }
  }
  const continuity = stripNudeBecomesPhrase(`${prompt} ${base}`)
  if (/현재\s*나체|옷\s*없음/i.test(continuity)) {
    return { mode: 'hold', nudeBecomes: false }
  }
  return { mode: 'none', nudeBecomes: false }
}

/**
 * 최종 결과가 전신 나체여야 하는지(네거티브·해부 락용).
 * 몸매 투영은 이번 revision에 있을 때만 강제 — base 잔여 문구로 고착되지 않음.
 */
export function wantsFullNude(revision: string, baseDescription?: string): boolean {
  const rev = polishKoreanPromptText(revision || '')
  const base = polishKoreanPromptText(baseDescription || '')
  if (isBodyProjectRequest(rev)) return true
  if (NUDE_STATE_WORD_PATTERN.test(rev)) return true
  if (wantsDressAction(rev)) return false
  if (wantsNudeOrUndress(rev)) return true
  if (!base) return false
  if (wantsDressAction(base)) return false
  const baseCont = stripNudeBecomesPhrase(base)
  if (/현재\s*나체|옷\s*없음/i.test(baseCont)) return true
  if (NUDE_STATE_WORD_PATTERN.test(baseCont)) return true
  return wantsNudeOrUndress(baseCont)
}

/**
 * "옷을 교체/스왑"하는 큰 수정인지 폭넓게 판별한다. 탈의(옷을 벗다)·착의(옷을 입다)·교체
 * ("A 대신 B로", "A를 B로 바꿔줘") 세 가지 표현 방식을 모두 하나의 판별로 묶어서, 의류
 * 명사·동사 조합을 사용자가 쓸 때마다 하나씩 나열하지 않아도 되게 한다.
 */
export function isClothingChangeRevision(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  if (wantsNudeOrUndress(t) || wantsDressAction(t)) return true
  // "바지를 스커트로 바꿔줘/교체해줘"처럼 명사와 교체 동사가 붙어있지 않고 문장 뒤쪽에
  // 떨어져 있는 경우는 인접 매칭으로 못 잡는다 — 의류 명사가 하나라도 있고 교체 계열
  // 표현이 있으면 옷 교체 요청으로 간주한다.
  const mentionsClothing = new RegExp(KO_CLOTHING_NOUN, 'i').test(t)
  return mentionsClothing && KO_REPLACE_WORD_PATTERN.test(t)
}

/**
 * Legacy text trigger (optional). Primary UX is the 「몸매 투영」 button (`bodyProject: true`).
 */
export const NUDE_BECOMES_PHRASE = '나체가 된다.'
/** 공백 제거 후: 나체가된다. */
const NUDE_BECOMES_EXACT_COMPACT = '나체가된다.'

/** Canonical revision when the 몸매 투영 button is used — no magic phrase required. */
export const BODY_PROJECT_REVISION =
  '몸매 투영: 얼굴·체형 그대로. 어깨·팔뚝·팔꿈치로 유두 높이를 읽고, 가슴은 옷에 볼륨이 있으면 C컵 반~D컵·처진 실루엣 가능. 배꼽·치부 기점 고정 후 상의·바지·벨트·팬티 전부 녹여 완전 나체. 가슴 아래 벨트/띠 잔상·바지/팬티 잔존·빈유 과소평가 실패.'

export function hasNudeBecomesPhrase(text: string): boolean {
  const t = polishKoreanPromptText(text || '')
  if (!t) return false
  // 반드시 마침표(.) — 「나체가 된다」단독·「되어」는 제외
  if (/나체가\s*된다\./u.test(t)) return true
  const compact = t.replace(/[\s·・\-_/]/g, '')
  return compact.includes(NUDE_BECOMES_EXACT_COMPACT)
}

/** 몸매 투영 요청 — 버튼 플래그, 「몸매 투영」문구, 또는 legacy 「나체가 된다.」 */
export function isBodyProjectRequest(text: string, bodyProjectFlag?: boolean): boolean {
  if (bodyProjectFlag === true) return true
  const t = polishKoreanPromptText(text || '')
  if (!t) return false
  if (/몸매\s*투영/u.test(t)) return true
  return hasNudeBecomesPhrase(t)
}

/**
 * 쇼츠 BEAT 타임라인 균등 분할 — "3등분 약속": 동작이 3개면 균등 3등분(예: 18초→6초씩,
 * 15초→5초씩), 동작이 2개(탈의 + 단일 지속 동작, 또는 탈의 + 나체유지)면 균등 반반.
 * 항상 실제 클립 길이(초) 경계를 정수로 반환해 프롬프트에 구체적인 초 단위 라벨을 박는다.
 */
export function buildEqualBeatSeconds(totalSec: number | undefined, parts: 2 | 3): number[] {
  const total = Math.max(2, Math.round(Number(totalSec) || 15))
  if (parts === 2) {
    const half = Math.min(total - 1, Math.max(1, Math.round(total / 2)))
    return [0, half, total]
  }
  const t1 = Math.min(total - 2, Math.max(1, Math.round(total / 3)))
  const t2 = Math.min(total - 1, Math.max(t1 + 1, Math.round((total * 2) / 3)))
  return [0, t1, t2, total]
}

/**
 * 모션이 「이미 나체 유지」만 명시하고 탈의·전환을 말하지 않는지.
 * (dual-b 후반 등 — 진짜 유지 경로)
 */
export function motionExplicitNudeHoldOnly(motion: string): boolean {
  const t = polishKoreanPromptText(motion || '')
  if (!t) return false
  const hold =
    /이미\s*(완전\s*)?나체\s*유지|나체\s*유지(?:하며|하고|한\s*채)?|fully\s*nude\s*hold|already\s*(fully\s*)?nude\s*(?:hold|stay|keep)|stay(?:s|ing)?\s*(?:fully\s*)?nude/i.test(
      t,
    )
  if (!hold) return false
  // 유지라고 써도 벗기/팬티제거/나체로 전환이면 탈의 경로
  if (wantsUndressAction(t)) return false
  if (/나체로|누드로|올\s*누드|완전\s*나체로|옷을\s*벗겨|팬티\s*(?:를\s*)?(?:벗|제거|없)|속옷\s*(?:을\s*)?(?:벗|제거|없)/i.test(t)) {
    return false
  }
  return true
}

/**
 * 쇼츠 모션이 나체·탈의를 요구하면 탈의(전환) 경로로 강제.
 * 「나체」(조사 로 없음)도 포함 — 예전엔 「나체로」만 잡아, 누적 「현재 나체」와 만나
 * staysNude(유지)로 떨어져 팬티가 픽셀 그대로 남는 회귀가 있었음.
 */
export function motionForcesBecomeNude(motion: string): boolean {
  const t = polishKoreanPromptText(motion || '')
  if (!t) return false
  if (motionExplicitNudeHoldOnly(t)) return false
  // 몸매 투영 = 탈의·신체 복구 전환
  if (isBodyProjectRequest(t)) return true
  if (wantsUndressAction(t)) return true
  // 상태 단어 「나체/누드」만 있어도 쇼츠에서는 전환으로 본다 (정지 이미지에 속옷 잔존 흔함)
  if (wantsNudeOrUndress(t)) return true
  return /올\s*누드|전라|fully\s*nude|get(?:s|ting)?\s*(?:fully\s*)?naked/i.test(t)
}

/**
 * 나체/누드 요청 모션에 팬티·의상 잔존 방지 문구를 붙인다.
 * 중요: 소스가 아직 옷을 입은 상태인데 「이미 나체 유지」를 붙이면
 * Wan이 탈의를 건너뛰고 팬티만 남긴 채 동작을 하는 실측이 있었음 → 소스 상태로 문구를 가른다.
 */
export function ensureNudeHoldMotionPhrase(
  motion: string,
  opts?: { sourceAlreadyNude?: boolean; durationSec?: number },
): string {
  const t = polishKoreanPromptText(motion || '')
  if (!t) return t
  const asksNude =
    wantsNudeOrUndress(t) ||
    wantsUndressAction(t) ||
    wantsFullNude(t) ||
    /누드|나체|nude|naked/i.test(t)
  if (!asksNude && !opts?.sourceAlreadyNude) return t

  const pantyBan =
    '브라·팬티·바지·반바지·청바지·핫팬츠·레깅스·치마·치마바지·끈팬티 한 픽셀도 남기지 말 것 — 끝까지 완전 나체. 팬티 대신 뿌연 블러·안개·김·모자이크·피부색 얼룩 장애물도 금지 — 크롯치는 선명히 보이고 성인 체모(곱슬 음모)는 유지'
  const fogBanEn =
    'FORBIDDEN foggy blur / milky haze / steam cloud / cloudy smudge over crotch (fake panty substitute). Uncensored sharp crotch with natural adult pubic hair visible — not a shaved blank doll crotch, not fog.'

  // 모션이 나체/탈의를 요구하면(유지-only가 아니면) 소스 마커와 무관하게 전환
  if (motionForcesBecomeNude(t)) {
    let cleaned = t
      .replace(/이미\s*(완전\s*)?나체\s*유지\s*(\([^)]*\))?\s*\.?\s*/gi, '')
      .replace(/fully\s*nude\s*hold[^.]*\.?\s*/gi, '')
      .replace(/already\s*(fully\s*)?nude[^.]*\.?\s*/gi, '')
      .trim()
    if (isBodyProjectRequest(cleaned)) {
      return `BODY PROJECTION (몸매 투영): keep same faces/bodies; predict nipple(유두)+navel(배꼽) under clothes; dissolve fabric only onto those anchors; panties/briefs must leave. FORBIDDEN new body, gender swap, smile-only, fog. ${pantyBan}. ${fogBanEn}. ${cleaned}`
    }
    if (/옷을\s*벗겨\s*완전\s*나체|완전\s*나체로\s*전환|undress\s*to\s*full\s*nude|take\s*off\s*all\s*(?:clothes|clothing|panties)/i.test(cleaned)) {
      return /팬티|panty|블러|뿌연|fog|blur/i.test(cleaned)
        ? cleaned
        : `${cleaned}. ${pantyBan}. ${fogBanEn}`
    }
    // "3등분 약속": 탈의 + 이어지는 행동 = 2개 동작 → 균등 반반(구체적 초로 표기).
    const [, half, total] = buildEqualBeatSeconds(opts?.durationSec, 2)
    return `Take off ALL clothes (top, bra, pants/jeans/shorts/leggings/skirt) including panties/thong in the first half (0–${half}s of ${total}s) — then the action for the rest of the clip (${half}–${total}s). This applies no matter how the source garment looks: ordinary clothes, dress/gown, robe/cloak/cape, corset, costume, or any fantasy/decorative outfit (shells, jewels, veils, wraps) — ALL of it must come off, none of it is "part of the character" or exempt. FORBIDDEN clothed conversation or foggy crotch blur. ${pantyBan}. ${fogBanEn}. ${cleaned}`
  }

  // 명시적 유지-only 또는 (모션에 나체 요청 없이) 소스만 나체 마커
  if (opts?.sourceAlreadyNude || motionExplicitNudeHoldOnly(t)) {
    if (/이미\s*(완전\s*)?나체\s*유지|fully\s*nude\s*hold|already\s*(fully\s*)?nude/i.test(t)) {
      return /팬티|panty|블러|뿌연|fog|blur/i.test(t)
        ? `${t}. ${fogBanEn}`
        : `${t}. If any panties/underwear or foggy blur remain in the source, remove them immediately. ${pantyBan}. ${fogBanEn}`
    }
    return `이미 완전 나체 유지. 소스에 팬티·뿌연 블러가 보이면 즉시 제거. ${pantyBan}. ${fogBanEn}. ${t}`
  }

  // 착의 소스: 「이미 나체」문구가 있으면 오히려 해로우니 제거·교체
  let cleaned = t
    .replace(/이미\s*(완전\s*)?나체\s*유지\s*(\([^)]*\))?\s*\.?\s*/gi, '')
    .replace(/fully\s*nude\s*hold[^.]*\.?\s*/gi, '')
    .replace(/already\s*(fully\s*)?nude[^.]*\.?\s*/gi, '')
    .trim()
  if (/옷을\s*벗겨\s*완전\s*나체|완전\s*나체로\s*전환|undress\s*to\s*full\s*nude/i.test(cleaned)) {
    return cleaned
  }
  return `옷을 벗겨 완전 나체가 된 뒤 동작(바지·반바지·청바지·치마·레깅스·팬티·브라 포함 전부 제거, 뿌연 블러 금지). 평범한 옷이든 드레스·가운·로브·망토·코르셋·판타지 의상(조개·보석·베일 장식 등)이든 종류와 무관하게 전부 벗겨야 하며, 캐릭터의 일부처럼 남겨두면 안 된다. ${pantyBan}. ${fogBanEn}. ${cleaned}`
}
