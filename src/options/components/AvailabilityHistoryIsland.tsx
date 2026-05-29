import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { displayUrl } from '../../shared/text.js'
import { ThemeProvider } from '../../ui'
import { formatDateTime } from '../shared-options/utils.js'

export interface AvailabilityHistoryResultViewModel {
  id: string
  title: string
  url: string
  path: string
  status: string
  streak: number
}

export interface AvailabilityHistoryRunViewModel {
  runId: string
  completedAt: number
  scope?: {
    label?: string
    key?: string
  }
  results: AvailabilityHistoryResultViewModel[]
  newResults: AvailabilityHistoryResultViewModel[]
  recoveredResults: AvailabilityHistoryResultViewModel[]
  summary?: {
    totalAbnormal?: number
    newCount?: number
    persistentCount?: number
    recoveredCount?: number
    reviewCount?: number
    failedCount?: number
  }
}

const roots = new WeakMap<Element, Root>()

export function renderAvailabilityHistoryLogIsland(
  container: Element,
  runs: AvailabilityHistoryRunViewModel[],
  emptyCopy: string,
  maxAbnormalCount: number
): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <AvailabilityHistoryLogList
          emptyCopy={emptyCopy}
          maxAbnormalCount={maxAbnormalCount}
          runs={runs}
        />
      </ThemeProvider>
    )
  })
}

export function renderAvailabilityRecoveredHistoryIsland(
  container: Element,
  results: AvailabilityHistoryResultViewModel[],
  emptyCopy: string
): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <RecoveredHistoryList emptyCopy={emptyCopy} results={results} />
      </ThemeProvider>
    )
  })
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
    return <div className="detect-empty">{emptyCopy}</div>
  }

  return (
    <>
      {runs.map((run, index) => (
        <HistoryRunCard
          index={index}
          key={run.runId || `${run.completedAt}:${index}`}
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
    return <div className="detect-empty">{emptyCopy}</div>
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
    <article className="detect-result-card compact">
      <div className="detect-result-head">
        <div className="detect-result-head-left">
          <span className="options-chip success">已恢复</span>
        </div>
      </div>
      <div className="detect-result-copy">
        <strong>{result.title || '未命名书签'}</strong>
        <div className="detect-result-url">{displayUrl(result.url)}</div>
        {result.streak ? (
          <div className="detect-result-detail">恢复前曾连续异常 {result.streak} 次</div>
        ) : null}
        <p className="detect-result-path" title={result.path || '未归档路径'}>
          {result.path || '未归档路径'}
        </p>
      </div>
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
  const newResults = Array.isArray(run.newResults) ? run.newResults : []
  const recoveredResults = Array.isArray(run.recoveredResults) ? run.recoveredResults : []
  const newResultIds = new Set(newResults.map((result) => String(result?.id || '')))
  const persistentResults = (Array.isArray(run.results) ? run.results : []).filter((result) => {
    return !newResultIds.has(String(result?.id || ''))
  })
  const topStreak = (run.results || []).length === 0
    ? 0
    : Math.max(...run.results.map((result) => Number(result.streak) || 1), 1)
  const runLabel = index === 0 ? '最近一次' : `第 ${index + 1} 次记录`
  const abnormalCount = Number(run.summary?.totalAbnormal) || 0
  const width = abnormalCount <= 0 ? 0 : Math.max(8, Math.round((abnormalCount / maxAbnormalCount) * 100))
  const scopeLabel = run.scope?.label || '全部书签'
  const newCount = Number(run.summary?.newCount) || 0
  const persistentCount = Number(run.summary?.persistentCount) || 0
  const recoveredCount = Number(run.summary?.recoveredCount) || 0
  const reviewCount = Number(run.summary?.reviewCount) || 0
  const failedCount = Number(run.summary?.failedCount) || 0

  return (
    <article className="detect-result-card history-run-card">
      <div className="detect-result-head">
        <div className="detect-result-head-left">
          <span className="options-chip muted">{runLabel}</span>
          <span className="options-chip muted">{scopeLabel}</span>
          <span className="options-chip warning">新增 {newCount}</span>
          <span className="options-chip muted">持续 {persistentCount}</span>
          <span className="options-chip success">恢复 {recoveredCount}</span>
        </div>
        <span className="option-value">{formatDateTime(run.completedAt)}</span>
      </div>
      <div className="detect-result-copy">
        <div className="history-run-trend">
          <div className="history-trend-meta">
            <strong>异常 {abnormalCount} 条</strong>
            <span>低置信 {reviewCount} · 高置信 {failedCount}</span>
          </div>
          <div className="history-trend-bar-track" aria-hidden="true">
            <span className="history-trend-bar" style={{ width: `${width}%` }} />
          </div>
          <div className="history-trend-copy">
            新增 {newCount} · 持续 {persistentCount} · 恢复 {recoveredCount}
          </div>
        </div>
        <div className="history-run-summary">
          {topStreak > 0
            ? `当前记录中最高连续异常为 ${topStreak} 次，检测范围为 ${scopeLabel}。`
            : `本次检测没有发现异常，检测范围为 ${scopeLabel}。`}
        </div>
        <HistoryRunResultSection
          emptyCopy="本次没有新增异常。"
          limit={6}
          moreCopy="条新增异常未展开。"
          results={newResults}
          showStreak
          title="本次新增异常"
        />
        <HistoryRunResultSection
          emptyCopy="本次没有持续异常。"
          limit={6}
          moreCopy="条持续异常未展开。"
          results={persistentResults}
          showStreak
          title="本次持续异常"
        />
        <HistoryRunResultSection
          emptyCopy="本次没有已恢复结果。"
          limit={4}
          moreCopy="条已恢复结果未展开。"
          results={recoveredResults}
          title="本次已恢复"
        />
      </div>
    </article>
  )
}

function HistoryRunResultSection({
  emptyCopy,
  limit,
  moreCopy,
  results,
  showStreak = false,
  title
}: {
  emptyCopy: string
  limit: number
  moreCopy: string
  results: AvailabilityHistoryResultViewModel[]
  showStreak?: boolean
  title: string
}) {
  const visibleResults = results.slice(0, limit)
  const hiddenCount = Math.max(0, results.length - visibleResults.length)

  return (
    <div className="history-run-section">
      <strong>{title}</strong>
      {visibleResults.length ? (
        <>
          <ul className="history-run-list">
            {visibleResults.map((result) => (
              <li key={result.id}>
                {result.title || '未命名书签'} · {displayUrl(result.url)}
                {showStreak ? ` · 连续异常 ${result.streak || 1} 次` : ''}
              </li>
            ))}
          </ul>
          {hiddenCount ? <p className="history-run-more">还有 {hiddenCount} {moreCopy}</p> : null}
        </>
      ) : (
        <p className="history-run-empty">{emptyCopy}</p>
      )}
    </div>
  )
}
