import type { SyncProfileInput } from './sync-contract.js'

export interface SyncEditorTransfer {
  profileId?: string
  input: SyncProfileInput
  customOAuth: boolean
  client: { clientId: string; clientSecret: string }
  createdAt: number
}

const PREFIX = 'curatorSync:editor-transfer:'
let pendingTransfer: Promise<SyncEditorTransfer | null> | null = null

/** A login opens another window, so its unsaved form must outlive the popup. */
export async function continueSyncEditorInTab(transfer: Omit<SyncEditorTransfer, 'createdAt'>): Promise<void> {
  const id = crypto.randomUUID()
  const key = `${PREFIX}${id}`
  await chrome.storage.session.set({ [key]: { ...transfer, createdAt: Date.now() } })
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL(`src/options/options.html?syncEditor=${id}#backup:sync`) })
  } catch (error) {
    await chrome.storage.session.remove(key)
    throw error
  }
}

/** The one-use session entry is never put in a URL or persisted to disk. */
export async function takeSyncEditorTransfer(): Promise<SyncEditorTransfer | null> {
  if (!new URL(window.location.href).searchParams.has('syncEditor')) return null
  if (pendingTransfer) return pendingTransfer
  pendingTransfer = readTransfer()
  return pendingTransfer
}

async function readTransfer(): Promise<SyncEditorTransfer | null> {
  const url = new URL(window.location.href)
  const id = url.searchParams.get('syncEditor')
  if (!id || !/^[a-z0-9-]{36}$/i.test(id)) return null
  const key = `${PREFIX}${id}`
  const stored = (await chrome.storage.session.get(key))[key] as SyncEditorTransfer | undefined
  await chrome.storage.session.remove(key)
  url.searchParams.delete('syncEditor')
  window.history.replaceState(null, '', url.href)
  if (!stored || Date.now() - stored.createdAt > 10 * 60 * 1000 || !stored.input) return null
  return stored
}
