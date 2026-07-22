import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { ShortcutControlsState } from './shortcut-types.js'

const defaultShortcutControlsState: ShortcutControlsState = {
  detail: '',
  list: { kind: 'loading' },
  loading: true,
  statusLabel: '读取中',
  statusTone: 'muted'
}

const shortcutControlsStore = createUiViewStoreSlice(
  'options',
  'shortcut-controls',
  defaultShortcutControlsState
)

export function publishShortcutControls(state: ShortcutControlsState): void {
  shortcutControlsStore.setState(state)
}

export function useShortcutControlsState(): ShortcutControlsState {
  return useUiViewStoreSlice(shortcutControlsStore)
}
