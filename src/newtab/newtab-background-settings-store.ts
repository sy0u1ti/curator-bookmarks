import { useSyncExternalStore } from 'react'
import type { FeaturedBackgroundPreferences } from './featured-gallery-preferences'

export interface NewtabBackgroundSettingsView {
  color: string
  displaySize: number
  displaySizeMax: number
  displaySizeMin: number
  featuredCreditHidden: boolean
  featuredDisplayHidden: boolean
  featuredId: string
  featuredPickerDisabled: boolean
  featuredPickerHidden: boolean
  imageName: string
  imageRowHidden: boolean
  maskBlur: number
  maskEnabled: boolean
  maskStyle: string
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
  maskBlur: number
  maskStyle: string
  type: string
  url: string
  videoName: string
}

export type NewtabBackgroundSettingsFieldKey =
  | 'color'
  | 'displaySize'
  | 'featuredId'
  | 'maskBlur'
  | 'maskStyle'
  | 'positionX'
  | 'positionY'
  | 'type'
  | 'url'

export interface NewtabBackgroundSettingsActions {
  onFieldChange: (key: NewtabBackgroundSettingsFieldKey, value: number | string) => void
  onMaskToggle: (enabled: boolean) => void
  onUrlCommit: () => void
}

const EMPTY_VIEW: NewtabBackgroundSettingsView = {
  color: '#101013',
  displaySize: 100,
  displaySizeMax: 180,
  displaySizeMin: 100,
  featuredCreditHidden: true,
  featuredDisplayHidden: true,
  featuredId: '',
  featuredPickerDisabled: true,
  featuredPickerHidden: true,
  imageName: '',
  imageRowHidden: true,
  maskBlur: 12,
  maskEnabled: false,
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
  onFieldChange: () => {},
  onMaskToggle: () => {},
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
  }
): NewtabBackgroundSettingsView {
  return {
    color: settings.color,
    displaySize: preferences.displaySize,
    displaySizeMax: limits.displaySize.max,
    displaySizeMin: limits.displaySize.min,
    featuredCreditHidden: settings.type !== 'featured',
    featuredDisplayHidden: settings.type !== 'featured',
    featuredId: settings.featuredId,
    featuredPickerDisabled: settings.type !== 'featured',
    featuredPickerHidden: settings.type !== 'featured',
    imageName: settings.imageName,
    imageRowHidden: settings.type !== 'image',
    maskBlur: settings.maskBlur,
    maskEnabled: settings.maskEnabled,
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

export function dispatchNewtabBackgroundSettingFieldChange(
  key: NewtabBackgroundSettingsFieldKey,
  value: number | string
): void {
  backgroundSettingsActions.onFieldChange(key, value)
}

export function dispatchNewtabBackgroundUrlCommit(): void {
  backgroundSettingsActions.onUrlCommit()
}
