import type { IconName } from '../../ui/icons/icon-map'

export type DashboardViewActionDetail =
  | {
      action:
        | 'clear-ai-tags'
        | 'clear-search'
        | 'clear-selection'
        | 'close-tag-editor'
        | 'delete-selected'
        | 'exit-dashboard'
        | 'move-selected'
        | 'regenerate-ai-tags'
        | 'results-unmounted'
        | 'save-tags'
        | 'select-visible'
        | 'toggle-natural-search'
    }
  | {
      action:
        | 'copy-bookmark'
        | 'delete-one'
        | 'edit-tags'
        | 'folder-filter'
        | 'folder-filter-focus'
        | 'move-one'
        | 'tag-hover-close'
        | 'tag-hover-open'
        | 'toggle-speed-dial'
        | 'toggle-tags'
      bookmarkId: string
    }
  | {
      action: 'favicon-load'
      bookmarkId: string
      pageUrl: string
      source: 'cache' | 'chrome'
      src: string
    }
  | {
      action: 'favicon-error'
      bookmarkId: string
      pageUrl: string
      source: 'cache' | 'chrome'
      src: string
    }
  | {
      action: 'toggle-selection'
      bookmarkId: string
      checked: boolean
    }
  | {
      action: 'card-menu-open-change'
      bookmarkId: string
      open: boolean
    }
  | {
      action: 'drag-hover-delete'
      active: boolean
    }
  | {
      action: 'drag-hover-folder'
      bookmarkId: string
    }
  | {
      action: 'drag-start-card'
      bookmarkId: string
      captureElement: HTMLElement
      event: PointerEvent
    }
  | {
      action: 'drag-pointer-move' | 'drag-pointer-up'
      event: PointerEvent
    }
  | {
      action: 'drag-pointer-cancel'
    }
  | {
      action: 'results-mounted'
      clientHeight: number
      clientWidth: number
      scrollHeight: number
      scrollTop: number
    }
  | {
      action: 'results-scroll'
      scrollTop: number
    }
  | {
      action: 'results-scroll-sync'
      clientHeight: number
      clientWidth: number
      scrollHeight: number
      scrollTop: number
    }
  | {
      action: 'results-resize'
      clientHeight: number
      clientWidth: number
      scrollHeight: number
      scrollTop: number
    }
  | {
      action: 'query-change' | 'tag-editor-draft-change'
      value: string
    }

export interface DashboardTitleState {
  countText: string
  title: string
}

export interface DashboardPanelChromeState {
  ready: boolean
  resultsStableHeight: string
  resultsUpdating: boolean
  resultsVirtualized: boolean
}

export interface DashboardResultsScrollRequestState {
  requestId: number
  scrollTop: number
}

export interface DashboardSearchChipViewModel {
  kind: string
  label: string
}

export interface DashboardSearchControlsState {
  focusRequestId: number
  natural: {
    active: boolean
    ariaLabel: string
    fallback: boolean
    label: string
    pending: boolean
    title: string
  }
  query: string
  searchHelpOpen: boolean
  showClearSearch: boolean
}

export interface DashboardBreadcrumbSegmentViewModel {
  current: boolean
  id: string
  label: string
  path: string
}

export interface DashboardFolderSidebarItemViewModel {
  active: boolean
  count: number
  depth: number
  id: string
  path: string
  title: string
}

export interface DashboardLoadingLabelState {
  busy: boolean
  label: string
  loaderClass: string
  variant: 'bar' | 'spiral'
  wrapperClass: string
}

export interface DashboardEmptyState {
  loading: boolean
  message: string
}

export interface DashboardFolderDropTargetViewModel {
  active: boolean
  bookmarkCount: number
  folderCount: number
  id: string
  path: string
  title: string
}

export interface DashboardDragPreviewState {
  fallbackLabel: string
  favicon: DashboardCardFaviconViewModel | null
  title: string
}

export interface DashboardSelectionBarState {
  canSelectVisible: boolean
  selectedCount: number
  selectionActionsDisabled: boolean
}

export interface DashboardTagEditorActionsState {
  cancelDanger: boolean
  cancelDisabled: boolean
  cancelLabel: string
  clearAiBusy: boolean
  clearAiDisabled: boolean
  regenerateAiBusy: boolean
  regenerateAiDisabled: boolean
  saveBusy: boolean
  saveDisabled: boolean
}

export interface DashboardTagEditorFieldState {
  disabled: boolean
  focusRequestId: number
  value: string
}

export interface DashboardCardFaviconViewModel {
  pageUrl: string
  source: 'cache' | 'chrome'
  src: string
}

export interface DashboardCardViewModel {
  activeMenu: boolean
  bookmarkId: string
  copyActionLabel: string
  copyText: string
  copyTooltip: string
  deleting: boolean
  deleteLabel: string
  displayUrl: string
  editTagsLabel: string
  expanded: boolean
  fallbackLabel: string
  favicon: DashboardCardFaviconViewModel | null
  hiddenTagCount: number
  itemPath: string
  moreLabel: string
  moveLabel: string
  openLabel: string
  parentId: string
  renderMode: 'full' | 'scroll'
  selected: boolean
  selectionLabel: string
  speedDialActionLabel: string
  speedDialActionText: string
  speedDialPinned: boolean
  tagStatusTitle: string
  tags: string[]
  title: string
  url: string
  visibleTags: string[]
}

export type DashboardCardActionIcon = 'open' | 'copy' | 'tag' | 'speed-dial' | 'move' | 'delete'

export const dashboardCardActionIconByKind = {
  copy: 'Copy',
  delete: 'Trash2',
  move: 'Move',
  open: 'ExternalLink',
  'speed-dial': 'Gauge',
  tag: 'Tag'
} satisfies Record<DashboardCardActionIcon, IconName>

export type DashboardResultsState =
  | {
      mode: 'empty'
      empty: DashboardEmptyState
    }
  | {
      mode: 'static'
      cards: DashboardCardViewModel[]
    }
  | {
      mode: 'virtual'
      cards: DashboardCardViewModel[]
      columnCount: number
      offsetY: number
      totalHeight: number
    }

export interface DashboardFolderSidebarState {
  countText: string
  focusRequestId: string
  items: DashboardFolderSidebarItemViewModel[]
}

export interface DashboardTagEditorState {
  actions: DashboardTagEditorActionsState
  bookmarkId: string
  closing: boolean
  field: DashboardTagEditorFieldState
  meta: string
  positionRequestId: number
  status: string
  title: string
  visible: boolean
}

export interface DashboardCardMenuFocusRequestState {
  bookmarkId: string
  requestId: number
}

export interface DashboardDragOverlayState {
  closing: boolean
  deleteTargetActive: boolean
  dragHint: DashboardLoadingLabelState
  dragPreview: DashboardDragPreviewState | null
  dropTargets: DashboardFolderDropTargetViewModel[]
  moving: boolean
  previewTransform: string
  visible: boolean
}
