import { useSyncExternalStore } from 'react'
import type { IconLayoutPresetKey, IconSettings } from './icon-settings'

export interface NewtabIconPreviewTile {
  id: string
  mark: string
  title: string
}

export interface NewtabIconPreviewView {
  columns: number
  columnGap: number
  effectiveColumnGap: number
  effectiveFolderGap: number
  effectiveRowGap: number
  fixedColumnsDisabled: boolean
  fixedColumns: number
  folderGap: number
  iconShellSize: number
  layoutMode: string
  pageWidth: number
  previewColumnGap: number
  previewGridMaxWidth: number
  previewRowGap: number
  previewShellSize: number
  previewTileWidth: number
  preset: string
  rowGap: number
  showTitles: boolean
  summary: string
  tileWidth: number
  tileWidthDisabled: boolean
  titleLines: number
  titleLinesDisabled: boolean
  tiles: NewtabIconPreviewTile[]
  verticalCenter: boolean
}

const DEFAULT_VIEW: NewtabIconPreviewView = {
  columns: 3,
  columnGap: 10,
  effectiveColumnGap: 24,
  effectiveFolderGap: 20,
  effectiveRowGap: 12,
  fixedColumnsDisabled: false,
  fixedColumns: 4,
  folderGap: 20,
  iconShellSize: 32,
  layoutMode: 'auto',
  pageWidth: 78,
  previewColumnGap: 8,
  previewGridMaxWidth: 240,
  previewRowGap: 8,
  previewShellSize: 20,
  previewTileWidth: 72,
  preset: '',
  rowGap: 10,
  showTitles: true,
  summary: '',
  tileWidth: 184,
  tileWidthDisabled: false,
  titleLines: 1,
  titleLinesDisabled: false,
  tiles: [],
  verticalCenter: false
}

export type NewtabIconSettingsFieldKey =
  | 'columnGap'
  | 'columns'
  | 'folderGap'
  | 'iconShellSize'
  | 'layoutMode'
  | 'pageWidth'
  | 'rowGap'
  | 'tileWidth'
  | 'titleLines'

export interface NewtabIconSettingsActions {
  onFieldChange: (key: NewtabIconSettingsFieldKey, value: number | string) => void
  onPresetApply: (preset: IconLayoutPresetKey) => void
  onResetDefaults: () => void
  onShowTitlesToggle: (enabled: boolean) => void
  onVerticalCenterToggle: (enabled: boolean) => void
}

const EMPTY_ACTIONS: NewtabIconSettingsActions = {
  onFieldChange: () => {},
  onPresetApply: () => {},
  onResetDefaults: () => {},
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

export function dispatchNewtabIconSettingFieldChange(
  key: NewtabIconSettingsFieldKey,
  value: number | string
): void {
  iconSettingsActions.onFieldChange(key, value)
}

export function dispatchNewtabIconPresetApply(preset: IconLayoutPresetKey): void {
  iconSettingsActions.onPresetApply(preset)
}

export function dispatchNewtabIconResetDefaults(): void {
  iconSettingsActions.onResetDefaults()
}

export function useNewtabIconPreviewView(): NewtabIconPreviewView {
  return useSyncExternalStore(
    subscribeIconPreview,
    () => iconPreviewView,
    () => DEFAULT_VIEW
  )
}

export function createNewtabIconPreviewView(
  settings: IconSettings,
  preview: Pick<
    NewtabIconPreviewView,
    | 'columns'
    | 'previewColumnGap'
    | 'previewGridMaxWidth'
    | 'previewRowGap'
    | 'previewShellSize'
    | 'previewTileWidth'
    | 'summary'
    | 'tiles'
  >,
  effectiveValues: Pick<
    NewtabIconPreviewView,
    | 'effectiveColumnGap'
    | 'effectiveFolderGap'
    | 'effectiveRowGap'
  >
): NewtabIconPreviewView {
  return {
    ...preview,
    ...effectiveValues,
    columnGap: settings.columnGap,
    fixedColumnsDisabled: settings.layoutMode !== 'fixed',
    fixedColumns: settings.columns,
    folderGap: settings.folderGap,
    iconShellSize: settings.iconShellSize,
    layoutMode: settings.layoutMode,
    pageWidth: settings.pageWidth,
    preset: settings.preset,
    rowGap: settings.rowGap,
    showTitles: settings.showTitles,
    tileWidth: settings.tileWidth,
    tileWidthDisabled: !settings.showTitles,
    titleLines: settings.titleLines,
    titleLinesDisabled: !settings.showTitles,
    verticalCenter: settings.verticalCenter
  }
}
