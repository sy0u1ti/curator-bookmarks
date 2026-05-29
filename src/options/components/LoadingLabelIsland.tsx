import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { DotMatrixLoader } from '../../ui'

export interface LoadingLabelState {
  busy: boolean
  label: string
  loaderClass: string
  variant: 'bar' | 'spiral'
  wrapperClass: string
}

const roots = new WeakMap<Element, Root>()

export function renderLoadingLabelIsland(container: Element, state: LoadingLabelState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(<LoadingLabel state={state} />)
  })
}

function LoadingLabel({ state }: { state: LoadingLabelState }) {
  if (!state.busy) {
    return <>{state.label}</>
  }

  return (
    <span className={state.wrapperClass}>
      <DotMatrixLoader variant={state.variant} className={state.loaderClass} />
      <span>{state.label}</span>
    </span>
  )
}
