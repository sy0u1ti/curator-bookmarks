import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { Button } from '../../ui/primitives/Button.js'
import { ThemeProvider } from '../../ui/theme/ThemeProvider.js'
import { dispatchRecycleAction } from './recycle-events.js'

export interface RecycleControlsState {
  busy: boolean
  entryCount: number
  selectedCount: number
}

const roots = new WeakMap<Element, Root>()

export function renderRecycleControlsIsland(container: Element, state: RecycleControlsState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <RecycleControls state={state} />
      </ThemeProvider>
    )
  })
}

function RecycleControls({ state }: { state: RecycleControlsState }) {
  const hasEntries = state.entryCount > 0
  const hasSelection = state.selectedCount > 0

  return (
    <>
      <div
        id="recycle-selection-group"
        className={['options-group detect-selection-group', hasSelection ? '' : 'hidden'].filter(Boolean).join(' ')}
      >
        <div className="detect-results-header">
          <div>
            <strong id="recycle-selection-count">{state.selectedCount} 条已选择</strong>
            <p className="detect-results-subtitle">可批量恢复选中的回收站书签，也可只清除回收站记录。</p>
          </div>
          <div className="detect-results-actions">
            <Button
              id="recycle-clear-selection"
              className="options-button secondary small"
              size="sm"
              type="button"
              variant="secondary"
              aria-label="清空回收站已选书签"
              onClick={() => dispatchRecycleAction('clear-selection')}
            >
              清空选择
            </Button>
            <Button
              id="recycle-restore-selection"
              className="options-button small"
              size="sm"
              type="button"
              aria-label="批量恢复回收站已选书签"
              disabled={state.busy || !hasSelection}
              focusableWhenDisabled={state.busy}
              onClick={() => dispatchRecycleAction('restore-selected')}
            >
              批量恢复
            </Button>
            <Button
              id="recycle-clear-selected"
              className="options-button danger small"
              size="sm"
              type="button"
              variant="danger"
              aria-label="清除回收站已选记录"
              disabled={state.busy || !hasSelection}
              focusableWhenDisabled={state.busy}
              onClick={() => dispatchRecycleAction('clear-selected')}
            >
              清除所选
            </Button>
          </div>
        </div>
      </div>

      <div className="detect-results-header">
        <div>
          <strong>回收站条目</strong>
          <p id="recycle-results-subtitle" className="detect-results-subtitle">
            恢复时会优先尝试放回原文件夹；若原文件夹已不存在，则回到书签栏。
          </p>
        </div>
        <div className="detect-results-actions">
          <Button
            id="recycle-select-all"
            className="options-button secondary small"
            size="sm"
            type="button"
            variant="secondary"
            aria-label="全选回收站条目"
            disabled={!hasEntries}
            onClick={() => dispatchRecycleAction('select-all')}
          >
            全选本区
          </Button>
          <Button
            id="recycle-clear-all"
            className="options-button danger small"
            size="sm"
            type="button"
            variant="danger"
            aria-label="清空全部回收站记录"
            disabled={!hasEntries || state.busy}
            focusableWhenDisabled={state.busy}
            onClick={() => dispatchRecycleAction('clear-all')}
          >
            清空回收站
          </Button>
          <span id="recycle-count" className="option-value">
            {state.entryCount} 条回收站条目
          </span>
        </div>
      </div>
    </>
  )
}
