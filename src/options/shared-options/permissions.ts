import {
  assessSensitiveExternalUrl,
  isExternallyCheckableUrl
} from '../../shared/sensitive-url.js'

// An origin pattern depends only on the URL text. Options collects origins for
// several scopes of the same catalog, so each bookmark URL is parsed once.
const REQUEST_ORIGIN_CACHE_LIMIT = 50000
const requestOriginCache = new Map<string, string>()

export function collectRequestOrigins(bookmarks: Array<{ url?: string }>): string[] {
  const origins = new Set<string>()

  for (const bookmark of bookmarks) {
    const origin = getRequestOriginPattern(String(bookmark.url || ''))
    if (origin) {
      origins.add(origin)
    }
  }

  return [...origins].sort((left, right) => left.localeCompare(right))
}

function getRequestOriginPattern(url: string): string {
  let origin = requestOriginCache.get(url)
  if (origin !== undefined) {
    return origin
  }

  origin = ''
  try {
    const parsedUrl = new URL(url)
    if (/^https?:$/i.test(parsedUrl.protocol) && !assessSensitiveExternalUrl(parsedUrl.href).sensitive) {
      origin = `${parsedUrl.origin}/*`
    }
  } catch {
    origin = ''
  }

  if (requestOriginCache.size >= REQUEST_ORIGIN_CACHE_LIMIT) {
    requestOriginCache.clear()
  }
  requestOriginCache.set(url, origin)
  return origin
}

export function isCheckableUrl(url: unknown): boolean {
  return isExternallyCheckableUrl(url)
}

export function getOriginPermissionPattern(url: unknown): string {
  try {
    const parsedUrl = new URL(String(url || '').trim())
    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      return ''
    }

    return `${parsedUrl.origin}/*`
  } catch {
    return ''
  }
}

export function containsPermissions(query: chrome.permissions.Permissions): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.permissions.contains(query, (granted) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(Boolean(granted))
    })
  })
}

export function requestPermissions(query: chrome.permissions.Permissions): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.permissions.request(query, (granted) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(Boolean(granted))
    })
  })
}
