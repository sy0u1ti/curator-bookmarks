export type HoldPhase = 'idle' | 'holding' | 'ready' | 'confirmed'
export const HOLD_CONFIRM_DURATION_MS = 900

export function createHoldConfirmation({
  onChange, onConfirm, durationMs = HOLD_CONFIRM_DURATION_MS,
  schedule = (callback, delay) => setTimeout(callback, delay),
  unschedule = timer => clearTimeout(timer)
}: {
  onChange: (phase: HoldPhase) => void
  onConfirm: () => void
  durationMs?: number
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>
  unschedule?: (timer: ReturnType<typeof setTimeout>) => void
}) {
  let phase: HoldPhase = 'idle'
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  const clearTimer = () => {
    generation += 1
    if (timer !== undefined) unschedule(timer)
    timer = undefined
  }
  const change = (next: HoldPhase) => { phase = next; onChange(next) }
  const cancel = () => {
    clearTimer()
    if (phase !== 'confirmed') change('idle')
  }
  const release = () => {
    clearTimer()
    if (phase !== 'ready') {
      if (phase !== 'confirmed') change('idle')
      return
    }
    change('confirmed')
    onConfirm()
  }
  return {
    start() {
      if (phase !== 'idle') return
      change('holding')
      const current = ++generation
      timer = schedule(() => {
        if (current !== generation || phase !== 'holding') return
        timer = undefined
        change('ready')
      }, durationMs)
    },
    release,
    cancel,
    // Assistive-technology activation needs no timed gesture: arm, then confirm.
    activate() {
      if (phase === 'ready') release()
      else if (phase === 'idle') change('ready')
    },
    dispose() { clearTimer() }
  }
}
