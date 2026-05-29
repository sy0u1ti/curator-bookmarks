import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { displayUrl } from '../../shared/text.js'
import { Button, ThemeProvider } from '../../ui'

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

const roots = new WeakMap<Element, Root>()

export function renderIgnoreRulesIsland(
  container: Element,
  kind: IgnoreRuleKind,
  rules: IgnoreRuleViewModel[]
): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <IgnoreRuleList kind={kind} rules={rules} />
      </ThemeProvider>
    )
  })
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
