import { Button } from '../../ui/base/Button.js'
import { handleRecycleAction } from '../options-controller'
import { useRecycleControlsState } from './recycle-controls-store.js'

const RECYCLE_HEADER_CLASS = 'flex flex-wrap items-center justify-between gap-3'
const RECYCLE_HEADER_COPY_CLASS = 'min-w-0'
const RECYCLE_HEADER_TITLE_CLASS =
  'block text-[15px] font-semibold leading-normal tracking-[0] text-[var(--ui-text-primary)]'
const RECYCLE_HEADER_SUBTITLE_CLASS =
  'mt-2.5 mb-0 text-[13px] leading-[1.7] text-[var(--ui-text-secondary)]'
const RECYCLE_HEADER_ACTIONS_CLASS =
  'flex min-w-0 flex-wrap items-center justify-end gap-2.5 max-[760px]:items-start max-[760px]:justify-start'
const RECYCLE_SELECTION_GROUP_CLASS =
  'mb-[18px] rounded-[18px] border border-[var(--ui-divider-subtle)] bg-[#171719] p-[16px]'

export function RecycleControls() {
  const state = useRecycleControlsState()
  const hasEntries = state.entryCount > 0
  const hasSelection = state.selectedCount > 0

  return (
    <>
      {hasSelection ? (
        <div className={RECYCLE_SELECTION_GROUP_CLASS}>
          <div className={RECYCLE_HEADER_CLASS}>
            <div className={RECYCLE_HEADER_COPY_CLASS}>
              <strong className={RECYCLE_HEADER_TITLE_CLASS}>
                {state.selectedCount} 条已选择
              </strong>
              <p className={RECYCLE_HEADER_SUBTITLE_CLASS}>可批量恢复选中的回收站书签，也可只清除回收站记录。</p>
            </div>
            <div className={RECYCLE_HEADER_ACTIONS_CLASS}>
              <Button
                size="sm"
                type="button"
                variant="secondary"
                aria-label="清空回收站已选书签"
                onClick={() => handleRecycleAction('clear-selection')}
              >
                清空选择
              </Button>
              <Button
                size="sm"
                type="button"
                aria-label="批量恢复回收站已选书签"
                disabled={state.busy || !hasSelection}
                focusableWhenDisabled={state.busy}
                onClick={() => handleRecycleAction('restore-selected')}
              >
                批量恢复
              </Button>
              <Button
                size="sm"
                type="button"
                variant="danger"
                aria-label="清除回收站已选记录"
                disabled={state.busy || !hasSelection}
                focusableWhenDisabled={state.busy}
                onClick={() => handleRecycleAction('clear-selected')}
              >
                清除所选
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={RECYCLE_HEADER_CLASS}>
        <div className={RECYCLE_HEADER_COPY_CLASS}>
          <strong className={RECYCLE_HEADER_TITLE_CLASS}>回收站条目</strong>
          <p className={RECYCLE_HEADER_SUBTITLE_CLASS}>
            恢复时会优先尝试放回原文件夹；若原文件夹已不存在，则回到书签栏。
          </p>
        </div>
        <div className={RECYCLE_HEADER_ACTIONS_CLASS}>
          <Button
            size="sm"
            type="button"
            variant="secondary"
            aria-label="全选回收站条目"
            disabled={!hasEntries}
            onClick={() => handleRecycleAction('select-all')}
          >
            全选本区
          </Button>
          <Button
            size="sm"
            type="button"
            variant="danger"
            aria-label="清空全部回收站记录"
            disabled={!hasEntries || state.busy}
            focusableWhenDisabled={state.busy}
            onClick={() => handleRecycleAction('clear-all')}
          >
            清空回收站
          </Button>
        </div>
      </div>
    </>
  )
}
