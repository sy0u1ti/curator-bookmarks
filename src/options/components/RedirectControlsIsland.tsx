import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { Button } from '../../ui/primitives/Button.js'
import { ThemeProvider } from '../../ui/theme/ThemeProvider.js'
import { dispatchRedirectAction } from './redirect-events.js'

export interface RedirectControlsState {
  count: number
  locked: boolean
  selectedCount: number
  subtitle: string
}

const roots = new WeakMap<Element, Root>()

export function renderRedirectControlsIsland(container: Element, state: RedirectControlsState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <RedirectControls state={state} />
      </ThemeProvider>
    )
  })
}

function RedirectControls({ state }: { state: RedirectControlsState }) {
  const hasResults = state.count > 0
  const hasSelection = state.selectedCount > 0

  return (
    <>
      <div
        id="redirect-selection-group"
        className={['options-group detect-selection-group', hasSelection ? '' : 'hidden'].filter(Boolean).join(' ')}
      >
        <div className="detect-results-header">
          <div>
            <strong id="redirect-selection-count">{state.selectedCount} 条已选择</strong>
            <p className="detect-results-subtitle">可批量更新这些重定向书签为最终地址，或直接批量删除并移入回收站。</p>
          </div>
          <div className="detect-results-actions">
            <Button
              id="redirect-clear-selection"
              className="options-button secondary small"
              size="sm"
              type="button"
              variant="secondary"
              aria-label="清空重定向更新已选书签"
              onClick={() => dispatchRedirectAction('clear-selection')}
            >
              清空选择
            </Button>
            <Button
              id="redirect-batch-update"
              className="options-button small"
              size="sm"
              type="button"
              aria-label="批量更新重定向已选书签为最终 URL"
              disabled={state.locked || !hasSelection}
              focusableWhenDisabled={state.locked}
              onClick={() => dispatchRedirectAction('update-selected')}
            >
              批量更新最终 URL
            </Button>
            <Button
              id="redirect-delete-selection"
              className="options-button danger small"
              size="sm"
              type="button"
              variant="danger"
              aria-label="删除重定向更新已选书签"
              disabled={state.locked || !hasSelection}
              focusableWhenDisabled={state.locked}
              onClick={() => dispatchRedirectAction('delete-selected')}
            >
              删除所选
            </Button>
          </div>
        </div>
      </div>

      <div className="detect-results-header">
        <div>
          <strong>待更新重定向</strong>
          <p id="redirect-results-subtitle" className="detect-results-subtitle">
            {state.subtitle}
          </p>
        </div>
        <div className="detect-results-actions">
          <Button
            id="redirect-select-all"
            className="options-button secondary small"
            size="sm"
            type="button"
            variant="secondary"
            aria-label="全选待更新重定向书签"
            disabled={!hasResults}
            onClick={() => dispatchRedirectAction('select-all')}
          >
            全选本区
          </Button>
          <Button
            id="redirect-delete-all"
            className="options-button danger small"
            size="sm"
            type="button"
            variant="danger"
            aria-label="批量删除待更新重定向书签"
            disabled={state.locked || !hasResults}
            focusableWhenDisabled={state.locked}
            onClick={() => dispatchRedirectAction('delete-all')}
          >
            批量删除本区
          </Button>
          <span id="redirect-count" className="option-value">
            {state.count} 条待更新
          </span>
        </div>
      </div>
    </>
  )
}
