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
  options?: { waitSec?: number | null },
): Promise<ReplicatePredictionResponse> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  }
  // waitSec === null → 즉시 반환(비동기). Cloudflare Pages 30초 한도용.
  if (options?.waitSec !== null) {
    const waitSec =
      typeof options?.waitSec === 'number'
        ? options.waitSec
        : Math.min(55, Math.round(timeoutMs / 1000))
    headers.Prefer = `wait=${Math.max(1, waitSec)}`
  }

  const response = await fetchWithTimeout(
    'https://api.replicate.com/v1/predictions',
    {
      method: 'POST',
      headers,
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

export async function fetchReplicatePrediction(
  apiToken: string,
  predictionId: string,
): Promise<ReplicatePredictionResponse> {
  const id = predictionId.trim()
  if (!id) throw new Error('replicate_missing_prediction_id')
  const response = await fetchWithTimeout(
    `https://api.replicate.com/v1/predictions/${id}`,
    { headers: { Authorization: `Bearer ${apiToken}` } },
    20_000,
  )
  const payload = (await response.json().catch(() => ({}))) as ReplicatePredictionResponse
  if (!response.ok) throw new Error(extractReplicateError(payload))
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
  /** 미지정 시 8 — Lightning 계열 기본값. 일반 SDXL(정밀모드) 등으로 모델을 바꿀 때는
   * 반드시 이 값도 함께 올려야 한다(8스텝은 일반 SDXL에서 노이즈/해부구조 붕괴를 유발함). */
  numInferenceSteps?: number
  guidanceScale?: number
}): Promise<{ imageUrl: string }> {
  if (!options.apiToken?.trim()) throw new Error('missing_replicate_token')
  if (!options.imageUrl?.trim()) throw new Error('missing_image_url')

  const startedAt = Date.now()
  const versionId =
    options.modelVersion?.trim() ||
    (await resolveLatestVersion(options.apiToken, options.modelOwner, options.modelName))

  const strength = options.strength ?? 0.42
  const safety = options.disableSafetyChecker !== false
  const numInferenceSteps = options.numInferenceSteps ?? 8
  const guidanceScale = options.guidanceScale ?? 2.2
  // 2·3차(스키마 거부 대비 축소) 시도에서도 num_inference_steps/guidance_scale/negative_prompt는
  // 계속 유지한다 — 예전엔 1차에만 있고 2·3차엔 빠져서, 정밀모드(스텝↑·CFG↑)로 전환했다고
  // 표시해놓고 1차가 실패하면 조용히 기본 스텝/CFG로 되돌아가는 불일치가 있었다. width/height/
  // number_of_images처럼 모델별로 스키마가 갈리는 필드만 단계적으로 줄인다.
  const attempts: Array<Record<string, unknown>> = [
    {
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      image: options.imageUrl,
      strength,
      prompt_strength: strength,
      width: options.width,
      height: options.height,
      num_inference_steps: numInferenceSteps,
      guidance_scale: guidanceScale,
      number_of_images: 1,
      disable_safety_checker: safety,
    },
    {
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      image: options.imageUrl,
      strength,
      num_inference_steps: numInferenceSteps,
      guidance_scale: guidanceScale,
      disable_safety_checker: safety,
    },
    {
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      init_image: options.imageUrl,
      prompt_strength: strength,
      num_inference_steps: numInferenceSteps,
      guidance_scale: guidanceScale,
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
 * InstantID(zsxkib/instant-id) — 얼굴 사진 1장만으로 정체성(identity)을 유지한 채
 * 프롬프트가 지시하는 새 장면(의상·배경·포즈)을 생성한다.
 *
 * generateReplicateImage(순수 T2I, "Korean woman, attractive face" 같은 일반 인종 태그만
 * 사용)와 근본적으로 다르다 — 텍스트만으로는 특정 인물의 실제 얼굴을 재현할 방법이 없다는
 * 한계 때문에, 얼굴 사진을 별도 인코더(얼굴 임베딩 + IdentityNet ControlNet)에 넣어
 * "이 얼굴을 유지해라"는 벡터 신호를 diffusion 모델에 직접 주입하는 방식을 쓴다.
 * refineReplicateImageToImage(기존 사진의 픽셀에서 출발하는 img2img)와도 다르다 — 이건
 * 매번 완전히 새로운 장면을 "생성"하면서도 얼굴만 특정 인물로 고정할 수 있다는 게 장점이다.
 */
export async function generateFaceIdImage(options: {
  apiToken: string
  modelOwner: string
  modelName: string
  modelVersion?: string
  /** 정체성 기준이 되는 얼굴 사진 URL (허용 호스트 화이트리스트를 통과한 URL이어야 함) */
  faceImageUrl: string
  prompt: string
  negativePrompt?: string
  width: number
  height: number
  /** IdentityNet(ControlNet) 강도 — 높을수록 얼굴 구조(윤곽·이목구비 배치)를 강하게 고정.
   * 기본 0.8(모델 권장값). 너무 높으면 표정/각도가 경직될 수 있다. */
  identityStrength?: number
  /** IP-Adapter 강도 — 높을수록 얼굴의 세부 질감·색감까지 강하게 반영.
   * 너무 높으면 배경/의상이 과포화되거나 텍스트 지시를 덜 따르는 경향이 있다. */
  adapterStrength?: number
}): Promise<{ imageUrl: string }> {
  if (!options.apiToken?.trim()) throw new Error('missing_replicate_token')
  if (!options.faceImageUrl?.trim()) throw new Error('missing_face_image_url')

  const startedAt = Date.now()
  const versionId =
    options.modelVersion?.trim() ||
    (await resolveLatestVersion(options.apiToken, options.modelOwner, options.modelName))

  const identityStrength = options.identityStrength ?? 0.8
  const adapterStrength = options.adapterStrength ?? 0.8

  // 1차: 전체 파라미터. 2차: 모델 스키마가 다를 경우(버전 교체 등) 대비한 최소 입력 재시도
  // (기존 refineReplicateImageToImage와 같은 방어 패턴).
  const attempts: Array<Record<string, unknown>> = [
    {
      image: options.faceImageUrl,
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      width: options.width,
      height: options.height,
      controlnet_conditioning_scale: identityStrength,
      ip_adapter_scale: adapterStrength,
      num_outputs: 1,
      enhance_nonface_region: true,
      disable_safety_checker: true,
    },
    {
      image: options.faceImageUrl,
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      width: options.width,
      height: options.height,
      disable_safety_checker: true,
    },
    {
      image: options.faceImageUrl,
      prompt: options.prompt,
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
      lastError = error instanceof Error ? error : new Error('replicate_faceid_failed')
    }
  }
  throw lastError || new Error('replicate_faceid_failed')
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

/** ReplicateVideoAspect(portrait/landscape/square) → Wan2.2 aspect_ratio 파라미터.
 * Wan은 16:9/9:16 두 값만 받는다(정사각형 옵션이 없음) — "쇼츠"(세로 영상)가 주 용도라
 * square/story 등 애매한 값은 세로(9:16)로 매핑한다. */
function wanAspectRatio(aspect?: ReplicateVideoAspect): '16:9' | '9:16' {
  return aspect === 'landscape' ? '16:9' : '9:16'
}

function buildWanVideoInput(options: {
  imageUrl: string
  prompt: string
  aspect?: ReplicateVideoAspect
  durationSec?: number
  goFast?: boolean
}): { fullInput: Record<string, unknown>; minimalInput: Record<string, unknown>; approxSec: number } {
  const { num_frames, frames_per_second, approxSec } = resolveWanI2vDuration(options.durationSec)
  const fullInput: Record<string, unknown> = {
    image: options.imageUrl,
    prompt: options.prompt,
    num_frames,
    frames_per_second,
    // aspect_ratio를 안 넘기면 모델 기본값(16:9 가로)이 강제로 적용된다 — 세로(9:16)로 만든
    // 원본 이미지로 "쇼츠"(세로 영상)를 요청해도 항상 가로로 나오던 죽은 코드였다.
    aspect_ratio: wanAspectRatio(options.aspect),
    // go_fast(distilled fast path)는 속도는 빠르지만 프롬프트 순응도가 떨어진다.
    // 사용자가 구체적인 모션을 요청했을 때는 꺼서(느려지지만) 요청한 동작을 더 잘 따르게 한다.
    go_fast: options.goFast !== false,
    resolution: '480p',
    // 성인 화보 모션이 안전필터에 걸려 빈 실패로 떨어지는 경우 완화
    disable_safety_checker: true,
  }
  // fullInput이 스키마 문제로 거부될 때만 쓰는 최소 재시도 입력(다른 I2V 모델로 교체됐을 때의
  // 안전판이라 Wan 전용 필드는 최소화한다) — 그래도 사용자가 실제로 고른 옵션이 조용히
  // 무시되는 걸 막기 위해 go_fast·num_frames·frames_per_second·aspect_ratio는 반드시 남긴다.
  // 예전엔 go_fast만 남기고 나머지(특히 duration을 결정하는 num_frames/frames_per_second)는
  // 빠뜨려서, 재시도가 발생하면 사용자가 고른 영상 길이가 조용히 무시되는 버그가 있었다.
  const minimalInput: Record<string, unknown> = {
    image: options.imageUrl,
    prompt: options.prompt,
    num_frames,
    frames_per_second,
    aspect_ratio: wanAspectRatio(options.aspect),
    go_fast: options.goFast !== false,
  }
  return { fullInput, minimalInput, approxSec }
}

const MAX_VIDEO_SOURCE_BYTES = 12 * 1024 * 1024

function parseImageDataUrl(dataUrl: string): {
  contentType: string
  bytes: ArrayBuffer
  filename: string
} {
  const m = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    (dataUrl || '').trim(),
  )
  if (!m) throw new Error('invalid_image_data_url')
  const contentType = m[1].toLowerCase().replace('image/jpg', 'image/jpeg')
  const b64 = m[2].replace(/\s+/g, '')
  // atob → binary string → ArrayBuffer (Workers 호환)
  const bin = atob(b64)
  if (bin.length > MAX_VIDEO_SOURCE_BYTES) throw new Error('source_image_too_large')
  const bytes = new ArrayBuffer(bin.length)
  const view = new Uint8Array(bytes)
  for (let i = 0; i < bin.length; i += 1) view[i] = bin.charCodeAt(i)
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  return { contentType, bytes, filename: `source.${ext}` }
}

/** Replicate Files API — 만료된 delivery URL 대신 신선한 입력 URL을 만든다. */
export async function uploadBytesToReplicate(
  apiToken: string,
  bytes: ArrayBuffer,
  contentType: string,
  filename: string,
): Promise<string> {
  const form = new FormData()
  form.append('content', new Blob([bytes], { type: contentType || 'application/octet-stream' }), filename)
  const response = await fetchWithTimeout(
    'https://api.replicate.com/v1/files',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: form,
    },
    45_000,
  )
  const payload = (await response.json().catch(() => ({}))) as {
    urls?: { get?: string }
    detail?: string
    error?: unknown
  }
  if (!response.ok) {
    throw new Error(
      (typeof payload.detail === 'string' && payload.detail) ||
        extractReplicateError(payload) ||
        'replicate_file_upload_failed',
    )
  }
  const getUrl = payload.urls?.get?.trim()
  if (!getUrl) throw new Error('replicate_file_upload_missing_url')
  return getUrl
}

/**
 * 영상 입력 이미지를 Replicate에 재업로드한다.
 * replicate.delivery 임시 URL은 금방 404가 나므로 필수.
 */
export async function resolveVideoSourceImageUrl(options: {
  apiToken: string
  imageUrl?: string
  imageDataUrl?: string
}): Promise<string> {
  if (!options.apiToken?.trim()) throw new Error('missing_replicate_token')

  if (options.imageDataUrl?.trim().startsWith('data:image/')) {
    const parsed = parseImageDataUrl(options.imageDataUrl)
    return uploadBytesToReplicate(
      options.apiToken,
      parsed.bytes,
      parsed.contentType,
      parsed.filename,
    )
  }

  const url = (options.imageUrl || '').trim()
  if (!url) throw new Error('missing_image_url')

  let response: Response
  try {
    response = await fetchWithTimeout(url, { method: 'GET', redirect: 'follow' }, 25_000)
  } catch {
    throw new Error('source_image_fetch_failed')
  }
  if (response.status === 404 || response.status === 403 || response.status === 410) {
    throw new Error('source_image_expired')
  }
  if (!response.ok) {
    throw new Error(`source_image_fetch_failed_${response.status}`)
  }

  const buf = await response.arrayBuffer()
  if (buf.byteLength < 64) throw new Error('source_image_empty')
  if (buf.byteLength > MAX_VIDEO_SOURCE_BYTES) throw new Error('source_image_too_large')

  const headerType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  const contentType =
    headerType.startsWith('image/') && !headerType.includes('svg')
      ? headerType
      : url.toLowerCase().includes('.png')
        ? 'image/png'
        : url.toLowerCase().includes('.webp')
          ? 'image/webp'
          : 'image/jpeg'
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  return uploadBytesToReplicate(options.apiToken, buf, contentType, `source.${ext}`)
}

/**
 * 비디오 생성 시작 — Cloudflare 30초 한도에 맞게 길게 기다리지 않는다.
 * 완료되지 않으면 predictionId를 돌려 클라이언트가 폴링한다.
 */
export async function startReplicateVideo(options: {
  apiToken: string
  modelOwner: string
  modelName: string
  modelVersion?: string
  imageUrl: string
  prompt: string
  aspect?: ReplicateVideoAspect
  durationSec?: number
  goFast?: boolean
}): Promise<{
  status: 'succeeded' | 'processing'
  predictionId: string
  videoUrl?: string
  durationSec: number
}> {
  if (!options.apiToken?.trim()) throw new Error('missing_replicate_token')
  if (!options.imageUrl?.trim()) throw new Error('missing_image_url')

  const versionId =
    options.modelVersion?.trim() ||
    (await resolveLatestVersion(options.apiToken, options.modelOwner, options.modelName))

  const { fullInput, minimalInput, approxSec } = buildWanVideoInput(options)

  // Prefer: wait 없이 즉시 접수 — Cloudflare ~30초 한도/502 방지
  let prediction: ReplicatePredictionResponse
  let lastErr: Error | null = null
  try {
    prediction = await createPrediction(options.apiToken, versionId, fullInput, 18_000, {
      waitSec: null,
    })
  } catch (firstErr) {
    lastErr = firstErr instanceof Error ? firstErr : new Error('replicate_video_start_failed')
    try {
      prediction = await createPrediction(options.apiToken, versionId, minimalInput, 18_000, {
        waitSec: null,
      })
      lastErr = null
    } catch (secondErr) {
      const msg =
        (secondErr instanceof Error && secondErr.message) ||
        lastErr?.message ||
        'replicate_video_start_failed'
      throw new Error(msg)
    }
  }

  if (!prediction.id) throw new Error('replicate_missing_prediction_id')

  if (prediction.status === 'failed' || prediction.status === 'canceled') {
    throw new Error(extractReplicateError(prediction) || `replicate_${prediction.status}`)
  }

  if (prediction.status === 'succeeded') {
    const videoUrl = extractVideoUrl(prediction.output)
    if (!videoUrl) throw new Error('replicate_missing_video_url')
    return { status: 'succeeded', predictionId: prediction.id, videoUrl, durationSec: approxSec }
  }

  return { status: 'processing', predictionId: prediction.id, durationSec: approxSec }
}

/** 폴링용 — 한 번만 조회 */
export async function checkReplicateVideo(options: {
  apiToken: string
  predictionId: string
  durationSec?: number
}): Promise<{
  status: 'succeeded' | 'processing' | 'failed'
  videoUrl?: string
  error?: string
  durationSec: number
}> {
  const approxSec = resolveWanI2vDuration(options.durationSec).approxSec
  const prediction = await fetchReplicatePrediction(options.apiToken, options.predictionId)

  if (prediction.status === 'succeeded') {
    const videoUrl = extractVideoUrl(prediction.output)
    if (!videoUrl) {
      return { status: 'failed', error: 'replicate_missing_video_url', durationSec: approxSec }
    }
    return { status: 'succeeded', videoUrl, durationSec: approxSec }
  }
  if (prediction.status === 'failed' || prediction.status === 'canceled') {
    return {
      status: 'failed',
      error: extractReplicateError(prediction) || `replicate_${prediction.status}`,
      durationSec: approxSec,
    }
  }
  return { status: 'processing', durationSec: approxSec }
}

/** @deprecated 동기 대기 — Pages 한도에 걸릴 수 있음. start+check 사용 권장 */
export async function generateReplicateVideo(options: {
  apiToken: string
  modelOwner: string
  modelName: string
  modelVersion?: string
  imageUrl: string
  prompt: string
  aspect?: ReplicateVideoAspect
  durationSec?: number
}): Promise<{ videoUrl: string; durationSec: number }> {
  const started = await startReplicateVideo(options)
  if (started.status === 'succeeded' && started.videoUrl) {
    return { videoUrl: started.videoUrl, durationSec: started.durationSec }
  }
  const startedAt = Date.now()
  const prediction = await pollPrediction(
    options.apiToken,
    started.predictionId,
    startedAt,
    REPLICATE_VIDEO_TIMEOUT_MS,
  )
  const videoUrl = extractVideoUrl(prediction.output)
  if (!videoUrl) throw new Error('replicate_missing_video_url')
  return { videoUrl, durationSec: started.durationSec }
}
