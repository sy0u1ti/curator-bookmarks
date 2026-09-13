import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { capturePageArchive, getArchiveSourceTab, getPageArchiveFilename, parseArchiveTabId, requestPageCapturePermission } from './page-archive.js'

const originalChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
let runtimeError: string | undefined
let source: Partial<chrome.tabs.Tab> | undefined
let granted: boolean
let blob: Blob | null

beforeEach(() => {
  runtimeError = undefined
  source = { id: 42, url: 'https://example.test/article', title: 'Saved page' }
  granted = true
  blob = new Blob(['MIME-Version: 1.0\nContent-Type: multipart/related\n'], { type: 'multipart/related' })
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value: {
    runtime: { get lastError() { return runtimeError ? { message: runtimeError } : undefined } },
    tabs: { get: (_id: number, callback: (tab: Partial<chrome.tabs.Tab> | undefined) => void) => callback(source) },
    permissions: { request: (options: chrome.permissions.Permissions, callback: (value: boolean) => void) => {
      assert.deepEqual(options, { permissions: ['pageCapture'] })
      callback(granted)
    } },
    pageCapture: { saveAsMHTML: (options: chrome.pageCapture.SaveDetails, callback: (value: Blob | null) => void) => {
      assert.equal(options.tabId, 42)
      callback(blob)
    } }
  } })
})
afterEach(() => {
  if (originalChrome) Object.defineProperty(globalThis, 'chrome', originalChrome)
  else Reflect.deleteProperty(globalThis, 'chrome')
})

test('source tab IDs reject partial, negative, unsafe and absent values', () => {
  for (const value of [null, '', '-1', '12x', '1.2', '1e2', ' 12 ', '2147483648', '9007199254740993']) assert.equal(parseArchiveTabId(value), null)
  assert.equal(parseArchiveTabId('42'), 42)
})
test('MHTML filenames preserve readable titles without path separators or control characters', () => {
  const date = new Date('2026-09-11T08:00:00Z')
  assert.equal(getPageArchiveFilename('文章: 图片/离线\\测试\n', date), '文章_ 图片_离线_测试_-2026-09-11.mhtml')
  assert.equal(getPageArchiveFilename(' ... ', date), '网页存档-2026-09-11.mhtml')
  assert.ok(getPageArchiveFilename('a'.repeat(200), date).length < 120)
})
test('capture uses the selected source and surfaces permission, empty capture and browser errors', async () => {
  assert.equal((await getArchiveSourceTab(42)).title, 'Saved page')
  assert.equal(await requestPageCapturePermission(), true)
  assert.equal(await capturePageArchive(42), blob)
  granted = false
  assert.equal(await requestPageCapturePermission(), false)
  blob = null
  await assert.rejects(capturePageArchive(42), /未能生成离线副本/)
  runtimeError = 'Page capture failed'
  await assert.rejects(capturePageArchive(42), /Page capture failed/)
  await assert.rejects(requestPageCapturePermission(), /Page capture failed/)
})
test('closed and restricted source pages fail with actionable errors', async () => {
  source = undefined
  await assert.rejects(getArchiveSourceTab(42), /来源标签页已关闭/)
  for (const url of ['chrome://settings', 'chrome-extension://other/page.html', 'file:///private.html']) {
    source = { id: 42, url }
    await assert.rejects(getArchiveSourceTab(42), /仅支持普通 HTTP\/HTTPS/)
  }
  source = { id: 42 }
  assert.equal((await getArchiveSourceTab(42)).id, 42, 'unavailable metadata does not require granting all-sites access')
})
