import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  BACKGROUND_URL_MAX_BYTES,
  buildMinimalBookmarkMoveOperations,
  validateBackgroundBlobSize,
  validateBackgroundContentLength
} from '../src/newtab/interactions.js'

test('builds minimal bookmark move operations for a drag reorder', () => {
  assert.deepEqual(
    buildMinimalBookmarkMoveOperations(['a', 'b', 'c', 'd'], ['a', 'c', 'b', 'd'], 'folder-1'),
    [
      { id: 'b', parentId: 'folder-1', index: 2 }
    ]
  )

  assert.deepEqual(
    buildMinimalBookmarkMoveOperations(['a', 'b', 'c', 'd'], ['b', 'c', 'd', 'a'], 'folder-1'),
    [
      { id: 'a', parentId: 'folder-1', index: 3 }
    ]
  )

  assert.deepEqual(
    buildMinimalBookmarkMoveOperations(['a', 'b', 'c', 'd'], ['d', 'a', 'b', 'c'], 'folder-1'),
    [
      { id: 'd', parentId: 'folder-1', index: 0 }
    ]
  )
})

test('does not emit bookmark moves for unchanged or invalid reorder snapshots', () => {
  assert.deepEqual(
    buildMinimalBookmarkMoveOperations(['a', 'b', 'c'], ['a', 'b', 'c'], 'folder-1'),
    []
  )
  assert.deepEqual(
    buildMinimalBookmarkMoveOperations(['a', 'b', 'c'], ['a', 'c'], 'folder-1'),
    []
  )
  assert.deepEqual(
    buildMinimalBookmarkMoveOperations(['a', 'b', 'c'], ['a', 'b', 'x'], 'folder-1'),
    []
  )
  assert.deepEqual(
    buildMinimalBookmarkMoveOperations(['a', 'b', 'c'], ['a', 'c', 'b'], ''),
    []
  )
})

test('validates remote background declared and final blob size', () => {
  assert.deepEqual(validateBackgroundContentLength(null), { allowed: true })
  assert.deepEqual(validateBackgroundContentLength(String(BACKGROUND_URL_MAX_BYTES)), { allowed: true })
  assert.equal(validateBackgroundContentLength(String(BACKGROUND_URL_MAX_BYTES + 1)).allowed, false)

  assert.deepEqual(validateBackgroundBlobSize(BACKGROUND_URL_MAX_BYTES), { allowed: true })
  assert.equal(validateBackgroundBlobSize(BACKGROUND_URL_MAX_BYTES + 1).allowed, false)
})
