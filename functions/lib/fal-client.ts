import {
  buildStillNudeAdultPubicLine,
  buildStillNudeAdultBustLine,
  buildStillWomanNudeNoPantyLock,
} from './nude-anatomy-locks'
import { buildSplitHandsLockLine } from './kiss-touch-motion'

export type FalImageSize =
  | 'square_hd'
  | 'square'
  | 'portrait_4_3'
  | 'portrait_16_9'
  | 'landscape_4_3'
  | 'landscape_16_9'
  | { width: number; height: number }

/** Pages Function wall-clock 전에 JSON으로 돌아오도록 보조 엔진 예산을 짧게 잡는다. */
const FAL_TIMEOUT_MS = 22_000
/** inpaint는 큐 대기가 길어 짧게 잡으면 이중 모델 폴백으로 서브요청만 소진됨 */
const FAL_REFINE_TIMEOUT_MS = 28_000

/**
 * Flux 2 Pro는 safety_tolerance가 1–5만 허용(5=가장 느슨).
 * Flux.1 Pro / Kontext는 1–6. 잘못된 '6'을 Flux 2에 보내면
 * "Input should be '1', '2', '3', '4' or '5'" 로 거절된다.
 */
function falSafetyTolerance(modelId?: string): '5' | '6' {
  const id = (modelId || '').toLowerCase()
  // Flux.1 Kontext / flux-pro 는 1–6. 그 외(기본 Flux 2 Pro)는 1–5만.
  if (id.includes('kontext') || (id.includes('flux-pro') && !id.includes('flux-2'))) return '6'
  return '5'
}

/** Flux 2 Pro는 enum 크기만 받음. {width,height} 커스텀은 거절될 수 있음. */
function flux2SafeImageSize(size: FalImageSize): FalImageSize {
  if (typeof size === 'string') {
    if (
      size === 'square_hd' ||
      size === 'square' ||
      size === 'portrait_4_3' ||
      size === 'portrait_16_9' ||
      size === 'landscape_4_3' ||
      size === 'landscape_16_9'
    ) {
      return size
    }
    return 'portrait_16_9'
  }
  const r = size.width / Math.max(1, size.height)
  if (r < 0.7) return 'portrait_16_9'
  if (r > 1.4) return 'landscape_16_9'
  if (r > 1.05) return 'landscape_4_3'
  if (r < 0.95) return 'portrait_4_3'
  return 'square_hd'
}

function isFlux2Model(modelId?: string): boolean {
  const id = (modelId || '').toLowerCase()
  return id.includes('flux-2') || id.includes('flux/2')
}

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
  image?: { url?: string }
  images?: Array<{ url?: string }>
  detail?: string | Array<{ msg?: string }>
  error?: string
  has_nsfw_concepts?: boolean[]
}

type FalVideoResultResponse = {
  video?: { url?: string }
  video_url?: string
  detail?: string | Array<{ msg?: string }>
  error?: string
}

/** ffmpeg 병합 — 쇼츠 두 클립 이어 붙이기 */
export const FAL_VIDEO_MERGE_TIMEOUT_MS = 90_000
const FAL_TTS_TIMEOUT_MS = 28_000

type FalAudioResultResponse = {
  audio?: { url?: string }
  audio_url?: string | { url?: string }
  custom_voice_id?: string
  detail?: string | Array<{ msg?: string }>
  error?: string
}

async function runFalQueueAudio(
  falKey: string,
  falModel: string,
  body: Record<string, unknown>,
  timeoutMs: number = FAL_TTS_TIMEOUT_MS,
): Promise<{ audioUrl: string }> {
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
  if (!submitResponse.ok) throw new Error(extractErrorMessage(submitPayload))
  let resultPayload: FalAudioResultResponse
  if (submitPayload.status_url && submitPayload.response_url) {
    resultPayload = await pollFalResult<FalAudioResultResponse>(
      falKey,
      submitPayload.status_url,
      submitPayload.response_url,
      startedAt,
      timeoutMs,
    )
  } else {
    resultPayload = submitPayload as FalAudioResultResponse
  }
  const audioUrl =
    resultPayload.audio?.url?.trim() ||
    (typeof resultPayload.audio_url === 'string'
      ? resultPayload.audio_url.trim()
      : resultPayload.audio_url?.url?.trim()) ||
    ''
  if (!audioUrl) throw new Error(extractErrorMessage(resultPayload) || 'missing_audio_url')
  return { audioUrl }
}

/** 한국어 대사 TTS. 영상 엔진(Wan)은 건드리지 않는다. */
export async function synthesizeFalSpeech(options: {
  falKey: string
  text: string
  voiceId?: string
}): Promise<{ audioUrl: string; voiceId: string }> {
  const text = String(options.text || '').trim()
  if (!text) throw new Error('speech_text_required')
  const voiceId = String(options.voiceId || '').trim() || 'Wise_Woman'
  const body = {
    text,
    voice_setting: { voice_id: voiceId, speed: 1, vol: 1, pitch: 0 },
    language_boost: 'Korean',
  }
  try {
    const out = await runFalQueueAudio(options.falKey, 'fal-ai/minimax/preview/speech-2.6-turbo', body)
    return { ...out, voiceId }
  } catch {
    const out = await runFalQueueAudio(options.falKey, 'fal-ai/minimax/speech-02-hd', body)
    return { ...out, voiceId }
  }
}

/** 올린 목소리 샘플을 기준으로 대사를 읽는다. MiniMax 기계음보다 원본 톤에 가깝다. */
export async function synthesizeFalSpeechFromSample(options: {
  falKey: string
  text: string
  audioDataUrl: string
}): Promise<{ audioUrl: string; voiceId?: string }> {
  const text = String(options.text || '').trim()
  if (!text) throw new Error('speech_text_required')
  const refUrl = await uploadDataUrlToFal(options.falKey, options.audioDataUrl, 'voice-ref.wav', {
    maxBytes: 10_000_000,
    tooLargeError: 'voice_sample_too_large',
  })
  try {
    return await runFalQueueAudio(options.falKey, 'fal-ai/f5-tts', {
      gen_text: text,
      ref_audio_url: refUrl,
      model_type: 'F5-TTS',
      remove_silence: true,
    })
  } catch {
    /* F5가 거절하면 다음 엔진 */
  }
  try {
    return await runFalQueueAudio(options.falKey, 'fal-ai/chatterbox/text-to-speech', {
      text,
      audio_url: refUrl,
      exaggeration: 0.2,
      temperature: 0.5,
      cfg: 0.4,
    })
  } catch {
    /* Chatterbox 실패 시 MiniMax */
  }
  const endpoint = 'https://queue.fal.run/fal-ai/minimax/voice-clone'
  const startedAt = Date.now()
  const submitResponse = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${options.falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: refUrl,
        text,
        model: 'speech-02-hd',
        noise_reduction: true,
        need_volume_normalization: true,
      }),
    },
    20_000,
  )
  const submitPayload = (await submitResponse.json().catch(() => ({}))) as FalQueueSubmitResponse
  if (!submitResponse.ok) throw new Error(extractErrorMessage(submitPayload))
  const resultPayload = submitPayload.status_url && submitPayload.response_url
    ? await pollFalResult<FalAudioResultResponse>(
        options.falKey,
        submitPayload.status_url,
        submitPayload.response_url,
        startedAt,
        FAL_TTS_TIMEOUT_MS,
      )
    : (submitPayload as FalAudioResultResponse)
  const previewUrl =
    resultPayload.audio?.url?.trim() ||
    (typeof resultPayload.audio_url === 'string'
      ? resultPayload.audio_url.trim()
      : resultPayload.audio_url?.url?.trim()) ||
    ''
  const voiceId = String(resultPayload.custom_voice_id || '').trim()
  if (previewUrl) return { audioUrl: previewUrl, voiceId: voiceId || undefined }
  if (!voiceId) throw new Error(extractErrorMessage(resultPayload) || 'voice_clone_failed')
  return synthesizeFalSpeech({ falKey: options.falKey, text, voiceId })
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

function firstFalImageUrl(payload: { image?: { url?: string }; images?: Array<{ url?: string }> }): string {
  return payload.image?.url?.trim() || payload.images?.[0]?.url?.trim() || ''
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
  const videoUrl = resultPayload.video?.url?.trim() || resultPayload.video_url?.trim()
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
  if (/nude|bare skin|nipple|pubic|uncensor|나체|유두|음모|bare crotch|fully nude/i.test(src)) {
    const noPanty = buildStillWomanNudeNoPantyLock(src)
    extras.push(
      noPanty ||
        'If nude: visible adult nipples on bare breasts — no mosaic, no censor blur.',
      noPanty ? '' : buildStillNudeAdultBustLine(src),
      noPanty ? '' : buildStillNudeAdultPubicLine(src),
      buildSplitHandsLockLine(src),
    )
  }
  if (!extras.length) return prompt

  return `${prompt} CONSTRAINTS (must follow): ${extras.filter(Boolean).join(' ')}`
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
  const imageSize = isFlux2Model(options.falModel)
    ? flux2SafeImageSize(options.imageSize)
    : options.imageSize
  return runFalQueue(
    options.falKey,
    options.falModel,
    {
      prompt,
      image_size: imageSize,
      num_images: 1,
      output_format: 'png',
      enable_safety_checker: false,
      safety_tolerance: falSafetyTolerance(options.falModel),
    },
    options.timeoutMs ?? FAL_TIMEOUT_MS,
  )
}

const FAL_BACKGROUND_REMOVAL_TIMEOUT_MS = 25_000
const FAL_UPSCALE_TIMEOUT_MS = 90_000

type FalUpscaleResponse = {
  image?: { url?: string; width?: number; height?: number }
  detail?: string | Array<{ msg?: string }>
  error?: string
}

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

/**
 * 화질 올리기 — Real-ESRGAN(fal.ai, fal-ai/esrgan). 얼굴 복원은 하지 않는다(얼굴이 달라지지 않게 face:false).
 * 결과는 scale 배 큰 PNG 1장. 출력 스키마가 image{} 단일 객체라 removeFalBackground 와 같은 방식으로 제출·폴링한다.
 */
export async function upscaleFalImage(options: {
  falKey: string
  imageUrl: string
  scale?: number
  timeoutMs?: number
}): Promise<{ imageUrl: string; width?: number; height?: number }> {
  const startedAt = Date.now()
  const timeoutMs = options.timeoutMs ?? FAL_UPSCALE_TIMEOUT_MS
  const endpoint = 'https://queue.fal.run/fal-ai/esrgan'
  const scale = options.scale && options.scale > 1 && options.scale <= 4 ? options.scale : 2

  const submitResponse = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${options.falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: options.imageUrl,
        scale,
        model: 'RealESRGAN_x4plus',
        face: false,
        output_format: 'png',
      }),
    },
    Math.min(timeoutMs, 20_000),
  )
  const submitPayload = (await submitResponse.json().catch(() => ({}))) as FalQueueSubmitResponse
  if (!submitResponse.ok) {
    throw new Error(extractErrorMessage(submitPayload))
  }

  let resultPayload: FalUpscaleResponse
  if (submitPayload.status_url && submitPayload.response_url) {
    resultPayload = await pollFalResult<FalUpscaleResponse>(
      options.falKey,
      submitPayload.status_url,
      submitPayload.response_url,
      startedAt,
      timeoutMs,
    )
  } else {
    resultPayload = submitPayload as FalUpscaleResponse
  }

  const imageUrl = resultPayload.image?.url?.trim()
  if (!imageUrl) {
    throw new Error(extractErrorMessage(resultPayload) || 'missing_image_url')
  }
  return { imageUrl, width: resultPayload.image?.width, height: resultPayload.image?.height }
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

/** 증명사진→전신: 제출만 하고 폴링은 tale-scene-status. */
export async function submitFalKontextEdit(options: {
  falKey: string
  imageUrl: string
  prompt: string
  tier?: 'pro' | 'max'
  guidanceScale?: number
  outputFormat?: 'png' | 'jpeg'
  aspectRatio?: string
}): Promise<{ statusUrl: string; responseUrl: string } | { imageUrl: string }> {
  let imageUrl = options.imageUrl
  if (imageUrl.startsWith('data:')) {
    const ext = imageUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png'
    imageUrl = await uploadDataUrlToFal(options.falKey, imageUrl, `kontext-src-${Date.now()}.${ext}`)
  }
  const model = options.tier === 'max' ? 'fal-ai/flux-pro/kontext/max' : 'fal-ai/flux-pro/kontext'
  return submitFalQueueJob({
    falKey: options.falKey,
    falModel: model,
    body: {
      prompt: options.prompt,
      image_url: imageUrl,
      num_images: 1,
      output_format: options.outputFormat || 'png',
      safety_tolerance: '6',
      enable_safety_checker: false,
      guidance_scale:
        typeof options.guidanceScale === 'number' ? options.guidanceScale : 5.5,
      ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
    },
  })
}

/** Flux 2 Pro outpaint: 결과 한 변이 이 값을 넘으면 거절된다. */
export const FAL_OUTPAINT_MAX_DIM = 2560

/** expand 합이 maxDim을 넘지 않게 줄인다. 아래(몸통)를 우선 남긴다. */
export function fitOutpaintExpand(options: {
  sourceW: number
  sourceH: number
  top?: number
  bottom?: number
  left?: number
  right?: number
  maxDim?: number
}): { top: number; bottom: number; left: number; right: number } {
  const maxDim = Math.max(64, options.maxDim || FAL_OUTPAINT_MAX_DIM)
  const srcW = Math.max(1, Math.round(options.sourceW))
  const srcH = Math.max(1, Math.round(options.sourceH))
  const fitPair = (src: number, first: number, second: number, preferSecond: boolean) => {
    let a = Math.max(0, Math.round(first))
    let b = Math.max(0, Math.round(second))
    const room = Math.max(0, maxDim - src)
    if (a + b <= room) return [a, b] as const
    if (room === 0) return [0, 0] as const
    if (preferSecond) {
      b = Math.min(b, room)
      a = Math.min(a, Math.max(0, room - b))
    } else {
      const scale = room / (a + b)
      a = Math.floor(a * scale)
      b = Math.max(0, room - a)
    }
    return [a, b] as const
  }
  const [left, right] = fitPair(srcW, options.left || 0, options.right || 0, false)
  const [top, bottom] = fitPair(srcH, options.top || 0, options.bottom || 0, true)
  return { top, bottom, left, right }
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

async function submitFalQueueJob(options: {
  falKey: string
  falModel: string
  body: Record<string, unknown>
}): Promise<{ statusUrl: string; responseUrl: string } | { imageUrl: string }> {
  const endpoint = `https://queue.fal.run/${options.falModel}`
  const submitResponse = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${options.falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options.body),
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
  const imageUrl = firstFalImageUrl(submitPayload)
  if (!imageUrl) {
    throw new Error(extractErrorMessage(submitPayload) || 'missing_image_url')
  }
  return { imageUrl }
}

export async function submitFalLeffaVirtualTryon(options: {
  falKey: string
  humanUrl: string
  garmentUrl: string
  garmentType?: 'upper_body' | 'lower_body' | 'dresses'
}): Promise<{ statusUrl: string; responseUrl: string } | { imageUrl: string }> {
  let humanUrl = options.humanUrl
  let garmentUrl = options.garmentUrl
  if (humanUrl.startsWith('data:')) {
    const ext = humanUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png'
    humanUrl = await uploadDataUrlToFal(options.falKey, humanUrl, `leffa-human-${Date.now()}.${ext}`, {
      maxBytes: 8_000_000,
    })
  }
  if (garmentUrl.startsWith('data:')) {
    const ext = garmentUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png'
    garmentUrl = await uploadDataUrlToFal(options.falKey, garmentUrl, `leffa-garment-${Date.now()}.${ext}`, {
      maxBytes: 8_000_000,
    })
  }
  return submitFalQueueJob({
    falKey: options.falKey,
    falModel: 'fal-ai/leffa/virtual-tryon',
    body: {
      human_image_url: humanUrl,
      garment_image_url: garmentUrl,
      garment_type: options.garmentType || 'dresses',
      output_format: 'png',
      enable_safety_checker: false,
    },
  })
}

/**
 * 옷 사진을 그대로 입히는 VTON. 말로 옷을 설명하는 인페인팅과 달리 목표 옷이 그림으로
 * 고정되므로 매번 같은 옷이 나온다(실측 3/3). 얼굴은 엔진이 스스로 보존한다
 * (ArcFace 0.964, 얼굴칸 이동 0.1%) — 마스크 합성으로 덮을 필요가 없다.
 * 출력 해상도도 입력과 같게 돌려준다(880×1184 → 880×1184).
 */
export async function submitFalFashnTryon(options: {
  falKey: string
  humanUrl: string
  garmentUrl: string
  category?: 'tops' | 'bottoms' | 'one-pieces' | 'auto'
}): Promise<{ statusUrl: string; responseUrl: string } | { imageUrl: string }> {
  let humanUrl = options.humanUrl
  let garmentUrl = options.garmentUrl
  if (humanUrl.startsWith('data:')) {
    const ext = humanUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png'
    humanUrl = await uploadDataUrlToFal(options.falKey, humanUrl, `fashn-human-${Date.now()}.${ext}`, {
      maxBytes: 8_000_000,
    })
  }
  if (garmentUrl.startsWith('data:')) {
    const ext = garmentUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png'
    garmentUrl = await uploadDataUrlToFal(options.falKey, garmentUrl, `fashn-garment-${Date.now()}.${ext}`, {
      maxBytes: 8_000_000,
    })
  }
  return submitFalQueueJob({
    falKey: options.falKey,
    falModel: 'fal-ai/fashn/tryon/v1.6',
    body: {
      model_image: humanUrl,
      garment_image: garmentUrl,
      category: options.category || 'one-pieces',
      // quality 가 피부 질감·원본 보존을 가장 많이 남긴다.
      mode: 'quality',
      // 참고 옷은 마네킹 고스트 컷이다.
      garment_photo_type: 'flat-lay',
      moderation_level: 'permissive',
      num_samples: 1,
      // 켜면(기본) 사람 파싱을 끄므로 원래 재킷 소매·청바지 자리를 비우지 못하고 드레스
      // 천으로 덮어 흰 소매·흰 레깅스가 생긴다(실측 팔다리 2/4만 맨살). 끄면 4/4 맨살.
      segmentation_free: false,
      output_format: 'png',
    },
  })
}

/** 증명사진→전신: 제출만 하고 폴링은 tale-scene-status. */
export async function submitFalOutpaint(options: {
  falKey: string
  imageUrl: string
  expand_top?: number
  expand_bottom?: number
  expand_left?: number
  expand_right?: number
  sourceW?: number
  sourceH?: number
  mode?: 'high' | 'fast'
}): Promise<{ statusUrl: string; responseUrl: string } | { imageUrl: string }> {
  let imageUrl = options.imageUrl
  if (imageUrl.startsWith('data:')) {
    const ext = imageUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png'
    imageUrl = await uploadDataUrlToFal(options.falKey, imageUrl, `outpaint-src-${Date.now()}.${ext}`)
  }
  const fitted =
    options.sourceW && options.sourceH
      ? fitOutpaintExpand({
          sourceW: options.sourceW,
          sourceH: options.sourceH,
          top: options.expand_top,
          bottom: options.expand_bottom,
          left: options.expand_left,
          right: options.expand_right,
        })
      : {
          top: Math.max(0, Math.min(200, Math.round(options.expand_top || 0))),
          bottom: Math.max(0, Math.min(1200, Math.round(options.expand_bottom || 0))),
          left: Math.max(0, Math.min(200, Math.round(options.expand_left || 0))),
          right: Math.max(0, Math.min(200, Math.round(options.expand_right || 0))),
        }
  return submitFalQueueJob({
    falKey: options.falKey,
    falModel: 'fal-ai/flux-2-pro/outpaint',
    body: {
      image_url: imageUrl,
      expand_top: fitted.top,
      expand_bottom: fitted.bottom,
      expand_left: fitted.left,
      expand_right: fitted.right,
      mode: options.mode || 'fast',
      output_format: 'png',
      enable_safety_checker: false,
    },
  })
}

/** 배경만 채우기: 제출만 하고 폴링은 tale-scene-status. */
export async function submitFalInpaint(options: {
  falKey: string
  imageUrl: string
  maskUrl: string
  prompt: string
  negativePrompt?: string
  strength?: number
  preferGeneral?: boolean
}): Promise<{ statusUrl: string; responseUrl: string } | { imageUrl: string }> {
  let imageUrl = options.imageUrl
  let maskUrl = options.maskUrl
  const [srcUp, maskUp] = await Promise.all([
    imageUrl.startsWith('data:')
      ? uploadDataUrlToFal(options.falKey, imageUrl, `inpaint-src-${Date.now()}.${extOf(imageUrl)}`, {
          maxBytes: 8_000_000,
          tooLargeError: 'look_source_too_large',
        })
      : Promise.resolve(imageUrl),
    maskUrl.startsWith('data:')
      ? uploadDataUrlToFal(options.falKey, maskUrl, `inpaint-mask-${Date.now()}.${extOf(maskUrl)}`, {
          maxBytes: 8_000_000,
          tooLargeError: 'look_mask_too_large',
        })
      : Promise.resolve(maskUrl),
  ])
  imageUrl = srcUp
  maskUrl = maskUp
  const prompt = bakeConstraintsForFlux(options.prompt, options.negativePrompt)
  const strength =
    typeof options.strength === 'number' && Number.isFinite(options.strength)
      ? Math.min(0.95, Math.max(0.35, options.strength))
      : 0.72
  const body = {
    prompt,
    image_url: imageUrl,
    mask_url: maskUrl,
    strength,
    num_images: 1,
    num_inference_steps: 28,
    output_format: 'png',
    enable_safety_checker: false,
  }
  const models = options.preferGeneral
    ? (['fal-ai/flux-general/inpainting', 'fal-ai/flux-lora/inpainting'] as const)
    : (['fal-ai/flux-lora/inpainting', 'fal-ai/flux-general/inpainting'] as const)
  let last = 'look_inpaint_failed'
  for (const falModel of models) {
    try {
      return await submitFalQueueJob({
        falKey: options.falKey,
        falModel,
        body,
      })
    } catch (error) {
      last = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(last)
}

function extOf(url: string): 'jpg' | 'png' {
  return url.startsWith('data:image/jpeg') ? 'jpg' : 'png'
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
      enable_safety_checker: false,
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
    // 안전 필터가 켜져 있으면 분홍 니트 같은 피부색 계열이 넓은 이어 그리기 캔버스를 오탐해 검은 1024x768 자리표시 이미지를 돌려준다(실측)
    enable_safety_checker: false,
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

/** 텍스트→이미지 비동기 제출 (증명사진 2인 장면 골격용). 폴링은 checkFalKontextMultiImage와 동일 스키마. */
export async function submitFalTextToImage(options: {
  falKey: string
  prompt: string
  imageSize: FalImageSize
  falModel?: string
}): Promise<{ statusUrl: string; responseUrl: string } | { imageUrl: string }> {
  const model = (options.falModel || 'fal-ai/flux-2-pro').replace(/^https?:\/\/queue\.fal\.run\//, '')
  const endpoint = `https://queue.fal.run/${model}`
  // 얼굴로 장면 골격 전용. bakeConstraintsForFlux는 프롬프트에 nude가 있으면
  // 나체 잠금을 붙여 Flux가 거절한다. 이 경로는 옷 입은 장면만.
  const prompt = options.prompt
  const submitResponse = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${options.falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: isFlux2Model(model) ? flux2SafeImageSize(options.imageSize) : options.imageSize,
        num_images: 1,
        output_format: 'png',
        enable_safety_checker: false,
        safety_tolerance: falSafetyTolerance(model),
      }),
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
  if (status !== 'COMPLETED') {
    return { status: 'pending', falStatus: falStatus || 'IN_PROGRESS' }
  }

  const resultResponse = await fetchWithTimeout(
    options.responseUrl,
    { method: 'GET', headers: { Authorization: `Key ${options.falKey}` } },
    15_000,
  )
  const resultPayload = (await resultResponse.json().catch(() => ({}))) as FalImageResultResponse
  if (!resultResponse.ok) {
    return { status: 'failed', error: extractErrorMessage(resultPayload), falStatus: 'COMPLETED' }
  }
  const policyMsg = extractErrorMessage(resultPayload)
  const imageUrl = firstFalImageUrl(resultPayload)
  if (!imageUrl) {
    if (/content.?policy|flagged|nsfw|safety/i.test(policyMsg)) {
      return { status: 'failed', error: policyMsg, falStatus: 'COMPLETED' }
    }
    return {
      status: 'failed',
      error: policyMsg !== 'fal_generation_failed' ? policyMsg : 'missing_image_url',
      falStatus: 'COMPLETED',
    }
  }
  // 성인 전용: has_nsfw_concepts만으로 실패 처리하지 않음(오탐·정상 NSFW 모두 이미지 반환)
  const nsfwFlagged =
    Array.isArray(resultPayload.has_nsfw_concepts) && resultPayload.has_nsfw_concepts.some(Boolean)
  return { status: 'succeeded', imageUrl, nsfwFlagged, falStatus: 'COMPLETED' }
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

/** insight | easel | replicate | indexed(좌우 인덱스) | kontext(머리·헤어 통째) */
export type FaceSwapEngine = 'insight' | 'easel' | 'replicate' | 'indexed' | 'kontext'

/** Desk 몸 잇기 뒤 — 전신 구도 유지한 채 증명 머리·얼굴만 교체 */
export const DESK_FULLBODY_HEAD_SWAP_PROMPT = [
  'Image 1 is a FULL BODY standing photograph, head to shoes, 3:4 frame. Image 2 is the identity head.',
  'Keep image 1 camera distance, full body, feet, clothes, pose, hands, and background. Do not zoom in. Do not crop to a bust or portrait.',
  'Replace only the head and hairstyle of image 1 with the face and hair from image 2. Same person. Match the neck.',
  'FORBIDDEN: a closer crop, a passport photo, a waist crop, two people, an oval face sticker, a beige plate, a new woman.',
].join(' ')

/** Kontext Multi — 원본 머리·얼굴 제거 후 증명사진 머리·얼굴 통째 교체 */
export const HEAD_SWAP_KONTEXT_PROMPT = [
  'Image 1 is the base photo (body, clothes, pose, background). Image 2 is the identity HEAD reference.',
  'CRITICAL: Completely REMOVE the entire head AND hair of the person in image 1 (face, hair, forehead, ears).',
  'Fill the removed head/hair region with the natural background/environment from image 1 so no leftover original hair remains.',
  'Then place the FULL head from image 2 — face AND hairstyle — onto the neck and shoulders of the person in image 1.',
  'Keep image 1 body, clothing, hands, pose, camera angle, and scene lighting.',
  'Match skin tone at the neck seam. Photorealistic. Adult subject (18+).',
  'FORBIDDEN: keeping image 1 hair, blending two hairstyles, face-only swap that leaves original hair.',
].join(' ')

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
