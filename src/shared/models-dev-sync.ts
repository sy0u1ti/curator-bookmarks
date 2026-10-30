import { STORAGE_KEYS } from './constants.js'
import {
  MODELS_DEV_MAX_BYTES, MODELS_DEV_REFRESH_MS, MODELS_DEV_URL, parseModelsDevCatalog
} from './models-dev.js'
import {
  normalizeModelsDevCache, normalizeModelsDevEtag, normalizeModelsDevSyncSettings,
  type ModelsDevCache, type ModelsDevSyncError, type ModelsDevSyncSettings
} from './models-dev-cache.js'

export const MODELS_DEV_ALARM = 'curator:models-dev-refresh'
const RETRY_MS = 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 20000

export type ModelsDevMessage =
  | { type: 'models-dev:refresh' }
  | { type: 'models-dev:configure'; autoUpdate: boolean }

export type ModelsDevSyncResult = { ok: true; updated?: boolean } | { ok: false; error: ModelsDevSyncError }

export interface ModelsDevSyncDependencies {
  read: (keys?: string[]) => Promise<Record<string, unknown>>
  write: (values: Record<string, unknown>) => Promise<void>
  hasPermission: () => Promise<boolean>
  schedule: (when: number | null) => Promise<void>
  fetch?: typeof fetch
  now?: () => number
  timeoutMs?: number
}

export function getModelsDevNextRefresh(cache: ModelsDevCache | null, settings: ModelsDevSyncSettings, now: number): number {
  const freshUntil = cache && cache.checkedAt <= now ? cache.checkedAt + MODELS_DEV_REFRESH_MS : 0
  const retryAt = settings.failures && settings.lastAttemptAt <= now
    ? settings.lastAttemptAt + Math.min(MODELS_DEV_REFRESH_MS, RETRY_MS * 2 ** (settings.failures - 1))
    : 0
  return Math.max(freshUntil, retryAt)
}

export function createModelsDevSyncService(deps: ModelsDevSyncDependencies) {
  const now = deps.now ?? Date.now
  const fetchImpl = deps.fetch ?? globalThis.fetch
  let inFlight: Promise<ModelsDevSyncResult> | null = null
  let inFlightManual = false
  let activeController: AbortController | null = null
  let activeIsAutomatic = false
  let generation = 0
  let configurationSequence = 0
  let writeQueue = Promise.resolve()
  // Fetch outside the queue; commits re-read preferences so a concurrent opt-out wins.
  function commit(task: (stored: Record<string, unknown>) => Promise<void>): Promise<void> {
    const next = writeQueue.catch(() => {}).then(async () => task(await deps.read([STORAGE_KEYS.modelsDevSync])))
    writeQueue = next.catch(() => {})
    return next
  }

  async function schedule(): Promise<void> {
    await commit(async (stored) => {
      const settings = normalizeModelsDevSyncSettings(stored[STORAGE_KEYS.modelsDevSync])
      const cached = settings.autoUpdate ? await deps.read([STORAGE_KEYS.modelsDevCatalog]) : {}
      const cache = normalizeModelsDevCache(cached[STORAGE_KEYS.modelsDevCatalog])
      await deps.schedule(settings.autoUpdate ? Math.max(now() + 60000, getModelsDevNextRefresh(cache, settings, now())) : null)
    })
  }

  async function performRefresh(manual: boolean): Promise<ModelsDevSyncResult> {
    const startedGeneration = generation
    const stored = await deps.read([STORAGE_KEYS.modelsDevSync])
    const settings = normalizeModelsDevSyncSettings(stored[STORAGE_KEYS.modelsDevSync])
    if (!manual && !settings.autoUpdate) return { ok: true, updated: false }
    const cached = await deps.read([STORAGE_KEYS.modelsDevCatalog])
    const cache = normalizeModelsDevCache(cached[STORAGE_KEYS.modelsDevCatalog])
    if (!manual && (!settings.autoUpdate || getModelsDevNextRefresh(cache, settings, now()) > now())) return { ok: true, updated: false }
    let failure: ModelsDevSyncError = 'network'
    activeIsAutomatic = !manual
    try {
      if (!await deps.hasPermission()) {
        failure = 'permission'
        throw new Error(failure)
      }
      if (!manual && startedGeneration !== generation) return { ok: true, updated: false }
      const controller = new AbortController()
      activeController = controller
      const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? REQUEST_TIMEOUT_MS)
      let nextCache: ModelsDevCache
      let updated = false
      try {
        const response = await fetchImpl(MODELS_DEV_URL, {
          method: 'GET',
          headers: { Accept: 'application/json', ...(cache?.etag ? { 'If-None-Match': cache.etag } : {}) },
          cache: 'no-cache',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          redirect: 'error',
          signal: controller.signal
        })
        if (response.status === 304 && cache) {
          nextCache = { ...cache, checkedAt: now() }
        } else {
          if (!response.ok) throw new Error('network')
          const contentType = response.headers.get('content-type') ?? ''
          if (!/^application\/(?:[\w.+-]+\+)?json(?:;|$)/i.test(contentType)) throw new Error('invalid_catalog')
          const json = await readCatalogResponse(response)
          const catalog = parseModelsDevCatalog(json)
          nextCache = {
            version: 1, catalog, checkedAt: now(), updatedAt: now(),
            etag: normalizeModelsDevEtag(response.headers.get('etag'))
          }
          updated = true
        }
      } finally {
        clearTimeout(timer)
        activeController = null
      }
      if (!manual && startedGeneration !== generation) return { ok: true, updated: false }
      failure = 'storage'
      await commit(async (latest) => {
        if (!manual && startedGeneration !== generation) return
        const latestSettings = normalizeModelsDevSyncSettings(latest[STORAGE_KEYS.modelsDevSync])
        await deps.write({
          [STORAGE_KEYS.modelsDevCatalog]: nextCache,
          [STORAGE_KEYS.modelsDevSync]: { ...latestSettings, lastAttemptAt: now(), failures: 0, lastError: '' }
        })
      })
      return { ok: true, updated }
    } catch (error) {
      if (!manual && startedGeneration !== generation) return { ok: true, updated: false }
      if (error instanceof Error && ['invalid_catalog', 'too_large'].includes(error.message)) failure = error.message as ModelsDevSyncError
      await commit(async (latest) => {
        const latestSettings = normalizeModelsDevSyncSettings(latest[STORAGE_KEYS.modelsDevSync])
        await deps.write({
          [STORAGE_KEYS.modelsDevSync]: { ...latestSettings, lastAttemptAt: now(), failures: Math.min(10, latestSettings.failures + 1), lastError: failure }
        })
      }).catch(() => {})
      return { ok: false, error: failure }
    }
  }

  function refresh(manual = true): Promise<ModelsDevSyncResult> {
    // A startup check may skip downloading; it must not swallow an explicit refresh.
    if (inFlight && manual && !inFlightManual) return inFlight.then(() => refresh(true))
    if (!inFlight) {
      inFlightManual = manual
      inFlight = performRefresh(manual)
        .catch((): ModelsDevSyncResult => ({ ok: false, error: 'storage' }))
        .finally(async () => {
          activeIsAutomatic = false
          try { await schedule() } catch { /* A later worker wake repairs the alarm. */ }
          inFlight = null
        })
    }
    return inFlight
  }

  async function configure(autoUpdate: boolean): Promise<ModelsDevSyncResult> {
    const sequence = ++configurationSequence
    try {
      if (autoUpdate && !await deps.hasPermission()) return { ok: false, error: 'permission' }
      if (sequence !== configurationSequence) return { ok: true }
      if (!autoUpdate) {
        generation += 1
        if (activeIsAutomatic) activeController?.abort()
      }
      await commit(async (stored) => {
        if (sequence !== configurationSequence) return
        const settings = normalizeModelsDevSyncSettings(stored[STORAGE_KEYS.modelsDevSync])
        await deps.write({ [STORAGE_KEYS.modelsDevSync]: { ...settings, autoUpdate } })
      })
      await schedule()
      return { ok: true }
    } catch { return { ok: false, error: 'storage' } }
  }

  return { refresh, configure }
}

async function readCatalogResponse(response: Response): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > MODELS_DEV_MAX_BYTES) {
    await response.body?.cancel().catch(() => {})
    throw new Error('too_large')
  }
  if (!response.body) throw new Error('invalid_catalog')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MODELS_DEV_MAX_BYTES) throw new Error('too_large')
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally { reader.releaseLock() }
  try { return JSON.parse(text) } catch { throw new Error('invalid_catalog') }
}
