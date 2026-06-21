import {
  useCallback,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from 'react'
import { Icon } from '../../ui/icons/Icon'
import { Button } from '../../ui/base/Button'
import { DotMatrixLoader } from '../../ui/base/DotMatrixLoader'
import { Input } from '../../ui/base/Input'
import {
  Popover,
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverRoot
} from '../../ui/base/Popover'
import {
  DASHBOARD_CARD_HEIGHT,
  DASHBOARD_CARD_MIN_WIDTH
} from '../sections/dashboard-virtual'
import {
  DashboardBreadcrumbsContent,
  DashboardCardsTitleContent,
  DashboardDragHintContent,
  DashboardDragPreviewContent,
  DashboardFolderDropGridContent,
  DashboardFolderSidebarCountContent,
  DashboardFolderTreeContent,
  DashboardResults,
  DashboardSearchChipsContent,
  DashboardSearchControlsContent,
  DashboardSelectionBarContent,
  DashboardStatusContent,
  DashboardTagEditorActionsContent,
  DashboardTagEditorFieldContent,
  DashboardTagEditorMetaContent,
  DashboardTagEditorStatusContent,
  DashboardTagEditorTitleContent,
  DashboardTitleContent
} from './DashboardView'
import {
  handleDashboardViewAction,
  handleDashboardPanelKeyDown as runDashboardPanelKeyDown
} from '../options-controller'
import {
  handleDashboardPanelClick as runDashboardPanelClick,
  handleDashboardPanelFocusIn as runDashboardPanelFocusIn
} from '../sections/dashboard-lazy'
import {
  patchDashboardSearchControlsState,
  useDashboardViewState
} from './dashboard-view-store'
import {
  DASHBOARD_RESULTS_GROUP_CLASS,
  DASHBOARD_RESULTS_TITLE_CLASS,
  DASHBOARD_RESULTS_TRANSITION_STATE_CLASS,
  DASHBOARD_RESULTS_WINDOWED_STATE_CLASS,
  DASHBOARD_SEARCH_ICON_CLASS,
  DASHBOARD_CONTENT_LAYOUT_CLASS,
  DASHBOARD_CARD_GRID_CLASS,
  DASHBOARD_FLOATING_SURFACE_CONTAINMENT_CLASS,
  DASHBOARD_FOLDER_SIDEBAR_CLASS,
  DASHBOARD_FOLDER_SIDEBAR_HEAD_CLASS,
  DASHBOARD_FOLDER_SIDEBAR_TITLE_CLASS,
  DASHBOARD_FOLDER_TREE_CLASS,
  DASHBOARD_LOADING_CARD_CLASS,
  DASHBOARD_LOADING_LOADER_CLASS,
  DASHBOARD_LOADING_SCREEN_CLASS,
  DASHBOARD_META_PILL_CLASS,
  DASHBOARD_QUERY_ROW_CLASS,
  DASHBOARD_PANEL_CLASS,
  DASHBOARD_PERFORMANCE_CLASS,
  DASHBOARD_SELECTION_GROUP_CLASS,
  DASHBOARD_SEARCH_BOX_CLASS,
  DASHBOARD_FOLDER_BREADCRUMBS_CLASS,
  DASHBOARD_SEARCH_INPUT_CLASS,
  DASHBOARD_SEARCH_INPUT_FIELD_CLASS,
  DASHBOARD_SEARCH_LABEL_CLASS,
  DASHBOARD_SEARCH_LABEL_TEXT_CLASS,
  DASHBOARD_SEARCH_HELP_BUTTON_CLASS,
  DASHBOARD_SEARCH_HELP_POPOVER_CLASS,
  DASHBOARD_SEARCH_HELP_TITLE_CLASS,
  DASHBOARD_TAG_EDITOR_ACTIONS_CLASS,
  DASHBOARD_TAG_EDITOR_HEAD_CLASS,
  DASHBOARD_TAG_EDITOR_HELP_CLASS,
  DASHBOARD_TAG_EDITOR_META_CLASS,
  DASHBOARD_TAG_EDITOR_PANEL_CLASS,
  DASHBOARD_TAG_EDITOR_PANEL_CLOSING_STATE_CLASS,
  DASHBOARD_TAG_EDITOR_POSITIONER_CLASS,
  DASHBOARD_TAG_EDITOR_ROOT_CLASS,
  DASHBOARD_TAG_EDITOR_ROOT_CLOSING_STATE_CLASS,
  DASHBOARD_TAG_EDITOR_STATUS_CLASS,
  DASHBOARD_TAG_EDITOR_TITLE_CLASS,
  DASHBOARD_TITLE_ACTIONS_CLASS,
  DASHBOARD_TOOLBAR_CLASS,
  DASHBOARD_TOOLBAR_EXIT_BUTTON_CLASS,
  DASHBOARD_TOOLBAR_STATUS_CLASS,
  DASHBOARD_DELETE_DROP_COPY_CLASS,
  DASHBOARD_DELETE_DROP_DESCRIPTION_CLASS,
  DASHBOARD_DELETE_DROP_ICON_CLASS,
  DASHBOARD_DELETE_DROP_TARGET_ACTIVE_STATE_CLASS,
  DASHBOARD_DELETE_DROP_TARGET_ACTIVE_TRANSFORM_STATE_CLASS,
  DASHBOARD_DELETE_DROP_TARGET_CLASS,
  DASHBOARD_DELETE_DROP_TARGET_CLOSING_STATE_CLASS,
  DASHBOARD_DELETE_DROP_TARGET_MOVING_STATE_CLASS,
  DASHBOARD_DELETE_DROP_TITLE_CLASS,
  DASHBOARD_DRAG_OVERLAY_CLASS,
  DASHBOARD_DRAG_OVERLAY_CLOSING_STATE_CLASS,
  DASHBOARD_DRAG_PREVIEW_CLASS,
  DASHBOARD_DRAG_PREVIEW_CLOSING_STATE_CLASS,
  DASHBOARD_DROP_HEAD_CLASS,
  DASHBOARD_DROP_HINT_CLASS,
  DASHBOARD_DROP_PANEL_CLASS,
  DASHBOARD_DROP_PANEL_CLOSING_STATE_CLASS,
  DASHBOARD_DROP_TITLE_CLASS,
  DASHBOARD_FOLDER_DROP_GRID_CLASS,
  DASHBOARD_LOADING_SCREEN_READY_STATE_CLASS,
  DASHBOARD_PANEL_NOT_READY_STATE_CLASS
} from './dashboard-classes'
import type {
  DashboardCardMenuFocusRequestState,
  DashboardDragOverlayState,
  DashboardPanelChromeState,
  DashboardResultsScrollRequestState,
  DashboardResultsState,
  DashboardSearchControlsState,
  DashboardTagEditorState
} from './dashboard-view-types'

export function DashboardPanel({ hidden }: { hidden: boolean }) {
  const [tagEditorPosition, setTagEditorPosition] = useState<DashboardTagEditorPosition>(() => getHiddenDashboardTagEditorPosition())
  const panelRef = useRef<HTMLElement | null>(null)
  const tagEditorRef = useRef<HTMLDivElement | null>(null)
  const cardElementRefs = useRef<Map<string, HTMLElement> | null>(null)
  const {
    cardMenuFocusRequest,
    dragOverlay,
    panelChrome,
    results,
    resultsScrollRequest,
    searchControls,
    tagEditor
  } = useDashboardViewState()
  const tagEditorOpen = !hidden && tagEditor.visible

  if (!cardElementRefs.current) {
    cardElementRefs.current = new Map()
  }

  const registerDashboardCardElement = useCallback((bookmarkId: string, node: HTMLElement | null) => {
    const safeBookmarkId = String(bookmarkId || '').trim()
    if (!safeBookmarkId) {
      return
    }
    if (node) {
      cardElementRefs.current?.set(safeBookmarkId, node)
      return
    }
    cardElementRefs.current?.delete(safeBookmarkId)
  }, [])

  useLayoutEffect(() => {
    if (!tagEditorOpen) {
      setTagEditorPosition(getHiddenDashboardTagEditorPosition())
      return
    }

    const editor = tagEditorRef.current
    const card = cardElementRefs.current?.get(tagEditor.bookmarkId)
    if (!editor || !card) {
      return
    }

    setTagEditorPosition(getDashboardTagEditorPosition(editor, card))
  }, [tagEditorOpen, tagEditor.bookmarkId, tagEditor.positionRequestId, results])

  useLayoutEffect(() => {
    if (hidden) {
      return
    }

    const panel = panelRef.current
    if (!panel) {
      return
    }

    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement && panel.contains(activeElement)) {
      return
    }

    panel.focus({ preventScroll: true })
  }, [hidden])

  const handleDashboardPanelPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (hidden) {
      return
    }
    runDashboardPanelClick(event.nativeEvent)
  }, [hidden])

  const handleDashboardPanelFocus = useCallback((event: ReactFocusEvent<HTMLElement>) => {
    if (hidden) {
      return
    }
    runDashboardPanelFocusIn(event.nativeEvent)
  }, [hidden])

  const handleDashboardPanelKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (hidden) {
      return
    }

    runDashboardPanelKeyDown(event.nativeEvent)
    if (event.nativeEvent.defaultPrevented) {
      event.stopPropagation()
    }
  }, [hidden])

  return (
    <section
      id="dashboard"
      ref={panelRef}
      className={[
        DASHBOARD_PANEL_CLASS,
        DASHBOARD_PERFORMANCE_CLASS
      ].filter(Boolean).join(' ')}
      aria-labelledby="dashboard-title"
      hidden={hidden}
      tabIndex={-1}
      onPointerDownCapture={handleDashboardPanelPointerDown}
      onFocusCapture={handleDashboardPanelFocus}
      onKeyDownCapture={handleDashboardPanelKeyDown}
    >
      <output
        className={[
          DASHBOARD_LOADING_SCREEN_CLASS,
          panelChrome.ready ? DASHBOARD_LOADING_SCREEN_READY_STATE_CLASS : ''
        ].filter(Boolean).join(' ')}
        aria-label="正在读取书签仪表盘"
      >
        <div className={DASHBOARD_LOADING_CARD_CLASS}>
          <DotMatrixLoader className={DASHBOARD_LOADING_LOADER_CLASS} />
        </div>
      </output>

      <h1 id="dashboard-title" className="sr-only">
        <DashboardTitleContent />
      </h1>

      <DashboardToolbar ready={panelChrome.ready} searchControls={searchControls} />

      <DashboardSelectionGroup ready={panelChrome.ready} />

      <DashboardResultsSection
        active={!hidden}
        cardsDimmed={dragOverlay.visible}
        focusRequest={cardMenuFocusRequest}
        panelChrome={panelChrome}
        registerCardElement={registerDashboardCardElement}
        results={results}
        scrollRequest={resultsScrollRequest}
      />

      <DashboardDragOverlay state={dragOverlay} />

      <DashboardTagEditorLayer
        open={tagEditorOpen}
        position={tagEditorPosition}
        refObject={tagEditorRef}
        state={tagEditor}
      />
    </section>
  )
}

function DashboardToolbar({
  ready,
  searchControls
}: {
  ready: boolean
  searchControls: DashboardSearchControlsState
}) {
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!searchControls.focusRequestId) {
      return
    }

    window.setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)
  }, [searchControls.focusRequestId])

  return (
    <div
      className={[
        DASHBOARD_TOOLBAR_CLASS,
        ready ? '' : DASHBOARD_PANEL_NOT_READY_STATE_CLASS
      ].filter(Boolean).join(' ')}
    >
      <div className={DASHBOARD_SEARCH_BOX_CLASS}>
        <label className={DASHBOARD_SEARCH_LABEL_CLASS} htmlFor="dashboard-query">
          <span className={DASHBOARD_SEARCH_LABEL_TEXT_CLASS}>搜索书签</span>
          <span className={DASHBOARD_QUERY_ROW_CLASS}>
            <Popover
              className={DASHBOARD_SEARCH_HELP_POPOVER_CLASS}
              open={searchControls.searchHelpOpen}
              onOpenChange={(open) => patchDashboardSearchControlsState({ searchHelpOpen: open })}
              portal={false}
              triggerNativeButton
              align="end"
              sideOffset={8}
              trigger={<DashboardSearchHelpButton />}
            >
              <strong className={DASHBOARD_SEARCH_HELP_TITLE_CLASS}>高级搜索语法</strong>
              <span>site:github.com 限定站点</span>
              <span>folder:"前端资料" 限定文件夹</span>
              <span>type:文档 限定内容类型</span>
              <span>最近 2 周、昨天、上个月限定时间</span>
              <span>-youtube 或 -"短视频" 排除结果</span>
            </Popover>
            <span className={DASHBOARD_SEARCH_INPUT_FIELD_CLASS}>
              <Icon name="Search" size={16} className={DASHBOARD_SEARCH_ICON_CLASS} aria-hidden="true" />
              <Input
                id="dashboard-query"
                className={DASHBOARD_SEARCH_INPUT_CLASS}
                type="search"
                ref={searchInputRef}
                spellCheck={false}
                unstyled
                value={searchControls.query}
                onValueChange={(value) => {
                  handleDashboardViewAction({
                    action: 'query-change',
                    value
                  })
                }}
                placeholder="关键词搜索"
              />
              <DashboardSearchControlsContent />
            </span>
          </span>
        </label>
        <DashboardSearchChipsContent />
        <nav className={DASHBOARD_FOLDER_BREADCRUMBS_CLASS} aria-label="当前 Dashboard 文件夹路径">
          <DashboardBreadcrumbsContent />
        </nav>
      </div>
      <div className={DASHBOARD_TITLE_ACTIONS_CLASS}>
        <span className={DASHBOARD_TOOLBAR_STATUS_CLASS}>
          <DashboardStatusContent />
        </span>
        <Button
          className={DASHBOARD_TOOLBAR_EXIT_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => handleDashboardViewAction({ action: 'exit-dashboard' })}
        >
          退出
        </Button>
      </div>
    </div>
  )
}

function DashboardSearchHelpButton({
  className,
  type,
  'aria-label': ariaLabel,
  ref,
  ...props
}: ComponentPropsWithRef<'button'>) {
  return (
    <button
      {...props}
      ref={ref}
      className={[DASHBOARD_SEARCH_HELP_BUTTON_CLASS, className].filter(Boolean).join(' ')}
      type={type ?? 'button'}
      aria-label={ariaLabel ?? '查看高级搜索语法'}
    >
      ?
    </button>
  )
}

function DashboardSelectionGroup({ ready }: { ready: boolean }) {
  return (
    <div
      className={[
        DASHBOARD_SELECTION_GROUP_CLASS,
        ready ? '' : DASHBOARD_PANEL_NOT_READY_STATE_CLASS
      ].filter(Boolean).join(' ')}
    >
      <DashboardSelectionBarContent />
    </div>
  )
}

function DashboardResultsSection({
  active,
  cardsDimmed,
  focusRequest,
  panelChrome,
  registerCardElement,
  results,
  scrollRequest
}: {
  active: boolean
  cardsDimmed: boolean
  focusRequest: DashboardCardMenuFocusRequestState
  panelChrome: DashboardPanelChromeState
  registerCardElement: (bookmarkId: string, node: HTMLElement | null) => void
  results: DashboardResultsState
  scrollRequest: DashboardResultsScrollRequestState
}) {
  const resultsRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!active || !scrollRequest.requestId) {
      return
    }

    const resultsElement = resultsRef.current
    if (!resultsElement) {
      return
    }

    const nextScrollTop = Math.max(0, Number(scrollRequest.scrollTop) || 0)
    if (resultsElement.scrollTop !== nextScrollTop) {
      resultsElement.scrollTop = nextScrollTop
    }
    handleDashboardViewAction({
      action: 'results-scroll-sync',
      ...getDashboardResultsMetrics(resultsElement)
    })
  }, [active, scrollRequest.requestId, scrollRequest.scrollTop])

  useLayoutEffect(() => {
    if (!active) {
      return
    }

    const resultsElement = resultsRef.current
    if (!resultsElement) {
      return
    }

    handleDashboardViewAction({
      action: 'results-mounted',
      ...getDashboardResultsMetrics(resultsElement)
    })

    if (typeof ResizeObserver === 'undefined') {
      handleDashboardViewAction({
        action: 'results-resize',
        ...getDashboardResultsMetrics(resultsElement)
      })
      return () => {
        handleDashboardViewAction({ action: 'results-unmounted' })
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      handleDashboardViewAction({
        action: 'results-resize',
        ...getDashboardResultsMetrics(resultsElement)
      })
    })
    resizeObserver.observe(resultsElement)

    return () => {
      resizeObserver.disconnect()
      handleDashboardViewAction({ action: 'results-unmounted' })
    }
  }, [active])

  return (
    <section
      className={[
        DASHBOARD_RESULTS_GROUP_CLASS,
        panelChrome.ready ? '' : DASHBOARD_PANEL_NOT_READY_STATE_CLASS
      ].filter(Boolean).join(' ')}
      aria-labelledby="dashboard-cards-title"
    >
      <h2 id="dashboard-cards-title" className={DASHBOARD_RESULTS_TITLE_CLASS}>
        <DashboardCardsTitleContent />
      </h2>
      <div className={DASHBOARD_CONTENT_LAYOUT_CLASS}>
        <aside className={DASHBOARD_FOLDER_SIDEBAR_CLASS} aria-labelledby="dashboard-folder-sidebar-title" aria-label="书签文件夹">
          <div className={DASHBOARD_FOLDER_SIDEBAR_HEAD_CLASS}>
            <strong id="dashboard-folder-sidebar-title" className={DASHBOARD_FOLDER_SIDEBAR_TITLE_CLASS}>文件夹</strong>
            <span className={DASHBOARD_META_PILL_CLASS}>
              <DashboardFolderSidebarCountContent />
            </span>
          </div>
          <nav
            className={DASHBOARD_FOLDER_TREE_CLASS}
            aria-label="按文件夹筛选书签"
          >
            <DashboardFolderTreeContent />
          </nav>
        </aside>
        <div
          ref={resultsRef}
          className={[
            DASHBOARD_CARD_GRID_CLASS,
            panelChrome.resultsUpdating ? DASHBOARD_RESULTS_TRANSITION_STATE_CLASS : '',
            panelChrome.resultsVirtualized ? DASHBOARD_RESULTS_WINDOWED_STATE_CLASS : '',
            hasDashboardFloatingSurface(results) ? DASHBOARD_FLOATING_SURFACE_CONTAINMENT_CLASS : ''
          ].filter(Boolean).join(' ')}
          onScroll={(event) => {
            const target = event.currentTarget
            handleDashboardViewAction({
              action: 'results-scroll',
              ...getDashboardResultsMetrics(target)
            })
          }}
          style={{
            '--dashboard-card-height': `${DASHBOARD_CARD_HEIGHT}px`,
            '--dashboard-card-min-width': `${DASHBOARD_CARD_MIN_WIDTH}px`,
            '--dashboard-results-stable-height': panelChrome.resultsStableHeight || undefined
          } as CSSProperties}
        >
          <DashboardResults
            state={results}
            dimCards={cardsDimmed}
            focusRequest={focusRequest}
            registerCardElement={registerCardElement}
          />
        </div>
      </div>
    </section>
  )
}

function getDashboardResultsMetrics(element: HTMLElement) {
  return {
    clientHeight: element.clientHeight,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop
  }
}

function hasDashboardFloatingSurface(results: DashboardResultsState): boolean {
  if (results.mode === 'empty') {
    return false
  }
  return results.cards.some((card) => card.activeMenu || card.expanded)
}

function DashboardTagEditorLayer({
  open,
  position,
  refObject,
  state
}: {
  open: boolean
  position: DashboardTagEditorPosition
  refObject: RefObject<HTMLDivElement | null>
  state: DashboardTagEditorState
}) {
  return (
    <div
      id="dashboard-tag-editor"
      ref={refObject}
      className={[
        DASHBOARD_TAG_EDITOR_ROOT_CLASS,
        state.closing ? DASHBOARD_TAG_EDITOR_ROOT_CLOSING_STATE_CLASS : ''
      ].filter(Boolean).join(' ')}
      aria-modal="false"
      aria-hidden={open ? 'false' : 'true'}
      hidden={!open && !state.closing}
      style={position.style}
    >
      <PopoverRoot open={open} triggerId="dashboard-tag-editor">
        <PopoverPortal keepMounted container={null}>
          <PopoverPositioner className={DASHBOARD_TAG_EDITOR_POSITIONER_CLASS} anchor={() => refObject.current} collisionAvoidance={{ side: 'none', align: 'none' }}>
            <PopoverPopup
              className={[
                DASHBOARD_TAG_EDITOR_PANEL_CLASS,
                state.closing ? DASHBOARD_TAG_EDITOR_PANEL_CLOSING_STATE_CLASS : ''
              ].filter(Boolean).join(' ')}
              aria-labelledby="dashboard-tag-editor-title"
              aria-describedby="dashboard-tag-editor-help dashboard-tag-editor-status"
              tabIndex={-1}
              initialFocus={false}
              finalFocus={false}
            >
              <div className={DASHBOARD_TAG_EDITOR_HEAD_CLASS}>
                <div>
                  <strong id="dashboard-tag-editor-title" className={DASHBOARD_TAG_EDITOR_TITLE_CLASS}>
                    <DashboardTagEditorTitleContent />
                  </strong>
                  <span className={DASHBOARD_TAG_EDITOR_META_CLASS}>
                    <DashboardTagEditorMetaContent />
                  </span>
                </div>
              </div>
              <DashboardTagEditorFieldContent />
              <p id="dashboard-tag-editor-help" className={DASHBOARD_TAG_EDITOR_HELP_CLASS}>
                每行一个标签，也可以用逗号、顿号分隔；保存后会自动去重。
              </p>
              <p id="dashboard-tag-editor-status" className={DASHBOARD_TAG_EDITOR_STATUS_CLASS} role="status" aria-live="polite" aria-atomic="true">
                <DashboardTagEditorStatusContent />
              </p>
              <div className={DASHBOARD_TAG_EDITOR_ACTIONS_CLASS}>
                <DashboardTagEditorActionsContent />
              </div>
            </PopoverPopup>
          </PopoverPositioner>
        </PopoverPortal>
      </PopoverRoot>
    </div>
  )
}

function clearDashboardDragHover(): void {
  handleDashboardViewAction({
    action: 'drag-hover-folder',
    bookmarkId: ''
  })
  handleDashboardViewAction({
    action: 'drag-hover-delete',
    active: false
  })
}

function handleDashboardOverlayPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
  handleDashboardViewAction({
    action: 'drag-pointer-up',
    event: event.nativeEvent
  })
}

function handleDashboardOverlayPointerCancel(): void {
  handleDashboardViewAction({ action: 'drag-pointer-cancel' })
}

function DashboardDragOverlay({ state }: { state: DashboardDragOverlayState }) {
  const handleOverlayPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    handleDashboardViewAction({
      action: 'drag-pointer-move',
      event: event.nativeEvent
    })

    if (state.moving) {
      return
    }

    if (event.target === event.currentTarget) {
      clearDashboardDragHover()
    }
  }

  const handleDropPanelPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (state.moving) {
      return
    }

    if (isDashboardFolderDropOptionEvent(event.nativeEvent, event.currentTarget)) {
      return
    }
    clearDashboardDragHover()
  }

  return (
    <div
      className={[
        DASHBOARD_DRAG_OVERLAY_CLASS,
        state.closing ? DASHBOARD_DRAG_OVERLAY_CLOSING_STATE_CLASS : ''
      ].filter(Boolean).join(' ')}
      aria-hidden={state.visible ? 'false' : 'true'}
      hidden={!state.visible && !state.closing}
      onPointerMove={handleOverlayPointerMove}
      onPointerUp={handleDashboardOverlayPointerUp}
      onPointerCancel={handleDashboardOverlayPointerCancel}
    >
      <div
        className={[
          DASHBOARD_DELETE_DROP_TARGET_CLASS,
          state.deleteTargetActive ? DASHBOARD_DELETE_DROP_TARGET_ACTIVE_STATE_CLASS : '',
          state.deleteTargetActive && !state.closing ? DASHBOARD_DELETE_DROP_TARGET_ACTIVE_TRANSFORM_STATE_CLASS : '',
          state.moving ? DASHBOARD_DELETE_DROP_TARGET_MOVING_STATE_CLASS : '',
          state.closing ? DASHBOARD_DELETE_DROP_TARGET_CLOSING_STATE_CLASS : ''
        ].filter(Boolean).join(' ')}
        onPointerEnter={() => {
          if (state.moving) {
            return
          }
          handleDashboardViewAction({
            action: 'drag-hover-folder',
            bookmarkId: ''
          })
          handleDashboardViewAction({
            action: 'drag-hover-delete',
            active: true
          })
        }}
        onPointerLeave={() => {
          if (state.moving) {
            return
          }
            handleDashboardViewAction({
            action: 'drag-hover-delete',
            active: false
          })
        }}
      >
        <span className={DASHBOARD_DELETE_DROP_ICON_CLASS} aria-hidden="true" />
        <span className={DASHBOARD_DELETE_DROP_COPY_CLASS}>
          <strong className={DASHBOARD_DELETE_DROP_TITLE_CLASS}>删除书签</strong>
          <small className={DASHBOARD_DELETE_DROP_DESCRIPTION_CLASS}>拖到这里松开，确认后移入回收站</small>
        </span>
      </div>
      <div
        className={[
          DASHBOARD_DROP_PANEL_CLASS,
          state.closing ? DASHBOARD_DROP_PANEL_CLOSING_STATE_CLASS : ''
        ].filter(Boolean).join(' ')}
        onPointerMove={handleDropPanelPointerMove}
      >
        <div className={DASHBOARD_DROP_HEAD_CLASS}>
          <div>
            <strong className={DASHBOARD_DROP_TITLE_CLASS}>拖入文件夹移动书签</strong>
            <p className={DASHBOARD_DROP_HINT_CLASS}><DashboardDragHintContent /></p>
          </div>
          <span className={DASHBOARD_META_PILL_CLASS}>Esc 取消</span>
        </div>
        <div className={DASHBOARD_FOLDER_DROP_GRID_CLASS} aria-label="拖放目标文件夹">
          <DashboardFolderDropGridContent />
        </div>
      </div>
      <div
        className={[
          DASHBOARD_DRAG_PREVIEW_CLASS,
          state.closing ? DASHBOARD_DRAG_PREVIEW_CLOSING_STATE_CLASS : ''
        ].filter(Boolean).join(' ')}
        aria-hidden="true"
        style={{ transform: state.previewTransform || undefined }}
      >
        <DashboardDragPreviewContent />
      </div>
    </div>
  )
}

function isDashboardFolderDropOptionEvent(event: PointerEvent, panel: HTMLElement): boolean {
  return event.composedPath().some((item) => {
    return item instanceof HTMLElement &&
      item.getAttribute('role') === 'option' &&
      panel.contains(item)
  })
}

interface DashboardTagEditorPosition {
  style: CSSProperties
}

function getHiddenDashboardTagEditorPosition(): DashboardTagEditorPosition {
  return {
    style: {
      left: 0,
      right: 'auto',
      top: 0
    }
  }
}

function getDashboardTagEditorPosition(editor: HTMLElement, card: HTMLElement): DashboardTagEditorPosition {
  const margin = 16
  const gap = 12
  const cardRect = card.getBoundingClientRect()
  const editorRect = editor.getBoundingClientRect()
  const editorWidth = Math.min(editorRect.width || 430, window.innerWidth - margin * 2)
  const editorHeight = Math.min(editorRect.height || 300, window.innerHeight - margin * 2)
  const hasRightSpace = cardRect.right + gap + editorWidth <= window.innerWidth - margin
  const hasLeftSpace = cardRect.left - gap - editorWidth >= margin

  let left = hasRightSpace
    ? cardRect.right + gap
    : hasLeftSpace
      ? cardRect.left - gap - editorWidth
      : Math.min(Math.max(cardRect.left, margin), window.innerWidth - editorWidth - margin)
  let top = cardRect.top

  left = Math.min(Math.max(left, margin), window.innerWidth - editorWidth - margin)
  top = Math.min(Math.max(top, margin), window.innerHeight - editorHeight - margin)

  return {
    style: {
      left: `${Math.round(left)}px`,
      right: 'auto',
      top: `${Math.round(top)}px`
    }
  }
}
