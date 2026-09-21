#!/usr/bin/env node
/** 무과금. 「옷 녹이기」 쇼츠 문구를 서버가 어떻게 분류하는지, 그리고 Wan에 뭐가 나가는지. */
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(path.join(ROOT, '_tmp_bundle'), { recursive: true })
const bundle = (src, name) => {
  const out = path.join(ROOT, '_tmp_bundle', name)
  execSync(`node_modules\\.bin\\esbuild "${src}" --bundle --platform=node --format=cjs --outfile="${out}"`, {
    cwd: ROOT,
    stdio: 'pipe',
  })
  return out
}
const intent = await import(`file://${bundle('functions/lib/nude-intent.ts', 'nude-intent.cjs')}?t=${Date.now()}`)
const policy = await import(`file://${bundle('functions/lib/content-policy.ts', 'content-policy.cjs')}?t=${Date.now()}`)

const MELT = '이 사진 같은 사람. 지금 옷만 슬립으로 천천히 녹인다. 얼굴·몸·자세 유지. 새 사람 금지. 서서 다시 찍기 금지.'
const UNDRESS = '옷벗김. 혼자. 원본 구도 유지. 클로즈업 금지.'
// 슬립 + 미소. compileDeskMove 가 "옷은 그대로"를 떼고 슬립 목표를 붙인 결과.
const SLIP_SMILE = '살짝 미소 짓는다. 옷만 슬립 한 겹으로 바꾼다.'
// 슬립을 안 고른 미소는 옷 유지가 맞다.
const PLAIN_SMILE = '살짝 미소 짓는다. 옷은 그대로.'

const classify = (m) => ({
  motion: m,
  wantsUndressAction: intent.wantsUndressAction(m),
  wantsOtbeotgim: intent.wantsOtbeotgim(m),
  wantsNudeOrUndress: intent.wantsNudeOrUndress(m),
  wantsSlipOrSilkLook: intent.wantsSlipOrSilkLook(m),
})

const build = (m) =>
  policy.buildAnimationPrompt({
    motion: m,
    durationSec: 10,
    sourcePeople: 1,
    genMode: 'fashion',
  })

const measure = (m) => {
  const prompt = build(m)
  return {
    ...classify(m),
    keepsClothes: /Keep source clothes/i.test(prompt),
    saysDoNotUndress: /Do not undress/i.test(prompt),
    keepsOutfit: /Keep the source outfit/i.test(prompt),
    mentionsSlip: /slip/i.test(prompt),
    chars: prompt.length,
    prompt,
  }
}

const melt = measure(MELT)
const undress = measure(UNDRESS)
const slipSmile = measure(SLIP_SMILE)
const plainSmile = measure(PLAIN_SMILE)

/** 슬립을 달라 했는데 옷 유지 문장이 같이 나가면 엔진은 영어를 따르고 슬립을 버린다. */
const asksSlipGetsSlip = (r) =>
  r.mentionsSlip && !r.keepsClothes && !r.saysDoNotUndress && !r.keepsOutfit
const strip = (r) => ({ ...r, prompt: undefined })

const checks = {
  meltGivesSlip: asksSlipGetsSlip(melt),
  slipSmileGivesSlip: asksSlipGetsSlip(slipSmile),
  /** 미소 동작이 프롬프트에 남아 있어야 한다. 옷만 바뀌고 동작이 사라지면 안 된다. */
  slipSmileKeepsAction: /미소|smile/i.test(slipSmile.prompt),
  /** 슬립을 안 고른 미소는 그대로 옷 유지 경로. */
  plainSmileKeepsClothes: plainSmile.keepsClothes && !plainSmile.mentionsSlip,
  /** 벗기는 나체 경로 그대로. */
  undressStaysNudePath: undress.wantsOtbeotgim,
  allUnderWanLimit: [melt, slipSmile, plainSmile, undress].every((r) => r.chars <= 1500),
}

const report = {
  newPaidCall: false,
  wanCalled: false,
  melt: strip(melt),
  slipSmile: strip(slipSmile),
  plainSmile: strip(plainSmile),
  undress: strip(undress),
  checks,
  ok: Object.values(checks).every(Boolean),
}
console.log(JSON.stringify(report, null, 2))
console.log('\n--- SLIP + SMILE PROMPT ---\n' + slipSmile.prompt)
if (!report.ok) process.exit(1)
