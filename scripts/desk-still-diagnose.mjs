#!/usr/bin/env node
/**
 * Desk 정지화 생성 직전 진단. fal/Replicate/Wan 호출 없음. 배포 없음. 제품 코드 변경 없음.
 * 흰=수정, 검=유지 마스크 PNG를 실제 buildDeskClothesMaskDataUrl로 저장한다.
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'desk-still-diagnose')
const BUNDLE_DIR = path.join(ROOT, '_tmp_bundle')
const MASK_BUNDLE = path.join(BUNDLE_DIR, 'face-preserve-mask.cjs')
const PROMPT_BUNDLE = path.join(BUNDLE_DIR, 'desk-still-prompt.cjs')

if (!existsSync(BUNDLE_DIR)) mkdirSync(BUNDLE_DIR, { recursive: true })
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/face-preserve-mask.ts" --bundle --platform=node --format=cjs --outfile="${MASK_BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
execSync(
  `node_modules\\.bin\\esbuild "functions/lib/desk-still-prompt.ts" --bundle --platform=node --format=cjs --outfile="${PROMPT_BUNDLE}"`,
  { cwd: ROOT, stdio: 'pipe' },
)
const maskMod = await import(`file://${MASK_BUNDLE}?t=${Date.now()}`)
const promptMod = await import(`file://${PROMPT_BUNDLE}?t=${Date.now()}`)

function imageSize(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1
        continue
      }
      const marker = buf[i + 1]
      if (marker === 0xd8 || marker === 0xd9) {
        i += 2
        continue
      }
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) }
      }
      const len = buf.readUInt16BE(i + 2)
      i += 2 + len
    }
    throw new Error('jpeg_sof_missing')
  }
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  throw new Error('unknown_image')
}

function poseDrawReplicateSize(aspectRatio) {
  if (aspectRatio === '16:9') return { width: 1216, height: 832 }
  if (aspectRatio === '1:1') return { width: 1024, height: 1024 }
  if (aspectRatio === '3:4' || aspectRatio === '2:3' || aspectRatio === 'portrait') {
    return { width: 832, height: 1216 }
  }
  return { width: 768, height: 1344 }
}

function clientAspectRatio(width, height) {
  const ratio = height / Math.max(width, 1)
  if (width > height * 1.08) return '16:9'
  if (Math.abs(width - height) / Math.max(width, 1) < 0.08) return '1:1'
  if (ratio < 1.62) return '3:4'
  return '9:16'
}

function serverMaskSize(aspectRatio) {
  const dims = poseDrawReplicateSize(aspectRatio)
  return { width: Math.min(768, dims.width), height: Math.min(1024, dims.height) }
}

function decodeDataUrlPng(dataUrl) {
  const b64 = dataUrl.replace(/^data:image\/png;base64,/, '')
  return Buffer.from(b64, 'base64')
}

function maskStatsFromFn(options) {
  const dataUrl = maskMod.buildDeskClothesMaskDataUrl(options)
  const png = decodeDataUrlPng(dataUrl)
  const { width, height } = options
  const faceKeepRatio = Math.min(0.48, Math.max(0.22, options.faceKeepRatio ?? 0.34))
  const cutY = Math.floor(height * faceKeepRatio)
  const padX = Math.floor(width * 0.06)
  const padBot = Math.floor(height * 0.04)
  const midX = options.rightHalfOnly ? Math.floor(width * 0.5) : 0
  let white = 0
  const probes = {
    forehead: 0,
    neckBand: 0,
    chestCenter: 0,
    handApprox: 0,
    leftTorso: 0,
    rightTorso: 0,
    sidePad: 0,
    bottomPad: 0,
  }
  const sample = (x, y) => {
    const keep = x < midX || y < cutY || x < padX || x >= width - padX || y >= height - padBot
    return keep ? 0 : 255
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (sample(x, y) === 255) white += 1
    }
  }
  probes.forehead = sample(Math.floor(width * 0.75), Math.floor(height * 0.12))
  probes.neckBand = sample(Math.floor(width * 0.75), Math.floor(cutY + 8))
  probes.chestCenter = sample(Math.floor(width * 0.75), Math.floor(height * 0.52))
  probes.handApprox = sample(Math.floor(width * 0.62), Math.floor(height * 0.62))
  probes.leftTorso = sample(Math.floor(width * 0.25), Math.floor(height * 0.55))
  probes.rightTorso = sample(Math.floor(width * 0.75), Math.floor(height * 0.55))
  probes.sidePad = sample(Math.floor(padX / 2), Math.floor(height * 0.5))
  probes.bottomPad = sample(Math.floor(width * 0.5), height - Math.max(1, Math.floor(padBot / 2)))
  return {
    png,
    dataUrlBytes: dataUrl.length,
    width,
    height,
    faceKeepRatio,
    cutY,
    padX,
    padBot,
    midX,
    white,
    black: width * height - white,
    whiteRatio: white / (width * height),
    probes,
    clothesOnly:
      probes.neckBand === 0 &&
      probes.handApprox === 0 &&
      probes.chestCenter === 255 &&
      probes.forehead === 0,
    note: '기하 밴드일 뿐 의상 세그멘테이션이 아니다. 흰 영역은 목·피부·체형·손을 포함한다.',
  }
}

/** public/app.js cropDeskRightPerson 과 동일 */
function cropDeskRightPersonGeom(w, h, boxes) {
  const list = (boxes || []).filter((b) => b && b.w >= 0.04 && b.h >= 0.05)
  if (list.length < 1) return { ok: false, reason: 'no-box' }
  const sorted = list.slice().sort((a, b) => a.x - b.x)
  const right = sorted[sorted.length - 1]
  const faceW = Math.max(8, right.w * w)
  const left = sorted[0]
  const leftCx = (left.x + left.w / 2) * w
  const rightCx = (right.x + right.w / 2) * w
  const mid = sorted.length >= 2 ? Math.round((leftCx + rightCx) / 2) : Math.round(w * 0.48)
  let sx = Math.max(mid, Math.round(right.x * w - faceW * 0.22))
  if (sorted.length === 1) {
    const cx = right.x + right.w / 2
    if (cx < 0.58) return { ok: false, reason: 'single-face-not-right', cx }
    sx = Math.max(Math.round(w * 0.46), Math.round(right.x * w - faceW * 0.2))
  }
  sx = Math.max(sx, Math.round(w * 0.38))
  const sw = Math.max(32, w - sx)
  if (sw > w * 0.64 || sx < w * 0.32) return { ok: false, reason: 'crop-reject', sx, sw, w }
  return {
    ok: true,
    sx,
    sy: 0,
    sw,
    sh: h,
    fullW: w,
    fullH: h,
    pickedBox: right,
    sorted,
    mid,
  }
}

const DESK_STILL_PASSES = {
  implemented: 'histogram + face count + crop center, not embedding',
  missing: ['face embedding cosine', 'gender composition', 'protected-region pixel delta'],
  skipPass: [
    { when: 'result face boxes null', reason: 'undetected', ok: true, note: '검사 실패를 통과로 친다' },
    { when: 'source face boxes empty', reason: 'source-undetected', ok: true, note: '원본 미검출도 통과' },
  ],
  fail: [
    { reason: 'extra', when: 'outBoxes.length > expect', expect: '1 or 2' },
    { reason: 'mw-ww', when: 'expect>=2 and outBoxes.length < expect', note: '성별이 아니라 얼굴 개수만 본다' },
    { reason: 'faces', when: 'expect===1 and count !== 1' },
    { reason: 'crop', when: 'hypot(dx,dy) > 0.18 OR scale > 1.85 OR scale < 0.45', thresholds: { centerShift: 0.18, scaleHi: 1.85, scaleLo: 0.45 } },
    { reason: 'face', when: 'deskHistCorr < 0.62', formula: '0.65*histCosine + 0.35*meanRGB', note: '32x32 16-bin luma. 임베딩 아님' },
  ],
  retry: 1,
  pasteOnFail: false,
}

const CASES = [
  {
    id: 'woman-bust',
    title: '여성 상반신',
    source: path.join(ROOT, 'tmp-faceswap-test', 'try-extend', '5-woman-id.jpg'),
    couple: false,
    labeledFaces: [{ gender: 'female', x: 0.22, y: 0.16, w: 0.56, h: 0.62 }],
    labeledWomanSide: 'only',
    bodyInfoInSource: false,
    wouldNeedBodyExtend: true,
  },
  {
    id: 'woman-full',
    title: '여성 전신',
    source: path.join(ROOT, 'tmp-faceswap-test', 'try-stand', '1-stand.jpg'),
    couple: false,
    labeledFaces: [{ gender: 'female', x: 0.39, y: 0.07, w: 0.2, h: 0.13 }],
    labeledWomanSide: 'center',
    bodyInfoInSource: true,
    wouldNeedBodyExtend: false,
  },
  {
    id: 'couple-bust',
    title: '남녀 상반신',
    source: path.join(ROOT, 'tmp-faceswap-test', 'woman-face-id.jpg'),
    couple: true,
    labeledFaces: [
      { gender: 'male', x: 0.0, y: 0.08, w: 0.2, h: 0.52 },
      { gender: 'female', x: 0.28, y: 0.1, w: 0.58, h: 0.64 },
    ],
    labeledWomanSide: 'right',
    bodyInfoInSource: false,
    wouldNeedBodyExtend: true,
  },
  {
    id: 'couple-full',
    title: '남녀 전신',
    source: path.join(ROOT, 'tmp-faceswap-test', 'try-shorts-kiss-v2', 'f01-start.jpg'),
    couple: true,
    labeledFaces: [
      { gender: 'female', x: 0.14, y: 0.4, w: 0.2, h: 0.14 },
      { gender: 'male', x: 0.5, y: 0.36, w: 0.22, h: 0.15 },
    ],
    labeledWomanSide: 'left',
    bodyInfoInSource: true,
    wouldNeedBodyExtend: false,
  },
]

function compileLookOnly(couple) {
  return couple
    ? '원본을 그 자리에서만 고친다. 왼쪽은 남자 그대로(얼굴·몸·옷). 오른쪽 여자만 옷을 녹여 나체. 같은 얼굴·같은 자세. 여여·성별 바꾸기·새 얼굴 금지.'
    : '원본을 그 자리에서만 고친다. 얼굴·머리·몸매·자세·방 유지. 옷을 녹여 나체. 팬티 없음. 새 사람·흰 스튜디오·마른 화보 모델 금지.'
}

if (existsSync(OUT)) {
  /* keep folder, overwrite cases */
}
mkdirSync(OUT, { recursive: true })

const results = []
for (const item of CASES) {
  const dir = path.join(OUT, item.id)
  mkdirSync(dir, { recursive: true })
  const buf = readFileSync(item.source)
  const { width, height } = imageSize(buf)
  copyFileSync(item.source, path.join(dir, '00-source.jpg'))
  const aspectRatio = clientAspectRatio(width, height)
  const server = serverMaskSize(aspectRatio)
  const faceKeepRatio = item.couple ? 0.4 : 0.34
  const crop = cropDeskRightPersonGeom(width, height, item.labeledFaces)
  const codePicked = crop.ok ? crop.pickedBox : null
  const codePickedGender = codePicked
    ? item.labeledFaces.find((f) => f === codePicked || (f.x === codePicked.x && f.y === codePicked.y))
        ?.gender || 'unknown-by-x-sort'
    : null
  const genderMatch = !item.couple || codePickedGender === 'female'
  const takeCropBranch = Boolean(item.couple && crop.ok)
  const sentKeep = takeCropBranch ? 0.34 : item.couple ? 0.4 : 0.34
  const sentRightHalf = item.couple && !takeCropBranch
  const maskOptsServer = {
    width: server.width,
    height: server.height,
    faceKeepRatio: sentKeep,
    rightHalfOnly: sentRightHalf,
  }
  const maskOptsMapped = {
    width,
    height,
    faceKeepRatio: sentKeep,
    rightHalfOnly: sentRightHalf,
  }
  const statsServer = maskStatsFromFn(maskOptsServer)
  const statsMapped = maskStatsFromFn(maskOptsMapped)
  writeFileSync(path.join(dir, '01-mask-server.png'), statsServer.png)
  writeFileSync(path.join(dir, '02-mask-mapped-to-source.png'), statsMapped.png)
  let statsRightRule = null
  if (item.couple) {
    statsRightRule = maskStatsFromFn({
      width,
      height,
      faceKeepRatio: 0.4,
      rightHalfOnly: true,
    })
    writeFileSync(path.join(dir, '03-mask-right-half-rule.png'), statsRightRule.png)
  }

  const description = compileLookOnly(item.couple)
  const prompt = promptMod.buildDeskStillPrompt(description, takeCropBranch ? false : item.couple, 'look', {
    look: 'nude',
    action: 'none',
    couple: takeCropBranch ? false : item.couple,
  })
  const payload = takeCropBranch
    ? {
        composeMode: 'desk-still',
        deskStep: 'look',
        images: ['<crop-of-rightmost-person-only>'],
        description: compileLookOnly(false),
        photoreal: true,
        refKind: 'body',
        aspectRatio: crop.sw > crop.sh * 1.08 ? '16:9' : Math.abs(crop.sw - crop.sh) / Math.max(crop.sw, 1) < 0.08 ? '1:1' : '3:4',
        gender0: 'female',
        sourcePeople: 1,
        adultStill: true,
        deskLook: 'nude',
        deskCouple: false,
        deskAction: 'none',
        engineWouldBe: 'fal-look-inpaint',
        mask: { faceKeepRatio: 0.34, rightHalfOnly: false, reason: 'crop is sent as solo' },
      }
    : {
        composeMode: 'desk-still',
        deskStep: 'look',
        images: ['<full-source>'],
        description,
        photoreal: true,
        refKind: 'body',
        aspectRatio,
        gender0: item.couple ? 'female' : 'female',
        gender1: item.couple ? 'male' : undefined,
        sourcePeople: item.couple ? 2 : 1,
        sourceCast: item.couple ? 'mw' : undefined,
        adultStill: true,
        deskLook: 'nude',
        deskCouple: item.couple,
        deskAction: 'none',
        engineWouldBe: 'fal-look-inpaint',
        mask: {
          ...server,
          faceKeepRatio,
          rightHalfOnly: item.couple,
        },
      }

  const facts = {
    id: item.id,
    title: item.title,
    sourceRel: path.relative(ROOT, item.source).replaceAll('\\', '/'),
    sourcePx: { width, height },
    aspectRatio,
    serverMaskPx: server,
    couple: item.couple,
    labeledWomanSide: item.labeledWomanSide,
    labeledFaces: item.labeledFaces,
    genderDetectionInCode: false,
    codeSelects: 'rightmost face by x (cropDeskRightPerson) or left-half black (rightHalfOnly)',
    cropBranch: takeCropBranch,
    crop,
    codePickedGender,
    genderMatch,
    wouldGenerateDespiteMismatch: item.couple && !genderMatch,
    wouldAbortIfGenderUncertain: false,
    bodyInfoInSource: item.bodyInfoInSource,
    wouldNeedBodyExtend: item.wouldNeedBodyExtend,
    bodyExtendIsNewBody: item.wouldNeedBodyExtend,
    bodyExtendWouldCallPaid: item.wouldNeedBodyExtend && !item.couple,
    maskIsClothesSegmentation: false,
    maskWhiteRatioServer: statsServer.whiteRatio,
    maskProbesServer: statsServer.probes,
    maskProbesMapped: statsMapped.probes,
    maskProbesRightHalfRule: statsRightRule?.probes || null,
    protectedOnly:
      'top band (34% solo / 40% couple) + 6% side pads + 4% bottom + optional left half if rightHalfOnly',
    exposedToInpaint: ['neck below cutY', 'skin', 'torso shape', 'hands in band', 'man if he is on the right'],
    prompt,
    payload,
    paidCallMade: false,
  }
  writeFileSync(path.join(dir, 'facts.json'), JSON.stringify(facts, null, 2))
  writeFileSync(path.join(dir, 'payload.json'), JSON.stringify(payload, null, 2))
  results.push(facts)
}

const report = {
  generatedAt: '2026-09-17',
  paidCalls: 0,
  deploy: false,
  wanTouched: false,
  productCodeChanged: false,
  coupleRightFixedEvidence: [
    'functions/lib/face-preserve-mask.ts buildDeskClothesMaskDataUrl rightHalfOnly → midX = width/2, x < midX keep',
    'functions/api/tale-scene.ts LOOK mask rightHalfOnly: intent.couple',
    'functions/lib/desk-still-prompt.ts LEFT man / RIGHT woman strings',
    'public/app.js cropDeskRightPerson sorts faces by x and crops the rightmost',
    'public/app.js runDeskStepLook: if couple && cropTry → runDeskWomanCropLook (right crop as female, deskCouple:false)',
  ],
  deskStillPasses: DESK_STILL_PASSES,
  npm: { test: 'missing script', build: 'missing script', wireCheck: 'regex connection only, not execution' },
  cases: results.map((r) => ({
    id: r.id,
    labeledWomanSide: r.labeledWomanSide,
    codePickedGender: r.codePickedGender,
    genderMatch: r.genderMatch,
    wouldGenerateDespiteMismatch: r.wouldGenerateDespiteMismatch,
    cropBranch: r.cropBranch,
    maskWhiteRatioServer: r.maskWhiteRatioServer,
    bodyExtendIsNewBody: r.bodyExtendIsNewBody,
  })),
}
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))

const html = `<!doctype html>
<meta charset="utf-8">
<title>Desk still diagnose — no paid calls</title>
<style>
  body { font: 14px/1.45 sans-serif; background:#111; color:#eee; margin: 24px; }
  h1,h2 { font-weight: 650; }
  .case { display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 0 0 40px; }
  figure { margin:0; background:#1c1c1c; padding:8px; }
  img { width:100%; height:auto; display:block; background:#000; }
  .stack { position:relative; }
  .stack img:last-child { position:absolute; inset:0; mix-blend-mode: multiply; opacity: 0.72; }
  .warn { color:#ffb4b4; }
  pre { background:#000; padding:12px; overflow:auto; font-size:12px; }
</style>
<h1>생성 직전 진단 (유료 호출 0)</h1>
<p>흰=inpaint 대상, 검=유지. 마스크는 의상 세그가 아니라 상단 밴드+가장자리(+커플이면 왼쪽 절반)다.</p>
<p class="warn">와이어 체크 통과 ≠ 실행 검증. npm test / npm run build 스크립트 없음.</p>
${results
  .map(
    (r) => `
<section>
  <h2>${r.title} · ${r.id}</h2>
  <p>라벨 여성 위치: <b>${r.labeledWomanSide}</b> · 코드가 고른 성별: <b>${r.codePickedGender || 'n/a'}</b> ·
    일치: ${r.genderMatch} · 불일치여도 생성: ${r.wouldGenerateDespiteMismatch} · crop 분기: ${r.cropBranch}</p>
  <div class="case">
    <figure><img src="${r.id}/00-source.jpg" alt="source"><figcaption>원본</figcaption></figure>
    <figure><img src="${r.id}/01-mask-server.png" alt="mask"><figcaption>실제 요청에 실릴 마스크 ${r.serverMaskPx.width}×${r.serverMaskPx.height} 흰=수정</figcaption></figure>
    <figure class="stack">
      <img src="${r.id}/00-source.jpg" alt="">
      <img src="${r.id}/${r.couple ? '03-mask-right-half-rule.png' : '02-mask-mapped-to-source.png'}" alt="">
      <figcaption>${r.couple ? '커플 오른쪽 고정 규칙(왼쪽 전부 검정)을 원본에 얹음' : '원본 크기로 같은 기하를 얹음 (흰=수정)'}</figcaption>
    </figure>
  </div>
</section>`,
  )
  .join('')}
<h2>deskStillPasses</h2>
<pre>${JSON.stringify(DESK_STILL_PASSES, null, 2)}</pre>
<h2>report.json</h2>
<pre>${JSON.stringify(report, null, 2)}</pre>
`
writeFileSync(path.join(OUT, 'index.html'), html)

console.log(JSON.stringify({ out: path.relative(ROOT, OUT).replaceAll('\\', '/'), cases: report.cases }, null, 2))
