import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'try-stand-same')
const BASE = process.env.STORYMAG_BASE || ''

function loadCreds() {
  const note = path.join(ROOT, '핀패스.txt')
  const n = fs.existsSync(note) ? fs.readFileSync(note, 'utf8') : ''
  const pin = (n.match(/^핀\s+(\S+)/m) || [])[1]?.trim()
  const password = (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim()
  return { pin, password }
}

function toDataUrl(file) {
  return `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`
}

async function main() {
  const creds = loadCreds()
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password: creds.password }),
  })
  const auth = await login.json()
  if (!auth.ok) throw new Error(`login_${login.status}`)
  const headers = {
    'Content-Type': 'application/json',
    'x-session-token': auth.token,
    'x-admin-pin': creds.pin,
  }
  const submit = await fetch(`${BASE}/api/face-swap`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      engine: 'kontext',
      targetSide: 'gender',
      targetImage: toDataUrl(path.join(OUT, '1-stand.jpg')),
      face0: toDataUrl(path.join(OUT, '0-original.jpg')),
      gender0: 'female',
      upscale: false,
      workflowType: 'user_hair',
    }),
  })
  const data = await submit.json()
  console.log('submit', submit.status, data.ok, data.pending, data.error)
  let url = data.imageUrl
  if (!url && data.pending) {
    for (let i = 0; i < 50; i += 1) {
      await new Promise((r) => setTimeout(r, 2500))
      const p = await fetch(`${BASE}/api/face-swap-status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          statusUrl: data.statusUrl,
          responseUrl: data.responseUrl,
          engine: data.engine,
          baseImageUrl: data.baseImageUrl,
        }),
      })
      const d = await p.json()
      console.log('poll', i, d.status, d.error || '')
      if (d.status === 'succeeded' && d.imageUrl) {
        url = d.imageUrl
        break
      }
      if (d.status === 'failed' || d.ok === false) throw new Error(d.message || d.error)
    }
  }
  if (!url) throw new Error('no url')
  const img = await fetch(url)
  fs.writeFileSync(path.join(OUT, '3-kontext-head.jpg'), Buffer.from(await img.arrayBuffer()))
  console.log('saved 3-kontext-head.jpg')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
