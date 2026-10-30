export const NEWTAB_BACKGROUND_TYPE_OPTIONS = [
  ['image', '图片'],
  ['video', '视频'],
  ['urls', '图片链接'],
  ['color', '纯色']
] as const

export type NewtabBackgroundType = (typeof NEWTAB_BACKGROUND_TYPE_OPTIONS)[number][0]

const SELECTABLE_BACKGROUND_TYPES = new Set<string>(
  NEWTAB_BACKGROUND_TYPE_OPTIONS.map(([value]) => value)
)

export function normalizeNewtabBackgroundType(value: unknown): NewtabBackgroundType {
  return SELECTABLE_BACKGROUND_TYPES.has(String(value))
    ? String(value) as NewtabBackgroundType
    : 'color'
}
