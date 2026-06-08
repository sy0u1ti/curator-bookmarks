import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { ReactNode } from 'react'
import { displayUrl } from '../../shared/text.js'
import { Button } from '../../ui/primitives/Button.js'
import { Card } from '../../ui/primitives/Card.js'
import { ThemeProvider } from '../../ui/theme/ThemeProvider.js'
import { dispatchIgnoreRuleAction } from './ignore-events.js'

export type IgnoreRuleKind = 'bookmark' | 'domain' | 'folder'

export interface BookmarkIgnoreRuleViewModel {
  bookmarkId: string
  title: string
  url: string
  createdAt: number
}

export interface DomainIgnoreRuleViewModel {
  domain: string
  createdAt: number
}

export interface FolderIgnoreRuleViewModel {
  folderId: string
  title: string
  path: string
  createdAt: number
}

export type IgnoreRuleViewModel =
  | BookmarkIgnoreRuleViewModel
  | DomainIgnoreRuleViewModel
  | FolderIgnoreRuleViewModel

export interface IgnoreRulesState {
  bookmarks: BookmarkIgnoreRuleViewModel[]
  domains: DomainIgnoreRuleViewModel[]
  folders: FolderIgnoreRuleViewModel[]
}

const roots = new WeakMap<Element, Root>()

export function renderIgnoreRulesIsland(
  container: Element,
  kind: IgnoreRuleKind,
  rules: IgnoreRuleViewModel[]
): void {
  renderIgnoreNode(container, <IgnoreRuleList kind={kind} rules={rules} />)
}

export interface IgnoreRulesSummaryState {
  bookmarkCount: number
  domainCount: number
  folderCount: number
}

export function renderIgnoreRulesSummaryIsland(
  container: Element,
  state: IgnoreRulesSummaryState
): void {
  renderIgnoreNode(container, <IgnoreRulesSummary state={state} />)
}

export function renderIgnoreRulesPanelIsland(
  container: Element,
  state: IgnoreRulesState
): void {
  renderIgnoreNode(container, <IgnoreRulesPanelControls state={state} />)
}

function renderIgnoreNode(container: Element, node: ReactNode): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(<ThemeProvider>{node}</ThemeProvider>)
  })
}

const ignoreSummaryMetrics = [
  { key: 'bookmarkCount', label: '书签规则', valueId: 'ignore-bookmark-count' },
  { key: 'domainCount', label: '域名规则', valueId: 'ignore-domain-count' },
  { key: 'folderCount', label: '文件夹规则', valueId: 'ignore-folder-count' }
] satisfies Array<{
  key: keyof IgnoreRulesSummaryState
  label: string
  valueId: string
}>

function IgnoreRulesSummary({ state }: { state: IgnoreRulesSummaryState }) {
  return (
    <div className="detect-summary-grid compact-grid">
      {ignoreSummaryMetrics.map((metric) => (
        <Card className="summary-card compact" key={metric.valueId}>
          <span className="summary-label">{metric.label}</span>
          <strong id={metric.valueId}>{state[metric.key]}</strong>
        </Card>
      ))}
    </div>
  )
}

function IgnoreRulesPanelControls({ state }: { state: IgnoreRulesState }) {
  const summaryState: IgnoreRulesSummaryState = {
    bookmarkCount: state.bookmarks.length,
    domainCount: state.domains.length,
    folderCount: state.folders.length
  }
  const groups = [
    {
      clearId: 'ignore-clear-bookmarks',
      clearLabel: '清空按书签忽略规则',
      detail: '仅压制指定书签本身的异常提示。',
      kind: 'bookmark',
      listId: 'ignore-bookmark-rules',
      rules: state.bookmarks,
      title: '按书签忽略'
    },
    {
      clearId: 'ignore-clear-domains',
      clearLabel: '清空按域名忽略规则',
      detail: '同一域名下的异常提示会被压制。',
      kind: 'domain',
      listId: 'ignore-domain-rules',
      rules: state.domains,
      title: '按域名忽略'
    },
    {
      clearId: 'ignore-clear-folders',
      clearLabel: '清空按文件夹忽略规则',
      detail: '命中该文件夹及其子层级的异常提示会被压制。',
      kind: 'folder',
      listId: 'ignore-folder-rules',
      rules: state.folders,
      title: '按文件夹忽略'
    }
  ] satisfies Array<{
    clearId: string
    clearLabel: string
    detail: string
    kind: IgnoreRuleKind
    listId: string
    rules: IgnoreRuleViewModel[]
    title: string
  }>

  return (
    <>
      <IgnoreRulesSummary state={summaryState} />
      {groups.map((group) => (
        <div className="options-group detect-results-group" key={group.kind}>
          <div className="detect-results-header">
            <div>
              <strong>{group.title}</strong>
              <p className="detect-results-subtitle">{group.detail}</p>
            </div>
            <Button
              id={group.clearId}
              className="options-button secondary small"
              size="sm"
              type="button"
              variant="secondary"
              aria-label={group.clearLabel}
              disabled={group.rules.length === 0}
              onClick={() => dispatchIgnoreRuleAction({ action: 'clear', kind: group.kind })}
            >
              清空本类
            </Button>
          </div>
          <div id={group.listId} className="detect-results">
            <IgnoreRuleList kind={group.kind} rules={group.rules} />
          </div>
        </div>
      ))}
    </>
  )
}

function IgnoreRuleList({
  kind,
  rules
}: {
  kind: IgnoreRuleKind
  rules: IgnoreRuleViewModel[]
}) {
  if (!rules.length) {
    return <div className="detect-empty">当前没有这类忽略规则。</div>
  }

  return (
    <>
      {rules
        .slice()
        .sort((left, right) => (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0))
        .map((rule) => (
          <IgnoreRuleCard kind={kind} key={`${kind}:${getIgnoreRuleId(rule, kind)}`} rule={rule} />
        ))}
    </>
  )
}

function IgnoreRuleCard({
  kind,
  rule
}: {
  kind: IgnoreRuleKind
  rule: IgnoreRuleViewModel
}) {
  const title = getIgnoreRuleTitle(rule, kind)
  const detail = getIgnoreRuleDetail(rule, kind)
  const ruleId = getIgnoreRuleId(rule, kind)
  const deleteLabel = getIgnoreRuleActionLabel('删除忽略规则', rule, kind)

  return (
    <article className="detect-result-card compact">
      <div className="detect-result-head">
        <div className="detect-result-head-left">
          <span className="options-chip muted">忽略规则</span>
        </div>
        <div className="detect-result-actions">
          <Button
            className="detect-result-action"
            type="button"
            data-ignore-remove={kind}
            data-ignore-id={ruleId}
            aria-label={deleteLabel}
            onClick={() => dispatchIgnoreRuleAction({ action: 'remove', kind, ruleId })}
            unstyled
          >
            删除规则
          </Button>
        </div>
      </div>
      <div className="detect-result-copy">
        <strong>{title || '未命名规则'}</strong>
        <div className="detect-result-detail">{detail || ''}</div>
      </div>
    </article>
  )
}

function getIgnoreRuleTitle(rule: IgnoreRuleViewModel, kind: IgnoreRuleKind): string {
  if (kind === 'bookmark' && 'title' in rule) {
    return rule.title
  }
  if (kind === 'folder' && 'title' in rule) {
    return rule.title
  }
  if (kind === 'domain' && 'domain' in rule) {
    return rule.domain
  }
  return ''
}

function getIgnoreRuleDetail(rule: IgnoreRuleViewModel, kind: IgnoreRuleKind): string {
  if (kind === 'bookmark' && 'url' in rule) {
    return displayUrl(rule.url)
  }
  if (kind === 'folder' && 'path' in rule && 'title' in rule) {
    return rule.path || rule.title
  }
  return '按域名忽略'
}

function getIgnoreRuleId(rule: IgnoreRuleViewModel, kind: IgnoreRuleKind): string {
  if (kind === 'bookmark' && 'bookmarkId' in rule) {
    return rule.bookmarkId
  }
  if (kind === 'folder' && 'folderId' in rule) {
    return rule.folderId
  }
  if (kind === 'domain' && 'domain' in rule) {
    return rule.domain
  }
  return ''
}

function getIgnoreRuleActionLabel(
  action: string,
  rule: IgnoreRuleViewModel,
  kind: IgnoreRuleKind
): string {
  const title = kind === 'bookmark'
    ? getIgnoreRuleTitle(rule, kind) || getIgnoreRuleDetail(rule, kind)
    : kind === 'folder'
      ? getIgnoreRuleDetail(rule, kind) || getIgnoreRuleTitle(rule, kind)
      : getIgnoreRuleTitle(rule, kind)
  const normalizedTitle = String(title || '未命名规则')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = normalizedTitle.length > 48
    ? `${normalizedTitle.slice(0, 47).trim()}...`
    : normalizedTitle

  return `${action}：${safeTitle || '未命名规则'}`
}
