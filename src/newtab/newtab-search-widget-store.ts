import { useSyncExternalStore, type FocusEvent, type FormEvent, type KeyboardEvent } from 'react'

const noop = () => undefined

export interface SearchWidgetButtonState {
  ariaLabel: string
  label: string
  title: string
}

export interface SearchWidgetNaturalButtonState extends SearchWidgetButtonState {
  active: boolean
  fallback: boolean
  pending: boolean
}

export interface SearchWidgetEngineButtonState extends SearchWidgetButtonState {
  disabled: boolean
  expanded?: boolean
}

export interface SearchWidgetShellState {
  ariaLabel: string
  autoVerticalCenter: boolean
  backgroundAlpha: string
  height: number
  inputAriaLabel: string
  offsetY: number
  placeholder: string
  width: number
}

export interface SearchWidgetButtonStates {
  engine: SearchWidgetEngineButtonState
  natural: SearchWidgetNaturalButtonState
}

export interface SearchWidgetPanelState {
  panelVisible: boolean
  suggestionsVisible: boolean
}

export interface SearchWidgetActionState {
  canSubmit: boolean
  hasInputValue: boolean
}

export interface SearchWidgetComboboxState {
  activeDescendantId: string
  expanded: boolean
}

export interface SearchWidgetEngineMenuState extends SearchEngineMenuState {
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
  open: boolean
}

export interface SearchWidgetInteractionState {
  onClear: () => void
  onEngineKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  onEngineToggle: () => void
  onInputFocus: () => void
  onInputInput: () => void
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onRootBlur: (event: FocusEvent<HTMLDivElement>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onToggleNatural: () => void
}

export interface SearchEngineMenuItemViewModel {
  active: boolean
  id: string
  label: string
  onSelect: () => void | Promise<void>
}

export interface SearchEngineMenuState {
  hint: string
  items: SearchEngineMenuItemViewModel[]
}

export interface SearchChipViewModel {
  kind: string
  label: string
}

export interface SearchSuggestionViewModel {
  active: boolean
  ariaLabel: string
  command: boolean
  elementId: string
  id: string
  mark: string
  meta: string
  onSelect: () => void
  title: string
}

export type SearchHintState =
  | { type: 'empty' }
  | { type: 'text'; text: string }
  | { type: 'webFallback'; ariaLabel: string; label: string; onSelect: () => void; title: string }

export interface SavedSearchItemViewModel {
  id: string
  label: string
  onApply: () => void
  onDelete: () => void | Promise<void>
  query: string
}

export interface SavedSearchesState {
  canSaveCurrent: boolean
  error: string
  hasCurrentSaved: boolean
  items: SavedSearchItemViewModel[]
  onSaveCurrent: () => void | Promise<void>
  show: boolean
}

export interface NewtabSearchWidgetNodes {
  engineButton: HTMLButtonElement | null
  engineMenu: HTMLElement | null
  input: HTMLInputElement | null
  slot: HTMLElement | null
}

export interface NewtabSearchWidgetView {
  action: SearchWidgetActionState
  buttons: SearchWidgetButtonStates
  chips: SearchChipViewModel[]
  combobox: SearchWidgetComboboxState
  engineMenu: SearchWidgetEngineMenuState
  hint: SearchHintState
  interactions: SearchWidgetInteractionState
  onNodesChange?: (nodes: NewtabSearchWidgetNodes) => void
  panel: SearchWidgetPanelState
  savedSearches: SavedSearchesState
  sectionLabel: string
  shell: SearchWidgetShellState
  suggestions: SearchSuggestionViewModel[]
}

let searchWidgetView: NewtabSearchWidgetView | null = null
let searchWidgetNodes: NewtabSearchWidgetNodes = createEmptySearchWidgetNodes()
const listeners = new Set<() => void>()

function subscribeNewtabSearchWidget(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitNewtabSearchWidgetChange(): void {
  listeners.forEach((listener) => listener())
}

export function createEmptySavedSearchesState(): SavedSearchesState {
  return {
    canSaveCurrent: false,
    error: '',
    hasCurrentSaved: false,
    items: [],
    onSaveCurrent: noop,
    show: false
  }
}

export function createDefaultSearchWidgetInteractionState(): SearchWidgetInteractionState {
  return {
    onClear: noop,
    onEngineKeyDown: noop,
    onEngineToggle: noop,
    onInputFocus: noop,
    onInputInput: noop,
    onInputKeyDown: noop,
    onRootBlur: noop,
    onSubmit: (event) => {
      event.preventDefault()
    },
    onToggleNatural: noop
  }
}

export function createEmptySearchWidgetNodes(): NewtabSearchWidgetNodes {
  return {
    engineButton: null,
    engineMenu: null,
    input: null,
    slot: null
  }
}

export function dispatchNewtabSearchWidgetView(view: NewtabSearchWidgetView | null): void {
  searchWidgetView = view
  if (!view) {
    setNewtabSearchWidgetNodes(createEmptySearchWidgetNodes())
  }
  emitNewtabSearchWidgetChange()
}

export function patchNewtabSearchWidgetView(patch: Partial<NewtabSearchWidgetView>): void {
  if (!searchWidgetView) {
    return
  }

  searchWidgetView = {
    ...searchWidgetView,
    ...patch
  }
  emitNewtabSearchWidgetChange()
}

export function getNewtabSearchWidgetView(): NewtabSearchWidgetView | null {
  return searchWidgetView
}

export function setNewtabSearchWidgetNodes(nodes: NewtabSearchWidgetNodes): void {
  searchWidgetNodes = { ...nodes }
}

export function getNewtabSearchWidgetNodes(): NewtabSearchWidgetNodes {
  return searchWidgetNodes
}

export function useNewtabSearchWidgetView(): NewtabSearchWidgetView | null {
  return useSyncExternalStore(
    subscribeNewtabSearchWidget,
    () => searchWidgetView,
    () => null
  )
}
