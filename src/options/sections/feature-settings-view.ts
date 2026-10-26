import { getInboxWorkflowMode, type InboxWorkflowSettings } from '../../shared/inbox-workflow.js'
import type { FeatureSettingsControlsState } from '../components/feature-settings-types.js'

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
      key: 'autoAnalyzeBookmarks', label: '自动分析',
      description: '新增书签后自动生成标签与建议，高置信度时建议调整名称或移动；待整理箱采用独立策略。',
      help: '新增网页书签后自动生成分析与标签，高置信时会调整名称和文件夹。快捷键收藏到待整理箱后的处理方式可在下方单独选择。',
      checked: Boolean(settings.autoAnalyzeBookmarks),
      disabled: locked || input.testingConnection || pending === 'autoAnalyzeBookmarks',
      status: pending === 'autoAnalyzeBookmarks' ? '保存中…' : undefined,
      statusTone: 'muted'
    }, {
      key: 'allowRemoteParsing', label: '网页内容辅助解析',
      description: 'AI 分析时通过 Jina Reader 获取网页内容，第三方服务会收到目标网址。',
      help: '结合 Jina Reader 内容；第三方服务会收到目标 URL。',
      checked: remoteEnabled,
      disabled: locked || pending === 'allowRemoteParsing',
      status: pending === 'allowRemoteParsing' ? '保存中…' : remoteEnabled && !input.remoteParserGranted ? '待授权' : undefined,
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
