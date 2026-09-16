import { wantsNudeOrUndress, wantsDeskSitOrLie } from './nude-intent'
import { wantsExplicitPubicShave } from './nude-anatomy-locks'

/** Juggernaut/SDXL CLIP은 ~77토큰. 칸을 쌓되 동작([DO])이 항상 맨 앞. */
export const DESK_STILL_PROMPT_MAX = 420

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
  const who = couple ? 'She nude. He dressed.' : 'Same woman nude.'
  return `${who} ${pubic} FAILED black panty, fog, hairless blank.`
}

function deskKeep(couple: boolean, clothesStay: boolean): string {
  const face = couple ? 'same faces. He stays male.' : 'same face.'
  const rest = clothesStay
    ? 'same pose, crop, clothes.'
    : couple
      ? 'same pose, crop. hug stays hug. FORBIDDEN stand apart, two women.'
      : 'same pose, crop.'
  return `${face} ${rest} Adult 18+.`
}

export function buildDeskStillPrompt(descriptionKo: string, couple = false, step = ''): string {
  const t = descriptionKo || ''
  const lie = /눕|누워|lying/i.test(t)
  const slip = /슬립|slip|실크/i.test(t)
  const nudeLook = wantsNudeOrUndress(t)
  const sit = /앉|sit(?:ting)?/i.test(t)
  const stand = /서서|서기|stand(?:ing)?/i.test(t)
  const hug = couple && /포옹|안기게|서로 안|안는다|껴안|\bhug\b/i.test(t)
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
        ? 'Edit source in place. Do not create, replace, duplicate, remove, or gender-swap anyone. Melt ONLY person 0 (woman) clothes, panty OFF. Preserve person 1 (man), hug, camera, background. FORBIDDEN two women, white studio.'
        : 'melt ALL clothes to full nude. panty OFF.'
      : slip
        ? couple
          ? 'Edit source in place. Melt ONLY person 0 (woman) clothes into a pale slip. Preserve person 1 (man), pose, crop. FORBIDDEN two women, white studio.'
          : 'melt clothes into a pale slip.'
        : couple
          ? 'Edit source in place. Melt ONLY person 0 (woman) clothes into the requested outfit. Preserve person 1 (man). FORBIDDEN two women, white studio.'
          : 'melt clothes into the requested outfit.'
    const body = nudeLook
      ? deskNudeBody(t, couple)
      : slip
        ? 'pale slip only. If panty shows: ivory, not black.'
        : ''
    const hint = !nudeLook && !slip ? userHint(t) : ''
    return assembleDeskStill([
      { key: 'DO', text: hint ? `${action} User: ${hint}` : action },
      { key: 'BODY', text: body },
      { key: 'KEEP', text: deskKeep(couple, !nudeLook) },
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
    const kiss = /키스|입맞춤|kiss/i.test(t)
    const hugCut = /포옹|안는|hug/i.test(t)
    const breast = /가슴|breast/i.test(t)
    const action =
      kiss && breast
        ? 'kiss mouth-to-mouth AND his hand on her breast.'
        : kiss
          ? 'kiss mouth-to-mouth now. same two faces.'
          : hugCut
            ? 'light hug. both faces visible.'
            : breast
              ? 'a hand on her breast. face stays in.'
              : 'only this next beat. same crop.'
    return assembleDeskStill([
      { key: 'DO', text: action },
      { key: 'BODY', text: nudeLook ? deskNudeBody(t, couple) : slip ? 'keep the slip. no black panty.' : '' },
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
      ? 'two women, gender swap, feminized man, both nude, standing apart, black panty, thong, bikini, leftover clothes, bra, fog crotch, hairless crotch, missing man, black image, mosaic, new face, child'
      : 'black panty, thong, bikini, leftover clothes, bra, fog crotch, hairless crotch, black image, mosaic, new face, child'
  }
  if (/슬립|slip|실크/i.test(t)) {
    return 'black panty, black bra, lace teddy, bodysuit, new face, black image, fully naked, child'
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
