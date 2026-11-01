let owners = 0
let dispose: (() => void) | undefined

export function observeMotionPreferences(): () => void {
  if (owners++ === 0) {
    const root = document.documentElement
    const updateActivity = () => root.toggleAttribute('data-motion-paused', document.hidden)
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
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('pointermove', onPointerMove, { passive: true })
    dispose = () => {
      document.removeEventListener('visibilitychange', updateActivity)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('pointermove', onPointerMove)
      root.removeAttribute('data-motion-paused')
      delete root.dataset.motionInput
    }
  }
  return () => {
    if (--owners === 0) {
      dispose?.()
      dispose = undefined
    }
  }
}
