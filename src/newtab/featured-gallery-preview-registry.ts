export interface FeaturedBackgroundCardPreviewElement {
}

export interface FeaturedBackgroundPreviewImageElement {
  dataset: Record<string, string>
  src: string
}

export interface FeaturedBackgroundCardPreviewEntry {
  card: FeaturedBackgroundCardPreviewElement
  image: FeaturedBackgroundPreviewImageElement
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
      entries.set(entry.card, {
        ...entry,
        visible: false
      })
    },

    markVisible(card: FeaturedBackgroundCardPreviewElement): FeaturedBackgroundCardPreviewEntry | null {
      const entry = entries.get(card)
      if (!entry || entry.visible) {
        return null
      }
      entry.visible = true
      return entry
    },

    unregister(card: FeaturedBackgroundCardPreviewElement): void {
      entries.delete(card)
    },

    resetVisibility(): void {
      for (const entry of entries.values()) {
        entry.visible = false
      }
    },

    clear(): void {
      entries.clear()
    }
  }
}
