type StartupDataResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown }

interface StartupDataEntry {
  task: Promise<StartupDataResult<unknown>>
  stale: boolean
  unsubscribe?: () => void
}

// The classic preboot scripts and Vite modules have separate module scopes.
// Share only the pending first read through this document's global object.
const startupGlobal = globalThis as typeof globalThis & {
  __curatorStartupData?: Map<string, StartupDataEntry | null>
}

function getStartupDataCache(): Map<string, StartupDataEntry | null> {
  return startupGlobal.__curatorStartupData ??= new Map()
}

export function prefetchStartupData<T>(
  key: string,
  load: () => Promise<T>,
  subscribe?: (invalidate: () => void) => () => void
): void {
  const cache = getStartupDataCache()
  if (cache.has(key)) return

  const entry: StartupDataEntry = { stale: false, task: settleStartupData(load) }
  cache.set(key, entry)
  entry.unsubscribe = subscribe?.(() => { entry.stale = true })
}

export async function consumeStartupData<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cache = getStartupDataCache()
  const entry = cache.get(key)
  // A consumed entry stays empty, so another copy of the entry module cannot
  // prefetch a second tree. Subsequent refreshes always request current data.
  cache.set(key, null)
  const task = entry && !entry.stale ? entry.task : settleStartupData(load)
  try {
    let result = await task
    // A bookmark can change while the first RPC is still in flight. Keep the
    // listener until it settles and replace that snapshot before publishing it.
    if (entry?.stale && task === entry.task) result = await settleStartupData(load)
    if (result.ok === false) throw result.error
    return result.value as T
  } finally {
    entry?.unsubscribe?.()
  }
}

function settleStartupData<T>(load: () => Promise<T>): Promise<StartupDataResult<T>> {
  try {
    return load().then(
      value => ({ ok: true, value }),
      error => ({ ok: false, error })
    )
  } catch (error) {
    return Promise.resolve({ ok: false, error })
  }
}

export function subscribeStartupBookmarkChanges(invalidate: () => void): () => void {
  const events = [
    chrome.bookmarks.onCreated,
    chrome.bookmarks.onRemoved,
    chrome.bookmarks.onChanged,
    chrome.bookmarks.onMoved,
    chrome.bookmarks.onChildrenReordered,
    chrome.bookmarks.onImportEnded
  ]
  for (const event of events) event?.addListener(invalidate)
  return () => { for (const event of events) event?.removeListener(invalidate) }
}
