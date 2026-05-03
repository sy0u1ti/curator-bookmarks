export interface BrowserQuickShortcut {
  id: string
  label: string
  detail: string
  url: string
  badge: string
}

export const DEFAULT_BROWSER_QUICK_SHORTCUTS: BrowserQuickShortcut[] = [
  {
    id: 'history',
    label: '历史记录',
    detail: 'chrome://history',
    url: 'chrome://history',
    badge: '历'
  },
  {
    id: 'downloads',
    label: '下载内容',
    detail: 'chrome://downloads',
    url: 'chrome://downloads',
    badge: '下'
  },
  {
    id: 'extensions',
    label: '扩展管理',
    detail: 'chrome://extensions',
    url: 'chrome://extensions',
    badge: '扩'
  },
  {
    id: 'passwords',
    label: '密码管理',
    detail: 'chrome://settings/passwords',
    url: 'chrome://settings/passwords',
    badge: '密'
  },
  {
    id: 'settings',
    label: '浏览器设置',
    detail: 'chrome://settings',
    url: 'chrome://settings',
    badge: '设'
  }
]

export function normalizeBrowserQuickShortcutsVisible(value: unknown): boolean {
  return value !== false
}

export function getBrowserQuickShortcuts(
  visible: unknown,
  shortcuts: BrowserQuickShortcut[] = DEFAULT_BROWSER_QUICK_SHORTCUTS
): BrowserQuickShortcut[] {
  if (!normalizeBrowserQuickShortcutsVisible(visible)) {
    return []
  }

  return shortcuts
    .filter((shortcut) => shortcut.id && shortcut.label && shortcut.url.startsWith('chrome://'))
    .map((shortcut) => ({ ...shortcut }))
}
