#!/usr/bin/env node
/**
 * 유료 없음. 현재 LOOK 마스크(여 CAST 칸 − 머리·목·피부색)와
 * 원본검정+생성흰 합성을 4종 대표 사진에 적용해 PNG·수치를 저장한다.
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-mask-audit')
const BUNDLE_DIR = path.join(ROOT, '_tmp_bundle')
const COMP_BUNDLE = path.join(BUNDLE_DIR, 'desk-clothes-composite.cjs')
const APP = readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8')

if (!existsSync(BUNDLE_DIR)) mkdirSync(BUNDLE_DIR, { recursive: true })
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-clothes-composite.ts" --bundle --platform=node --format=cjs --outfile="${COMP_BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const comp = await import(`file://${COMP_BUNDLE}?t=${Date.now()}`)

const CASES = [
  {
    id: 'woman-bust',
    title: '여성 상반신',
    source: path.join(ROOT, 'tmp-faceswap-test', 'try-extend', '5-woman-id.jpg'),
    faces: [{ slot: 'woman', x: 0.22, y: 0.16, w: 0.56, h: 0.62 }],
  },
  {
    id: 'woman-full',
    title: '여성 전신',
    source: path.join(ROOT, 'tmp-faceswap-test', 'try-stand', '1-stand.jpg'),
    faces: [{ slot: 'woman', x: 0.39, y: 0.07, w: 0.2, h: 0.13 }],
  },
  {
    id: 'couple-woman-left',
    title: '남녀 · 여 왼쪽',
    source: path.join(ROOT, 'tmp-faceswap-test', 'try-shorts-kiss-v2', 'f01-start.jpg'),
    faces: [
      { slot: 'woman', x: 0.14, y: 0.4, w: 0.2, h: 0.14 },
      { slot: 'man', x: 0.5, y: 0.36, w: 0.22, h: 0.15 },
    ],
  },
  {
    id: 'couple-woman-right',
    title: '남녀 · 여 오른쪽',
    source: path.join(ROOT, 'tmp-faceswap-test', 'woman-face-id.jpg'),
    faces: [
      { slot: 'man', x: 0.0, y: 0.08, w: 0.2, h: 0.52 },
      { slot: 'woman', x: 0.28, y: 0.1, w: 0.58, h: 0.64 },
    ],
  },
]

function pointInNorm(box, x, y) {
  if (!box) return false
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h
}

function personFromFace(face) {
  const x = Math.max(0, face.x - face.w * 0.45)
  const y = Math.max(0, face.y - face.h * 0.7)
  return {
    slot: face.slot,
    x,
    y,
    w: Math.min(1 - x, face.w * 2.4),
    h: Math.min(1 - y, Math.max(face.h * 5.5, 0.55)),
  }
}

function layoutFromFaces(faces) {
  const womanFace = faces.find((f) => f.slot === 'woman')
  const manFace = faces.find((f) => f.slot === 'man')
  if (!manFace) {
    return {
      woman: { slot: 'woman', x: 0, y: 0, w: 1, h: 1 },
      man: null,
      solo: true,
    }
  }
  return {
    woman: personFromFace(womanFace),
    man: personFromFace(manFace),
    solo: false,
  }
}

/** public/app.js buildWomanClothesMaskDataUrl 과 같은 규칙 */
function buildClientClothesMask(rgba, width, height, layout, faces) {
  const womanFaces = faces.filter((f) => pointInNorm(layout.woman, f.x + f.w / 2, f.y + f.h / 2) && f.slot === 'woman')
  if (womanFaces.length !== 1) return { ok: false, reason: 'woman_face_unlink' }
  if (layout.man) {
    const manFaces = faces.filter((f) => pointInNorm(layout.man, f.x + f.w / 2, f.y + f.h / 2) && f.slot === 'man')
    if (manFaces.length !== 1) return { ok: false, reason: 'man_face_unlink' }
  } else if (faces.length !== 1) {
    return { ok: false, reason: 'cast_people' }
  }
  const face = womanFaces[0]
  const w = width
  const h = height
  const fx0 = Math.round((face.x + face.w * 0.25) * w)
  const fy0 = Math.round((face.y + face.h * 0.28) * h)
  const fx1 = Math.round((face.x + face.w * 0.75) * w)
  const fy1 = Math.round((face.y + face.h * 0.72) * h)
  let sr = 0
  let sg = 0
  let sb = 0
  let sn = 0
  for (let y = fy0; y < fy1; y += 2) {
    for (let x = fx0; x < fx1; x += 2) {
      const i = (y * w + x) * 4
      if (i < 0 || i >= rgba.length) continue
      sr += rgba[i]
      sg += rgba[i + 1]
      sb += rgba[i + 2]
      sn += 1
    }
  }
  if (!sn) return { ok: false, reason: 'no_skin_sample' }
  sr /= sn
  sg /= sn
  sb /= sn
  const hairTop = face.y - face.h * 0.55
  const neckBot = face.y + face.h * 1.28
  const facePadX = face.w * 0.22
  const mask = new Uint8Array(w * h)
  let white = 0
  let womanPx = 0
  let invade = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4
      const nx = x / w
      const ny = y / h
      const inWoman = pointInNorm(layout.woman, nx, ny)
      const inMan = layout.man ? pointInNorm(layout.man, nx, ny) : false
      if (inWoman) womanPx += 1
      const dr = rgba[i] - sr
      const dg = rgba[i + 1] - sg
      const db = rgba[i + 2] - sb
      const skin = dr * dr + dg * dg + db * db < 42 * 42 && rgba[i] > rgba[i + 2] - 8
      let keep = true
      if (!inWoman || inMan) keep = true
      else {
        const inHead =
          ny >= hairTop &&
          ny <= neckBot &&
          nx >= face.x - facePadX &&
          nx <= face.x + face.w + facePadX
        keep = inHead || skin || rgba[i + 3] < 20
      }
      if (keep) mask[y * w + x] = 0
      else {
        mask[y * w + x] = 255
        white += 1
        if (skin || (dr * dr + dg * dg + db * db < 38 * 38 && rgba[i] > rgba[i + 2] - 8)) invade += 1
      }
    }
  }
  const ratio = white / Math.max(womanPx, 1)
  const abort =
    white < 80 || ratio < 0.04 || ratio > 0.48
      ? 'mask_not_clothes'
      : invade / Math.max(white, 1) > 0.02
        ? 'mask_invade'
        : ''
  return {
    ok: !abort,
    reason: abort || '',
    mask,
    white,
    womanPx,
    ratio,
    invade,
    invadeFrac: white ? invade / white : 1,
    skinSample: { r: sr, g: sg, b: sb },
    face,
  }
}

/** public/app.js deskFaceDescriptor */
function deskFaceDescriptor(rgba, width, height, box) {
  const sx = Math.max(0, box.x * width)
  const sy = Math.max(0, box.y * height)
  const sw = Math.max(8, box.w * width)
  const sh = Math.max(8, box.h * height)
  const vec = []
  let sum = 0
  for (let py = 0; py < 32; py += 1) {
    for (let px = 0; px < 32; px += 1) {
      const x = Math.min(width - 1, Math.floor(sx + ((px + 0.5) / 32) * sw))
      const y = Math.min(height - 1, Math.floor(sy + ((py + 0.5) / 32) * sh))
      const i = (y * width + x) * 4
      const luma = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]
      vec.push(luma)
      sum += luma
    }
  }
  const mean = sum / vec.length
  return vec.map((v) => v - mean)
}

function deskVecCos(a, b) {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

function drawBox(rgba, width, height, box, rgb, t = 3) {
  const x0 = Math.max(0, Math.round(box.x * width))
  const y0 = Math.max(0, Math.round(box.y * height))
  const x1 = Math.min(width - 1, Math.round((box.x + box.w) * width))
  const y1 = Math.min(height - 1, Math.round((box.y + box.h) * height))
  const set = (x, y) => {
    const i = (y * width + x) * 4
    rgba[i] = rgb[0]
    rgba[i + 1] = rgb[1]
    rgba[i + 2] = rgb[2]
    rgba[i + 3] = 255
  }
  for (let x = x0; x <= x1; x += 1) {
    for (let k = 0; k < t; k += 1) {
      if (y0 + k < height) set(x, y0 + k)
      if (y1 - k >= 0) set(x, y1 - k)
    }
  }
  for (let y = y0; y <= y1; y += 1) {
    for (let k = 0; k < t; k += 1) {
      if (x0 + k < width) set(x0 + k, y)
      if (x1 - k >= 0) set(x1 - k, y)
    }
  }
}

function cloneRgba(src) {
  return new Uint8Array(src)
}

function probeMask(mask, width, height, nx, ny) {
  const x = Math.min(width - 1, Math.max(0, Math.round(nx * width)))
  const y = Math.min(height - 1, Math.max(0, Math.round(ny * height)))
  return mask[y * width + x]
}

function hardBlackDiff(src, out, mask, width, height) {
  let n = 0
  let max = 0
  let sum = 0
  let changed = 0
  for (let p = 0; p < width * height; p += 1) {
    if (mask[p] >= 128) continue
    const i = p * 4
    const mad =
      (Math.abs(src[i] - out[i]) + Math.abs(src[i + 1] - out[i + 1]) + Math.abs(src[i + 2] - out[i + 2])) / 3
    n += 1
    sum += mad
    if (mad > max) max = mad
    if (mad > 0) changed += 1
  }
  return { n, max, mad: n ? sum / n : 0, changed, identical: n > 0 && max === 0 }
}

mkdirSync(OUT, { recursive: true })

const descriptorFn = APP.slice(
  APP.indexOf('async function deskFaceDescriptor'),
  APP.indexOf('function deskVecCos'),
)
const histFn = APP.slice(APP.indexOf('async function deskFaceHist'), APP.indexOf('function deskHistCorr'))
const protectFn = APP.slice(
  APP.indexOf('async function deskProtectPixelDiff'),
  APP.indexOf('async function deskStillPasses'),
)
const gateUses = {
  descriptor: /deskFaceDescriptor/.test(APP) && /deskVecCos\(left, right\) < 0.78/.test(APP),
  histInGate: /deskHistCorr/.test(APP.slice(APP.indexOf('async function deskStillPasses'), APP.indexOf('async function resolveDeskFrame'))),
  protectMadLimit: (protectFn.match(/mean <= ([0-9.]+)/) || [])[1] || null,
}

const casesOut = []
for (const item of CASES) {
  const dir = path.join(OUT, item.id)
  mkdirSync(dir, { recursive: true })
  const buf = readFileSync(item.source)
  const decoded = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const width = decoded.info.width
  const height = decoded.info.height
  const src = new Uint8Array(decoded.data)
  const layout = layoutFromFaces(item.faces)
  const built = buildClientClothesMask(src, width, height, layout, item.faces)

  const overlay = cloneRgba(src)
  if (layout.woman) drawBox(overlay, width, height, layout.woman, [0, 220, 80], 4)
  if (layout.man) drawBox(overlay, width, height, layout.man, [40, 120, 255], 4)
  for (const f of item.faces) drawBox(overlay, width, height, f, f.slot === 'woman' ? [255, 60, 180] : [255, 200, 0], 2)

  const mask = built.mask || new Uint8Array(width * height)
  const protectVis = new Uint8Array(src.length)
  const maskRgb = new Uint8Array(src.length)
  for (let p = 0; p < width * height; p += 1) {
    const i = p * 4
    const white = mask[p] >= 128
    maskRgb[i] = white ? 255 : 0
    maskRgb[i + 1] = white ? 255 : 0
    maskRgb[i + 2] = white ? 255 : 0
    maskRgb[i + 3] = 255
    if (white) {
      protectVis[i] = 255
      protectVis[i + 1] = 0
      protectVis[i + 2] = 80
      protectVis[i + 3] = 255
    } else {
      protectVis[i] = src[i]
      protectVis[i + 1] = src[i + 1]
      protectVis[i + 2] = src[i + 2]
      protectVis[i + 3] = 255
    }
  }

  const gen = new Uint8Array(src.length)
  for (let i = 0; i < gen.length; i += 4) {
    gen[i] = 255
    gen[i + 1] = 0
    gen[i + 2] = 255
    gen[i + 3] = 255
  }
  const out = built.mask ? comp.compositeProtectRgba(src, gen, mask, width, height, 5) : cloneRgba(src)
  const alpha0 = built.mask ? comp.protectRegionMad(src, out, mask, width, height, 5) : { n: 0, max: 1, mad: 1, identical: false }
  const hard = built.mask ? hardBlackDiff(src, out, mask, width, height) : { n: 0, max: 1, mad: 1, changed: 0, identical: false }

  const womanFace = item.faces.find((f) => f.slot === 'woman')
  const manFace = item.faces.find((f) => f.slot === 'man')
  const probes = {
    womanFaceCenter: probeMask(mask, width, height, womanFace.x + womanFace.w / 2, womanFace.y + womanFace.h / 2),
    womanChest: probeMask(mask, width, height, womanFace.x + womanFace.w / 2, Math.min(0.98, womanFace.y + womanFace.h * 1.7)),
    cornerTL: probeMask(mask, width, height, 0.04, 0.04),
    cornerBR: probeMask(mask, width, height, 0.96, 0.96),
  }
  if (manFace) {
    probes.manFaceCenter = probeMask(mask, width, height, manFace.x + manFace.w / 2, manFace.y + manFace.h / 2)
  }

  const descriptors = item.faces.map((f) => ({
    slot: f.slot,
    dim: 1024,
    sample: deskFaceDescriptor(src, width, height, f).slice(0, 8).map((v) => Math.round(v * 10) / 10),
    vec: deskFaceDescriptor(src, width, height, f),
  }))
  const pairCos =
    descriptors.length === 2 ? deskVecCos(descriptors[0].vec, descriptors[1].vec) : null

  await sharp(Buffer.from(src), { raw: { width, height, channels: 4 } }).png().toFile(path.join(dir, '00-source.png'))
  await sharp(Buffer.from(overlay), { raw: { width, height, channels: 4 } }).png().toFile(path.join(dir, '01-woman-coords.png'))
  await sharp(Buffer.from(maskRgb), { raw: { width, height, channels: 4 } }).png().toFile(path.join(dir, '02-mask-white.png'))
  await sharp(Buffer.from(protectVis), { raw: { width, height, channels: 4 } }).png().toFile(path.join(dir, '03-protect.png'))
  await sharp(Buffer.from(out), { raw: { width, height, channels: 4 } }).png().toFile(path.join(dir, '04-composite-rule.png'))

  const delta = new Uint8Array(src.length)
  for (let p = 0; p < width * height; p += 1) {
    const i = p * 4
    const dlt =
      (Math.abs(src[i] - out[i]) + Math.abs(src[i + 1] - out[i + 1]) + Math.abs(src[i + 2] - out[i + 2])) / 3
    const v = dlt > 0 ? 255 : 0
    delta[i] = v
    delta[i + 1] = mask[p] >= 128 ? 0 : v
    delta[i + 2] = mask[p] >= 128 ? 0 : v
    delta[i + 3] = 255
  }
  await sharp(Buffer.from(delta), { raw: { width, height, channels: 4 } }).png().toFile(path.join(dir, '05-protect-delta.png'))

  const facts = {
    id: item.id,
    title: item.title,
    sourceRel: path.relative(ROOT, item.source).replaceAll('\\', '/'),
    paidCalls: 0,
    width,
    height,
    layout,
    faces: item.faces,
    maskOk: built.ok,
    maskReason: built.reason || 'ok',
    white: built.white || 0,
    womanPx: built.womanPx || 0,
    whiteRatioInWoman: built.ratio || 0,
    invade: built.invade || 0,
    invadeFrac: built.invadeFrac || 0,
    skinSample: built.skinSample || null,
    probes,
    maskIsClothesSegment: false,
    maskRule: '여 CAST 칸에서 머리·목 밴드와 얼굴 피부색에 가까운 화소를 뺀 나머지',
    protectAlpha0: alpha0,
    protectHardBlack: hard,
    compositeRule: 'out = src*(1-a)+gen*a, a=feather(mask,5px). gen=magenta fake, no paid model',
    descriptors: descriptors.map((d) => ({ slot: d.slot, dim: d.dim, sample8: d.sample })),
    womanManCosine: pairCos,
    wouldPassEmbedThresholdAgainstOtherPerson: pairCos != null ? pairCos >= 0.78 : null,
  }
  writeFileSync(path.join(dir, 'facts.json'), JSON.stringify(facts, null, 2))
  casesOut.push(facts)
  console.log(
    `${item.id}  mask=${facts.maskReason} white=${facts.white}  a0.max=${alpha0.max} hard.max=${hard.max} hard.changed=${hard.changed}`,
  )
}

const report = {
  generatedAt: '2026-09-17',
  paidCalls: 0,
  deploy: false,
  wanTouched: false,
  menuTouched: false,
  maskIsClothesSegment: false,
  compositeLocksProtect: true,
  cases: casesOut.map((c) => ({
    id: c.id,
    title: c.title,
    maskOk: c.maskOk,
    maskReason: c.maskReason,
    white: c.white,
    whiteRatioInWoman: c.whiteRatioInWoman,
    invadeFrac: c.invadeFrac,
    probes: c.probes,
    protectAlpha0Identical: c.protectAlpha0.identical,
    protectAlpha0: { n: c.protectAlpha0.n, mad: c.protectAlpha0.mad, max: c.protectAlpha0.max },
    protectHardBlackIdentical: c.protectHardBlack.identical,
    protectHardBlack: {
      n: c.protectHardBlack.n,
      mad: c.protectHardBlack.mad,
      max: c.protectHardBlack.max,
      changed: c.protectHardBlack.changed,
    },
    womanManCosine: c.womanManCosine,
    wouldPassEmbedThresholdAgainstOtherPerson: c.wouldPassEmbedThresholdAgainstOtherPerson,
  })),
  faceDescriptor: {
    function: 'deskFaceDescriptor',
    file: 'public/app.js',
    isNeuralEmbedding: false,
    meaning:
      '얼굴 상자를 32×32로 줄인 뒤 각 화소의 루마(0.299R+0.587G+0.114B)를 모은 1024차원 벡터. 평균을 빼 중심화한다. ArcFace/InsightFace 임베딩이 아니다.',
    compare: 'deskVecCos, 게이트 임계값 0.78',
    alsoPresent: {
      deskFaceHist: '32×32에서 16칸 루마 히스토그램 + 평균 RGB. deskStillPasses는 현재 이것을 쓰지 않는다.',
    },
    gateProtectMad: gateUses.protectMadLimit,
    gateUsesDescriptor: gateUses.descriptor,
    gateUsesHist: gateUses.histInGate,
    sourceExcerpt: descriptorFn.trim().slice(0, 900),
    histExcerpt: histFn.trim().slice(0, 400),
  },
}

writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))

const cards = casesOut
  .map((c) => {
    const rel = c.id
    return `<section><h2>${c.title} <code>${c.id}</code></h2>
<p>마스크 ${c.maskReason} · 흰 ${c.white}px (${(c.whiteRatioInWoman * 100).toFixed(1)}% of woman box) · α=0 max ${c.protectAlpha0.max} · hard-black max ${c.protectHardBlack.max} changed ${c.protectHardBlack.changed}</p>
<div class="row">
<figure><img src="${rel}/00-source.png" alt="source"><figcaption>원본</figcaption></figure>
<figure><img src="${rel}/01-woman-coords.png" alt="coords"><figcaption>여 칸 초록 · 남 칸 파랑 · 얼굴</figcaption></figure>
<figure><img src="${rel}/02-mask-white.png" alt="mask"><figcaption>흰=수정 마스크</figcaption></figure>
<figure><img src="${rel}/03-protect.png" alt="protect"><figcaption>보호=원본, 수정=자홍 표시</figcaption></figure>
<figure><img src="${rel}/04-composite-rule.png" alt="composite"><figcaption>최종=원본검정+자홍흰</figcaption></figure>
<figure><img src="${rel}/05-protect-delta.png" alt="delta"><figcaption>검정영역 차이(희면 차이&gt;0)</figcaption></figure>
</div></section>`
  })
  .join('\n')

writeFileSync(
  path.join(OUT, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>desk mask audit</title>
<style>body{font:14px/1.4 sans-serif;background:#111;color:#eee;margin:16px} img{max-width:220px;height:auto;background:#333} .row{display:flex;flex-wrap:wrap;gap:8px} figure{margin:0} figcaption{font-size:12px;color:#bbb}</style>
<h1>LOOK 마스크 감사 · 유료 0</h1>
<p>흰 마스크는 의상 세그가 아니라 여 CAST 칸의 나머지입니다. 합성 후 α=0(완전 보호)은 원본과 같아야 합니다. 5px 여밈 띠의 검정은 바뀔 수 있습니다.</p>
${cards}`,
)

console.log(JSON.stringify({ out: path.relative(ROOT, OUT), paidCalls: 0, cases: report.cases }, null, 2))
