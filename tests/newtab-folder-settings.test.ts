import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  findNewTabFolder,
  normalizeFolderIds,
  normalizeFolderSettingsWithDefault
} from '../src/newtab/folder-settings.js'

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
          title: '标签页',
          children: [
            {
              id: '11',
              parentId: '10',
              title: 'React',
              url: 'https://react.dev/'
            }
          ]
        },
        {
          id: '20',
          parentId: '1',
          title: '资料',
          children: [
            {
              id: '21',
              parentId: '20',
              title: '标签页',
              children: []
            }
          ]
        }
      ]
    }
  ]
}

test('new tab folder settings use the default 标签页 folder only before explicit source selection exists', () => {
  assert.deepEqual(
    normalizeFolderSettingsWithDefault(undefined, rootNode),
    {
      selectedFolderIds: ['10'],
      hideFolderNames: false
    }
  )

  assert.deepEqual(
    normalizeFolderSettingsWithDefault({ selectedFolderIds: [], hideFolderNames: true }, rootNode),
    {
      selectedFolderIds: [],
      hideFolderNames: true
    }
  )
})

test('new tab folder settings preserve unavailable explicit selections for missing-folder recovery UI', () => {
  assert.deepEqual(
    normalizeFolderSettingsWithDefault({ selectedFolderIds: ['999', '999', ' '] }, rootNode),
    {
      selectedFolderIds: ['999'],
      hideFolderNames: false
    }
  )
})

test('new tab folder lookup prefers the direct bookmarks bar 标签页 folder', () => {
  assert.equal(findNewTabFolder(rootNode)?.id, '10')
})

test('new tab folder id normalization trims, dedupes, and caps source ids', () => {
  const ids = normalizeFolderIds([
    ' a ',
    'a',
    '',
    ...Array.from({ length: 30 }, (_, index) => `folder-${index}`)
  ])

  assert.equal(ids[0], 'a')
  assert.equal(ids.length, 24)
  assert.equal(ids.at(-1), 'folder-22')
})
