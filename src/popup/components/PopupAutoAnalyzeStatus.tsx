import { Button } from '../../ui'
import { cx } from '../../ui'
import {
  dispatchPopupAutoAnalyzeStatusAction,
  usePopupAutoAnalyzeStatusView
} from '../popup-controller-store'

const STATUS_BASE_CLASS =
  'relative z-[1] grid min-h-[38px] flex-none grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2.5 overflow-hidden rounded-[7px] border border-ds-border bg-ds-surface-1 px-2 py-[7px] pl-2.5 shadow-none'

const STATUS_STATE_CLASS: Record<string, string> = {
  queued: 'border-ds-accent-line bg-ds-selected text-ds-accent-text',
  processing: 'border-ds-accent-line bg-ds-selected text-ds-accent-text',
  completed: 'border-ds-accent-line bg-ds-selected text-ds-accent-text',
  failed: 'border-ds-danger bg-ds-danger-soft'
}

const STATUS_INDICATOR_CLASS: Record<string, string> = {
  queued: 'bg-ds-text-secondary shadow-none',
  processing: 'animate-[auto-analyze-pulse_1400ms_ease-in-out_infinite] bg-ds-accent-hover shadow-none',
  completed: 'bg-ds-accent-hover shadow-none',
  failed: 'bg-ds-danger-text shadow-none'
}

const actionClass =
  'inline-flex min-h-[26px] min-w-[34px] items-center justify-center rounded-md border border-ds-border bg-ds-surface-1 px-2 text-[11px] font-semibold leading-none text-ds-text-primary outline-none transition-colors hover:border-ds-border-hover hover:bg-ds-hover focus-visible:border-ds-border-hover focus-visible:bg-ds-hover'

const ghostActionClass =
  'border-transparent bg-transparent text-ds-text-secondary hover:text-ds-text-primary focus-visible:text-ds-text-primary'

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
        state.collapsed && 'grid-cols-[8px_minmax(0,1fr)_auto] py-[5px]',
        !hidden && STATUS_STATE_CLASS[state.status]
      )}
      hidden={hidden}
      aria-live="polite"
      aria-atomic="true"
      aria-label={ariaLabel}
    >
      {hidden ? null : (
        <>
          <div
            className={cx(
                'h-2 w-2 rounded-full bg-ds-text-primary shadow-none',
              STATUS_INDICATOR_CLASS[state.status]
            )}
            aria-hidden="true"
          ></div>
          <output className="min-w-0">
            <p className="m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold leading-tight text-ds-text-primary">
              {state.title}
            </p>
            <p className={cx(
              'mt-0.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-tight text-ds-text-secondary'
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
