import { getInboxWorkflowSettings, type InboxWorkflowMode } from '../../shared/inbox-workflow.js'
import { saveInboxSettings } from '../../shared/inbox.js'
import { aiNamingState, managerState } from '../shared-options/state.js'

export async function saveInboxWorkflowMode(
  mode: InboxWorkflowMode,
  render: () => void
) {
  if (aiNamingState.pendingFeatureSwitch) {
    render()
    return
  }

  try {
    aiNamingState.pendingFeatureSwitch = 'inboxWorkflow'
    managerState.inboxSettingsStatus = '正在保存 Inbox 设置…'
    render()
    managerState.inboxSettings = await saveInboxSettings(getInboxWorkflowSettings(mode))
    managerState.inboxSettingsStatus = 'Inbox 设置已保存。'
  } catch (error) {
    managerState.inboxSettingsStatus = error instanceof Error
      ? error.message
      : 'Inbox 设置保存失败，请稍后重试。'
  } finally {
    if (aiNamingState.pendingFeatureSwitch === 'inboxWorkflow') {
      aiNamingState.pendingFeatureSwitch = ''
    }
    render()
  }
}
