#!/usr/bin/env node
/**
 * 무과금. LOOK 나체만 CAST 국소 inpaint 0.85. 슬립 Leffa·Wan 불변.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tale = readFileSync(path.join(ROOT, 'functions/api/tale-scene.ts'), 'utf8')
const look = tale.slice(tale.indexOf('const nudeStill'), tale.indexOf('if (step === \'look\') {', tale.indexOf('look_inpaint_required')))

const silkLeffa = /clothesReplace = intent\.look === 'silk'/.test(look) && /submitFalLeffaVirtualTryon/.test(look)
const nudeInpaint = /nudeStill \? 0\.85/.test(look) && /bare adult skin of the SAME CAST body/.test(look)
const slipStrengthUntouched = !/slipStill \? 0\.85/.test(look) && /strength: nudeStill \? 0\.85 : 0\.56/.test(look)
const wanFrozen = !/wan-2\.2/.test(look)

const ok = silkLeffa && nudeInpaint && slipStrengthUntouched && wanFrozen
const report = { silkLeffa, nudeInpaint, slipStrengthUntouched, wanFrozen, ok }
console.log(JSON.stringify(report, null, 2))
if (!ok) process.exit(1)
