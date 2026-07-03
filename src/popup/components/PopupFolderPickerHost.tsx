import type { KeyboardEvent } from 'react'
import {
  dispatchPopupFolderPickerAction,
  usePopupFolderPickerState
} from '../popup-controller-store'
import {
  getEnabledFolderPickerOptions,
  getFolderPickerToggleSelector,
  getNextFolderPickerFocusIndex
} from '../popup-keyboard-navigation'
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
    <div
      id={id}
      className={className}
      role="tree"
      tabIndex={-1}
      aria-label={getAriaLabel(mode)}
      onKeyDown={(event) => handleFolderPickerTreeKeyDown(event, mode)}
    >
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

function handleFolderPickerTreeKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  mode: PopupFolderPickerMode
): void {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return
  }

  const key = event.key
  if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End') {
    const options = getEnabledFolderPickerOptions(event.currentTarget, mode)
    const currentIndex = options.findIndex((option) => option === document.activeElement)
    const nextIndex = getNextFolderPickerFocusIndex(currentIndex, options.length, key)
    const nextOption = nextIndex >= 0 ? options[nextIndex] : null
    if (!nextOption) {
      return
    }

    event.preventDefault()
    nextOption.focus({ preventScroll: true })
    nextOption.scrollIntoView({ block: 'nearest' })
    return
  }

  if (key !== 'ArrowLeft' && key !== 'ArrowRight') {
    return
  }

  const row = getFolderPickerFocusedRow(event.target)
  const toggle = row?.querySelector<HTMLButtonElement>(getFolderPickerToggleSelector(mode)) ?? null
  if (!toggle || toggle.disabled || toggle.getAttribute('data-disabled') === 'true') {
    return
  }

  const expanded = toggle.getAttribute('aria-expanded') === 'true'
  if ((key === 'ArrowRight' && expanded) || (key === 'ArrowLeft' && !expanded)) {
    return
  }

  event.preventDefault()
  toggle.click()
}

function getFolderPickerFocusedRow(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target.closest<HTMLElement>('[data-folder-picker-row]') : null
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
