import { MODELS_DEV_ORIGIN } from './models-dev.js'
import { MODELS_DEV_ERROR_LABELS } from './models-dev-cache.js'
import type { ModelsDevMessage, ModelsDevSyncResult } from './models-dev-sync.js'

export async function requestModelsDevUpdate(message: ModelsDevMessage): Promise<ModelsDevSyncResult> {
  try {
    // Request in the click handler's user gesture, never in the background worker.
    if (message.type === 'models-dev:refresh' || message.autoUpdate) {
      if (!await chrome.permissions.request({ origins: [MODELS_DEV_ORIGIN] })) return { ok: false, error: 'permission' }
    }
    const result = await chrome.runtime.sendMessage(message) as ModelsDevSyncResult | undefined
    if (result?.ok === true) return { ok: true, updated: result.updated === true }
    return result?.ok === false && Object.hasOwn(MODELS_DEV_ERROR_LABELS, result.error) ? result : { ok: false, error: 'network' }
  } catch { return { ok: false, error: 'network' } }
}
