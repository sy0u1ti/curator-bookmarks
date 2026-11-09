import type { InboxWorkflowMode } from '../../shared/inbox-workflow.js'

export const FEATURE_SWITCH_CONTENT = [
  { key: 'autoAnalyzeBookmarks', label: '自动分析', description: '新增书签后自动生成标签，高置信时改名并移动。' },
  { key: 'allowRemoteParsing', label: '网页内容辅助解析', description: 'AI 分析时通过 Jina Reader 读取网页内容，第三方服务会收到目标网址。' }
] as const

export const INBOX_WORKFLOW_STATUS_COPY = {
  capture: '只保存到待整理，不调用 AI，也不改名或移动。',
  analyze: '不受“自动分析”开关影响；分析失败时保留在待整理。'
} as const

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
