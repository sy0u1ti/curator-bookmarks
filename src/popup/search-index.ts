import type { BookmarkTagIndex, BookmarkTagRecord } from '../shared/bookmark-tags.js'
import type {
  ContentSnapshotIndex,
  ContentSnapshotRecord,
  ContentSnapshotSettings
} from '../shared/content-snapshot-search.js'
import {
  loadContentSnapshotIndex,
  loadContentSnapshotSettings
} from '../shared/content-snapshot-search.js'
import type { BookmarkRecord } from '../shared/types.js'
import type {
  BookmarkCatalogSnapshot
} from '../shared/bookmark-catalog.js'
import type { CooperativeEnrichOptions } from '../shared/search/pinyin.js'
import {
  indexBookmarkForSearch,
  type PopupSearchBookmark
} from './search.js'

let pinyinModulePromise: Promise<typeof import('../shared/search/pinyin.js')> | null = null

function loadPinyinModule(): Promise<typeof import('../shared/search/pinyin.js')> {
  pinyinModulePromise ||= import('../shared/search/pinyin.js')
  return pinyinModulePromise
}

const POPUP_SNAPSHOT_FULL_TEXT_LIMIT = 600

interface PopupSearchEntryInputs {
  bookmark: BookmarkRecord
  tagRecord: BookmarkTagRecord | null
  snapshotRecord: ContentSnapshotRecord | null
  includeFullText: boolean
}

// indexBookmarkForSearch is a pure projection of these inputs. Remember them
// so a deferred patch only re-indexes entries whose tag or snapshot changed.
const entryInputs = new WeakMap<PopupSearchBookmark, PopupSearchEntryInputs>()
// The side panel rebuilds its index after every bookmark event, and extraction
// reuses unchanged records. An entry still projecting the same record, tag and
// snapshot (light, no full text) is reused with its pinyin tokens intact.
const lightEntriesByRecord = new WeakMap<BookmarkRecord, PopupSearchBookmark>()

export interface PopupSearchIndexSource {
  bookmarks: BookmarkRecord[]
  tagIndex: BookmarkTagIndex | null
  snapshotIndex?: ContentSnapshotIndex | null
  includeFullText?: boolean
}

export interface PopupSearchIndexSnapshotState {
  settings: ContentSnapshotSettings | null
  index: ContentSnapshotIndex | null
}

export function buildLightPopupSearchIndex({
  bookmarks,
  tagIndex,
  snapshotIndex = null
}: PopupSearchIndexSource): PopupSearchBookmark[] {
  const tagRecords = tagIndex?.records || {}
  const snapshotRecords = snapshotIndex?.records || {}

  return bookmarks.map((bookmark) => {
    const tagRecord = tagRecords[bookmark.id] || null
    const snapshotRecord = snapshotRecords[bookmark.id] || null
    const previous = lightEntriesByRecord.get(bookmark)
    const previousInputs = previous ? entryInputs.get(previous) : null
    if (
      previousInputs?.bookmark === bookmark &&
      previousInputs.tagRecord === tagRecord &&
      previousInputs.snapshotRecord === snapshotRecord &&
      !previousInputs.includeFullText
    ) {
      return previous
    }

    const entry = indexBookmarkForSearch(
      bookmark,
      tagRecord,
      snapshotRecord,
      { includeFullText: false }
    )
    entryInputs.set(entry, { bookmark, tagRecord, snapshotRecord, includeFullText: false })
    lightEntriesByRecord.set(bookmark, entry)
    return entry
  })
}

export async function loadPopupSearchIndexSnapshotState(): Promise<PopupSearchIndexSnapshotState> {
  const [settings, index] = await Promise.all([
    loadContentSnapshotSettings().catch(() => null),
    loadContentSnapshotIndex().catch(() => null)
  ])
  return { settings, index }
}

export async function enrichLightPopupSearchIndexWithPinyin(
  indexed: PopupSearchBookmark[],
  options: CooperativeEnrichOptions = {}
): Promise<{ processed: number; enriched: number; aborted: boolean }> {
  const { enrichPinyinTokensCooperatively } = await loadPinyinModule()
  return enrichPinyinTokensCooperatively(indexed, options)
}

export function shouldWarmPopupSnapshotFullText(
  snapshotState: PopupSearchIndexSnapshotState | null
): boolean {
  return Boolean(
    snapshotState?.settings?.fullTextSearchEnabled &&
    snapshotState.index &&
    Object.values(snapshotState.index.records || {}).some((record) =>
      (record.fullTextStorage === 'local' && Boolean(record.fullText)) ||
      (record.fullTextStorage === 'idb' && Boolean(record.fullTextRef))
    )
  )
}

export function buildLightPopupSearchIndexFromCatalog(
  catalog: BookmarkCatalogSnapshot
): PopupSearchBookmark[] {
  return buildLightPopupSearchIndex({
    bookmarks: catalog.extracted.bookmarks,
    tagIndex: catalog.tagIndex,
    snapshotIndex: catalog.snapshotState?.index || null
  })
}

export function patchLightPopupSearchIndexFromCatalog(
  indexed: PopupSearchBookmark[],
  catalog: BookmarkCatalogSnapshot
): number {
  return patchPopupSearchIndexFromCatalog(indexed, catalog, {
    includeFullText: false
  })
}

export async function enrichExistingPopupSearchIndexWithSnapshotFullTextFromCatalog(
  indexed: PopupSearchBookmark[],
  catalog: BookmarkCatalogSnapshot,
  options: {
    isActive?: () => boolean
  } = {}
): Promise<number> {
  const snapshotIndex = catalog.snapshotState?.index || null
  if (!snapshotIndex) {
    if (options.isActive && !options.isActive()) {
      return 0
    }
    return patchLightPopupSearchIndexFromCatalog(indexed, catalog)
  }

  if (options.isActive && !options.isActive()) {
    return 0
  }
  const { buildContentSnapshotSearchMapWithFullText } = await import('../shared/content-snapshots.js')
  const snapshotSearchMap = await buildContentSnapshotSearchMapWithFullText(snapshotIndex, {
    includeFullText: true,
    maxRecords: POPUP_SNAPSHOT_FULL_TEXT_LIMIT
  }).catch(() => new Map<string, string>())
  const searchIndexStillActive = !(options.isActive && !options.isActive())
  if (!searchIndexStillActive) {
    return 0
  }

  return patchPopupSearchIndexFromCatalog(indexed, catalog, {
    includeFullText: true,
    snapshotSearchMap
  })
}

function patchPopupSearchIndexFromCatalog(
  indexed: PopupSearchBookmark[],
  catalog: BookmarkCatalogSnapshot,
  {
    includeFullText,
    snapshotSearchMap = null
  }: {
    includeFullText: boolean
    snapshotSearchMap?: Map<string, string> | null
  }
): number {
  const tagRecords = catalog.tagIndex?.records || {}
  const snapshotIndex = catalog.snapshotState?.index || null
  const snapshotRecords = snapshotIndex?.records || {}
  const sourceBookmarks = catalog.extracted.bookmarks
  let patched = 0

  for (let index = 0; index < indexed.length; index += 1) {
    const target = indexed[index]
    if (!target) {
      continue
    }

    const sourceBookmark = sourceBookmarks[index]?.id === target.id
      ? sourceBookmarks[index]
      : catalog.extracted.bookmarkMap.get(target.id) || target
    const tagRecord = tagRecords[target.id] || null
    const snapshotRecord = snapshotRecords[target.id] || null
    const snapshotSearchText = snapshotSearchMap?.get(target.id)
    const previousInputs = entryInputs.get(target)
    if (
      !snapshotSearchText &&
      previousInputs?.bookmark === sourceBookmark &&
      previousInputs.tagRecord === tagRecord &&
      previousInputs.snapshotRecord === snapshotRecord &&
      previousInputs.includeFullText === includeFullText
    ) {
      // The same inputs project to the same entry. Keep it, including any
      // pinyin tokens that were derived from its unchanged search text.
      continue
    }

    const next = indexBookmarkForSearch(
      sourceBookmark,
      tagRecord,
      snapshotRecord,
      { includeFullText }
    )
    if (snapshotSearchText) {
      next.searchText = `${next.searchText} ${snapshotSearchText}`.trim()
      entryInputs.delete(target)
    } else {
      entryInputs.set(target, { bookmark: sourceBookmark, tagRecord, snapshotRecord, includeFullText })
    }

    patchPopupSearchBookmark(target, next)
    patched += 1
  }

  return patched
}

function patchPopupSearchBookmark(
  target: PopupSearchBookmark,
  next: PopupSearchBookmark
): void {
  Object.assign(target, next)
  target.tagPinyinFull = []
  target.tagPinyinInitials = []
  delete target.pinyinBaseSearchText
  delete target.pinyinEnriched
}
