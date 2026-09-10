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

export function getSettingsGroupControlSyncActions(
  group: unknown
): SettingsGroupControlSyncAction[] {
  switch (normalizeSettingsDrawerSection(group)) {
    case 'glass':
      return [] // Glass owns its immediate preview and persistence store.
    case 'appearance':
      return ['background', 'featuredBackgroundDisplay', 'icon', 'time']
    case 'search':
      return ['search']
    case 'advanced':
      return ['general', 'modules']
    case 'source':
    default:
      return ['folder']
  }
}
