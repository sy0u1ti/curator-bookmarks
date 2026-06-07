import { useEffect, useState } from 'react'
import {
  dispatchPopupFolderPickerAction,
  POPUP_FOLDER_PICKER_CHANGE_EVENT,
  type PopupFolderPickerChangeDetail
} from '../popup-events'
import { PopupFolderPicker } from './PopupFolderPicker'
import type { PopupFolderPickerState } from './PopupViewModels'

type PopupFolderPickerMode = PopupFolderPickerState['mode']

function getEmptyState(mode: PopupFolderPickerMode): PopupFolderPickerState {
  return {
    empty: null,
    mode,
    query: '',
    treeOptions: []
  }
}

export function PopupFolderPickerHost({
  className,
  id,
  mode
}: {
  className: string
  id: string
  mode: PopupFolderPickerMode
}) {
  const [state, setState] = useState<PopupFolderPickerState>(() => getEmptyState(mode))

  useEffect(() => {
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<PopupFolderPickerChangeDetail>).detail
      if (detail?.mode === mode) {
        setState(detail.state)
      }
    }

    window.addEventListener(POPUP_FOLDER_PICKER_CHANGE_EVENT, handleChange)
    return () => window.removeEventListener(POPUP_FOLDER_PICKER_CHANGE_EVENT, handleChange)
  }, [mode])

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
