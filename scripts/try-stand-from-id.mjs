import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'try-stand-same')
const BASE = process.env.STORYMAG_BASE || ''

function loadCreds() {
  const n = fs.readFileSync(path.join(ROOT, '핀패스.txt'), 'utf8')
  return {
    pin: (n.match(/^핀\s+(\S+)/m) || [])[1]?.trim(),
    password: (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim(),
  }
}

async function main() {
  const creds = loadCreds()
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password: creds.password }),
  })
  const auth = await login.json()
  const headers = {
    'Content-Type': 'application/json',
    'x-session-token': auth.token,
    'x-admin-pin': creds.pin,
  }
  const original = `data:image/jpeg;base64,${fs.readFileSync(path.join(OUT, '0-original.jpg')).toString('base64')}`
  const submit = await fetch(`${BASE}/api/tale-scene`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      composeMode: 'extend-body',
      images: [original],
      description: '같은 옷으로 허리 다리 신발까지',
      photoreal: true,
      refKind: 'face',
      gender0: 'female',
      aspectRatio: '3:4',
      extendStyle: 'stand',
    }),
  })
  const data = await submit.json()
  console.log('submit', submit.status, data.ok, data.pending, data.error)
  let url = data.imageUrl
  if (!url && data.pending) {
    for (let i = 0; i < 50; i += 1) {
      await new Promise((r) => setTimeout(r, 2500))
      const p = await fetch(`${BASE}/api/tale-scene-status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ statusUrl: data.statusUrl, responseUrl: data.responseUrl }),
      })
      const d = await p.json()
      console.log('poll', i, d.status)
      if (d.status === 'succeeded' && d.imageUrl) {
        url = d.imageUrl
        break
      }
      if (d.status === 'failed' || d.ok === false) throw new Error(d.message || d.error)
    }
  }
  const img = await fetch(url)
  fs.writeFileSync(path.join(OUT, '4-from-id.jpg'), Buffer.from(await img.arrayBuffer()))
  console.log('saved 4-from-id.jpg')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
