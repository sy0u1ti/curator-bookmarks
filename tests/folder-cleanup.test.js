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
