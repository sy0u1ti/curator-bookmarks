import { isExternallyCheckableUrl } from '../shared/sensitive-url.js'
import type { PopupSmartClassifierViewModel } from './components/PopupViewModels.js'

interface PopupSmartClassifierRenderState {
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
  currentUrl,
  smartStatus
}: PopupSmartClassifierRenderState): PopupSmartClassifierViewModel['status'] {
  if (!isExternallyCheckableUrl(currentUrl)) {
    return 'idle'
  }

  if (SMART_CLASSIFIER_ACTIVE_STATUSES.has(smartStatus as PopupSmartClassifierViewModel['status'])) {
    return smartStatus as PopupSmartClassifierViewModel['status']
  }

  return 'idle'
}

export function isPopupSmartClassifierActiveStatus(status: string): boolean {
  return SMART_CLASSIFIER_ACTIVE_STATUSES.has(status as PopupSmartClassifierViewModel['status'])
}
