import { navigateToOptionsSectionHash } from '../options-section-store.js'
import { Button } from '../../ui/base/Button'
import { Icon } from '../../ui/icons/Icon'
import { useAiConfigLinkState } from './ai-config-link-store.js'

export function AiConfigLink() {
  const { configured } = useAiConfigLinkState()
  const label = configured ? 'AI 服务设置' : '配置 AI 服务'

  return (
    <Button
      className="w-full border-ds-border bg-ds-surface-2 hover:border-ds-border-hover hover:bg-ds-surface-3"
      size="sm"
      type="button"
      variant="secondary"
      aria-label={label}
      onClick={() => {
        navigateToOptionsSectionHash('#ai-settings')
      }}
    >
      <Icon name="Settings" size={14} aria-hidden="true" />
      {label}
    </Button>
  )
}
