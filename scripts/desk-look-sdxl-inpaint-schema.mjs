import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const line = readFileSync(path.join(ROOT, '.dev.vars'), 'utf8')
  .split(/\n/)
  .find((l) => l.startsWith('REPLICATE_API_TOKEN='))
const token = line.slice('REPLICATE_API_TOKEN='.length).trim().replace(/^["']|["']$/g, '')
const res = await fetch('https://api.replicate.com/v1/models/lucataco/sdxl-inpainting', {
  headers: { Authorization: `Bearer ${token}` },
})
const body = await res.json()
const schema = body.latest_version?.openapi_schema?.components?.schemas?.Input?.properties || {}
const keys = Object.keys(schema)
writeFileSync(
  path.join(ROOT, 'tmp-faceswap-test', 'desk-look-nude-probe', 'sdxl-inpaint-schema.json'),
  JSON.stringify({ keys, schema }, null, 2),
)
console.log(keys.join(','))
