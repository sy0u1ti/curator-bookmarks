import { createRoot } from 'react-dom/client'
import { PopupContentHost } from './components/PopupContentHost'
import { dispatchPopupContentChange, registerPopupActionHandlers } from './popup-controller-store'
import { createPopupContentRowCache } from './popup-content-row-cache'
import { ThemeProvider } from '../ui/theme/ThemeProvider'
import type { PopupContentBookmarkRowViewModel, PopupContentFolderRowViewModel } from './components/PopupViewModels'

const params = new URLSearchParams(location.search)
const sidepanel = params.get('surface') === 'sidepanel'
document.documentElement.dataset.curatorSurface = sidepanel ? 'sidepanel' : 'popup'
let count = 10000
let generation = 0
let index = 0
let pane: 'bookmarks' | 'folders' = 'bookmarks'
let frame = 0
let repeat = false
let reads = 0
let lastAction: unknown = null
const bookmarkCache = createPopupContentRowCache<PopupContentBookmarkRowViewModel>('active')
const folderCache = createPopupContentRowCache<PopupContentFolderRowViewModel>('keyboardActive')
const menus = (id: string) => ({
  items: ['edit', 'copy-url', 'open-current-tab', 'move', 'delete'].map(action => ({
    action, bookmarkId: id, label: action, ariaLabel: `${action} ${id}`,
    danger: action === 'delete', disabled: false
  }))
})
const publish = (preserveScroll = false, repeated = false) => {
  const mainRows = bookmarkCache.getRows([generation], () => Array.from({ length: count }, (_, i) => ({
    kind: 'bookmark', bookmarkId: `bookmark-${i}`, index: i, depth: 0, parentId: 'root',
    get title() { reads++; return `Bookmark ${String(i + 1).padStart(5, '0')}` },
    url: `https://example.test/reference/${i}`, displayUrl: 'example.test',
    path: 'Bookmarks / References', menuLabel: 'Bookmark actions', menu: menus(`bookmark-${i}`)
  })), pane === 'bookmarks' ? index : -1)
  const sidebarRows = folderCache.getRows([generation], () => Array.from({ length: count }, (_, i) => ({
    kind: 'folder', folderId: `folder-${i}`, index: i, depth: 0, root: false,
    expanded: false, subtitle: 'References', countLabel: '12', toggleLabel: 'Open folder',
    get title() { reads++; return `Folder ${String(i + 1).padStart(5, '0')}` }
  })), pane === 'folders' ? index : -1)
  dispatchPopupContentChange({
    title: 'References', mode: 'tree', loading: false, keyboardPane: pane,
    mainRows, sidebarRows, rows: [...sidebarRows, ...mainRows]
  }, { preserveScroll, ...(repeated ? { navigation: 'repeat' as const } : {}) })
}
const navigate = (key: string, repeated = false) => {
  const previous = index
  if (key === 'ArrowLeft') { pane = 'folders'; index = 0 }
  else if (key === 'ArrowRight') { pane = 'bookmarks'; index = 0 }
  else if (key === 'ArrowDown') index = Math.min(count - 1, index + 1)
  else if (key === 'ArrowUp') index = Math.max(0, index - 1)
  else if (key === 'Home') index = 0
  else if (key === 'End') index = count - 1
  else return false
  const shell = document.getElementById('popup-app-shell')!
  if (shell.dataset.keyboardNav !== 'true') shell.dataset.keyboardNav = 'true'
  repeat = repeated
  if (previous === index && key !== 'ArrowLeft' && key !== 'ArrowRight') return true
  if (!frame) frame = requestAnimationFrame(() => { frame = 0; publish(false, repeat) })
  return true
}
registerPopupActionHandlers({
  content: detail => {
    lastAction = detail
    if (detail.action === 'keyboard-navigate') navigate(detail.menuAction!, detail.repeat)
    if (detail.action === 'set-active-result' || detail.action === 'set-active-folder') {
      pane = detail.action === 'set-active-result' ? 'bookmarks' : 'folders'
      index = detail.index!
      publish(true)
    }
  }
})
document.addEventListener('keydown', event => {
  if (!event.defaultPrevented && navigate(event.key, event.repeat)) event.preventDefault()
})
;(window as any).__repeat = {
  select(next: number, target = pane, preserveScroll = false) {
    index = next; pane = target; publish(preserveScroll)
  },
  reset(nextCount = 10000) {
    if (frame) cancelAnimationFrame(frame)
    frame = 0; generation++; count = nextCount; index = 0; pane = 'bookmarks'
    publish()
  },
  state: () => ({ index, pane, count, lastAction }),
  resetReads: () => { reads = 0 },
  reads: () => reads
}
publish()
createRoot(document.getElementById('popup-root')!).render(
  <ThemeProvider>
    <main id="popup-app-shell" style={{ height: '100%', padding: 14, overflow: 'hidden' }}>
      <PopupContentHost />
    </main>
  </ThemeProvider>
)
