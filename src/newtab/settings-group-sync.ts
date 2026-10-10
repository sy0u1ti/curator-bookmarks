export type SettingsDrawerSection = 'source' | 'appearance' | 'glass' | 'search' | 'advanced'

export type SettingsGroupControlSyncAction =
  | 'folder'
  | 'background'
  | 'featuredBackgroundDisplay'
  | 'search'
  | 'modules'
  | 'general'
  | 'icon'
  | 'time'

export function normalizeSettingsDrawerSection(value: unknown): SettingsDrawerSection {
  const section = String(value || '')
  if (section === 'modules') {
    return 'advanced'
  }

  return section === 'appearance' ||
    section === 'glass' ||
    section === 'search' ||
    section === 'advanced'
    ? section
    : 'source'
}

