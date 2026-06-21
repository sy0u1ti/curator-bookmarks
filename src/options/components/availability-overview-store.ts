import { useSyncExternalStore } from 'react'
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
  statusCopy: '仅检测 `http/https` 书签，其它协议会自动跳过。'
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
  reviewSubtitle: '导航失败但证据不足以直接判定为高置信异常，建议人工确认',
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

let currentProgressState = defaultProgressState
let currentDecisionMetricsState = defaultDecisionMetricsState
let currentFiltersState = defaultFiltersState
let currentResultsHeaderState = defaultResultsHeaderState
let currentSelectionActionsState = defaultSelectionActionsState

const progressListeners = new Set<() => void>()
const decisionMetricsListeners = new Set<() => void>()
const filtersListeners = new Set<() => void>()
const resultsHeaderListeners = new Set<() => void>()
const selectionActionsListeners = new Set<() => void>()

function subscribeProgress(listener: () => void): () => void {
  progressListeners.add(listener)
  return () => progressListeners.delete(listener)
}

function subscribeDecisionMetrics(listener: () => void): () => void {
  decisionMetricsListeners.add(listener)
  return () => decisionMetricsListeners.delete(listener)
}

function subscribeFilters(listener: () => void): () => void {
  filtersListeners.add(listener)
  return () => filtersListeners.delete(listener)
}

function subscribeResultsHeader(listener: () => void): () => void {
  resultsHeaderListeners.add(listener)
  return () => resultsHeaderListeners.delete(listener)
}

function subscribeSelectionActions(listener: () => void): () => void {
  selectionActionsListeners.add(listener)
  return () => selectionActionsListeners.delete(listener)
}

function getProgressSnapshot(): AvailabilityProgressState {
  return currentProgressState
}

function getDecisionMetricsSnapshot(): AvailabilityDecisionMetricsState {
  return currentDecisionMetricsState
}

function getFiltersSnapshot(): AvailabilityFiltersState {
  return currentFiltersState
}

function getResultsHeaderSnapshot(): AvailabilityResultsHeaderState {
  return currentResultsHeaderState
}

function getSelectionActionsSnapshot(): AvailabilitySelectionActionsState {
  return currentSelectionActionsState
}

export function publishAvailabilityProgress(state: AvailabilityProgressState): void {
  currentProgressState = state
  progressListeners.forEach((listener) => listener())
}

export function publishAvailabilityDecisionMetrics(state: AvailabilityDecisionMetricsState): void {
  currentDecisionMetricsState = state
  decisionMetricsListeners.forEach((listener) => listener())
}

export function publishAvailabilityFilters(state: AvailabilityFiltersState): void {
  currentFiltersState = state
  filtersListeners.forEach((listener) => listener())
}

export function publishAvailabilityResultsHeader(state: AvailabilityResultsHeaderState): void {
  currentResultsHeaderState = state
  resultsHeaderListeners.forEach((listener) => listener())
}

export function publishAvailabilitySelectionActions(state: AvailabilitySelectionActionsState): void {
  currentSelectionActionsState = state
  selectionActionsListeners.forEach((listener) => listener())
}

export function useAvailabilityProgress(): AvailabilityProgressState {
  return useSyncExternalStore(subscribeProgress, getProgressSnapshot, getProgressSnapshot)
}

export function useAvailabilityDecisionMetrics(): AvailabilityDecisionMetricsState {
  return useSyncExternalStore(subscribeDecisionMetrics, getDecisionMetricsSnapshot, getDecisionMetricsSnapshot)
}

export function useAvailabilityFilters(): AvailabilityFiltersState {
  return useSyncExternalStore(subscribeFilters, getFiltersSnapshot, getFiltersSnapshot)
}

export function useAvailabilityResultsHeader(): AvailabilityResultsHeaderState {
  return useSyncExternalStore(subscribeResultsHeader, getResultsHeaderSnapshot, getResultsHeaderSnapshot)
}

export function useAvailabilitySelectionActions(): AvailabilitySelectionActionsState {
  return useSyncExternalStore(subscribeSelectionActions, getSelectionActionsSnapshot, getSelectionActionsSnapshot)
}
