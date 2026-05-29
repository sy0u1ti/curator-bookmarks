import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { CSSProperties, ReactNode } from 'react'
import {
  Button,
  CheckboxControl,
  DotMatrixLoader,
  Icon,
  InlineMenu,
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverRoot,
  type InlineMenuAction,
  type IconName
} from '../../ui'

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

export interface DashboardTitleState {
  countText: string
  title: string
}

export interface DashboardSearchChipViewModel {
  kind: string
  label: string
}

export interface DashboardBreadcrumbSegmentViewModel {
  current: boolean
  id: string
  label: string
  path: string
}

export interface DashboardFolderSidebarItemViewModel {
  active: boolean
  count: number
  depth: number
  id: string
  path: string
  title: string
}

export interface DashboardLoadingLabelState {
  busy: boolean
  label: string
  loaderClass: string
  variant: 'bar' | 'spiral'
  wrapperClass: string
}

export interface DashboardEmptyState {
  loading: boolean
  message: string
}

export interface DashboardFolderDropTargetViewModel {
  active: boolean
  bookmarkCount: number
  folderCount: number
  id: string
  path: string
  title: string
}

export interface DashboardDragPreviewState {
  fallbackLabel: string
  favicon: {
    pageUrl: string
    source: string
    src: string
  } | null
  title: string
}

export interface DashboardCardFaviconViewModel {
  pageUrl: string
  source: 'cache' | 'chrome'
  src: string
}

export interface DashboardCardViewModel {
  activeMenu: boolean
  bookmarkId: string
  copyActionLabel: string
  copyText: string
  copyTooltip: string
  deleting: boolean
  deleteLabel: string
  displayUrl: string
  editTagsLabel: string
  expanded: boolean
  fallbackLabel: string
  favicon: DashboardCardFaviconViewModel | null
  hiddenTagCount: number
  itemPath: string
  moreLabel: string
  moveLabel: string
  openLabel: string
  parentId: string
  selected: boolean
  selectionLabel: string
  speedDialActionLabel: string
  speedDialActionText: string
  speedDialPinned: boolean
  tagStatusTitle: string
  tags: string[]
  title: string
  url: string
  visibleTags: string[]
}

const dashboardCardActionIconByKind = {
  copy: 'Copy',
  delete: 'Trash2',
  move: 'Move',
  open: 'ExternalLink',
  'speed-dial': 'Gauge',
  tag: 'Tag'
} satisfies Record<DashboardCardActionIcon, IconName>

type DashboardCardActionIcon = 'open' | 'copy' | 'tag' | 'speed-dial' | 'move' | 'delete'

export function renderDashboardTitleIsland(container: Element, state: DashboardTitleState): void {
  renderIsland(container, <DashboardTitle state={state} />)
}

export function renderDashboardSearchChipsIsland(container: Element, chips: DashboardSearchChipViewModel[]): void {
  renderIsland(container, <DashboardSearchChips chips={chips} />)
}

export function renderDashboardBreadcrumbsIsland(
  container: Element,
  segments: DashboardBreadcrumbSegmentViewModel[]
): void {
  renderIsland(container, <DashboardBreadcrumbs segments={segments} />)
}

export function renderDashboardFolderSidebarIsland(
  container: Element,
  items: DashboardFolderSidebarItemViewModel[]
): void {
  renderIsland(container, <DashboardFolderSidebar items={items} />)
}

export function renderDashboardLoadingLabelIsland(
  container: Element,
  state: DashboardLoadingLabelState
): void {
  renderIsland(container, <DashboardLoadingLabel state={state} />)
}

export function renderDashboardEmptyStateIsland(container: Element, state: DashboardEmptyState): void {
  renderIsland(container, <DashboardEmptyStatePanel state={state} />)
}

export function renderDashboardFolderDropGridIsland(
  container: Element,
  targets: DashboardFolderDropTargetViewModel[]
): void {
  renderIsland(container, <DashboardFolderDropGrid targets={targets} />)
}

export function renderDashboardDragPreviewIsland(
  container: Element,
  state: DashboardDragPreviewState | null
): void {
  renderIsland(container, state ? <DashboardDragPreview state={state} /> : null)
}

export function createDashboardCardIslandElement(state: DashboardCardViewModel): HTMLElement {
  const element = document.createElement('article')
  applyDashboardCardHostAttributes(element, state)
  renderIsland(element, <DashboardCardContents state={state} />)
  return element
}

export function renderDashboardCardListIsland(
  container: HTMLElement,
  states: DashboardCardViewModel[]
): void {
  const fragment = document.createDocumentFragment()
  for (const state of states) {
    fragment.append(createDashboardCardIslandElement(state))
  }
  container.replaceChildren(fragment)
}

export function replaceDashboardVirtualWindowIslandNodes(
  windowElement: HTMLElement,
  nodes: HTMLElement[]
): void {
  const fragment = document.createDocumentFragment()
  for (const node of nodes) {
    fragment.append(node)
  }
  windowElement.replaceChildren(fragment)
}

export function prependDashboardVirtualWindowIslandNodes(
  windowElement: HTMLElement,
  nodes: HTMLElement[]
): void {
  const fragment = document.createDocumentFragment()
  for (const node of nodes) {
    fragment.append(node)
  }
  windowElement.prepend(fragment)
}

export function appendDashboardVirtualWindowIslandNodes(
  windowElement: HTMLElement,
  nodes: HTMLElement[]
): void {
  const fragment = document.createDocumentFragment()
  for (const node of nodes) {
    fragment.append(node)
  }
  windowElement.append(fragment)
}

export function removeDashboardVirtualWindowIslandEdgeNodes(
  windowElement: HTMLElement,
  count: number,
  edge: 'start' | 'end'
): void {
  for (let index = 0; index < count; index += 1) {
    const child = edge === 'start'
      ? windowElement.firstElementChild
      : windowElement.lastElementChild
    if (!child) {
      return
    }
    child.remove()
  }
}

export function createDashboardTagPopoverIslandElement(state: DashboardCardViewModel): HTMLElement {
  const element = document.createElement('div')
  element.className = 'dashboard-tag-popover-host'
  renderIsland(element, <DashboardTagPopoverShell state={state} />)
  return element
}

export function createDashboardVirtualWindowIslandElement(): {
  spacer: HTMLElement
  windowElement: HTMLElement
} {
  const spacer = document.createElement('div')
  spacer.className = 'dashboard-virtual-spacer'
  renderIsland(spacer, <DashboardVirtualWindowShell />)
  const windowElement = spacer.querySelector<HTMLElement>('.dashboard-virtual-window')
  if (!windowElement) {
    throw new Error('Dashboard virtual window shell failed to render.')
  }
  return { spacer, windowElement }
}

export function renderDashboardVirtualWindowShellIsland(
  container: HTMLElement,
  spacer: HTMLElement
): void {
  container.replaceChildren(spacer)
}

export function mountDashboardDragOverlayIsland(overlay: HTMLElement): void {
  if (overlay.parentElement !== document.body) {
    document.body.append(overlay)
  }
}

function applyDashboardCardHostAttributes(element: HTMLElement, state: DashboardCardViewModel): void {
  element.className = [
    'dashboard-bookmark-card',
    state.selected ? 'selected' : '',
    state.expanded ? 'tags-expanded' : '',
    state.activeMenu ? 'menu-open' : ''
  ].filter(Boolean).join(' ')
  element.setAttribute('data-dashboard-card', '')
  element.setAttribute('data-dashboard-bookmark-id', state.bookmarkId)
}

function DashboardVirtualWindowShell() {
  return <div className="dashboard-virtual-window" />
}

function DashboardTitle({ state }: { state: DashboardTitleState }) {
  return (
    <>
      {state.title} <span id="dashboard-total">{state.countText}</span>
    </>
  )
}

function DashboardSearchChips({ chips }: { chips: DashboardSearchChipViewModel[] }) {
  return (
    <>
      {chips.map((chip) => (
        <span className={['dashboard-search-chip', chip.kind].filter(Boolean).join(' ')} key={`${chip.kind}:${chip.label}`}>
          {chip.label}
        </span>
      ))}
    </>
  )
}

function DashboardBreadcrumbs({ segments }: { segments: DashboardBreadcrumbSegmentViewModel[] }) {
  if (!segments.length) {
    return null
  }

  return (
    <ol className="dashboard-folder-breadcrumb-list">
      {segments.map((segment, index) => (
        <FragmentWithSeparator index={index} key={`${segment.id || 'current'}:${index}`}>
          {segment.current || !segment.id ? (
            <span className="dashboard-folder-breadcrumb-current" aria-current="page" title={segment.path}>
              {segment.label}
            </span>
          ) : (
            <Button
              className="dashboard-folder-breadcrumb-link"
              type="button"
              data-dashboard-folder-filter={segment.id}
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
      {index === 0 ? null : <li className="dashboard-folder-breadcrumb-separator" aria-hidden="true">&gt;</li>}
      <li>{children}</li>
    </>
  )
}

function DashboardFolderSidebar({ items }: { items: DashboardFolderSidebarItemViewModel[] }) {
  return (
    <>
      {items.map((item) => {
        const clampedDepth = Math.min(Math.max(Number(item.depth) || 0, 0), 8)
        const countLabel = `${Number(item.count) || 0} 个书签`
        const pathText = item.path || item.title || '未命名文件夹'
        const titleText = item.title || '未命名文件夹'
        const style = { '--folder-depth-offset': `${clampedDepth * 13}px` } as CSSProperties

        return (
          <Button
            className={['dashboard-folder-tree-item', item.active ? 'active' : ''].filter(Boolean).join(' ')}
            type="button"
            role="option"
            data-dashboard-folder-filter={item.id}
            data-dashboard-no-drag="true"
            aria-selected={item.active ? 'true' : 'false'}
            tabIndex={item.active ? 0 : -1}
            aria-current={item.active ? 'page' : undefined}
            aria-label={`${pathText}，${countLabel}`}
            title={pathText}
            style={style}
            key={item.id}
            unstyled
          >
            <span className="dashboard-folder-tree-branch" aria-hidden="true"></span>
            <span className="dashboard-folder-tree-label">{titleText}</span>
            <span className="dashboard-folder-tree-count" title={countLabel}>{Number(item.count) || 0}</span>
          </Button>
        )
      })}
    </>
  )
}

function DashboardLoadingLabel({ state }: { state: DashboardLoadingLabelState }) {
  if (!state.busy) {
    return <>{state.label}</>
  }

  return (
    <span className={state.wrapperClass}>
      <DotMatrixLoader variant={state.variant} className={state.loaderClass} />
      <span>{state.label}</span>
    </span>
  )
}

function DashboardEmptyStatePanel({ state }: { state: DashboardEmptyState }) {
  return (
    <div className={['detect-empty', state.loading ? 'dashboard-loading-empty' : ''].filter(Boolean).join(' ')}>
      {state.loading ? (
        <DashboardLoadingLabel
          state={{
            busy: true,
            label: state.message,
            loaderClass: 'dashboard-status-dot-loader',
            variant: 'spiral',
            wrapperClass: 'status-loading-label'
          }}
        />
      ) : (
        state.message
      )}
    </div>
  )
}

function DashboardFolderDropGrid({ targets }: { targets: DashboardFolderDropTargetViewModel[] }) {
  if (!targets.length) {
    return <div className="detect-empty">没有可用的目标文件夹。</div>
  }

  return (
    <>
      {targets.map((target) => {
        const folderCopy = target.folderCount ? ` · ${target.folderCount} 个子文件夹` : ''
        return (
          <Button
            className={['dashboard-folder-drop-card', target.active ? 'active' : ''].filter(Boolean).join(' ')}
            type="button"
            role="option"
            aria-selected={target.active ? 'true' : 'false'}
            data-dashboard-drop-folder={target.id}
            title={target.path}
            key={target.id}
            unstyled
          >
            <span className="dashboard-folder-icon" aria-hidden="true"></span>
            <span className="dashboard-folder-copy">
              <strong>{target.title}</strong>
              <span>{target.path}</span>
              <small>{`${target.bookmarkCount} 个书签${folderCopy}`}</small>
            </span>
          </Button>
        )
      })}
    </>
  )
}

function DashboardDragPreview({ state }: { state: DashboardDragPreviewState }) {
  return (
    <>
      <span className="dashboard-favicon-shell" aria-hidden="true">
        {state.favicon ? (
          <img
            src={state.favicon.src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            data-dashboard-favicon="true"
            data-dashboard-favicon-source={state.favicon.source}
            data-dashboard-favicon-page-url={state.favicon.pageUrl}
          />
        ) : null}
        <span>{state.fallbackLabel}</span>
      </span>
      <span>{state.title}</span>
    </>
  )
}

function DashboardCardContents({ state }: { state: DashboardCardViewModel }) {
  const tagRowVisible = state.visibleTags.length > 0 || state.hiddenTagCount > 0

  return (
    <>
      <label className="dashboard-card-check" data-dashboard-no-drag>
        <CheckboxControl
          aria-label={state.selectionLabel}
          className="options-checkbox-control"
          defaultChecked={state.selected}
          disabled={state.deleting}
          inputAttributes={{ 'data-dashboard-select': state.bookmarkId }}
          syncInputState
          unstyled
        />
        <span className="sr-only">{state.selectionLabel}</span>
      </label>
      <div className="dashboard-card-body">
        <DashboardFavicon state={state} />
        <div className="dashboard-card-copy">
          <div className="dashboard-card-title-row">
            <strong title={state.title}>{state.title}</strong>
          </div>
          <a
            className="dashboard-card-url"
            href={state.url}
            target="_blank"
            rel="noreferrer noopener"
            data-dashboard-no-drag
          >
            {state.displayUrl}
          </a>
          <div className="dashboard-card-meta">
            <div className="dashboard-card-path-row">
              <Button
                className="dashboard-path-chip"
                type="button"
                data-dashboard-folder-filter={state.parentId}
                data-dashboard-no-drag="true"
                title={state.itemPath}
                aria-label={`按文件夹筛选：${state.itemPath}`}
                unstyled
              >
                {state.itemPath}
              </Button>
            </div>
            {tagRowVisible ? (
              <div className="dashboard-card-tag-row">
                {state.visibleTags.map((tag) => (
                  <span className="dashboard-mini-chip" key={tag}>{tag}</span>
                ))}
                {state.hiddenTagCount > 0 ? (
                  <Button
                    id={`dashboard-tag-toggle-${state.bookmarkId}`}
                    className="dashboard-mini-chip dashboard-tag-toggle"
                    type="button"
                    data-dashboard-toggle-tags={state.bookmarkId}
                    data-dashboard-no-drag="true"
                    aria-expanded={state.expanded ? 'true' : 'false'}
                    aria-controls={`dashboard-tag-popover-${state.bookmarkId}`}
                    aria-label={`查看 ${state.hiddenTagCount} 个隐藏标签`}
                    unstyled
                  >
                    +{state.hiddenTagCount}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="dashboard-card-tag-row empty" aria-hidden="true"></div>
            )}
          </div>
        </div>
      </div>
      <div className="dashboard-card-side">
        <span
          className={['dashboard-status-dot', state.tags.length ? 'has-tags' : ''].filter(Boolean).join(' ')}
          title={state.tagStatusTitle}
        ></span>
      </div>
      <div className="dashboard-card-footer">
        <div className="dashboard-card-actions">
          <DashboardCardAction
            as="a"
            icon="open"
            label={state.openLabel}
            tooltip="打开书签"
            className="detect-result-open"
            href={state.url}
            text="打开"
          />
          <DashboardCardAction
            icon="copy"
            label={state.copyActionLabel}
            tooltip={state.copyTooltip}
            className="detect-result-action"
            data-dashboard-copy={state.bookmarkId}
            text={state.copyText}
          />
          <DashboardCardMoreMenu state={state} />
        </div>
      </div>
      {state.expanded && state.tags.length ? <DashboardTagPopoverShell state={state} /> : null}
    </>
  )
}

function DashboardCardMoreMenu({ state }: { state: DashboardCardViewModel }) {
  const trigger = (
    <Button
      className="dashboard-icon-action dashboard-card-more-trigger"
      type="button"
      data-dashboard-toggle-menu={state.bookmarkId}
      data-dashboard-no-drag="true"
      data-dashboard-tooltip="更多操作"
      aria-label={state.moreLabel}
      aria-haspopup="menu"
      aria-expanded={state.activeMenu ? 'true' : 'false'}
      unstyled
    >
      <Icon name="MoreHorizontal" aria-hidden="true" />
      <span className="sr-only">更多</span>
    </Button>
  )

  return (
    <div className={['dashboard-card-more', state.activeMenu ? 'is-open' : ''].filter(Boolean).join(' ')} data-dashboard-no-drag>
      <InlineMenu
        actions={getDashboardCardMenuActions(state)}
        className="dashboard-card-menu"
        label={state.moreLabel}
        open={state.activeMenu}
        trigger={trigger}
      />
    </div>
  )
}

function getDashboardCardMenuActions(state: DashboardCardViewModel): InlineMenuAction[] {
  return [
    {
      id: 'edit-tags',
      label: <DashboardCardMenuItemContent icon="tag" text="修改标签" />,
      className: 'dashboard-card-menu-item',
      attributes: getDashboardCardMenuItemAttributes({
        action: 'edit-tags',
        bookmarkId: state.bookmarkId,
        label: state.editTagsLabel
      })
    },
    {
      id: 'toggle-speed-dial',
      label: <DashboardCardMenuItemContent icon="speed-dial" text={state.speedDialActionText} />,
      className: 'dashboard-card-menu-item',
      attributes: getDashboardCardMenuItemAttributes({
        action: 'toggle-speed-dial',
        bookmarkId: state.bookmarkId,
        label: state.speedDialActionLabel,
        pressed: state.speedDialPinned
      })
    },
    {
      id: 'move-one',
      label: <DashboardCardMenuItemContent icon="move" text="移动" />,
      className: 'dashboard-card-menu-item',
      attributes: getDashboardCardMenuItemAttributes({
        action: 'move-one',
        bookmarkId: state.bookmarkId,
        label: state.moveLabel
      }),
      disabled: state.deleting
    },
    {
      id: 'delete-one',
      label: <DashboardCardMenuItemContent icon="delete" text="删除" />,
      className: 'dashboard-card-menu-item danger',
      attributes: getDashboardCardMenuItemAttributes({
        action: 'delete-one',
        bookmarkId: state.bookmarkId,
        label: state.deleteLabel
      }),
      destructive: true,
      disabled: state.deleting
    }
  ]
}

function getDashboardCardMenuItemAttributes({
  action,
  bookmarkId,
  label,
  pressed
}: {
  action: string
  bookmarkId: string
  label: string
  pressed?: boolean
}): Record<string, string> {
  return {
    'data-dashboard-action': action,
    'data-dashboard-bookmark-id': bookmarkId,
    'data-dashboard-no-drag': 'true',
    'aria-label': label,
    ...(typeof pressed === 'boolean' ? { 'aria-pressed': pressed ? 'true' : 'false' } : {})
  }
}

function DashboardFavicon({ state }: { state: DashboardCardViewModel }) {
  return (
    <span className="dashboard-favicon-shell" aria-hidden="true">
      {state.favicon ? (
        <img
          src={state.favicon.src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          data-dashboard-favicon="true"
          data-dashboard-favicon-source={state.favicon.source}
          data-dashboard-favicon-page-url={state.favicon.pageUrl}
        />
      ) : null}
      <span>{state.fallbackLabel}</span>
    </span>
  )
}

function DashboardCardAction({
  as = 'button',
  icon,
  label,
  tooltip,
  className,
  text,
  href,
  ...props
}: {
  as?: 'a' | 'button'
  icon: DashboardCardActionIcon
  label: string
  tooltip: string
  className: string
  text: string
  href?: string
} & Record<string, string>) {
  const classes = ['dashboard-icon-action', className].filter(Boolean).join(' ')
  const content = (
    <>
      <Icon name={dashboardCardActionIconByKind[icon]} aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </>
  )

  if (as === 'a') {
    return (
      <a
        className={classes}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        data-dashboard-no-drag
        data-dashboard-tooltip={tooltip}
        aria-label={label}
        {...props}
      >
        {content}
      </a>
    )
  }

  return (
    <Button
      className={classes}
      type="button"
      data-dashboard-no-drag="true"
      data-dashboard-tooltip={tooltip}
      aria-label={label}
      unstyled
      {...props}
    >
      {content}
    </Button>
  )
}

function DashboardCardMenuItemContent({
  icon,
  text
}: {
  icon: DashboardCardActionIcon
  text: string
}) {
  return (
    <>
      <Icon name={dashboardCardActionIconByKind[icon]} aria-hidden="true" />
      <span>{text}</span>
    </>
  )
}

function DashboardTagPopoverShell({ state }: { state: DashboardCardViewModel }) {
  return (
    <PopoverRoot open triggerId={`dashboard-tag-toggle-${state.bookmarkId}`}>
      <PopoverPortal keepMounted container={null}>
        <PopoverPositioner
          className="dashboard-tag-popover-positioner"
          anchor={() => document.getElementById(`dashboard-tag-toggle-${state.bookmarkId}`)}
        >
          <PopoverPopup
            id={`dashboard-tag-popover-${state.bookmarkId}`}
            className="dashboard-tag-popover"
            data-dashboard-no-drag
            aria-label="全部标签"
            initialFocus={false}
            finalFocus={false}
          >
            <DashboardTagPopoverContents state={state} />
          </PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </PopoverRoot>
  )
}

function DashboardTagPopoverContents({ state }: { state: DashboardCardViewModel }) {
  return (
    <>
      <strong>全部标签</strong>
      <div className="dashboard-tag-popover-list">
        {state.tags.map((tag) => (
          <span className="dashboard-mini-chip" key={tag}>{tag}</span>
        ))}
      </div>
    </>
  )
}
