import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'
import type { NewTabTimeSettings } from './time-settings'

export interface NewtabClockView {
  ariaLabel: string
  dateDateTime: string
  dateText: string
  periodText: string
  settings: NewTabTimeSettings
  timeDateTime: string
  timeText: string
}

const clockStore = createUiViewStoreSlice<NewtabClockView | null>('newtab', 'clock', null)

export function dispatchNewtabClockView(view: NewtabClockView | null): void {
  clockStore.setState(view ? { ...view } : null)
}

export function useNewtabClockView(): NewtabClockView | null {
  return useUiViewStoreSlice(clockStore)
}
