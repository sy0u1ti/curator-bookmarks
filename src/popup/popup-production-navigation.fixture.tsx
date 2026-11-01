import { state } from './state'
import { dispatchPopupContentAction, getPopupContentSnapshot } from './popup-controller-store'
import './main'

// Keep the actual startup, controller, search catalog, view stores and UI.
// The HTTP harness replaces Chrome I/O only, not the navigation implementation.
;(window as any).__productionNavigation = {
  read: () => ({
    loading: state.isLoading,
    metadataPending: state.searchMetadataPending,
    count: state.allBookmarks.length,
    folders: state.allFolders.length,
    index: state.keyboardPane === 'folders' ? state.activeFolderKeyboardIndex : state.activeResultIndex,
    pane: state.keyboardPane,
    query: state.debouncedQuery,
    rendered: getPopupContentSnapshot().state.mainRows?.length || 0
  }),
  select(index: number, pane: 'bookmarks' | 'folders') {
    dispatchPopupContentAction({
      action: pane === 'folders' ? 'set-active-folder' : 'set-active-result',
      index
    })
  }
}
