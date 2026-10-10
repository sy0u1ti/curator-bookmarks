import { STORAGE_KEYS } from './constants.js'

// Additive to schema v1: old backups preserve preferences they never captured.
export const BACKUP_PREFERENCE_FIELDS = {
  inboxSettings: STORAGE_KEYS.inboxSettings,
  contentSnapshotSettings: STORAGE_KEYS.contentSnapshotSettings,
  availabilitySettings: STORAGE_KEYS.availabilitySettings
} as const

export function normalizeBackupPreferences(value: unknown): Record<string, unknown> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return Object.fromEntries(Object.keys(BACKUP_PREFERENCE_FIELDS).flatMap(field => {
    const settings = source[field]
    return settings && typeof settings === 'object' && !Array.isArray(settings) ? [[field, settings]] : []
  }))
}

export function buildBackupPreferencesPayload(value: unknown): Record<string, unknown> {
  const preferences = normalizeBackupPreferences(value)
  return Object.fromEntries(Object.entries(BACKUP_PREFERENCE_FIELDS)
    .filter(([field]) => field in preferences)
    .map(([field, key]) => [key, preferences[field]]))
}
