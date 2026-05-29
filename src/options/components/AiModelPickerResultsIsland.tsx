import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { AiModelOptionCard, ThemeProvider } from '../../ui'

export interface AiModelPickerResultsState {
  activeId: string
  currentModel: string
  customModels: string[]
  emptyMessage: string
  fetchedModels: string[]
  models: string[]
  presetModels: string[]
}

const roots = new WeakMap<Element, Root>()

export function renderAiModelPickerResultsIsland(
  container: Element,
  state: AiModelPickerResultsState
): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <AiModelPickerResults state={state} />
      </ThemeProvider>
    )
  })
}

function AiModelPickerResults({ state }: { state: AiModelPickerResultsState }) {
  if (!state.models.length) {
    return <div className="detect-empty">{state.emptyMessage}</div>
  }

  return (
    <>
      {state.models.map((model) => (
        <AiModelOptionCard
          active={model === state.activeId}
          current={model === state.currentModel}
          key={model}
          modelId={model}
          tabIndex={model === state.activeId ? 0 : -1}
          tags={getAiModelPickerTags(model, state)}
        >
          {model}
        </AiModelOptionCard>
      ))}
    </>
  )
}

function getAiModelPickerTags(model: string, state: AiModelPickerResultsState): string[] {
  const tags: string[] = []
  if (model === state.currentModel) {
    tags.push('当前')
  }
  if (state.presetModels.includes(model)) {
    tags.push('预设')
  }
  if (state.customModels.includes(model)) {
    tags.push('自定义')
  }
  if (state.fetchedModels.includes(model)) {
    tags.push('已拉取')
  }

  return tags
}
