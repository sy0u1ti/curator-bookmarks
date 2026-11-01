import { getMotionSpring, shouldSkipMotion } from '../shared/motion'
import { advanceSpring, springSettled, type SpringAxis } from '../shared/motion-spring'

type Rect = { x: number; y: number; width: number; height: number }
const axes = ['x', 'y', 'width', 'height'] as const

export function attachSidebarMotion(sidebar: HTMLElement, indicator: HTMLElement) {
  const spring = getMotionSpring(sidebar)
  const position = Object.fromEntries(axes.map(key => [key, { position: 0, velocity: 0 }])) as Record<keyof Rect, SpringAxis>
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  let row: HTMLElement | null = null
  let frame = 0
  let previousTime = 0
  let placed = false
  let readyFrame = 0
  const sublists = [...sidebar.querySelectorAll<HTMLElement>('.options-nav-sublist')].map(list => ({
    list,
    indicator: list.querySelector<HTMLElement>(':scope > .options-nav-sub-indicator')!,
    row: null as HTMLElement | null,
    readyFrame: 0
  }))

  const geometry = (target: HTMLElement, host = sidebar): Rect | null => {
    const panel = target.closest('.t-acc-panel')
    if (panel && (!panel.hasAttribute('data-open') || panel.hasAttribute('data-ending-style'))) return null
    const outer = host.getBoundingClientRect()
    const inner = target.getBoundingClientRect()
    if (!inner.width || !inner.height) return null
    return {
      x: inner.left - outer.left + host.scrollLeft - host.clientLeft,
      y: inner.top - outer.top + host.scrollTop - host.clientTop,
      width: inner.width,
      height: inner.height
    }
  }

  const paint = () => {
    indicator.style.transform = `translate3d(${position.x.position}px, ${position.y.position}px, 0)`
    indicator.style.width = `${position.width.position}px`
    indicator.style.height = `${position.height.position}px`
  }

  const positionSublists = (instant = false) => {
    for (const sub of sublists) {
      const next = sub.list.querySelector<HTMLElement>(':scope > .options-nav-link[aria-current="page"]')
      const rect = next ? geometry(next, sub.list) : null
      if (!rect) {
        sub.indicator.hidden = true
        sub.row = null
        cancelAnimationFrame(sub.readyFrame)
        sub.readyFrame = 0
        delete sub.indicator.dataset.ready
        continue
      }
      if (instant || !sub.row || shouldSkipMotion()) delete sub.indicator.dataset.ready
      sub.indicator.hidden = false
      sub.indicator.style.transform = `translate3d(${rect.x}px, ${rect.y}px, 0)`
      sub.indicator.style.width = `${rect.width}px`
      sub.indicator.style.height = `${rect.height}px`
      sub.row = next
      if (!sub.indicator.dataset.ready && !sub.readyFrame) {
        sub.readyFrame = requestAnimationFrame(() => {
          sub.indicator.dataset.ready = 'true'
          sub.readyFrame = 0
        })
      }
    }
  }

  const stop = () => {
    cancelAnimationFrame(frame)
    frame = 0
    delete indicator.dataset.moving
  }

  const put = (rect: Rect) => {
    for (const key of axes) Object.assign(position[key], { position: rect[key], velocity: 0 })
    paint()
    stop()
  }

  const folding = () => [...sidebar.querySelectorAll('.t-acc-panel')].some(panel =>
    panel.getAnimations().some(animation =>
      (animation as CSSTransition).transitionProperty === 'grid-template-rows' && animation.playState === 'running'
    )
  )

  const step = (now: number) => {
    frame = 0
    const rect = row?.isConnected ? geometry(row) : null
    if (!rect) {
      indicator.hidden = true
      placed = false
      stop()
      return
    }
    if (shouldSkipMotion() || document.hidden) {
      put(rect)
      return
    }
    const elapsed = (now - previousTime) / 1000
    previousTime = now
    for (const key of axes) advanceSpring(position[key], rect[key], elapsed, spring)
    if (axes.every(key => springSettled(position[key], rect[key])) && !folding()) {
      put(rect)
      return
    }
    paint()
    frame = requestAnimationFrame(step)
  }

  const go = () => {
    if (frame) return
    indicator.dataset.moving = 'true'
    previousTime = performance.now()
    frame = requestAnimationFrame(step)
  }

  const sync = (instant = false) => {
    positionSublists(instant)
    // The main spring stays on the active parent. Its child has a separate,
    // locally clipped indicator, just like Magpie's nav-top-hl and nav-hl.
    const next = sidebar.querySelector<HTMLElement>('.options-nav-trigger[data-active]') ??
      sidebar.querySelector<HTMLElement>('.options-nav-link[aria-current="page"][data-nav-level="primary"]')
    const changed = next !== row
    row = next
    const rect = next ? geometry(next) : null
    if (!rect) {
      indicator.hidden = true
      placed = false
      stop()
      return
    }
    indicator.hidden = false
    indicator.style.opacity = '1'
    if (instant || !placed || shouldSkipMotion() || document.hidden ||
      (!changed && !frame && !folding())) {
      put(rect)
    } else {
      // A new target keeps every axis's velocity, including a mid-fold reversal.
      go()
    }
    placed = true
    indicator.dataset.ready = 'true'
  }

  const onLayout = () => {
    positionSublists(true)
    if (!frame) sync()
  }
  const onInstant = () => sync(true)
  const onKey = (event: KeyboardEvent) => {
    if (!['Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) onInstant()
  }
  const observer = new ResizeObserver(onLayout)
  observer.observe(sidebar)
  sidebar.querySelectorAll('.t-acc-panel, .options-nav-link, .options-nav-trigger').forEach(element => observer.observe(element))
  sidebar.addEventListener('scroll', onLayout, { passive: true })
  document.addEventListener('keydown', onKey, true)
  document.addEventListener('visibilitychange', onInstant)
  reduce.addEventListener('change', onInstant)
  sync(true)
  // Expanded navigation on first paint is already in place, never an entrance.
  readyFrame = requestAnimationFrame(() => {
    readyFrame = requestAnimationFrame(() => { sidebar.dataset.motionReady = 'true' })
  })

  return {
    sync,
    dispose() {
      stop()
      cancelAnimationFrame(readyFrame)
      observer.disconnect()
      sidebar.removeEventListener('scroll', onLayout)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('visibilitychange', onInstant)
      reduce.removeEventListener('change', onInstant)
      for (const sub of sublists) {
        cancelAnimationFrame(sub.readyFrame)
        sub.indicator.hidden = true
        delete sub.indicator.dataset.ready
      }
      indicator.hidden = true
      delete indicator.dataset.ready
      delete sidebar.dataset.motionReady
    }
  }
}
