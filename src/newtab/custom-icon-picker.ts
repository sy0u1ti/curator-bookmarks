const CUSTOM_ICON_MAX_BYTES = 2 * 1024 * 1024

export function readCustomIconFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('请选择图片文件。'))
  }

  if (file.size > CUSTOM_ICON_MAX_BYTES) {
    return Promise.reject(new Error('自定义图片不能超过 2MB。'))
  }

  return readFileAsDataUrl(file)
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
