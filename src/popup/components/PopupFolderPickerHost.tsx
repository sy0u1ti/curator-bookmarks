import { useEffect, useState } from 'react'
import {
  dispatchPopupFolderPickerAction,
  POPUP_FOLDER_PICKER_CHANGE_EVENT,
  type PopupFolderPickerChangeDetail
} from '../popup-events'
import { PopupFolderPicker, type PopupFolderPickerState } from './PopupRuntimeIslands'

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
    <div id={id} className={className} role="tree" aria-label={getAriaLabel(mode)} onClick={handleClick}>
      <PopupFolderPicker state={state} />
    </div>
  )

  function handleClick(event: React.MouseEvent<HTMLElement>) {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    const toggle = target.closest(`[data-toggle-${mode}-folder]`)
    if (toggle) {
      if (toggle.hasAttribute('data-disabled')) {
        return
      }
      dispatchPopupFolderPickerAction({
        action: 'toggle',
        folderId: toggle.getAttribute(`data-toggle-${mode}-folder`) || '',
        mode
      })
      return
    }

    const select = target.closest(getSelectSelector(mode))
    if (select) {
      dispatchPopupFolderPickerAction({
        action: 'select',
        folderId: select.getAttribute(getSelectAttribute(mode)) || '',
        mode
      })
    }
  }
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

function getSelectSelector(mode: PopupFolderPickerMode): string {
  return `[${getSelectAttribute(mode)}]`
}

function getSelectAttribute(mode: PopupFolderPickerMode): string {
  if (mode === 'move') {
    return 'data-select-folder'
  }
  if (mode === 'smart') {
    return 'data-smart-select-folder'
  }
  return 'data-select-edit-folder'
}
