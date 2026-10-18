import Hyalite, { type HyaliteMapInput } from '../vendor/hyalite/hyalite.js'
import { getNewtabGlassSettings, subscribeNewtabGlassSettings } from './newtab-glass-settings-store.js'
import { applyGlassSurfaceTint, getGlassRefractionOptions, type NewtabGlassSettings } from './glass-settings.js'
import type { GlassMapRequest, GlassMapResponse } from './hyalite-map-worker.js'
import type { GlassRasterInput, GlassRasterScene } from './hyalite-raster.js'
import { getNewtabBackgroundMediaView } from './newtab-background-media-store.js'
import {
  finishNewtabGlassStartup,
  isNewtabGlassStartupPending,
  NEWTAB_GLASS_STARTUP_READY_EVENT
} from './newtab-glass-startup.js'
import { glassTextureCacheKey, readGlassTexture, writeGlassTexture, type CachedGlassTexture } from './newtab-glass-cache.js'

// Only static surfaces that sit directly on the wallpaper get a refraction rim.
// The texture is cut from the wallpaper alone, so floating panels (menus, the
// settings drawer, dropdowns, toasts) would show a rim that does not match the
// UI behind them, and the swap from blur to rim was visible on every open.
// Bookmark cards and modules mount, scroll and resize too often to swap
// material without flashing; they use the frost tier in hyalite-glass.css.
export const GLASS_SURFACE_SELECTOR = '.newtab-search-surface,.newtab-clock,.newtab-glass-preview'
const GHOST_SELECTOR = '.bookmark-drag-ghost,.speed-dial-drag-ghost,.folder-drag-ghost'
const PRIORITY_SELECTOR = '.newtab-search-surface,.newtab-clock,.newtab-glass-preview'
const MAX_REFRACTING_SURFACES = 8

function refractionOptions(settings: NewtabGlassSettings) {
  return {
    bevel: settings.bevel, thickness: settings.thickness, blur: settings.blur,
    dispersion: settings.dispersion, rim: settings.rim, light: settings.light, smooth: settings.smooth
  }
}

class MapWorker {
  private worker: Worker | null = null
  private seq = 0
  private failed = false
  private running = false
  private requests = new Map<string, {
    id: number; input: HyaliteMapInput; raster?: GlassRasterInput; sent: boolean; promise: Promise<CachedGlassTexture | undefined>;
    resolve: (texture?: CachedGlassTexture) => void; reject: (error: Error) => void
  }>()
  async prepare(input: HyaliteMapInput, raster?: GlassRasterInput): Promise<CachedGlassTexture | undefined> {
    const key = raster ? await glassTextureCacheKey(input, raster) : null
    const cached = await readGlassTexture(key)
    if (cached) {
      performance.mark('newtab.glassCacheHit')
      return cached
    }
    const texture = await this.render(input, raster)
    if (texture) writeGlassTexture(key, texture.blob, texture.luminance)
    return texture
  }
  private render(input: HyaliteMapInput, raster?: GlassRasterInput): Promise<CachedGlassTexture | undefined> {
    if (!raster && Hyalite.hasMap(input.key)) return Promise.resolve(undefined)
    const key = input.key + (raster ? '|' + JSON.stringify(raster) + '|' + JSON.stringify(input.options) : '')
    const existing = this.requests.get(key)
    if (existing) return existing.promise
    if (this.failed) return Promise.reject(new Error('Glass worker unavailable'))
    let resolve!: (texture?: CachedGlassTexture) => void, reject!: (error: Error) => void
    const promise = new Promise<CachedGlassTexture | undefined>((yes, no) => { resolve = yes; reject = no })
    this.requests.set(key, { id: ++this.seq, input, raster, sent: false, promise, resolve, reject })
    this.pump()
    return promise
  }
  cancelQueued(): void {
    for (const [key, request] of this.requests) if (!request.sent) {
      this.requests.delete(key)
      request.reject(new Error('Superseded glass settings'))
    }
  }
  private pump(): void {
    if (this.running || this.failed) return
    const request = [...this.requests.values()].find(item => !item.sent)
    if (!request) return
    try {
      if (!this.worker) {
        this.worker = new Worker(new URL('./hyalite-map-worker.ts', import.meta.url), { type: 'module', name: 'curator-glass-maps' })
        this.worker.onmessage = ({ data }: MessageEvent<GlassMapResponse>) => {
          const entry = [...this.requests.entries()].find(([, item]) => item.id === data.id)
          if (!entry) return
          const [key, item] = entry
          this.requests.delete(key)
          this.running = false
          if ('error' in data) item.reject(new Error(data.error))
          else {
            if ('map' in data) {
              Hyalite.cacheMap(item.input, data.map, data.info)
              item.resolve(undefined)
            } else {
              item.resolve({ blob: data.texture, luminance: data.luminance })
            }
          }
          this.pump()
        }
        this.worker.onerror = event => { event.preventDefault(); this.fail(new Error(event.message || 'Glass worker failed')) }
      }
      request.sent = true
      this.running = true
      this.worker.postMessage({ id: request.id, input: request.input, raster: request.raster } satisfies GlassMapRequest)
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error('Glass worker unavailable'))
    }
  }
  private fail(error: Error): void {
    this.failed = true
    this.worker?.terminate()
    this.worker = null
    this.running = false
    for (const request of this.requests.values()) request.reject(error)
    this.requests.clear()
  }
  stop(): void { this.fail(new Error('Glass renderer stopped')) }
}

interface Surface {
  element: HTMLElement
  visible: boolean
  selected: boolean
  version: number
  timer: ReturnType<typeof setTimeout> | null
  area: number
  width: number
  height: number
  key: string
  textureUrl: string
  luminance: number | null
  motion: Set<string>
  failed: boolean
  preparing: boolean
  /** Decoded lens held until the startup pass can present every surface at once. */
  prepared: PreparedRefraction | null
}

interface PreparedRefraction {
  blur: number
  luminance: number | null
  opticsSignature: string
  renderKey: string
  url: string
}
let disposeRuntime: (() => void) | null = null

export function startNewtabGlassRuntime(): () => void {
  if (disposeRuntime) return disposeRuntime
  let settings = getNewtabGlassSettings()
  let stopped = false
  let lastInput = 0
  let scrollTimer: ReturnType<typeof setTimeout> | null = null
  let rebalanceTimer: ReturnType<typeof setTimeout> | null = null
  let startupFrame = 0
  let startupStableFrames = 0
  let startupHadContent = false
  // pending: hold decoded lenses for an atomic first commit.
  // committed: refraction is live and later lenses may apply directly.
  // settled: the guard chose the compatible material; late lenses are dropped
  // until the user explicitly changes an optical setting.
  let startupPhase: 'pending' | 'committed' | 'settled' = 'pending'
  let worker = new MapWorker()
  const surfaces = new Map<HTMLElement, Surface>()
  const app = document.querySelector<HTMLElement>('.newtab-app')
  let scene: GlassRasterScene | null = null
  // Video wallpapers cannot feed the static refraction scene, so their tint is
  // driven by a sampled frame instead. It applies to every surface as a
  // fallback until (or unless) a per-surface luminance exists.
  let fallbackLuminance: number | null = null
  let videoSampleTimer: ReturnType<typeof setInterval> | null = null
  let videoSampleCanvas: OffscreenCanvas | null = null
  const forcedColors = matchMedia('(forced-colors: active)')
  // Preserve the explicitly selected New Tab glass, including on systems that
  // reduce transparency by default. Forced colours still use native solids.
  const enabled = () => !document.hidden && !forcedColors.matches && Hyalite.supported()
  function readScene(): GlassRasterScene | null {
    const media = getNewtabBackgroundMediaView()
    if (media.kind !== 'image' || !media.src) return null
    const masked = app?.classList.contains('background-mask-enabled')
    const maskStyle = app?.dataset.backgroundMaskStyle || 'dark'
    if (masked && !['dark', 'light', 'frosted', 'noise'].includes(maskStyle)) return null
    const mask = masked ? document.getElementById('newtab-background-mask') : null
    const maskCss = mask ? getComputedStyle(mask) : null
    return {
      src: media.src, color: app?.style.getPropertyValue('--bg') || '#101013',
      width: innerWidth, height: innerHeight, density: devicePixelRatio || 1,
      size: app?.style.getPropertyValue('--instant-wallpaper-size') || media.backgroundSize,
      position: app?.style.getPropertyValue('--instant-wallpaper-position') || media.backgroundPosition,
      filter: maskCss?.backdropFilter || 'none', veil: maskCss?.backgroundColor || '',
      gradient: maskCss?.backgroundImage || 'none'
    }
  }

  function updateScene(): void {
    if (document.hidden) return
    const next = readScene()
    syncVideoLuminance()
    if (JSON.stringify(scene) === JSON.stringify(next)) return
    scene = next
    worker.cancelQueued()
    surfaces.forEach(surface => {
      // Switching from a URL to its local Blob is common during hydration.
      // Keep the decoded lens until its replacement is ready, instead of
      // stripping the rim for another cache lookup of the same wallpaper.
      if (!scene || !surface.textureUrl) fallback(surface)
      schedule(surface, 80)
    })
    queueRebalance()
  }

  function applySurfaceTints(): void {
    surfaces.forEach(surface => applyGlassSurfaceTint(surface.element, settings.tint, surface.luminance ?? fallbackLuminance))
  }

  /** Average luminance of the current video frame, or null when it cannot be
   * read (cross-origin source, decoder not ready). */
  function sampleVideoLuminance(): number | null {
    const video = document.querySelector<HTMLVideoElement>('video.newtab-background-video')
    if (!video || video.readyState < 2 || !video.videoWidth) return null
    try {
      const canvas = videoSampleCanvas ??= new OffscreenCanvas(32, 18)
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return null
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      let total = 0
      for (let index = 0; index < data.length; index += 4) {
        total += data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722
      }
      return total / (data.length / 4) / 255
    } catch { return null }
  }

  function syncVideoLuminance(): void {
    const videoActive = getNewtabBackgroundMediaView().kind === 'video'
    if (!videoActive) {
      if (videoSampleTimer) { clearInterval(videoSampleTimer); videoSampleTimer = null }
      if (fallbackLuminance !== null) {
        fallbackLuminance = null
        applySurfaceTints()
      }
      return
    }
    const luminance = sampleVideoLuminance()
    if (luminance !== null && Math.abs(luminance - (fallbackLuminance ?? -1)) > 0.01) {
      fallbackLuminance = luminance
      applySurfaceTints()
    }
    if (!videoSampleTimer) {
      videoSampleTimer = setInterval(() => { if (!stopped && !document.hidden) syncVideoLuminance() }, 3000)
    }
  }

  function checkStartup(): void {
    startupFrame = 0
    if (stopped || !isNewtabGlassStartupPending()) return
    updateScene()
    const waitingForMedia = app?.dataset.backgroundMedia === 'true' && getNewtabBackgroundMediaView().kind === 'none'
    const contentReady = Boolean(document.querySelector('.newtab-page, .newtab-state')) &&
      !waitingForMedia && !app?.classList.contains('newtab-booting') && !app?.classList.contains('loading-wallpaper')
    // Content is already painted with the compatible material, so the startup
    // pass only waits for the first viewport's decoded lenses to land together.
    // The bookmark snapshot may still own the grid pixels while font metrics
    // settle; that handoff never gates the lens commit or the page reveal.
    const startupSurfaces = [...surfaces.values()].filter(surface => surface.selected)
    const pending = startupSurfaces.some(surface =>
      surface.timer || surface.preparing || (!surface.failed && !surface.prepared && surface.element.dataset.glassMode !== 'refraction'))
    if (contentReady && !startupHadContent) {
      startupHadContent = true
      performance.mark('newtab.glassContentReady')
    }
    if (contentReady && startupSurfaces.length && !pending && !rebalanceTimer) startupStableFrames++
    else startupStableFrames = 0
    if (startupStableFrames >= 2) {
      commitStartupRefraction()
      return
    }
    startupFrame = requestAnimationFrame(checkStartup)
  }

  function commitStartupRefraction(): void {
    if (startupPhase !== 'pending') return
    // All or nothing: one failed lens keeps the whole first viewport on the
    // compatible material instead of showing a partly refracting shell.
    if ([...surfaces.values()].some(surface => surface.selected && surface.failed)) {
      startupPhase = 'settled'
      surfaces.forEach(releasePreparedRefraction)
      finishNewtabGlassStartup('fallback')
      return
    }
    startupPhase = 'committed'
    surfaces.forEach(surface => {
      const prepared = surface.prepared
      if (!prepared) return
      surface.prepared = null
      applyPreparedLens(surface, prepared)
    })
    finishNewtabGlassStartup('ready')
  }

  // Enable rim cross-fades only after the first committed frame, so startup
  // still lands atomically while every later lens change eases in and out.
  function enableFade(element: HTMLElement): void {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!stopped && element.isConnected) element.dataset.glassFade = ''
    }))
  }

  function applyPreparedLens(surface: Surface, prepared: PreparedRefraction): void {
    const element = surface.element
    const previous = surface.textureUrl
    surface.textureUrl = prepared.url
    surface.luminance = prepared.luminance
    applyGlassSurfaceTint(element, settings.tint, prepared.luminance ?? fallbackLuminance)
    element.style.setProperty('--newtab-glass-texture', 'url(' + prepared.url + ')')
    element.dataset.glassRenderer = 'raster'
    element.dataset.glassBlur = String(prepared.blur)
    element.dataset.glassOptics = prepared.opticsSignature
    element.dataset.glassMode = 'refraction'
    surface.key = prepared.renderKey
    surface.failed = false
    if (previous) URL.revokeObjectURL(previous)
  }

  function fallback(surface: Surface): void {
    surface.element.style.setProperty('--hyalite', 'blur(' + settings.blur + 'px)')
    surface.element.dataset.glassMode = 'frosted'
  }
  function deactivate(surface: Surface): void {
    surface.version++
    if (surface.timer) clearTimeout(surface.timer)
    surface.timer = null
    surface.preparing = false
    releasePreparedRefraction(surface)
    if (surface.selected) resize.unobserve(surface.element)
    surface.selected = false
    surface.key = ''
    surface.luminance = null
    surface.motion.clear()
    if (surface.textureUrl) URL.revokeObjectURL(surface.textureUrl)
    surface.textureUrl = ''
    surface.element.style.removeProperty('--newtab-glass-texture')
    surface.element.style.removeProperty('--newtab-glass-surface-fill')
    delete surface.element.dataset.glassRenderer
    Hyalite.detach(surface.element)
    fallback(surface)
  }
  function releasePreparedRefraction(surface: Surface): void {
    if (!surface.prepared) return
    URL.revokeObjectURL(surface.prepared.url)
    surface.prepared = null
  }
  function prepare(surface: Surface): void {
    surface.timer = null
    if (stopped || !surface.selected || !surface.visible || surface.motion.size || !enabled() || !surface.element.isConnected) return
    // The preview remains live while a slider is dragged; background lenses
    // are prepared during the next pause instead of competing with the input.
    const wait = surface.element.matches('.newtab-glass-preview') ? 0 : 100 - (performance.now() - lastInput)
    if (wait > 0) { surface.timer = setTimeout(() => prepare(surface), wait); return }
    surface.timer = null
    const element = surface.element
    const measuredSize = Hyalite.sizeOf(element)
    // Hyalite's size helper follows the transformed client box. Keep the
    // first layout size for bookmark tiles so a press scale cannot invalidate
    // their cached wallpaper crop (the ResizeObserver still updates these
    // values when the actual layout changes).
    const [width, height] = element.matches('.bookmark-tile') && surface.width >= 4 && surface.height >= 4
      ? [surface.width, surface.height]
      : measuredSize
    if (width < 4 || height < 4) return
    const radii = Hyalite.radiiOf(element, width, height)
    const optics = getGlassRefractionOptions(settings, width, height, radii)
    const opticsSignature = JSON.stringify(refractionOptions(settings))
    const input = Hyalite.mapInput(width, height, radii, optics)
    const options = { ...optics, autoResize: false, requirePreparedMap: true, materialize: 0 }
    const preview = element.matches('.newtab-glass-preview')
    const bounds = element.getBoundingClientRect()
    const raster = !preview && scene ? { scene, rect: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } } : undefined
    if (!preview && !raster) return
    // Bookmark tiles use a cached wallpaper crop while their hover/press
    // transforms run. Their transformed client rect changes by a pixel or two
    // during interaction, but rebuilding a blob texture there makes the glass
    // rim visibly blink. Scroll and scene changes explicitly invalidate the
    // surface key below, so real wallpaper movement still gets a fresh crop.
    const rasterKey = raster && element.matches('.bookmark-tile')
      ? { ...raster, rect: { width, height } }
      : raster
    const renderKey = input.key + '|' + width + 'x' + height + '|' + JSON.stringify(options) + '|' + opticsSignature + '|' + JSON.stringify(rasterKey)
    if (surface.key === renderKey && element.dataset.glassMode === 'refraction') return
    if (isNewtabGlassStartupPending() && surface.prepared?.renderKey === renderKey) return
    if (element.dataset.glassRenderer !== 'raster' || element.dataset.glassMode !== 'refraction') fallback(surface)
    const version = surface.version
    surface.preparing = true
    void worker.prepare(input, raster).then(async prepared => {
      if (stopped || version !== surface.version || !surface.selected || !enabled() || !element.isConnected) return
      if (!element.matches('.newtab-glass-preview') && performance.now() - lastInput < 100) { schedule(surface, 100); return }
      // Layout may have changed while the Worker was encoding a map.
      const currentSize = Hyalite.sizeOf(element)
      const currentRadii = Hyalite.radiiOf(element, ...currentSize)
      const current = Hyalite.mapInput(...currentSize, currentRadii, getGlassRefractionOptions(settings, ...currentSize, currentRadii))
      if (current.key !== input.key || currentSize[0] !== width || currentSize[1] !== height) { schedule(surface, 120); return }
      const texture = prepared?.blob
      if (raster && texture) {
        const url = URL.createObjectURL(texture)
        const decoded = new Image()
        decoded.src = url
        try { await decoded.decode() } catch { URL.revokeObjectURL(url); throw new Error('Glass texture decode failed') }
        if (stopped || version !== surface.version || !surface.selected || !element.isConnected) { URL.revokeObjectURL(url); return }
        if (startupPhase === 'pending') {
          // Present the whole first viewport at once: hold decoded lenses until
          // every selected surface is ready, then commit in one frame.
          if (surface.prepared && surface.prepared.url !== url) URL.revokeObjectURL(surface.prepared.url)
          surface.prepared = {
            blur: options.blur,
            luminance: prepared?.luminance ?? null,
            opticsSignature,
            renderKey,
            url
          }
          return
        }
        // A later lens after the atomic commit, after the guard settled on the
        // compatible material, or after an explicit settings change: apply
        // directly. The fallback stylesheet keeps late rims visually off until
        // the user opts back in, so this only prepares the next explicit change.
        if (surface.prepared) {
          URL.revokeObjectURL(surface.prepared.url)
          surface.prepared = null
        }
        const previous = surface.textureUrl
        surface.textureUrl = url
        surface.luminance = prepared?.luminance ?? null
        applyGlassSurfaceTint(element, settings.tint, surface.luminance ?? fallbackLuminance)
        element.style.setProperty('--newtab-glass-texture', 'url(' + url + ')')
        element.dataset.glassRenderer = 'raster'
        element.dataset.glassBlur = String(options.blur)
        element.dataset.glassOptics = opticsSignature
        element.dataset.glassMode = 'refraction'
        surface.key = renderKey
        surface.failed = false
        if (previous) URL.revokeObjectURL(previous)
        return
      }
      Hyalite.update(element, options)
      element.dataset.glassRenderer = 'svg'
      element.dataset.glassOptics = opticsSignature
      if (element.style.getPropertyValue('--hyalite').startsWith('url(')) {
        surface.key = renderKey
        element.dataset.glassMode = 'refraction'
      }
    }).catch(() => {
      if (!stopped && version === surface.version) {
        surface.failed = true
        if (!surface.textureUrl) fallback(surface)
      }
    }).finally(() => {
      if (version === surface.version) surface.preparing = false
    })
  }
  function schedule(surface: Surface, delay = 40): void {
    surface.version++
    surface.failed = false
    surface.preparing = false
    if (surface.timer) clearTimeout(surface.timer)
    if (surface.selected) {
      // Hover, focus and search state classes usually leave geometry unchanged.
      // Keep the current lens until prepare confirms that it actually changed.
      surface.timer = setTimeout(() => prepare(surface), isNewtabGlassStartupPending() ? 0 : delay)
    }
  }
  function rebalance(): void {
    rebalanceTimer = null
    if (stopped) return
    const candidates = [...surfaces.values()].filter(surface => surface.visible && surface.element.isConnected)
    candidates.sort((a, b) => Number(b.element.matches(PRIORITY_SELECTOR)) - Number(a.element.matches(PRIORITY_SELECTOR)))
    let count = 0
    let pixels = 0
    const areaBudget = Math.max(1_200_000, innerWidth * innerHeight * 1.6)
    for (const surface of candidates) {
      const needsRefraction = Boolean(scene) || surface.element.matches('.newtab-glass-preview')
      const selected = enabled() && needsRefraction && count < MAX_REFRACTING_SURFACES && (pixels + surface.area <= areaBudget || count === 0)
      if (selected) { count++; pixels += surface.area }
      if (surface.selected === selected) continue
      if (!selected) deactivate(surface)
      else {
        surface.selected = true
        resize.observe(surface.element)
        schedule(surface)
      }
    }
    document.documentElement.dataset.hyaliteSurfaces = String(count)
  }
  function queueRebalance(): void {
    if (!rebalanceTimer) rebalanceTimer = setTimeout(rebalance, isNewtabGlassStartupPending() ? 0 : 32)
  }
  const resize = new ResizeObserver(entries => {
    if (document.hidden) return
    for (const entry of entries) {
      const surface = surfaces.get(entry.target as HTMLElement)
      if (surface?.selected) {
        const box = entry.borderBoxSize[0]
        const width = Math.round(box?.inlineSize ?? entry.contentRect.width)
        const height = Math.round(box?.blockSize ?? entry.contentRect.height)
        if (width === surface.width && height === surface.height) continue
        if (surface.key) fallback(surface)
        surface.width = width
        surface.height = height
        surface.area = width * height
        schedule(surface, 140)
      }
    }
    queueRebalance()
  })
  const intersection = new IntersectionObserver(entries => {
    if (document.hidden) return
    for (const entry of entries) {
      const surface = surfaces.get(entry.target as HTMLElement)
      if (!surface) continue
      surface.visible = entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0 && !surface.element.closest('[hidden]')
      surface.area = entry.boundingClientRect.width * entry.boundingClientRect.height
      if (!surface.visible && surface.selected) deactivate(surface)
    }
    queueRebalance()
  }, { rootMargin: '40px', threshold: 0 })

  function register(element: HTMLElement): void {
    if (surfaces.has(element) || element.matches(GHOST_SELECTOR)) return
    const surface: Surface = { element, visible: false, selected: false, version: 0, timer: null, area: 0, width: 0, height: 0, key: '', textureUrl: '', luminance: null, motion: new Set(), failed: false, preparing: false, prepared: null }
    surfaces.set(element, surface)
    element.dataset.hyaliteSurface = ''
    if (!isNewtabGlassStartupPending()) enableFade(element)
    // Hyalite models native corner radii. Do not crop its edge with a second lens shape.
    element.dataset.squircle = 'off'
    if (element.dataset.sq === 'on') { element.style.removeProperty('clip-path'); delete element.dataset.sq }
    fallback(surface)
    intersection.observe(element)
  }
  function inspect(node: Node): void {
    if (document.hidden) return
    if (!(node instanceof HTMLElement)) return
    if (node.matches(GLASS_SURFACE_SELECTOR)) register(node)
    node.querySelectorAll<HTMLElement>(GLASS_SURFACE_SELECTOR).forEach(register)
  }
  function remove(node: Node): void {
    if (!(node instanceof HTMLElement) || node.isConnected) return
    const release = (element: HTMLElement) => {
      const surface = surfaces.get(element)
      if (!surface) return
      deactivate(surface)
      intersection.unobserve(element)
      surfaces.delete(element)
    }
    release(node)
    node.querySelectorAll<HTMLElement>('[data-hyalite-surface]').forEach(release)
  }
  const mutations = new MutationObserver(records => {
    if (document.hidden) return
    for (const record of records) {
      if (record.type === 'childList') {
        record.removedNodes.forEach(remove)
        record.addedNodes.forEach(inspect)
      } else if (record.target instanceof HTMLElement) {
        const element = record.target
        if (element === app) { updateScene(); queueRebalance(); continue }
        const surface = surfaces.get(element)
        if (surface && surface.selected) schedule(surface, 140)
        else if (element.matches(GLASS_SURFACE_SELECTOR)) register(element)
      }
    }
  })
  mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'data-open', 'data-closed', 'data-background-type', 'data-background-media'] })
  inspect(document.body)
  const sceneChanges = new MutationObserver(updateScene)
  if (app) sceneChanges.observe(app, { attributes: true, attributeFilter: ['style', 'data-background-media', 'data-background-mask-style'] })
  sceneChanges.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
  const maskElement = document.getElementById('newtab-background-mask')
  if (maskElement) sceneChanges.observe(maskElement, { attributes: true, attributeFilter: ['style', 'class'] })
  window.addEventListener('resize', updateScene)
  updateScene()
  const releaseUncommittedLenses = () => {
    // The guard settled on the compatible material. Its stylesheet keeps every
    // late rim hidden, so applying the decoded lenses now warms the next
    // explicit optical change instead of throwing the work away.
    if (startupPhase !== 'pending') return
    startupPhase = 'settled'
    surfaces.forEach(surface => {
      const prepared = surface.prepared
      if (!prepared) return
      surface.prepared = null
      applyPreparedLens(surface, prepared)
    })
  }
  const startupFinished = () => {
    releaseUncommittedLenses()
    surfaces.forEach(surface => enableFade(surface.element))
  }
  window.addEventListener(NEWTAB_GLASS_STARTUP_READY_EVENT, startupFinished)
  startupFrame = requestAnimationFrame(checkStartup)

  const settingsChanged = (next: NewtabGlassSettings) => {
    const opticsChanged = JSON.stringify(refractionOptions(settings)) !== JSON.stringify(refractionOptions(next))
    settings = next
    // The adaptive fill follows the tint slider without rebuilding any lens.
    applySurfaceTints()
    // Tint is a CSS-only change; moving that slider must never rebuild a lens.
    if (!opticsChanged) return
    if (document.documentElement.dataset.newtabGlassStartup === 'fallback') {
      document.documentElement.dataset.newtabGlassStartup = 'ready'
    }
    // An explicit optical change is the documented way out of the startup
    // fallback; from here lenses apply as they finish instead of being dropped.
    startupPhase = 'committed'
    worker.cancelQueued()
    if (document.hidden) return
    surfaces.forEach(surface => {
      if (surface.element.dataset.glassRenderer !== 'raster' || surface.element.dataset.glassMode !== 'refraction') fallback(surface)
      schedule(surface, surface.element.matches('.newtab-glass-preview') ? 16 : 100)
    })
  }
  const unsubscribe = subscribeNewtabGlassSettings(settingsChanged)
  const interaction = (event: Event) => {
    if (event.type === 'pointermove' && !(event as PointerEvent).buttons) return
    lastInput = performance.now()
  }
  const motion = (event: TransitionEvent) => {
    if (!(event.target instanceof HTMLElement) || !['transform', 'translate', 'scale', 'opacity'].includes(event.propertyName)) return
    const target = event.target.matches('.newtab-search-shell') ? event.target.querySelector<HTMLElement>('.newtab-search-surface') : event.target
    const surface = target && surfaces.get(target)
    if (!surface) return
    if (event.type === 'transitionrun') surface.motion.add(event.propertyName)
    else surface.motion.delete(event.propertyName)
    if (!surface.motion.size) schedule(surface)
  }
  const activity = () => {
    if (document.hidden) { worker.cancelQueued(); return }
    for (const [element, surface] of surfaces) {
      if (!element.isConnected) { deactivate(surface); surfaces.delete(element) }
    }
    inspect(document.body)
    updateScene()
    resize.disconnect()
    intersection.disconnect()
    surfaces.forEach(surface => {
      intersection.observe(surface.element)
      if (surface.selected) resize.observe(surface.element)
    })
    if (!enabled()) {
      worker.stop()
      worker = new MapWorker()
      surfaces.forEach(deactivate)
    }
    surfaces.forEach(surface => { if (surface.selected) schedule(surface) })
    queueRebalance()
  }
  const scrolled = () => {
    if (scrollTimer) clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => {
      scrollTimer = null
      surfaces.forEach(surface => {
        if (surface.selected && surface.visible) {
          surface.key = ''
          schedule(surface)
        }
      })
    }, 100)
  }
  const interactionEvents = ['pointerdown', 'pointermove', 'keydown', 'input', 'wheel']
  const motionEvents = ['transitionrun', 'transitionend', 'transitioncancel'] as const
  for (const event of interactionEvents) document.addEventListener(event, interaction, { passive: true, capture: true })
  for (const event of motionEvents) document.addEventListener(event, motion, true)
  document.addEventListener('visibilitychange', activity)
  document.addEventListener('scroll', scrolled, { passive: true, capture: true })
  forcedColors.addEventListener('change', activity)

  const dispose = () => {
    if (stopped) return
    stopped = true
    unsubscribe()
    mutations.disconnect()
    sceneChanges.disconnect()
    intersection.disconnect()
    resize.disconnect()
    if (rebalanceTimer) clearTimeout(rebalanceTimer)
    if (startupFrame) cancelAnimationFrame(startupFrame)
    if (scrollTimer) clearTimeout(scrollTimer)
    if (videoSampleTimer) { clearInterval(videoSampleTimer); videoSampleTimer = null }
    surfaces.forEach(surface => {
      deactivate(surface)
    })
    surfaces.clear()
    worker.stop()
    for (const event of interactionEvents) document.removeEventListener(event, interaction, true)
    for (const event of motionEvents) document.removeEventListener(event, motion, true)
    document.removeEventListener('visibilitychange', activity)
    document.removeEventListener('scroll', scrolled, true)
    forcedColors.removeEventListener('change', activity)
    window.removeEventListener('resize', updateScene)
    window.removeEventListener(NEWTAB_GLASS_STARTUP_READY_EVENT, startupFinished)
    window.removeEventListener('pagehide', dispose)
    disposeRuntime = null
  }
  window.addEventListener('pagehide', dispose)
  disposeRuntime = dispose
  return dispose
}
