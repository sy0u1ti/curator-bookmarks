import { useSyncExternalStore } from 'react'
import {
  LOADING_LABEL_STATUS_LOADER_CLASS,
  LOADING_LABEL_STATUS_WRAPPER_CLASS
} from './loading-label-classes.js'
import type {
  DashboardBreadcrumbSegmentViewModel,
  DashboardDragOverlayState,
  DashboardFolderSidebarState,
  DashboardLoadingLabelState,
  DashboardCardMenuFocusRequestState,
  DashboardPanelChromeState,
  DashboardResultsScrollRequestState,
  DashboardResultsState,
  DashboardSearchChipViewModel,
  DashboardSearchControlsState,
  DashboardSelectionBarState,
  DashboardTagEditorState,
  DashboardTitleState
} from './dashboard-view-types.js'

export interface DashboardViewState {
  breadcrumbs: DashboardBreadcrumbSegmentViewModel[]
  cardMenuFocusRequest: DashboardCardMenuFocusRequestState
  cardsTitle: string
  dragOverlay: DashboardDragOverlayState
  folderSidebar: DashboardFolderSidebarState
  panelChrome: DashboardPanelChromeState
  resultsScrollRequest: DashboardResultsScrollRequestState
  results: DashboardResultsState
  searchChips: DashboardSearchChipViewModel[]
  searchControls: DashboardSearchControlsState
  selectionBar: DashboardSelectionBarState
  status: DashboardLoadingLabelState
  tagEditor: DashboardTagEditorState
  title: DashboardTitleState
}

const defaultLoadingLabelState: DashboardLoadingLabelState = {
  busy: false,
  label: '',
  loaderClass: LOADING_LABEL_STATUS_LOADER_CLASS,
  variant: 'bar',
  wrapperClass: LOADING_LABEL_STATUS_WRAPPER_CLASS
}

const defaultDashboardViewState: DashboardViewState = {
  breadcrumbs: [],
  cardMenuFocusRequest: {
    bookmarkId: '',
    requestId: 0
  },
  cardsTitle: '',
  dragOverlay: {
    closing: false,
    deleteTargetActive: false,
    dragHint: defaultLoadingLabelState,
    dragPreview: null,
    dropTargets: [],
    moving: false,
    previewTransform: '',
    visible: false
  },
  folderSidebar: {
    countText: '',
    focusRequestId: '',
    items: []
  },
  panelChrome: {
    ready: false,
    resultsStableHeight: '',
    resultsUpdating: false,
    resultsVirtualized: false
  },
  resultsScrollRequest: {
    requestId: 0,
    scrollTop: 0
  },
  results: {
    mode: 'empty',
    empty: {
      loading: false,
      message: '正在读取书签目录。'
    }
  },
  searchChips: [],
  searchControls: {
    focusRequestId: 0,
    natural: {
      active: false,
      ariaLabel: '开启 Dashboard AI 语义搜索',
      fallback: false,
      label: '语义',
      pending: false,
      title: '开启 AI 语义搜索'
    },
    query: '',
    searchHelpOpen: false,
    showClearSearch: false
  },
  selectionBar: {
    canSelectVisible: false,
    selectedCount: 0,
    selectionActionsDisabled: true
  },
  status: defaultLoadingLabelState,
  tagEditor: {
    actions: {
      cancelDanger: false,
      cancelDisabled: false,
      cancelLabel: '取消',
      clearAiBusy: false,
      clearAiDisabled: true,
      regenerateAiBusy: false,
      regenerateAiDisabled: true,
      saveBusy: false,
      saveDisabled: false
    },
    bookmarkId: '',
    closing: false,
    field: {
      disabled: false,
      focusRequestId: 0,
      value: ''
    },
    meta: '',
    positionRequestId: 0,
    status: '',
    title: '修改标签',
    visible: false
  },
  title: {
    countText: '',
    title: ''
  }
}

let currentDashboardViewState = defaultDashboardViewState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): DashboardViewState {
  return currentDashboardViewState
}

export function publishDashboardViewState(patch: Partial<DashboardViewState>): void {
  currentDashboardViewState = {
    ...currentDashboardViewState,
    ...patch
  }
  listeners.forEach((listener) => listener())
}

export function patchDashboardSearchControlsState(patch: Partial<DashboardSearchControlsState>): void {
  publishDashboardViewState({
    searchControls: {
      ...currentDashboardViewState.searchControls,
      ...patch
    }
  })
}

export function getDashboardViewSnapshot(): DashboardViewState {
  return currentDashboardViewState
}

export function useDashboardViewState(): DashboardViewState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
