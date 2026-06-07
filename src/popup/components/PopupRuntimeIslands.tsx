import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { CSSProperties, ReactNode } from 'react'
import { getQueryTerms, normalizeQuery } from '../search.js'
import { AiSetupPrompt, Button, DotMatrixLoader, Icon, Input, Progress, Toolbar, type IconName } from '../../ui'

export interface PopupEmptyActionViewModel {
  action: string
  label: string
  primary?: boolean
}

export type PopupEmptyStateViewModel =
  | { kind: 'none' }
  | { kind: 'message'; message: string }
  | { kind: 'natural-setup' }
  | {
      actions: PopupEmptyActionViewModel[]
      hint: string
      kind: 'search'
      title: string
    }

export interface PopupFolderTreeOptionViewModel {
  badges: Array<{ label: string; muted?: boolean }>
  disabled: boolean
  expanded: boolean
  hasChildren: boolean
  id: string
  mode: 'move' | 'smart' | 'edit'
  path: string
  rowCurrent: boolean
  selected: boolean
  title: string
  toggleLabel: string
  depth: number
}

export interface PopupFolderPickerState {
  empty: {
    action?: string
    actionLabel?: string
    detail?: string
    message?: string
    title?: string
  } | null
  mode: 'move' | 'smart' | 'edit'
  query: string
  treeOptions?: PopupFolderTreeOptionViewModel[]
}

export interface PopupActionMenuItemViewModel {
  action: string
  ariaLabel: string
  bookmarkId: string
  danger: boolean
  disabled: boolean
  label: string
}

export interface PopupActionMenuViewModel {
  id: string
  items: PopupActionMenuItemViewModel[]
  open: boolean
}

export interface PopupContentBookmarkRowViewModel {
  bookmarkId: string
  depth: number
  displayUrl: string
  kind: 'bookmark'
  menu: PopupActionMenuViewModel
  menuLabel: string
  path?: string
  title: string
  url: string
}

export interface PopupContentFolderRowViewModel {
  active?: boolean
  countLabel: string
  depth: number
  expanded: boolean
  folderId: string
  kind: 'folder'
  root: boolean
  subtitle: string
  title: string
  toggleLabel: string
}

export interface PopupContentSearchResultViewModel {
  active: boolean
  bookmarkId: string
  depth: number
  displayUrl: string
  highlightQuery: string
  index: number
  kind: 'result'
  menu: PopupActionMenuViewModel
  menuLabel: string
  path: string
  reasonLabel: string
  reasonTitle: string
  reasonTokens: string[]
  title: string
  url: string
}

export type PopupContentRowViewModel =
  | PopupContentBookmarkRowViewModel
  | PopupContentFolderRowViewModel
  | PopupContentSearchResultViewModel

export type PopupContentMainRowViewModel =
  | PopupContentBookmarkRowViewModel
  | PopupContentSearchResultViewModel

export interface PopupContentViewModel {
  emptyLabel?: string
  loading?: boolean
  mainState?: {
    kind: 'empty' | 'loading' | 'natural-setup' | 'search-empty'
    label?: string
    state?: PopupEmptyStateViewModel
  }
  mainRows?: PopupContentMainRowViewModel[]
  meta?: string
  mode?: 'search' | 'tree'
  rows: PopupContentRowViewModel[]
  sidebarRows?: PopupContentFolderRowViewModel[]
  title?: string
}

export interface PopupSmartPageViewModel {
  bookmarked: boolean
  favicon: string
  pinLabel: string
  pinPending: boolean
  pinned: boolean
  status: string
  statusTitle: string
  title: string
  fallbackIcon: string
}

export interface PopupSmartRecommendationViewModel {
  confidence: number
  id: string
  isNew: boolean
  selected: boolean
  title: string
  path: string
}

export interface PopupSmartClassifierViewModel {
  error: string
  loadingLabel: string
  loadingProgress: number
  loadingStartProgress: number
  loadingStep: number
  loadingStepCount: number
  page: PopupSmartPageViewModel | null
  permissionOrigins: string[]
  recommendations: PopupSmartRecommendationViewModel[]
  saved: boolean
  saving: boolean
  status: 'hidden' | 'idle' | 'page-loading' | 'loading' | 'results' | 'error' | 'permission'
  suggestedTitle: string
}

const roots = new WeakMap<Element, Root>()

function renderIsland(container: Element, node: ReactNode): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(node)
  })
}

export function renderPopupFolderPickerIsland(
  container: Element,
  state: PopupFolderPickerState
): void {
  renderIsland(container, <PopupFolderPicker state={state} />)
}

export function renderPopupSmartClassifierIsland(
  container: Element,
  state: PopupSmartClassifierViewModel
): void {
  renderIsland(container, <PopupSmartClassifier state={state} />)
}

function PopupEmptyState({ state }: { state: PopupEmptyStateViewModel }) {
  if (state.kind === 'none') {
    return null
  }

  if (state.kind === 'message') {
    return <>{state.message}</>
  }

  if (state.kind === 'natural-setup') {
    return (
      <AiSetupPrompt
        className="empty-search-state natural-search-setup-state"
        title={<p className="empty-title">请配置 AI 渠道</p>}
        description={<p className="empty-hint">普通搜索已包含本地规则。语义搜索需要配置 AI 渠道后使用。</p>}
        actions={
          <>
            <Button
              className="empty-action primary"
              type="button"
              data-empty-action="open-ai-settings"
              unstyled
            >
              配置 AI 渠道
            </Button>
            <Button
              className="empty-action"
              type="button"
              data-empty-action="dismiss-natural-setup"
              unstyled
            >
              继续普通搜索
            </Button>
          </>
        }
      />
    )
  }

  return (
    <div className="empty-search-state">
      <p className="empty-title">{state.title}</p>
      <p className="empty-hint">{state.hint}</p>
      <div className="empty-actions">
        {state.actions.map((action) => (
          <Button
            className={['empty-action', action.primary ? 'primary' : ''].filter(Boolean).join(' ')}
            type="button"
            data-empty-action={action.action}
            key={action.action}
            unstyled
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function PopupFolderPicker({ state }: { state: PopupFolderPickerState }) {
  return <PopupTreeFolderPicker state={state} />
}

function PopupTreeFolderPicker({ state }: { state: PopupFolderPickerState }) {
  const options = state.treeOptions || []

  if (!options.length) {
    return state.empty?.message ? <div className="state-panel">{state.empty.message}</div> : null
  }

  return (
    <>
      {options.map((option) => (
        <PopupTreeFolderOption option={option} query={state.query} key={`${option.mode}:${option.id}`} />
      ))}
    </>
  )
}

function PopupTreeFolderOption({
  option,
  query
}: {
  option: PopupFolderTreeOptionViewModel
  query: string
}) {
  const toggleAttrs = getTreeFolderToggleAttributes(option)
  const selectAttrs = getTreeFolderSelectAttributes(option)
  const style = { '--depth': option.depth } as CSSProperties

  return (
    <div className={['picker-row', option.rowCurrent ? 'current' : ''].filter(Boolean).join(' ')} style={style}>
      <Button
        className={['tree-toggle', option.expanded ? 'expanded' : ''].filter(Boolean).join(' ')}
        type="button"
        role="treeitem"
        aria-level={option.depth + 1}
        aria-expanded={option.hasChildren ? option.expanded : false}
        aria-label={option.toggleLabel}
        unstyled
        {...(!option.hasChildren ? { 'data-disabled': 'true' } : {})}
        {...toggleAttrs}
      ></Button>
      <Button
        className="picker-folder-card"
        type="button"
        role="treeitem"
        aria-level={option.depth + 1}
        aria-selected={option.selected ? 'true' : 'false'}
        disabled={option.disabled}
        unstyled
        {...selectAttrs}
      >
        <span className="folder-tree-branch" aria-hidden="true"></span>
        <span className="picker-folder-main">
          <span className="row-title">
            <HighlightedText text={option.title} query={query} />
          </span>
          <span className="picker-path" title={option.path}>
            <HighlightedText text={option.path} query={query} />
          </span>
          {option.badges.map((badge) => (
            <span
              className={['picker-badge', badge.muted ? 'muted' : ''].filter(Boolean).join(' ')}
              key={badge.label}
            >
              {badge.label}
            </span>
          ))}
        </span>
      </Button>
    </div>
  )
}

function getTreeFolderToggleAttributes(option: PopupFolderTreeOptionViewModel) {
  if (option.mode === 'move') {
    return { 'data-toggle-move-folder': option.id }
  }
  if (option.mode === 'smart') {
    return { 'data-toggle-smart-folder': option.id }
  }
  return { 'data-toggle-edit-folder': option.id }
}

function getTreeFolderSelectAttributes(option: PopupFolderTreeOptionViewModel) {
  if (option.mode === 'move') {
    return { 'data-select-folder': option.id }
  }
  if (option.mode === 'smart') {
    return { 'data-smart-select-folder': option.id }
  }
  return { 'data-select-edit-folder': option.id }
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitHighlightText(text, query).map((part, index) => {
        const key = `${index}:${part.text}`
        return part.highlight ? <mark key={key}>{part.text}</mark> : <span key={key}>{part.text}</span>
      })}
    </>
  )
}

function splitHighlightText(text: string, query: string): Array<{ highlight: boolean; text: string }> {
  const safeText = String(text || '')
  const terms = getQueryTerms(normalizeQuery(query))

  if (!terms.length || !safeText) {
    return [{ highlight: false, text: safeText }]
  }

  const lowerText = safeText.toLowerCase()
  const ranges: Array<[number, number]> = []

  for (const term of [...terms].sort((left, right) => right.length - left.length)) {
    let fromIndex = 0
    while (fromIndex < lowerText.length) {
      const matchIndex = lowerText.indexOf(term, fromIndex)
      if (matchIndex === -1) {
        break
      }
      ranges.push([matchIndex, matchIndex + term.length])
      fromIndex = matchIndex + term.length
    }
  }

  if (!ranges.length) {
    return [{ highlight: false, text: safeText }]
  }

  ranges.sort((left, right) => left[0] - right[0])
  const mergedRanges: Array<[number, number]> = []

  for (const currentRange of ranges) {
    const previousRange = mergedRanges.at(-1)
    if (!previousRange || currentRange[0] > previousRange[1]) {
      mergedRanges.push([...currentRange])
      continue
    }

    previousRange[1] = Math.max(previousRange[1], currentRange[1])
  }

  const parts: Array<{ highlight: boolean; text: string }> = []
  let cursor = 0

  for (const [start, end] of mergedRanges) {
    if (start > cursor) {
      parts.push({ highlight: false, text: safeText.slice(cursor, start) })
    }
    parts.push({ highlight: true, text: safeText.slice(start, end) })
    cursor = end
  }

  if (cursor < safeText.length) {
    parts.push({ highlight: false, text: safeText.slice(cursor) })
  }

  return parts.length ? parts : [{ highlight: false, text: safeText }]
}

export function PopupContent({ state }: { state: PopupContentViewModel }) {
  const sidebarRows = state.sidebarRows || state.rows.filter((row): row is PopupContentFolderRowViewModel => row.kind === 'folder')
  const mainRows = state.mainRows || state.rows.filter((row): row is PopupContentMainRowViewModel => row.kind !== 'folder')
  const mode = state.mode || (mainRows.some((row) => row.kind === 'result') ? 'search' : 'tree')
  const title = state.title || (mode === 'search' ? '搜索结果' : '全部书签')
  const meta = state.meta || `${mainRows.length} 条`
  const isLoading = Boolean(state.loading)

  return (
    <div
      className={[
        'bookmark-workspace-shell',
        't-skel',
        isLoading ? 'is-loading' : 'is-revealed'
      ].join(' ')}
      data-state={isLoading ? 'loading' : 'ready'}
      aria-busy={isLoading ? 'true' : 'false'}
    >
      <div className="bookmark-workspace-skeleton t-skel-skeleton is-pulsing" aria-hidden="true">
        <PopupContentSkeleton mode={mode} title={title} />
      </div>
      <div className="bookmark-workspace-content t-skel-content">
        <div className={['bookmark-workspace', `bookmark-workspace-${mode}`].join(' ')}>
          <aside className="bookmark-sidebar" aria-label="文件夹树">
            <header className="bookmark-pane-head">
              <span>全部文件夹</span>
            </header>
            <div className="bookmark-folder-tree" role="tree">
              {sidebarRows.map((row) => <PopupFolderRow row={row} key={`folder:${row.folderId}`} />)}
            </div>
          </aside>
          <section className="bookmark-main-pane" aria-label={title}>
            <header className="bookmark-pane-head bookmark-main-head">
              <span>{title}</span>
              <span className="bookmark-pane-meta">{meta}</span>
            </header>
            <div className="bookmark-main-list" data-popup-main-list role="list">
              {state.mainState ? (
                <PopupMainStatePanel state={state.mainState} />
              ) : mainRows.length ? (
                mainRows.map((row) => {
                  if (row.kind === 'bookmark') {
                    return <PopupBookmarkRow row={row} key={`bookmark:${row.bookmarkId}`} />
                  }
                  return <PopupSearchResultRow row={row} key={`result:${row.bookmarkId}:${row.index}`} />
                })
              ) : (
                <div className="state-panel compact">{state.emptyLabel || '暂无可展示书签'}</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function PopupContentSkeleton({
  mode,
  title
}: {
  mode: 'search' | 'tree'
  title: string
}) {
  const folderRows = [
    { depth: 0, width: 0.72, count: 0.34 },
    { depth: 1, width: 0.64, count: 0.26 },
    { depth: 1, width: 0.76, count: 0.22 },
    { depth: 2, width: 0.52, count: 0.3 },
    { depth: 1, width: 0.58, count: 0.24 },
    { depth: 2, width: 0.68, count: 0.2 },
    { depth: 2, width: 0.46, count: 0.28 },
    { depth: 1, width: 0.7, count: 0.18 }
  ]
  const bookmarkRows = [
    { width: 0.78, url: 0.58, path: 0.36 },
    { width: 0.62, url: 0.74, path: 0.48 },
    { width: 0.86, url: 0.52, path: 0.42 },
    { width: 0.58, url: 0.68, path: 0.34 },
    { width: 0.74, url: 0.56, path: 0.5 }
  ]

  return (
    <div className={['bookmark-workspace', `bookmark-workspace-${mode}`, 'bookmark-workspace-placeholder'].join(' ')}>
      <aside className="bookmark-sidebar" aria-label="文件夹树加载占位">
        <header className="bookmark-pane-head">
          <span>全部文件夹</span>
        </header>
        <div className="bookmark-folder-tree" role="presentation">
          {folderRows.map((row, index) => (
            <div
              className="tree-row folder-row skeleton-folder-row"
              style={{ '--depth': row.depth } as CSSProperties}
              key={`folder-skeleton:${index}`}
            >
              <div className="folder-card popup-list-row sidebar-folder-card">
                <span className="folder-tree-branch" aria-hidden="true"></span>
                <span className="row-main folder-row-main">
                  <span className="popup-skeleton-bar skeleton-folder-title" style={{ '--skeleton-width': row.width } as CSSProperties}></span>
                  <span className="popup-skeleton-bar skeleton-folder-count" style={{ '--skeleton-width': row.count } as CSSProperties}></span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <section className="bookmark-main-pane" aria-label={`${title}加载占位`}>
        <header className="bookmark-pane-head bookmark-main-head">
          <span>{title}</span>
          <span className="bookmark-pane-meta">
            <span className="popup-skeleton-bar skeleton-meta"></span>
          </span>
        </header>
        <div className="bookmark-main-list" role="presentation">
          {bookmarkRows.map((row, index) => (
            <div className="tree-row bookmark-row skeleton-bookmark-row" key={`bookmark-skeleton:${index}`}>
              <div className="bookmark-card popup-list-row">
                <span className="row-main">
                  <span className="popup-skeleton-bar skeleton-bookmark-title" style={{ '--skeleton-width': row.width } as CSSProperties}></span>
                  <span className="popup-skeleton-bar skeleton-bookmark-url" style={{ '--skeleton-width': row.url } as CSSProperties}></span>
                  <span className="popup-skeleton-bar skeleton-bookmark-path" style={{ '--skeleton-width': row.path } as CSSProperties}></span>
                </span>
              </div>
              <div className="popup-row-actions skeleton-row-actions">
                <span className="popup-skeleton-dot"></span>
                <span className="popup-skeleton-dot"></span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function PopupMainStatePanel({
  state
}: {
  state: NonNullable<PopupContentViewModel['mainState']>
}) {
  if (state.kind === 'loading') {
    return (
      <div className="state-panel compact bookmark-main-state" role="status" aria-live="polite">
        <PopupMainLoadingSkeleton label={state.label || '正在搜索书签…'} />
      </div>
    )
  }

  if (state.kind === 'natural-setup' || state.kind === 'search-empty') {
    return (
      <div className="state-panel compact bookmark-main-state">
        <PopupEmptyState state={state.state || { kind: 'none' }} />
      </div>
    )
  }

  return (
    <div className="state-panel compact bookmark-main-state">
      {state.label || '暂无可展示书签'}
    </div>
  )
}

function PopupMainLoadingSkeleton({ label }: { label: string }) {
  return (
    <div className="popup-search-skeleton" aria-label={label}>
      {[0.82, 0.66, 0.74].map((width, index) => (
        <div className="popup-search-skeleton-row" key={`search-skeleton:${index}`}>
          <span className="popup-skeleton-bar skeleton-bookmark-title" style={{ '--skeleton-width': width } as CSSProperties}></span>
          <span className="popup-skeleton-bar skeleton-bookmark-url" style={{ '--skeleton-width': 0.46 + index * 0.08 } as CSSProperties}></span>
        </div>
      ))}
    </div>
  )
}

function PopupFolderRow({ row }: { row: PopupContentFolderRowViewModel }) {
  const style = { '--depth': row.depth } as CSSProperties

  return (
    <div className={['tree-row', 'folder-row', row.root ? 'root-folder-row' : '', row.active ? 'active' : ''].filter(Boolean).join(' ')} style={style}>
      <Button
        className={['folder-card', 'popup-list-row', 'sidebar-folder-card', row.root ? 'root-folder-card' : '', row.active ? 'active' : ''].filter(Boolean).join(' ')}
        type="button"
        data-sidebar-folder-filter={row.root ? 'all' : row.folderId}
        aria-current={row.active ? 'page' : undefined}
        title={row.subtitle}
        unstyled
      >
        <span className="folder-tree-branch" aria-hidden="true"></span>
        <span className="row-main folder-row-main">
          <span className="row-title">{row.title}</span>
          <span className="folder-tree-count" title={`${row.countLabel} 个书签`}>{row.countLabel}</span>
        </span>
      </Button>
    </div>
  )
}

function PopupBookmarkRow({ row }: { row: PopupContentBookmarkRowViewModel }) {
  const style = { '--depth': row.depth } as CSSProperties

  return (
    <div className="tree-row bookmark-row" style={style}>
      <Button className="bookmark-card popup-list-row" type="button" data-open-bookmark={row.bookmarkId} unstyled>
        <span className="row-main">
          <span className="row-title">{row.title}</span>
          <span className="row-subtitle" title={row.url}>{row.displayUrl}</span>
          {row.path ? <span className="row-path" title={row.path}>{row.path}</span> : null}
        </span>
      </Button>
      <PopupRowActions bookmarkId={row.bookmarkId} label={row.menuLabel} menu={row.menu} />
    </div>
  )
}

function PopupSearchResultRow({ row }: { row: PopupContentSearchResultViewModel }) {
  return (
    <article className={['result-card', row.active ? 'active' : ''].filter(Boolean).join(' ')} data-result-index={row.index}>
      <Button className="result-main popup-list-row" type="button" data-open-bookmark={row.bookmarkId} unstyled>
        <span className="result-copy">
          <span className="result-title">
            <HighlightedText text={row.title} query={row.highlightQuery} />
          </span>
          <span className="result-url" title={row.url}>
            <HighlightedText text={row.displayUrl} query={row.highlightQuery} />
          </span>
          <span className="result-path-shell">
            <span className="result-path" title={row.path}>{row.path}</span>
          </span>
          {row.reasonTokens.length ? (
            <span className="result-match-reasons" title={row.reasonTitle} aria-label={row.reasonLabel}>
              {row.reasonTokens.map((token) => (
                <span className="result-match-token" key={token}>{token}</span>
              ))}
            </span>
          ) : null}
        </span>
      </Button>
      <PopupRowActions bookmarkId={row.bookmarkId} label={row.menuLabel} menu={row.menu} title="操作菜单" />
    </article>
  )
}

function PopupRowActions({
  bookmarkId,
  label,
  menu,
  title
}: {
  bookmarkId: string
  label: string
  menu: PopupActionMenuViewModel
  title?: string
}) {
  const quickActions = menu.items.filter((item) => {
    return ['edit', 'copy-url', 'open-current-tab', 'move', 'delete'].includes(item.action)
  })

  return (
    <div className="popup-row-actions" aria-label="书签快捷操作">
      {quickActions.map((item) => (
        <Button
          className={['row-action-button', item.danger ? 'danger' : ''].filter(Boolean).join(' ')}
          type="button"
          data-menu-action={item.action}
          data-bookmark-id={item.bookmarkId}
          aria-label={item.ariaLabel}
          title={item.label}
          disabled={item.disabled}
          key={`${item.bookmarkId}:${item.action}`}
          unstyled
        >
          <Icon name={getPopupActionIconName(item.action)} size={14} aria-hidden="true" />
        </Button>
      ))}
    </div>
  )
}

function getPopupActionIconName(action: string): IconName {
  if (action === 'edit') {
    return 'Pencil'
  }
  if (action === 'copy-url') {
    return 'Copy'
  }
  if (action === 'move') {
    return 'Move'
  }
  if (action === 'delete') {
    return 'Trash2'
  }
  return 'ExternalLink'
}

function PopupSmartClassifier({ state }: { state: PopupSmartClassifierViewModel }) {
  if (state.status === 'hidden') {
    return null
  }

  if (state.status === 'page-loading') {
    return <PopupSmartPageRevealCard page={state.page} loading />
  }

  if (state.status === 'loading') {
    return <PopupSmartLoading state={state} />
  }

  if (state.status === 'results') {
    return (
      <>
        <PopupSmartResult state={state} />
        <PopupSmartManualButton />
      </>
    )
  }

  if (state.status === 'error') {
    return (
      <>
        <PopupSmartPageCard page={state.page} />
        <div className="smart-panel-head smart-panel-head-standalone">
          <p>智能分类失败</p>
          <PopupSmartExitButton />
        </div>
        <div className="error-banner">{state.error || '智能分类失败，请稍后重试。'}</div>
        <Toolbar className="smart-actions smart-actions-three" unstyled>
          <Button className="smart-cancel-button" type="button" data-smart-action="manual-folder" unstyled>
            手动选择
          </Button>
          <Button className="smart-settings-action" type="button" data-smart-action="open-ai-settings" unstyled>
            AI 设置
          </Button>
          <Button className="smart-classify-button" type="button" data-smart-action="classify" unstyled>
            重试
          </Button>
        </Toolbar>
      </>
    )
  }

  if (state.status === 'permission') {
    return <PopupSmartPermission state={state} />
  }

  return <PopupSmartPageRevealCard page={state.page} loading={false} />
}

function PopupSmartPageCard({ page }: { page: PopupSmartPageViewModel | null }) {
  return (
    <article className={getPopupSmartPageCardClassName(page)}>
      <PopupSmartPageCardContent page={page} />
    </article>
  )
}

function PopupSmartPageRevealCard({
  loading,
  page
}: {
  loading: boolean
  page: PopupSmartPageViewModel | null
}) {
  return (
    <div
      className={['current-page-reveal-shell', 't-skel', loading ? 'is-loading' : 'is-revealed'].join(' ')}
      data-state={loading ? 'loading' : 'ready'}
      aria-busy={loading ? 'true' : 'false'}
      role={loading ? 'status' : undefined}
      aria-live="polite"
    >
      <div className="smart-page-card current-page-skeleton-card t-skel-skeleton is-pulsing" aria-hidden="true">
        <PopupSmartPageSkeletonContent />
      </div>
      <article className={[getPopupSmartPageCardClassName(page), 'current-page-card-content', 't-skel-content'].join(' ')}>
        <PopupSmartPageCardContent page={page} />
      </article>
    </div>
  )
}

function getPopupSmartPageCardClassName(page: PopupSmartPageViewModel | null) {
  return [
    'smart-page-card',
    page ? (page.bookmarked ? 'bookmarked' : 'unbookmarked') : 'current-page-placeholder'
  ].join(' ')
}

function PopupSmartPageCardContent({ page }: { page: PopupSmartPageViewModel | null }) {
  if (!page) {
    return <PopupSmartPagePlaceholderContent />
  }

  return (
    <>
      <div className="smart-page-main">
        <span className="smart-page-icon" aria-hidden="true">
          {page.favicon ? <img src={page.favicon} alt="" /> : page.fallbackIcon}
        </span>
        <div className="smart-page-copy">
          <p className="smart-page-title" title={page.title}>{page.title}</p>
          <p className="smart-page-status" title={page.statusTitle}>{page.status}</p>
        </div>
      </div>
      {page.bookmarked ? (
        <Toolbar className="current-page-actions" aria-label="当前页快捷操作" unstyled>
          <Button
            className={['current-page-action', 'primary', page.pinned ? 'pressed' : ''].filter(Boolean).join(' ')}
            type="button"
            data-current-page-action="pin-newtab"
            aria-pressed={page.pinned}
            disabled={page.pinPending}
            unstyled
          >
            {page.pinPending ? <PopupButtonLoadingLabel label={page.pinned ? '取消中' : '固定中'} /> : page.pinLabel}
          </Button>
          <Button className="current-page-action" type="button" data-current-page-action="edit" unstyled>
            编辑
          </Button>
        </Toolbar>
      ) : (
        <Toolbar className="current-page-actions" aria-label="当前页快捷操作" unstyled>
          <Button className="current-page-action primary" type="button" data-current-page-action="save" unstyled>
            快速保存
          </Button>
          <Button className="current-page-action" type="button" data-smart-action="classify" unstyled>
            智能分类
          </Button>
        </Toolbar>
      )}
    </>
  )
}

function PopupSmartPageSkeletonContent() {
  return (
    <>
      <div className="smart-page-main current-page-skeleton-main">
        <span className="popup-skeleton-dot current-page-skeleton-icon" aria-hidden="true"></span>
        <span className="current-page-skeleton-copy" aria-hidden="true">
          <span
            className="popup-skeleton-bar current-page-skeleton-title"
            style={{ '--skeleton-width': 0.64 } as CSSProperties}
          ></span>
          <span
            className="popup-skeleton-bar current-page-skeleton-status"
            style={{ '--skeleton-width': 0.86 } as CSSProperties}
          ></span>
        </span>
      </div>
      <span className="current-page-actions current-page-skeleton-actions" aria-hidden="true">
        <span className="popup-skeleton-bar current-page-skeleton-action"></span>
        <span className="popup-skeleton-bar current-page-skeleton-action secondary"></span>
      </span>
    </>
  )
}

function PopupSmartPagePlaceholderContent() {
  return (
    <>
      <div className="smart-page-main">
        <span className="smart-page-icon current-page-placeholder-icon" aria-hidden="true">
          <Icon name="PanelRight" size={15} />
        </span>
        <div className="smart-page-copy">
          <p className="smart-page-title">当前标签页</p>
          <p className="smart-page-status" title="打开网页后可快速保存或智能分类">
            打开网页后可快速保存或智能分类
          </p>
        </div>
      </div>
      <Toolbar className="current-page-actions is-placeholder" aria-label="当前页快捷操作" unstyled>
        <Button className="current-page-action primary" type="button" disabled unstyled>
          快速保存
        </Button>
        <Button className="current-page-action" type="button" disabled unstyled>
          智能分类
        </Button>
      </Toolbar>
    </>
  )
}

function PopupSmartExitButton() {
  return (
    <Button className="smart-exit-button" type="button" data-smart-action="exit" aria-label="退出智能分类" unstyled>
      退出
    </Button>
  )
}

function PopupSmartManualButton() {
  return (
    <Button className="smart-manual-button" type="button" data-smart-action="manual-folder" unstyled>
      <span className="smart-folder-icon" aria-hidden="true"></span>
      <span>手动选择文件夹</span>
    </Button>
  )
}

function PopupSmartPermission({ state }: { state: PopupSmartClassifierViewModel }) {
  return (
    <article className="smart-permission-card">
      <div className="smart-panel-head">
        <p>需要授权 AI 渠道</p>
        <PopupSmartExitButton />
      </div>
      <div className="smart-permission-body">
        <p className="smart-permission-copy">
          智能分类需要访问你配置的 AI 服务地址。当前网页不会申请额外权限，正文读取失败时会用标题和 URL 继续推荐。
        </p>
        {state.permissionOrigins.length ? (
          <div className="smart-permission-origins">
            {state.permissionOrigins.map((origin) => <span key={origin}>{origin}</span>)}
          </div>
        ) : null}
        {state.error ? <p className="smart-permission-error">{state.error}</p> : null}
      </div>
      <Toolbar className="smart-actions" unstyled>
        <Button className="smart-cancel-button" type="button" data-smart-action="manual-folder" unstyled>
          手动选择
        </Button>
        <Button className="smart-settings-action" type="button" data-smart-action="open-ai-settings" unstyled>
          AI 设置
        </Button>
        <Button className="smart-classify-button" type="button" data-smart-action="grant-permission" unstyled>
          授权并继续
        </Button>
      </Toolbar>
    </article>
  )
}

function PopupButtonLoadingLabel({ label }: { label: string }) {
  return (
    <span className="button-loading-label">
      <DotMatrixLoader variant="bar" className="button-dot-loader" />
      <span>{label}</span>
    </span>
  )
}

function PopupSmartLoading({ state }: { state: PopupSmartClassifierViewModel }) {
  return (
    <article className="smart-loading-card">
      <div className="smart-panel-head">
        <p>智能分类</p>
        <PopupSmartExitButton />
      </div>
      <div className="smart-loading-body">
        <DotMatrixLoader variant="spiral" className="smart-loading-loader" />
        <div className="smart-loading-content">
          <p className="smart-loading-copy">
            <span>{state.loadingLabel}</span>
            <small>{state.loadingStep}/{state.loadingStepCount}</small>
          </p>
          <Progress
            className="smart-progress-track"
            indicatorClassName="smart-progress-bar"
            indicatorProps={{ 'data-smart-progress-target': state.loadingProgress } as Record<string, string | number>}
            indicatorStyle={{ '--smart-progress-scale': state.loadingStartProgress / 100 } as CSSProperties}
            label="智能分类进度"
            value={state.loadingProgress}
            unstyled
          />
        </div>
      </div>
    </article>
  )
}

function PopupSmartResult({ state }: { state: PopupSmartClassifierViewModel }) {
  const canSave = Boolean(state.recommendations.length && !state.saving && !state.saved)

  return (
    <article className="smart-result-card">
      <div className="smart-panel-head">
        <p>推荐文件夹</p>
        <PopupSmartExitButton />
      </div>
      <div className="smart-title-row">
        <Input
          id="smart-title-input"
          className="smart-title-input"
          type="text"
          spellCheck={false}
          maxLength={180}
          defaultValue={state.suggestedTitle}
          aria-label="推荐书签标题"
        />
      </div>
      <p className="smart-section-label">推荐文件夹</p>
      <div className="smart-recommendations">
        {state.recommendations.length ? (
          state.recommendations.map((recommendation) => (
            <Button
              className={['smart-folder-option', recommendation.selected ? 'selected' : ''].filter(Boolean).join(' ')}
              type="button"
              data-smart-recommendation={recommendation.id}
              key={recommendation.id}
              unstyled
            >
              <span className="smart-folder-main">
                <span className="smart-folder-head">
                  <span className="smart-folder-icon" aria-hidden="true"></span>
                  <span className="smart-folder-name">{recommendation.title}</span>
                </span>
                <span className="smart-folder-path" title={recommendation.path}>{recommendation.path}</span>
              </span>
              <span className="smart-folder-meta">
                {recommendation.isNew ? <span className="smart-new-badge">新建</span> : null}
                {recommendation.selected ? <span className="smart-checkmark">{'\u2713'}</span> : null}
                <span>{recommendation.confidence}%</span>
              </span>
            </Button>
          ))
        ) : (
          <div className="state-panel compact">未生成可用推荐，请手动选择文件夹。</div>
        )}
      </div>
      <Toolbar className="smart-actions" unstyled>
        <Button className="smart-cancel-button" type="button" data-smart-action="reset" unstyled>
          取消
        </Button>
        <Button
          className={['smart-save-button', state.saved ? 'saved' : ''].filter(Boolean).join(' ')}
          type="button"
          data-smart-action="save"
          disabled={!canSave}
          unstyled
        >
          {state.saved ? '已保存' : state.saving ? <PopupButtonLoadingLabel label="保存中" /> : '确认保存'}
        </Button>
      </Toolbar>
    </article>
  )
}
