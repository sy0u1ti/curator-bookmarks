import {
  dispatchPopupFolderPickerAction,
  usePopupFolderPickerState
} from '../popup-events'
import { PopupFolderPicker } from './PopupFolderPicker'
import type { PopupFolderPickerState } from './PopupViewModels'

type PopupFolderPickerMode = PopupFolderPickerState['mode']

export function PopupFolderPickerHost({
  className,
  id,
  mode
}: {
  className: string
  id: string
  mode: PopupFolderPickerMode
}) {
  const state = usePopupFolderPickerState(mode)

  return (
    <div id={id} className={className} role="tree" aria-label={getAriaLabel(mode)}>
      <PopupFolderPicker
        onFolderSelect={(folderId) => {
          dispatchPopupFolderPickerAction({
            action: 'select',
            folderId,
            mode
          })
        }}
        onFolderToggle={(folderId) => {
          dispatchPopupFolderPickerAction({
            action: 'toggle',
            folderId,
            mode
          })
        }}
        state={state}
      />
    </div>
  )
}

function getAriaLabel(mode: PopupFolderPickerMode): string {
  if (mode === 'move') {
    return '移动目标文件夹'
  }
  if (mode === 'smart') {
    return '保存目标文件夹'
  }
  return '编辑目标文件夹'
}
