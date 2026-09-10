import { Button } from '../../ui/base/Button'
import { AiThinkingOrb } from '../../ui/ai/AiThinkingOrb'
import { Icon } from '../../ui/icons/Icon'
import { cx } from '../../ui/base/utils'
import {
  dispatchPopupAutoAnalyzeStatusAction,
  usePopupAutoAnalyzeStatusView
} from '../popup-controller-store'

const STATUS_BASE_CLASS =
  'relative z-[1] grid min-h-[38px] flex-none grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2.5 overflow-hidden rounded-[7px] border border-ds-border bg-ds-surface-1 px-2 py-[7px] pl-2.5 shadow-none'

const STATUS_STATE_CLASS: Record<string, string> = {
  queued: '',
  processing: '',
  completed: '',
  failed: 'border-ds-danger/60'
}

const STATUS_INDICATOR_CLASS: Record<string, string> = {
  queued: 'text-ds-text-secondary',
  processing: 'text-ds-text-primary',
  completed: 'text-ds-success-text',
  failed: 'text-ds-danger-text'
}

const actionClass =
  'inline-flex min-h-[26px] min-w-[34px] items-center justify-center rounded-md border border-ds-border bg-ds-surface-1 px-2 text-xs font-semibold leading-none text-ds-text-primary outline-none transition-[border-color,background-color,color,transform,scale] duration-ds-fast ease-ds-standard hover:border-ds-border-hover hover:bg-ds-hover focus-visible:border-ds-border-hover focus-visible:bg-ds-hover active:scale-[var(--ds-press-scale)]'

const ghostActionClass =
  'border-transparent bg-transparent text-ds-text-secondary hover:text-ds-text-primary focus-visible:text-ds-text-primary'

function AutoAnalyzeIndicator({ status, collapsed }: { status: string | null; collapsed: boolean }) {
  return status === 'processing'
    ? <AiThinkingOrb state="working" paused={collapsed} />
    : <Icon name={status === 'queued' ? 'Clock' : status === 'completed' ? 'Check' : 'AlertTriangle'} size={16} />
}

export function PopupAutoAnalyzeStatus({ smartActive = false }: { smartActive?: boolean }) {
  const state = usePopupAutoAnalyzeStatusView()

  const hidden = !state.status || smartActive
  const ariaLabel = hidden
    ? undefined
    : state.collapsed
      ? `${state.title}，已折叠`
      : `${state.title}，${state.detail}`

  return (
    <section
      id="auto-analyze-status"
      className={cx(
        STATUS_BASE_CLASS,
        !state.collapsed && 'max-h-24',
        state.collapsed && 'py-[5px]',
        !hidden && STATUS_STATE_CLASS[state.status]
      )}
      hidden={hidden}
      aria-live="polite"
      aria-atomic="true"
      aria-label={ariaLabel}
    >
      {hidden ? null : (
        <>
          <span
            className={cx('t-status-icon', STATUS_INDICATOR_CLASS[state.status])}
            key={state.status}
            aria-hidden="true"
          >
            <AutoAnalyzeIndicator status={state.status} collapsed={state.collapsed} />
          </span>
          <output className="min-w-0">
            <p className="m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold leading-tight text-ds-text-primary">
              {state.title}
            </p>
            <p className={cx(
              'mt-0.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-tight text-ds-text-secondary'
            )} hidden={state.collapsed}>
              {state.detail}
            </p>
          </output>
          <div className="inline-flex items-center gap-1.5">
            {state.showHistory ? (
              <Button
                className={actionClass}
                type="button"
                onClick={() => dispatchPopupAutoAnalyzeStatusAction('history')}
                unstyled
              >
                查看
              </Button>
            ) : null}
            <Button
              className={cx(actionClass, ghostActionClass)}
              type="button"
              onClick={() => dispatchPopupAutoAnalyzeStatusAction('toggle')}
              aria-expanded={state.collapsed ? 'false' : 'true'}
              unstyled
            >
              {state.collapsed ? '展开' : '折叠'}
            </Button>
            <Button
              className={cx(actionClass, ghostActionClass)}
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
