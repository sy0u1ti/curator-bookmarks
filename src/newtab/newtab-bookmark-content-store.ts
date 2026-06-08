import { useSyncExternalStore, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import type { NewTabSourceNavigationItem } from './content-state'
import type { BookmarkIconShellFavicon } from './components/BookmarkIconShell'

export interface EmptyFolderState {
  folderId: string
  onAddBookmark: (anchor: HTMLElement, folderId: string) => void
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

let bookmarkContentView: BookmarkContentViewModel | null = null
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

export function useNewtabBookmarkContentView(): BookmarkContentViewModel | null {
  return useSyncExternalStore(
    subscribeNewtabBookmarkContent,
    () => bookmarkContentView,
    () => null
  )
}
