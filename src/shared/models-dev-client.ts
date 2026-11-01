import { MODELS_DEV_ORIGIN } from './models-dev.js'
import { createBrowserModelsDevSyncService } from './models-dev-browser.js'
import type { ModelsDevMessage, ModelsDevSyncResult } from './models-dev-sync.js'

let service: ReturnType<typeof createBrowserModelsDevSyncService> | undefined

export async function requestModelsDevUpdate(message: ModelsDevMessage): Promise<ModelsDevSyncResult> {
  try {
    // Request in the click handler's user gesture, never in the background worker.
    if (message.type === 'models-dev:refresh' || message.autoUpdate) {
      if (!await chrome.permissions.request({ origins: [MODELS_DEV_ORIGIN] })) return { ok: false, error: 'permission' }
    }
  } catch { return { ok: false, error: 'permission' } }

  // An explicit download belongs to this extension page. It must not depend on
  // a sleeping, outdated or disconnected service-worker message listener.
  service ??= createBrowserModelsDevSyncService()
  if (message.type === 'models-dev:refresh') return service.refresh()
  const result = await service.configure(message.autoUpdate)
  if (result.ok && message.autoUpdate) void service.refresh(false)
  return result
}
