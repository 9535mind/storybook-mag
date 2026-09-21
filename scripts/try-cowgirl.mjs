/**
 * 포즈 탭 기승위 시험: 누운 남자를 만든 뒤 그 장 위에 기승위.
 * 쇼츠 API는 호출하지 않음.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'try-cowgirl')
const BASE = process.env.STORYMAG_BASE || ''
const WOMAN = path.join(ROOT, 'tmp-faceswap-test', 'woman-face-id.jpg')
const MAN = path.join(ROOT, 'tmp-faceswap-test', 'try-extend', '5-man-body.jpg')
const MAN_FALLBACK = path.join(ROOT, 'tmp-faceswap-test', 'man-face-id.jpg')

function loadPassword() {
  const n = fs.readFileSync(path.join(ROOT, '핀패스.txt'), 'utf8')
  return (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim()
}

function fileDataUrl(filePath) {
  const buf = fs.readFileSync(filePath)
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password: loadPassword() }),
  })
  const data = await r.json()
  if (!data.ok || !data.token) throw new Error(`login_${r.status}`)
  return data.token
}

async function api(pathname, body, token) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-token': token },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { http: res.status, data }
}

async function saveUrl(url, name) {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  const out = path.join(OUT, name)
  fs.writeFileSync(out, buf)
  console.log('saved', name, buf.length)
  return out
}

async function poseDraw(token, payload, label) {
  console.log('\n===', label, '===')
  const submit = await api('/api/tale-scene', payload, token)
  console.log('submit', submit.http, submit.data.ok, submit.data.error || submit.data.composeMode)
  if (submit.data.prompt) console.log('prompt', String(submit.data.prompt).slice(0, 280))
  if (!submit.data.ok) throw new Error(submit.data.message || submit.data.error || `http_${submit.http}`)
  if (submit.data.imageUrl) return submit.data.imageUrl
  const predictionId = submit.data.predictionId
  if (!predictionId) throw new Error('no_prediction')
  const t0 = Date.now()
  for (let i = 0; i < 70; i += 1) {
    await new Promise((r) => setTimeout(r, i < 5 ? 2500 : 4000))
    const poll = await api('/api/generate-status', { predictionId }, token)
    const sec = Math.round((Date.now() - t0) / 1000)
    console.log(`  poll ${sec}s ${poll.data.status || poll.data.error}`)
    if (poll.data.status === 'succeeded' && poll.data.imageUrl) return poll.data.imageUrl
    if (poll.data.status === 'failed' || poll.data.ok === false) {
      throw new Error(poll.data.message || poll.data.error || 'failed')
    }
    if (sec > 220) throw new Error('poll_timeout')
  }
  throw new Error('poll_exhausted')
}

async function main() {
  if (!BASE) throw new Error('set STORYMAG_BASE')
  fs.mkdirSync(OUT, { recursive: true })
  const manPath = fs.existsSync(MAN) ? MAN : MAN_FALLBACK
  const token = await login()
  console.log('session ok', BASE)
  console.log('man source', manPath)

  const manUrl = await poseDraw(
    token,
    {
      composeMode: 'pose-draw',
      poseId: 'nude',
      photoCount: 1,
      images: [fileDataUrl(manPath)],
      description: '누워있는 성인 남성 전신 나체, 실사',
      photoreal: true,
      refKind: 'pose',
      aspectRatio: '9:16',
      gender0: 'male',
    },
    '1 누운 남자',
  )
  const liePath = await saveUrl(manUrl, '1-lie-man.jpg')

  const cowgirlUrl = await poseDraw(
    token,
    {
      composeMode: 'pose-draw',
      poseId: 'cowgirl',
      photoCount: 2,
      images: [fileDataUrl(liePath)],
      description: '기승위, 누운 남자 위에 여자가 앉은 전신 사진, 실사',
      photoreal: true,
      refKind: 'pose',
      aspectRatio: '9:16',
      gender0: 'female',
      gender1: 'male',
    },
    '2 기승위 (누운 남자 바닥)',
  )
  await saveUrl(cowgirlUrl, '2-cowgirl.jpg')
  console.log('\nwoman id unused in this API-only pass:', fs.existsSync(WOMAN))
  console.log('done', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
