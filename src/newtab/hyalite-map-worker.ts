import Hyalite, { type HyaliteMapInput, type HyaliteMapRecord, type HyaliteInfo, type HyaliteMapPixels } from '../vendor/hyalite/hyalite.js'
import { renderGlassRaster, type GlassRasterInput } from './hyalite-raster.js'

export interface GlassMapRequest { id: number; input: HyaliteMapInput; raster?: GlassRasterInput }
export type GlassMapResponse =
  | { id: number; map: HyaliteMapRecord; info: HyaliteInfo }
  | { id: number; texture: Blob; luminance: number | null }
  | { id: number; error: string }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<GlassMapRequest>) => void) | null
  postMessage(message: GlassMapResponse): void
}
const cache = new Map<string, { map: HyaliteMapRecord; info: HyaliteInfo; pixels: HyaliteMapPixels }>()
const pixelCache = new Map<string, HyaliteMapPixels>()
let queue: Promise<void> = Promise.resolve()

function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Glass map encoding failed'))
    reader.readAsDataURL(blob)
  })
}
function buildPixels(input: HyaliteMapInput): HyaliteMapPixels {
  const hit = pixelCache.get(input.key)
  if (hit) return hit
  const pixels = Hyalite.buildMapPixels(input.width, input.height, input.radii, input.options)
  pixelCache.set(input.key, pixels)
  if (pixelCache.size > 24) pixelCache.delete(pixelCache.keys().next().value!)
  return pixels
}
async function build(input: HyaliteMapInput) {
  const hit = cache.get(input.key)
  if (hit) { cache.delete(input.key); cache.set(input.key, hit); return hit }
  const pixels = buildPixels(input)
  const canvas = new OffscreenCanvas(pixels.width, pixels.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Offscreen canvas unavailable')
  context.putImageData(new ImageData(pixels.outer as Uint8ClampedArray<ArrayBuffer>, pixels.width, pixels.height), 0, 0)
  const url = await asDataUrl(await canvas.convertToBlob({ type: 'image/png' }))
  context.putImageData(new ImageData(pixels.inner as Uint8ClampedArray<ArrayBuffer>, pixels.width, pixels.height), 0, 0)
  const innerUrl = await asDataUrl(await canvas.convertToBlob({ type: 'image/png' }))
  const result = {
    pixels,
    map: { url, maxd: pixels.maxd, inner: { url: innerUrl, maxd: pixels.innerMaxd }, split: pixels.split },
    info: { maxDisplacement: pixels.maxd, bevel: pixels.bevel, mapSize: [pixels.width, pixels.height] as [number, number],
      radii: input.radii, map: url, mapInner: innerUrl, split: pixels.split }
  }
  cache.set(input.key, result)
  if (cache.size > 24) cache.delete(cache.keys().next().value!)
  return result
}
scope.onmessage = ({ data }) => {
  queue = queue.catch(() => {}).then(async () => {
    try {
      // Raster surfaces need only displacement pixels. Encoding two additional
      // SVG map PNGs per shape wastes startup time and cross-thread bandwidth.
      if (data.raster) {
        const { blob, luminance } = await renderGlassRaster(data.input, buildPixels(data.input), data.raster)
        scope.postMessage({ id: data.id, texture: blob, luminance })
        return
      }
      const result = await build(data.input)
      scope.postMessage({ id: data.id, map: result.map, info: result.info })
    }
    catch (error) { scope.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Glass map unavailable' }) }
  })
}
