import { getInboxWorkflowSettings, type InboxWorkflowMode } from '../../shared/inbox-workflow.js'
import { saveInboxSettings } from '../../shared/inbox.js'
import { managerState } from '../shared-options/state.js'

export async function saveInboxWorkflowMode(
  mode: InboxWorkflowMode,
  render: () => void
) {
  // Provider settings use a different storage record; only Inbox saves conflict.
  if (managerState.inboxSettingsSaving) {
    render()
    return
  }

  try {
    managerState.inboxSettingsSaving = true
    managerState.inboxSettingsStatus = '正在保存 Inbox 设置…'
    render()
    managerState.inboxSettings = await saveInboxSettings(getInboxWorkflowSettings(mode))
    managerState.inboxSettingsStatus = 'Inbox 设置已保存。'
  } catch (error) {
    managerState.inboxSettingsStatus = error instanceof Error
      ? error.message
      : 'Inbox 设置保存失败，请稍后重试。'
  } finally {
    managerState.inboxSettingsSaving = false
    render()
  }
}
