import type { SyncMessage } from './sync-messages.js'

/** Never accept content-script senders or another extension, even at a similar URL. */
export function canAccessSync(
  sender: { id?: string; url?: string },
  type: SyncMessage['type'],
  extensionId: string,
  extensionUrl: string
): boolean {
  if (sender.id !== extensionId || !sender.url) return false
  try {
    const actual = new URL(sender.url)
    const expected = new URL(extensionUrl)
    if (actual.protocol !== expected.protocol || actual.host !== expected.host) return false
    if (actual.pathname === '/src/options/options.html' || actual.pathname === '/src/sidepanel/sidepanel.html') return true
    // Interactive login outlives a transient popup; it continues in a persistent editor.
    return actual.pathname === '/src/popup/popup.html' && type !== 'sync:authorize'
  } catch { return false }
}
