import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBookmarkHtmlExport, type BookmarkHtmlNode } from './bookmark-html.js'

test('portable HTML retains folders, order, duplicate URLs and bookmark dates without mutating the tree', () => {
  const tree: BookmarkHtmlNode[] = [{ id: '0', children: [{ id: '1', title: '书签栏', children: [
    { title: '空目录', children: [] },
    { title: '资源 A', url: 'https://example.test/A?q=Value#/one', dateAdded: 1700000000123 },
    { title: '资料', dateGroupModified: 1700000002123, children: [
      { title: '另一个入口', url: 'https://example.test/A?q=Value#/one' }
    ] }
  ] }] }]
  const before = structuredClone(tree)
  const html = buildBookmarkHtmlExport(tree)
  assert.match(html, /^<!DOCTYPE NETSCAPE-Bookmark-file-1>/)
  assert.match(html, /charset=UTF-8/)
  assert.match(html, /PERSONAL_TOOLBAR_FOLDER="true">书签栏/)
  assert.match(html, /<H3>空目录<\/H3>\n\s*<DL><p>\n\s*<\/DL>/)
  assert.match(html, /ADD_DATE="1700000000"/)
  assert.match(html, /LAST_MODIFIED="1700000002"/)
  assert.equal((html.match(/HREF="https:\/\/example\.test\/A\?q=Value#\/one"/g) || []).length, 2)
  assert.ok(html.indexOf('资源 A') < html.indexOf('另一个入口'))
  assert.deepEqual(tree, before)
})

test('bookmark text and URL attributes cannot inject markup into an exported file', () => {
  const html = buildBookmarkHtmlExport([{ title: '<script>alert("title")</script>', children: [
    { title: 'A & B </A><img src=x>', url: 'https://example.test/?q="&tag=<html>' },
    { title: 'Bookmarklet', url: 'javascript:alert("saved bookmarklet")' }
  ] }])
  assert.equal(html.includes('<script>'), false)
  assert.equal(html.includes('<img'), false)
  assert.match(html, /&lt;script&gt;alert\(&quot;title&quot;\)&lt;\/script&gt;/)
  assert.match(html, /HREF="https:\/\/example.test\/\?q=&quot;&amp;tag=&lt;html&gt;"/)
  assert.match(html, /Content-Security-Policy/)
  assert.match(html, /default-src 'none'/)
  assert.match(html, /javascript:alert\(&quot;saved bookmarklet&quot;\)/, 'export preserves user bookmarklets')
})

test('empty libraries and deeply nested folders export without recursive stack overflow', () => {
  assert.match(buildBookmarkHtmlExport([]), /<DL><p>\n<\/DL><p>/)
  let node: BookmarkHtmlNode = { title: 'Deep bookmark', url: 'https://example.test/deep' }
  for (let index = 0; index < 5000; index++) node = { title: `Folder ${index}`, children: [node] }
  const html = buildBookmarkHtmlExport([node])
  assert.equal((html.match(/<H3/g) || []).length, 5000)
  assert.match(html, /Deep bookmark/)
})
