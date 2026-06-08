import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Button, Icon } from '../../ui'
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
  useNewtabBookmarkContentView
} from '../newtab-bookmark-content-store'
import { BookmarkIconShell } from './BookmarkIconShell'
import { SpeedDialPanelHost } from './NewtabSpeedDialPanel'

export function NewtabBookmarkContent() {
  const state = useNewtabBookmarkContentView()
  if (!state) {
    return null
  }

  return <BookmarkContent state={state} />
}

function BookmarkContent({ state }: { state: BookmarkContentViewModel }) {
  return (
    <section
      className="newtab-content"
      style={createBookmarkContentStyle(state.content)}
      data-icon-layout-mode={state.content.layoutMode}
      data-icon-show-titles={String(state.content.showTitles)}
      data-icon-vertical-center={String(state.content.verticalCenter)}
      aria-busy={state.content.reordering ? 'true' : 'false'}
    >
      {state.speedDial ? <SpeedDialPanelHost /> : null}
      {state.portal ? <PortalPanel state={state.portal} /> : null}
      {state.sourceNavigation ? (
        <nav className="source-navigation" aria-label="书签来源导航">
          <SourceNavigation state={state.sourceNavigation} />
        </nav>
      ) : null}
      <div className="bookmark-folder-sections">
        {state.sections.map((section) => (
          <BookmarkFolderSection section={section} key={section.folderId} />
        ))}
        {state.reorderStatus ? (
          <p className="bookmark-reorder-status" data-tone={state.reorderStatus.tone} role="status">
            {state.reorderStatus.message}
          </p>
        ) : null}
      </div>
    </section>
  )
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

function BookmarkFolderSection({ section }: { section: BookmarkFolderSectionViewModel }) {
  const className = section.dragging ? 'bookmark-folder-section dragging-folder' : 'bookmark-folder-section'

  return (
    <section
      className={className}
      id={section.anchorId}
      data-folder-section-id={section.folderId}
      tabIndex={-1}
    >
      <div className="folder-section-header-row">
        <FolderSectionHeader state={{
          bookmarkCount: section.bookmarkCount,
          dragging: section.dragging,
          folderId: section.folderId,
          path: section.path,
          onAddBookmark: section.onAddBookmark,
          title: section.title
        }} />
      </div>
      {section.grid ? (
        <BookmarkFolderGrid grid={section.grid} title={section.title} />
      ) : (
        <div className="bookmark-folder-empty-state">
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
  grid,
  title
}: {
  grid: BookmarkFolderGridViewModel
  title: string
}) {
  const totalCount = grid.items.length
  const initialVisibleCount = getInitialVisibleCount(grid)
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount)
  const [expanding, setExpanding] = useState(false)
  const placeholderRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setVisibleCount((current) => Math.min(totalCount, Math.max(current, initialVisibleCount)))
  }, [grid.folderId, initialVisibleCount, totalCount])

  useEffect(() => {
    if (!expanding || visibleCount >= totalCount) {
      if (visibleCount >= totalCount) {
        setExpanding(false)
      }
      return
    }

    const frame = window.requestAnimationFrame(() => {
      setVisibleCount((current) => Math.min(totalCount, current + grid.chunkSize))
    })
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [expanding, grid.chunkSize, totalCount, visibleCount])

  useEffect(() => {
    if (visibleCount >= totalCount || expanding) {
      return
    }

    const placeholder = placeholderRef.current
    if (!placeholder) {
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      window.queueMicrotask(() => {
        setExpanding(true)
      })
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setExpanding(true)
      }
    }, { rootMargin: '360px 0px' })
    observer.observe(placeholder)
    return () => {
      observer.disconnect()
    }
  }, [expanding, totalCount, visibleCount])

  const visibleItems = useMemo(
    () => grid.items.slice(0, visibleCount),
    [grid.items, visibleCount]
  )
  const remainingCount = Math.max(0, totalCount - visibleCount)
  const busy = grid.busy || remainingCount > 0

  return (
    <nav
      className="bookmark-grid"
      data-bookmark-grid-folder-id={grid.folderId}
      data-incremental-render={remainingCount > 0 ? 'true' : undefined}
      aria-label={grid.ariaLabel}
      aria-busy={busy ? 'true' : 'false'}
    >
      {visibleItems.map((item) => (
        <BookmarkTile state={item} key={item.id} />
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
  refNode: React.RefObject<HTMLDivElement | null>
  remainingCount: number
}) {
  const title = `${folderTitle || '文件夹'}还有 ${remainingCount} 个书签将在滚动到此处时载入`
  return (
    <div
      className="bookmark-grid-placeholder"
      data-pending-bookmarks={String(remainingCount)}
      role="status"
      aria-live="polite"
      title={title}
      ref={refNode}
    >
      继续载入 {remainingCount} 个书签
    </div>
  )
}

function BookmarkTile({ state }: { state: BookmarkTileViewModel }) {
  return (
    <a
      className={state.dragging ? 'bookmark-tile dragging' : 'bookmark-tile'}
      href={state.url}
      title={state.title}
      draggable={false}
      data-bookmark-id={state.id}
      data-folder-id={state.folderId}
      onClick={state.onNavigate}
      style={state.style}
    >
      <BookmarkIconShell
        customIcon={state.customIcon}
        fallbackLabel={state.fallbackLabel}
        favicon={state.favicon}
      />
      <span className="bookmark-title">{state.title}</span>
    </a>
  )
}

function PortalPanel({ state }: { state: PortalPanelState }) {
  return (
    <section className="newtab-portal quick-only" aria-label="Curator 常用和新近添加书签">
      <section className="newtab-quick-access" aria-label="Curator 常用和新近添加书签">
        <QuickAccessPanel state={state.quickAccess} />
      </section>
    </section>
  )
}

function QuickAccessPanel({ state }: { state: QuickAccessPanelState }) {
  return (
    <>
      {state.groups.map((group) => (
        <section className="newtab-quick-group" aria-label={`${group.label}书签`} key={group.label}>
          <div className="newtab-quick-heading">{group.label}</div>
          <div className="newtab-quick-list">
            {group.items.map((item) => (
              <a
                className="newtab-quick-link"
                href={item.url}
                title={`${item.title} · ${item.detail}`}
                draggable={false}
                data-bookmark-id={item.id}
                data-quick-reason={item.reason}
                onClick={item.onNavigate}
                key={item.id}
              >
                <span className="newtab-quick-mark" aria-hidden="true">{item.badge}</span>
                <span className="newtab-quick-copy">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function EmptyFolder({ state }: { state: EmptyFolderState }) {
  return (
    <>
      <p className="bookmark-folder-empty">
        此文件夹还没有书签。你可以先添加一个书签，或改用已有的非空来源；选择来源只改变展示，不会移动或删除书签。
      </p>
      <div className="bookmark-folder-empty-actions">
        <Button
          className="newtab-button secondary"
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
          className="newtab-button secondary"
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

  return (
    <>
      <Button
        className={state.dragging ? 'folder-section-header dragging' : 'folder-section-header'}
        type="button"
        data-folder-drag-handle={state.folderId}
        title={state.path || state.title}
        aria-label={`${state.title}，长按拖拽调整文件夹顺序`}
        unstyled
      >
        <span className="folder-section-title">{displayTitle}</span>
        <span className="folder-section-count">{state.bookmarkCount}</span>
      </Button>
      <Button
        className="folder-section-add"
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
        <Icon name="Plus" size={12} aria-hidden="true" />
      </Button>
    </>
  )
}

function SourceNavigation({ state }: { state: SourceNavigationState }) {
  return (
    <>
      <span className="source-navigation-label">来源</span>
      <div className="source-navigation-list">
        {state.items.map((item) => (
          <a
            className="source-navigation-link"
            href={`#${item.anchorId}`}
            data-source-navigation-target={item.anchorId}
            title={item.path}
            draggable={false}
            aria-label={`跳转到「${item.title}」，${item.bookmarkCount} 个书签`}
            onClick={(event) => {
              event.preventDefault()
              state.onFocusSource(item.anchorId)
            }}
            key={item.id}
          >
            <span className="source-navigation-title">{item.title}</span>
            <span className="source-navigation-count">{item.bookmarkCount}</span>
          </a>
        ))}
      </div>
    </>
  )
}
