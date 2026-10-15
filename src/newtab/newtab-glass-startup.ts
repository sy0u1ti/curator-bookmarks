export const NEWTAB_GLASS_STARTUP_READY_EVENT = 'newtab:glass-startup-ready'

export function isNewtabGlassStartupPending(): boolean {
  return document.documentElement.dataset.newtabGlassStartup === 'pending'
}

export function finishNewtabGlassStartup(mode: 'ready' | 'fallback'): void {
  if (!isNewtabGlassStartupPending()) return
  document.documentElement.dataset.newtabGlassStartup = mode
  performance.mark('newtab.glassPresented')
  window.dispatchEvent(new Event(NEWTAB_GLASS_STARTUP_READY_EVENT))
}

export function guardNewtabGlassStartup(): void {
  // A missing renderer or unavailable wallpaper must not leave the page hidden.
  // The fallback is final for this startup; a late worker cannot flash a new rim.
  const timer = window.setTimeout(() => finishNewtabGlassStartup('fallback'), 500)
  window.addEventListener(NEWTAB_GLASS_STARTUP_READY_EVENT, () => window.clearTimeout(timer), { once: true })
}
