import { STORAGE_KEYS } from '../shared/constants.js'
import { MODELS_DEV_ORIGIN } from '../shared/models-dev.js'
import { createModelsDevSyncService, MODELS_DEV_ALARM } from '../shared/models-dev-sync.js'
import { getLocalStorage, setLocalStorage } from '../shared/storage.js'

export function registerModelsDevSync(): void {
  const service = createModelsDevSyncService({
    read: (keys = [STORAGE_KEYS.modelsDevCatalog, STORAGE_KEYS.modelsDevSync]) => getLocalStorage(keys),
    write: setLocalStorage,
    hasPermission: () => chrome.permissions.contains({ origins: [MODELS_DEV_ORIGIN] }),
    schedule: async (when) => {
      if (when === null) await chrome.alarms.clear(MODELS_DEV_ALARM)
      else await chrome.alarms.create(MODELS_DEV_ALARM, { when })
    }
  })
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
  void service.refresh(false)
}
