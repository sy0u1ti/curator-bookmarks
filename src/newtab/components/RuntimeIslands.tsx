import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import {
  Button,
  Icon,
  SwitchControl
} from '../../ui'
import type { NewTabSourceNavigationItem } from '../content-state'
import { useNewtabSpeedDialView } from '../newtab-speed-dial-store'
import type { SpeedDialEmptyState } from '../speed-dial-types'
import type { NewTabTimeSettings } from '../time-settings'

const roots = new WeakMap<Element, Root>()

function renderIsland(container: Element, node: React.ReactNode): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(node)
  })
}

export interface ClockWidgetState {
  ariaLabel: string
  dateDateTime: string
  dateText: string
  periodText: string
  settings: NewTabTimeSettings
  timeDateTime: string
  timeText: string
}

export interface EmptyFolderState {
  folderId: string
  onAddBookmark: (anchor: HTMLElement, folderId: string) => void
  onOpenFolderSettings: () => void
}

export interface SourceNavigationState {
  items: NewTabSourceNavigationItem[]
  onFocusSource: (anchorId: string) => void
}

export interface QuickAccessLinkViewModel {
  badge: string
  detail: string
  id: string
  onNavigate: (event: React.MouseEvent<HTMLAnchorElement>) => void
  reason: 'pinned' | 'frequent' | 'added'
  title: string
  url: string
}

export interface QuickAccessGroupViewModel {
  items: QuickAccessLinkViewModel[]
  label: string
}

export interface QuickAccessPanelState {
  groups: QuickAccessGroupViewModel[]
}

export interface PortalPanelState {
  quickAccess: QuickAccessPanelState
}

export interface SpeedDialCardViewModel {
  customIcon: boolean
  detail: string
  dragging: boolean
  fallbackLabel: string
  favicon: {
    fetchpriority: 'high' | 'auto'
    loading: 'eager' | 'lazy'
    src: string
  }
  id: string
  onNavigate: (event: React.MouseEvent<HTMLAnchorElement>) => void
  style?: React.CSSProperties
  title: string
  url: string
}

export type SpeedDialContentState =
  | { type: 'loading'; label: string }
  | { type: 'empty'; state: SpeedDialEmptyState }
  | { type: 'items'; busy: boolean; items: SpeedDialCardViewModel[] }

export interface SpeedDialPanelState {
  ariaBusy: boolean
  content: SpeedDialContentState
  meta: string
  metaTone?: 'error' | ''
}

export interface BookmarkTileViewModel {
  customIcon: boolean
  dragging: boolean
  fallbackLabel: string
  favicon: {
    fetchpriority: 'high' | 'low'
    loading: 'eager' | 'lazy'
    src: string
  }
  folderId: string
  id: string
  title: string
  url: string
}

export interface FeaturedBackgroundPickerCardViewModel {
  favorite: boolean
  fetchpriority: 'high' | 'auto'
  id: string
  imageUrl: string
  initialPreviewUrl: string
  onClearHoverPreview: (card: HTMLElement) => void
  onFavoriteToggle: (card: HTMLElement, id: string) => void | Promise<void>
  onSelect: (card: HTMLElement, id: string) => void
  onScheduleHoverPreview: (card: HTMLElement) => void
  previewAccentColor: string
  previewFallbackUrls: string[]
  remotePreviewUrl: string
  resolutionState: 'ready' | 'pending'
  resolutionText: string
  selected: boolean
  title: string
}

export interface FeaturedBackgroundPickerGridSectionViewModel {
  cards: FeaturedBackgroundPickerCardViewModel[]
  emptyText: string
  title: string
}

export interface FeaturedBackgroundPickerProviderGroupViewModel {
  cards: FeaturedBackgroundPickerCardViewModel[]
  emptyText: string
  title: string
}

export type FeaturedBackgroundPickerSectionViewModel =
  | { type: 'grid'; section: FeaturedBackgroundPickerGridSectionViewModel }
  | { type: 'providers'; title: string; groups: FeaturedBackgroundPickerProviderGroupViewModel[] }

export type FeaturedBackgroundPickerState =
  | { type: 'state'; label: string }
  | { type: 'sections'; sections: FeaturedBackgroundPickerSectionViewModel[] }

export interface FolderSectionHeaderState {
  bookmarkCount: number
  dragging: boolean
  folderId: string
  onAddBookmark: (anchor: HTMLElement, folderId: string) => void
  path: string
  title: string
}

export interface BookmarkContentStyleState {
  columnGap: number
  columns: number
  fixedGridWidth: number
  folderGap: number
  iconShellSize: number
  layoutMode: string
  pageWidth: number
  reordering: boolean
  rowGap: number
  showTitles: boolean
  tileWidth: number
  titleLines: number
  verticalCenter: boolean
}

export interface BookmarkContentViewModel {
  content: BookmarkContentStyleState
  modules: HTMLElement[]
  portal: PortalPanelState | null
  reorderStatus: BookmarkReorderStatusViewModel | null
  sections: BookmarkFolderSectionViewModel[]
  sourceNavigation: SourceNavigationState | null
  speedDial: boolean
}

export interface BookmarkFolderSectionViewModel {
  anchorId: string
  bookmarkCount: number
  dragging: boolean
  folderId: string
  grid: BookmarkFolderGridViewModel | null
  onAddBookmark: (anchor: HTMLElement, folderId: string) => void
  onOpenFolderSettings: () => void
  path: string
  title: string
}

export interface BookmarkFolderGridViewModel {
  ariaLabel: string
  busy: boolean
  folderId: string
  onMount: (node: HTMLElement | null) => void
}

export interface BookmarkReorderStatusViewModel {
  message: string
  tone: string
}

export function createBookmarkTileIslandElement(state: BookmarkTileViewModel): HTMLAnchorElement {
  const tile = document.createElement('a')
  renderBookmarkTileIslandElement(tile, state)
  return tile
}

export function renderBookmarkTileIslandElement(
  tile: HTMLAnchorElement,
  state: BookmarkTileViewModel
): void {
  tile.className = state.dragging ? 'bookmark-tile dragging' : 'bookmark-tile'
  tile.href = state.url
  tile.title = state.title
  tile.draggable = false
  tile.dataset.bookmarkId = state.id
  tile.dataset.folderId = state.folderId
  renderIsland(tile, <BookmarkTile state={state} />)
}

export function appendBookmarkTileIslandElements(
  container: HTMLElement,
  states: BookmarkTileViewModel[],
  { before }: { before?: ChildNode | null } = {}
): HTMLAnchorElement[] {
  const fragment = document.createDocumentFragment()
  const tiles = states.map((state) => {
    const tile = createBookmarkTileIslandElement(state)
    fragment.append(tile)
    return tile
  })

  if (before?.parentNode === container) {
    container.insertBefore(fragment, before)
  } else {
    container.append(fragment)
  }

  return tiles
}

export function createBookmarkContentIslandElement(state: BookmarkContentViewModel): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-content'
  applyBookmarkContentHostAttributes(view, state.content)
  renderIsland(view, <BookmarkContent state={state} />)
  return view
}

export function replaceBookmarkContentIslandChildren(
  target: HTMLElement,
  source: HTMLElement
): void {
  target.replaceChildren(...Array.from(source.childNodes))
  copyElementPresentationState(source, target)
}

export function mountNewTabDragGhostBridge(ghost: HTMLElement): void {
  document.body.append(ghost)
}

function applyBookmarkContentHostAttributes(view: HTMLElement, state: BookmarkContentStyleState): void {
  view.style.setProperty('--icon-page-width', `${state.pageWidth}px`)
  view.style.setProperty('--icon-column-gap', `${state.columnGap}px`)
  view.style.setProperty('--icon-row-gap', `${state.rowGap}px`)
  view.style.setProperty('--icon-folder-gap', `${state.folderGap}px`)
  view.style.setProperty('--icon-tile-width', `${state.tileWidth}px`)
  view.style.setProperty('--icon-shell-size', `${state.iconShellSize}px`)
  view.style.setProperty('--icon-fixed-grid-width', `${state.fixedGridWidth}px`)
  view.style.setProperty('--icon-columns', String(state.columns))
  view.style.setProperty('--icon-title-lines', String(state.titleLines))
  view.dataset.iconLayoutMode = state.layoutMode
  view.dataset.iconShowTitles = String(state.showTitles)
  view.dataset.iconVerticalCenter = String(state.verticalCenter)
  view.setAttribute('aria-busy', state.reordering ? 'true' : 'false')
}

function copyElementPresentationState(source: HTMLElement, target: HTMLElement): void {
  target.className = source.className
  target.removeAttribute('style')
  const sourceAttributeNames = new Set(source.getAttributeNames())
  for (const name of target.getAttributeNames()) {
    if (name !== 'class' && !sourceAttributeNames.has(name)) {
      target.removeAttribute(name)
    }
  }

  for (const name of source.getAttributeNames()) {
    if (name === 'class') {
      continue
    }

    target.setAttribute(name, source.getAttribute(name) || '')
  }
}

function BookmarkContent({ state }: { state: BookmarkContentViewModel }) {
  return (
    <>
      <MountedElements elements={state.modules} />
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
    </>
  )
}

function SpeedDialPanelHost() {
  const state = useNewtabSpeedDialView()
  if (!state) {
    return null
  }

  return (
    <section className="newtab-speed-dial" aria-label="Speed Dial" aria-busy={state.ariaBusy}>
      <SpeedDialPanel state={state} />
    </section>
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

function MountedElements({ elements }: { elements: HTMLElement[] }) {
  return (
    <>
      {elements.map((element, index) => (
        <MountedElement element={element} key={`${element.dataset.newtabModule || element.className || 'module'}:${index}`} />
      ))}
    </>
  )
}

function MountedElement({ element }: { element: HTMLElement | null }) {
  if (!element) {
    return null
  }

  return (
    <div
      hidden
      ref={(node) => {
        if (!node || element.parentElement === node.parentElement) {
          return
        }
        node.replaceWith(element)
      }}
    />
  )
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
        <nav
          className="bookmark-grid"
          data-bookmark-grid-folder-id={section.grid.folderId}
          aria-label={section.grid.ariaLabel}
          aria-busy={section.grid.busy}
          ref={section.grid.onMount}
        />
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

export function FeaturedBackgroundPicker({ state }: { state: FeaturedBackgroundPickerState }) {
  if (state.type === 'state') {
    return <div className="featured-wallpaper-state">{state.label}</div>
  }

  return (
    <>
      {state.sections.map((section) => (
        section.type === 'grid' ? (
          <FeaturedBackgroundPickerGridSection section={section.section} key={`grid:${section.section.title}`} />
        ) : (
          <FeaturedBackgroundPickerProviderSection section={section} key={`providers:${section.title}`} />
        )
      ))}
    </>
  )
}

function FeaturedBackgroundPickerProviderSection({
  section
}: {
  section: Extract<FeaturedBackgroundPickerSectionViewModel, { type: 'providers' }>
}) {
  return (
    <section className="featured-wallpaper-section" aria-label={section.title}>
      <h4 className="featured-wallpaper-section-title">{section.title}</h4>
      <div className="featured-wallpaper-provider-stack">
        {section.groups.map((group) => (
          <section className="featured-wallpaper-provider-section" aria-label={group.title} key={group.title}>
            <h5 className="featured-wallpaper-provider-title">{group.title}</h5>
            <FeaturedBackgroundPickerCardGrid cards={group.cards} emptyText={group.emptyText} />
          </section>
        ))}
      </div>
    </section>
  )
}

function FeaturedBackgroundPickerGridSection({ section }: { section: FeaturedBackgroundPickerGridSectionViewModel }) {
  return (
    <section className="featured-wallpaper-section" aria-label={section.title}>
      <h4 className="featured-wallpaper-section-title">{section.title}</h4>
      <FeaturedBackgroundPickerCardGrid cards={section.cards} emptyText={section.emptyText} />
    </section>
  )
}

function FeaturedBackgroundPickerCardGrid({
  cards,
  emptyText
}: {
  cards: FeaturedBackgroundPickerCardViewModel[]
  emptyText: string
}) {
  return (
    <div className="featured-wallpaper-section-grid">
      {cards.length ? (
        cards.map((card) => <FeaturedBackgroundPickerCard card={card} key={card.id} />)
      ) : (
        <div className="featured-wallpaper-section-empty">{emptyText}</div>
      )}
    </div>
  )
}

function FeaturedBackgroundPickerCard({ card }: { card: FeaturedBackgroundPickerCardViewModel }) {
  const [previewState, setPreviewState] = useState<'ready' | 'loading'>(card.initialPreviewUrl ? 'ready' : 'loading')
  const cardRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    setPreviewState(card.initialPreviewUrl ? 'ready' : 'loading')
  }, [card.initialPreviewUrl])

  const className = [
    'featured-wallpaper-card',
    card.selected ? 'is-selected' : '',
    previewState === 'ready' ? 'has-preview-image' : '',
    previewState === 'loading' ? 'is-loading' : ''
  ].filter(Boolean).join(' ')
  const previewStyle = {
    '--featured-wallpaper-preview-placeholder': card.previewAccentColor
  } as React.CSSProperties

  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      aria-label={card.title}
      aria-pressed={card.selected}
      data-featured-background-id={card.id}
      data-featured-background-preview-url={card.imageUrl}
      data-featured-background-preview-title={card.title}
      data-featured-background-resolved-preview-url={card.initialPreviewUrl}
      ref={cardRef}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
          return
        }
        card.onClearHoverPreview(event.currentTarget)
      }}
      onClick={(event) => {
        card.onClearHoverPreview(event.currentTarget)
        card.onSelect(event.currentTarget, card.id)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }
        event.preventDefault()
        card.onClearHoverPreview(event.currentTarget)
        card.onSelect(event.currentTarget, card.id)
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') {
          return
        }
        card.onScheduleHoverPreview(event.currentTarget)
      }}
      onPointerLeave={(event) => {
        card.onClearHoverPreview(event.currentTarget)
      }}
    >
      <span className="featured-wallpaper-preview" style={previewStyle}>
        <img
          className="featured-wallpaper-preview-image"
          src={card.initialPreviewUrl}
          alt=""
          decoding="async"
          loading="eager"
          fetchPriority={card.fetchpriority}
          draggable={false}
          data-remote-preview-url={card.remotePreviewUrl}
          data-preview-fallback-urls={JSON.stringify(card.previewFallbackUrls)}
          onError={(event) => {
            handleFeaturedBackgroundPreviewError(event, setPreviewState)
          }}
          onLoad={(event) => {
            handleFeaturedBackgroundPreviewLoad(event, setPreviewState)
          }}
        />
        <span className="featured-wallpaper-resolution" data-state={card.resolutionState}>
          {card.resolutionText}
        </span>
        <Button
          className={card.favorite ? 'featured-wallpaper-favorite is-favorite' : 'featured-wallpaper-favorite'}
          type="button"
          aria-pressed={card.favorite}
          aria-label={card.favorite ? '取消收藏这张精选图' : '收藏这张精选图'}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const cardElement = cardRef.current
            if (!cardElement) {
              return
            }
            card.onClearHoverPreview(cardElement)
            void card.onFavoriteToggle(cardElement, card.id)
          }}
          unstyled
        >
          <Icon name="Heart" aria-hidden="true" />
        </Button>
      </span>
    </div>
  )
}

function handleFeaturedBackgroundPreviewError(
  event: React.SyntheticEvent<HTMLImageElement>,
  setPreviewState: (state: 'ready' | 'loading') => void
) {
  const image = event.currentTarget
  const card = image.closest<HTMLElement>('.featured-wallpaper-card')
  const fallbackUrls = parseFeaturedBackgroundPreviewFallbackUrls(image.dataset.previewFallbackUrls)
  const fallbackUrl = fallbackUrls.shift() || ''
  image.dataset.previewFallbackUrls = JSON.stringify(fallbackUrls)
  if (!card) {
    return
  }
  if (!fallbackUrl) {
    setPreviewState('loading')
    return
  }

  image.src = fallbackUrl
  card.dataset.featuredBackgroundResolvedPreviewUrl = fallbackUrl
  setPreviewState('ready')
}

function handleFeaturedBackgroundPreviewLoad(
  event: React.SyntheticEvent<HTMLImageElement>,
  setPreviewState: (state: 'ready' | 'loading') => void
) {
  const image = event.currentTarget
  const card = image.closest<HTMLElement>('.featured-wallpaper-card')
  if (!card) {
    return
  }
  card.dataset.featuredBackgroundResolvedPreviewUrl = image.currentSrc || image.src
  setPreviewState('ready')
}

function parseFeaturedBackgroundPreviewFallbackUrls(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || '[]'))
    return Array.isArray(parsed)
      ? parsed.map((url) => String(url || '').trim()).filter(Boolean)
      : []
  } catch {
    return []
  }
}

function BookmarkTile({ state }: { state: BookmarkTileViewModel }) {
  return (
    <>
      <BookmarkIconShell
        customIcon={state.customIcon}
        fallbackLabel={state.fallbackLabel}
        favicon={state.favicon}
      />
      <span className="bookmark-title">{state.title}</span>
    </>
  )
}

function SpeedDialPanel({ state }: { state: SpeedDialPanelState }) {
  return (
    <>
      <div className="newtab-module-heading">
        <h2>Speed Dial</h2>
        <span data-tone={state.metaTone || undefined}>{state.meta}</span>
      </div>
      <SpeedDialContent state={state.content} />
    </>
  )
}

function SpeedDialContent({ state }: { state: SpeedDialContentState }) {
  if (state.type === 'loading') {
    return (
      <div className="newtab-speed-dial-empty" role="status">
        {state.label}
      </div>
    )
  }

  if (state.type === 'empty') {
    return (
      <div className="newtab-speed-dial-empty">
        <div className="newtab-speed-dial-empty-copy">
          <strong>{state.state.title}</strong>
          <span>{state.state.detail}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="newtab-speed-dial-grid" aria-busy={state.busy ? 'true' : 'false'}>
      {state.items.map((item) => (
        <a
          className={item.dragging ? 'newtab-speed-dial-card dragging' : 'newtab-speed-dial-card'}
          href={item.url}
          title={item.title}
          draggable={false}
          data-bookmark-id={item.id}
          data-speed-dial-bookmark-id={item.id}
          aria-label={`打开固定入口：${item.title}。长按拖拽调整 Speed Dial 顺序`}
          onClick={item.onNavigate}
          style={item.style}
          key={item.id}
        >
          <BookmarkIconShell
            className="newtab-speed-dial-mark bookmark-icon-shell"
            customIcon={item.customIcon}
            fallbackLabel={item.fallbackLabel}
            favicon={item.favicon}
          />
          <span className="newtab-speed-dial-copy">
            <strong>{item.title}</strong>
            <span>{item.detail}</span>
          </span>
        </a>
      ))}
    </div>
  )
}

function BookmarkIconShell({
  className = 'bookmark-icon-shell',
  customIcon,
  fallbackLabel,
  favicon
}: {
  className?: string
  customIcon: boolean
  fallbackLabel: string
  favicon: BookmarkTileViewModel['favicon'] | SpeedDialCardViewModel['favicon']
}) {
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    setMissing(false)
  }, [favicon.src])

  return (
    <span className={missing ? `${className} favicon-missing` : className} aria-hidden="true">
      <img
        className={customIcon ? 'bookmark-favicon custom-icon' : 'bookmark-favicon'}
        src={favicon.src}
        alt=""
        draggable={false}
        loading={favicon.loading}
        decoding="async"
        fetchPriority={favicon.fetchpriority}
        onError={() => {
          setMissing(true)
        }}
      />
      <span className="bookmark-fallback">{fallbackLabel}</span>
    </span>
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

export function ClockWidgetContent({ state }: { state: ClockWidgetState }) {
  const { settings } = state

  return (
    <>
      {settings.displayMode !== 'date' ? (
        <span className="newtab-clock-time-group">
          <time className="newtab-clock-time" data-clock-time="true" dateTime={state.timeDateTime}>
            {state.timeText}
          </time>
          {settings.hour12 ? (
            <span className="newtab-clock-period" data-clock-period="true">
              {state.periodText}
            </span>
          ) : null}
        </span>
      ) : null}
      {settings.displayMode !== 'time' ? (
        <time className="newtab-clock-date" data-clock-date="true" dateTime={state.dateDateTime}>
          {state.dateText}
        </time>
      ) : null}
    </>
  )
}
