import { memo, useState, type CSSProperties, type RefObject } from 'react'
import { Button } from '../../ui/base/Button'
import { NumberPop } from '../../ui/motion/NumberPop'
import { Icon, type IconName } from '../../ui/icons/Icon'
import { cx } from '../../ui/base/utils'
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
  onMenuAction?: (bookmarkId: string, action: string, returnFocusElement?: HTMLElement | null) => void
  onResultHover?: (index: number) => void
}

export interface PopupActiveResultIndicatorState {
  style: CSSProperties
  visible: boolean
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
  { title: '44px', url: '66px', path: '94px' },
  { title: '16px', url: '36px', path: '94px' },
  { title: '62px', url: '72px', path: '94px' },
  { title: '48px', url: '56px', path: '94px' },
  { title: '74px', url: '68px', path: '94px' }
] as const
const POPUP_CONTENT_SKELETON_ACTION_COUNT = 5

const workspaceShellClass =
  'relative h-full min-h-0'
const workspaceLayerClass = 'absolute inset-0 min-h-0'
const workspaceSkeletonLayerClass = cx(
  workspaceLayerClass,
  'z-[1] opacity-100 [will-change:opacity,filter] transition-[opacity,filter] duration-[var(--reveal-dur)] ease-[var(--reveal-ease)] motion-reduce:transition-none',
  '[&>*]:animate-[popup-skeleton-pulse_var(--pulse-dur)_ease-in-out_var(--pulse-count)] motion-reduce:[&>*]:animate-none'
)
const workspaceSkeletonHiddenClass = 'pointer-events-none opacity-0 blur-[var(--reveal-blur)]'
const workspaceContentLayerClass = cx(
  workspaceLayerClass,
  'z-[2] opacity-0 [will-change:opacity,filter] transition-[opacity,filter] duration-[var(--reveal-dur)] ease-[var(--reveal-ease)] motion-reduce:transition-none'
)
const workspaceContentLoadingClass = 'pointer-events-none blur-[var(--reveal-blur)]'
const workspaceContentReadyClass = 'opacity-100'
const workspaceClass =
  'relative grid h-full min-h-0 grid-cols-[221px_minmax(0,1fr)] gap-2.5 max-[620px]:grid-cols-[minmax(0,1fr)] max-[620px]:grid-rows-[minmax(108px,36%)_minmax(0,1fr)]'
const workspacePlaceholderClass = 'pointer-events-none'
const paneClass =
  'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-ds-md border-0 bg-ds-surface-1'
const mainPaneClass = cx(paneClass, 'bg-ds-surface-1')
const paneHeaderClass =
  'flex min-h-[42px] flex-none items-center justify-between gap-2.5 border-b border-ds-border px-[13px] text-xs font-[760] text-ds-text-primary'
const paneTitleMetaClass = 'font-medium text-ds-text-muted'
const folderTreeClass =
  'min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-[6px_5px] [scrollbar-color:var(--ds-border-hover)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]'
const mainListClass =
  'relative m-0 min-h-0 flex-1 list-none overflow-x-hidden overflow-y-auto p-[8px_9px] [scrollbar-color:var(--ds-border-hover)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]'
const folderRowClass = 'relative block min-h-[34px]'
const mainRowClass =
  'popup-main-row relative z-[1] grid min-h-[74px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-t border-[rgba(38,40,46,0.72)] py-1.5 first:border-t-0 max-[430px]:grid-cols-[minmax(0,1fr)] max-[430px]:gap-1.5'
const activeResultIndicatorClass = 'popup-active-result-indicator'
const folderCardClass = [
  'relative grid min-h-[34px] w-full min-w-0 grid-cols-[12px_minmax(0,1fr)_max-content] items-center gap-[7px] rounded-ds-sm border border-transparent bg-transparent py-1.5 pr-2 pl-2 text-left text-ds-text-primary outline-none',
  'transition-[border-color,background,color,transform] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1 active:scale-[0.993]'
].join(' ')
const folderCardActiveClass =
  'border-ds-border-hover bg-ds-text-primary/[0.055] before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[2px] before:rounded-full before:bg-ds-text-primary/70 before:content-[""]'
const folderBranchClass =
  'relative inline-grid h-2.5 w-2.5 flex-none place-items-center justify-self-center rounded-bl-[4px] border-b border-l border-b-white/20 border-l-white/20 bg-transparent text-ds-text-secondary'
const rootFolderBranchClass = 'rounded-full border border-white/30'
const folderMainClass =
  'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-[7px]'
const folderTitleClass =
  'min-w-0 truncate text-left text-xs font-bold leading-tight text-ds-text-primary'
const folderCountClass =
  'min-w-0 justify-self-end bg-transparent p-0 text-right text-[11px] font-semibold leading-tight text-ds-text-disabled [font-variant-numeric:tabular-nums]'
const folderCountActiveClass = 'text-ds-text-secondary'
const listButtonClass = [
  'popup-list-button flex min-h-[58px] w-full min-w-0 items-start gap-2.5 rounded-md border border-transparent bg-transparent text-left text-ds-text-primary outline-none',
  'transition-[border-color,background,color,transform] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1 active:scale-[0.993]'
].join(' ')
const listButtonBaseStyle: CSSProperties = {
  padding: '8px 13px'
}
const rowMainClass = 'grid min-w-0 gap-0.5'
const rowTitleClass =
  'min-w-0 truncate text-left text-[13px] font-[760] leading-tight text-ds-text-primary'
const rowSubtitleClass =
  'min-w-0 truncate text-left text-xs font-medium leading-tight text-ds-text-muted'
const rowPathClass = cx(rowSubtitleClass, 'text-ds-text-muted')
const resultCopyClass = 'grid min-w-0 gap-0.5'
const resultPathShellClass = 'block min-w-0'
const resultMatchReasonsClass = 'mt-0.5 flex flex-wrap gap-1'
const resultMatchTokenClass =
  'inline-flex min-h-[18px] items-center rounded-[5px] border border-ds-border bg-ds-surface-2 px-1.5 text-[10px] font-semibold text-ds-text-secondary'
const rowActionsClass = 'popup-row-actions t-resize'
const rowActionRailClass = 'popup-row-actions-menu'
const rowActionButtonClass = [
  'inline-flex h-7 w-7 flex-none items-center justify-center rounded-md border border-ds-border-hover bg-ds-surface-3 text-ds-text-primary outline-none',
  'transition-[border-color,background,color,transform,opacity] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-surface-3 focus-visible:border-ds-border-hover focus-visible:bg-ds-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1',
  'active:scale-95 disabled:cursor-default disabled:opacity-45'
].join(' ')
const rowActionTriggerClass = cx(rowActionButtonClass, 'popup-row-actions-trigger')
const rowActionDangerClass =
  'hover:border-[rgba(255,138,130,0.42)] hover:text-ds-danger-text focus-visible:border-[rgba(255,138,130,0.42)] focus-visible:text-ds-danger-text'
const compactStateClass =
  'grid min-h-[90px] place-items-center px-4 py-3 text-center text-xs leading-[1.55] text-ds-text-muted'
const mainStateClass = cx(compactStateClass, 'min-h-full p-[18px]')
const skeletonBarBaseClass =
  'relative overflow-hidden rounded-full bg-[rgba(255,255,255,0.055)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.018)] before:absolute before:inset-y-0 before:left-0 before:w-3/5 before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.095),transparent)] before:animate-[popup-skeleton-sheen_1500ms_ease-in-out_infinite] before:will-change-transform motion-reduce:before:animate-none'
const skeletonBarClass = cx(
  skeletonBarBaseClass,
  'block h-[9px] w-[calc(var(--skeleton-width,0.7)*100%)]'
)
const skeletonTextBarClass = cx(skeletonBarBaseClass, 'block max-w-full')
const skeletonDotClass =
  'relative block h-7 w-7 overflow-hidden rounded-md bg-[rgba(255,255,255,0.055)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.018)] before:absolute before:inset-y-0 before:left-0 before:w-3/5 before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.095),transparent)] before:animate-[popup-skeleton-sheen_1500ms_ease-in-out_infinite] before:will-change-transform motion-reduce:before:animate-none'
const skeletonFolderTitleClass = cx(skeletonBarClass, 'min-w-[54px]')
const skeletonFolderCountClass =
  cx(skeletonBarClass, 'max-w-[30px] min-w-4 justify-self-end')
const skeletonHeaderMetaClass = cx(skeletonBarBaseClass, 'inline-block h-[7px] w-[68px] align-[1px]')
const skeletonBookmarkTitleClass = cx(skeletonTextBarClass, 'h-2')
const skeletonBookmarkUrlClass = cx(skeletonTextBarClass, 'h-[6px] opacity-75')
const skeletonBookmarkPathClass = cx(skeletonTextBarClass, 'h-[6px] opacity-60')
const skeletonBookmarkTitleLineClass = cx(rowTitleClass, 'flex h-4 items-center')
const skeletonBookmarkSubtitleLineClass = cx(rowSubtitleClass, 'flex h-[15px] items-center')
const skeletonBookmarkPathLineClass = cx(rowPathClass, 'flex h-[15px] items-center')
const skeletonActionButtonClass = skeletonDotClass
const searchSkeletonClass = 'grid w-[min(100%,390px)] gap-3 self-stretch'
const searchSkeletonRowClass = 'grid gap-2 rounded-md bg-ds-text-primary/[0.018] px-[9px] py-2'

function getFolderDepthStyle(depth: number): CSSProperties {
  const normalizedDepth = Math.max(0, Number(depth) || 0)
  return { paddingLeft: `${8 + normalizedDepth * 16}px` }
}

function getBookmarkButtonStyle(): CSSProperties {
  return listButtonBaseStyle
}

export function PopupContent({
  activeResultIndicator,
  activeResultRef,
  activeFolderRef,
  folderTreeRef,
  workspaceRef,
  handlers,
  mainListRef,
  state
}: {
  activeResultIndicator?: PopupActiveResultIndicatorState
  activeResultRef?: RefObject<HTMLLIElement | null>
  activeFolderRef?: RefObject<HTMLDivElement | null>
  folderTreeRef?: RefObject<HTMLDivElement | null>
  workspaceRef?: RefObject<HTMLDivElement | null>
  handlers?: PopupContentActionHandlers
  mainListRef?: RefObject<HTMLUListElement | null>
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
      className={workspaceShellClass}
      data-state={isLoading ? 'loading' : 'ready'}
      aria-busy={isLoading ? 'true' : 'false'}
    >
      <div className={cx(workspaceSkeletonLayerClass, isLoading ? '' : workspaceSkeletonHiddenClass)} aria-hidden="true">
        <PopupContentSkeleton mode={mode} title={title} />
      </div>
      <div className={cx(workspaceContentLayerClass, isLoading ? workspaceContentLoadingClass : workspaceContentReadyClass)}>
        <div className={workspaceClass} ref={workspaceRef}>
          <aside className={paneClass} aria-label="文件夹树">
            <header className={paneHeaderClass}>
              <span>全部文件夹</span>
            </header>
            <div className={folderTreeClass} role="tree" ref={folderTreeRef}>
              {sidebarRows.map((row) => (
                <PopupFolderRow
                  activeFolderRef={row.keyboardActive ? activeFolderRef : undefined}
                  onFolderFilter={handlers?.onFolderFilter}
                  row={row}
                  key={`folder:${row.folderId}`}
                />
              ))}
            </div>
          </aside>
          <section className={mainPaneClass} aria-label={title}>
            <header className={paneHeaderClass}>
              <span>{title} <span className={paneTitleMetaClass}>· <NumberPop text={meta} /></span></span>
            </header>
            <ul className={mainListClass} ref={mainListRef}>
              {state.mainState ? (
                <PopupMainStatePanel onEmptyAction={handlers?.onEmptyAction} state={state.mainState} />
              ) : mainRows.length ? (
                mainRows.map((row) => {
                  if (row.kind === 'bookmark') {
                    return <MemoPopupBookmarkRow activeResultRef={activeResultRef} handlers={handlers} row={row} key={`bookmark:${row.bookmarkId}`} />
                  }
                  return <MemoPopupSearchResultRow activeResultRef={activeResultRef} handlers={handlers} row={row} key={`result:${row.bookmarkId}:${row.index}`} />
                })
              ) : (
                <li className={compactStateClass}>{state.emptyLabel || '暂无可展示书签'}</li>
              )}
            </ul>
          </section>
          {/* Workspace-level indicator — slides freely across both panes */}
          <div
            className={activeResultIndicatorClass}
            aria-hidden="true"
            data-visible={activeResultIndicator?.visible ? 'true' : undefined}
            role="presentation"
            style={activeResultIndicator?.style}
          ></div>
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
    <div className={cx(workspaceClass, workspacePlaceholderClass)}>
      <aside className={paneClass} aria-label="文件夹树加载占位">
        <header className={paneHeaderClass}>
          <span>全部文件夹</span>
        </header>
        <div className={folderTreeClass} role="presentation">
          {POPUP_CONTENT_SKELETON_FOLDER_ROWS.map((row, index) => (
            <div
              className={folderRowClass}
              style={{ '--depth': row.depth } as CSSProperties}
              key={`folder-skeleton:${index}`}
            >
              <div className={cx(folderCardClass, 'cursor-default')} style={getFolderDepthStyle(row.depth)}>
                <span className={folderBranchClass} aria-hidden="true"></span>
                <span className={folderMainClass}>
                  <span className={skeletonFolderTitleClass} style={{ '--skeleton-width': row.width } as CSSProperties}></span>
                  <span className={skeletonFolderCountClass} style={{ '--skeleton-width': row.count } as CSSProperties}></span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <section className={mainPaneClass} aria-label={`${title}加载占位`}>
        <header className={paneHeaderClass}>
          <span>
            {title}{' '}
            <span className={paneTitleMetaClass}>
              · <span className={skeletonHeaderMetaClass}></span>
            </span>
          </span>
        </header>
        <ul className={mainListClass} role="presentation">
          {POPUP_CONTENT_SKELETON_BOOKMARK_ROWS.map((row) => (
            <li
              className={mainRowClass}
              key={`bookmark-skeleton:${row.title}:${row.url}:${row.path}`}
            >
              <div className={cx(listButtonClass, 'cursor-default')} style={getBookmarkButtonStyle()}>
                <span className={rowMainClass}>
                  <span className={skeletonBookmarkTitleLineClass}>
                    <span className={skeletonBookmarkTitleClass} style={{ width: row.title }}></span>
                  </span>
                  <span className={skeletonBookmarkSubtitleLineClass}>
                    <span className={skeletonBookmarkUrlClass} style={{ width: row.url }}></span>
                  </span>
                  <span className={skeletonBookmarkPathLineClass}>
                    <span className={skeletonBookmarkPathClass} style={{ width: row.path }}></span>
                  </span>
                </span>
              </div>
              <PopupSkeletonRowActions expanded={false} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function PopupSkeletonRowActions({ expanded }: { expanded: boolean }) {
  return (
    <div
      className={cx(rowActionsClass, 'opacity-80')}
      data-active={expanded ? 'true' : undefined}
      data-open={expanded ? 'true' : 'false'}
    >
      <div className={rowActionRailClass}>
        {Array.from({ length: POPUP_CONTENT_SKELETON_ACTION_COUNT }, (_, index) => (
          <span className={skeletonActionButtonClass} key={`bookmark-skeleton-action:${index}`}></span>
        ))}
      </div>
      <span className={cx(skeletonActionButtonClass, 'popup-row-actions-trigger')}></span>
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
      <li className={mainStateClass} aria-live="polite">
        <PopupMainLoadingSkeleton label={state.label || '正在搜索书签…'} />
      </li>
    )
  }

  if (state.kind === 'natural-setup' || state.kind === 'search-empty') {
    return (
      <li className={mainStateClass}>
        <PopupEmptyState onAction={onEmptyAction} state={state.state || { kind: 'none' }} />
      </li>
    )
  }

  return (
    <li className={mainStateClass}>
      {state.label || '暂无可展示书签'}
    </li>
  )
}

function PopupMainLoadingSkeleton({ label }: { label: string }) {
  return (
    <div className={searchSkeletonClass} aria-label={label}>
      {[0.82, 0.66, 0.74].map((width, index) => (
        <div className={searchSkeletonRowClass} key={`search-skeleton:${index}`}>
          <span className={skeletonBookmarkTitleClass} style={{ '--skeleton-width': width } as CSSProperties}></span>
          <span className={skeletonBookmarkUrlClass} style={{ '--skeleton-width': 0.46 + index * 0.08 } as CSSProperties}></span>
        </div>
      ))}
    </div>
  )
}

function PopupFolderRow({
  activeFolderRef,
  onFolderFilter,
  row
}: {
  activeFolderRef?: RefObject<HTMLDivElement | null>
  onFolderFilter?: (folderId: string) => void
  row: PopupContentFolderRowViewModel
}) {
  const style = { '--depth': row.depth } as CSSProperties

  return (
    <div className={folderRowClass} style={style} ref={activeFolderRef}>
      <Button
        className={cx(folderCardClass, row.active ? folderCardActiveClass : '')}
        type="button"
        style={getFolderDepthStyle(row.depth)}
        aria-current={row.active ? 'page' : undefined}
        title={row.subtitle}
        onClick={() => onFolderFilter?.(row.root ? 'all' : row.folderId)}
        unstyled
      >
        <span className={cx(folderBranchClass, row.root ? rootFolderBranchClass : '')} aria-hidden="true"></span>
        <span className={folderMainClass}>
          <span className={folderTitleClass}>{row.title}</span>
          <span className={cx(folderCountClass, row.active ? folderCountActiveClass : '')} title={`${row.countLabel} 个书签`}>
            <NumberPop text={row.countLabel} />
          </span>
        </span>
      </Button>
    </div>
  )
}

function PopupBookmarkRow({
  activeResultRef,
  handlers,
  row
}: {
  activeResultRef?: RefObject<HTMLLIElement | null>
  handlers?: PopupContentActionHandlers
  row: PopupContentBookmarkRowViewModel
}) {
  const style = { '--depth': row.depth } as CSSProperties

  return (
    <li
      className={mainRowClass}
      data-active={row.active ? 'true' : undefined}
      ref={row.active ? activeResultRef : undefined}
      style={style}
    >
      <Button
        className={listButtonClass}
        type="button"
        data-active={row.active ? 'true' : undefined}
        style={getBookmarkButtonStyle()}
        onClick={() => handlers?.onBookmarkOpen?.(row.bookmarkId)}
        unstyled
      >
        <span className={rowMainClass}>
          <span className={rowTitleClass}>{row.title}</span>
          <span className={rowSubtitleClass} title={row.url}>{row.displayUrl}</span>
          {row.path ? <span className={rowPathClass} title={row.path}>{row.path}</span> : null}
        </span>
      </Button>
      <PopupRowActions
        active={row.active}
        bookmarkId={row.bookmarkId}
        label={row.menuLabel}
        menu={row.menu}
        onMenuAction={handlers?.onMenuAction}
      />
    </li>
  )
}

function PopupSearchResultRow({
  activeResultRef,
  handlers,
  row
}: {
  activeResultRef?: RefObject<HTMLLIElement | null>
  handlers?: PopupContentActionHandlers
  row: PopupContentSearchResultViewModel
}) {
  return (
    <li
      className={mainRowClass}
      data-active={row.active ? 'true' : undefined}
      ref={row.active ? activeResultRef : undefined}
    >
      <Button
        className={listButtonClass}
        type="button"
        data-active={row.active ? 'true' : undefined}
        style={getBookmarkButtonStyle()}
        onClick={() => handlers?.onBookmarkOpen?.(row.bookmarkId)}
        onPointerOver={() => handlers?.onResultHover?.(row.index)}
        unstyled
      >
        <span className={resultCopyClass}>
          <span className={rowTitleClass}>
            <HighlightedText text={row.title} query={row.highlightQuery} />
          </span>
          <span className={rowSubtitleClass} title={row.url}>
            <HighlightedText text={row.displayUrl} query={row.highlightQuery} />
          </span>
          <span className={resultPathShellClass}>
            <span className={rowPathClass} title={row.path}>{row.path}</span>
          </span>
          {row.reasonTokens.length ? (
            <span className={resultMatchReasonsClass} title={row.reasonTitle} aria-label={row.reasonLabel}>
              {row.reasonTokens.map((token) => (
                <span className={resultMatchTokenClass} key={token}>{token}</span>
              ))}
            </span>
          ) : null}
        </span>
      </Button>
      <PopupRowActions
        active={row.active}
        bookmarkId={row.bookmarkId}
        label={row.menuLabel}
        menu={row.menu}
        onMenuAction={handlers?.onMenuAction}
        title="操作菜单"
      />
    </li>
  )
}

const MemoPopupBookmarkRow = memo(PopupBookmarkRow, arePopupBookmarkRowPropsEqual)
const MemoPopupSearchResultRow = memo(PopupSearchResultRow, arePopupSearchResultRowPropsEqual)

function arePopupBookmarkRowPropsEqual(
  previous: {
    activeResultRef?: RefObject<HTMLLIElement | null>
    handlers?: PopupContentActionHandlers
    row: PopupContentBookmarkRowViewModel
  },
  next: {
    activeResultRef?: RefObject<HTMLLIElement | null>
    handlers?: PopupContentActionHandlers
    row: PopupContentBookmarkRowViewModel
  }
) {
  return previous.activeResultRef === next.activeResultRef &&
    previous.handlers === next.handlers &&
    areBookmarkRowsEqual(previous.row, next.row)
}

function arePopupSearchResultRowPropsEqual(
  previous: {
    activeResultRef?: RefObject<HTMLLIElement | null>
    handlers?: PopupContentActionHandlers
    row: PopupContentSearchResultViewModel
  },
  next: {
    activeResultRef?: RefObject<HTMLLIElement | null>
    handlers?: PopupContentActionHandlers
    row: PopupContentSearchResultViewModel
  }
) {
  return previous.activeResultRef === next.activeResultRef &&
    previous.handlers === next.handlers &&
    areSearchResultRowsEqual(previous.row, next.row)
}

function areBookmarkRowsEqual(
  previous: PopupContentBookmarkRowViewModel,
  next: PopupContentBookmarkRowViewModel
) {
  return Boolean(previous.active) === Boolean(next.active) &&
    previous.bookmarkId === next.bookmarkId &&
    previous.depth === next.depth &&
    previous.displayUrl === next.displayUrl &&
    previous.menuLabel === next.menuLabel &&
    previous.path === next.path &&
    previous.title === next.title &&
    previous.url === next.url &&
    areActionMenusEqual(previous.menu, next.menu)
}

function areSearchResultRowsEqual(
  previous: PopupContentSearchResultViewModel,
  next: PopupContentSearchResultViewModel
) {
  return previous.active === next.active &&
    previous.bookmarkId === next.bookmarkId &&
    previous.depth === next.depth &&
    previous.displayUrl === next.displayUrl &&
    previous.highlightQuery === next.highlightQuery &&
    previous.index === next.index &&
    previous.menuLabel === next.menuLabel &&
    previous.path === next.path &&
    previous.reasonLabel === next.reasonLabel &&
    previous.reasonTitle === next.reasonTitle &&
    previous.title === next.title &&
    previous.url === next.url &&
    areStringArraysEqual(previous.reasonTokens, next.reasonTokens) &&
    areActionMenusEqual(previous.menu, next.menu)
}

function areActionMenusEqual(
  previous: PopupActionMenuViewModel,
  next: PopupActionMenuViewModel
) {
  return previous.items.length === next.items.length && previous.items.every((item, index) => {
    const nextItem = next.items[index]
    return item.action === nextItem.action &&
      item.ariaLabel === nextItem.ariaLabel &&
      item.bookmarkId === nextItem.bookmarkId &&
      item.danger === nextItem.danger &&
      item.disabled === nextItem.disabled &&
      item.label === nextItem.label
  })
}

function areStringArraysEqual(previous: string[], next: string[]) {
  return previous.length === next.length && previous.every((item, index) => item === next[index])
}

function PopupRowActions({
  active = false,
  bookmarkId,
  label,
  menu,
  onMenuAction,
  title
}: {
  active?: boolean
  bookmarkId: string
  label: string
  menu: PopupActionMenuViewModel
  onMenuAction?: (bookmarkId: string, action: string, returnFocusElement?: HTMLElement | null) => void
  title?: string
}) {
  const [focusExpanded, setFocusExpanded] = useState(false)
  const [pinnedExpanded, setPinnedExpanded] = useState(false)
  const [forcedCollapsed, setForcedCollapsed] = useState(false)
  const quickActions = menu.items.filter((item) => {
    return ['edit', 'copy-url', 'open-current-tab', 'move', 'delete'].includes(item.action)
  })
  const expanded = (active || focusExpanded || pinnedExpanded) && !forcedCollapsed
  const triggerLabel = title || label || '显示书签快捷操作'

  return (
    <div
      className={rowActionsClass}
      aria-label="书签快捷操作"
      data-active={active ? 'true' : undefined}
      data-collapsed={forcedCollapsed ? 'true' : undefined}
      data-open={expanded ? 'true' : 'false'}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setFocusExpanded(false)
        }
      }}
      onFocus={() => {
        if (!forcedCollapsed) {
          setFocusExpanded(true)
        }
      }}
      onPointerLeave={() => setForcedCollapsed(false)}
    >
      <div className={rowActionRailClass}>
        {quickActions.map((item) => (
          <Button
            className={cx(rowActionButtonClass, item.danger ? rowActionDangerClass : '')}
            type="button"
            aria-label={item.ariaLabel}
            title={item.label}
            disabled={item.disabled}
            tabIndex={expanded ? undefined : -1}
            onClick={(event) => {
              onMenuAction?.(item.bookmarkId, item.action, event.currentTarget)
              setFocusExpanded(false)
            }}
            key={`${item.bookmarkId}:${item.action}`}
            unstyled
          >
            <Icon name={getPopupActionIconName(item.action)} size={14} aria-hidden="true" />
          </Button>
        ))}
      </div>
      <Button
        className={rowActionTriggerClass}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={expanded}
        aria-pressed={pinnedExpanded && !forcedCollapsed}
        title={triggerLabel}
        onClick={(event) => {
          if (pinnedExpanded && !forcedCollapsed) {
            setPinnedExpanded(false)
            setFocusExpanded(false)
            setForcedCollapsed(true)
            event.currentTarget.blur()
            return
          }

          setPinnedExpanded(true)
          setForcedCollapsed(false)
        }}
        unstyled
      >
        <Icon name="MoreHorizontal" size={14} aria-hidden="true" />
      </Button>
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
