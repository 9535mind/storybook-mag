import { isAdminEmail, requireAuth } from '../lib/auth'
import {
  buildAnimationPrompt,
  ensureNudeHoldMotionPhrase,
  evaluateContentPolicy,
  isBodyProjectRequest,
  normalizeBodyLandmarks,
  resolveNudeIntent,
  stripNudeBecomesPhrase,
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

  // 디버깅·재시도가 잦은 쇼츠: admin은 넉넉히(24/30초는 클립 2회라 한도를 빨리 씀)
  const animateLimit = isAdminEmail(auth.user.email) ? 400 : 30
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
    /** 「몸매 투영 쇼츠」버튼 — 이미지 refine이 아니라 I2V 체형유지 탈의 */
    bodyProject?: boolean
    /** User-placed 타점 (nippleL/R, navel, breastRadius) — normalized 0–1 */
    landmarks?: unknown
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
  const bodyProjectFlag = body.bodyProject === true

  let motion = (body.motion ?? '').trim()
  if (motion.length > 400) {
    return jsonResponse({ ok: false, error: 'motion_too_long' }, 400)
  }

  // 「몸매 투영 쇼츠」버튼 — 이미지 수정 없이 I2V에서 체형 유지 탈의 전환
  if (bodyProjectFlag) {
    if (!isBodyProjectRequest(motion)) {
      motion = motion
        ? `몸매 투영. ${motion}`
        : '몸매 투영: 얼굴·체형 그대로. 어깨·팔뚝·팔꿈치로 유두 높이를 읽고, 가슴은 옷에 볼륨이 있으면 C컵 반~D컵·처진 실루엣 가능. 배꼽·치부 기점 고정 후 상의·바지·벨트·팬티 전부 녹여 완전 나체. 가슴 아래 벨트/띠 잔상·바지/팬티 잔존·빈유 과소평가 실패'
    }
  }
  // NOTE: refine 마커만으로 motion='몸매 투영'을 주입하지 않음.
  // 일반 쇼츠(키스/애무)가 become 조기 return으로 새는 회귀를 막는다. 몸매 투영은 bodyProject 버튼만.

  const nudeIntent = resolveNudeIntent({
    motion,
    prompt: originalPrompt,
    base: originalPrompt,
    bodyProject: bodyProjectFlag,
  })
  const motionForceBecomeNude = nudeIntent.mode === 'become' || bodyProjectFlag
  const continuity = stripNudeBecomesPhrase(originalPrompt)
  const sourceNudeHold =
    nudeIntent.mode === 'hold' ||
    (!motionForceBecomeNude &&
      (/현재\s*나체|옷\s*없음/.test(continuity) ||
        /fully\s*nude|already\s*(fully\s*)?nude/i.test(continuity)))
  motion = ensureNudeHoldMotionPhrase(motion, {
    sourceAlreadyNude: sourceNudeHold && !motionForceBecomeNude,
  })
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
  const landmarks = bodyProjectFlag ? normalizeBodyLandmarks(body.landmarks) : null
  // 몸매 투영: 긴 화보 설명(블라우스·벨트·바지)이 I2V에 다시 옷을 먹이는 걸 막기 위해
  // 원문 프롬프트는 넣지 않고, 짧은 become 비트 + 타점만 사용.
  // 타점 %를 motion 문자열에도 넣어 프롬프트 경로가 달라도 좌표가 빠지지 않게 한다.
  const landmarkMotion = landmarks
    ? [
        '몸매 투영 full nude reveal.',
        `LEFT mound x=${((landmarks.moundL ?? landmarks.nippleL).x * 100).toFixed(1)}% y=${((landmarks.moundL ?? landmarks.nippleL).y * 100).toFixed(1)}%.`,
        `LEFT nipple x=${(landmarks.nippleL.x * 100).toFixed(1)}% y=${(landmarks.nippleL.y * 100).toFixed(1)}% (may be off-center).`,
        `RIGHT mound x=${((landmarks.moundR ?? landmarks.nippleR).x * 100).toFixed(1)}% y=${((landmarks.moundR ?? landmarks.nippleR).y * 100).toFixed(1)}%.`,
        `RIGHT nipple x=${(landmarks.nippleR.x * 100).toFixed(1)}% y=${(landmarks.nippleR.y * 100).toFixed(1)}% (may be off-center).`,
        'Remove bra, brown waist belt, pants, and all panties (including double layers).',
      ].join(' ')
    : '몸매 투영 full nude reveal. Remove bra, brown waist belt, pants, and all panties.'
  const prompt = bodyProjectFlag
    ? buildAnimationPrompt({
        prompt: '',
        motion: landmarkMotion,
        clipRole,
        landmarks,
        bodyProject: true,
      })
    : buildAnimationPrompt({
        prompt: [originalPrompt, promptForVideo].filter(Boolean).join('\n'),
        motion: [motionForVideo, motion].filter(Boolean).join('\n'),
        clipRole,
        landmarks,
      })
  const modelOwner = env.REPLICATE_VIDEO_MODEL_OWNER?.trim() || 'wan-video'
  const modelName = env.REPLICATE_VIDEO_MODEL_NAME?.trim() || 'wan-2.2-i2v-fast'
  const requested =
    typeof body.durationSec === 'number' && Number.isFinite(body.durationSec) ? body.durationSec : 15
  const { approxSec } = resolveWanI2vDuration(requested)
  const nudeOrUndress =
    bodyProjectFlag ||
    nudeIntent.nudeBecomes ||
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
      // 모션·나체/탈의·몸매 투영이면 go_fast OFF — 켜면 중반에 팬티·브라·남자 발명이 잦음(실측)
      goFast: !(motion || nudeOrUndress || sourceNudeHold || bodyProjectFlag),
      // 몸매 투영: 원본 벨트/바지 픽셀에 달라붙는 회귀 → sample_shift를 올려 옷 용해 여유
      sampleShift: bodyProjectFlag ? 18 : undefined,
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
