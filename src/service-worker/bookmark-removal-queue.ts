interface RemovedBookmarkNode {
  id?: string
  children?: RemovedBookmarkNode[]
}

export function collectRemovedBookmarkIds(bookmarkId: string, node?: RemovedBookmarkNode): string[] {
  const ids = new Set<string>([String(bookmarkId)])
  const pending = node ? [node] : []
  while (pending.length) {
    const current = pending.pop()!
    if (current.id) ids.add(String(current.id))
    for (const child of current.children || []) pending.push(child)
  }
  return Array.from(ids).filter(Boolean)
}

export function createBookmarkRemovalQueue(
  cleanup: (bookmarkIds: string[]) => Promise<void>
): (bookmarkIds: string | string[]) => Promise<void> {
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

  return (bookmarkIds) => {
    for (const bookmarkId of Array.isArray(bookmarkIds) ? bookmarkIds : [bookmarkIds]) {
      const id = String(bookmarkId || '').trim()
      if (id) pendingIds.add(id)
    }
    if (!pendingIds.size) {
      return Promise.resolve()
    }
    // Start in the next microtask; ongoing storage work collects the next batch.
    // No debounce timer is left pending when the service worker becomes idle.
    cleanupPromise ??= Promise.resolve().then(drain)
    return cleanupPromise
  }
}
