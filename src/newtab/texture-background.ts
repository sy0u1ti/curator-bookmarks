import {
  getTextureImageUrl,
  getTextureOpacity,
  normalizeTextureSettings,
  type TextureSettings
} from './texture-settings.js'

export const TEXTURE_SNAPSHOT_KEY = 'curatorNewTabTextureBackground'

export function readTextureBackgroundSnapshot(): TextureSettings | null {
  try {
    const record = JSON.parse(localStorage.getItem(TEXTURE_SNAPSHOT_KEY) || 'null')
    return record?.type === 'texture' ? normalizeTextureSettings(record) : null
  } catch {
    return null
  }
}

export function applyTextureBackground(settings: TextureSettings | null): void {
  const root = document.documentElement
  if (!settings) {
    delete root.dataset.textureBackground
    root.style.removeProperty('--newtab-texture-image')
    return
  }
  const normalized = normalizeTextureSettings(settings)
  root.style.setProperty('--newtab-texture-image', `url("${getTextureImageUrl(normalized.texturePreset)}")`)
  root.style.setProperty('--newtab-texture-opacity', String(getTextureOpacity(normalized)))
  root.dataset.textureBackground = normalized.texturePreset
}

export function syncTextureBackground(settings: TextureSettings & { type: string }): void {
  const texture = settings.type === 'texture' ? normalizeTextureSettings(settings) : null
  applyTextureBackground(texture)
  try {
    if (texture) localStorage.setItem(TEXTURE_SNAPSHOT_KEY, JSON.stringify({ type: 'texture', ...texture }))
    else localStorage.removeItem(TEXTURE_SNAPSHOT_KEY)
  } catch {
    // This first-paint cache is optional; chrome.storage remains authoritative.
  }
}
