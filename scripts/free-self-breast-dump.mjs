import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const client = readFileSync(path.join(ROOT, 'public', 'free-studio.js'), 'utf8')
const holdSrc = client.match(/const holdNude = \(text\) => \{[\s\S]*?\n  \}/)[0]
const holdNude = new Function(`${holdSrc.replace('const holdNude =', 'return')}`)()
mkdirSync(path.join(ROOT, '_tmp_bundle'), { recursive: true })
const policyOut = path.join(ROOT, '_tmp_bundle', 'policy-self.cjs')
const lockOut = path.join(ROOT, '_tmp_bundle', 'lock-self.cjs')
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/aug27/content-policy.ts" --bundle --platform=node --format=cjs --outfile="${policyOut}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/free-self-breast.ts" --bundle --platform=node --format=cjs --outfile="${lockOut}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const policy = await import(`file://${policyOut}?t=${Date.now()}`)
const { applyFreeSelfBreastLock } = await import(`file://${lockOut}?t=${Date.now()}`)
const motion = holdNude('나체로 자기 가슴 만지기')
const raw = policy.buildAnimationPrompt({
  motion,
  durationSec: 15,
  sourcePeople: 1,
  genMode: 'fashion',
})
const locked = applyFreeSelfBreastLock(raw, motion)
const FREE_CAM =
  'WIDE SHOT LOCK: exact source framing every frame. Head and shoulders stay visible. Never zoom. Never a waist-down only crop. Never a chest-only crop. '
let sent = `${FREE_CAM}${locked}`
if (sent.length > 1500) {
  const budget = 1500 - FREE_CAM.length
  const body = locked.slice(0, Math.max(0, budget))
  const cut = body.lastIndexOf('.')
  sent = `${FREE_CAM}${(cut > 400 ? body.slice(0, cut + 1) : body).trim()}`
}
console.log('MOTION:', motion)
console.log('SENT', sent.length)
console.log(sent)
