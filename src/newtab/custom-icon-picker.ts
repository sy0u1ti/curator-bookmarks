const CUSTOM_ICON_MAX_BYTES = 2 * 1024 * 1024

export function pickCustomIconImage(): Promise<string | null> {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.hidden = true

  return new Promise((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      input.remove()
      window.removeEventListener('focus', handleWindowFocus)
    }

    const settle = (value: string | null) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(value)
    }

    const fail = (error: Error) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      reject(error)
    }

    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (!input.files?.length) {
          settle(null)
        }
      }, 300)
    }

    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) {
        settle(null)
        return
      }

      if (!file.type.startsWith('image/')) {
        fail(new Error('请选择图片文件。'))
        return
      }

      if (file.size > CUSTOM_ICON_MAX_BYTES) {
        fail(new Error('自定义图片不能超过 2MB。'))
        return
      }

      readFileAsDataUrl(file).then(settle, fail)
    })

    window.addEventListener('focus', handleWindowFocus)
    document.body.appendChild(input)
    input.click()
  })
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const result = String(reader.result || '')
      if (!result.startsWith('data:image/')) {
        reject(new Error('图片读取失败，请换一张图片重试。'))
        return
      }
      resolve(result)
    })
    reader.addEventListener('error', () => {
      reject(new Error('图片读取失败，请换一张图片重试。'))
    })
    reader.readAsDataURL(file)
  })
}
