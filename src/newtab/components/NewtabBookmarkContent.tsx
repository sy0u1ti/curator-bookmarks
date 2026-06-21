import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { Icon } from '../../ui/icons/Icon'
import { Button } from '../../ui/base/Button'
import {
  type BookmarkContentStyleState,
  type BookmarkContentViewModel,
  type BookmarkFolderGridViewModel,
  type BookmarkFolderSectionViewModel,
  type BookmarkTileViewModel,
  type EmptyFolderState,
  type FolderSectionHeaderState,
  type PortalPanelState,
  type QuickAccessPanelState,
  type SourceNavigationState,
  setNewtabBookmarkFolderHeaderNode,
  setNewtabBookmarkFolderSectionNode,
  setNewtabBookmarkGridNode,
  setNewtabBookmarkTileIconNode,
  setNewtabBookmarkTileNode,
  useNewtabBookmarkContentView
} from '../newtab-bookmark-content-store'
import { useNewtabDragUiView, type NewtabDragUiView } from '../newtab-drag-ui-store'
import { useNewtabFolderSourceView } from '../newtab-folder-source-store'
import { BookmarkIconShell } from './BookmarkIconShell'
import { SpeedDialPanelHost } from './NewtabSpeedDialPanel'
import { getBookmarkTileClass, getBookmarkTitleClass } from './bookmarkTileClasses'
import {
  FOLDER_SECTION_COUNT_CLASS,
  FOLDER_SECTION_TITLE_CLASS,
  getFolderSectionHeaderRowClass,
  getFolderSectionHeaderClass
} from './folderSectionClasses'
import {
  BOOKMARK_FOLDER_SECTIONS_CLASS,
  getBookmarkGridClass,
  getNewtabContentClass
} from './newtabLayoutClasses'
import { getNewtabButtonClass } from './newtabButtonClass'

const EMPTY_FOLDER_STATE_CLASS = 'bookmark-folder-empty-state grid justify-items-start gap-2.5'
const EMPTY_FOLDER_COPY_CLASS = 'bookmark-folder-empty justify-self-start mt-1 mb-0 text-xs leading-[1.4] text-[rgba(245,245,247,0.4)]'
const EMPTY_FOLDER_ACTIONS_CLASS = 'bookmark-folder-empty-actions flex flex-wrap gap-2'
const EMPTY_FOLDER_BUTTON_CLASS = getNewtabButtonClass('secondary', '!min-h-[34px] !px-3 !text-xs')
const SOURCE_NAVIGATION_CLASS = 'source-navigation mb-3.5 inline-grid max-w-full grid-cols-[auto_minmax(0,1fr)] items-center justify-self-start gap-2'
const SOURCE_NAVIGATION_LABEL_CLASS = 'source-navigation-label whitespace-nowrap text-[11px] font-[720] leading-none text-[rgba(245,245,247,0.42)]'
const SOURCE_NAVIGATION_LIST_CLASS = 'source-navigation-list flex min-w-0 max-w-full flex-wrap gap-1.5'
const SOURCE_NAVIGATION_LINK_CLASS = 'source-navigation-link inline-flex h-[26px] max-w-[min(180px,100%)] items-center justify-start gap-1.5 rounded-[var(--ui-radius-control)] border border-[rgba(245,245,247,0.1)] bg-[rgba(10,10,12,0.28)] px-2 text-left leading-normal text-[rgba(245,245,247,0.72)] no-underline [-webkit-backdrop-filter:blur(8px)_saturate(1.06)] [backdrop-filter:blur(8px)_saturate(1.06)] [transition:border-color_var(--ui-motion-standard)_var(--ui-ease-standard),background-color_var(--ui-motion-standard)_var(--ui-ease-standard),color_var(--ui-motion-standard)_var(--ui-ease-standard)] hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)] focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)] focus-visible:shadow-[0_0_0_2px_rgba(245,245,247,0.12)] focus-visible:outline-none'
const SOURCE_NAVIGATION_TITLE_CLASS = 'source-navigation-title min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[650] leading-none'
const SOURCE_NAVIGATION_COUNT_CLASS = 'source-navigation-count inline-grid h-4 min-w-[18px] place-items-center rounded-[var(--ui-radius-pill)] bg-[var(--ui-surface-selected)] text-[10px] font-[760] leading-none text-[var(--ui-accent-text)]'
const FOLDER_SECTION_ADD_CLASS = 'folder-section-add inline-flex h-[22px] min-h-[22px] w-[22px] min-w-[22px] flex-none items-center justify-center gap-0 rounded-md border border-transparent bg-transparent p-0 leading-none text-[rgba(245,245,247,0.56)] opacity-70 cursor-pointer [transition:opacity_var(--ui-motion-standard)_var(--ui-ease-standard),background-color_var(--ui-motion-standard)_var(--ui-ease-standard),color_var(--ui-motion-standard)_var(--ui-ease-standard)] hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)] hover:opacity-100 focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)] focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[rgba(245,245,247,0.26)]'
const BOOKMARK_GRID_PLACEHOLDER_CLASS = 'bookmark-grid-placeholder grid min-h-[calc(var(--icon-shell-size)+18px)] items-center rounded-[var(--ui-radius-control)] border border-dashed border-[rgba(245,245,247,0.14)] bg-[rgba(10,10,12,0.24)] px-2.5 py-2 text-[11px] font-[620] text-[rgba(245,245,247,0.46)] [-webkit-backdrop-filter:blur(8px)_saturate(1.06)] [backdrop-filter:blur(8px)_saturate(1.06)]'
const BOOKMARK_FOLDER_SECTION_CLASS = 'bookmark-folder-section group/bookmark-folder-section grid w-full content-start items-start justify-items-stretch gap-1.5 [scroll-margin-top:clamp(28px,5vh,48px)] [content-visibility:auto] [contain-intrinsic-size:0_320px] [transition:opacity_var(--ui-motion-standard)_var(--ui-ease-standard),transform_var(--ui-motion-standard)_var(--ui-ease-standard)] focus:bg-transparent focus:[box-shadow:none] focus:[outline:0] focus-visible:bg-transparent focus-visible:[box-shadow:none] focus-visible:[outline:0]'
const BOOKMARK_FOLDER_SECTION_DRAGGING_CLASS = 'dragging-folder opacity-[0.54]'
const BOOKMARK_REORDER_STATUS_CLASS = 'bookmark-reorder-status mt-1.5 mb-0 text-xs font-[650] leading-[1.4]'
const BOOKMARK_REORDER_STATUS_WARNING_CLASS = 'text-[rgba(255,214,179,0.88)]'
const BOOKMARK_REORDER_STATUS_SUCCESS_CLASS = 'text-[rgba(132,218,137,0.9)]'
const BOOKMARK_REORDER_STATUS_ERROR_CLASS = 'text-[rgba(255,183,176,0.94)]'
const PORTAL_PANEL_CLASS = 'newtab-portal quick-only [--portal-card-min-height:42px] [--portal-card-gap:6px] mb-[18px] grid w-full grid-cols-1 items-stretch gap-3.5 rounded-lg border border-[rgba(245,245,247,0.13)] bg-[rgba(15,15,15,0.56)] p-2.5 shadow-[0_14px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.075)] [-webkit-backdrop-filter:blur(12px)_saturate(1.12)] [backdrop-filter:blur(12px)_saturate(1.12)]'
const QUICK_ACCESS_CLASS = 'newtab-quick-access grid w-full content-stretch gap-[var(--portal-card-gap)]'
const QUICK_GROUP_CLASS = 'newtab-quick-group grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-2.5'
const QUICK_HEADING_CLASS = 'newtab-quick-heading flex [min-height:auto] items-center whitespace-nowrap px-0.5 text-[11px] font-[750] leading-[1.2] tracking-[0] text-[rgba(245,245,247,0.48)]'
const QUICK_LIST_CLASS = 'newtab-quick-list grid min-w-0 grid-cols-[repeat(auto-fill,minmax(136px,1fr))] auto-rows-[minmax(var(--portal-card-min-height),1fr)] gap-[var(--portal-card-gap)]'
const QUICK_LINK_CLASS = 'newtab-quick-link grid min-h-[var(--portal-card-min-height)] min-w-0 grid-cols-[24px_minmax(0,1fr)] items-center gap-[7px] rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[rgba(21,21,22,0.54)] py-1 pr-2 pl-[5px] text-[rgba(245,245,247,0.84)] no-underline shadow-[0_14px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.075)] [transform:none] [transition:border-color_160ms_var(--ui-ease-standard),background-color_160ms_var(--ui-ease-standard),box-shadow_160ms_var(--ui-ease-standard),transform_160ms_var(--ui-ease-standard),opacity_var(--ui-motion-standard)_var(--ui-ease-standard)] [-webkit-backdrop-filter:blur(8px)_saturate(1.06)] [backdrop-filter:blur(8px)_saturate(1.06)] hover:border-[rgba(245,245,247,0.16)] hover:bg-[rgba(31,32,35,0.62)] hover:text-[var(--ui-text-primary)] hover:shadow-[0_14px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.075)] hover:[transform:none] hover:no-underline focus-visible:border-[rgba(245,245,247,0.16)] focus-visible:bg-[rgba(31,32,35,0.62)] focus-visible:text-[var(--ui-text-primary)] focus-visible:shadow-[0_14px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.075)] focus-visible:[transform:none] focus-visible:no-underline focus-visible:outline-none'
const QUICK_MARK_CLASS = 'newtab-quick-mark grid h-6 w-6 place-items-center rounded-md text-[11px] font-extrabold leading-none'
const QUICK_MARK_DEFAULT_CLASS = 'bg-[rgba(245,245,247,0.08)] text-[rgba(245,245,247,0.72)]'
const QUICK_MARK_PINNED_CLASS = 'bg-[rgba(245,245,247,0.16)] text-[rgba(180,204,255,0.94)]'
const QUICK_COPY_CLASS = 'newtab-quick-copy grid min-w-0 gap-0.5'
const QUICK_COPY_TITLE_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[720] leading-[1.15]'
const QUICK_COPY_DETAIL_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-[560] leading-[1.15] text-[rgba(245,245,247,0.42)]'

export function NewtabBookmarkContent({ hasSearch = false }: { hasSearch?: boolean }) {
  const state = useNewtabBookmarkContentView()
  if (!state) {
    return null
  }

  return <BookmarkContent hasSearch={hasSearch} state={state} />
}

function BookmarkContent({
  hasSearch,
  state
}: {
  hasSearch: boolean
  state: BookmarkContentViewModel
}) {
  const dragUi = useNewtabDragUiView()
  const folderSource = useNewtabFolderSourceView()
  const sectionRefs = useRef<Map<string, HTMLElement> | null>(null)
  if (!sectionRefs.current) {
    sectionRefs.current = new Map()
  }
  const setSectionElement = useCallback((anchorId: string, element: HTMLElement | null) => {
    if (element) {
      sectionRefs.current?.set(anchorId, element)
      return
    }
    sectionRefs.current?.delete(anchorId)
  }, [])
  const focusSource = useCallback((anchorId: string) => {
    const section = sectionRefs.current?.get(anchorId)
    if (!section) {
      return
    }
    section.scrollIntoView({ block: 'start', behavior: 'smooth' })
    section.focus({ preventScroll: true })
  }, [])

  return (
    <section
      className={getNewtabContentClass({ hasSearch, layoutMode: state.content.layoutMode })}
      style={createBookmarkContentStyle(state.content)}
      data-icon-layout-mode={state.content.layoutMode}
      data-icon-show-titles={String(state.content.showTitles)}
      data-icon-vertical-center={String(state.content.verticalCenter)}
      aria-busy={state.content.reordering ? 'true' : 'false'}
    >
      {state.speedDial ? <SpeedDialPanelHost /> : null}
      {state.portal ? <PortalPanel state={state.portal} /> : null}
      {state.sourceNavigation ? (
        <nav className={SOURCE_NAVIGATION_CLASS} aria-label="书签来源导航">
          <SourceNavigation onFocusSource={focusSource} state={state.sourceNavigation} />
        </nav>
      ) : null}
      <div className={BOOKMARK_FOLDER_SECTIONS_CLASS}>
        {state.sections.map((section) => (
          <BookmarkFolderSection
            dragUi={dragUi}
            fixedLayout={state.content.layoutMode === 'fixed'}
            hideFolderNames={folderSource.hideFolderNames}
            section={section}
            showTitles={state.content.showTitles}
            onSectionRef={setSectionElement}
            key={section.folderId}
          />
        ))}
        {state.reorderStatus ? (
          <p
            className={getBookmarkReorderStatusClass(state.reorderStatus.tone)}
            data-tone={state.reorderStatus.tone}
            role="status"
          >
            {state.reorderStatus.message}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function getBookmarkReorderStatusClass(tone: string): string {
  if (tone === 'success') {
    return `${BOOKMARK_REORDER_STATUS_CLASS} ${BOOKMARK_REORDER_STATUS_SUCCESS_CLASS}`
  }
  if (tone === 'error') {
    return `${BOOKMARK_REORDER_STATUS_CLASS} ${BOOKMARK_REORDER_STATUS_ERROR_CLASS}`
  }
  return `${BOOKMARK_REORDER_STATUS_CLASS} ${BOOKMARK_REORDER_STATUS_WARNING_CLASS}`
}

function createBookmarkContentStyle(state: BookmarkContentStyleState): CSSProperties {
  return {
    '--icon-page-width': `${state.pageWidth}px`,
    '--icon-column-gap': `${state.columnGap}px`,
    '--icon-row-gap': `${state.rowGap}px`,
    '--icon-folder-gap': `${state.folderGap}px`,
    '--icon-tile-width': `${state.tileWidth}px`,
    '--icon-shell-size': `${state.iconShellSize}px`,
    '--icon-fixed-grid-width': `${state.fixedGridWidth}px`,
    '--icon-columns': String(state.columns),
    '--icon-title-lines': String(state.titleLines)
  } as CSSProperties
}

function BookmarkFolderSection({
  dragUi,
  fixedLayout,
  hideFolderNames,
  onSectionRef,
  section,
  showTitles,
}: {
  dragUi: NewtabDragUiView
  fixedLayout: boolean
  hideFolderNames: boolean
  onSectionRef: (anchorId: string, element: HTMLElement | null) => void
  section: BookmarkFolderSectionViewModel
  showTitles: boolean
}) {
  const className = section.dragging
    ? `${BOOKMARK_FOLDER_SECTION_CLASS} ${BOOKMARK_FOLDER_SECTION_DRAGGING_CLASS}`
    : BOOKMARK_FOLDER_SECTION_CLASS
  const sectionRef = useCallback((element: HTMLElement | null) => {
    onSectionRef(section.anchorId, element)
    setNewtabBookmarkFolderSectionNode(section.folderId, element)
  }, [onSectionRef, section.anchorId, section.folderId])

  return (
    <section
      className={className}
      id={section.anchorId}
      data-folder-section-id={section.folderId}
      ref={sectionRef}
      tabIndex={-1}
    >
      <div className={getFolderSectionHeaderRowClass({
        forceVisible: dragUi.folderOrderDragging,
        hideNames: hideFolderNames
      })}>
        <FolderSectionHeader state={{
          bookmarkCount: section.bookmarkCount,
          dragging: section.dragging,
          folderId: section.folderId,
          path: section.path,
          onAddBookmark: section.onAddBookmark,
          onClick: section.onClick,
          onDragPointerDown: section.onDragPointerDown,
          title: section.title
        }} />
      </div>
      {section.grid ? (
        <BookmarkFolderGrid dragUi={dragUi} fixedLayout={fixedLayout} grid={section.grid} showTitles={showTitles} title={section.title} />
      ) : (
        <div className={EMPTY_FOLDER_STATE_CLASS}>
          <EmptyFolder state={{
            folderId: section.folderId,
            onAddBookmark: section.onAddBookmark,
            onOpenFolderSettings: section.onOpenFolderSettings
          }} />
        </div>
      )}
    </section>
  )
}

function BookmarkFolderGrid({
  dragUi,
  fixedLayout,
  grid,
  showTitles,
  title
}: {
  dragUi: NewtabDragUiView
  fixedLayout: boolean
  grid: BookmarkFolderGridViewModel
  showTitles: boolean
  title: string
}) {
  const setGridRef = useCallback((element: HTMLElement | null) => {
    setNewtabBookmarkGridNode(grid.folderId, element)
  }, [grid.folderId])
  const totalCount = grid.items.length
  const initialVisibleCount = getInitialVisibleCount(grid)
  const [visibleState, setVisibleState] = useState(() => ({
    folderId: grid.folderId,
    visibleCount: initialVisibleCount
  }))
  let visibleCount = visibleState.folderId === grid.folderId
    ? visibleState.visibleCount
    : initialVisibleCount
  const normalizedVisibleCount = Math.min(totalCount, Math.max(visibleCount, initialVisibleCount))
  if (visibleState.folderId !== grid.folderId || visibleState.visibleCount !== normalizedVisibleCount) {
    visibleCount = normalizedVisibleCount
    setVisibleState({
      folderId: grid.folderId,
      visibleCount: normalizedVisibleCount
    })
  }
  const expandFrameRef = useRef(0)
  const placeholderRef = useRef<HTMLOutputElement | null>(null)
  const visibleCountRef = useRef(visibleCount)
  visibleCountRef.current = visibleCount

  const cancelExpandFrame = useCallback(() => {
    if (!expandFrameRef.current) {
      return
    }
    window.cancelAnimationFrame(expandFrameRef.current)
    expandFrameRef.current = 0
  }, [])

  const expandVisibleItems = useCallback(() => {
    if (expandFrameRef.current || visibleCountRef.current >= totalCount) {
      return
    }

    const runFrame = () => {
      expandFrameRef.current = window.requestAnimationFrame(() => {
        expandFrameRef.current = 0
        const nextVisibleCount = Math.min(
          totalCount,
          Math.max(visibleCountRef.current, initialVisibleCount) + grid.chunkSize
        )
        visibleCountRef.current = nextVisibleCount
        setVisibleState((current) => {
          if (current.folderId !== grid.folderId) {
            return current
          }
          return {
            ...current,
            visibleCount: Math.max(current.visibleCount, nextVisibleCount)
          }
        })

        if (nextVisibleCount < totalCount) {
          runFrame()
        }
      })
    }

    runFrame()
  }, [grid.chunkSize, grid.folderId, initialVisibleCount, totalCount])

  useEffect(() => {
    return () => {
      setNewtabBookmarkGridNode(grid.folderId, null)
      cancelExpandFrame()
    }
  }, [cancelExpandFrame, grid.folderId])

  useEffect(() => {
    if (visibleCount >= totalCount) {
      cancelExpandFrame()
      return
    }

    const placeholder = placeholderRef.current
    if (!placeholder) {
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      window.queueMicrotask(() => {
        expandVisibleItems()
      })
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        expandVisibleItems()
      }
    }, { rootMargin: '360px 0px' })
    observer.observe(placeholder)
    return () => {
      observer.disconnect()
    }
  }, [cancelExpandFrame, expandVisibleItems, totalCount, visibleCount])

  const visibleItems = useMemo(
    () => grid.items.slice(0, visibleCount),
    [grid.items, visibleCount]
  )
  const remainingCount = Math.max(0, totalCount - visibleCount)
  const busy = grid.busy || remainingCount > 0

  return (
    <nav
      className={getBookmarkGridClass({ fixedLayout })}
      data-bookmark-grid-folder-id={grid.folderId}
      data-incremental-render={remainingCount > 0 ? 'true' : undefined}
      aria-label={grid.ariaLabel}
      aria-busy={busy ? 'true' : 'false'}
      ref={setGridRef}
    >
      {visibleItems.map((item) => (
        <BookmarkTile dragUi={dragUi} state={item} showTitles={showTitles} key={item.id} />
      ))}
      {remainingCount > 0 ? (
        <BookmarkGridPlaceholder
          folderTitle={title}
          remainingCount={remainingCount}
          refNode={placeholderRef}
        />
      ) : null}
    </nav>
  )
}

function getInitialVisibleCount(grid: BookmarkFolderGridViewModel): number {
  return Math.min(grid.items.length, Math.max(0, grid.initialVisibleCount))
}

function BookmarkGridPlaceholder({
  folderTitle,
  refNode,
  remainingCount
}: {
  folderTitle: string
  refNode: React.RefObject<HTMLOutputElement | null>
  remainingCount: number
}) {
  const title = `${folderTitle || '文件夹'}还有 ${remainingCount} 个书签将在滚动到此处时载入`
  return (
    <output
      className={BOOKMARK_GRID_PLACEHOLDER_CLASS}
      data-pending-bookmarks={String(remainingCount)}
      aria-live="polite"
      title={title}
      ref={refNode}
    >
      继续载入 {remainingCount} 个书签
    </output>
  )
}

function BookmarkTile({
  dragUi,
  state,
  showTitles
}: {
  dragUi: NewtabDragUiView
  state: BookmarkTileViewModel
  showTitles: boolean
}) {
  const setTileRef = useCallback((element: HTMLAnchorElement | null) => {
    setNewtabBookmarkTileNode(state.id, element)
  }, [state.id])
  const setIconRef = useCallback((element: HTMLSpanElement | null) => {
    setNewtabBookmarkTileIconNode(state.id, element)
  }, [state.id])
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLAnchorElement>) => {
    state.onDragPointerDown(event)
  }, [state])

  useEffect(() => {
    return () => {
      setNewtabBookmarkTileNode(state.id, null)
      setNewtabBookmarkTileIconNode(state.id, null)
    }
  }, [state.id])

  return (
    <a
      className={getBookmarkTileClass({
        dragActive: dragUi.bookmarkDragging,
        dragging: state.dragging,
        previewInitializing: dragUi.previewInitializing,
        showTitles
      })}
      href={state.url}
      title={state.title}
      draggable={false}
      data-bookmark-id={state.id}
      data-folder-id={state.folderId}
      onClick={state.onNavigate}
      onContextMenu={state.onContextMenu}
      onPointerDown={handlePointerDown}
      ref={setTileRef}
      style={state.style}
    >
      <BookmarkIconShell
        customIcon={state.customIcon}
        fallbackLabel={state.fallbackLabel}
        favicon={state.favicon}
        ref={setIconRef}
      />
      <span className={getBookmarkTitleClass()} hidden={!showTitles}>{state.title}</span>
    </a>
  )
}

function PortalPanel({ state }: { state: PortalPanelState }) {
  return (
    <section className={PORTAL_PANEL_CLASS} aria-label="Curator 常用和新近添加书签">
      <section className={QUICK_ACCESS_CLASS} aria-label="Curator 常用和新近添加书签">
        <QuickAccessPanel state={state.quickAccess} />
      </section>
    </section>
  )
}

function QuickAccessPanel({ state }: { state: QuickAccessPanelState }) {
  return (
    <>
      {state.groups.map((group) => (
        <section className={QUICK_GROUP_CLASS} aria-label={`${group.label}书签`} key={group.label}>
          <div className={QUICK_HEADING_CLASS}>{group.label}</div>
          <div className={QUICK_LIST_CLASS}>
            {group.items.map((item) => (
              <a
                className={QUICK_LINK_CLASS}
                href={item.url}
                title={`${item.title} · ${item.detail}`}
                draggable={false}
                data-bookmark-id={item.id}
                data-quick-reason={item.reason}
                onClick={item.onNavigate}
                onContextMenu={item.onContextMenu}
                key={item.id}
              >
                <span className={getQuickAccessMarkClass(item.reason)} aria-hidden="true">{item.badge}</span>
                <span className={QUICK_COPY_CLASS}>
                  <strong className={QUICK_COPY_TITLE_CLASS}>{item.title}</strong>
                  <span className={QUICK_COPY_DETAIL_CLASS}>{item.detail}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function getQuickAccessMarkClass(reason: string): string {
  return reason === 'pinned'
    ? `${QUICK_MARK_CLASS} ${QUICK_MARK_PINNED_CLASS}`
    : `${QUICK_MARK_CLASS} ${QUICK_MARK_DEFAULT_CLASS}`
}

function EmptyFolder({ state }: { state: EmptyFolderState }) {
  return (
    <>
      <p className={EMPTY_FOLDER_COPY_CLASS}>
        此文件夹还没有书签。你可以先添加一个书签，或改用已有的非空来源；选择来源只改变展示，不会移动或删除书签。
      </p>
      <div className={EMPTY_FOLDER_ACTIONS_CLASS}>
        <Button
          className={EMPTY_FOLDER_BUTTON_CLASS}
          type="button"
          data-add-bookmark-folder-id={state.folderId}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            state.onAddBookmark(event.currentTarget, state.folderId)
          }}
          unstyled
        >
          添加书签到这里
        </Button>
        <Button
          className={EMPTY_FOLDER_BUTTON_CLASS}
          type="button"
          title="打开来源设置并选择已有文件夹"
          onClick={state.onOpenFolderSettings}
          unstyled
        >
          选择现有来源
        </Button>
      </div>
    </>
  )
}

function FolderSectionHeader({ state }: { state: FolderSectionHeaderState }) {
  const displayTitle = state.title || '未命名文件夹'
  const addTitle = `添加书签到「${displayTitle}」`
  const setHeaderRef = useCallback((element: HTMLButtonElement | null) => {
    setNewtabBookmarkFolderHeaderNode(state.folderId, element)
  }, [state.folderId])
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    state.onDragPointerDown(event)
  }, [state])

  useEffect(() => {
    return () => {
      setNewtabBookmarkFolderHeaderNode(state.folderId, null)
    }
  }, [state.folderId])

  return (
    <>
      <Button
        className={getFolderSectionHeaderClass({ dragging: state.dragging })}
        type="button"
        data-folder-drag-handle={state.folderId}
        title={state.path || state.title}
        aria-label={`${state.title}，长按拖拽调整文件夹顺序`}
        onClick={state.onClick}
        onPointerDown={handlePointerDown}
        ref={setHeaderRef}
        unstyled
      >
        <span className={FOLDER_SECTION_TITLE_CLASS}>{displayTitle}</span>
        <span className={FOLDER_SECTION_COUNT_CLASS}>{state.bookmarkCount}</span>
      </Button>
      <Button
        className={FOLDER_SECTION_ADD_CLASS}
        type="button"
        data-add-bookmark-folder-id={state.folderId}
        title={addTitle}
        aria-label={addTitle}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          state.onAddBookmark(event.currentTarget, state.folderId)
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        unstyled
      >
        <Icon name="Plus" size={12} strokeWidth={2} aria-hidden="true" />
      </Button>
    </>
  )
}

function SourceNavigation({
  onFocusSource,
  state
}: {
  onFocusSource: (anchorId: string) => void
  state: SourceNavigationState
}) {
  return (
    <>
      <span className={SOURCE_NAVIGATION_LABEL_CLASS}>来源</span>
      <div className={SOURCE_NAVIGATION_LIST_CLASS}>
        {state.items.map((item) => (
          <Button
            className={SOURCE_NAVIGATION_LINK_CLASS}
            data-source-navigation-target={item.anchorId}
            title={item.path}
            draggable={false}
            aria-label={`跳转到「${item.title}」，${item.bookmarkCount} 个书签`}
            type="button"
            onClick={() => {
              onFocusSource(item.anchorId)
            }}
            unstyled
            key={item.id}
          >
            <span className={SOURCE_NAVIGATION_TITLE_CLASS}>{item.title}</span>
            <span className={SOURCE_NAVIGATION_COUNT_CLASS}>{item.bookmarkCount}</span>
          </Button>
        ))}
      </div>
    </>
  )
}
