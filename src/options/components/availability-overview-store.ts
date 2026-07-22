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
  durationLabel: '未开始',
  progressLabel: '未开始',
  progressValue: 0,
  statusCopy: '仅检测 http/https 书签。'
}

const defaultDecisionMetricsState: AvailabilityDecisionMetricsState = {
  ignored: '0',
  newCount: '0',
  persistent: '0',
  progress: '0 / 0',
  recovered: '0',
  scope: '全部书签'
}

const defaultFiltersState: AvailabilityFiltersState = {
  filters: [
    { active: true, count: 0, filter: 'all', label: '全部' },
    { active: false, count: 0, filter: 'failed', label: '高置信' },
    { active: false, count: 0, filter: 'review', label: '低置信 / 待确认' },
    { active: false, count: 0, filter: 'redirected', label: '重定向' },
    { active: false, count: 0, filter: 'new', label: '新增' },
    { active: false, count: 0, filter: 'persistent', label: '持续' },
    { active: false, count: 0, filter: 'recovered', label: '已恢复' },
    { active: false, count: 0, filter: 'ignored', label: '已忽略过滤' }
  ]
}

const defaultResultsHeaderState: AvailabilityResultsHeaderState = {
  deleteFailedDisabled: true,
  deleteFailedLabel: '批量删除',
  failedCount: '0 条异常',
  failedLastRun: '尚未执行检测',
  failedTitle: '高置信异常',
  reviewCount: '0 条低置信异常',
  reviewSubtitle: '证据不足的异常，建议人工确认',
  reviewTitle: '低置信异常'
}

const defaultSelectionActionsState: AvailabilitySelectionActionsState = {
  clearDisabled: true,
  countLabel: '0 条已选择',
  deleteDisabled: true,
  demoteDisabled: true,
  hidden: true,
  ignoreBookmarkDisabled: true,
  ignoreDomainDisabled: true,
  ignoreFolderDisabled: true,
  moveDisabled: true,
  promoteDisabled: true,
  retestDisabled: true,
  retestLabel: '重新测试'
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
