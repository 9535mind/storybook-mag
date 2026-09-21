/**
 * 얼굴로 장면(나란히) 실측: 전신 이어그리기 → 배경제거 → 배치 → 배경
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'tmp-faceswap-test', 'try-extend')
const BASE = process.env.STORYMAG_BASE || 'https://10ee7fcc.storymag.pages.dev'
const LEFTOVER =
  'C:/Users/UserK/.cursor/projects/c-Users-UserK-Desktop-PLATFORM-fashion-magazine/assets/c__Users_UserK_AppData_Roaming_Cursor_User_workspaceStorage_445c76ae849c56e27af6a45e9bef9d4d_images_image-f82c8131-aa64-43da-baff-6fc0ffd06397.png'

function loadCreds() {
  const note = path.join(ROOT, '핀패스.txt')
  const n = fs.existsSync(note) ? fs.readFileSync(note, 'utf8') : ''
  const pin = (n.match(/^핀\s+(\S+)/m) || [])[1]?.trim()
  const password = (n.match(/패스워드\s+(\S+)/) || [])[1]?.trim()
  if (!pin) {
    const t = fs.readFileSync(path.join(ROOT, '.dev.vars'), 'utf8')
    return { pin: (t.match(/^ADMIN_PIN=(.*)$/m) || [])[1]?.trim(), password }
  }
  return { pin, password }
}

async function loginSession(password) {
  if (!password) return ''
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password }),
  })
  const data = await r.json().catch(() => ({}))
  if (!data.ok || !data.token) throw new Error(`login_failed_${r.status}`)
  console.log('  session login ok')
  return data.token
}

function toDataUrl(buf, mime = 'image/jpeg') {
  return `data:${mime};base64,${buf.toString('base64')}`
}

function cloneRgba(d) {
  return new Uint8ClampedArray(d)
}

function floodKeyStudio(d, w, h) {
  const colorAt = (x, y) => {
    const i = (y * w + x) * 4
    return [d[i], d[i + 1], d[i + 2], d[i + 3]]
  }
  const refs = [
    colorAt(2, 2),
    colorAt(w - 3, 2),
    colorAt(2, h - 3),
    colorAt(w - 3, h - 3),
    colorAt(Math.round(w / 2), 2),
  ]
  const isBg = (r, g, b) => {
    const y = r * 0.299 + g * 0.587 + b * 0.114
    const sat = Math.max(r, g, b) - Math.min(r, g, b)
    if (y > 178 && sat < 30) return true
    for (let s = 0; s < refs.length; s += 1) {
      if (Math.hypot(r - refs[s][0], g - refs[s][1], b - refs[s][2]) < 34) return true
    }
    return false
  }
  const faceKeep = (x, y) => x > w * 0.28 && x < w * 0.72 && y > h * 0.03 && y < h * 0.24
  const seen = new Uint8Array(w * h)
  const q = []
  const pushIfBg = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const si = y * w + x
    if (seen[si] || faceKeep(x, y)) return
    const [r, g, b, a] = colorAt(x, y)
    if (a < 8) {
      seen[si] = 1
      return
    }
    if (!isBg(r, g, b)) return
    seen[si] = 1
    q.push(x, y)
  }
  for (let x = 0; x < w; x += 1) {
    pushIfBg(x, 0)
    pushIfBg(x, h - 1)
  }
  for (let y = 0; y < h; y += 1) {
    pushIfBg(0, y)
    pushIfBg(w - 1, y)
  }
  let qi = 0
  while (qi < q.length) {
    const x = q[qi]
    const y = q[qi + 1]
    qi += 2
    d[(y * w + x) * 4 + 3] = 0
    pushIfBg(x - 1, y)
    pushIfBg(x + 1, y)
    pushIfBg(x, y - 1)
    pushIfBg(x, y + 1)
  }
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] < 200) d[i] = 0
  }
}

function dropStudioIslands(d, w, h) {
  const seen = new Uint8Array(w * h)
  const q = []
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const start = y * w + x
      if (seen[start] || d[start * 4 + 3] < 24) continue
      q.length = 0
      q.push(x, y)
      seen[start] = 1
      const pixels = []
      let n = 0
      let sumY = 0
      let sumSat = 0
      let colorN = 0
      let qi = 0
      while (qi < q.length) {
        const cx = q[qi]
        const cy = q[qi + 1]
        qi += 2
        const ci = cy * w + cx
        pixels.push(ci)
        const r = d[ci * 4]
        const g = d[ci * 4 + 1]
        const b = d[ci * 4 + 2]
        const luma = r * 0.299 + g * 0.587 + b * 0.114
        const sat = Math.max(r, g, b) - Math.min(r, g, b)
        n += 1
        sumY += luma
        sumSat += sat
        if (sat > 28 || luma < 150) colorN += 1
        const nbr = [cx - 1, cy, cx + 1, cy, cx, cy - 1, cx, cy + 1]
        for (let k = 0; k < nbr.length; k += 2) {
          const nx = nbr[k]
          const ny = nbr[k + 1]
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const ni = ny * w + nx
          if (seen[ni] || d[ni * 4 + 3] < 24) continue
          seen[ni] = 1
          q.push(nx, ny)
        }
      }
      const colorRatio = colorN / Math.max(n, 1)
      const meanY = sumY / Math.max(n, 1)
      const meanSat = sumSat / Math.max(n, 1)
      if (n < 48 || (colorRatio < 0.07 && meanY > 168 && meanSat < 28)) {
        for (let p = 0; p < pixels.length; p += 1) d[pixels[p] * 4 + 3] = 0
      }
    }
  }
}

function cropNonBackground(d, w, h) {
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (d[(y * w + x) * 4 + 3] < 24) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX <= minX || maxY <= minY) return { data: d, width: w, height: h }
  const pad = 8
  const sx = Math.max(0, minX - pad)
  const sy = Math.max(0, minY - pad)
  const sw = Math.min(w - sx, maxX - minX + pad * 2)
  const sh = Math.min(h - sy, maxY - minY + pad * 2)
  const out = Buffer.alloc(sw * sh * 4)
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const si = ((sy + y) * w + (sx + x)) * 4
      const di = (y * sw + x) * 4
      out[di] = d[si]
      out[di + 1] = d[si + 1]
      out[di + 2] = d[si + 2]
      out[di + 3] = d[si + 3]
    }
  }
  return { data: out, width: sw, height: sh }
}

function leftoverStudioScore(d, w, h) {
  let studio = 0
  let opaque = 0
  for (let y = Math.round(h * 0.18); y < Math.round(h * 0.82); y += 2) {
    for (let x = 2; x < w - 2; x += 2) {
      const i = (y * w + x) * 4
      if (d[i + 3] < 24) continue
      opaque += 1
      const luma = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
      const sat = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])
      if (luma > 170 && sat < 26) studio += 1
    }
  }
  return { studio, opaque, ratio: studio / Math.max(opaque, 1) }
}

async function rawFromFile(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height }
}

async function saveRaw(raw, name) {
  const buf = await sharp(Buffer.from(raw.data), {
    raw: { width: raw.width, height: raw.height, channels: 4 },
  })
    .png()
    .toBuffer()
  const out = path.join(OUT, name)
  fs.writeFileSync(out, buf)
  return out
}

function keyIdStudioBackdrop(d, w, h) {
  const sampleAt = (x, y) => {
    const i = (Math.max(0, Math.min(w - 1, x)) + Math.max(0, Math.min(h - 1, y)) * w) * 4
    return [d[i], d[i + 1], d[i + 2]]
  }
  const samples = [
    sampleAt(2, 2),
    sampleAt(w - 3, 2),
    sampleAt(2, Math.round(h * 0.12)),
    sampleAt(w - 3, Math.round(h * 0.12)),
    sampleAt(Math.round(w / 2), 2),
  ]
  const cx = w / 2
  const cy = h * 0.46
  const prx = w * 0.32
  const pry = h * 0.36
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const nx = (x - cx) / prx
      const ny = (y - cy) / pry
      if (nx * nx + ny * ny < 1) continue
      if (x > w * 0.2 && x < w * 0.8 && y > h * 0.04 && y < h * 0.42) continue
      const i = (y * w + x) * 4
      const r = d[i]
      const g = d[i + 1]
      const b = d[i + 2]
      let nearest = 999
      for (let s = 0; s < samples.length; s += 1) {
        const dr = r - samples[s][0]
        const dg = g - samples[s][1]
        const db = b - samples[s][2]
        const dist = Math.sqrt(dr * dr + dg * dg + db * db)
        if (dist < nearest) nearest = dist
      }
      const maxc = Math.max(r, g, b)
      const minc = Math.min(r, g, b)
      const luma = r * 0.299 + g * 0.587 + b * 0.114
      const outsideBody = x < w * 0.2 || x > w * 0.8
      const studioGray = outsideBody && luma > 168 && maxc - minc < 32
      if (nearest < 48 || studioGray) d[i + 3] = 0
      else if (nearest < 64) d[i + 3] = Math.round(d[i + 3] * ((64 - nearest) / 16))
    }
  }
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] < 200) d[i] = 0
  }
}

async function extractIdSubject(file) {
  const raw = await rawFromFile(file)
  keyIdStudioBackdrop(raw.data, raw.width, raw.height)
  const png = await sharp(Buffer.from(raw.data), {
    raw: { width: raw.width, height: raw.height, channels: 4 },
  })
    .png()
    .toBuffer()
  const flat = await sharp({
    create: {
      width: raw.width,
      height: raw.height,
      channels: 3,
      background: { r: 244, g: 244, b: 244 },
    },
  })
    .composite([{ input: png }])
    .jpeg({ quality: 92 })
    .toBuffer()
  return { png, flat }
}

async function buildBodyExtendCanvas(png) {
  const meta = await sharp(png).metadata()
  const cw = 768
  const ch = 1024
  const scale = Math.min((ch * 0.48) / Math.max(meta.height, 1), (cw * 0.62) / Math.max(meta.width, 1))
  const dw = Math.max(8, Math.round(meta.width * scale))
  const dh = Math.max(8, Math.round(meta.height * scale))
  const dx = Math.round((cw - dw) / 2)
  const dy = Math.round(ch * 0.05)
  const resized = await sharp(png).resize(dw, dh).png().toBuffer()
  return sharp({
    create: { width: cw, height: ch, channels: 3, background: { r: 217, g: 217, b: 217 } },
  })
    .composite([{ input: resized, left: dx, top: dy }])
    .jpeg({ quality: 92 })
    .toBuffer()
}

async function api(pathname, body, auth) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth?.token) headers['x-session-token'] = auth.token
  if (auth?.pin) headers['x-admin-pin'] = auth.pin
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { http: res.status, data }
}

async function pollScene(statusUrl, responseUrl, pin, label) {
  const started = Date.now()
  for (let i = 0; i < 70; i += 1) {
    await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 2500))
    const { http, data } = await api('/api/tale-scene-status', { statusUrl, responseUrl }, pin)
    const sec = Math.round((Date.now() - started) / 1000)
    console.log(`  [${label}] poll ${sec}s http=${http} status=${data.status} pending=${data.pending}`)
    if (data.status === 'succeeded' && data.imageUrl) return data.imageUrl
    if (data.status === 'failed' || data.ok === false) {
      throw new Error(data.message || data.error || 'scene_failed')
    }
    if (sec > 220) throw new Error('poll_timeout')
  }
  throw new Error('poll_exhausted')
}

async function postTale(pin, payload, label) {
  const { http, data } = await api('/api/tale-scene', payload, pin)
  console.log(`  [${label}] submit http=${http} ok=${data.ok} ${data.error || data.pending || 'immediate'}`)
  if (!data.ok) throw new Error(data.message || data.error || `http_${http}`)
  if (data.imageUrl) return data.imageUrl
  if (data.pending) return pollScene(data.statusUrl, data.responseUrl, pin, label)
  throw new Error('no_image')
}

async function saveRemote(url, name) {
  const res = await fetch(url)
  const buf = Buffer.from(await res.arrayBuffer())
  const out = path.join(OUT, name)
  fs.writeFileSync(out, buf)
  console.log('  saved', name, buf.length)
  return out
}

function looksEmpty(buf) {
  return sharp(buf)
    .resize(32, 32, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => {
      let sum = 0
      let sum2 = 0
      let n = 0
      const start = Math.floor(info.height * 0.48) * info.width * info.channels
      for (let i = start; i < data.length; i += info.channels) {
        const y = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
        sum += y
        sum2 += y * y
        n += 1
      }
      const mean = sum / Math.max(n, 1)
      const variance = sum2 / Math.max(n, 1) - mean * mean
      return variance < 90 && mean > 170
    })
}

async function isolateFile(file, tag) {
  const raw = await rawFromFile(file)
  const floodOnly = { data: cloneRgba(raw.data), width: raw.width, height: raw.height }
  floodKeyStudio(floodOnly.data, floodOnly.width, floodOnly.height)
  const floodScore = leftoverStudioScore(floodOnly.data, floodOnly.width, floodOnly.height)
  await saveRaw(cropNonBackground(floodOnly.data, floodOnly.width, floodOnly.height), `${tag}-flood.png`)

  const both = { data: cloneRgba(raw.data), width: raw.width, height: raw.height }
  floodKeyStudio(both.data, both.width, both.height)
  dropStudioIslands(both.data, both.width, both.height)
  const bothScore = leftoverStudioScore(both.data, both.width, both.height)
  const cropped = cropNonBackground(both.data, both.width, both.height)
  await saveRaw(cropped, `${tag}-cut.png`)
  console.log(`  ${tag} leftover flood=${floodScore.ratio.toFixed(3)} both=${bothScore.ratio.toFixed(3)}`)
  return { cropped, floodScore, bothScore }
}

async function phaseLeftover(pin) {
  console.log('\n=== 0) leftover isolation on last user shot ===')
  if (!fs.existsSync(LEFTOVER)) {
    console.log('  skip, leftover file missing')
    return
  }
  await isolateFile(LEFTOVER, '0-leftover')
  if (!pin) return
  const leftoverBuf = await sharp(LEFTOVER).resize(900, null, { fit: 'inside' }).jpeg({ quality: 88 }).toBuffer()
  const up = await api('/api/upload-image', { dataUrl: toDataUrl(leftoverBuf) }, pin)
  console.log(`  leftover upload http=${up.http} ok=${up.data.ok} ${up.data.error || ''}`)
  if (up.data.ok && up.data.imageUrl) {
    const rb = await api('/api/remove-background', { imageUrl: up.data.imageUrl }, pin)
    console.log(`  leftover birefnet http=${rb.http} ok=${rb.data.ok} ${rb.data.error || ''}`)
    if (rb.data.ok && rb.data.imageUrl) {
      const cut = await saveRemote(rb.data.imageUrl, '0-leftover-birefnet.png')
      await isolateFile(cut, '0-leftover-biref')
    }
  }
}

async function compositeSide(cuts, aspect = '9:16') {
  const [cw, ch] = aspect === '9:16' ? [768, 1365] : [1024, 1024]
  const slots = cuts.length === 1 ? [0.5] : cuts.map((_, i) => (i + 1) / (cuts.length + 1))
  const layers = []
  const maskLayers = []
  for (let i = 0; i < cuts.length; i += 1) {
    const src = cuts[i]
    const scale = Math.min((ch * 0.9) / src.height, (cw * 0.42) / src.width)
    const dw = Math.max(8, Math.round(src.width * scale))
    const dh = Math.max(8, Math.round(src.height * scale))
    const dx = Math.round(cw * slots[i] - dw / 2)
    const dy = Math.round(ch - dh - ch * 0.05)
    const png = await sharp(Buffer.from(src.data), {
      raw: { width: src.width, height: src.height, channels: 4 },
    })
      .resize(dw, dh)
      .png()
      .toBuffer()
    layers.push({ input: png, left: Math.max(0, dx), top: Math.max(0, dy) })
    maskLayers.push({ input: png, left: Math.max(0, dx), top: Math.max(0, dy), blend: 'dest-out' })
  }
  const composite = await sharp({
    create: { width: cw, height: ch, channels: 3, background: { r: 239, g: 239, b: 239 } },
  })
    .composite(layers)
    .jpeg({ quality: 92 })
    .toBuffer()
  const mask = await sharp({
    create: { width: cw, height: ch, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite(maskLayers)
    .removeAlpha()
    .png()
    .toBuffer()
  // white=inpaint, black=keep person
  const { data, info } = await sharp(mask).raw().toBuffer({ resolveWithObject: true })
  for (let p = 0; p < data.length; p += info.channels) {
    const keepPerson = data[p] < 128
    const v = keepPerson ? 0 : 255
    data[p] = v
    data[p + 1] = v
    data[p + 2] = v
  }
  const maskOut = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toBuffer()
  return { composite, mask: maskOut }
}

async function phaseFull(pin) {
  console.log('\n=== 1) extend-body + isolate + scene-bg ===')
  const woman = path.join(ROOT, 'tmp-faceswap-test', 'woman-face-id.jpg')
  const man = path.join(ROOT, 'tmp-faceswap-test', 'man-face-id.jpg')
  const jobs = [
    { file: woman, gender: 'female', tag: '1-woman' },
    { file: man, gender: 'male', tag: '1-man' },
  ]
  const cuts = []
  for (const job of jobs) {
    console.log(`\n-- ${job.tag} --`)
    const sub = await extractIdSubject(job.file)
    fs.writeFileSync(path.join(OUT, `${job.tag}-subject.png`), sub.png)
    const canvas = await buildBodyExtendCanvas(sub.png)
    fs.writeFileSync(path.join(OUT, `${job.tag}-canvas.jpg`), canvas)
    let url
    try {
      url = await postTale(
        pin,
        {
          composeMode: 'extend-body',
          images: [toDataUrl(canvas)],
          description: '두 사람이 나란히 서 있는 전신 사진, 실사',
          photoreal: true,
          refKind: 'face',
          gender0: job.gender,
        },
        `${job.tag} extend`,
      )
    } catch (e) {
      console.log('  extend failed, retry id-only', e.message)
      url = await postTale(
        pin,
        {
          composeMode: 'extend-body',
          images: [toDataUrl(sub.flat)],
          description: '두 사람이 나란히 서 있는 전신 사진, 실사',
          photoreal: true,
          refKind: 'face',
          gender0: job.gender,
          extendStyle: 'id-only',
        },
        `${job.tag} id-only`,
      )
    }
    const bodyPath = await saveRemote(url, `${job.tag}-body.jpg`)
    if (await looksEmpty(fs.readFileSync(bodyPath))) {
      console.log('  empty body, retry id-only')
      url = await postTale(
        pin,
        {
          composeMode: 'extend-body',
          images: [toDataUrl(sub.flat)],
          description: '두 사람이 나란히 서 있는 전신 사진, 실사',
          photoreal: true,
          refKind: 'face',
          gender0: job.gender,
          extendStyle: 'id-only',
        },
        `${job.tag} id-only`,
      )
      await saveRemote(url, `${job.tag}-body.jpg`)
    }
    let cutSrc = bodyPath
    try {
      const { http, data } = await api('/api/remove-background', { imageUrl: url }, pin)
      console.log(`  remove-bg http=${http} ok=${data.ok} ${data.error || ''}`)
      if (data.ok && data.imageUrl) {
        cutSrc = await saveRemote(data.imageUrl, `${job.tag}-birefnet.png`)
      }
    } catch (e) {
      console.log('  remove-bg failed', e.message)
    }
    const isolated = await isolateFile(cutSrc, job.tag)
    cuts.push(isolated.cropped)
  }

  const laid = await compositeSide(cuts)
  fs.writeFileSync(path.join(OUT, '2-composite.jpg'), laid.composite)
  fs.writeFileSync(path.join(OUT, '2-mask.png'), laid.mask)
  console.log('\n-- scene-bg --')
  const bgUrl = await postTale(
    pin,
    {
      composeMode: 'scene-bg',
      images: [toDataUrl(laid.composite), toDataUrl(laid.mask, 'image/png')],
      description: '두 사람이 나란히 서 있는 전신 사진, 실사',
      photoreal: true,
      refKind: 'face',
      aspectRatio: '9:16',
    },
    'scene-bg',
  )
  await saveRemote(bgUrl, '3-final.jpg')
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  console.log('base', BASE)
  if (process.argv.includes('--local-only')) {
    await phaseLeftover(null)
    return
  }
  const creds = loadCreds()
  const token = await loginSession(creds.password)
  const auth = { pin: creds.pin, token }
  await phaseLeftover(auth)
  await phaseFull(auth)
  console.log('\n=== DONE ===', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
