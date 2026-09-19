import { wantsNudeOrUndress, wantsDeskSitOrLie, wantsSlipOrSilkLook } from './nude-intent'
import { wantsExplicitPubicShave } from './nude-anatomy-locks'

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
  return out.slice(0, DESK_STILL_PROMPT_MAX).replace(/\s+\S*$/, '').trim()
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
    : 'bare crotch, Korean-30s pubic on mons. panty OFF.'
  const who = couple ? 'CAST woman-slot only. CAST man-slot stays dressed.' : 'Same woman nude.'
  return `${who} ${pubic} FAILED black panty, fog, hairless blank.`
}

function deskSlipDo(couple: boolean): string {
  return couple
    ? 'Edit in place. CAST woman-slot only: smelt klærne til én tynn finsilke-nattkjole, ingen BH. CAST man-slot stays. FORBIDDEN bra, two women, new faces, assume right=woman.'
    : 'Edit in place. Same woman, same body, same hair, same room. Smelt klærne til én tynn finsilke-nattkjole, ingen BH. FORBIDDEN bra, new face, white studio, catalog model.'
}

function deskSlipBody(): string {
  return 'én tynn finsilke-slip, bias-skåret, flytende drape. Ingen BH, ingen BH-stropper. Nakne bryst under silken. Ingen separat truse. FAILED bra, camisole+panty.'
}

function deskKeep(couple: boolean, clothesStay: boolean): string {
  const face = couple ? 'same faces. CAST man-slot stays male.' : 'same source face, same hair.'
  const rest = clothesStay
    ? 'same pose, crop, clothes.'
    : couple
      ? 'same pose, crop. hug stays. FORBIDDEN stand apart, two women.'
      : 'same pose, crop, body, room. FORBIDDEN new model, white studio, slim beauty.'
  return `${face} ${rest} Adult 18+.`
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
    const body = nudeLook ? deskNudeBody(t, couple) : slip ? deskSlipBody() : ''
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
      { key: 'BODY', text: nudeLook ? deskNudeBody(t, couple) : slip ? deskSlipBody() : '' },
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
  if (options.nudeStill) {
    return options.couple
      ? 'two women, lesbian, gender swap, feminized man, man with breasts, standing apart, new face, missing man, bra, panty, lingerie, thong, bikini, leftover clothes, fog crotch, hairless crotch, black image, mosaic, child'
      : 'black panty, thong, g-string, bikini, leftover clothes, bra, fog crotch, hairless crotch, black image, mosaic, new face, slim model, white studio, child'
  }
  if (/슬립|slip|실크/i.test(t)) {
    return 'bra, brassiere, bra straps, underwire, separate panty, camisole, tank top, two-piece lingerie, catalog model, new face, white studio, slim beauty, black panty, black bra, lace teddy, bodysuit, black image, fully naked, child'
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
    ? 'missing man, new face, black image, fully naked, child, mosaic'
    : 'new face, black image, fully naked, child, mosaic, extra person'
}
