const CONTENT_SELECTOR = [
  'a', 'button', 'input', 'textarea', 'select', '[contenteditable]',
  '[role="dialog"]', '[role="menu"]', '[role="listbox"]',
  '[data-drawer-content]', '.newtab-clock', '.newtab-search-slot',
  '.bookmark-folder-section', '.newtab-speed-dial-panel',
  '.bookmark-navigation', '.base-toast'
].join(',')

export function acceptsTexturePointer(event: PointerEvent): boolean {
  if (!(event.target instanceof Element) || event.target.closest(CONTENT_SELECTOR)) return false
  const app = document.querySelector('.newtab-app')
  if (app?.matches('.settings-open,.bookmark-dragging,.folder-order-dragging,.speed-dial-dragging')) return false
  const focused = document.activeElement
  return !(focused instanceof HTMLInputElement && focused.value.trim())
}

export function isTextureMotionAllowed(environment: {
  visible: boolean
  reducedMotion: boolean
  slowUpdates: boolean
  coarsePointer: boolean
  forcedColors: boolean
}): boolean {
  return environment.visible && !environment.reducedMotion && !environment.slowUpdates &&
    !environment.coarsePointer && !environment.forcedColors
}
