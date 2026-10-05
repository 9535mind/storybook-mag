/**
 * 그림·사진 붙이기 공용.
 * 파일 선택 · 끌어다 놓기 · Ctrl+V 붙여넣기 · 결과 그림 Ctrl+C 복사를 모든 칸에서 같게 만든다.
 * Desk / 일러스트의 기존 붙이기는 그대로 두고, 여기 등록한 칸만 받는다.
 */
;(() => {
  const handlers = Object.create(null)

  const isImageFile = (file) => {
    if (!file) return false
    const type = String(file.type || '').toLowerCase()
    if (type.startsWith('image/')) return true
    if (type && type !== 'application/octet-stream') return false
    const name = String(file.name || '')
    if (/\.(png|jpe?g|webp|gif|bmp|heic|heif|jfif)$/i.test(name)) return true
    return !type
  }

  const isPdfFile = (file) => {
    if (!file) return false
    const type = String(file.type || '').toLowerCase()
    if (type === 'application/pdf') return true
    return /\.pdf$/i.test(String(file.name || ''))
  }

  const filesFrom = (dataTransfer, { pdf, onlyPdf } = {}) => {
    if (!dataTransfer) return []
    const out = []
    const push = (file) => {
      if (!file) return
      if (onlyPdf) {
        if (isPdfFile(file)) out.push(file)
        return
      }
      if (isImageFile(file) || (pdf && isPdfFile(file))) out.push(file)
    }
    const files = dataTransfer.files
    if (files?.length) {
      for (const file of files) push(file)
    }
    if (!out.length) {
      const items = dataTransfer.items
      if (items?.length) {
        for (const item of items) {
          const type = String(item.type || '')
          if (item.kind === 'file' && (type.startsWith('image/') || (pdf && type === 'application/pdf') || !type)) {
            push(item.getAsFile())
          }
        }
      }
    }
    return out
  }

  const hasFileDrag = (event) => {
    const types = event.dataTransfer?.types
    if (!types) return false
    return Array.from(types).includes('Files')
  }

  const readClipboardImage = async () => {
    if (!navigator.clipboard?.read) return null
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const type = item.types.find((one) => String(one).startsWith('image/'))
      if (!type) continue
      const blob = await item.getType(type)
      if (blob) return new File([blob], `paste-${Date.now()}.png`, { type: blob.type || type })
    }
    return null
  }

  const bind = (el, opts = {}) => {
    if (!el) return
    const onFiles = opts.onFiles
    el.classList.add('attach-drop')
    if (typeof onFiles !== 'function') return
    let depth = 0
    const setOn = (on) => {
      el.classList.toggle('attach-drop--on', on)
    }
    el.addEventListener('dragenter', (event) => {
      if (!hasFileDrag(event)) return
      event.preventDefault()
      depth += 1
      setOn(true)
    })
    el.addEventListener('dragover', (event) => {
      if (!hasFileDrag(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    })
    el.addEventListener('dragleave', (event) => {
      if (el.contains(event.relatedTarget)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setOn(false)
    })
    el.addEventListener('drop', (event) => {
      const files = filesFrom(event.dataTransfer, { pdf: opts.pdf, onlyPdf: opts.onlyPdf })
      if (!files.length) return
      event.preventDefault()
      event.stopPropagation()
      depth = 0
      setOn(false)
      onFiles(files, event)
    })
    el.addEventListener('paste', (event) => {
      const files = filesFrom(event.clipboardData, { pdf: opts.pdf, onlyPdf: opts.onlyPdf })
      if (files.length) {
        event.preventDefault()
        event.stopPropagation()
        onFiles(files, event)
        return
      }
      const types = Array.from(event.clipboardData?.types || [])
      const looksImage = types.some((one) => String(one).startsWith('image/') || one === 'Files')
      if (!looksImage || opts.onlyPdf) return
      event.preventDefault()
      event.stopPropagation()
      void readClipboardImage()
        .then((file) => {
          if (file) onFiles([file], event)
          else opts.onEmptyPaste?.()
        })
        .catch(() => opts.onEmptyPaste?.())
    })
    opts.pasteBtn?.addEventListener('click', async () => {
      try {
        if (opts.onlyPdf && navigator.clipboard?.read) {
          const items = await navigator.clipboard.read()
          for (const item of items) {
            if (item.types.includes('application/pdf')) {
              const blob = await item.getType('application/pdf')
              onFiles([new File([blob], `paste-${Date.now()}.pdf`, { type: 'application/pdf' })], { type: 'paste-btn' })
              return
            }
          }
          opts.onEmptyPaste?.()
          return
        }
        const file = await readClipboardImage()
        if (!file) {
          opts.onEmptyPaste?.()
          return
        }
        onFiles([file], { type: 'paste-btn' })
      } catch {
        opts.onEmptyPaste?.()
      }
    })
  }

  const currentArea = () =>
    typeof getAppArea === 'function' ? getAppArea() : localStorage.getItem('storymagAppArea') || ''

  const route = (files, event) => {
    if (!files?.length) return false
    const area = currentArea()
    const fn = handlers[area]
    if (typeof fn !== 'function') return false
    fn(files, event)
    return true
  }

  const copyImageEl = async (el) => {
    if (!el) return false
    let blob = null
    if (el instanceof HTMLImageElement) {
      const src = el.currentSrc || el.src
      if (!src) return false
      if (src.startsWith('data:')) {
        const res = await fetch(src)
        blob = await res.blob()
      } else {
        const canvas = document.createElement('canvas')
        canvas.width = el.naturalWidth || el.width
        canvas.height = el.naturalHeight || el.height
        if (!canvas.width || !canvas.height) return false
        try {
          canvas.getContext('2d').drawImage(el, 0, 0)
          blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        } catch {
          try {
            const res = await fetch(src, { mode: 'cors' })
            blob = await res.blob()
          } catch {
            return false
          }
        }
      }
    } else if (el instanceof HTMLCanvasElement) {
      blob = await new Promise((resolve) => el.toBlob(resolve, 'image/png'))
    }
    if (!blob || !navigator.clipboard?.write) return false
    await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })])
    return true
  }

  const visibleCopyTarget = (event) => {
    const hit = event.target?.closest?.('img, canvas')
    if (hit && hit.offsetParent !== null && (hit.naturalWidth || hit.width)) return hit
    const area = currentArea()
    const ids =
      area === 'free'
        ? ['free-result', 'free-photo-preview']
        : area === 'observe'
          ? ['observe-preview']
          : area === 'tale'
            ? ['tale-scene-result-img', 'layout-canvas', 'tale-img-canvas']
            : area === 'studio' || area === 'admin'
              ? ['result-image', 'desk-cast-woman-img', 'desk-cast-man-img']
              : []
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el && !el.hidden && el.offsetParent !== null) return el
    }
    return null
  }

  document.addEventListener('keydown', async (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'c') return
    if (event.altKey) return
    const sel = String(window.getSelection?.() || '')
    if (sel.trim()) return
    const tag = event.target
    if (tag && (tag.tagName === 'INPUT' || tag.tagName === 'TEXTAREA') && tag.type !== 'file') return
    const el = visibleCopyTarget(event)
    if (!el) return
    try {
      const ok = await copyImageEl(el)
      if (ok) event.preventDefault()
    } catch {
      /* 브라우저가 막으면 기본 복사에 맡긴다 */
    }
  })

  globalThis.StorymagAttach = {
    isImageFile,
    isPdfFile,
    filesFrom,
    hasFileDrag,
    readClipboardImage,
    bind,
    register: (area, fn) => {
      handlers[area] = fn
    },
    route,
    copyImageEl,
  }
})()
