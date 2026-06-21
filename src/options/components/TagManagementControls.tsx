import { useEffect, useRef, type FormEvent } from 'react'
import { Button } from '../../ui/base/Button.js'
import { Input } from '../../ui/base/Input.js'
import { handleTagManagementAction } from '../options-controller'
import {
  patchTagManagementControlsForm,
  useTagManagementControlsState
} from './tag-management-controls-store.js'

const TAG_MANAGEMENT_HEADER_CLASS =
  'flex min-w-0 items-center justify-between gap-3.5 max-[760px]:flex-col max-[760px]:items-stretch'
const TAG_MANAGEMENT_TITLE_CLASS = 'min-w-0'
const TAG_MANAGEMENT_TITLE_TEXT_CLASS = 'block text-[15px] font-bold leading-[1.35] text-[var(--ui-text-primary)]'
const TAG_MANAGEMENT_SUBTITLE_CLASS = 'mt-1 text-[13px] leading-[1.7] text-[var(--ui-text-secondary)]'
const TAG_MANAGEMENT_METRICS_CLASS =
  'flex min-w-0 flex-none flex-wrap justify-end gap-1.5 max-[760px]:justify-start'
const TAG_MANAGEMENT_METRIC_CLASS =
  'inline-flex min-h-[26px] items-center whitespace-nowrap rounded-lg border border-[var(--ui-divider-subtle)] px-[9px] py-[5px] text-xs font-[680] leading-[1.2] text-[var(--ui-text-secondary)]'
const TAG_MANAGEMENT_TOOLBAR_CLASS =
  'mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2.5 max-[760px]:grid-cols-1 max-[760px]:items-stretch'
const TAG_MANAGEMENT_FORM_CLASS =
  'grid grid-cols-[minmax(160px,0.8fr)_minmax(160px,0.8fr)_auto] items-end gap-2.5 max-[760px]:grid-cols-1'
const TAG_MANAGEMENT_LABEL_CLASS =
  'grid min-w-0 gap-2 text-xs font-semibold text-[var(--ui-text-secondary)]'
const TAG_MANAGEMENT_INPUT_CLASS =
  'w-full min-w-0 !min-h-[34px] !rounded-lg !border !border-[var(--ui-divider)] !bg-[rgba(255,255,255,0.045)] !px-[11px] !py-2 !text-[var(--ui-text-primary)] !shadow-none !outline-none [font:inherit] focus-visible:!border-[var(--ui-accent-line)] focus-visible:!shadow-[0_0_0_3px_rgba(120,166,255,0.12)] disabled:opacity-50'
const TAG_MANAGEMENT_FORM_ACTIONS_CLASS = 'grid grid-cols-2 gap-2'
const TAG_MANAGEMENT_ACTION_BUTTON_CLASS = 'w-full min-w-0 justify-center whitespace-nowrap'
const TAG_MANAGEMENT_REFRESH_BUTTON_CLASS = 'justify-center whitespace-nowrap max-[760px]:w-full'
const TAG_MANAGEMENT_STATUS_CLASS = 'col-span-full m-0 text-[13px] leading-[1.7] text-[var(--ui-text-secondary)]'

export function TagManagementControls() {
  const state = useTagManagementControlsState()
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
    if (!state.focusTargetRequestId) {
      return undefined
    }
    const frame = window.requestAnimationFrame(() => {
      selectTargetInput()
    })
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [state.focusTargetRequestId])

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    handleTagManagementAction({
      action: 'rename',
      sourceTag: state.sourceTag,
      targetTag: state.targetTag
    })
  }

  return (
    <>
      <div className={TAG_MANAGEMENT_HEADER_CLASS}>
        <div className={TAG_MANAGEMENT_TITLE_CLASS}>
          <strong className={TAG_MANAGEMENT_TITLE_TEXT_CLASS}>标签词云</strong>
          <p className={TAG_MANAGEMENT_SUBTITLE_CLASS}>字号和明暗代表使用频率，点击标签可填入整理表单。</p>
        </div>
        <div className={TAG_MANAGEMENT_METRICS_CLASS} aria-label="标签统计概览">
          <span className={TAG_MANAGEMENT_METRIC_CLASS}>{state.totalTags} 个标签</span>
          <span className={TAG_MANAGEMENT_METRIC_CLASS}>{state.taggedBookmarks} 条书签</span>
          <span className={TAG_MANAGEMENT_METRIC_CLASS}>{state.manualTags} 个手动标签</span>
        </div>
      </div>

      <div className={TAG_MANAGEMENT_TOOLBAR_CLASS}>
        <form className={TAG_MANAGEMENT_FORM_CLASS} onSubmit={handleRename}>
          <label className={TAG_MANAGEMENT_LABEL_CLASS} htmlFor="tag-management-rename-source">
            <span>原标签</span>
            <Input
              id="tag-management-rename-source"
              className={TAG_MANAGEMENT_INPUT_CLASS}
              type="text"
              autoComplete="off"
              placeholder="选择或输入标签"
              value={state.sourceTag}
              onValueChange={(value) => patchTagManagementControlsForm({ sourceTag: value })}
              disabled={state.loading}
              unstyled
            />
          </label>
          <label className={TAG_MANAGEMENT_LABEL_CLASS} htmlFor="tag-management-rename-target">
            <span>新标签</span>
            <Input
              id="tag-management-rename-target"
              className={TAG_MANAGEMENT_INPUT_CLASS}
              ref={targetInputRef}
              type="text"
              autoComplete="off"
              placeholder="用于重命名"
              value={state.targetTag}
              onValueChange={(value) => patchTagManagementControlsForm({ targetTag: value })}
              disabled={state.loading}
              unstyled
            />
          </label>
          <div className={TAG_MANAGEMENT_FORM_ACTIONS_CLASS}>
            <Button
              className={TAG_MANAGEMENT_ACTION_BUTTON_CLASS}
              size="sm"
              type="submit"
              variant="primary"
              aria-label="重命名书签标签"
              disabled={actionDisabled}
              focusableWhenDisabled={state.loading}
            >
              重命名
            </Button>
            <Button
              className={TAG_MANAGEMENT_ACTION_BUTTON_CLASS}
              size="sm"
              type="button"
              variant="danger"
              aria-label="删除书签标签"
              disabled={actionDisabled}
              focusableWhenDisabled={state.loading}
              onClick={() => handleTagManagementAction({ action: 'delete', sourceTag: state.sourceTag })}
            >
              删除标签
            </Button>
          </div>
        </form>
        <Button
          className={TAG_MANAGEMENT_REFRESH_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="刷新标签统计"
          disabled={state.loading}
          focusableWhenDisabled={state.loading}
          onClick={() => handleTagManagementAction({ action: 'refresh' })}
        >
          刷新统计
        </Button>
        <p className={TAG_MANAGEMENT_STATUS_CLASS}>
          {state.status}
        </p>
      </div>
    </>
  )
}
