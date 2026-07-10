import {
  useCallback,
  useLayoutEffect,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { useMotionEntrance } from '../../ui/motion/useMotionEntrance'
import { Button } from '../../ui/base/Button'
import { Icon } from '../../ui/icons/Icon'
import {
  setNewtabSpeedDialCardIconNode,
  setNewtabSpeedDialCardNode,
  setNewtabSpeedDialGridNode,
  useNewtabSpeedDialView
} from '../newtab-speed-dial-store'
import { useNewtabDragUiView, type NewtabDragUiView } from '../newtab-drag-ui-store'
import type { SpeedDialEmptyState } from '../speed-dial-types'
import { BookmarkIconShell, type BookmarkIconShellFavicon } from './BookmarkIconShell'
import {
  SPEED_DIAL_COPY_CLASS,
  SPEED_DIAL_COPY_DETAIL_CLASS,
  SPEED_DIAL_COPY_TITLE_CLASS,
  SPEED_DIAL_EMPTY_CLASS,
  SPEED_DIAL_EMPTY_ACTION_CLASS,
  SPEED_DIAL_EMPTY_COPY_CLASS,
  SPEED_DIAL_EMPTY_DETAIL_CLASS,
  SPEED_DIAL_EMPTY_TITLE_CLASS,
  SPEED_DIAL_GRID_CLASS,
  SPEED_DIAL_HEADING_CLASS,
  SPEED_DIAL_MARK_CLASS,
  SPEED_DIAL_META_CLASS,
  SPEED_DIAL_PANEL_CLASS,
  SPEED_DIAL_TITLE_CLASS,
  getSpeedDialCardClass
} from './speedDialClasses'

export interface SpeedDialCardViewModel {
  customIcon: boolean
  detail: string
  dragging: boolean
  fallbackLabel: string
  favicon: BookmarkIconShellFavicon
  id: string
  onContextMenu: (event: ReactMouseEvent<HTMLAnchorElement>) => void
  onDragPointerDown: (event: ReactPointerEvent<HTMLAnchorElement>) => void
  onNavigate: (event: ReactMouseEvent<HTMLAnchorElement>) => void
  style?: CSSProperties
  title: string
  url: string
}

export type SpeedDialContentState =
  | { type: 'loading'; label: string }
  | { type: 'empty'; onOpenDashboard: () => void; state: SpeedDialEmptyState }
  | { type: 'items'; busy: boolean; items: SpeedDialCardViewModel[] }

export interface SpeedDialPanelState {
  ariaBusy: boolean
  content: SpeedDialContentState
  meta: string
  metaTone?: 'error' | ''
}

export function SpeedDialPanelHost() {
  const state = useNewtabSpeedDialView()
  const dragUi = useNewtabDragUiView()
  if (!state) {
    return null
  }

  return (
    <section
      className={SPEED_DIAL_PANEL_CLASS}
      data-content-type={state.content.type}
      aria-label="固定入口"
      aria-busy={state.ariaBusy}
    >
      <SpeedDialPanel dragUi={dragUi} state={state} />
    </section>
  )
}

function SpeedDialPanel({ dragUi, state }: { dragUi: NewtabDragUiView; state: SpeedDialPanelState }) {
  return (
    <>
      <div className={SPEED_DIAL_HEADING_CLASS}>
        <h2 className={SPEED_DIAL_TITLE_CLASS}>固定入口</h2>
        <span className={SPEED_DIAL_META_CLASS} data-tone={state.metaTone || undefined}>{state.meta}</span>
      </div>
      <SpeedDialContent dragUi={dragUi} state={state.content} />
    </>
  )
}

function SpeedDialContent({ dragUi, state }: { dragUi: NewtabDragUiView; state: SpeedDialContentState }) {
  const emptyEntered = useMotionEntrance(state.type === 'empty')

  if (state.type === 'loading') {
    return (
      <output className={SPEED_DIAL_EMPTY_CLASS} aria-live="polite">
        {state.label}
      </output>
    )
  }

  if (state.type === 'empty') {
    return (
      <div className={['t-stagger', SPEED_DIAL_EMPTY_CLASS, emptyEntered ? 'is-shown' : ''].filter(Boolean).join(' ')}>
        <div className={SPEED_DIAL_EMPTY_COPY_CLASS}>
          <strong className={['t-stagger-line t-stagger-line--1', SPEED_DIAL_EMPTY_TITLE_CLASS].join(' ')}>{state.state.title}</strong>
          <span className={['t-stagger-line t-stagger-line--2', SPEED_DIAL_EMPTY_DETAIL_CLASS].join(' ')}>{state.state.detail}</span>
        </div>
        <Button
          className={SPEED_DIAL_EMPTY_ACTION_CLASS}
          type="button"
          onClick={state.onOpenDashboard}
          unstyled
        >
          添加固定入口
          <Icon name="Plus" size={14} aria-hidden="true" />
        </Button>
      </div>
    )
  }

  return <SpeedDialItemsGrid dragUi={dragUi} state={state} />
}

function SpeedDialItemsGrid({
  dragUi,
  state
}: {
  dragUi: NewtabDragUiView
  state: Extract<SpeedDialContentState, { type: 'items' }>
}) {
  const setGridRef = useCallback((element: HTMLDivElement | null) => {
    setNewtabSpeedDialGridNode(element)
  }, [])

  useLayoutEffect(() => {
    return () => {
      setNewtabSpeedDialGridNode(null)
    }
  }, [])

  return (
    <div className={SPEED_DIAL_GRID_CLASS} aria-busy={state.busy ? 'true' : 'false'} ref={setGridRef}>
      {state.items.map((item) => (
        <SpeedDialCard dragUi={dragUi} item={item} key={item.id} />
      ))}
    </div>
  )
}

function SpeedDialCard({ dragUi, item }: { dragUi: NewtabDragUiView; item: SpeedDialCardViewModel }) {
  const setCardRef = useCallback((element: HTMLAnchorElement | null) => {
    setNewtabSpeedDialCardNode(item.id, element)
  }, [item.id])
  const setIconRef = useCallback((element: HTMLSpanElement | null) => {
    setNewtabSpeedDialCardIconNode(item.id, element)
  }, [item.id])

  useLayoutEffect(() => {
    return () => {
      setNewtabSpeedDialCardNode(item.id, null)
      setNewtabSpeedDialCardIconNode(item.id, null)
    }
  }, [item.id])

  return (
    <a
      className={getSpeedDialCardClass({
        dragActive: dragUi.speedDialDragging,
        dragging: item.dragging,
        previewInitializing: dragUi.previewInitializing
      })}
      href={item.url}
      title={item.title}
      draggable={false}
      data-bookmark-id={item.id}
      data-speed-dial-bookmark-id={item.id}
      aria-label={`打开固定入口：${item.title}。长按拖拽调整固定入口顺序`}
      onClick={item.onNavigate}
      onContextMenu={item.onContextMenu}
      onPointerDown={item.onDragPointerDown}
      ref={setCardRef}
      style={item.style}
    >
      <BookmarkIconShell
        className={SPEED_DIAL_MARK_CLASS}
        customIcon={item.customIcon}
        fallbackLabel={item.fallbackLabel}
        favicon={item.favicon}
        ref={setIconRef}
      />
      <span className={SPEED_DIAL_COPY_CLASS}>
        <strong className={SPEED_DIAL_COPY_TITLE_CLASS}>{item.title}</strong>
        <span className={SPEED_DIAL_COPY_DETAIL_CLASS}>{item.detail}</span>
      </span>
    </a>
  )
}
