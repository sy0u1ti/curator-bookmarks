import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'

export interface DoubleConfirmLabelState {
  confirm: boolean
  confirmLabel: string
  label: string
}

const roots = new WeakMap<Element, Root>()

export function renderDoubleConfirmLabelIsland(container: Element, state: DoubleConfirmLabelState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(<DoubleConfirmLabel state={state} />)
  })
}

function DoubleConfirmLabel({ state }: { state: DoubleConfirmLabelState }) {
  if (!state.confirm) {
    return <>{state.label}</>
  }

  return (
    <>
      <span className="double-confirm-icon" aria-hidden="true">{'\u2713\u2713'}</span> {state.confirmLabel}
    </>
  )
}
