export type NewTabContentState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'missing-folder'; reason: 'none-selected' | 'selected-unavailable' }
  | { type: 'bookmarks' }

export interface ResolveNewTabContentStateInput {
  loading: boolean
  error: string
  selectedFolderCount: number
  visibleFolderCount: number
}

export interface NewTabPageModule {
  id: string
  element: HTMLElement
  placement: 'utility' | 'primary'
}

export interface NewTabPageOptions {
  modules: NewTabPageModule[]
}

export interface NewTabSearchIndexBookmark {
  id: string
  title?: string
  url?: string
  dateAdded?: number
}

export interface NewTabSearchIndexSection {
  title: string
  path: string
  bookmarks: NewTabSearchIndexBookmark[]
}

export interface NewTabSearchIndexEntry {
  id: string
  title: string
  url: string
  folderTitle: string
  folderPath: string
  normalizedTitle: string
  normalizedUrl: string
  normalizedFolderTitle: string
  order: number
}

export interface SearchBookmarkSuggestion {
  id: string
  title: string
  url: string
  folderTitle: string
  folderPath: string
  score: number
  order: number
}

export interface PortalBookmarkActivityRecord {
  bookmarkId: string
  openCount: number
  lastOpenedAt: number
}

export interface PortalBookmarkSourceItem {
  id: string
  title?: string
  url?: string
  dateAdded?: number
}

export interface PortalQuickAccessItem {
  id: string
  reason: 'pinned' | 'frequent' | 'opened' | 'added'
  detail: string
  badge: string
}

export interface PortalQuickAccessInput {
  bookmarks: PortalBookmarkSourceItem[]
  pinnedIds: string[]
  records: Record<string, PortalBookmarkActivityRecord>
  now: number
  itemLimit: number
  showFrequent: boolean
  showRecent: boolean
}

export interface PortalOverviewInput {
  sections: NewTabSearchIndexSection[]
  activityRecords: Record<string, PortalBookmarkActivityRecord>
  now: number
}

export interface PortalOverview {
  bookmarkCount: number
  folderCount: number
  openedTodayCount: number
  addedTodayCount: number
}

export type PortalPanelLayout = 'hidden' | 'full' | 'overview-only' | 'quick-only'

export interface PortalPanelLayoutInput {
  showOverview: boolean
  hasOverviewSignal: boolean
  hasQuickAccess: boolean
}

export interface MissingFolderViewOptions {
  creatingFolder: boolean
  reason: 'none-selected' | 'selected-unavailable'
  onCreateFolder: () => void
  onOpenFolderSettings: () => void
}

export interface VerticalCenterCollisionOffsetInput {
  utilityBottom: number
  contentTop: number
  minimumGap?: number
}

const DEFAULT_VERTICAL_CENTER_COLLISION_GAP = 12

export function getVerticalCenterCollisionOffset({
  utilityBottom,
  contentTop,
  minimumGap = DEFAULT_VERTICAL_CENTER_COLLISION_GAP
}: VerticalCenterCollisionOffsetInput): number {
  const requiredTop = utilityBottom + Math.max(0, minimumGap)
  const offset = Math.ceil(requiredTop - contentTop)
  if (!Number.isFinite(offset)) {
    return 0
  }
  return Math.max(0, offset)
}

export function resolveNewTabContentState(
  input: ResolveNewTabContentStateInput
): NewTabContentState {
  if (input.loading) {
    return { type: 'loading' }
  }

  if (input.error) {
    return { type: 'error', message: input.error }
  }

  if (!input.visibleFolderCount) {
    return {
      type: 'missing-folder',
      reason: input.selectedFolderCount > 0 ? 'selected-unavailable' : 'none-selected'
    }
  }

  return { type: 'bookmarks' }
}

export function resolvePortalPanelLayout({
  showOverview,
  hasOverviewSignal,
  hasQuickAccess
}: PortalPanelLayoutInput): PortalPanelLayout {
  if (showOverview && hasOverviewSignal && hasQuickAccess) {
    return 'full'
  }
  if (showOverview && hasOverviewSignal) {
    return 'overview-only'
  }
  if (hasQuickAccess) {
    return 'quick-only'
  }
  return 'hidden'
}

export function buildNewTabSearchIndex(
  sections: NewTabSearchIndexSection[]
): NewTabSearchIndexEntry[] {
  const entries: NewTabSearchIndexEntry[] = []
  let order = 0

  for (const section of sections) {
    const folderTitle = section.title || '未命名文件夹'
    const folderPath = section.path || section.title || ''
    const normalizedFolderTitle = normalizeNewTabSearchText(folderTitle)

    for (const bookmark of section.bookmarks) {
      const url = String(bookmark.url || '').trim()
      if (!url) {
        continue
      }

      const title = String(bookmark.title || '').trim() || url
      entries.push({
        id: String(bookmark.id),
        title,
        url,
        folderTitle,
        folderPath,
        normalizedTitle: normalizeNewTabSearchText(title),
        normalizedUrl: normalizeNewTabSearchText(url),
        normalizedFolderTitle,
        order
      })
      order += 1
    }
  }

  return entries
}

export function getSearchBookmarkSuggestionsFromIndex(
  query: string,
  index: NewTabSearchIndexEntry[],
  limit: number
): SearchBookmarkSuggestion[] {
  const normalizedQuery = normalizeNewTabSearchText(query)
  if (!normalizedQuery || limit <= 0) {
    return []
  }

  const suggestions: SearchBookmarkSuggestion[] = []
  for (const entry of index) {
    const score = getSearchSuggestionScore(
      normalizedQuery,
      entry.normalizedTitle,
      entry.normalizedUrl,
      entry.normalizedFolderTitle
    )
    if (score < 0) {
      continue
    }

    suggestions.push({
      id: entry.id,
      title: entry.title,
      url: entry.url,
      folderTitle: entry.folderTitle,
      folderPath: entry.folderPath,
      score,
      order: entry.order
    })
  }

  return suggestions
    .sort((left, right) => left.score - right.score || left.order - right.order)
    .slice(0, limit)
}

export function buildNewTabPortalOverview({
  sections,
  activityRecords,
  now
}: PortalOverviewInput): PortalOverview {
  const todayStart = getLocalDayStart(now)
  const bookmarkIds = new Set<string>()
  let addedTodayCount = 0

  for (const section of sections) {
    for (const bookmark of section.bookmarks) {
      const id = String(bookmark.id || '').trim()
      const url = String(bookmark.url || '').trim()
      if (!id || !url || bookmarkIds.has(id)) {
        continue
      }

      bookmarkIds.add(id)
      if (isTimestampInLocalDay(Number(bookmark.dateAdded), todayStart, now)) {
        addedTodayCount += 1
      }
    }
  }

  const openedTodayIds = new Set<string>()
  for (const record of Object.values(activityRecords)) {
    const id = String(record.bookmarkId || '').trim()
    if (
      id &&
      bookmarkIds.has(id) &&
      Number(record.openCount) > 0 &&
      isTimestampInLocalDay(Number(record.lastOpenedAt), todayStart, now)
    ) {
      openedTodayIds.add(id)
    }
  }

  return {
    bookmarkCount: bookmarkIds.size,
    folderCount: sections.length,
    openedTodayCount: openedTodayIds.size,
    addedTodayCount
  }
}

export function getPortalQuickAccessItems({
  bookmarks,
  pinnedIds,
  records,
  now,
  itemLimit,
  showFrequent,
  showRecent
}: PortalQuickAccessInput): {
  frequentItems: PortalQuickAccessItem[]
  recentItems: PortalQuickAccessItem[]
} {
  const bookmarkMap = new Map(
    bookmarks
      .filter((bookmark) => String(bookmark.id || '').trim() && String(bookmark.url || '').trim())
      .map((bookmark) => [String(bookmark.id), bookmark])
  )
  const limit = Math.max(0, Math.floor(itemLimit))
  const frequentItems: PortalQuickAccessItem[] = []
  const recentItems: PortalQuickAccessItem[] = []
  const usedIds = new Set<string>()

  if (showFrequent && limit > 0) {
    for (const bookmarkId of pinnedIds) {
      const id = String(bookmarkId || '').trim()
      if (!id || usedIds.has(id) || !bookmarkMap.has(id)) {
        continue
      }

      frequentItems.push({
        id,
        reason: 'pinned',
        detail: '已固定',
        badge: '固'
      })
      usedIds.add(id)
      if (frequentItems.length >= limit) {
        break
      }
    }

    if (frequentItems.length < limit) {
      const frequentRecords = Object.values(records)
        .filter((record) =>
          Number(record.openCount) > 0 &&
          !usedIds.has(String(record.bookmarkId)) &&
          bookmarkMap.has(String(record.bookmarkId))
        )
        .sort((left, right) =>
          Number(right.openCount) - Number(left.openCount) ||
          Number(right.lastOpenedAt) - Number(left.lastOpenedAt)
        )

      for (const record of frequentRecords) {
        const id = String(record.bookmarkId)
        frequentItems.push({
          id,
          reason: 'frequent',
          detail: `打开 ${Math.min(Math.floor(Number(record.openCount) || 0), 9999)} 次`,
          badge: '常'
        })
        usedIds.add(id)
        if (frequentItems.length >= limit) {
          break
        }
      }
    }
  }

  if (showRecent && limit > 0) {
    const recentRecords = Object.values(records)
      .filter((record) =>
        Number(record.lastOpenedAt) > 0 &&
        !usedIds.has(String(record.bookmarkId)) &&
        bookmarkMap.has(String(record.bookmarkId))
      )
      .sort((left, right) => Number(right.lastOpenedAt) - Number(left.lastOpenedAt))

    for (const record of recentRecords) {
      const id = String(record.bookmarkId)
      recentItems.push({
        id,
        reason: 'opened',
        detail: formatNewTabRelativeActivityTime(Number(record.lastOpenedAt), '打开', now),
        badge: '开'
      })
      usedIds.add(id)
      if (recentItems.length >= limit) {
        break
      }
    }

    if (recentItems.length < limit) {
      const recentlyAdded = [...bookmarkMap.values()]
        .filter((bookmark) =>
          !usedIds.has(String(bookmark.id)) &&
          Number.isFinite(Number(bookmark.dateAdded)) &&
          Number(bookmark.dateAdded) > 0
        )
        .sort((left, right) => Number(right.dateAdded) - Number(left.dateAdded))

      for (const bookmark of recentlyAdded) {
        const id = String(bookmark.id)
        recentItems.push({
          id,
          reason: 'added',
          detail: formatNewTabRelativeActivityTime(Number(bookmark.dateAdded), '添加', now),
          badge: '新'
        })
        usedIds.add(id)
        if (recentItems.length >= limit) {
          break
        }
      }
    }
  }

  return { frequentItems, recentItems }
}

export function formatNewTabRelativeActivityTime(
  timestamp: number,
  label: string,
  now = Date.now()
): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return `${label}时间未知`
  }

  const diffMs = Math.max(0, now - timestamp)
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  if (diffMs < hourMs) {
    return `${label}于刚刚`
  }
  if (diffMs < dayMs) {
    return `${label}于 ${Math.max(1, Math.floor(diffMs / hourMs))} 小时前`
  }
  if (diffMs < 30 * dayMs) {
    return `${label}于 ${Math.max(1, Math.floor(diffMs / dayMs))} 天前`
  }

  const date = new Date(timestamp)
  return `${label}于 ${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

export function normalizeNewTabSearchText(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function getSearchSuggestionScore(
  query: string,
  title: string,
  url: string,
  folderTitle: string
): number {
  if (title === query) {
    return 0
  }
  if (title.startsWith(query)) {
    return 1
  }
  if (title.includes(query)) {
    return 2
  }
  if (url.includes(query)) {
    return 3
  }
  if (folderTitle.includes(query)) {
    return 4
  }
  return -1
}

function getLocalDayStart(timestamp: number): number {
  const date = Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp) : new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function isTimestampInLocalDay(timestamp: number, dayStart: number, now: number): boolean {
  return Number.isFinite(timestamp) &&
    timestamp >= dayStart &&
    timestamp <= now &&
    timestamp < dayStart + 24 * 60 * 60 * 1000
}

export function createNewTabPage({ modules }: NewTabPageOptions): HTMLElement {
  const page = document.createElement('main')
  page.className = 'newtab-page'
  page.dataset.contentState = modules.some((module) => module.id === 'bookmarks')
    ? 'bookmarks'
    : 'empty'

  const utilityStack = document.createElement('div')
  utilityStack.className = 'newtab-utility-stack'

  const primarySlot = document.createElement('div')
  primarySlot.className = 'newtab-primary-slot'

  for (const module of modules) {
    module.element.dataset.newtabModule = module.id
    if (module.placement === 'utility') {
      utilityStack.appendChild(module.element)
    } else {
      primarySlot.appendChild(module.element)
    }
  }

  page.classList.toggle('has-search', modules.some((module) => module.id === 'search'))
  page.classList.toggle('has-clock', modules.some((module) => module.id === 'clock'))
  const bookmarkModule = modules.find((module) => module.id === 'bookmarks')
  if (bookmarkModule) {
    page.dataset.iconVerticalCenter = bookmarkModule.element.dataset.iconVerticalCenter || 'false'
  }
  page.append(utilityStack, primarySlot)
  return page
}

export function createMissingFolderView({
  creatingFolder,
  reason,
  onCreateFolder,
  onOpenFolderSettings
}: MissingFolderViewOptions): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-state folder-missing'
  view.setAttribute('aria-labelledby', 'newtab-missing-folder-title')

  const title = document.createElement('h1')
  title.id = 'newtab-missing-folder-title'
  title.textContent = reason === 'selected-unavailable'
    ? '已选书签来源不可用'
    : '请选择新标签页的书签来源'

  const copy = document.createElement('p')
  copy.textContent = reason === 'selected-unavailable'
    ? '之前选择的文件夹可能已被删除或移动。请打开设置里的“书签来源”，重新选择要显示的文件夹。'
    : '新标签页还没有要显示的书签文件夹。请打开设置里的“书签来源”，选择一个或多个文件夹。'

  const actions = document.createElement('div')
  actions.className = 'newtab-state-actions'

  const settingsButton = document.createElement('button')
  settingsButton.className = 'newtab-button'
  settingsButton.type = 'button'
  settingsButton.textContent = '选择书签来源'
  settingsButton.addEventListener('click', onOpenFolderSettings)

  const createButton = document.createElement('button')
  createButton.className = 'newtab-button secondary'
  createButton.type = 'button'
  createButton.disabled = creatingFolder
  createButton.textContent = creatingFolder ? '正在创建' : '新建专用文件夹'
  createButton.addEventListener('click', onCreateFolder)

  actions.append(settingsButton, createButton)
  view.append(title, copy, actions)
  return view
}

export function createStateView(message: string, actionLabel = '', action?: () => void): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-state'

  const copy = document.createElement('p')
  copy.textContent = message
  view.appendChild(copy)

  if (actionLabel && action) {
    const button = document.createElement('button')
    button.className = 'newtab-button secondary'
    button.type = 'button'
    button.textContent = actionLabel
    button.addEventListener('click', action)
    view.appendChild(button)
  }

  return view
}
