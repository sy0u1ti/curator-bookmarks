import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { displayUrl } from '../../shared/text.js'
import { Button, CheckboxControl, ThemeProvider } from '../../ui'

export interface AvailabilityQuickActionViewModel {
  action: string
  disabled: boolean
  impact: string
  label: string
}

export interface AvailabilityResultCardViewModel {
  actionButton: {
    action: 'promote-failed' | 'demote-review'
    disabled: boolean
    label: string
    ariaLabel: string
  } | null
  badgeText: string
  bookmarkId: string
  evidenceCopy: string
  finalUrl: string
  metadataItems: string[]
  openLabel: string
  path: string
  quickActions: AvailabilityQuickActionViewModel[]
  recommendation: string
  selectable: boolean
  selected: boolean
  selectionDisabled: boolean
  selectionLabel: string
  showFinalUrl: boolean
  statusLabel: string
  title: string
  tone: string
  url: string
}

export interface AvailabilityResultsState {
  emptyMessage: string
  results: AvailabilityResultCardViewModel[]
}

const roots = new WeakMap<Element, Root>()

export function renderAvailabilityResultsIsland(
  container: Element,
  state: AvailabilityResultsState
): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <AvailabilityResults state={state} />
      </ThemeProvider>
    )
  })
}

function AvailabilityResults({ state }: { state: AvailabilityResultsState }) {
  if (!state.results.length) {
    return <div className="detect-empty">{state.emptyMessage}</div>
  }

  return (
    <>
      {state.results.map((result) => (
        <AvailabilityResultCard key={result.bookmarkId} result={result} />
      ))}
    </>
  )
}

function AvailabilityResultCard({ result }: { result: AvailabilityResultCardViewModel }) {
  return (
    <article
      className={[
        'detect-result-card',
        'availability-result-card',
        result.selected ? 'selected' : ''
      ].filter(Boolean).join(' ')}
    >
      <div className="detect-result-head">
        <div className="detect-result-head-left">
          {result.selectable ? (
            <label className="detect-result-check">
              <CheckboxControl
                aria-label={result.selectionLabel}
                className="options-checkbox-control"
                checked={result.selected}
                disabled={result.selectionDisabled}
                inputAttributes={{
                  'data-availability-select': 'true',
                  'data-bookmark-id': result.bookmarkId
                }}
                syncInputState
                unstyled
              />
              <span>选择</span>
            </label>
          ) : null}
          <span className={`options-chip ${result.tone}`}>{result.statusLabel}</span>
          <span className="options-chip muted">{result.badgeText}</span>
        </div>
        <div className="detect-result-actions">
          <AvailabilityPanelMoveAction result={result} />
          {result.url ? (
            <a
              className="detect-result-open"
              href={result.url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={result.openLabel}
            >
              打开链接
            </a>
          ) : null}
        </div>
      </div>
      <div className="detect-result-copy">
        <strong>{result.title || '未命名书签'}</strong>
        {result.url ? (
          <a className="detect-result-url" href={result.url} target="_blank" rel="noreferrer noopener">
            {displayUrl(result.url)}
          </a>
        ) : (
          <p className="detect-result-url">无可打开 URL</p>
        )}
        {result.showFinalUrl ? (
          <p className="detect-result-detail">最终地址：{displayUrl(result.finalUrl)}</p>
        ) : null}
        <p className="detect-result-detail">{result.recommendation}</p>
        <p className="detect-result-detail">证据摘要：{result.evidenceCopy}</p>
        <p className="detect-result-path" title={result.path || '未归档路径'}>
          路径：{result.path || '未归档路径'}
        </p>
        <div className="availability-result-meta">
          {result.metadataItems.map((item) => (
            <span key={`${result.bookmarkId}:${item}`}>{item}</span>
          ))}
        </div>
        <AvailabilityQuickActions result={result} />
      </div>
    </article>
  )
}

function AvailabilityPanelMoveAction({ result }: { result: AvailabilityResultCardViewModel }) {
  if (!result.actionButton) {
    return null
  }

  const dataAttribute = result.actionButton.action === 'promote-failed'
    ? { 'data-review-action': 'promote-failed' }
    : { 'data-failed-action': 'demote-review' }

  return (
    <Button
      className="detect-result-action"
      type="button"
      data-bookmark-id={result.bookmarkId}
      aria-label={result.actionButton.ariaLabel}
      disabled={result.actionButton.disabled}
      unstyled
      {...dataAttribute}
    >
      {result.actionButton.label}
    </Button>
  )
}

function AvailabilityQuickActions({ result }: { result: AvailabilityResultCardViewModel }) {
  if (!result.quickActions.length) {
    return null
  }

  return (
    <div className="availability-result-actions" aria-label="异常结果忽略操作">
      {result.quickActions.map((action) => (
        <span className="availability-result-action-pair" key={`${result.bookmarkId}:${action.action}`}>
          <Button
            className="detect-result-action"
            type="button"
            data-availability-result-action={action.action}
            data-bookmark-id={result.bookmarkId}
            aria-label={`${action.label}：${action.impact}`}
            title={action.impact}
            disabled={action.disabled}
            unstyled
          >
            {action.label}
          </Button>
          <span>{action.impact}</span>
        </span>
      ))}
    </div>
  )
}
