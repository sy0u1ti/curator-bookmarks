export interface NewtabGlassSettings {
  tint: number
  bevel: number
  thickness: number
  blur: number
  dispersion: number
  rim: number
  light: number
  smooth: number
}
export type NewtabGlassSettingKey = keyof NewtabGlassSettings
export const GLASS_SETTINGS_CACHE_KEY = 'curator-newtab-glass-v1'

// Keep the playground's seven controls. Geometry controls are normalized per
// surface, with defaults matching its ~28px bevel / 19px slab on a 30px corner.
// Blur deliberately starts at the requested maximum.
export const DEFAULT_GLASS_SETTINGS: Readonly<NewtabGlassSettings> = {
  tint: 13, bevel: 44, thickness: 28, blur: 12, dispersion: 0.11, rim: 0.3, light: -25, smooth: 0.75
}
export const GLASS_SETTING_LIMITS: Record<NewtabGlassSettingKey, readonly [number, number, number]> = {
  tint: [0, 60, 1],
  bevel: [4, 48, 1], thickness: [2, 40, 1], blur: [0, 12, 0.5],
  dispersion: [0, 0.16, 0.01], rim: [0, 1.6, 0.05], light: [-180, 180, 5], smooth: [0, 3, 0.25]
}

export function normalizeGlassSettings(raw: unknown): NewtabGlassSettings {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
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

export function getGlassRefractionOptions(
  settings: NewtabGlassSettings,
  width: number,
  height: number,
  radii: readonly number[]
): Omit<NewtabGlassSettings, 'tint'> {
  const maxBevel = Math.max(1, Math.min(Math.max(1, ...radii), Math.floor(Math.min(width, height) / 2) - 1))
  const bevel = 1 + (maxBevel - 1) * (settings.bevel - 4) / 44
  // The unmodified Hyalite no-fold constraint saturates when a slab is much
  // thicker than its bevel. Map the control to the useful interval instead of
  // feeding a 40px slab to a 6px corner and making half the slider a no-op.
  const thickness = bevel * (0.05 + 0.95 * (settings.thickness - 2) / 38)
  return {
    bevel, thickness, blur: settings.blur, dispersion: settings.dispersion,
    rim: settings.rim, light: settings.light, smooth: settings.smooth
  }
}

export function applyGlassSettingsCss(settings: NewtabGlassSettings, root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--newtab-glass-bg-fill', `rgba(0, 0, 0, ${settings.tint / 100})`)
  root.style.setProperty('--newtab-glass-background-blur', settings.blur + 'px')
  root.style.setProperty('--newtab-glass-backdrop-filter', 'blur(' + settings.blur + 'px)')
  root.style.setProperty('--newtab-glass-rim-opacity', String(Math.min(0.5, settings.rim * 0.25)))
  const light = settings.light * Math.PI / 180
  root.style.setProperty('--newtab-glass-light-x', (Math.sin(light) * 1.5).toFixed(2) + 'px')
  root.style.setProperty('--newtab-glass-light-y', (-Math.cos(light) * 1.5).toFixed(2) + 'px')
}
