import { wantsNudeOrUndress, wantsDeskSitOrLie, wantsSlipOrSilkLook } from './nude-intent'
import { wantsExplicitPubicShave, buildStillWomanBustHint } from './nude-anatomy-locks'

/** Juggernaut/SDXL CLIP은 ~77토큰. 칸을 쌓되 동작([DO])이 항상 맨 앞. */
export const DESK_STILL_PROMPT_MAX = 420

export type DeskLookKind = 'nude' | 'silk' | 'clothes'
export type DeskActionKind = 'none' | 'kiss' | 'hug' | 'breast'
export type DeskStillStep = 'look' | 'place' | 'cut' | 'together' | ''

export type DeskIntent = {
  step: DeskStillStep
  couple: boolean
  look: DeskLookKind
  action: DeskActionKind
}

/** 겉옷 검정은 됨. 속옷·브라·팬티·크롭·숏츠는 검정 금지. */
export const DESK_NO_BLACK_UNDERWEAR =
  'Ivory or cream only for bra, panty, sports-bra, crop top, and bike shorts. FORBIDDEN black underwear, black panty, black bra, charcoal base-layer.'

/** 몸 잇기가 크림 재킷을 내면 검정만 되돌린다. */
export function buildDeskExtendJacketPrompt(): string {
  return [
    'Same exact woman, same face, same hair, same standing pose, same studio.',
    'Change only the cream, ivory, beige, or white jacket into a black office blazer.',
    'Keep the same black V-neck or knit under the jacket.',
    'Photoreal. FORBIDDEN a new face, leftover cream jacket, an ivory blazer, trousers, a pantsuit, a beige plate, an oval sticker.',
  ].join(' ')
}

/** 가슴 크롭: 검정 재킷만 제공 옷 색 가족으로. 얼굴은 보내지 않음. */
export function buildDeskExtendJacketLightPrompt(clothHex = ''): string {
  const color = clothHex ? `cream ivory ${clothHex}` : 'cream ivory matching the trousers'
  return [
    'This photo is already a crop of a jacket and chest. Keep the exact same crop, pose, and background. Do not add a head.',
    `Change ONLY the black blazer into a ${color} jacket. Keep the white shirt if present.`,
    'Photoreal. FORBIDDEN a new crop, a face, a black blazer, brown stains, a beige plate.',
  ].join(' ')
}

/** 크림 재킷은 두고 검정 바지만 제공 옷 색 가족으로. */
export function buildDeskExtendPantsPrompt(clothHex = ''): string {
  const color = clothHex ? `cream ivory ${clothHex}` : 'cream ivory matching the jacket at the top'
  return [
    'This photo is already a crop of the waist, legs, hands, and shoes.',
    'Keep the exact same crop, pose, hands, and background. Do not add a head or a new torso.',
    `Change ONLY the black trousers and black shoes into ${color} trousers and cream flats.`,
    'Even cream fabric. No brown stains, no dirty patches, no squares on the thighs.',
    'Photoreal. FORBIDDEN a new crop, a face, black pants, black shoes, a beige plate, brown stains.',
  ].join(' ')
}

/** 검정 정장을 제공 사진과 같은 밝은 옷 색으로. */
export function buildDeskExtendRecolorPrompt(clothHex = ''): string {
  const color = clothHex ? `cream ivory ${clothHex}` : 'cream ivory from the identity cloth'
  return [
    'Keep this exact woman, exact face, exact standing pose.',
    `Recolor the black office suit into a ${color} zip knit or jacket and matching light trousers.`,
    'Photoreal. FORBIDDEN a new face, a black blazer, black trousers, a catalog model, a beige plate.',
  ].join(' ')
}

/** 몸 잇기가 제공 사진과 다른 색으로 바꾸면 그 색으로 되돌린다. */
export function buildDeskExtendKeepLightPrompt(clothHex = ''): string {
  const color = clothHex ? `exact cloth color ${clothHex}` : 'the exact cloth color from image 2'
  return [
    'Image 1 is the standing full body. Image 2 is the identity photograph.',
    'Same exact woman, same face, same hair, same standing pose, same studio.',
    `Change only the mismatched clothes into the same ${color} zip knit from image 2.`,
    'Keep image 2 fabric color exactly. Lower body stays in that same color family. Photoreal.',
    'FORBIDDEN a different color, a black office suit, a brighter white catalog outfit, black trousers, black pumps, a new face, a beige plate.',
  ].join(' ')
}

/** 몸 잇기가 롱코트·플레어로 내리면 재킷+무릎 펜슬로 되돌린다. */
export function buildDeskExtendSkirtPrompt(): string {
  return [
    'Same exact woman, same face, same hair, same standing pose, same studio.',
    'Change only the long coat or flared dress into a short black office blazer over a matching black pencil skirt.',
    'Blazer hem at the hip. Skirt hem at the knee, straight and slim. Thighs stay visible below the hem.',
    'Keep the black V-neck. Photoreal. FORBIDDEN a long coat, a coat-dress, an A-line flare, a midi hem, trousers, a new face.',
  ].join(' ')
}

/** 팔 길이를 보게 — 아이보리 크롭+숏츠. 같은 얼굴·같은 자세. Kontext용이라 420자 CLIP 상한을 쓰지 않는다. */
export function buildDeskShapePrompt(strict = false): string {
  return [
    ...(strict
      ? ['Keep the exact same pose, the exact same head position, the same head size and the same body position as the source. Do not move, tilt or resize the head.']
      : []),
    'Same exact woman, same face, same hair, same standing pose, same studio.',
    'Keep the exact same full-body camera. Head to shoes in frame. Same distance. Do not crop or zoom.',
    'Change her outfit to an ivory cream athletic crop top and matching ivory high-waist bike shorts.',
    DESK_NO_BLACK_UNDERWEAR,
    'Arms hang at her sides. Both hands stay fully visible beside the thighs so arm length can be judged. Fingertips near mid-thigh. Shoes stay visible.',
    'Photoreal. FORBIDDEN a new face, a catalog model, a waist crop, missing shoes, a zoom-in, a beige plate, black underwear.',
  ].join(' ')
}

export function parseDeskLookKind(lookId?: string, text = ''): DeskLookKind {
  const id = String(lookId || '').trim()
  if (id === 'nude') return 'nude'
  if (id === 'silk') return 'silk'
  if (wantsNudeOrUndress(text)) return 'nude'
  if (wantsSlipOrSilkLook(text)) return 'silk'
  return 'clothes'
}

export function parseDeskActionKind(actionId?: string, text = ''): DeskActionKind {
  const id = String(actionId || '').trim()
  if (id === 'kiss' || id === 'hug' || id === 'breast') return id
  const t = text || ''
  if (/키스|입맞춤|kiss/i.test(t)) return 'kiss'
  if (/포옹|안기게|서로 안|안는다|껴안|\bhug\b/i.test(t)) return 'hug'
  if (/가슴|breast/i.test(t)) return 'breast'
  return 'none'
}

export function parseDeskIntent(
  descriptionKo: string,
  couple = false,
  step = '',
  hints?: { look?: string; action?: string; couple?: boolean },
): DeskIntent {
  const t = descriptionKo || ''
  return {
    step: step === 'look' || step === 'place' || step === 'cut' || step === 'together' ? step : '',
    couple: hints?.couple === true || hints?.couple === false ? hints.couple : Boolean(couple),
    look: parseDeskLookKind(hints?.look, t),
    action: parseDeskActionKind(hints?.action, t),
  }
}

type DeskStillKey = 'DO' | 'BODY' | 'KEEP'

function userHint(text: string, max = 48): string {
  const t = (text || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  return t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, '').trim()
}

function packDeskStill(parts: string[]): string {
  const out = parts.filter(Boolean).join(' ').replace(/\s{2,}/g, ' ').trim()
  if (out.length <= DESK_STILL_PROMPT_MAX) return out
  // 넘치면 문장 끝에서 자른다. 단어 중간에서 끊으면 마지막 칸이 "FORBIDDEN new" 같은 반쪽 지시가 된다.
  const cut = out.slice(0, DESK_STILL_PROMPT_MAX)
  const lastStop = cut.lastIndexOf('. ')
  if (lastStop > DESK_STILL_PROMPT_MAX * 0.6) return cut.slice(0, lastStop + 1).trim()
  return cut.replace(/\s+\S*$/, '').trim()
}

function assembleDeskStill(sections: Array<{ key: DeskStillKey; text: string }>): string {
  return packDeskStill(
    sections
      .filter((s) => s.text.trim())
      .map((s) => `[${s.key}] ${s.text.replace(/\s{2,}/g, ' ').trim()}`),
  )
}

/** 나체 BODY — 검정 팬티로 음모를 가리는 실측, 민무늬 공백, 안개 가짜팬티 */
function deskNudeBody(text: string, couple: boolean): string {
  const pubic = wantsExplicitPubicShave(text)
    ? 'bare crotch, shaved as asked. panty OFF.'
    : 'bare crotch, Korean-30s pubic curly mons, soft labia, natural cleft. panty OFF.'
  const who = couple ? 'CAST woman-slot only. CAST man-slot stays dressed.' : 'Same woman nude.'
  return `${who} ${buildStillWomanBustHint(text)} ${pubic} FAILED black panty, fog, hairless Barbie, single crease.`
}

// 슬립은 몸을 드러내는 일이 아니라 옷을 갈아입히는 일이다. 나체 문구를 섞으면
// 엔진이 몸을 다시 그리고, 실측처럼 엉덩이가 12% 줄어든 딴 몸이 나온다.
function deskSlipDo(couple: boolean): string {
  return couple
    ? 'Edit in place. CAST woman-slot only: change her outfit to one silk slip dress. CAST man-slot stays. FORBIDDEN two women, new faces, assume right=woman, nudity.'
    : 'Edit in place. Same woman, same body shape, same hair, same room. Change her outfit to one silk slip dress. FORBIDDEN new face, slimmer body, white studio, catalog model, nudity.'
}

function deskSlipBody(text = ''): string {
  return `one silk slip dress, spaghetti straps, bias cut, hem below the knee. Keep her own shoulder width, waist and hips. ${buildStillWomanBustHint(text)} FAILED nudity, thigh-short hem, slimmed body, model proportions.`
}

function deskKeep(couple: boolean, clothesStay: boolean): string {
  const face = couple ? 'same faces. CAST man-slot stays male.' : 'same source face, same hair.'
  const rest = clothesStay
    ? 'same pose, crop, clothes.'
    : couple
      ? 'same pose, crop. hug stays. FORBIDDEN stand apart, two women.'
      : 'same pose, crop, body, room. FORBIDDEN new model, white studio, slim beauty.'
  // 나이 문구를 앞에 둔다. 뒤에 두면 길이 상한에서 먼저 잘려 나간다.
  return `Adult 18+. ${face} ${rest}`
}

export function buildDeskStillPrompt(
  descriptionKo: string,
  couple = false,
  step = '',
  hints?: { look?: string; action?: string; couple?: boolean },
): string {
  const intent = parseDeskIntent(descriptionKo, couple, step, hints)
  const t = descriptionKo || ''
  const lie = /눕|누워|lying/i.test(t)
  const slip = intent.look === 'silk'
  const nudeLook = intent.look === 'nude'
  couple = intent.couple
  const sit = /앉|sit(?:ting)?/i.test(t)
  const stand = /서서|서기|stand(?:ing)?/i.test(t)
  const hug = intent.action === 'hug' || (couple && /포옹|안기게|서로 안|안는다|껴안|\bhug\b/i.test(t))
  const sitLie = wantsDeskSitOrLie(t)

  if (step === 'together') {
    return assembleDeskStill([
      { key: 'DO', text: 'both source adults in ONE photo. same height. same clothes.' },
      { key: 'KEEP', text: deskKeep(true, true) },
    ])
  }

  if (step === 'look') {
    const action = nudeLook
      ? couple
        ? 'Edit in place. CAST woman-slot melt clothes panty OFF. CAST man-slot stays male+clothes. FORBIDDEN two women, gender-swap, new faces, assume right=woman.'
        : 'Edit in place. Same woman, same body, same hair, same room. Melt clothes only, panty OFF, ZERO thong. FORBIDDEN new face, slim model, white studio.'
      : slip
        ? deskSlipDo(couple)
        : couple
          ? 'Edit in place. CAST woman-slot melt outfit. CAST man-slot stays. FORBIDDEN two women, gender-swap, new faces, assume right=woman.'
          : 'Edit source in place. Melt clothes into the requested outfit. FORBIDDEN new face, white studio.'
    const body = nudeLook
      ? deskNudeBody(t, couple)
      : slip
        ? deskSlipBody(t)
        : `${buildStillWomanBustHint(t)} ivory/beige second-skin bodycon micro mini, cling hips and inner thighs, hem at the panty line, 5cm shorter. FORBIDDEN black A-line, flare, mid-thigh, 1970s office.`
    const hint = !nudeLook && !slip ? userHint(t) : ''
    return assembleDeskStill([
      { key: 'DO', text: hint ? `${action} User: ${hint}` : action },
      { key: 'BODY', text: body },
      { key: 'KEEP', text: deskKeep(couple, !nudeLook && !slip) },
    ])
  }

  if (step === 'place') {
    const action = hug
      ? 'light hug now. arms around each other. both faces. clothes stay.'
      : lie
        ? couple
          ? 'BOTH lie on the bed now. not standing.'
          : 'she lies on the bed now. not standing.'
        : couple && sit && stand
          ? 'she SITS, he STANDS beside her. she must not stay standing.'
          : couple && sit
            ? 'BOTH SIT now. knees bent. not standing.'
            : sit
              ? 'she SITS now. knees bent. not standing.'
              : couple && stand
                ? 'BOTH stand near each other. clothes stay.'
                : 'change only the room. keep the current pose.'
    const hint = !hug && !sitLie ? userHint(t, 40) : ''
    return assembleDeskStill([
      { key: 'DO', text: hint ? `${action} User: ${hint}` : action },
      { key: 'KEEP', text: deskKeep(couple, true) },
    ])
  }

  if (step === 'cut') {
      const kiss = intent.action === 'kiss' || /키스|입맞춤|kiss/i.test(t)
    const hugCut = intent.action === 'hug' || /포옹|안는|hug/i.test(t)
    const breast = intent.action === 'breast' || /가슴|breast/i.test(t)
    const action =
      kiss && breast
        ? couple
          ? 'Edit source in place. Source MAN kisses source WOMAN, his hand on her breast. He stays male. FORBIDDEN two women.'
          : 'a hand on her breast. face stays in. no second person.'
        : kiss
          ? couple
            ? nudeLook
              ? 'Edit in place. LEFT=source MAN stays male, short hair, flat chest. RIGHT=source WOMAN fully nude, bra OFF, panty OFF. He kisses her mouth-to-mouth. Keep hug. FORBIDDEN two women, lesbian, lingerie, gender-swap.'
              : 'Edit source in place. Source MAN kisses source WOMAN mouth-to-mouth. He stays male. Same hug/crop. FORBIDDEN two women, new faces, lingerie catalog.'
            : 'do not add a second person. no kiss with a new partner.'
          : hugCut
            ? 'light hug. both faces visible.'
            : breast
              ? 'a hand on her breast. face stays in.'
              : 'only this next beat. same crop.'
    return assembleDeskStill([
      { key: 'DO', text: action },
      { key: 'BODY', text: nudeLook ? deskNudeBody(t, couple) : slip ? deskSlipBody(t) : '' },
      { key: 'KEEP', text: deskKeep(couple, !nudeLook) },
    ])
  }

  const action = nudeLook
    ? couple
      ? 'melt ONLY her clothes to full nude. panty OFF. He keeps clothes.'
      : 'melt ALL clothes to full nude. panty OFF.'
    : hug
      ? 'light hug. clothes stay.'
      : sitLie
        ? 'change to the requested pose. clothes stay.'
        : 'edit this photo only. same face.'
  return assembleDeskStill([
    { key: 'DO', text: action },
    { key: 'BODY', text: nudeLook ? deskNudeBody(t, couple) : '' },
    { key: 'KEEP', text: deskKeep(couple, !nudeLook) },
  ])
}

export function deskStillNegativePrompt(options: {
  couple: boolean
  nudeStill: boolean
  descriptionKo: string
}): string {
  const t = options.descriptionKo || ''
  const hugeOk = /거유|초거유|E컵|F컵|G컵|huge\s*bust/i.test(t)
  const noGiant = hugeOk ? '' : ', huge breasts, balloon bust, porn-giant chest'
  if (options.nudeStill) {
    return options.couple
      ? `two women, lesbian, gender swap, feminized man, man with breasts, standing apart, new face, missing man, bra, panty, lingerie, thong, bikini, leftover clothes, fog crotch, hairless crotch, black image, mosaic, child${noGiant}`
      : `black panty, thong, g-string, bikini, leftover clothes, bra, fog crotch, hairless crotch, black image, mosaic, new face, slim model, white studio, child${noGiant}`
  }
  if (/슬립|slip|실크/i.test(t)) {
    return `bra, brassiere, bra straps, underwire, separate panty, camisole, tank top, two-piece lingerie, catalog model, new face, white studio, slim beauty, black panty, black bra, lace teddy, bodysuit, black image, fully naked, child${noGiant}`
  }
  if (/포옹|안기게|서로 안|안는다|\bhug\b/i.test(t)) {
    return 'standing apart, no contact, side-by-side, missing man, new face, black image, fully naked, child'
  }
  if (wantsDeskSitOrLie(t)) {
    return options.couple
      ? 'still standing, standing portrait, missing man, new face, black image, fully naked, child'
      : 'still standing, standing portrait, new face, black image, fully naked, child'
  }
  return options.couple
    ? `missing man, new face, black image, fully naked, child, mosaic${noGiant}`
    : `new face, black image, fully naked, child, mosaic, extra person${noGiant}`
}
