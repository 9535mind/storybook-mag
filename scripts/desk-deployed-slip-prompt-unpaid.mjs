#!/usr/bin/env node
/** 무과금. 배포된 트리가 실제로 엔진에 보내는 슬립 프롬프트를 그대로 찍는다. */
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TREE = process.argv[2] || ROOT
mkdirSync(path.join(ROOT, '_tmp_bundle'), { recursive: true })
const out = path.join(ROOT, '_tmp_bundle', 'deployed-still-prompt.cjs')
execSync(
  `node_modules\\.bin\\esbuild "${path.join(TREE, 'functions/lib/desk-still-prompt.ts')}" --bundle --platform=node --format=cjs --outfile="${out}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const mod = await import(`file://${out}?t=${Date.now()}`)

const falOut = path.join(ROOT, '_tmp_bundle', 'deployed-fal-client.cjs')
execSync(
  `node_modules\\.bin\\esbuild "${path.join(TREE, 'functions/lib/fal-client.ts')}" --bundle --platform=node --format=cjs --outfile="${falOut}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const fal = await import(`file://${falOut}?t=${Date.now()}`)

const prompt = mod.buildDeskStillPrompt('슬립 한 겹 노브라', false, 'look', {
  look: 'silk',
  action: 'none',
  couple: false,
})
// tale-scene.ts 가 실제로 덧붙이는 꼬리.
const localEdit = `${prompt} Local edit ONLY the white-masked clothes. The silk follows the existing torso and pose. Unmasked face, hair, hands, limbs, and background stay exact source pixels. FORBIDDEN new person, standing rebuild.`

const negative = mod.deskStillNegativePrompt({
  couple: false,
  nudeStill: false,
  descriptionKo: '슬립 한 겹 노브라',
})
// fal-client 가 negative 를 프롬프트에 녹여 최종 문자열을 만든다. 이게 진짜 엔진 입력.
const final = fal.bakeConstraintsForFlux(localEdit, negative)

const nonEnglish = final.match(/[\u00C0-\u024F][\p{L}]*/gu) || []
const korean = final.match(/[\uac00-\ud7a3]+/g) || []
// Flux 의 CLIP 인코더는 대략 77토큰에서 자른다. 단어 수로 가늠한다.
const words = final.split(/\s+/).filter(Boolean).length
const report = {
  newPaidCall: false,
  tree: TREE,
  promptChars: prompt.length,
  localEditChars: localEdit.length,
  finalChars: final.length,
  finalWords: words,
  cap: mod.DESK_STILL_PROMPT_MAX,
  overCap: prompt.length > mod.DESK_STILL_PROMPT_MAX,
  saysSlipDress: /slip dress|silk slip|thin silk slip/i.test(final),
  /** 슬립 지시가 프롬프트 앞쪽 77단어 안에 있는가. 뒤로 밀리면 엔진이 못 본다. */
  slipWordIndex: final.split(/\s+/).findIndex((w) => /slip/i.test(w)),
  nonEnglishWords: [...new Set(nonEnglish)].slice(0, 20),
  koreanWords: [...new Set(korean)].slice(0, 20),
  endsMidWord: !/[.!?]$/.test(prompt.trim()),
}
console.log(JSON.stringify(report, null, 2))
console.log('\n--- NEGATIVE ---\n' + negative)
console.log('\n--- FINAL STRING SENT TO fal-ai/flux-lora/inpainting ---\n' + final)
