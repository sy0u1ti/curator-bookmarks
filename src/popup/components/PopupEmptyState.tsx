import { AiSetupPrompt } from '../../ui/ai/AiSetupPrompt'
import { Button } from '../../ui/primitives/Button'
import type { PopupEmptyStateViewModel } from './PopupViewModels'

export function PopupEmptyState({
  onAction,
  state
}: {
  onAction?: (action: string) => void
  state: PopupEmptyStateViewModel
}) {
  if (state.kind === 'none') {
    return null
  }

  if (state.kind === 'message') {
    return <>{state.message}</>
  }

  if (state.kind === 'natural-setup') {
    return (
      <AiSetupPrompt
        className="empty-search-state natural-search-setup-state"
        title={<p className="empty-title">请配置 AI 渠道</p>}
        description={<p className="empty-hint">普通搜索已包含本地规则。语义搜索需要配置 AI 渠道后使用。</p>}
        actions={
          <>
            <Button
              className="empty-action primary"
              type="button"
              data-empty-action="open-ai-settings"
              onClick={() => onAction?.('open-ai-settings')}
              unstyled
            >
              配置 AI 渠道
            </Button>
            <Button
              className="empty-action"
              type="button"
              data-empty-action="dismiss-natural-setup"
              onClick={() => onAction?.('dismiss-natural-setup')}
              unstyled
            >
              继续普通搜索
            </Button>
          </>
        }
      />
    )
  }

  return (
    <div className="empty-search-state">
      <p className="empty-title">{state.title}</p>
      <p className="empty-hint">{state.hint}</p>
      <div className="empty-actions">
        {state.actions.map((action) => (
          <Button
            className={['empty-action', action.primary ? 'primary' : ''].filter(Boolean).join(' ')}
            type="button"
            data-empty-action={action.action}
            onClick={() => onAction?.(action.action)}
            key={action.action}
            unstyled
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
