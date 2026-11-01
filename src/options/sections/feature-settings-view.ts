import { getInboxWorkflowMode, type InboxWorkflowSettings } from '../../shared/inbox-workflow.js'
import { FEATURE_SWITCH_CONTENT, type FeatureSettingsControlsState } from '../components/feature-settings-types.js'

interface FeatureSettingsViewInput {
  settings: { autoAnalyzeBookmarks?: boolean; allowRemoteParsing?: boolean }
  inboxSettings: InboxWorkflowSettings
  inboxStatus: string
  loading: boolean
  remoteParserGranted: boolean
  locked: boolean
  pending: string
  testingConnection: boolean
}

export function buildFeatureSettingsView(input: FeatureSettingsViewInput): FeatureSettingsControlsState {
  const { settings, locked, pending } = input
  const remoteEnabled = Boolean(settings.allowRemoteParsing)
  return {
    loading: input.loading,
    switches: [{
      ...FEATURE_SWITCH_CONTENT[0],
      checked: Boolean(settings.autoAnalyzeBookmarks),
      disabled: locked || input.testingConnection || pending === 'autoAnalyzeBookmarks',
     status: undefined,
      statusTone: 'muted'
    }, {
      ...FEATURE_SWITCH_CONTENT[1],
      checked: remoteEnabled,
      disabled: locked || pending === 'allowRemoteParsing',
     status: remoteEnabled && !input.remoteParserGranted ? '待授权' : undefined,
      statusTone: remoteEnabled && !input.remoteParserGranted ? 'warning' : 'muted'
    }],
    inboxWorkflow: {
      value: getInboxWorkflowMode(input.inboxSettings),
      disabled: locked || Boolean(pending),
      status: input.inboxStatus || (getInboxWorkflowMode(input.inboxSettings) === 'capture'
        ? '仅保存至待整理箱，不调用 AI，不自动重命名或移动。'
        : '此设置独立于上方自动分析开关；AI 服务可用时执行，未能成功分析时保留在待整理箱。')
    }
  }
}
