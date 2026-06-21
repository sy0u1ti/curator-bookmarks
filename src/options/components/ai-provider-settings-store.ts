import { useSyncExternalStore } from 'react'
import type { AiProviderSettingsState } from './ai-provider-settings-types.js'

const defaultAiProviderSettingsState: AiProviderSettingsState = {
  apiKey: '',
  apiKeyPlaceholder: '未保存 API Key',
  apiStyle: 'chat',
  apiStyleOptions: [],
  baseUrl: '',
  batchSize: '6',
  configStatusText: '待配置',
  configTone: 'muted',
  connectivityBusy: false,
  connectivityCopy: '',
  connectivityTone: 'muted',
  connectivityVisible: false,
  customModels: [],
  hasRequiredConfig: false,
  modelTools: {
    fetchDisabled: true,
    fetchLabel: '获取模型',
    fetchModelsStatus: '',
    fetchModelsStatusBusy: false,
    fetchModelsStatusTone: 'muted',
    fetchingModels: false,
    manageDisabled: true,
    selector: {
      currentModel: '',
      customModels: [],
      disabled: true,
      fetchedModels: [],
      models: [],
      presetModels: []
    }
  },
  modelToolsDisabled: true,
  noticeText: '填写 API Key 后即可获取模型并测试连接。',
  revealApiKey: false,
  saveDisabled: true,
  saveStatusText: '待配置',
  showSaveSettingsButton: true,
  testButtonSecondary: true,
  testDisabled: true,
  testLabel: '测试连接',
  testingConnection: false,
  timeoutMs: '30000'
}

let currentAiProviderSettingsState = defaultAiProviderSettingsState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): AiProviderSettingsState {
  return currentAiProviderSettingsState
}

export function publishAiProviderSettings(state: AiProviderSettingsState): void {
  currentAiProviderSettingsState = state
  listeners.forEach((listener) => listener())
}

export function useAiProviderSettingsState(): AiProviderSettingsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
