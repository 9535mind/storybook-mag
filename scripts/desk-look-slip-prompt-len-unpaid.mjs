#!/usr/bin/env node
/** 무과금. 슬립 inpaint에 실제로 들어가는 프롬프트 길이. Flux는 길면 원본을 그대로 돌려준다. */
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, '_tmp_bundle')
mkdirSync(OUT, { recursive: true })

const bundle = (src, name) => {
  const out = path.join(OUT, name)
  execSync(`node_modules\\.bin\\esbuild "${src}" --bundle --platform=node --format=cjs --outfile="${out}"`, {
    cwd: ROOT,
    stdio: 'pipe',
  })
  return out
}

const promptMod = await import(`file://${bundle('functions/lib/desk-still-prompt.ts', 'desk-still-prompt.cjs')}?t=${Date.now()}`)
const falMod = await import(`file://${bundle('functions/lib/fal-client.ts', 'fal-client.cjs')}?t=${Date.now()}`)

const descriptionKo =
  '원본을 그 자리에서만 고친다. 얼굴·머리·몸매·자세·방 유지. 옷만 얇은 실크 슬립 한 장 노브라로 녹인다. 팬티 따로 없음. 새 사람·흰 스튜디오·화보 모델 금지.'

// tale-scene.ts와 같은 위치 인자. 객체로 부르면 step이 비어 엉뚱한 칸이 나온다.
const couple = false
const step = 'look'
const intent = promptMod.parseDeskIntent(descriptionKo, couple, step, {
  look: 'silk',
  action: 'none',
  couple,
})
const base = promptMod.buildDeskStillPrompt(descriptionKo, couple, step, {
  look: intent.look,
  action: intent.action,
  couple: intent.couple,
})
const negative = promptMod.deskStillNegativePrompt({ couple, nudeStill: false, descriptionKo })

// 접미문은 tale-scene.ts에서 그대로 읽는다. 여기 베껴 두면 따로 논다.
const tale = readFileSync(path.join(ROOT, 'functions', 'api', 'tale-scene.ts'), 'utf8')
const suffix = (tale.match(/\? `\$\{prompt\} (Local edit ONLY the white-masked clothes\. The silk[^`]*)`/) || [])[1]
if (!suffix) {
  console.log('tale-scene.ts slip suffix not found')
  process.exit(1)
}
const localEdit = `${base} ${suffix}`

const baked = falMod.bakeConstraintsForFlux
  ? falMod.bakeConstraintsForFlux(localEdit, negative)
  : `${localEdit}\nAVOID: ${negative}`

const words = baked.trim().split(/\s+/).length
const report = {
  newPaidCall: false,
  baseChars: base.length,
  negativeChars: negative.length,
  localEditChars: localEdit.length,
  sentToFluxChars: baked.length,
  sentToFluxWords: words,
  /** T5는 512토큰. 영어는 대략 단어당 1.3토큰. */
  estTokens: Math.round(words * 1.3),
  overT5: Math.round(words * 1.3) > 512,
  base,
  negative,
  sentToFlux: baked,
}
console.log(JSON.stringify(report, null, 2))
