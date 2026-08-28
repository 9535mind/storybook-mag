/**
 * 얼굴/입 고정 잠금 문구 — 탈의·수정 시 얼굴이 드리프트하지 않도록.
 * content-policy.ts에서 분리 — 다른 모듈에 의존하지 않는 독립 유틸.
 */

/**
 * 입·이빨 과장 억제 — 이빨을 과하게 드러내면 서양형/다른 사람으로 드리프트하는 실측.
 * (입을 열었을 때 이빨이 전혀 안 보이면 어색 → 조금 보이는 정도는 허용)
 */
export function buildSoftMouthFaceLock(): string {
  return [
    'MOUTH LOCK: natural Korean mouth — soft closed smile, or lightly parted lips when speaking/kissing',
    'teeth may show slightly when the mouth opens — a small natural glimpse only',
    'FORBIDDEN: wide toothy Hollywood grin, rows of exaggerated teeth, mouth stretched open that changes identity',
    'keep the same lip shape and mouth width as the source face — do not stretch the mouth',
  ].join('. ')
}

/** 탈의/나체 시 얼굴 픽셀 동결 — 몸만 바꾸고 얼굴은 가져오기 */
export function buildFaceFrozenLock(): string {
  return [
    'FACE FROZEN: copy the source face as-is — eyes, nose, mouth, brows, jaw, skin',
    'Do NOT redraw, beautify, age, Westernize, or change the mouth for expression beyond a tiny soft smile',
    buildSoftMouthFaceLock(),
  ].join('. ')
}

/**
 * 2인(커플) 쇼츠 전용 얼굴 고정 — 위 buildFaceFrozenLock/STRUCTURE LOCK은 전부 단수
 * ("same face identity" 한 문장)라 한 사람만 있다고 가정한 문구였다. 소스 사진에 두 사람이
 * 함께 있을 때(특히 증명사진이 아니라 전신/반신 합성 사진처럼 두 얼굴이 작게 나오는 경우)
 * Wan I2V가 영상 진행 중 둘 중 한쪽 얼굴을 다른 사람으로 드리프트시키는 실측이 확인됐다 —
 * "두 사람 모두 각자의 얼굴을 그대로 유지"를 별도 문장으로 명시해야 한다.
 */
export function buildCoupleFaceLock(): string {
  return [
    'TWO PEOPLE, TWO SEPARATE FACES: this is two different real individuals, not one person twice — keep EACH person\'s own face, skin tone, and hairstyle exactly as in the source photo, in every frame',
    'FORBIDDEN: either face drifting into a different-looking person, the two faces blending into each other, or one person being replaced/duplicated as the video plays',
  ].join('. ')
}
