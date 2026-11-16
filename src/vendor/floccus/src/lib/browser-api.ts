/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Curator replacement for floccus' src/lib/browser-api.js.
 *
 * The original promisifies a snapshot of `chrome` taken when the module loads.
 * Curator requests `tabs`, `tabGroups`, `identity` and `history` only when a
 * profile needs them, and a snapshot would not see an API that was granted
 * afterwards. Manifest V3 APIs return promises natively, so this module reads
 * `chrome` at call time instead.
 *
 * It also keeps the engine's storage entries in a namespace of their own and
 * reports the bookmarks a sync creates, so the host can tell them apart from
 * the ones the user adds.
 */
import { i18n } from './native/I18n'

declare const chrome: any

export const STORAGE_PREFIX = 'curatorSync:'

export interface LocalBookmarkCreateDetails {
  parentId?: string
  title?: string
  url?: string
  index?: number
}

type LocalBookmarkCreateObserver = (details: LocalBookmarkCreateDetails) => void

let localBookmarkCreateObserver: LocalBookmarkCreateObserver | null = null

export function setLocalBookmarkCreateObserver(observer: LocalBookmarkCreateObserver | null): void {
  localBookmarkCreateObserver = observer
}

const prefixed = (key: string): string => STORAGE_PREFIX + key

function unprefix(values: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values || {})) {
    if (key.startsWith(STORAGE_PREFIX)) {
      result[key.slice(STORAGE_PREFIX.length)] = value
    }
  }
  return result
}

const local = {
  async get(keys: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>> {
    if (typeof keys === 'string') {
      return unprefix(await chrome.storage.local.get(prefixed(keys)))
    }
    if (Array.isArray(keys)) {
      return unprefix(await chrome.storage.local.get(keys.map(prefixed)))
    }
    if (keys && typeof keys === 'object') {
      const defaults: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(keys)) {
        defaults[prefixed(key)] = value
      }
      return unprefix(await chrome.storage.local.get(defaults))
    }
    // Reading everything would hand the engine the host's own entries
    throw new Error('The sync engine may only read its own storage entries')
  },
  async set(values: Record<string, unknown>): Promise<void> {
    const entries: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(values)) {
      entries[prefixed(key)] = value
    }
    await chrome.storage.local.set(entries)
  },
  async remove(keys: string | string[]): Promise<void> {
    await chrome.storage.local.remove(Array.isArray(keys) ? keys.map(prefixed) : prefixed(keys))
  },
}

const storage = { local }

const bookmarks = new Proxy({}, {
  get(_target, name: string) {
    if (name === 'create') {
      return (details: LocalBookmarkCreateDetails) => {
        if (localBookmarkCreateObserver) {
          try {
            localBookmarkCreateObserver(details)
          } catch (e) {
            console.warn(e)
          }
        }
        return chrome.bookmarks.create(details)
      }
    }
    const value = chrome.bookmarks[name]
    return typeof value === 'function' ? value.bind(chrome.bookmarks) : value
  },
})

// The host extension ships no _locales, so chrome.i18n has nothing to offer
const messages = {
  getMessage: (name: string, substitutions?: unknown) => i18n.getMessage(name, substitutions),
}

const browser: any = new Proxy({}, {
  get(_target, name: string) {
    if (name === 'storage') return storage
    if (name === 'bookmarks') return bookmarks
    if (name === 'i18n') return messages
    return chrome[name]
  },
  has(_target, name: string) {
    return name in chrome
  },
})

export default browser
