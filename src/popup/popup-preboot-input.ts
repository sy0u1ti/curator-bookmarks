export const POPUP_PREBOOT_SHELL_ID = 'popup-preboot-shell'
export const POPUP_PREBOOT_SEARCH_INPUT_ID = 'popup-preboot-search-input'

const MAX_PREBOOT_QUERY_LENGTH = 512

export interface PopupPrebootSearchSnapshot {
  active: boolean
  selectionDirection: 'backward' | 'forward' | 'none' | null
  selectionEnd: number | null
  selectionStart: number | null
  value: string
}

export interface PopupPrebootWritableInput {
  selectionDirection?: 'backward' | 'forward' | 'none' | null
  selectionEnd: number | null
  selectionStart: number | null
  value: string
  focus?: (options?: FocusOptions) => void
  setSelectionRange?: (
    selectionStart: number,
    selectionEnd: number,
    selectionDirection?: 'backward' | 'forward' | 'none'
  ) => void
}

export type PopupPrebootKeyboardEdit =
  | { type: 'deleteContentBackward' }
  | { type: 'deleteContentForward' }
  | { text: string; type: 'insertText' }

interface PopupPrebootKeyboardEventLike {
  altKey?: boolean
  ctrlKey?: boolean
  defaultPrevented?: boolean
  isComposing?: boolean
  key: string
  metaKey?: boolean
  preventDefault?: () => void
  target?: EventTarget | null
}

export function installPopupPrebootInputCapture(
  documentRef: Document = document,
  windowRef: Window = window
): () => void {
  const input = getPopupPrebootSearchInput(documentRef)
  if (!input) {
    return () => {}
  }

  focusPopupPrebootSearchInput(documentRef)
  const focusFrame = windowRef.requestAnimationFrame(() => {
    focusPopupPrebootSearchInput(documentRef)
  })

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!hasPopupPrebootSearchShell(documentRef)) {
      return
    }

    if (isEditableEventTarget(event.target)) {
      return
    }

    const edit = getPopupPrebootKeyboardEdit(event)
    if (!edit) {
      return
    }

    event.preventDefault()
    focusPopupPrebootSearchInput(documentRef)
    applyPopupPrebootKeyboardEdit(input, edit)
  }

  documentRef.addEventListener('keydown', handleKeyDown, { capture: true })

  return () => {
    windowRef.cancelAnimationFrame(focusFrame)
    documentRef.removeEventListener('keydown', handleKeyDown, { capture: true })
  }
}

export function getPopupPrebootSearchInput(documentRef: Document = document): HTMLInputElement | null {
  const element = documentRef.getElementById(POPUP_PREBOOT_SEARCH_INPUT_ID)
  return element instanceof HTMLInputElement ? element : null
}

export function readPopupPrebootSearchSnapshot(documentRef: Document = document): PopupPrebootSearchSnapshot {
  const input = getPopupPrebootSearchInput(documentRef)
  if (!input) {
    return createEmptyPopupPrebootSearchSnapshot()
  }

  return {
    active: documentRef.activeElement === input,
    selectionDirection: normalizeSelectionDirection(input.selectionDirection),
    selectionEnd: input.selectionEnd,
    selectionStart: input.selectionStart,
    value: normalizePopupPrebootSearchValue(input.value)
  }
}

export function getPopupPrebootSearchAdoptionQuery(
  snapshot: PopupPrebootSearchSnapshot,
  currentQuery: string
): string {
  const prebootQuery = normalizePopupPrebootSearchValue(snapshot.value)
  const query = String(currentQuery || '')

  if (!prebootQuery) {
    return query
  }

  if (snapshot.active || !query || prebootQuery.startsWith(query)) {
    return prebootQuery
  }

  return query
}

export function focusPopupPrebootSearchInput(documentRef: Document = document): boolean {
  const input = getPopupPrebootSearchInput(documentRef)
  if (!input || input.disabled) {
    return false
  }

  input.focus({ preventScroll: true })
  return documentRef.activeElement === input
}

export function hidePopupPrebootSearchShell(documentRef: Document = document): void {
  const shell = documentRef.getElementById(POPUP_PREBOOT_SHELL_ID)
  if (!shell) {
    return
  }

  shell.dataset.popupPrebootAdopted = 'true'
  shell.setAttribute('hidden', '')
}

export function hasPopupPrebootSearchShell(documentRef: Document = document): boolean {
  const shell = documentRef.getElementById(POPUP_PREBOOT_SHELL_ID)
  return Boolean(shell && !shell.hasAttribute('hidden'))
}

export function applyPopupPrebootSnapshotToInput(
  input: PopupPrebootWritableInput,
  snapshot: PopupPrebootSearchSnapshot
): void {
  const value = normalizePopupPrebootSearchValue(snapshot.value)
  input.value = value

  const selectionStart = clampSelectionIndex(snapshot.selectionStart, value)
  const selectionEnd = clampSelectionIndex(snapshot.selectionEnd, value)
  if (
    selectionStart === null ||
    selectionEnd === null ||
    typeof input.setSelectionRange !== 'function'
  ) {
    return
  }

  input.setSelectionRange(
    selectionStart,
    selectionEnd,
    normalizeSelectionDirection(snapshot.selectionDirection) || 'none'
  )
}

export function getPopupPrebootKeyboardEdit(
  event: PopupPrebootKeyboardEventLike
): PopupPrebootKeyboardEdit | null {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return null
  }

  if (event.key === 'Backspace') {
    return { type: 'deleteContentBackward' }
  }

  if (event.key === 'Delete') {
    return { type: 'deleteContentForward' }
  }

  if (event.key.length === 1) {
    return { text: event.key, type: 'insertText' }
  }

  return null
}

export function applyPopupPrebootKeyboardEdit(
  input: PopupPrebootWritableInput,
  edit: PopupPrebootKeyboardEdit
): void {
  const value = normalizePopupPrebootSearchValue(input.value)
  const selectionStart = clampSelectionIndex(input.selectionStart, value) ?? value.length
  const selectionEnd = clampSelectionIndex(input.selectionEnd, value) ?? selectionStart
  const start = Math.min(selectionStart, selectionEnd)
  const end = Math.max(selectionStart, selectionEnd)

  if (edit.type === 'insertText') {
    const nextValue = normalizePopupPrebootSearchValue(`${value.slice(0, start)}${edit.text}${value.slice(end)}`)
    const nextCaret = Math.min(start + edit.text.length, nextValue.length)
    setPopupPrebootInputValue(input, nextValue, nextCaret)
    return
  }

  if (edit.type === 'deleteContentBackward') {
    const deleteStart = start === end ? Math.max(0, start - 1) : start
    const nextValue = `${value.slice(0, deleteStart)}${value.slice(end)}`
    setPopupPrebootInputValue(input, nextValue, deleteStart)
    return
  }

  const deleteEnd = start === end ? Math.min(value.length, end + 1) : end
  const nextValue = `${value.slice(0, start)}${value.slice(deleteEnd)}`
  setPopupPrebootInputValue(input, nextValue, start)
}

function createEmptyPopupPrebootSearchSnapshot(): PopupPrebootSearchSnapshot {
  return {
    active: false,
    selectionDirection: null,
    selectionEnd: null,
    selectionStart: null,
    value: ''
  }
}

function setPopupPrebootInputValue(
  input: PopupPrebootWritableInput,
  value: string,
  caret: number
): void {
  input.value = value
  if (typeof input.setSelectionRange === 'function') {
    input.setSelectionRange(caret, caret, 'none')
    return
  }

  input.selectionStart = caret
  input.selectionEnd = caret
  input.selectionDirection = 'none'
}

function normalizePopupPrebootSearchValue(value: unknown): string {
  return String(value || '').slice(0, MAX_PREBOOT_QUERY_LENGTH)
}

function clampSelectionIndex(value: number | null | undefined, text: string): number | null {
  if (value === null || typeof value === 'undefined') {
    return null
  }

  const index = Math.round(Number(value))
  if (!Number.isFinite(index)) {
    return null
  }

  return Math.max(0, Math.min(index, text.length))
}

function normalizeSelectionDirection(
  value: string | null | undefined
): 'backward' | 'forward' | 'none' | null {
  if (value === 'backward' || value === 'forward' || value === 'none') {
    return value
  }

  return null
}

function isEditableEventTarget(target: EventTarget | null | undefined): boolean {
  if (!(target instanceof Element)) {
    return false
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return !target.readOnly && !target.disabled
  }

  if (target instanceof HTMLSelectElement) {
    return !target.disabled
  }

  return target.hasAttribute('contenteditable')
}
