import { useEffect, useRef } from 'react'
import { Button } from '../../ui/base/Button.js'
import { Input } from '../../ui/base/Input.js'
import { Popover } from '../../ui/base/Popover.js'
import { cx } from '../../ui/base/utils.js'
import { ButtonBusyLoadingLabel } from './LoadingLabel.js'
import { handleAvailabilityControlsAction } from '../options-controller'
import { useAvailabilityControls } from './availability-controls-store.js'

const AVAILABILITY_CONTROLS_TOOLBAR_CLASS =
  'mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 max-[1180px]:grid-cols-[minmax(0,1fr)] max-[1180px]:items-start'
const AVAILABILITY_PERMISSION_CARD_CLASS =
  'rounded-[var(--ui-radius-group)] border border-[var(--ui-divider-subtle)] bg-[var(--ui-surface)] p-[18px_20px] max-[760px]:px-4'
const AVAILABILITY_PERMISSION_META_CLASS =
  'flex flex-wrap items-center justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start'
const AVAILABILITY_PERMISSION_TITLE_CLASS =
  'block text-[15px] font-[650] leading-normal tracking-[0] text-[var(--ui-text-primary)]'
const AVAILABILITY_PERMISSION_COPY_CLASS =
  'mt-2.5 mb-0 text-[13px] leading-[1.7] text-[var(--ui-text-secondary)]'
const AVAILABILITY_CONTROLS_ACTIONS_CLASS =
  'flex flex-wrap items-center justify-end gap-3 max-[1180px]:justify-start max-[760px]:flex-col max-[760px]:items-start'
const AVAILABILITY_BADGE_BASE_CLASS =
  'inline-flex min-h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-[11px] text-[11px] font-semibold leading-none tracking-[0]'
const AVAILABILITY_BADGE_TONE_CLASSES: Record<string, string> = {
  danger: 'border-[rgba(255,138,130,0.22)] bg-[rgba(255,138,130,0.12)] text-[#ffb7b0]',
  muted: 'border-[var(--ui-surface-hover)] bg-[var(--ui-surface-raised)] text-[var(--ui-text-tertiary)]',
  success: 'border-[rgba(170,237,189,0.32)] bg-[rgba(170,237,189,0.16)] text-[#e2ffe9]',
  warning: 'border-[rgba(255,206,141,0.2)] bg-[rgba(255,206,141,0.12)] text-[#ffdca5]'
}
const AVAILABILITY_BUTTON_MOBILE_FULL_CLASS = 'max-[760px]:w-full'
const SETTINGS_ANCHOR_CLASS = `relative shrink-0 ${AVAILABILITY_BUTTON_MOBILE_FULL_CLASS}`
const SETTINGS_POPOVER_CLASS =
  '!z-[24] w-[min(320px,calc(100vw_-_48px))] !rounded-[8px] !border-[var(--ui-divider-subtle)] !bg-[#0d0d0e] !p-[14px] !shadow-[0_18px_48px_rgba(0,0,0,0.46)]'
const SETTINGS_HEAD_CLASS = 'flex items-center justify-between gap-2.5'
const SETTINGS_TITLE_CLASS = 'text-sm font-bold text-[var(--ui-text-primary)]'
const SETTINGS_STATUS_BASE_CLASS =
  'min-w-11 text-right text-xs font-[650] leading-[1.4] text-[rgba(245,245,247,0.46)] max-[760px]:text-left'
const SETTINGS_STATUS_TONE_CLASSES: Record<string, string> = {
  danger: 'text-[#ffb7b0]',
  muted: 'text-[rgba(245,245,247,0.46)]',
  success: 'text-[#bdf3ca]',
  warning: 'text-[#ffdca5]'
}
const SETTINGS_FIELD_CLASS =
  'mt-3.5 grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3 text-[13px] font-semibold text-[var(--ui-text-secondary)] max-[760px]:grid-cols-[minmax(0,1fr)]'
const SETTINGS_INPUT_CLASS =
  'h-[34px] w-full min-w-0 !rounded-[6px] !border !border-[rgba(255,255,255,0.13)] !bg-[#050506] text-center text-sm font-[650] !text-[var(--ui-text-primary)] outline-none focus-visible:!border-[rgba(255,255,255,0.13)] focus-visible:!bg-[#050506] focus-visible:!shadow-none focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-[rgba(245,245,247,0.42)]'
const SETTINGS_NOTE_CLASS = 'mb-0 mt-3 text-xs leading-[1.6] text-[var(--ui-text-tertiary)]'
const SETTINGS_ACTIONS_CLASS = 'mt-3.5 flex flex-wrap items-center justify-end gap-2.5'

function BusyLabel({
  busy,
  label
}: {
  busy: boolean
  label: string
}) {
  if (!busy) {
    return <>{label}</>
  }

  return <ButtonBusyLoadingLabel label={label} />
}

export function AvailabilityControls() {
  const state = useAvailabilityControls()
  const concurrencyInputRef = useRef<HTMLInputElement | null>(null)
  const badgeClassName = cx(
    AVAILABILITY_BADGE_BASE_CLASS,
    AVAILABILITY_BADGE_TONE_CLASSES[state.badgeTone] || AVAILABILITY_BADGE_TONE_CLASSES.muted
  )
  const settingsStatusClassName = cx(
    SETTINGS_STATUS_BASE_CLASS,
    SETTINGS_STATUS_TONE_CLASSES[state.settingsStatusTone] || SETTINGS_STATUS_TONE_CLASSES.muted
  )

  useEffect(() => {
    if (!state.settingsOpen) {
      return
    }

    window.setTimeout(() => {
      concurrencyInputRef.current?.focus()
      concurrencyInputRef.current?.select()
    }, 0)
  }, [state.settingsOpen])

  const updateDraft = (draft: Partial<typeof state.settingsDraft>) => {
    handleAvailabilityControlsAction({
      action: 'settings-draft-change',
      draft: {
        ...state.settingsDraft,
        ...draft
      }
    })
  }

  return (
    <div className={AVAILABILITY_CONTROLS_TOOLBAR_CLASS}>
      <div className={AVAILABILITY_PERMISSION_CARD_CLASS}>
        <div className={AVAILABILITY_PERMISSION_META_CLASS}>
          <span className={badgeClassName}>
            {state.badgeText}
          </span>
          <strong className={AVAILABILITY_PERMISSION_TITLE_CLASS}>检测方式</strong>
        </div>
        <p className={AVAILABILITY_PERMISSION_COPY_CLASS}>
          {state.permissionCopy}
        </p>
      </div>

      <div className={AVAILABILITY_CONTROLS_ACTIONS_CLASS}>
        <div className={SETTINGS_ANCHOR_CLASS}>
          <Popover
            align="end"
            open={state.settingsOpen}
            onOpenChange={(open) => {
              handleAvailabilityControlsAction({ action: 'settings-open-change', open })
            }}
            portal={false}
            popupClassName={SETTINGS_POPOVER_CLASS}
            side="bottom"
            sideOffset={10}
            trigger={
              <Button
                className={AVAILABILITY_BUTTON_MOBILE_FULL_CLASS}
                size="sm"
                type="button"
                variant="secondary"
                disabled={state.settingsDisabled}
                focusableWhenDisabled={state.settingsDisabled}
              >
                检测设置
              </Button>
            }
          >
            <div className={SETTINGS_HEAD_CLASS}>
              <strong className={SETTINGS_TITLE_CLASS}>检测设置</strong>
              <span
                className={settingsStatusClassName}
              >
                {state.settingsStatus}
              </span>
            </div>
            <label className={SETTINGS_FIELD_CLASS} htmlFor="availability-concurrency-input">
              <span>并发数</span>
              <Input
                id="availability-concurrency-input"
                ref={concurrencyInputRef}
                className={SETTINGS_INPUT_CLASS}
                type="number"
                inputMode="numeric"
                min="1"
                max="6"
                step="1"
                unstyled
                value={state.settingsDraft.concurrency}
                onValueChange={(value) => {
                  updateDraft({ concurrency: value })
                }}
              />
            </label>
            <label className={SETTINGS_FIELD_CLASS} htmlFor="availability-timeout-input">
              <span>超时时长（秒）</span>
              <Input
                id="availability-timeout-input"
                className={SETTINGS_INPUT_CLASS}
                type="number"
                inputMode="numeric"
                min="5"
                max="120"
                step="5"
                unstyled
                value={state.settingsDraft.navigationTimeoutSeconds}
                onValueChange={(value) => {
                  updateDraft({ navigationTimeoutSeconds: value })
                }}
              />
            </label>
            <p className={SETTINGS_NOTE_CLASS}>单域名仍会自动限流；遇到超时或 HTTP 429 会降速。</p>
            <div className={SETTINGS_ACTIONS_CLASS}>
              <Button
                className={AVAILABILITY_BUTTON_MOBILE_FULL_CLASS}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => handleAvailabilityControlsAction({ action: 'settings-reset' })}
              >
                恢复默认
              </Button>
              <Button
                className={AVAILABILITY_BUTTON_MOBILE_FULL_CLASS}
                size="sm"
                type="button"
                variant="primary"
                onClick={() => handleAvailabilityControlsAction({ action: 'settings-save' })}
              >
                保存设置
              </Button>
            </div>
          </Popover>
        </div>
        <Button
          className={AVAILABILITY_BUTTON_MOBILE_FULL_CLASS}
          type="button"
          variant="primary"
          disabled={state.actionDisabled}
          focusableWhenDisabled={state.actionDisabled}
          onClick={() => handleAvailabilityControlsAction({ action: 'start' })}
        >
          <BusyLabel busy={state.actionBusy} label={state.actionLabel} />
        </Button>
        {state.pauseHidden ? null : (
          <Button
            className={AVAILABILITY_BUTTON_MOBILE_FULL_CLASS}
            size="sm"
            type="button"
            variant="secondary"
            disabled={state.pauseDisabled}
            focusableWhenDisabled={state.pauseDisabled}
            onClick={() => handleAvailabilityControlsAction({ action: 'pause-toggle' })}
          >
            {state.pauseLabel}
          </Button>
        )}
        {state.stopHidden ? null : (
          <Button
            className={AVAILABILITY_BUTTON_MOBILE_FULL_CLASS}
            size="sm"
            type="button"
            variant="secondary"
            disabled={state.stopDisabled}
            focusableWhenDisabled={state.stopDisabled}
            onClick={() => handleAvailabilityControlsAction({ action: 'stop' })}
          >
            <BusyLabel busy={state.stopBusy} label={state.stopLabel} />
          </Button>
        )}
      </div>
    </div>
  )
}
