import assert from 'node:assert/strict'
import type { BookmarkCatalogSnapshot } from '../shared/bookmark-catalog.js'
import type { BookmarkRecord } from '../shared/types.js'
import { enrichLightPopupSearchIndexWithPinyin, patchLightPopupSearchIndexFromCatalog } from './search-index.js'
import { indexBookmarkForSearch, searchBookmarks } from './search.js'

async function run(): Promise<void> {
  const bookmark: BookmarkRecord = {
    id: 'bookmark-card-directory',
    title: '卡网大全',
    url: 'https://example.invalid/item',
    displayUrl: 'example.invalid/item',
    normalizedTitle: '卡网大全',
    normalizedUrl: 'https://example.invalid/item',
    duplicateKey: 'https://example.invalid/item',
    domain: 'example.invalid',
    path: '书签栏 / 市场 / AI API / 卡网',
    ancestorIds: ['1', 'market', 'ai', 'card'],
    parentId: 'card',
    index: 0,
    dateAdded: 1
  }
  const indexedBookmarks = [indexBookmarkForSearch(bookmark)]
  const catalog: BookmarkCatalogSnapshot = {
    version: 'pinyin-refresh-race-test',
    includeFullText: false,
    extracted: {
      bookmarks: [bookmark],
      folders: [],
      bookmarkMap: new Map([[bookmark.id, bookmark]]),
      folderMap: new Map(),
      catalogVersionFingerprint: {
        bookmarkHash: 'bookmark',
        folderHash: 'folder'
      }
    },
    tagIndex: null,
    snapshotState: null
  }

  assert.equal(searchBookmarks('kaw', indexedBookmarks).length, 0, 'light indexes should not accidentally match pinyin before enrichment')

  await enrichLightPopupSearchIndexWithPinyin(indexedBookmarks)
  assert.equal(searchBookmarks('kaw', indexedBookmarks)[0]?.id, bookmark.id, 'pinyin enrichment should make 卡网 discoverable through kaw')

  patchLightPopupSearchIndexFromCatalog(indexedBookmarks, catalog)
  assert.equal(searchBookmarks('kaw', indexedBookmarks).length, 0, 'deferred catalog patches should invalidate the old pinyin projection')

  await enrichLightPopupSearchIndexWithPinyin(indexedBookmarks)
  assert.equal(searchBookmarks('kaw', indexedBookmarks)[0]?.id, bookmark.id, 're-enrichment should restore the same pinyin result after a deferred patch')
}

await run()
console.log('Popup pinyin search tests passed.')
