import type { AiModelSelectorState } from './ai-model-selector-types.js'
import type { ActionFeedback } from '../../shared/action-feedback.js'

export interface AiProviderModelToolsState {
  fetchDisabled: boolean
  fetchLabel: string
  fetchModelsStatus: string
  fetchingModels: boolean
  fetchFeedback: ActionFeedback
  manageDisabled: boolean
  selector: AiModelSelectorState
}
