import { Button } from '../../ui/base/Button'
import { StableLabel, StatusMessage } from '../../ui/base/StatusMessage'
import { Icon } from '../../ui/icons/Icon'
import { handleShortcutAction } from '../options-controller'
import { AI_SETTINGS_TITLE_CLASS } from './ai-settings-card-classes.js'
import { ShortcutList } from './ShortcutList.js'
import { useShortcutControlsState } from './shortcut-store.js'

const SHORTCUT_CARD_CLASS =
  'options-interactive-surface mt-7 rounded-ds-card border-0 bg-ds-surface-1 p-4 max-[760px]:mt-5 max-[760px]:p-4'
const SHORTCUT_HEAD_CLASS =
  'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2'
const SHORTCUT_TITLE_ROW_CLASS =
  'grid min-w-0 grid-cols-[18px_minmax(0,1fr)] items-start gap-2.5'
const SHORTCUT_TITLE_ICON_CLASS =
  'mt-[2px] inline-grid size-[18px] shrink-0 place-items-center text-ds-text-secondary'
const SHORTCUT_SUBTITLE_CLASS =
  'col-span-2 m-0 text-[13px] leading-[1.6] text-ds-text-secondary'
const SHORTCUT_STATUS_BASE_CLASS =
  'inline-flex min-h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-[11px] text-xs font-semibold leading-none tracking-[0]'
const SHORTCUT_STATUS_TONE_CLASSES: Record<string, string> = {
  danger: 'border-ds-danger/35 bg-ds-danger-soft text-ds-danger-text',
  muted: 'border-ds-hover bg-ds-surface-2 text-ds-text-muted',
  success: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
  warning: 'border-ds-warning/35 bg-ds-warning-soft text-ds-warning'
}
const SHORTCUT_LIST_CLASS = 'mt-5 flex flex-col gap-2'
const SHORTCUT_ACTIONS_CLASS =
  'mt-[18px] flex flex-wrap items-center justify-end gap-2.5 max-[760px]:flex-col max-[760px]:items-stretch'
const SHORTCUT_ACTION_BUTTON_CLASS = 'max-[760px]:w-full'

export function ShortcutControls() {
  const state = useShortcutControlsState()
  const statusClassName = [
    SHORTCUT_STATUS_BASE_CLASS,
    SHORTCUT_STATUS_TONE_CLASSES[state.statusTone] || SHORTCUT_STATUS_TONE_CLASSES.muted
  ].join(' ')

  return (
    <div className={SHORTCUT_CARD_CLASS} aria-busy={state.loading ? 'true' : undefined}>
      <div className={SHORTCUT_HEAD_CLASS}>
        <div className={SHORTCUT_TITLE_ROW_CLASS}>
          <span className={SHORTCUT_TITLE_ICON_CLASS}>
            <Icon name="Keyboard" size={16} strokeWidth={2} aria-hidden="true" />
          </span>
          <h2 className={AI_SETTINGS_TITLE_CLASS}>快捷键</h2>
        </div>
        <span className={statusClassName}>
          <StableLabel text={state.statusLabel} reserve={['读取中…', '读取失败', '已同步']} />
        </span>
        <StatusMessage className={SHORTCUT_SUBTITLE_CLASS} tone={state.statusTone === 'warning' ? 'warning' : state.statusTone === 'danger' ? 'error' : 'neutral'}>
          {state.detail || '快捷键在 Chrome 扩展设置中修改。'}
        </StatusMessage>
      </div>
      <div className={`${SHORTCUT_LIST_CLASS} ${state.loading ? '' : 'options-settings-ready-body'}`}>
        <ShortcutList state={state.list} />
      </div>
      <div className={SHORTCUT_ACTIONS_CLASS}>
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
          <Icon name="RefreshCw" size={14} aria-hidden="true" />
          刷新状态
        </Button>
        <Button
          className={SHORTCUT_ACTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="primary"
          aria-label="打开 Chrome 扩展快捷键设置"
          onClick={() => handleShortcutAction('open-settings')}
        >
          <Icon name="ExternalLink" size={14} aria-hidden="true" />
          打开快捷键设置
        </Button>
      </div>
    </div>
  )
}
