import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Only one readable/interactive layer exists. A new request replaces the
 * pending destination; it never queues an animation or replays progress. */
export function PopupActivityTransition({ identity, children, onSettle }: {
  identity: string
  children: ReactNode
  onSettle?: () => void
}) {
  const [shown, setShown] = useState(identity)
  const [phase, setPhase] = useState<'idle' | 'out' | 'in'>('idle')
  const frame = useRef<HTMLDivElement>(null)
  const destination = useRef({ identity, children })
  const visible = useRef(children)
  destination.current = { identity, children }
  if (shown === identity) visible.current = children

  const commit = () => {
    visible.current = destination.current.children
    setShown(destination.current.identity)
    setPhase('in')
  }

  useLayoutEffect(() => {
    if (identity === shown) {
      if (phase === 'out') setPhase('idle')
      return
    }
    if (document.documentElement.dataset.motionInput === 'keyboard' ||
        matchMedia('(prefers-reduced-motion: reduce)').matches) {
      visible.current = destination.current.children
      setShown(identity)
      setPhase('idle')
      return
    }
    setPhase('out')
    // Read the actual CSS duration, including surface/user overrides. The
    // fallback also completes if a tab is hidden and transitionend is omitted.
    const css = frame.current ? getComputedStyle(frame.current) : null
    const seconds = Math.max(0, ...(css?.transitionDuration || '0s').split(',').map(value => parseFloat(value)))
    const timer = setTimeout(commit, seconds * 1000 + 32)
    return () => clearTimeout(timer)
  }, [identity, shown])

  useLayoutEffect(() => {
    if (phase === 'idle') onSettle?.()
    if (phase !== 'in') return
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPhase('idle'))
    })
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [phase])

  return (
    <div
      ref={frame}
      className="popup-activity-transition"
      data-phase={phase}
      inert={phase !== 'idle'}
      aria-hidden={phase !== 'idle' || undefined}
      onTransitionEnd={event => {
        if (event.target === event.currentTarget && event.propertyName === 'opacity' && phase === 'out') commit()
      }}
    >
      {visible.current}
    </div>
  )
}
