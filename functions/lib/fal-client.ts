export type FalImageSize =
  | 'square_hd'
  | 'portrait_4_3'
  | 'landscape_4_3'
  | { width: number; height: number }

/** Pages Function wall-clock 전에 JSON으로 돌아오도록 보조 엔진 예산을 짧게 잡는다. */
const FAL_TIMEOUT_MS = 22_000
const FAL_REFINE_TIMEOUT_MS = 18_000

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
}

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

async function pollFalResult(
  falKey: string,
  statusUrl: string,
  responseUrl: string,
  startedAt: number,
  timeoutMs: number,
): Promise<FalImageResultResponse> {
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
      const resultPayload = (await resultResponse.json().catch(() => ({}))) as FalImageResultResponse
      if (!resultResponse.ok) {
        throw new Error(extractErrorMessage(resultPayload))
      }
      return resultPayload
    }

    if (status === 'FAILED' || status === 'CANCELLED') {
      throw new Error(extractErrorMessage(statusPayload) || `fal_${status.toLowerCase()}`)
    }

    await sleep(attempt < 10 ? 500 : 1_000)
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
    resultPayload = await pollFalResult(
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
      safety_tolerance: '5',
    },
    options.timeoutMs ?? FAL_TIMEOUT_MS,
  )
}

/** data URI → fal 스토리지 https URL (inpaint 마스크 / 레퍼런스 이미지 업로드 공용). */
export async function uploadDataUrlToFal(
  falKey: string,
  dataUrl: string,
  fileName: string,
  options: { maxBytes?: number; tooLargeError?: string } = {},
): Promise<string> {
  if (!dataUrl.startsWith('data:')) throw new Error('invalid_data_url')

  // fetch(data:)는 Worker에서 바이트 변환을 맡기므로 수동 atob 루프보다 CPU를 덜 쓴다.
  const blobResponse = await fetch(dataUrl)
  if (!blobResponse.ok) throw new Error('invalid_data_url')
  const blob = await blobResponse.blob()
  const maxBytes = options.maxBytes ?? 1_200_000
  if (blob.size > maxBytes) throw new Error(options.tooLargeError ?? 'mask_too_large')

  const form = new FormData()
  form.append('file', blob, fileName)

  const response = await fetchWithTimeout(
    'https://rest.alpha.fal.ai/storage/upload',
    {
      method: 'POST',
      headers: { Authorization: `Key ${falKey}` },
      body: form,
    },
    20_000,
  )
  const payload = (await response.json().catch(() => ({}))) as { url?: string; file_url?: string; detail?: string }
  if (!response.ok) {
    throw new Error(payload.detail || 'fal_upload_failed')
  }
  const url = (payload.url || payload.file_url || '').trim()
  if (!url) throw new Error('fal_upload_missing_url')
  return url
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

/** 영역 수정(inpaint) — mask에서 흰 영역만 수정. mask는 data URI 또는 https. */
export async function refineFalInpaint(options: {
  falKey: string
  imageUrl: string
  maskUrl: string
  prompt: string
}): Promise<{ imageUrl: string }> {
  let maskUrl = options.maskUrl
  if (maskUrl.startsWith('data:')) {
    const ext = maskUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png'
    maskUrl = await uploadDataUrlToFal(options.falKey, maskUrl, `mask-${Date.now()}.${ext}`)
  }

  // 빠른 lora inpaint 우선 (fill은 성인 화보에서 검은 화면을 자주 냄)
  const models = ['fal-ai/flux-lora/inpainting', 'fal-ai/flux-general/inpainting'] as const
  const errors: string[] = []
  for (const model of models) {
    try {
      return await runFalQueue(
        options.falKey,
        model,
        {
          prompt: options.prompt,
          image_url: options.imageUrl,
          mask_url: maskUrl,
          strength: 0.85,
          num_images: 1,
          output_format: 'png',
          enable_safety_checker: false,
        },
        FAL_REFINE_TIMEOUT_MS,
      )
    } catch (error) {
      errors.push(`${model}: ${error instanceof Error ? error.message : 'failed'}`)
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
}): Promise<{ imageUrl: string }> {
  return runFalQueue(
    options.falKey,
    'fal-ai/flux-pro/kontext/multi',
    {
      prompt: options.prompt,
      image_urls: options.imageUrls,
      num_images: 1,
      output_format: 'png',
      safety_tolerance: '5',
      ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
    },
    options.timeoutMs ?? FAL_WILDLIFE_TIMEOUT_MS,
  )
}

export function resolveFalImageSize(size: string | undefined): FalImageSize {
  if (size === 'portrait') return 'portrait_4_3' // 화보 세로에 가까운 preset
  if (size === 'story') return { width: 768, height: 1344 } // 9:16 Shorts
  if (size === 'landscape') return 'landscape_4_3'
  return 'square_hd'
}
