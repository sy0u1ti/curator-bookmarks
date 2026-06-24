import { Button, TextSwap, useMotionEntrance } from '../../ui'
import { Icon } from '../../ui/icons/Icon'
import {
  dispatchPopupSavedSearchAction,
  usePopupSavedSearchesView
} from '../popup-controller-store'

const ROOT_CLASS = [
  't-panel-slide grid gap-[5px] rounded-lg border border-[rgba(245,245,247,0.12)] bg-[rgba(255,255,255,0.035)] px-[7px] py-1.5 [--panel-translate-y:8px]'
].join(' ')
const ROOT_COLLAPSED_CLASS = 'max-h-14 gap-0 py-1'
const HEAD_CLASS = [
  'flex min-h-[22px] items-center justify-between gap-2 text-[11px] font-bold [color:var(--ds-text-muted)]'
].join(' ')
const TOGGLE_CLASS = [
  'inline-flex min-h-[22px] items-center gap-1 rounded-md border border-transparent px-1.5 text-[11px] font-bold tracking-[0.01em]',
  '[color:var(--ds-text-secondary)]',
  'hover:border-[rgba(245,245,247,0.18)] hover:bg-[rgba(245,245,247,0.04)] hover:[color:var(--ds-text-primary)]',
  'focus-visible:border-[rgba(245,245,247,0.18)] focus-visible:bg-[rgba(245,245,247,0.04)] focus-visible:[color:var(--ds-text-primary)]'
].join(' ')
const SAVE_CLASS = [
  'inline-flex min-h-[22px] items-center justify-center rounded-[7px] border border-[rgba(245,245,247,0.18)] bg-ds-surface-2 px-[7px] text-[11px] font-bold leading-none',
  '[color:var(--ds-text-secondary)] disabled:cursor-default disabled:opacity-[0.55]',
  'hover:bg-ds-hover hover:[color:var(--ds-text-primary)]',
  'focus-visible:bg-ds-hover focus-visible:[color:var(--ds-text-primary)]'
].join(' ')
const STATUS_CLASS = 'text-[11px] leading-tight [color:var(--ds-text-disabled)]'
const ERROR_STATUS_CLASS = 'text-ds-danger-text'
const LIST_CLASS = 'flex flex-wrap gap-[5px]'
const CHIP_CLASS = [
  'inline-flex min-w-0 max-w-full overflow-hidden rounded-full border border-[rgba(245,245,247,0.18)] bg-ds-surface-3'
].join(' ')
const CHIP_ACTIVE_CLASS = 'border-[rgba(245,245,247,0.48)] bg-[rgba(245,245,247,0.11)]'
const APPLY_CLASS = [
  'inline-flex min-h-[22px] max-w-60 items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap px-[7px] text-[11px] font-bold leading-none',
  '[color:var(--ds-text-secondary)] hover:bg-ds-hover hover:[color:var(--ds-text-primary)] focus-visible:bg-ds-hover focus-visible:[color:var(--ds-text-primary)]'
].join(' ')
const DELETE_CLASS = [
  'inline-flex min-h-[22px] w-[22px] items-center justify-center border-l border-[rgba(245,245,247,0.18)] text-[11px] font-bold leading-none',
  '[color:var(--ds-text-muted)] hover:bg-ds-hover hover:[color:var(--ds-text-primary)] focus-visible:bg-ds-hover focus-visible:[color:var(--ds-text-primary)]'
].join(' ')

export function PopupSavedSearches() {
  const state = usePopupSavedSearchesView()
  const entered = useMotionEntrance(state.show)

  const className = [
    ROOT_CLASS,
    state.show && !state.expanded ? ROOT_COLLAPSED_CLASS : ''
  ].filter(Boolean).join(' ')
  const visibleItems = state.items.slice(0, 6)

  return (
    <div id="saved-searches" className={className} data-open={entered ? 'true' : 'false'} aria-label="已保存搜索" hidden={!state.show}>
      {state.show ? (
        <>
          <div className={HEAD_CLASS}>
            {state.items.length ? (
              <Button
                className={TOGGLE_CLASS}
                type="button"
                onClick={() => dispatchPopupSavedSearchAction('toggle')}
                aria-expanded={state.expanded}
                aria-controls="saved-searches-list"
                unstyled
              >
                <Icon
                  name="ChevronDown"
                  size={14}
                  className={['opacity-70 transition-transform duration-150', state.expanded ? '' : '-rotate-90'].filter(Boolean).join(' ')}
                  aria-hidden="true"
                />
                <TextSwap text={`已保存 ${state.items.length}`} />
              </Button>
            ) : (
              <span className={STATUS_CLASS} hidden={!state.expanded}>暂无保存项</span>
            )}
            {state.canSaveCurrent ? (
              <Button
                className={SAVE_CLASS}
                type="button"
                onClick={() => dispatchPopupSavedSearchAction('save-current')}
                disabled={state.hasCurrentSaved}
                aria-label={state.hasCurrentSaved ? '当前搜索已保存' : '保存当前搜索'}
                unstyled
              >
                {state.hasCurrentSaved ? '已保存' : '保存当前搜索'}
              </Button>
            ) : null}
          </div>
          {state.error && state.expanded ? <span className={[STATUS_CLASS, ERROR_STATUS_CLASS].join(' ')}>{state.error}</span> : null}
          {state.expanded && visibleItems.length ? (
            <div id="saved-searches-list" className={LIST_CLASS}>
              {visibleItems.map((item) => (
                <span className={[CHIP_CLASS, item.active ? CHIP_ACTIVE_CLASS : ''].filter(Boolean).join(' ')} key={item.id}>
                  <Button
                    className={APPLY_CLASS}
                    type="button"
                    onClick={() => dispatchPopupSavedSearchAction('apply', item.id)}
                    title={item.query}
                    unstyled
                  >
                    {item.label}
                  </Button>
                  <Button
                    className={DELETE_CLASS}
                    type="button"
                    onClick={() => dispatchPopupSavedSearchAction('delete', item.id)}
                    aria-label={`删除保存搜索：${item.label}`}
                    unstyled
                  >
                    <Icon name="X" size={12} aria-hidden="true" />
                  </Button>
                </span>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
