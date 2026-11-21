import { isPopupSmartClassifiableUrl } from './popup-page-policy.js'
import type { PopupSmartClassifierViewModel } from './components/PopupViewModels.js'

interface PopupSmartClassifierRenderState {
  currentTabHydrated?: boolean
  currentUrl: string
  isLoading: boolean
  smartStatus: string
}

const SMART_CLASSIFIER_ACTIVE_STATUSES = new Set<PopupSmartClassifierViewModel['status']>([
  'loading',
  'results',
  'error',
  'permission'
])

export function getPopupSmartClassifierRenderStatus({
  currentTabHydrated = true,
  currentUrl,
  smartStatus
}: PopupSmartClassifierRenderState): PopupSmartClassifierViewModel['status'] {
  if (!currentTabHydrated && !currentUrl) {
    return 'page-loading'
  }

  if (!isPopupSmartClassifiableUrl(currentUrl)) {
    return 'idle'
  }

  if (SMART_CLASSIFIER_ACTIVE_STATUSES.has(smartStatus as PopupSmartClassifierViewModel['status'])) {
    return smartStatus as PopupSmartClassifierViewModel['status']
  }

  return 'idle'
}

