import { navigateToOptionsSectionHash } from '../options-section-store.js'
import {
  AI_CONFIG_LINK_CLASS,
  AI_CONFIG_LINK_CONFIGURED_CLASS,
  AI_CONFIG_LINK_DEFAULT_CLASS
} from './ai-provider-settings-classes.js'
import { useAiConfigLinkState } from './ai-config-link-store.js'

export function AiConfigLink() {
  const { configured } = useAiConfigLinkState()
  const label = configured ? 'AI 渠道设置' : '配置 AI 渠道'

  return (
    <button
      type="button"
      className={[
        AI_CONFIG_LINK_CLASS,
        configured ? AI_CONFIG_LINK_CONFIGURED_CLASS : AI_CONFIG_LINK_DEFAULT_CLASS
      ].filter(Boolean).join(' ')}
      aria-label={configured ? 'AI 渠道已配置，前往通用设置查看或修改' : '配置 AI 渠道'}
      onClick={() => {
        navigateToOptionsSectionHash('#general:ai-provider')
      }}
    >
      {label}
    </button>
  )
}
