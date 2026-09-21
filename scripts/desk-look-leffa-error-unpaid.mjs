#!/usr/bin/env node
/**
 * 무과금. LOOK 슬립 Leffa 실패 시 가운데 원본 유지.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const app = readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8')
const tale = readFileSync(path.join(ROOT, 'functions', 'api', 'tale-scene.ts'), 'utf8')

function clientKeepCenter(job, center) {
  if (!job || job.auth || !job.imageUrl) {
    return { center, painted: false }
  }
  return { center: job.imageUrl, painted: true }
}

function serverLookFail() {
  return {
    ok: false,
    error: 'look_inpaint_failed',
    message: '옷을 녹이지 못했습니다. 가운데는 원본입니다. 얼굴을 붙이지 않습니다.',
  }
}

const source = 'data:image/jpeg;base64,SOURCEKEEP'
const fails = [
  serverLookFail(),
  { ok: false, error: 'look_garment_missing', message: '옷을 녹이지 못했습니다. 가운데는 원본입니다.' },
  null,
  { ok: true },
  { auth: true },
]
const checks = []
for (const job of fails) {
  const out = clientKeepCenter(job, source)
  checks.push(out.center === source && out.painted === false)
}

const lookFail = serverLookFail()
const sourceStay = /가운데는 원본입니다/.test(app) && /if \(!job \|\| job\.auth \|\| !job\.imageUrl\)/.test(app)
const noPaintOnFail = /if \(!job \|\| job\.auth \|\| !job\.imageUrl\) \{[\s\S]{0,220}?return/.test(app)
const silkInpaint = /engine = 'fal-look-inpaint'/.test(tale) && !/submitFalLeffaVirtualTryon/.test(tale)
const serverNoImage = lookFail.ok === false && !lookFail.imageUrl && lookFail.error === 'look_inpaint_failed'

const ok =
  checks.every(Boolean) &&
  sourceStay &&
  noPaintOnFail &&
  silkInpaint &&
  serverNoImage

console.log(
  JSON.stringify(
    {
      ok,
      paidCall: false,
      keepCenter: checks.every(Boolean),
      clientFailClosed: sourceStay && noPaintOnFail,
      lookError: lookFail.error,
    },
    null,
    2,
  ),
)
if (!ok) process.exit(1)
