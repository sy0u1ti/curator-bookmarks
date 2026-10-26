export type FaviconContrast = 'original' | 'light-backdrop' | 'neutral-backdrop'

const SAMPLE_SIZE = 20
const CACHE_LIMIT = 512
const contrastCache = new Map<string, FaviconContrast>()
let sampleCanvas: HTMLCanvasElement | null = null

export function classifyFaviconContrast(pixels: Uint8ClampedArray): FaviconContrast {
  let opacity = 0
  let luminance = 0
  let darkPixels = 0
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255
    if (alpha < 0.15) continue
    const light = (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255
    opacity += alpha
    luminance += light * alpha
    if (light < 0.25) darkPixels += alpha
  }
  // A backdrop helps dark transparent glyphs, not opaque artwork. Do not
  // invert the bitmap or brighten a light logo into another light surface.
  return opacity > 2 && opacity / (pixels.length / 4) < 0.9 &&
    luminance / opacity < 0.22 && darkPixels / opacity > 0.65
    ? 'light-backdrop'
    : 'original'
}

export function getCachedFaviconContrast(source: string): FaviconContrast {
  return contrastCache.get(source) || 'original'
}

export function readFaviconContrast(image: HTMLImageElement, source: string): FaviconContrast {
  const cached = contrastCache.get(source)
  if (cached) return cached
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) return 'original'

  let contrast: FaviconContrast = 'neutral-backdrop'
  try {
    sampleCanvas ||= document.createElement('canvas')
    sampleCanvas.width = SAMPLE_SIZE
    sampleCanvas.height = SAMPLE_SIZE
    const context = sampleCanvas.getContext('2d', { willReadFrequently: true })
    if (context) {
      context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
      contrast = classifyFaviconContrast(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data)
    }
  } catch {
    // A successfully decoded cross-origin image may taint the canvas. Unknown
    // pixels need a mid-tone plate that supports both dark and light glyphs,
    // rather than being cached as a known readable-on-dark image.
    sampleCanvas = null
  }
  if (contrastCache.size >= CACHE_LIMIT) {
    contrastCache.delete(contrastCache.keys().next().value!)
  }
  contrastCache.set(source, contrast)
  return contrast
}
