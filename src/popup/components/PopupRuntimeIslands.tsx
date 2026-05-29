import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { CSSProperties, ReactNode } from 'react'
import { getQueryTerms, normalizeQuery } from '../search.js'
import { AiSetupPrompt, Button, DotMatrixLoader, InlineMenu, Input, ToastList } from '../../ui'

export interface PopupAutoAnalyzeStatusState {
  collapsed: boolean
  detail: string
  showHistory: boolean
  status: string | null
  title: string
}

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

export interface PopupLoadingStateViewModel {
  label: string
}

export interface PopupFilterFolderOptionViewModel {
  active: boolean
  id: string
  path: string
  selected: boolean
  title: string
  tooltip: string
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
  filterOptions?: PopupFilterFolderOptionViewModel[]
  mode: 'filter' | 'move' | 'smart' | 'edit'
  query: string
  treeOptions?: PopupFolderTreeOptionViewModel[]
}

export interface PopupToastViewModel {
  action: string
  actionLabel: string
  id: string
  message: string
  type: string
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
  title: string
  url: string
}

export interface PopupContentFolderRowViewModel {
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

export interface PopupContentViewModel {
  rows: PopupContentRowViewModel[]
}

export interface PopupSearchChipViewModel {
  kind: string
  label: string
}

export interface PopupSavedSearchItemViewModel {
  active: boolean
  id: string
  label: string
  query: string
}

export interface PopupSavedSearchesViewModel {
  canSaveCurrent: boolean
  error: string
  expanded: boolean
  hasCurrentSaved: boolean
  items: PopupSavedSearchItemViewModel[]
  show: boolean
}

export interface PopupBreadcrumbSegmentViewModel {
  current: boolean
  id: string
  label: string
  path: string
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

export function renderPopupAutoAnalyzeStatusIsland(
  container: Element,
  state: PopupAutoAnalyzeStatusState
): void {
  renderIsland(container, <PopupAutoAnalyzeStatus state={state} />)
}

export function renderPopupEmptyStateIsland(
  container: Element,
  state: PopupEmptyStateViewModel
): void {
  renderIsland(container, <PopupEmptyState state={state} />)
}

export function renderPopupLoadingStateIsland(
  container: Element,
  state: PopupLoadingStateViewModel
): void {
  renderIsland(container, <PopupLoadingState state={state} />)
}

export function renderPopupFolderPickerIsland(
  container: Element,
  state: PopupFolderPickerState
): void {
  renderIsland(container, <PopupFolderPicker state={state} />)
}

export function renderPopupToastsIsland(container: Element, toasts: PopupToastViewModel[]): void {
  renderIsland(container, <PopupToasts toasts={toasts} />)
}

export function renderPopupContentIsland(container: Element, state: PopupContentViewModel): void {
  renderIsland(container, <PopupContent state={state} />)
}

export function renderPopupSearchChipsIsland(container: Element, chips: PopupSearchChipViewModel[]): void {
  renderIsland(container, <PopupSearchChips chips={chips} />)
}

export function renderPopupSavedSearchesIsland(
  container: Element,
  state: PopupSavedSearchesViewModel
): void {
  renderIsland(container, <PopupSavedSearches state={state} />)
}

export function renderPopupBreadcrumbsIsland(
  container: Element,
  segments: PopupBreadcrumbSegmentViewModel[]
): void {
  renderIsland(container, <PopupBreadcrumbs segments={segments} />)
}

export function renderPopupSmartClassifierIsland(
  container: Element,
  state: PopupSmartClassifierViewModel
): void {
  renderIsland(container, <PopupSmartClassifier state={state} />)
}

function PopupAutoAnalyzeStatus({ state }: { state: PopupAutoAnalyzeStatusState }) {
  if (!state.status) {
    return null
  }

  return (
    <>
      <div className="auto-analyze-indicator" aria-hidden="true"></div>
      <div className="auto-analyze-copy" role="status">
        <p className="auto-analyze-title">{state.title}</p>
        <p className="auto-analyze-detail">{state.detail}</p>
      </div>
      <div className="auto-analyze-actions">
        {state.showHistory ? (
          <Button className="auto-analyze-action" type="button" data-auto-analyze-action="history" unstyled>
            查看
          </Button>
        ) : null}
        <Button
          className="auto-analyze-action ghost"
          type="button"
          data-auto-analyze-action="toggle"
          aria-expanded={state.collapsed ? 'false' : 'true'}
          unstyled
        >
          {state.collapsed ? '展开' : '折叠'}
        </Button>
        <Button
          className="auto-analyze-action ghost"
          type="button"
          data-auto-analyze-action="dismiss"
          aria-label="关闭自动分析状态"
          unstyled
        >
          关闭
        </Button>
      </div>
    </>
  )
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

function PopupLoadingState({ state }: { state: PopupLoadingStateViewModel }) {
  return (
    <span className="popup-loading-stack">
      <DotMatrixLoader variant="spiral" className="popup-loading-loader" />
      <span>{state.label}</span>
    </span>
  )
}

function PopupFolderPicker({ state }: { state: PopupFolderPickerState }) {
  if (state.mode === 'filter') {
    return <PopupFilterFolderPicker state={state} />
  }

  return <PopupTreeFolderPicker state={state} />
}

function PopupFilterFolderPicker({ state }: { state: PopupFolderPickerState }) {
  const options = state.filterOptions || []

  if (!options.length && state.empty) {
    return (
      <div className="modal-empty">
        <p className="modal-empty-title">{state.empty.title || '未找到相关文件夹'}</p>
        {state.empty.detail ? <p className="modal-empty-detail">{state.empty.detail}</p> : null}
        {state.empty.action ? (
          <Button
            className="secondary-button"
            type="button"
            data-filter-folder-action={state.empty.action}
            unstyled
          >
            {state.empty.actionLabel || '清空搜索'}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <>
      {options.map((option) => (
        <Button
          className={['filter-option', option.selected ? 'selected' : ''].filter(Boolean).join(' ')}
          type="button"
          role="option"
          aria-selected={option.selected ? 'true' : 'false'}
          data-select-filter-folder={option.id}
          tabIndex={option.active ? 0 : -1}
          title={option.tooltip}
          key={option.id}
          unstyled
        >
          <span className="filter-option-check" aria-hidden="true"></span>
          <span className="filter-option-copy">
            <span className="filter-option-title">
              <HighlightedText text={option.title} query={state.query} />
            </span>
            <span className="filter-option-path">
              <HighlightedText text={option.path} query={state.query} />
            </span>
          </span>
        </Button>
      ))}
    </>
  )
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
        <span className="folder-kind" aria-hidden="true"></span>
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

function PopupToasts({ toasts }: { toasts: PopupToastViewModel[] }) {
  return (
    <ToastList
      actionClassName="toast-action"
      closeClassName="toast-dismiss"
      closeLabel="关闭"
      contentClassName="toast-copy"
      descriptionClassName="toast-message"
      items={toasts.map((toast) => ({
        action: toast.action,
        actionLabel: toast.actionLabel || '操作',
        description: toast.message,
        id: toast.id,
        priority: toast.type === 'error' ? 'high' : 'low',
        type: toast.type
      }))}
      rootClassName="toast"
      timeout={0}
      unstyled
    />
  )
}

function PopupContent({ state }: { state: PopupContentViewModel }) {
  return (
    <>
      {state.rows.map((row) => {
        if (row.kind === 'folder') {
          return <PopupFolderRow row={row} key={`folder:${row.folderId}`} />
        }
        if (row.kind === 'bookmark') {
          return <PopupBookmarkRow row={row} key={`bookmark:${row.bookmarkId}`} />
        }
        return <PopupSearchResultRow row={row} key={`result:${row.bookmarkId}:${row.index}`} />
      })}
    </>
  )
}

function PopupFolderRow({ row }: { row: PopupContentFolderRowViewModel }) {
  const style = { '--depth': row.depth } as CSSProperties

  return (
    <div className={['tree-row', 'folder-row', row.root ? 'root-folder-row' : ''].filter(Boolean).join(' ')} style={style}>
      {row.root ? (
        <span className="tree-toggle-spacer" aria-hidden="true"></span>
      ) : (
        <Button
          className={['tree-toggle', row.expanded ? 'expanded' : ''].filter(Boolean).join(' ')}
          type="button"
          data-toggle-folder={row.folderId}
          aria-label={row.toggleLabel}
          unstyled
        ></Button>
      )}
      {row.root ? (
        <div className="folder-card root-folder-card">
          <span className="folder-kind" aria-hidden="true"></span>
          <span className="row-main">
            <span className="row-title">{row.title}</span>
            <span className="row-subtitle">{row.subtitle}</span>
          </span>
        </div>
      ) : (
        <Button
          className="folder-card"
          type="button"
          data-toggle-folder={row.folderId}
          aria-expanded={row.expanded}
          unstyled
        >
          <span className="folder-kind" aria-hidden="true"></span>
          <span className="row-main">
            <span className="row-title">{row.title}</span>
            <span className="row-subtitle">{row.subtitle}</span>
          </span>
        </Button>
      )}
    </div>
  )
}

function PopupBookmarkRow({ row }: { row: PopupContentBookmarkRowViewModel }) {
  const style = { '--depth': row.depth } as CSSProperties

  return (
    <div className="tree-row bookmark-row" style={style}>
      <Button className="bookmark-card" type="button" data-open-bookmark={row.bookmarkId} unstyled>
        <span className="bookmark-kind" aria-hidden="true"></span>
        <span className="row-main">
          <span className="row-title">{row.title}</span>
          <span className="row-subtitle" title={row.url}>{row.displayUrl}</span>
        </span>
      </Button>
      <PopupActionMenuAnchor bookmarkId={row.bookmarkId} label={row.menuLabel} menu={row.menu} />
    </div>
  )
}

function PopupSearchResultRow({ row }: { row: PopupContentSearchResultViewModel }) {
  return (
    <article className={['result-card', row.active ? 'active' : ''].filter(Boolean).join(' ')} data-result-index={row.index}>
      <Button className="result-main" type="button" data-open-bookmark={row.bookmarkId} unstyled>
        <span className="bookmark-kind" aria-hidden="true"></span>
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
      <PopupActionMenuAnchor bookmarkId={row.bookmarkId} label={row.menuLabel} menu={row.menu} title="操作菜单" />
    </article>
  )
}

function PopupActionMenuAnchor({
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
  const trigger = (
    <Button
      className="icon-button"
      type="button"
      data-open-menu={bookmarkId}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={menu.open}
      aria-controls={menu.id}
      title={title}
      unstyled
    ></Button>
  )

  return (
    <div className="menu-anchor">
      <InlineMenu
        id={menu.id}
        className="action-menu"
        label="书签操作"
        open={menu.open}
        trigger={trigger}
        actions={menu.items.map((item) => ({
          id: item.action,
          label: item.label,
          disabled: item.disabled,
          destructive: item.danger,
          attributes: {
            'data-menu-action': item.action,
            'data-bookmark-id': item.bookmarkId,
            'aria-label': item.ariaLabel
          }
        }))}
      />
    </div>
  )
}

function PopupSearchChips({ chips }: { chips: PopupSearchChipViewModel[] }) {
  return (
    <>
      {chips.map((chip) => (
        <span className={['search-filter-chip', chip.kind].filter(Boolean).join(' ')} key={`${chip.kind}:${chip.label}`}>
          {chip.label}
        </span>
      ))}
    </>
  )
}

function PopupSavedSearches({ state }: { state: PopupSavedSearchesViewModel }) {
  if (!state.show) {
    return null
  }

  const visibleItems = state.items.slice(0, 6)

  return (
    <>
      <div className="saved-search-head">
        {state.items.length ? (
          <Button
            className="saved-search-toggle"
            type="button"
            data-saved-search-action="toggle"
            aria-expanded={state.expanded}
            aria-controls="saved-searches-list"
            unstyled
          >
            <span className="saved-search-toggle-label">已保存 {state.items.length}</span>
            <span className="saved-search-toggle-icon" aria-hidden="true"></span>
          </Button>
        ) : (
          <span className="saved-search-status">暂无保存项</span>
        )}
        {state.canSaveCurrent ? (
          <Button
            className="saved-search-save"
            type="button"
            data-saved-search-action="save-current"
            disabled={state.hasCurrentSaved}
            aria-label={state.hasCurrentSaved ? '当前搜索已保存' : '保存当前搜索'}
            unstyled
          >
            {state.hasCurrentSaved ? '已保存' : '保存当前搜索'}
          </Button>
        ) : null}
      </div>
      {state.error ? <span className="saved-search-status error">{state.error}</span> : null}
      {state.expanded && visibleItems.length ? (
        <div id="saved-searches-list" className="saved-search-list">
          {visibleItems.map((item) => (
            <span className={['saved-search-chip', item.active ? 'active' : ''].filter(Boolean).join(' ')} key={item.id}>
              <Button
                className="saved-search-apply"
                type="button"
                data-saved-search-action="apply"
                data-saved-search-id={item.id}
                title={item.query}
                unstyled
              >
                {item.label}
              </Button>
              <Button
                className="saved-search-delete"
                type="button"
                data-saved-search-action="delete"
                data-saved-search-id={item.id}
                aria-label={`删除保存搜索：${item.label}`}
                unstyled
              >
                {'\u00d7'}
              </Button>
            </span>
          ))}
        </div>
      ) : null}
    </>
  )
}

function PopupBreadcrumbs({ segments }: { segments: PopupBreadcrumbSegmentViewModel[] }) {
  if (!segments.length) {
    return null
  }

  return (
    <ol className="folder-breadcrumb-list">
      {segments.map((segment, index) => (
        <FragmentWithSeparator index={index} key={`${segment.id || 'current'}:${index}`}>
          {segment.current || !segment.id ? (
            <span className="folder-breadcrumb-current" aria-current="page" title={segment.path}>
              {segment.label}
            </span>
          ) : (
            <Button
              className="folder-breadcrumb-link"
              type="button"
              data-folder-breadcrumb-id={segment.id}
              title={segment.path}
              unstyled
            >
              {segment.label}
            </Button>
          )}
        </FragmentWithSeparator>
      ))}
    </ol>
  )
}

function FragmentWithSeparator({
  children,
  index
}: {
  children: ReactNode
  index: number
}) {
  return (
    <>
      {index > 0 ? <li className="folder-breadcrumb-separator" aria-hidden="true">&gt;</li> : null}
      <li>{children}</li>
    </>
  )
}

function PopupSmartClassifier({ state }: { state: PopupSmartClassifierViewModel }) {
  if (state.status === 'hidden') {
    return null
  }

  if (state.status === 'page-loading') {
    return (
      <div className="state-panel">
        <PopupLoadingState state={{ label: '正在读取当前网页…' }} />
      </div>
    )
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
        <div className="smart-actions smart-actions-three">
          <Button className="smart-cancel-button" type="button" data-smart-action="manual-folder" unstyled>
            手动选择
          </Button>
          <Button className="smart-settings-action" type="button" data-smart-action="open-ai-settings" unstyled>
            AI 设置
          </Button>
          <Button className="smart-classify-button" type="button" data-smart-action="classify" unstyled>
            重试
          </Button>
        </div>
      </>
    )
  }

  if (state.status === 'permission') {
    return <PopupSmartPermission state={state} />
  }

  return <PopupSmartPageCard page={state.page} />
}

function PopupSmartPageCard({ page }: { page: PopupSmartPageViewModel | null }) {
  if (!page) {
    return null
  }

  return (
    <article className={['smart-page-card', page.bookmarked ? 'bookmarked' : 'unbookmarked'].join(' ')}>
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
        <div className="current-page-actions" aria-label="当前页快捷操作">
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
        </div>
      ) : (
        <div className="current-page-actions" aria-label="当前页快捷操作">
          <Button className="current-page-action primary" type="button" data-current-page-action="save" unstyled>
            快速保存
          </Button>
          <Button className="current-page-action" type="button" data-smart-action="classify" unstyled>
            智能分类
          </Button>
        </div>
      )}
    </article>
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
      <div className="smart-actions">
        <Button className="smart-cancel-button" type="button" data-smart-action="manual-folder" unstyled>
          手动选择
        </Button>
        <Button className="smart-settings-action" type="button" data-smart-action="open-ai-settings" unstyled>
          AI 设置
        </Button>
        <Button className="smart-classify-button" type="button" data-smart-action="grant-permission" unstyled>
          授权并继续
        </Button>
      </div>
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
          <div className="smart-progress-track" aria-hidden="true">
            <span
              className="smart-progress-bar"
              data-smart-progress-target={state.loadingProgress}
              style={{ '--smart-progress-scale': state.loadingStartProgress / 100 } as CSSProperties}
            ></span>
          </div>
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
      <div className="smart-actions">
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
      </div>
    </article>
  )
}
