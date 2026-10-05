#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-look-nude-probe')
mkdirSync(OUT, { recursive: true })

function envVal(key) {
  const line = readFileSync(path.join(ROOT, '.dev.vars'), 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`))
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : ''
}

const token = envVal('REPLICATE_API_TOKEN')
const models = [
  'lucataco/sdxl-inpainting',
  'stability-ai/stable-diffusion-inpainting',
  'fermatresearch/sdxl-inpaint',
]
const found = []
for (const id of models) {
  const [owner, name] = id.split('/')
  const res = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => ({}))
  found.push({
    id,
    status: res.status,
    version: body?.latest_version?.id ? 'yes' : '',
    err: body?.detail || body?.title || '',
  })
}
writeFileSync(path.join(OUT, 'inpaint-models.json'), JSON.stringify(found, null, 2))
console.log(JSON.stringify(found, null, 2))
