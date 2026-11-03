import { STORAGE_KEYS } from '../../shared/constants.js'
import { normalizeContentSnapshotSettings, type ContentSnapshotSettings } from '../../shared/content-snapshot-search.js'
import { getLocalStorage, setLocalStorage, withLocalStorageTransaction } from '../../shared/storage.js'
import type { ContentSnapshotSettingsChangeDetail } from '../components/content-snapshot-types.js'

type SettingsField = 'enabled' | 'saveFullText' | 'fullTextSearchEnabled'
type SettingsPatch = Partial<Pick<ContentSnapshotSettings, SettingsField>>

export function createContentSnapshotSettingsController(
  state: { settings: ContentSnapshotSettings; statusMessage: string },
  render: () => void
) {
  let confirmed = state.settings
  let revision = 0
  const pending = new Map<number, SettingsPatch>()
  const errors = new Map<SettingsField, string>()

  function applyDraft() {
    let settings = confirmed
    for (const patch of pending.values()) settings = { ...settings, ...patch }
    state.settings = normalizeContentSnapshotSettings(settings)
  }

  return {
    accept(value: unknown) {
      confirmed = normalizeContentSnapshotSettings(value)
      // Storage echoes confirm old writes; newer local edits still own their fields.
      applyDraft()
    },
    async save(detail: ContentSnapshotSettingsChangeDetail) {
      const patch: SettingsPatch = {}
      if (detail.enabled !== undefined) patch.enabled = detail.enabled
      if (detail.saveFullText !== undefined) patch.saveFullText = detail.saveFullText
      if (detail.syncFullTextSearch) patch.fullTextSearchEnabled = detail.saveFullText ?? state.settings.saveFullText
      const fields = Object.keys(patch) as SettingsField[]
      if (!fields.length) return

      const request = ++revision
      pending.set(request, patch)
      for (const field of fields) errors.delete(field)
      applyDraft()
      state.statusMessage = [...new Set(errors.values())].join('；')
      render()
      try {
        await withLocalStorageTransaction(async transaction => {
          const stored = await getLocalStorage([STORAGE_KEYS.contentSnapshotSettings])
          const next = normalizeContentSnapshotSettings({
            ...normalizeContentSnapshotSettings(stored[STORAGE_KEYS.contentSnapshotSettings]), ...patch
          })
          await setLocalStorage({ [STORAGE_KEYS.contentSnapshotSettings]: next }, { transaction })
          confirmed = next
        })
      } catch (error) {
        const message = error instanceof Error ? `网页内容索引设置保存失败：${error.message}` : '网页内容索引设置保存失败。'
        for (const field of fields) {
          if (![...pending].some(([id, newer]) => id > request && field in newer)) errors.set(field, message)
        }
      } finally {
        pending.delete(request)
        applyDraft()
        state.statusMessage = errors.size
          ? [...new Set(errors.values())].join('；')
          : pending.size ? '' : '网页内容索引设置已保存。'
        render()
      }
    }
  }
}
