#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  'lucataco/realistic-vision-v5-inpainting',
  'asiryan/realistic-vision-v6.0-b1',
  'stability-ai/stable-diffusion-inpainting',
]
const schemas = []
for (const id of models) {
  const [owner, name] = id.split('/')
  const res = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => ({}))
  const props = body?.latest_version?.openapi_schema?.components?.schemas?.Input?.properties || {}
  schemas.push({
    id,
    status: res.status,
    keys: Object.keys(props),
    mask: props.mask || props.mask_image || props.mask_url || null,
    image: props.image || props.image_url || null,
    extra: {
      disable_safety_checker: Boolean(props.disable_safety_checker),
      strength: Boolean(props.strength),
      prompt: Boolean(props.prompt),
      model: props.model ? { enum: props.model.enum, default: props.model.default } : null,
      task: props.task ? { enum: props.task.enum, default: props.task.default } : null,
    },
  })
}
writeFileSync(path.join(OUT, 'rv-inpaint-schema.json'), JSON.stringify(schemas, null, 2))
console.log(JSON.stringify(schemas, null, 2))
