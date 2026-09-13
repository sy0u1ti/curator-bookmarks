export function parseArchiveTabId(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const tabId = Number(value)
  return Number.isSafeInteger(tabId) && tabId >= 0 && tabId <= 2147483647 ? tabId : null
}

export function getPageArchiveFilename(title: string, now = new Date()): string {
  const stem = String(title || '网页存档').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '').trim().slice(0, 90) || '网页存档'
  return `${stem}-${now.toISOString().slice(0, 10)}.mhtml`
}

export function getArchiveSourceTab(tabId: number): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => chrome.tabs.get(tabId, tab => {
    const error = chrome.runtime.lastError
    if (error || !tab) reject(new Error('来源标签页已关闭，请回到要保存的网页重新发起存档。'))
    else if (tab.url && !/^https?:\/\//i.test(tab.url)) reject(new Error('仅支持普通 HTTP/HTTPS 网页。'))
    else resolve(tab)
  }))
}

export function requestPageCapturePermission(): Promise<boolean> {
  // Invoke directly from the Save button, while Chrome's user gesture is active.
  return new Promise((resolve, reject) => chrome.permissions.request({ permissions: ['pageCapture'] }, granted => {
    const error = chrome.runtime.lastError
    if (error) reject(new Error(error.message))
    else resolve(granted)
  }))
}

export function capturePageArchive(tabId: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!chrome.pageCapture?.saveAsMHTML) { reject(new Error('当前浏览器不支持页面存档，请使用 Chrome。')); return }
    chrome.pageCapture.saveAsMHTML({ tabId }, blob => {
      const error = chrome.runtime.lastError
      if (error || !blob?.size) reject(new Error(error?.message || '页面未能生成离线副本，请保持来源页打开后重试。'))
      else resolve(blob)
    })
  })
}
