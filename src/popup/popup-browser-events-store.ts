export interface PopupBrowserEventActions {
  onDocumentKeyDown: (event: KeyboardEvent) => void
  onPageHide: (event: PageTransitionEvent) => void
  onStorageChanged: (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => void
}

const EMPTY_POPUP_BROWSER_EVENT_ACTIONS: PopupBrowserEventActions = {
  onDocumentKeyDown: () => {},
  onPageHide: () => {},
  onStorageChanged: () => {}
}

let popupBrowserEventActions: PopupBrowserEventActions = EMPTY_POPUP_BROWSER_EVENT_ACTIONS

export function registerPopupBrowserEventActions(actions: PopupBrowserEventActions): () => void {
  popupBrowserEventActions = actions
  return () => {
    if (popupBrowserEventActions === actions) {
      popupBrowserEventActions = EMPTY_POPUP_BROWSER_EVENT_ACTIONS
    }
  }
}

export function dispatchPopupDocumentKeyDown(event: KeyboardEvent): void {
  popupBrowserEventActions.onDocumentKeyDown(event)
}

export function dispatchPopupPageHide(event: PageTransitionEvent): void {
  popupBrowserEventActions.onPageHide(event)
}

export function dispatchPopupStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void {
  popupBrowserEventActions.onStorageChanged(changes, areaName)
}
