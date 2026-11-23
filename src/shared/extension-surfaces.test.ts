import assert from 'node:assert/strict'
import {
  buildBookmarkManagerAnchor,
  buildBookmarkManagerHash,
  parseBookmarkManagerAnchor
} from './extension-surfaces.js'

assert.equal(buildBookmarkManagerAnchor(), '')
assert.equal(buildBookmarkManagerAnchor({}), '')
assert.equal(buildBookmarkManagerHash(), '#bookmarks')

const folderHash = buildBookmarkManagerHash({ folderId: '42' })
assert.equal(folderHash, '#bookmarks:folder=42')
assert.deepEqual(parseBookmarkManagerAnchor(folderHash.slice('#bookmarks:'.length)), {
  folderId: '42'
})

const bookmarkHash = buildBookmarkManagerHash({ bookmarkId: '99', folderId: '42' })
assert.deepEqual(parseBookmarkManagerAnchor(bookmarkHash.slice('#bookmarks:'.length)), {
  bookmarkId: '99',
  folderId: '42'
})

const queryAnchor = buildBookmarkManagerAnchor({ folderId: '12', query: 'AI 工具 & 提示词' })
assert.deepEqual(parseBookmarkManagerAnchor(queryAnchor), {
  folderId: '12',
  query: 'AI 工具 & 提示词'
})

assert.deepEqual(parseBookmarkManagerAnchor(''), {})
assert.deepEqual(parseBookmarkManagerAnchor('section'), {})

console.log('Extension surfaces bookmark manager deep-link tests passed.')
