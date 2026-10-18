export type NewTabModuleSettingKey =
  | 'speedDial'

export interface NewTabModuleSettings {
  version: 1
  speedDial: boolean
  order: NewTabModuleSettingKey[]
}

export interface NewTabModuleSettingRow {
  key: NewTabModuleSettingKey
  label: string
  description: string
  enabled: boolean
}

export const DEFAULT_NEW_TAB_MODULE_SETTINGS: NewTabModuleSettings = {
  version: 1,
  speedDial: false,
  order: ['speedDial']
}

const NEW_TAB_MODULE_SETTING_META: Record<
  NewTabModuleSettingKey,
  Omit<NewTabModuleSettingRow, 'key' | 'enabled'>
> = {
  speedDial: {
    label: '固定入口',
    description: '显示固定的高频书签入口。'
  }
}

const MODULE_SETTING_KEYS: NewTabModuleSettingKey[] = [
  'speedDial'
]

export function normalizeNewTabModuleSettings(rawSettings: unknown): NewTabModuleSettings {
  const hasStoredSettings = Boolean(
    rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
  )
  const source = hasStoredSettings
    ? rawSettings as Record<string, unknown>
    : {}

  return {
    version: 1,
    speedDial: readCombinedSpeedDialSetting(source, hasStoredSettings),
    order: normalizeModuleOrder(source.order)
  }
}

export function getVisibleNewTabModules(rawSettings: unknown): NewTabModuleSettingKey[] {
  const settings = normalizeNewTabModuleSettings(rawSettings)
  return settings.order.filter((key) => settings[key])
}

export function buildNewTabModuleSettingRows(rawSettings: unknown): NewTabModuleSettingRow[] {
  const settings = normalizeNewTabModuleSettings(rawSettings)
  return settings.order.map((key) => ({
    key,
    ...NEW_TAB_MODULE_SETTING_META[key],
    enabled: settings[key]
  }))
}

function readBooleanSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readCombinedSpeedDialSetting(
  source: Record<string, unknown>,
  hasStoredSettings: boolean
): boolean {
  // Existing records predate the new-user default. Keep their previous on
  // state when the legacy fields are absent, while explicit off values win.
  const legacyDefault = hasStoredSettings
  const speedDial = readBooleanSetting(source.speedDial, legacyDefault)
  const workspaces = readBooleanSetting(source.workspaces, legacyDefault)
  return speedDial && workspaces
}

function normalizeModuleOrder(value: unknown): NewTabModuleSettingKey[] {
  const order: NewTabModuleSettingKey[] = []
  const orderSet = new Set<NewTabModuleSettingKey>()
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isNewTabModuleSettingKey(item) && !orderSet.has(item)) {
        order.push(item)
        orderSet.add(item)
      }
    }
  }

  for (const key of MODULE_SETTING_KEYS) {
    if (!orderSet.has(key)) {
      order.push(key)
      orderSet.add(key)
    }
  }
  return order
}

function isNewTabModuleSettingKey(value: unknown): value is NewTabModuleSettingKey {
  return typeof value === 'string' && (MODULE_SETTING_KEYS as string[]).includes(value)
}
