import { memo, useCallback, useEffect, useRef, type ComponentPropsWithoutRef, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/icons/Icon'
import { InlineMenu, type InlineMenuAction } from '../../ui/Menu'
import {
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverRoot
} from '../../ui/Popover'
import { Textarea } from '../../ui/Textarea'
import { TextSwap } from '../../ui/motion/TextSwap'
import { handleDashboardViewAction } from '../options-controller'
import { useDashboardViewSelector } from './dashboard-view-store.js'
import { BusyLoadingLabel } from './LoadingLabel.js'
import {
  DASHBOARD_CARD_BODY_CLASS,
  DASHBOARD_CARD_CHECK_CLASS,
  DASHBOARD_CARD_COPY_CLASS,
  DASHBOARD_CARD_COPY_ACTION_CLASS,
  DASHBOARD_CARD_DIMMED_CLASS,
  DASHBOARD_CARD_FAVICON_FALLBACK_CLASS,
  DASHBOARD_CARD_FAVICON_IMAGE_CLASS,
  DASHBOARD_CARD_FAVICON_IMAGE_SELECTED_STATE_CLASS,
  DASHBOARD_CARD_FAVICON_SHELL_CLASS,
  DASHBOARD_CARD_FAVICON_SHELL_SELECTED_STATE_CLASS,
  DASHBOARD_CARD_FOOTER_CLASS,
  DASHBOARD_CARD_MENU_CLASS,
  DASHBOARD_CARD_MENU_ITEM_CLASS,
  DASHBOARD_CARD_MENU_ITEM_DANGER_CLASS,
  DASHBOARD_CARD_META_CLASS,
  DASHBOARD_CARD_MORE_CLASS,
  DASHBOARD_CARD_MORE_MENU_OPEN_STATE_CLASS,
  DASHBOARD_CARD_MORE_TRIGGER_CLASS,
  DASHBOARD_CARD_PATH_CHIP_CLASS,
  DASHBOARD_CARD_OPEN_ACTION_CLASS,
  DASHBOARD_CARD_ROOT_CLASS,
  DASHBOARD_CARD_SELECTED_STATE_CLASS,
  DASHBOARD_CARD_MENU_OPEN_STATE_CLASS,
  DASHBOARD_CARD_STATIC_VISIBILITY_CLASS,
  DASHBOARD_CARD_TAGS_EXPANDED_STATE_CLASS,
  DASHBOARD_CARD_TAG_ROW_CLASS,
  DASHBOARD_CARD_TAG_CHIP_CLASS,
  DASHBOARD_CARD_TAG_TOGGLE_CLASS,
  DASHBOARD_CARD_TITLE_CLASS,
  DASHBOARD_CARD_URL_CLASS,
  DASHBOARD_TAG_POPOVER_CLASS,
  DASHBOARD_TAG_POPOVER_LIST_CLASS,
  DASHBOARD_TAG_POPOVER_POSITIONER_CLASS,
  DASHBOARD_TAG_POPOVER_TITLE_CLASS,
  DASHBOARD_CLEAR_SEARCH_CLASS,
  DASHBOARD_DROP_EMPTY_STATE_CLASS,
  DASHBOARD_DRAG_PREVIEW_TITLE_CLASS,
  DASHBOARD_EMPTY_STATE_ACTIONS_CLASS,
  DASHBOARD_EMPTY_STATE_PRIMARY_ACTION_CLASS,
  DASHBOARD_EMPTY_STATE_SECONDARY_ACTION_CLASS,
  DASHBOARD_EMPTY_STATE_CLASS,
  DASHBOARD_EMPTY_STATE_SUGGESTIONS_CLASS,
  DASHBOARD_EMPTY_STATE_TEXT_CLASS,
  DASHBOARD_EMPTY_STATE_TITLE_CLASS,
  DASHBOARD_FOLDER_BREADCRUMB_CURRENT_CLASS,
  DASHBOARD_FOLDER_BREADCRUMB_CURRENT_ITEM_CLASS,
  DASHBOARD_FOLDER_BREADCRUMB_ITEM_CLASS,
  DASHBOARD_FOLDER_BREADCRUMB_LINK_CLASS,
  DASHBOARD_FOLDER_BREADCRUMB_LIST_CLASS,
  DASHBOARD_FOLDER_TREE_BRANCH_CLASS,
  DASHBOARD_FOLDER_TREE_COUNT_CLASS,
  DASHBOARD_FOLDER_TREE_ITEM_CLASS,
  DASHBOARD_FOLDER_TREE_LABEL_CLASS,
  DASHBOARD_FOLDER_TREE_ROOT_BRANCH_CLASS,
  DASHBOARD_FOLDER_DROP_COPY_CLASS,
  DASHBOARD_FOLDER_DROP_ICON_CLASS,
  DASHBOARD_FOLDER_DROP_META_CLASS,
  DASHBOARD_FOLDER_DROP_PATH_CLASS,
  DASHBOARD_FOLDER_DROP_TITLE_CLASS,
  DASHBOARD_FOLDER_BREADCRUMB_SEPARATOR_CLASS,
  DASHBOARD_FOLDER_DROP_CARD_CLASS,
  DASHBOARD_FOLDER_DROP_CARD_MOVING_STATE_CLASS,
  DASHBOARD_NATURAL_SEARCH_MARKER_CLASS,
  DASHBOARD_NATURAL_SEARCH_LABEL_CLASS,
  DASHBOARD_NATURAL_SEARCH_TOGGLE_CLASS,
  DASHBOARD_NATURAL_SEARCH_TOGGLE_ACTIVE_STATE_CLASS,
  DASHBOARD_NATURAL_SEARCH_TOGGLE_FALLBACK_STATE_CLASS,
  DASHBOARD_SEARCH_CHIPS_CLASS,
  DASHBOARD_SEARCH_CHIP_CLASS,
  DASHBOARD_LOADING_EMPTY_STATE_CLASS,
  DASHBOARD_SELECTION_ACTIONS_CLASS,
  DASHBOARD_SELECTION_BAR_CLASS,
  DASHBOARD_SELECTION_COUNT_CLASS,
  DASHBOARD_SELECTION_DANGER_BUTTON_CLASS,
  DASHBOARD_SELECTION_SECONDARY_BUTTON_CLASS,
  DASHBOARD_VIRTUAL_SPACER_CLASS,
  DASHBOARD_VIRTUAL_WINDOW_CLASS,
  DASHBOARD_TAG_EDITOR_DANGER_BUTTON_CLASS,
  DASHBOARD_TAG_EDITOR_FIELD_CLASS,
  DASHBOARD_TAG_EDITOR_FIELD_LABEL_CLASS,
  DASHBOARD_TAG_EDITOR_AI_ACTIONS_CLASS,
  DASHBOARD_TAG_EDITOR_PRIMARY_BUTTON_CLASS,
  DASHBOARD_TAG_EDITOR_PRIMARY_ACTIONS_CLASS,
  DASHBOARD_TAG_EDITOR_SECONDARY_BUTTON_CLASS,
  DASHBOARD_TAG_EDITOR_TEXTAREA_CLASS
} from './dashboard-classes.js'
import {
  LOADING_LABEL_BUTTON_LOADER_CLASS,
  LOADING_LABEL_BUTTON_WRAPPER_CLASS,
  LOADING_LABEL_STATUS_LOADER_CLASS,
  LOADING_LABEL_STATUS_WRAPPER_CLASS
} from './loading-label-classes.js'
import { OPTION_RESULT_CHECKBOX_CLASS } from './option-layout-classes.js'
import { useOptionsFocusTargetRef } from './options-focus-target-store.js'
import type {
  DashboardBreadcrumbSegmentViewModel,
  DashboardCardActionIcon,
  DashboardCardFaviconViewModel,
  DashboardCardMenuFocusRequestState,
  DashboardCardViewModel,
  DashboardDragPreviewState,
  DashboardEmptyState,
  DashboardEmptyStateAction,
  DashboardFolderDropTargetViewModel,
  DashboardFolderSidebarItemViewModel,
  DashboardLoadingLabelState,
  DashboardSearchChipViewModel,
  DashboardSearchControlsState,
  DashboardResultsState,
  DashboardSelectionBarState,
  DashboardTagEditorActionsState,
  DashboardTagEditorFieldState,
  DashboardTitleState
} from './dashboard-view-types.js'
import { dashboardCardActionIconByKind } from './dashboard-view-types.js'

export function DashboardTitleContent() {
  const title = useDashboardViewSelector((state) => state.title)
  return <DashboardTitle state={title} />
}

export function DashboardCardsTitleContent() {
  const cardsTitle = useDashboardViewSelector((state) => state.cardsTitle)
  return <>{cardsTitle}</>
}

export function DashboardSearchChipsContent() {
  const searchChips = useDashboardViewSelector((state) => state.searchChips)
  return <DashboardSearchChips chips={searchChips} />
}

export function DashboardSearchControlsContent() {
  const searchControls = useDashboardViewSelector((state) => state.searchControls)
  return <DashboardSearchControls state={searchControls} />
}

export function DashboardBreadcrumbsContent() {
  const breadcrumbs = useDashboardViewSelector((state) => state.breadcrumbs)
  return <DashboardBreadcrumbs segments={breadcrumbs} />
}

export function DashboardFolderSidebarCountContent() {
  const countText = useDashboardViewSelector((state) => state.folderSidebar.countText)
  return <>{countText}</>
}

export function DashboardFolderTreeContent() {
  const folderSidebar = useDashboardViewSelector((state) => state.folderSidebar)
  return <DashboardFolderSidebar state={folderSidebar} />
}

export function DashboardStatusContent() {
  const status = useDashboardViewSelector((state) => state.status)
  return <DashboardLoadingLabel state={status} />
}

export function DashboardSelectionBarContent() {
  const selectionBar = useDashboardViewSelector((state) => state.selectionBar)
  return <DashboardSelectionBar state={selectionBar} />
}

export function DashboardResultsContent() {
  const cardMenuFocusRequest = useDashboardViewSelector((state) => state.cardMenuFocusRequest)
  const dragOverlayVisible = useDashboardViewSelector((state) => state.dragOverlay.visible)
  const results = useDashboardViewSelector((state) => state.results)
  return <DashboardResults state={results} focusRequest={cardMenuFocusRequest} dimCards={dragOverlayVisible} />
}

export type DashboardCardElementRegistrar = (bookmarkId: string, node: HTMLElement | null) => void

export function DashboardResults({
  dimCards,
  focusRequest,
  registerCardElement,
  state
}: {
  dimCards?: boolean
  focusRequest: DashboardCardMenuFocusRequestState
  registerCardElement?: DashboardCardElementRegistrar
  state: DashboardResultsState
}) {
  if (state.mode === 'empty') {
    return <DashboardEmptyStatePanel state={state.empty} />
  }
  if (state.mode === 'static') {
    return (
      <>
        {state.cards.map((cardState) => (
          <DashboardCard
            state={cardState}
            dimmed={Boolean(dimCards)}
            focusRequest={focusRequest}
            registerCardElement={registerCardElement}
            staticVisibility
            key={cardState.bookmarkId}
          />
        ))}
      </>
    )
  }
  return (
    <div className={DASHBOARD_VIRTUAL_SPACER_CLASS} style={{ height: `${Math.ceil(state.totalHeight)}px` }}>
      <div
        className={DASHBOARD_VIRTUAL_WINDOW_CLASS}
        style={{
          gridTemplateColumns: `repeat(${state.columnCount}, minmax(0, 1fr))`,
          transform: `translate3d(0, ${Math.round(state.offsetY)}px, 0)`
        }}
      >
        {state.cards.map((cardState) => (
          <DashboardCard
            state={cardState}
            dimmed={Boolean(dimCards)}
            focusRequest={focusRequest}
            registerCardElement={registerCardElement}
            key={cardState.bookmarkId}
          />
        ))}
      </div>
    </div>
  )
}

export function DashboardFolderDropGridContent() {
  const dropTargets = useDashboardViewSelector((state) => state.dragOverlay.dropTargets)
  const moving = useDashboardViewSelector((state) => state.dragOverlay.moving)
  return <DashboardFolderDropGrid targets={dropTargets} moving={moving} />
}

export function DashboardDragPreviewContent() {
  const dragPreview = useDashboardViewSelector((state) => state.dragOverlay.dragPreview)
  return dragPreview ? <DashboardDragPreview state={dragPreview} /> : null
}

export function DashboardDragHintContent() {
  const dragHint = useDashboardViewSelector((state) => state.dragOverlay.dragHint)
  return <DashboardLoadingLabel state={dragHint} />
}

export function DashboardTagEditorTitleContent() {
  const title = useDashboardViewSelector((state) => state.tagEditor.title)
  return <>{title}</>
}

export function DashboardTagEditorMetaContent() {
  const meta = useDashboardViewSelector((state) => state.tagEditor.meta)
  return <>{meta}</>
}

export function DashboardTagEditorFieldContent() {
  const tagEditor = useDashboardViewSelector((state) => state.tagEditor)
  return tagEditor.visible ? <DashboardTagEditorField state={tagEditor.field} /> : null
}

export function DashboardTagEditorStatusContent() {
  const status = useDashboardViewSelector((state) => state.tagEditor.status)
  return <>{status}</>
}

export function DashboardTagEditorActionsContent() {
  const tagEditor = useDashboardViewSelector((state) => state.tagEditor)
  return tagEditor.visible ? <DashboardTagEditorActions state={tagEditor.actions} /> : null
}

function DashboardTitle({ state }: { state: DashboardTitleState }) {
  return (
    <>
      {state.title} <span>{state.countText}</span>
    </>
  )
}

function DashboardSearchChips({ chips }: { chips: DashboardSearchChipViewModel[] }) {
  return (
    <div className={DASHBOARD_SEARCH_CHIPS_CLASS} aria-label="当前搜索条件">
      {chips.map((chip) => (
        <span className={DASHBOARD_SEARCH_CHIP_CLASS} key={`${chip.kind}:${chip.label}`}>
          {chip.label}
        </span>
      ))}
    </div>
  )
}

function DashboardSearchControls({ state }: { state: DashboardSearchControlsState }) {
  const natural = state.natural
  const naturalToggleStateClass = natural.fallback
    ? DASHBOARD_NATURAL_SEARCH_TOGGLE_FALLBACK_STATE_CLASS
    : natural.active
      ? DASHBOARD_NATURAL_SEARCH_TOGGLE_ACTIVE_STATE_CLASS
      : ''

  return (
    <>
      <Button
        className={DASHBOARD_CLEAR_SEARCH_CLASS}
        type="button"
        hidden={!state.showClearSearch}
        aria-label="清空 Dashboard 搜索"
        onClick={() => handleDashboardViewAction({ action: 'clear-search' })}
        unstyled
      >
        <Icon name="X" size={14} aria-hidden="true" />
      </Button>
      <Button
        className={[
          DASHBOARD_NATURAL_SEARCH_TOGGLE_CLASS,
          naturalToggleStateClass
        ].filter(Boolean).join(' ')}
        type="button"
        aria-pressed={natural.active ? 'true' : 'false'}
        aria-label={natural.ariaLabel}
        title={natural.title}
        onClick={() => handleDashboardViewAction({ action: 'toggle-natural-search' })}
        unstyled
      >
        {natural.pending ? <span className={DASHBOARD_NATURAL_SEARCH_MARKER_CLASS} aria-hidden="true" /> : null}
        <span className={DASHBOARD_NATURAL_SEARCH_LABEL_CLASS}>{natural.label}</span>
      </Button>
    </>
  )
}

function DashboardBreadcrumbs({ segments }: { segments: DashboardBreadcrumbSegmentViewModel[] }) {
  if (!segments.length) {
    return null
  }

  return (
    <ol className={DASHBOARD_FOLDER_BREADCRUMB_LIST_CLASS}>
      {segments.map((segment, index) => (
        <FragmentWithSeparator index={index} isLast={index === segments.length - 1} key={getDashboardBreadcrumbSegmentKey(segment)}>
          {segment.current || !segment.id ? (
            <span className={DASHBOARD_FOLDER_BREADCRUMB_CURRENT_CLASS} aria-current="page" title={segment.path}>
              {segment.label}
            </span>
          ) : (
            <Button
              className={DASHBOARD_FOLDER_BREADCRUMB_LINK_CLASS}
              type="button"
              title={segment.path}
              onClick={() => handleDashboardViewAction({
                action: 'folder-filter',
                bookmarkId: segment.id
              })}
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

function getDashboardBreadcrumbSegmentKey(segment: DashboardBreadcrumbSegmentViewModel): string {
  return [
    segment.id || 'current',
    segment.path,
    segment.label,
    segment.current ? 'current' : 'link'
  ].join(':')
}

function FragmentWithSeparator({
  children,
  index,
  isLast
}: {
  children: ReactNode
  index: number
  isLast: boolean
}) {
  return (
    <>
      {index === 0 ? null : <li className={DASHBOARD_FOLDER_BREADCRUMB_SEPARATOR_CLASS} aria-hidden="true">&gt;</li>}
      <li className={[DASHBOARD_FOLDER_BREADCRUMB_ITEM_CLASS, isLast ? DASHBOARD_FOLDER_BREADCRUMB_CURRENT_ITEM_CLASS : ''].filter(Boolean).join(' ')}>
        {children}
      </li>
    </>
  )
}

function DashboardFolderSidebar({ state }: { state: { focusRequestId: string; items: DashboardFolderSidebarItemViewModel[] } }) {
  const itemRefs = useRef<Map<string, HTMLButtonElement> | null>(null)
  const items = state.items
  if (!itemRefs.current) {
    itemRefs.current = new Map()
  }

  useEffect(() => {
    if (!state.focusRequestId) {
      return
    }

    window.requestAnimationFrame(() => {
      itemRefs.current?.get(state.focusRequestId)?.focus({ preventScroll: true })
    })
  }, [state.focusRequestId, items])

  const setItemRef = (id: string) => (node: HTMLButtonElement | null) => {
    if (node) {
      itemRefs.current?.set(id, node)
      return
    }
    itemRefs.current?.delete(id)
  }

  const handleFolderKeyDown = (event: KeyboardEvent<HTMLButtonElement>, itemId: string) => {
    const nextId = getDashboardFolderKeyboardTargetId(event.key, items, itemId)
    if (!nextId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    itemRefs.current.get(nextId)?.focus()
    handleDashboardViewAction({
      action: 'folder-filter-focus',
      bookmarkId: nextId
    })
  }

  return (
    <>
      {items.map((item, index) => {
        const clampedDepth = Math.min(Math.max(Number(item.depth) || 0, 0), 8)
        const countLabel = `${Number(item.count) || 0} 个书签`
        const pathText = item.path || item.title || '未命名文件夹'
        const titleText = item.title || '未命名文件夹'
        const style = { '--folder-depth-offset': `${clampedDepth * 13}px` } as CSSProperties

        return (
          <Button
            className={DASHBOARD_FOLDER_TREE_ITEM_CLASS}
            type="button"
            role="option"
            aria-selected={item.active ? 'true' : 'false'}
            tabIndex={item.active ? 0 : -1}
            aria-current={item.active ? 'page' : undefined}
            aria-label={`${pathText}，${countLabel}`}
            title={pathText}
            style={style}
            key={item.id}
            ref={setItemRef(item.id)}
            onClick={() => handleDashboardViewAction({
              action: 'folder-filter',
              bookmarkId: item.id
            })}
            onKeyDown={(event) => handleFolderKeyDown(event, item.id)}
            unstyled
          >
            <span
              className={index === 0 ? DASHBOARD_FOLDER_TREE_ROOT_BRANCH_CLASS : DASHBOARD_FOLDER_TREE_BRANCH_CLASS}
              aria-hidden="true"
            ></span>
            <span className={DASHBOARD_FOLDER_TREE_LABEL_CLASS}>{titleText}</span>
            <span
              className={DASHBOARD_FOLDER_TREE_COUNT_CLASS}
              title={countLabel}
            >
              {Number(item.count) || 0}
            </span>
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
    <BusyLoadingLabel
      label={state.label}
      loaderClassName={state.loaderClass}
      variant={state.variant}
      wrapperClassName={state.wrapperClass}
    />
  )
}

function DashboardEmptyStatePanel({ state }: { state: DashboardEmptyState }) {
  return (
    <div className={state.loading ? DASHBOARD_LOADING_EMPTY_STATE_CLASS : DASHBOARD_EMPTY_STATE_CLASS}>
      {state.loading ? (
        <DashboardLoadingLabel
          state={{
            busy: true,
            label: state.message,
            loaderClass: LOADING_LABEL_STATUS_LOADER_CLASS,
            variant: 'spiral',
            wrapperClass: LOADING_LABEL_STATUS_WRAPPER_CLASS
          }}
        />
      ) : (
        <>
          <strong className={DASHBOARD_EMPTY_STATE_TITLE_CLASS}>{state.title}</strong>
          <p className={DASHBOARD_EMPTY_STATE_TEXT_CLASS}>{state.message}</p>
          {state.suggestions.length ? (
            <ul className={DASHBOARD_EMPTY_STATE_SUGGESTIONS_CLASS}>
              {state.suggestions.map((suggestion) => (
                <li key={suggestion}>{suggestion}</li>
              ))}
            </ul>
          ) : null}
          {state.actions.length ? (
            <div className={DASHBOARD_EMPTY_STATE_ACTIONS_CLASS}>
              {state.actions.map((action) => (
                <Button
                  className={
                    action.variant === 'primary'
                      ? DASHBOARD_EMPTY_STATE_PRIMARY_ACTION_CLASS
                      : DASHBOARD_EMPTY_STATE_SECONDARY_ACTION_CLASS
                  }
                  type="button"
                  variant={action.variant}
                  key={`${action.action}:${action.bookmarkId || ''}:${action.label}`}
                  onClick={() => handleDashboardEmptyStateAction(action)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function handleDashboardEmptyStateAction(action: DashboardEmptyStateAction): void {
  if (action.action === 'clear-search') {
    handleDashboardViewAction({ action: 'clear-search' })
    return
  }

  if (action.action === 'folder-filter') {
    handleDashboardViewAction({
      action: 'folder-filter',
      bookmarkId: action.bookmarkId || ''
    })
    return
  }

  handleDashboardViewAction({ action: 'exit-dashboard' })
}

function DashboardFolderDropGrid({ targets, moving }: { targets: DashboardFolderDropTargetViewModel[]; moving: boolean }) {
  if (!targets.length) {
    return <div className={DASHBOARD_DROP_EMPTY_STATE_CLASS}>没有可用的目标文件夹。</div>
  }

  return (
    <>
      {targets.map((target) => {
        const folderCopy = target.folderCount ? ` · ${target.folderCount} 个子文件夹` : ''
        return (
          <Button
            className={[
              DASHBOARD_FOLDER_DROP_CARD_CLASS,
              moving ? DASHBOARD_FOLDER_DROP_CARD_MOVING_STATE_CLASS : ''
            ].filter(Boolean).join(' ')}
            type="button"
            role="option"
            aria-selected={target.active ? 'true' : 'false'}
            title={target.path}
            key={target.id}
            onPointerEnter={() => {
              handleDashboardViewAction({
                action: 'drag-hover-delete',
                active: false
              })
              handleDashboardViewAction({
                action: 'drag-hover-folder',
                bookmarkId: target.id
              })
            }}
            onPointerLeave={() => {
              handleDashboardViewAction({
                action: 'drag-hover-folder',
                bookmarkId: ''
              })
            }}
            unstyled
          >
            <span className={DASHBOARD_FOLDER_DROP_ICON_CLASS} aria-hidden="true"></span>
            <span className={DASHBOARD_FOLDER_DROP_COPY_CLASS}>
              <strong className={DASHBOARD_FOLDER_DROP_TITLE_CLASS}>{target.title}</strong>
              <span className={DASHBOARD_FOLDER_DROP_PATH_CLASS}>{target.path}</span>
              <small className={DASHBOARD_FOLDER_DROP_META_CLASS}>{`${target.bookmarkCount} 个书签${folderCopy}`}</small>
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
      <DashboardFaviconShell
        bookmarkId=""
        fallbackLabel={state.fallbackLabel}
        favicon={state.favicon}
      />
      <span className={DASHBOARD_DRAG_PREVIEW_TITLE_CLASS}>{state.title}</span>
    </>
  )
}

function DashboardSelectionBar({ state }: { state: DashboardSelectionBarState }) {
  const moveSelectionRef = useOptionsFocusTargetRef<HTMLButtonElement>('dashboard-move-selection')

  return (
    <div className={DASHBOARD_SELECTION_BAR_CLASS}>
      <strong className={DASHBOARD_SELECTION_COUNT_CLASS}>
        <TextSwap text={`${state.selectedCount} 条已选择`} />
      </strong>
      <div className={DASHBOARD_SELECTION_ACTIONS_CLASS}>
        <Button
          className={DASHBOARD_SELECTION_SECONDARY_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="选择当前可见的 Dashboard 书签"
          disabled={!state.canSelectVisible}
          onClick={() => handleDashboardViewAction({ action: 'select-visible' })}
        >
          选择当前可见
        </Button>
        <Button
          className={DASHBOARD_SELECTION_SECONDARY_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="清空 Dashboard 已选书签"
          disabled={state.selectionActionsDisabled}
          onClick={() => handleDashboardViewAction({ action: 'clear-selection' })}
        >
          清空选择
        </Button>
        <Button
          ref={moveSelectionRef}
          className={DASHBOARD_SELECTION_SECONDARY_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="批量移动 Dashboard 已选书签"
          disabled={state.selectionActionsDisabled}
          onClick={() => handleDashboardViewAction({ action: 'move-selected' })}
        >
          批量移动
        </Button>
        <Button
          className={DASHBOARD_SELECTION_DANGER_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="danger"
          aria-label="批量删除 Dashboard 已选书签"
          disabled={state.selectionActionsDisabled}
          onClick={() => handleDashboardViewAction({ action: 'delete-selected' })}
        >
          批量删除
        </Button>
      </div>
    </div>
  )
}

function DashboardTagEditorActions({ state }: { state: DashboardTagEditorActionsState }) {
  return (
    <>
      <div className={DASHBOARD_TAG_EDITOR_AI_ACTIONS_CLASS} aria-label="AI 标签操作">
        <Button
          className={DASHBOARD_TAG_EDITOR_SECONDARY_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="清除当前 Dashboard 书签的 AI 标签"
          disabled={state.clearAiDisabled}
          focusableWhenDisabled={state.clearAiBusy}
          onClick={() => handleDashboardViewAction({ action: 'clear-ai-tags' })}
        >
          <DashboardLoadingLabel
            state={{
              busy: state.clearAiBusy,
              label: state.clearAiBusy ? '清除中...' : '清除 AI 标签',
              loaderClass: LOADING_LABEL_BUTTON_LOADER_CLASS,
              variant: 'bar',
              wrapperClass: LOADING_LABEL_BUTTON_WRAPPER_CLASS
            }}
          />
        </Button>
        <Button
          className={DASHBOARD_TAG_EDITOR_SECONDARY_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="重新生成当前 Dashboard 书签的 AI 标签"
          disabled={state.regenerateAiDisabled}
          focusableWhenDisabled={state.regenerateAiBusy}
          onClick={() => handleDashboardViewAction({ action: 'regenerate-ai-tags' })}
        >
          <DashboardLoadingLabel
            state={{
              busy: state.regenerateAiBusy,
              label: state.regenerateAiBusy ? '生成中...' : '重新生成 AI 标签',
              loaderClass: LOADING_LABEL_BUTTON_LOADER_CLASS,
              variant: 'spiral',
              wrapperClass: LOADING_LABEL_BUTTON_WRAPPER_CLASS
            }}
          />
        </Button>
      </div>
      <div className={DASHBOARD_TAG_EDITOR_PRIMARY_ACTIONS_CLASS}>
        <Button
          className={
            state.cancelDanger
              ? DASHBOARD_TAG_EDITOR_DANGER_BUTTON_CLASS
              : DASHBOARD_TAG_EDITOR_SECONDARY_BUTTON_CLASS
          }
          size="sm"
          type="button"
          variant={state.cancelDanger ? 'danger' : 'secondary'}
          aria-label="取消编辑当前 Dashboard 书签标签"
          disabled={state.cancelDisabled}
          focusableWhenDisabled={state.cancelDanger}
          onClick={() => handleDashboardViewAction({ action: 'close-tag-editor' })}
        >
          {state.cancelLabel}
        </Button>
        <Button
          className={DASHBOARD_TAG_EDITOR_PRIMARY_BUTTON_CLASS}
          size="sm"
          type="button"
          aria-label="保存当前 Dashboard 书签标签"
          disabled={state.saveDisabled}
          focusableWhenDisabled={state.saveBusy}
          onClick={() => handleDashboardViewAction({ action: 'save-tags' })}
        >
          <DashboardLoadingLabel
            state={{
              busy: state.saveBusy,
              label: state.saveBusy ? '保存中...' : '保存标签',
              loaderClass: LOADING_LABEL_BUTTON_LOADER_CLASS,
              variant: 'bar',
              wrapperClass: LOADING_LABEL_BUTTON_WRAPPER_CLASS
            }}
          />
        </Button>
      </div>
    </>
  )
}

function DashboardTagEditorField({ state }: { state: DashboardTagEditorFieldState }) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const textareaId = 'dashboard-tag-editor-tags'

  useEffect(() => {
    if (!state.focusRequestId) {
      return
    }

    window.setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }, [state.focusRequestId])

  return (
    <label className={DASHBOARD_TAG_EDITOR_FIELD_CLASS} htmlFor={textareaId}>
      <span className={DASHBOARD_TAG_EDITOR_FIELD_LABEL_CLASS}>标签</span>
      <Textarea
        id={textareaId}
        className={DASHBOARD_TAG_EDITOR_TEXTAREA_CLASS}
        key={state.value}
        ref={textareaRef}
        defaultValue={state.value}
        disabled={state.disabled}
        rows={5}
        placeholder="用逗号、顿号或换行分隔标签"
        onChange={(event) => {
          handleDashboardViewAction({
            action: 'tag-editor-draft-change',
            value: event.currentTarget.value
          })
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') {
            return
          }
          event.preventDefault()
          handleDashboardViewAction({ action: 'close-tag-editor' })
        }}
      />
    </label>
  )
}

function getDashboardFolderKeyboardTargetId(
  key: string,
  items: DashboardFolderSidebarItemViewModel[],
  currentId: string
): string {
  if (
    key !== 'ArrowDown' &&
    key !== 'ArrowRight' &&
    key !== 'ArrowUp' &&
    key !== 'ArrowLeft' &&
    key !== 'Home' &&
    key !== 'End'
  ) {
    return ''
  }

  if (!items.length) {
    return ''
  }

  const currentIndex = Math.max(0, items.findIndex((item) => item.id === currentId))
  if (key === 'ArrowDown' || key === 'ArrowRight') {
    return items[Math.min(items.length - 1, currentIndex + 1)]?.id || ''
  }
  if (key === 'ArrowUp' || key === 'ArrowLeft') {
    return items[Math.max(0, currentIndex - 1)]?.id || ''
  }
  if (key === 'Home') {
    return items[0]?.id || ''
  }
  return items[items.length - 1]?.id || ''
}

const DashboardCard = memo(function DashboardCard({
  dimmed,
  state,
  focusRequest,
  registerCardElement,
  staticVisibility
}: {
  dimmed: boolean
  state: DashboardCardViewModel
  focusRequest: DashboardCardMenuFocusRequestState
  registerCardElement?: DashboardCardElementRegistrar
  staticVisibility?: boolean
}) {
  const dragPointerIdRef = useRef<number | null>(null)
  const interactionsEnabled = state.interactionMode === 'full'
  const setCardRef = useCallback((node: HTMLElement | null) => {
    registerCardElement?.(state.bookmarkId, node)
  }, [registerCardElement, state.bookmarkId])

  useEffect(() => {
    if (!dimmed) {
      dragPointerIdRef.current = null
    }
  }, [dimmed])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target
    if (
      event.button !== 0 ||
      !event.isPrimary ||
      !(target instanceof HTMLElement) ||
      isDashboardCardDragIgnored(event.nativeEvent, event.currentTarget)
    ) {
      return
    }

    dragPointerIdRef.current = event.pointerId
    handleDashboardViewAction({
      action: 'drag-start-card',
      bookmarkId: state.bookmarkId,
      captureElement: event.currentTarget,
      event: event.nativeEvent
    })
  }, [state.bookmarkId])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) {
      return
    }

    handleDashboardViewAction({
      action: 'drag-pointer-move',
      event: event.nativeEvent
    })
  }, [])

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) {
      return
    }

    dragPointerIdRef.current = null
    handleDashboardViewAction({
      action: 'drag-pointer-up',
      event: event.nativeEvent
    })
  }, [])

  const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) {
      return
    }

    dragPointerIdRef.current = null
    handleDashboardViewAction({ action: 'drag-pointer-cancel' })
  }, [])

  const handleLostPointerCapture = useCallback(() => {
    dragPointerIdRef.current = null
  }, [])

  return (
    <article
      ref={setCardRef}
      data-bookmark-id={state.bookmarkId}
      data-render-mode={state.renderMode}
      onPointerDown={interactionsEnabled ? handlePointerDown : undefined}
      onPointerMove={interactionsEnabled ? handlePointerMove : undefined}
      onPointerUp={interactionsEnabled ? handlePointerUp : undefined}
      onPointerCancel={interactionsEnabled ? handlePointerCancel : undefined}
      onLostPointerCapture={interactionsEnabled ? handleLostPointerCapture : undefined}
      className={[
        DASHBOARD_CARD_ROOT_CLASS,
        state.selected ? DASHBOARD_CARD_SELECTED_STATE_CLASS : '',
        staticVisibility ? DASHBOARD_CARD_STATIC_VISIBILITY_CLASS : '',
        dimmed ? DASHBOARD_CARD_DIMMED_CLASS : '',
        state.activeMenu ? DASHBOARD_CARD_MENU_OPEN_STATE_CLASS : '',
        state.expanded ? DASHBOARD_CARD_TAGS_EXPANDED_STATE_CLASS : ''
      ].filter(Boolean).join(' ')}
    >
      <DashboardCardContents state={state} focusRequest={focusRequest} />
    </article>
  )
}, areDashboardCardPropsEqual)

function areDashboardCardPropsEqual(
  previous: {
    dimmed: boolean
    state: DashboardCardViewModel
    focusRequest: DashboardCardMenuFocusRequestState
    registerCardElement?: DashboardCardElementRegistrar
    staticVisibility?: boolean
  },
  next: {
    dimmed: boolean
    state: DashboardCardViewModel
    focusRequest: DashboardCardMenuFocusRequestState
    registerCardElement?: DashboardCardElementRegistrar
    staticVisibility?: boolean
  }
): boolean {
  return (
    previous.dimmed === next.dimmed &&
    previous.registerCardElement === next.registerCardElement &&
    Boolean(previous.staticVisibility) === Boolean(next.staticVisibility) &&
    getDashboardCardFocusRequestId(previous.focusRequest, previous.state.bookmarkId) ===
      getDashboardCardFocusRequestId(next.focusRequest, next.state.bookmarkId) &&
    areDashboardCardStatesEqual(previous.state, next.state)
  )
}

function getDashboardCardFocusRequestId(
  focusRequest: DashboardCardMenuFocusRequestState,
  bookmarkId: string
): number {
  return focusRequest.bookmarkId === bookmarkId ? focusRequest.requestId : 0
}

function areDashboardCardStatesEqual(previous: DashboardCardViewModel, next: DashboardCardViewModel): boolean {
  if (previous === next) {
    return true
  }

  return (
    previous.activeMenu === next.activeMenu &&
    previous.bookmarkId === next.bookmarkId &&
    previous.copyActionLabel === next.copyActionLabel &&
    previous.copyText === next.copyText &&
    previous.copyTooltip === next.copyTooltip &&
    previous.deleting === next.deleting &&
    previous.deleteLabel === next.deleteLabel &&
    previous.displayUrl === next.displayUrl &&
    previous.editTagsLabel === next.editTagsLabel &&
    previous.expanded === next.expanded &&
    previous.fallbackLabel === next.fallbackLabel &&
    areDashboardFaviconsEqual(previous.favicon, next.favicon) &&
    previous.hiddenTagCount === next.hiddenTagCount &&
    previous.interactionMode === next.interactionMode &&
    previous.itemPath === next.itemPath &&
    previous.moreLabel === next.moreLabel &&
    previous.moveLabel === next.moveLabel &&
    previous.openLabel === next.openLabel &&
    previous.parentId === next.parentId &&
    previous.renderMode === next.renderMode &&
    previous.selected === next.selected &&
    previous.selectionLabel === next.selectionLabel &&
    previous.speedDialActionLabel === next.speedDialActionLabel &&
    previous.speedDialActionText === next.speedDialActionText &&
    previous.speedDialPinned === next.speedDialPinned &&
    previous.title === next.title &&
    previous.url === next.url &&
    areStringArraysEqual(previous.tags, next.tags) &&
    areStringArraysEqual(previous.visibleTags, next.visibleTags)
  )
}

function areDashboardFaviconsEqual(
  previous: DashboardCardFaviconViewModel | null,
  next: DashboardCardFaviconViewModel | null
): boolean {
  return (
    previous === next ||
    Boolean(previous) === Boolean(next) &&
      previous?.pageUrl === next?.pageUrl &&
      previous?.source === next?.source &&
      previous?.src === next?.src
  )
}

function areStringArraysEqual(previous: string[], next: string[]): boolean {
  if (previous === next) {
    return true
  }
  return previous.length === next.length && previous.every((value, index) => value === next[index])
}

const DASHBOARD_CARD_DRAG_IGNORED_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'LABEL', 'SELECT', 'TEXTAREA'])

function isDashboardCardDragIgnored(event: PointerEvent, card: HTMLElement): boolean {
  for (const item of event.composedPath()) {
    if (item === card) {
      return false
    }

    if (
      item instanceof HTMLElement &&
      card.contains(item) &&
      DASHBOARD_CARD_DRAG_IGNORED_TAGS.has(item.tagName)
    ) {
      return true
    }
  }

  return false
}

function stopDashboardCardDragPropagation(event: ReactPointerEvent<HTMLElement>) {
  event.stopPropagation()
}

function DashboardCardContents({
  state,
  focusRequest
}: {
  state: DashboardCardViewModel
  focusRequest: DashboardCardMenuFocusRequestState
}) {
  const isScrollCard = state.renderMode === 'scroll'
  const hasFullContent = !isScrollCard
  const hasFullInteractions = hasFullContent && state.interactionMode === 'full'
  const tagRowVisible = hasFullContent && (state.visibleTags.length > 0 || state.hiddenTagCount > 0)
  const tagToggleRef = useRef<HTMLButtonElement | null>(null)
  const tagsPanelId = getDashboardTagsPanelId(state.bookmarkId)
  const tagPopoverOpen = hasFullInteractions && state.expanded && state.tags.length > 0

  return (
    <>
      {hasFullContent ? (
        <span className={DASHBOARD_CARD_CHECK_CLASS}>
          {hasFullInteractions ? (
            <button
              type="button"
              role="checkbox"
              aria-label={state.selectionLabel}
              aria-checked={state.selected ? 'true' : 'false'}
              className={OPTION_RESULT_CHECKBOX_CLASS}
              disabled={state.deleting}
              data-checked={state.selected ? '' : undefined}
              data-disabled={state.deleting ? '' : undefined}
              onClick={() => handleDashboardViewAction({
                action: 'toggle-selection',
                bookmarkId: state.bookmarkId,
                checked: !state.selected
              })}
            >
              <Icon name="Check" size={13} className={state.selected ? '' : 'opacity-0'} aria-hidden="true" />
            </button>
          ) : (
            <span
              role="presentation"
              className={OPTION_RESULT_CHECKBOX_CLASS}
              data-checked={state.selected ? '' : undefined}
              data-disabled={state.deleting ? '' : undefined}
            >
              <Icon name="Check" size={13} className={state.selected ? '' : 'opacity-0'} aria-hidden="true" />
            </span>
          )}
          <span className="sr-only">{state.selectionLabel}</span>
        </span>
      ) : null}
      <div className={DASHBOARD_CARD_BODY_CLASS}>
        <DashboardFavicon state={state} />
        <div className={DASHBOARD_CARD_COPY_CLASS}>
          <strong className={DASHBOARD_CARD_TITLE_CLASS} title={state.title}>{state.title}</strong>
          <a
            className={DASHBOARD_CARD_URL_CLASS}
            href={state.url}
            target="_blank"
            rel="noreferrer noopener"
            draggable={false}
          >
            {state.displayUrl}
          </a>
          <div className={DASHBOARD_CARD_META_CLASS}>
            {!hasFullInteractions ? (
              <span className={DASHBOARD_CARD_PATH_CHIP_CLASS} title={state.itemPath}>
                {state.itemPath}
              </span>
            ) : (
              <button
                className={DASHBOARD_CARD_PATH_CHIP_CLASS}
                type="button"
                title={state.itemPath}
                aria-label={`按文件夹筛选：${state.itemPath}`}
                onClick={() => handleDashboardViewAction({
                  action: 'folder-filter',
                  bookmarkId: state.parentId
                })}
              >
                {state.itemPath}
              </button>
            )}
            {tagRowVisible ? (
              <div className={DASHBOARD_CARD_TAG_ROW_CLASS}>
                {state.visibleTags.map((tag) => (
                  <span className={DASHBOARD_CARD_TAG_CHIP_CLASS} key={tag}>{tag}</span>
                ))}
                {state.hiddenTagCount > 0 && hasFullInteractions ? (
                  <Button
                    id={`dashboard-tag-more-${state.bookmarkId}`}
                    ref={tagToggleRef}
                    className={DASHBOARD_CARD_TAG_TOGGLE_CLASS}
                    type="button"
                    aria-expanded={state.expanded ? 'true' : 'false'}
                    aria-controls={tagsPanelId}
                    aria-label={`查看 ${state.hiddenTagCount} 个隐藏标签`}
                    onClick={() => {
                      if (state.expanded) {
                        return
                      }
                      handleDashboardViewAction({
                        action: 'toggle-tags',
                        bookmarkId: state.bookmarkId
                      })
                    }}
                    onPointerEnter={() => handleDashboardViewAction({
                      action: 'tag-hover-open',
                      bookmarkId: state.bookmarkId
                    })}
                    onPointerLeave={(event) => {
                      if (isDashboardTagPopoverTransition(event.relatedTarget, state.bookmarkId)) {
                        return
                      }
                      handleDashboardViewAction({
                        action: 'tag-hover-close',
                        bookmarkId: state.bookmarkId
                      })
                    }}
                    unstyled
                  >
                    +{state.hiddenTagCount}
                  </Button>
                ) : state.hiddenTagCount > 0 ? (
                  <span className={DASHBOARD_CARD_TAG_TOGGLE_CLASS}>
                    +{state.hiddenTagCount}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {hasFullContent ? (
        <div className={DASHBOARD_CARD_FOOTER_CLASS}>
          <DashboardCardAction
            as="a"
            icon="open"
            label={state.openLabel}
            tooltip="打开书签"
            className={DASHBOARD_CARD_OPEN_ACTION_CLASS}
            href={state.url}
            text="打开"
          />
          <DashboardCardAction
            icon="copy"
            label={state.copyActionLabel}
            tooltip={state.copyTooltip}
            className={DASHBOARD_CARD_COPY_ACTION_CLASS}
            onClick={() => handleDashboardViewAction({
              action: 'copy-bookmark',
              bookmarkId: state.bookmarkId
            })}
            text={state.copyText}
          />
          <DashboardCardMoreMenu state={state} focusRequest={focusRequest} />
        </div>
      ) : null}
      {hasFullInteractions && tagPopoverOpen ? (
        <DashboardTagPopoverShell
          open
          state={state}
          triggerRef={tagToggleRef}
        />
      ) : null}
    </>
  )
}

function DashboardCardMoreMenu({
  state,
  focusRequest
}: {
  state: DashboardCardViewModel
  focusRequest: DashboardCardMenuFocusRequestState
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const focusRequestId = focusRequest.bookmarkId === state.bookmarkId ? focusRequest.requestId : 0

  return (
    <div
      className={[
        DASHBOARD_CARD_MORE_CLASS,
        state.activeMenu ? DASHBOARD_CARD_MORE_MENU_OPEN_STATE_CLASS : ''
      ].filter(Boolean).join(' ')}
      onPointerDown={stopDashboardCardDragPropagation}
    >
      {state.activeMenu ? (
        <InlineMenu
          actions={getDashboardCardMenuActions(state)}
          className={DASHBOARD_CARD_MENU_CLASS}
          label={state.moreLabel}
          open
          onOpenChange={(open, eventDetails) => {
            if (!open && eventDetails.reason === 'escape-key') {
              eventDetails.event.preventDefault()
              eventDetails.event.stopPropagation()
            }

            handleDashboardViewAction({
              action: 'card-menu-open-change',
              bookmarkId: state.bookmarkId,
              open
            })
          }}
          trigger={
            <>
              <Icon name="MoreHorizontal" aria-hidden="true" />
              <span className="sr-only">更多</span>
            </>
          }
          triggerProps={{
            className: DASHBOARD_CARD_MORE_TRIGGER_CLASS,
            type: 'button',
            'aria-label': state.moreLabel,
            'aria-haspopup': 'menu',
            'aria-expanded': 'true',
            title: '更多操作',
            ref: triggerRef
          }}
        />
      ) : (
        <button
          ref={triggerRef}
          className={DASHBOARD_CARD_MORE_TRIGGER_CLASS}
          type="button"
          aria-label={state.moreLabel}
          aria-haspopup="menu"
          aria-expanded="false"
          title="更多操作"
          onClick={() => handleDashboardViewAction({
            action: 'card-menu-open-change',
            bookmarkId: state.bookmarkId,
            open: true
          })}
        >
          <Icon name="MoreHorizontal" aria-hidden="true" />
          <span className="sr-only">更多</span>
        </button>
      )}
      {focusRequestId ? (
        <DashboardCardMoreFocusRestorer
          focusRequestId={focusRequestId}
          triggerRef={triggerRef}
        />
      ) : null}
    </div>
  )
}

function DashboardCardMoreFocusRestorer({
  focusRequestId,
  triggerRef
}: {
  focusRequestId: number
  triggerRef: RefObject<HTMLButtonElement | null>
}) {
  useEffect(() => {
    window.setTimeout(() => {
      triggerRef.current?.focus()
    }, 0)
  }, [focusRequestId, triggerRef])

  return null
}

function getDashboardCardMenuActions(state: DashboardCardViewModel): InlineMenuAction[] {
  return [
    {
      id: 'edit-tags',
      label: <DashboardCardMenuItemContent icon="tag" text="修改标签" />,
      className: DASHBOARD_CARD_MENU_ITEM_CLASS,
      attributes: getDashboardCardMenuItemAttributes({
        label: state.editTagsLabel
      }),
      onSelect: () => handleDashboardViewAction({
        action: 'edit-tags',
        bookmarkId: state.bookmarkId
      })
    },
    {
      id: 'toggle-speed-dial',
      label: <DashboardCardMenuItemContent icon="speed-dial" text={state.speedDialActionText} />,
      className: DASHBOARD_CARD_MENU_ITEM_CLASS,
      attributes: getDashboardCardMenuItemAttributes({
        label: state.speedDialActionLabel,
        pressed: state.speedDialPinned
      }),
      onSelect: () => handleDashboardViewAction({
        action: 'toggle-speed-dial',
        bookmarkId: state.bookmarkId
      })
    },
    {
      id: 'move-one',
      label: <DashboardCardMenuItemContent icon="move" text="移动" />,
      className: DASHBOARD_CARD_MENU_ITEM_CLASS,
      attributes: getDashboardCardMenuItemAttributes({
        label: state.moveLabel
      }),
      onSelect: () => handleDashboardViewAction({
        action: 'move-one',
        bookmarkId: state.bookmarkId
      }),
      disabled: state.deleting
    },
    {
      id: 'delete-one',
      label: <DashboardCardMenuItemContent icon="delete" text="删除" />,
      className: DASHBOARD_CARD_MENU_ITEM_DANGER_CLASS,
      attributes: getDashboardCardMenuItemAttributes({
        label: state.deleteLabel
      }),
      onSelect: () => handleDashboardViewAction({
        action: 'delete-one',
        bookmarkId: state.bookmarkId
      }),
      destructive: true,
      disabled: state.deleting
    }
  ]
}

function getDashboardCardMenuItemAttributes({
  label,
  pressed
}: {
  label: string
  pressed?: boolean
}): Record<string, string> {
  return {
    'aria-label': label,
    ...(typeof pressed === 'boolean' ? { 'aria-pressed': pressed ? 'true' : 'false' } : {})
  }
}

function DashboardFavicon({ state }: { state: DashboardCardViewModel }) {
  return (
    <DashboardFaviconShell
      bookmarkId={state.bookmarkId}
      fallbackLabel={state.fallbackLabel}
      favicon={state.favicon}
      selected={state.selected}
    />
  )
}

function DashboardFaviconShell({
  bookmarkId,
  fallbackLabel,
  favicon,
  selected = false
}: {
  bookmarkId: string
  fallbackLabel: string
  favicon: DashboardCardFaviconViewModel | null
  selected?: boolean
}) {
  return (
    <span
      className={[
        DASHBOARD_CARD_FAVICON_SHELL_CLASS,
        selected ? DASHBOARD_CARD_FAVICON_SHELL_SELECTED_STATE_CLASS : ''
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {favicon ? (
        <DashboardFaviconImage
          bookmarkId={bookmarkId}
          favicon={favicon}
          selected={selected}
          key={`${favicon.source}:${favicon.pageUrl}:${favicon.src}`}
        />
      ) : (
        <DashboardFaviconFallback label={fallbackLabel} />
      )}
    </span>
  )
}

function DashboardFaviconImage({
  bookmarkId,
  favicon,
  selected
}: {
  bookmarkId: string
  favicon: DashboardCardFaviconViewModel
  selected: boolean
}) {
  return (
    <img
      className={[
        DASHBOARD_CARD_FAVICON_IMAGE_CLASS,
        selected ? DASHBOARD_CARD_FAVICON_IMAGE_SELECTED_STATE_CLASS : ''
      ].filter(Boolean).join(' ')}
      src={favicon.src}
      alt=""
      loading="eager"
      decoding="async"
      draggable={false}
      onError={() => handleDashboardViewAction({
        action: 'favicon-error',
        bookmarkId,
        pageUrl: favicon.pageUrl,
        source: favicon.source,
        src: favicon.src
      })}
    />
  )
}

const DashboardFaviconFallback = memo(function DashboardFaviconFallback({
  fallbackRef,
  hidden = false,
  label
}: {
  fallbackRef?: RefObject<HTMLSpanElement | null>
  hidden?: boolean
  label: string
}) {
  return (
    <span
      ref={fallbackRef}
      className={DASHBOARD_CARD_FAVICON_FALLBACK_CLASS}
      hidden={hidden}
    >
      {label}
    </span>
  )
})

type DashboardCardActionBaseProps = {
  icon: DashboardCardActionIcon
  label: string
  tooltip: string
  className: string
  text: string
}

type DashboardCardActionButtonProps = DashboardCardActionBaseProps & {
  as?: 'button'
} & Omit<ComponentPropsWithoutRef<'button'>, 'aria-label' | 'children' | 'className' | 'type'>

type DashboardCardActionLinkProps = DashboardCardActionBaseProps & {
  as: 'a'
  href: string
} & Omit<ComponentPropsWithoutRef<'a'>, 'aria-label' | 'children' | 'className' | 'href' | 'rel' | 'target'>

type DashboardCardActionProps = DashboardCardActionButtonProps | DashboardCardActionLinkProps

function DashboardCardAction({
  as = 'button',
  icon,
  label,
  tooltip,
  className,
  text,
  ...props
}: DashboardCardActionProps) {
  const content = (
    <>
      <Icon name={dashboardCardActionIconByKind[icon]} aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </>
  )

  if (as === 'a') {
    const { href, ...linkProps } = props as DashboardCardActionLinkProps
    return (
      <a
        className={className}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        draggable={false}
        aria-label={label}
        title={tooltip}
        {...linkProps}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      className={className}
      type="button"
      aria-label={label}
      title={tooltip}
      {...props as DashboardCardActionButtonProps}
    >
      {content}
    </button>
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

function DashboardTagPopoverShell({
  open,
  state,
  triggerRef
}: {
  open: boolean
  state: DashboardCardViewModel
  triggerRef: RefObject<HTMLButtonElement | null>
}) {
  const tagsPanelId = getDashboardTagsPanelId(state.bookmarkId)

  return (
    <PopoverRoot open={open} triggerId={`dashboard-tag-more-${state.bookmarkId}`}>
      <PopoverPortal keepMounted>
        <PopoverPositioner
          className={DASHBOARD_TAG_POPOVER_POSITIONER_CLASS}
          anchor={() => triggerRef.current?.closest('article') || triggerRef.current}
          align="center"
          positionMethod="fixed"
          side="right"
          sideOffset={8}
          collisionPadding={12}
          collisionAvoidance={{ side: 'flip', align: 'shift' }}
          onPointerDown={stopDashboardCardDragPropagation}
        >
          <PopoverPopup
            id={tagsPanelId}
            className={[
              DASHBOARD_TAG_POPOVER_CLASS,
              't-dropdown',
              open ? 'is-open' : 'is-closing'
            ].join(' ')}
            aria-label="全部标签"
            initialFocus={false}
            finalFocus={false}
            unanimated
            onPointerEnter={() => handleDashboardViewAction({
              action: 'tag-hover-open',
              bookmarkId: state.bookmarkId
            })}
            onPointerLeave={(event) => {
              if (isDashboardTagPopoverTransition(event.relatedTarget, state.bookmarkId)) {
                return
              }
              handleDashboardViewAction({
                action: 'tag-hover-close',
                bookmarkId: state.bookmarkId
              })
            }}
          >
            <DashboardTagPopoverContents state={state} />
          </PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </PopoverRoot>
  )
}

function isDashboardTagPopoverTransition(relatedTarget: EventTarget | null, bookmarkId: string): boolean {
  if (!(relatedTarget instanceof Element)) {
    return false
  }

  const panelId = getDashboardTagsPanelId(bookmarkId)
  let element: Element | null = relatedTarget

  while (element) {
    if (element.getAttribute('aria-controls') === panelId || element.id === panelId) {
      return true
    }
    element = element.parentElement
  }

  return false
}

function getDashboardTagsPanelId(bookmarkId: string): string {
  return `dashboard-tags-panel-${bookmarkId}`
}

function DashboardTagPopoverContents({ state }: { state: DashboardCardViewModel }) {
  return (
    <>
      <strong className={DASHBOARD_TAG_POPOVER_TITLE_CLASS}>全部标签</strong>
      <div className={DASHBOARD_TAG_POPOVER_LIST_CLASS}>
        {state.tags.map((tag) => (
          <span className={DASHBOARD_CARD_TAG_CHIP_CLASS} key={tag}>{tag}</span>
        ))}
      </div>
    </>
  )
}
