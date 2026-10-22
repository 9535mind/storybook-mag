/**
 * 자유 스튜디오 = 8월 27일자(7b98822) 완성본을 그대로 쓰는 칸.
 *
 * 서버는 얼린 사본만 부른다:
 *   /api/free-refine   ← 그날의 refine.ts      (사진 + 지시문, 나체·포즈 살아 있던 경로)
 *   /api/free-generate ← 그날의 generate.ts    (글만으로 한 장)
 *   /api/free-animate  ← 그날의 animate.ts     (쇼츠, Wan wan-2.2-i2v-fast)
 * 셋 다 functions/lib/aug27/content-policy.ts 를 본다.
 *
 * Desk 와 일러스트는 지금 코드를 그대로 쓴다. 여기를 고쳐도 저쪽은 변하지 않는다.
 */
;(() => {
  const MAX_SIDE = 1536
  /** 24/30초는 두 클립으로 나눠 만든 뒤 붙인다 (그날의 규칙 그대로). */
  const DUAL = { 24: 12, 30: 15 }

  const state = {
    /** 최초로 올린 얼굴. 이어 만들기는 이 얼굴을 다시 붙인다. */
    castPhoto: '',
    /** 올린 사진 (data URL, 미리보기용) */
    photo: '',
    /** 남친 원본. 한 장면은 이 사진과 나를 붙인다. */
    himPhoto: '',
    /** 그 사진을 올려서 받은 호스팅 URL — refine/animate 는 진짜 URL 을 요구한다 */
    photoUrl: '',
    /** 방금 만든 그림 URL */
    result: '',
    /** 그 그림이 이미 나체인가 (몸매 투영으로 만든 것인가) */
    resultNude: false,
    /** 방금 만든 무음 쇼츠. 대사는 이 장에 입힌다. */
    videoUrl: '',
    /** 지금 영상이 이미 나체인가. 잇기는 옷을 다시 입히지 않는다. */
    videoNude: false,
    /** 사용자가 녹음·올린 목소리. 있으면 TTS 대신 이걸 입힌다. */
    voiceBlob: null,
    voiceName: '',
    voiceWho: 'me',
    voices: { me: null, him: null },
    mediaRec: null,
    busy: false,
  }

  const VOICE_LABELS = { me: '나', him: '남친' }
  const VOICE_DB = 'storymag-voices'
  const VOICE_STORE = 'slots'
  /** 10월 18일 확정-2번. 나는 이 파일만 쓴다. */
  const ME_VOICE_URL = '/voices/me-ref.m4a'
  const ME_VOICE_NAME = '확정-2번'

  const openVoiceDb = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(VOICE_DB, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(VOICE_STORE)) {
          db.createObjectStore(VOICE_STORE, { keyPath: 'id' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error || new Error('voice_db_open_failed'))
    })

  const loadVoiceSlots = async () => {
    try {
      const db = await openVoiceDb()
      const rows = await new Promise((resolve, reject) => {
        const tx = db.transaction(VOICE_STORE, 'readonly')
        const req = tx.objectStore(VOICE_STORE).getAll()
        req.onsuccess = () => resolve(req.result || [])
        req.onerror = () => reject(req.error || new Error('voice_db_read_failed'))
      })
      for (const row of rows) {
        if ((row.id === 'me' || row.id === 'him') && row.blob) {
          state.voices[row.id] = {
            blob: row.blob,
            name: row.name || '저장됨',
            voiceId: row.voiceId || '',
          }
        }
      }
    } catch {
      /* 저장소를 못 열면 이번 세션만 쓴다 */
    }
    applyVoiceSlot(state.voiceWho)
  }

  const lockMeVoice = async () => {
    const res = await fetch(ME_VOICE_URL, { cache: 'force-cache' })
    if (!res.ok) throw new Error('me_voice_missing')
    const blob = await res.blob()
    if (!blob || blob.size < 1000) throw new Error('me_voice_empty')
    await saveVoiceSlot('me', blob, ME_VOICE_NAME, { voiceId: '' })
  }

  const saveVoiceSlot = async (id, blob, name, extra = {}) => {
    const prev = state.voices[id] || {}
    const voiceId = extra.voiceId !== undefined ? extra.voiceId : prev.voiceId || ''
    state.voices[id] = { blob: blob || prev.blob, name: name || prev.name || '저장됨', voiceId }
    try {
      const db = await openVoiceDb()
      await new Promise((resolve, reject) => {
        const tx = db.transaction(VOICE_STORE, 'readwrite')
        tx.objectStore(VOICE_STORE).put({
          id,
          blob: state.voices[id].blob,
          name: state.voices[id].name,
          voiceId,
          updatedAt: Date.now(),
        })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error || new Error('voice_db_write_failed'))
      })
    } catch {
      /* 저장 실패해도 이번 세션은 쓴다 */
    }
    applyVoiceSlot(id)
  }

  const applyVoiceSlot = (id) => {
    state.voiceWho = id === 'him' ? 'him' : 'me'
    const slot = state.voices[state.voiceWho]
    state.voiceBlob = slot?.blob || null
    state.voiceName = slot?.name || ''
    const me = $('free-voice-who-me')
    const him = $('free-voice-who-him')
    if (me) {
      me.className = state.voiceWho === 'me' ? 'form__submit' : 'review-panel__secondary'
      me.textContent = state.voices.me?.blob ? '나 · 2번' : '나'
    }
    if (him) {
      him.className = state.voiceWho === 'him' ? 'form__submit' : 'review-panel__secondary'
      him.textContent = state.voices.him?.blob ? '남친 · 저장됨' : '남친'
    }
    paintVoiceName()
  }

  /** 움직임 주문이 벗기를 요구하는가. */
  const NUDE_WORDS = /나체|나채|알몸|누드|벗/

  const splitMoveBeats = (text) => {
    const raw = String(text || '').replace(/가습(?!기)/g, '가슴')
    const chunks = raw
      .split(/\s*(?:그리고|,|그\s*다음|그\s*후|이어서|다음으로|그리고\s*나서)\s*/i)
      .map((s) => s.trim())
      .filter(Boolean)
    const out = []
    const push = (beat) => {
      if (beat && out[out.length - 1] !== beat) out.push(beat)
    }
    const kind = (part) => {
      if (/춤|댄스|dance/i.test(part)) return 'dance'
      if (/키스|입맞춤|kiss/i.test(part)) return 'kiss'
      if (/(가슴|젖|유방|breast)/i.test(part) && /만지|만진|만져|주무르|애무|문지르/i.test(part)) return 'breast'
      if (NUDE_WORDS.test(part)) return 'nude'
      return ''
    }
    for (const chunk of chunks) {
      const one = kind(chunk)
      if (one) {
        push(one)
        continue
      }
      if (NUDE_WORDS.test(chunk)) push('nude')
      if (/춤|댄스|dance/i.test(chunk)) push('dance')
      if (/(가슴|젖|유방)/i.test(chunk) && /만지|만진|만져|주무르|애무/i.test(chunk)) push('breast')
    }
    if (out.length <= 1 && NUDE_WORDS.test(raw)) {
      if (/춤|댄스|dance/i.test(raw)) return ['nude', 'dance']
      if (/(가슴|젖|유방)/i.test(raw) && /만지|만진|만져|주무르|애무|문지르/i.test(raw)) return ['nude', 'breast']
    }
    return out.slice(0, 3)
  }

  const BEAT_KO = {
    nude: '옷을 전부 벗고 완전 나체. 팬티 없음. 밑은 맨살',
    dance: '나체로 춤춘다. 팔과 허리가 계속 움직인다',
    breast: '자기 손으로 가슴을 계속 만진다. 멈추지 않는다',
    kiss: '입을 맞추고 유지한다',
  }

  /** 요구가 둘이면 반반, 셋이면 3등분. */
  const writeBeatMotion = (text, sec) => {
    const beats = splitMoveBeats(text)
    if (beats.length < 2) return ''
    const n = beats.length >= 3 ? 3 : 2
    const used = beats.slice(0, n)
    const total = Math.max(2, Math.round(Number(sec) || 15))
    const cuts =
      n === 2
        ? [0, Math.round(total / 2), total]
        : [0, Math.round(total / 3), Math.round((total * 2) / 3), total]
    return used.map((beat, i) => `${cuts[i]}–${cuts[i + 1]}초: ${BEAT_KO[beat] || beat}`).join('. ')
  }

  /**
   * 이미 나체인 프레임에서 시작할 때는 "벗는다"를 빼야 한다.
   * 안 빼면 엔진이 앞 절반을 탈의에 쓰고, 정작 동작은 끝에 몰려 뒤에서 옷이 되살아난다.
   * 카메라 잠금은 맨 앞에 둔다 — Wan 은 앞문장을 더 잘 따른다. 줌·다른 얼굴이 그 실패였다.
   */
  const holdNude = (text, couple) => {
    const stripped = text
      .replace(/(완전\s*)?나체(로|가\s*되어|가\s*된\s*채|인\s*채|상태로|로\s*변해)?\s*/g, '')
      .replace(/옷을?\s*(다\s*)?벗(고|은\s*채|어|기|는다)?\s*/g, '')
      .replace(/알몸(으로|인\s*채)?\s*/g, '')
      .replace(/누드(로|가\s*되어)?\s*/g, '')
      .replace(/^[\s,.·]+/, '')
      .trim()
    const core = stripped || text
    const selfBreast =
      !couple &&
      /자기|자신|스스로|혼자|her\s+own/i.test(text) &&
      /가슴|젖|유방|breast/i.test(text) &&
      /만지|만져|주무르|애무|knead|squeez|fondl|touch/i.test(text)
    const selfLock = selfBreast
      ? ' BOTH her own hands knead and squeeze her own bare breasts. No partner. No idle pose.'
      : ''
    const breastKiss =
      couple &&
      /(?:가슴|젖꼭지|유두|유방)\s*(?:에(?:다가)?|을|를)\s*키스|키스\s*(?:를\s*)?(?:가슴|젖꼭지)|kiss(?:es|ing)?\s*(?:her\s*)?(?:breast|nipple)/i.test(
        text,
      )
    const coupleLock = couple
      ? breastKiss
        ? ' Same two Korean people from the photo. He leans in. His mouth stays on her bare breast. Same crop as the photo. No zoom. No chest close-up. Same white studio. No new faces. No bathroom.'
        : /가슴|젖|유방|breast/i.test(text)
          ? ' Same two Korean people from the photo. Mouth-to-mouth kiss. His hand on her bare breast. Same crop as the photo. No zoom. No chest close-up. Same white studio. Keep the man clothed. No bathroom. No new faces.'
          : ' Same two Korean people from the photo. Mouth-to-mouth kiss. Same crop as the photo. No zoom. Same white studio. Keep the man clothed. No bathroom. No new faces.'
      : ''
    const faceLock = breastKiss
      ? 'Same two faces. Exact source crop. No zoom. Head stays in frame.'
      : couple
        ? 'Same two faces. Exact source crop. No zoom. Head stays in frame.'
        : 'Same face, same glasses. Exact source crop. No zoom. Head stays in frame.'
    return `${faceLock} 이미 완전 나체 유지. ${core}${coupleLock}${selfLock}`
  }

  const listFaceBoxes = async (url) => {
    if (!url) return []
    if (typeof deskStillFaceBoxes === 'function') {
      const boxes = await deskStillFaceBoxes(url).catch(() => null)
      if (Array.isArray(boxes) && boxes.length) return boxes
    }
    return []
  }

  const sampleBelowFace = (url, box) =>
    new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        try {
          const w = img.naturalWidth || 1
          const h = img.naturalHeight || 1
          const sx = Math.max(0, Math.round((box.x + box.w * 0.15) * w))
          const sy = Math.max(0, Math.round((box.y + box.h * 1.05) * h))
          const sw = Math.max(8, Math.round(box.w * 0.7 * w))
          const sh = Math.max(8, Math.round(box.h * 0.9 * h))
          const canvas = document.createElement('canvas')
          canvas.width = 24
          canvas.height = 24
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 24, 24)
          const data = ctx.getImageData(0, 0, 24, 24).data
          let r = 0
          let g = 0
          let b = 0
          let n = 0
          for (let i = 0; i < data.length; i += 4) {
            const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
            if (luma > 228) continue
            r += data[i]
            g += data[i + 1]
            b += data[i + 2]
            n += 1
          }
          if (!n) {
            resolve(null)
            return
          }
          resolve({ r: r / n, g: g / n, b: b / n, luma: (0.299 * r + 0.587 * g + 0.114 * b) / n })
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = url
    })

  const pickWomanBox = async (url, boxes) => {
    if (!Array.isArray(boxes) || !boxes.length) return null
    if (boxes.length === 1) return boxes[0]
    const samples = await Promise.all(boxes.map((box) => sampleBelowFace(url, box)))
    if (samples.every((s) => !s)) {
      return boxes.slice().sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2)).pop()
    }
    let best = boxes[0]
    let bestScore = -1e9
    boxes.forEach((box, i) => {
      const s = samples[i]
      const score = s ? s.r - s.b + (s.r - s.g) * 0.45 : box.x
      if (score > bestScore) {
        bestScore = score
        best = box
      }
    })
    return best
  }

  const slotBody = (face, kind) => {
    if (kind === 'man') {
      const x = Math.max(0, face.x - face.w * 0.3)
      const y = Math.max(0, face.y - face.h * 0.35)
      return { x, y, w: Math.min(1 - x, face.w * 1.7), h: Math.min(1 - y, face.h * 4) }
    }
    const x = Math.max(0, face.x - face.w * 0.45)
    const y = Math.max(0, face.y + face.h * 0.55)
    return { x, y, w: Math.min(1 - x, face.w * 2.3), h: Math.min(1 - y, 0.78) }
  }

  const CLOTHES_LABELS = new Set(['Upper-clothes', 'Skirt', 'Pants', 'Dress', 'Belt', 'Scarf'])

  const womanClothesMask = (labels, width, height, woman, man) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const imgd = ctx.createImageData(width, height)
    let white = 0
    const inBox = (box, nx, ny) =>
      Boolean(box && nx >= box.x && nx <= box.x + box.w && ny >= box.y && ny <= box.y + box.h)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const p = y * width + x
        const nx = (x + 0.5) / width
        const ny = (y + 0.5) / height
        const on =
          CLOTHES_LABELS.has(labels[p] || '') && !inBox(man, nx, ny) && (!woman || inBox(woman, nx, ny))
        const v = on ? 255 : 0
        if (on) white += 1
        imgd.data[p * 4] = v
        imgd.data[p * 4 + 1] = v
        imgd.data[p * 4 + 2] = v
        imgd.data[p * 4 + 3] = 255
      }
    }
    ctx.putImageData(imgd, 0, 0)
    return { dataUrl: canvas.toDataURL('image/png'), white }
  }

  const countSkinHeads = (url) =>
    new Promise((resolve) => {
      if (!url) {
        resolve(0)
        return
      }
      const img = new Image()
      img.onload = () => {
        try {
          const w = 180
          const h = Math.max(24, Math.round((w * img.naturalHeight) / Math.max(img.naturalWidth, 1)))
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          ctx.drawImage(img, 0, 0, w, h)
          const data = ctx.getImageData(0, 0, w, h).data
          const y0 = Math.round(h * 0.04)
          const y1 = Math.round(h * 0.28)
          const col = new Array(w).fill(0)
          for (let y = y0; y < y1; y += 1) {
            for (let x = 0; x < w; x += 1) {
              const i = (y * w + x) * 4
              const r = data[i]
              const g = data[i + 1]
              const b = data[i + 2]
              const luma = r * 0.299 + g * 0.587 + b * 0.114
              if (luma < 78 || luma > 226) continue
              if (r < 88 || r < g - 6 || r < b + 8) continue
              const sat = Math.max(r, g, b) - Math.min(r, g, b)
              if (sat < 16 || sat > 120) continue
              col[x] += 1
            }
          }
          const smooth = col.map((_, x) => {
            let sum = 0
            let n = 0
            for (let k = -2; k <= 2; k += 1) {
              const i = x + k
              if (i < 0 || i >= w) continue
              sum += col[i]
              n += 1
            }
            return sum / n
          })
          const peak = Math.max(...smooth, 0)
          const thresh = Math.max(2, peak * 0.35)
          const gap = Math.max(8, Math.round(w * 0.07))
          let runs = 0
          let last = -gap
          for (let x = 1; x < w - 1; x += 1) {
            if (smooth[x] < thresh) continue
            if (smooth[x] < smooth[x - 1] || smooth[x] < smooth[x + 1]) continue
            if (x - last < gap) continue
            runs += 1
            last = x
          }
          resolve(runs)
        } catch {
          resolve(0)
        }
      }
      img.onerror = () => resolve(0)
      img.src = url
    })

  const peopleNamed = (text) => {
    const t = String(text || '')
    const digit = t.match(/([3-8])\s*명/)
    if (digit) return Number(digit[1])
    if (/세\s*(?:명|사람|여자)|여자\s*(?:셋|세\s*명)|3인/.test(t)) return 3
    if (/네\s*(?:명|사람)|4인/.test(t)) return 4
    if (/다섯\s*(?:명|사람)|5인/.test(t)) return 5
    return 0
  }

  const frameShape = (url) =>
    new Promise((resolve) => {
      if (!url) {
        resolve('')
        return
      }
      const img = new Image()
      img.onload = () => {
        const w = img.naturalWidth || 1
        const h = img.naturalHeight || 1
        resolve(w >= h * 1.05 ? 'landscape' : 'portrait')
      }
      img.onerror = () => resolve('')
      img.src = url
    })

  const countFaces = async (url) => {
    let fromBoxes = 0
    if (url && typeof deskStillFaceBoxes === 'function') {
      const boxes = await deskStillFaceBoxes(url, { max: 6, couple: true }).catch(() => null)
      if (Array.isArray(boxes)) fromBoxes = boxes.length
    }
    if (!fromBoxes) {
      const boxes = await listFaceBoxes(url)
      fromBoxes = boxes.length
    }
    const skin = await countSkinHeads(url)
    const seen = Math.max(fromBoxes, skin)
    if (seen) return seen
    if (!url || typeof countDeskSceneFaces !== 'function') return 0
    const n = await countDeskSceneFaces(url, 12000, { noTimeout: true }).catch(() => 0)
    return typeof n === 'number' && n > 0 ? n : 0
  }

  const looksCoupleMotion = (text) => {
    const t = String(text || '')
    if (/자기|스스로|혼자/i.test(t) && !/키스|입맞춤|kiss/i.test(t)) return false
    return (
      /키스|입맞춤|kiss/i.test(t) ||
      (/가슴|젖|유방|breast/i.test(t) && /남자|그(?:가|의)|파트너|여자(?:의)?\s*가슴/i.test(t))
    )
  }

  const $ = (id) => document.getElementById(id)
  const headers = () =>
    typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' }

  const setStatus = (text, bad) => paint($('free-status'), text, bad)
  const setMoveStatus = (text, bad) => paint($('free-move-status'), text, bad)
  const setComposeStatus = (text, bad) => paint($('free-compose-status'), text, bad)

  function paint(el, text, bad) {
    if (!el) return
    el.textContent = text || ''
    el.hidden = !text
    el.classList.toggle('form__status--error', Boolean(bad))
  }

  /** 큰 사진을 그대로 보내면 요청이 막힌다. 긴 변을 줄여 JPEG 로 바꾼다. */
  const shrink = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('read_failed'))
      reader.onload = () => {
        const img = new Image()
        img.onerror = () => reject(new Error('decode_failed'))
        img.onload = () => {
          const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
          const w = Math.max(1, Math.round(img.width * scale))
          const h = Math.max(1, Math.round(img.height * scale))
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', 0.92))
        }
        img.src = String(reader.result || '')
      }
      reader.readAsDataURL(file)
    })

  /** refine 은 data URL 을 받지 않는다. 한 번만 올리고 URL 을 기억한다. */
  const hostPhoto = async () => {
    if (!state.photo) return ''
    if (state.photoUrl) return state.photoUrl
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ dataUrl: state.photo }),
    })
    const data = await response.json().catch(() => ({}))
    if (!data.ok || !data.imageUrl) throw new Error(data.message || data.error || 'upload_failed')
    state.photoUrl = data.imageUrl
    return state.photoUrl
  }

  const hostImage = async (dataUrl) => {
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ dataUrl }),
    })
    const data = await response.json().catch(() => ({}))
    if (!data.ok || !data.imageUrl) throw new Error(data.message || data.error || 'upload_failed')
    return data.imageUrl
  }

  const syncMoveRow = () => {
    const wrap = $('free-move-wrap')
    if (wrap) wrap.hidden = !state.photo && !state.result
    const from = $('free-move-from')
    if (from) {
      from.textContent = state.result
        ? '시작 프레임: 방금 만든 그림 (올린 원본은 그대로)'
        : state.photo
          ? '시작 프레임: 올린 사진. 고치지 않으면 이 장으로 바로 움직입니다. 올린 원본은 그대로 둡니다.'
          : ''
    }
  }

  const syncPhotoOnlyButtons = () => {
    const project = $('free-project')
    if (project) project.disabled = !state.photo || state.busy
    const revise = $('free-revise')
    if (revise) revise.disabled = (!state.photo && !state.result) || state.busy
  }

  const showPhoto = () => {
    const wrap = $('free-photo-wrap')
    const preview = $('free-photo-preview')
    if (preview) preview.src = state.castPhoto || state.photo || ''
    if (wrap) wrap.hidden = !(state.castPhoto || state.photo)
    syncMoveRow()
    syncPhotoOnlyButtons()
  }

  const showHim = () => {
    const wrap = $('free-him-wrap')
    const preview = $('free-him-preview')
    if (preview) preview.src = state.himPhoto || ''
    if (wrap) wrap.hidden = !state.himPhoto
  }

  const composeCouple = async () => {
    const woman = state.castPhoto || state.photo
    const man = state.himPhoto
    if (!woman || !man) {
      setComposeStatus('나와 남친 사진을 둘 다 올리세요.', true)
      return
    }
    if (state.busy) return
    const button = $('free-compose')
    busy(true, button)
    setComposeStatus('한 장면으로 붙이는 중…', false)
    try {
      const extendIfBust = async (src, gender, label) => {
        const need =
          typeof window.deskPhotoNeedsBodyExtend === 'function'
            ? await window.deskPhotoNeedsBodyExtend(src)
            : false
        if (!need) return src
        if (typeof globalThis.extendOneIdBody !== 'function') {
          throw new Error(`${label}이 반신인데 몸 잇기를 찾지 못했습니다.`)
        }
        setComposeStatus(`${label}이 반신입니다. 전신으로 잇는 중…`, false)
        const ext = await globalThis.extendOneIdBody(src, gender, 1, 1, {
          faceSrc: src,
          forcePhoto: true,
        })
        if (ext?.auth) throw new Error('다시 로그인해 주세요.')
        if (!ext?.display) throw new Error(`${label} 반신을 전신으로 잇지 못했습니다. 다시 눌러 주세요.`)
        return ext.display
      }
      const womanBody = await extendIfBust(woman, 'female', '나')
      const manBody = await extendIfBust(man, 'male', '남친')
      let plate = ''
      if (typeof composeDeskCoupleStill === 'function') {
        plate = await composeDeskCoupleStill(womanBody, manBody)
      } else if (globalThis.DeskPipeline?.composePlate) {
        plate = await globalThis.DeskPipeline.composePlate(
          [
            { src: womanBody, heightFactor: 1, slot: 'woman' },
            { src: manBody, heightFactor: 1.02, slot: 'man' },
          ],
          'landscape',
        )
      }
      if (!plate) {
        setComposeStatus('붙이기를 찾지 못했습니다. 새로고침한 뒤 다시 눌러 주세요.', true)
        return
      }
      state.photo = plate
      state.photoUrl = ''
      await hostPhoto()
      showPhoto()
      setComposeStatus('한 장면이 됐습니다. 아래 움직이기로 쇼츠 됩니다.', false)
    } catch (error) {
      setComposeStatus(`실패: ${error instanceof Error ? error.message : '다시 눌러 주세요.'}`, true)
    } finally {
      busy(false, button)
    }
  }

  const showResult = (url, nude) => {
    state.result = url || ''
    state.resultNude = Boolean(url) && nude === true
    const wrap = $('free-result-wrap')
    const img = $('free-result')
    if (img) img.src = state.result
    if (wrap) wrap.hidden = !state.result
    if (!state.result) {
      const video = $('free-video-wrap')
      if (video) video.hidden = true
    }
    syncMoveRow()
    syncPhotoOnlyButtons()
    syncContinuePane()
  }

  const syncContinuePane = () => {
    const pane = $('free-continue-pane')
    const need = $('free-continue-need')
    const ready = $('free-continue-ready')
    const run = $('free-continue-run')
    const has = Boolean(state.result)
    if (pane) pane.hidden = !has
    if (need) need.hidden = true
    if (ready) ready.hidden = !has
    if (run) run.disabled = !has || state.busy
  }

  const setFreeTab = () => {
    const makePane = $('free-make-pane')
    if (makePane) makePane.hidden = false
    syncContinuePane()
  }

  const busy = (on, button) => {
    state.busy = on
    if (button) button.disabled = on
    syncPhotoOnlyButtons()
    syncContinuePane()
  }

  /** 서버가 돌려준 에러 코드를 사람 말로. 그날 코드가 쓰던 코드들이다. */
  const explain = (data, status) => {
    const code = data.error || ''
    if (code === 'content_policy_blocked') {
      return `엔진이 막았습니다: ${data.blockedReason || '표현을 조금 바꿔 주세요.'}`
    }
    if (code === 'revision_required') return '무엇을 고칠지 적어 주세요.'
    if (code === 'revision_too_long') return '고칠 말이 너무 깁니다. 800자 아래로 줄여 주세요.'
    if (code === 'description_too_long') return '글이 너무 깁니다. 줄여 주세요.'
    if (code === 'use_accessory_pin') return data.message || '이번엔 실패했습니다. 다시 눌러 주세요.'
    return data.message || `실패: ${code || status}`
  }

  const primaryFace = (faces) => {
    if (!faces?.length) return null
    return faces.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0]
  }

  const originalFace = () => state.castPhoto || state.photo

  const srcFaceOk = (box) =>
    Boolean(box && box.h >= 0.04 && box.h <= 0.34 && box.w >= 0.04 && box.w <= 0.4)
  const destFaceOk = (box) =>
    Boolean(
      box &&
        box.h >= 0.05 &&
        box.h <= 0.78 &&
        box.w >= 0.05 &&
        box.w <= 0.8 &&
        box.y < 0.68,
    )

  /** 얼굴 살만. 목·깃·셔츠가 따라오면 옷이 원본으로 돌아간다. */
  const tightFaceBox = (face) => {
    if (!face) return null
    const padX = face.w * 0.07
    const padTop = face.h * 0.14
    const padBot = face.h * 0.05
    const x = Math.max(0, face.x - padX)
    const y = Math.max(0, face.y - padTop)
    return {
      x,
      y,
      w: Math.min(1 - x, face.w + padX * 2),
      h: Math.min(1 - y, face.h + padTop + padBot),
    }
  }

  const readFaces = async (url) => {
    if (typeof deskStillFaceBoxes === 'function') {
      const boxes = await deskStillFaceBoxes(url, { max: 4, couple: false })
      if (boxes && boxes.length) return boxes
    }
    if (typeof globalThis.estimateFaceBoxFromImage === 'function') {
      const one = await globalThis.estimateFaceBoxFromImage(url, { scanTop: 0.72, centerOnly: true })
      if (one) return [one]
    }
    return []
  }

  const loadFaceImg = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('face_img'))
      img.src = src
    })

  /**
   * 최초 얼굴만 결과 얼굴 자리에 올린다.
   * 결과의 옷·동작·몸은 그대로. 원본 좌표로 찍지 않는다(셔츠가 따라옴).
   */
  const stampFaceOnly = async (source, dest) => {
    if (!source || !dest) return dest
    try {
      const stableSrc =
        typeof ensureStableDataUrl === 'function' && !String(source).startsWith('data:')
          ? await ensureStableDataUrl(source)
          : source
      const stableOut =
        typeof ensureStableDataUrl === 'function' && !String(dest).startsWith('data:')
          ? await ensureStableDataUrl(dest)
          : dest
      const srcFaces = await readFaces(stableSrc)
      const outFaces = await readFaces(stableOut)
      const main =
        (srcFaces || []).find(srcFaceOk) || (srcFaceOk(primaryFace(srcFaces)) ? primaryFace(srcFaces) : null)
      const target =
        (outFaces || []).find(destFaceOk) || (destFaceOk(primaryFace(outFaces)) ? primaryFace(outFaces) : null)
      const sb = tightFaceBox(main)
      const ob = tightFaceBox(target)
      if (!sb || !ob) return dest
      const srcImg = await loadFaceImg(stableSrc)
      const outImg = await loadFaceImg(stableOut)
      const W = outImg.naturalWidth || 1
      const H = outImg.naturalHeight || 1
      const sw0 = srcImg.naturalWidth || 1
      const sh0 = srcImg.naturalHeight || 1
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      ctx.drawImage(outImg, 0, 0, W, H)
      let dw = Math.max(8, Math.round(ob.w * W))
      let dh = Math.max(8, Math.round(ob.h * H))
      const srcAspect = Math.max(0.7, Math.min(1.2, (sb.w * sw0) / Math.max(1, sb.h * sh0)))
      const destAspect = dw / Math.max(1, dh)
      if (destAspect > srcAspect * 1.06) dw = Math.max(8, Math.round(dh * srcAspect))
      else if (destAspect < srcAspect / 1.06) dh = Math.max(8, Math.round(dw / srcAspect))
      const dx = Math.round(ob.x * W + (ob.w * W) / 2 - dw / 2)
      const dy = Math.round(ob.y * H + (ob.h * H) / 2 - dh / 2)
      const patch = document.createElement('canvas')
      patch.width = dw
      patch.height = dh
      const pctx = patch.getContext('2d')
      pctx.drawImage(srcImg, sb.x * sw0, sb.y * sh0, sb.w * sw0, sb.h * sh0, 0, 0, dw, dh)
      pctx.globalCompositeOperation = 'destination-in'
      pctx.save()
      pctx.translate(dw / 2, dh / 2)
      pctx.scale(dw / 2, dh / 2)
      const grad = pctx.createRadialGradient(0, 0, 0, 0, 0, 1)
      grad.addColorStop(0, 'rgba(0,0,0,1)')
      grad.addColorStop(0.86, 'rgba(0,0,0,1)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      pctx.fillStyle = grad
      pctx.fillRect(-1, -1, 2, 2)
      pctx.restore()
      ctx.drawImage(patch, dx, dy)
      return canvas.toDataURL('image/jpeg', 0.92)
    } catch (_) {
      return dest
    }
  }

  /** 결과 얼굴을 못 찾으면 윗가운데에 최초 얼굴만 올린다. 직전 얼굴을 원본으로 쓰지 않는다. */
  const stampFaceAtGuess = async (source, dest) => {
    if (!source || !dest) return dest
    try {
      const srcFaces = await readFaces(source)
      const main =
        (srcFaces || []).find(srcFaceOk) || (srcFaceOk(primaryFace(srcFaces)) ? primaryFace(srcFaces) : null)
      if (!srcFaceOk(main)) return dest
      const fakeDest = { x: 0.32, y: 0.06, w: 0.36, h: 0.34 }
      const srcImg = await loadFaceImg(source)
      const outImg = await loadFaceImg(dest)
      const W = outImg.naturalWidth || 1
      const H = outImg.naturalHeight || 1
      const sw0 = srcImg.naturalWidth || 1
      const sh0 = srcImg.naturalHeight || 1
      const sb = tightFaceBox(main)
      const ob = tightFaceBox(fakeDest)
      if (!sb || !ob) return dest
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      ctx.drawImage(outImg, 0, 0, W, H)
      const dw = Math.max(8, Math.round(ob.w * W))
      const dh = Math.max(8, Math.round(ob.h * H))
      const dx = Math.round(ob.x * W + (ob.w * W) / 2 - dw / 2)
      const dy = Math.round(ob.y * H + (ob.h * H) / 2 - dh / 2)
      const patch = document.createElement('canvas')
      patch.width = dw
      patch.height = dh
      const pctx = patch.getContext('2d')
      pctx.drawImage(srcImg, sb.x * sw0, sb.y * sh0, sb.w * sw0, sb.h * sh0, 0, 0, dw, dh)
      pctx.globalCompositeOperation = 'destination-in'
      pctx.save()
      pctx.translate(dw / 2, dh / 2)
      pctx.scale(dw / 2, dh / 2)
      const grad = pctx.createRadialGradient(0, 0, 0, 0, 0, 1)
      grad.addColorStop(0, 'rgba(0,0,0,1)')
      grad.addColorStop(0.86, 'rgba(0,0,0,1)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      pctx.fillStyle = grad
      pctx.fillRect(-1, -1, 2, 2)
      pctx.restore()
      ctx.drawImage(patch, dx, dy)
      return canvas.toDataURL('image/jpeg', 0.92)
    } catch (_) {
      return dest
    }
  }

  const applyOriginalFace = async (dest) => {
    const src = originalFace()
    if (!src || !dest) return dest
    const stamped = await stampFaceOnly(src, dest)
    if (stamped && stamped !== dest) return stamped
    return stampFaceAtGuess(src, dest)
  }

  const holdSourceFaces = async (source, result) => {
    if (!source || !result) return result
    const src = originalFace() || source
    const stamped = await applyOriginalFace(result)
    if (stamped && stamped !== result) return stamped
    const again = await stampFaceOnly(src, result)
    if (again && again !== result) return again
    return result
  }

  const sealLastVideoFace = async (videoUrl) => {
    if (!videoUrl || !originalFace() || typeof globalThis.captureVideoEndFrame !== 'function') return ''
    try {
      setMoveStatus('마지막 얼굴에 최초 얼굴을 올리는 중…', false)
      const last = await globalThis.captureVideoEndFrame(videoUrl)
      if (!last) return ''
      const sealed = await applyOriginalFace(last)
      if (!sealed || sealed === last) return ''
      showResult(sealed, true)
      const video = $('free-video')
      if (video) video.poster = sealed
      return sealed
    } catch (_) {
      return ''
    }
  }

  const callJson = async (path, payload) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
    })
    if (response.status === 401) return { auth: true }
    const data = await response.json().catch(() => ({}))
    if (!data.ok) return { error: explain(data, response.status) }
    return { data }
  }

  const sizeValue = () => $('free-size')?.value || 'portrait'

  /**
   * 한 장 만들기 / 수정하기 / 몸매 투영.
   * 수정하기는 올린 사진 또는 방금 나온 장을 적은 말대로 고친다. Desk 옷 칸이 아니다.
   * @param {{ bodyProject?: boolean, revise?: boolean }} [opts]
   */
  const run = async (opts = {}) => {
    if (state.busy) return
    const bodyProject = opts.bodyProject === true
    const revise = opts.revise === true
    const text = String($('free-text')?.value || '').trim()
    if (
      !revise &&
      !bodyProject &&
      state.photo &&
      (NUDE_WORDS.test(text) || /가슴|젖|유방|breast/i.test(text))
    ) {
      const move = $('free-move-text')
      if (move && !String(move.value || '').trim()) move.value = text
      return runMove()
    }
    if (bodyProject && !state.photo) {
      setStatus('몸매 투영은 사진이 있어야 합니다.', true)
      return
    }
    if (revise && !state.photo && !state.result) {
      setStatus('고칠 사진을 올리세요. 옷 갈아입히기·수정은 이 칸입니다.', true)
      return
    }
    if (!bodyProject && !text) {
      setStatus(revise ? '무엇을 고칠지 적어 주세요.' : '무엇을 만들지 적어 주세요.', true)
      return
    }
    const button = bodyProject ? $('free-project') : revise ? $('free-revise') : $('free-run')
    busy(true, button)
    setStatus(
      bodyProject
        ? '몸매 투영 중… 원래 체형 그대로 벗깁니다. 30초쯤 걸립니다.'
        : revise
          ? '이 장을 적은 대로 고치는 중… 30초쯤 걸립니다.'
          : state.photo
            ? '새 그림을 그리는 중… 올린 원본은 그대로 둡니다. 30초쯤 걸립니다.'
            : '글만으로 그리는 중… 30초쯤 걸립니다.',
      false,
    )
    try {
      let out
      let sourcePeople = 1
      if (revise) {
        const fromOriginal = (url) => Boolean(url && (url === state.photo || url === state.photoUrl))
        const sourceUrl =
          state.result && !fromOriginal(state.result) ? state.result : ''
        const imageUrl = sourceUrl || (await hostPhoto())
        const faceSrc = sourceUrl || state.photo
        const photoFaces = await countFaces(faceSrc)
        const coupleText = looksCoupleMotion(text)
        sourcePeople = photoFaces >= 2 || coupleText ? 2 : 1
        out = await callJson('/api/free-refine', {
          mode: 'text',
          genMode: 'fashion',
          imageUrl,
          baseDescription: '',
          revision: opts.zoomRetry
            ? `같은 카메라 구도. 줌인 금지. 얼굴이 프레임에 남게. ${text}`
            : text,
          sourcePeople,
          size: sizeValue(),
          mood: 'clean',
        })
      } else if (state.photo) {
        const photoFaces = await countFaces(state.photo)
        const coupleText = looksCoupleMotion(text)
        sourcePeople = photoFaces >= 2 || coupleText ? 2 : 1
        const imageUrl = await hostPhoto()
        out = await callJson('/api/free-refine', {
          mode: 'text',
          genMode: 'fashion',
          imageUrl,
          baseDescription: '',
          revision: opts.zoomRetry
            ? `같은 카메라 구도. 줌인 금지. 얼굴이 프레임에 남게. ${text}`
            : text,
          bodyProject: bodyProject || undefined,
          sourcePeople,
          size: sizeValue(),
          mood: 'clean',
        })
      } else {
        out = await callJson('/api/free-generate', {
          description: text,
          mode: 'fashion',
          size: sizeValue(),
          mood: 'clean',
        })
      }
      if (out.auth) {
        setStatus('다시 로그인해 주세요.', true)
        return
      }
      if (out.error) {
        setStatus(out.error, true)
        return
      }
      const url = out.data.imageUrl || out.data.url || ''
      if (!url) {
        setStatus('결과를 받지 못했습니다. 같은 단추를 다시 눌러 주세요.', true)
        return
      }
      const faceSrc = state.castPhoto || state.photo
      const held = faceSrc ? await holdSourceFaces(faceSrc, url) : url
      if (faceSrc && (!held || held === url)) {
        setStatus('얼굴이 바뀌어 이 장은 쓰지 않습니다. 다시 눌러 주세요.', true)
        return
      }
      const poseChange = /눕|누워|앉|일어|기대|자세|침대|창가/.test(text)
      if (
        faceSrc &&
        !opts.zoomRetry &&
        !poseChange &&
        typeof deskFrameHolds === 'function' &&
        !(await deskFrameHolds(faceSrc, held)).ok
      ) {
        setStatus('같은 구도로 한 번 더 그립니다…', false)
        busy(false, button)
        return run({ ...opts, zoomRetry: true })
      }
      showResult(held, sourcePeople === 2 || bodyProject || NUDE_WORDS.test(text))
      const label = out.data.engineLabel ? ` (${out.data.engineLabel})` : ''
      setStatus(
        revise
          ? `고쳤습니다${label}. 얼굴은 올린 사진입니다. 또 고치려면 말을 바꿔 수정하기를 누르세요.`
          : `나왔습니다${label}. 얼굴은 올린 사진입니다. 더 고치려면 고칠 말을 적고 수정하기를 누르세요.`,
        false,
      )
    } catch (error) {
      setStatus(`실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, true)
    } finally {
      busy(false, button)
    }
  }

  const setContinueStatus = (text, isError) => {
    const el = $('free-continue-status')
    if (!el) return
    el.hidden = !text
    el.textContent = text || ''
    el.classList.toggle('form__status--error', Boolean(isError))
  }

  /**
   * 마지막 장을 잇는다. 얼굴은 최초 사진에서 다시 붙이고,
   * 이미 나체면 옷을 되돌리지 않는다. 점과 배꼽 위 음모는 기본으로 지운다.
   */
  const runContinue = async () => {
    if (state.busy) return
    if (!state.result) {
      setContinueStatus('먼저 만들기에서 한 장을 만드세요.', true)
      return
    }
    const extra = String($('free-continue-text')?.value || '').trim()
    const revision =
      extra ||
      '점은 지우고, 음모는 치골에만 짧게. 같은 구도. 줌인 금지.'
    const button = $('free-continue-run')
    busy(true, button)
    setContinueStatus('이 장을 잇는 중… 얼굴은 최초 사진으로 다시 확인합니다.', false)
    try {
      let imageUrl = state.result
      if (imageUrl.startsWith('data:')) imageUrl = await hostImage(imageUrl)
      const out = await callJson('/api/free-refine', {
        mode: 'text',
        genMode: 'fashion',
        imageUrl,
        baseDescription: '',
        revision,
        continueLast: true,
        stayNude: state.resultNude === true,
        sourcePeople: 1,
        size: sizeValue(),
        mood: 'clean',
      })
      if (out.auth) {
        setContinueStatus('다시 로그인해 주세요.', true)
        return
      }
      if (out.error) {
        setContinueStatus(out.error, true)
        return
      }
      const url = out.data.imageUrl || out.data.url || ''
      if (!url) {
        setContinueStatus('결과를 받지 못했습니다. 다시 눌러 주세요.', true)
        return
      }
      if (typeof isNearlyBlackImage === 'function' && (await isNearlyBlackImage(url))) {
        setContinueStatus('필터가 검은 장을 냈습니다. 이전 장을 둡니다. 같은 글로 한 번 더 누르세요.', true)
        return
      }
      const faceSrc = state.castPhoto || state.photo
      let held = url
      if (faceSrc) {
        held = await holdSourceFaces(faceSrc, url)
        if (!held || held === url) {
          setContinueStatus('얼굴이 바뀌어 이전 장을 둡니다. 다시 눌러 주세요.', true)
          return
        }
      }
      showResult(held, state.resultNude === true)
      setContinueStatus('이었습니다. 최초 얼굴을 다시 붙였습니다.', false)
    } catch (error) {
      setContinueStatus(`실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, true)
    } finally {
      busy(false, button)
    }
  }

  /** 클립 한 개. 그날의 animate.ts 사본을 부른다. */
  const oneClip = async (imageUrl, motion, durationSec, extra) => {
    const out = await callJson('/api/free-animate', {
      imageUrl,
      prompt: '',
      motion,
      durationSec,
      size: sizeValue(),
      clipRole: 'single',
      ...extra,
    })
    if (out.auth) throw new Error('로그인이 풀렸습니다. 다시 로그인해 주세요.')
    if (out.error) throw new Error(out.error)
    let videoUrl = out.data.videoUrl || ''
    if (!videoUrl && out.data.predictionId) {
      const started = Date.now()
      while (Date.now() - started < 8 * 60 * 1000) {
        await new Promise((done) => setTimeout(done, 5000))
        const poll = await fetch('/api/animate-status', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ predictionId: out.data.predictionId, durationSec }),
        })
        const step = await poll.json().catch(() => ({}))
        if (step.status === 'failed') throw new Error(step.message || '영상 생성 실패')
        if (step.videoUrl) {
          videoUrl = step.videoUrl
          break
        }
        setMoveStatus(`영상 만드는 중… ${Math.round((Date.now() - started) / 1000)}초 경과`, false)
      }
    }
    if (!videoUrl) throw new Error('시간 안에 결과를 받지 못했습니다. 다시 눌러 주세요.')
    return videoUrl
  }

  /**
   * 움직이기. 엔진·길이·머지는 동결된 그대로다 —
   * 10~18초는 한 클립, 24/30초는 두 클립을 만들어 ffmpeg 로 붙인다.
   */
  const runMove = async () => {
    if (state.busy) return
    if (!state.result && !state.photo && !state.photoUrl) {
      setMoveStatus('사진을 올리거나 한 장을 먼저 만드세요.', true)
      return
    }
    let motion = String($('free-move-text')?.value || '').replace(/나채/g, '나체').trim()
    if (!motion) {
      motion = String($('free-text')?.value || '').trim()
      if (motion && $('free-move-text')) $('free-move-text').value = motion
    }
    if (!motion) {
      setMoveStatus('움직이기에 나체, 가슴처럼 적어 주세요.', true)
      return
    }
    const total = Number($('free-move-sec')?.value) || 15
    const clipSec = DUAL[total] || total
    const dual = Boolean(DUAL[total])
    let motion2 = String($('free-move-text2')?.value || '').trim()
    if (dual && !motion2) {
      setMoveStatus(`${total}초는 두 클립입니다. 후반 움직임도 적어 주세요.`, true)
      return
    }
    const bodyProject = $('free-move-project')?.checked === true
    const soloNude = NUDE_WORDS.test(motion) || /가슴|젖|유방|주무르|breast/i.test(motion)

    const button = $('free-move-run')
    busy(true, button)
    try {
      const fromOriginal = (url) =>
        Boolean(url && (url === state.photo || url === state.photoUrl))
      const madeStill = Boolean(state.result && !fromOriginal(state.result))
      // 나체 쇼츠는 올린 원본에서 바로 간다. 깨진 중간 장을 쓰면 쇼츠가 그 사진과 같아진다.
      let startFrame = ''
      if (soloNude) {
        startFrame = state.photoUrl || (await hostPhoto())
      } else {
        startFrame = madeStill ? state.result : ''
        if (!startFrame) startFrame = state.photoUrl || (await hostPhoto())
      }
      if (!startFrame) {
        setMoveStatus('사진을 올리거나 한 장을 먼저 만드세요.', true)
        return
      }
      const photoFaces = Math.max(
        await countFaces(startFrame || state.photo || state.photoUrl || state.result),
        peopleNamed(`${motion} ${motion2}`),
      )
      const group = photoFaces >= 3
      const couple = !group && (photoFaces >= 2 || Boolean(state.himPhoto))
      if ((couple || looksCoupleMotion(`${motion} ${motion2}`)) && !group) {
        const box = $('free-move-project')
        if (box) box.checked = false
      }

      const timed = writeBeatMotion(motion, clipSec)
      if (couple && soloNude && /키스|입맞춤|kiss/i.test(motion)) {
        const half = Math.round(clipSec / 2)
        motion = `0–${half}초: 여자만 옷을 전부 벗고 완전 나체. 남자는 옷 그대로. ${half}–${clipSec}초: 입맞춤. 여자는 나체 유지.`
      } else if (timed) {
        motion = timed
      } else if (soloNude && /춤|댄스|dance/i.test(motion)) {
        motion = `완전 나체로 춤춘다. 상의 없음. 바지 없음. 팬티 없음. 밑은 맨살. 같은 얼굴, 같은 방. ${String(motion).replace(/춤주/g, '춤추')}`
      }

      const people = group ? Math.min(photoFaces, 8) : couple ? 2 : 1
      const clipSize = (await frameShape(startFrame)) || sizeValue()

      setMoveStatus(
        dual ? `${total}초 쇼츠: 전반(1/2) 만드는 중… 1~2분` : `영상 만드는 중… 1~2분 (${total}초)`,
        false,
      )
      const clip1 = await oneClip(startFrame, motion, clipSec, {
        bodyProject: soloNude || couple ? undefined : bodyProject || undefined,
        clipRole: dual ? 'dual-a' : 'single',
        sourcePeople: people,
        sourceNude: soloNude ? undefined : state.resultNude || undefined,
        zoomIn: false,
        size: clipSize,
      })
      if (!dual) {
        showVideo(clip1)
        state.videoNude = soloNude || NUDE_WORDS.test(motion)
        await sealLastVideoFace(clip1)
        setMoveStatus('나왔습니다. 마지막 얼굴은 올린 사진입니다.', false)
        return
      }

      setMoveStatus(`${total}초 쇼츠: 후반 연결용 프레임 잡는 중…`, false)
      let endFrame = ''
      if (typeof globalThis.captureVideoEndFrame === 'function') {
        endFrame = await globalThis.captureVideoEndFrame(clip1).catch(() => '')
      }
      setMoveStatus(`${total}초 쇼츠: 후반(2/2) 만드는 중… 1~2분`, false)
      const clip2 = await oneClip(endFrame || startFrame, motion2, clipSec, {
        clipRole: 'dual-b',
        sourcePeople: people,
        sourceNude: state.resultNude || undefined,
        zoomIn: false,
        size: clipSize,
      })

      setMoveStatus('두 클립 이어 붙이는 중…', false)
      const merged = await callJson('/api/merge-videos', { videoUrls: [clip1, clip2] })
      if (merged.error || !merged.data?.videoUrl) {
        showVideo(clip1)
        await sealLastVideoFace(clip1)
        setMoveStatus('이어 붙이기가 실패해서 전반만 보여 드립니다. 다시 눌러 주세요.', true)
        return
      }
      showVideo(merged.data.videoUrl)
      state.videoNude = soloNude || NUDE_WORDS.test(`${motion} ${motion2}`)
      await sealLastVideoFace(merged.data.videoUrl)
      setMoveStatus('나왔습니다. 마지막 얼굴은 올린 사진입니다.', false)
    } catch (error) {
      setMoveStatus(`실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, true)
    } finally {
      busy(false, button)
    }
  }

  /** 지금 영상 끝에서 다음 클립을 만들어 붙인다. Wan·머지는 그대로. */
  const runContinueShorts = async () => {
    if (state.busy) return
    const prev = state.videoUrl
    if (!prev) {
      setMoveStatus('먼저 움직이기로 쇼츠를 만드세요.', true)
      return
    }
    let motion = String($('free-move-next')?.value || '').trim()
    if (!motion) {
      setMoveStatus('이어서 할 움직임을 적어 주세요.', true)
      return
    }
    const total = Number($('free-move-sec')?.value) || 15
    const clipSec = DUAL[total] || total
    const button = $('free-move-next-run')
    busy(true, button)
    try {
      const alreadyNude = state.videoNude || state.resultNude || NUDE_WORDS.test(motion)
      motion = alreadyNude
        ? `이미 완전 나체. 옷을 다시 입히지 말 것. ${String(motion).replace(/춤주/g, '춤추')}`
        : writeBeatMotion(motion, clipSec) || motion
      setMoveStatus('끝 장에 최초 얼굴을 올리는 중…', false)
      let startFrame = ''
      if (typeof globalThis.captureVideoEndFrame === 'function') {
        startFrame = await globalThis.captureVideoEndFrame(prev)
      }
      if (!startFrame) {
        setMoveStatus('끝 장을 못 가져왔습니다. 다시 눌러 주세요.', true)
        return
      }
      const sealedStart = await applyOriginalFace(startFrame)
      if (!sealedStart || sealedStart === startFrame) {
        setMoveStatus('최초 얼굴을 끝 장에 올리지 못했습니다. 다시 눌러 주세요.', true)
        return
      }
      startFrame = sealedStart.startsWith('data:') ? await hostImage(sealedStart) : sealedStart
      setMoveStatus(`이어서 ${clipSec}초 만드는 중… 1~2분`, false)
      const next = await oneClip(startFrame, motion, clipSec, {
        clipRole: 'single',
        sourcePeople: 1,
        sourceNude: alreadyNude || undefined,
        zoomIn: false,
        size: (await frameShape(startFrame)) || sizeValue(),
      })
      setMoveStatus('이전 편 뒤에 붙이는 중…', false)
      const merged = await callJson('/api/merge-videos', { videoUrls: [prev, next] })
      if (merged.error || !merged.data?.videoUrl) {
        showVideo(next)
        state.videoNude = alreadyNude
        await sealLastVideoFace(next)
        setMoveStatus('이번 편은 됐지만 붙이기가 실패했습니다. 이번 편만 보여 드립니다.', true)
        return
      }
      showVideo(merged.data.videoUrl)
      state.videoNude = alreadyNude
      await sealLastVideoFace(merged.data.videoUrl)
      setMoveStatus('이었습니다. 영상 저장으로 받으세요.', false)
    } catch (error) {
      setMoveStatus(`실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, true)
    } finally {
      busy(false, button)
    }
  }

  const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('voice_read_failed'))
      reader.readAsDataURL(blob)
    })

  const encodeWav = (samples, sampleRate) => {
    const bytes = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(bytes)
    const write = (offset, text) => {
      for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
    }
    write(0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    write(8, 'WAVE')
    write(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    write(36, 'data')
    view.setUint32(40, samples.length * 2, true)
    let o = 44
    for (let i = 0; i < samples.length; i += 1) {
      const s = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      o += 2
    }
    return bytes
  }

  /** 통화 원본 전체가 아니라 내 말 16초만 잘라 기준으로 쓴다. */
  const sliceVoiceRef = async (blob) => {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return blobToDataUrl(blob)
    const ctx = new Ctx()
    try {
      const raw = await blob.arrayBuffer()
      const buf = await ctx.decodeAudioData(raw.slice(0))
      const sr = buf.sampleRate
      const start = Math.min(buf.length - 1, Math.floor(Math.min(10, Math.max(0, buf.duration * 0.18)) * sr))
      const want = Math.max(1, Math.min(buf.length - start, Math.floor(16 * sr)))
      const mono = new Float32Array(want)
      const ch0 = buf.getChannelData(0)
      const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null
      for (let i = 0; i < want; i += 1) {
        const a = ch0[start + i] || 0
        const b = ch1 ? ch1[start + i] || 0 : a
        mono[i] = (a + b) / 2
      }
      return blobToDataUrl(new Blob([encodeWav(mono, sr)], { type: 'audio/wav' }))
    } finally {
      if (typeof ctx.close === 'function') ctx.close().catch(() => {})
    }
  }

  const paintVoiceName = () => {
    const el = $('free-voice-file-name')
    if (!el) return
    el.hidden = false
    const who = VOICE_LABELS[state.voiceWho] || '나'
    el.textContent = state.voiceName ? `${who}: ${state.voiceName}` : `${who}: 아직 없음`
  }

  const toggleVoiceRecord = async () => {
    const btn = $('free-voice-record')
    if (state.mediaRec && state.mediaRec.state === 'recording') {
      state.mediaRec.stop()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceStatus('이 브라우저는 녹음을 지원하지 않습니다. 목소리 파일을 올리세요.', true)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const chunks = []
      rec.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data)
      }
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        state.mediaRec = null
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
        saveVoiceSlot(state.voiceWho, blob, '방금 녹음', { voiceId: '' }).catch(() => {})
        if (btn) btn.textContent = '이 칸에 녹음'
        setVoiceStatus(`${VOICE_LABELS[state.voiceWho]} 칸에 녹음해 두었습니다.`, false)
      }
      rec.start()
      state.mediaRec = rec
      if (btn) btn.textContent = '녹음 멈추기'
      setVoiceStatus('녹음 중입니다. 대사를 말한 뒤 멈추기를 누르세요.', false)
    } catch {
      setVoiceStatus('마이크를 열지 못했습니다. 목소리 파일을 올리세요.', true)
    }
  }

  const setVoiceStatus = (text, isError) => {
    const el = $('free-voice-status')
    if (!el) return
    el.hidden = !text
    el.textContent = text || ''
    el.classList.toggle('form__status--error', Boolean(isError))
  }

  const runVoice = async () => {
    if (state.busy) return
    const source = state.videoUrl
    if (!source) {
      setVoiceStatus('먼저 아래 움직이기로 쇼츠를 만드세요.', true)
      return
    }
    const text = String($('free-voice-text')?.value || '').trim()
    if (!state.voiceBlob && !text) {
      setVoiceStatus('내 목소리를 녹음·올리거나, 기계 목소리로 쓸 대사를 적으세요.', true)
      return
    }
    if (typeof mixVideoWithBgm !== 'function') {
      setVoiceStatus('이 브라우저는 소리 입히기를 지원하지 않습니다. Chrome을 쓰세요.', true)
      return
    }
    const button = $('free-voice-run')
    busy(true, button)
    try {
      let audioBlob = null
      if (state.voiceBlob && text) {
        setVoiceStatus('올린 녹취의 내 목소리로 대사를 만드는 중…', false)
        const out = await callJson('/api/free-voice', {
          text,
          voiceDataUrl: await sliceVoiceRef(state.voiceBlob),
        })
        if (out.auth) {
          setVoiceStatus('다시 로그인해 주세요.', true)
          return
        }
        if (out.error) {
          setVoiceStatus(out.error, true)
          return
        }
        const audioUrl = out.data.audioUrl || ''
        if (!audioUrl) {
          setVoiceStatus('목소리를 받지 못했습니다. 다시 눌러 주세요.', true)
          return
        }
        const audioRes = await fetch(audioUrl)
        if (!audioRes.ok) throw new Error('목소리를 받지 못했습니다.')
        audioBlob = await audioRes.blob()
      } else if (state.voiceBlob) {
        audioBlob = state.voiceBlob
      } else {
        setVoiceStatus('기계 목소리를 만드는 중… 내 목소리는 10초 이상 올리고 대사를 적으세요.', false)
        const out = await callJson('/api/free-voice', { text })
        if (out.auth) {
          setVoiceStatus('다시 로그인해 주세요.', true)
          return
        }
        if (out.error) {
          setVoiceStatus(out.error, true)
          return
        }
        const audioUrl = out.data.audioUrl || ''
        if (!audioUrl) {
          setVoiceStatus('목소리를 받지 못했습니다. 다시 눌러 주세요.', true)
          return
        }
        const audioRes = await fetch(audioUrl)
        if (!audioRes.ok) throw new Error('목소리를 받지 못했습니다.')
        audioBlob = await audioRes.blob()
      }
      setVoiceStatus('영상에 입히는 중… 길이만큼 기다려 주세요.', false)
      const mixed = await mixVideoWithBgm(source, audioBlob, { volume: 1, loop: false })
      showVideo(mixed.blobUrl, { keepSource: true })
      setVoiceStatus(
        state.voiceBlob && text
          ? `${VOICE_LABELS[state.voiceWho]} 목소리로 대사를 입혔습니다.`
          : state.voiceBlob
            ? `${VOICE_LABELS[state.voiceWho]} 녹음을 그대로 입혔습니다.`
            : '기계 목소리를 입혔습니다. 나와 남친 칸에 10초 이상 올리세요.',
        false,
      )
    } catch (error) {
      setVoiceStatus(`실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, true)
    } finally {
      busy(false, button)
    }
  }

  const showVideo = (url, opts = {}) => {
    if (url && !opts.keepSource) state.videoUrl = url
    const video = $('free-video')
    const wrap = $('free-video-wrap')
    if (video) {
      video.loop = true
      video.src = url
      const start = () => {
        video.currentTime = 0
        const play = video.play()
        if (play && typeof play.catch === 'function') play.catch(() => {})
      }
      if (video.readyState >= 2) start()
      else video.addEventListener('canplay', start, { once: true })
      if (!video.dataset.loopBound) {
        video.dataset.loopBound = '1'
        video.addEventListener('ended', () => {
          if (!video.loop || !video.src) return
          video.currentTime = 0
          video.play().catch(() => {})
        })
      }
    }
    if (wrap) wrap.hidden = false
  }

  /** 24/30초를 고르면 후반 움직임 칸이 열린다. */
  const syncDualRow = () => {
    const total = Number($('free-move-sec')?.value) || 15
    const row = $('free-move-dual')
    if (row) row.hidden = !DUAL[total]
  }

  const clickSave = (href, name) => {
    const a = document.createElement('a')
    a.href = href
    a.download = name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const download = () => {
    if (!state.result) return
    clickSave(state.result, `free-studio-${Date.now()}.jpg`)
  }

  const saveVideo = async () => {
    const url = state.videoUrl || $('free-video')?.src || ''
    if (!url) {
      setMoveStatus('저장할 영상이 없습니다.', true)
      return
    }
    setMoveStatus('영상을 저장하는 중…', false)
    try {
      if (typeof downloadVideoFile === 'function' && (url.startsWith('blob:') || url.startsWith('data:'))) {
        await downloadVideoFile(url, `free-shorts-${Date.now()}.mp4`)
        setMoveStatus('저장했습니다.', false)
        return
      }
      if (typeof downloadVideoFile === 'function') {
        try {
          await downloadVideoFile(url, `free-shorts-${Date.now()}.mp4`)
          setMoveStatus('저장했습니다.', false)
          return
        } catch (_) {
          /* CDN이 막히면 서버로 받아 저장한다 */
        }
      }
      const response = await fetch('/api/media-bytes', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ imageUrl: url }),
      })
      const data = await response.json().catch(() => ({}))
      if (data?.ok && typeof data.dataUrl === 'string' && data.dataUrl.startsWith('data:')) {
        const blob = await (await fetch(data.dataUrl)).blob()
        const objectUrl = URL.createObjectURL(blob)
        clickSave(objectUrl, `free-shorts-${Date.now()}.mp4`)
        URL.revokeObjectURL(objectUrl)
        setMoveStatus('저장했습니다.', false)
        return
      }
      clickSave(url, `free-shorts-${Date.now()}.mp4`)
      setMoveStatus('저장했습니다.', false)
    } catch (error) {
      setMoveStatus(`저장 실패: ${error instanceof Error ? error.message : '다시 눌러 주세요.'}`, true)
    }
  }

  const saveStill = () => {
    if (!state.result) {
      setMoveStatus('저장할 마지막 장이 없습니다. 영상이 끝난 뒤 다시 눌러 주세요.', true)
      return
    }
    clickSave(state.result, `free-last-${Date.now()}.jpg`)
    setMoveStatus('마지막 장을 저장했습니다.', false)
  }

  const init = () => {
    const applyPhotoFile = async (file) => {
      if (!file) return
      const ok = typeof StorymagAttach?.isImageFile === 'function' ? StorymagAttach.isImageFile(file) : /^image\//.test(file.type || '')
      if (!ok) {
        setStatus('이미지 파일만 올릴 수 있습니다.', true)
        return
      }
      try {
        state.photo = await shrink(file)
        state.castPhoto = state.photo
        state.photoUrl = ''
        showPhoto()
        setStatus('사진을 올렸습니다. 아래 움직이기에 나체, 가슴을 적고 바로 쇼츠 됩니다. 장은 만들지 않아도 됩니다.', false)
      } catch {
        state.photo = ''
        state.photoUrl = ''
        showPhoto()
        setStatus('사진을 읽지 못했습니다. 다른 파일로 해 주세요.', true)
      }
    }
    window.__freeApplyPhotoFile = applyPhotoFile
    $('free-photo')?.addEventListener('change', async (event) => {
      const file = event.target?.files?.[0]
      event.target.value = ''
      if (file) await applyPhotoFile(file)
    })
    if (typeof StorymagAttach?.bind === 'function') {
      StorymagAttach.register('free', (files) => applyPhotoFile(files[0]))
      const takeFiles = (files) => applyPhotoFile(files[0])
      const emptyPaste = () =>
        setStatus('복사한 그림이 없습니다. 그림을 복사한 뒤 Ctrl+V 또는 붙이기를 누르세요.', true)
      StorymagAttach.bind($('free-area'), {
        onFiles: takeFiles,
        pasteBtn: $('free-photo-paste'),
        onEmptyPaste: emptyPaste,
      })
      StorymagAttach.bind($('free-photo-drop'), { onFiles: takeFiles })
      StorymagAttach.bind($('free-text-drop'), {
        onFiles: takeFiles,
        pasteBtn: $('free-text-paste'),
        onEmptyPaste: emptyPaste,
      })
      StorymagAttach.bind($('free-text'), { onFiles: takeFiles, onEmptyPaste: emptyPaste })
    }
    $('free-photo-clear')?.addEventListener('click', () => {
      state.photo = ''
      state.castPhoto = ''
      state.photoUrl = ''
      const input = $('free-photo')
      if (input) input.value = ''
      showPhoto()
      setStatus('사진을 뺐습니다. 이제 글만으로 그립니다.', false)
    })
    const applyHimFile = async (file) => {
      if (!file) return
      const ok = typeof StorymagAttach?.isImageFile === 'function' ? StorymagAttach.isImageFile(file) : /^image\//.test(file.type || '')
      if (!ok) {
        setComposeStatus('이미지 파일만 올릴 수 있습니다.', true)
        return
      }
      try {
        state.himPhoto = await shrink(file)
        showHim()
        setComposeStatus(state.castPhoto || state.photo ? '남친을 올렸습니다. 한 장면으로 합치기를 누르세요.' : '남친을 올렸습니다. 내 사진도 올리세요.', false)
      } catch {
        state.himPhoto = ''
        showHim()
        setComposeStatus('남친 사진을 읽지 못했습니다.', true)
      }
    }
    $('free-him-photo')?.addEventListener('change', async (event) => {
      const file = event.target?.files?.[0]
      event.target.value = ''
      if (file) await applyHimFile(file)
    })
    if (typeof StorymagAttach?.bind === 'function') {
      StorymagAttach.bind($('free-him-drop'), {
        onFiles: (files) => applyHimFile(files[0]),
        pasteBtn: $('free-him-paste'),
        onEmptyPaste: () => setComposeStatus('복사한 그림이 없습니다.', true),
      })
    }
    $('free-him-clear')?.addEventListener('click', () => {
      state.himPhoto = ''
      const input = $('free-him-photo')
      if (input) input.value = ''
      showHim()
      setComposeStatus('남친 사진을 뺐습니다.', false)
    })
    $('free-compose')?.addEventListener('click', () => {
      composeCouple().catch(() => {})
    })
    $('free-tab-make')?.addEventListener('click', () => setFreeTab('make'))
    $('free-tab-continue')?.addEventListener('click', () => setFreeTab('continue'))
    $('free-continue-run')?.addEventListener('click', runContinue)
    $('free-run')?.addEventListener('click', () => run())
    $('free-revise')?.addEventListener('click', () => run({ revise: true }))
    $('free-project')?.addEventListener('click', () => run({ bodyProject: true }))
    $('free-move-run')?.addEventListener('click', runMove)
    $('free-move-next-run')?.addEventListener('click', () => {
      runContinueShorts().catch(() => {})
    })
    $('free-voice-run')?.addEventListener('click', runVoice)
    $('free-voice-record')?.addEventListener('click', () => {
      if (state.voiceWho === 'me') {
        setVoiceStatus('나는 확정-2번으로 고정입니다. 남친 칸만 녹음하세요.', true)
        return
      }
      toggleVoiceRecord().catch(() => {})
    })
    $('free-voice-who-me')?.addEventListener('click', () => applyVoiceSlot('me'))
    $('free-voice-who-him')?.addEventListener('click', () => applyVoiceSlot('him'))
    $('free-voice-file')?.addEventListener('change', (event) => {
      const file = event.target?.files?.[0]
      event.target.value = ''
      if (!file) return
      if (state.voiceWho === 'me') {
        setVoiceStatus('나는 확정-2번으로 고정입니다. 남친 칸에 올리세요.', true)
        return
      }
      saveVoiceSlot(state.voiceWho, file, file.name, { voiceId: '' })
        .then(() => {
          setVoiceStatus(`${VOICE_LABELS[state.voiceWho]} 칸에 저장했습니다.`, false)
        })
        .catch(() => {
          setVoiceStatus('목소리를 저장하지 못했습니다. 다시 올리세요.', true)
        })
    })
    $('free-move-sec')?.addEventListener('change', syncDualRow)
    $('free-download')?.addEventListener('click', download)
    $('free-video-save')?.addEventListener('click', () => {
      saveVideo().catch(() => {})
    })
    $('free-still-save')?.addEventListener('click', saveStill)
    $('free-reset')?.addEventListener('click', () => {
      state.photo = ''
      state.castPhoto = ''
      state.himPhoto = ''
      state.photoUrl = ''
      const input = $('free-photo')
      if (input) input.value = ''
      const himInput = $('free-him-photo')
      if (himInput) himInput.value = ''
      for (const id of ['free-text', 'free-continue-text', 'free-move-text', 'free-move-text2', 'free-move-next']) {
        const field = $(id)
        if (field) field.value = ''
      }
      state.videoUrl = ''
      state.videoNude = false
      applyVoiceSlot(state.voiceWho)
      showPhoto()
      showHim()
      showResult('')
      setStatus('', false)
      setMoveStatus('', false)
      setContinueStatus('', false)
      setVoiceStatus('', false)
      setFreeTab('make')
    })
    syncDualRow()
    syncPhotoOnlyButtons()
    setFreeTab('make')
    loadVoiceSlots()
      .catch(() => {})
      .then(() => lockMeVoice())
      .catch(() => applyVoiceSlot(state.voiceWho))
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
