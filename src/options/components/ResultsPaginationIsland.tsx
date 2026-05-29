import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { Button, ThemeProvider } from '../../ui'

export interface ResultsPaginationState {
  kind: string
  label: string
  page: number
  totalPages: number
  start: number
  end: number
  totalCount: number
}

const roots = new WeakMap<Element, Root>()

export function renderResultsPaginationIsland(
  container: Element,
  state: ResultsPaginationState | null
): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  container.classList.toggle('hidden', !state || state.totalPages <= 1)

  flushSync(() => {
    root.render(
      <ThemeProvider>
        {state && state.totalPages > 1 ? <ResultsPagination state={state} /> : null}
      </ThemeProvider>
    )
  })
}

function ResultsPagination({ state }: { state: ResultsPaginationState }) {
  return (
    <>
      <span className="results-pagination-label">
        {state.label} {state.start}-{state.end} / {state.totalCount}
      </span>
      <Button
        className="options-button secondary small"
        type="button"
        data-results-page={state.kind}
        data-page-direction="prev"
        disabled={state.page <= 1}
        unstyled
      >
        上一页
      </Button>
      <span className="option-value">
        {state.page} / {state.totalPages}
      </span>
      <Button
        className="options-button secondary small"
        type="button"
        data-results-page={state.kind}
        data-page-direction="next"
        disabled={state.page >= state.totalPages}
        unstyled
      >
        下一页
      </Button>
    </>
  )
}
