export interface FeaturedBackgroundPickerContentDependencies<Gallery> {
  getLoadedGallery: () => Gallery | null
  loadGallery: () => Promise<Gallery>
  isOpen: () => boolean
  hasRenderedContent: () => boolean
  showLoading: () => void
  showError: () => void
  render: (gallery: Gallery) => void
  focusInitialTarget: () => void
  scheduleFrame: (callback: () => void) => void
  schedulePreviewWarm: (callback: () => void) => void
  warmPreviewObjectUrls: (gallery: Gallery) => Promise<void>
}

export async function openFeaturedBackgroundPickerContent<Gallery>({
  getLoadedGallery,
  loadGallery,
  isOpen,
  hasRenderedContent,
  showLoading,
  showError,
  render,
  focusInitialTarget,
  scheduleFrame,
  schedulePreviewWarm,
  warmPreviewObjectUrls
}: FeaturedBackgroundPickerContentDependencies<Gallery>): Promise<void> {
  try {
    let gallery = getLoadedGallery()
    if (!gallery) {
      showLoading()
      gallery = await loadGallery()
      if (!isOpen()) {
        return
      }
    } else if (!hasRenderedContent()) {
      showLoading()
    }

    if (!isOpen()) {
      return
    }

    render(gallery)
    scheduleFrame(focusInitialTarget)
    schedulePreviewWarm(() => {
      void warmPreviewObjectUrls(gallery).catch(() => {})
    })
  } catch {
    showError()
  }
}
