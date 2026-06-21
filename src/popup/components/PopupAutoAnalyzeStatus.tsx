import { Button } from '../../ui/base/Button'
import { cx } from '../../ui/base/utils'
import {
  dispatchPopupAutoAnalyzeStatusAction,
  usePopupAutoAnalyzeStatusView
} from '../popup-controller-store'

const STATUS_BASE_CLASS =
  'relative z-[1] grid min-h-[38px] flex-none grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2.5 overflow-hidden rounded-[7px] border border-[var(--ui-divider)] bg-[var(--ui-surface)] px-2 py-[7px] pl-2.5 shadow-none'

const STATUS_STATE_CLASS: Record<string, string> = {
  queued: 'border-[var(--ui-accent-line)] bg-[var(--ui-surface-selected)] text-[var(--ui-accent-text)]',
  processing: 'border-[var(--ui-accent-line)] bg-[var(--ui-surface-selected)] text-[var(--ui-accent-text)]',
  completed: 'border-[var(--ui-accent-line)] bg-[var(--ui-surface-selected)] text-[var(--ui-accent-text)]',
  failed: 'border-[rgba(255,154,147,0.45)] bg-[var(--ui-surface-danger)]'
}

const STATUS_INDICATOR_CLASS: Record<string, string> = {
  queued: 'bg-[#a8a8ad] shadow-[0_0_0_3px_rgba(245,245,247,0.1)]',
  processing: 'animate-[auto-analyze-pulse_1400ms_ease-in-out_infinite] bg-[var(--ui-accent-strong)] shadow-[0_0_0_3px_rgba(142,230,168,0.12)]',
  completed: 'bg-[var(--ui-accent-strong)] shadow-[0_0_0_3px_rgba(142,230,168,0.12)]',
  failed: 'bg-[#ff8a82] shadow-[0_0_0_3px_rgba(255,138,130,0.12)]'
}

const actionClass =
  'inline-flex min-h-[26px] min-w-[34px] items-center justify-center rounded-md border border-[var(--ui-divider)] bg-[var(--ui-surface)] px-2 text-[11px] font-semibold leading-none text-[var(--ui-text-primary)] outline-none transition-colors hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)]'

const ghostActionClass =
  'border-transparent bg-transparent text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] focus-visible:text-[var(--ui-text-primary)]'

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
              'h-2 w-2 rounded-full bg-[#d7d7dc] shadow-[0_0_0_3px_rgba(245,245,247,0.1)]',
              STATUS_INDICATOR_CLASS[state.status]
            )}
            aria-hidden="true"
          ></div>
          <output className="min-w-0">
            <p className="m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold leading-tight text-[var(--ui-text-primary)]">
              {state.title}
            </p>
            <p className={cx(
              'mt-0.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-tight text-[var(--ui-text-secondary)]'
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
