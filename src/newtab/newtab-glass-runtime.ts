import Hyalite, { type HyaliteMapInput } from '../vendor/hyalite/hyalite.js'
import { getNewtabGlassSettings, subscribeNewtabGlassSettings } from './newtab-glass-settings-store.js'
import { getGlassRefractionOptions, type NewtabGlassSettings } from './glass-settings.js'
import type { GlassMapRequest, GlassMapResponse } from './hyalite-map-worker.js'
import type { GlassRasterInput, GlassRasterScene } from './hyalite-raster.js'
import { getNewtabBackgroundMediaView } from './newtab-background-media-store.js'

export const GLASS_SURFACE_SELECTOR = [
  '.newtab-search-surface', '.newtab-clock', '.newtab-onboarding-strip', '.settings-trigger',
  '.newtab-delete-toast-panel', '.newtab-speed-dial', '.newtab-portal', '.bookmark-tile',
  '.newtab-search-engine-menu', '.featured-wallpaper-panel',
  '.folder-section-header', '.bookmark-breadcrumb-item', '.source-navigation-label',
  '.source-navigation-link', '.folder-section-add', '.bookmark-menu-surface',
  '.settings-drawer-panel', '[data-drawer-content]', '.newtab-glass-preview'
].join(',')
const GHOST_SELECTOR = '.bookmark-drag-ghost,.speed-dial-drag-ghost,.folder-drag-ghost'
const PRIORITY_SELECTOR = '.newtab-search-surface,.newtab-clock,.settings-drawer-panel,[data-drawer-content],.bookmark-menu-surface,.newtab-search-engine-menu,.featured-wallpaper-panel,.newtab-glass-preview'
const MAX_REFRACTING_SURFACES = 48

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
    id: number; input: HyaliteMapInput; raster?: GlassRasterInput; sent: boolean; promise: Promise<Blob | undefined>;
    resolve: (texture?: Blob) => void; reject: (error: Error) => void
  }>()
  prepare(input: HyaliteMapInput, raster?: GlassRasterInput): Promise<Blob | undefined> {
    if (!raster && Hyalite.hasMap(input.key)) return Promise.resolve(undefined)
    const key = input.key + (raster ? '|' + JSON.stringify(raster) + '|' + JSON.stringify(input.options) : '')
    const existing = this.requests.get(key)
    if (existing) return existing.promise
    if (this.failed) return Promise.reject(new Error('Glass worker unavailable'))
    let resolve!: (texture?: Blob) => void, reject!: (error: Error) => void
    const promise = new Promise<Blob | undefined>((yes, no) => { resolve = yes; reject = no })
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
            Hyalite.cacheMap(item.input, data.map, data.info)
            item.resolve(data.texture)
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
  motion: Set<string>
}
let disposeRuntime: (() => void) | null = null

export function startNewtabGlassRuntime(): () => void {
  if (disposeRuntime) return disposeRuntime
  let settings = getNewtabGlassSettings()
  let stopped = false
  let lastInput = 0
  let scrollTimer: ReturnType<typeof setTimeout> | null = null
  let rebalanceTimer: ReturnType<typeof setTimeout> | null = null
  let worker = new MapWorker()
  const surfaces = new Map<HTMLElement, Surface>()
  const app = document.querySelector<HTMLElement>('.newtab-app')
  let scene: GlassRasterScene | null = null
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
    if (JSON.stringify(scene) === JSON.stringify(next)) return
    scene = next
    worker.cancelQueued()
    surfaces.forEach(surface => { fallback(surface); schedule(surface, 80) })
    queueRebalance()
  }

  function fallback(surface: Surface): void {
    surface.element.style.setProperty('--hyalite', 'blur(' + settings.blur + 'px)')
    surface.element.dataset.glassMode = 'frosted'
  }
  function deactivate(surface: Surface): void {
    surface.version++
    if (surface.timer) clearTimeout(surface.timer)
    surface.timer = null
    if (surface.selected) resize.unobserve(surface.element)
    surface.selected = false
    surface.key = ''
    surface.motion.clear()
    if (surface.textureUrl) URL.revokeObjectURL(surface.textureUrl)
    surface.textureUrl = ''
    surface.element.style.removeProperty('--newtab-glass-texture')
    delete surface.element.dataset.glassRenderer
    Hyalite.detach(surface.element)
    fallback(surface)
  }
  function prepare(surface: Surface): void {
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
    if (element.dataset.glassRenderer !== 'raster' || element.dataset.glassMode !== 'refraction') fallback(surface)
    const version = surface.version
    void worker.prepare(input, raster).then(async texture => {
      if (stopped || version !== surface.version || !surface.selected || !enabled() || !element.isConnected) return
      if (!element.matches('.newtab-glass-preview') && performance.now() - lastInput < 100) { schedule(surface, 100); return }
      // Layout may have changed while the Worker was encoding a map.
      const currentSize = Hyalite.sizeOf(element)
      const currentRadii = Hyalite.radiiOf(element, ...currentSize)
      const current = Hyalite.mapInput(...currentSize, currentRadii, getGlassRefractionOptions(settings, ...currentSize, currentRadii))
      if (current.key !== input.key || currentSize[0] !== width || currentSize[1] !== height) { schedule(surface, 120); return }
      if (raster && texture) {
        const url = URL.createObjectURL(texture)
        const decoded = new Image()
        decoded.src = url
        try { await decoded.decode() } catch { URL.revokeObjectURL(url); throw new Error('Glass texture decode failed') }
        if (stopped || version !== surface.version || !surface.selected || !element.isConnected) { URL.revokeObjectURL(url); return }
        const previous = surface.textureUrl
        surface.textureUrl = url
        element.style.setProperty('--newtab-glass-texture', 'url(' + url + ')')
        element.dataset.glassRenderer = 'raster'
        element.dataset.glassBlur = String(options.blur)
        element.dataset.glassOptics = opticsSignature
        element.dataset.glassMode = 'refraction'
        surface.key = renderKey
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
      if (!stopped && version === surface.version) fallback(surface)
    })
  }
  function schedule(surface: Surface, delay = 40): void {
    surface.version++
    if (surface.timer) clearTimeout(surface.timer)
    if (surface.selected) {
      // Hover, focus and search state classes usually leave geometry unchanged.
      // Keep the current lens until prepare confirms that it actually changed.
      surface.timer = setTimeout(() => prepare(surface), delay)
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
    if (!rebalanceTimer) rebalanceTimer = setTimeout(rebalance, 32)
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
    const surface: Surface = { element, visible: false, selected: false, version: 0, timer: null, area: 0, width: 0, height: 0, key: '', textureUrl: '', motion: new Set() }
    surfaces.set(element, surface)
    element.dataset.hyaliteSurface = ''
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

  const settingsChanged = (next: NewtabGlassSettings) => {
    const opticsChanged = JSON.stringify(refractionOptions(settings)) !== JSON.stringify(refractionOptions(next))
    settings = next
    // Tint is a CSS-only change; moving that slider must never rebuild a lens.
    if (!opticsChanged) return
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
    if (scrollTimer) clearTimeout(scrollTimer)
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
    window.removeEventListener('pagehide', dispose)
    disposeRuntime = null
  }
  window.addEventListener('pagehide', dispose)
  disposeRuntime = dispose
  return dispose
}
