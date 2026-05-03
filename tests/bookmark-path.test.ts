import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildBookmarkPathSegments,
  findFolderByPath,
  formatBookmarkPath,
  formatFolderPath,
  splitBookmarkPath
} from '../src/shared/bookmark-path.js'
import type { FolderRecord } from '../src/shared/types.js'

function folder(id: string, title: string, path: string): FolderRecord {
  return {
    id,
    title,
    path,
    normalizedTitle: '',
    normalizedPath: '',
    depth: 1,
    folderCount: 0,
    bookmarkCount: 0
  }
}

test('splits bookmark folder paths across common separators', () => {
  assert.deepEqual(splitBookmarkPath('书签栏 / 工具 > AI › Prompt'), [
    '书签栏',
    '工具',
    'AI',
    'Prompt'
  ])
  assert.equal(formatBookmarkPath('书签栏 / 工具 / AI'), '书签栏 > 工具 > AI')
})

test('builds breadcrumb segments with clickable ancestor folder ids', () => {
  const folders = [
    folder('1', '书签栏', '书签栏'),
    folder('10', '工具', '书签栏 / 工具'),
    folder('11', 'AI', '书签栏 / 工具 / AI')
  ]
  const folderMap = new Map(folders.map((item) => [item.id, item]))

  assert.deepEqual(buildBookmarkPathSegments(folders[2], folderMap), [
    { id: '1', label: '书签栏', path: '书签栏', current: false },
    { id: '10', label: '工具', path: '书签栏 > 工具', current: false },
    { id: '11', label: 'AI', path: '书签栏 > 工具 > AI', current: true }
  ])
})

test('matches folders by normalized breadcrumb path', () => {
  const folders = [
    folder('10', '工具', '书签栏 / 工具'),
    folder('11', 'AI', '书签栏 / 工具 / AI')
  ]
  const folderMap = new Map(folders.map((item) => [item.id, item]))

  assert.equal(findFolderByPath('书签栏 > 工具 > AI', folderMap)?.id, '11')
  assert.equal(findFolderByPath('书签栏 / 不存在', folderMap), null)
})

test('preserves folder titles that contain slash when folder map provides the chain', () => {
  const folders = [
    folder('1', '书签栏', '书签栏'),
    folder('12', 'Inbox / 待整理', '书签栏 / Inbox / 待整理')
  ]
  const folderMap = new Map(folders.map((item) => [item.id, item]))

  assert.deepEqual(buildBookmarkPathSegments(folders[1], folderMap), [
    { id: '1', label: '书签栏', path: '书签栏', current: false },
    { id: '12', label: 'Inbox / 待整理', path: '书签栏 > Inbox / 待整理', current: true }
  ])
  assert.equal(formatFolderPath(folders[1], folderMap), '书签栏 > Inbox / 待整理')
})
