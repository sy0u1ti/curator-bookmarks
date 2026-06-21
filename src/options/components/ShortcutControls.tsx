import { Button } from '../../ui/base/Button.js'
import { handleShortcutAction } from '../options-controller'
import { ShortcutList } from './ShortcutList.js'
import { useShortcutControlsState } from './shortcut-store.js'

const SHORTCUT_DETAIL_BASE_CLASS =
  'mt-3 mb-0 whitespace-normal rounded-lg border border-[rgba(245,245,247,0.08)] bg-[rgba(245,245,247,0.035)] px-3 py-2.5 text-xs leading-[1.6] text-[var(--ui-text-disabled)] [overflow-wrap:anywhere]'
const SHORTCUT_DETAIL_TONE_CLASSES: Record<string, string> = {
  danger: 'border-[rgba(255,206,141,0.18)] bg-[rgba(255,206,141,0.08)] text-[#ffdca5]',
  success: 'border-[rgba(170,237,189,0.16)] bg-[rgba(170,237,189,0.08)] text-[#bdf3ca]',
  warning: 'border-[rgba(255,206,141,0.18)] bg-[rgba(255,206,141,0.08)] text-[#ffdca5]'
}
const SHORTCUT_CARD_CLASS =
  'mt-7 rounded-[var(--ui-radius-group)] border border-white/[0.06] bg-[rgba(24,24,26,0.92)] p-[26px_24px_24px] max-[760px]:mt-5 max-[760px]:p-[18px_16px]'
const SHORTCUT_HEAD_CLASS =
  'flex items-start justify-between gap-[18px] max-[760px]:flex-col max-[760px]:items-stretch'
const SHORTCUT_COPY_CLASS = 'min-w-0'
const SHORTCUT_TITLE_CLASS =
  'm-0 text-[17px] font-[720] leading-[1.35] tracking-[0] text-[var(--ui-text-primary)]'
const SHORTCUT_NOTICE_CLASS =
  'mt-3 mb-0 text-sm font-[560] leading-[1.7] text-[var(--ui-text-secondary)]'
const SHORTCUT_SUBTITLE_CLASS =
  'mt-2 mb-0 text-[13px] leading-[1.7] text-[var(--ui-text-disabled)]'
const SHORTCUT_STATUS_BASE_CLASS =
  'inline-flex min-h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-[11px] text-[11px] font-semibold leading-none tracking-[0]'
const SHORTCUT_STATUS_TONE_CLASSES: Record<string, string> = {
  danger: 'border-[rgba(255,138,130,0.22)] bg-[rgba(255,138,130,0.12)] text-[#ffb7b0]',
  muted: 'border-[var(--ui-surface-hover)] bg-[var(--ui-surface-raised)] text-[var(--ui-text-tertiary)]',
  success: 'border-[rgba(170,237,189,0.32)] bg-[rgba(170,237,189,0.16)] text-[#e2ffe9]',
  warning: 'border-[rgba(255,206,141,0.2)] bg-[rgba(255,206,141,0.12)] text-[#ffdca5]'
}
const SHORTCUT_LIST_CLASS = 'mt-5 flex flex-col gap-2'
const SHORTCUT_ACTIONS_CLASS =
  'mt-[18px] flex flex-wrap items-center justify-end gap-2.5 max-[760px]:flex-col max-[760px]:items-stretch'
const SHORTCUT_ACTION_BUTTON_CLASS = 'max-[760px]:w-full'

export function ShortcutControls() {
  const state = useShortcutControlsState()
  const detailClassName = [
    SHORTCUT_DETAIL_BASE_CLASS,
    SHORTCUT_DETAIL_TONE_CLASSES[state.statusTone] || ''
  ]
    .filter(Boolean)
    .join(' ')
  const statusClassName = [
    SHORTCUT_STATUS_BASE_CLASS,
    SHORTCUT_STATUS_TONE_CLASSES[state.statusTone] || SHORTCUT_STATUS_TONE_CLASSES.muted
  ].join(' ')

  return (
    <div className={SHORTCUT_CARD_CLASS}>
      <div className={SHORTCUT_HEAD_CLASS}>
        <div className={SHORTCUT_COPY_CLASS}>
          <h2 className={SHORTCUT_TITLE_CLASS}>快捷键</h2>
          <p className={SHORTCUT_NOTICE_CLASS}>为打开搜索、智能分类和切换自动分析设置快捷键。</p>
          <p className={SHORTCUT_SUBTITLE_CLASS}>Chrome 只允许在扩展快捷键页修改绑定。</p>
        </div>
        <span className={statusClassName}>
          {state.statusLabel}
        </span>
      </div>
      {state.detail ? (
        <p className={detailClassName}>
          {state.detail}
        </p>
      ) : null}
      <div className={SHORTCUT_LIST_CLASS}>
        <ShortcutList state={state.list} />
      </div>
      <div className={SHORTCUT_ACTIONS_CLASS}>
        <Button
          className={SHORTCUT_ACTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="primary"
          aria-label="打开 Chrome 扩展快捷键设置"
          onClick={() => handleShortcutAction('open-settings')}
        >
          打开快捷键设置
        </Button>
        <Button
          className={SHORTCUT_ACTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="复制 Chrome 扩展快捷键设置地址"
          onClick={() => handleShortcutAction('copy-url')}
        >
          复制设置地址
        </Button>
        <Button
          className={SHORTCUT_ACTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="刷新扩展快捷键绑定状态"
          disabled={state.loading}
          focusableWhenDisabled={state.loading}
          onClick={() => handleShortcutAction('refresh')}
        >
          刷新状态
        </Button>
      </div>
    </div>
  )
}
