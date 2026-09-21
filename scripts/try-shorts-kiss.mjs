/**
 * 커플 나체 키스 쇼츠 실측 (배포 API)
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'try-shorts-kiss-v3')
const BASE = process.env.STORYMAG_BASE || 'https://2a4cf60d.storymag.pages.dev'
const SRC = path.join(ROOT, 'tmp-faceswap-test', 'try-extend', '4-studio-composite.jpg')

function loadPassword() {
  const n = fs.readFileSync(path.join(ROOT, '핀패스.txt'), 'utf8')
  return (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim()
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
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': token,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { http: res.status, data }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const token = await login()
  console.log('session ok', BASE)

  const jpeg = await sharp(SRC)
    .resize(768, null, { fit: 'inside' })
    .jpeg({ quality: 82 })
    .toBuffer()
  const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`
  console.log('source bytes', jpeg.length)

  const motion =
    '나체로 서로 키스하는 장면 (남녀만: 소스 남자가 여자와 키스. 남자는 남자로 유지. 여여 키스 금지. 둘 다 전신 나체) (사진에는 두 사람이 함께 있다 — 커플)'
  console.log('motion chars', motion.length)

  const submit = await api(
    '/api/animate',
    {
      imageDataUrl: dataUrl,
      prompt: '20대 남녀 커플이 나란히 선 전신 스튜디오 사진',
      motion,
      size: 'portrait',
      durationSec: 15,
      clipRole: 'single',
    },
    token,
  )
  console.log('submit', submit.http, submit.data.ok, submit.data.error || submit.data.status, 'pending', submit.data.pending)
  if (submit.data.promptChars) console.log('promptChars', submit.data.promptChars)
  if (submit.data.prompt) {
    const prompt = String(submit.data.prompt)
    fs.writeFileSync(path.join(OUT, 'prompt.txt'), prompt)
    const time = (prompt.match(/\[TIME\][\s\S]*?(?=\[|$)/) || [prompt.slice(0, 500)])[0]
    console.log('TIME', time.trim())
    console.log('hasHoldSplit', /8–11s|8-11s/.test(prompt), 'hasShirtFail', /FAILED if she still has a shirt/.test(prompt))
  }
  if (!submit.data.ok) throw new Error(submit.data.message || submit.data.error || `http_${submit.http}`)

  let videoUrl = submit.data.videoUrl
  const predictionId = submit.data.predictionId
  if (!videoUrl && predictionId) {
    const started = Date.now()
    for (let i = 0; i < 80; i += 1) {
      await new Promise((r) => setTimeout(r, i < 6 ? 3000 : 4000))
      const poll = await api('/api/animate-status', { predictionId, durationSec: 15 }, token)
      const sec = Math.round((Date.now() - started) / 1000)
      console.log(`poll ${sec}s http=${poll.http} status=${poll.data.status} pending=${poll.data.pending}`)
      if (poll.data.status === 'succeeded' && poll.data.videoUrl) {
        videoUrl = poll.data.videoUrl
        break
      }
      if (poll.data.status === 'failed' || poll.data.ok === false) {
        throw new Error(poll.data.message || poll.data.error || 'failed')
      }
      if (sec > 240) throw new Error('poll_timeout')
    }
  }
  if (!videoUrl) throw new Error('no_video')

  const vidRes = await fetch(videoUrl)
  const vidBuf = Buffer.from(await vidRes.arrayBuffer())
  const vidPath = path.join(OUT, 'kiss.mp4')
  fs.writeFileSync(vidPath, vidBuf)
  console.log('saved video', vidPath, vidBuf.length)

  const stamps = [
    ['f01-start', '00:00:01'],
    ['f02-undress', '00:00:06'],
    ['f03-kiss', '00:00:09'],
    ['f04-hold', '00:00:12'],
    ['f05-end', '00:00:14.5'],
  ]
  for (const [name, t] of stamps) {
    const out = path.join(OUT, `${name}.jpg`)
    const r = spawnSync(
      'ffmpeg',
      ['-y', '-ss', t, '-i', vidPath, '-frames:v', '1', '-q:v', '3', out],
      { encoding: 'utf8' },
    )
    if (r.status !== 0) console.log('ffmpeg fail', name, r.stderr?.slice(-200))
    else console.log('frame', name, fs.existsSync(out) ? fs.statSync(out).size : 0)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
