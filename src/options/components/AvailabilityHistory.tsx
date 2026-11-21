import { useState } from 'react'
import { OptionDetails } from './OptionDetails.js'
import { displayUrl } from '../../shared/text.js'
import { Button } from '../../ui/base/Button'
import { cx } from '../../ui/base/utils'
import { handleHistoryControlAction } from '../options-controller'
import { formatDateTime } from '../shared-options/utils.js'
import { OPTION_SURFACE_CLASS } from './option-layout-classes.js'
import { OptionEmptyState } from './OptionEmptyState.js'
import { useAvailabilityHistoryState } from './availability-history-store.js'
import type {
  AvailabilityHistoryControlsState,
  AvailabilityHistoryResultViewModel,
  AvailabilityHistoryRunViewModel
} from './availability-history-types.js'

const HISTORY_TOOLBAR_CLASS =
  'mt-6 flex flex-wrap items-center justify-between gap-3 max-[760px]:mt-4'
const HISTORY_SUMMARY_CLASS = 'm-0 text-[13px] leading-[1.55] text-ds-text-secondary'
const HISTORY_ACTIONS_CLASS =
  'flex min-w-0 flex-wrap items-center justify-end gap-2 max-[760px]:justify-start'
const HISTORY_METRIC_BAR_CLASS =
  'options-interactive-surface mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-ds-md border border-ds-border-subtle bg-ds-border-subtle'
const HISTORY_METRIC_CELL_CLASS = 'bg-ds-surface-1 px-5 py-4 max-[760px]:px-4 max-[640px]:px-3 max-[640px]:py-3'
const HISTORY_METRIC_LABEL_ROW_CLASS = 'flex items-center gap-2 text-xs font-medium leading-4 text-ds-text-muted'
const HISTORY_METRIC_VALUE_CLASS =
  'mt-2 block text-2xl font-semibold leading-none tracking-[-0.03em] text-ds-text-primary tabular-nums max-[640px]:text-xl'
const HISTORY_SECTION_SURFACE_CLASS =
  `options-interactive-surface curator-motion-surface mt-6 overflow-hidden ${OPTION_SURFACE_CLASS} max-[760px]:mt-4`
const HISTORY_SECTION_HEADER_CLASS =
  'flex flex-wrap items-center justify-between gap-3 border-b border-ds-border-subtle px-5 py-3.5 max-[760px]:px-4'
const HISTORY_SECTION_HEADER_BORDERLESS_CLASS =
  'flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 max-[760px]:px-4'
const HISTORY_SECTION_TITLE_GROUP_CLASS = 'flex min-w-0 items-baseline gap-2.5'
const HISTORY_SECTION_TITLE_CLASS =
  'm-0 text-sm font-semibold leading-[1.35] tracking-[-0.01em] text-ds-text-primary'
const HISTORY_SECTION_COUNT_CLASS = 'text-xs font-medium text-ds-text-muted tabular-nums'
const HISTORY_DIVIDED_LIST_CLASS = 'divide-y divide-ds-border-subtle'
const HISTORY_EMPTY_INLINE_CLASS =
  'px-5 py-4 text-[13px] leading-[1.55] text-ds-text-secondary max-[760px]:px-4'
const HISTORY_RUN_ROW_CLASS =
  'px-5 py-4 transition-colors duration-ds-fast ease-ds-standard hover:bg-ds-hover/40 max-[760px]:px-4'
const HISTORY_RUN_TOP_CLASS =
  'flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1.5'
const HISTORY_RUN_IDENTITY_CLASS =
  'flex min-w-0 flex-wrap items-center gap-2'
const HISTORY_RUN_TITLE_CLASS =
  'text-sm font-medium leading-[1.4] text-ds-text-primary'
const HISTORY_RUN_LATEST_TAG_CLASS =
  'inline-flex h-5 items-center rounded-full border border-ds-border bg-ds-bg-page px-2 text-xs font-medium leading-none text-ds-text-secondary'
const HISTORY_RUN_SCOPE_CLASS =
  'text-xs text-ds-text-muted [overflow-wrap:anywhere]'
const HISTORY_RUN_TIME_CLASS =
  'font-mono text-xs leading-none text-ds-text-muted tabular-nums'
const HISTORY_RUN_TELEMETRY_CLASS =
  'mt-2.5 flex flex-wrap items-center justify-between gap-x-5 gap-y-2'
const HISTORY_RUN_COUNTS_CLASS =
  'flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1'
const HISTORY_RUN_ABNORMAL_CLASS =
  'text-[13px] font-semibold leading-normal text-ds-text-primary tabular-nums'
const HISTORY_RUN_BREAKDOWN_CLASS =
  'text-xs leading-normal text-ds-text-secondary tabular-nums'
const HISTORY_TREND_TRACK_CLASS =
  'h-1 w-28 shrink-0 overflow-hidden rounded-full bg-ds-surface-3 max-[760px]:w-full'
const HISTORY_TREND_BAR_CLASS =
  'block h-full rounded-[inherit] transition-[width] duration-ds-state ease-ds-settle'
const HISTORY_RUN_DELTA_CLASS =
  'text-xs leading-[1.55] text-ds-text-muted tabular-nums'
const HISTORY_DETAILS_WELL_CLASS =
  'mt-3 rounded-ds-sm border border-ds-border-subtle bg-ds-bg-page/75 p-4 max-[760px]:p-3.5'
const HISTORY_RUN_SECTION_CLASS = 'min-w-0'
const HISTORY_RUN_SECTION_HEADER_CLASS =
  'flex items-center justify-between gap-2 pb-2 text-xs font-medium text-ds-text-secondary'
const HISTORY_RUN_LIST_CLASS =
  'm-0 list-none divide-y divide-ds-border-subtle/70 p-0'
const HISTORY_RUN_LIST_ITEM_CLASS =
  'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-[13px] leading-[1.55] text-ds-text-secondary first:pt-0 last:pb-0 [overflow-wrap:anywhere] [word-break:break-word]'
const HISTORY_RECOVERED_ROW_CLASS =
  'px-5 py-3.5 transition-colors duration-ds-fast ease-ds-standard hover:bg-ds-hover/40 max-[760px]:px-4'
const HISTORY_RECOVERED_TOP_CLASS =
  'flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1'
const HISTORY_RECOVERED_TITLE_GROUP_CLASS =
  'flex min-w-0 flex-wrap items-center gap-2'
const HISTORY_RECOVERED_TITLE_CLASS =
  'min-w-0 text-sm font-medium leading-[1.4] text-ds-text-primary [overflow-wrap:anywhere]'
const HISTORY_RECOVERED_STREAK_CLASS =
  'text-xs text-ds-success-text tabular-nums'
const HISTORY_RECOVERED_PATH_CLASS =
  'm-0 text-xs leading-[1.5] text-ds-text-muted [overflow-wrap:anywhere]'
const HISTORY_RECOVERED_URL_CLASS =
  'mt-1 block text-xs leading-[1.55] text-ds-text-secondary [overflow-wrap:anywhere] [word-break:break-word]'

export function AvailabilityHistory() {
  const state = useAvailabilityHistoryState()
  const showLogList = !state.log.collapsed || state.log.runs.length === 0
  const hasHistory = state.log.runs.length > 0
  const hasRecovered = state.recovered.results.length > 0

  if (!hasHistory && !hasRecovered) {
    return (
      <div className="mt-6 max-[760px]:mt-4">
        <OptionEmptyState
          title="还没有检测历史"
          description="完成一次检测后，这里会保留异常变化、恢复记录和趋势。"
          actions={[{ action: 'run-availability', label: '去做可用性检测', variant: 'primary' }]}
        />
      </div>
    )
  }

  return (
    <>
      <AvailabilityHistoryControls state={state.controls} />
      <section className={HISTORY_SECTION_SURFACE_CLASS} aria-label="检测日志">
        <header className={showLogList ? HISTORY_SECTION_HEADER_CLASS : HISTORY_SECTION_HEADER_BORDERLESS_CLASS}>
          <div className={HISTORY_SECTION_TITLE_GROUP_CLASS}>
            <h2 className={HISTORY_SECTION_TITLE_CLASS}>检测日志</h2>
            {state.log.runs.length ? (
              <span className={HISTORY_SECTION_COUNT_CLASS}>{state.log.runs.length} 次</span>
            ) : null}
          </div>
          <div className={HISTORY_ACTIONS_CLASS}>
            {!state.controls.logToggleDisabled ? (
              <Button
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => handleHistoryControlAction('toggle-logs')}
              >
                {state.controls.logToggleLabel}
              </Button>
            ) : null}
          </div>
        </header>
        {showLogList ? (
          <div className={HISTORY_DIVIDED_LIST_CLASS}>
            <AvailabilityHistoryLogList
              emptyCopy={state.log.emptyCopy}
              maxAbnormalCount={state.log.maxAbnormalCount}
              runs={state.log.runs}
            />
          </div>
        ) : null}
      </section>
      {hasHistory || hasRecovered ? (
        <section className={HISTORY_SECTION_SURFACE_CLASS} aria-label="最近一次已恢复">
          <header className={HISTORY_SECTION_HEADER_CLASS}>
            <div className={HISTORY_SECTION_TITLE_GROUP_CLASS}>
              <h2 className={HISTORY_SECTION_TITLE_CLASS}>最近一次已恢复</h2>
              {state.recovered.results.length ? (
                <span className={HISTORY_SECTION_COUNT_CLASS}>{state.recovered.results.length} 条</span>
              ) : null}
            </div>
          </header>
          <div className={HISTORY_DIVIDED_LIST_CLASS}>
            <RecoveredHistoryList
              emptyCopy={state.recovered.emptyCopy}
              results={state.recovered.results}
            />
          </div>
        </section>
      ) : null}
    </>
  )
}

function AvailabilityHistoryControls({ state }: { state: AvailabilityHistoryControlsState }) {
  const newCount = Number(state.metrics.newCount) || 0
  const persistentCount = Number(state.metrics.persistentCount) || 0
  const recoveredCount = Number(state.metrics.recoveredCount) || 0

  return (
    <>
      <div className={HISTORY_TOOLBAR_CLASS}>
        <p className={HISTORY_SUMMARY_CLASS}>{state.subtitle}</p>
        <div className={HISTORY_ACTIONS_CLASS}>
          {!state.clearDisabled ? (
            <Button
              size="sm"
              type="button"
              variant="secondary"
              aria-label="清空可用性检测历史日志"
              onClick={() => handleHistoryControlAction('clear-history')}
            >
              清空历史日志
            </Button>
          ) : null}
        </div>
      </div>
      <div className={HISTORY_METRIC_BAR_CLASS}>
        <div className={HISTORY_METRIC_CELL_CLASS}>
          <span className={HISTORY_METRIC_LABEL_ROW_CLASS}>
            <span className={cx('size-1.5 rounded-full', newCount > 0 ? 'bg-ds-warning' : 'bg-ds-border-hover')} aria-hidden="true" />
            新增异常
          </span>
          <strong className={HISTORY_METRIC_VALUE_CLASS}>{state.metrics.newCount}</strong>
        </div>
        <div className={HISTORY_METRIC_CELL_CLASS}>
          <span className={HISTORY_METRIC_LABEL_ROW_CLASS}>
            <span className={cx('size-1.5 rounded-full', persistentCount > 0 ? 'bg-ds-danger' : 'bg-ds-border-hover')} aria-hidden="true" />
            持续异常
          </span>
          <strong className={HISTORY_METRIC_VALUE_CLASS}>{state.metrics.persistentCount}</strong>
        </div>
        <div className={HISTORY_METRIC_CELL_CLASS}>
          <span className={HISTORY_METRIC_LABEL_ROW_CLASS}>
            <span className={cx('size-1.5 rounded-full', recoveredCount > 0 ? 'bg-ds-success' : 'bg-ds-border-hover')} aria-hidden="true" />
            已恢复
          </span>
          <strong className={HISTORY_METRIC_VALUE_CLASS}>{state.metrics.recoveredCount}</strong>
        </div>
      </div>
    </>
  )
}

function AvailabilityHistoryLogList({
  emptyCopy,
  maxAbnormalCount,
  runs
}: {
  emptyCopy: string
  maxAbnormalCount: number
  runs: AvailabilityHistoryRunViewModel[]
}) {
  if (!runs.length) {
    return (
      <div className="px-5 py-5 max-[760px]:px-4">
        <OptionEmptyState
          embedded
          title="还没有检测历史"
          description={`${emptyCopy} 完成一次检测后，这里会显示异常变化、恢复记录和趋势。`}
          actions={[{ action: 'run-availability', label: '去做可用性检测', variant: 'primary' }]}
        />
      </div>
    )
  }

  return (
    <>
      {runs.map((run, index) => (
        <HistoryRunCard
          index={index}
          key={run.runId || String(run.completedAt)}
          maxAbnormalCount={maxAbnormalCount}
          run={run}
        />
      ))}
    </>
  )
}

function RecoveredHistoryList({
  emptyCopy,
  results
}: {
  emptyCopy: string
  results: AvailabilityHistoryResultViewModel[]
}) {
  if (!results.length) {
    return <div className={HISTORY_EMPTY_INLINE_CLASS}>{emptyCopy}</div>
  }

  return (
    <>
      {results.map((result) => (
        <RecoveredResultCard key={result.id} result={result} />
      ))}
    </>
  )
}

function RecoveredResultCard({ result }: { result: AvailabilityHistoryResultViewModel }) {
  return (
    <article className={HISTORY_RECOVERED_ROW_CLASS}>
      <div className={HISTORY_RECOVERED_TOP_CLASS}>
        <div className={HISTORY_RECOVERED_TITLE_GROUP_CLASS}>
          <span className="size-1.5 shrink-0 rounded-full bg-ds-success" aria-hidden="true" />
          <strong className={HISTORY_RECOVERED_TITLE_CLASS}>{result.title || '未命名书签'}</strong>
          {result.streak ? (
            <span className={HISTORY_RECOVERED_STREAK_CLASS}>此前连续异常 {result.streak} 次</span>
          ) : null}
        </div>
        <p className={HISTORY_RECOVERED_PATH_CLASS} title={result.path || '未归档路径'}>
          {result.path || '未归档路径'}
        </p>
      </div>
      <div className={HISTORY_RECOVERED_URL_CLASS}>{displayUrl(result.url)}</div>
    </article>
  )
}

function HistoryRunCard({
  index,
  maxAbnormalCount,
  run
}: {
  index: number
  maxAbnormalCount: number
  run: AvailabilityHistoryRunViewModel
}) {
  const runLabel = index === 0 ? '最近一次' : `第 ${index + 1} 次记录`
  const abnormalCount = Number(run.summary?.totalAbnormal) || 0
  const width = abnormalCount <= 0 ? 0 : Math.max(8, Math.round((abnormalCount / maxAbnormalCount) * 100))
  const scopeLabel = run.scope?.label || '全部书签'
  const newCount = Number(run.summary?.newCount) || 0
  const persistentCount = Number(run.summary?.persistentCount) || 0
  const recoveredCount = Number(run.summary?.recoveredCount) || 0
  const reviewCount = Number(run.summary?.reviewCount) || 0
  const failedCount = Number(run.summary?.failedCount) || 0
  const statusDotClass = abnormalCount === 0
    ? 'bg-ds-success'
    : failedCount > 0
      ? 'bg-ds-danger'
      : 'bg-ds-warning'
  const trendFillClass = abnormalCount === 0
    ? 'bg-ds-success'
    : failedCount > 0
      ? 'bg-ds-danger'
      : 'bg-ds-warning'

  return (
    <article className={HISTORY_RUN_ROW_CLASS}>
      <div className={HISTORY_RUN_TOP_CLASS}>
        <div className={HISTORY_RUN_IDENTITY_CLASS}>
          <span className={cx('size-1.5 shrink-0 rounded-full', statusDotClass)} aria-hidden="true" />
          <span className={HISTORY_RUN_TITLE_CLASS}>{runLabel}</span>
          {index === 0 ? <span className={HISTORY_RUN_LATEST_TAG_CLASS}>最新</span> : null}
          <span className="text-ds-border-hover" aria-hidden="true">/</span>
          <span className={HISTORY_RUN_SCOPE_CLASS}>{scopeLabel}</span>
        </div>
        <time className={HISTORY_RUN_TIME_CLASS}>{formatDateTime(run.completedAt)}</time>
      </div>
      <div className={HISTORY_RUN_TELEMETRY_CLASS}>
        <div className={HISTORY_RUN_COUNTS_CLASS}>
          <strong className={HISTORY_RUN_ABNORMAL_CLASS}>异常 {abnormalCount} 条</strong>
          <span className={HISTORY_RUN_BREAKDOWN_CLASS}>待确认 {reviewCount} · 无法访问 {failedCount}</span>
        </div>
        <div className={HISTORY_TREND_TRACK_CLASS} aria-hidden="true">
          <span className={cx(HISTORY_TREND_BAR_CLASS, trendFillClass)} style={{ width: `${width}%` }} />
        </div>
      </div>
      <OptionDetails
        className="mt-3"
        panelClassName={HISTORY_DETAILS_WELL_CLASS}
        label="查看本轮明细"
        ariaLabel={'查看本轮明细：' + formatDateTime(run.completedAt)}
        actions={<div className={HISTORY_RUN_DELTA_CLASS}>新增 {newCount} · 持续 {persistentCount} · 恢复 {recoveredCount}</div>}
      >
        <HistoryRunDetails run={run} />
      </OptionDetails>
    </article>
  )
}

function HistoryRunDetails({ run }: { run: AvailabilityHistoryRunViewModel }) {
  const newResults = Array.isArray(run.newResults) ? run.newResults : []
  const recoveredResults = Array.isArray(run.recoveredResults) ? run.recoveredResults : []
  const newIds = new Set(newResults.map(result => String(result.id)))
  const persistentResults = (run.results || []).filter(result => !newIds.has(String(result.id)))
  const topStreak = (run.results || []).reduce((max, result) => Math.max(max, Number(result.streak) || 1), 0)
  return <div className="grid gap-4">
    {topStreak > 1 ? <p className="m-0 text-xs text-ds-text-muted tabular-nums">最长连续异常 {topStreak} 次</p> : null}
    {newResults.length ? <HistoryRunResultSection results={newResults} limit={6} showStreak title="新增异常" /> : null}
    {persistentResults.length ? <HistoryRunResultSection results={persistentResults} limit={6} showStreak title="持续异常" /> : null}
    {recoveredResults.length ? <HistoryRunResultSection results={recoveredResults} limit={4} title="已恢复" /> : null}
    {!newResults.length && !persistentResults.length && !recoveredResults.length ? <p className="m-0 text-[13px] text-ds-text-secondary">本轮没有异常或恢复记录。</p> : null}
  </div>
}

function HistoryRunResultSection({
  limit,
  results,
  showStreak = false,
  title
}: {
  limit: number
  results: AvailabilityHistoryResultViewModel[]
  showStreak?: boolean
  title: string
}) {
  const [additionalVisibleCount, setAdditionalVisibleCount] = useState(0)
  const visibleResults = results.slice(0, limit + additionalVisibleCount)
  const hiddenCount = Math.max(0, results.length - visibleResults.length)

  return (
    <div className={HISTORY_RUN_SECTION_CLASS}>
      <div className={HISTORY_RUN_SECTION_HEADER_CLASS}>
        <strong className="font-medium text-ds-text-primary">{title}</strong>
        <span className="tabular-nums text-ds-text-muted">{results.length} 条</span>
      </div>
      {visibleResults.length ? (
        <>
          <ul className={HISTORY_RUN_LIST_CLASS}>
            {visibleResults.map((result) => (
              <li className={HISTORY_RUN_LIST_ITEM_CLASS} key={result.id}>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-ds-text-primary">{result.title || '未命名书签'}</span>
                  <span className="mx-1.5 text-ds-text-muted" aria-hidden="true">·</span>
                  <span className="font-mono text-xs text-ds-text-muted">{displayUrl(result.url)}</span>
                </span>
                {showStreak ? (
                  <span className="shrink-0 text-xs font-medium text-ds-warning-text tabular-nums">连续异常 {result.streak || 1} 次</span>
                ) : null}
              </li>
            ))}
          </ul>
          {hiddenCount ? <Button className="mt-3" size="sm" variant="secondary" onClick={() => setAdditionalVisibleCount(count => count + 50)}>显示更多（剩余 {hiddenCount} 条）</Button> : null}
        </>
      ) : (
        <p className="m-0 text-[13px] text-ds-text-secondary">没有相关记录。</p>
      )}
    </div>
  )
}
