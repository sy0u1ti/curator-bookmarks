import { observeAmbientMotion } from './ambient-motion'

interface RecordedPointerAnchor {
  x: number
  y: number
  timestamp: number
}

let owners = 0
let dispose: (() => void) | undefined
let lastPointerAnchor: RecordedPointerAnchor | null = null

export function getRecentPointerAnchor(maxAgeMs = 1200): { x: number; y: number } | null {
  if (!lastPointerAnchor) return null
  if (Date.now() - lastPointerAnchor.timestamp > maxAgeMs) return null
  return { x: lastPointerAnchor.x, y: lastPointerAnchor.y }
}

export function observeMotionPreferences(): () => void {
  if (owners++ === 0) {
    const root = document.documentElement
    const ambient = observeAmbientMotion()
    const updateActivity = () => {
      root.toggleAttribute('data-motion-paused', document.hidden || !document.hasFocus())
      ambient.sync()
    }
    let pointerMoveBound = false
    const syncPointerMoveListener = (shouldBind: boolean) => {
      if (shouldBind === pointerMoveBound) return
      pointerMoveBound = shouldBind
      if (shouldBind) {
        document.addEventListener('pointermove', onPointerMove, { passive: true })
      } else {
        document.removeEventListener('pointermove', onPointerMove)
      }
    }
    const setInput = (input: 'keyboard' | 'pointer') => {
      if (root.dataset.motionInput !== input) root.dataset.motionInput = input
      syncPointerMoveListener(input === 'keyboard')
    }
    const onKey = (event: KeyboardEvent) => {
      if (!['Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) {
        lastPointerAnchor = null
        setInput('keyboard')
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      setInput('pointer')
      if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        lastPointerAnchor = { x: event.clientX, y: event.clientY, timestamp: Date.now() }
      }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.movementX || event.movementY) setInput('pointer')
    }
    updateActivity()
    document.addEventListener('visibilitychange', updateActivity)
    window.addEventListener('focus', updateActivity)
    window.addEventListener('blur', updateActivity)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    dispose = () => {
      document.removeEventListener('visibilitychange', updateActivity)
      window.removeEventListener('focus', updateActivity)
      window.removeEventListener('blur', updateActivity)
      ambient.dispose()
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      syncPointerMoveListener(false)
      lastPointerAnchor = null
      root.removeAttribute('data-motion-paused')
      delete root.dataset.motionInput
    }
  }
  let released = false
  return () => {
    if (released) return
    released = true
    if (--owners === 0) {
      dispose?.()
      dispose = undefined
    }
  }
}
