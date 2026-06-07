import { Button } from '../../ui/primitives/Button'
import {
  dispatchPopupAutoAnalyzeStatusAction,
  usePopupAutoAnalyzeStatusView
} from '../popup-controller-store'

export function PopupAutoAnalyzeStatus() {
  const state = usePopupAutoAnalyzeStatusView()

  const hidden = !state.status
  const className = [
    'auto-analyze-status',
    hidden ? 'hidden' : state.status,
    state.collapsed ? 'collapsed' : ''
  ].filter(Boolean).join(' ')
  const ariaLabel = hidden
    ? undefined
    : state.collapsed
      ? `${state.title}，已折叠`
      : `${state.title}，${state.detail}`

  return (
    <section
      id="auto-analyze-status"
      className={className}
      aria-live="polite"
      aria-atomic="true"
      aria-label={ariaLabel}
    >
      {hidden ? null : (
        <>
          <div className="auto-analyze-indicator" aria-hidden="true"></div>
          <output className="auto-analyze-copy">
            <p className="auto-analyze-title">{state.title}</p>
            <p className="auto-analyze-detail">{state.detail}</p>
          </output>
          <div className="auto-analyze-actions">
            {state.showHistory ? (
              <Button
                className="auto-analyze-action"
                type="button"
                onClick={() => dispatchPopupAutoAnalyzeStatusAction('history')}
                unstyled
              >
                查看
              </Button>
            ) : null}
            <Button
              className="auto-analyze-action ghost"
              type="button"
              onClick={() => dispatchPopupAutoAnalyzeStatusAction('toggle')}
              aria-expanded={state.collapsed ? 'false' : 'true'}
              unstyled
            >
              {state.collapsed ? '展开' : '折叠'}
            </Button>
            <Button
              className="auto-analyze-action ghost"
              type="button"
              onClick={() => dispatchPopupAutoAnalyzeStatusAction('dismiss')}
              aria-label="关闭自动分析状态"
              unstyled
            >
              关闭
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
