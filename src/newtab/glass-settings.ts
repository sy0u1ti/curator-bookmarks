export interface NewtabGlassSettings {
  tint: number
  blur: number
  saturation: number
  brightness: number
  highlight: number
}
export type NewtabGlassSettingKey = keyof NewtabGlassSettings
export const GLASS_SETTINGS_CACHE_KEY = 'curator-newtab-glass-v1'

// GlassSurface's Frosted path is controlled entirely by CSS.
export const DEFAULT_GLASS_SETTINGS: Readonly<NewtabGlassSettings> = {
  tint: 13, blur: 12, saturation: 140, brightness: 104, highlight: 100
}

export const GLASS_PRESETS = [
  { id: 'balanced', label: '均衡', description: '均衡的磨砂与边缘高光', settings: DEFAULT_GLASS_SETTINGS },
  { id: 'clear', label: '清透', description: '更清晰地透出背景', settings: { ...DEFAULT_GLASS_SETTINGS, tint: 6, blur: 3, saturation: 110, highlight: 65 } },
  { id: 'soft', label: '柔和', description: '柔和磨砂与低高光', settings: { ...DEFAULT_GLASS_SETTINGS, tint: 24, saturation: 100, brightness: 100, highlight: 50 } }
] as const

export function getGlassPresetId(settings: NewtabGlassSettings): string {
  return GLASS_PRESETS.find(preset => (Object.keys(DEFAULT_GLASS_SETTINGS) as NewtabGlassSettingKey[])
    .every(key => preset.settings[key] === settings[key]))?.id || 'custom'
}
export const GLASS_SETTING_LIMITS: Record<NewtabGlassSettingKey, readonly [number, number, number]> = {
  tint: [0, 60, 1],
  blur: [0, 12, 0.5], saturation: [0, 200, 1],
  brightness: [80, 120, 1], highlight: [0, 150, 1]
}

export function normalizeGlassSettings(raw: unknown): NewtabGlassSettings {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw as Record<string, unknown> } : {}
  // Keep tint/blur and map the old rim intensity to Frosted's highlight.
  // Retired optical parameters never reach the new material.
  if (source.highlight === undefined &&
    (typeof source.rim === 'number' || (typeof source.rim === 'string' && source.rim.trim() !== '')) &&
    Number.isFinite(Number(source.rim))) {
    source.highlight = Number(source.rim) / 0.3 * 100
  }
  const settings = { ...DEFAULT_GLASS_SETTINGS }
  for (const key of Object.keys(GLASS_SETTING_LIMITS) as NewtabGlassSettingKey[]) {
    const value = source[key]
    if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && value.trim() === '')) continue
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) continue
    const [min, max, step] = GLASS_SETTING_LIMITS[key]
    settings[key] = Number((Math.min(max, Math.max(min, Math.round(numeric / step) * step))).toFixed(4))
  }
  return settings
}

export function readGlassSettingsCache(): NewtabGlassSettings {
  try { return normalizeGlassSettings(JSON.parse(localStorage.getItem(GLASS_SETTINGS_CACHE_KEY) || 'null')) }
  catch { return { ...DEFAULT_GLASS_SETTINGS } }
}

export function applyGlassSettingsCss(settings: NewtabGlassSettings, root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--newtab-glass-bg-fill', `rgba(0, 0, 0, ${settings.tint / 100})`)
  root.style.setProperty('--newtab-glass-tint', String(settings.tint / 100))
  root.style.setProperty('--newtab-glass-background-blur', settings.blur + 'px')
  root.style.setProperty('--newtab-glass-backdrop-filter', `blur(${settings.blur}px) saturate(${settings.saturation / 100}) brightness(${settings.brightness / 100})`)
  root.style.setProperty('--newtab-glass-saturation', String(settings.saturation / 100))
  root.style.setProperty('--newtab-glass-brightness', String(settings.brightness / 100))
  root.style.setProperty('--newtab-glass-highlight', String(settings.highlight / 100))
}
