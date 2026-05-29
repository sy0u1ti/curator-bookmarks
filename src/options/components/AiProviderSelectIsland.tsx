import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { Select, ThemeProvider, type SelectOption } from '../../ui'

export interface AiProviderSelectState {
  disabled?: boolean
  key: 'apiStyle'
  label: string
  options: SelectOption[]
  value: string
}

export interface AiProviderSelectChangeDetail {
  key: AiProviderSelectState['key']
  value: string
}

const roots = new WeakMap<Element, Root>()

export function renderAiProviderSelectIsland(container: Element, state: AiProviderSelectState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <AiProviderSelect state={state} />
      </ThemeProvider>
    )
  })
}

function dispatchAiProviderSelectChange(key: AiProviderSelectState['key'], value: string | null) {
  window.dispatchEvent(new CustomEvent<AiProviderSelectChangeDetail>('options:ai-provider-select-change', {
    detail: {
      key,
      value: value || ''
    }
  }))
}

function AiProviderSelect({ state }: { state: AiProviderSelectState }) {
  return (
    <Select
      className="ai-provider-select-control"
      disabled={state.disabled}
      label={state.label}
      options={state.options}
      value={state.value}
      onValueChange={(value) => dispatchAiProviderSelectChange(state.key, value)}
    />
  )
}
