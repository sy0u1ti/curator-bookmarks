import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildDashboardFaviconWarmupItems,
  createDashboardFaviconWarmupQueue,
  getDashboardChunkPlan,
  getDashboardVirtualWindow,
  scheduleDashboardChunk,
  type DashboardFaviconWarmupItem
} from '../src/newtab/dashboard-performance.js'

async function flushWarmupMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

test('builds dashboard favicon warmup items with chrome favicon urls and skips duplicate urls', () => {
  const items = buildDashboardFaviconWarmupItems({
    faviconEndpointUrl: 'chrome-extension://extension-id/_favicon/',
    bookmarks: [
      { id: '1', url: 'https://example.com/a' },
      { id: '2', url: 'https://example.com/a' },
      { id: '3', url: '' },
      { id: '4', url: 'https://example.net/b' }
    ],
    size: 64,
    cacheToken: (bookmark) => bookmark.id === '4' ? 400 : ''
  })

  assert.equal(items.length, 2)
  assert.deepEqual(items.map((item) => item.pageUrl), [
    'https://example.com/a',
    'https://example.net/b'
  ])

  const firstUrl = new URL(items[0].faviconUrl)
  assert.equal(firstUrl.searchParams.get('pageUrl'), 'https://example.com/a')
  assert.equal(firstUrl.searchParams.get('size'), '64')
  assert.equal(firstUrl.searchParams.get('cache'), '1')
  assert.equal(firstUrl.searchParams.get('refresh'), null)

  const secondUrl = new URL(items[1].faviconUrl)
  assert.equal(secondUrl.searchParams.get('refresh'), '400')
})

test('dashboard favicon warmup queue respects concurrency and batch size', async () => {
  const idleCallbacks: Array<() => void> = []
  const pendingLoads: Array<{
    item: DashboardFaviconWarmupItem
    resolve: () => void
  }> = []
  let activeLoads = 0
  let peakActiveLoads = 0
  const warmed: string[] = []
  const queue = createDashboardFaviconWarmupQueue({
    faviconEndpointUrl: 'chrome-extension://extension-id/_favicon/',
    bookmarks: Array.from({ length: 5 }, (_, index) => ({
      id: String(index + 1),
      url: `https://example.com/${index + 1}`
    })),
    maxConcurrent: 2,
    batchSize: 3,
    batchDelayMs: 1,
    waitForIdle: (callback) => {
      idleCallbacks.push(callback)
    },
    loadFavicon: async (_url, item) => {
      activeLoads += 1
      peakActiveLoads = Math.max(peakActiveLoads, activeLoads)
      await new Promise<void>((resolve) => {
        pendingLoads.push({
          item,
          resolve: () => {
            activeLoads -= 1
            resolve()
          }
        })
      })
    },
    onWarm: (item) => {
      warmed.push(item.id)
    }
  })

  queue.start()
  assert.equal(idleCallbacks.length, 1)
  idleCallbacks.shift()?.()
  await flushWarmupMicrotasks()

  assert.equal(pendingLoads.length, 2)
  assert.equal(queue.getSnapshot().activeCount, 2)
  assert.equal(queue.getSnapshot().pendingCount, 3)
  assert.equal(peakActiveLoads, 2)

  pendingLoads.shift()?.resolve()
  await flushWarmupMicrotasks()
  assert.equal(pendingLoads.length, 2)
  assert.deepEqual(pendingLoads.map((load) => load.item.id), ['2', '3'])
  assert.equal(queue.getSnapshot().pendingCount, 2)

  pendingLoads.shift()?.resolve()
  await flushWarmupMicrotasks()
  assert.equal(pendingLoads.length, 1)
  assert.equal(idleCallbacks.length, 0)

  pendingLoads.shift()?.resolve()
  await new Promise((resolve) => setTimeout(resolve, 5))
  await flushWarmupMicrotasks()

  assert.equal(pendingLoads.length, 2)
  assert.deepEqual(pendingLoads.map((load) => load.item.id), ['4', '5'])
  assert.equal(peakActiveLoads, 2)

  pendingLoads.splice(0).forEach((load) => load.resolve())
  await flushWarmupMicrotasks()

  assert.deepEqual(warmed, ['1', '2', '3', '4', '5'])
  assert.deepEqual(queue.getSnapshot(), {
    pendingCount: 0,
    activeCount: 0,
    warmedCount: 5,
    failedCount: 0,
    canceled: false
  })
})

test('dashboard favicon warmup queue can be canceled before later batches run', async () => {
  const idleCallbacks: Array<() => void> = []
  const loaded: string[] = []
  const queue = createDashboardFaviconWarmupQueue({
    faviconEndpointUrl: 'chrome-extension://extension-id/_favicon/',
    bookmarks: [
      { id: '1', url: 'https://example.com/1' },
      { id: '2', url: 'https://example.com/2' },
      { id: '3', url: 'https://example.com/3' }
    ],
    maxConcurrent: 1,
    batchSize: 1,
    batchDelayMs: 1,
    waitForIdle: (callback) => {
      idleCallbacks.push(callback)
    },
    loadFavicon: (_url, item) => {
      loaded.push(item.id)
    }
  })

  queue.start()
  idleCallbacks.shift()?.()
  await flushWarmupMicrotasks()
  queue.cancel()
  await new Promise((resolve) => setTimeout(resolve, 5))

  assert.deepEqual(loaded, ['1'])
  assert.equal(queue.getSnapshot().pendingCount, 0)
  assert.equal(queue.getSnapshot().canceled, true)
})

test('dashboard chunk and virtual window helpers bound work for large lists', () => {
  assert.deepEqual(getDashboardChunkPlan({
    totalCount: 125,
    startIndex: 40,
    maxItemsPerChunk: 35
  }), {
    startIndex: 40,
    endIndex: 75,
    count: 35,
    hasMore: true
  })

  assert.deepEqual(getDashboardVirtualWindow({
    totalCount: 1000,
    scrollTop: 500,
    viewportHeight: 300,
    itemHeight: 50,
    overscan: 2
  }), {
    startIndex: 8,
    endIndex: 18,
    visibleStartIndex: 10,
    visibleEndIndex: 16,
    beforeHeight: 400,
    afterHeight: 49100
  })
})

test('scheduleDashboardChunk skips canceled callbacks', () => {
  const idleCallbacks: Array<() => void> = []
  let callCount = 0
  const cancel = scheduleDashboardChunk(
    () => {
      callCount += 1
    },
    (callback) => {
      idleCallbacks.push(callback)
    }
  )

  cancel()
  idleCallbacks.shift()?.()

  assert.equal(callCount, 0)
})
