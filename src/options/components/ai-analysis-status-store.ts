import { useSyncExternalStore } from 'react'
import type { AiNamingResultsState } from './AiAnalysisResultsTypes.js'

export interface AiAnalysisStatusState {
  badgeText: string
  badgeTone: string
  statusCopy: string
}

export interface AiAnalysisProgressState {
  busy: boolean
  progressCopy: string
  progressLabel: string
  progressValue: number
}

export interface AiAnalysisActionsState {
  actionDisabled: boolean
  actionLabel: string
  pauseDisabled: boolean
  pauseHidden: boolean
  pauseLabel: string
  stopDisabled: boolean
  stopHidden: boolean
  stopLabel: string
}

export interface AiAnalysisDurationState {
  durationLabel: string
}

export interface AiAnalysisDecisionMetricsState {
  eligible: string
  suggested: string
  manualReview: string
  unchanged: string
  highConfidence: string
  mediumConfidence: string
  lowConfidence: string
  failed: string
}

export interface AiAnalysisSelectionActionsState {
  applyDisabled: boolean
  clearDisabled: boolean
  countLabel: string
  hidden: boolean
  moveConfirm: boolean
  moveDisabled: boolean
  moveLabel: string
  moveTitle: string
  selectAllDisabled: boolean
  selectHighConfidenceDisabled: boolean
}

export interface AiAnalysisResultsHeaderState {
  resultCount: string
  subtitle: string
}

export interface AiAnalysisResultsFilterState {
  clearDisabled: boolean
  confidence: string
  query: string
  status: string
}

export interface AiAnalysisScopePickerState {
  copy: string
  disabled: boolean
  label: string
}

export interface AiAnalysisResultsPaginationState {
  end: number
  label: string
  page: number
  start: number
  totalCount: number
  totalPages: number
  visible: boolean
}

const defaultState: AiAnalysisStatusState = {
  badgeText: '书签智能分析',
  badgeTone: 'muted',
  statusCopy: '保存通用 AI 渠道后，系统会先读取网页内容，再分批生成书签智能分析建议并同步网页内容索引。建议生成后，你可以先预览并手动选择要应用的标题。'
}

const defaultProgressState: AiAnalysisProgressState = {
  busy: false,
  progressCopy: '先读取书签指向的网页内容，再把结果分批发送给 AI 模型生成书签智能分析建议。',
  progressLabel: '未开始',
  progressValue: 0
}

const defaultActionsState: AiAnalysisActionsState = {
  actionDisabled: true,
  actionLabel: '开始分析并生成建议',
  pauseDisabled: true,
  pauseHidden: true,
  pauseLabel: '暂停生成',
  stopDisabled: true,
  stopHidden: true,
  stopLabel: '停止本次生成'
}

const defaultDurationState: AiAnalysisDurationState = {
  durationLabel: '未开始'
}

const defaultDecisionMetricsState: AiAnalysisDecisionMetricsState = {
  eligible: '0',
  suggested: '0',
  manualReview: '0',
  unchanged: '0',
  highConfidence: '0',
  mediumConfidence: '0',
  lowConfidence: '0',
  failed: '0'
}

const defaultSelectionActionsState: AiAnalysisSelectionActionsState = {
  applyDisabled: true,
  clearDisabled: true,
  countLabel: '0 条已选择',
  hidden: true,
  moveConfirm: false,
  moveDisabled: true,
  moveLabel: '移动至推荐文件夹',
  moveTitle: '所选结果没有可用的推荐文件夹',
  selectAllDisabled: true,
  selectHighConfidenceDisabled: true
}

const defaultResultsHeaderState: AiAnalysisResultsHeaderState = {
  resultCount: '0 条结果',
  subtitle: '在通用设置中配置 AI 渠道后，开始分析并生成建议，这里会展示当前标题、建议标题、标签、置信度与原因。'
}

const defaultResultsFilterState: AiAnalysisResultsFilterState = {
  clearDisabled: true,
  confidence: 'all',
  query: '',
  status: 'all'
}

const defaultResultsState: AiNamingResultsState = {
  emptyMessage: '保存 AI 渠道并开始分析后，这里会展示书签智能分析结果。',
  results: []
}

const defaultScopePickerState: AiAnalysisScopePickerState = {
  copy: '当前范围：全部书签。你可以切换到某个文件夹，只处理该文件夹及其子层级里的 `http/https` 书签。',
  disabled: false,
  label: '全部书签'
}

const defaultResultsPaginationState: AiAnalysisResultsPaginationState = {
  end: 0,
  label: 'AI 结果',
  page: 1,
  start: 0,
  totalCount: 0,
  totalPages: 1,
  visible: false
}

let currentState = defaultState
let currentProgressState = defaultProgressState
let currentActionsState = defaultActionsState
let currentDurationState = defaultDurationState
let currentDecisionMetricsState = defaultDecisionMetricsState
let currentSelectionActionsState = defaultSelectionActionsState
let currentResultsHeaderState = defaultResultsHeaderState
let currentResultsFilterState = defaultResultsFilterState
let currentResultsState = defaultResultsState
let currentScopePickerState = defaultScopePickerState
let currentResultsPaginationState = defaultResultsPaginationState
const listeners = new Set<() => void>()
const progressListeners = new Set<() => void>()
const actionsListeners = new Set<() => void>()
const durationListeners = new Set<() => void>()
const decisionMetricsListeners = new Set<() => void>()
const selectionActionsListeners = new Set<() => void>()
const resultsHeaderListeners = new Set<() => void>()
const resultsFilterListeners = new Set<() => void>()
const resultsListeners = new Set<() => void>()
const scopePickerListeners = new Set<() => void>()
const resultsPaginationListeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function subscribeProgress(listener: () => void): () => void {
  progressListeners.add(listener)
  return () => progressListeners.delete(listener)
}

function subscribeActions(listener: () => void): () => void {
  actionsListeners.add(listener)
  return () => actionsListeners.delete(listener)
}

function subscribeDuration(listener: () => void): () => void {
  durationListeners.add(listener)
  return () => durationListeners.delete(listener)
}

function subscribeDecisionMetrics(listener: () => void): () => void {
  decisionMetricsListeners.add(listener)
  return () => decisionMetricsListeners.delete(listener)
}

function subscribeSelectionActions(listener: () => void): () => void {
  selectionActionsListeners.add(listener)
  return () => selectionActionsListeners.delete(listener)
}

function subscribeResultsHeader(listener: () => void): () => void {
  resultsHeaderListeners.add(listener)
  return () => resultsHeaderListeners.delete(listener)
}

function subscribeResultsFilter(listener: () => void): () => void {
  resultsFilterListeners.add(listener)
  return () => resultsFilterListeners.delete(listener)
}

function subscribeResults(listener: () => void): () => void {
  resultsListeners.add(listener)
  return () => resultsListeners.delete(listener)
}

function subscribeScopePicker(listener: () => void): () => void {
  scopePickerListeners.add(listener)
  return () => scopePickerListeners.delete(listener)
}

function subscribeResultsPagination(listener: () => void): () => void {
  resultsPaginationListeners.add(listener)
  return () => resultsPaginationListeners.delete(listener)
}

function getSnapshot(): AiAnalysisStatusState {
  return currentState
}

function getProgressSnapshot(): AiAnalysisProgressState {
  return currentProgressState
}

function getActionsSnapshot(): AiAnalysisActionsState {
  return currentActionsState
}

function getDurationSnapshot(): AiAnalysisDurationState {
  return currentDurationState
}

function getDecisionMetricsSnapshot(): AiAnalysisDecisionMetricsState {
  return currentDecisionMetricsState
}

function getSelectionActionsSnapshot(): AiAnalysisSelectionActionsState {
  return currentSelectionActionsState
}

function getResultsHeaderSnapshot(): AiAnalysisResultsHeaderState {
  return currentResultsHeaderState
}

function getResultsFilterSnapshot(): AiAnalysisResultsFilterState {
  return currentResultsFilterState
}

function getResultsSnapshot(): AiNamingResultsState {
  return currentResultsState
}

function getScopePickerSnapshot(): AiAnalysisScopePickerState {
  return currentScopePickerState
}

function getResultsPaginationSnapshot(): AiAnalysisResultsPaginationState {
  return currentResultsPaginationState
}

export function publishAiAnalysisStatus(state: AiAnalysisStatusState): void {
  currentState = state
  listeners.forEach((listener) => listener())
}

export function publishAiAnalysisProgress(state: AiAnalysisProgressState): void {
  currentProgressState = state
  progressListeners.forEach((listener) => listener())
}

export function publishAiAnalysisActions(state: AiAnalysisActionsState): void {
  currentActionsState = state
  actionsListeners.forEach((listener) => listener())
}

export function publishAiAnalysisDuration(state: AiAnalysisDurationState): void {
  currentDurationState = state
  durationListeners.forEach((listener) => listener())
}

export function publishAiAnalysisDecisionMetrics(state: AiAnalysisDecisionMetricsState): void {
  currentDecisionMetricsState = state
  decisionMetricsListeners.forEach((listener) => listener())
}

export function publishAiAnalysisSelectionActions(state: AiAnalysisSelectionActionsState): void {
  currentSelectionActionsState = state
  selectionActionsListeners.forEach((listener) => listener())
}

export function publishAiAnalysisResultsHeader(state: AiAnalysisResultsHeaderState): void {
  currentResultsHeaderState = state
  resultsHeaderListeners.forEach((listener) => listener())
}

export function publishAiAnalysisResultsFilter(state: AiAnalysisResultsFilterState): void {
  currentResultsFilterState = state
  resultsFilterListeners.forEach((listener) => listener())
}

export function publishAiAnalysisResults(state: AiNamingResultsState): void {
  currentResultsState = state
  resultsListeners.forEach((listener) => listener())
}

export function publishAiAnalysisScopePicker(state: AiAnalysisScopePickerState): void {
  currentScopePickerState = state
  scopePickerListeners.forEach((listener) => listener())
}

export function publishAiAnalysisResultsPagination(state: AiAnalysisResultsPaginationState): void {
  currentResultsPaginationState = state
  resultsPaginationListeners.forEach((listener) => listener())
}

export function useAiAnalysisStatus(): AiAnalysisStatusState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useAiAnalysisProgress(): AiAnalysisProgressState {
  return useSyncExternalStore(subscribeProgress, getProgressSnapshot, getProgressSnapshot)
}

export function useAiAnalysisActions(): AiAnalysisActionsState {
  return useSyncExternalStore(subscribeActions, getActionsSnapshot, getActionsSnapshot)
}

export function useAiAnalysisDuration(): AiAnalysisDurationState {
  return useSyncExternalStore(subscribeDuration, getDurationSnapshot, getDurationSnapshot)
}

export function useAiAnalysisDecisionMetrics(): AiAnalysisDecisionMetricsState {
  return useSyncExternalStore(subscribeDecisionMetrics, getDecisionMetricsSnapshot, getDecisionMetricsSnapshot)
}

export function useAiAnalysisSelectionActions(): AiAnalysisSelectionActionsState {
  return useSyncExternalStore(subscribeSelectionActions, getSelectionActionsSnapshot, getSelectionActionsSnapshot)
}

export function useAiAnalysisResultsHeader(): AiAnalysisResultsHeaderState {
  return useSyncExternalStore(subscribeResultsHeader, getResultsHeaderSnapshot, getResultsHeaderSnapshot)
}

export function useAiAnalysisResultsFilter(): AiAnalysisResultsFilterState {
  return useSyncExternalStore(subscribeResultsFilter, getResultsFilterSnapshot, getResultsFilterSnapshot)
}

export function useAiAnalysisResults(): AiNamingResultsState {
  return useSyncExternalStore(subscribeResults, getResultsSnapshot, getResultsSnapshot)
}

export function useAiAnalysisScopePicker(): AiAnalysisScopePickerState {
  return useSyncExternalStore(subscribeScopePicker, getScopePickerSnapshot, getScopePickerSnapshot)
}

export function useAiAnalysisResultsPagination(): AiAnalysisResultsPaginationState {
  return useSyncExternalStore(subscribeResultsPagination, getResultsPaginationSnapshot, getResultsPaginationSnapshot)
}
