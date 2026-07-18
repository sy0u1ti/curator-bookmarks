export interface PopupKeyboardFolderRowLike {
  folderId: string
  root?: boolean
}

export type PopupKeyboardPane = 'bookmarks' | 'folders'
export type PopupFolderPickerMode = 'edit' | 'move' | 'smart'

export interface PopupKeyboardTargetInfo {
  editable: boolean
  interactive: boolean
  mainSearchInput: boolean
}

const POPUP_CONTENT_NAVIGATION_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  'Escape'
])

export function isPopupContentNavigationKey(key: string): boolean {
  return POPUP_CONTENT_NAVIGATION_KEYS.has(key)
}

export function getFolderPaneTreeRoot<Node>(currentRoot: Node | null, bookmarksBarNode: Node | null): Node | null {
  return bookmarksBarNode || currentRoot
}

export function getFolderPaneKeyboardIndex(
  rows: readonly PopupKeyboardFolderRowLike[],
  selectedFolderFilterId: string | null
): number {
  if (!rows.length) {
    return -1
  }

  const activeIndex = rows.findIndex((row) =>
    (!selectedFolderFilterId && row.root === true) ||
    (Boolean(selectedFolderFilterId) && row.folderId === selectedFolderFilterId)
  )

  return activeIndex >= 0 ? activeIndex : 0
}

export function getBookmarkPaneKeyboardIndex(activeResultIndex: number, bookmarkCount: number): number {
  const count = Math.max(0, Math.trunc(Number(bookmarkCount) || 0))
  if (count <= 0) {
    return -1
  }

  const index = Number.isFinite(activeResultIndex) ? Math.trunc(activeResultIndex) : -1
  return Math.max(0, Math.min(index, count - 1))
}

export function isBookmarkRowKeyboardActive(
  keyboardPane: PopupKeyboardPane,
  rowIndex: number,
  activeResultIndex: number
): boolean {
  return keyboardPane === 'bookmarks' && rowIndex === activeResultIndex
}

export function shouldDelegatePopupDocumentNavigation(
  key: string,
  target: PopupKeyboardTargetInfo
): boolean {
  if (target.mainSearchInput) {
    return key === 'ArrowLeft' || key === 'ArrowRight'
  }

  return target.editable || target.interactive
}

export function shouldBlurMainSearchForNavigation(
  key: string,
  target: PopupKeyboardTargetInfo
): boolean {
  return target.mainSearchInput && (key === 'ArrowDown' || key === 'ArrowUp')
}

export function getFolderPickerSelectSelector(mode: PopupFolderPickerMode): string {
  if (mode === 'move') {
    return '[data-select-folder]'
  }
  if (mode === 'smart') {
    return '[data-smart-select-folder]'
  }
  return '[data-select-edit-folder]'
}

export function getEnabledFolderPickerOptions(
  container: HTMLElement | null,
  mode: PopupFolderPickerMode
): HTMLButtonElement[] {
  if (!container) {
    return []
  }

  return Array.from(container.querySelectorAll<HTMLButtonElement>(getFolderPickerSelectSelector(mode)))
    .filter((option) => !option.disabled && option.getAttribute('aria-disabled') !== 'true')
}

export function focusFolderPickerEdge(
  container: HTMLElement | null,
  mode: PopupFolderPickerMode,
  edge: 'first' | 'last'
): boolean {
  const options = getEnabledFolderPickerOptions(container, mode)
  const target = edge === 'last' ? options.at(-1) : options[0]
  if (!target) {
    return false
  }

  target.focus({ preventScroll: true })
  target.scrollIntoView({ block: 'nearest' })
  return true
}

export function getFolderPickerToggleSelector(mode: PopupFolderPickerMode): string {
  if (mode === 'move') {
    return '[data-toggle-move-folder]'
  }
  if (mode === 'smart') {
    return '[data-toggle-smart-folder]'
  }
  return '[data-toggle-edit-folder]'
}

export function getNextFolderPickerFocusIndex(
  currentIndex: number,
  itemCount: number,
  key: string
): number {
  const count = Math.max(0, Math.trunc(Number(itemCount) || 0))
  if (count <= 0) {
    return -1
  }

  if (key === 'Home') {
    return 0
  }
  if (key === 'End') {
    return count - 1
  }

  const index = Number.isFinite(currentIndex) ? Math.trunc(currentIndex) : -1
  if (key === 'ArrowUp') {
    return index <= 0 ? count - 1 : index - 1
  }
  if (key === 'ArrowDown') {
    return index < 0 || index >= count - 1 ? 0 : index + 1
  }

  return index >= 0 && index < count ? index : 0
}
