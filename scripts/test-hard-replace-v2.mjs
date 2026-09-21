/**
 * 커플 사진 좌·우 얼굴을 교차 덮어쓰기 — 완전 교체 스모크 테스트
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ASSETS =
  'C:/Users/UserK/.cursor/projects/c-Users-UserK-Desktop-PLATFORM-fashion-magazine/assets'
const TARGET = path.join(ASSETS, 'couple-fashion-photo.png')
const OUT_DIR = path.join(process.cwd(), 'tmp-faceswap-test')

async function hardPaste(targetBuf, idFaceBuf, targetFace) {
  const tMeta = await sharp(targetBuf).metadata()
  const tw = tMeta.width
  const th = tMeta.height
  const cover = 1.08
  const dw = Math.round(targetFace.w * tw * cover)
  const dh = Math.round(targetFace.h * th * cover)
  const dx = Math.round(targetFace.x * tw + (targetFace.w * tw - dw) / 2)
  const dy = Math.round(targetFace.y * th + (targetFace.h * th - dh) / 2)
  const facePatch = await sharp(idFaceBuf).resize(dw, dh, { fit: 'cover' }).png().toBuffer()
  const svg = Buffer.from(
    `<svg width="${dw}" height="${dh}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="50%" cy="48%" r="52%">
          <stop offset="0%" stop-color="white"/>
          <stop offset="75%" stop-color="white"/>
          <stop offset="100%" stop-color="black"/>
        </radialGradient>
      </defs>
      <ellipse cx="${dw / 2}" cy="${dh / 2}" rx="${dw * 0.49}" ry="${dh * 0.52}" fill="url(#g)"/>
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

async function cropFace(buf, box, name) {
  const m = await sharp(buf).metadata()
  const left = Math.max(0, Math.round(box.x * m.width))
  const top = Math.max(0, Math.round(box.y * m.height))
  const width = Math.min(m.width - left, Math.round(box.w * m.width))
  const height = Math.min(m.height - top, Math.round(box.h * m.height))
  const out = await sharp(buf).extract({ left, top, width, height }).jpeg().toBuffer()
  fs.writeFileSync(path.join(OUT_DIR, name), out)
  return out
}

const full = fs.readFileSync(TARGET)
const meta = await sharp(full).metadata()
const W = meta.width
const H = meta.height
const cut = Math.round(W * 0.54)
const leftHalf = await sharp(full).extract({ left: 0, top: 0, width: cut, height: H }).jpeg().toBuffer()
const rightHalf = await sharp(full)
  .extract({ left: W - cut, top: 0, width: cut, height: H })
  .jpeg()
  .toBuffer()

// 이 커플 사진용 얼굴 박스 (반쪽 기준 — 얼굴만 타이트)
const manInLeft = { x: 0.5, y: 0.06, w: 0.36, h: 0.36 }
const womanInRight = { x: 0.02, y: 0.04, w: 0.48, h: 0.42 }

const manId = await cropFace(leftHalf, manInLeft, 'man-face-id.jpg')
const womanId = await cropFace(rightHalf, womanInRight, 'woman-face-id.jpg')

const leftReplaced = await hardPaste(leftHalf, womanId, manInLeft)
const rightReplaced = await hardPaste(rightHalf, manId, womanInRight)

const result = await sharp({
  create: { width: W, height: H, channels: 3, background: { r: 0, g: 0, b: 0 } },
})
  .composite([
    { input: leftReplaced, left: 0, top: 0 },
    { input: rightReplaced, left: W - cut, top: 0 },
  ])
  .jpeg({ quality: 92 })
  .toBuffer()

fs.writeFileSync(path.join(OUT_DIR, 'hard-replace-result.jpg'), result)
fs.writeFileSync(path.join(OUT_DIR, 'left-replaced.jpg'), leftReplaced)
fs.writeFileSync(path.join(OUT_DIR, 'right-replaced.jpg'), rightReplaced)
console.log('wrote', path.join(OUT_DIR, 'hard-replace-result.jpg'))
