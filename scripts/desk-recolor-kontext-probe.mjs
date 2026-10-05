#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-body-mw150-kontext-probe')
mkdirSync(OUT, { recursive: true })

function envVal(key) {
  const line = readFileSync(path.join(ROOT, '.dev.vars'), 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`))
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : ''
}

const BUNDLE = path.join(ROOT, '_tmp_bundle', 'fal-client.recolor-probe.cjs')
execSync(
  `node_modules\\.bin\\esbuild functions/lib/fal-client.ts --bundle --platform=node --format=cjs --outfile="${BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const fal = await import(`file://${BUNDLE}?t=${Date.now()}`)

const srcPath =
  process.env.DESK_RECOLOR_SRC ||
  path.join(ROOT, 'tmp-faceswap-test', 'desk-body-mw148', 'standing.jpg')
const srcBuf = readFileSync(srcPath)
const imageUrl = `data:image/jpeg;base64,${srcBuf.toString('base64')}`
const prompt =
  process.env.DESK_RECOLOR_PROMPT ||
  [
    'Keep this exact woman, exact face, exact cream ivory jacket, exact standing pose and background.',
    'Change ONLY the black trousers and black shoes into cream ivory trousers and cream flats that match the jacket.',
    'FORBIDDEN a new face, black pants, black shoes, a beige plate, a catalog model.',
  ].join(' ')

const job = await fal.submitFalKontextEdit({
  falKey: envVal('FAL_KEY'),
  imageUrl,
  prompt,
  tier: 'pro',
  guidanceScale: 8.2,
  ...(process.env.DESK_RECOLOR_RATIO === 'keep' ? {} : { aspectRatio: process.env.DESK_RECOLOR_RATIO || '3:4' }),
})

async function waitImage(submitted) {
  if (submitted.imageUrl) return submitted.imageUrl
  const t0 = Date.now()
  while (Date.now() - t0 < 180000) {
    await new Promise((r) => setTimeout(r, 2500))
    const st = await fal.checkFalKontextMultiImage({
      falKey: envVal('FAL_KEY'),
      statusUrl: submitted.statusUrl,
      responseUrl: submitted.responseUrl,
    })
    if (st.imageUrl) return st.imageUrl
    if (st.status === 'failed') throw new Error(st.error || 'failed')
  }
  throw new Error('timeout')
}

const url = await waitImage(job)
const out = Buffer.from(await (await fetch(url)).arrayBuffer())
const name = process.env.DESK_RECOLOR_NAME || 'pants.jpg'
writeFileSync(path.join(OUT, name), out)
writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({ srcPath, url, prompt }, null, 2))
console.log(JSON.stringify({ name, bytes: out.length, url: url.slice(0, 90) }, null, 2))
