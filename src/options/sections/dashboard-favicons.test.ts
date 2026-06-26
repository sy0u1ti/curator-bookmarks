import {
  warmDashboardFavicon,
  type DashboardFaviconCache
} from './dashboard-favicons.js'

async function run(): Promise<void> {
  await testWarmupDoesNotFetchRemoteFaviconsFromExtensionPage()
}

async function testWarmupDoesNotFetchRemoteFaviconsFromExtensionPage(): Promise<void> {
  const globalWithTestHooks = globalThis as unknown as {
    Image?: unknown
  }
  const originalFetch = globalThis.fetch
  const originalImage = globalWithTestHooks.Image
  let fetchCalls = 0
  let remotePermissionChecks = 0
  let cacheUpserts = 0
  let failedMarks = 0

  globalThis.fetch = (async () => {
    fetchCalls += 1
    throw new Error('remote favicon fetch should not run from extension pages')
  }) as typeof fetch
  globalWithTestHooks.Image = FakeDashboardImage

  try {
    await warmDashboardFavicon(
      'chrome-extension://test-extension/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2F&size=32',
      {
        id: 'example',
        pageUrl: 'https://example.com/',
        faviconUrl: 'chrome-extension://test-extension/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2F&size=32'
      },
      {
        getCache: (): DashboardFaviconCache => ({}),
        upsert: () => {
          cacheUpserts += 1
        },
        markFailed: () => {
          failedMarks += 1
        }
      },
      {
        canFetchRemote: () => {
          remotePermissionChecks += 1
          return true
        }
      }
    )
  } finally {
    globalThis.fetch = originalFetch
    globalWithTestHooks.Image = originalImage
  }

  assert(fetchCalls === 0, `warmup should not fetch remote favicon assets, got ${fetchCalls}`)
  assert(remotePermissionChecks === 0, `warmup should not check remote favicon fetch permission, got ${remotePermissionChecks}`)
  assert(cacheUpserts === 0, `warmup should not cache remote favicon data URLs, got ${cacheUpserts}`)
  assert(failedMarks === 0, `warmup should not mark remote favicon failures, got ${failedMarks}`)
}

class FakeDashboardImage {
  decoding = ''
  private readonly listeners = new Map<string, Array<() => void>>()

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) || []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  set src(_value: string) {
    queueMicrotask(() => {
      for (const listener of this.listeners.get('load') || []) {
        listener()
      }
    })
  }
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

await run()
console.log('Dashboard favicon tests passed.')
