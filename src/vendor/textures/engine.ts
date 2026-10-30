// Copyright (c) 2026 Textures (textures.dev). MIT; see ./LICENSE.
// Curator adapter: one bounded, on-demand loop; no ambient animation.
export interface TextureMotionOptions {
  eventTarget?: HTMLElement | Window
  acceptsPointer?: (event: PointerEvent) => boolean
}

interface Pointer {
  x: number
  y: number
  active: number
  reduced: boolean
}

export function getTextureFrameTiming(elapsedMs: number): { steps: number; dt: number } {
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0
    ? Math.min(elapsedMs / 1000, 0.1) : 1 / 60
  const steps = Math.max(1, Math.ceil(elapsed * 60))
  return { steps, dt: elapsed / steps }
}

export function engine(
  root: HTMLElement,
  draw: (pointer: Pointer, dt: number) => boolean | void,
  min: [number, number],
  options: TextureMotionOptions = {}
): () => void {
  const svg = root.querySelector('svg')
  if (!svg) return () => {}

  const target = options.eventTarget ?? root
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const slow = matchMedia('(update: slow)')
  const coarse = matchMedia('(hover: none), (pointer: coarse)')
  let frame = 0
  let last = 0
  let active = 0
  let wanted = 0
  let x = 366
  let y = 258
  let visible = true
  let disposed = false
  let box: { left: number; top: number; scale: number; ox: number; oy: number } | null = null
  root.dataset.textureRunning = 'false'

  const enabled = () => !disposed && visible && !document.hidden &&
    !reduced.matches && !slow.matches && !coarse.matches
  const cancel = () => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    last = 0
    root.dataset.textureRunning = 'false'
  }
  const tick = (now: number) => {
    frame = 0
    if (!enabled()) {
      cancel()
      return
    }
    // Preserve elapsed time on slow frames while keeping each spring step stable.
    const { steps, dt } = getTextureFrameTiming(last ? now - last : 1000 / 60)
    last = now
    let moving: boolean | void = false
    for (let step = 0; step < steps; step++) {
      active += (wanted - active) * (1 - Math.exp(-18 * dt))
      if (Math.abs(wanted - active) < 0.002) active = wanted
      moving = draw({ x, y, active, reduced: false }, dt)
    }
    if (moving || active !== wanted) frame = requestAnimationFrame(tick)
    else cancel()
  }
  const wake = () => {
    if (frame || !enabled()) return
    root.dataset.textureRunning = 'true'
    frame = requestAnimationFrame(tick)
  }
  const settle = () => {
    if (wanted === 0 && active === 0) return
    wanted = 0
    wake()
  }
  const measure = () => {
    const rect = svg.getBoundingClientRect()
    if (rect.width < min[0] || rect.height < min[1]) {
      box = null
      return
    }
    const scale = Math.max(rect.width / 732, rect.height / 516)
    box = {
      left: rect.left, top: rect.top, scale,
      ox: (rect.width - 732 * scale) / 2,
      oy: (rect.height - 516 * scale) / 2
    }
  }
  const move = (event: Event) => {
    const pointer = event as PointerEvent
    if (!enabled() || pointer.pointerType === 'touch' || pointer.buttons ||
      (options.acceptsPointer && !options.acceptsPointer(pointer))) {
      settle()
      return
    }
    if (!box) measure()
    if (!box) return
    x = (pointer.clientX - box.left - box.ox) / box.scale
    y = (pointer.clientY - box.top - box.oy) / box.scale
    wanted = 1
    wake()
  }
  const invalidate = () => {
    box = null
    settle()
  }
  const capabilityChanged = () => {
    wanted = 0
    if (!enabled()) cancel()
    else if (active) wake()
  }
  const observer = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(([entry]) => {
        visible = Boolean(entry?.isIntersecting)
        capabilityChanged()
      })
    : null
  observer?.observe(svg)
  target.addEventListener('pointermove', move, { passive: true })
  target.addEventListener('pointerleave', settle)
  target.addEventListener('pointercancel', settle)
  window.addEventListener('pointerdown', settle, { passive: true })
  window.addEventListener('keydown', settle)
  window.addEventListener('blur', settle)
  window.addEventListener('resize', invalidate, { passive: true })
  document.addEventListener('scroll', invalidate, { capture: true, passive: true })
  document.addEventListener('visibilitychange', capabilityChanged)
  reduced.addEventListener('change', capabilityChanged)
  slow.addEventListener('change', capabilityChanged)
  coarse.addEventListener('change', capabilityChanged)

  return () => {
    disposed = true
    cancel()
    observer?.disconnect()
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerleave', settle)
    target.removeEventListener('pointercancel', settle)
    window.removeEventListener('pointerdown', settle)
    window.removeEventListener('keydown', settle)
    window.removeEventListener('blur', settle)
    window.removeEventListener('resize', invalidate)
    document.removeEventListener('scroll', invalidate, true)
    document.removeEventListener('visibilitychange', capabilityChanged)
    reduced.removeEventListener('change', capabilityChanged)
    slow.removeEventListener('change', capabilityChanged)
    coarse.removeEventListener('change', capabilityChanged)
  }
}
