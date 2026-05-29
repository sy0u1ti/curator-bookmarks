import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { Button } from '../../ui'
import type { IconLayoutPresetKey } from '../icon-settings'

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

export interface IconPreviewState {
  columns: number
  names: string[]
  sampleCount: number
}

export interface IconPresetCardState {
  desc: string
  detail: string
  key: IconLayoutPresetKey
  name: string
  previewCellHeight: string
  previewColumnCount: number
  previewGap: string
  previewPadding: string
  previewRowCount: number
}

export function renderIconPreviewIsland(container: Element, state: IconPreviewState): void {
  renderIsland(container, <IconPreview state={state} />)
}

export function renderIconPreviewSummaryIsland(container: Element, summary: string): void {
  renderIsland(container, <>{summary}</>)
}

export function renderIconPresetCardsIsland(container: Element, cards: IconPresetCardState[]): void {
  renderIsland(container, <IconPresetCards cards={cards} />)
}

function IconPreview({ state }: { state: IconPreviewState }) {
  const sampleItems = Array.from({ length: state.sampleCount }, (_, index) => ({
    id: `${index}:${state.names[index] || ''}`,
    mark: state.names[index]?.slice(0, 1) || '*',
    title: state.names[index] || ''
  }))

  return (
    <div
      className="icon-live-preview-grid"
      style={{ gridTemplateColumns: `repeat(${state.columns}, minmax(0, 1fr))` }}
    >
      {sampleItems.map((item) => (
        <span className="icon-live-preview-tile" key={item.id}>
          <span className="icon-live-preview-shell">
            <span className="icon-live-preview-mark">{item.mark}</span>
          </span>
          <span className="icon-live-preview-title">{item.title}</span>
        </span>
      ))}
    </div>
  )
}

function IconPresetCards({ cards }: { cards: IconPresetCardState[] }) {
  return (
    <>
      {cards.map((card) => (
        <Button
          className="icon-preset-card"
          type="button"
          data-preset={card.key}
          aria-pressed="false"
          aria-label={`${card.name}布局，${card.desc}，${card.detail}`}
          key={card.key}
          unstyled
        >
          <span
            className="icon-preset-preview"
            style={{
              gap: card.previewGap,
              gridTemplateColumns: `repeat(${card.previewColumnCount}, 1fr)`,
              padding: card.previewPadding
            }}
          >
            {Array.from({ length: card.previewColumnCount * card.previewRowCount }, (_, index) => (
              <span
                className="icon-preset-preview-cell"
                style={{ height: card.previewCellHeight }}
                key={`${card.key}:${index}`}
              />
            ))}
          </span>
          <span className="icon-preset-name">{card.name}</span>
          <span className="icon-preset-desc">{card.desc}</span>
          <span className="icon-preset-detail">{card.detail}</span>
        </Button>
      ))}
    </>
  )
}
