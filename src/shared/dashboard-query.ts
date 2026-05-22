import {
  filterDashboardItems,
  sortDashboardItems,
  type DashboardFilters,
  type DashboardItem,
  type DashboardModel
} from './dashboard-model.js'

export interface DashboardSearchLimitInput {
  requestedLimit?: number
  cachedResultCount?: number
  initialLimit: number
  maxLimit: number
}

export function getDashboardStructuralCandidateItems(
  model: DashboardModel,
  filters: DashboardFilters = {}
): DashboardItem[] {
  return filterDashboardItems(model.items, {
    query: '',
    folderId: filters.folderId,
    domain: filters.domain,
    month: filters.month
  })
}

export function sortDashboardCandidates(
  items: DashboardItem[],
  filters: DashboardFilters = {}
): DashboardItem[] {
  return sortDashboardItems(items, filters.sortKey)
}

export function createDashboardSearchKey({
  model,
  filters,
  query,
  itemCount
}: {
  model: DashboardModel
  filters: DashboardFilters
  query: string
  itemCount: number
}): string {
  return [
    String(query || ''),
    String(filters.folderId || ''),
    String(filters.domain || ''),
    String(filters.month || ''),
    String(filters.sortKey || 'date-desc'),
    String(itemCount),
    String(model.items.length),
    String(model.items[0]?.id || ''),
    String(model.items[model.items.length - 1]?.id || '')
  ].join('\u0001')
}

export function getDashboardSearchResultLimit({
  requestedLimit = 0,
  cachedResultCount = 0,
  initialLimit,
  maxLimit
}: DashboardSearchLimitInput): number {
  const safeInitialLimit = Math.max(0, Math.floor(Number(initialLimit) || 0))
  const safeMaxLimit = Math.max(safeInitialLimit, Math.floor(Number(maxLimit) || 0))
  const safeRequestedLimit = Math.max(0, Math.floor(Number(requestedLimit) || 0))
  const safeCachedResultCount = Math.max(0, Math.floor(Number(cachedResultCount) || 0))

  return Math.min(
    safeMaxLimit,
    Math.max(safeInitialLimit, safeRequestedLimit, safeCachedResultCount)
  )
}

export function mapDashboardSearchIdsToItems(
  items: DashboardItem[],
  ids: Iterable<unknown>
): DashboardItem[] {
  const itemById = new Map(items.map((item) => [String(item.id), item]))
  const mappedItems: DashboardItem[] = []

  for (const id of ids) {
    const item = itemById.get(String(id))
    if (item) {
      mappedItems.push(item)
    }
  }

  return mappedItems
}
