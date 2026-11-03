import { createRoot } from 'react-dom/client'
import { OptionsApp } from './OptionsApp'
import { availabilityState, managerState } from './shared-options/state'
import { handleAvailabilityPanelAction } from './options-controller'
import { buildFailureClassification } from './sections/classifier'

const qa = {
  ready: () => !availabilityState.catalogLoading && !availabilityState.storageLoading && !availabilityState.permissionPending,
  state: () => ({
    deleting: availabilityState.deleting,
    running: availabilityState.runSessionActive,
    selected: [...managerState.selectedAvailabilityIds],
    review: availabilityState.reviewResults.map(row => row.id),
    failed: availabilityState.failedResults.map(row => row.id),
    availableCount: availabilityState.availableCount,
    healthy: [...availabilityState.checkedHealthyBookmarkIds],
    redirected: availabilityState.redirectResults.map(row => row.id),
    abnormalHistory: managerState.currentHistoryEntries.map(row => row.id),
    recycle: managerState.recycleBin,
    error: availabilityState.lastError
  }),
  seed() {
    const results = availabilityState.allBookmarks.filter(bookmark => !bookmark.id.startsWith('login-')).map(bookmark => {
      const review = bookmark.id === 'review'
      const permission = bookmark.id === 'permission'
      const statusCode = review ? 403 : 404
      return {
        ...buildFailureClassification(bookmark, [{
          status: 'failed', finalUrl: permission ? 'https://canonical.example.org/page' : bookmark.url,
          detail: 'HTTP ' + statusCode, errorCode: permission ? 'ungranted-redirect' : 'http-' + statusCode,
          networkEvidence: { requestSent: true, requestedUrl: bookmark.url, method: 'GET', statusCode,
            finalResponseObserved: !permission, redirects: [], timing: {} }
        }], null, false),
        historyStatus: bookmark.id === 'persistent' ? 'persistent' : 'new',
        abnormalStreak: bookmark.id === 'persistent' ? 2 : 1
      }
    })
    availabilityState.reviewResults = results.filter(row => row.status === 'review')
    availabilityState.failedResults = results.filter(row => row.status === 'failed')
    availabilityState.reviewCount = availabilityState.reviewResults.length
    availabilityState.failedCount = availabilityState.failedResults.length
    availabilityState.checkedBookmarks = results.length
    availabilityState.runTotalBookmarks = results.length
    availabilityState.runStartedAt = Date.now() - 1500
    availabilityState.lastCompletedAt = Date.now()
    availabilityState.lastRunOutcome = 'completed'
    managerState.currentHistoryEntries = []
    handleAvailabilityPanelAction({ action: 'filter-change', filter: 'all' })
  },
  seedLoginReviews() {
    const results = availabilityState.allBookmarks.filter(bookmark => bookmark.id.startsWith('login-')).map(bookmark => ({
      ...bookmark, status: 'review' as const, finalUrl: bookmark.url, badgeText: '需要登录',
      detail: '旧版登录误报', errorCode: 'login-required', historyStatus: 'persistent', abnormalStreak: 2
    }))
    availabilityState.reviewResults = results
    availabilityState.failedResults = []
    availabilityState.redirectResults = []
    availabilityState.reviewCount = results.length
    availabilityState.failedCount = 0
    availabilityState.availableCount = 0
    availabilityState.redirectedCount = 0
    availabilityState.checkedBookmarks = results.length
    availabilityState.runTotalBookmarks = results.length
    availabilityState.runStartedAt = Date.now() - 1500
    availabilityState.lastCompletedAt = Date.now()
    availabilityState.lastRunOutcome = 'completed'
    managerState.currentHistoryEntries = results.map(row => ({ ...row, streak: 2 }))
    handleAvailabilityPanelAction({ action: 'filter-change', filter: 'all' })
  }
}
;(window as any).__availabilityQA = qa
createRoot(document.getElementById('options-root')!).render(<OptionsApp />)
