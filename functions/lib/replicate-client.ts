/**
 * Replicate client — primary engine (Juggernaut XL Lightning, SDXL 계열).
 *
 * Community 모델이라 버전 id가 필요함 → GET /v1/models/{owner}/{name} 으로
 * latest_version.id 를 조회한 뒤 POST /v1/predictions 로 실행한다.
 * (공식 모델용 단축 엔드포인트 /v1/models/.../predictions 는 community 모델에는 안 통함)
 */

const REPLICATE_TIMEOUT_MS = 55_000
/** 비디오(I2V) 모델은 이미지 모델보다 훨씬 오래 걸림 — 별도의 넉넉한 예산을 둔다. */
const REPLICATE_VIDEO_TIMEOUT_MS = 170_000
const VERSION_CACHE_TTL_MS = 10 * 60 * 1000

type ReplicateModelResponse = {
  latest_version?: { id?: string }
  detail?: string
}

type ReplicatePredictionResponse = {
  id?: string
  status?: string
  output?: unknown
  error?: unknown
  detail?: string
}

const versionCache = new Map<string, { id: string; resolvedAt: number }>()

function extractReplicateError(payload: { error?: unknown; detail?: string }): string {
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim()
  if (payload.error && typeof payload.error === 'object') {
    try {
      return JSON.stringify(payload.error)
    } catch {
      /* ignore */
    }
  }
  if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim()
  return 'replicate_request_failed'
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.max(timeoutMs, 1_000))
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function resolveLatestVersion(apiToken: string, owner: string, name: string): Promise<string> {
  const cacheKey = `${owner}/${name}`
  const cached = versionCache.get(cacheKey)
  if (cached && Date.now() - cached.resolvedAt < VERSION_CACHE_TTL_MS) {
    return cached.id
  }

  const response = await fetchWithTimeout(
    `https://api.replicate.com/v1/models/${owner}/${name}`,
    { headers: { Authorization: `Bearer ${apiToken}` } },
    15_000,
  )
  const payload = (await response.json().catch(() => ({}))) as ReplicateModelResponse
  if (!response.ok) {
    throw new Error(payload.detail || 'replicate_model_lookup_failed')
  }
  const versionId = payload.latest_version?.id
  if (!versionId) {
    throw new Error('replicate_missing_latest_version')
  }
  versionCache.set(cacheKey, { id: versionId, resolvedAt: Date.now() })
  return versionId
}

async function createPrediction(
  apiToken: string,
  version: string,
  input: Record<string, unknown>,
  timeoutMs: number = REPLICATE_TIMEOUT_MS,
): Promise<ReplicatePredictionResponse> {
  const response = await fetchWithTimeout(
    'https://api.replicate.com/v1/predictions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        Prefer: `wait=${Math.min(55, Math.round(timeoutMs / 1000))}`,
      },
      body: JSON.stringify({ version, input }),
    },
    timeoutMs,
  )
  const payload = (await response.json().catch(() => ({}))) as ReplicatePredictionResponse
  if (!response.ok) {
    throw new Error(extractReplicateError(payload))
  }
  return payload
}

async function pollPrediction(
  apiToken: string,
  id: string,
  startedAt: number,
  timeoutMs: number = REPLICATE_TIMEOUT_MS,
): Promise<ReplicatePredictionResponse> {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const elapsed = Date.now() - startedAt
    if (elapsed >= timeoutMs) throw new Error('replicate_timeout')

    const response = await fetchWithTimeout(
      `https://api.replicate.com/v1/predictions/${id}`,
      { headers: { Authorization: `Bearer ${apiToken}` } },
      timeoutMs - elapsed,
    )
    const payload = (await response.json().catch(() => ({}))) as ReplicatePredictionResponse
    if (!response.ok) throw new Error(extractReplicateError(payload))

    if (payload.status === 'succeeded') return payload
    if (payload.status === 'failed' || payload.status === 'canceled') {
      throw new Error(extractReplicateError(payload) || `replicate_${payload.status}`)
    }
    await sleep(attempt < 10 ? 500 : 1_500)
  }
  throw new Error('replicate_timeout')
}

function extractImageUrl(output: unknown): string | null {
  if (typeof output === 'string' && output.trim()) return output.trim()
  if (Array.isArray(output) && typeof output[0] === 'string' && output[0].trim()) {
    return output[0].trim()
  }
  return null
}

export type ReplicateImageSize = { width: number; height: number }

/** Juggernaut XL 계열 권장 SDXL 네이티브 해상도. */
export function resolveReplicateImageSize(size: string | undefined): ReplicateImageSize {
  if (size === 'portrait') return { width: 832, height: 1216 } // 2:3
  if (size === 'story') return { width: 768, height: 1344 } // 9:16 Shorts
  if (size === 'landscape') return { width: 1216, height: 832 } // 3:2
  return { width: 1024, height: 1024 } // 1:1
}

export async function generateReplicateImage(options: {
  apiToken: string
  modelOwner: string
  modelName: string
  modelVersion?: string
  prompt: string
  negativePrompt?: string
  width: number
  height: number
  /** 자유 일러스트 등 — 앱 자체 정책 통과 후 엔진 안전필터만 해제 */
  disableSafetyChecker?: boolean
  numInferenceSteps?: number
  guidanceScale?: number
}): Promise<{ imageUrl: string }> {
  if (!options.apiToken?.trim()) {
    throw new Error('missing_replicate_token')
  }

  const startedAt = Date.now()
  const versionId =
    options.modelVersion?.trim() ||
    (await resolveLatestVersion(options.apiToken, options.modelOwner, options.modelName))

  // Lightning은 빠르지만 steps/CFG가 너무 낮으면 프롬프트를 무시하기 쉬움 → 충실도 쪽으로 조금 올림
  // Juggernaut 스키마: number_of_images, disable_safety_checker
  const fullInput: Record<string, unknown> = {
    prompt: options.prompt,
    negative_prompt: options.negativePrompt,
    width: options.width,
    height: options.height,
    num_inference_steps: options.numInferenceSteps ?? 10,
    guidance_scale: options.guidanceScale ?? 3.2,
    number_of_images: 1,
    num_outputs: 1,
  }
  if (options.disableSafetyChecker) {
    fullInput.disable_safety_checker = true
  }

  let prediction: ReplicatePredictionResponse
  try {
    prediction = await createPrediction(options.apiToken, versionId, fullInput)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'replicate_request_failed'
    // 레이트리밋은 재시도해도 동일·악화. NSFW는 안전필터 해제 입력으로 한 번 더 시도.
    if (/throttl|rate limit|429/i.test(message)) {
      throw new Error(message)
    }
    if (/nsfw/i.test(message) && options.disableSafetyChecker) {
      const nsfwRetry: Record<string, unknown> = {
        prompt: options.prompt,
        negative_prompt: options.negativePrompt,
        width: options.width,
        height: options.height,
        disable_safety_checker: true,
        number_of_images: 1,
      }
      prediction = await createPrediction(options.apiToken, versionId, nsfwRetry)
    } else {
      // 모델 스키마가 다를 수 있음(추가 필드 거부) — 최소 입력으로 재시도.
      const minimalInput: Record<string, unknown> = {
        prompt: options.prompt,
        width: options.width,
        height: options.height,
      }
      if (options.disableSafetyChecker) {
        minimalInput.disable_safety_checker = true
      }
      prediction = await createPrediction(options.apiToken, versionId, minimalInput)
    }
  }

  if (prediction.status === 'failed') {
    throw new Error(extractReplicateError(prediction))
  }

  if (prediction.status !== 'succeeded') {
    if (!prediction.id) throw new Error('replicate_missing_prediction_id')
    prediction = await pollPrediction(options.apiToken, prediction.id, startedAt)
  }

  if (prediction.status === 'failed') {
    throw new Error(extractReplicateError(prediction))
  }

  const imageUrl = extractImageUrl(prediction.output)
  if (!imageUrl) {
    throw new Error('replicate_missing_image_url')
  }
  return { imageUrl }
}

/**
 * 원본 이미지를 유지한 채 약하게 수정(img2img).
 * 전체 재생성(T2I)과 달리 얼굴·구도가 바뀌는 문제를 줄인다.
 */
export async function refineReplicateImageToImage(options: {
  apiToken: string
  modelOwner: string
  modelName: string
  modelVersion?: string
  imageUrl: string
  prompt: string
  negativePrompt?: string
  width: number
  height: number
  /** 0에 가까울수록 원본 유지, 1에 가까울수록 크게 변경 */
  strength?: number
  disableSafetyChecker?: boolean
}): Promise<{ imageUrl: string }> {
  if (!options.apiToken?.trim()) throw new Error('missing_replicate_token')
  if (!options.imageUrl?.trim()) throw new Error('missing_image_url')

  const startedAt = Date.now()
  const versionId =
    options.modelVersion?.trim() ||
    (await resolveLatestVersion(options.apiToken, options.modelOwner, options.modelName))

  const strength = options.strength ?? 0.42
  const safety = options.disableSafetyChecker !== false
  const attempts: Array<Record<string, unknown>> = [
    {
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      image: options.imageUrl,
      strength,
      prompt_strength: strength,
      width: options.width,
      height: options.height,
      num_inference_steps: 8,
      guidance_scale: 2.2,
      number_of_images: 1,
      disable_safety_checker: safety,
    },
    {
      prompt: options.prompt,
      image: options.imageUrl,
      strength,
      width: options.width,
      height: options.height,
      disable_safety_checker: safety,
    },
    {
      prompt: options.prompt,
      init_image: options.imageUrl,
      prompt_strength: strength,
      disable_safety_checker: safety,
    },
  ]

  let lastError: Error | null = null
  for (const input of attempts) {
    try {
      let prediction = await createPrediction(options.apiToken, versionId, input)
      if (prediction.status !== 'succeeded') {
        if (!prediction.id) throw new Error('replicate_missing_prediction_id')
        prediction = await pollPrediction(options.apiToken, prediction.id, startedAt)
      }
      const imageUrl = extractImageUrl(prediction.output)
      if (!imageUrl) throw new Error('replicate_missing_image_url')
      return { imageUrl }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('replicate_img2img_failed')
    }
  }
  throw lastError || new Error('replicate_img2img_failed')
}

/**
 * Replicate 비디오(I2V) 클라이언트 — 기본 타겟: Wan2.2 I2V (wan-video/wan-2.2-i2v-fast).
 *
 * Wan2.2 I2V 계열 모델은 `image` + `prompt` 를 필수 입력으로 받고, 결과는 비디오 파일의
 * URI 문자열(또는 { video: { url } } 형태) 로 반환된다. HunyuanVideo 등 다른 I2V 모델로
 * 교체하고 싶으면 REPLICATE_VIDEO_MODEL_OWNER / REPLICATE_VIDEO_MODEL_NAME 환경변수만 바꾸면 됨
 * (스키마가 다르면 최소 입력 재시도 로직이 자동으로 흡수함).
 */

function extractVideoUrl(output: unknown): string | null {
  if (typeof output === 'string' && output.trim()) return output.trim()
  if (Array.isArray(output) && typeof output[0] === 'string' && output[0].trim()) {
    return output[0].trim()
  }
  if (output && typeof output === 'object') {
    const record = output as Record<string, unknown>
    if (typeof record.video === 'string' && record.video.trim()) return record.video.trim()
    if (record.video && typeof record.video === 'object') {
      const url = (record.video as Record<string, unknown>).url
      if (typeof url === 'string' && url.trim()) return url.trim()
    }
    if (typeof record.url === 'string' && record.url.trim()) return record.url.trim()
  }
  return null
}

export type ReplicateVideoAspect = 'portrait' | 'landscape' | 'square'

/** 이미지 생성 시 선택한 비율을 I2V 모델의 해상도 힌트로 매핑(Wan2.2 계열: 16:9 / 9:16). */
export function resolveReplicateVideoAspect(size: string | undefined): ReplicateVideoAspect {
  if (size === 'portrait' || size === 'story') return 'portrait' // 2:3 · 9:16 → 세로 영상
  if (size === 'landscape') return 'landscape'
  return 'square'
}

/**
 * Wan2.2-i2v-fast 길이 근사 (UI: 8 / 10 / 12 / 15초, 기본 8초).
 * API 한도: frames 81–121 → 길수록 fps↓
 */
export function resolveWanI2vDuration(durationSec?: number): {
  num_frames: number
  frames_per_second: number
  approxSec: number
} {
  const raw = Math.round(Number(durationSec) || 8)
  if (raw <= 8) return { num_frames: 121, frames_per_second: 15, approxSec: 8 }
  if (raw <= 10) return { num_frames: 121, frames_per_second: 12, approxSec: 10 }
  if (raw <= 12) return { num_frames: 121, frames_per_second: 10, approxSec: 12 }
  return { num_frames: 121, frames_per_second: 8, approxSec: 15 }
}

export async function generateReplicateVideo(options: {
  apiToken: string
  modelOwner: string
  modelName: string
  modelVersion?: string
  imageUrl: string
  prompt: string
  aspect?: ReplicateVideoAspect
  /** 목표 길이(초). Wan2.2 계열은 frames/fps로 근사 (최대 약 15초). */
  durationSec?: number
}): Promise<{ videoUrl: string; durationSec: number }> {
  if (!options.apiToken?.trim()) {
    throw new Error('missing_replicate_token')
  }
  if (!options.imageUrl?.trim()) {
    throw new Error('missing_image_url')
  }

  const startedAt = Date.now()
  const versionId =
    options.modelVersion?.trim() ||
    (await resolveLatestVersion(options.apiToken, options.modelOwner, options.modelName))

  const { num_frames, frames_per_second, approxSec } = resolveWanI2vDuration(options.durationSec)

  const fullInput: Record<string, unknown> = {
    image: options.imageUrl,
    prompt: options.prompt,
    num_frames,
    frames_per_second,
    go_fast: true,
  }
  // Wan2.2 schema: resolution enum is "480p" | "720p" (aspect follows source image).
  if (options.aspect === 'portrait' || options.aspect === 'landscape' || options.aspect === 'square') {
    fullInput.resolution = '480p'
  }

  let prediction: ReplicatePredictionResponse
  try {
    prediction = await createPrediction(options.apiToken, versionId, fullInput, REPLICATE_VIDEO_TIMEOUT_MS)
  } catch {
    // 모델 스키마가 다를 수 있음(추가 필드 거부) — 최소 입력으로 재시도.
    const minimalInput: Record<string, unknown> = {
      image: options.imageUrl,
      prompt: options.prompt,
    }
    prediction = await createPrediction(options.apiToken, versionId, minimalInput, REPLICATE_VIDEO_TIMEOUT_MS)
  }

  if (prediction.status !== 'succeeded') {
    if (!prediction.id) throw new Error('replicate_missing_prediction_id')
    prediction = await pollPrediction(options.apiToken, prediction.id, startedAt, REPLICATE_VIDEO_TIMEOUT_MS)
  }

  const videoUrl = extractVideoUrl(prediction.output)
  if (!videoUrl) {
    throw new Error('replicate_missing_video_url')
  }
  return { videoUrl, durationSec: approxSec }
}
