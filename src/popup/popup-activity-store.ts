import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'
import { PopupActivityQueue, type PopupActivitySnapshot } from './popup-activity.js'

const activityStore = createUiViewStoreSlice<PopupActivitySnapshot>(
  'popup', 'activity', { items: [], activeId: null }
)

export const popupActivities = new PopupActivityQueue(snapshot => activityStore.setState(snapshot))

export function usePopupActivity(): PopupActivitySnapshot {
  return useUiViewStoreSlice(activityStore, snapshot => snapshot)
}
