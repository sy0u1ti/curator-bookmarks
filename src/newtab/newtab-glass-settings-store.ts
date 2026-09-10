import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'
import { STORAGE_KEYS } from '../shared/constants.js'
import { getLocalStorage } from '../shared/storage.js'
import { applyGlassSettingsCss, DEFAULT_GLASS_SETTINGS, GLASS_SETTINGS_CACHE_KEY, normalizeGlassSettings, readGlassSettingsCache, type NewtabGlassSettingKey, type NewtabGlassSettings } from './glass-settings.js'

interface GlassSettingsView {
  settings: NewtabGlassSettings
  ready: boolean
  saveState: 'idle' | 'saving' | 'saved' | 'error'
}
const store = createUiViewStoreSlice<GlassSettingsView>('newtab', 'glass-settings', {
  settings: { ...DEFAULT_GLASS_SETTINGS }, ready: false, saveState: 'idle'
})
const listeners = new Set<(settings: NewtabGlassSettings) => void>()
let started = false
let generation = 0
let saveTimer: ReturnType<typeof setTimeout> | undefined
let writeQueue: Promise<void> = Promise.resolve()
let closing = false

function writeSettings(settings: NewtabGlassSettings): Promise<void> {
  // This is one complete, atomic storage value. Do not wait for the shared
  // read/modify/write lock: its queued callback can be abandoned on pagehide.
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.newTabGlassSettings]: settings }, () => {
      const error = chrome.runtime.lastError
      if (error) reject(new Error(error.message))
      else resolve()
    })
  })
}

function publish(settings: NewtabGlassSettings, saveState: GlassSettingsView['saveState'], ready = true): void {
  store.setState({ settings, ready, saveState })
  applyGlassSettingsCss(settings)
  try { localStorage.setItem(GLASS_SETTINGS_CACHE_KEY, JSON.stringify(settings)) } catch { /* Chrome storage remains authoritative. */ }
  listeners.forEach(listener => listener(settings))
}

export function initializeNewtabGlassSettings(): void {
  if (started) return
  started = true
  publish(readGlassSettingsCache(), 'idle', false)
  const initialGeneration = generation
  void getLocalStorage<Record<string, unknown>>([STORAGE_KEYS.newTabGlassSettings]).then(stored => {
    if (generation === initialGeneration) publish(normalizeGlassSettings(stored[STORAGE_KEYS.newTabGlassSettings]), 'idle')
  }).catch(() => publish(store.getState().settings, 'error'))

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEYS.newTabGlassSettings] || store.getState().saveState === 'saving') return
    const settings = normalizeGlassSettings(changes[STORAGE_KEYS.newTabGlassSettings].newValue)
    if (JSON.stringify(settings) !== JSON.stringify(store.getState().settings)) publish(settings, 'idle')
  })
  window.addEventListener('pagehide', () => {
    closing = true
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
    // Submit the final browser-storage RPC synchronously, before this document
    // disappears. Older queued writes are skipped; already-sent writes precede it.
    if (store.getState().saveState === 'saving') void writeSettings(store.getState().settings).catch(() => {})
  })
  window.addEventListener('pageshow', () => { closing = false })
}

export function subscribeNewtabGlassSettings(listener: (settings: NewtabGlassSettings) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function getNewtabGlassSettings(): NewtabGlassSettings { return store.getState().settings }
export function useNewtabGlassSettings(): GlassSettingsView { return useUiViewStoreSlice(store) }

function persist(): void {
  const version = generation
  const settings = { ...store.getState().settings }
  writeQueue = writeQueue.catch(() => {}).then(() => {
    if (closing || version !== generation) return
    return writeSettings(settings)
  })
    .then(() => { if (version === generation) store.setState({ ...store.getState(), saveState: 'saved' }) })
    .catch(() => { if (version === generation) store.setState({ ...store.getState(), saveState: 'error' }) })
}
function update(next: NewtabGlassSettings): void {
  generation++
  publish(next, 'saving')
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { saveTimer = undefined; persist() }, 180)
}
export function changeNewtabGlassSetting(key: NewtabGlassSettingKey, value: number): void {
  const current = store.getState().settings
  const next = normalizeGlassSettings({ ...current, [key]: value })
  if (next[key] !== current[key]) update(next)
}
export function resetNewtabGlassSettings(): void { update({ ...DEFAULT_GLASS_SETTINGS }) }
