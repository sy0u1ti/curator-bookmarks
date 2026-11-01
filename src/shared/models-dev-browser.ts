import { STORAGE_KEYS } from './constants.js'
import { MODELS_DEV_ORIGIN } from './models-dev.js'
import { createModelsDevSyncService, MODELS_DEV_ALARM } from './models-dev-sync.js'
import { getLocalStorage, setLocalStorage, withLocalStorageTransaction } from './storage.js'

/** The options page and MV3 worker share storage, consent and alarm ownership. */
export function createBrowserModelsDevSyncService() {
  return createModelsDevSyncService({
    read: (keys = [STORAGE_KEYS.modelsDevCatalog, STORAGE_KEYS.modelsDevSync]) => getLocalStorage(keys),
    write: setLocalStorage,
    hasPermission: () => chrome.permissions.contains({ origins: [MODELS_DEV_ORIGIN] }),
    transaction: (task) => withLocalStorageTransaction((transaction) => task({
      read: (keys = [STORAGE_KEYS.modelsDevCatalog, STORAGE_KEYS.modelsDevSync]) => getLocalStorage(keys),
      write: (values) => setLocalStorage(values, { transaction })
    })),
    schedule: async (when) => {
      if (when === null) await chrome.alarms.clear(MODELS_DEV_ALARM)
      else await chrome.alarms.create(MODELS_DEV_ALARM, { when })
    }
  })
}
