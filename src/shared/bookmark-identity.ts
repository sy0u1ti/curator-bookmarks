import {
  buildDuplicateKey,
  extractDomain,
  normalizeText
} from './text.js'
import type { BookmarkRecord } from './types.js'

export const BOOKMARK_IDENTITY_SCHEMA_VERSION = 1

export interface BookmarkIdentityComponents {
  urlKey: string
  titleKey: string
  pathKey: string
  domain: string
}

export interface BookmarkIdentity {
  schemaVersion: typeof BOOKMARK_IDENTITY_SCHEMA_VERSION
  identity: string
  fingerprint: string
  sourceBookmarkId: string
  components: BookmarkIdentityComponents
}

export interface BookmarkBackupRecord {
  schemaVersion: typeof BOOKMARK_IDENTITY_SCHEMA_VERSION
  identity: BookmarkIdentity
  bookmark: {
    title: string
    url: string
    path: string
    parentId: string
    index: number
    dateAdded: number
  }
}

export interface BookmarkBackupPackage {
  schemaVersion: typeof BOOKMARK_IDENTITY_SCHEMA_VERSION
  exportedAt: number
  bookmarks: BookmarkBackupRecord[]
}

export function createBookmarkIdentity(bookmark: Pick<BookmarkRecord, 'id' | 'title' | 'url' | 'path' | 'domain'>): BookmarkIdentity {
  const components = getBookmarkIdentityComponents(bookmark)
  const identitySource = [
    'bookmark',
    'identity',
    components.urlKey,
    components.pathKey
  ].join('\n')
  const fingerprintSource = [
    'bookmark',
    'fingerprint',
    components.urlKey,
    components.pathKey,
    components.titleKey
  ].join('\n')

  return {
    schemaVersion: BOOKMARK_IDENTITY_SCHEMA_VERSION,
    identity: `bookmark:v1:${hashStableString(identitySource)}`,
    fingerprint: `bookmark:v1:${hashStableString(fingerprintSource)}`,
    sourceBookmarkId: String(bookmark.id || ''),
    components
  }
}

export function getBookmarkIdentityComponents(
  bookmark: Pick<BookmarkRecord, 'title' | 'url' | 'path' | 'domain'>
): BookmarkIdentityComponents {
  const urlKey = buildDuplicateKey(bookmark.url)
  const pathKey = normalizeText(bookmark.path || '')
  const titleKey = normalizeText(bookmark.title || '')
  const domain = normalizeText(bookmark.domain || extractDomain(bookmark.url))

  return {
    urlKey,
    titleKey,
    pathKey,
    domain
  }
}

export function buildBookmarkBackupRecord(bookmark: BookmarkRecord): BookmarkBackupRecord {
  return {
    schemaVersion: BOOKMARK_IDENTITY_SCHEMA_VERSION,
    identity: createBookmarkIdentity(bookmark),
    bookmark: {
      title: bookmark.title,
      url: bookmark.url,
      path: bookmark.path,
      parentId: bookmark.parentId,
      index: bookmark.index,
      dateAdded: bookmark.dateAdded
    }
  }
}

export function buildBookmarkBackupPackage(
  bookmarks: BookmarkRecord[],
  exportedAt = Date.now()
): BookmarkBackupPackage {
  return {
    schemaVersion: BOOKMARK_IDENTITY_SCHEMA_VERSION,
    exportedAt,
    bookmarks: bookmarks.map((bookmark) => buildBookmarkBackupRecord(bookmark))
  }
}

export function hashStableString(value: unknown): string {
  const text = String(value || '')
  let hash = 0x811c9dc5

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(36).padStart(7, '0')
}
