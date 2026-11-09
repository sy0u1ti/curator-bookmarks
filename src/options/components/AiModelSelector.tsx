import { CheckIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  ModelSelector,
  ModelSelectorCombobox,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorItemIndicator,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTag,
  ModelSelectorTrigger
} from '../../ui/ai/ModelSelector'
import {
  type AiModelSelectorState
} from './ai-model-selector-types.js'
import { OPTIONS_REDUCED_MOTION_SURFACE_CLASS } from './options-motion-classes.js'

const MODEL_SELECTOR_CHECK_CLASS = 'size-3.5 text-ds-text-secondary'
const MODEL_SELECTOR_LOGO_SLOT_CLASS = 'size-3 flex-none'
const MODEL_SELECTOR_REDUCED_MOTION_CLASS = OPTIONS_REDUCED_MOTION_SURFACE_CLASS

export function AiModelSelector({
  onModelSelect,
  state
}: {
  onModelSelect: (model: string) => void
  state: AiModelSelectorState
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const catalogModels = state.fetchedModels.length ? state.fetchedModels : state.models
  const selectedModel = state.currentModel || catalogModels[0] || ''
  const selectedMeta = getModelMeta(selectedModel, state)
  const filteredModels = useMemo(() => {
    const normalizedQuery = normalizeModelSearchText(query)
    if (!normalizedQuery) {
      return catalogModels
    }

    return catalogModels.filter((model) => normalizeModelSearchText(model).includes(normalizedQuery))
  }, [catalogModels, query])
  const groupedModels = useMemo(() => groupModels(filteredModels, state), [filteredModels, state])

  function handleSelect(model: string) {
    onModelSelect(model)
    setOpen(false)
    setQuery('')
  }

  function handleOpenChange(nextOpen: boolean) {
    if (state.disabled && nextOpen) {
      return
    }
    setOpen(nextOpen)
    if (!nextOpen) {
      setQuery('')
    }
  }

  return (
    <ModelSelector
      open={open}
      onOpenChange={handleOpenChange}
    >
      <ModelSelectorTrigger
        type="button"
        aria-label="选择 AI 模型"
        disabled={state.disabled}
      >
        {selectedMeta.lab ? <ModelSelectorLogo provider={selectedMeta.lab.id} /> : null}
        <ModelSelectorName>{selectedModel || '选择模型'}</ModelSelectorName>
      </ModelSelectorTrigger>
      <ModelSelectorContent
        backdropClassName={MODEL_SELECTOR_REDUCED_MOTION_CLASS}
        className={MODEL_SELECTOR_REDUCED_MOTION_CLASS}
        title="选择 AI 模型"
      >
        <ModelSelectorCombobox
          filteredItems={filteredModels}
          inputValue={query}
          items={catalogModels}
          onInputValueChange={setQuery}
          onOpenChange={handleOpenChange}
          onValueChange={(model) => {
            if (model) {
              handleSelect(model)
            }
          }}
          open={open}
          value={selectedModel || null}
        >
          <ModelSelectorInput
            autoFocus
            onClear={() => setQuery('')}
            placeholder="Search models…"
          />
          <ModelSelectorList aria-label="AI 模型候选列表">
            <ModelSelectorEmpty>
              {query ? '没有匹配的模型。' : '尚未加载模型。'}
            </ModelSelectorEmpty>
            {groupedModels.map((group, groupIndex) => (
              <ModelSelectorGroup
                className={groupIndex === 0 ? undefined : 'mt-1.5'}
                heading={group.heading}
                key={group.key}
              >
                {group.models.map((model) => {
                  const meta = getModelMeta(model, state)
                  return (
                    <ModelSelectorItem
                      key={model}
                      value={model}
                    >
                      {meta.lab
                        ? <ModelSelectorLogo provider={meta.lab.id} />
                        : <span aria-hidden="true" className={MODEL_SELECTOR_LOGO_SLOT_CLASS} />}
                      <ModelSelectorName>{model}</ModelSelectorName>
                      <ModelSelectorLogoGroup>
                        {meta.tags.map((tag) => (
                          <ModelSelectorTag key={tag}>
                            {tag}
                          </ModelSelectorTag>
                        ))}
                      </ModelSelectorLogoGroup>
                      <ModelSelectorItemIndicator>
                        <CheckIcon className={MODEL_SELECTOR_CHECK_CLASS} />
                      </ModelSelectorItemIndicator>
                    </ModelSelectorItem>
                  )
                })}
              </ModelSelectorGroup>
            ))}
          </ModelSelectorList>
        </ModelSelectorCombobox>
      </ModelSelectorContent>
    </ModelSelector>
  )
}

function groupModels(models: string[], state: AiModelSelectorState) {
  const groups = new Map<string, { heading: string; key: string; models: string[] }>()
  const unknown: string[] = []
  for (const model of models) {
    const lab = state.labs[model]
    if (!lab) {
      unknown.push(model)
      continue
    }
    const group = groups.get(lab.id) ?? { heading: lab.name, key: lab.id, models: [] }
    group.models.push(model)
    groups.set(lab.id, group)
  }

  return unknown.length
    ? [...groups.values(), { heading: '其他', key: '', models: unknown }]
    : [...groups.values()]
}

function getModelMeta(model: string, state: AiModelSelectorState) {
  const tags: string[] = []
  if (state.fetchedModels.length && state.fetchedModels.includes(model)) {
    tags.push('已拉取')
  } else {
    if (state.presetModels.includes(model)) {
      tags.push('预设')
    }
    if (state.customModels.includes(model)) {
      tags.push('自定义')
    }
  }

  return {
    lab: state.labs[model] ?? null,
    tags
  }
}

function normalizeModelSearchText(value: string) {
  return value.trim().toLocaleLowerCase()
}
