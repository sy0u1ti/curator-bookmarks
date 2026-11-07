import { AiProviderCard } from '../../ui/ai/AiProviderCard'
import { Button } from '../../ui/base/Button'
import { StableLabel, StatusMessage } from '../../ui/base/StatusMessage'
import { Icon } from '../../ui/icons/Icon'
import { handleShortcutAction } from '../options-controller'
import {
  AI_SETTINGS_BODY_CLASS,
  AI_SETTINGS_CARD_CLASS,
  AI_SETTINGS_HEADER_CLASS,
  AI_SETTINGS_READY_BODY_CLASS,
  AI_SETTINGS_SUBTITLE_CLASS,
  AI_SETTINGS_TITLE_CLASS
} from './ai-settings-card-classes.js'
import { ShortcutList } from './ShortcutList.js'
import { useShortcutControlsState } from './shortcut-store.js'

const SHORTCUT_STATUS_BASE_CLASS =
  'inline-flex min-h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-[11px] text-xs font-semibold leading-none tracking-[0]'
const SHORTCUT_STATUS_TONE_CLASSES: Record<string, string> = {
  danger: 'border-ds-danger/35 bg-ds-danger-soft text-ds-danger-text',
  muted: 'border-ds-hover bg-ds-surface-2 text-ds-text-muted',
  success: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
  warning: 'border-ds-warning/35 bg-ds-warning-soft text-ds-warning'
}
const SHORTCUT_ACTIONS_CLASS =
  'flex flex-wrap items-center justify-end gap-2.5 px-4 py-3 max-[760px]:flex-col max-[760px]:items-stretch'
const SHORTCUT_ACTION_BUTTON_CLASS = 'max-[760px]:w-full'
const SHORTCUT_DEFAULT_DETAIL = '快捷键在 Chrome 扩展设置中修改。'
const SHORTCUT_DETAIL_RESERVE = [SHORTCUT_DEFAULT_DETAIL, '快捷键未配置，可在 Chrome 扩展快捷键页设置。']
const shortcutTitle = <h2 className={AI_SETTINGS_TITLE_CLASS}>快捷键</h2>

export function ShortcutControls() {
  const state = useShortcutControlsState()
  const statusClassName = [
    SHORTCUT_STATUS_BASE_CLASS,
    SHORTCUT_STATUS_TONE_CLASSES[state.statusTone] || SHORTCUT_STATUS_TONE_CLASSES.muted
  ].join(' ')

  return (
    <AiProviderCard
      id="settings-shortcuts"
      className={AI_SETTINGS_CARD_CLASS}
      title={shortcutTitle}
      description={
        <StatusMessage className={AI_SETTINGS_SUBTITLE_CLASS} reserve={SHORTCUT_DETAIL_RESERVE} tone={state.statusTone === 'warning' ? 'warning' : state.statusTone === 'danger' ? 'error' : 'neutral'}>
          {state.detail || SHORTCUT_DEFAULT_DETAIL}
        </StatusMessage>
      }
      status={
        <span className={statusClassName}>
          <StableLabel text={state.statusLabel} reserve={['读取中…', '读取失败', '已同步']} />
        </span>
      }
      headerClassName={AI_SETTINGS_HEADER_CLASS}
      iconName="Keyboard"
      bodyClassName={`${AI_SETTINGS_BODY_CLASS} ${state.loading ? '' : AI_SETTINGS_READY_BODY_CLASS}`}
      aria-busy={state.loading ? 'true' : undefined}
    >
      <ShortcutList state={state.list} />
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
    </AiProviderCard>
  )
}
