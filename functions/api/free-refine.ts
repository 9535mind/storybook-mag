// ⚠ 8월 27일자 완성본(7b98822)을 그대로 얼린 사본입니다. 자유 스튜디오 전용.
// Desk / 일러스트는 이 파일을 쓰지 않습니다. 여기를 "개선"하지 마세요 —
// 사용자가 이 시점의 나체·포즈 동작을 기준점으로 저장했습니다. (사진 수정)
import { isAdminEmail, requireAuth } from '../lib/auth'
import {
  buildFashionMagazinePrompt,
  buildFashionNegativePrompt,
  buildFramingExtendRefineAddon,
  buildRefinePrompt,
  DEFAULT_NEGATIVE_PROMPT,
  describesAnimalSubject,
  evaluateContentPolicy,
  isAdditiveRefineRevision,
  isClothingChangeRevision,
  isFramingExtendRevision,
  isStructuralRefineRevision,
  mergeFreeRevisionDescription,
  polishKoreanPromptText,
  resolveFashionDescriptionWordBudget,
  resolveFramingExpandPixels,
  buildJewelryAccessoryRefinePrompt,
  buildNecklaceRefinePrompt,
  buildNippleAreolaRefinePrompt,
  buildRealisticPubicHairRefinePrompt,
  buildSplitCompositeFixPrompt,
  buildWristAndNecklaceRefinePrompt,
  buildWristWatchRefinePrompt,
  BODY_PROJECT_REVISION,
  buildNudeBecomesDefinitionLock,
  buildNudeIdentityRefinePrompt,
  isBodyProjectRequest,
  stripDefaultContinuityEchoes,
  wantsFullNude,
  wantsJewelryAccessoryRefine,
  wantsNecklaceRefine,
  wantsNippleAreolaRefine,
  wantsNudeOrUndress,
  wantsPubicHairOnlyRefine,
  wantsSplitCompositeFix,
  wantsExplicitPubicShave,
  wantsWristAccessoryRefine,
} from '../lib/aug27/content-policy'
import {
  FAL_WILDLIFE_TIMEOUT_MS,
  generateFalImage,
  outpaintFalImage,
  refineFalImageToImage,
  refineFalInpaint,
  refineFalKontextEdit,
  resolveFalImageSize,
} from '../lib/fal-client'
import {
  buildBreastDetailMaskDataUrl,
  buildEarJewelryMaskDataUrl,
  buildFacePreserveBodyMaskDataUrl,
  buildNeckJewelryMaskDataUrl,
  buildPubicRegionMaskDataUrl,
  buildTorsoSkinMaskDataUrl,
  buildWristAndNeckJewelryMaskDataUrl,
  buildWristJewelryMaskDataUrl,
} from '../lib/face-preserve-mask'
import { mediaUrlError } from '../lib/media-url'
import { enforceRateLimit, rateLimitIdentity } from '../lib/rate-limit'
import {
  generateReplicateImage,
  refineReplicateImageToImage,
  resolveReplicateImageSize,
} from '../lib/replicate-client'
import {
  compileResponsiveFreePrompt,
  isRealWildlifeScene,
  summarizePlan,
} from '../lib/scene-compiler'
import { compileSdxlTagPrompt, translateDescriptionForImagePrompt } from '../lib/translate'
import { COUPLE_NUDE_STILL_REVISION } from '../lib/free-couple-lock'

interface Env {
  DB?: D1Database
  ADMIN_PIN?: string
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }
  /** 한→영 번역 주 엔진(선택) — 없으면 Workers AI 폴백만 사용 */
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_MODEL?: string
  REPLICATE_API_TOKEN?: string
  REPLICATE_MODEL_OWNER?: string
  REPLICATE_MODEL_NAME?: string
  REPLICATE_MODEL_VERSION?: string
  REPLICATE_PRECISION_MODEL_OWNER?: string
  REPLICATE_PRECISION_MODEL_NAME?: string
  REPLICATE_PRECISION_MODEL_VERSION?: string
  FAL_KEY?: string
  FAL_MODEL_ID?: string
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const limited = await enforceRateLimit(env, 'free-refine', rateLimitIdentity(auth), 40, 3600)
  if (limited) return limited

  let body: {
    mode?: 'text' | 'region'
    genMode?: 'free' | 'fashion'
    imageUrl?: string
    baseDescription?: string
    revision?: string
    /** 「몸매 투영」버튼 — 문구 규칙 없이 체형 유지 탈의 경로 */
    bodyProject?: boolean
    maskDataUrl?: string
    mood?: string
    size?: string
    regionCount?: number
    /** 2면 커플. 솔로 얼굴마스크 탈의를 쓰지 않는다. */
    sourcePeople?: number
    /** 자유 스튜디오 이어 만들기. 전신 탈의를 다시 돌리지 않는다. */
    continueLast?: boolean
    /** 이미 나체인 장. 옷을 다시 입히지 않는다. */
    stayNude?: boolean
    /** 얼굴 하단(0~1). 앉은 사진은 0.42면 턱이 마스크 밖으로 새 여자가 된다. */
    faceKeepRatio?: number
  }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json_body' }, 400)
  }

  const bodyProjectFlag = body.bodyProject === true
  const sourcePeople = body.sourcePeople === 2 ? 2 : 1
  const coupleShot = sourcePeople === 2
  const faceKeepRatioRaw = Number(body.faceKeepRatio)
  const faceKeepRatio = Number.isFinite(faceKeepRatioRaw)
    ? Math.min(0.72, Math.max(0.22, faceKeepRatioRaw))
    : 0
  const mode = body.mode === 'region' ? 'region' : 'text'
  // 화보 모드는 아래의 화보 전용 img2img/재생성 경로를 타야 하므로, genMode='fashion'이면
  // 자유 장면 재생성 블록을 건너뛰게 한다(예전엔 여기서 무조건 'free'로 강제해서, 화보
  // (관리자) 모드에서 "귀걸이 추가" 같은 작은 텍스트 수정도 전부 자유 일러스트용 장면
  // 재생성(LLM 기반 동물/사물 재해석)으로 흘러가 이미지가 전혀 "수정"되지 않고 완전히
  // 다른 장면(심지어 사자 같은 동물)으로 재생성되는 사고가 났었다).
  //
  // 단, genMode는 반드시 서버에서 관리자 여부로 재검증해야 한다 — generate.ts는 이미
  // isAdminEmail로 비관리자의 'fashion' 접근을 막는데(그 커밋 주석: "/api/generate를
  // 직접 호출하면 비관리자도 'fashion'... 접근할 수 있었다"), 이 파일은 그 검증 없이
  // body.genMode를 그대로 신뢰하고 있었다 — 즉 SOLO_ADMIN_ONLY=0 환경에서는 비관리자가
  // /api/refine을 직접 호출해 화보(성인) 파이프라인·긴 프롬프트 예산을 탈 수 있는
  // 비대칭 구멍이었다. generate.ts와 동일하게 여기서도 막는다.
  const genMode: 'free' | 'fashion' =
    body.genMode === 'fashion' && isAdminEmail(auth.user.email) ? 'fashion' : 'free'
  const imageUrl = (body.imageUrl ?? '').trim()
  const baseDescription = polishKoreanPromptText(body.baseDescription ?? '')
  // 「같은 얼굴 유지」「한 명만」은 프롬프트 조립(buildIroncladIdentityLock 등)이 기본 적용 —
  // 사용자 입력에서 제거해 변경 지시만 남긴다.
  // 몸매 투영 버튼은 고정 revision — 매직 문구(나체가 된다.) 불필요.
  const continueLast = body.continueLast === true
  const stayNude = body.stayNude === true
  const continueLock = continueLast
    ? [
        stayNude
          ? 'ALREADY NUDE. Stay fully nude. FORBIDDEN clothes, bra, panties, or reverting to the clothed photo.'
          : 'Same person and same crop. Apply only the user change.',
        'FACE: keep the original face. FORBIDDEN a new model, a fuller face, an older face.',
        stayNude
          ? 'SKIN: erase dark dots, moles, and speckles on the breasts, under the nipples, and the belly. PUBIC: short compact dark curls on the mons only, well below the navel.'
          : '',
      ]
        .filter(Boolean)
        .join(' ')
    : ''
  const userRevision = coupleShot
    ? (body.revision || '').trim() || COUPLE_NUDE_STILL_REVISION
    : bodyProjectFlag
      ? BODY_PROJECT_REVISION
      : stripDefaultContinuityEchoes(body.revision ?? '')
  const revision = continueLast
    ? `${continueLock} ${userRevision}`.trim().slice(0, 800)
    : userRevision
  const attempts: Array<{ engine: string; error: string }> = []

  const urlErr = mediaUrlError(imageUrl)
  if (urlErr) return jsonResponse({ ok: false, error: urlErr }, 400)
  if (!revision) return jsonResponse({ ok: false, error: 'revision_required' }, 400)
  // 관리자는 그림 상세본(최대 3000자 미만)을 그대로 baseDescription으로 들고 올 수 있게 허용한다.
  const maxDescriptionChars = isAdminEmail(auth.user.email) ? 3000 : 1200
  if (revision.length > 800) return jsonResponse({ ok: false, error: 'revision_too_long' }, 400)
  if (baseDescription.length > maxDescriptionChars) {
    return jsonResponse({ ok: false, error: 'description_too_long', maxLength: maxDescriptionChars }, 400)
  }

  const policyVerdict = evaluateContentPolicy(`${baseDescription}\n${revision}`, { mode: genMode })
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

  const size = body.size ?? 'landscape'
  const mood = body.mood ?? 'clean'
  // genMode='fashion'이라도 실제 서술이 동물/사물 장면이면(관리자가 화보 탭에서 동물 그림을
  // 만든 경우) "성인 여성 얼굴 유지" 문구를 쓰면 안 된다. 번역이 "말"을 애매하게 옮길 수도
  // 있으니, 번역 전 원문 한국어 텍스트로 먼저 판별해서 아래 img2img 경로 전체에 재사용한다.
  const animalSubject = describesAnimalSubject(`${baseDescription} ${revision}`)

  const inpaintSize = () => ({
    width: size === 'portrait' || size === 'story' ? 768 : 1024,
    height: size === 'story' ? 1344 : size === 'portrait' ? 1024 : 768,
  })

  /** 배꼽에서 내려오는 음모 줄을 지운다. 새 털을 그리지 않는다. */
  const eraseBellyTrail = async (srcUrl: string) => {
    const { imageUrl: cleared } = await refineFalInpaint({
      falKey: env.FAL_KEY as string,
      imageUrl: srcUrl,
      maskUrl: buildPubicRegionMaskDataUrl({
        ...inpaintSize(),
        yStartRatio: 0.48,
        yEndRatio: 0.88,
        xStartRatio: 0.26,
        xEndRatio: 0.74,
      }),
      prompt:
        'ERASE every hair on the belly and below the navel. Smooth bare skin. One clean navel. FORBIDDEN happy trail, midline hair, pubic hair climbing toward the navel. Do not paint any new hair. Do not change the face or the breasts.',
      negativePrompt:
        'hair, happy trail, pubic hair, midline hair, stubble, trail to navel, different face',
      strength: 0.88,
    })
    return cleared
  }

  /** 가슴·배의 점·털을 지운다. 얼굴·치골은 마스크 밖. */
  const cleanBelly = async (srcUrl: string) => {
    const dims = inpaintSize()
    let { imageUrl: torso } = await refineFalInpaint({
      falKey: env.FAL_KEY as string,
      imageUrl: srcUrl,
      maskUrl: buildTorsoSkinMaskDataUrl(dims),
      prompt:
        'Smooth bare skin on the breasts, under the nipples, the belly, and around the navel. Erase every mole, dark dot, speckle, freckle, and hair in this area. Keep the same breast shape and plain nipples with no hair. One normal navel only — no second hole or dark mark below it. Do not change the face, hair, or the crotch.',
      negativePrompt:
        'dots, speckles, moles, stipple, dirt spots, freckle field, hair, happy trail, pubic hair, second navel, different face',
      strength: 0.8,
    })
    try {
      const { imageUrl: navel } = await refineFalInpaint({
        falKey: env.FAL_KEY as string,
        imageUrl: torso,
        maskUrl: buildPubicRegionMaskDataUrl({
          ...dims,
          yStartRatio: 0.46,
          yEndRatio: 0.84,
          xStartRatio: 0.26,
          xEndRatio: 0.74,
        }),
        prompt:
          'Smooth belly skin. One clean navel. Erase every mole, dark dot, second hole, crease, and hair around and below the navel. Bare skin only. Do not paint pubic hair. Do not change the face.',
        negativePrompt:
          'mole, dark dot, second navel, extra hole, hair, happy trail, pubic hair, dirt spot, different face',
        strength: 0.82,
      })
      torso = navel
    } catch {
      /* 배꼽 띠가 실패해도 가슴 정리는 이어 간다 */
    }
    try {
      const { imageUrl: breasts } = await refineFalInpaint({
        falKey: env.FAL_KEY as string,
        imageUrl: torso,
        maskUrl: buildBreastDetailMaskDataUrl(dims),
        prompt:
          'Keep the same breasts and nipples. Erase every mole, dark dot, speckle, and hair on the breast skin and under the nipples. Smooth even skin. No nipple hair. Do not change the face.',
        negativePrompt: 'dots, speckles, moles, nipple hair, different face, different breasts',
        strength: 0.72,
      })
      return breasts
    } catch {
      return torso
    }
  }

  /** 전신 탈의 직후 치골만 — 배꼽보다 아래. 마스크 위쪽(배)은 맨살. */
  const finishPubicHair = async (
    srcUrl: string,
    span?: boolean | { rightHalfOnly?: boolean; xStartRatio?: number; xEndRatio?: number },
  ) => {
    const extra = span === true ? { rightHalfOnly: true } : span || {}
    const pubicPrompt = [
      'Hair ONLY as a low compact patch on the mons, at the bottom of the mask. The navel and the whole belly stay bare skin. FORBIDDEN a trail of hair up to the navel.',
      buildRealisticPubicHairRefinePrompt(
        'neat Korean-30s curly mons, slightly fuller than 20s, visible coils, not a thin line, not a triangle',
      ),
      'Paint a real adult vulva now: soft outer labia, a natural vertical cleft, modest inner-labia hint.',
      'Paint a dark-brown CURLY mons patch with separate coils. FAILED hairless Barbie mound, single pencil crease, smooth blank crotch, hair on the belly.',
    ].join(' ')
    const { imageUrl: finished } = await refineFalInpaint({
      falKey: env.FAL_KEY as string,
      imageUrl: srcUrl,
      maskUrl: buildPubicRegionMaskDataUrl({
        ...inpaintSize(),
        ...extra,
        yStartRatio: 0.82,
        yEndRatio: 0.92,
        xStartRatio: extra.rightHalfOnly ? 0.5 : 0.32,
        xEndRatio: extra.rightHalfOnly ? 1 : 0.68,
      }),
      prompt: pubicPrompt,
      negativePrompt:
        'thin midline hair, landing strip, ink-blob triangle, shaved, hairless doll, barbie mound, single crease, jet black ink blob, male happy trail, hair on belly, hair on navel, hair up to navel, pubic hair on abdomen, panties, clothes, different face, grainy stubble',
      strength: 0.82,
    })
    return finished
  }

  const polishSkinDots = async (srcUrl: string) => {
    if (!env.FAL_KEY?.trim()) return srcUrl
    let next = srcUrl
    try {
      next = await cleanBelly(next)
    } catch (error) {
      attempts.push({
        engine: 'fal-belly-clean',
        error: error instanceof Error ? error.message : 'failed',
      })
    }
    try {
      next = await eraseBellyTrail(next)
    } catch (error) {
      attempts.push({
        engine: 'fal-belly-trail',
        error: error instanceof Error ? error.message : 'failed',
      })
    }
    return next
  }

  // ═══════════════════════════════════════════════════════════
  // 지시형 수정: Flux Kontext (쇼츠 Wan≠이미지편집 — 편집 전용 엔진)
  // 마스크 추측 inpaint보다 "문장으로 고쳐줘"에 맞음. 실패 시 아래 기존 경로.
  // ═══════════════════════════════════════════════════════════
  // 무릎·전신 확장은 진짜 아웃페인트가 맞음 — Kontext가 장면을 새로 그리면 얼굴이 바뀜
  // 이어 만들기 잠금에 navel/배꼽이 들어 있어도 아웃페인트로 보내지 않는다.
  // 나체 유지 잠금이 wantsFullNude를 켜서 Kontext를 건너뛰던 것도 막는다.
  const framingSource = continueLast ? userRevision : revision
  const skipKontextForFraming = isFramingExtendRevision(framingSource)
  const continueClothesEdit =
    continueLast &&
    (wantsNudeOrUndress(userRevision) || isClothingChangeRevision(userRevision))
  // 8월 27일(7b98822): 커플이어도 적은 말을 Kontext에 그대로 보낸다.
  // 나중에 넣은 "커플 금지"는 앉기·키스 같은 명령을 거절하게 만들었다.
  // 상의 벗김·스커트 교체는 Kontext 필터가 검은 장을 내므로 얼굴잠금 inpaint로 보낸다.
  if (
    mode === 'text' &&
    env.FAL_KEY?.trim() &&
    !skipKontextForFraming &&
    !continueClothesEdit &&
    (continueLast ||
      (!wantsFullNude(revision, baseDescription) && !wantsNudeOrUndress(revision)))
  ) {
    const { text: revisionForKontext } = await translateDescriptionForImagePrompt(revision, env)
    const fuseSeamPolish =
      /LOCAL head-swap|FINAL head-swap|head-swap seam|EDGE MATTE ONLY|lasso silhouette/i.test(
        revision,
      )
    const kontextPrompt = [
      'CAMERA FIRST: keep the EXACT same crop, distance, and framing as the input photo. Head stays in frame. FORBIDDEN zoom-in, bust close-up, chest-only crop, cutting the head.',
      'Edit this existing photo. Apply ONLY this change:',
      revisionForKontext || revision,
      'FACE: keep the exact same face as the input photo — same jaw, same cheeks, same age, same slimness. FORBIDDEN a fuller face, an older face, a different woman, a new model.',
      'Keep the same person identity and body proportions. Same camera. Do not invent a different person. Photorealistic result.',
      stayNude || /점|주근깨|mole|dot/i.test(revision)
        ? 'SKIN: erase moles, dark dots, and speckles on the breasts, under the nipples, and the belly. Smooth skin. Do not change the face.'
        : '',
      fuseSeamPolish
        ? 'CRITICAL QUALITY: preserve the input photo sharpness and resolution. Do NOT re-render the whole image soft/muddy/low-res. Only local seam/neck/edge fixes. Keep fabric weave and facial micro-detail.'
        : '',
    ]
      .filter(Boolean)
      .join(' ')
    try {
      const { imageUrl: nextUrl } = await refineFalKontextEdit({
        falKey: env.FAL_KEY,
        imageUrl,
        prompt: kontextPrompt,
        tier: 'pro',
      })
      let polished = nextUrl
      if (stayNude || /점|주근깨|mole|dot/i.test(userRevision)) {
        polished = await polishSkinDots(polished)
      }
      if (continueLast && stayNude && !wantsExplicitPubicShave(userRevision)) {
        try {
          polished = await finishPubicHair(polished)
        } catch (error) {
          attempts.push({
            engine: 'fal-pubic-finish',
            error: error instanceof Error ? error.message : 'failed',
          })
        }
      }
      return jsonResponse(
        {
          ok: true,
          imageUrl: polished,
          prompt: kontextPrompt,
          mode,
          genMode,
          engine: 'fal',
          engineLabel: 'fal.ai · Flux Kontext (지시 수정)',
          message:
            '이미지 편집 전용 엔진(Kontext)으로 처리했어요. 위치가 애매하면 「찍어서 붙이기」나 올가미를 쓰세요.',
          attempts: attempts.length ? attempts : undefined,
        },
        200,
      )
    } catch (error) {
      attempts.push({
        engine: 'fal-kontext-edit',
        error: error instanceof Error ? error.message : 'failed',
      })
      // 장신구만인데 Kontext도 실패 → 찍어서 붙이기 안내 (장면 재생성으로 보내지 않음)
      if (wantsJewelryAccessoryRefine(revision) && genMode === 'free') {
        return jsonResponse(
          {
            ok: false,
            error: 'use_accessory_pin',
            message:
              '지시 수정 엔진이 이번엔 실패했어요. 「찍어서 붙이기」로 시계·귀걸이 자리를 클릭해 붙이거나, 잠시 후 텍스트 수정을 다시 시도해 주세요.',
            attempts,
          },
          422,
        )
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 자유 모드 텍스트 수정 = 자유 장면 재생성 (Kontext 실패·누드 등)
  // 화보(fashion) 모드는 여기를 건너뛰고 아래 화보 전용 재생성/img2img 경로를 탄다.
  // ═══════════════════════════════════════════════════════════
  if (mode === 'text' && genMode === 'free' && !coupleShot) {
    // 한글 병합 브리프(merged)는 그대로 두고, 실제 이미지 프롬프트 조립 직전에만 영어로
    // 번역한다 — 그래야 씬 파서(Llama)와 최종 프롬프트 둘 다 영어 텍스트를 받게 된다.
    const merged = mergeFreeRevisionDescription(baseDescription, revision)
    const { text: mergedForPrompt } = await translateDescriptionForImagePrompt(merged, env)
    try {
      const compiled = await compileResponsiveFreePrompt({
        description: mergedForPrompt,
        size,
        mood,
        ai: env.AI,
      })
      const prompt = compiled.prompt
      const negativePrompt = compiled.negativePrompt
      const wildlifeScene = isRealWildlifeScene(compiled.plan)
      const complexScene =
        compiled.plan.multiSpecies ||
        compiled.plan.actions.length > 0 ||
        compiled.plan.states.length > 0 ||
        compiled.plan.traits.length > 0 ||
        compiled.plan.needsWideScene
      const sceneMeta = summarizePlan(compiled.plan)

      const tryFal = async (asPrimary: boolean) => {
        if (!env.FAL_KEY?.trim()) {
          attempts.push({ engine: 'fal', error: 'fal_key_not_configured' })
          return null
        }
        try {
          const falModel = env.FAL_MODEL_ID?.trim() || 'fal-ai/flux-2-pro'
          const { imageUrl: nextUrl } = await generateFalImage({
            falKey: env.FAL_KEY,
            falModel,
            prompt,
            negativePrompt,
            imageSize: resolveFalImageSize(size),
            timeoutMs: wildlifeScene || asPrimary ? FAL_WILDLIFE_TIMEOUT_MS : undefined,
          })
          return jsonResponse(
            {
              ok: true,
              imageUrl: nextUrl,
              prompt,
              negativePrompt,
              mode,
              genMode,
              structuralRegen: true,
              scene: sceneMeta,
              engine: 'fal',
              engineLabel: asPrimary
                ? 'fal.ai · Flux 장면 재생성 (자유 수정 · 야생동물)'
                : 'fal.ai · Flux 장면 재생성 (자유 수정)',
              message:
                '자유 일러스트 수정은 장면 재생성으로 처리해요. 원본 동물·구도를 유지한 채 요청을 반영합니다.',
              wildlifeRoute: wildlifeScene,
            },
            200,
          )
        } catch (error) {
          attempts.push({
            engine: 'fal',
            error: error instanceof Error ? error.message : 'unknown_error',
          })
          return null
        }
      }

      const tryReplicate = async () => {
        if (!env.REPLICATE_API_TOKEN?.trim()) {
          attempts.push({ engine: 'replicate', error: 'replicate_token_not_configured' })
          return null
        }
        try {
          const steps = wildlifeScene ? 18 : complexScene ? 14 : 12
          const cfg = wildlifeScene ? 7.0 : complexScene ? 5.0 : 4.0
          const dims = resolveReplicateImageSize(size)
          const { imageUrl: nextUrl } = await generateReplicateImage({
            apiToken: env.REPLICATE_API_TOKEN,
            modelOwner: env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based',
            modelName: env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning',
            modelVersion: env.REPLICATE_MODEL_VERSION,
            prompt,
            negativePrompt,
            disableSafetyChecker: true,
            numInferenceSteps: steps,
            guidanceScale: cfg,
            ...dims,
          })
          return jsonResponse(
            {
              ok: true,
              imageUrl: nextUrl,
              prompt,
              negativePrompt,
              mode,
              genMode,
              structuralRegen: true,
              scene: sceneMeta,
              engine: 'replicate',
              engineLabel: wildlifeScene
                ? 'Replicate · 장면 재생성 (자유 수정 · 야생동물)'
                : 'Replicate · 장면 재생성 (자유 수정)',
              message:
                '자유 일러스트 수정은 장면 재생성으로 처리해요. 원본 동물·구도를 유지한 채 요청을 반영합니다.',
              wildlifeRoute: wildlifeScene,
              attempts: attempts.length ? attempts : undefined,
            },
            200,
          )
        } catch (error) {
          attempts.push({
            engine: 'replicate',
            error: error instanceof Error ? error.message : 'unknown_error',
          })
          return null
        }
      }

      if (wildlifeScene) {
        const falRes = await tryFal(true)
        if (falRes) return falRes
        const repRes = await tryReplicate()
        if (repRes) return repRes
      } else {
        const falRes = await tryFal(false)
        if (falRes) return falRes
        const repRes = await tryReplicate()
        if (repRes) return repRes
      }

      return jsonResponse(
        {
          ok: false,
          error: 'refine_failed',
          message: '자유 장면 수정(재생성)에 실패했어요. 잠시 후 다시 시도해 주세요.',
          attempts,
        },
        500,
      )
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error: 'refine_failed',
          message: error instanceof Error ? error.message : 'free_scene_regen_failed',
          attempts,
        },
        500,
      )
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 화보 모드 · 큰 수정 → 화보 T2I 재생성
  // ═══════════════════════════════════════════════════════════
  const structural = mode === 'text' && isStructuralRefineRevision(revision)
  // isStructuralRefineRevision은 "누드/나체/nude"도 구조적 큰 수정으로 분류하는데, 바로 아래
  // T2I 재생성 분기는 원본 이미지를 전혀 입력으로 쓰지 않는 순수 텍스트→이미지 생성이라
  // (얼굴은 "Korean woman, attractive face" 같은 일반 인종 태그로만 지정됨) 매번 완전히
  // 다른 사람 얼굴이 나온다 — 실측으로 "수정(누드 요청)할 때마다 얼굴이 달라진다"는 신고가
  // 반복 확인됐다. 누드/탈의 요청은 원본 이미지를 실제로 입력으로 쓰는 img2img 경로(아래
  // 511행~, 정밀모델·strength 0.6)로 보내서 얼굴을 최대한 보존한 채 옷을 벗기게 한다 —
  // 이 경로는 T2I 재생성보다 옷을 완전히 제거하는 성공률은 다소 낮을 수 있지만, "다른 사람"
  // 이 되어버리는 것보다는 원본 인물을 지키는 쪽이 사용자에게 훨씬 중요하다.
  // revision 우선 — base에 붙은 옛 서술과 합치면 오판/약화가 생길 수 있음
  const nudeRevision =
    wantsNudeOrUndress(revision) || wantsFullNude(revision, baseDescription)
  // isStructuralRefineRevision은 이제 탈의뿐 아니라 착의·교체("가운을 입혀줘", "바지를
  // 스커트로 바꿔줘")도 구조적 수정으로 잡는다(옷을 놓치지 않고 반영하기 위함) — 그런데
  // 이 T2I 재생성 분기는 원본 이미지를 전혀 쓰지 않는 순수 텍스트→이미지 생성이라, 위
  // nudeRevision 제외만으로는 "착의/교체" 요청까지 걸러지지 않아 원본 인물이 완전히 다른
  // 사람으로 바뀌는 회귀가 생긴다. 옷과 관련된 변경이면(탈의든 착의든 교체든) 전부 여기를
  // 건너뛰고 아래 얼굴 보존 img2img 경로로 보낸다 — "전신으로/거울 앞에서" 같은 옷과
  // 무관한 순수 프레이밍·구도 변경만 이 분기(T2I 재생성)를 탄다.
  const clothingChangeRevision = isClothingChangeRevision(`${baseDescription} ${revision}`)
  // 「허리/무릎/발목까지」류는 T2I·일반 img2img 금지 — 진짜 아웃페인트로 아래로 확장(얼굴 유지)
  const framingExtendRevision = mode === 'text' && isFramingExtendRevision(framingSource)
  if (framingExtendRevision && env.FAL_KEY?.trim()) {
    try {
      const expand = resolveFramingExpandPixels(revision)
      const { imageUrl: nextUrl } = await outpaintFalImage({
        falKey: env.FAL_KEY,
        imageUrl,
        ...expand,
        mode: 'fast',
      })
      return jsonResponse(
        {
          ok: true,
          imageUrl: nextUrl,
          prompt: `outpaint ${JSON.stringify(expand)} · ${revision}`,
          mode,
          genMode,
          structuralRegen: false,
          framingOutpaint: true,
          engine: 'fal',
          engineLabel: 'fal.ai · Outpaint (아래로 확장 · 얼굴 유지)',
          message:
            '증명사진·상반신을 아래로 이어 그렸어요. 얼굴은 원본을 유지합니다. 더 아래(무릎·전신)가 필요하면 한 번 더 요청해 주세요.',
        },
        200,
      )
    } catch (error) {
      attempts.push({
        engine: 'fal-outpaint',
        error: error instanceof Error ? error.message : 'outpaint_failed',
      })
      // 아웃페인트 실패 시에만 아래 img2img 프레이밍 보조 경로로 계속
    }
  }
  if (
    structural &&
    !nudeRevision &&
    !clothingChangeRevision &&
    !framingExtendRevision &&
    genMode === 'fashion' &&
    env.REPLICATE_API_TOKEN?.trim()
  ) {
    const merged = [baseDescription, revision].filter(Boolean).join('. ')
    // SDXL/Juggernaut CLIP 인코더의 ~70단어 예산에 맞춰 번역+압축 — generate.ts의 화보 경로와 동일.
    // revision을 따로 넘겨서, 예산 안에서 수정 지시가 조용히 잘려나가지 않게 한다. 예산 자체도
    // 55 고정이 아니라, 뒤에 붙을 인종/의상보강/무드/구도/품질 태그 길이에 맞춰 동적으로 정한다.
    const descriptionBudget = resolveFashionDescriptionWordBudget({ mood, size, rawDescription: merged })
    const { text: mergedForPrompt } = await compileSdxlTagPrompt(baseDescription, env, descriptionBudget, revision)
    // 인종·누드 판별은 압축 전 원문(merged) 기준 — 압축 과정에서 명시적 언급이 잘려나가면
    // 기본값(한국인)이 사용자가 지정한 인종을 뒤집어버리는 버그가 있었다.
    const prompt = buildFashionMagazinePrompt({
      description: mergedForPrompt,
      mood,
      size,
      rawDescription: merged,
    })
    const negativePrompt = buildFashionNegativePrompt(merged)
    // 이 블록은 위에서 nudeRevision·clothingChangeRevision을 모두 걸러냈으므로 누드/탈의/
    // 착의/교체 케이스는 절대 여기 도달하지 않는다 — "전신으로/거울 앞에서" 같은 옷과
    // 무관한 순수 프레이밍·구도 변경만 처리한다.
    try {
      const dims = resolveReplicateImageSize(size)
      const { imageUrl: nextUrl } = await generateReplicateImage({
        apiToken: env.REPLICATE_API_TOKEN,
        modelOwner: env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based',
        modelName: env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning',
        modelVersion: env.REPLICATE_MODEL_VERSION,
        prompt,
        negativePrompt,
        disableSafetyChecker: true,
        numInferenceSteps: 14,
        guidanceScale: 4.2,
        ...dims,
      })
      return jsonResponse(
        {
          ok: true,
          imageUrl: nextUrl,
          prompt,
          mode,
          genMode,
          structuralRegen: true,
          engine: 'replicate',
          engineLabel: 'Replicate · 장면 재생성 (전신·구도 큰 수정)',
          message:
            '전신·구도처럼 큰 수정은 원본 유지 img2img 대신 장면 재생성으로 처리했어요.',
        },
        200,
      )
    } catch (error) {
      attempts.push({
        engine: 'replicate-t2i-structural',
        error: error instanceof Error ? error.message : 'unknown_error',
      })
    }
  }

  // img2img/inpaint 프롬프트는 "정확히 이 변경만 적용해줘"가 핵심이라 번역 품질이 특히 중요하다
  // (예: "귀걸이 추가해줘"가 한글 그대로 들어가면 이미지 모델이 못 읽어서 수정이 안 먹힘).
  const [{ text: baseDescriptionForPrompt }, { text: revisionForPrompt }] = await Promise.all([
    translateDescriptionForImagePrompt(baseDescription, env),
    translateDescriptionForImagePrompt(revision, env),
  ])
  // 몸매 투영은 번역문에서 의미가 흐려질 수 있어 원문/플래그로 전용 프롬프트를 쓴다.
  const nudeBecomesHit = isBodyProjectRequest(revision, bodyProjectFlag)
  let prompt =
    nudeBecomesHit && mode === 'text' && genMode === 'fashion' && !animalSubject
      ? buildNudeIdentityRefinePrompt(revision, baseDescription)
      : buildRefinePrompt({
          baseDescription: baseDescriptionForPrompt,
          revision: revisionForPrompt,
          mode,
          // 위에서 원문 한국어로 이미 판별한 animalSubject를 그대로 강제 반영한다(번역이 "말"을
          // 애매하게 옮겨서 buildRefinePrompt 내부의 자체 재판별이 놓치는 경우를 방지).
          genMode: genMode === 'fashion' && animalSubject ? 'free' : genMode,
        })
  if (framingExtendRevision) {
    prompt = `${prompt} ${buildFramingExtendRefineAddon(revision, baseDescription)}`
  }
  // 예전엔 이 분기에 품질/해부구조 네거티브(DEFAULT_NEGATIVE_PROMPT) 없이 "사람으로 바뀌지 말 것"
  // 문구만 있었다 — 아래에서 추가형 수정에 strength를 올리면 팔다리 개수가 틀어지는 등 해부구조
  // 오류 위험이 커지므로, 기본 품질 네거티브를 반드시 함께 넣는다.
  let negativePrompt =
    genMode === 'free' || animalSubject
      ? `${DEFAULT_NEGATIVE_PROMPT}, human fashion model, woman portrait, bathrobe, studio mugshot, replaced animal with human`
      // baseDescription과 revision을 따로 넘긴다 — buildFashionNegativePrompt가 최종 누드
      // 판별(wantsFullNude)만 내부적으로 분리해서 계산한다. 미리 합친 문자열 하나로 넘기면
      // baseDescription의 "치마를 입고 있다" 같은 기존 상태 서술 때문에 이번 revision의
      // 순수 탈의 요청("치마를 벗겨줘")까지 상쇄되어 negative prompt가 "missing outfit"을
      // 그대로 유지해 옷 제거 요청과 충돌하는 사고가 있었다.
      : buildFashionNegativePrompt(baseDescription, revision)
  if (framingExtendRevision && !nudeRevision) {
    negativePrompt = `${negativePrompt}, lower-body only crop, waist-down photo, headless body, nude lower body, different person, cropped at thighs, missing head, missing face`
  }
  // "추가해줘/넣어줘"처럼 원본에 없던 새 요소를 그리는 요청은 img2img strength를 더 줘야
  // 실제로 반영된다(낮은 strength는 원본 보존이 강해서 새 물체 합성이 잘 안 됨 — 실측 확인).
  const additive = mode === 'text' && !structural && isAdditiveRefineRevision(revision)

  // ── 영역 수정: inpaint 우선
  if (mode === 'region') {
    const maskDataUrl = (body.maskDataUrl ?? '').trim()
    if (!maskDataUrl.startsWith('data:image/')) {
      return jsonResponse({ ok: false, error: 'mask_required' }, 400)
    }
    if (maskDataUrl.length > 1_800_000) {
      return jsonResponse(
        {
          ok: false,
          error: 'mask_too_large',
          message: '선택 영역 데이터가 너무 커요. 영역을 줄이거나 텍스트로 수정을 시도해 주세요.',
        },
        413,
      )
    }
    if (!env.FAL_KEY?.trim()) {
      return jsonResponse(
        {
          ok: false,
          error: 'fal_key_required_for_region_refine',
          message: '영역 수정은 fal 키가 필요합니다. Cloudflare Secrets에 FAL_KEY를 등록해 주세요.',
        },
        500,
      )
    }

    try {
      // 올가미+귀걸이: strength 0.85는 마스크·건물 발명을 자주 함(실측) → 전용 프롬프트·강도↓
      const regionJewelry = wantsJewelryAccessoryRefine(revision)
      // 머리 제거·배경 메우기: 강도를 높여 흰 사각형/빈칸으로 남는 실패를 줄임
      const regionBgFill =
        /seamless continuation of the surrounding background|fill only the masked region|background fill|remove leftover head/i.test(
          revision,
        )
      const coupleClothes = coupleShot
      const regionPrompt = regionJewelry
        ? buildJewelryAccessoryRefinePrompt(revisionForPrompt || revision)
        : coupleClothes
          ? [
              'Local edit ONLY the white-masked clothes.',
              'Melt those garments to bare adult skin of the SAME woman already in the photo.',
              'Keep EVERY unmasked pixel exact: both faces, the man, his clothes, hands, hair, studio, crop.',
              'FORBIDDEN new person, Caucasian, bathroom, oval face sticker, undressing the man, moving anyone.',
              'Bare breasts with nipples if the mask covers the chest.',
              'If the mask covers the crotch: bare adult vulva with soft labia, a natural cleft, and a neat Korean-30s dark-brown CURLY mons patch. FORBIDDEN hairless Barbie mound, single crease, panties.',
              'Photorealistic.',
            ].join(' ')
          : regionBgFill
            ? [
                'Inpaint ONLY the white-masked area.',
                'Continue the real room background behind the person (wall, furniture, window, floor) — photoreal match to neighbors.',
                'No blank white rectangle, no empty patch, no solid color block.',
                'Remove any leftover head, hair, cutout fringe inside the mask.',
                'Do not change unmasked body, clothing, or other faces.',
                revisionForPrompt || revision,
              ].join(' ')
            : prompt
      const regionNegative = regionJewelry
        ? `${negativePrompt}, surgical mask, face mask, medical mask, KF94, N95, covering mouth, new building, extra architecture, changed background, different face, no earring, missing earring`
        : coupleClothes
          ? 'different face, Caucasian, new person, bathroom, bathtub, tiles, undressing the man, oval sticker, catalog model, clothes left in the mask'
          : regionBgFill
            ? `${negativePrompt}, blank white rectangle, solid white patch, empty hole, pure white fill, cutout fringe, leftover head, passport photo backdrop`
            : negativePrompt
      const { imageUrl: nextUrl } = await refineFalInpaint({
        falKey: env.FAL_KEY,
        imageUrl,
        maskUrl: maskDataUrl,
        prompt: regionPrompt,
        negativePrompt: regionNegative,
        strength: regionJewelry ? 0.62 : coupleClothes ? 0.85 : regionBgFill ? 0.92 : undefined,
      })
      return jsonResponse(
        {
          ok: true,
          imageUrl: nextUrl,
          prompt: regionPrompt,
          mode,
          genMode,
          engine: 'fal',
          engineLabel: regionJewelry
            ? 'fal.ai · Flux Inpaint (올가미 · 장신구만)'
            : coupleClothes
              ? 'fal.ai · 커플 (여자 옷 칸만 녹임)'
              : 'fal.ai · Flux Inpaint (영역만 수정)',
          regionCount: body.regionCount ?? 1,
          message: regionJewelry
            ? '선택한 귓불 영역에만 장신구를 넣도록 강도를 낮춰 처리했어요. 마스크·건물이 생기면 영역을 더 작게 잡고 다시 시도해 보세요.'
            : coupleClothes
              ? '올린 원본은 그대로 두고, 여자 옷 칸만 녹였습니다.'
              : undefined,
        },
        200,
      )
    } catch (error) {
      const regionErr = error instanceof Error ? error.message : 'failed'
      attempts.push({
        engine: 'fal-inpaint',
        error: regionErr,
      })
      const regionJewelryBusy =
        wantsJewelryAccessoryRefine(revision) &&
        /fal_provider_timeout|Too many subrequests/i.test(regionErr)
      if (regionJewelryBusy) {
        return jsonResponse(
          {
            ok: false,
            error: 'jewelry_provider_busy',
            message:
              '장신구 영역 수정 서버가 잠시 바빠요. 10~20초 뒤 다시 시도해 주세요. 영역을 더 작게 잡으면 성공률이 올라가요.',
            attempts,
          },
          503,
        )
      }
      if (coupleShot) {
        return jsonResponse(
          {
            ok: false,
            error: 'refine_failed',
            message: '여자 옷만 녹이지 못했습니다. 원본은 그대로 둡니다.',
            attempts,
          },
          500,
        )
      }
      if (env.REPLICATE_API_TOKEN?.trim()) {
        try {
          const dims = resolveReplicateImageSize(size)
          // 이 폴백은 실제 마스크를 전달하지 않고 이미지 전체를 다시 그린다. 그런데 위 `prompt`는
          // mode:'region'용으로 지어져 "마스크된 영역만 바꾸고 나머지는 보존하라"는 지시를
          // 포함한다 — 마스크가 없는 이 경로에서 그 지시를 그대로 쓰면, 전신 누드처럼 마스크
          // 밖 전체에 영향을 주는 요청이 "보존하라"는 문구에 눌려 반영되지 않는 사고가 실측으로
          // 확인됐다(바구니만 지워지고 인물은 그대로 옷을 입고 있는 등). 전체 이미지 수정이므로
          // mode:'text' 프롬프트로 다시 만든다.
          const wholeImagePrompt = buildRefinePrompt({
            baseDescription: baseDescriptionForPrompt,
            revision: revisionForPrompt,
            mode: 'text',
            genMode: genMode === 'fashion' && animalSubject ? 'free' : genMode,
          })
          // 누드/탈의뿐 아니라 착의·교체("가운으로 갈아입혀줘")도 기본 Lightning 엔진(8스텝)
          // 에서는 반영이 약하게 나오는 편향이 실측으로 확인된 케이스다 — generate.ts / 위
          // 구조적 재생성 분기와 동일하게 정밀 모델(스텝·CFG↑)로 자동 전환한다.
          const nudeFallback = wantsNudeOrUndress(`${baseDescription} ${revision}`)
          const clothingChangeFallback = isClothingChangeRevision(`${baseDescription} ${revision}`)
          const bigClothingFallback = nudeFallback || clothingChangeFallback
          // 라벨에는 실제로 "최종 상태가 누드인지"만 반영한다 — 옷을 교체하는 요청까지
          // "누드 요청"이라고 표시하면 사용자에게 혼란을 준다.
          // wantsFullNude는 revision만 단독으로 검사한다 — baseDescription은 "현재 청바지를
          // 입고 있다"처럼 기존 상태를 서술할 뿐인데, 이를 revision과 미리 합친 문자열
          // 하나로 검사하면 상쇄되어버리는 사고가 있었다 — wantsFullNude(revision,
          // baseDescription) 2-인자 버전을 써서 "이번 지시 우선, 없으면 이전 상태 승계"
          // 규칙으로 정확히 분리해서 판단한다.
          const fullNudeFallbackOutcome = bigClothingFallback && wantsFullNude(revision, baseDescription)
          // 실측(2026-08-22): 정밀모델(stability-ai/sdxl)은 낮은 strength(0.48 이하)에서는
          // 나체 요청을 거의 반영하지 못한다 — 위 구조적 재생성 분기와 동일하게 나체
          // 결과만 기본 모델(Lightning)+고강도로 분리한다. 일반 의상 교체는 기존 그대로.
          const nudeFallbackLightning = fullNudeFallbackOutcome
          // strength를 너무 올리면 수정 반복마다 얼굴이 하얗게/흑갈색으로 드리프트됨 — 얼굴 보존 우선
          const fallbackStrength = nudeFallbackLightning ? 0.85 : bigClothingFallback ? 0.48 : 0.38
          const usePrecisionForFallback = bigClothingFallback && !nudeFallbackLightning
          // 실측(2026-08-22): 프롬프트에 "shells, jewels, veils, wraps" 같은 장식 명사를
          // (제거 대상 예시로) 나열하면 SDXL류 모델이 그 명사를 오히려 새로 그려 넣는
          // 사고가 있었다 — 긍정 프롬프트에서는 명사를 빼고, 여기 negative prompt에서
          // 금지어로만 다룬다.
          const nudeFallbackNegative = nudeFallbackLightning
            ? `${negativePrompt}, jeweled wrap, decorative veil, shell bra, decorative belt over crotch, ornamental covering, fabric wrap over crotch, panties, thong, underwear`
            : negativePrompt
          const { imageUrl: nextUrl } = await refineReplicateImageToImage({
            apiToken: env.REPLICATE_API_TOKEN,
            modelOwner: usePrecisionForFallback
              ? env.REPLICATE_PRECISION_MODEL_OWNER?.trim() || 'stability-ai'
              : env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based',
            modelName: usePrecisionForFallback
              ? env.REPLICATE_PRECISION_MODEL_NAME?.trim() || 'sdxl'
              : env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning',
            modelVersion: usePrecisionForFallback ? env.REPLICATE_PRECISION_MODEL_VERSION : env.REPLICATE_MODEL_VERSION,
            imageUrl,
            prompt: wholeImagePrompt,
            negativePrompt: nudeFallbackNegative,
            width: dims.width,
            height: dims.height,
            strength: fallbackStrength,
            numInferenceSteps: usePrecisionForFallback ? 30 : undefined,
            guidanceScale: usePrecisionForFallback ? 7.5 : undefined,
            disableSafetyChecker: true,
          })
          return jsonResponse(
            {
              ok: true,
              imageUrl: nextUrl,
              prompt: wholeImagePrompt,
              mode: 'text',
              genMode,
              engine: 'replicate',
              engineLabel: bigClothingFallback
                ? fullNudeFallbackOutcome
                  ? 'Replicate · Img2Img (영역 수정 폴백 · 정밀모드, 누드 요청 자동 전환)'
                  : 'Replicate · Img2Img (영역 수정 폴백 · 정밀모드, 의상 변경 자동 전환)'
                : 'Replicate · Img2Img (영역 수정 폴백)',
              fallbackUsed: true,
              attempts,
              regionCount: body.regionCount ?? 1,
            },
            200,
          )
        } catch (fallbackError) {
          attempts.push({
            engine: 'replicate-img2img-fallback',
            error: fallbackError instanceof Error ? fallbackError.message : 'failed',
          })
        }
      }
      return jsonResponse(
        {
          ok: false,
          error: 'refine_failed',
          message:
            '영역 수정에 실패했어요. 영역을 하나씩 나눠 적용하거나, 텍스트로 수정을 시도해 주세요.',
          attempts,
        },
        500,
      )
    }
  }

  // ── 화보 모드: 탈의/나체
  // 몸매 투영은 Flux inpaint 1순위 금지 — 착의+웃음만 바꾸고 성공으로 끝나는
  // 회귀가 있었음 → Replicate 정밀 img2img를 먼저, Flux는 폴백.
  if (continueClothesEdit && env.FAL_KEY?.trim()) {
    try {
      const maskDataUrl = buildFacePreserveBodyMaskDataUrl({
        width: size === 'portrait' || size === 'story' ? 768 : 1024,
        height: size === 'story' ? 1344 : size === 'portrait' ? 1024 : 768,
        faceKeepRatio: size === 'landscape' ? 0.4 : 0.42,
      })
      const { text: clothesEn } = await translateDescriptionForImagePrompt(userRevision, env)
      const clothesPrompt = [
        'CAMERA: exact same crop. Head stays in frame. FORBIDDEN zoom-in.',
        'Local edit ONLY the masked white body. Keep the unmasked face pixels exact — same face, same hair, same age.',
        'Stay in the same pose and the same bed or room.',
        clothesEn || userRevision,
        'If the top comes off, keep a skirt on the lower body. She is not fully nude unless the user asked for full nude.',
        'FORBIDDEN new face, older face, fuller face, bathroom, black image, catalog model.',
        'Photorealistic.',
      ].join(' ')
      const { imageUrl: nextUrl } = await refineFalInpaint({
        falKey: env.FAL_KEY as string,
        imageUrl,
        maskUrl: maskDataUrl,
        prompt: clothesPrompt,
        negativePrompt:
          'different face, new person, older face, fuller face, bathroom, black image, catalog model, zoom-in',
        strength: 0.82,
      })
      return jsonResponse(
        {
          ok: true,
          imageUrl: nextUrl,
          prompt: clothesPrompt,
          mode,
          genMode,
          engine: 'fal',
          engineLabel: 'fal.ai · 이어서 옷만 (얼굴 잠금)',
          autoFacePreserveMask: true,
          message: '얼굴은 두고 옷만 고쳤습니다.',
          attempts: attempts.length ? attempts : undefined,
        },
        200,
      )
    } catch (error) {
      attempts.push({
        engine: 'fal-continue-clothes',
        error: error instanceof Error ? error.message : 'failed',
      })
    }
  }

  const autoUndressInpaint =
    mode === 'text' &&
    genMode === 'fashion' &&
    !animalSubject &&
    !coupleShot &&
    !continueLast &&
    wantsFullNude(revision, baseDescription)

  const runFacePreserveUndress = async () => {
    const maskDataUrl = buildFacePreserveBodyMaskDataUrl({
      width: size === 'portrait' || size === 'story' ? 768 : 1024,
      height: size === 'story' ? 1344 : size === 'portrait' ? 1024 : 768,
      // 앉은 사진·셀카는 얼굴이 가운데 있다. 0.42면 턱이 녹아 새 여자가 된다.
      faceKeepRatio: faceKeepRatio || (size === 'landscape' ? 0.4 : 0.42),
    })
    const inpaintPrompt = nudeBecomesHit
      ? [
          'CAMERA: exact same crop as the source. Head stays in frame. FORBIDDEN zoom-in, bust close-up.',
          'Local edit: ONLY the masked white body. Melt ALL clothes off this same woman.',
          'Keep the unmasked face pixels exact — same jaw, same age, same expression. Do not add glasses. Do not invent a new face.',
          'Same room, same camera crop. FORBIDDEN new face, glasses that were not on the face, wavy salon hair, bathroom tiles, catalog model, smile-only.',
          'Bare breasts with plain nipples. Smooth skin on the breasts, under the nipples, the belly, and the navel.',
          'FORBIDDEN moles, dark dots, speckles, or any hair on the breasts, belly, or around the navel. FORBIDDEN happy trail. The belly stays completely bare.',
          'Photorealistic.',
        ].join(' ')
      : [
          'CAMERA: exact same crop as the source. Head stays in frame. FORBIDDEN zoom-in, bust close-up.',
          'Local edit: ONLY change the masked white body area.',
          'FULL NUDE: remove ALL clothes from torso AND hips — blouse, bra, robe, sweater, pants, skirt, panties, thong, briefs.',
          'Bare adult breasts with visible nipples AND bare crotch — no underwear fabric left on.',
          'Smooth skin on the breasts, under the nipples, the belly, and the navel. FORBIDDEN moles, dark dots, speckles, or any hair on the breasts, belly, or navel. FORBIDDEN happy trail.',
          'Keep the unmasked face pixels exactly. Same woman, same glasses, same hair. Keep any other person outside the mask.',
          'FORBIDDEN new face, zoom, bathroom. Photorealistic.',
          revisionForPrompt ? `User request: ${revisionForPrompt}.` : '',
        ]
          .filter(Boolean)
          .join(' ')
    const { imageUrl: nextUrl } = await refineFalInpaint({
      falKey: env.FAL_KEY as string,
      imageUrl,
      maskUrl: maskDataUrl,
      prompt: inpaintPrompt,
      negativePrompt:
        'different face, new person, no glasses, wavy hair, salon model, bathroom tiles, clothes, robe, sweater, bra, panties, thong, briefs, underwear, bikini bottom, censored, mosaic, shaved, hairless doll, thin midline hair, landing strip, ink-blob triangle, dots under breasts, speckles on belly, moles under nipples, stippled abdomen, hair above navel, happy trail, pubic hair on stomach',
      strength: 0.88,
    })
    return { nextUrl, inpaintPrompt }
  }

  // 8월 27일에는 커플 글 수정도 여기서 이어졌다. 거절하지 않는다.

  // 자유 스튜디오: 전신 img2img가 얼굴을 화보 모델로 갈아엎는다. 얼굴은 마스크로 잠그고 목 아래만 녹인다.
  if (autoUndressInpaint && env.FAL_KEY?.trim()) {
    try {
      const { nextUrl, inpaintPrompt } = await runFacePreserveUndress()
      let imageUrlOut = await polishSkinDots(nextUrl)
      let pubicFinished = false
      if (!wantsExplicitPubicShave(revision) && (faceKeepRatio || 0) < 0.45) {
        try {
          imageUrlOut = await finishPubicHair(imageUrlOut)
          pubicFinished = true
        } catch (error) {
          attempts.push({
            engine: 'fal-pubic-finish',
            error: error instanceof Error ? error.message : 'failed',
          })
        }
      }
      return jsonResponse(
        {
          ok: true,
          imageUrl: imageUrlOut,
          prompt: inpaintPrompt,
          mode,
          genMode,
          engine: 'fal',
          engineLabel: nudeBecomesHit
            ? pubicFinished
              ? 'fal.ai · 몸매 투영 (얼굴 잠금 + 음모)'
              : 'fal.ai · 몸매 투영 (얼굴 잠금 inpaint)'
            : pubicFinished
              ? 'fal.ai · Flux Inpaint (탈의 · 음모)'
              : 'fal.ai · Flux Inpaint (탈의 · 얼굴 보존)',
          autoFacePreserveMask: true,
          autoPubicFinish: pubicFinished,
          message: nudeBecomesHit
            ? pubicFinished
              ? '얼굴·안경·방은 원본이고 목 아래 옷만 녹인 뒤 음모를 손봤습니다.'
              : '얼굴·안경·방은 원본이고 목 아래 옷만 녹였습니다.'
            : pubicFinished
              ? '얼굴은 두고 몸통 옷을 벗긴 뒤 음모를 손봤습니다.'
              : '얼굴은 두고 몸통 옷만 벗겼습니다.',
          attempts: attempts.length ? attempts : undefined,
        },
        200,
      )
    } catch (error) {
      attempts.push({
        engine: 'fal-auto-undress-inpaint',
        error: error instanceof Error ? error.message : 'failed',
      })
    }
  }

  // ── 한 장 안 세로 갈라짐(반반 옷색) 수리 — 두 패널 크롭과 다름
  const splitCompositeFix =
    mode === 'text' &&
    genMode === 'fashion' &&
    !animalSubject &&
    wantsSplitCompositeFix(revision)
  if (splitCompositeFix) {
    prompt = buildSplitCompositeFixPrompt(revisionForPrompt || revision)
    negativePrompt = `${negativePrompt}, vertical seam down the middle, half-and-half clothing, left-right different outfit colors, split torso, fused twin portrait, diptych`
  }

  // ── 귀걸이·목걸이·시계: 전신 img2img(strength↑)는 인물을 갈아엎음 → 국소 inpaint
  // (호랑이+사람처럼 동물 단어가 있어도 장신구 요청이면 허용 — animalSubject로 막지 않음)
  const jewelryOnly =
    mode === 'text' &&
    genMode === 'fashion' &&
    wantsJewelryAccessoryRefine(revision) &&
    !splitCompositeFix &&
    !nudeRevision
  if (jewelryOnly && env.FAL_KEY?.trim()) {
    const wristAccessory = wantsWristAccessoryRefine(revision)
    const necklaceAccessory = wantsNecklaceRefine(revision)
    const wristAndNeck = wristAccessory && necklaceAccessory
    try {
      const maskW = size === 'portrait' || size === 'story' ? 768 : 1024
      const maskH = size === 'story' ? 1344 : size === 'portrait' ? 1024 : 768
      const maskDataUrl = wristAndNeck
        ? buildWristAndNeckJewelryMaskDataUrl({ width: maskW, height: maskH })
        : wristAccessory
          ? buildWristJewelryMaskDataUrl({ width: maskW, height: maskH })
          : necklaceAccessory
            ? buildNeckJewelryMaskDataUrl({ width: maskW, height: maskH })
            : buildEarJewelryMaskDataUrl({ width: maskW, height: maskH })
      const revText = revisionForPrompt || revision
      const jewelryPrompt = wristAndNeck
        ? buildWristAndNecklaceRefinePrompt(revText)
        : wristAccessory
          ? buildWristWatchRefinePrompt(revText)
          : necklaceAccessory
            ? buildNecklaceRefinePrompt(revText)
            : buildJewelryAccessoryRefinePrompt(revText)
      const { imageUrl: nextUrl } = await refineFalInpaint({
        falKey: env.FAL_KEY,
        imageUrl,
        maskUrl: maskDataUrl,
        prompt: jewelryPrompt,
        negativePrompt: wristAndNeck
          ? 'different face, new person, changed hair, changed clothes, changed background, surgical mask, leftover necklace, cross pendant still visible, bare wrist without accessory, missing watch, missing bracelet'
          : wristAccessory
            ? 'different face, new person, changed hair, changed clothes, changed background, surgical mask, no watch, missing watch, bare wrist without accessory'
            : necklaceAccessory
              ? 'different face, new person, changed hair, changed clothes, leftover necklace, cross pendant, chain still visible, surgical mask'
              : 'different face, new person, studio mugshot, changed hair, changed clothes, changed background, two people, diptych, surgical mask, face mask, medical mask, KF94, N95, covering mouth, new building, extra architecture, no earring, missing earring',
        strength: 0.62,
      })
      return jsonResponse(
        {
          ok: true,
          imageUrl: nextUrl,
          prompt: jewelryPrompt,
          mode,
          genMode,
          engine: 'fal',
          engineLabel: wristAndNeck
            ? 'fal.ai · Flux Inpaint (손목+목걸이)'
            : wristAccessory
              ? 'fal.ai · Flux Inpaint (손목 시계·팔찌만)'
              : necklaceAccessory
                ? 'fal.ai · Flux Inpaint (목걸이만)'
                : 'fal.ai · Flux Inpaint (귀걸이·장신구만)',
          autoEarMask: !wristAccessory && !necklaceAccessory,
          autoWristMask: wristAccessory || undefined,
          autoNeckMask: necklaceAccessory || undefined,
          message: wristAndNeck
            ? '손목에 시계/팔찌를 넣고 목걸이 영역을 함께 손봤어요. 부족하면 올가미로 손목·목만 지정해 다시 시도하세요.'
            : wristAccessory
              ? '얼굴·옷·배경은 두고 손목 부근에만 시계/팔찌를 넣었어요. 손목이 안 보이는 클로즈업이면 전신·상반신으로 구도를 넓힌 뒤 다시 시도하거나, 올가미로 손목만 지정하세요.'
              : necklaceAccessory
                ? '목·쇄골 부근만 손봐 목걸이를 처리했어요. 남아 있으면 올가미로 목걸이만 지정해 다시 시도하세요.'
                : '얼굴·몸·배경은 원본 그대로 두고 귀 부근에만 장신구를 넣었어요. 안 보이면 올가미로 귀만 지정해 다시 시도해 보세요.',
          attempts: attempts.length ? attempts : undefined,
        },
        200,
      )
    } catch (error) {
      const jewelryErr = error instanceof Error ? error.message : 'failed'
      attempts.push({
        engine: 'fal-jewelry-inpaint',
        error: jewelryErr,
      })
      // 타임아웃·서브요청 한도면 img2img 폴백도 같은 Worker에서 바로 터짐 → 조기 안내
      if (/fal_provider_timeout|Too many subrequests/i.test(jewelryErr)) {
        return jsonResponse(
          {
            ok: false,
            error: 'jewelry_provider_busy',
            message:
              '장신구 수정 서버가 잠시 바빠요. 10~20초 뒤 다시 시도해 주세요. 안 되면 요청을 나눠 「손목에 시계·팔찌」와 「목걸이 제거」를 따로 적용하거나, 올가미로 해당 부위만 지정해 보세요.',
            attempts,
          },
          503,
        )
      }
      const revText = revisionForPrompt || revision
      prompt = wristAndNeck
        ? buildWristAndNecklaceRefinePrompt(revText)
        : wristAccessory
          ? buildWristWatchRefinePrompt(revText)
          : necklaceAccessory
            ? buildNecklaceRefinePrompt(revText)
            : buildJewelryAccessoryRefinePrompt(revText)
    }
  }

  // ── 유두·유륜만 (가슴 밴드 inpaint) — 음모와 한 문장에 있으면 유두 먼저
  // 주의: "나체로 만들어줘, 음모도 자연스럽게" 처럼 전신 탈의 요청에 유두/음모 단어가
  // 같이 있으면, 예전엔 이 국소 inpaint(옷은 그대로 두고 마스크 부위만 살짝 손봄)로
  // 잘못 가로채져서 "옷을 안 벗김" 회귀가 났다(jewelryOnly는 이미 이 가드가 있었는데
  // 유두/음모 경로만 빠져 있었다) — nudeRevision(전신 탈의 의도)이 있으면 이 국소
  // 경로를 건너뛰고 아래 일반 탈의 경로로 넘긴다.
  const nippleAreolaOnly =
    mode === 'text' &&
    genMode === 'fashion' &&
    !animalSubject &&
    wantsNippleAreolaRefine(revision) &&
    !splitCompositeFix &&
    !jewelryOnly &&
    !nudeRevision
  // 유두+음모 한 문장이면 유두를 먼저 처리하고, 음모는 다음 수정으로 안내
  if (nippleAreolaOnly && env.FAL_KEY?.trim()) {
    try {
      const maskDataUrl = buildBreastDetailMaskDataUrl({
        width: size === 'portrait' || size === 'story' ? 768 : 1024,
        height: size === 'story' ? 1344 : size === 'portrait' ? 1024 : 768,
      })
      const nipplePrompt = buildNippleAreolaRefinePrompt(revisionForPrompt || revision)
      const { imageUrl: nextUrl } = await refineFalInpaint({
        falKey: env.FAL_KEY,
        imageUrl,
        maskUrl: maskDataUrl,
        prompt: nipplePrompt,
        negativePrompt:
          'tiny barbie nipples, blank breasts, censored, mosaic, different face, changed body, clothes',
      })
      const alsoPubic = wantsPubicHairOnlyRefine(revision)
      return jsonResponse(
        {
          ok: true,
          imageUrl: nextUrl,
          prompt: nipplePrompt,
          mode,
          genMode,
          engine: 'fal',
          engineLabel: 'fal.ai · Flux Inpaint (유두·유륜만)',
          autoBreastMask: true,
          message: alsoPubic
            ? '유두·유륜만 먼저 손봤어요. 이어서 「음모 조금 더 풍성하고 곱슬·가닥 보이게」로 한 번 더 수정하세요.'
            : '가슴(유두·유륜) 부위만 손봤어요.',
          attempts: attempts.length ? attempts : undefined,
        },
        200,
      )
    } catch (error) {
      attempts.push({
        engine: 'fal-nipple-inpaint',
        error: error instanceof Error ? error.message : 'failed',
      })
      prompt = buildNippleAreolaRefinePrompt(revisionForPrompt || revision)
    }
  }

  // ── 체모·음모만 사실적으로 (쇼츠 엔진은 그대로 — 정지 이미지 국소 수정)
  // nippleAreolaOnly와 동일한 이유로 nudeRevision(전신 탈의 의도) 가드 추가 —
  // "나체로, 음모 자연스럽게" 같은 요청이 옷은 그대로 두고 음모 패치만 그리는
  // 사고로 새지 않게 한다.
  const pubicHairOnly =
    mode === 'text' &&
    genMode === 'fashion' &&
    !animalSubject &&
    wantsPubicHairOnlyRefine(revision) &&
    !splitCompositeFix &&
    !jewelryOnly &&
    !nudeRevision
  if (pubicHairOnly && env.FAL_KEY?.trim()) {
    try {
      const maskDataUrl = buildPubicRegionMaskDataUrl({
        width: size === 'portrait' || size === 'story' ? 768 : 1024,
        height: size === 'story' ? 1344 : size === 'portrait' ? 1024 : 768,
      })
      const pubicPrompt = buildRealisticPubicHairRefinePrompt(revisionForPrompt || revision)
      const { imageUrl: nextUrl } = await refineFalInpaint({
        falKey: env.FAL_KEY,
        imageUrl,
        maskUrl: maskDataUrl,
        prompt: pubicPrompt,
        negativePrompt:
          'male pubic trail to navel, happy trail, jet black ink blob, censored, mosaic, different face, clothes, panties',
      })
      return jsonResponse(
        {
          ok: true,
          imageUrl: nextUrl,
          prompt: pubicPrompt,
          mode,
          genMode,
          engine: 'fal',
          engineLabel: 'fal.ai · Flux Inpaint (체모·음모만)',
          autoPubicMask: true,
          message:
            '얼굴·가슴은 두고 하복부 체모만 손봤어요. 쇼츠는 이 정지 이미지로 다시 만들면 반영됩니다.',
          attempts: attempts.length ? attempts : undefined,
        },
        200,
      )
    } catch (error) {
      attempts.push({
        engine: 'fal-pubic-inpaint',
        error: error instanceof Error ? error.message : 'failed',
      })
      // 아래 Replicate로 폴백 (프롬프트는 체모 전용으로 교체)
      prompt = buildRealisticPubicHairRefinePrompt(revisionForPrompt || revision)
    }
  }

  // ── 화보 모드 전용: 작은 텍스트 수정만 얼굴 유지 img2img
  // (자유 모드는 위에서 이미 return — 여기 도달하지 않음)
  // 나체/몸매 투영은 전신 img2img 를 타면 얼굴이 화보 모델로 바뀐다. inpaint 가 실패한 뒤에는 여기서 한 번 더 갈아엎지 않는다.
  if (env.REPLICATE_API_TOKEN?.trim() && !autoUndressInpaint) {
    try {
      const dims = resolveReplicateImageSize(size)
      const structuralFallbackClothing = structural && (nudeRevision || clothingChangeRevision)
      const framingExtendBoost = framingExtendRevision && !nudeRevision
      const fullNudeOutcome = structuralFallbackClothing && wantsFullNude(revision, baseDescription)
      const usePrecision = structuralFallbackClothing || framingExtendBoost
      // 실측(라이브 재현 테스트, 2026-08-22): "완전 나체" 결과만 놓고 보면 정밀 모델
      // (stability-ai/sdxl, strength 0.72~0.95)은 같은 프롬프트로도 거의 항상 실패한다 —
      // 옷이 그대로 남거나(strength 0.72) 상의만 벗겨지고 하의는 그대로 남는다(strength
      // 0.95). 반대로 기본 모델(juggernaut-xl-lightning)은 strength 0.82~0.88·Lightning
      // 기본 스텝(8)·기본 가이던스(2.2)에서 반복 테스트 전부 성공(상하의 모두 제거,
      // 바비돌/속옷 잔존 없음) — "정밀모드가 나체에 더 안정적"이라던 예전 코멘트는 이번
      // 재현 테스트로 뒤집혔다. 나체(fullNudeOutcome/nudeBecomesHit)만 골라 기본 모델+
      // 고강도로 보내고, 그 외(장신구·체모·세로 갈라짐·프레이밍 확장·일반 의상 교체)는
      // 기존 정밀모드 그대로 둔다(이 경로들은 이번에 재검증하지 않았음).
      const nudeLightning = fullNudeOutcome || nudeBecomesHit
      // 탈의는 SDXL 정밀이 Flux보다 나체 반영이 안정적(실측) — strength 0.74
      // (0.62에서도 완전 착의→나체가 "변화 없음"인 경우가 있어 상향; 얼굴은 짧은 나체 전용 프롬프트로 유지)
      // 체모만: 얼굴 보존 위해 strength↓·정밀모드
      // 세로 갈라짐 수리는 구도 재통합이 필요해 strength·정밀↑
      // 장신구: strength 0.42 additive는 인물 치환 실측 → 0.2로 최소화
      const strength = jewelryOnly
        ? 0.2
        : splitCompositeFix
          ? 0.5
          : pubicHairOnly
            ? 0.38
            : framingExtendBoost
              ? 0.48
              : nudeLightning
                ? 0.85
                : structural
                    ? structuralFallbackClothing
                      ? 0.52
                      : 0.42
                    : additive
                      ? 0.3
                      : 0.24
      // 장신구 폴백은 Lightning+저강도 — 정밀 SDXL은 인물 재생성 편향이 큼
      // 몸매 투영 inpaint 실패 시에만 여기로 — 체형 유지를 위해 strength 과고(0.85+) 금지
      const usePrecisionForRun =
        (usePrecision || pubicHairOnly || splitCompositeFix) && !nudeLightning
      const nudePrompt =
        nudeBecomesHit || fullNudeOutcome
          ? buildNudeIdentityRefinePrompt(revision, baseDescription)
          : prompt
      const { imageUrl: nextUrl } = await refineReplicateImageToImage({
        apiToken: env.REPLICATE_API_TOKEN,
        modelOwner: usePrecisionForRun
          ? env.REPLICATE_PRECISION_MODEL_OWNER?.trim() || 'stability-ai'
          : env.REPLICATE_MODEL_OWNER?.trim() || 'sdxl-based',
        modelName: usePrecisionForRun
          ? env.REPLICATE_PRECISION_MODEL_NAME?.trim() || 'sdxl'
          : env.REPLICATE_MODEL_NAME?.trim() || 'juggernaut-xl-lightning',
        modelVersion: usePrecisionForRun
          ? env.REPLICATE_PRECISION_MODEL_VERSION
          : env.REPLICATE_MODEL_VERSION,
        imageUrl,
        prompt: nudePrompt,
        negativePrompt: jewelryOnly
          ? `${negativePrompt}, different person, new face, studio headshot, changed haircut, changed outfit, changed background`
          : pubicHairOnly
            ? `${negativePrompt}, male pubic trail, happy trail to navel, jet black pubic blob`
            : fullNudeOutcome || nudeBecomesHit
          ? `${negativePrompt}, panties, thong, briefs, bikini bottom, underwear on crotch, lingerie bottoms, clothes, dressed, different body shape, slimmed body, barbie body, jeweled wrap, decorative veil, shell bra, decorative belt over crotch, ornamental covering, fabric wrap over crotch`
          : negativePrompt,
        width: dims.width,
        height: dims.height,
        strength,
        numInferenceSteps: usePrecisionForRun ? 32 : undefined,
        guidanceScale: usePrecisionForRun ? 8 : undefined,
        disableSafetyChecker: true,
      })
      const polished =
        nudeBecomesHit || fullNudeOutcome ? await polishSkinDots(nextUrl) : nextUrl
      return jsonResponse(
        {
          ok: true,
          imageUrl: polished,
          prompt: nudePrompt,
          mode,
          genMode,
          structuralRegen: false,
          engine: 'replicate',
          engineLabel: jewelryOnly
            ? 'Replicate · Img2Img (장신구만 · 인물 보존·저강도)'
            : splitCompositeFix
              ? 'Replicate · Img2Img (세로 갈라짐 수리 · 한 사람·한 옷)'
              : pubicHairOnly
                ? 'Replicate · Img2Img (체모·음모만 · 정밀모드)'
                : framingExtendBoost
                  ? 'Replicate · Img2Img (전신·프레이밍 확장 · 동일 인물)'
                  : nudeBecomesHit
                    ? 'Replicate · Img2Img (몸매 투영)'
                    : structuralFallbackClothing
                    ? fullNudeOutcome
                      ? 'Replicate · Img2Img (누드 요청 · 얼굴 보존 · 고강도)'
                      : 'Replicate · Img2Img (의상 변경 · 얼굴 보존 · 정밀모드)'
                    : structural
                      ? 'Replicate · Img2Img (장면 재생성 실패 · 보조 경로)'
                      : additive
                        ? 'Replicate · Img2Img (요소 추가)'
                        : 'Replicate · Img2Img (얼굴 유지 수정)',
          fallbackUsed: structural && !structuralFallbackClothing && !framingExtendBoost ? true : undefined,
          message: jewelryOnly
            ? '장신구만 넣도록 저강도로 처리했어요. 인물이 바뀌면 「이전과 비교」→「이 버전에서 다시 수정」후, 올가미로 귀만 지정해 보세요.'
            : splitCompositeFix
              ? '한 장 안에서 세로로 갈라진 옷/색을 한 사람·한 옷으로 맞춰 봤어요. 부족하면 같은 요청으로 한 번 더 적용해 보세요.'
              : pubicHairOnly
                ? '체모·음모만 손봤어요. 쇼츠에 반영하려면 이 이미지로 쇼츠를 다시 만들어 주세요.'
                : framingExtendBoost
                  ? '같은 사람을 유지한 채 무릎·발목까지 보이도록 구도를 넓혔어요. 부족하면 「이전과 비교」후 한 번 더 다듬어 보세요.'
                  : nudeBecomesHit
                    ? '몸매 투영: 옷을 약하게 남긴 채 페이드로 녹여 같은 체형을 드러냈어요. 옷이 남으면 「몸매 투영」을 한 번 더 눌러 보세요.'
                    : structuralFallbackClothing
                    ? fullNudeOutcome
                      ? '탈의·나체는 기본 모델을 고강도로 돌려 처리했어요. 얼굴이 어긋나면 「이전과 비교」→「이 버전에서 다시 수정」후 다시 적용해 보세요.'
                      : '원본 인물의 얼굴을 자동 보존해 처리했어요. 의상 변경이 약하면 바꿀 내용만 다시 적어 수정해 주세요.'
                    : structural
                      ? '장면을 통째로 다시 그리는 재생성이 실패해서, 원본을 더 보존하는 보조 방식으로 대체했어요. 큰 변경이 기대만큼 반영되지 않았을 수 있어요 — 필요하면 다시 수정하기를 눌러 재시도해 주세요.'
                      : undefined,
          attempts: attempts.length ? attempts : undefined,
        },
        200,
      )
    } catch (error) {
      attempts.push({
        engine: 'replicate-img2img',
        error: error instanceof Error ? error.message : 'unknown_error',
      })
    }
  } else if (!autoUndressInpaint) {
    attempts.push({ engine: 'replicate-img2img', error: 'replicate_token_not_configured' })
  }

  // 얼굴보존 inpaint 는 위에서 이미 1순위로 돌렸다. 전신 Flux img2img 는 얼굴을 바꾸므로 나체 경로에서는 쓰지 않는다.
  if (!autoUndressInpaint && env.FAL_KEY?.trim()) {
    try {
      const { imageUrl: nextUrl } = await refineFalImageToImage({
        falKey: env.FAL_KEY,
        imageUrl,
        prompt,
        strength: structural ? 0.28 : additive ? 0.4 : 0.22,
      })
      return jsonResponse(
        {
          ok: true,
          imageUrl: nextUrl,
          prompt,
          mode,
          genMode,
          engine: 'fal',
          engineLabel: 'fal.ai · Flux Img2Img (얼굴 유지 수정)',
          fallbackUsed: true,
          attempts,
        },
        200,
      )
    } catch (error) {
      attempts.push({
        engine: 'fal-img2img',
        error: error instanceof Error ? error.message : 'unknown_error',
      })
    }
  } else if (!autoUndressInpaint) {
    attempts.push({ engine: 'fal-img2img', error: 'fal_key_not_configured' })
  }

  return jsonResponse(
    {
      ok: false,
      error: 'refine_failed',
      message: '원본을 유지한 수정에 실패했어요. 잠시 후 다시 시도해 주세요.',
      attempts,
    },
    500,
  )
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204 })
}
