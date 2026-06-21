const BACKGROUND_URL_CACHE_MAX_DIMENSION = 2560
const BACKGROUND_URL_CACHE_QUALITY = 0.86
const BACKGROUND_VIDEO_READY_TIMEOUT_MS = 2800

export function waitForBackgroundVideoSourceReady(
  src: string,
  timeoutMs = BACKGROUND_VIDEO_READY_TIMEOUT_MS
): Promise<boolean> {
  const video = document.createElement('video')
  video.autoplay = true
  video.loop = true
  video.muted = true
  video.playsInline = true
  video.src = src

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve(true)
  }

  return new Promise((resolve) => {
    let settled = false
    let timeout = 0

    const cleanup = () => {
      window.clearTimeout(timeout)
      video.removeEventListener('loadedmetadata', handleReady)
      video.removeEventListener('canplay', handleReady)
      video.removeEventListener('error', handleError)
      video.removeAttribute('src')
      video.load()
    }

    const settle = (ready: boolean) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(ready)
    }

    function handleReady(): void {
      settle(true)
    }

    function handleError(): void {
      settle(false)
    }

    timeout = window.setTimeout(() => {
      settle(false)
    }, timeoutMs)
    video.addEventListener('loadedmetadata', handleReady, { once: true })
    video.addEventListener('canplay', handleReady, { once: true })
    video.addEventListener('error', handleError, { once: true })
  })
}

export async function createOptimizedBackgroundImageBlob(blob: Blob): Promise<Blob> {
  if (blob.type.toLowerCase() === 'image/gif') {
    return blob
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return blob
  }

  try {
    const targetMaxDimension = getBackgroundCacheTargetDimension()
    const sourceMaxDimension = Math.max(bitmap.width, bitmap.height)
    if (!sourceMaxDimension || sourceMaxDimension <= targetMaxDimension) {
      return blob
    }

    const scale = targetMaxDimension / sourceMaxDimension
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const context = canvas.getContext('2d')
    if (!context) {
      return blob
    }

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
    const optimizedBlob = await canvasToBlob(canvas, 'image/webp', BACKGROUND_URL_CACHE_QUALITY)
    if (!optimizedBlob || optimizedBlob.size >= blob.size) {
      return blob
    }

    return optimizedBlob
  } finally {
    bitmap.close()
  }
}

function getBackgroundCacheTargetDimension(): number {
  const viewportMaxDimension = Math.max(window.innerWidth || 0, window.innerHeight || 0, 1280)
  const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
  return Math.min(BACKGROUND_URL_CACHE_MAX_DIMENSION, Math.ceil(viewportMaxDimension * pixelRatio))
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob)
    }, type, quality)
  })
}
