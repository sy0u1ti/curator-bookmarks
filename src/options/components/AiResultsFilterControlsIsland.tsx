import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { Select, ThemeProvider, type SelectOption } from '../../ui'

export interface AiResultsFilterControlsState {
  confidence: string
  status: string
}

export interface AiResultsFilterChangeDetail {
  key: 'confidence' | 'status'
  value: string
}

const roots = new WeakMap<Element, Root>()

const statusOptions: SelectOption[] = [
  { value: 'all', label: '全部状态' },
  { value: 'suggested', label: '只看建议改名' },
  { value: 'changed', label: '只看标题变化大' },
  { value: 'manual_review', label: '只看待人工确认' },
  { value: 'failed', label: '只看失败' }
]

const confidenceOptions: SelectOption[] = [
  { value: 'all', label: '全部置信度' },
  { value: 'high', label: '只看高置信' },
  { value: 'medium', label: '只看中置信' },
  { value: 'low', label: '只看低置信' }
]

export function renderAiResultsFilterControlsIsland(
  container: Element,
  state: AiResultsFilterControlsState
): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <AiResultsFilterControls state={state} />
      </ThemeProvider>
    )
  })
}

function dispatchAiResultsFilterChange(key: AiResultsFilterChangeDetail['key'], value: string | null) {
  window.dispatchEvent(new CustomEvent<AiResultsFilterChangeDetail>('options:ai-results-filter-change', {
    detail: {
      key,
      value: value || 'all'
    }
  }))
}

function AiResultsFilterControls({ state }: { state: AiResultsFilterControlsState }) {
  return (
    <>
      <Select
        className="ai-results-filter-select ai-results-filter-select-status"
        label="按状态筛选书签智能分析结果"
        options={statusOptions}
        value={state.status}
        onValueChange={(value) => dispatchAiResultsFilterChange('status', value)}
      />
      <Select
        className="ai-results-filter-select ai-results-filter-select-confidence"
        label="按置信度筛选书签智能分析结果"
        options={confidenceOptions}
        value={state.confidence}
        onValueChange={(value) => dispatchAiResultsFilterChange('confidence', value)}
      />
    </>
  )
}
