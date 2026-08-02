import { isAdminEmail, requireAuth } from '../lib/auth'
import {
  buildAnimationPrompt,
  ensureNudeHoldMotionPhrase,
  evaluateContentPolicy,
  wantsNudeOrUndress,
  wantsUndressAction,
} from '../lib/content-policy'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'
import {
  resolveReplicateVideoAspect,
  resolveVideoSourceImageUrl,
  resolveWanI2vDuration,
  startReplicateVideo,
} from '../lib/replicate-client'
import { translateDescriptionForImagePrompt } from '../lib/translate'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  REPLICATE_API_TOKEN?: string
  REPLICATE_VIDEO_MODEL_OWNER?: string
  REPLICATE_VIDEO_MODEL_NAME?: string
  REPLICATE_VIDEO_MODEL_VERSION?: string
  /** Workers AI — 한→영 모션 지시 번역 폴백 */
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }
  /** 한→영 번역 주 엔진(선택) — 없으면 Workers AI 폴백만 사용 */
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_MODEL?: string
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

// 관리자 확장 화보 설명(최대 2400자) + buildFashionMagazinePrompt 고정 문구를 더하면
// 완성된 이미지 프롬프트가 3000자 근처까지 늘어날 수 있다. 예전엔 1200자로 하드 차단해서
// "prompt_too_long"으로 쇼츠 생성이 막혔는데, 이제는 잘라내되 문장/단어 경계에서 끊어
// 자연스럽게 이어지도록 한다(중간에 단어가 잘리는 것을 방지).
const ANIMATE_PROMPT_MAX_CHARS = 3000

function truncatePromptAtBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const slice = text.slice(0, maxLen)
  const lastBreak = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf(', '),
    slice.lastIndexOf(' '),
  )
  const cut = lastBreak > maxLen * 0.6 ? lastBreak : maxLen
  return slice.slice(0, cut).trim()
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  // 디버깅·재시도가 잦은 쇼츠: admin은 넉넉히, 일반은 시간당 20회
  const animateLimit = isAdminEmail(auth.user.email) ? 80 : 20
  const limited = await enforceRateLimit(
    env,
    'animate',
    rateLimitIdentity(auth),
    animateLimit,
    3600,
  )
  if (limited) return limited

  if (!env.REPLICATE_API_TOKEN?.trim()) {
    return jsonResponse({ ok: false, error: 'replicate_token_not_configured' }, 500)
  }

  let body: {
    imageUrl?: string
    imageDataUrl?: string
    prompt?: string
    motion?: string
    size?: string
    durationSec?: number
    /** single | dual-a | dual-b — 줌 연출은 dual만 */
    clipRole?: string
  }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const imageUrl = (body.imageUrl ?? '').trim()
  const imageDataUrl = (body.imageDataUrl ?? '').trim()
  const hasDataUrl = imageDataUrl.startsWith('data:image/')
  if (!hasDataUrl) {
    const urlErr = mediaUrlError(imageUrl)
    if (urlErr) {
      return jsonResponse({ ok: false, error: urlErr }, 400)
    }
  } else if (imageDataUrl.length > 18_000_000) {
    return jsonResponse({ ok: false, error: 'source_image_too_large' }, 400)
  }

  const originalPrompt = truncatePromptAtBoundary((body.prompt ?? '').trim(), ANIMATE_PROMPT_MAX_CHARS)

  let motion = (body.motion ?? '').trim()
  if (motion.length > 400) {
    return jsonResponse({ ok: false, error: 'motion_too_long' }, 400)
  }

  // 「나체로」등 전환 요청이면 누적 프롬프트의 옛 나체 단어로 "이미 나체" 오판하지 않음
  const motionForceBecomeNude =
    /나체로|누드로|올\s*누드|완전\s*나체|옷을\s*벗겨|옷을\s*벗기|탈의하|undress|strip|get(?:s|ting)?\s*(?:fully\s*)?naked/i.test(
      motion,
    )
  const sourceNudeHold =
    !motionForceBecomeNude &&
    (/현재\s*나체|옷\s*없음/.test(originalPrompt) ||
      /fully\s*nude|already\s*(fully\s*)?nude/i.test(originalPrompt))
  // 나체/누드 요청이면 소스 상태에 맞는 유지·전환 문구를 서버에서 자동 부착
  motion = ensureNudeHoldMotionPhrase(motion, { sourceAlreadyNude: sourceNudeHold })
  if (motion.length > 480) {
    motion = motion.slice(0, 480).trim()
  }

  const policyText = [originalPrompt, motion].filter(Boolean).join('\n')
  if (policyText) {
    const policyVerdict = evaluateContentPolicy(policyText)
    if (!policyVerdict.allowed) {
      return jsonResponse(
        {
          ok: false,
          error: 'content_policy_blocked',
          blockedReason: policyVerdict.blockedReason,
          matchedSignals: policyVerdict.matchedSignals,
        },
        422,
      )
    }
  }

  // Wan I2V도 영어 위주 모델이라, 모션 힌트를 한글 그대로 넣으면 잘 안 따라간다 — 번역해서 넣는다.
  const [{ text: promptForVideo }, { text: motionForVideo }] = await Promise.all([
    translateDescriptionForImagePrompt(originalPrompt, env),
    translateDescriptionForImagePrompt(motion, env),
  ])
  const clipRoleRaw = (body.clipRole ?? '').trim().toLowerCase()
  const clipRole =
    clipRoleRaw === 'dual-a' || clipRoleRaw === 'dual-b' ? clipRoleRaw : ('single' as const)
  // 한글 원문을 판별용으로 같이 넣음 — 번역만 쓰면 나체/탈의가 약해져 중반에 속옷·남자가 붙는 사고
  const prompt = buildAnimationPrompt({
    prompt: [originalPrompt, promptForVideo].filter(Boolean).join('\n'),
    motion: [motion, motionForVideo].filter(Boolean).join('\n'),
    clipRole,
  })
  const modelOwner = env.REPLICATE_VIDEO_MODEL_OWNER?.trim() || 'wan-video'
  const modelName = env.REPLICATE_VIDEO_MODEL_NAME?.trim() || 'wan-2.2-i2v-fast'
  const requested =
    typeof body.durationSec === 'number' && Number.isFinite(body.durationSec) ? body.durationSec : 15
  const { approxSec } = resolveWanI2vDuration(requested)
  const nudeOrUndress =
    wantsUndressAction(motion) ||
    wantsNudeOrUndress(motion) ||
    wantsUndressAction(motionForVideo) ||
    wantsNudeOrUndress(motionForVideo)

  try {
    // delivery URL은 금방 만료 → 항상 Files API로 재업로드한 뒤 I2V 시작
    const freshImageUrl = await resolveVideoSourceImageUrl({
      apiToken: env.REPLICATE_API_TOKEN,
      imageUrl: hasDataUrl ? undefined : imageUrl,
      imageDataUrl: hasDataUrl ? imageDataUrl : undefined,
    })

    const started = await startReplicateVideo({
      apiToken: env.REPLICATE_API_TOKEN,
      modelOwner,
      modelName,
      modelVersion: env.REPLICATE_VIDEO_MODEL_VERSION,
      imageUrl: freshImageUrl,
      prompt,
      aspect: resolveReplicateVideoAspect(body.size),
      durationSec: requested,
      // 모션·나체/탈의면 go_fast OFF — 켜면 중반에 팬티·브라·남자 발명이 잦음(실측)
      goFast: !(motion || nudeOrUndress || sourceNudeHold),
    })

    if (started.status === 'succeeded' && started.videoUrl) {
      return jsonResponse(
        {
          ok: true,
          pending: false,
          videoUrl: started.videoUrl,
          prompt,
          durationSec: started.durationSec || approxSec,
          predictionId: started.predictionId,
          engine: 'replicate',
          engineLabel: `Replicate · ${modelOwner}/${modelName}`,
        },
        200,
      )
    }

    // 항상 HTTP 200 — 일부 게이트웨이가 202를 502로 깨뜨리는 경우 방지
    return jsonResponse(
      {
        ok: true,
        pending: true,
        predictionId: started.predictionId,
        prompt,
        durationSec: started.durationSec || approxSec,
        engine: 'replicate',
        engineLabel: `Replicate · ${modelOwner}/${modelName}`,
        message: '영상 생성을 시작했어요. 완료될 때까지 상태를 확인합니다.',
      },
      200,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    // 앱 오류도 200 + ok:false 로 내려 본문을 클라이언트가 확실히 읽게 함
    return jsonResponse(
      {
        ok: false,
        error: 'video_generation_failed',
        message,
      },
      200,
    )
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204 })
}
