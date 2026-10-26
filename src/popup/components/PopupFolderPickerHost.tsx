import { memo, useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  dispatchPopupFolderPickerAction,
  usePopupFolderPickerState
} from '../popup-controller-store'
import {
  getFolderPickerSelectSelector,
  getFolderPickerToggleSelector,
  getNextFolderPickerFocusIndex,
  registerFolderPickerFocusHandler
} from '../popup-keyboard-navigation'
import { PopupFolderPicker } from './PopupFolderPicker'
import type { PopupFolderPickerState, PopupFolderTreeOptionViewModel } from './PopupViewModels'

type PopupFolderPickerMode = PopupFolderPickerState['mode']
const PICKER_ROW_HEIGHT = 34
const PICKER_OVERSCAN = 2
const PICKER_VIRTUAL_THRESHOLD = 48
const PICKER_WINDOW_BUDGET = 8

export const PopupFolderPickerHost = memo(function PopupFolderPickerHost({
  className,
  id,
  mode,
  onFolderSelectStart,
  ...props
}: {
  className: string
  id: string
  mode: PopupFolderPickerMode
  onFolderSelectStart?: (folderId: string) => void
  'data-squircle-subtree'?: 'off'
}) {
  const state = usePopupFolderPickerState(mode)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pendingFocusRef = useRef<string | null>(null)
  const options = state.treeOptions || []
  const virtual = options.length > PICKER_VIRTUAL_THRESHOLD
  const [rowHeight, setRowHeight] = useState(PICKER_ROW_HEIGHT)
  const [rowWindow, setRowWindow] = useState({ start: 0, count: PICKER_WINDOW_BUDGET })
  const start = virtual ? Math.min(rowWindow.start, Math.max(0, options.length - rowWindow.count)) : 0
  const end = virtual ? Math.min(options.length, start + rowWindow.count) : options.length
  const selectSelector = getFolderPickerSelectSelector(mode)

  const updateWindow = useCallback(() => {
    const container = containerRef.current
    if (!container || !virtual) return
    // Keep the mounted rows independent of the disclosure's animated height.
    // Reading a viewport that is clipped by the accordion would otherwise
    // remount rows at intermediate heights.
    const count = Math.min(
      options.length,
      Math.max(PICKER_WINDOW_BUDGET, Math.ceil(container.clientHeight / rowHeight) + PICKER_OVERSCAN * 2)
    )
    const nextStart = Math.min(
      Math.max(0, options.length - count),
      Math.max(0, Math.floor(container.scrollTop / rowHeight) - PICKER_OVERSCAN)
    )
    setRowWindow(current => current.start === nextStart && current.count === count
      ? current : { start: nextStart, count })
  }, [options.length, rowHeight, virtual])

  const focusOption = useCallback((option: PopupFolderTreeOptionViewModel | undefined) => {
    const container = containerRef.current
    if (!container || !option || option.disabled) return false
    const selector = `${selectSelector.slice(0, -1)}="${CSS.escape(option.id)}"]`
    const button = container.querySelector<HTMLButtonElement>(selector)
    if (button) {
      button.focus({ preventScroll: true })
      button.scrollIntoView({ block: 'nearest' })
    } else {
      pendingFocusRef.current = option.id
      container.scrollTop = options.indexOf(option) * rowHeight
      updateWindow()
    }
    return true
  }, [options, rowHeight, selectSelector, updateWindow])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    return registerFolderPickerFocusHandler(container, edge => {
      const enabled = options.filter(option => !option.disabled)
      return focusOption(edge === 'last' ? enabled.at(-1) : enabled[0])
    })
  }, [focusOption, options])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || !virtual) return
    updateWindow()
    container.addEventListener('scroll', updateWindow, { passive: true })
    const observer = new ResizeObserver(updateWindow)
    observer.observe(container)
    return () => {
      container.removeEventListener('scroll', updateWindow)
      observer.disconnect()
    }
  }, [updateWindow, virtual])

  useLayoutEffect(() => {
    const container = containerRef.current
    const row = container?.querySelector<HTMLElement>('[data-folder-picker-row]')
    if (row?.offsetHeight) setRowHeight(current => current === row.offsetHeight ? current : row.offsetHeight)
    if (!container || !pendingFocusRef.current) return
    const button = container.querySelector<HTMLButtonElement>(
      `${selectSelector.slice(0, -1)}="${CSS.escape(pendingFocusRef.current)}"]`
    )
    if (!button) return
    pendingFocusRef.current = null
    button.focus({ preventScroll: true })
    button.scrollIntoView({ block: 'nearest' })
  }, [start, end, options, selectSelector])

  const selectFolder = useCallback((folderId: string) => {
    onFolderSelectStart?.(folderId)
    dispatchPopupFolderPickerAction({ action: 'select', folderId, mode })
  }, [mode, onFolderSelectStart])
  const toggleFolder = useCallback((folderId: string) => {
    dispatchPopupFolderPickerAction({ action: 'toggle', folderId, mode })
  }, [mode])

  return (
    <div
      ref={containerRef}
      id={id}
      className={className}
      role="tree"
      tabIndex={-1}
      aria-label={getAriaLabel(mode)}
      data-squircle-subtree="off"
      {...props}
      onKeyDown={(event) => handleFolderPickerTreeKeyDown(event, mode, options, focusOption)}
    >
      <PopupFolderPicker
        startIndex={start}
        endIndex={end}
        rowHeight={rowHeight}
        onFolderSelect={selectFolder}
        onFolderToggle={toggleFolder}
        state={state}
      />
    </div>
  )
})

function handleFolderPickerTreeKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  mode: PopupFolderPickerMode,
  treeOptions: PopupFolderTreeOptionViewModel[],
  focusOption: (option: PopupFolderTreeOptionViewModel | undefined) => boolean
): void {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return
  }

  const key = event.key
  if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End') {
    const selector = getFolderPickerSelectSelector(mode)
    const current = getFolderPickerFocusedRow(event.target)?.querySelector(selector)
    const currentId = current?.getAttribute(selector.slice(1, -1))
    const options = treeOptions.filter(option => !option.disabled)
    const currentIndex = options.findIndex(option => option.id === currentId)
    const nextIndex = getNextFolderPickerFocusIndex(currentIndex, options.length, key)
    const nextOption = nextIndex >= 0 ? options[nextIndex] : null
    if (!focusOption(nextOption)) {
      return
    }

    event.preventDefault()
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
