import { Button } from '../../ui/base/Button'
import { StableLabel } from '../../ui/base/StatusMessage'
import { SelectionDock } from './SelectionDock'
import { OptionActionsMenu } from './OptionActionsMenu'
import { handleAvailabilityPanelAction } from '../options-controller'
import { useAvailabilitySelectionActions } from './availability-overview-store.js'
import { useOptionsFocusTargetRef } from './options-focus-target-store.js'

export function AvailabilitySelectionActions() {
  const state = useAvailabilitySelectionActions()
  const moveSelectionRef = useOptionsFocusTargetRef<HTMLButtonElement>('availability-selection-move')
  const entered = !state.hidden
  const moreActions = [
    { id: 'promote-selection', label: '移入高置信异常', disabled: state.promoteDisabled },
    { id: 'demote-selection', label: '移入低置信异常', disabled: state.demoteDisabled },
    { id: 'ignore-bookmarks', label: '忽略所选书签', disabled: state.ignoreBookmarkDisabled },
    { id: 'ignore-domains', label: '忽略所选域名', disabled: state.ignoreDomainDisabled },
    { id: 'ignore-folders', label: '忽略所选文件夹', disabled: state.ignoreFolderDisabled }
  ] as const

  return (
    <SelectionDock open={entered} label="已选异常书签操作">
      <div className="options-selection-bar">
        <div className="options-selection-summary">
          <strong className="text-sm font-semibold tabular-nums">{state.countLabel}</strong>
          <Button
            size="sm"
            type="button"
            variant="ghost"
            aria-label="清空可用性检测已选书签"
            disabled={state.clearDisabled}
            focusableWhenDisabled={state.clearDisabled}
            onClick={() => handleAvailabilityPanelAction({ action: 'clear-selection' })}
          >
            清空选择
          </Button>
        </div>
        <div className="options-selection-actions">
          <Button
            size="sm"
            type="button"
            variant="secondary"
            aria-label="重新测试可用性检测已选书签"
            disabled={state.retestDisabled}
            focusableWhenDisabled={state.retestDisabled}
            onClick={() => handleAvailabilityPanelAction({ action: 'retest-selection' })}
          >
            <StableLabel text={state.retestLabel} reserve={['重新测试', '正在测试…']} />
          </Button>
          <Button
            ref={moveSelectionRef}
            size="sm"
            type="button"
            variant="secondary"
            aria-label="批量移动可用性检测已选书签到文件夹"
            disabled={state.moveDisabled}
            focusableWhenDisabled={state.moveDisabled}
            onClick={() => handleAvailabilityPanelAction({ action: 'move-selection' })}
          >
            移动到文件夹
          </Button>
          <OptionActionsMenu label="更多已选异常书签操作" actions={moreActions.map(action => ({
            ...action,
            separatorBefore: action.id === 'ignore-bookmarks',
            onSelect: () => handleAvailabilityPanelAction({ action: action.id })
          }))} />
          <Button
            size="sm"
            type="button"
            variant="danger"
            aria-label="批量删除可用性检测已选书签"
            disabled={state.deleteDisabled}
            focusableWhenDisabled={state.deleteDisabled}
            onClick={() => handleAvailabilityPanelAction({ action: 'delete-selected' })}
          >
            删除所选
          </Button>
        </div>
      </div>
    </SelectionDock>
  )
}
