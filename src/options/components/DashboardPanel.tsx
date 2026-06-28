import {
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useEffect,
  memo,
  useReducer,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from 'react'
import { flushSync } from 'react-dom'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/icons/Icon'
import { Input } from '../../ui/Input'
import {
  Popover,
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverRoot
} from '../../ui/Popover'
import {
  DASHBOARD_CARD_HEIGHT,
  DASHBOARD_CARD_MIN_WIDTH,
  DASHBOARD_GRID_GAP
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
  useDashboardViewSelector
} from './dashboard-view-store'
import { prefersReducedMotion } from '../../shared/motion'
import {
  DASHBOARD_CHROME_SKELETON_CONTENT_CLASS,
  DASHBOARD_CHROME_SKELETON_LAYER_CLASS,
  DASHBOARD_RESULTS_GROUP_CLASS,
  DASHBOARD_RESULTS_GRID_STATE_CLASS,
  DASHBOARD_RESULTS_CONTENT_LAYER_CLASS,
  DASHBOARD_RESULTS_SKELETON_LAYER_CLASS,
  DASHBOARD_RESULTS_SKELETON_ROOT_CLASS,
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
  DASHBOARD_META_PILL_CLASS,
  DASHBOARD_QUERY_ROW_CLASS,
  DASHBOARD_PANEL_CLASS,
  DASHBOARD_PERFORMANCE_CLASS,
  DASHBOARD_SELECTION_ACTIONS_CLASS,
  DASHBOARD_SELECTION_BAR_CLASS,
  DASHBOARD_SELECTION_GROUP_ACTIVE_CLASS,
  DASHBOARD_SELECTION_GROUP_CLASS,
  DASHBOARD_SELECTION_SKELETON_BUTTON_CLASS,
  DASHBOARD_SKELETON_BAR_CLASS,
  DASHBOARD_SKELETON_CARD_CLASS,
  DASHBOARD_SKELETON_CARD_COPY_CLASS,
  DASHBOARD_SKELETON_CARD_GRID_CLASS,
  DASHBOARD_SKELETON_CARD_HEADER_CLASS,
  DASHBOARD_SKELETON_CARD_ICON_CLASS,
  DASHBOARD_SKELETON_CARD_META_CLASS,
  DASHBOARD_SKELETON_DOT_CLASS,
  DASHBOARD_SKELETON_FOLDER_ITEM_CLASS,
  DASHBOARD_SEARCH_BOX_CLASS,
  DASHBOARD_FOLDER_BREADCRUMBS_CLASS,
  DASHBOARD_SEARCH_HELP_SKELETON_CLASS,
  DASHBOARD_SEARCH_INPUT_CLASS,
  DASHBOARD_SEARCH_INPUT_FIELD_CLASS,
  DASHBOARD_SEARCH_LABEL_CLASS,
  DASHBOARD_SEARCH_LABEL_TEXT_CLASS,
  DASHBOARD_SEARCH_HELP_BUTTON_CLASS,
  DASHBOARD_SEARCH_HELP_EXAMPLE_CLASS,
  DASHBOARD_SEARCH_HELP_POPOVER_CLASS,
  DASHBOARD_SEARCH_HELP_TITLE_CLASS,
  DASHBOARD_SEARCH_SKELETON_ACTION_CLASS,
  DASHBOARD_SEARCH_SKELETON_ICON_CLASS,
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
  DASHBOARD_TOOLBAR_EXIT_SKELETON_CLASS,
  DASHBOARD_TOOLBAR_SKELETON_ROOT_CLASS,
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
  DASHBOARD_FOLDER_DROP_GRID_CLASS
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

const DASHBOARD_SKELETON_FOLDER_ROWS = [
  { countWidth: '34%', depth: 0, labelWidth: '74%' },
  { countWidth: '28%', depth: 1, labelWidth: '62%' },
  { countWidth: '22%', depth: 1, labelWidth: '82%' },
  { countWidth: '30%', depth: 2, labelWidth: '56%' },
  { countWidth: '24%', depth: 1, labelWidth: '68%' },
  { countWidth: '26%', depth: 2, labelWidth: '48%' },
  { countWidth: '20%', depth: 2, labelWidth: '72%' }
] as const

const DASHBOARD_SKELETON_CARD_PATTERNS = [
  { detailWidth: '64%', metaWidth: '36%', titleWidth: '78%' },
  { detailWidth: '72%', metaWidth: '44%', titleWidth: '66%' },
  { detailWidth: '58%', metaWidth: '30%', titleWidth: '86%' },
  { detailWidth: '68%', metaWidth: '40%', titleWidth: '58%' },
  { detailWidth: '54%', metaWidth: '34%', titleWidth: '74%' },
  { detailWidth: '76%', metaWidth: '42%', titleWidth: '62%' },
  { detailWidth: '62%', metaWidth: '28%', titleWidth: '82%' },
  { detailWidth: '70%', metaWidth: '38%', titleWidth: '68%' }
] as const
const DASHBOARD_SKELETON_CARD_COUNT = 120
const DASHBOARD_SKELETON_CARDS = Array.from(
  { length: DASHBOARD_SKELETON_CARD_COUNT },
  (_, index) => DASHBOARD_SKELETON_CARD_PATTERNS[index % DASHBOARD_SKELETON_CARD_PATTERNS.length]
)

const DASHBOARD_SKELETON_MIN_VISIBLE_MS = 180
const DASHBOARD_IMMEDIATE_SCROLL_SYNC_DELTA = (DASHBOARD_CARD_HEIGHT + DASHBOARD_GRID_GAP) * 3
const DASHBOARD_SEARCH_HELP_EXAMPLES = [
  { query: 'site:github.com', label: '限定站点' },
  { query: 'folder:"前端资料"', label: '限定文件夹' },
  { query: 'type:文档', label: '限定内容类型' },
  { query: '最近 2 周', label: '限定时间' },
  { query: '-youtube', label: '排除结果' }
] as const

interface DashboardSkeletonRevealState {
  revealed: boolean
  replayKey: number
}

type DashboardSkeletonRevealAction =
  | { type: 'hide' }
  | { type: 'replay' }
  | { type: 'reveal' }

function dashboardSkeletonRevealReducer(
  state: DashboardSkeletonRevealState,
  action: DashboardSkeletonRevealAction
): DashboardSkeletonRevealState {
  if (action.type === 'hide') {
    return state.revealed ? { ...state, revealed: false } : state
  }
  if (action.type === 'replay') {
    return {
      revealed: false,
      replayKey: state.replayKey + 1
    }
  }
  return state.revealed ? state : { ...state, revealed: true }
}

function useDashboardSkeletonReveal(active: boolean, ready: boolean) {
  const skeletonShownAtRef = useRef(0)
  const wasActiveRef = useRef(false)
  const previousReadyRef = useRef(ready)
  const [state, dispatch] = useReducer(dashboardSkeletonRevealReducer, {
    revealed: false,
    replayKey: 0
  })

  useLayoutEffect(() => {
    if (!active) {
      wasActiveRef.current = false
      previousReadyRef.current = ready
      skeletonShownAtRef.current = 0
      dispatch({ type: 'hide' })
      return
    }

    const entering = !wasActiveRef.current
    const loadingRestarted = previousReadyRef.current && !ready
    wasActiveRef.current = true
    previousReadyRef.current = ready

    if (entering || loadingRestarted) {
      skeletonShownAtRef.current = performance.now()
      dispatch({ type: 'replay' })
    }
  }, [active, ready])

  useEffect(() => {
    if (!active || !ready) {
      return
    }

    if (prefersReducedMotion()) {
      skeletonShownAtRef.current = 0
      dispatch({ type: 'reveal' })
      return
    }

    const shownAt = skeletonShownAtRef.current
    if (!shownAt) {
      dispatch({ type: 'reveal' })
      return
    }

    const remainingMs = Math.max(0, DASHBOARD_SKELETON_MIN_VISIBLE_MS - (performance.now() - shownAt))
    if (remainingMs <= 0) {
      skeletonShownAtRef.current = 0
      dispatch({ type: 'reveal' })
      return
    }

    const timer = window.setTimeout(() => {
      skeletonShownAtRef.current = 0
      dispatch({ type: 'reveal' })
    }, remainingMs)

    return () => {
      window.clearTimeout(timer)
    }
  }, [active, ready, state.replayKey])

  return state
}

export function DashboardPanel({ hidden }: { hidden: boolean }) {
  const [tagEditorPosition, setTagEditorPosition] = useState<DashboardTagEditorPosition>(() => getHiddenDashboardTagEditorPosition())
  const panelRef = useRef<HTMLElement | null>(null)
  const tagEditorRef = useRef<HTMLDivElement | null>(null)
  const cardElementRefs = useRef<Map<string, HTMLElement> | null>(null)
  const cardMenuFocusRequest = useDashboardViewSelector((state) => state.cardMenuFocusRequest)
  const dragOverlay = useDashboardViewSelector((state) => state.dragOverlay)
  const panelChrome = useDashboardViewSelector((state) => state.panelChrome)
  const resultsScrollRequest = useDashboardViewSelector((state) => state.resultsScrollRequest)
  const searchControls = useDashboardViewSelector((state) => state.searchControls)
  const tagEditor = useDashboardViewSelector((state) => state.tagEditor)
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
  }, [tagEditorOpen, tagEditor.bookmarkId, tagEditor.positionRequestId])

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
      <h1 id="dashboard-title" className="sr-only">
        <DashboardTitleContent />
      </h1>

      <DashboardChrome active={!hidden} ready={panelChrome.ready} searchControls={searchControls} />

      <DashboardResultsSection
        active={!hidden}
        cardsDimmed={dragOverlay.visible}
        focusRequest={cardMenuFocusRequest}
        panelChrome={panelChrome}
        registerCardElement={tagEditorOpen ? registerDashboardCardElement : undefined}
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

const DashboardChrome = memo(function DashboardChrome({
  active,
  ready,
  searchControls
}: {
  active: boolean
  ready: boolean
  searchControls: DashboardSearchControlsState
}) {
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const skeleton = useDashboardSkeletonReveal(active, ready)

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
        DASHBOARD_TOOLBAR_SKELETON_ROOT_CLASS,
        skeleton.revealed ? 'is-revealed' : ''
      ].filter(Boolean).join(' ')}
      data-state={skeleton.revealed ? 'ready' : 'loading'}
    >
      {!skeleton.revealed ? (
        <div
          key={`dashboard-chrome-skeleton:${skeleton.replayKey}`}
          className={DASHBOARD_CHROME_SKELETON_LAYER_CLASS}
          aria-hidden="true"
        >
          <DashboardChromeSkeleton />
        </div>
      ) : null}
      <div
        className={[
          DASHBOARD_CHROME_SKELETON_CONTENT_CLASS,
          skeleton.revealed ? '' : 'pointer-events-none'
        ].filter(Boolean).join(' ')}
        aria-hidden={skeleton.revealed ? undefined : 'true'}
        inert={!skeleton.revealed}
      >
        <DashboardChromeContent searchControls={searchControls} searchInputRef={searchInputRef} />
      </div>
    </div>
  )
})

function DashboardChromeContent({
  searchControls,
  searchInputRef
}: {
  searchControls: DashboardSearchControlsState
  searchInputRef: RefObject<HTMLInputElement | null>
}) {
  return (
    <div className={DASHBOARD_TOOLBAR_CLASS}>
      <div className={DASHBOARD_SEARCH_BOX_CLASS}>
        <label className={DASHBOARD_SEARCH_LABEL_CLASS} htmlFor="dashboard-query">
          <span className={DASHBOARD_SEARCH_LABEL_TEXT_CLASS}>搜索书签</span>
          <span className={DASHBOARD_QUERY_ROW_CLASS}>
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
              <Popover
                id="dashboard-search-help-popover"
                className={DASHBOARD_SEARCH_HELP_POPOVER_CLASS}
                open={searchControls.searchHelpOpen}
                onOpenChange={(open) => patchDashboardSearchControlsState({ searchHelpOpen: open })}
                positionMethod="fixed"
                triggerNativeButton
                align="end"
                side="bottom"
                sideOffset={8}
                collisionPadding={12}
                collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
                trigger={<DashboardSearchHelpButton />}
              >
                <strong className={DASHBOARD_SEARCH_HELP_TITLE_CLASS}>高级搜索语法</strong>
                {DASHBOARD_SEARCH_HELP_EXAMPLES.map((example) => (
                  <span className={DASHBOARD_SEARCH_HELP_EXAMPLE_CLASS} key={example.query}>
                    <code>{example.query}</code>
                    <span>{example.label}</span>
                  </span>
                ))}
              </Popover>
            </span>
          </span>
        </label>
        <DashboardSearchChipsContent />
        <nav className={DASHBOARD_FOLDER_BREADCRUMBS_CLASS} aria-label="当前 Dashboard 文件夹路径">
          <DashboardBreadcrumbsContent />
        </nav>
      </div>
      <div
        className={[
          DASHBOARD_SELECTION_GROUP_CLASS,
          DASHBOARD_SELECTION_GROUP_ACTIVE_CLASS
        ].filter(Boolean).join(' ')}
        data-open="true"
      >
        <DashboardSelectionBarContent />
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

function DashboardChromeSkeleton() {
  return (
    <div className={DASHBOARD_TOOLBAR_CLASS} aria-hidden="true">
      <div className={DASHBOARD_SEARCH_BOX_CLASS}>
        <div className={DASHBOARD_SEARCH_LABEL_CLASS}>
          <span className={DASHBOARD_QUERY_ROW_CLASS}>
            <span className={DASHBOARD_SEARCH_INPUT_FIELD_CLASS}>
              <span className={DASHBOARD_SEARCH_SKELETON_ICON_CLASS}></span>
              <span className={DASHBOARD_SKELETON_BAR_CLASS} style={getSkeletonWidthStyle('34%')}></span>
              <span className={DASHBOARD_SEARCH_SKELETON_ACTION_CLASS}></span>
              <span className={DASHBOARD_SEARCH_HELP_SKELETON_CLASS}></span>
            </span>
          </span>
        </div>
        <div className={DASHBOARD_FOLDER_BREADCRUMBS_CLASS}>
          <span className={DASHBOARD_SKELETON_BAR_CLASS} style={getSkeletonWidthStyle('24%')}></span>
        </div>
      </div>
      <DashboardSelectionSkeleton />
      <div className={[DASHBOARD_TITLE_ACTIONS_CLASS, '!w-[60px] !gap-0 ![grid-template-columns:none]'].join(' ')}>
        <span className={DASHBOARD_TOOLBAR_EXIT_SKELETON_CLASS}></span>
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
      <Icon name="CircleHelp" size={15} aria-hidden="true" />
    </button>
  )
}

function DashboardSelectionSkeleton() {
  return (
    <div className={[DASHBOARD_SELECTION_GROUP_CLASS, DASHBOARD_SELECTION_GROUP_ACTIVE_CLASS].join(' ')} data-open="true" aria-hidden="true">
      <div className={DASHBOARD_SELECTION_BAR_CLASS}>
        <span className={[DASHBOARD_SKELETON_BAR_CLASS, 'max-[560px]:h-[16.5px]'].join(' ')} style={getSkeletonWidthStyle('96px')}></span>
        <div className={DASHBOARD_SELECTION_ACTIONS_CLASS}>
          {['112px', '78px', '78px', '78px'].map((width, index) => (
            <span
              className={DASHBOARD_SELECTION_SKELETON_BUTTON_CLASS}
              key={`dashboard-selection-action-skeleton:${index}`}
              style={getSkeletonWidthStyle(width)}
            ></span>
          ))}
        </div>
      </div>
    </div>
  )
}

const DashboardResultsSection = memo(function DashboardResultsSection({
  active,
  cardsDimmed,
  focusRequest,
  panelChrome,
  registerCardElement,
  scrollRequest
}: {
  active: boolean
  cardsDimmed: boolean
  focusRequest: DashboardCardMenuFocusRequestState
  panelChrome: DashboardPanelChromeState
  registerCardElement?: (bookmarkId: string, node: HTMLElement | null) => void
  scrollRequest: DashboardResultsScrollRequestState
}) {
  const skeleton = useDashboardSkeletonReveal(active, panelChrome.ready)

  return (
    <section
      className={DASHBOARD_RESULTS_GROUP_CLASS}
      aria-labelledby="dashboard-cards-title"
      aria-busy={skeleton.revealed ? 'false' : 'true'}
    >
      <h2 id="dashboard-cards-title" className={DASHBOARD_RESULTS_TITLE_CLASS}>
        <DashboardCardsTitleContent />
      </h2>
      <div
        className={[
          DASHBOARD_RESULTS_SKELETON_ROOT_CLASS,
          skeleton.revealed ? 'is-revealed' : ''
        ].filter(Boolean).join(' ')}
        data-state={skeleton.revealed ? 'ready' : 'loading'}
      >
        {!skeleton.revealed ? (
          <div
            key={`dashboard-results-skeleton:${skeleton.replayKey}`}
            className={[
              DASHBOARD_RESULTS_SKELETON_LAYER_CLASS,
              DASHBOARD_CONTENT_LAYOUT_CLASS
            ].join(' ')}
            aria-hidden="true"
          >
            <DashboardResultsSkeleton />
          </div>
        ) : null}
        <div
          className={[
            DASHBOARD_RESULTS_CONTENT_LAYER_CLASS,
            DASHBOARD_CONTENT_LAYOUT_CLASS,
            skeleton.revealed ? '' : 'pointer-events-none'
          ].filter(Boolean).join(' ')}
          aria-hidden={skeleton.revealed ? undefined : 'true'}
          inert={!skeleton.revealed}
        >
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
          <DashboardResultsGrid
            active={active}
            cardsDimmed={cardsDimmed}
            focusRequest={focusRequest}
            panelChrome={panelChrome}
            registerCardElement={registerCardElement}
            scrollRequest={scrollRequest}
          />
        </div>
      </div>
    </section>
  )
})

const DashboardResultsGrid = memo(function DashboardResultsGrid({
  active,
  cardsDimmed,
  focusRequest,
  panelChrome,
  registerCardElement,
  scrollRequest
}: {
  active: boolean
  cardsDimmed: boolean
  focusRequest: DashboardCardMenuFocusRequestState
  panelChrome: DashboardPanelChromeState
  registerCardElement?: (bookmarkId: string, node: HTMLElement | null) => void
  scrollRequest: DashboardResultsScrollRequestState
}) {
  const results = useDashboardViewSelector((state) => state.results)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const scrollFrameRef = useRef<number>(0)
  const lastDispatchedScrollTopRef = useRef(0)
  const pendingScrollTopRef = useRef(0)
  const scrollingTimerRef = useRef<number>(0)

  const dispatchResultsScroll = useCallback((scrollTop: number) => {
    lastDispatchedScrollTopRef.current = scrollTop
    handleDashboardViewAction({
      action: 'results-scroll-activity',
      scrollTop
    })
  }, [])

  const clearResultsScrolling = useCallback(() => {
    if (scrollingTimerRef.current) {
      window.clearTimeout(scrollingTimerRef.current)
      scrollingTimerRef.current = 0
    }
    if (scrollFrameRef.current) {
      window.cancelAnimationFrame(scrollFrameRef.current)
      scrollFrameRef.current = 0
    }
    resultsRef.current?.removeAttribute('data-dashboard-scrolling')
  }, [])

  const markResultsScrolling = useCallback((resultsElement: HTMLElement) => {
    if (!scrollingTimerRef.current) {
      resultsElement.setAttribute('data-dashboard-scrolling', 'true')
    }
    if (scrollingTimerRef.current) {
      window.clearTimeout(scrollingTimerRef.current)
    }
    scrollingTimerRef.current = window.setTimeout(() => {
      scrollingTimerRef.current = 0
      if (resultsRef.current === resultsElement) {
        resultsElement.removeAttribute('data-dashboard-scrolling')
      }
    }, 140)
  }, [])

  const handleResultsScrollActivity = useEffectEvent((resultsElement: HTMLElement) => {
    markResultsScrolling(resultsElement)
    const scrollTop = resultsElement.scrollTop
    pendingScrollTopRef.current = scrollTop
    if (Math.abs(scrollTop - lastDispatchedScrollTopRef.current) >= DASHBOARD_IMMEDIATE_SCROLL_SYNC_DELTA) {
      if (scrollFrameRef.current) {
        window.cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = 0
      }
      flushSync(() => {
        dispatchResultsScroll(scrollTop)
      })
      return
    }
    if (scrollFrameRef.current) {
      return
    }
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = 0
      if (resultsRef.current !== resultsElement) {
        return
      }
      dispatchResultsScroll(pendingScrollTopRef.current)
    })
  })

  useEffect(() => {
    if (!active) {
      clearResultsScrolling()
      return
    }

    const resultsElement = resultsRef.current
    if (!resultsElement) {
      return
    }

    const handleResultsScroll = () => {
      handleResultsScrollActivity(resultsElement)
    }

    resultsElement.addEventListener('scroll', handleResultsScroll, { passive: true })
    return () => {
      resultsElement.removeEventListener('scroll', handleResultsScroll)
      clearResultsScrolling()
    }
  }, [active, clearResultsScrolling])

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
    lastDispatchedScrollTopRef.current = nextScrollTop
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

    lastDispatchedScrollTopRef.current = resultsElement.scrollTop
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
    <div
      ref={resultsRef}
      className={[
        DASHBOARD_CARD_GRID_CLASS,
        panelChrome.resultsUpdating ? DASHBOARD_RESULTS_TRANSITION_STATE_CLASS : '',
        panelChrome.resultsVirtualized ? DASHBOARD_RESULTS_WINDOWED_STATE_CLASS : DASHBOARD_RESULTS_GRID_STATE_CLASS,
        hasDashboardFloatingSurface(results) ? DASHBOARD_FLOATING_SURFACE_CONTAINMENT_CLASS : ''
      ].filter(Boolean).join(' ')}
      style={getDashboardResultsGridStyle(panelChrome)}
    >
      <DashboardResults
        state={results}
        dimCards={cardsDimmed}
        focusRequest={focusRequest}
        registerCardElement={registerCardElement}
      />
    </div>
  )
})

function DashboardResultsSkeleton() {
  return (
    <>
      <aside className={DASHBOARD_FOLDER_SIDEBAR_CLASS} aria-label="书签文件夹加载占位">
        <div className={DASHBOARD_FOLDER_SIDEBAR_HEAD_CLASS}>
          <span className={DASHBOARD_SKELETON_BAR_CLASS} style={getSkeletonWidthStyle('46%')}></span>
          <span className={DASHBOARD_SKELETON_BAR_CLASS} style={getSkeletonWidthStyle('28%')}></span>
        </div>
        <div className={DASHBOARD_FOLDER_TREE_CLASS}>
          {DASHBOARD_SKELETON_FOLDER_ROWS.map((row, index) => (
            <div
              className={DASHBOARD_SKELETON_FOLDER_ITEM_CLASS}
              key={`dashboard-folder-skeleton:${index}`}
              style={getDashboardSkeletonFolderStyle(row.depth)}
            >
              <span className={DASHBOARD_SKELETON_DOT_CLASS}></span>
              <span className={DASHBOARD_SKELETON_BAR_CLASS} style={getSkeletonWidthStyle(row.labelWidth)}></span>
              <span className={DASHBOARD_SKELETON_BAR_CLASS} style={getSkeletonWidthStyle(row.countWidth)}></span>
            </div>
          ))}
        </div>
      </aside>
      <div
        className={[
          DASHBOARD_CARD_GRID_CLASS,
          DASHBOARD_RESULTS_GRID_STATE_CLASS,
          DASHBOARD_SKELETON_CARD_GRID_CLASS
        ].join(' ')}
        style={getDashboardResultsGridStyle()}
      >
        {DASHBOARD_SKELETON_CARDS.map((card, index) => (
          <article className={DASHBOARD_SKELETON_CARD_CLASS} key={`dashboard-card-skeleton:${index}`}>
            <div className={DASHBOARD_SKELETON_CARD_HEADER_CLASS}>
              <span className={DASHBOARD_SKELETON_CARD_ICON_CLASS}></span>
              <span className={DASHBOARD_SKELETON_BAR_CLASS} style={getSkeletonWidthStyle('18%')}></span>
            </div>
            <div className={DASHBOARD_SKELETON_CARD_COPY_CLASS}>
              <span className={DASHBOARD_SKELETON_BAR_CLASS} style={getSkeletonWidthStyle(card.titleWidth)}></span>
              <span className={DASHBOARD_SKELETON_BAR_CLASS} style={getSkeletonWidthStyle(card.detailWidth)}></span>
            </div>
            <div className={DASHBOARD_SKELETON_CARD_META_CLASS}>
              <span className={DASHBOARD_SKELETON_BAR_CLASS} style={getSkeletonWidthStyle(card.metaWidth)}></span>
              <span className={DASHBOARD_SKELETON_BAR_CLASS} style={getSkeletonWidthStyle('24%')}></span>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}

function getDashboardResultsGridStyle(panelChrome?: DashboardPanelChromeState): CSSProperties {
  return {
    '--dashboard-card-height': `${DASHBOARD_CARD_HEIGHT}px`,
    '--dashboard-card-min-width': `${DASHBOARD_CARD_MIN_WIDTH}px`,
    '--dashboard-results-stable-height': panelChrome?.resultsStableHeight || undefined
  } as CSSProperties
}

function getDashboardSkeletonFolderStyle(depth: number): CSSProperties {
  return { '--folder-depth-offset': `${Math.max(0, depth) * 13}px` } as CSSProperties
}

function getSkeletonWidthStyle(width: string): CSSProperties {
  return { width }
}

function getDashboardResultsMetrics(element: HTMLElement) {
  const styles = window.getComputedStyle(element)
  const horizontalPadding =
    Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight)
  const contentWidth = element.clientWidth - (Number.isFinite(horizontalPadding) ? horizontalPadding : 0)

  return {
    clientHeight: element.clientHeight,
    clientWidth: Math.max(0, contentWidth),
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

const DashboardTagEditorLayer = memo(function DashboardTagEditorLayer({
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
                每行一个标签，保存后自动去重。
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
})

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

const DashboardDragOverlay = memo(function DashboardDragOverlay({ state }: { state: DashboardDragOverlayState }) {
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
})

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
