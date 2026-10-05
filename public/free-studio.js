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
    /** 올린 사진 (data URL, 미리보기용) */
    photo: '',
    /** 그 사진을 올려서 받은 호스팅 URL — refine/animate 는 진짜 URL 을 요구한다 */
    photoUrl: '',
    /** 방금 만든 그림 URL */
    result: '',
    /** 그 그림이 이미 나체인가 (몸매 투영으로 만든 것인가) */
    resultNude: false,
    busy: false,
  }

  /** 움직임 주문이 벗기를 요구하는가. */
  const NUDE_WORDS = /나체|알몸|누드|벗/

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
        ? ' Same two Korean people from the photo. He leans in. His mouth stays on her bare breast. Intimate chest two-shot. Same white studio. No new faces. No bathroom.'
        : /가슴|젖|유방|breast/i.test(text)
          ? ' Same two Korean people from the photo. Mouth-to-mouth kiss. His hand on her bare breast. Same white studio. Keep the man clothed. No bathroom. No new faces.'
          : ' Same two Korean people from the photo. Mouth-to-mouth kiss. Same white studio. Keep the man clothed. No bathroom. No new faces.'
      : ''
    const faceLock = breastKiss
      ? 'Same two faces.'
      : couple
        ? 'Same two faces. No zoom.'
        : 'Same face, same glasses. No zoom.'
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

  const countFaces = async (url) => {
    const boxes = await listFaceBoxes(url)
    if (boxes.length) return boxes.length
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
    if (preview) preview.src = state.photo || ''
    if (wrap) wrap.hidden = !state.photo
    syncMoveRow()
    syncPhotoOnlyButtons()
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
  }

  const busy = (on, button) => {
    state.busy = on
    if (button) button.disabled = on
    syncPhotoOnlyButtons()
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
          revision: text,
          sourcePeople,
          size: sizeValue(),
          mood: 'clean',
        })
      } else if (state.photo) {
        const photoFaces = await countFaces(state.photo)
        const coupleText = looksCoupleMotion(text)
        sourcePeople = photoFaces >= 2 || coupleText ? 2 : 1
        const imageUrl = await hostPhoto()
        if (sourcePeople === 2) {
          setStatus('올린 원본은 그대로 두고, 여자 옷 칸만 찾아 녹입니다…', false)
          const parse = globalThis.DeskLookOnnx?.parse
          if (typeof parse !== 'function') {
            setStatus('옷 칸을 읽는 모듈이 없습니다. 새로고침 후 다시 눌러 주세요.', true)
            return
          }
          const parsed = await parse(state.photo)
          if (!parsed?.ok || !Array.isArray(parsed.labels)) {
            setStatus('옷 칸을 읽지 못했습니다. 잠시 뒤 다시 눌러 주세요.', true)
            return
          }
          const boxes = await listFaceBoxes(state.photo)
          const womanFace = await pickWomanBox(state.photo, boxes)
          const manFace = boxes.find((b) => b !== womanFace) || null
          const woman = womanFace ? slotBody(womanFace, 'woman') : null
          const man = manFace ? slotBody(manFace, 'man') : null
          const mask = womanClothesMask(parsed.labels, parsed.width, parsed.height, woman, man)
          if (mask.white < 1200) {
            setStatus('여자 옷을 찾지 못해 원본을 건드리지 않았습니다.', true)
            return
          }
          out = await callJson('/api/free-refine', {
            mode: 'region',
            genMode: 'fashion',
            imageUrl,
            baseDescription: '',
            revision: '여자 옷만 녹여 나체. 마스크 밖 얼굴·남자·배경은 원본 그대로.',
            maskDataUrl: mask.dataUrl,
            sourcePeople: 2,
            size: sizeValue(),
            mood: 'clean',
          })
        } else {
          out = await callJson('/api/free-refine', {
            mode: 'text',
            genMode: 'fashion',
            imageUrl,
            baseDescription: '',
            revision: text,
            bodyProject: bodyProject || undefined,
            sourcePeople: 1,
            size: sizeValue(),
            mood: 'clean',
          })
        }
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
      // 글로 벗긴 경우에도 결과는 나체다 — 움직이기에서 또 벗기지 않게 표시해 둔다.
      showResult(url, sourcePeople === 2 || bodyProject || NUDE_WORDS.test(text))
      const label = out.data.engineLabel ? ` (${out.data.engineLabel})` : ''
      setStatus(
        revise
          ? `고쳤습니다${label}. 또 고치려면 말을 바꿔 수정하기를 누르세요.`
          : `나왔습니다${label}. 더 고치려면 고칠 말을 적고 수정하기를 누르세요.`,
        false,
      )
    } catch (error) {
      setStatus(`실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, true)
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
    let motion = String($('free-move-text')?.value || '').trim()
    if (!motion) {
      setMoveStatus('어떤 움직임인지 적어 주세요.', true)
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

    const button = $('free-move-run')
    busy(true, button)
    try {
      const fromOriginal = (url) =>
        Boolean(url && (url === state.photo || url === state.photoUrl))
      const madeStill = Boolean(state.result && !fromOriginal(state.result))
      let startFrame = madeStill ? state.result : ''
      if (!startFrame) {
        startFrame = state.photoUrl || (await hostPhoto())
      }
      if (!startFrame) {
        setMoveStatus('사진을 올리거나 한 장을 먼저 만드세요.', true)
        return
      }
      const photoFaces = await countFaces(startFrame || state.photo || state.photoUrl || state.result)
      const couple = photoFaces >= 2
      if (couple || looksCoupleMotion(`${motion} ${motion2}`)) {
        const box = $('free-move-project')
        if (box) box.checked = false
      }

      if (state.resultNude) {
        motion = holdNude(motion, couple)
        if (motion2) motion2 = holdNude(motion2, couple)
      }

      setMoveStatus(
        dual ? `${total}초 쇼츠: 전반(1/2) 만드는 중… 1~2분` : `영상 만드는 중… 1~2분 (${total}초)`,
        false,
      )
      const clip1 = await oneClip(startFrame, motion, clipSec, {
        bodyProject: couple ? undefined : state.resultNude ? undefined : bodyProject || undefined,
        clipRole: dual ? 'dual-a' : 'single',
        sourcePeople: couple ? 2 : 1,
        sourceNude: state.resultNude || undefined,
      })
      if (!dual) {
        showVideo(clip1)
        setMoveStatus('나왔습니다.', false)
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
        sourcePeople: couple ? 2 : 1,
        sourceNude: state.resultNude || undefined,
      })

      setMoveStatus('두 클립 이어 붙이는 중…', false)
      const merged = await callJson('/api/merge-videos', { videoUrls: [clip1, clip2] })
      if (merged.error || !merged.data?.videoUrl) {
        showVideo(clip1)
        setMoveStatus('이어 붙이기가 실패해서 전반만 보여 드립니다. 다시 눌러 주세요.', true)
        return
      }
      showVideo(merged.data.videoUrl)
      setMoveStatus('나왔습니다.', false)
    } catch (error) {
      setMoveStatus(`실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, true)
    } finally {
      busy(false, button)
    }
  }

  const showVideo = (url) => {
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

  const download = () => {
    if (!state.result) return
    const a = document.createElement('a')
    a.href = state.result
    a.download = `free-studio-${Date.now()}.png`
    a.rel = 'noopener'
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    a.remove()
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
        state.photoUrl = ''
        showPhoto()
        setStatus('사진을 올렸습니다. 고치지 않으면 아래 움직이기로 바로 쇼츠 됩니다. 벗기려면 「몸매 투영」이 가장 셉니다.', false)
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
      state.photoUrl = ''
      const input = $('free-photo')
      if (input) input.value = ''
      showPhoto()
      setStatus('사진을 뺐습니다. 이제 글만으로 그립니다.', false)
    })
    $('free-run')?.addEventListener('click', () => run())
    $('free-revise')?.addEventListener('click', () => run({ revise: true }))
    $('free-project')?.addEventListener('click', () => run({ bodyProject: true }))
    $('free-move-run')?.addEventListener('click', runMove)
    $('free-move-sec')?.addEventListener('change', syncDualRow)
    $('free-download')?.addEventListener('click', download)
    $('free-reset')?.addEventListener('click', () => {
      state.photo = ''
      state.photoUrl = ''
      const input = $('free-photo')
      if (input) input.value = ''
      for (const id of ['free-text', 'free-move-text', 'free-move-text2']) {
        const field = $(id)
        if (field) field.value = ''
      }
      showPhoto()
      showResult('')
      setStatus('', false)
      setMoveStatus('', false)
    })
    syncDualRow()
    syncPhotoOnlyButtons()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
