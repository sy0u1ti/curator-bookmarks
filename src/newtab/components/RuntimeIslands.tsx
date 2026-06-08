import { useEffect, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import {
  Button,
  Icon,
  InlineDialogPanel,
  InlineMenuList,
  Input,
  Select,
  SwitchControl,
  ToastList,
  type IconName,
  type InlineMenuAction
} from '../../ui'
import type { NewTabSourceNavigationItem } from '../content-state'
import type { SpeedDialEmptyState } from '../speed-dial-types'
import type { NewTabTimeSettings } from '../time-settings'

const roots = new WeakMap<Element, Root>()
const searchWidgetActionStores = new WeakMap<Element, SearchWidgetActionStore>()
const searchWidgetButtonStores = new WeakMap<Element, SearchWidgetButtonStore>()
const searchWidgetComboboxStores = new WeakMap<Element, SearchWidgetComboboxStore>()
const searchWidgetEngineMenuStores = new WeakMap<Element, SearchWidgetEngineMenuStore>()
const searchWidgetInteractionStores = new WeakMap<Element, SearchWidgetInteractionStore>()
const searchWidgetPanelStores = new WeakMap<Element, SearchWidgetPanelStore>()
const clockWidgetStores = new WeakMap<Element, ClockWidgetStore>()

const noop = () => undefined

function renderIsland(container: Element, node: React.ReactNode): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(node)
  })
}

export interface NewTabOnboardingState {
  onOpenFolderSettings: () => void
  onSkip: () => void
}

export interface DeleteToastState {
  bookmarkLabel: string
  busy: boolean
  detail: string
}

export interface ClockWidgetState {
  ariaLabel: string
  dateDateTime: string
  dateText: string
  periodText: string
  settings: NewTabTimeSettings
  timeDateTime: string
  timeText: string
}

export interface EmptyFolderState {
  folderId: string
  onOpenFolderSettings: () => void
}

export interface SourceNavigationState {
  items: NewTabSourceNavigationItem[]
  onFocusSource: (anchorId: string) => void
}

export interface QuickAccessLinkViewModel {
  badge: string
  detail: string
  id: string
  reason: 'pinned' | 'frequent' | 'added'
  title: string
  url: string
}

export interface QuickAccessGroupViewModel {
  items: QuickAccessLinkViewModel[]
  label: string
}

export interface QuickAccessPanelState {
  groups: QuickAccessGroupViewModel[]
}

export interface SpeedDialCardViewModel {
  customIcon: boolean
  detail: string
  dragging: boolean
  fallbackLabel: string
  favicon: {
    fetchpriority: 'high' | 'auto'
    loading: 'eager' | 'lazy'
    src: string
  }
  id: string
  title: string
  url: string
}

export type SpeedDialContentState =
  | { type: 'loading'; label: string }
  | { type: 'empty'; state: SpeedDialEmptyState }
  | { type: 'items'; busy: boolean; items: SpeedDialCardViewModel[] }

export interface SpeedDialPanelState {
  ariaBusy: boolean
  content: SpeedDialContentState
  meta: string
  metaTone?: 'error' | ''
}

export interface BookmarkTileViewModel {
  customIcon: boolean
  dragging: boolean
  fallbackLabel: string
  favicon: {
    fetchpriority: 'high' | 'low'
    loading: 'eager' | 'lazy'
    src: string
  }
  folderId: string
  id: string
  title: string
  url: string
}

export type BookmarkMenuActionIcon = 'trash' | 'refresh' | 'save' | 'plus' | 'copy' | 'pin'

export interface BookmarkMenuTextFieldViewModel {
  disabled: boolean
  id: string
  label: string
  onChange: (value: string) => void
  onEnter: () => void | Promise<void>
  placeholder: string
  type: 'text' | 'url'
  value: string
}

export interface BookmarkMenuActionViewModel {
  actionId?: string
  ariaLabel: string
  disabled: boolean
  icon: BookmarkMenuActionIcon
  id: string
  label: string
  onSelect: () => void | Promise<void>
  variant?: 'danger' | ''
}

export interface BookmarkEditMenuViewModel {
  actions: BookmarkMenuActionViewModel[]
  error: string
  fields: [BookmarkMenuTextFieldViewModel, BookmarkMenuTextFieldViewModel]
  iconMode: 'website' | 'custom'
  iconModeDisabled: boolean
  onIconModeChange: (value: string) => void | Promise<void>
  status: string
  statusTone?: 'warning' | ''
  x: number
  y: number
}

export interface BookmarkAddMenuViewModel {
  actions: BookmarkMenuActionViewModel[]
  error: string
  expanded: boolean
  fields: [BookmarkMenuTextFieldViewModel, BookmarkMenuTextFieldViewModel]
  onExpand: () => void | Promise<void>
  x: number
  y: number
}

export interface FeaturedBackgroundPickerCardViewModel {
  favorite: boolean
  fetchpriority: 'high' | 'auto'
  id: string
  imageUrl: string
  initialPreviewUrl: string
  previewAccentColor: string
  previewFallbackUrls: string[]
  remotePreviewUrl: string
  resolutionState: 'ready' | 'pending'
  resolutionText: string
  selected: boolean
  title: string
}

export interface FeaturedBackgroundPickerGridSectionViewModel {
  cards: FeaturedBackgroundPickerCardViewModel[]
  emptyText: string
  title: string
}

export interface FeaturedBackgroundPickerProviderGroupViewModel {
  cards: FeaturedBackgroundPickerCardViewModel[]
  emptyText: string
  title: string
}

export type FeaturedBackgroundPickerSectionViewModel =
  | { type: 'grid'; section: FeaturedBackgroundPickerGridSectionViewModel }
  | { type: 'providers'; title: string; groups: FeaturedBackgroundPickerProviderGroupViewModel[] }

export type FeaturedBackgroundPickerState =
  | { type: 'state'; label: string }
  | { type: 'sections'; sections: FeaturedBackgroundPickerSectionViewModel[] }

export interface FolderSectionHeaderState {
  bookmarkCount: number
  dragging: boolean
  folderId: string
  path: string
  title: string
}

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
  placeholder: string
  offsetY: number
  width: number
  engine: SearchWidgetEngineButtonState
  natural: SearchWidgetNaturalButtonState
}

export type SearchWidgetButtonStates = Pick<SearchWidgetShellState, 'engine' | 'natural'>

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
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void
  open: boolean
}

export interface SearchWidgetInteractionState {
  onClear: () => void
  onEngineKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
  onEngineToggle: () => void
  onInputFocus: () => void
  onInputInput: () => void
  onInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onRootBlur: (event: React.FocusEvent<HTMLDivElement>) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onToggleNatural: () => void
}

interface SearchWidgetActionStore {
  getSnapshot: () => SearchWidgetActionState
  setState: (state: SearchWidgetActionState) => void
  subscribe: (listener: () => void) => () => void
}

interface SearchWidgetButtonStore {
  getSnapshot: () => SearchWidgetButtonStates
  setState: (state: SearchWidgetButtonStates) => void
  subscribe: (listener: () => void) => () => void
}

interface SearchWidgetComboboxStore {
  getSnapshot: () => SearchWidgetComboboxState
  setState: (state: SearchWidgetComboboxState) => void
  subscribe: (listener: () => void) => () => void
}

interface SearchWidgetEngineMenuStore {
  getSnapshot: () => SearchWidgetEngineMenuState
  setState: (state: SearchWidgetEngineMenuState) => void
  subscribe: (listener: () => void) => () => void
}

interface SearchWidgetInteractionStore {
  getSnapshot: () => SearchWidgetInteractionState
  setState: (state: SearchWidgetInteractionState) => void
  subscribe: (listener: () => void) => () => void
}

interface SearchWidgetPanelStore {
  getSnapshot: () => SearchWidgetPanelState
  setState: (state: SearchWidgetPanelState) => void
  subscribe: (listener: () => void) => () => void
}

interface ClockWidgetStore {
  getSnapshot: () => ClockWidgetState
  setState: (state: ClockWidgetState) => void
  subscribe: (listener: () => void) => () => void
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

export interface ModuleSettingRowViewModel {
  description: string
  enabled: boolean
  index: number
  key: string
  label: string
  total: number
}

export type SelectedFolderSourceListState =
  | { type: 'empty'; message: string }
  | { type: 'items'; items: SelectedFolderSourceItemViewModel[] }

export interface SelectedFolderSourceItemViewModel {
  affectedCount: number
  folderId: string
  path: string
  stats: string
  title: string
}

export type FolderCandidateListState =
  | { type: 'empty'; message: string }
  | { type: 'items'; items: FolderCandidateItemViewModel[] }

export interface FolderCandidateItemViewModel {
  active: boolean
  badge: string
  folderId: string
  path: string
  selected: boolean
  stats: string
  title: string
}

export interface BookmarkContentStyleState {
  columnGap: number
  columns: number
  fixedGridWidth: number
  folderGap: number
  iconShellSize: number
  layoutMode: string
  pageWidth: number
  reordering: boolean
  rowGap: number
  showTitles: boolean
  tileWidth: number
  titleLines: number
  verticalCenter: boolean
}

export interface BookmarkContentViewModel {
  content: BookmarkContentStyleState
  modules: HTMLElement[]
  reorderStatus: BookmarkReorderStatusViewModel | null
  sections: BookmarkFolderSectionViewModel[]
  sourceNavigation: HTMLElement | null
}

export interface BookmarkFolderSectionViewModel {
  anchorId: string
  bookmarkCount: number
  dragging: boolean
  folderId: string
  grid: BookmarkFolderGridViewModel | null
  onOpenFolderSettings: () => void
  path: string
  title: string
}

export interface BookmarkFolderGridViewModel {
  ariaLabel: string
  busy: boolean
  folderId: string
  onMount: (node: HTMLElement | null) => void
}

export interface BookmarkReorderStatusViewModel {
  message: string
  tone: string
}

export interface BookmarkGridPlaceholderViewModel {
  folderTitle: string
  remainingCount: number
}

export interface FeaturedBackgroundHoverPreviewViewModel {
  hidden: boolean
}

export function createSearchWidgetIslandElement(state: SearchWidgetShellState): HTMLElement {
  const slot = document.createElement('section')
  slot.className = 'newtab-search-slot'
  slot.style.setProperty('--search-width', `${state.width}vw`)
  slot.style.setProperty('--search-height', `${state.height}px`)
  slot.style.setProperty('--search-offset-y', `${state.offsetY}px`)
  slot.dataset.searchAutoVerticalCenter = String(state.autoVerticalCenter)
  slot.setAttribute('aria-label', state.ariaLabel)
  const buttonStore = getSearchWidgetButtonStore(slot, {
    engine: state.engine,
    natural: state.natural
  })
  const actionStore = getSearchWidgetActionStore(slot, {
    canSubmit: false,
    hasInputValue: false
  })
  const comboboxStore = getSearchWidgetComboboxStore(slot, {
    activeDescendantId: '',
    expanded: false
  })
  const engineMenuStore = getSearchWidgetEngineMenuStore(slot, {
    hint: '',
    items: [],
    open: false
  })
  const interactionStore = getSearchWidgetInteractionStore(slot, createDefaultSearchWidgetInteractionState())
  const panelStore = getSearchWidgetPanelStore(slot, {
    panelVisible: false,
    suggestionsVisible: true
  })
  actionStore.setState({
    canSubmit: false,
    hasInputValue: false
  })
  comboboxStore.setState({
    activeDescendantId: '',
    expanded: false
  })
  engineMenuStore.setState({
    hint: '',
    items: [],
    open: false
  })
  interactionStore.setState(createDefaultSearchWidgetInteractionState())
  buttonStore.setState({
    engine: state.engine,
    natural: state.natural
  })
  panelStore.setState({
    panelVisible: false,
    suggestionsVisible: true
  })
  renderIsland(slot, (
    <SearchWidgetShell
      actionStore={actionStore}
      buttonStore={buttonStore}
      comboboxStore={comboboxStore}
      engineMenuStore={engineMenuStore}
      interactionStore={interactionStore}
      panelStore={panelStore}
      state={state}
    />
  ))
  return slot
}

export function renderSearchWidgetActionStateIsland(
  container: HTMLElement,
  state: SearchWidgetActionState
): void {
  const actionStore = getSearchWidgetActionStore(container, state)
  flushSync(() => {
    actionStore.setState(state)
  })
}

export function renderSearchWidgetButtonStatesIsland(
  container: HTMLElement,
  state: SearchWidgetButtonStates
): void {
  const buttonStore = getSearchWidgetButtonStore(container, state)
  flushSync(() => {
    buttonStore.setState(state)
  })
}

export function renderSearchWidgetComboboxStateIsland(
  container: HTMLElement,
  state: SearchWidgetComboboxState
): void {
  const comboboxStore = getSearchWidgetComboboxStore(container, state)
  flushSync(() => {
    comboboxStore.setState(state)
  })
}

export function renderSearchWidgetEngineMenuStateIsland(
  container: HTMLElement,
  state: SearchWidgetEngineMenuState
): void {
  const engineMenuStore = getSearchWidgetEngineMenuStore(container, state)
  flushSync(() => {
    engineMenuStore.setState(state)
  })
}

export function renderSearchWidgetInteractionStateIsland(
  container: HTMLElement,
  state: SearchWidgetInteractionState
): void {
  const interactionStore = getSearchWidgetInteractionStore(container, state)
  flushSync(() => {
    interactionStore.setState(state)
  })
}

export function renderSearchWidgetPanelStateIsland(
  container: HTMLElement,
  state: SearchWidgetPanelState
): void {
  const panelStore = getSearchWidgetPanelStore(container, state)
  flushSync(() => {
    panelStore.setState(state)
  })
}

export function createClockWidgetIslandElement(state: ClockWidgetState): HTMLElement {
  const clock = document.createElement('section')
  clock.className = 'newtab-clock'
  syncClockWidgetHost(clock, state)
  const clockStore = getClockWidgetStore(clock, state)
  renderIsland(clock, <ClockWidget store={clockStore} />)
  return clock
}

export function renderClockWidgetStateIsland(
  container: HTMLElement,
  state: ClockWidgetState
): void {
  syncClockWidgetHost(container, state)
  const clockStore = getClockWidgetStore(container, state)
  flushSync(() => {
    clockStore.setState(state)
  })
}

export function createClockSpacerIslandElement(): HTMLElement {
  const spacer = document.createElement('div')
  spacer.className = 'newtab-clock-spacer'
  return spacer
}

export function createNewTabOnboardingIslandElement(state: NewTabOnboardingState): HTMLElement {
  const section = document.createElement('section')
  section.className = 'newtab-onboarding-strip'
  section.setAttribute('aria-label', 'Curator 首次使用引导')
  renderIsland(section, <NewTabOnboardingStrip state={state} />)
  return section
}

export function createDeleteToastIslandElement(state: DeleteToastState): HTMLElement {
  const toast = document.createElement('section')
  toast.className = 'newtab-delete-toast'
  renderIsland(toast, <DeleteToast state={state} />)
  return toast
}

export function mountDeleteToastIslandElement(toast: HTMLElement): void {
  document.body.append(toast)
}

export function createSourceNavigationIslandElement(state: SourceNavigationState): HTMLElement {
  const nav = document.createElement('nav')
  nav.className = 'source-navigation'
  nav.setAttribute('aria-label', '书签来源导航')
  renderIsland(nav, <SourceNavigation state={state} />)
  return nav
}

export function createQuickAccessPanelIslandElement(state: QuickAccessPanelState): HTMLElement {
  const panel = document.createElement('section')
  panel.className = 'newtab-quick-access'
  panel.setAttribute('aria-label', 'Curator 常用和新近添加书签')
  renderIsland(panel, <QuickAccessPanel state={state} />)
  return panel
}

export function createPortalPanelIslandElement(content: HTMLElement): HTMLElement {
  const panel = document.createElement('section')
  panel.className = 'newtab-portal quick-only'
  panel.setAttribute('aria-label', 'Curator 常用和新近添加书签')
  renderIsland(panel, <PortalPanel content={content} />)
  return panel
}

export function createSpeedDialPanelIslandElement(state: SpeedDialPanelState): HTMLElement {
  const section = document.createElement('section')
  section.className = 'newtab-speed-dial'
  section.setAttribute('aria-label', 'Speed Dial')
  renderSpeedDialPanelIsland(section, state)
  return section
}

export function renderSpeedDialPanelIsland(container: HTMLElement, state: SpeedDialPanelState): void {
  container.setAttribute('aria-busy', String(state.ariaBusy))
  renderIsland(container, <SpeedDialPanel state={state} />)
}

export function createBookmarkTileIslandElement(state: BookmarkTileViewModel): HTMLAnchorElement {
  const tile = document.createElement('a')
  renderBookmarkTileIslandElement(tile, state)
  return tile
}

export function renderBookmarkTileIslandElement(
  tile: HTMLAnchorElement,
  state: BookmarkTileViewModel
): void {
  tile.className = state.dragging ? 'bookmark-tile dragging' : 'bookmark-tile'
  tile.href = state.url
  tile.title = state.title
  tile.draggable = false
  tile.dataset.bookmarkId = state.id
  tile.dataset.folderId = state.folderId
  renderIsland(tile, <BookmarkTile state={state} />)
}

export function appendBookmarkTileIslandElements(
  container: HTMLElement,
  states: BookmarkTileViewModel[],
  { before }: { before?: ChildNode | null } = {}
): HTMLAnchorElement[] {
  const fragment = document.createDocumentFragment()
  const tiles = states.map((state) => {
    const tile = createBookmarkTileIslandElement(state)
    fragment.append(tile)
    return tile
  })

  if (before?.parentNode === container) {
    container.insertBefore(fragment, before)
  } else {
    container.append(fragment)
  }

  return tiles
}

export function createBookmarkEditMenuIslandElement(state: BookmarkEditMenuViewModel): HTMLElement {
  const menu = document.createElement('section')
  menu.className = 'bookmark-edit-menu'
  menu.style.left = `${state.x}px`
  menu.style.top = `${state.y}px`
  renderIsland(menu, <BookmarkEditMenu state={state} />)
  return menu
}

export function mountBookmarkEditMenuIslandElement(menu: HTMLElement): void {
  document.body.append(menu)
}

export function createBookmarkAddMenuIslandElement(state: BookmarkAddMenuViewModel): HTMLElement {
  const menu = document.createElement('section')
  menu.className = state.expanded ? 'bookmark-add-menu expanded' : 'bookmark-add-menu'
  menu.style.left = `${state.x}px`
  menu.style.top = `${state.y}px`
  renderIsland(menu, <BookmarkAddMenu state={state} />)
  return menu
}

export function mountBookmarkAddMenuIslandElement(menu: HTMLElement): void {
  document.body.append(menu)
}

export function renderFeaturedBackgroundPickerIsland(
  container: HTMLElement,
  state: FeaturedBackgroundPickerState
): void {
  renderIsland(container, <FeaturedBackgroundPicker state={state} />)
}

export function renderNewTabSearchChipsIsland(container: HTMLElement, chips: SearchChipViewModel[]): void {
  renderIsland(container, <SearchChips chips={chips} />)
}

export function renderNewTabSearchSuggestionsIsland(
  container: HTMLElement,
  suggestions: SearchSuggestionViewModel[]
): void {
  renderIsland(container, <SearchSuggestions suggestions={suggestions} />)
}

export function renderNewTabSearchSectionLabelIsland(container: HTMLElement, label: string): void {
  renderIsland(container, <SearchSectionLabel label={label} />)
}

export function renderNewTabSearchHintIsland(container: HTMLElement, state: SearchHintState): void {
  renderIsland(container, <SearchHint state={state} />)
}

export function renderNewTabSavedSearchesIsland(container: HTMLElement, state: SavedSearchesState): void {
  renderIsland(container, <SavedSearches state={state} />)
}

export function createModuleSettingRowIslandElement(state: ModuleSettingRowViewModel): HTMLElement {
  const row = document.createElement('div')
  row.className = 'setting-row newtab-module-setting-row'
  row.dataset.moduleSettingRow = state.key
  renderIsland(row, <ModuleSettingRow state={state} />)
  return row
}

export function renderModuleSettingRowIsland(
  container: HTMLElement,
  state: ModuleSettingRowViewModel
): void {
  container.replaceChildren(createModuleSettingRowIslandElement(state))
}

export function renderSelectedFolderSourceListIsland(
  container: HTMLElement,
  state: SelectedFolderSourceListState
): void {
  renderIsland(container, <SelectedFolderSourceList state={state} />)
}

export function renderFolderCandidateListIsland(container: HTMLElement, state: FolderCandidateListState): void {
  renderIsland(container, <FolderCandidateList state={state} />)
}

export function createBookmarkContentIslandElement(state: BookmarkContentViewModel): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-content'
  applyBookmarkContentHostAttributes(view, state.content)
  renderIsland(view, <BookmarkContent state={state} />)
  return view
}

export function replaceBookmarkContentIslandChildren(
  target: HTMLElement,
  source: HTMLElement
): void {
  target.replaceChildren(...Array.from(source.childNodes))
  copyElementPresentationState(source, target)
}

export function createBookmarkGridPlaceholderIslandElement(state: BookmarkGridPlaceholderViewModel): HTMLElement {
  const placeholder = document.createElement('div')
  placeholder.className = 'bookmark-grid-placeholder'
  renderBookmarkGridPlaceholderIslandElement(placeholder, state)
  return placeholder
}

export function renderBookmarkGridPlaceholderIslandElement(
  placeholder: HTMLElement,
  state: BookmarkGridPlaceholderViewModel
): void {
  placeholder.dataset.pendingBookmarks = String(Math.max(0, state.remainingCount))
  placeholder.setAttribute('role', 'status')
  placeholder.setAttribute('aria-live', 'polite')
  placeholder.title = `${state.folderTitle || '文件夹'}还有 ${state.remainingCount} 个书签将在滚动到此处时载入`
  renderIsland(placeholder, <BookmarkGridPlaceholder state={state} />)
}

export function mountBookmarkGridPlaceholderIslandElement(
  container: HTMLElement,
  placeholder: HTMLElement
): void {
  container.append(placeholder)
}

export function createFeaturedBackgroundHoverPreviewIslandElement(
  state: FeaturedBackgroundHoverPreviewViewModel
): HTMLElement {
  const preview = document.createElement('div')
  preview.className = 'featured-wallpaper-hover-preview'
  preview.setAttribute('role', 'img')
  preview.setAttribute('aria-hidden', String(state.hidden))
  renderIsland(preview, <FeaturedBackgroundHoverPreview />)
  return preview
}

export function mountFeaturedBackgroundHoverPreviewIslandElement(
  container: HTMLElement | null,
  preview: HTMLElement
): void {
  container?.append(preview)
}

export function mountNewTabDragGhostBridge(ghost: HTMLElement): void {
  document.body.append(ghost)
}

function applyBookmarkContentHostAttributes(view: HTMLElement, state: BookmarkContentStyleState): void {
  view.style.setProperty('--icon-page-width', `${state.pageWidth}px`)
  view.style.setProperty('--icon-column-gap', `${state.columnGap}px`)
  view.style.setProperty('--icon-row-gap', `${state.rowGap}px`)
  view.style.setProperty('--icon-folder-gap', `${state.folderGap}px`)
  view.style.setProperty('--icon-tile-width', `${state.tileWidth}px`)
  view.style.setProperty('--icon-shell-size', `${state.iconShellSize}px`)
  view.style.setProperty('--icon-fixed-grid-width', `${state.fixedGridWidth}px`)
  view.style.setProperty('--icon-columns', String(state.columns))
  view.style.setProperty('--icon-title-lines', String(state.titleLines))
  view.dataset.iconLayoutMode = state.layoutMode
  view.dataset.iconShowTitles = String(state.showTitles)
  view.dataset.iconVerticalCenter = String(state.verticalCenter)
  view.setAttribute('aria-busy', state.reordering ? 'true' : 'false')
}

function copyElementPresentationState(source: HTMLElement, target: HTMLElement): void {
  target.className = source.className
  target.removeAttribute('style')
  const sourceAttributeNames = new Set(source.getAttributeNames())
  for (const name of target.getAttributeNames()) {
    if (name !== 'class' && !sourceAttributeNames.has(name)) {
      target.removeAttribute(name)
    }
  }

  for (const name of source.getAttributeNames()) {
    if (name === 'class') {
      continue
    }

    target.setAttribute(name, source.getAttribute(name) || '')
  }
}

function getSearchWidgetActionStore(
  host: Element,
  initialState: SearchWidgetActionState
): SearchWidgetActionStore {
  let store = searchWidgetActionStores.get(host)
  if (store) {
    return store
  }

  let currentState = initialState
  const listeners = new Set<() => void>()
  store = {
    getSnapshot: () => currentState,
    setState: (state) => {
      currentState = state
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
  searchWidgetActionStores.set(host, store)
  return store
}

function getSearchWidgetButtonStore(
  host: Element,
  initialState: SearchWidgetButtonStates
): SearchWidgetButtonStore {
  let store = searchWidgetButtonStores.get(host)
  if (store) {
    return store
  }

  let currentState = initialState
  const listeners = new Set<() => void>()
  store = {
    getSnapshot: () => currentState,
    setState: (state) => {
      currentState = state
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
  searchWidgetButtonStores.set(host, store)
  return store
}

function getSearchWidgetComboboxStore(
  host: Element,
  initialState: SearchWidgetComboboxState
): SearchWidgetComboboxStore {
  let store = searchWidgetComboboxStores.get(host)
  if (store) {
    return store
  }

  let currentState = initialState
  const listeners = new Set<() => void>()
  store = {
    getSnapshot: () => currentState,
    setState: (state) => {
      currentState = state
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
  searchWidgetComboboxStores.set(host, store)
  return store
}

function getSearchWidgetEngineMenuStore(
  host: Element,
  initialState: SearchWidgetEngineMenuState
): SearchWidgetEngineMenuStore {
  let store = searchWidgetEngineMenuStores.get(host)
  if (store) {
    return store
  }

  let currentState = initialState
  const listeners = new Set<() => void>()
  store = {
    getSnapshot: () => currentState,
    setState: (state) => {
      currentState = state
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
  searchWidgetEngineMenuStores.set(host, store)
  return store
}

function getSearchWidgetInteractionStore(
  host: Element,
  initialState: SearchWidgetInteractionState
): SearchWidgetInteractionStore {
  let store = searchWidgetInteractionStores.get(host)
  if (store) {
    return store
  }

  let currentState = initialState
  const listeners = new Set<() => void>()
  store = {
    getSnapshot: () => currentState,
    setState: (state) => {
      currentState = state
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
  searchWidgetInteractionStores.set(host, store)
  return store
}

function getSearchWidgetPanelStore(
  host: Element,
  initialState: SearchWidgetPanelState
): SearchWidgetPanelStore {
  let store = searchWidgetPanelStores.get(host)
  if (store) {
    return store
  }

  let currentState = initialState
  const listeners = new Set<() => void>()
  store = {
    getSnapshot: () => currentState,
    setState: (state) => {
      currentState = state
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
  searchWidgetPanelStores.set(host, store)
  return store
}

function getClockWidgetStore(
  host: Element,
  initialState: ClockWidgetState
): ClockWidgetStore {
  let store = clockWidgetStores.get(host)
  if (store) {
    return store
  }

  let currentState = initialState
  const listeners = new Set<() => void>()
  store = {
    getSnapshot: () => currentState,
    setState: (state) => {
      currentState = state
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
  clockWidgetStores.set(host, store)
  return store
}

function syncClockWidgetHost(clock: HTMLElement, state: ClockWidgetState): void {
  const { settings } = state
  clock.style.setProperty('--clock-scale', String(settings.clockSize / 100))
  clock.dataset.clockDisplayMode = settings.displayMode
  clock.dataset.clockDensity = settings.density
  clock.dataset.clockShowSeconds = String(settings.showSeconds && settings.displayMode !== 'date')
  clock.dataset.clockHour12 = String(settings.hour12 && settings.displayMode !== 'date')
  clock.setAttribute('aria-label', state.ariaLabel)
}

function useSearchWidgetActionState(store: SearchWidgetActionStore): SearchWidgetActionState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

function useSearchWidgetButtonStates(store: SearchWidgetButtonStore): SearchWidgetButtonStates {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

function useSearchWidgetComboboxState(store: SearchWidgetComboboxStore): SearchWidgetComboboxState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

function useSearchWidgetEngineMenuState(store: SearchWidgetEngineMenuStore): SearchWidgetEngineMenuState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

function useSearchWidgetInteractionState(store: SearchWidgetInteractionStore): SearchWidgetInteractionState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

function useSearchWidgetPanelState(store: SearchWidgetPanelStore): SearchWidgetPanelState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

function useClockWidgetState(store: ClockWidgetStore): ClockWidgetState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

function createDefaultSearchWidgetInteractionState(): SearchWidgetInteractionState {
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

function SearchWidgetShell({
  actionStore,
  buttonStore,
  comboboxStore,
  engineMenuStore,
  interactionStore,
  panelStore,
  state
}: {
  actionStore: SearchWidgetActionStore
  buttonStore: SearchWidgetButtonStore
  comboboxStore: SearchWidgetComboboxStore
  engineMenuStore: SearchWidgetEngineMenuStore
  interactionStore: SearchWidgetInteractionStore
  panelStore: SearchWidgetPanelStore
  state: SearchWidgetShellState
}) {
  const interactions = useSearchWidgetInteractionState(interactionStore)
  const formStyle = {
    '--search-width': `${state.width}vw`,
    '--search-height': `${state.height}px`,
    '--search-bg-alpha': state.backgroundAlpha
  } as React.CSSProperties

  return (
    <div className="newtab-search-shell" onBlur={interactions.onRootBlur}>
      <form
        className="newtab-search"
        style={formStyle}
        role="search"
        aria-label={state.ariaLabel}
        onSubmit={interactions.onSubmit}
      >
        <Icon name="Search" className="newtab-search-icon" size={16} aria-hidden="true" />
        <SearchWidgetInput comboboxStore={comboboxStore} interactions={interactions} state={state} />
        <SearchWidgetClearButton actionStore={actionStore} onClear={interactions.onClear} />
        <SearchWidgetSeparator actionStore={actionStore} />
        <SearchWidgetNaturalButton buttonStore={buttonStore} onToggleNatural={interactions.onToggleNatural} />
        <SearchWidgetEngineButton
          buttonStore={buttonStore}
          onEngineKeyDown={interactions.onEngineKeyDown}
          onEngineToggle={interactions.onEngineToggle}
        />
        <SearchWidgetSubmitButton actionStore={actionStore} />
      </form>
      <SearchWidgetEngineMenu engineMenuStore={engineMenuStore} />
      <SearchWidgetSuggestionsPanel panelStore={panelStore} />
    </div>
  )
}

function SearchWidgetInput({
  comboboxStore,
  interactions,
  state
}: {
  comboboxStore: SearchWidgetComboboxStore
  interactions: SearchWidgetInteractionState
  state: SearchWidgetShellState
}) {
  const combobox = useSearchWidgetComboboxState(comboboxStore)

  return (
    <Input
      className="newtab-search-input"
      type="search"
      autoComplete="off"
      enterKeyHint="search"
      placeholder={state.placeholder}
      spellCheck={false}
      role="combobox"
      aria-label={state.inputAriaLabel}
      aria-autocomplete="list"
      aria-controls="newtab-search-suggestions"
      aria-expanded={combobox.expanded}
      aria-activedescendant={combobox.activeDescendantId || undefined}
      onFocus={interactions.onInputFocus}
      onInput={interactions.onInputInput}
      onKeyDown={interactions.onInputKeyDown}
      unstyled
    />
  )
}

function SearchWidgetClearButton({
  actionStore,
  onClear
}: {
  actionStore: SearchWidgetActionStore
  onClear: () => void
}) {
  const { hasInputValue } = useSearchWidgetActionState(actionStore)

  return (
    <Button
      className={hasInputValue ? 'newtab-search-clear' : 'newtab-search-clear hidden'}
      type="button"
      aria-label="清空搜索"
      onClick={onClear}
      unstyled
    >
      <Icon name="X" size={14} aria-hidden="true" />
    </Button>
  )
}

function SearchWidgetSeparator({ actionStore }: { actionStore: SearchWidgetActionStore }) {
  const { hasInputValue } = useSearchWidgetActionState(actionStore)

  return (
    <span
      className={hasInputValue ? 'newtab-search-separator' : 'newtab-search-separator hidden'}
      aria-hidden="true"
    />
  )
}

function SearchWidgetSubmitButton({ actionStore }: { actionStore: SearchWidgetActionStore }) {
  const { canSubmit } = useSearchWidgetActionState(actionStore)

  return (
    <Button
      className="newtab-search-submit"
      type="submit"
      aria-label="搜索网页"
      aria-disabled={!canSubmit}
      title="搜索网页"
      disabled={!canSubmit}
      unstyled
    >
      <Icon name="Search" className="newtab-search-submit-icon" size={14} aria-hidden="true" />
    </Button>
  )
}

function SearchWidgetNaturalButton({
  buttonStore,
  onToggleNatural
}: {
  buttonStore: SearchWidgetButtonStore
  onToggleNatural: () => void
}) {
  const { natural } = useSearchWidgetButtonStates(buttonStore)

  return (
    <Button
      className={getNaturalSearchButtonClassName(natural)}
      type="button"
      aria-pressed={natural.active}
      aria-label={natural.ariaLabel}
      title={natural.title}
      onClick={onToggleNatural}
      unstyled
    >
      {natural.label}
    </Button>
  )
}

function SearchWidgetEngineButton({
  buttonStore,
  onEngineKeyDown,
  onEngineToggle
}: {
  buttonStore: SearchWidgetButtonStore
  onEngineKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
  onEngineToggle: () => void
}) {
  const { engine } = useSearchWidgetButtonStates(buttonStore)

  return (
    <Button
      className="newtab-search-engine"
      type="button"
      aria-haspopup="menu"
      aria-expanded={engine.expanded ? 'true' : 'false'}
      aria-label={engine.ariaLabel}
      disabled={engine.disabled}
      title={engine.title}
      onClick={onEngineToggle}
      onKeyDown={onEngineKeyDown}
      unstyled
    >
      {engine.label}
    </Button>
  )
}

function SearchWidgetEngineMenu({ engineMenuStore }: { engineMenuStore: SearchWidgetEngineMenuStore }) {
  const engineMenu = useSearchWidgetEngineMenuState(engineMenuStore)
  if (!engineMenu.open) {
    return null
  }

  return (
    <div
      className="newtab-search-engine-menu"
      role="menu"
      aria-label="搜索引擎"
      onKeyDown={engineMenu.onKeyDown}
    >
      <SearchEngineMenu state={engineMenu} />
    </div>
  )
}

function SearchWidgetSuggestionsPanel({ panelStore }: { panelStore: SearchWidgetPanelStore }) {
  const panelState = useSearchWidgetPanelState(panelStore)

  return (
    <div
      id="newtab-search-suggestions-panel"
      className={panelState.panelVisible
        ? 'newtab-search-suggestions-panel'
        : 'newtab-search-suggestions-panel hidden'}
    >
      <div className="newtab-search-chips" aria-label="当前搜索条件" />
      <div className="newtab-search-section-label" />
      <div
        id="newtab-search-suggestions"
        className="newtab-search-suggestions"
        role="listbox"
        aria-label="匹配的书签"
        hidden={!panelState.suggestionsVisible}
      />
      <div className="newtab-search-hint" role="status" aria-live="polite" />
      <div className="newtab-saved-searches" aria-label="已保存搜索" />
    </div>
  )
}

function getNaturalSearchButtonClassName(state: SearchWidgetNaturalButtonState): string {
  return [
    'newtab-search-natural',
    state.active ? 'active' : '',
    state.pending ? 'pending' : '',
    state.fallback ? 'fallback' : ''
  ].filter(Boolean).join(' ')
}

function BookmarkContent({ state }: { state: BookmarkContentViewModel }) {
  return (
    <>
      <MountedElements elements={state.modules} />
      <MountedElement element={state.sourceNavigation} />
      <div className="bookmark-folder-sections">
        {state.sections.map((section) => (
          <BookmarkFolderSection section={section} key={section.folderId} />
        ))}
        {state.reorderStatus ? (
          <p className="bookmark-reorder-status" data-tone={state.reorderStatus.tone} role="status">
            {state.reorderStatus.message}
          </p>
        ) : null}
      </div>
    </>
  )
}

function BookmarkGridPlaceholder({ state }: { state: BookmarkGridPlaceholderViewModel }) {
  return <>继续载入 {state.remainingCount} 个书签</>
}

function FeaturedBackgroundHoverPreview() {
  return null
}

function PortalPanel({ content }: { content: HTMLElement }) {
  return <MountedElement element={content} />
}

function MountedElements({ elements }: { elements: HTMLElement[] }) {
  return (
    <>
      {elements.map((element, index) => (
        <MountedElement element={element} key={`${element.dataset.newtabModule || element.className || 'module'}:${index}`} />
      ))}
    </>
  )
}

function MountedElement({ element }: { element: HTMLElement | null }) {
  if (!element) {
    return null
  }

  return (
    <div
      hidden
      ref={(node) => {
        if (!node || element.parentElement === node.parentElement) {
          return
        }
        node.replaceWith(element)
      }}
    />
  )
}

function BookmarkFolderSection({ section }: { section: BookmarkFolderSectionViewModel }) {
  const className = section.dragging ? 'bookmark-folder-section dragging-folder' : 'bookmark-folder-section'

  return (
    <section
      className={className}
      id={section.anchorId}
      data-folder-section-id={section.folderId}
      tabIndex={-1}
    >
      <div className="folder-section-header-row">
        <FolderSectionHeader state={{
          bookmarkCount: section.bookmarkCount,
          dragging: section.dragging,
          folderId: section.folderId,
          path: section.path,
          title: section.title
        }} />
      </div>
      {section.grid ? (
        <nav
          className="bookmark-grid"
          data-bookmark-grid-folder-id={section.grid.folderId}
          aria-label={section.grid.ariaLabel}
          aria-busy={section.grid.busy}
          ref={section.grid.onMount}
        />
      ) : (
        <div className="bookmark-folder-empty-state">
          <EmptyFolder state={{
            folderId: section.folderId,
            onOpenFolderSettings: section.onOpenFolderSettings
          }} />
        </div>
      )}
    </section>
  )
}

function ModuleSettingRow({ state }: { state: ModuleSettingRowViewModel }) {
  return (
    <>
      <span className="setting-label-stack">
        <span>{state.label}</span>
        <small>{state.description}</small>
      </span>
      <span className="module-setting-controls">
        <Button
          className="module-setting-order-button"
          type="button"
          data-module-setting-move={state.key}
          data-module-setting-direction="up"
          disabled={state.index <= 0}
          aria-label={`上移模块：${state.label}`}
          title={`上移 ${state.label}`}
          unstyled
        >
          {'\u2191'}
        </Button>
        <Button
          className="module-setting-order-button"
          type="button"
          data-module-setting-move={state.key}
          data-module-setting-direction="down"
          disabled={state.index >= state.total - 1}
          aria-label={`下移模块：${state.label}`}
          title={`下移 ${state.label}`}
          unstyled
        >
          {'\u2193'}
        </Button>
        <label
          className="module-setting-switch-label"
          aria-label={`${state.enabled ? '隐藏' : '显示'}模块：${state.label}`}
        >
          <SwitchControl
            className="setting-switch"
            defaultChecked={state.enabled}
            inputAttributes={{ 'data-module-setting-toggle': state.key }}
            inputClassName="setting-switch-input"
            syncInputState
            thumbClassName="setting-switch-thumb"
            unstyled
          />
        </label>
      </span>
    </>
  )
}

function SelectedFolderSourceList({ state }: { state: SelectedFolderSourceListState }) {
  if (state.type === 'empty') {
    return <p className="folder-source-empty">{state.message}</p>
  }

  return (
    <>
      {state.items.map((item) => (
        <div className="folder-source-selected-item" key={item.folderId}>
          <span className="folder-source-selected-copy">
            <strong>{item.title}</strong>
            <span>{item.path}</span>
            <span>{item.stats}</span>
          </span>
          <Button
            className="folder-source-remove"
            type="button"
            data-folder-remove-id={item.folderId}
            aria-label={getFolderSourceRemoveLabel(item)}
            title={getFolderSourceRemoveLabel(item)}
            unstyled
          >
            <Icon name="X" size={12} aria-hidden="true" />
          </Button>
        </div>
      ))}
    </>
  )
}

function getFolderSourceRemoveLabel(item: SelectedFolderSourceItemViewModel): string {
  return `从新标签页移除「${item.title || '文件夹'}」，将隐藏 ${item.affectedCount} 个书签，不会删除书签`
}

function FolderCandidateList({ state }: { state: FolderCandidateListState }) {
  if (state.type === 'empty') {
    return (
      <p className="folder-source-empty" role="status" aria-live="polite">
        {state.message}
      </p>
    )
  }

  return (
    <>
      {state.items.map((item) => (
        <Button
          className={item.selected ? 'folder-candidate-card selected' : 'folder-candidate-card'}
          type="button"
          data-folder-candidate-id={item.folderId}
          tabIndex={item.active ? 0 : -1}
          title={item.path || item.title}
          role="option"
          aria-selected={item.selected}
          unstyled
          key={item.folderId}
        >
          <span className="folder-candidate-copy">
            <strong>{item.title || '未命名文件夹'}</strong>
            <span>{item.path || item.title || '未命名文件夹'}</span>
            <span>{item.stats}</span>
          </span>
          <span className="folder-candidate-badge">{item.badge}</span>
        </Button>
      ))}
    </>
  )
}

function SearchEngineMenu({ state }: { state: SearchEngineMenuState }) {
  return (
    <>
      <InlineMenuList
        actions={state.items.map((item) => ({
          id: item.id,
          label: item.label,
          className: item.active ? 'newtab-search-engine-item active' : 'newtab-search-engine-item',
          closeOnSelect: false,
          onSelect: item.onSelect,
          attributes: {
            role: 'menuitemradio',
            'aria-checked': String(item.active),
            tabIndex: '-1'
          }
        }))}
        className="newtab-search-engine-menu-items"
        label="搜索引擎"
      />
      <div className="newtab-search-engine-menu-hint">{state.hint}</div>
    </>
  )
}

function SearchChips({ chips }: { chips: SearchChipViewModel[] }) {
  if (!chips.length) {
    return null
  }

  return (
    <>
      {chips.map((chip) => (
        <span className={`newtab-search-chip ${chip.kind}`} key={`${chip.kind}:${chip.label}`}>
          {chip.label}
        </span>
      ))}
    </>
  )
}

function SearchSuggestions({ suggestions }: { suggestions: SearchSuggestionViewModel[] }) {
  return (
    <>
      {suggestions.map((suggestion) => (
        <Button
          id={suggestion.elementId}
          className={[
            'newtab-search-suggestion',
            suggestion.command ? 'command' : '',
            suggestion.active ? 'active' : ''
          ].filter(Boolean).join(' ')}
          type="button"
          role="option"
          aria-selected={suggestion.active}
          aria-label={suggestion.ariaLabel}
          onPointerDown={(event) => {
            event.preventDefault()
          }}
          onClick={suggestion.onSelect}
          unstyled
          key={suggestion.id}
        >
          <span className="newtab-search-suggestion-mark" aria-hidden="true">
            {suggestion.mark}
          </span>
          <span className="newtab-search-suggestion-copy">
            <strong>{suggestion.title}</strong>
            <span>{suggestion.meta}</span>
          </span>
        </Button>
      ))}
    </>
  )
}

function SearchSectionLabel({ label }: { label: string }) {
  return label ? <>{label}</> : null
}

function SearchHint({ state }: { state: SearchHintState }) {
  if (state.type === 'empty') {
    return null
  }

  if (state.type === 'webFallback') {
    return (
      <Button
        className="newtab-search-web-hint"
        type="button"
        title={state.title}
        aria-label={state.ariaLabel}
        onPointerDown={(event) => {
          event.preventDefault()
        }}
        onClick={state.onSelect}
        unstyled
      >
        {state.label}
      </Button>
    )
  }

  return <>{state.text}</>
}

function SavedSearches({ state }: { state: SavedSearchesState }) {
  if (!state.show) {
    return null
  }

  return (
    <>
      <div className="newtab-saved-search-head">
        <span className={state.error ? 'error' : ''}>{state.error || '保存搜索'}</span>
        {state.canSaveCurrent ? (
          <Button
            className="newtab-saved-search-save"
            type="button"
            disabled={state.hasCurrentSaved}
            onPointerDown={(event) => {
              event.preventDefault()
            }}
            onClick={() => {
              void state.onSaveCurrent()
            }}
            unstyled
          >
            {state.hasCurrentSaved ? '已保存' : '保存'}
          </Button>
        ) : null}
      </div>
      {state.items.length ? (
        <div className="newtab-saved-search-list">
          {state.items.map((item) => (
            <span className="newtab-saved-search-chip" key={item.id}>
              <Button
                className="newtab-saved-search-apply"
                type="button"
                title={item.query}
                onPointerDown={(event) => {
                  event.preventDefault()
                }}
                onClick={item.onApply}
                unstyled
              >
                {item.label}
              </Button>
              <Button
                className="newtab-saved-search-delete"
                type="button"
                aria-label={`删除保存搜索：${item.label}`}
                onPointerDown={(event) => {
                  event.preventDefault()
                }}
                onClick={() => {
                  void item.onDelete()
                }}
                unstyled
              >
                <Icon name="X" size={12} aria-hidden="true" />
              </Button>
            </span>
          ))}
        </div>
      ) : null}
    </>
  )
}

function NewTabOnboardingStrip({ state }: { state: NewTabOnboardingState }) {
  return (
    <>
      <div className="newtab-onboarding-copy">
        <strong>Curator 已将新标签页设为书签搜索和快捷入口</strong>
        <span>核心书签功能默认本地；网页搜索、精选远程背景、AI/Jina 和链接检测可关闭或跳过。</span>
      </div>
      <div className="newtab-onboarding-actions">
        <Button type="button" onClick={state.onOpenFolderSettings} unstyled>
          选择来源
        </Button>
        <Button className="secondary" type="button" onClick={state.onSkip} unstyled>
          我知道了
        </Button>
      </div>
    </>
  )
}

function FeaturedBackgroundPicker({ state }: { state: FeaturedBackgroundPickerState }) {
  if (state.type === 'state') {
    return <div className="featured-wallpaper-state">{state.label}</div>
  }

  return (
    <>
      {state.sections.map((section) => (
        section.type === 'grid' ? (
          <FeaturedBackgroundPickerGridSection section={section.section} key={`grid:${section.section.title}`} />
        ) : (
          <FeaturedBackgroundPickerProviderSection section={section} key={`providers:${section.title}`} />
        )
      ))}
    </>
  )
}

function FeaturedBackgroundPickerProviderSection({
  section
}: {
  section: Extract<FeaturedBackgroundPickerSectionViewModel, { type: 'providers' }>
}) {
  return (
    <section className="featured-wallpaper-section" aria-label={section.title}>
      <h4 className="featured-wallpaper-section-title">{section.title}</h4>
      <div className="featured-wallpaper-provider-stack">
        {section.groups.map((group) => (
          <section className="featured-wallpaper-provider-section" aria-label={group.title} key={group.title}>
            <h5 className="featured-wallpaper-provider-title">{group.title}</h5>
            <FeaturedBackgroundPickerCardGrid cards={group.cards} emptyText={group.emptyText} />
          </section>
        ))}
      </div>
    </section>
  )
}

function FeaturedBackgroundPickerGridSection({ section }: { section: FeaturedBackgroundPickerGridSectionViewModel }) {
  return (
    <section className="featured-wallpaper-section" aria-label={section.title}>
      <h4 className="featured-wallpaper-section-title">{section.title}</h4>
      <FeaturedBackgroundPickerCardGrid cards={section.cards} emptyText={section.emptyText} />
    </section>
  )
}

function FeaturedBackgroundPickerCardGrid({
  cards,
  emptyText
}: {
  cards: FeaturedBackgroundPickerCardViewModel[]
  emptyText: string
}) {
  return (
    <div className="featured-wallpaper-section-grid">
      {cards.length ? (
        cards.map((card) => <FeaturedBackgroundPickerCard card={card} key={card.id} />)
      ) : (
        <div className="featured-wallpaper-section-empty">{emptyText}</div>
      )}
    </div>
  )
}

function FeaturedBackgroundPickerCard({ card }: { card: FeaturedBackgroundPickerCardViewModel }) {
  const className = [
    'featured-wallpaper-card',
    card.selected ? 'is-selected' : '',
    'has-preview-image'
  ].filter(Boolean).join(' ')
  const previewStyle = {
    '--featured-wallpaper-preview-placeholder': card.previewAccentColor
  } as React.CSSProperties

  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      aria-label={card.title}
      aria-pressed={card.selected}
      data-featured-background-id={card.id}
      data-featured-background-preview-url={card.imageUrl}
      data-featured-background-preview-title={card.title}
      data-featured-background-resolved-preview-url={card.initialPreviewUrl}
    >
      <span className="featured-wallpaper-preview" style={previewStyle}>
        <img
          className="featured-wallpaper-preview-image"
          src={card.initialPreviewUrl}
          alt=""
          decoding="async"
          loading="eager"
          fetchPriority={card.fetchpriority}
          draggable={false}
          data-remote-preview-url={card.remotePreviewUrl}
          data-preview-fallback-urls={JSON.stringify(card.previewFallbackUrls)}
          onError={handleFeaturedBackgroundPreviewError}
          onLoad={handleFeaturedBackgroundPreviewLoad}
        />
        <span className="featured-wallpaper-resolution" data-state={card.resolutionState}>
          {card.resolutionText}
        </span>
        <Button
          className={card.favorite ? 'featured-wallpaper-favorite is-favorite' : 'featured-wallpaper-favorite'}
          type="button"
          aria-pressed={card.favorite}
          aria-label={card.favorite ? '取消收藏这张精选图' : '收藏这张精选图'}
          unstyled
        >
          <Icon name="Heart" aria-hidden="true" />
        </Button>
      </span>
    </div>
  )
}

function handleFeaturedBackgroundPreviewError(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget
  const card = image.closest<HTMLElement>('.featured-wallpaper-card')
  const fallbackUrls = parseFeaturedBackgroundPreviewFallbackUrls(image.dataset.previewFallbackUrls)
  const fallbackUrl = fallbackUrls.shift() || ''
  image.dataset.previewFallbackUrls = JSON.stringify(fallbackUrls)
  if (!card) {
    return
  }
  if (!fallbackUrl) {
    card.classList.remove('has-preview-image')
    card.classList.add('is-loading')
    return
  }

  image.src = fallbackUrl
  card.dataset.featuredBackgroundResolvedPreviewUrl = fallbackUrl
  card.classList.add('has-preview-image')
  card.classList.remove('is-loading')
}

function handleFeaturedBackgroundPreviewLoad(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget
  const card = image.closest<HTMLElement>('.featured-wallpaper-card')
  if (!card) {
    return
  }
  card.dataset.featuredBackgroundResolvedPreviewUrl = image.currentSrc || image.src
  card.classList.add('has-preview-image')
  card.classList.remove('is-loading')
}

function parseFeaturedBackgroundPreviewFallbackUrls(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || '[]'))
    return Array.isArray(parsed)
      ? parsed.map((url) => String(url || '').trim()).filter(Boolean)
      : []
  } catch {
    return []
  }
}

function BookmarkEditMenu({ state }: { state: BookmarkEditMenuViewModel }) {
  return (
    <InlineDialogPanel
      className="bookmark-menu-popover-shell"
      aria-label="书签设置"
      initialFocus={false}
      finalFocus={false}
    >
      <BookmarkMenuTextField field={state.fields[0]} />
      <BookmarkMenuTextField field={state.fields[1]} />
      <label className="bookmark-menu-row">
        <span>图标</span>
        <Select
          disabled={state.iconModeDisabled}
          inputAttributes={{ 'aria-label': '图标' }}
          itemClassName="custom-select-option"
          value={state.iconMode}
          options={[
            { value: 'website', label: '网站图标' },
            { value: 'custom', label: '自定义图片' }
          ]}
          onValueChange={(value) => {
            void state.onIconModeChange(value || state.iconMode)
          }}
          popupClassName="custom-select-list"
          positionerClassName="custom-select-positioner"
          triggerClassName="bookmark-menu-control custom-select-trigger"
          unstyled
          valueClassName="custom-select-trigger-label"
        />
      </label>
      <BookmarkMenuSeparator />
      <BookmarkMenuActions actions={state.actions} label="书签操作" />
      <BookmarkMenuFeedback error={state.error} status={state.status} statusTone={state.statusTone} />
    </InlineDialogPanel>
  )
}

function BookmarkAddMenu({ state }: { state: BookmarkAddMenuViewModel }) {
  return (
    <InlineDialogPanel
      className="bookmark-menu-popover-shell"
      aria-label="添加新标签页书签"
      initialFocus={false}
      finalFocus={false}
    >
      {state.expanded ? (
        <>
          <BookmarkMenuTextField field={state.fields[0]} />
          <BookmarkMenuTextField field={state.fields[1]} />
          <BookmarkMenuSeparator />
          <BookmarkMenuActions actions={state.actions} label="添加书签操作" />
        </>
      ) : (
        <Button
          className="bookmark-add-trigger"
          type="button"
          onClick={() => {
            void state.onExpand()
          }}
          unstyled
        >
          <MenuActionIcon icon="plus" />
          添加书签
        </Button>
      )}
      <BookmarkMenuFeedback error={state.error} status="" />
    </InlineDialogPanel>
  )
}

function BookmarkMenuTextField({ field }: { field: BookmarkMenuTextFieldViewModel }) {
  return (
    <label className="bookmark-menu-row">
      <span>{field.label}</span>
      <Input
        className="bookmark-menu-input"
        type={field.type}
        placeholder={field.placeholder}
        value={field.value}
        disabled={field.disabled}
        spellCheck={false}
        onChange={(event) => {
          field.onChange(event.currentTarget.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void field.onEnter()
          }
        }}
        unstyled
      />
    </label>
  )
}

function BookmarkMenuSeparator() {
  return <div className="bookmark-menu-separator" />
}

function BookmarkMenuActions({ actions, label }: { actions: BookmarkMenuActionViewModel[]; label: string }) {
  return (
    <InlineMenuList
      actions={actions.map(toInlineMenuAction)}
      className="bookmark-menu-actions"
      label={label}
    />
  )
}

function toInlineMenuAction(action: BookmarkMenuActionViewModel): InlineMenuAction {
  return {
    id: action.id,
    label: <BookmarkMenuActionContent icon={action.icon} label={action.label} />,
    disabled: action.disabled,
    destructive: action.variant === 'danger',
    className: action.variant ? `bookmark-menu-action ${action.variant}` : 'bookmark-menu-action',
    onSelect: action.onSelect,
    closeOnSelect: false,
    attributes: {
      ...(action.actionId ? { 'data-menu-action': action.actionId } : {}),
      'aria-label': action.ariaLabel
    }
  }
}

function BookmarkMenuActionContent({ icon, label }: { icon: BookmarkMenuActionIcon; label: string }) {
  return (
    <>
      <MenuActionIcon icon={icon} />
      {label}
    </>
  )
}

function MenuActionIcon({ icon }: { icon: BookmarkMenuActionIcon }) {
  const iconNameByAction: Record<BookmarkMenuActionIcon, IconName> = {
    copy: 'Copy',
    pin: 'Pin',
    plus: 'Plus',
    refresh: 'RefreshCw',
    save: 'Save',
    trash: 'Trash2'
  }
  return <Icon name={iconNameByAction[icon]} aria-hidden="true" />
}

function BookmarkMenuFeedback({
  error,
  status,
  statusTone
}: {
  error: string
  status: string
  statusTone?: 'warning' | ''
}) {
  return (
    <>
      {error ? <p className="bookmark-menu-error">{error}</p> : null}
      {status ? (
        <p className={statusTone === 'warning' ? 'bookmark-menu-status is-warning' : 'bookmark-menu-status'}>
          {status}
        </p>
      ) : null}
    </>
  )
}

function BookmarkTile({ state }: { state: BookmarkTileViewModel }) {
  return (
    <>
      <BookmarkIconShell
        customIcon={state.customIcon}
        fallbackLabel={state.fallbackLabel}
        favicon={state.favicon}
      />
      <span className="bookmark-title">{state.title}</span>
    </>
  )
}

function SpeedDialPanel({ state }: { state: SpeedDialPanelState }) {
  return (
    <>
      <div className="newtab-module-heading">
        <h2>Speed Dial</h2>
        <span data-tone={state.metaTone || undefined}>{state.meta}</span>
      </div>
      <SpeedDialContent state={state.content} />
    </>
  )
}

function SpeedDialContent({ state }: { state: SpeedDialContentState }) {
  if (state.type === 'loading') {
    return (
      <div className="newtab-speed-dial-empty" role="status">
        {state.label}
      </div>
    )
  }

  if (state.type === 'empty') {
    return (
      <div className="newtab-speed-dial-empty">
        <div className="newtab-speed-dial-empty-copy">
          <strong>{state.state.title}</strong>
          <span>{state.state.detail}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="newtab-speed-dial-grid" aria-busy={state.busy ? 'true' : 'false'}>
      {state.items.map((item) => (
        <a
          className={item.dragging ? 'newtab-speed-dial-card dragging' : 'newtab-speed-dial-card'}
          href={item.url}
          title={item.title}
          draggable={false}
          data-bookmark-id={item.id}
          data-speed-dial-bookmark-id={item.id}
          aria-label={`打开固定入口：${item.title}。长按拖拽调整 Speed Dial 顺序`}
          key={item.id}
        >
          <BookmarkIconShell
            className="newtab-speed-dial-mark bookmark-icon-shell"
            customIcon={item.customIcon}
            fallbackLabel={item.fallbackLabel}
            favicon={item.favicon}
          />
          <span className="newtab-speed-dial-copy">
            <strong>{item.title}</strong>
            <span>{item.detail}</span>
          </span>
        </a>
      ))}
    </div>
  )
}

function BookmarkIconShell({
  className = 'bookmark-icon-shell',
  customIcon,
  fallbackLabel,
  favicon
}: {
  className?: string
  customIcon: boolean
  fallbackLabel: string
  favicon: BookmarkTileViewModel['favicon'] | SpeedDialCardViewModel['favicon']
}) {
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    setMissing(false)
  }, [favicon.src])

  return (
    <span className={missing ? `${className} favicon-missing` : className} aria-hidden="true">
      <img
        className={customIcon ? 'bookmark-favicon custom-icon' : 'bookmark-favicon'}
        src={favicon.src}
        alt=""
        draggable={false}
        loading={favicon.loading}
        decoding="async"
        fetchPriority={favicon.fetchpriority}
        onError={() => {
          setMissing(true)
        }}
      />
      <span className="bookmark-fallback">{fallbackLabel}</span>
    </span>
  )
}

function FolderSectionHeader({ state }: { state: FolderSectionHeaderState }) {
  const displayTitle = state.title || '未命名文件夹'
  const addTitle = `添加书签到「${displayTitle}」`

  return (
    <>
      <Button
        className={state.dragging ? 'folder-section-header dragging' : 'folder-section-header'}
        type="button"
        data-folder-drag-handle={state.folderId}
        title={state.path || state.title}
        aria-label={`${state.title}，长按拖拽调整文件夹顺序`}
        unstyled
      >
        <span className="folder-section-title">{displayTitle}</span>
        <span className="folder-section-count">{state.bookmarkCount}</span>
      </Button>
      <Button
        className="folder-section-add"
        type="button"
        data-add-bookmark-folder-id={state.folderId}
        title={addTitle}
        aria-label={addTitle}
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        unstyled
      >
        <Icon name="Plus" size={12} aria-hidden="true" />
      </Button>
    </>
  )
}

function QuickAccessPanel({ state }: { state: QuickAccessPanelState }) {
  return (
    <>
      {state.groups.map((group) => (
        <section className="newtab-quick-group" aria-label={`${group.label}书签`} key={group.label}>
          <div className="newtab-quick-heading">{group.label}</div>
          <div className="newtab-quick-list">
            {group.items.map((item) => (
              <a
                className="newtab-quick-link"
                href={item.url}
                title={`${item.title} · ${item.detail}`}
                draggable={false}
                data-bookmark-id={item.id}
                data-quick-reason={item.reason}
                key={item.id}
              >
                <span className="newtab-quick-mark" aria-hidden="true">{item.badge}</span>
                <span className="newtab-quick-copy">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function EmptyFolder({ state }: { state: EmptyFolderState }) {
  return (
    <>
      <p className="bookmark-folder-empty">
        此文件夹还没有书签。你可以先添加一个书签，或改用已有的非空来源；选择来源只改变展示，不会移动或删除书签。
      </p>
      <div className="bookmark-folder-empty-actions">
        <Button
          className="newtab-button secondary"
          type="button"
          data-add-bookmark-folder-id={state.folderId}
          unstyled
        >
          添加书签到这里
        </Button>
        <Button
          className="newtab-button secondary"
          type="button"
          title="打开来源设置并选择已有文件夹"
          onClick={state.onOpenFolderSettings}
          unstyled
        >
          选择现有来源
        </Button>
      </div>
    </>
  )
}

function SourceNavigation({ state }: { state: SourceNavigationState }) {
  return (
    <>
      <span className="source-navigation-label">来源</span>
      <div className="source-navigation-list">
        {state.items.map((item) => (
          <a
            className="source-navigation-link"
            href={`#${item.anchorId}`}
            data-source-navigation-target={item.anchorId}
            title={item.path}
            draggable={false}
            aria-label={`跳转到「${item.title}」，${item.bookmarkCount} 个书签`}
            onClick={(event) => {
              event.preventDefault()
              state.onFocusSource(item.anchorId)
            }}
            key={item.id}
          >
            <span className="source-navigation-title">{item.title}</span>
            <span className="source-navigation-count">{item.bookmarkCount}</span>
          </a>
        ))}
      </div>
    </>
  )
}

function ClockWidget({ store }: { store: ClockWidgetStore }) {
  const state = useClockWidgetState(store)
  const { settings } = state

  return (
    <>
      {settings.displayMode !== 'date' ? (
        <span className="newtab-clock-time-group">
          <time className="newtab-clock-time" data-clock-time="true" dateTime={state.timeDateTime}>
            {state.timeText}
          </time>
          {settings.hour12 ? (
            <span className="newtab-clock-period" data-clock-period="true">
              {state.periodText}
            </span>
          ) : null}
        </span>
      ) : null}
      {settings.displayMode !== 'time' ? (
        <time className="newtab-clock-date" data-clock-date="true" dateTime={state.dateDateTime}>
          {state.dateText}
        </time>
      ) : null}
    </>
  )
}

function DeleteToast({ state }: { state: DeleteToastState }) {
  return (
    <ToastList
      contentClassName="newtab-delete-toast-copy"
      descriptionClassName="newtab-delete-toast-description"
      items={[{
        actions: (
          <div className="newtab-delete-toast-actions">
            <Button
              type="button"
              data-undo-delete="true"
              disabled={state.busy}
              aria-label={`撤销删除：${state.bookmarkLabel}`}
              unstyled
            >
              {state.busy ? '恢复中' : '撤销'}
            </Button>
            <Button
              type="button"
              data-open-recycle="true"
              aria-label={`打开回收站查看：${state.bookmarkLabel}`}
              unstyled
            >
              回收站
            </Button>
          </div>
        ),
        description: state.detail,
        id: 'newtab-delete-toast',
        title: '已删除书签',
        type: 'success'
      }]}
      rootClassName="newtab-delete-toast-panel"
      titleClassName="newtab-delete-toast-title"
      timeout={0}
      unstyled
    />
  )
}
