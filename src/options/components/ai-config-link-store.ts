import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'

export interface AiConfigLinkState {
  configured: boolean
}

const defaultAiConfigLinkState: AiConfigLinkState = {
  configured: false
}

const aiConfigLinkStore = createUiViewStoreSlice(
  'options',
  'ai-config-link',
  defaultAiConfigLinkState
)

export function publishAiConfigLinkState(state: AiConfigLinkState): void {
  aiConfigLinkStore.setState({
    configured: Boolean(state.configured)
  })
}

export function useAiConfigLinkState(): AiConfigLinkState {
  return useUiViewStoreSlice(aiConfigLinkStore)
}
