/**
 * 화보/수정 텍스트가 실제로 동물 주제인지 판별.
 * content-policy.ts에서 분리 — polishKoreanPromptText 외 다른 모듈 의존 없음.
 */
import { polishKoreanPromptText } from './korean-text'

// 영단어(frog/cat/dog/lion/bear/bird 등)는 \b로 단어 경계를 반드시 둬야 한다 — 예전엔
// 경계 없이 그냥 부분일치라서 "delicate"("cat" 포함), "million/billion/pavilion"("lion"
// 포함), "forbear"("bear" 포함) 같은 흔한 단어에도 오발동해서, 화보 수정 문구에 "delicate"
// (레이스/장신구 묘사에 자주 쓰임) 한 단어만 있어도 화보 모드 전체가 "동물/일러스트" 자유
// 모드로 잘못 전환되는 심각한 사고가 실측으로 확인됐다(정체성 잠금·인종 기본값·란제리
// 안전 문구가 전부 빠지고 "여성 모델을 만들지 말라"는 정반대 지시가 들어감). 복수형(s)만
// 허용하고, 그 외에는 정확히 그 단어여야 매칭되게 좁힌다.
const ANIMAL_SUBJECT_PATTERN =
  /토끼|개구리|여우|사자|호랑이|고양이|강아지|원숭|당나귀|곰|늑대|동물|\b(?:frog|rabbit|fox|lion|tiger|cat|dog|monkey|bear|bird|horse|animal)s?\b/i

// "말"(말horse)과 "새"(bird)는 JS 정규식의 \b가 한글을 \w로 취급하지 않아 "말\b"/"새\b"가
// 한글 문장에서는 절대 매칭되지 않는 죽은 패턴이었다(실측으로 확인 — "말의 머리 위에" 같은
// 문장에서 전혀 감지되지 않아 화보 모드 인물 고정 문구가 말 그림에 잘못 섞여 들어갔다).
// "말"은 "정말/거짓말/참말"처럼 앞 글자에 붙는 복합어와 구분해야 하므로, 문장 시작/공백/구두점
// 뒤에서 시작하고, 뒤에는 조사·공백·구두점·문장끝이 오는 경우만 "말(horse)"로 인정한다.
const HORSE_WORD_PATTERN =
  /(?:^|[\s"'“'(\[,.!?])말(?=이|가|은|는|을|를|의|과|와|도|만|처럼|같이|한테|에게|께|만큼|보다|들[이은을의]?|[\s"'”)\],.!?]|$)/
const BIRD_WORD_PATTERN =
  /(?:^|[\s"'“'(\[,.!?])새(?=가|는|를|의|와|랑|한테|에게|처럼|보다|같이|만|까지|도|들[이은을의]?|[\s"'”)\],.!?]|$)/

/** 화보(fashion) 모드로 선택돼 있어도 실제 내용이 동물/사물 장면인지 판별한다.
 * 관리자가 「관리자전용(화보)」 탭에서 동물 그림을 만든 경우, 이후 그 이미지를 텍스트로 수정할 때
 * "같은 성인 여성 얼굴 유지" 같은 인물 전용 잠금 문구를 넣으면 img2img 모델이 동물을 여성 얼굴로
 * 바꿔버리는 사고가 실측으로 확인됐다 — 그래서 genMode와 무관하게 실제 서술 내용으로 다시 판별한다. */
export function describesAnimalSubject(text: string): boolean {
  const t = polishKoreanPromptText(text)
  return ANIMAL_SUBJECT_PATTERN.test(t) || HORSE_WORD_PATTERN.test(t) || BIRD_WORD_PATTERN.test(t)
}
