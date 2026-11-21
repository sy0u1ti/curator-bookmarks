import { MODELS_DEV_ORIGIN } from '../shared/models-dev.js'
import { MODELS_DEV_ALARM } from '../shared/models-dev-sync.js'
import { createBrowserModelsDevSyncService } from '../shared/models-dev-browser.js'
import { STORAGE_KEYS } from '../shared/constants.js'
import { normalizeModelsDevSyncSettings } from '../shared/models-dev-cache.js'
import { getLocalStorage } from '../shared/storage.js'

export function registerModelsDevSync(): void {
  const service = createBrowserModelsDevSyncService()
  const reconcileOnWake = async (): Promise<void> => {
    const [stored, alarm] = await Promise.all([
      getLocalStorage([STORAGE_KEYS.modelsDevSync]).catch(() => ({} as Record<string, unknown>)),
      chrome.alarms.get(MODELS_DEV_ALARM).catch(() => undefined)
    ])
    const settings = normalizeModelsDevSyncSettings(stored[STORAGE_KEYS.modelsDevSync])
    if (!settings.autoUpdate && !alarm) return
    await service.refresh(false)
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'models-dev:refresh' && message?.type !== 'models-dev:configure') return
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) {
      sendResponse({ ok: false, error: 'permission' })
      return
    }
    if (message.type === 'models-dev:configure' && typeof message.autoUpdate !== 'boolean') {
      sendResponse({ ok: false, error: 'invalid_catalog' })
      return
    }
    const task = message.type === 'models-dev:refresh'
      ? service.refresh()
      : service.configure(message.autoUpdate)
    void task.then((result) => {
      sendResponse(result)
      if (result.ok && message.type === 'models-dev:configure' && message.autoUpdate) void service.refresh(false)
    })
    return true
  })
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === MODELS_DEV_ALARM) void service.refresh(false)
  })
  chrome.permissions.onRemoved.addListener(() => {
    void chrome.permissions.contains({ origins: [MODELS_DEV_ORIGIN] })
      .then((granted) => { if (!granted) return service.configure(false) })
      .catch(() => {})
  })
  chrome.runtime.onStartup.addListener(() => { void service.refresh(false) })
  chrome.runtime.onInstalled.addListener(() => { void service.refresh(false) })
  // MV3 alarms can disappear across browser restarts; a worker wake repairs them.
  void reconcileOnWake()
}
