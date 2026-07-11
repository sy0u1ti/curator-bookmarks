const NEWTAB_FAVICON_READY_REGISTRY_KEY = '__curatorNewtabReadyFavicons'
const NEWTAB_FAVICON_READY_REGISTRY_LIMIT = 1200
const TRACKABLE_FAVICON_SOURCE_PATTERN = /^(?:chrome-extension|chrome|https?):/i

type FaviconReadinessGlobal = typeof globalThis & {
  [NEWTAB_FAVICON_READY_REGISTRY_KEY]?: Set<string>
}

export function isNewtabFaviconReady(source: string): boolean {
  const normalizedSource = normalizeTrackableFaviconSource(source)
  return Boolean(normalizedSource && getNewtabFaviconReadyRegistry().has(normalizedSource))
}

export function markNewtabFaviconReady(source: string): void {
  const normalizedSource = normalizeTrackableFaviconSource(source)
  if (!normalizedSource) {
    return
  }

  const registry = getNewtabFaviconReadyRegistry()
  if (registry.has(normalizedSource)) {
    return
  }
  while (registry.size >= NEWTAB_FAVICON_READY_REGISTRY_LIMIT) {
    const oldestSource = registry.values().next().value
    if (typeof oldestSource !== 'string') {
      break
    }
    registry.delete(oldestSource)
  }
  registry.add(normalizedSource)
}

export function markNewtabFaviconNotReady(source: string): void {
  const normalizedSource = normalizeTrackableFaviconSource(source)
  if (normalizedSource) {
    getNewtabFaviconReadyRegistry().delete(normalizedSource)
  }
}

function getNewtabFaviconReadyRegistry(): Set<string> {
  const host = globalThis as FaviconReadinessGlobal
  const current = host[NEWTAB_FAVICON_READY_REGISTRY_KEY]
  if (current instanceof Set) {
    return current
  }

  const registry = new Set<string>()
  host[NEWTAB_FAVICON_READY_REGISTRY_KEY] = registry
  return registry
}

function normalizeTrackableFaviconSource(source: string): string {
  const normalizedSource = String(source || '').trim()
  return normalizedSource.length <= 4096 && TRACKABLE_FAVICON_SOURCE_PATTERN.test(normalizedSource)
    ? normalizedSource
    : ''
}
