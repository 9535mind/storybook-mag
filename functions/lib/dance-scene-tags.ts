/**
 * 춤/역동 동작 감지 → 장르별(왈츠/발레/탱고 등) 또는 범용 자세 태그.
 * content-policy.ts에서 분리 — 다른 모듈에 의존하지 않는 독립 유틸.
 */

/**
 * "힘차게 달린다/페달을 밟는다" 같은 동작 묘사를 감지하는 패턴.
 * amplifyClothingAndScene(양성 태그)와 buildFashionNegativePrompt(음성 태그) 양쪽에서
 * 같은 조건으로 참조해, 사용자가 매번 "몸을 앞으로 숙이고 근육에 힘이…" 식으로 직접
 * 풀어쓰지 않아도 동작 단어만으로 역동적인 포즈가 자동으로 강제되게 한다.
 */
export const DYNAMIC_ACTION_PATTERN =
  /힘차게|힘있게|역동적|다이나믹|달린다|달리는|질주|전속력|스피드|속도감|뛰는|뛰어가|페달\s*을?\s*밟|바람에\s*날리|dynamic|running|sprinting|speeding|pedaling|galloping|mid-action|in\s*motion/i

/**
 * "춤춘다"만으로는 팔다리를 어떻게 둬야 할지 모델에게 정보가 거의 없어서(추상적 행위
 * 라벨일 뿐 구체적 자세가 아님), 실측으로 뻣뻣하게 서 있는 자세로 뭉개지는 경우가 반복
 * 확인됐다. 반면 왈츠/발레/살사 같은 구체적 장르는 학습 데이터에 특징적 자세(파트너 홀드,
 * 발끝 세우기 등)가 뚜렷해서 훨씬 안정적으로 반영된다 — 장르가 감지되면 그 장르의 전형적
 * 자세를 직접 명시하고, 장르가 없으면 최소한 "역동적인 춤 동작" 정도의 범용 태그를 붙여서
 * 완전히 뻣뻣한 정자세로 새는 것만이라도 막는다. DYNAMIC_ACTION_PATTERN(달리기/질주 계열)과
 * 는 성격이 달라 별도 패턴/함수로 분리한다(그 태그는 "몸을 앞으로 숙이고 바람에 날리는"
 * 식이라 춤에는 안 맞는 경우가 많다).
 */
const DANCE_GENRE_TAGS: Array<{ pattern: RegExp; en: string }> = [
  {
    pattern: /왈츠|활츠|waltz/i,
    en: 'elegant ballroom waltz pose, partner dance hold with one arm raised, flowing gown swirling mid-turn, graceful spin, poised ballroom dancer posture',
  },
  {
    pattern: /발레|ballet/i,
    en: 'classical ballet pose, pointed toes en pointe, arms in ballet fifth position, graceful ballerina posture',
  },
  {
    pattern: /탱고|tango/i,
    en: 'dramatic tango pose, sharp partner embrace, extended leg line, intense passionate posture',
  },
  {
    pattern: /살사|salsa/i,
    en: 'salsa dance pose, hip movement mid-turn, dynamic partner dance footwork',
  },
  {
    pattern: /플라멩코|flamenco/i,
    en: 'flamenco dance pose, dramatic arm and hand flourish, sharp footwork stance, passionate posture',
  },
  {
    pattern: /벨리\s*댄스|belly\s*dance/i,
    en: 'belly dance pose, fluid hip movement, flowing arm gestures, ornate dance costume',
  },
  {
    pattern: /브레이크\s*댄스|breakdance|비\s*보잉|b-?boying/i,
    en: 'breakdance pose, dynamic acrobatic street dance freeze, energetic street dance stance',
  },
  {
    pattern: /현대\s*무용|컨템포러리|contemporary\s*dance/i,
    en: 'contemporary dance pose, expressive fluid body line, artistic modern dance movement',
  },
  {
    pattern: /재즈\s*댄스|jazz\s*dance/i,
    en: 'jazz dance pose, sharp dynamic body line, theatrical dance stance',
  },
  {
    pattern: /케이팝|k-?pop\s*댄스|아이돌\s*댄스/i,
    en: 'k-pop choreography dance pose, sharp synchronized dance move, confident performance stance',
  },
  {
    pattern: /힙합|hip-?hop/i,
    en: 'hip-hop dance pose, street dance stance with bent knees, sharp expressive arm movement',
  },
]

const GENERIC_DANCE_PATTERN = /춤\s*추|춤춘다|춤을|댄스\s*를?\s*추|dancing|\bdance\b/i

/** 춤 감지 — 장르가 명시돼 있으면 그 장르 전용 자세, 없으면 범용 댄스 자세 태그를 반환. */
export function resolveDanceTag(description: string): string {
  const genre = DANCE_GENRE_TAGS.find((g) => g.pattern.test(description))
  if (genre) return genre.en
  if (GENERIC_DANCE_PATTERN.test(description)) {
    return 'dynamic dance pose, mid-dance movement, expressive body line, graceful arm gesture, NOT a static standing portrait, NOT stiff arms at sides'
  }
  return ''
}

export function isDanceRevision(description: string): boolean {
  return GENERIC_DANCE_PATTERN.test(description) || DANCE_GENRE_TAGS.some((g) => g.pattern.test(description))
}
