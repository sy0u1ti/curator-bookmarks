import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import { useNewtabSpeedDialView } from '../newtab-speed-dial-store'
import type { SpeedDialEmptyState } from '../speed-dial-types'
import { BookmarkIconShell, type BookmarkIconShellFavicon } from './BookmarkIconShell'

export interface SpeedDialCardViewModel {
  customIcon: boolean
  detail: string
  dragging: boolean
  fallbackLabel: string
  favicon: BookmarkIconShellFavicon
  id: string
  onNavigate: (event: ReactMouseEvent<HTMLAnchorElement>) => void
  style?: CSSProperties
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

export function SpeedDialPanelHost() {
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
