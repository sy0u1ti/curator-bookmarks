import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type CSSProperties,
  type MutableRefObject,
  type RefObject,
  type SyntheticEvent
} from 'react'
import { Button } from '../../ui/base/Button'
import { Icon } from '../../ui/icons/Icon'
import { useNewtabFeaturedBackgroundPickerFocusRequest } from '../newtab-featured-background-picker-store'
import { FEATURED_WALLPAPER_CONTROL_CLASS } from './featuredWallpaperControlClasses'

const FEATURED_BACKGROUND_INITIAL_PREVIEW_HYDRATION_LIMIT = 16
const FEATURED_BACKGROUND_PREVIEW_OBSERVER_ROOT_MARGIN = '280px 0px'
const FEATURED_BACKGROUND_PICKER_CARD_CLASS =
  'featured-wallpaper-card rounded-ds-sm border border-ds-border bg-ds-surface-1 shadow-none [&::before]:shadow-none [&::after]:shadow-none'
const FEATURED_BACKGROUND_PICKER_CARD_SELECTED_CLASS =
  'border-ds-border-hover bg-ds-selected text-ds-text-primary shadow-none'
const FEATURED_BACKGROUND_CARD_ACTION_CLASS = `featured-wallpaper-card-action ${FEATURED_WALLPAPER_CONTROL_CLASS}`
const FEATURED_BACKGROUND_DOWNLOAD_CLASS = `featured-wallpaper-download ${FEATURED_BACKGROUND_CARD_ACTION_CLASS}`
const FEATURED_BACKGROUND_FAVORITE_CLASS = `featured-wallpaper-favorite ${FEATURED_BACKGROUND_CARD_ACTION_CLASS}`
const FEATURED_BACKGROUND_FAVORITE_SELECTED_CLASS = FEATURED_BACKGROUND_FAVORITE_CLASS

export interface FeaturedBackgroundHoverPreviewRequest {
  element: HTMLElement
  imageUrl: string
  resolvedPreviewUrl: string
  title: string
}

export interface FeaturedBackgroundPickerCardViewModel {
  favorite: boolean
  fetchpriority: 'high' | 'auto'
  id: string
  imageUrl: string
  initialPreviewUrl: string
  onClearHoverPreview: (card?: HTMLElement) => void
  onDownload: (card: HTMLElement, id: string) => void | Promise<void>
  onFavoriteToggle: (card: HTMLElement, id: string) => void | Promise<void>
  onResolvePreviewObjectUrl: (remotePreviewUrl: string, fallbackUrl: string) => Promise<string>
  onSelect: (card: HTMLElement, id: string) => void
  onScheduleHoverPreview: (request: FeaturedBackgroundHoverPreviewRequest) => void
  previewAccentColor: string
  previewFallbackUrls: string[]
  renderIndex: number
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

type FeaturedBackgroundPreviewState = 'ready' | 'loading'
interface FeaturedBackgroundPreviewViewState {
  src: string
  state: FeaturedBackgroundPreviewState
}

type FeaturedBackgroundPreviewViewAction =
  | { type: 'loading' }
  | { type: 'ready' }
  | { type: 'src'; src: string; state: FeaturedBackgroundPreviewState }

export function FeaturedBackgroundPicker({
  previewRootRef,
  state
}: {
  previewRootRef?: RefObject<HTMLElement | null>
  state: FeaturedBackgroundPickerState
}) {
  const focusRequest = useNewtabFeaturedBackgroundPickerFocusRequest()

  if (state.type === 'state') {
    return <div className="featured-wallpaper-state">{state.label}</div>
  }

  const focusTargetId = getFeaturedBackgroundPickerFocusTargetId(state)

  return (
    <>
      {state.sections.map((section) => (
        section.type === 'grid' ? (
          <FeaturedBackgroundPickerGridSection
            focusRequestId={focusRequest.requestId}
            focusTargetId={focusTargetId}
            previewRootRef={previewRootRef}
            section={section.section}
            key={`grid:${section.section.title}`}
          />
        ) : (
          <FeaturedBackgroundPickerProviderSection
            focusRequestId={focusRequest.requestId}
            focusTargetId={focusTargetId}
            previewRootRef={previewRootRef}
            section={section}
            key={`providers:${section.title}`}
          />
        )
      ))}
    </>
  )
}

function FeaturedBackgroundPickerProviderSection({
  focusRequestId,
  focusTargetId,
  previewRootRef,
  section
}: {
  focusRequestId: number
  focusTargetId: string
  previewRootRef?: RefObject<HTMLElement | null>
  section: Extract<FeaturedBackgroundPickerSectionViewModel, { type: 'providers' }>
}) {
  return (
    <section className="featured-wallpaper-section" aria-label={section.title}>
      <h4 className="featured-wallpaper-section-title">{section.title}</h4>
      <div className="featured-wallpaper-provider-stack">
        {section.groups.map((group) => (
          <section className="featured-wallpaper-provider-section" aria-label={group.title} key={group.title}>
            <h5 className="featured-wallpaper-provider-title">{group.title}</h5>
            <FeaturedBackgroundPickerCardGrid
              cards={group.cards}
              emptyText={group.emptyText}
              focusRequestId={focusRequestId}
              focusTargetId={focusTargetId}
              previewRootRef={previewRootRef}
            />
          </section>
        ))}
      </div>
    </section>
  )
}

function FeaturedBackgroundPickerGridSection({
  focusRequestId,
  focusTargetId,
  previewRootRef,
  section
}: {
  focusRequestId: number
  focusTargetId: string
  previewRootRef?: RefObject<HTMLElement | null>
  section: FeaturedBackgroundPickerGridSectionViewModel
}) {
  return (
    <section className="featured-wallpaper-section" aria-label={section.title}>
      <h4 className="featured-wallpaper-section-title">{section.title}</h4>
      <FeaturedBackgroundPickerCardGrid
        cards={section.cards}
        emptyText={section.emptyText}
        focusRequestId={focusRequestId}
        focusTargetId={focusTargetId}
        previewRootRef={previewRootRef}
      />
    </section>
  )
}

function FeaturedBackgroundPickerCardGrid({
  cards,
  emptyText,
  focusRequestId,
  focusTargetId,
  previewRootRef
}: {
  cards: FeaturedBackgroundPickerCardViewModel[]
  emptyText: string
  focusRequestId: number
  focusTargetId: string
  previewRootRef?: RefObject<HTMLElement | null>
}) {
  return (
    <div className="featured-wallpaper-section-grid">
      {cards.length ? (
        cards.map((card) => (
          <FeaturedBackgroundPickerCard
            card={card}
            focusRequestId={focusRequestId}
            previewRootRef={previewRootRef}
            shouldReceiveInitialFocus={card.id === focusTargetId}
            key={getFeaturedBackgroundPickerCardKey(card)}
          />
        ))
      ) : (
        <div className="featured-wallpaper-section-empty">{emptyText}</div>
      )}
    </div>
  )
}

function FeaturedBackgroundPickerCard({
  card,
  focusRequestId,
  previewRootRef,
  shouldReceiveInitialFocus
}: {
  card: FeaturedBackgroundPickerCardViewModel
  focusRequestId: number
  previewRootRef?: RefObject<HTMLElement | null>
  shouldReceiveInitialFocus: boolean
}) {
  const [previewView, dispatchPreviewView] = useReducer(
    reduceFeaturedBackgroundPreviewView,
    card.initialPreviewUrl,
    createFeaturedBackgroundPreviewViewState
  )
  const cardRef = useRef<HTMLElement | null>(null)
  const resolvedPreviewUrlRef = useRef(card.initialPreviewUrl)
  const fallbackUrlsRef = useRef<string[]>([])
  const fallbackUrlsInitializedRef = useRef(false)
  const handledFocusRequestIdRef = useRef(0)
  const hydrationRequestKeyRef = useRef('')
  if (!fallbackUrlsInitializedRef.current) {
    fallbackUrlsRef.current = getFeaturedBackgroundPreviewFallbackQueue(card.previewFallbackUrls)
    fallbackUrlsInitializedRef.current = true
  }

  const hydratePreview = useCallback(() => {
    const remotePreviewUrl = card.remotePreviewUrl || card.imageUrl
    if (!remotePreviewUrl) {
      return
    }

    const requestKey = `${card.id}:${remotePreviewUrl}`
    if (hydrationRequestKeyRef.current === requestKey) {
      return
    }
    hydrationRequestKeyRef.current = requestKey

    const fallbackUrl = resolvedPreviewUrlRef.current || card.initialPreviewUrl || remotePreviewUrl
    void card.onResolvePreviewObjectUrl(remotePreviewUrl, fallbackUrl)
      .then((objectUrl) => {
        if (!objectUrl || hydrationRequestKeyRef.current !== requestKey || !cardRef.current?.isConnected) {
          return
        }
        resolvedPreviewUrlRef.current = objectUrl
        dispatchPreviewView({ type: 'src', src: objectUrl, state: 'ready' })
      })
  }, [
    card.id,
    card.imageUrl,
    card.initialPreviewUrl,
    card.onResolvePreviewObjectUrl,
    card.remotePreviewUrl
  ])

  useEffect(() => {
    if (!shouldReceiveInitialFocus ||
      focusRequestId === 0 ||
      handledFocusRequestIdRef.current === focusRequestId) {
      return
    }
    handledFocusRequestIdRef.current = focusRequestId
    cardRef.current?.focus()
  }, [focusRequestId, shouldReceiveInitialFocus])

  useEffect(() => {
    if (card.renderIndex < FEATURED_BACKGROUND_INITIAL_PREVIEW_HYDRATION_LIMIT) {
      hydratePreview()
      return
    }

    const element = cardRef.current
    if (!element) {
      return
    }
    if (typeof IntersectionObserver === 'undefined') {
      hydratePreview()
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return
      }
      hydratePreview()
      observer.disconnect()
    }, {
      root: previewRootRef?.current ?? null,
      rootMargin: FEATURED_BACKGROUND_PREVIEW_OBSERVER_ROOT_MARGIN
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [card.id, card.renderIndex, hydratePreview, previewRootRef])

  const className = [
    FEATURED_BACKGROUND_PICKER_CARD_CLASS,
    card.selected ? FEATURED_BACKGROUND_PICKER_CARD_SELECTED_CLASS : ''
  ].filter(Boolean).join(' ')
  const cardStyle = {
    '--featured-wallpaper-preview-placeholder': card.previewAccentColor
  } as CSSProperties

  return (
    <Button
      className={className}
      nativeButton={false}
      render={<div />}
      unstyled
      aria-label={card.title}
      aria-pressed={card.selected}
      data-featured-background-id={card.id}
      style={cardStyle}
      ref={(element) => {
        cardRef.current = element
      }}
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
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') {
          return
        }
        card.onScheduleHoverPreview(createFeaturedBackgroundHoverPreviewRequest({
          card,
          element: event.currentTarget,
          resolvedPreviewUrl: resolvedPreviewUrlRef.current || previewView.src
        }))
      }}
      onPointerLeave={(event) => {
        card.onClearHoverPreview(event.currentTarget)
      }}
    >
      <span className="featured-wallpaper-preview">
        <img
          className="featured-wallpaper-preview-image"
          src={previewView.src}
          alt=""
          decoding="async"
          loading="eager"
          fetchPriority={card.fetchpriority}
          draggable={false}
          onError={(event) => {
            handleFeaturedBackgroundPreviewError({
              event,
              fallbackUrlsRef,
              previewSrc: previewView.src,
              resolvedPreviewUrlRef,
              dispatchPreviewView
            })
          }}
          onLoad={(event) => {
            handleFeaturedBackgroundPreviewLoad({
              event,
              resolvedPreviewUrlRef,
              dispatchPreviewView
            })
          }}
        />
        <span className="featured-wallpaper-resolution" data-state={card.resolutionState}>
          {card.resolutionText}
        </span>
        <span className="featured-wallpaper-card-actions">
          <Button
            className={FEATURED_BACKGROUND_DOWNLOAD_CLASS}
            type="button"
            aria-label="下载这张精选图"
            title="下载原图"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              const cardElement = cardRef.current
              if (!cardElement) {
                return
              }
              card.onClearHoverPreview(cardElement)
              void card.onDownload(cardElement, card.id)
            }}
            unstyled
          >
            <Icon name="Download" aria-hidden="true" />
          </Button>
          <Button
            className={card.favorite ? FEATURED_BACKGROUND_FAVORITE_SELECTED_CLASS : FEATURED_BACKGROUND_FAVORITE_CLASS}
            type="button"
            aria-pressed={card.favorite}
            aria-label={card.favorite ? '取消收藏这张精选图' : '收藏这张精选图'}
            title={card.favorite ? '取消收藏' : '收藏'}
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
      </span>
    </Button>
  )
}

function createFeaturedBackgroundHoverPreviewRequest({
  card,
  element,
  resolvedPreviewUrl
}: {
  card: FeaturedBackgroundPickerCardViewModel
  element: HTMLElement
  resolvedPreviewUrl: string
}): FeaturedBackgroundHoverPreviewRequest {
  return {
    element,
    imageUrl: card.imageUrl,
    resolvedPreviewUrl: resolvedPreviewUrl || card.initialPreviewUrl || card.imageUrl,
    title: card.title
  }
}

function createFeaturedBackgroundPreviewViewState(src: string): FeaturedBackgroundPreviewViewState {
  return {
    src,
    state: src ? 'ready' : 'loading'
  }
}

function reduceFeaturedBackgroundPreviewView(
  state: FeaturedBackgroundPreviewViewState,
  action: FeaturedBackgroundPreviewViewAction
): FeaturedBackgroundPreviewViewState {
  switch (action.type) {
    case 'loading':
      return state.state === 'loading'
        ? state
        : { ...state, state: 'loading' }
    case 'ready':
      return state.state === 'ready'
        ? state
        : { ...state, state: 'ready' }
    case 'src':
      return state.src === action.src && state.state === action.state
        ? state
        : { src: action.src, state: action.state }
  }
}

function handleFeaturedBackgroundPreviewError({
  event,
  fallbackUrlsRef,
  previewSrc,
  resolvedPreviewUrlRef,
  dispatchPreviewView
}: {
  event: SyntheticEvent<HTMLImageElement>
  fallbackUrlsRef: MutableRefObject<string[]>
  previewSrc: string
  resolvedPreviewUrlRef: MutableRefObject<string>
  dispatchPreviewView: (action: FeaturedBackgroundPreviewViewAction) => void
}) {
  const image = event.currentTarget
  const failedUrl = image.currentSrc || image.src || previewSrc
  const fallbackUrl = takeNextFeaturedBackgroundPreviewFallbackUrl(fallbackUrlsRef, failedUrl)
  if (!fallbackUrl) {
    dispatchPreviewView({ type: 'loading' })
    return
  }

  resolvedPreviewUrlRef.current = fallbackUrl
  dispatchPreviewView({ type: 'src', src: fallbackUrl, state: 'ready' })
}

function handleFeaturedBackgroundPreviewLoad({
  event,
  resolvedPreviewUrlRef,
  dispatchPreviewView
}: {
  event: SyntheticEvent<HTMLImageElement>
  resolvedPreviewUrlRef: MutableRefObject<string>
  dispatchPreviewView: (action: FeaturedBackgroundPreviewViewAction) => void
}) {
  const image = event.currentTarget
  resolvedPreviewUrlRef.current = image.currentSrc || image.src
  dispatchPreviewView({ type: 'ready' })
}

function getFeaturedBackgroundPreviewFallbackQueue(urls: string[]): string[] {
  const seen = new Set<string>()
  const queue: string[] = []
  for (const url of urls) {
    const previewUrl = String(url || '').trim()
    if (!previewUrl || seen.has(previewUrl)) {
      continue
    }
    seen.add(previewUrl)
    queue.push(previewUrl)
  }
  return queue
}

function takeNextFeaturedBackgroundPreviewFallbackUrl(
  fallbackUrlsRef: MutableRefObject<string[]>,
  failedUrl: string
): string {
  const normalizedFailedUrl = String(failedUrl || '').trim()
  const fallbackUrl = fallbackUrlsRef.current.find((url) => url && url !== normalizedFailedUrl) || ''
  fallbackUrlsRef.current = fallbackUrlsRef.current.filter((url) => url && url !== fallbackUrl)
  return fallbackUrl
}

function getFeaturedBackgroundPickerCardKey(card: FeaturedBackgroundPickerCardViewModel): string {
  return [
    card.id,
    card.remotePreviewUrl,
    card.initialPreviewUrl,
    card.renderIndex,
    card.previewFallbackUrls.join('\u001f')
  ].join(':')
}

function getFeaturedBackgroundPickerFocusTargetId(
  state: Extract<FeaturedBackgroundPickerState, { type: 'sections' }>
): string {
  let firstCardId = ''
  let selectedCardId = ''

  for (const card of getFeaturedBackgroundPickerCards(state)) {
    firstCardId ||= card.id
    if (card.selected) {
      selectedCardId = card.id
      break
    }
  }

  return selectedCardId || firstCardId
}

function* getFeaturedBackgroundPickerCards(
  state: Extract<FeaturedBackgroundPickerState, { type: 'sections' }>
): Generator<FeaturedBackgroundPickerCardViewModel> {
  for (const section of state.sections) {
    if (section.type === 'grid') {
      yield* section.section.cards
      continue
    }

    for (const group of section.groups) {
      yield* group.cards
    }
  }
}
