// The same user-tuned curve as .popup-active-result-indicator.
export const POPUP_SELECTION_MOVE_MS = 100
export const POPUP_SELECTION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const REPEAT_FRAME_OVERLAP_MS = 1000 / 60

export type PopupScrollPhase = 'dock' | 'step'

export interface PopupScrollPort {
  read: () => number
  write: (top: number) => void
  place: (offset: number) => void
  animate: (offset: number, duration: number, start: number, phase: PopupScrollPhase, base: number) => { cancel: () => void }
  rebaseDistance?: number
  now?: () => number
}

export function createPopupScrollFollow(port: PopupScrollPort) {
  let target = 0
  let written = 0
  let requestedAt: number | null = null
  let interval = 1000 / 30
  let offset = 0
  let started = 0
  let duration = 0
  let animation: { cancel: () => void } | null = null
  let dockOffset = 0
  let dockStarted = 0
  let dockAnimation: { cancel: () => void } | null = null
  const now = port.now || (() => performance.now())
  const offsetAt = (time: number) => duration > 0 ? offset * Math.max(0, 1 - (time - started) / duration) : 0
  const dockOffsetAt = (time: number) => dockOffset *
    (1 - selectionProgress((time - dockStarted) / POPUP_SELECTION_MOVE_MS))
  const visualOffsetAt = (time: number) => offsetAt(time) + dockOffsetAt(time)

  const cancel = (preservePosition = true) => {
    const visible = target - visualOffsetAt(now())
    animation?.cancel()
    dockAnimation?.cancel()
    animation = null
    dockAnimation = null
    offset = duration = dockOffset = 0
    requestedAt = null
    port.place(0)
    if (preservePosition && Math.abs(visible - written) > 0.5) {
      written = Math.max(0, Math.round(visible))
      port.write(written)
    }
    target = written
  }

  return {
    moveTo(top: number, follow: boolean, dock = false) {
      if (!Number.isFinite(top)) return
      const destination = Math.max(0, Math.round(top))
      if (!follow) {
        cancel(false)
        target = written = destination
        port.write(destination)
        return
      }
      if (dock) {
        const time = now()
        const current = requestedAt === null ? port.read() : target - visualOffsetAt(time)
        cancel(false)
        dockOffset = destination - current
        dockStarted = time
        requestedAt = time
        interval = 1000 / 30
        target = written = destination
        port.write(destination)
        // Docking and the incoming row cadence have independent clocks. A new
        // repeat must not restart the visible journey from the middle to an edge.
        dockAnimation = Math.abs(dockOffset) > 0.01
          ? port.animate(dockOffset, POPUP_SELECTION_MOVE_MS, time, 'dock', 0) : null
        return
      }
      if (requestedAt !== null && destination === target) return
      const time = now()
      const remaining = offsetAt(time)
      let distance = Math.abs(destination - target)
      if (requestedAt !== null) {
        const cadence = time - requestedAt
        if (cadence >= 12 && cadence <= 100) interval += (cadence - interval) * 0.2
      } else {
        written = target = port.read()
        distance = Math.abs(destination - written)
        interval = 1000 / 30
      }
      offset = remaining + destination - target
      started = time
      // Keep a small overlap for OS repeat jitter. Carried distance restores
      // steady velocity, while the final tail remains below the tap's 100ms.
      duration = Math.min(POPUP_SELECTION_MOVE_MS, Math.max(
        interval + REPEAT_FRAME_OVERLAP_MS,
        Math.abs(offset) / Math.max(0.01, distance / interval)
      ))
      animation?.cancel()
      target = destination
      requestedAt = time
      // Move continuously on the bounded row layer. Rebase native scrolling
      // only when its buffer is used, instead of forcing layout on every key.
      if (Math.abs(destination - written) >= (port.rebaseDistance || 0)) {
        written = destination
        port.write(destination)
      }
      const base = written - target
      port.place(base)
      animation = Math.abs(offset) > 0.01 ? port.animate(offset, duration, started, 'step', base) : null
    },
    observe(top: number) {
      if (Math.abs(top - written) > 1) {
        cancel(false)
        written = target = top
        return false
      }
      return true
    },
    cancel,
    get active() {
      return (animation !== null && now() < started + duration) ||
        (dockAnimation !== null && now() < dockStarted + POPUP_SELECTION_MOVE_MS)
    },
    get position() { return written },
    get visualPosition() { return target - visualOffsetAt(now()) }
  }
}

function selectionProgress(progress: number): number {
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  // Invert the cubic's time axis for interruption math only; WAAPI paints it.
  let t = progress
  for (let iteration = 0; iteration < 6; iteration++) {
    const u = 1 - t
    const x = 3 * u * u * t * 0.22 + 3 * u * t * t * 0.36 + t * t * t
    const slope = 3 * u * u * 0.22 + 6 * u * t * (0.36 - 0.22) + 3 * t * t * (1 - 0.36)
    t = Math.min(1, Math.max(0, t - (x - progress) / slope))
  }
  return 1 - (1 - t) ** 3
}
