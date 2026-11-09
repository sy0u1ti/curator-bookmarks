import type { ModelsDevLab } from '../../shared/models-dev.js'

export interface AiModelSelectorState {
  currentModel: string
  customModels: string[]
  disabled: boolean
  fetchedModels: string[]
  labs: Record<string, ModelsDevLab>
  models: string[]
  presetModels: string[]
}
