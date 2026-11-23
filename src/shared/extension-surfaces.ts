export interface BookmarkManagerTarget {
  bookmarkId?: string
  folderId?: string
  query?: string
}

export function isSidePanelSurface(): boolean {
  return typeof document !== 'undefined' && document.documentElement?.dataset.curatorSurface === 'sidepanel'
}

export function isOptionsSurface(): boolean {
  return typeof document !== 'undefined' && document.documentElement?.dataset.curatorSurface === 'options'
}

export function isPersistentSurface(): boolean {
  return isSidePanelSurface() || isOptionsSurface()
}

export function closeTransientPopup(): void {
  if (!isPersistentSurface() && typeof window !== 'undefined') window.close()
}

export function buildBookmarkManagerAnchor(target?: BookmarkManagerTarget): string {
  if (!target) return ''
  const params = new URLSearchParams()
  const folderId = String(target.folderId || '').trim()
  const bookmarkId = String(target.bookmarkId || '').trim()
  const query = String(target.query || '').trim()
  if (folderId) params.set('folder', folderId)
  if (bookmarkId) params.set('bookmark', bookmarkId)
  if (query) params.set('q', query)
  return params.toString()
}

export function parseBookmarkManagerAnchor(anchor: string): BookmarkManagerTarget {
  const raw = String(anchor || '').trim()
  if (!raw || raw === 'section') return {}
  const params = new URLSearchParams(raw)
  const folderId = String(params.get('folder') || '').trim()
  const bookmarkId = String(params.get('bookmark') || '').trim()
  const query = String(params.get('q') || '').trim()
  return {
    ...(folderId ? { folderId } : null),
    ...(bookmarkId ? { bookmarkId } : null),
    ...(query ? { query } : null)
  }
}

export function buildBookmarkManagerHash(target?: BookmarkManagerTarget): string {
  const anchor = buildBookmarkManagerAnchor(target)
  return anchor ? `#bookmarks:${anchor}` : '#bookmarks'
}

export function buildBookmarkManagerUrl(target?: BookmarkManagerTarget): string {
  return chrome.runtime.getURL(`src/options/options.html${buildBookmarkManagerHash(target)}`)
}

export async function openBookmarkManagerWorkspace(target?: BookmarkManagerTarget): Promise<void> {
  const hash = buildBookmarkManagerHash(target)
  if (isOptionsSurface() && typeof window !== 'undefined') {
    window.location.hash = hash
    return
  }
  await chrome.tabs.create({ url: chrome.runtime.getURL(`src/options/options.html${hash}`) })
  closeTransientPopup()
}

export async function openBookmarkSidePanel(): Promise<void> {
  const manifest = chrome.runtime.getManifest()
  if (!manifest.permissions?.includes('sidePanel') || !manifest.side_panel?.default_path) {
    throw new Error('侧栏的新配置尚未生效。请打开扩展管理，找到 Curator 并点击“重新加载”，再打开弹窗。')
  }
  if (typeof chrome.sidePanel?.open !== 'function') {
    throw new Error('当前浏览器尚未提供侧栏功能。请先重新加载 Curator；如果仍不可用，请更新 Chrome 后重试。')
  }
  // Resolve the current window inside Chrome, without an asynchronous window
  // lookup that could fail or consume the click's transient user activation.
  await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
}

export async function openExtensionManagement(): Promise<void> {
  await chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` })
  closeTransientPopup()
}

export function openPageArchiveWorkspace(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = chrome.runtime.lastError
      if (error) { reject(new Error(error.message)); return }
      const tab = tabs[0]
      if (!Number.isInteger(tab?.id) || (tab.url && !/^https?:\/\//i.test(tab.url))) {
        reject(new Error('请先打开要保存的普通网页。浏览器设置页和扩展页面不能存档。'))
        return
      }
      chrome.tabs.create({ url: chrome.runtime.getURL(`src/archive/archive.html?tabId=${tab.id}`) }, () => {
        const createError = chrome.runtime.lastError
        if (createError) reject(new Error(createError.message))
        else { closeTransientPopup(); resolve() }
      })
    })
  })
}
