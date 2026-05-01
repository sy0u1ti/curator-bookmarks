import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzeFolderCleanup } from '../src/shared/folder-cleanup.js'

function folder(id, title, children = []) {
  return {
    id,
    title,
    children
  }
}

function bookmark(id, title, url) {
  return {
    id,
    title,
    url
  }
}

test('detects empty folders and deep single-bookmark folders', () => {
  const tree = folder('0', '', [
    folder('1', '书签栏', [
      folder('10', '空文件夹'),
      folder('20', '工具', [
        folder('21', '开发', [
          folder('22', '前端', [
            folder('23', 'React', [
              bookmark('100', 'React 教程', 'https://react.dev/learn')
            ])
          ])
        ])
      ])
    ])
  ])

  const suggestions = analyzeFolderCleanup(tree)

  assert.ok(suggestions.some((item) => item.kind === 'empty-folder' && item.primaryFolderId === '10'))
  assert.ok(suggestions.some((item) => item.kind === 'deep-single-bookmark' && item.primaryFolderId === '23'))
})

test('detects same-name folders and large folder split groups', () => {
  const largeBookmarks = Array.from({ length: 42 }, (_, index) => {
    const host = index < 21 ? 'docs.example.com' : 'blog.example.org'
    return bookmark(`large-${index}`, `页面 ${index}`, `https://${host}/page-${index}`)
  })
  const tree = folder('0', '', [
    folder('1', '书签栏', [
      folder('30', '教程', [
        bookmark('101', 'A', 'https://a.example.com')
      ]),
      folder('31', '教程', [
        bookmark('102', 'B', 'https://b.example.com')
      ]),
      folder('40', '资料库', largeBookmarks)
    ])
  ])

  const suggestions = analyzeFolderCleanup(tree)
  const sameName = suggestions.find((item) => item.kind === 'same-name-folders')
  const large = suggestions.find((item) => item.kind === 'large-folder-split')

  assert.equal(sameName?.operation, 'merge')
  assert.equal(large?.operation, 'split')
  assert.ok((large?.splitGroups || []).length >= 2)
})

test('excludes chrome default roots and plugin inbox from cleanup suggestions', () => {
  const bookmarksBarBookmarks = Array.from({ length: 45 }, (_, index) => (
    bookmark(`bar-${index}`, `书签栏页面 ${index}`, `https://bar-${index}.example.com`)
  ))
  const tree = folder('0', '', [
    folder('1', '书签栏', [
      ...bookmarksBarBookmarks,
      folder('90', 'Inbox / 待整理', [
        folder('91', '临时空文件夹')
      ]),
      folder('92', '普通空文件夹')
    ]),
    folder('2', '其他书签')
  ])

  const suggestions = analyzeFolderCleanup(tree)

  assert.equal(suggestions.some((item) => item.primaryFolderId === '1'), false)
  assert.equal(suggestions.some((item) => item.primaryFolderId === '2'), false)
  assert.equal(suggestions.some((item) => item.folderIds.includes('90') || item.folderIds.includes('91')), false)
  assert.ok(suggestions.some((item) => item.kind === 'empty-folder' && item.primaryFolderId === '92'))
})
