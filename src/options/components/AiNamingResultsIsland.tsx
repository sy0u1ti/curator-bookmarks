import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { displayUrl } from '../../shared/text.js'
import {
  AiClassificationResult,
  Button,
  CheckboxControl,
  CollapsiblePanel,
  CollapsibleRoot,
  CollapsibleTrigger,
  ThemeProvider
} from '../../ui'

export interface AiNamingResultCardViewModel {
  canMoveToSuggestedFolder: boolean
  confidenceLabel: string
  confidenceScorePercent: number | null
  currentTitle: string
  detailRows: string[]
  expandedTags: boolean
  id: string
  interactionLocked: boolean
  isSelected: boolean
  moveLabel: string
  openLabel: string
  path: string
  pendingMove: boolean
  selectable: boolean
  selectionLabel: string
  statusLabel: string
  badgeTone: string
  suggestedFolder: string
  suggestedTitle: string
  tags: string[]
  url: string
  applyLabel: string
  rejectLabel: string
}

export interface AiNamingResultsState {
  emptyMessage: string
  results: AiNamingResultCardViewModel[]
}

const roots = new WeakMap<Element, Root>()

export function renderAiNamingResultsIsland(container: Element, state: AiNamingResultsState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <AiNamingResults state={state} />
      </ThemeProvider>
    )
  })
}

function AiNamingResults({ state }: { state: AiNamingResultsState }) {
  if (!state.results.length) {
    return <div className="detect-empty">{state.emptyMessage}</div>
  }

  return (
    <>
      {state.results.map((result) => (
        <AiNamingResultCard key={result.id} result={result} />
      ))}
    </>
  )
}

function AiNamingResultCard({ result }: { result: AiNamingResultCardViewModel }) {
  return (
    <AiClassificationResult
      className={['detect-result-card', result.isSelected ? 'selected' : ''].filter(Boolean).join(' ')}
      title={
        <div className="detect-result-head-left">
          <label className="detect-result-check">
            <CheckboxControl
              aria-label={result.selectionLabel}
              className="options-checkbox-control"
              checked={result.selectable && result.isSelected}
              disabled={!result.selectable || result.interactionLocked}
              inputAttributes={{ 'data-ai-select': result.id }}
              syncInputState
              unstyled
            />
            <span>{result.selectable ? '选择' : '不可直接应用'}</span>
          </label>
          <span className={`options-chip ${result.badgeTone}`}>{result.statusLabel}</span>
        </div>
      }
      confidence={
        <>
          {result.confidenceLabel}
          {result.confidenceScorePercent !== null ? ` · ${result.confidenceScorePercent}%` : ''}
        </>
      }
      actions={
        <div className="detect-result-actions">
          <a
            className="detect-result-open"
            href={result.url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={result.openLabel}
          >
            打开页面
          </a>
          {result.selectable ? (
            <>
              <Button
                className="detect-result-action"
                type="button"
                data-ai-apply={result.id}
                aria-label={result.applyLabel}
                disabled={result.interactionLocked}
                unstyled
              >
                应用建议
              </Button>
              <Button
                className="detect-result-action secondary"
                type="button"
                data-ai-reject={result.id}
                aria-label={result.rejectLabel}
                disabled={result.interactionLocked}
                unstyled
              >
                拒绝建议
              </Button>
            </>
          ) : null}
        </div>
      }
      bodyClassName="detect-result-copy ai-result-copy"
    >
      <strong>{result.currentTitle || '未命名书签'}</strong>
      <p className="ai-result-suggested">{result.suggestedTitle || '未生成建议标题'}</p>
      <div className="ai-result-meta">
        <span>{displayUrl(result.url)}</span>
        <span>{result.path || '未归档路径'}</span>
      </div>
      <SuggestedFolder result={result} />
      <TagPreview result={result} />
      <ResultDetails result={result} />
    </AiClassificationResult>
  )
}

function SuggestedFolder({ result }: { result: AiNamingResultCardViewModel }) {
  if (!result.suggestedFolder) {
    return null
  }

  return (
    <div className="ai-result-folder-suggestion">
      <div className="ai-result-folder-copy">
        <span>推荐文件夹</span>
        <strong>{result.suggestedFolder}</strong>
      </div>
      {result.canMoveToSuggestedFolder ? (
        <Button
          className={[
            'detect-result-action',
            'ai-move-recommended-action',
            'double-confirm-action',
            result.pendingMove ? 'confirm' : ''
          ].filter(Boolean).join(' ')}
          type="button"
          data-ai-move-recommended={result.id}
          title={result.pendingMove
            ? `再次点击，移动到 ${result.suggestedFolder}`
            : `移动到 ${result.suggestedFolder}`}
          aria-label={result.moveLabel}
          disabled={result.interactionLocked}
          unstyled
        >
          {result.pendingMove ? (
            <>
              <span className="double-confirm-icon" aria-hidden="true">✓✓</span> 确认移动
            </>
          ) : (
            '移动至推荐文件夹'
          )}
        </Button>
      ) : null}
    </div>
  )
}

function TagPreview({ result }: { result: AiNamingResultCardViewModel }) {
  if (!result.tags.length) {
    return null
  }

  return (
    <div
      className={['ai-result-tag-shell', result.expandedTags ? 'expanded' : ''].filter(Boolean).join(' ')}
      data-ai-tag-shell={result.id}
    >
      <div className="ai-result-tag-list" aria-label="标签预览" data-ai-tag-list={result.id}>
        {result.tags.map((tag) => (
          <span className="ai-result-tag" key={`${result.id}:${tag}`}>
            {tag}
          </span>
        ))}
      </div>
      <Button
        className="ai-result-tag-toggle hidden"
        type="button"
        data-ai-toggle-tags={result.id}
        aria-expanded={result.expandedTags ? 'true' : 'false'}
        unstyled
      >
        {result.expandedTags ? '收起标签' : '展开标签'}
      </Button>
    </div>
  )
}

function ResultDetails({ result }: { result: AiNamingResultCardViewModel }) {
  if (!result.detailRows.length) {
    return null
  }

  return (
    <CollapsibleRoot className="ai-result-details">
      <CollapsibleTrigger className="ai-result-summary">分析细节</CollapsibleTrigger>
      <CollapsiblePanel className="ai-result-detail-list">
        {result.detailRows.map((detail) => (
          <p className="detect-result-detail" key={`${result.id}:${detail}`}>
            {detail}
          </p>
        ))}
      </CollapsiblePanel>
    </CollapsibleRoot>
  )
}
