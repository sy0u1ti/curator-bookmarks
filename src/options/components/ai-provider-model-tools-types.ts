import type { AiModelSelectorState } from './ai-model-selector-types.js'

export interface AiProviderModelToolsState {
  fetchDisabled: boolean
  fetchLabel: string
  fetchModelsStatus: string
  fetchModelsStatusBusy: boolean
  fetchModelsStatusTone: string
  fetchingModels: boolean
  manageDisabled: boolean
  selector: AiModelSelectorState
}
