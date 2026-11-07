import { observeAmbientMotion } from './ambient-motion'

let owners = 0
let dispose: (() => void) | undefined

export function observeMotionPreferences(): () => void {
  if (owners++ === 0) {
    const root = document.documentElement
    const ambient = observeAmbientMotion()
    const updateActivity = () => {
      root.toggleAttribute('data-motion-paused', document.hidden || !document.hasFocus())
      ambient.sync()
    }
    const setInput = (input: 'keyboard' | 'pointer') => {
      if (root.dataset.motionInput !== input) root.dataset.motionInput = input
    }
    const onKey = (event: KeyboardEvent) => {
      if (!['Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) setInput('keyboard')
    }
    const onPointer = () => setInput('pointer')
    const onPointerMove = (event: PointerEvent) => {
      if (event.movementX || event.movementY) onPointer()
    }
    updateActivity()
    document.addEventListener('visibilitychange', updateActivity)
    window.addEventListener('focus', updateActivity)
    window.addEventListener('blur', updateActivity)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('pointermove', onPointerMove, { passive: true })
    dispose = () => {
      document.removeEventListener('visibilitychange', updateActivity)
      window.removeEventListener('focus', updateActivity)
      window.removeEventListener('blur', updateActivity)
      ambient.dispose()
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('pointermove', onPointerMove)
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
