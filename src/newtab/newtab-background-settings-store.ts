import { useSyncExternalStore } from 'react'
import type { FeaturedBackgroundPreferences } from './featured-gallery-preferences.js'
import {
  doesBackgroundMaskFilterSupportGeometry,
  isLegacyBackgroundMaskStyle,
  isWallpaperFilterMaskStyle,
  type BackgroundMaskStyle
} from './background-mask-settings.js'

export interface NewtabBackgroundSettingsView {
  backgroundStatus: string
  backgroundStatusTone: 'info' | 'success' | 'warning' | 'error'
  color: string
  displaySize: number
  displaySizeMax: number
  displaySizeMin: number
  featuredCreditHref: string
  featuredCreditHidden: boolean
  featuredCreditText: string
  featuredCreditTitle: string
  featuredDisplayHidden: boolean
  featuredId: string
  featuredPickerDisabled: boolean
  featuredPickerExpanded: boolean
  featuredPickerHidden: boolean
  featuredPickerLabel: string
  featuredPickerSelected: boolean
  imageName: string
  imageRowHidden: boolean
  maskBlur: number
  maskBlurHidden: boolean
  maskEnabled: boolean
  maskFilterHover: boolean
  maskFilterHoverHidden: boolean
  maskFilterSize: number
  maskFilterSizeHidden: boolean
  maskFilterSpacing: number
  maskFilterSpacingHidden: boolean
  maskFilterStrength: number
  maskFilterStrengthHidden: boolean
  maskOverlay: number
  maskStyle: BackgroundMaskStyle
  maskStyleHidden: boolean
  positionX: number
  positionXMax: number
  positionXMin: number
  positionY: number
  positionYMax: number
  positionYMin: number
  type: string
  url: string
  urlRowHidden: boolean
  videoName: string
  videoRowHidden: boolean
}

export interface NewtabBackgroundSettingsSource {
  color: string
  featuredId: string
  imageName: string
  maskEnabled: boolean
  maskFilterHover: boolean
  maskBlur: number
  maskFilterSize: number
  maskFilterSpacing: number
  maskFilterStrength: number
  maskOverlay: number
  maskStyle: BackgroundMaskStyle
  type: string
  url: string
  videoName: string
}

export type NewtabBackgroundSettingsFieldKey =
  | 'color'
  | 'displaySize'
  | 'featuredId'
  | 'maskBlur'
  | 'maskFilterSize'
  | 'maskFilterSpacing'
  | 'maskFilterStrength'
  | 'maskOverlay'
  | 'maskStyle'
  | 'positionX'
  | 'positionY'
  | 'type'
  | 'url'

export interface NewtabBackgroundSettingsActions {
  onFileSelect: (mediaType: 'image' | 'video', file: File) => void
  onFieldChange: (key: NewtabBackgroundSettingsFieldKey, value: number | string) => void
  onMaskToggle: (enabled: boolean) => void
  onFilterHoverToggle: (enabled: boolean) => void
  onUrlCommit: () => void
}

const EMPTY_VIEW: NewtabBackgroundSettingsView = {
  backgroundStatus: '',
  backgroundStatusTone: 'info',
  color: '#101013',
  displaySize: 100,
  displaySizeMax: 180,
  displaySizeMin: 100,
  featuredCreditHref: 'https://images.nasa.gov/',
  featuredCreditHidden: true,
  featuredCreditText: 'NASA Image and Video Library',
  featuredCreditTitle: '',
  featuredDisplayHidden: true,
  featuredId: '',
  featuredPickerDisabled: true,
  featuredPickerExpanded: false,
  featuredPickerHidden: true,
  featuredPickerLabel: '选择壁纸',
  featuredPickerSelected: false,
  imageName: '',
  imageRowHidden: true,
  maskBlur: 12,
  maskBlurHidden: true,
  maskEnabled: false,
  maskFilterHover: true,
  maskFilterHoverHidden: true,
  maskFilterSize: 50,
  maskFilterSizeHidden: true,
  maskFilterSpacing: 50,
  maskFilterSpacingHidden: true,
  maskFilterStrength: 50,
  maskFilterStrengthHidden: true,
  maskOverlay: 50,
  maskStyle: 'dark',
  maskStyleHidden: true,
  positionX: 50,
  positionXMax: 100,
  positionXMin: 0,
  positionY: 50,
  positionYMax: 100,
  positionYMin: 0,
  type: 'color',
  url: '',
  urlRowHidden: true,
  videoName: '',
  videoRowHidden: true
}

const EMPTY_ACTIONS: NewtabBackgroundSettingsActions = {
  onFileSelect: () => {},
  onFieldChange: () => {},
  onMaskToggle: () => {},
  onFilterHoverToggle: () => {},
  onUrlCommit: () => {}
}

let backgroundSettingsView: NewtabBackgroundSettingsView = EMPTY_VIEW
let backgroundSettingsActions: NewtabBackgroundSettingsActions = EMPTY_ACTIONS

const listeners = new Set<() => void>()

function subscribeBackgroundSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitBackgroundSettingsChange(): void {
  listeners.forEach((listener) => listener())
}

export function createNewtabBackgroundSettingsView(
  settings: NewtabBackgroundSettingsSource,
  preferences: FeaturedBackgroundPreferences,
  limits: {
    displaySize: { min: number; max: number }
    positionX: { min: number; max: number }
    positionY: { min: number; max: number }
  },
  ui: Partial<Pick<
    NewtabBackgroundSettingsView,
    | 'backgroundStatus'
    | 'backgroundStatusTone'
    | 'featuredCreditHref'
    | 'featuredCreditText'
    | 'featuredCreditTitle'
    | 'featuredPickerExpanded'
    | 'featuredPickerLabel'
    | 'featuredPickerSelected'
  >> = {}
): NewtabBackgroundSettingsView {
  const featuredPickerSelected = ui.featuredPickerSelected ?? Boolean(settings.featuredId)
  const maskControlsHidden = !settings.maskEnabled
  const maskFilterSelected = isWallpaperFilterMaskStyle(settings.maskStyle)
  const maskFilterGeometrySupported = doesBackgroundMaskFilterSupportGeometry(settings.maskStyle)

  return {
    backgroundStatus: ui.backgroundStatus ?? '',
    backgroundStatusTone: ui.backgroundStatusTone ?? 'info',
    color: settings.color,
    displaySize: preferences.displaySize,
    displaySizeMax: limits.displaySize.max,
    displaySizeMin: limits.displaySize.min,
    featuredCreditHref: ui.featuredCreditHref ?? 'https://images.nasa.gov/',
    featuredCreditHidden: settings.type !== 'featured',
    featuredCreditText: ui.featuredCreditText ?? 'NASA Image and Video Library',
    featuredCreditTitle: ui.featuredCreditTitle ?? '',
    featuredDisplayHidden: settings.type !== 'featured',
    featuredId: settings.featuredId,
    featuredPickerDisabled: settings.type !== 'featured',
    featuredPickerExpanded: ui.featuredPickerExpanded ?? false,
    featuredPickerHidden: settings.type !== 'featured',
    featuredPickerLabel: ui.featuredPickerLabel ?? '选择壁纸',
    featuredPickerSelected,
    imageName: settings.imageName,
    imageRowHidden: settings.type !== 'image',
    maskBlur: settings.maskBlur,
    maskBlurHidden: maskControlsHidden || !isLegacyBackgroundMaskStyle(settings.maskStyle),
    maskEnabled: settings.maskEnabled,
    maskFilterHover: settings.maskFilterHover,
    maskFilterHoverHidden: maskControlsHidden || !maskFilterGeometrySupported,
    maskFilterSize: settings.maskFilterSize,
    maskFilterSizeHidden: maskControlsHidden || !maskFilterGeometrySupported,
    maskFilterSpacing: settings.maskFilterSpacing,
    maskFilterSpacingHidden: maskControlsHidden || !maskFilterGeometrySupported,
    maskFilterStrength: settings.maskFilterStrength,
    maskFilterStrengthHidden: maskControlsHidden || !maskFilterSelected,
    maskOverlay: settings.maskOverlay,
    maskStyle: settings.maskStyle,
    maskStyleHidden: !settings.maskEnabled,
    positionX: preferences.positionX,
    positionXMax: limits.positionX.max,
    positionXMin: limits.positionX.min,
    positionY: preferences.positionY,
    positionYMax: limits.positionY.max,
    positionYMin: limits.positionY.min,
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
  backgroundSettingsView = view
  emitBackgroundSettingsChange()
}

export function useNewtabBackgroundSettingsView(): NewtabBackgroundSettingsView {
  return useSyncExternalStore(
    subscribeBackgroundSettings,
    () => backgroundSettingsView,
    () => EMPTY_VIEW
  )
}

export function dispatchNewtabBackgroundMaskToggle(enabled: boolean): void {
  backgroundSettingsActions.onMaskToggle(enabled)
}

export function dispatchNewtabBackgroundFilterHoverToggle(enabled: boolean): void {
  backgroundSettingsActions.onFilterHoverToggle(enabled)
}

export function dispatchNewtabBackgroundSettingFieldChange(
  key: NewtabBackgroundSettingsFieldKey,
  value: number | string
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
