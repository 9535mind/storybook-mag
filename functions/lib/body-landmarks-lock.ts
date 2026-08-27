/**
 * 사용자 지정 몸매 타점(유두/가슴/배꼽) 정규화 + I2V 프롬프트용 좌표 잠금 문구.
 * content-policy.ts에서 분리 — 다른 모듈에 의존하지 않는 독립 유틸.
 */

/** Normalized body landmarks (0–1, image top-left origin) placed by the user before 몸매 투영. */
export type BodyLandmarks = {
  /** White-circle center = breast mound center (not always equal to nipple). */
  moundL?: { x: number; y: number }
  moundR?: { x: number; y: number }
  /** Red-dot = nipple; may sit off-center on the mound. Absent = user removed that side. */
  nippleL?: { x: number; y: number }
  nippleR?: { x: number; y: number }
  /** Optional — UI no longer collects navel; kept for backward compat. */
  navel?: { x: number; y: number }
  /** Breast mound radius as fraction of min(imageW, imageH). */
  breastRadius?: number
  /** Per-side radii when user tuned left/right independently. */
  breastRadiusL?: number
  breastRadiusR?: number
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5
  return Math.min(1, Math.max(0, n))
}

function clampBreastRadius(n: number, fallback = 0.08): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(0.22, Math.max(0.035, n))
}

/** Sanitize client landmarks; returns null if neither breast side remains. */
export function normalizeBodyLandmarks(raw: unknown): BodyLandmarks | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const readPt = (key: string) => {
    const p = o[key]
    if (!p || typeof p !== 'object') return null
    const x = Number((p as { x?: unknown }).x)
    const y = Number((p as { y?: unknown }).y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return { x: clamp01(x), y: clamp01(y) }
  }
  const nippleL = readPt('nippleL')
  const nippleR = readPt('nippleR')
  // 사용자가 우클릭으로 한쪽 타점을 제거한 경우 — 남은 쪽만으로도 허용
  if (!nippleL && !nippleR) return null
  const moundL = nippleL ? readPt('moundL') || { ...nippleL } : undefined
  const moundR = nippleR ? readPt('moundR') || { ...nippleR } : undefined
  const navel = readPt('navel')
  const br = Number(o.breastRadius)
  const brL = Number(o.breastRadiusL)
  const brR = Number(o.breastRadiusR)
  const shared = Number.isFinite(br) ? clampBreastRadius(br) : 0.08
  const breastRadiusL = nippleL
    ? Number.isFinite(brL)
      ? clampBreastRadius(brL, shared)
      : shared
    : undefined
  const breastRadiusR = nippleR
    ? Number.isFinite(brR)
      ? clampBreastRadius(brR, shared)
      : shared
    : undefined
  const radii = [breastRadiusL, breastRadiusR].filter((n): n is number => typeof n === 'number')
  return {
    ...(moundL ? { moundL } : {}),
    ...(moundR ? { moundR } : {}),
    ...(nippleL ? { nippleL } : {}),
    ...(nippleR ? { nippleR } : {}),
    ...(navel ? { navel } : {}),
    breastRadius: radii.length ? radii.reduce((a, b) => a + b, 0) / radii.length : shared,
    ...(breastRadiusL != null ? { breastRadiusL } : {}),
    ...(breastRadiusR != null ? { breastRadiusR } : {}),
  }
}

function pct(n: number): string {
  return `${(clamp01(n) * 100).toFixed(1)}%`
}

/**
 * User-placed 타점 → exact nipple/breast/navel anchors for I2V.
 * Coords only — never paint dots onto the source; anchors must match the clothed silhouette.
 */
export function buildBodyLandmarkCoordsLock(landmarks: BodyLandmarks): string {
  const parts = [
    'USER-CONFIRMED BODY LANDMARKS (normalized image coords, origin top-left) — mound center and nipple may differ:',
  ]
  if (landmarks.nippleL) {
    const rL = landmarks.breastRadiusL ?? landmarks.breastRadius ?? 0.08
    const mL = landmarks.moundL ?? landmarks.nippleL
    parts.push(
      `LEFT breast MOUND center at x=${pct(mL.x)} , y=${pct(mL.y)} — mound radius ≈ ${(rL * 100).toFixed(1)}% of shorter image side`,
      `LEFT NIPPLE (red point) at x=${pct(landmarks.nippleL.x)} , y=${pct(landmarks.nippleL.y)} — place the actual nipple here; it may be off-center on the mound (not always at the circle center)`,
    )
  } else {
    parts.push(
      'LEFT breast: NO user landmark — estimate left mound/nipple from the clothed anatomy; do not invent a second face or wrong torso side',
    )
  }
  if (landmarks.nippleR) {
    const rR = landmarks.breastRadiusR ?? landmarks.breastRadius ?? 0.08
    const mR = landmarks.moundR ?? landmarks.nippleR
    parts.push(
      `RIGHT breast MOUND center at x=${pct(mR.x)} , y=${pct(mR.y)} — mound radius ≈ ${(rR * 100).toFixed(1)}% of shorter image side`,
      `RIGHT NIPPLE (red point) at x=${pct(landmarks.nippleR.x)} , y=${pct(landmarks.nippleR.y)} — place the actual nipple here; off-center OK`,
    )
  } else {
    parts.push(
      'RIGHT breast: NO user landmark — estimate right mound/nipple from the clothed anatomy; do not invent a second face or wrong torso side',
    )
  }
  if (landmarks.navel) {
    parts.push(
      `NAVEL at x=${pct(landmarks.navel.x)} from left, y=${pct(landmarks.navel.y)} from top`,
    )
  }
  parts.push(
    'Draw soft breast volume around each PROVIDED MOUND center; put nipples exactly at the provided nipple coords — FORBIDDEN forcing nipples to geometric circle centers if the red points are offset',
    'The source image has NO painted circles or dots — use only these coordinates',
    'Do NOT move nipples to face/neck/shoulder; do NOT shrink the bust away from these anchors',
  )
  return parts.join('. ')
}
