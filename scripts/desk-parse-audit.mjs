#!/usr/bin/env node
/**
 * 유료 생성 0. SegFormer 의상 파싱 + 안쪽 feather + 검정 전체 MAD 0 + ArcFace.
 */
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-parse-audit')
const BUNDLE_DIR = path.join(ROOT, '_tmp_bundle')
const COMP_BUNDLE = path.join(BUNDLE_DIR, 'desk-clothes-composite.cjs')
const PARSE_BUNDLE = path.join(BUNDLE_DIR, 'desk-clothes-parse.cjs')

if (!existsSync(BUNDLE_DIR)) mkdirSync(BUNDLE_DIR, { recursive: true })
mkdirSync(OUT, { recursive: true })
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-clothes-composite.ts" --bundle --platform=node --format=cjs --outfile="${COMP_BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-clothes-parse.ts" --bundle --platform=node --format=cjs --outfile="${PARSE_BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const comp = await import(`file://${COMP_BUNDLE}?t=${Date.now()}`)
const parseMod = await import(`file://${PARSE_BUNDLE}?t=${Date.now()}`)

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

function personFromFace(face) {
  const x = Math.max(0, face.x - face.w * 0.55)
  const y = Math.max(0, face.y - face.h * 0.75)
  return {
    slot: face.slot,
    x,
    y,
    w: Math.min(1 - x, face.w * 2.8),
    h: Math.min(1 - y, Math.max(face.h * 6.2, 0.6)),
  }
}

function layoutFromFaces(faces) {
  const womanFace = faces.find((f) => f.slot === 'woman')
  const manFace = faces.find((f) => f.slot === 'man')
  if (!manFace) return { woman: { slot: 'woman', x: 0, y: 0, w: 1, h: 1 }, man: null }
  return { woman: personFromFace(womanFace), man: personFromFace(manFace) }
}

function probe(mask, width, height, nx, ny) {
  const x = Math.min(width - 1, Math.max(0, Math.round(nx * width)))
  const y = Math.min(height - 1, Math.max(0, Math.round(ny * height)))
  return mask[y * width + x]
}

function cosine(a, b) {
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

function inwardFeatherSelfTest() {
  const W = 32
  const H = 32
  const src = new Uint8Array(W * H * 4)
  const gen = new Uint8Array(W * H * 4)
  const mask = new Uint8Array(W * H)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4
      src[i] = 10
      src[i + 1] = 20
      src[i + 2] = 30
      src[i + 3] = 255
      gen[i] = 255
      gen[i + 1] = 0
      gen[i + 2] = 255
      gen[i + 3] = 255
      mask[y * W + x] = x >= 10 && x < 22 && y >= 10 && y < 22 ? 255 : 0
    }
  }
  const out = comp.compositeProtectRgba(src, gen, mask, W, H, 5)
  const stats = comp.protectRegionMad(src, out, mask, W, H, 5)
  if (!stats.identical) throw new Error(`inward_feather_black_not_zero max=${stats.max} changed_mad=${stats.mad}`)
  return stats
}

function lastJson(raw) {
  const lines = String(raw)
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].startsWith('{')) return JSON.parse(lines[i])
  }
  throw new Error('no_json')
}

function parseLabels(imagePath, labelsBin) {
  const raw = execFileSync('py', ['-3', path.join(ROOT, 'scripts', 'desk-segformer-parse.py')], {
    input: JSON.stringify({ image: imagePath, labelsBin }),
    encoding: 'utf8',
    timeout: 180000,
    cwd: ROOT,
  })
  const meta = lastJson(raw)
  const ids = readFileSync(labelsBin)
  const names = parseMod.CLOTHES_PARSE_LABELS
  const labels = Array.from(ids, (id) => names[id] || 'Background')
  return { ...meta, labels }
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

function embedFaces(imagePath, faces) {
  const raw = execFileSync('py', ['-3', path.join(ROOT, 'scripts', 'desk-arcface-embed.py')], {
    input: JSON.stringify({ image: imagePath, faces }),
    encoding: 'utf8',
    timeout: 180000,
    cwd: ROOT,
  })
  return lastJson(raw)
}

const featherSelf = inwardFeatherSelfTest()
console.log('ok  inward-feather black MAD 0', JSON.stringify(featherSelf))

const casesOut = []
for (const item of CASES) {
  const dir = path.join(OUT, item.id)
  mkdirSync(dir, { recursive: true })
  const decoded = await sharp(item.source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const width = decoded.info.width
  const height = decoded.info.height
  const src = new Uint8Array(decoded.data)
  const layout = layoutFromFaces(item.faces)
  const parsed = parseLabels(item.source, path.join(dir, 'labels.u8'))
  const labels = parsed.labels
  const assembled = parseMod.assembleClothesParseMask({
    labels,
    width,
    height,
    woman: layout.woman,
    man: layout.man,
  })
  const invade = parseMod.parseInvasionCounts(labels, assembled.mask)
  const womanFace = item.faces.find((f) => f.slot === 'woman')
  const manFace = item.faces.find((f) => f.slot === 'man')
  const probes = {
    womanFace: probe(assembled.mask, width, height, womanFace.x + womanFace.w / 2, womanFace.y + womanFace.h / 2),
    cornerTL: probe(assembled.mask, width, height, 0.04, 0.04),
    cornerBR: probe(assembled.mask, width, height, 0.96, 0.96),
  }
  if (manFace) {
    probes.manFace = probe(assembled.mask, width, height, manFace.x + manFace.w / 2, manFace.y + manFace.h / 2)
  }

  const gen = new Uint8Array(src.length)
  for (let i = 0; i < gen.length; i += 4) {
    gen[i] = 255
    gen[i + 1] = 0
    gen[i + 2] = 255
    gen[i + 3] = 255
  }
  const out = comp.compositeProtectRgba(src, gen, assembled.mask, width, height, 5)
  const protect = comp.protectRegionMad(src, out, assembled.mask, width, height, 5)

  const overlay = new Uint8Array(src)
  if (layout.woman) drawBox(overlay, width, height, layout.woman, [0, 220, 80], 4)
  if (layout.man) drawBox(overlay, width, height, layout.man, [40, 120, 255], 4)
  const maskRgb = new Uint8Array(src.length)
  const protectVis = new Uint8Array(src.length)
  for (let p = 0; p < width * height; p += 1) {
    const i = p * 4
    const white = assembled.mask[p] >= 128
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

  await sharp(Buffer.from(src), { raw: { width, height, channels: 4 } }).png().toFile(path.join(dir, '00-source.png'))
  await sharp(Buffer.from(overlay), { raw: { width, height, channels: 4 } }).png().toFile(path.join(dir, '01-woman-coords.png'))
  await sharp(Buffer.from(maskRgb), { raw: { width, height, channels: 4 } }).png().toFile(path.join(dir, '02-mask-white.png'))
  await sharp(Buffer.from(protectVis), { raw: { width, height, channels: 4 } }).png().toFile(path.join(dir, '03-protect.png'))
  await sharp(Buffer.from(out), { raw: { width, height, channels: 4 } }).png().toFile(path.join(dir, '04-composite-rule.png'))

  let embed = { ok: false, error: 'not_run' }
  try {
    embed = embedFaces(item.source, item.faces)
  } catch (err) {
    embed = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  const faceRows = (embed.faces || []).map((f) => ({ slot: f.slot, dim: f.dim }))
  let pairCos = null
  if ((embed.faces || []).length === 2) pairCos = cosine(embed.faces[0].vec, embed.faces[1].vec)

  const facts = {
    id: item.id,
    title: item.title,
    paidCallsThisStep: 0,
    width,
    height,
    layout,
    maskOk: assembled.ok,
    maskReason: assembled.reason || 'ok',
    white: assembled.white,
    whiteUpper: assembled.whiteUpper,
    whiteLower: assembled.whiteLower,
    clothesRegionsTogether: assembled.whiteUpper >= parseMod.MASK_MIN_WHITE && assembled.whiteLower >= parseMod.MASK_MIN_WHITE,
    invade,
    probes,
    protectBlack: protect,
    embedEngine: embed.engine || embed.error,
    embedFaces: faceRows,
    womanManArcFaceCosine: pairCos,
    visualBgOrSkin:
      invade.background + invade.skin + invade.hair === 0 &&
      probes.womanFace === 0 &&
      (probes.manFace == null || probes.manFace === 0),
    embedOk: Boolean(embed.ok),
  }
  writeFileSync(path.join(dir, 'facts.json'), JSON.stringify(facts, null, 2))
  casesOut.push(facts)
  console.log(
    `${item.id} white=${assembled.white} protect.max=${protect.max} invade.bg=${invade.background} skin=${invade.skin} embed=${facts.embedEngine}`,
  )
}

const ledger = {
  note: '유료 이미지 생성(fal/Replicate/Wan)만 센다. 로컬 가중치 다운로드는 유료 호출이 아니다.',
  previousSteps: [
    {
      id: 'desk-look-paid-once',
      when: '2026-09-17',
      falInpaint: 1,
      purpose: '합성 공식 유료 1회 검증',
    },
    {
      id: 'desk-mask-audit',
      when: '2026-09-17',
      falInpaint: 0,
      purpose: '4종 레거시 마스크 PNG',
    },
  ],
  thisStep: {
    id: 'desk-parse-audit',
    falInpaint: 0,
    replicate: 0,
    wan: 0,
    anthropic: 0,
  },
  cumulativePaidImageGens: 1,
}

const report = {
  generatedAt: '2026-09-17',
  paid: ledger,
  inwardFeatherSelfTest: featherSelf,
  clothesModel: 'Xenova/segformer_b2_clothes via local onnxruntime',
  clothesWhiteClasses: parseMod.CLOTHES_EDIT_LABELS,
  wanTouched: false,
  menuTouched: false,
  deploy: false,
  cases: casesOut,
  allBlackMad0: casesOut.every((c) => c.protectBlack.identical),
  allVisualClean: casesOut.every((c) => c.visualBgOrSkin),
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
writeFileSync(path.join(ROOT, 'tmp-faceswap-test', 'desk-paid-ledger.json'), JSON.stringify(ledger, null, 2))

const cards = casesOut
  .map((c) => {
    return `<section><h2>${c.title}</h2>
<p>흰 ${c.white} · 검정 max ${c.protectBlack.max} identical=${c.protectBlack.identical} · bg침범 ${c.invade.background} 피부 ${c.invade.skin} · 임베딩 ${c.embedEngine} 여남코사인 ${c.womanManArcFaceCosine}</p>
<div class="row">
<figure><img src="${c.id}/00-source.png"><figcaption>원본</figcaption></figure>
<figure><img src="${c.id}/01-woman-coords.png"><figcaption>CAST 칸</figcaption></figure>
<figure><img src="${c.id}/02-mask-white.png"><figcaption>의상 파싱 흰 마스크</figcaption></figure>
<figure><img src="${c.id}/03-protect.png"><figcaption>보호=원본</figcaption></figure>
<figure><img src="${c.id}/04-composite-rule.png"><figcaption>원본검정+자홍흰</figcaption></figure>
</div></section>`
  })
  .join('\n')
writeFileSync(
  path.join(OUT, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>parse audit</title>
<style>body{font:14px/1.4 sans-serif;background:#111;color:#eee;margin:16px} img{max-width:220px} .row{display:flex;flex-wrap:wrap;gap:8px} figure{margin:0}</style>
<h1>의상 파싱 감사 · 이번 단계 유료 0 · 누적 생성 1</h1>
${cards}`,
)

console.log(JSON.stringify({ allBlackMad0: report.allBlackMad0, allVisualClean: report.allVisualClean, paid: ledger }, null, 2))
if (!report.allBlackMad0) process.exit(1)
