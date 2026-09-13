import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'

const help = createUiViewStoreSlice('popup', 'keyboard-help', false)
export const setPopupKeyboardHelpOpen = (open: boolean) => help.setState(open)
export const isPopupKeyboardHelpOpen = () => help.getState()
export const usePopupKeyboardHelpOpen = () => useUiViewStoreSlice(help)

export interface PopupSearchAccessibility { query: string; activeId: string; count: number; pending: boolean }
const empty: PopupSearchAccessibility = { query: '', activeId: '', count: 0, pending: false }
const accessibility = createUiViewStoreSlice('popup', 'search-accessibility', empty)
export const usePopupSearchAccessibility = () => useUiViewStoreSlice(accessibility)
export function usePopupSearchInputAria(query: string) {
  const state = usePopupSearchAccessibility()
  const expanded = Boolean(query.trim() && query.trim() === state.query && state.count)
  return {
    role: 'combobox' as const,
    'aria-haspopup': 'grid' as const,
    'aria-autocomplete': 'list' as const,
    'aria-expanded': expanded,
    'aria-controls': expanded ? 'popup-search-results' : undefined,
    'aria-activedescendant': expanded && state.activeId ? state.activeId : undefined
  }
}
export function getPopupSearchGridAria(mode: 'tree' | 'search', count: number, hasPlaceholder: boolean) {
  return mode === 'search' && !hasPlaceholder && count > 0 ? {
    role: 'grid' as const,
    'aria-rowcount': count,
    'aria-colcount': 2
  } : {}
}
export function publishPopupSearchAccessibility(next: PopupSearchAccessibility): void {
  const old = accessibility.getState()
  if (old.query !== next.query || old.activeId !== next.activeId || old.count !== next.count || old.pending !== next.pending) accessibility.setState(next)
}
export const getPopupSearchResultId = (id: string) => `popup-search-result-${encodeURIComponent(id)}`
