import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'
import type { PopupContentChangeDetail } from './popup-controller-store'
import type { PopupContentViewModel } from './components/PopupViewModels'

export interface PopupNavigationSnapshot extends PopupContentChangeDetail {
  presentation: PopupContentViewModel
}

export function createPopupNavigationViewStore(initial: PopupContentChangeDetail) {
  let snapshot: PopupNavigationSnapshot = { ...initial, presentation: initial.state }
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    publish(detail: PopupContentChangeDetail) {
      // The catalog/header tree is not selection state. Rows subscribe to a
      // boolean below, while each virtual window subscribes only to its range.
      const presentation = detail.selectionOnly && detail.state.keyboardPane === snapshot.state.keyboardPane
        ? snapshot.presentation : detail.state
      snapshot = { ...detail, presentation }
      listeners.forEach(listener => listener())
    }
  }
}

export type PopupNavigationViewStore = ReturnType<typeof createPopupNavigationViewStore>
export const PopupNavigationContext = createContext<PopupNavigationViewStore | null>(null)
export const subscribeNoPopupNavigation = () => () => {}

export function usePopupNavigationStore() {
  return useContext(PopupNavigationContext)
}

export function getPopupRowNavigationFlags(
  current: PopupNavigationSnapshot | null,
  pane: 'bookmarks' | 'folders',
  index: number,
  fallbackActive: boolean,
  fallbackDeferred = false
): number {
  if (!current) return Number(fallbackActive) | (fallbackActive && fallbackDeferred ? 2 : 0)
  const activeIndex = pane === 'folders' ? current.state.activeFolderIndex : current.state.activeResultIndex
  const active = activeIndex === undefined ? fallbackActive
    : (current.state.keyboardPane || 'bookmarks') === pane && activeIndex === index
  return Number(active) | (active && current.navigation === 'repeat' ? 2 : 0)
}

export function usePopupRowNavigation(
  pane: 'bookmarks' | 'folders',
  index: number,
  fallbackActive: boolean,
  fallbackDeferred = false
) {
  const store = usePopupNavigationStore()
  const getSnapshot = useCallback(() => getPopupRowNavigationFlags(
    store?.getSnapshot() || null, pane, index, fallbackActive, fallbackDeferred
  ), [fallbackActive, fallbackDeferred, index, pane, store])
  const flags = useSyncExternalStore(store?.subscribe || subscribeNoPopupNavigation, getSnapshot, getSnapshot)
  return { active: Boolean(flags & 1), deferActions: Boolean(flags & 2) }
}
