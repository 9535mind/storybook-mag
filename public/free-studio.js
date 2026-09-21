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
    busy: false,
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

  /** 움직이기가 쓸 시작 프레임. 새로 만든 그림이 있으면 그것, 없으면 올린 사진. */
  const moveSource = () => state.result || state.photoUrl || state.photo || ''

  const syncMoveRow = () => {
    const wrap = $('free-move-wrap')
    if (wrap) wrap.hidden = !moveSource()
    const from = $('free-move-from')
    if (from) {
      from.textContent = state.result
        ? '시작 프레임: 방금 만든 그림'
        : state.photo
          ? '시작 프레임: 올린 사진 (그림을 안 만들어도 바로 됩니다)'
          : ''
    }
  }

  const syncPhotoOnlyButtons = () => {
    const project = $('free-project')
    if (project) project.disabled = !state.photo || state.busy
  }

  const showPhoto = () => {
    const wrap = $('free-photo-wrap')
    const preview = $('free-photo-preview')
    if (preview) preview.src = state.photo || ''
    if (wrap) wrap.hidden = !state.photo
    syncMoveRow()
    syncPhotoOnlyButtons()
  }

  const showResult = (url) => {
    state.result = url || ''
    const wrap = $('free-result-wrap')
    const img = $('free-result')
    if (img) img.src = state.result
    if (wrap) wrap.hidden = !state.result
    if (!state.result) {
      const video = $('free-video-wrap')
      if (video) video.hidden = true
    }
    syncMoveRow()
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
   * 한 장 만들기.
   * 사진이 있으면 그날의 refine (지시 수정 → Kontext / 나체면 화보 img2img),
   * 사진이 없으면 그날의 generate.
   * @param {{ bodyProject?: boolean }} [opts]
   */
  const run = async (opts = {}) => {
    if (state.busy) return
    const bodyProject = opts.bodyProject === true
    const text = String($('free-text')?.value || '').trim()
    if (bodyProject && !state.photo) {
      setStatus('몸매 투영은 사진이 있어야 합니다.', true)
      return
    }
    if (!bodyProject && !text) {
      setStatus('무엇을 만들지 적어 주세요.', true)
      return
    }
    const button = bodyProject ? $('free-project') : $('free-run')
    busy(true, button)
    setStatus(
      bodyProject
        ? '몸매 투영 중… 원래 체형 그대로 벗깁니다. 30초쯤 걸립니다.'
        : state.photo
          ? '올린 사진을 고치는 중… 30초쯤 걸립니다.'
          : '글만으로 그리는 중… 30초쯤 걸립니다.',
      false,
    )
    try {
      let out
      if (state.photo) {
        const imageUrl = await hostPhoto()
        out = await callJson('/api/free-refine', {
          mode: 'text',
          genMode: 'fashion',
          imageUrl,
          baseDescription: '',
          revision: text,
          bodyProject: bodyProject || undefined,
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
      showResult(url)
      const label = out.data.engineLabel ? ` (${out.data.engineLabel})` : ''
      setStatus(`나왔습니다${label}. 더 고치려면 고칠 말을 바꿔서 다시 누르세요.`, false)
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
    const startFrame = moveSource()
    if (!startFrame) {
      setMoveStatus('사진을 올리거나 그림을 한 장 만드세요.', true)
      return
    }
    const motion = String($('free-move-text')?.value || '').trim()
    if (!motion) {
      setMoveStatus('어떤 움직임인지 적어 주세요.', true)
      return
    }
    const total = Number($('free-move-sec')?.value) || 15
    const clipSec = DUAL[total] || total
    const dual = Boolean(DUAL[total])
    const motion2 = String($('free-move-text2')?.value || '').trim()
    if (dual && !motion2) {
      setMoveStatus(`${total}초는 두 클립입니다. 후반 움직임도 적어 주세요.`, true)
      return
    }
    const bodyProject = $('free-move-project')?.checked === true

    const button = $('free-move-run')
    busy(true, button)
    try {
      setMoveStatus(
        dual ? `${total}초 쇼츠: 전반(1/2) 만드는 중… 1~2분` : `영상 만드는 중… 1~2분 (${total}초)`,
        false,
      )
      const clip1 = await oneClip(startFrame, motion, clipSec, {
        bodyProject: bodyProject || undefined,
        clipRole: dual ? 'dual-a' : 'single',
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
    if (video) video.src = url
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
    $('free-photo')?.addEventListener('change', async (event) => {
      const file = event.target?.files?.[0]
      if (!file) return
      try {
        state.photo = await shrink(file)
        state.photoUrl = ''
        showPhoto()
        setStatus('사진을 올렸습니다. 고칠 말을 적으세요. 벗기려면 「몸매 투영」이 가장 셉니다.', false)
      } catch {
        state.photo = ''
        state.photoUrl = ''
        showPhoto()
        setStatus('사진을 읽지 못했습니다. 다른 파일로 해 주세요.', true)
      }
    })
    $('free-photo-clear')?.addEventListener('click', () => {
      state.photo = ''
      state.photoUrl = ''
      const input = $('free-photo')
      if (input) input.value = ''
      showPhoto()
      setStatus('사진을 뺐습니다. 이제 글만으로 그립니다.', false)
    })
    $('free-run')?.addEventListener('click', () => run())
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
