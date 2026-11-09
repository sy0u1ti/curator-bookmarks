import { navigateToOptionsSectionHash } from '../options-section-store.js'
import { Button } from '../../ui/base/Button'
import {
  AI_CONFIG_LINK_CLASS,
  AI_CONFIG_LINK_DEFAULT_CLASS
} from './ai-provider-settings-classes.js'
import { useAiConfigLinkState } from './ai-config-link-store.js'

export function AiConfigLink() {
  const { configured } = useAiConfigLinkState()
  const label = configured ? 'AI 服务设置' : '配置 AI 服务'

  return (
    <Button
      unstyled
      type="button"
      className={[
        AI_CONFIG_LINK_CLASS,
        AI_CONFIG_LINK_DEFAULT_CLASS
      ].filter(Boolean).join(' ')}
      aria-label={label}
      onClick={() => {
        navigateToOptionsSectionHash('#ai-settings')
      }}
    >
      {label}
    </Button>
  )
}
