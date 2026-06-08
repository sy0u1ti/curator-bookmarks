import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { CheckIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger
} from '../../ui/ai/ModelSelector'
import {
  ThemeProvider
} from '../../ui'

export interface AiModelSelectorState {
  currentModel: string
  customModels: string[]
  disabled: boolean
  fetchedModels: string[]
  models: string[]
  presetModels: string[]
}

export interface AiModelSelectorChangeDetail {
  model: string
}

export interface AiModelPickerResultsState extends Omit<AiModelSelectorState, 'disabled'> {
  activeId: string
  emptyMessage: string
}

const roots = new WeakMap<Element, Root>()

export function renderAiModelSelectorIsland(container: Element, state: AiModelSelectorState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <AiModelSelector state={state} />
      </ThemeProvider>
    )
  })
}

export function renderAiModelPickerResultsIsland(container: Element, state: AiModelPickerResultsState): void {
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

function AiModelSelector({ state }: { state: AiModelSelectorState }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selectedModel = state.currentModel || state.models[0] || ''
  const selectedMeta = getModelMeta(selectedModel, state)
  const filteredModels = useMemo(() => {
    const normalizedQuery = normalizeModelSearchText(query)
    if (!normalizedQuery) {
      return state.models
    }

    return state.models.filter((model) => normalizeModelSearchText(model).includes(normalizedQuery))
  }, [query, state.models])
  const groupedModels = useMemo(() => groupModels(filteredModels, state), [filteredModels, state])

  function handleSelect(model: string) {
    window.dispatchEvent(
      new CustomEvent<AiModelSelectorChangeDetail>('options:ai-model-selector-change', {
        detail: { model }
      })
    )
    setOpen(false)
    setQuery('')
  }

  return (
    <ModelSelector
      open={open}
      onOpenChange={(nextOpen) => {
        if (state.disabled && nextOpen) {
          return
        }
        setOpen(nextOpen)
        if (!nextOpen) {
          setQuery('')
        }
      }}
    >
      <ModelSelectorTrigger
        id="ai-model-selector-trigger"
        className="model-selector-trigger"
        type="button"
        aria-label="选择 AI 模型"
        disabled={state.disabled}
      >
        {selectedMeta.provider ? <ModelSelectorLogo provider={selectedMeta.provider} /> : null}
        <ModelSelectorName id="ai-model-selector-label">{selectedModel || '选择模型'}</ModelSelectorName>
      </ModelSelectorTrigger>
      <ModelSelectorContent dialogTitle="选择 AI 模型">
        <ModelSelectorInput
          autoFocus
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="搜索模型 ID"
          value={query}
        />
        <ModelSelectorList aria-label="AI 模型候选列表">
          {groupedModels.length ? (
            groupedModels.map((group) => (
              <ModelSelectorGroup heading={group.heading} key={group.heading}>
                {group.models.map((model) => {
                  const meta = getModelMeta(model, state)
                  return (
                    <ModelSelectorItem
                      current={model === selectedModel}
                      key={model}
                      onSelect={() => handleSelect(model)}
                      value={model}
                    >
                      <ModelSelectorLogo provider={meta.provider} />
                      <ModelSelectorName>{model}</ModelSelectorName>
                      <ModelSelectorLogoGroup>
                        {meta.tags.map((tag) => (
                          <span className="model-selector-tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </ModelSelectorLogoGroup>
                      {model === selectedModel ? <CheckIcon className="model-selector-check" /> : null}
                    </ModelSelectorItem>
                  )
                })}
              </ModelSelectorGroup>
            ))
          ) : (
            <ModelSelectorEmpty>
              {query ? '没有匹配的模型。' : '尚未加载模型，可点击「获取模型」从 API 拉取。'}
            </ModelSelectorEmpty>
          )}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  )
}

function AiModelPickerResults({ state }: { state: AiModelPickerResultsState }) {
  const groupedModels = useMemo(() => groupModels(state.models, { ...state, disabled: false }), [state])

  if (!state.models.length) {
    return <ModelSelectorEmpty>{state.emptyMessage}</ModelSelectorEmpty>
  }

  return (
    <ModelSelectorList aria-label="AI 模型候选列表">
      {groupedModels.map((group) => (
        <ModelSelectorGroup heading={group.heading} key={group.heading}>
          {group.models.map((model) => {
            const meta = getModelMeta(model, { ...state, disabled: false })
            const current = model === state.currentModel
            const active = model === state.activeId
            return (
              <ModelSelectorItem
                aria-selected={current ? 'true' : 'false'}
                current={current}
                data-active={active ? 'true' : undefined}
                key={model}
                tabIndex={active ? 0 : -1}
                value={model}
              >
                <ModelSelectorLogo provider={meta.provider} />
                <ModelSelectorName>{model}</ModelSelectorName>
                <ModelSelectorLogoGroup>
                  {meta.tags.map((tag) => (
                    <span className="model-selector-tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </ModelSelectorLogoGroup>
                {current ? <CheckIcon className="model-selector-check" /> : null}
              </ModelSelectorItem>
            )
          })}
        </ModelSelectorGroup>
      ))}
    </ModelSelectorList>
  )
}

function groupModels(models: string[], state: AiModelSelectorState) {
  const groups = new Map<string, string[]>()
  for (const model of models) {
    const heading = getModelMeta(model, state).heading
    const group = groups.get(heading) || []
    group.push(model)
    groups.set(heading, group)
  }

  return [...groups.entries()].map(([heading, groupModels]) => ({
    heading,
    models: groupModels
  }))
}

function getModelMeta(model: string, state: AiModelSelectorState) {
  const provider = inferModelProvider(model)
  const tags: string[] = []
  if (state.presetModels.includes(model)) {
    tags.push('预设')
  }
  if (state.customModels.includes(model)) {
    tags.push('自定义')
  }
  if (state.fetchedModels.includes(model)) {
    tags.push('已拉取')
  }

  return {
    heading: getModelGroupHeading(provider),
    provider,
    tags
  }
}

function normalizeModelSearchText(value: string) {
  return value.trim().toLocaleLowerCase()
}

function inferModelProvider(model: string) {
  const normalized = model.toLocaleLowerCase()
  if (/claude|anthropic/.test(normalized)) {
    return 'anthropic'
  }
  if (/gemini|google/.test(normalized)) {
    return 'google'
  }
  if (/gpt|o\d|openai/.test(normalized)) {
    return 'openai'
  }
  if (/deepseek/.test(normalized)) {
    return 'deepseek'
  }
  if (/qwen|alibaba/.test(normalized)) {
    return 'alibaba'
  }
  if (/mistral|codestral/.test(normalized)) {
    return 'mistral'
  }
  if (/llama|meta/.test(normalized)) {
    return 'llama'
  }
  if (/grok|xai/.test(normalized)) {
    return 'xai'
  }
  if (/sonar|perplexity/.test(normalized)) {
    return 'perplexity'
  }
  if (/moonshot|kimi/.test(normalized)) {
    return 'moonshotai'
  }
  if (/nova|bedrock|amazon/.test(normalized)) {
    return 'amazon-bedrock'
  }
  if (/azure/.test(normalized)) {
    return 'azure'
  }
  if (/openrouter/.test(normalized)) {
    return 'openrouter'
  }
  if (/groq/.test(normalized)) {
    return 'groq'
  }
  if (/together/.test(normalized)) {
    return 'togetherai'
  }
  if (/v0|vercel/.test(normalized)) {
    return 'vercel'
  }
  return 'openai'
}

function getModelGroupHeading(provider: string) {
  const labels: Record<string, string> = {
    alibaba: 'Alibaba',
    anthropic: 'Anthropic',
    'amazon-bedrock': 'Amazon',
    azure: 'Azure',
    deepseek: 'DeepSeek',
    google: 'Google',
    groq: 'Groq',
    llama: 'Meta',
    mistral: 'Mistral AI',
    moonshotai: 'Moonshot AI',
    openai: 'OpenAI',
    openrouter: 'OpenRouter',
    perplexity: 'Perplexity',
    togetherai: 'Together AI',
    vercel: 'Vercel',
    xai: 'xAI'
  }

  return labels[provider] || 'Custom'
}
