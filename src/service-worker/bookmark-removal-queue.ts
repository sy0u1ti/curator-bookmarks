export function createBookmarkRemovalQueue(
  cleanup: (bookmarkIds: string[]) => Promise<void>
): (bookmarkId: string) => Promise<void> {
  const pendingIds = new Set<string>()
  let cleanupPromise: Promise<void> | null = null

  async function drain(): Promise<void> {
    let failed = false
    let firstError: unknown
    try {
      while (pendingIds.size) {
        const bookmarkIds = Array.from(pendingIds)
        pendingIds.clear()
        try {
          await cleanup(bookmarkIds)
        } catch (error) {
          // An unsuccessful batch must not strand events received during its work.
          if (!failed) {
            failed = true
            firstError = error
          }
        }
      }
    } finally {
      cleanupPromise = null
    }
    if (failed) {
      throw firstError
    }
  }

  return (bookmarkId) => {
    const id = String(bookmarkId || '').trim()
    if (!id) {
      return Promise.resolve()
    }
    pendingIds.add(id)
    // Start in the next microtask; ongoing storage work collects the next batch.
    // No debounce timer is left pending when the service worker becomes idle.
    cleanupPromise ??= Promise.resolve().then(drain)
    return cleanupPromise
  }
}
