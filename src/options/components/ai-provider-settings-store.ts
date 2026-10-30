import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { AiProviderSettingsState } from './ai-provider-settings-types.js'
import { IDLE_ACTION_FEEDBACK } from '../../shared/action-feedback.js'

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
  fieldsDisabled: true,
  hasRequiredConfig: false,
  modelTools: {
    fetchDisabled: true,
    fetchLabel: '获取模型',
    fetchModelsStatus: '',
    fetchingModels: false,
    fetchFeedback: IDLE_ACTION_FEEDBACK,
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
  modelCatalog: { loaded: false, autoUpdate: false, checkedAt: 0, lastError: '', match: null },
  reasoningEffort: 'default',
  reasoningEffortNote: '',
  reasoningEffortOptions: [],
  reasoningEffortSupported: false,
  revealApiKey: false,
  saveDisabled: true,
  saveStatusText: '',
  showSaveSettingsButton: true,
  testButtonSecondary: true,
  testDisabled: true,
  testLabel: '测试连接',
  testingConnection: false,
  testFeedback: IDLE_ACTION_FEEDBACK,
  timeoutMs: '30000'
}

const aiProviderSettingsStore = createUiViewStoreSlice(
  'options',
  'ai-provider-settings',
  defaultAiProviderSettingsState
)

export function publishAiProviderSettings(state: AiProviderSettingsState): void {
  aiProviderSettingsStore.setState(state)
}

export function useAiProviderSettingsState(): AiProviderSettingsState {
  return useUiViewStoreSlice(aiProviderSettingsStore)
}
