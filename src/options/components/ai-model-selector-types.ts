export interface AiModelSelectorState {
  currentModel: string
  customModels: string[]
  disabled: boolean
  fetchedModels: string[]
  models: string[]
  presetModels: string[]
}
