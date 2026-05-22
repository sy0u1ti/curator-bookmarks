export interface FeaturedBackgroundCardPreviewElement {
  dataset: Record<string, string>
  classList: {
    add: (...tokens: string[]) => void
    remove: (...tokens: string[]) => void
    toggle: (token: string, force?: boolean) => boolean
  }
  style: {
    setProperty: (name: string, value: string) => void
  }
}

export interface FeaturedBackgroundPreviewImageElement {
  dataset: Record<string, string>
  src: string
}

export interface FeaturedBackgroundCardPreviewEntry {
  card: FeaturedBackgroundCardPreviewElement
  image: FeaturedBackgroundPreviewImageElement
  accentColor: string
}

export interface FeaturedBackgroundCardPreviewRegistry {
  register: (entry: FeaturedBackgroundCardPreviewEntry) => void
  markVisible: (card: FeaturedBackgroundCardPreviewElement) => FeaturedBackgroundCardPreviewEntry | null
  unregister: (card: FeaturedBackgroundCardPreviewElement) => void
  resetVisibility: () => void
  clear: () => void
}

export function createFeaturedBackgroundCardPreviewRegistry(): FeaturedBackgroundCardPreviewRegistry {
  const entries = new Map<FeaturedBackgroundCardPreviewElement, FeaturedBackgroundCardPreviewEntry & { visible: boolean }>()

  return {
    register(entry: FeaturedBackgroundCardPreviewEntry): void {
      const placeholderColor = normalizeFeaturedBackgroundPreviewPlaceholderColor(entry.accentColor)
      entry.card.style.setProperty('--featured-wallpaper-preview-placeholder', placeholderColor)
      entry.card.classList.add('is-loading')
      entry.card.classList.remove('has-preview-image')
      entry.card.dataset.featuredBackgroundPreviewState = 'pending'
      entries.set(entry.card, {
        ...entry,
        accentColor: placeholderColor,
        visible: false
      })
    },

    markVisible(card: FeaturedBackgroundCardPreviewElement): FeaturedBackgroundCardPreviewEntry | null {
      const entry = entries.get(card)
      if (!entry || entry.visible) {
        return null
      }
      entry.visible = true
      entry.card.dataset.featuredBackgroundPreviewState = 'visible'
      return entry
    },

    unregister(card: FeaturedBackgroundCardPreviewElement): void {
      entries.delete(card)
    },

    resetVisibility(): void {
      for (const entry of entries.values()) {
        entry.visible = false
        entry.card.dataset.featuredBackgroundPreviewState = 'pending'
      }
    },

    clear(): void {
      entries.clear()
    }
  }
}

function normalizeFeaturedBackgroundPreviewPlaceholderColor(value: unknown): string {
  const color = String(value || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color
  }
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
  }
  return '#151515'
}
