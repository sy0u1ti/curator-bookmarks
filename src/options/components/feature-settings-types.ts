import type { InboxWorkflowMode } from '../../shared/inbox-workflow.js'

export type FeatureSwitchStatusTone = 'muted' | 'success' | 'warning'

export type FeatureSettingKey =
  | 'allowRemoteParsing'
  | 'autoAnalyzeBookmarks'

export type FeatureSettingsChangeDetail = {
  checked: boolean
  key: FeatureSettingKey
} | { key: 'inboxWorkflow'; value: InboxWorkflowMode }

export interface FeatureSwitchItemState {
  checked: boolean
  disabled: boolean
  help: string
  description?: string
  key: FeatureSettingKey
  label: string
  status?: string
  statusTone?: FeatureSwitchStatusTone
}

export interface FeatureSettingsControlsState {
  loading: boolean
  switches: FeatureSwitchItemState[]
  inboxWorkflow?: {
    value: InboxWorkflowMode
    disabled: boolean
    status: string
  }
}
