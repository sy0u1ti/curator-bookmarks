import { AiProviderCard } from '../../ui/ai/AiProviderCard.js'
import { SwitchControl } from '../../ui/base/Switch.js'
import { Tooltip } from '../../ui/base/Tooltip.js'
import {
  AI_SETTINGS_BODY_CLASS,
  AI_SETTINGS_CARD_CLASS,
  AI_SETTINGS_COPY_CLASS,
  AI_SETTINGS_HEADER_CLASS,
  AI_SETTINGS_HELP_TOOLTIP_CLASS,
  AI_SETTINGS_HELP_TOOLTIP_POPUP_CLASS,
  AI_SETTINGS_INLINE_STATUS_CLASS,
  AI_SETTINGS_ROW_CLASS,
  AI_SETTINGS_ROW_TITLE_CLASS,
  AI_SETTINGS_STATUS_TONE_CLASS,
  AI_SETTINGS_SWITCH_CONTROL_CLASS,
  AI_SETTINGS_SWITCH_THUMB_CLASS,
  AI_SETTINGS_SWITCH_WRAP_CLASS,
  AI_SETTINGS_TITLE_CLASS,
  AI_SETTINGS_TITLE_ROW_CLASS
} from './ai-settings-card-classes.js'
import { handleFeatureSettingsChange } from '../options-controller'
import { useFeatureSettingsControlsState } from './feature-settings-store.js'
import type { FeatureSettingKey, FeatureSwitchItemState } from './feature-settings-types.js'

export function FeatureSettingsControls() {
  const state = useFeatureSettingsControlsState()

  return (
    <AiProviderCard
      className={AI_SETTINGS_CARD_CLASS}
      title={<h2 className={AI_SETTINGS_TITLE_CLASS}>功能设置</h2>}
      headerClassName={AI_SETTINGS_HEADER_CLASS}
      iconName="Sparkles"
      bodyClassName={AI_SETTINGS_BODY_CLASS}
    >
      {state.switches.map((item) => (
        <FeatureSwitchRow item={item} key={item.key} />
      ))}
    </AiProviderCard>
  )
}

function FeatureSwitchRow({ item }: { item: FeatureSwitchItemState }) {
  return (
    <div className={AI_SETTINGS_ROW_CLASS}>
      <div className={AI_SETTINGS_COPY_CLASS}>
        <div className={AI_SETTINGS_TITLE_ROW_CLASS}>
          <strong className={AI_SETTINGS_ROW_TITLE_CLASS}>
            {item.label} <HelpTooltip copy={item.help} />
          </strong>
          {item.status ? (
            <span
              className={`${AI_SETTINGS_INLINE_STATUS_CLASS} ${AI_SETTINGS_STATUS_TONE_CLASS[item.statusTone || 'muted']}`}
            >
              {item.status}
            </span>
          ) : null}
        </div>
      </div>
      <span className={AI_SETTINGS_SWITCH_WRAP_CLASS}>
        <SwitchControl
          aria-label={item.label}
          checked={item.checked}
          className={AI_SETTINGS_SWITCH_CONTROL_CLASS}
          disabled={item.disabled}
          thumbClassName={AI_SETTINGS_SWITCH_THUMB_CLASS}
          onCheckedChange={(checked) => handleFeatureSettingsChange({
            checked,
            key: item.key as FeatureSettingKey
          })}
          unstyled
        />
      </span>
    </div>
  )
}

function HelpTooltip({ copy }: { copy: string }) {
  return (
    <Tooltip
      content={copy}
      delay={180}
      popupClassName={AI_SETTINGS_HELP_TOOLTIP_POPUP_CLASS}
      sideOffset={10}
    >
      <button className={AI_SETTINGS_HELP_TOOLTIP_CLASS} type="button" aria-label={copy}>
        ?
      </button>
    </Tooltip>
  )
}
