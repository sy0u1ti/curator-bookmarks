import {
  buildDuplicateKey,
  displayUrl,
  extractDomain,
  normalizeText,
  normalizeUrl
} from './text.js'
import { BOOKMARKS_BAR_ID, ROOT_ID } from './constants.js'
import type {
  BookmarkRecord,
  BookmarkCatalogVersionFingerprint,
  ExtractedBookmarkData,
  FolderRecord
} from './types.js'

const BOOKMARK_CATALOG_HASH_SEED = 0x811c9dc5
const BOOKMARK_CATALOG_HASH_ALT_SEED = 0x9e3779b9
const BOOKMARK_CATALOG_HASH_MULTIPLIER = 0x01000193
const BOOKMARK_CATALOG_HASH_ALT_MULTIPLIER = 0x85ebca6b

export function extractBookmarkData(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null | undefined
): ExtractedBookmarkData {
  const bookmarks: BookmarkRecord[] = []
  const folders: FolderRecord[] = []
  const bookmarkMap = new Map<string, BookmarkRecord>()
  const folderMap = new Map<string, FolderRecord>()
  let bookmarkHash = BOOKMARK_CATALOG_HASH_SEED >>> 0
  let folderHash = BOOKMARK_CATALOG_HASH_ALT_SEED >>> 0

  function walk(
    node: chrome.bookmarks.BookmarkTreeNode,
    ancestorIds: string[] = [],
    folderPath = ''
  ): void {
    const isRoot = node.id === ROOT_ID
    const nodeId = String(node.id)
    const nodeTitle = String(node.title || '')
    const hasPathSegment = !isRoot && Boolean(nodeTitle)
    const currentAncestorIds = hasPathSegment ? [...ancestorIds, nodeId] : ancestorIds
    const currentPath = hasPathSegment
      ? folderPath
        ? `${folderPath} / ${nodeTitle}`
        : nodeTitle
      : folderPath

    if (!node.url && !isRoot) {
      const children = node.children || []
      let folderCount = 0
      let bookmarkCount = 0
      for (const child of children) {
        if (child.url) {
          bookmarkCount += 1
        } else {
          folderCount += 1
        }
      }

      const folder: FolderRecord = {
        id: nodeId,
        title: nodeTitle || '未命名文件夹',
        path: currentPath,
        normalizedTitle: normalizeText(nodeTitle),
        normalizedPath: normalizeText(currentPath),
        depth: currentAncestorIds.length,
        folderCount,
        bookmarkCount
      }

      folders.push(folder)
      folderMap.set(folder.id, folder)
      folderHash = updateCatalogRecordHash(
        folderHash,
        BOOKMARK_CATALOG_HASH_ALT_MULTIPLIER,
        [
          folder.id,
          folder.path,
          String(folder.bookmarkCount || 0),
          String(folder.folderCount || 0)
        ]
      )
    }

    for (const child of node.children || []) {
      if (child.url) {
        const bookmark: BookmarkRecord = {
          id: String(child.id),
          title: child.title || '未命名书签',
          url: child.url,
          displayUrl: displayUrl(child.url),
          normalizedTitle: normalizeText(child.title || ''),
          normalizedUrl: normalizeUrl(child.url),
          duplicateKey: buildDuplicateKey(child.url),
          domain: extractDomain(child.url),
          path: currentPath,
          ancestorIds: currentAncestorIds.slice(),
          parentId: String(child.parentId || currentAncestorIds.at(-1) || ''),
          index: typeof child.index === 'number' ? child.index : 0,
          dateAdded: Number(child.dateAdded) || 0
        }

        bookmarks.push(bookmark)
        bookmarkMap.set(bookmark.id, bookmark)
        bookmarkHash = updateCatalogRecordHash(
          bookmarkHash,
          BOOKMARK_CATALOG_HASH_MULTIPLIER,
          [
            bookmark.id,
            bookmark.parentId,
            bookmark.duplicateKey,
            String(bookmark.dateAdded || 0)
          ]
        )
      } else {
        walk(child, currentAncestorIds, currentPath)
      }
    }
  }

  if (rootNode) {
    walk(rootNode)
  }

  return {
    bookmarks,
    folders,
    bookmarkMap,
    folderMap,
    catalogVersionFingerprint: createCatalogVersionFingerprint(bookmarkHash, folderHash)
  }
}

function createCatalogVersionFingerprint(
  bookmarkHash: number,
  folderHash: number
): BookmarkCatalogVersionFingerprint {
  return {
    bookmarkHash: (bookmarkHash >>> 0).toString(36),
    folderHash: (folderHash >>> 0).toString(36)
  }
}

function updateCatalogRecordHash(hash: number, multiplier: number, values: unknown[]): number {
  let next = hash >>> 0
  for (const value of values) {
    next = updateCatalogHash(next, value, multiplier)
  }
  return updateCatalogHash(next, '\u001f', multiplier)
}

function updateCatalogHash(hash: number, value: unknown, multiplier: number): number {
  let next = hash >>> 0
  const text = String(value ?? '')
  for (let index = 0; index < text.length; index += 1) {
    next ^= text.charCodeAt(index)
    next = Math.imul(next, multiplier) >>> 0
  }
  return next >>> 0
}

export function findBookmarksBar(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null | undefined
): chrome.bookmarks.BookmarkTreeNode | null {
  const children = rootNode?.children || []
  return (
    children.find((child) => child.id === BOOKMARKS_BAR_ID) ||
    children.find((child) => !child.url) ||
    null
  )
}

export function findNodeById(
  node: chrome.bookmarks.BookmarkTreeNode | null | undefined,
  targetId: string
): chrome.bookmarks.BookmarkTreeNode | null {
  if (!node) {
    return null
  }

  if (node.id === targetId) {
    return node
  }

  for (const child of node.children || []) {
    const match = findNodeById(child, targetId)
    if (match) {
      return match
    }
  }

  return null
}
