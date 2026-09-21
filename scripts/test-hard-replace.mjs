/**
 * 로컬 완전 교체(덮어쓰기) 스모크 테스트.
 * couple-fashion-photo 에서 좌·우 얼굴을 잘라 서로 덮어씀 → 합성이 아닌 픽셀 교체인지 확인.
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ASSETS =
  'C:/Users/UserK/.cursor/projects/c-Users-UserK-Desktop-PLATFORM-fashion-magazine/assets'
const TARGET = path.join(ASSETS, 'couple-fashion-photo.png')
const OUT_DIR = path.join(process.cwd(), 'tmp-faceswap-test')
const OUT = path.join(OUT_DIR, 'hard-replace-result.jpg')
const BASE = 'https://storymag.mindstory.kr'

function readPin() {
  const t = fs.readFileSync(path.join(process.cwd(), '.dev.vars'), 'utf8')
  const m = t.match(/^ADMIN_PIN=(.*)$/m)
  return (m?.[1] || '').trim()
}

async function faceBoxApi(dataUrl, pin) {
  const res = await fetch(`${BASE}/api/face-box`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': pin,
    },
    body: JSON.stringify({ imageDataUrl: dataUrl }),
  })
  const data = await res.json().catch(() => ({}))
  return { http: res.status, data }
}

function heuristic(kind) {
  if (kind === 'id') return { x: 0.18, y: 0.12, w: 0.64, h: 0.72 }
  return { x: 0.22, y: 0.08, w: 0.56, h: 0.55 }
}

async function toDataUrl(buf, mime = 'image/jpeg') {
  return `data:${mime};base64,${buf.toString('base64')}`
}

async function hardPaste(targetBuf, idFaceBuf, targetFace, idFace) {
  const target = sharp(targetBuf)
  const tMeta = await target.metadata()
  const tw = tMeta.width
  const th = tMeta.height
  const idMeta = await sharp(idFaceBuf).metadata()
  const iw = idMeta.width
  const ih = idMeta.height

  const padX = idFace.w * 0.08
  const padY = idFace.h * 0.06
  const sx = Math.max(0, Math.round((idFace.x - padX) * iw))
  const sy = Math.max(0, Math.round((idFace.y - padY) * ih))
  const sw = Math.min(iw - sx, Math.round((idFace.w + padX * 2) * iw))
  const sh = Math.min(ih - sy, Math.round((idFace.h + padY * 2) * ih))

  const cover = 1.12
  const dw = Math.round(targetFace.w * tw * cover)
  const dh = Math.round(targetFace.h * th * cover)
  const dx = Math.round(targetFace.x * tw + (targetFace.w * tw - dw) / 2)
  const dy = Math.round(targetFace.y * th + (targetFace.h * th - dh) / 2)

  const facePatch = await sharp(idFaceBuf)
    .extract({ left: sx, top: sy, width: Math.max(1, sw), height: Math.max(1, sh) })
    .resize(dw, dh, { fit: 'fill' })
    .png()
    .toBuffer()

  // 타원 마스크 (중심 불투명)
  const svg = Buffer.from(
    `<svg width="${dw}" height="${dh}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="white"/>
          <stop offset="72%" stop-color="white"/>
          <stop offset="100%" stop-color="black"/>
        </radialGradient>
      </defs>
      <ellipse cx="${dw / 2}" cy="${dh / 2}" rx="${dw * 0.5}" ry="${dh * 0.54}" fill="url(#g)"/>
    </svg>`,
  )
  const masked = await sharp(facePatch)
    .composite([{ input: svg, blend: 'dest-in' }])
    .png()
    .toBuffer()

  return sharp(targetBuf)
    .composite([{ input: masked, left: Math.max(0, dx), top: Math.max(0, dy) }])
    .jpeg({ quality: 92 })
    .toBuffer()
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const pin = readPin()
  const full = fs.readFileSync(TARGET)
  const meta = await sharp(full).metadata()
  const W = meta.width
  const H = meta.height
  console.log('target', W, H)

  // 좌·우 반쪽
  const cut = Math.round(W * 0.54)
  const leftHalf = await sharp(full).extract({ left: 0, top: 0, width: cut, height: H }).jpeg().toBuffer()
  const rightHalf = await sharp(full)
    .extract({ left: W - cut, top: 0, width: cut, height: H })
    .jpeg()
    .toBuffer()

  // 반쪽에서 얼굴을 ID처럼 크롭 (휴리스틱 중앙상단)
  async function cropIdFromHalf(buf, label) {
    const m = await sharp(buf).metadata()
    const box = heuristic('target')
    const left = Math.round(box.x * m.width)
    const top = Math.round(box.y * m.height)
    const width = Math.round(box.w * m.width)
    const height = Math.round(box.h * m.height)
    const out = await sharp(buf).extract({ left, top, width, height }).jpeg().toBuffer()
    fs.writeFileSync(path.join(OUT_DIR, `${label}-id.jpg`), out)
    return out
  }

  const idFromLeft = await cropIdFromHalf(leftHalf, 'left')
  const idFromRight = await cropIdFromHalf(rightHalf, 'right')

  // API face-box 시도 (프로덕션)
  let apiOk = false
  let leftFace = heuristic('target')
  let rightFace = heuristic('target')
  let idL = heuristic('id')
  let idR = heuristic('id')
  try {
    const leftDu = await toDataUrl(leftHalf)
    const r1 = await faceBoxApi(leftDu, pin)
    console.log('face-box leftHalf', r1.http, r1.data?.ok, r1.data?.error || 'ok')
    if (r1.data?.ok && r1.data.face) {
      leftFace = r1.data.face
      apiOk = true
    }
    const rightDu = await toDataUrl(rightHalf)
    const r2 = await faceBoxApi(rightDu, pin)
    console.log('face-box rightHalf', r2.http, r2.data?.ok, r2.data?.error || 'ok')
    if (r2.data?.ok && r2.data.face) rightFace = r2.data.face
  } catch (e) {
    console.log('face-box API failed, using heuristic:', e.message)
  }

  // 교차 완전 교체: 오른쪽 얼굴 → 왼쪽 사람, 왼쪽 얼굴 → 오른쪽 사람
  const leftReplaced = await hardPaste(leftHalf, idFromRight, leftFace, idR)
  const rightReplaced = await hardPaste(rightHalf, idFromLeft, rightFace, idL)

  // 반쪽 다시 합치기
  const result = await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([
      { input: leftReplaced, left: 0, top: 0 },
      { input: rightReplaced, left: W - cut, top: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer()

  fs.writeFileSync(OUT, result)
  fs.writeFileSync(path.join(OUT_DIR, 'left-replaced.jpg'), leftReplaced)
  fs.writeFileSync(path.join(OUT_DIR, 'right-replaced.jpg'), rightReplaced)
  console.log('wrote', OUT)
  console.log('api_face_box', apiOk ? 'used' : 'heuristic_fallback')
  console.log('DONE')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
