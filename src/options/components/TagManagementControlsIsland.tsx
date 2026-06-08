import { useEffect, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { Button } from '../../ui/primitives/Button.js'
import { Input } from '../../ui/primitives/Input.js'
import { ThemeProvider } from '../../ui/theme/ThemeProvider.js'
import {
  dispatchTagManagementAction,
  TAG_MANAGEMENT_FILL_EVENT,
  TAG_MANAGEMENT_FORM_EVENT,
  type TagManagementFillDetail,
  type TagManagementFormDetail
} from './tag-management-events.js'

export interface TagManagementControlsState {
  loading: boolean
  manualTags: number
  status: string
  taggedBookmarks: number
  totalTags: number
}

const roots = new WeakMap<Element, Root>()

export function renderTagManagementControlsIsland(
  container: Element,
  state: TagManagementControlsState
): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <TagManagementControls state={state} />
      </ThemeProvider>
    )
  })
}

function TagManagementControls({ state }: { state: TagManagementControlsState }) {
  const [sourceTag, setSourceTag] = useState('')
  const [targetTag, setTargetTag] = useState('')
  const targetInputRef = useRef<HTMLElement | null>(null)
  const actionDisabled = state.loading || state.totalTags === 0

  function selectTargetInput() {
    if (targetInputRef.current instanceof HTMLInputElement) {
      targetInputRef.current.select()
      return
    }
    targetInputRef.current?.focus()
  }

  useEffect(() => {
    function handleFill(event: Event) {
      const tag = String((event as CustomEvent<TagManagementFillDetail>).detail?.tag || '').trim()
      if (!tag) {
        return
      }
      setSourceTag(tag)
      window.requestAnimationFrame(() => {
        selectTargetInput()
      })
    }

    function handleForm(event: Event) {
      const detail = (event as CustomEvent<TagManagementFormDetail>).detail || {}
      if (typeof detail.sourceTag === 'string') {
        setSourceTag(detail.sourceTag)
      }
      if (typeof detail.targetTag === 'string') {
        setTargetTag(detail.targetTag)
      }
      if (detail.focusTarget) {
        window.requestAnimationFrame(() => {
          selectTargetInput()
        })
      }
    }

    window.addEventListener(TAG_MANAGEMENT_FILL_EVENT, handleFill)
    window.addEventListener(TAG_MANAGEMENT_FORM_EVENT, handleForm)
    return () => {
      window.removeEventListener(TAG_MANAGEMENT_FILL_EVENT, handleFill)
      window.removeEventListener(TAG_MANAGEMENT_FORM_EVENT, handleForm)
    }
  }, [])

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    dispatchTagManagementAction({
      action: 'rename',
      sourceTag,
      targetTag
    })
  }

  return (
    <>
      <div className="tag-management-head">
        <div className="tag-management-title">
          <strong>标签词云</strong>
          <p className="detect-results-subtitle">字号和明暗代表使用频率，点击标签可填入整理表单。</p>
        </div>
        <div className="tag-management-metrics" aria-label="标签统计概览">
          <span id="tag-management-total">{state.totalTags} 个标签</span>
          <span id="tag-management-tagged-bookmarks">{state.taggedBookmarks} 条书签</span>
          <span id="tag-management-manual">{state.manualTags} 个手动标签</span>
        </div>
      </div>

      <div className="tag-management-toolbar">
        <form className="tag-management-form" onSubmit={handleRename}>
          <label htmlFor="tag-management-rename-source">
            <span>原标签</span>
            <Input
              id="tag-management-rename-source"
              type="text"
              autoComplete="off"
              placeholder="选择或输入标签"
              value={sourceTag}
              onValueChange={setSourceTag}
              disabled={state.loading}
            />
          </label>
          <label htmlFor="tag-management-rename-target">
            <span>新标签</span>
            <Input
              id="tag-management-rename-target"
              ref={targetInputRef}
              type="text"
              autoComplete="off"
              placeholder="用于重命名"
              value={targetTag}
              onValueChange={setTargetTag}
              disabled={state.loading}
            />
          </label>
          <div className="tag-management-form-actions">
            <Button
              id="tag-management-rename"
              className="options-button small"
              size="sm"
              type="submit"
              aria-label="重命名书签标签"
              disabled={actionDisabled}
              focusableWhenDisabled={state.loading}
            >
              重命名
            </Button>
            <Button
              id="tag-management-delete"
              className="options-button danger small"
              size="sm"
              type="button"
              variant="danger"
              aria-label="删除书签标签"
              disabled={actionDisabled}
              focusableWhenDisabled={state.loading}
              onClick={() => dispatchTagManagementAction({ action: 'delete', sourceTag })}
            >
              删除标签
            </Button>
          </div>
        </form>
        <Button
          id="tag-management-refresh"
          className="options-button secondary small"
          size="sm"
          type="button"
          variant="secondary"
          aria-label="刷新标签统计"
          disabled={state.loading}
          focusableWhenDisabled={state.loading}
          onClick={() => dispatchTagManagementAction({ action: 'refresh' })}
        >
          刷新统计
        </Button>
        <p id="tag-management-status" className="detect-status-copy">
          {state.status}
        </p>
      </div>
    </>
  )
}
