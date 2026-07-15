export interface NewtabSearchFocusKeyEvent {
  altKey: boolean
  ctrlKey: boolean
  defaultPrevented: boolean
  isComposing?: boolean
  key: string
  keyCode?: number
  metaKey: boolean
  shiftKey: boolean
}

export type NewtabSearchFocusIntent =
  | { type: 'append'; text: string }
  | { type: 'backspace' }
  | { type: 'focus' }
  | { type: 'select' }

export type NewtabBlankPointerAction = 'blur' | 'focus'

export function getNewtabBlankPointerAction(searchFocused: boolean): NewtabBlankPointerAction {
  return searchFocused ? 'blur' : 'focus'
}

export interface NewtabSearchFocusContext {
  draggingBookmark: boolean
  draggingFolder: boolean
  draggingSpeedDial: boolean
  editableTarget: boolean
  enabled: boolean
  featuredPickerOpen: boolean
  menuOpen: boolean
  settingsOpen: boolean
}

export function canUseNewtabSearchFocus(context: NewtabSearchFocusContext): boolean {
  return context.enabled &&
    !context.draggingBookmark &&
    !context.draggingFolder &&
    !context.draggingSpeedDial &&
    !context.editableTarget &&
    !context.featuredPickerOpen &&
    !context.menuOpen &&
    !context.settingsOpen
}

export function getNewtabSearchFocusIntent(
  event: NewtabSearchFocusKeyEvent
): NewtabSearchFocusIntent | null {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
    return null
  }

  if (event.isComposing || event.keyCode === 229 || event.key === 'Process') {
    return { type: 'focus' }
  }

  if (event.key === '/') {
    return { type: 'select' }
  }

  if (event.key === 'Backspace') {
    return { type: 'backspace' }
  }

  if (event.key.length === 1 && event.key.trim()) {
    return { type: 'append', text: event.key }
  }

  return null
}

export function getNextNewtabSearchValue(
  currentValue: string,
  intent: NewtabSearchFocusIntent
): string {
  if (intent.type === 'backspace') {
    return currentValue.slice(0, -1)
  }

  if (intent.type === 'append') {
    return `${currentValue}${intent.text}`
  }

  return currentValue
}
