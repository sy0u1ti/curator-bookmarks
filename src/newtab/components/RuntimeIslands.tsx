import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react'
import {
  Button,
  Icon
} from '../../ui'
import type { NewTabTimeSettings } from '../time-settings'

export interface ClockWidgetState {
  ariaLabel: string
  dateDateTime: string
  dateText: string
  periodText: string
  settings: NewTabTimeSettings
  timeDateTime: string
  timeText: string
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

export function mountNewTabDragGhostBridge(ghost: HTMLElement): void {
  document.body.append(ghost)
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
  } as CSSProperties

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
  event: SyntheticEvent<HTMLImageElement>,
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
  event: SyntheticEvent<HTMLImageElement>,
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
