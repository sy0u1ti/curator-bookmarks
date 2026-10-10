const CUSTOM_ICON_MAX_BYTES = 2 * 1024 * 1024

export async function readCustomIconFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('请选择图片文件。'))
  }

  if (file.size > CUSTOM_ICON_MAX_BYTES) {
    return Promise.reject(new Error('自定义图片不能超过 2MB。'))
  }

  const image = new Image()
  const url = URL.createObjectURL(file)
  try {
    image.src = url
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片无法解码。')
    const scale = Math.min(1, 128 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('图片处理不可用。')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => {
      if (value) resolve(value)
      else reject(new Error('图片压缩失败。'))
    }, 'image/webp', 0.88))
    return await readFileAsDataUrl(blob)
  } catch {
    throw new Error('图片读取失败，请换一张图片重试。')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function readFileAsDataUrl(file: Blob): Promise<string> {
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
