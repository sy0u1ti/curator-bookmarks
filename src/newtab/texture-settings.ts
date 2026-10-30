export const TEXTURE_PRESETS = [
  { id: 'current', label: '线流', opacity: 0.18 },
  { id: 'settle', label: '错落', opacity: 0.18 },
  { id: 'curtain', label: '帷幕', opacity: 0.065 },
  { id: 'sphere', label: '浮点', opacity: 0.11 },
  { id: 'watch', label: '涟漪', opacity: 0.14 },
  { id: 'twist', label: '经纬', opacity: 0.14 }
] as const

export type TexturePreset = (typeof TEXTURE_PRESETS)[number]['id']
export interface TextureSettings {
  texturePreset: TexturePreset
  textureIntensity: number
  textureMotion: boolean
}

export const DEFAULT_TEXTURE_SETTINGS: TextureSettings = {
  texturePreset: 'current',
  textureIntensity: 50,
  textureMotion: true
}
export const TEXTURE_BACKGROUND_COLOR = '#101013'

export function normalizeTextureSettings(value: unknown): TextureSettings {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
  const preset = TEXTURE_PRESETS.find(item => item.id === source.texturePreset)
  const intensity = typeof source.textureIntensity === 'number' || typeof source.textureIntensity === 'string' &&
    source.textureIntensity.trim() ? Number(source.textureIntensity) : NaN
  return {
    texturePreset: preset?.id ?? DEFAULT_TEXTURE_SETTINGS.texturePreset,
    textureIntensity: Number.isFinite(intensity)
      ? Math.round(Math.max(0, Math.min(100, intensity))) : DEFAULT_TEXTURE_SETTINGS.textureIntensity,
    textureMotion: typeof source.textureMotion === 'boolean'
      ? source.textureMotion : DEFAULT_TEXTURE_SETTINGS.textureMotion
  }
}

export function getTextureImageUrl(preset: TexturePreset): string {
  return `/textures/${normalizeTextureSettings({ texturePreset: preset }).texturePreset}.svg`
}

export function getTextureOpacity(settings: TextureSettings): number {
  const normalized = normalizeTextureSettings(settings)
  const preset = TEXTURE_PRESETS.find(item => item.id === normalized.texturePreset)!
  return Number((preset.opacity * normalized.textureIntensity / 50).toFixed(4))
}

export function isProceduralBackgroundType(type: unknown): boolean {
  return type === 'color' || type === 'texture'
}
