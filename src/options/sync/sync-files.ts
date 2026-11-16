import { buildBookmarkHtmlExport, type BookmarkHtmlNode } from '../../shared/bookmark-html.js'
import { downloadBlobFile } from '../../shared/download.js'
import { SYNC_TABS_ROOT, type SyncProfileView } from '../../shared/sync/sync-contract.js'
import { getSyncProfileTitle, requestSyncPermissions } from './sync-model.js'

/** Export the local side of one profile without contacting its server. */
export async function exportSyncBookmarks(profile: SyncProfileView): Promise<void> {
  let roots: BookmarkHtmlNode[]
  if (profile.data.localRoot === SYNC_TABS_ROOT) {
    if (!await requestSyncPermissions({ localRoot: SYNC_TABS_ROOT })) throw new Error('未授予读取标签页的权限。')
    const tabs = (await chrome.tabs.query({ windowType: 'normal' })).filter(tab => !tab.incognito && tab.url)
    const windows = new Map<number, BookmarkHtmlNode>()
    const groups = new Map<number, BookmarkHtmlNode>()
    for (const tab of tabs) {
      if (!windows.has(tab.windowId)) windows.set(tab.windowId, { title: `窗口 ${windows.size + 1}`, children: [] })
      let parent = windows.get(tab.windowId)!
      if (tab.groupId !== undefined && tab.groupId !== -1) {
        if (!groups.has(tab.groupId)) {
          const group = await chrome.tabGroups.get(tab.groupId)
          const folder = { title: group.title || '标签组', children: [] }
          groups.set(tab.groupId, folder)
          parent.children!.push(folder)
        }
        parent = groups.get(tab.groupId)!
      }
      parent.children!.push({ title: tab.title || tab.url, url: tab.url })
    }
    roots = [...windows.values()]
  } else {
    if (!profile.data.localRoot) throw new Error('请先为这项同步选择本地文件夹。')
    roots = await chrome.bookmarks.getSubTree(profile.data.localRoot)
  }
  const name = getSyncProfileTitle(profile).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
  downloadBlobFile(`${name || 'Curator'}.html`, new Blob([buildBookmarkHtmlExport(roots)], { type: 'text/html;charset=utf-8' }))
}
