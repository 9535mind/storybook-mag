export type FalImageSize =
  | 'square_hd'
  | 'portrait_4_3'
  | 'landscape_4_3'
  | { width: number; height: number }

/** Pages Function wall-clock 전에 JSON으로 돌아오도록 보조 엔진 예산을 짧게 잡는다. */
const FAL_TIMEOUT_MS = 22_000
/** inpaint는 큐 대기가 길어 짧게 잡으면 이중 모델 폴백으로 서브요청만 소진됨 */
const FAL_REFINE_TIMEOUT_MS = 28_000

type FalQueueSubmitResponse = {
  status_url?: string
  response_url?: string
  detail?: string | Array<{ msg?: string }>
  error?: string
}

type FalQueueStatusResponse = {
  status?: string
  detail?: string | Array<{ msg?: string }>
  error?: string
}

type FalImageResultResponse = {
  images?: Array<{ url?: string }>
  detail?: string | Array<{ msg?: string }>
  error?: string
  has_nsfw_concepts?: boolean[]
}

type FalVideoResultResponse = {
  video?: { url?: string }
  detail?: string | Array<{ msg?: string }>
  error?: string
}

/** ffmpeg 병합 — 쇼츠 두 클립 이어 붙이기 */
export const FAL_VIDEO_MERGE_TIMEOUT_MS = 90_000

function extractErrorMessage(payload: {
  error?: string
  detail?: string | Array<{ msg?: string }>
}): string {
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim()
  if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim()
  if (Array.isArray(payload.detail)) {
    return payload.detail.map((item) => item.msg).filter(Boolean).join('; ')
  }
  return 'fal_generation_failed'
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

/** T는 결과 payload 모양(이미지 생성은 images[], 배경 제거는 image{} 등 모델마다 다름). */
async function pollFalResult<T extends { detail?: string | Array<{ msg?: string }>; error?: string }>(
  falKey: string,
  statusUrl: string,
  responseUrl: string,
  startedAt: number,
  timeoutMs: number,
): Promise<T> {
  const budget = Math.max(timeoutMs, 5_000)
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const elapsed = Date.now() - startedAt
    if (elapsed >= budget) {
      throw new Error('fal_provider_timeout')
    }

    const statusResponse = await fetchWithTimeout(
      statusUrl,
      { method: 'GET', headers: { Authorization: `Key ${falKey}` } },
      budget - elapsed,
    )
    const statusPayload = (await statusResponse.json().catch(() => ({}))) as FalQueueStatusResponse
    if (!statusResponse.ok) {
      throw new Error(extractErrorMessage(statusPayload))
    }

    const status = statusPayload.status?.toUpperCase()
    if (status === 'COMPLETED') {
      const resultResponse = await fetchWithTimeout(
        responseUrl,
        { method: 'GET', headers: { Authorization: `Key ${falKey}` } },
        budget - (Date.now() - startedAt),
      )
      const resultPayload = (await resultResponse.json().catch(() => ({}))) as T
      if (!resultResponse.ok) {
        throw new Error(extractErrorMessage(resultPayload))
      }
      return resultPayload
    }

    if (status === 'FAILED' || status === 'CANCELLED') {
      throw new Error(extractErrorMessage(statusPayload) || `fal_${status.toLowerCase()}`)
    }

    // 500ms 폴링은 Workers 서브요청 한도를 빨리 소진함 → 간격↑
    await sleep(attempt < 6 ? 900 : 1_600)
  }

  throw new Error('fal_provider_timeout')
}

async function runFalQueue(
  falKey: string,
  falModel: string,
  body: Record<string, unknown>,
  timeoutMs: number = FAL_TIMEOUT_MS,
): Promise<{ imageUrl: string }> {
  const startedAt = Date.now()
  const endpoint = `https://queue.fal.run/${falModel}`

  const submitResponse = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    Math.min(timeoutMs, 20_000),
  )

  const submitPayload = (await submitResponse.json().catch(() => ({}))) as FalQueueSubmitResponse
  if (!submitResponse.ok) {
    throw new Error(extractErrorMessage(submitPayload))
  }

  let resultPayload: FalImageResultResponse
  if (submitPayload.status_url && submitPayload.response_url) {
    resultPayload = await pollFalResult<FalImageResultResponse>(
      falKey,
      submitPayload.status_url,
      submitPayload.response_url,
      startedAt,
      timeoutMs,
    )
  } else {
    resultPayload = submitPayload as FalImageResultResponse
  }

  const policyMsg = extractErrorMessage(resultPayload)
  if (/content.?policy|flagged|nsfw|safety/i.test(policyMsg)) {
    throw new Error(policyMsg)
  }

  const imageUrl = resultPayload.images?.[0]?.url?.trim()
  if (!imageUrl) {
    throw new Error(policyMsg !== 'fal_generation_failed' ? policyMsg : 'missing_image_url')
  }
  return { imageUrl }
}

async function runFalQueueVideo(
  falKey: string,
  falModel: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ videoUrl: string }> {
  const startedAt = Date.now()
  const endpoint = `https://queue.fal.run/${falModel}`

  const submitResponse = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    Math.min(timeoutMs, 20_000),
  )

  const submitPayload = (await submitResponse.json().catch(() => ({}))) as FalQueueSubmitResponse
  if (!submitResponse.ok) {
    throw new Error(extractErrorMessage(submitPayload))
  }

  let resultPayload: FalVideoResultResponse
  if (submitPayload.status_url && submitPayload.response_url) {
    resultPayload = await pollFalResult<FalVideoResultResponse>(
      falKey,
      submitPayload.status_url,
      submitPayload.response_url,
      startedAt,
      timeoutMs,
    )
  } else {
    resultPayload = submitPayload as FalVideoResultResponse
  }

  const policyMsg = extractErrorMessage(resultPayload)
  const videoUrl = resultPayload.video?.url?.trim()
  if (!videoUrl) {
    throw new Error(policyMsg !== 'fal_generation_failed' ? policyMsg : 'missing_video_url')
  }
  return { videoUrl }
}

/** 영상 클립 이어 붙이기 (보조). Wan 단일 클립 상한 ≈24초(슬로)일 때 12+12 등에 사용 */
export async function mergeFalVideos(options: {
  falKey: string
  videoUrls: string[]
  timeoutMs?: number
}): Promise<{ videoUrl: string }> {
  const urls = (options.videoUrls || []).map((u) => String(u || '').trim()).filter(Boolean)
  if (urls.length < 2) throw new Error('merge_needs_two_videos')
  return runFalQueueVideo(
    options.falKey,
    'fal-ai/ffmpeg-api/merge-videos',
    { video_urls: urls },
    options.timeoutMs ?? FAL_VIDEO_MERGE_TIMEOUT_MS,
  )
}

/**
 * Flux.2는 negative_prompt를 지원하지 않음.
 * Replicate용 negative를 긍정 제약으로 바꿔 프롬프트에 심는다.
 */
export function bakeConstraintsForFlux(prompt: string, negativePrompt?: string): string {
  const neg = (negativePrompt || '').trim()
  if (!neg && !prompt) return prompt

  const extras: string[] = []
  const src = `${prompt}\n${neg}`

  if (/anthropomorphic|furry|kemono|suited fox|fashion fox|necktie|bowtie|humanoid animal|bipedal/i.test(src)) {
    extras.push(
      'Depict a real wild animal with natural fur and a four-legged body in outdoor nature light.',
      'Show bare animal anatomy only: natural fur, paws, muzzle — wildlife documentary look.',
    )
  }
  if (/two normal eyes|one-eyed|missing one eye|one eye/i.test(src)) {
    extras.push(
      'The animal face must clearly show only one functioning eye (asymmetrical, one eye missing or scarred shut).',
    )
  }
  if (/grape|boutonniere|grapevine/i.test(src)) {
    extras.push(
      'Grapes appear as hanging fruit on a vine or tree in the environment, never as clothing jewelry or a lapel pin.',
    )
  }
  if (/studio void|black background|headshot|portrait crop|fashion magazine/i.test(neg)) {
    extras.push(
      'Full-body or medium-wide environmental wildlife shot with readable outdoor setting and natural ground.',
    )
  }
  // 수정 반복 시 얼굴 하얗게/흑갈색·서양인 치환 — Flux는 negative API가 없어 긍정 제약으로 흡수
  if (
    /same face|IRONCLAD|IDENTITY|Korean|skin tone|body type|pale white|muddy dark|caucasian|different person/i.test(
      src,
    )
  ) {
    extras.push(
      'Keep the exact same East Asian / Korean face and natural warm skin tone from the source photo.',
      'Do not bleach the face pale white, do not darken skin to muddy or blackish brown, do not turn her Caucasian.',
      'Keep the same body type and proportions as the source.',
    )
  }
  if (/nude|bare skin|nipple|pubic|uncensor|나체|유두|음모/i.test(src)) {
    extras.push(
      'If nude: show visible nipples on bare breasts and natural pubic detail (or shaved if requested) — no mosaic, no censor blur, no blank barbie anatomy.',
    )
  }
  if (!extras.length) return prompt

  return `${prompt} CONSTRAINTS (must follow): ${extras.join(' ')}`
}

/** 야생동물·복잡 장면용 여유 타임아웃 (Pages wall-clock 안에서) */
export const FAL_WILDLIFE_TIMEOUT_MS = 45_000

export async function generateFalImage(options: {
  falKey: string
  falModel: string
  prompt: string
  /** Flux는 negative API 없음 — bakeConstraintsForFlux로 프롬프트에 흡수 */
  negativePrompt?: string
  imageSize: FalImageSize
  timeoutMs?: number
}): Promise<{ imageUrl: string }> {
  const prompt = bakeConstraintsForFlux(options.prompt, options.negativePrompt)
  return runFalQueue(
    options.falKey,
    options.falModel,
    {
      prompt,
      image_size: options.imageSize,
      num_images: 1,
      output_format: 'png',
      enable_safety_checker: false,
      safety_tolerance: '6',
    },
    options.timeoutMs ?? FAL_TIMEOUT_MS,
  )
}

const FAL_BACKGROUND_REMOVAL_TIMEOUT_MS = 25_000

type FalBackgroundRemovalResponse = {
  image?: { url?: string }
  detail?: string | Array<{ msg?: string }>
  error?: string
}

/**
 * 배경 제거 — BiRefNet v2(fal.ai). 결과는 투명 배경 PNG 1장.
 * 이미지 생성 모델(images[] 배열)과 출력 스키마가 달라(image{} 단일 객체) runFalQueue를
 * 그대로 못 쓰고 별도로 제출·폴링한다.
 */
export async function removeFalBackground(options: {
  falKey: string
  imageUrl: string
  timeoutMs?: number
}): Promise<{ imageUrl: string }> {
  const startedAt = Date.now()
  const timeoutMs = options.timeoutMs ?? FAL_BACKGROUND_REMOVAL_TIMEOUT_MS
  const endpoint = 'https://queue.fal.run/fal-ai/birefnet/v2'

  const submitResponse = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${options.falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image_url: options.imageUrl, output_format: 'png' }),
    },
    Math.min(timeoutMs, 20_000),
  )
  const submitPayload = (await submitResponse.json().catch(() => ({}))) as FalQueueSubmitResponse
  if (!submitResponse.ok) {
    throw new Error(extractErrorMessage(submitPayload))
  }

  let resultPayload: FalBackgroundRemovalResponse
  if (submitPayload.status_url && submitPayload.response_url) {
    resultPayload = await pollFalResult<FalBackgroundRemovalResponse>(
      options.falKey,
      submitPayload.status_url,
      submitPayload.response_url,
      startedAt,
      timeoutMs,
    )
  } else {
    resultPayload = submitPayload as FalBackgroundRemovalResponse
  }

  const imageUrl = resultPayload.image?.url?.trim()
  if (!imageUrl) {
    throw new Error(extractErrorMessage(resultPayload) || 'missing_image_url')
  }
  return { imageUrl }
}

/** data URI → fal 스토리지 https URL (inpaint 마스크 / 레퍼런스 이미지 업로드 공용). */
/**
 * fal 스토리지 업로드 — 2단계(initiate → PUT) 방식.
 *
 * fal은 예전 단일 단계 `POST /storage/upload`(multipart)를 폐기했다 — 지금은 조용히
 * 404 "Not Found"를 낸다. 새 방식: (1) /storage/upload/initiate 에 content_type·file_name을
 * 보내 서명된 업로드 URL(upload_url)과 최종 접근 URL(file_url)을 발급받고, (2) 그 upload_url에
 * 실제 바이트를 PUT 한다. 최종적으로 model API에는 file_url을 넘긴다.
 */
// fal 계정 기본값은 "영구 보관 + 비인증 URL이면 누구나 접근 가능"이라 업로드마다 만료 기한을
// 명시적으로 박아준다 (개인 사진이 이유 없이 fal 서버에 무기한 남는 걸 막기 위함).
const DEFAULT_UPLOAD_TTL_SECONDS = 30 * 24 * 3600 // 30일 — 편집용 임시 업로드(마스크, 원본 사진 등)

export async function uploadDataUrlToFal(
  falKey: string,
  dataUrl: string,
  fileName: string,
  options: { maxBytes?: number; tooLargeError?: string; lifecycleSeconds?: number | null } = {},
): Promise<string> {
  if (!dataUrl.startsWith('data:')) throw new Error('invalid_data_url')

  // fetch(data:)는 Worker에서 바이트 변환을 맡기므로 수동 atob 루프보다 CPU를 덜 쓴다.
  const blobResponse = await fetch(dataUrl)
  if (!blobResponse.ok) throw new Error('invalid_data_url')
  const blob = await blobResponse.blob()
  const maxBytes = options.maxBytes ?? 1_200_000
  if (blob.size > maxBytes) throw new Error(options.tooLargeError ?? 'mask_too_large')

  const contentType = blob.type || 'application/octet-stream'

  // lifecycleSeconds === null이면 명시적으로 만료 없음(기존 동작), undefined면 기본 30일 적용.
  const ttlSeconds = options.lifecycleSeconds === null ? undefined : (options.lifecycleSeconds ?? DEFAULT_UPLOAD_TTL_SECONDS)
  const lifecycleHeaders: Record<string, string> =
    ttlSeconds !== undefined
      ? { 'X-Fal-Object-Lifecycle': JSON.stringify({ expiration_duration_seconds: ttlSeconds }) }
      : {}

  const initiateResponse = await fetchWithTimeout(
    'https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3',
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
        ...lifecycleHeaders,
      },
      body: JSON.stringify({ content_type: contentType, file_name: fileName }),
    },
    15_000,
  )
  const initiatePayload = (await initiateResponse.json().catch(() => ({}))) as {
    upload_url?: string
    file_url?: string
    detail?: string
  }
  if (!initiateResponse.ok) {
    throw new Error(initiatePayload.detail || 'fal_upload_initiate_failed')
  }
  const uploadUrl = initiatePayload.upload_url?.trim()
  const fileUrl = initiatePayload.file_url?.trim()
  if (!uploadUrl || !fileUrl) throw new Error('fal_upload_missing_url')

  const putResponse = await fetchWithTimeout(
    uploadUrl,
    {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    },
    20_000,
  )
  if (!putResponse.ok) {
    throw new Error('fal_upload_put_failed')
  }

  return fileUrl
}

/** 텍스트 수정(img2img) — 원본을 약하게만 고쳐 인물·구도를 유지한다. */
export async function refineFalImageToImage(options: {
  falKey: string
  imageUrl: string
  prompt: string
  strength?: number
}): Promise<{ imageUrl: string }> {
  const strength = options.strength ?? 0.38
  return runFalQueue(options.falKey, 'fal-ai/flux/dev/image-to-image', {
    prompt: options.prompt,
    image_url: options.imageUrl,
    strength,
    num_inference_steps: 28,
    num_images: 1,
    output_format: 'png',
    enable_safety_checker: false,
  })
}

/** 지시형 이미지 수정 — Flux Kontext (마스크 없이 문장으로 국소·전역 편집).
 *  inpaint/img2img보다 "시계 추가/옷 색 변경"류 지시 추종이 목적에 맞음. */
export const FAL_KONTEXT_EDIT_TIMEOUT_MS = 45_000

export async function refineFalKontextEdit(options: {
  falKey: string
  imageUrl: string
  /** 짧은 영문 수정 지시 */
  prompt: string
  /** pro | max — max는 지시 추종↑·비용↑ */
  tier?: 'pro' | 'max'
  timeoutMs?: number
}): Promise<{ imageUrl: string }> {
  const model =
    options.tier === 'max' ? 'fal-ai/flux-pro/kontext/max' : 'fal-ai/flux-pro/kontext'
  return runFalQueue(
    options.falKey,
    model,
    {
      prompt: options.prompt,
      image_url: options.imageUrl,
      num_images: 1,
      output_format: 'png',
      safety_tolerance: '6',
      guidance_scale: 3.5,
    },
    options.timeoutMs ?? FAL_KONTEXT_EDIT_TIMEOUT_MS,
  )
}

/** 증명사진→허리/전신: 캔버스를 아래로 진짜 확장(얼굴 픽셀 유지). */
export const FAL_OUTPAINT_TIMEOUT_MS = 55_000

export async function outpaintFalImage(options: {
  falKey: string
  imageUrl: string
  expand_top?: number
  expand_bottom?: number
  expand_left?: number
  expand_right?: number
  /** high|fast — Pages 한도 안에서는 fast 권장 */
  mode?: 'high' | 'fast'
}): Promise<{ imageUrl: string }> {
  let imageUrl = options.imageUrl
  if (imageUrl.startsWith('data:')) {
    const ext = imageUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png'
    imageUrl = await uploadDataUrlToFal(options.falKey, imageUrl, `outpaint-src-${Date.now()}.${ext}`)
  }
  const body = {
    image_url: imageUrl,
    expand_top: Math.max(0, Math.min(2048, Math.round(options.expand_top || 0))),
    expand_bottom: Math.max(0, Math.min(2048, Math.round(options.expand_bottom || 0))),
    expand_left: Math.max(0, Math.min(2048, Math.round(options.expand_left || 0))),
    expand_right: Math.max(0, Math.min(2048, Math.round(options.expand_right || 0))),
    mode: options.mode || 'fast',
    output_format: 'png',
  }
  try {
    return await runFalQueue(
      options.falKey,
      'fal-ai/flux-2-pro/outpaint',
      body,
      FAL_OUTPAINT_TIMEOUT_MS,
    )
  } catch (primaryError) {
    // 폴백: 사이드당 700px 제한인 경량 아웃페인트
    const clamp = (n: number) => Math.max(0, Math.min(700, n))
    try {
      return await runFalQueue(
        options.falKey,
        'fal-ai/image-apps-v2/outpaint',
        {
          image_url: imageUrl,
          expand_top: clamp(body.expand_top),
          expand_bottom: clamp(body.expand_bottom),
          expand_left: clamp(body.expand_left),
          expand_right: clamp(body.expand_right),
          output_format: 'png',
        },
        FAL_OUTPAINT_TIMEOUT_MS,
      )
    } catch (fallbackError) {
      const a = primaryError instanceof Error ? primaryError.message : String(primaryError)
      const b = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      throw new Error(`outpaint_failed: ${a} / ${b}`)
    }
  }
}

/** 영역 수정(inpaint) — mask에서 흰 영역만 수정. mask는 data URI 또는 https. */
export async function refineFalInpaint(options: {
  falKey: string
  imageUrl: string
  maskUrl: string
  prompt: string
  /** Flux inpaint도 negative API 없음 — bakeConstraintsForFlux로 프롬프트에 흡수해서라도
   * 최소한의 억제 신호를 준다. 안 넘기면 예전처럼 순수 긍정 프롬프트만 사용. */
  negativePrompt?: string
  /** 기본 0.85. 장신구처럼 작은 추가는 낮출수록 마스크·건물 발명이 줄어듦(실측). */
  strength?: number
}): Promise<{ imageUrl: string }> {
  let maskUrl = options.maskUrl
  if (maskUrl.startsWith('data:')) {
    const ext = maskUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png'
    maskUrl = await uploadDataUrlToFal(options.falKey, maskUrl, `mask-${Date.now()}.${ext}`)
  }
  const prompt = bakeConstraintsForFlux(options.prompt, options.negativePrompt)
  const strength =
    typeof options.strength === 'number' && Number.isFinite(options.strength)
      ? Math.min(0.95, Math.max(0.35, options.strength))
      : 0.85

  // lora 우선. 타임아웃이면 2차 모델도 같은 대기로 실패하고 서브요청만 태움 → 스킵
  const models = ['fal-ai/flux-lora/inpainting', 'fal-ai/flux-general/inpainting'] as const
  const errors: string[] = []
  for (let i = 0; i < models.length; i += 1) {
    const model = models[i]
    try {
      return await runFalQueue(
        options.falKey,
        model,
        {
          prompt,
          image_url: options.imageUrl,
          mask_url: maskUrl,
          strength,
          num_images: 1,
          output_format: 'png',
          enable_safety_checker: false,
        },
        FAL_REFINE_TIMEOUT_MS,
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'failed'
      errors.push(`${model}: ${msg}`)
      if (/fal_provider_timeout|Too many subrequests/i.test(msg)) break
    }
  }
  throw new Error(errors.join(' / ') || 'fal_inpaint_failed')
}

/**
 * 레퍼런스 이미지 여러 장 + 텍스트로 "같은 캐릭터/화풍의 새 장면"을 생성.
 * (동화 삽화 이어그리기 — 완전히 새로운 장면을 그리되 참고 이미지의 캐릭터·스타일을 최대한 유지)
 */
export async function generateFalKontextMultiImage(options: {
  falKey: string
  imageUrls: string[]
  prompt: string
  aspectRatio?: string
  timeoutMs?: number
  /** 기본 3.5. 두 사람 합성처럼 "누구를 빼먹지 말라"는 지시를 강하게 지켜야 할 때 5~7로 올리면
   * 프롬프트 순응도가 높아진다(실측: 기본값에서 두 번째 인물이 무시되는 사고 발생). */
  guidanceScale?: number
}): Promise<{ imageUrl: string }> {
  return runFalQueue(
    options.falKey,
    'fal-ai/flux-pro/kontext/multi',
    {
      prompt: options.prompt,
      image_urls: options.imageUrls,
      num_images: 1,
      output_format: 'png',
      safety_tolerance: '6',
      ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
      ...(typeof options.guidanceScale === 'number' ? { guidance_scale: options.guidanceScale } : {}),
    },
    options.timeoutMs ?? FAL_WILDLIFE_TIMEOUT_MS,
  )
}

function buildKontextMultiBody(options: {
  imageUrls: string[]
  prompt: string
  aspectRatio?: string
  guidanceScale?: number
}): Record<string, unknown> {
  return {
    prompt: options.prompt,
    image_urls: options.imageUrls,
    num_images: 1,
    output_format: 'png',
    safety_tolerance: '6',
    ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
    ...(typeof options.guidanceScale === 'number' ? { guidance_scale: options.guidanceScale } : {}),
  }
}

/**
 * 증명사진→전신 장면(Kontext Multi)도 얼굴교체와 같이 45초를 넘기는 경우가 있어
 * 동기 대기는 Pages 한도에 걸린다 — submit만 하고 클라이언트가 status를 폴링한다.
 */
export async function submitFalKontextMultiImage(options: {
  falKey: string
  imageUrls: string[]
  prompt: string
  aspectRatio?: string
  guidanceScale?: number
}): Promise<{ statusUrl: string; responseUrl: string } | { imageUrl: string }> {
  const endpoint = 'https://queue.fal.run/fal-ai/flux-pro/kontext/multi'
  const submitResponse = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${options.falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildKontextMultiBody(options)),
    },
    20_000,
  )
  const submitPayload = (await submitResponse.json().catch(() => ({}))) as FalQueueSubmitResponse &
    FalImageResultResponse
  if (!submitResponse.ok) {
    throw new Error(extractErrorMessage(submitPayload))
  }
  if (submitPayload.status_url && submitPayload.response_url) {
    return { statusUrl: submitPayload.status_url, responseUrl: submitPayload.response_url }
  }
  const imageUrl = submitPayload.images?.[0]?.url?.trim()
  if (!imageUrl) {
    throw new Error(extractErrorMessage(submitPayload) || 'missing_image_url')
  }
  return { imageUrl }
}

export async function checkFalKontextMultiImage(options: {
  falKey: string
  statusUrl: string
  responseUrl: string
}): Promise<{
  status: 'pending' | 'succeeded' | 'failed'
  imageUrl?: string
  error?: string
  nsfwFlagged?: boolean
}> {
  const statusResponse = await fetchWithTimeout(
    options.statusUrl,
    { method: 'GET', headers: { Authorization: `Key ${options.falKey}` } },
    15_000,
  )
  const statusPayload = (await statusResponse.json().catch(() => ({}))) as FalQueueStatusResponse
  if (!statusResponse.ok) {
    return { status: 'failed', error: extractErrorMessage(statusPayload) }
  }

  const status = statusPayload.status?.toUpperCase()
  if (status === 'FAILED' || status === 'CANCELLED') {
    return { status: 'failed', error: extractErrorMessage(statusPayload) || `fal_${status.toLowerCase()}` }
  }
  if (status !== 'COMPLETED') {
    return { status: 'pending' }
  }

  const resultResponse = await fetchWithTimeout(
    options.responseUrl,
    { method: 'GET', headers: { Authorization: `Key ${options.falKey}` } },
    15_000,
  )
  const resultPayload = (await resultResponse.json().catch(() => ({}))) as FalImageResultResponse
  if (!resultResponse.ok) {
    return { status: 'failed', error: extractErrorMessage(resultPayload) }
  }
  const policyMsg = extractErrorMessage(resultPayload)
  if (/content.?policy|flagged|nsfw|safety/i.test(policyMsg)) {
    return { status: 'failed', error: policyMsg }
  }
  const imageUrl = resultPayload.images?.[0]?.url?.trim()
  if (!imageUrl) {
    return { status: 'failed', error: policyMsg !== 'fal_generation_failed' ? policyMsg : 'missing_image_url' }
  }
  // 성인 전용: has_nsfw_concepts만으로 실패 처리하지 않음(오탐·정상 NSFW 모두 이미지 반환)
  const nsfwFlagged =
    Array.isArray(resultPayload.has_nsfw_concepts) && resultPayload.has_nsfw_concepts.some(Boolean)
  return { status: 'succeeded', imageUrl, nsfwFlagged }
}

// 얼굴 1장 교체는 대개 30~40초면 끝나지만, 2인 동시 교체는 60~90초 이상 걸리는 사례가
// 실측됨 — 45초로는 완료 전에 우리 쪽 폴링이 fal_provider_timeout을 던져버림.
// merge-videos(90초)와 동일하게, Pages Function은 클라이언트가 붙어있는 동안
// CPU 아닌 대기(fetch/sleep)는 30초 한도에 걸리지 않으므로 넉넉히 잡아도 안전하다.
const FAL_FACE_SWAP_TIMEOUT_MS = 60_000
const FAL_FACE_SWAP_TWO_FACE_TIMEOUT_MS = 110_000

type FalFaceSwapResponse = {
  image?: { url?: string }
  images?: Array<{ url?: string }>
  detail?: string | Array<{ msg?: string }>
  error?: string
}

function extractFaceSwapImageUrl(payload: FalFaceSwapResponse): string | null {
  const direct = payload.image?.url?.trim()
  if (direct) return direct
  const fromList = payload.images?.[0]?.url?.trim()
  return fromList || null
}

export type FaceSwapGender = 'male' | 'female' | 'non-binary'

/** insight | easel | replicate | indexed(좌우 인덱스) */
export type FaceSwapEngine = 'insight' | 'easel' | 'replicate' | 'indexed'

/**
 * InsightFace 계열 1인 얼굴 교체 — fal-ai/face-swap.
 * easel(구형 H100 큐)보다 대기열이 짧고, 증명사진→장면 닮음이 실무에서 더 안정적인 경우가 많다.
 */
export async function submitInsightFaceSwap(options: {
  falKey: string
  targetImageUrl: string
  faceImageUrl: string
}): Promise<{ statusUrl: string; responseUrl: string } | { imageUrl: string }> {
  const endpoint = 'https://queue.fal.run/fal-ai/face-swap'
  const body = {
    base_image_url: options.targetImageUrl,
    swap_image_url: options.faceImageUrl,
  }

  const submitResponse = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${options.falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    20_000,
  )
  const submitPayload = (await submitResponse.json().catch(() => ({}))) as FalQueueSubmitResponse &
    FalFaceSwapResponse
  if (!submitResponse.ok) {
    throw new Error(extractErrorMessage(submitPayload))
  }

  if (submitPayload.status_url && submitPayload.response_url) {
    return { statusUrl: submitPayload.status_url, responseUrl: submitPayload.response_url }
  }
  const imageUrl = extractFaceSwapImageUrl(submitPayload)
  if (!imageUrl) {
    throw new Error(extractErrorMessage(submitPayload) || 'missing_image_url')
  }
  return { imageUrl }
}

/**
 * 원클릭 얼굴 교체 — easel-ai/advanced-face-swap (fal.ai).
 * 올가미로 자르고/지우고/맞추는 admin-fuse 수동 합성을 대신해, 얼굴 사진(1~2장) +
 * 대상 사진만 넣으면 배경·포즈·조명을 그대로 유지한 채 얼굴만 자동으로 바꿔준다.
 * 출력 스키마가 image{}(단일 객체)라 runFalQueue(images[] 전용)를 그대로 못 쓴다
 * (removeFalBackground와 동일한 이유).
 */
export async function runAdvancedFaceSwap(options: {
  falKey: string
  targetImageUrl: string
  face0ImageUrl: string
  gender0: FaceSwapGender
  face1ImageUrl?: string
  gender1?: FaceSwapGender
  /** user_hair = 얼굴 사진 쪽 헤어스타일 유지 · target_hair = 대상 사진 헤어스타일 유지 */
  workflowType?: 'user_hair' | 'target_hair'
  upscale?: boolean
  timeoutMs?: number
}): Promise<{ imageUrl: string }> {
  const startedAt = Date.now()
  const hasSecondFace = Boolean(options.face1ImageUrl && options.gender1)
  const timeoutMs =
    options.timeoutMs ?? (hasSecondFace ? FAL_FACE_SWAP_TWO_FACE_TIMEOUT_MS : FAL_FACE_SWAP_TIMEOUT_MS)
  const endpoint = 'https://queue.fal.run/easel-ai/advanced-face-swap'

  const body: Record<string, unknown> = {
    face_image_0: options.face0ImageUrl,
    gender_0: options.gender0,
    target_image: options.targetImageUrl,
    workflow_type: options.workflowType ?? 'target_hair',
    // 기본 on — 닮음·피부톤 보존에 유리 (호출측에서 false로 끌 수 있음)
    upscale: options.upscale !== false,
    detailer: true,
  }
  if (hasSecondFace) {
    body.face_image_1 = options.face1ImageUrl
    body.gender_1 = options.gender1
  }

  const submitResponse = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${options.falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    Math.min(timeoutMs, 20_000),
  )
  const submitPayload = (await submitResponse.json().catch(() => ({}))) as FalQueueSubmitResponse
  if (!submitResponse.ok) {
    throw new Error(extractErrorMessage(submitPayload))
  }

  let resultPayload: FalFaceSwapResponse
  if (submitPayload.status_url && submitPayload.response_url) {
    resultPayload = await pollFalResult<FalFaceSwapResponse>(
      options.falKey,
      submitPayload.status_url,
      submitPayload.response_url,
      startedAt,
      timeoutMs,
    )
  } else {
    resultPayload = submitPayload as FalFaceSwapResponse
  }

  const imageUrl = extractFaceSwapImageUrl(resultPayload)
  if (!imageUrl) {
    throw new Error(extractErrorMessage(resultPayload) || 'missing_image_url')
  }
  return { imageUrl }
}

/**
 * 얼굴 2장(특히 두 명 동시 교체)은 fal 큐 처리가 45초를 넘기는 경우가 실측됐고,
 * 이 함수가 끝날 때까지 기다리는 동기 방식은 Pages Function의 벽시계 한도에 걸려
 * fal_provider_timeout으로 실패한다 — submit만 하고 status_url/response_url을
 * 클라이언트에 돌려준 뒤, /api/face-swap-status가 짧게 한 번씩 조회하는 비동기
 * 폴링 패턴(animate.ts/animate-status.ts와 동일한 이유)으로 바꾼다.
 */
export async function submitAdvancedFaceSwap(options: {
  falKey: string
  targetImageUrl: string
  face0ImageUrl: string
  gender0: FaceSwapGender
  face1ImageUrl?: string
  gender1?: FaceSwapGender
  workflowType?: 'user_hair' | 'target_hair'
  upscale?: boolean
}): Promise<{ statusUrl: string; responseUrl: string } | { imageUrl: string }> {
  const endpoint = 'https://queue.fal.run/easel-ai/advanced-face-swap'

  const body: Record<string, unknown> = {
    face_image_0: options.face0ImageUrl,
    gender_0: options.gender0,
    target_image: options.targetImageUrl,
    workflow_type: options.workflowType ?? 'target_hair',
    upscale: options.upscale !== false,
    detailer: true,
  }
  if (options.face1ImageUrl && options.gender1) {
    body.face_image_1 = options.face1ImageUrl
    body.gender_1 = options.gender1
  }

  const submitResponse = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${options.falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    20_000,
  )
  const submitPayload = (await submitResponse.json().catch(() => ({}))) as FalQueueSubmitResponse &
    FalFaceSwapResponse
  if (!submitResponse.ok) {
    throw new Error(extractErrorMessage(submitPayload))
  }

  if (submitPayload.status_url && submitPayload.response_url) {
    return { statusUrl: submitPayload.status_url, responseUrl: submitPayload.response_url }
  }
  const imageUrl = extractFaceSwapImageUrl(submitPayload)
  if (!imageUrl) {
    throw new Error(extractErrorMessage(submitPayload) || 'missing_image_url')
  }
  return { imageUrl }
}

/** 엔진 선택 후 submit — status 폴링은 checkAdvancedFaceSwap 공통. fal 엔진만. */
export async function submitFaceSwapJob(options: {
  falKey: string
  engine: 'insight' | 'easel'
  targetImageUrl: string
  face0ImageUrl: string
  gender0: FaceSwapGender
  face1ImageUrl?: string
  gender1?: FaceSwapGender
  workflowType?: 'user_hair' | 'target_hair'
  upscale?: boolean
}): Promise<
  | { statusUrl: string; responseUrl: string; engine: 'insight' | 'easel' }
  | { imageUrl: string; engine: 'insight' | 'easel' }
> {
  if (options.engine === 'insight') {
    const submitted = await submitInsightFaceSwap({
      falKey: options.falKey,
      targetImageUrl: options.targetImageUrl,
      faceImageUrl: options.face0ImageUrl,
    })
    return { ...submitted, engine: 'insight' }
  }
  const submitted = await submitAdvancedFaceSwap({
    falKey: options.falKey,
    targetImageUrl: options.targetImageUrl,
    face0ImageUrl: options.face0ImageUrl,
    gender0: options.gender0,
    face1ImageUrl: options.face1ImageUrl,
    gender1: options.gender1,
    workflowType: options.workflowType,
    upscale: options.upscale,
  })
  return { ...submitted, engine: 'easel' }
}

/** fal-ai/face-swap은 얼굴 미검출 시 원본 URL/바이트를 그대로 돌려줌 — 무변경 “가짜 성공” 차단. */
export async function isUnchangedFaceSwapResult(
  resultUrl: string,
  baseImageUrl: string,
): Promise<boolean> {
  const a = resultUrl.trim()
  const b = baseImageUrl.trim()
  if (!a || !b) return false
  if (a === b) return true
  try {
    const [ra, rb] = await Promise.all([
      fetchWithTimeout(a, { method: 'GET' }, 12_000),
      fetchWithTimeout(b, { method: 'GET' }, 12_000),
    ])
    if (!ra.ok || !rb.ok) return false
    const [ba, bb] = await Promise.all([ra.arrayBuffer(), rb.arrayBuffer()])
    if (ba.byteLength < 64 || bb.byteLength < 64) return false
    if (ba.byteLength === bb.byteLength) {
      const ha = await crypto.subtle.digest('SHA-256', ba)
      const hb = await crypto.subtle.digest('SHA-256', bb)
      const ua = new Uint8Array(ha)
      const ub = new Uint8Array(hb)
      if (ua.length === ub.length && ua.every((v, i) => v === ub[i])) return true
    }
    // 동일 파일이 재인코딩되면 해시가 달라질 수 있어, 앞부분+크기가 거의 같으면 무변경으로 본다.
    const sizeRatio = Math.min(ba.byteLength, bb.byteLength) / Math.max(ba.byteLength, bb.byteLength)
    if (sizeRatio < 0.98) return false
    const sample = Math.min(4096, ba.byteLength, bb.byteLength)
    const sa = new Uint8Array(ba, 0, sample)
    const sb = new Uint8Array(bb, 0, sample)
    let same = 0
    for (let i = 0; i < sample; i += 1) if (sa[i] === sb[i]) same += 1
    return same / sample > 0.995
  } catch {
    return false
  }
}

/** 위 submit이 돌려준 status_url/response_url을 한 번만 조회 — 짧은 폴링 루프는 호출부(status 엔드포인트)가 맡는다. */
export async function checkAdvancedFaceSwap(options: {
  falKey: string
  statusUrl: string
  responseUrl: string
}): Promise<{
  status: 'pending' | 'succeeded' | 'failed'
  imageUrl?: string
  error?: string
  falStatus?: string
}> {
  const statusResponse = await fetchWithTimeout(
    options.statusUrl,
    { method: 'GET', headers: { Authorization: `Key ${options.falKey}` } },
    15_000,
  )
  const statusPayload = (await statusResponse.json().catch(() => ({}))) as FalQueueStatusResponse
  if (!statusResponse.ok) {
    return {
      status: 'failed',
      error: extractErrorMessage(statusPayload),
      falStatus: statusPayload.status,
    }
  }

  const falStatus = String(statusPayload.status || '').trim()
  const status = falStatus.toUpperCase()
  if (status === 'FAILED' || status === 'CANCELLED') {
    return {
      status: 'failed',
      error: extractErrorMessage(statusPayload) || `fal_${status.toLowerCase()}`,
      falStatus,
    }
  }
  // IN_QUEUE / IN_PROGRESS / 빈 값 — 아직 결과 없음
  if (status !== 'COMPLETED') {
    return { status: 'pending', falStatus: falStatus || 'WAITING' }
  }

  const resultResponse = await fetchWithTimeout(
    options.responseUrl,
    { method: 'GET', headers: { Authorization: `Key ${options.falKey}` } },
    15_000,
  )
  const resultPayload = (await resultResponse.json().catch(() => ({}))) as FalFaceSwapResponse
  if (!resultResponse.ok) {
    return {
      status: 'failed',
      error: extractErrorMessage(resultPayload),
      falStatus: 'COMPLETED',
    }
  }
  const imageUrl = extractFaceSwapImageUrl(resultPayload)
  if (!imageUrl) {
    // 스키마가 image{} / images[] 둘 다 아닐 때 — 응답 키를 남겨 디버깅
    const keys = Object.keys(resultPayload || {}).slice(0, 12).join(',')
    return {
      status: 'failed',
      error: extractErrorMessage(resultPayload) || `missing_image_url${keys ? `:${keys}` : ''}`,
      falStatus: 'COMPLETED',
    }
  }
  return { status: 'succeeded', imageUrl, falStatus: 'COMPLETED' }
}

export function resolveFalImageSize(size: string | undefined): FalImageSize {
  if (size === 'portrait') return 'portrait_4_3' // 화보 세로에 가까운 preset
  if (size === 'story') return { width: 768, height: 1344 } // 9:16 Shorts
  if (size === 'landscape') return 'landscape_4_3'
  return 'square_hd'
}
