/**
 * 브라우저 ONNX. Worker에서 buffalo_l을 돌리지 않는다.
 * 불변 revision URL만 쓰고, SHA가 다르면 중단. 사각형 마스크로 되돌리지 않는다.
 */
(function (global) {
  const PIN = global.DeskLookModels && global.DeskLookModels.DESK_LOOK_MODELS
  const LABELS = [
    'Background',
    'Hat',
    'Hair',
    'Sunglasses',
    'Upper-clothes',
    'Skirt',
    'Pants',
    'Dress',
    'Belt',
    'Left-shoe',
    'Right-shoe',
    'Face',
    'Left-leg',
    'Right-leg',
    'Left-arm',
    'Right-arm',
    'Bag',
    'Scarf',
  ]
  const MEAN = [0.485, 0.456, 0.406]
  const STD = [0.229, 0.224, 0.225]

  let loadedSha = { segformerSha256: '', recSha256: '' }
  let ort = null
  let segSess = null
  let recSess = null

  async function sha256Hex(buf) {
    const d = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('')
  }

  async function fetchPinned(kind) {
    if (!PIN || !PIN[kind]) throw new Error('model_pin_missing')
    const pin = PIN[kind]
    const res = await fetch(pin.url, { mode: 'cors' })
    if (!res.ok) throw new Error('model_http')
    const buf = await res.arrayBuffer()
    const head = new Uint8Array(buf.slice(0, 16))
    const html = head[0] === 0x3c || (head[0] === 0xef && head[1] === 0xbb)
    if (html || buf.byteLength < 1_000_000 || buf.byteLength !== pin.bytes) throw new Error('model_not_onnx')
    const sha = await sha256Hex(buf)
    if (sha !== pin.sha256) throw new Error('model_sha')
    return buf
  }

  async function loadOrt() {
    if (ort) return ort
    if (global.ort) {
      ort = global.ort
      if (ort.env?.wasm && !ort.env.wasm.wasmPaths) {
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/'
      }
      // 교차 출처 격리가 없으면 멀티스레드가 못 뜬다. 1로 고정해 경고와 워커 폴백을 없앤다.
      if (ort.env?.wasm) ort.env.wasm.numThreads = 1
      return ort
    }
    return null
  }

  function imageDataToCHW(img, size) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)
    const out = new Float32Array(3 * size * size)
    for (let i = 0; i < size * size; i += 1) {
      out[i] = (data[i * 4] / 255 - MEAN[0]) / STD[0]
      out[size * size + i] = (data[i * 4 + 1] / 255 - MEAN[1]) / STD[1]
      out[2 * size * size + i] = (data[i * 4 + 2] / 255 - MEAN[2]) / STD[2]
    }
    return out
  }

  async function loadImage(src) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('image_load'))
      img.src = src
    })
    return img
  }

  async function parseLabels(src) {
    const api = await loadOrt()
    if (!api || !PIN) return { ok: false, reason: 'parse_unavailable' }
    if (!segSess) {
      try {
        const buf = await fetchPinned('segformer')
        loadedSha.segformerSha256 = PIN.segformer.sha256
        segSess = await api.InferenceSession.create(buf)
      } catch {
        return { ok: false, reason: 'parse_unavailable' }
      }
    }
    const img = await loadImage(src)
    const chw = imageDataToCHW(img, 512)
    const inputName = segSess.inputNames[0]
    const tensor = new api.Tensor('float32', chw, [1, 3, 512, 512])
    const out = await segSess.run({ [inputName]: tensor })
    const logits = out[segSess.outputNames[0]]
    const dims = logits.dims
    const c = dims.length === 4 ? dims[1] : dims[0]
    const hh = dims.length === 4 ? dims[2] : dims[1]
    const ww = dims.length === 4 ? dims[3] : dims[2]
    const arr = logits.data
    const pred = new Uint8Array(hh * ww)
    for (let y = 0; y < hh; y += 1) {
      for (let x = 0; x < ww; x += 1) {
        let best = 0
        let bi = 0
        for (let k = 0; k < c; k += 1) {
          const v = arr[k * hh * ww + y * ww + x]
          if (v > best) {
            best = v
            bi = k
          }
        }
        pred[y * ww + x] = bi
      }
    }
    const width = img.naturalWidth
    const height = img.naturalHeight
    const labels = []
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const mx = Math.min(ww - 1, Math.floor((x / width) * ww))
        const my = Math.min(hh - 1, Math.floor((y / height) * hh))
        labels.push(LABELS[pred[my * ww + mx]] || 'Background')
      }
    }
    return { ok: true, labels, width, height }
  }

  async function embedCrop(src, box) {
    const api = await loadOrt()
    if (!api || !PIN) return { ok: false, reason: 'undetected', dim: 0, vec: null }
    if (!recSess) {
      try {
        const buf = await fetchPinned('rec')
        loadedSha.recSha256 = PIN.rec.sha256
        recSess = await api.InferenceSession.create(buf)
      } catch {
        return { ok: false, reason: 'undetected', dim: 0, vec: null }
      }
    }
    const img = await loadImage(src)
    const w = img.naturalWidth
    const h = img.naturalHeight
    const side = Math.max(box.w * w, box.h * h) * 1.36
    const cx = (box.x + box.w / 2) * w
    const cy = (box.y + box.h / 2) * h
    const sx = Math.max(0, cx - side / 2)
    const sy = Math.max(0, cy - side / 2)
    const canvas = document.createElement('canvas')
    canvas.width = 112
    canvas.height = 112
    canvas.getContext('2d').drawImage(img, sx, sy, Math.min(w - sx, side), Math.min(h - sy, side), 0, 0, 112, 112)
    const { data } = canvas.getContext('2d').getImageData(0, 0, 112, 112)
    const chw = new Float32Array(3 * 112 * 112)
    for (let i = 0; i < 112 * 112; i += 1) {
      chw[i] = (data[i * 4] - 127.5) / 127.5
      chw[112 * 112 + i] = (data[i * 4 + 1] - 127.5) / 127.5
      chw[2 * 112 * 112 + i] = (data[i * 4 + 2] - 127.5) / 127.5
    }
    const inputName = recSess.inputNames[0]
    const tensor = new api.Tensor('float32', chw, [1, 3, 112, 112])
    const out = await recSess.run({ [inputName]: tensor })
    const vec = Array.from(out[recSess.outputNames[0]].data)
    let n = 0
    for (let i = 0; i < vec.length; i += 1) n += vec[i] * vec[i]
    n = Math.sqrt(n)
    if (!n) return { ok: false, reason: 'undetected', dim: 0, vec: null }
    return { ok: true, dim: vec.length, vec: vec.map((v) => v / n), reason: '' }
  }

  global.DeskLookOnnx = {
    parse: parseLabels,
    async prepare(src, opts) {
      const parsed = await parseLabels(src)
      if (!parsed.ok) return parsed
      const faces = Array.isArray(opts?.faces) ? opts.faces : []
      const needCouple = Boolean(opts?.needCouple || opts?.layout?.man)
      const woman = faces.filter((f) => f.slot === 'woman')
      const man = faces.filter((f) => f.slot === 'man')
      if (!woman.length || (needCouple && man.length !== 1) || (!needCouple && (man.length || woman.length !== 1))) {
        return { ok: false, reason: 'undetected', ...parsed, embeds: [], faces, embedOk: false }
      }
      const embeds = []
      for (const face of faces) {
        const one = await embedCrop(src, face)
        if (!one.ok || one.dim !== 512) {
          return { ok: false, reason: 'undetected', ...parsed, embeds: [], faces, embedOk: false }
        }
        embeds.push({ slot: face.slot, dim: one.dim, vec: one.vec })
      }
      if (needCouple && embeds.length === 2) {
        const a = embeds[0].vec
        const b = embeds[1].vec
        let dot = 0
        let na = 0
        let nb = 0
        for (let i = 0; i < a.length; i += 1) {
          dot += a[i] * b[i]
          na += a[i] * a[i]
          nb += b[i] * b[i]
        }
        const cos = na && nb ? dot / Math.sqrt(na * nb) : 1
        if (cos >= 0.99) {
          return { ok: false, reason: 'undetected', ...parsed, embeds: [], faces, embedOk: false }
        }
      }
      if (!loadedSha.segformerSha256 || !loadedSha.recSha256) {
        return { ok: false, reason: 'parse_unavailable', ...parsed, embeds: [], faces, embedOk: false }
      }
      return {
        ok: true,
        reason: '',
        ...parsed,
        embeds,
        faces,
        embedOk: true,
        segformerSha256: loadedSha.segformerSha256,
        recSha256: loadedSha.recSha256,
      }
    },
    async embedCast(src, face) {
      return embedCrop(src, face)
    },
    get loadedSha() {
      return { ...loadedSha }
    },
  }
})(typeof window !== 'undefined' ? window : globalThis)
