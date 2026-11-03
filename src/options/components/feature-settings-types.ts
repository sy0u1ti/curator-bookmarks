import type { InboxWorkflowMode } from '../../shared/inbox-workflow.js'

export const FEATURE_SWITCH_CONTENT = [
  { key: 'autoAnalyzeBookmarks', label: '自动分析', description: '新增书签后自动生成标签；高置信时会改名、移动。待整理箱使用下方独立策略。' },
  { key: 'allowRemoteParsing', label: '网页内容辅助解析', description: 'AI 分析时通过 Jina Reader 获取网页内容，第三方服务会收到目标网址。' }
] as const

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
  error?: string
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
