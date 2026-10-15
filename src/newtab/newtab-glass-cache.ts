import type { HyaliteMapInput } from '../vendor/hyalite/hyalite.js'
import type { GlassRasterInput } from './hyalite-raster.js'

const CACHE_NAME = 'curator-glass-textures-v1'
const LUMA_HEADER = 'x-curator-luma'
// A reload transiently stages the remote URL and then the cached local Blob as
// two scenes. Keep both variants plus recent edits so the second scene still
// hits instead of evicting the entries it is about to read.
const MAX_ENTRIES = 192
const MAX_TEXTURE_BYTES = 512 * 1024
const MAX_AGE_MS = 24 * 60 * 60 * 1000
let cache: Promise<Cache | null> | undefined
let writes: Promise<void> = Promise.resolve()
const sources = new Map<string, Promise<string>>()

function openCache(): Promise<Cache | null> {
  return cache ??= caches.open(CACHE_NAME).catch(() => null)
}

async function digest(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
}

function sourceIdentity(src: string): Promise<string> {
  let identity = sources.get(src)
  if (!identity) {
    // Local wallpapers get a new object URL in every tab. Hash their bytes,
    // once per scene, so a reload can reuse the exact same refracted pixels.
    identity = src.startsWith('blob:')
      ? fetch(src).then(response => response.arrayBuffer()).then(digest)
      : digest(src)
    sources.set(src, identity)
    if (sources.size > 4) sources.delete(sources.keys().next().value!)
  }
  return identity
}

export async function glassTextureCacheKey(input: HyaliteMapInput, raster: GlassRasterInput): Promise<string | null> {
  try {
    const src = await sourceIdentity(raster.scene.src)
    const hash = await digest(JSON.stringify([input, { ...raster, scene: { ...raster.scene, src } }]))
    return `https://curator.invalid/glass/${hash}`
  } catch { return null }
}

export interface CachedGlassTexture {
  blob: Blob
  luminance: number | null
}

export async function readGlassTexture(key: string | null): Promise<CachedGlassTexture | undefined> {
  if (!key) return undefined
  try {
    const response = await (await openCache())?.match(key)
    if (!response || Date.now() - Number(response.headers.get('x-curator-created')) > MAX_AGE_MS) return undefined
    const blob = await response.blob()
    if (blob.type !== 'image/png' || blob.size <= 0 || blob.size > MAX_TEXTURE_BYTES) return undefined
    const luminance = Number(response.headers.get(LUMA_HEADER))
    return { blob, luminance: Number.isFinite(luminance) ? luminance : null }
  } catch { return undefined }
}

export function writeGlassTexture(key: string | null, blob: Blob, luminance: number | null): void {
  if (!key || blob.size > MAX_TEXTURE_BYTES) return
  // Cache writes and eviction are off the presentation path. A quota failure
  // simply uses the renderer next time; no preference or user media is evicted.
  writes = writes.then(async () => {
    const target = await openCache()
    if (!target) return
    const headers: Record<string, string> = { 'x-curator-created': String(Date.now()) }
    if (typeof luminance === 'number' && Number.isFinite(luminance)) headers[LUMA_HEADER] = String(luminance)
    await target.put(key, new Response(blob, { headers }))
    const keys = await target.keys()
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map(key => target.delete(key)))
  }).catch(() => {})
}
