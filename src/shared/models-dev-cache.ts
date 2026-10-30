import { STORAGE_KEYS } from './constants.js'
import { parseModelsDevCatalog, type ModelsDevCatalog } from './models-dev.js'
import { getLocalStorage } from './storage.js'

export type ModelsDevSyncError = 'permission' | 'network' | 'invalid_catalog' | 'too_large' | 'storage'

export interface ModelsDevCache {
  version: 1
  catalog: ModelsDevCatalog
  checkedAt: number
  updatedAt: number
  etag?: string
}

export interface ModelsDevSyncSettings {
  autoUpdate: boolean
  lastAttemptAt: number
  failures: number
  lastError: ModelsDevSyncError | ''
}

export interface ModelsDevSnapshot {
  loaded: boolean
  cache: ModelsDevCache | null
  settings: ModelsDevSyncSettings
}

export const DEFAULT_MODELS_DEV_SETTINGS: ModelsDevSyncSettings = {
  autoUpdate: false,
  lastAttemptAt: 0,
  failures: 0,
  lastError: ''
}

export const MODELS_DEV_ERROR_LABELS: Record<ModelsDevSyncError, string> = {
  permission: '未授权访问 models.dev',
  network: '暂时无法连接 models.dev，请稍后重试',
  invalid_catalog: '模型资料格式无效，已保留本地资料',
  too_large: '模型资料超过大小限制，已保留本地资料',
  storage: '模型资料未能保存，请稍后重试'
}

export function normalizeModelsDevSyncSettings(value: unknown): ModelsDevSyncSettings {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    autoUpdate: source.autoUpdate === true,
    lastAttemptAt: timestamp(source.lastAttemptAt),
    failures: typeof source.failures === 'number' && Number.isFinite(source.failures) ? Math.max(0, Math.min(10, Math.floor(source.failures))) : 0,
    lastError: typeof source.lastError === 'string' && Object.hasOwn(MODELS_DEV_ERROR_LABELS, source.lastError) ? source.lastError as ModelsDevSyncError : ''
  }
}

export function normalizeModelsDevEtag(value: unknown): string | undefined {
  return typeof value === 'string' && /^(?:W\/)?"[^\u0000-\u001f\u007f"]{1,200}"$/.test(value) ? value : undefined
}

function timestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 8.64e15 ? value : 0
}

export function normalizeModelsDevCache(value: unknown): ModelsDevCache | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, unknown>
  if (source.version !== 1 || !timestamp(source.checkedAt) || !timestamp(source.updatedAt)) return null
  try {
    return {
      version: 1,
      catalog: parseModelsDevCatalog(source.catalog, true),
      checkedAt: timestamp(source.checkedAt),
      updatedAt: timestamp(source.updatedAt),
      etag: normalizeModelsDevEtag(source.etag)
    }
  } catch { return null }
}

let snapshot: ModelsDevSnapshot = { loaded: false, cache: null, settings: { ...DEFAULT_MODELS_DEV_SETTINGS } }
let pending: Promise<ModelsDevSnapshot> | null = null
let loadingChanges: Record<string, unknown> | null = null
let listening = false
const listeners = new Set<() => void>()

export function getModelsDevSnapshot(): ModelsDevSnapshot {
  return snapshot
}

function applyChanges(values: Record<string, unknown>, loaded = snapshot.loaded): void {
  snapshot = {
    loaded,
    cache: Object.hasOwn(values, STORAGE_KEYS.modelsDevCatalog) ? normalizeModelsDevCache(values[STORAGE_KEYS.modelsDevCatalog]) : snapshot.cache,
    settings: Object.hasOwn(values, STORAGE_KEYS.modelsDevSync) ? normalizeModelsDevSyncSettings(values[STORAGE_KEYS.modelsDevSync]) : snapshot.settings
  }
  for (const notify of listeners) notify()
}

function ensureListener(): void {
  if (listening || typeof chrome === 'undefined' || !chrome.storage?.onChanged?.addListener) return
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    const values: Record<string, unknown> = {}
    for (const key of [STORAGE_KEYS.modelsDevCatalog, STORAGE_KEYS.modelsDevSync]) {
      if (Object.hasOwn(changes, key)) values[key] = changes[key].newValue
    }
    if (!Object.keys(values).length) return
    if (loadingChanges) Object.assign(loadingChanges, values)
    applyChanges(values)
  })
  listening = true
}

/** One local read per context; subsequent requests use the immutable last-good snapshot. */
export async function loadModelsDevSnapshot(): Promise<ModelsDevSnapshot> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local?.get) return snapshot
  ensureListener()
  if (snapshot.loaded) return snapshot
  if (!pending) {
    loadingChanges = {}
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('storage_timeout')), 1500)
    })
    pending = Promise.race([getLocalStorage([STORAGE_KEYS.modelsDevCatalog, STORAGE_KEYS.modelsDevSync]), timeout])
      .then((stored) => {
        applyChanges({
          [STORAGE_KEYS.modelsDevCatalog]: null,
          [STORAGE_KEYS.modelsDevSync]: null,
          ...stored,
          ...loadingChanges
        }, true)
        return snapshot
      })
      .catch(() => {
        applyChanges({ [STORAGE_KEYS.modelsDevSync]: { ...snapshot.settings, lastError: 'storage' } }, true)
        return snapshot
      })
      .finally(() => { clearTimeout(timer); pending = null; loadingChanges = null })
  }
  return pending
}

export function subscribeModelsDevSnapshot(listener: () => void): () => void {
  ensureListener()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
