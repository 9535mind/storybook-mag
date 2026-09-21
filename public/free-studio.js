/**
 * 자유 스튜디오.
 *
 * Desk 와 같은 엔진을 쓰지만 걸음(CAST→LOOK→PLACE→MOVE)도, 옷 마스크도,
 * 저장을 거부하는 검사도 없다. 사용자가 적은 말이 그대로 엔진에 간다.
 * Desk 파이프라인은 건드리지 않는다 — 여기서 실패해도 Desk 는 그대로다.
 */
;(() => {
  const MAX_SIDE = 1536
  const state = { photo: '', busy: false, result: '' }

  const $ = (id) => document.getElementById(id)

  const setStatus = (text, bad) => {
    const el = $('free-status')
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

  /** 움직이기가 쓸 시작 프레임. 새로 만든 그림이 있으면 그것, 없으면 올린 사진. */
  const moveSource = () => state.result || state.photo || ''

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

  const showPhoto = () => {
    const wrap = $('free-photo-wrap')
    const preview = $('free-photo-preview')
    if (preview) preview.src = state.photo || ''
    if (wrap) wrap.hidden = !state.photo
    syncMoveRow()
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

  const setMoveStatus = (text, bad) => {
    const el = $('free-move-status')
    if (!el) return
    el.textContent = text || ''
    el.hidden = !text
    el.classList.toggle('form__status--error', Boolean(bad))
  }

  const run = async () => {
    if (state.busy) return
    const text = String($('free-text')?.value || '').trim()
    if (!text) {
      setStatus('무엇을 만들지 적어 주세요.', true)
      return
    }
    if (typeof globalThis.postTaleSceneJob !== 'function') {
      setStatus('장면 엔진을 불러오지 못했습니다. 새로고침해 주세요.', true)
      return
    }
    state.busy = true
    const button = $('free-run')
    if (button) button.disabled = true
    setStatus(state.photo ? '올린 사진을 고치는 중…' : '글만으로 그리는 중…', false)
    try {
      const job = await globalThis.postTaleSceneJob(
        {
          composeMode: 'free-still',
          description: text,
          images: state.photo ? [state.photo] : [],
          aspectRatio: $('free-ratio')?.value || '3:4',
          photoreal: true,
          adultStill: true,
        },
        '자유 스튜디오',
        240,
        (message) => setStatus(message, true),
      )
      if (!job) return
      if (job.auth) {
        setStatus('다시 로그인해 주세요.', true)
        return
      }
      if (!job.imageUrl) {
        setStatus('결과를 받지 못했습니다. 같은 단추를 다시 눌러 주세요.', true)
        return
      }
      showResult(job.imageUrl)
      setStatus('나왔습니다. 더 고치려면 이 그림을 사진 칸에 올리세요.', false)
    } catch (error) {
      setStatus(`실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, true)
    } finally {
      state.busy = false
      if (button) button.disabled = false
    }
  }

  /**
   * 쇼츠. 엔진·길이·머지는 동결된 쇼츠 파이프라인을 그대로 쓴다
   * (Wan `wan-2.2-i2v-fast`, /api/animate → /api/animate-status).
   * Desk 의 걸음·CAST·게이트만 빼고 지금 그림을 시작 프레임으로 보낸다.
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
    const durationSec = Number($('free-move-sec')?.value) || 15
    const headers = typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' }
    state.busy = true
    const button = $('free-move-run')
    if (button) button.disabled = true
    setMoveStatus(`영상 만드는 중… 1~2분 걸립니다 (약 ${durationSec}초)`, false)
    try {
      const response = await fetch('/api/animate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          // 서버가 data URL 도 imageUrl 로 받아 준다 (animate.ts 가 알아서 갈라 씀).
          imageUrl: startFrame,
          prompt: '',
          motion,
          durationSec,
          clipRole: 'single',
          genMode: 'fashion',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        setMoveStatus('다시 로그인해 주세요.', true)
        return
      }
      if (!data.ok) {
        setMoveStatus(`실패: ${data.message || data.error || response.status}`, true)
        return
      }
      let videoUrl = data.videoUrl || ''
      if (!videoUrl && data.pending && data.predictionId) {
        const started = Date.now()
        while (Date.now() - started < 8 * 60 * 1000) {
          await new Promise((done) => setTimeout(done, 5000))
          const poll = await fetch('/api/animate-status', {
            method: 'POST',
            headers,
            body: JSON.stringify({ predictionId: data.predictionId, durationSec }),
          })
          const step = await poll.json().catch(() => ({}))
          if (step.status === 'failed') {
            setMoveStatus(`실패: ${step.message || '영상 생성 실패'}`, true)
            return
          }
          if (step.videoUrl) {
            videoUrl = step.videoUrl
            break
          }
          setMoveStatus(`영상 만드는 중… ${Math.round((Date.now() - started) / 1000)}초 경과`, false)
        }
      }
      if (!videoUrl) {
        setMoveStatus('시간 안에 결과를 받지 못했습니다. 다시 눌러 주세요.', true)
        return
      }
      const video = $('free-video')
      const wrap = $('free-video-wrap')
      if (video) video.src = videoUrl
      if (wrap) wrap.hidden = false
      setMoveStatus('나왔습니다.', false)
    } catch (error) {
      setMoveStatus(`실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, true)
    } finally {
      state.busy = false
      if (button) button.disabled = false
    }
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
        showPhoto()
        setStatus('사진을 올렸습니다. 고칠 말을 적으세요.', false)
      } catch {
        state.photo = ''
        showPhoto()
        setStatus('사진을 읽지 못했습니다. 다른 파일로 해 주세요.', true)
      }
    })
    $('free-photo-clear')?.addEventListener('click', () => {
      state.photo = ''
      const input = $('free-photo')
      if (input) input.value = ''
      showPhoto()
      setStatus('사진을 뺐습니다. 이제 글만으로 그립니다.', false)
    })
    $('free-run')?.addEventListener('click', run)
    $('free-move-run')?.addEventListener('click', runMove)
    $('free-download')?.addEventListener('click', download)
    $('free-reset')?.addEventListener('click', () => {
      state.photo = ''
      const input = $('free-photo')
      if (input) input.value = ''
      const text = $('free-text')
      if (text) text.value = ''
      const move = $('free-move-text')
      if (move) move.value = ''
      showPhoto()
      showResult('')
      setStatus('', false)
      setMoveStatus('', false)
    })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
