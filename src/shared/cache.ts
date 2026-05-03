export interface MemoryCacheOptions<K> {
  maxEntries: number
  ttlMs?: number
  version?: string
  normalizeKey?: (key: K) => K
  now?: () => number
}

interface MemoryCacheEntry<V> {
  value: V
  version: string
  updatedAt: number
}

export interface MemoryCache<K, V> {
  readonly size: number
  get(key: K): V | undefined
  has(key: K): boolean
  set(key: K, value: V): void
  delete(key: K): boolean
  clear(): void
  prune(): void
  keys(): IterableIterator<K>
  setVersion(version: string): void
}

export function createMemoryCache<K, V>(options: MemoryCacheOptions<K>): MemoryCache<K, V> {
  const maxEntries = Math.max(0, Math.floor(Number(options.maxEntries) || 0))
  const ttlMs = normalizeTtl(options.ttlMs)
  const normalizeKey = options.normalizeKey || ((key: K) => key)
  const now = options.now || Date.now
  let version = String(options.version || '1')
  const entries = new Map<K, MemoryCacheEntry<V>>()

  function normalizeCacheKey(key: K): K {
    return normalizeKey(key)
  }

  function isExpired(entry: MemoryCacheEntry<V>, timestamp = now()): boolean {
    if (entry.version !== version) {
      return true
    }

    return ttlMs !== null && timestamp - entry.updatedAt >= ttlMs
  }

  function evictOverflow() {
    if (maxEntries <= 0) {
      entries.clear()
      return
    }

    while (entries.size > maxEntries) {
      const oldest = entries.keys().next()
      if (oldest.done) {
        return
      }
      entries.delete(oldest.value)
    }
  }

  const cache: MemoryCache<K, V> = {
    get size() {
      cache.prune()
      return entries.size
    },

    get(key: K) {
      const normalizedKey = normalizeCacheKey(key)
      const entry = entries.get(normalizedKey)
      if (!entry) {
        return undefined
      }

      if (isExpired(entry)) {
        entries.delete(normalizedKey)
        return undefined
      }

      entries.delete(normalizedKey)
      entries.set(normalizedKey, entry)
      return entry.value
    },

    has(key: K) {
      const normalizedKey = normalizeCacheKey(key)
      const entry = entries.get(normalizedKey)
      if (!entry) {
        return false
      }

      if (isExpired(entry)) {
        entries.delete(normalizedKey)
        return false
      }

      entries.delete(normalizedKey)
      entries.set(normalizedKey, entry)
      return true
    },

    set(key: K, value: V) {
      const normalizedKey = normalizeCacheKey(key)
      entries.delete(normalizedKey)
      entries.set(normalizedKey, {
        value,
        version,
        updatedAt: now()
      })
      evictOverflow()
    },

    delete(key: K) {
      return entries.delete(normalizeCacheKey(key))
    },

    clear() {
      entries.clear()
    },

    prune() {
      const timestamp = now()
      for (const [key, entry] of entries) {
        if (isExpired(entry, timestamp)) {
          entries.delete(key)
        }
      }
      evictOverflow()
    },

    keys() {
      cache.prune()
      return entries.keys()
    },

    setVersion(nextVersion: string) {
      const normalizedVersion = String(nextVersion || '1')
      if (normalizedVersion === version) {
        return
      }

      version = normalizedVersion
      entries.clear()
    }
  }

  return cache
}

function normalizeTtl(value: unknown): number | null {
  const ttl = Math.floor(Number(value))
  return Number.isFinite(ttl) && ttl > 0 ? ttl : null
}
