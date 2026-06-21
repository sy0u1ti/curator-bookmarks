import { navigateToOptionsSectionHash } from '../options-section-store.js'
import {
  AI_CONFIG_LINK_CLASS,
  AI_CONFIG_LINK_CONFIGURED_CLASS,
  AI_CONFIG_LINK_DEFAULT_CLASS
} from './ai-provider-settings-classes.js'
import { useAiConfigLinkState } from './ai-config-link-store.js'

export function AiConfigLink() {
  const { configured } = useAiConfigLinkState()
  const label = configured ? '已配置 API KEY' : '配置 API Key'

  return (
    <a
      className={[
        AI_CONFIG_LINK_CLASS,
        configured ? AI_CONFIG_LINK_CONFIGURED_CLASS : AI_CONFIG_LINK_DEFAULT_CLASS
      ].filter(Boolean).join(' ')}
      href="#general:ai-provider"
      aria-label={configured ? '已配置 API KEY，前往通用设置查看或修改' : '配置 API Key'}
      onClick={(event) => {
        event.preventDefault()
        navigateToOptionsSectionHash('#general:ai-provider')
      }}
    >
      {label}
    </a>
  )
}
