import {
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type { NewTabSourceNavigationItem } from './content-state'
import type { BookmarkIconShellFavicon } from './components/BookmarkIconShell'

export interface EmptyFolderState {
  folderId: string
  onAddBookmark: (anchor: HTMLElement, folderId: string) => void
  onOpenFolderSettings: () => void
}

export interface SourceNavigationState {
  items: NewTabSourceNavigationItem[]
}

export interface QuickAccessLinkViewModel {
  badge: string
  detail: string
  id: string
  onContextMenu: (event: ReactMouseEvent<HTMLAnchorElement>) => void
  onNavigate: (event: ReactMouseEvent<HTMLAnchorElement>) => void
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

export interface PortalPanelState {
  quickAccess: QuickAccessPanelState
}

export interface BookmarkTileViewModel {
  customIcon: boolean
  dragging: boolean
  fallbackLabel: string
  favicon: BookmarkIconShellFavicon
  folderId: string
  id: string
  onContextMenu: (event: ReactMouseEvent<HTMLAnchorElement>) => void
  onDragPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onReorderKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  onNavigate: (event: ReactMouseEvent<HTMLAnchorElement>) => void
  style?: CSSProperties
  title: string
  url: string
}

export interface FolderSectionHeaderState {
  bookmarkCount: number
  dragging: boolean
  folderId: string
  onAddBookmark: (anchor: HTMLElement, folderId: string) => void
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void
  onDragPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onReorderKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
  path: string
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
  portal: PortalPanelState | null
  reorderStatus: BookmarkReorderStatusViewModel | null
  sections: BookmarkFolderSectionViewModel[]
  sourceNavigation: SourceNavigationState | null
  speedDial: boolean
}

export interface BookmarkFolderSectionViewModel {
  anchorId: string
  bookmarkCount: number
  dragging: boolean
  folderId: string
  grid: BookmarkFolderGridViewModel | null
  onAddBookmark: (anchor: HTMLElement, folderId: string) => void
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void
  onDragPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onReorderKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
  onOpenFolderSettings: () => void
  path: string
  title: string
}

export interface BookmarkFolderGridViewModel {
  ariaLabel: string
  busy: boolean
  chunkSize: number
  folderId: string
  initialVisibleCount: number
  items: BookmarkTileViewModel[]
}

export interface BookmarkReorderStatusViewModel {
  message: string
  tone: string
}

export interface NewtabBookmarkContentNodes {
  folderHeaders: Map<string, HTMLElement>
  folderSections: Map<string, HTMLElement>
  grids: Map<string, HTMLElement>
  tileIcons: Map<string, HTMLElement>
  tiles: Map<string, HTMLElement>
}

let bookmarkContentView: BookmarkContentViewModel | null = null
let bookmarkContentNodes: NewtabBookmarkContentNodes = createEmptyNewtabBookmarkContentNodes()
const listeners = new Set<() => void>()

function subscribeNewtabBookmarkContent(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitNewtabBookmarkContentChange(): void {
  listeners.forEach((listener) => listener())
}

export function dispatchNewtabBookmarkContentView(view: BookmarkContentViewModel | null): void {
  bookmarkContentView = view
  emitNewtabBookmarkContentChange()
}

export function patchNewtabBookmarkContentView(
  patcher: (view: BookmarkContentViewModel) => BookmarkContentViewModel
): void {
  if (!bookmarkContentView) {
    return
  }
  bookmarkContentView = patcher(bookmarkContentView)
  emitNewtabBookmarkContentChange()
}

export function getNewtabBookmarkContentView(): BookmarkContentViewModel | null {
  return bookmarkContentView
}

export function createEmptyNewtabBookmarkContentNodes(): NewtabBookmarkContentNodes {
  return {
    folderHeaders: new Map(),
    folderSections: new Map(),
    grids: new Map(),
    tileIcons: new Map(),
    tiles: new Map()
  }
}

export function setNewtabBookmarkGridNode(folderId: string, element: HTMLElement | null): void {
  bookmarkContentNodes = setNodeMapEntry(bookmarkContentNodes, 'grids', folderId, element)
}

export function setNewtabBookmarkTileNode(bookmarkId: string, element: HTMLElement | null): void {
  bookmarkContentNodes = setNodeMapEntry(bookmarkContentNodes, 'tiles', bookmarkId, element)
}

export function setNewtabBookmarkTileIconNode(bookmarkId: string, element: HTMLElement | null): void {
  bookmarkContentNodes = setNodeMapEntry(bookmarkContentNodes, 'tileIcons', bookmarkId, element)
}

export function setNewtabBookmarkFolderSectionNode(folderId: string, element: HTMLElement | null): void {
  bookmarkContentNodes = setNodeMapEntry(bookmarkContentNodes, 'folderSections', folderId, element)
}

export function setNewtabBookmarkFolderHeaderNode(folderId: string, element: HTMLElement | null): void {
  bookmarkContentNodes = setNodeMapEntry(bookmarkContentNodes, 'folderHeaders', folderId, element)
}

export function getNewtabBookmarkContentNodes(): NewtabBookmarkContentNodes {
  return bookmarkContentNodes
}

function setNodeMapEntry(
  nodes: NewtabBookmarkContentNodes,
  key: keyof NewtabBookmarkContentNodes,
  id: string,
  element: HTMLElement | null
): NewtabBookmarkContentNodes {
  const normalizedId = String(id || '').trim()
  if (!normalizedId) {
    return nodes
  }

  const currentElement = nodes[key].get(normalizedId) || null
  if (currentElement === element) {
    return nodes
  }

  const nextMap = new Map(nodes[key])
  if (element) {
    nextMap.set(normalizedId, element)
  } else {
    nextMap.delete(normalizedId)
  }

  return {
    ...nodes,
    [key]: nextMap
  }
}

export function useNewtabBookmarkContentView(): BookmarkContentViewModel | null {
  return useSyncExternalStore(
    subscribeNewtabBookmarkContent,
    () => bookmarkContentView,
    () => null
  )
}
