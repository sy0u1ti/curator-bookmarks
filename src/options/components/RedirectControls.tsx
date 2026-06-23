import { Button } from '../../ui'
import { handleRedirectAction } from '../options-controller'
import { useRedirectControlsState } from './redirect-controls-store.js'

const REDIRECT_HEADER_CLASS = 'flex flex-wrap items-center justify-between gap-3'
const REDIRECT_HEADER_COPY_CLASS = 'min-w-0'
const REDIRECT_HEADER_TITLE_CLASS =
  'block text-[15px] font-semibold leading-normal tracking-[0] text-ds-text-primary'
const REDIRECT_HEADER_SUBTITLE_CLASS =
  'mt-2.5 mb-0 text-[13px] leading-[1.7] text-ds-text-secondary'
const REDIRECT_HEADER_ACTIONS_CLASS =
  'flex min-w-0 flex-wrap items-center justify-end gap-2.5 max-[760px]:items-start max-[760px]:justify-start'
const REDIRECT_SELECTION_GROUP_CLASS =
  'mb-[18px] rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[16px]'

export function RedirectControls() {
  const state = useRedirectControlsState()
  const hasResults = state.count > 0
  const hasSelection = state.selectedCount > 0

  return (
    <>
      {hasSelection ? (
        <div className={REDIRECT_SELECTION_GROUP_CLASS}>
          <div className={REDIRECT_HEADER_CLASS}>
            <div className={REDIRECT_HEADER_COPY_CLASS}>
              <strong className={REDIRECT_HEADER_TITLE_CLASS}>
                {state.selectedCount} 条已选择
              </strong>
              <p className={REDIRECT_HEADER_SUBTITLE_CLASS}>可批量更新这些重定向书签为最终地址，或直接批量删除并移入回收站。</p>
            </div>
            <div className={REDIRECT_HEADER_ACTIONS_CLASS}>
              <Button
                size="sm"
                type="button"
                variant="secondary"
                aria-label="清空重定向更新已选书签"
                onClick={() => handleRedirectAction({ action: 'clear-selection' })}
              >
                清空选择
              </Button>
              <Button
                size="sm"
                type="button"
                aria-label="批量更新重定向已选书签为最终 URL"
                disabled={state.locked || !hasSelection}
                focusableWhenDisabled={state.locked}
                onClick={() => handleRedirectAction({ action: 'update-selected' })}
              >
                批量更新最终 URL
              </Button>
              <Button
                size="sm"
                type="button"
                variant="danger"
                aria-label="删除重定向更新已选书签"
                disabled={state.locked || !hasSelection}
                focusableWhenDisabled={state.locked}
                onClick={() => handleRedirectAction({ action: 'delete-selected' })}
              >
                删除所选
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={REDIRECT_HEADER_CLASS}>
        <div className={REDIRECT_HEADER_COPY_CLASS}>
          <strong className={REDIRECT_HEADER_TITLE_CLASS}>待更新重定向</strong>
          <p className={REDIRECT_HEADER_SUBTITLE_CLASS}>
            {state.subtitle}
          </p>
        </div>
        <div className={REDIRECT_HEADER_ACTIONS_CLASS}>
          <Button
            size="sm"
            type="button"
            variant="secondary"
            aria-label="全选待更新重定向书签"
            disabled={!hasResults}
            onClick={() => handleRedirectAction({ action: 'select-all' })}
          >
            全选本区
          </Button>
          <Button
            size="sm"
            type="button"
            variant="danger"
            aria-label="批量删除待更新重定向书签"
            disabled={state.locked || !hasResults}
            focusableWhenDisabled={state.locked}
            onClick={() => handleRedirectAction({ action: 'delete-all' })}
          >
            批量删除本区
          </Button>
        </div>
      </div>
    </>
  )
}
