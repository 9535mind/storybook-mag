/**
 * 쇼츠 영상에 사용자 음원(Suno 등)을 입히는 클라이언트 믹서.
 * - 태그(슬롯): 이름을 자유롭게 붙여 원하는 만큼 만들 수 있음. IndexedDB에 로컬 저장 (브라우저에만 보관)
 * - 합성: 영상을 blob으로 받은 뒤 canvas + MediaRecorder로 BGM 합성
 */

const BGM_DB_NAME = 'storymag-bgm'
const BGM_DB_VERSION = 1
const BGM_STORE = 'slots'
const BGM_MAX_LABEL_LENGTH = 24

function openBgmDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BGM_DB_NAME, BGM_DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(BGM_STORE)) {
        db.createObjectStore(BGM_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('bgm_db_open_failed'))
  })
}

function normalizeBgmLabel(label) {
  const trimmed = String(label || '').trim().slice(0, BGM_MAX_LABEL_LENGTH)
  if (!trimmed) throw new Error('empty_label')
  return trimmed
}

function generateBgmSlotId() {
  const rand = Math.random().toString(36).slice(2, 8)
  return `tag-${Date.now()}-${rand}`
}

/**
 * 저장된 태그(슬롯)를 만든 순서대로 나열한다.
 * (기존 고정 4개 슬롯 시절 데이터가 남아 있으면 그대로 태그로 표시되어 음원이 보존된다.)
 */
async function listBgmSlots() {
  const db = await openBgmDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BGM_STORE, 'readonly')
    const req = tx.objectStore(BGM_STORE).getAll()
    req.onsuccess = () => {
      const rows = (req.result || []).slice().sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 0
        const orderB = typeof b.order === 'number' ? b.order : 0
        return orderA - orderB
      })
      resolve(
        rows.map((row) => ({
          id: row.id,
          label: row.label || '이름 없음',
          fileName: row.fileName || '',
          hasAudio: Boolean(row.blob),
          mime: row.mime || '',
          updatedAt: row.updatedAt || null,
        })),
      )
    }
    req.onerror = () => reject(req.error || new Error('bgm_list_failed'))
  })
}

async function getBgmSlotBlob(slotId) {
  const db = await openBgmDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BGM_STORE, 'readonly')
    const req = tx.objectStore(BGM_STORE).get(slotId)
    req.onsuccess = () => resolve(req.result?.blob || null)
    req.onerror = () => reject(req.error || new Error('bgm_get_failed'))
  })
}

/** 새 태그를 만들고 음원을 저장한다. 성공하면 새 태그의 id를 반환. */
async function addBgmSlot(label, file) {
  if (!file || !file.size) throw new Error('empty_audio_file')
  if (file.size > 20 * 1024 * 1024) throw new Error('audio_too_large')
  const cleanLabel = normalizeBgmLabel(label)

  const db = await openBgmDb()
  const id = generateBgmSlotId()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BGM_STORE, 'readwrite')
    tx.objectStore(BGM_STORE).put({
      id,
      label: cleanLabel,
      fileName: file.name || `${cleanLabel}.audio`,
      mime: file.type || 'audio/mpeg',
      blob: file,
      order: Date.now(),
      updatedAt: new Date().toISOString(),
    })
    tx.oncomplete = () => resolve(id)
    tx.onerror = () => reject(tx.error || new Error('bgm_save_failed'))
  })
}

/** 기존 태그의 음원 파일만 교체한다 (이름·순서는 유지). */
async function replaceBgmSlotAudio(slotId, file) {
  if (!file || !file.size) throw new Error('empty_audio_file')
  if (file.size > 20 * 1024 * 1024) throw new Error('audio_too_large')

  const db = await openBgmDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BGM_STORE, 'readwrite')
    const store = tx.objectStore(BGM_STORE)
    const getReq = store.get(slotId)
    getReq.onsuccess = () => {
      const existing = getReq.result
      if (!existing) {
        reject(new Error('unknown_slot'))
        return
      }
      store.put({
        ...existing,
        fileName: file.name || existing.fileName,
        mime: file.type || 'audio/mpeg',
        blob: file,
        updatedAt: new Date().toISOString(),
      })
    }
    getReq.onerror = () => reject(getReq.error || new Error('bgm_get_failed'))
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error || new Error('bgm_save_failed'))
  })
}

/** 태그 이름만 바꾼다. */
async function renameBgmSlot(slotId, newLabel) {
  const cleanLabel = normalizeBgmLabel(newLabel)
  const db = await openBgmDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BGM_STORE, 'readwrite')
    const store = tx.objectStore(BGM_STORE)
    const getReq = store.get(slotId)
    getReq.onsuccess = () => {
      const existing = getReq.result
      if (!existing) {
        reject(new Error('unknown_slot'))
        return
      }
      store.put({ ...existing, label: cleanLabel })
    }
    getReq.onerror = () => reject(getReq.error || new Error('bgm_get_failed'))
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error || new Error('bgm_rename_failed'))
  })
}

/** 태그를 음원과 함께 완전히 삭제한다. */
async function deleteBgmSlot(slotId) {
  const db = await openBgmDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BGM_STORE, 'readwrite')
    tx.objectStore(BGM_STORE).delete(slotId)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error || new Error('bgm_delete_failed'))
  })
}

function pickRecorderMime() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return ''
}

/**
 * @param {string} videoUrl
 * @param {Blob} audioBlob
 * @param {{ volume?: number, onProgress?: (msg: string) => void }} [options]
 * @returns {Promise<{ blobUrl: string, blob: Blob, filename: string }>}
 */
async function mixVideoWithBgm(videoUrl, audioBlob, options = {}) {
  const volume = typeof options.volume === 'number' ? options.volume : 0.4
  const onProgress = options.onProgress || (() => {})

  if (!audioBlob?.size) throw new Error('missing_audio')
  const mime = pickRecorderMime()
  if (!mime) throw new Error('mediarecorder_unsupported')

  onProgress('영상을 준비하고 있어요…')
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) throw new Error('video_fetch_failed')
  const videoBlob = await videoRes.blob()
  const localVideoUrl = URL.createObjectURL(videoBlob)
  const localAudioUrl = URL.createObjectURL(audioBlob)

  const video = document.createElement('video')
  video.src = localVideoUrl
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'

  const audio = document.createElement('audio')
  audio.src = localAudioUrl
  audio.loop = true
  audio.preload = 'auto'

  try {
    await Promise.all([
      new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('video_load_failed'))
        video.load()
      }),
      new Promise((resolve, reject) => {
        audio.onloadedmetadata = () => resolve()
        audio.onerror = () => reject(new Error('audio_load_failed'))
        audio.load()
      }),
    ])

    const width = video.videoWidth || 720
    const height = video.videoHeight || 1280
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas_unavailable')

    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaElementSource(audio)
    const gain = audioCtx.createGain()
    gain.gain.value = Math.min(1, Math.max(0, volume))
    const dest = audioCtx.createMediaStreamDestination()
    source.connect(gain)
    gain.connect(dest)

    const canvasStream = canvas.captureStream(30)
    const combined = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ])

    const recorder = new MediaRecorder(combined, {
      mimeType: mime,
      videoBitsPerSecond: 6_000_000,
    })
    /** @type {BlobPart[]} */
    const chunks = []
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data)
    }

    onProgress('BGM을 입히고 있어요… 영상 길이만큼 기다려 주세요')
    video.currentTime = 0
    audio.currentTime = 0
    if (audioCtx.state === 'suspended') await audioCtx.resume()

    await video.play()
    await audio.play()
    recorder.start(200)

    let raf = 0
    const draw = () => {
      if (video.ended || video.paused) return
      ctx.drawImage(video, 0, 0, width, height)
      raf = requestAnimationFrame(draw)
    }
    draw()

    await new Promise((resolve, reject) => {
      video.onended = () => resolve()
      video.onerror = () => reject(new Error('video_play_failed'))
      // 안전장치: 메타 길이 + 1.5초
      const limitMs = Math.max(3000, (video.duration || 10) * 1000 + 1500)
      setTimeout(() => resolve(), limitMs)
    })

    cancelAnimationFrame(raf)
    if (recorder.state !== 'inactive') recorder.stop()
    audio.pause()
    video.pause()

    await new Promise((resolve) => {
      if (recorder.state === 'inactive') resolve()
      else recorder.onstop = () => resolve()
    })

    await audioCtx.close().catch(() => {})

    const outBlob = new Blob(chunks, { type: mime.includes('webm') ? 'video/webm' : mime })
    if (!outBlob.size) throw new Error('empty_mixed_video')
    const blobUrl = URL.createObjectURL(outBlob)
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const filename = `fashion-shorts-bgm-${stamp}.webm`
    return { blobUrl, blob: outBlob, filename }
  } finally {
    URL.revokeObjectURL(localVideoUrl)
    URL.revokeObjectURL(localAudioUrl)
  }
}
