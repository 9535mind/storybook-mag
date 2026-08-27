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
  return t.replace(/\s+/g, ' ').trim()
}
