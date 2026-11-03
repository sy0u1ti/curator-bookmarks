import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type {
  AvailabilityDecisionMetricsState,
  AvailabilityFiltersState,
  AvailabilityProgressState,
  AvailabilityResultsHeaderState,
  AvailabilitySelectionActionsState
} from './availability-overview-types.js'

const defaultProgressState: AvailabilityProgressState = {
  busy: false,
  visible: false,
  durationLabel: '未开始',
  progressLabel: '未开始',
  progressValue: 0,
  statusCopy: '仅检测 http/https 书签。'
}

const defaultDecisionMetricsState: AvailabilityDecisionMetricsState = {
  ignored: '0',
  newCount: '0',
  persistent: '0',
  recovered: '0'
}

const defaultFiltersState: AvailabilityFiltersState = {
  filters: [
    { active: true, count: 0, filter: 'all', label: '全部' },
    { active: false, count: 0, filter: 'failed', label: '无法访问' },
    { active: false, count: 0, filter: 'review', label: '待确认' },
    { active: false, count: 0, filter: 'redirected', label: '重定向' }
  ]
}

const defaultResultsHeaderState: AvailabilityResultsHeaderState = {
  visible: false,
  deleteFailedDisabled: true,
  deleteFailedLabel: '批量删除',
  failedCount: '0 条无法访问',
  failedLastRun: '尚未执行检测',
  failedTitle: '无法访问',
  reviewCount: '0 条待确认',
  reviewSubtitle: '临时故障或暂未完成验证的链接。',
  reviewTitle: '待确认'
}

const defaultSelectionActionsState: AvailabilitySelectionActionsState = {
  clearDisabled: true,
  countLabel: '0 条已选择',
  deleteDisabled: true,
  hidden: true,
  ignoreBookmarkDisabled: true,
  ignoreDomainDisabled: true,
  ignoreFolderDisabled: true,
  moveDisabled: true,
  retestDisabled: true,
  retestLabel: '重新检测'
}

interface AvailabilityOverviewStoreState {
  decisionMetrics: AvailabilityDecisionMetricsState
  filters: AvailabilityFiltersState
  progress: AvailabilityProgressState
  resultsHeader: AvailabilityResultsHeaderState
  selectionActions: AvailabilitySelectionActionsState
}

const availabilityOverviewStore = createUiViewStoreSlice<AvailabilityOverviewStoreState>(
  'options',
  'availability-overview',
  {
    decisionMetrics: defaultDecisionMetricsState,
    filters: defaultFiltersState,
    progress: defaultProgressState,
    resultsHeader: defaultResultsHeaderState,
    selectionActions: defaultSelectionActionsState
  }
)

export function publishAvailabilityProgress(state: AvailabilityProgressState): void {
  availabilityOverviewStore.setState((current) => ({ ...current, progress: state }))
}

export function publishAvailabilityDecisionMetrics(state: AvailabilityDecisionMetricsState): void {
  availabilityOverviewStore.setState((current) => ({ ...current, decisionMetrics: state }))
}

export function publishAvailabilityFilters(state: AvailabilityFiltersState): void {
  availabilityOverviewStore.setState((current) => ({ ...current, filters: state }))
}

export function publishAvailabilityResultsHeader(state: AvailabilityResultsHeaderState): void {
  availabilityOverviewStore.setState((current) => ({ ...current, resultsHeader: state }))
}

export function publishAvailabilitySelectionActions(state: AvailabilitySelectionActionsState): void {
  availabilityOverviewStore.setState((current) => ({ ...current, selectionActions: state }))
}

export function useAvailabilityProgress(): AvailabilityProgressState {
  return useUiViewStoreSlice(availabilityOverviewStore, (state) => state.progress)
}

export function useAvailabilityDecisionMetrics(): AvailabilityDecisionMetricsState {
  return useUiViewStoreSlice(availabilityOverviewStore, (state) => state.decisionMetrics)
}

export function useAvailabilityFilters(): AvailabilityFiltersState {
  return useUiViewStoreSlice(availabilityOverviewStore, (state) => state.filters)
}

export function useAvailabilityResultsHeader(): AvailabilityResultsHeaderState {
  return useUiViewStoreSlice(availabilityOverviewStore, (state) => state.resultsHeader)
}

export function useAvailabilitySelectionActions(): AvailabilitySelectionActionsState {
  return useUiViewStoreSlice(availabilityOverviewStore, (state) => state.selectionActions)
}
