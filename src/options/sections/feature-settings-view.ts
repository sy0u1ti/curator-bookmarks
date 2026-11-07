import { getInboxWorkflowMode, type InboxWorkflowSettings } from '../../shared/inbox-workflow.js'
import { FEATURE_SWITCH_CONTENT, INBOX_WORKFLOW_STATUS_COPY, type FeatureSettingsControlsState } from '../components/feature-settings-types.js'

interface FeatureSettingsViewInput {
  settings: { autoAnalyzeBookmarks?: boolean; allowRemoteParsing?: boolean }
  inboxSettings: InboxWorkflowSettings
  inboxStatus: string
  inboxSaving: boolean
  loading: boolean
  permissionsLoading: boolean
  remoteParserGranted: boolean
  locked: boolean
  pending: string
  errors?: Partial<Record<'autoAnalyzeBookmarks' | 'allowRemoteParsing', string>>
  testingConnection: boolean
}

export function buildFeatureSettingsView(input: FeatureSettingsViewInput): FeatureSettingsControlsState {
  const { settings, pending } = input
  const locked = input.locked || input.permissionsLoading
  const remoteEnabled = Boolean(settings.allowRemoteParsing)
  const needsRemotePermission = remoteEnabled && !input.permissionsLoading && !input.remoteParserGranted
  return {
    loading: input.loading,
    switches: [{
      ...FEATURE_SWITCH_CONTENT[0],
      checked: Boolean(settings.autoAnalyzeBookmarks),
      disabled: locked || input.testingConnection || pending === 'autoAnalyzeBookmarks',
      error: input.errors?.autoAnalyzeBookmarks,
      status: undefined,
      statusTone: 'muted'
    }, {
      ...FEATURE_SWITCH_CONTENT[1],
      checked: remoteEnabled,
      disabled: locked || pending === 'allowRemoteParsing',
      error: input.errors?.allowRemoteParsing,
      status: needsRemotePermission ? '待授权' : undefined,
      statusTone: needsRemotePermission ? 'warning' : 'muted'
    }],
    inboxWorkflow: {
      value: getInboxWorkflowMode(input.inboxSettings),
      disabled: input.loading || input.inboxSaving,
      status: input.inboxStatus || (getInboxWorkflowMode(input.inboxSettings) === 'capture'
        ? INBOX_WORKFLOW_STATUS_COPY.capture
        : INBOX_WORKFLOW_STATUS_COPY.analyze)
    }
  }
}
