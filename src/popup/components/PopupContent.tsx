import type { CSSProperties } from 'react'
import { Button } from '../../ui/primitives/Button'
import { Icon, type IconName } from '../../ui/icons/Icon'
import { HighlightedText } from './HighlightedText'
import { PopupEmptyState } from './PopupEmptyState'
import type {
  PopupActionMenuViewModel,
  PopupContentBookmarkRowViewModel,
  PopupContentFolderRowViewModel,
  PopupContentMainRowViewModel,
  PopupContentSearchResultViewModel,
  PopupContentViewModel
} from './PopupViewModels'

export interface PopupContentActionHandlers {
  onBookmarkOpen?: (bookmarkId: string) => void
  onEmptyAction?: (action: string) => void
  onFolderFilter?: (folderId: string) => void
  onMenuAction?: (bookmarkId: string, action: string) => void
  onResultHover?: (index: number) => void
}

const POPUP_CONTENT_SKELETON_FOLDER_ROWS = [
  { depth: 0, width: 0.72, count: 0.34 },
  { depth: 1, width: 0.64, count: 0.26 },
  { depth: 1, width: 0.76, count: 0.22 },
  { depth: 2, width: 0.52, count: 0.3 },
  { depth: 1, width: 0.58, count: 0.24 },
  { depth: 2, width: 0.68, count: 0.2 },
  { depth: 2, width: 0.46, count: 0.28 },
  { depth: 1, width: 0.7, count: 0.18 }
] as const

const POPUP_CONTENT_SKELETON_BOOKMARK_ROWS = [
  { width: 0.78, url: 0.58, path: 0.36 },
  { width: 0.62, url: 0.74, path: 0.48 },
  { width: 0.86, url: 0.52, path: 0.42 },
  { width: 0.58, url: 0.68, path: 0.34 },
  { width: 0.74, url: 0.56, path: 0.5 }
] as const

export function PopupContent({
  handlers,
  state
}: {
  handlers?: PopupContentActionHandlers
  state: PopupContentViewModel
}) {
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
              {sidebarRows.map((row) => (
                <PopupFolderRow
                  onFolderFilter={handlers?.onFolderFilter}
                  row={row}
                  key={`folder:${row.folderId}`}
                />
              ))}
            </div>
          </aside>
          <section className="bookmark-main-pane" aria-label={title}>
            <header className="bookmark-pane-head bookmark-main-head">
              <span>{title}</span>
              <span className="bookmark-pane-meta">{meta}</span>
            </header>
            <ul className="bookmark-main-list" data-popup-main-list>
              {state.mainState ? (
                <PopupMainStatePanel onEmptyAction={handlers?.onEmptyAction} state={state.mainState} />
              ) : mainRows.length ? (
                mainRows.map((row) => {
                  if (row.kind === 'bookmark') {
                    return <PopupBookmarkRow handlers={handlers} row={row} key={`bookmark:${row.bookmarkId}`} />
                  }
                  return <PopupSearchResultRow handlers={handlers} row={row} key={`result:${row.bookmarkId}:${row.index}`} />
                })
              ) : (
                <li className="state-panel compact">{state.emptyLabel || '暂无可展示书签'}</li>
              )}
            </ul>
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
  return (
    <div className={['bookmark-workspace', `bookmark-workspace-${mode}`, 'bookmark-workspace-placeholder'].join(' ')}>
      <aside className="bookmark-sidebar" aria-label="文件夹树加载占位">
        <header className="bookmark-pane-head">
          <span>全部文件夹</span>
        </header>
        <div className="bookmark-folder-tree" role="presentation">
          {POPUP_CONTENT_SKELETON_FOLDER_ROWS.map((row, index) => (
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
          {POPUP_CONTENT_SKELETON_BOOKMARK_ROWS.map((row, index) => (
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
  onEmptyAction,
  state
}: {
  onEmptyAction?: (action: string) => void
  state: NonNullable<PopupContentViewModel['mainState']>
}) {
  if (state.kind === 'loading') {
    return (
      <li className="state-panel compact bookmark-main-state" aria-live="polite">
        <PopupMainLoadingSkeleton label={state.label || '正在搜索书签…'} />
      </li>
    )
  }

  if (state.kind === 'natural-setup' || state.kind === 'search-empty') {
    return (
      <li className="state-panel compact bookmark-main-state">
        <PopupEmptyState onAction={onEmptyAction} state={state.state || { kind: 'none' }} />
      </li>
    )
  }

  return (
    <li className="state-panel compact bookmark-main-state">
      {state.label || '暂无可展示书签'}
    </li>
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

function PopupFolderRow({
  onFolderFilter,
  row
}: {
  onFolderFilter?: (folderId: string) => void
  row: PopupContentFolderRowViewModel
}) {
  const style = { '--depth': row.depth } as CSSProperties

  return (
    <div className={['tree-row', 'folder-row', row.root ? 'root-folder-row' : '', row.active ? 'active' : ''].filter(Boolean).join(' ')} style={style}>
      <Button
        className={['folder-card', 'popup-list-row', 'sidebar-folder-card', row.root ? 'root-folder-card' : '', row.active ? 'active' : ''].filter(Boolean).join(' ')}
        type="button"
        data-sidebar-folder-filter={row.root ? 'all' : row.folderId}
        aria-current={row.active ? 'page' : undefined}
        title={row.subtitle}
        onClick={() => onFolderFilter?.(row.root ? 'all' : row.folderId)}
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

function PopupBookmarkRow({
  handlers,
  row
}: {
  handlers?: PopupContentActionHandlers
  row: PopupContentBookmarkRowViewModel
}) {
  const style = { '--depth': row.depth } as CSSProperties

  return (
    <li className="tree-row bookmark-row" style={style}>
      <Button
        className="bookmark-card popup-list-row"
        type="button"
        data-open-bookmark={row.bookmarkId}
        onClick={() => handlers?.onBookmarkOpen?.(row.bookmarkId)}
        unstyled
      >
        <span className="row-main">
          <span className="row-title">{row.title}</span>
          <span className="row-subtitle" title={row.url}>{row.displayUrl}</span>
          {row.path ? <span className="row-path" title={row.path}>{row.path}</span> : null}
        </span>
      </Button>
      <PopupRowActions
        bookmarkId={row.bookmarkId}
        label={row.menuLabel}
        menu={row.menu}
        onMenuAction={handlers?.onMenuAction}
      />
    </li>
  )
}

function PopupSearchResultRow({
  handlers,
  row
}: {
  handlers?: PopupContentActionHandlers
  row: PopupContentSearchResultViewModel
}) {
  return (
    <li
      className={['result-card', row.active ? 'active' : ''].filter(Boolean).join(' ')}
      data-result-index={row.index}
    >
      <Button
        className="result-main popup-list-row"
        type="button"
        data-open-bookmark={row.bookmarkId}
        onClick={() => handlers?.onBookmarkOpen?.(row.bookmarkId)}
        onPointerOver={() => handlers?.onResultHover?.(row.index)}
        unstyled
      >
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
      <PopupRowActions
        bookmarkId={row.bookmarkId}
        label={row.menuLabel}
        menu={row.menu}
        onMenuAction={handlers?.onMenuAction}
        title="操作菜单"
      />
    </li>
  )
}

function PopupRowActions({
  bookmarkId,
  label,
  menu,
  onMenuAction,
  title
}: {
  bookmarkId: string
  label: string
  menu: PopupActionMenuViewModel
  onMenuAction?: (bookmarkId: string, action: string) => void
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
          onClick={() => onMenuAction?.(item.bookmarkId, item.action)}
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
