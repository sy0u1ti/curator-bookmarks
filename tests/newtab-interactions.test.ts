import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  BACKGROUND_URL_MAX_BYTES,
  buildBookmarkOrderAfterInsert,
  buildMinimalBookmarkMoveOperations,
  resolveRestorableBookmarkParentId,
  shouldInsertAfterBookmarkTile,
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

test('builds bookmark order after a pending drag insert without mutating input', () => {
  const order = ['a', 'b', 'c', 'd']

  assert.deepEqual(
    buildBookmarkOrderAfterInsert(order, 'b', 3),
    ['a', 'c', 'b', 'd']
  )
  assert.deepEqual(
    buildBookmarkOrderAfterInsert(order, 'b', 0),
    ['b', 'a', 'c', 'd']
  )
  assert.deepEqual(
    buildBookmarkOrderAfterInsert(order, 'b', 4),
    ['a', 'c', 'd', 'b']
  )
  assert.deepEqual(order, ['a', 'b', 'c', 'd'])
})

test('keeps bookmark order unchanged for invalid or same-slot pending inserts', () => {
  const order = ['a', 'b', 'c', 'd']

  assert.deepEqual(
    buildBookmarkOrderAfterInsert(order, 'missing', 2),
    order
  )
  assert.deepEqual(
    buildBookmarkOrderAfterInsert(order, 'b', 1),
    order
  )
  assert.deepEqual(
    buildBookmarkOrderAfterInsert(order, 'b', 2),
    order
  )
})

test('bookmark drag insertion uses horizontal halves within the same row', () => {
  const targetRect = { left: 100, top: 40, width: 180, height: 48 }

  assert.equal(
    shouldInsertAfterBookmarkTile({ x: 180, y: 64 }, targetRect),
    false
  )
  assert.equal(
    shouldInsertAfterBookmarkTile({ x: 220, y: 64 }, targetRect),
    true
  )
})

test('bookmark drag insertion uses vertical order across rows', () => {
  const targetRect = { left: 100, top: 40, width: 180, height: 48 }

  assert.equal(
    shouldInsertAfterBookmarkTile({ x: 260, y: 48 }, targetRect),
    false
  )
  assert.equal(
    shouldInsertAfterBookmarkTile({ x: 120, y: 82 }, targetRect),
    true
  )
})

test('validates remote background declared and final blob size', () => {
  assert.deepEqual(validateBackgroundContentLength(null), { allowed: true })
  assert.deepEqual(validateBackgroundContentLength(String(BACKGROUND_URL_MAX_BYTES)), { allowed: true })
  assert.equal(validateBackgroundContentLength(String(BACKGROUND_URL_MAX_BYTES + 1)).allowed, false)

  assert.deepEqual(validateBackgroundBlobSize(BACKGROUND_URL_MAX_BYTES), { allowed: true })
  assert.equal(validateBackgroundBlobSize(BACKGROUND_URL_MAX_BYTES + 1).allowed, false)
})

test('resolves undo delete parent to a live folder or the default location', () => {
  const rootNode: chrome.bookmarks.BookmarkTreeNode = {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        parentId: '0',
        title: '书签栏',
        children: [
          {
            id: '10',
            parentId: '1',
            title: '工作',
            children: [
              {
                id: '100',
                parentId: '10',
                title: 'React',
                url: 'https://react.dev/'
              }
            ]
          }
        ]
      }
    ]
  }

  assert.equal(resolveRestorableBookmarkParentId('10', rootNode, '1'), '10')
  assert.equal(resolveRestorableBookmarkParentId('missing-folder', rootNode, '1'), '1')
  assert.equal(resolveRestorableBookmarkParentId('100', rootNode, '1'), '1')
  assert.equal(resolveRestorableBookmarkParentId('', rootNode, '1'), '1')
})
