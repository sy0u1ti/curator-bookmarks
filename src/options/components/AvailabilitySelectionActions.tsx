import { Button } from '../../ui'
import { handleAvailabilityPanelAction } from '../options-controller'
import { useAvailabilitySelectionActions } from './availability-overview-store.js'
import { useOptionsFocusTargetRef } from './options-focus-target-store.js'

const AVAILABILITY_SELECTION_GROUP_CLASS = 'mt-7 p-[18px_20px_20px] max-[760px]:p-4'
const AVAILABILITY_SELECTION_HEADER_CLASS =
  'flex min-w-0 flex-wrap items-center justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start'
const AVAILABILITY_SELECTION_HEADER_COPY_CLASS = 'min-w-0'
const AVAILABILITY_SELECTION_HEADER_TITLE_CLASS =
  'block text-[15px] font-semibold leading-normal tracking-[0] text-ds-text-primary'
const AVAILABILITY_SELECTION_SUBTITLE_CLASS =
  'mt-2.5 mb-0 text-[13px] leading-[1.7] text-ds-text-secondary'
const AVAILABILITY_SELECTION_ACTIONS_CLASS =
  'flex flex-wrap items-center justify-start gap-3 max-[760px]:flex-col max-[760px]:items-start'
const AVAILABILITY_SELECTION_BUTTON_CLASS = 'max-[760px]:w-full'

export function AvailabilitySelectionActions() {
  const state = useAvailabilitySelectionActions()
  const moveSelectionRef = useOptionsFocusTargetRef<HTMLButtonElement>('availability-selection-move')

  if (state.hidden) {
    return null
  }

  return (
    <div className={AVAILABILITY_SELECTION_GROUP_CLASS}>
      <div className={AVAILABILITY_SELECTION_HEADER_CLASS}>
        <div className={AVAILABILITY_SELECTION_HEADER_COPY_CLASS}>
          <strong className={AVAILABILITY_SELECTION_HEADER_TITLE_CLASS}>
            {state.countLabel}
          </strong>
          <p className={AVAILABILITY_SELECTION_SUBTITLE_CLASS}>可对当前低/高置信异常执行批量移动、忽略或删除。</p>
        </div>
        <Button
          className={AVAILABILITY_SELECTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="清空可用性检测已选书签"
          disabled={state.clearDisabled}
          focusableWhenDisabled={state.clearDisabled}
          onClick={() => handleAvailabilityPanelAction({ action: 'clear-selection' })}
        >
          清空选择
        </Button>
      </div>
      <div className={AVAILABILITY_SELECTION_ACTIONS_CLASS}>
        <Button
          className={AVAILABILITY_SELECTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="重新测试可用性检测已选书签"
          disabled={state.retestDisabled}
          focusableWhenDisabled={state.retestDisabled}
          onClick={() => handleAvailabilityPanelAction({ action: 'retest-selection' })}
        >
          {state.retestLabel}
        </Button>
        <Button
          className={AVAILABILITY_SELECTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="将可用性检测已选书签移入高置信异常"
          disabled={state.promoteDisabled}
          focusableWhenDisabled={state.promoteDisabled}
          onClick={() => handleAvailabilityPanelAction({ action: 'promote-selection' })}
        >
          移入高置信异常
        </Button>
        <Button
          className={AVAILABILITY_SELECTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="将可用性检测已选书签移入低置信异常"
          disabled={state.demoteDisabled}
          focusableWhenDisabled={state.demoteDisabled}
          onClick={() => handleAvailabilityPanelAction({ action: 'demote-selection' })}
        >
          移入低置信异常
        </Button>
        <Button
          ref={moveSelectionRef}
          className={AVAILABILITY_SELECTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="批量移动可用性检测已选书签到文件夹"
          disabled={state.moveDisabled}
          focusableWhenDisabled={state.moveDisabled}
          onClick={() => handleAvailabilityPanelAction({ action: 'move-selection' })}
        >
          批量移动到文件夹
        </Button>
        <Button
          className={AVAILABILITY_SELECTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="忽略可用性检测所选书签"
          disabled={state.ignoreBookmarkDisabled}
          focusableWhenDisabled={state.ignoreBookmarkDisabled}
          onClick={() => handleAvailabilityPanelAction({ action: 'ignore-bookmarks' })}
        >
          忽略所选书签
        </Button>
        <Button
          className={AVAILABILITY_SELECTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="忽略可用性检测所选域名"
          disabled={state.ignoreDomainDisabled}
          focusableWhenDisabled={state.ignoreDomainDisabled}
          onClick={() => handleAvailabilityPanelAction({ action: 'ignore-domains' })}
        >
          忽略所选域名
        </Button>
        <Button
          className={AVAILABILITY_SELECTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="忽略可用性检测所选文件夹"
          disabled={state.ignoreFolderDisabled}
          focusableWhenDisabled={state.ignoreFolderDisabled}
          onClick={() => handleAvailabilityPanelAction({ action: 'ignore-folders' })}
        >
          忽略所选文件夹
        </Button>
        <Button
          className={AVAILABILITY_SELECTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="danger"
          aria-label="批量删除可用性检测已选书签"
          disabled={state.deleteDisabled}
          focusableWhenDisabled={state.deleteDisabled}
          onClick={() => handleAvailabilityPanelAction({ action: 'delete-selected' })}
        >
          批量删除所选
        </Button>
      </div>
    </div>
  )
}
