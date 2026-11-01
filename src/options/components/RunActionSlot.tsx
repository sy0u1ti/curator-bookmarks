import { useLayoutEffect, useRef, type ReactNode } from 'react'

/** Start and in-progress controls share one row, without an empty reserved row. */
export function RunActionSlot({ active, primary, children }: {
  active: boolean
  primary: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = ref.current
    const focused = document.activeElement
    if (root?.contains(focused) && focused?.closest('[aria-hidden="true"]')) {
      root.querySelector<HTMLButtonElement>('[aria-hidden="false"] button:not(:disabled)')?.focus({ preventScroll: true })
    }
  }, [active])

  return (
    <div className="options-run-action-slot" ref={ref}>
      <div className={active ? 'invisible' : undefined} aria-hidden={active}>{primary}</div>
      <div className={active ? 'options-run-secondary-actions' : 'options-run-secondary-actions invisible'} aria-hidden={!active}>
        {children}
      </div>
    </div>
  )
}
