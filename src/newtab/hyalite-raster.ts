import type { HyaliteMapInput, HyaliteMapPixels } from '../vendor/hyalite/hyalite.js'

export interface GlassRasterScene {
  src: string
  color: string
  width: number
  height: number
  size: string
  position: string
  density: number
  filter: string
  veil: string
  gradient: string
}

export interface GlassRasterInput {
  scene: GlassRasterScene
  rect: { left: number; top: number; width: number; height: number }
}

interface Frame {
  pixels: Uint8ClampedArray
  width: number
  height: number
  density: number
}

let imageSource = ''
let decodedImage: ImageBitmap | null = null
const frames = new Map<string, Frame>()
const textures = new Map<string, Blob>()

function sample(data: Uint8ClampedArray, width: number, height: number, x: number, y: number, channel: number): number {
  const cx = Math.min(width - 1, Math.max(0, x))
  const cy = Math.min(height - 1, Math.max(0, y))
  const x0 = Math.floor(cx), y0 = Math.floor(cy)
  const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1)
  const tx = cx - x0, ty = cy - y0
  const top = data[(y0 * width + x0) * 4 + channel] * (1 - tx) + data[(y0 * width + x1) * 4 + channel] * tx
  const bottom = data[(y1 * width + x0) * 4 + channel] * (1 - tx) + data[(y1 * width + x1) * 4 + channel] * tx
  return top * (1 - ty) + bottom * ty
}

function position(value: string | undefined): number {
  if (!value || value === 'center') return 0.5
  if (value === 'left' || value === 'top') return 0
  if (value === 'right' || value === 'bottom') return 1
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed / 100 : 0.5
}

async function backgroundFrame(scene: GlassRasterScene, blur: number): Promise<Frame> {
  const key = JSON.stringify(scene) + '|' + blur
  const cached = frames.get(key)
  if (cached) return cached
  if (imageSource !== scene.src || !decodedImage) {
    const response = await fetch(scene.src)
    if (!response.ok) throw new Error('Wallpaper pixels unavailable')
    const next = await createImageBitmap(await response.blob())
    decodedImage?.close()
    decodedImage = next
    imageSource = scene.src
  }
  const source = decodedImage
  const density = Math.max(0.25, Math.min(scene.density, 1.5, Math.sqrt(3_000_000 / (scene.width * scene.height))))
  const width = Math.ceil(scene.width * density), height = Math.ceil(scene.height * density)
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Wallpaper raster canvas unavailable')
  context.fillStyle = scene.color || '#101013'
  context.fillRect(0, 0, width, height)
  let ratio = scene.size === 'contain'
    ? Math.min(scene.width / source.width, scene.height / source.height)
    : Math.max(scene.width / source.width, scene.height / source.height)
  const sizes = scene.size.split(/\s+/)
  if (sizes[0]?.endsWith('%')) ratio = scene.width * Number.parseFloat(sizes[0]) / 100 / source.width
  else if (sizes[0]?.endsWith('px')) ratio = Number.parseFloat(sizes[0]) / source.width
  const drawWidth = source.width * ratio, drawHeight = source.height * ratio
  const positions = scene.position.split(/\s+/)
  const left = (scene.width - drawWidth) * position(positions[0])
  const top = (scene.height - drawHeight) * position(positions[1])
  const maskFilter = scene.filter.replace(/blur\(([\d.]+)px\)/g, (_, value) => `blur(${Number(value) * density}px)`)
  context.filter = [maskFilter === 'none' ? '' : maskFilter, `blur(${blur * density}px)`].filter(Boolean).join(' ')
  context.drawImage(source, left * density, top * density, drawWidth * density, drawHeight * density)
  context.filter = 'none'
  if (scene.veil && scene.veil !== 'rgba(0, 0, 0, 0)') {
    context.fillStyle = scene.veil
    context.fillRect(0, 0, width, height)
  }
  if (scene.gradient.startsWith('linear-gradient')) {
    const stops = [...scene.gradient.matchAll(/(rgba?\([^)]+\)|#[\da-f]{3,8}|transparent)\s*([\d.]+%)?/gi)]
    if (stops.length > 1) {
      const gradient = context.createLinearGradient(0, 0, 0, height)
      stops.forEach((stop, index) => gradient.addColorStop(stop[2] ? Number.parseFloat(stop[2]) / 100 : index / (stops.length - 1), stop[1]))
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)
    }
  }
  const frame = { width, height, density, pixels: context.getImageData(0, 0, width, height).data }
  frames.set(key, frame)
  if (frames.size > 2) frames.delete(frames.keys().next().value!)
  return frame
}

/** Cache the upstream lens field over the wallpaper, outside the UI thread.
 * Foreground text remains ordinary DOM; these pixels contain only the backdrop.
 */
export async function renderGlassRaster(input: HyaliteMapInput, map: HyaliteMapPixels, raster: GlassRasterInput): Promise<Blob> {
  const options = input.options
  const key = input.key + '|' + JSON.stringify(options) + '|' + JSON.stringify(raster)
  const hit = textures.get(key)
  if (hit) { textures.delete(key); textures.set(key, hit); return hit }
  const frame = await backgroundFrame(raster.scene, Number(options.blur) || 0)
  const logicalWidth = raster.rect.width, logicalHeight = raster.rect.height
  const width = Math.max(1, Math.round(logicalWidth * frame.density))
  const height = Math.max(1, Math.round(logicalHeight * frame.density))
  const pixels = new Uint8ClampedArray(width * height * 4)
  const smooth = Number(options.smooth) || 0
  const split = smooth > 0 ? map.split : 1
  const dispersion = smooth > 0 ? Math.min(0.95, Number(options.dispersion) / split) : Number(options.dispersion) || 0
  const light = Number(options.rim) || 0
  const readMap = (data: Uint8ClampedArray, x: number, y: number, channel: number) =>
    sample(data, map.width, map.height, x / logicalWidth * map.width - 0.5, y / logicalHeight * map.height - 0.5, channel)
  const backdrop = (x: number, y: number, channel: number) => sample(frame.pixels, frame.width, frame.height,
    (raster.rect.left + x) * frame.density - 0.5, (raster.rect.top + y) * frame.density - 0.5, channel)
  const inner = (x: number, y: number, channel: number) => backdrop(
    x + (readMap(map.inner, x, y, 0) / 255 - 0.5) * 2 * map.innerMaxd,
    y + (readMap(map.inner, x, y, 1) / 255 - 0.5) * 2 * map.innerMaxd, channel)
  const middle = (x: number, y: number, channel: number) => {
    if (!smooth) return backdrop(x, y, channel)
    const center = inner(x, y, channel)
    const mask = readMap(map.inner, x, y, 2) / 255
    if (mask < 0.01) return center
    // A separable 3x3 Gaussian approximation is only evaluated inside the rim.
    // Its variance matches the smoothing radius; the clear centre stays untouched.
    const distance = smooth * Math.SQRT2
    let softened = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      softened += inner(x + dx * distance, y + dy * distance, channel) * (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1) / 16
    }
    return center * (1 - mask) + softened * mask
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = (x + 0.5) / width * logicalWidth
    const py = (y + 0.5) / height * logicalHeight
    const vx = (readMap(map.outer, px, py, 0) / 255 - 0.5) * 2 * map.maxd * split
    const vy = (readMap(map.outer, px, py, 1) / 255 - 0.5) * 2 * map.maxd * split
    const rim = Math.min(1, readMap(map.outer, px, py, 2) / 255 * light)
    const at = (y * width + x) * 4
    // The unbent centre is rendered by native backdrop blur. Cache only the
    // refracting rim, so scrolling and moving backgrounds remain genuinely live.
    if (Math.hypot(vx, vy) / split < 0.08 && rim < 0.002) continue
    for (let channel = 0; channel < 3; channel++) {
      const factor = channel === 0 ? 1 - dispersion : channel === 2 ? 1 + dispersion : 1
      const color = middle(px + vx * factor, py + vy * factor, channel)
      pixels[at + channel] = color * (1 - rim) + 255 * rim
    }
    pixels[at + 3] = 255
  }
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Glass raster canvas unavailable')
  context.putImageData(new ImageData(pixels, width, height), 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  textures.set(key, blob)
  if (textures.size > 64) textures.delete(textures.keys().next().value!)
  return blob
}
