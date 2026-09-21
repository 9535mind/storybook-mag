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

  const showPhoto = () => {
    const wrap = $('free-photo-wrap')
    const preview = $('free-photo-preview')
    if (preview) preview.src = state.photo || ''
    if (wrap) wrap.hidden = !state.photo
  }

  const showResult = (url) => {
    state.result = url || ''
    const wrap = $('free-result-wrap')
    const img = $('free-result')
    if (img) img.src = state.result
    if (wrap) wrap.hidden = !state.result
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
    $('free-download')?.addEventListener('click', download)
    $('free-reset')?.addEventListener('click', () => {
      state.photo = ''
      const input = $('free-photo')
      if (input) input.value = ''
      const text = $('free-text')
      if (text) text.value = ''
      showPhoto()
      showResult('')
      setStatus('', false)
    })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
