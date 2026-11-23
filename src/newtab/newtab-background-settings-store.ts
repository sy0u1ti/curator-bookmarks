import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'
import { DEFAULT_TEXTURE_SETTINGS, normalizeTextureSettings, type TextureSettings } from './texture-settings.js'
import {
  DEFAULT_WALLPAPER_ADJUSTMENTS,
  doesBackgroundTypeTakeWallpaperAdjustments,
  toWallpaperAdjustmentFields,
  type WallpaperAdjustmentFields
} from './wallpaper-adjustments.js'

export interface NewtabBackgroundSettingsView extends TextureSettings, WallpaperAdjustmentFields {
  ready: boolean
  backgroundStatus: string
  backgroundStatusTone: 'info' | 'success' | 'warning' | 'error'
  color: string
  imageName: string
  imageRowHidden: boolean
  wallpaperAdjustmentsHidden: boolean
  type: string
  url: string
  urlRowHidden: boolean
  videoName: string
  videoRowHidden: boolean
}

export interface NewtabBackgroundSettingsSource extends Partial<TextureSettings>, WallpaperAdjustmentFields {
  color: string
  imageName: string
  type: string
  url: string
  videoName: string
}

export type NewtabBackgroundSettingsFieldKey =
  | 'color'
  | 'wallpaperEnabled'
  | 'wallpaperStyle'
  | 'wallpaperBlur'
  | 'wallpaperDim'
  | 'texturePreset'
  | 'textureIntensity'
  | 'textureMotion'
  | 'type'
  | 'url'

export interface NewtabBackgroundSettingsActions {
  onFileSelect: (mediaType: 'image' | 'video', file: File) => void
  onFieldChange: (key: NewtabBackgroundSettingsFieldKey, value: number | string | boolean) => void
  onUrlCommit: () => void
}

const EMPTY_VIEW: NewtabBackgroundSettingsView = {
  ...DEFAULT_TEXTURE_SETTINGS,
  ready: false,
  backgroundStatus: '',
  backgroundStatusTone: 'info',
  color: '#101013',
  imageName: '',
  imageRowHidden: true,
  wallpaperAdjustmentsHidden: true,
  ...toWallpaperAdjustmentFields(DEFAULT_WALLPAPER_ADJUSTMENTS),
  type: 'color',
  url: '',
  urlRowHidden: true,
  videoName: '',
  videoRowHidden: true
}

const EMPTY_ACTIONS: NewtabBackgroundSettingsActions = {
  onFileSelect: () => {},
  onFieldChange: () => {},
  onUrlCommit: () => {}
}

let backgroundSettingsActions: NewtabBackgroundSettingsActions = EMPTY_ACTIONS
const backgroundSettingsStore = createUiViewStoreSlice(
  'newtab',
  'background-settings',
  EMPTY_VIEW
)

export function createNewtabBackgroundSettingsView(
  settings: NewtabBackgroundSettingsSource,
  ui: Partial<Pick<
    NewtabBackgroundSettingsView,
    | 'backgroundStatus'
    | 'backgroundStatusTone'
    | 'ready'
  >> = {}
): NewtabBackgroundSettingsView {
  return {
    ...normalizeTextureSettings(settings),
    ready: ui.ready ?? false,
    backgroundStatus: ui.backgroundStatus ?? '',
    backgroundStatusTone: ui.backgroundStatusTone ?? 'info',
    color: settings.color,
    imageName: settings.imageName,
    imageRowHidden: settings.type !== 'image',
    wallpaperAdjustmentsHidden: !doesBackgroundTypeTakeWallpaperAdjustments(settings.type),
    wallpaperEnabled: settings.wallpaperEnabled,
    wallpaperStyle: settings.wallpaperStyle,
    wallpaperBlur: settings.wallpaperBlur,
    wallpaperDim: settings.wallpaperDim,
    type: settings.type,
    url: settings.url,
    urlRowHidden: settings.type !== 'urls',
    videoName: settings.videoName,
    videoRowHidden: settings.type !== 'video'
  }
}

export function registerNewtabBackgroundSettingsActions(
  actions: NewtabBackgroundSettingsActions
): () => void {
  backgroundSettingsActions = actions
  return () => {
    if (backgroundSettingsActions === actions) {
      backgroundSettingsActions = EMPTY_ACTIONS
    }
  }
}

export function dispatchNewtabBackgroundSettingsView(view: NewtabBackgroundSettingsView): void {
  backgroundSettingsStore.setState(view)
}

export function useNewtabBackgroundSettingsView(): NewtabBackgroundSettingsView {
  return useUiViewStoreSlice(backgroundSettingsStore)
}

export function dispatchNewtabBackgroundSettingFieldChange(
  key: NewtabBackgroundSettingsFieldKey,
  value: number | string | boolean
): void {
  backgroundSettingsActions.onFieldChange(key, value)
}

export function dispatchNewtabBackgroundUrlCommit(): void {
  backgroundSettingsActions.onUrlCommit()
}

export function dispatchNewtabBackgroundFileSelect(
  mediaType: 'image' | 'video',
  file: File
): void {
  backgroundSettingsActions.onFileSelect(mediaType, file)
}
