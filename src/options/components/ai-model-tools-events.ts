export const AI_MODEL_TOOLS_EVENT = 'options:ai-model-tools-action'

export type AiModelToolsAction =
  | 'fetch-models'
  | 'manage-models'

export interface AiModelToolsActionDetail {
  action: AiModelToolsAction
}

export function dispatchAiModelToolsAction(action: AiModelToolsAction): void {
  window.dispatchEvent(new CustomEvent<AiModelToolsActionDetail>(AI_MODEL_TOOLS_EVENT, {
    detail: { action }
  }))
}
