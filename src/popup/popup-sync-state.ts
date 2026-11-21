import { useEffect } from 'react'
import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'
import { requestSync } from '../shared/sync/sync-messages.js'
import { SYNC_ACCOUNTS_STORAGE_KEY } from '../shared/sync/sync-contract.js'
import type { SyncStatusSummary } from '../shared/sync/sync-status.js'
import { consumePrefetchedPopupSyncStatus } from './popup-startup-data.js'

const openStore = createUiViewStoreSlice('popup', 'sync-open', false)
const statusStore = createUiViewStoreSlice<{ status: SyncStatusSummary | null; error: string; settled: boolean }>(
  'popup', 'sync-status', { status: null, error: '', settled: false }
)
export const usePopupSyncOpen = () => useUiViewStoreSlice(openStore)
export const isPopupSyncOpen = () => openStore.getState()
export const setPopupSyncOpen = (open: boolean) => openStore.setState(open)
export const usePopupSyncStatus = () => useUiViewStoreSlice(statusStore)

export function usePopupSyncMonitor() {
  useEffect(() => {
    let alive = true
    let pending = false
    let dirty = false
    const refresh = async (usePrefetch = false) => {
      if (pending) { dirty = true; return }
      pending = true
      do {
        dirty = false
        try {
          const prefetched = usePrefetch ? await consumePrefetchedPopupSyncStatus().catch(() => null) : null
          usePrefetch = false
          const status = prefetched ?? await requestSync({ type: 'sync:status' })
          if (alive && !dirty) statusStore.setState({ status, error: '', settled: true })
        } catch (reason) {
          if (alive && !dirty) statusStore.setState({
            ...statusStore.getState(),
            error: reason instanceof Error ? reason.message : '同步状态读取失败',
            settled: true
          })
        }
      } while (alive && dirty)
      pending = false
    }
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[SYNC_ACCOUNTS_STORAGE_KEY]) void refresh()
    }
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      statusStore.setState({ ...statusStore.getState(), settled: true })
      return
    }
    void refresh(true)
    chrome.storage.onChanged.addListener(changed)
    const timer = setInterval(() => void refresh(), 60000)
    return () => {
      alive = false
      clearInterval(timer)
      chrome.storage.onChanged.removeListener(changed)
      openStore.setState(false)
      statusStore.setState({ status: null, error: '', settled: false })
    }
  }, [])
}
