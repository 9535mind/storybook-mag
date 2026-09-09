/**
 * 한글 프롬프트 텍스트 정리 유틸리티.
 * content-policy.ts에서 분리 — 다른 lib 모듈에도 의존하지 않는 순수 함수라 가장 먼저 뺐다.
 */

/** 생성·수정 공통: 흔한 한글 오타·커서 잔여 정리 */
export function polishKoreanPromptText(text: string): string {
  let t = String(text || '')
  if (!t) return ''
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, '')
  t = t.replace(/[|/\\]+/g, '')
  t = t.replace(/\s+/g, ' ').trim()
  t = t.replace(/([가-힣])\s+(게|히)(?=\s|$|[가-힣.,!?…·])/g, '$1$2')
  t = t.replace(/하고\s*잇다/g, '하고 있다')
  t = t.replace(/되어\s*잇다/g, '되어 있다')
  t = t.replace(/([가-힣])잇다/g, '$1있다')
  t = t.replace(/수정하래/g, '수정해줘')
  t = t.replace(/([가-힣])하래(?=\s|$|[.!?…])/g, '$1해줘')
  t = t.replace(/되엇/g, '되었')
  t = t.replace(/햇다/g, '했다')
  // 란제리촉옷차림 → 란제리 속옷차림
  t = t.replace(/촉옷/g, '속옷')
  t = t.replace(/란제리\s*속옷/g, '란제리 속옷')
  t = t.replace(/않자/g, '앉아')
  t = t.replace(/위애/g, '위에')
  t = t.replace(/잇어요/g, '있어요')
  t = t.replace(/잇다/g, '있다')
  t = t.replace(/잆학/g, '입학')
  t = t.replace(/입핵/g, '입학')
  // 가습(습/슴 받침 오타) → 가슴. "가습기"(가전제품)는 실존 단어라 제외해야 한다 —
  // 실측: "가습을 만져본다"를 "가슴을 만져본다"로 못 읽어서 가슴 터치 감지가 통째로
  // 빠지고, 결국 동작 없는 폴백(그냥 나체 유지)으로 새서 요청한 동작이 사라졌었다.
  t = t.replace(/가습(?!기)/g, '가슴')
  t = normalizeOtbeotgimTerms(t)
  return t.replace(/\s+/g, ' ').trim()
}

/**
 * 옷벗김 동의어 → 같은 토큰.
 * 겉옷·상의·하의 제거(브라 유지) → 바지 제거(팬티 유지) → 브라·팬티 제거 → 나체.
 */
const OTBEOTGIM_SYNONYM_PATTERN = new RegExp(
  [
    'layer[\\s-]*by[\\s-]*layer(?:\\s+(?:undress|strip|peel))?',
    '(?:undress|strip|peel)(?:es|ing|s)?\\s+layer[\\s-]*by[\\s-]*layer',
    'peel(?:s|ing)?\\s+one\\s+layer(?:\\s+at\\s+a\\s+time)?',
    'one\\s+layer\\s+at\\s+a\\s+time',
    'peel(?:s|ing)?\\s+layers?',
    'clothes\\s*peel',
    '속옷\\s*경유',
    '레이어\\s*벗김',
    '겹벗김',
    '층벗김',
    '한\\s*겹\\s*한\\s*겹(?:\\s*(?:벗겨?|벗기|벗긴다|제거))?',
    '한\\s*겹씩(?:으로)?\\s*(?:벗겨?|벗기|벗긴다|벗기고|벗김|제거|없애|지워)?',
    '한\\s*장씩\\s*(?:벗겨?|벗기|벗긴다|제거|없애)?',
    '옷을?\\s*하나씩\\s*(?:제거|벗기|벗겨|벗긴다|없애|지워)',
    '옷을?\\s*한\\s*(?:겹|장)씩\\s*(?:제거|벗기|벗겨|벗긴다|없애)?',
    '겹겹이(?:\\s*옷을?)?\\s*(?:벗기|벗겨|제거)',
    '옷을?\\s*겹겹이',
    '차례로\\s*(?:옷을?\\s*)?(?:벗기|벗겨|제거)',
    '단계적으로\\s*(?:옷을?\\s*)?(?:벗기|벗겨|제거)',
    '순서대로\\s*(?:옷을?\\s*)?(?:벗기|벗겨)',
    '겉(?:옷)?부터\\s*(?:벗기|벗겨|제거)',
    '겉옷을\\s*먼저(?:\\s*(?:벗기|벗겨))?',
    '층층이\\s*(?:벗기|벗겨)',
    '옷을?\\s*녹여(?:\\s*(?:벗기|벗겨))?',
    '옷\\s*녹이(?:기)?',
    '겉부터\\s*속까지',
    '블라우스부터(?:\\s*(?:벗기|벗겨|제거))?',
    '하나씩\\s*(?:벗기|벗겨|벗긴다)',
    '한\\s*개씩\\s*(?:벗기|벗겨|제거)',
    '옷\\s*벗김',
  ].join('|'),
  'gi',
)

export function normalizeOtbeotgimTerms(text: string): string {
  let t = String(text || '')
  if (!t) return ''
  t = t.replace(OTBEOTGIM_SYNONYM_PATTERN, '옷벗김')
  t = t.replace(/(?:옷벗김)(?:\s*옷벗김)+/g, '옷벗김')
  t = t.replace(/옷벗김(?=[가-힣A-Za-z0-9])/g, '옷벗김 ')
  return t.replace(/\s+/g, ' ').trim()
}
