import { useSyncExternalStore } from 'react'

export interface NewtabIconPreviewTile {
  id: string
  mark: string
  title: string
}

export interface NewtabIconPreviewView {
  columns: number
  layoutMode: string
  previewColumnGap: number
  previewGridMaxWidth: number
  previewRowGap: number
  previewShellSize: number
  previewTileWidth: number
  showTitles: boolean
  summary: string
  titleLines: number
  pageWidth: number
  tiles: NewtabIconPreviewTile[]
  verticalCenter: boolean
}

const DEFAULT_VIEW: NewtabIconPreviewView = {
  columns: 3,
  layoutMode: 'auto',
  pageWidth: 78,
  previewColumnGap: 8,
  previewGridMaxWidth: 240,
  previewRowGap: 8,
  previewShellSize: 20,
  previewTileWidth: 72,
  showTitles: true,
  summary: '',
  titleLines: 1,
  tiles: [],
  verticalCenter: false
}

export interface NewtabIconSettingsActions {
  onShowTitlesToggle: (enabled: boolean) => void
  onVerticalCenterToggle: (enabled: boolean) => void
}

const EMPTY_ACTIONS: NewtabIconSettingsActions = {
  onShowTitlesToggle: () => {},
  onVerticalCenterToggle: () => {}
}

let iconPreviewView: NewtabIconPreviewView = DEFAULT_VIEW
let iconSettingsActions: NewtabIconSettingsActions = EMPTY_ACTIONS

const listeners = new Set<() => void>()

function subscribeIconPreview(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitIconPreviewChange(): void {
  listeners.forEach((listener) => listener())
}

export function dispatchNewtabIconPreviewView(view: NewtabIconPreviewView): void {
  iconPreviewView = view
  emitIconPreviewChange()
}

export function registerNewtabIconSettingsActions(
  actions: NewtabIconSettingsActions
): () => void {
  iconSettingsActions = actions
  return () => {
    if (iconSettingsActions === actions) {
      iconSettingsActions = EMPTY_ACTIONS
    }
  }
}

export function dispatchNewtabIconVerticalCenterToggle(enabled: boolean): void {
  iconSettingsActions.onVerticalCenterToggle(enabled)
}

export function dispatchNewtabIconShowTitlesToggle(enabled: boolean): void {
  iconSettingsActions.onShowTitlesToggle(enabled)
}

export function useNewtabIconPreviewView(): NewtabIconPreviewView {
  return useSyncExternalStore(
    subscribeIconPreview,
    () => iconPreviewView,
    () => DEFAULT_VIEW
  )
}
