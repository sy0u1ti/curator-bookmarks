import { AiProviderCard } from '../../ui/ai/AiProviderCard.js'
import { SwitchControl } from '../../ui/primitives/Switch.js'
import { dispatchFeatureSettingsChange, type FeatureSettingKey } from './feature-settings-events.js'
import type { FeatureSettingsControlsState, FeatureSwitchItemState } from './feature-settings-types.js'

const featureSettingsTitle = <h2 className="ai-settings-subtitle">功能设置</h2>

export function FeatureSettingsControls({ state }: { state: FeatureSettingsControlsState }) {
  return (
    <AiProviderCard
      className="options-group ai-provider-card ai-feature-settings-card"
      title={featureSettingsTitle}
      headerClassName="ai-feature-settings-head"
      iconName="Sparkles"
      bodyClassName="ai-provider-layout"
    >
      {state.switches.map((item) => (
        <FeatureSwitchRow item={item} key={item.key} />
      ))}
    </AiProviderCard>
  )
}

function FeatureSwitchRow({ item }: { item: FeatureSwitchItemState }) {
  return (
    <div className="ai-feature-switch-row">
      <div className="ai-feature-switch-copy">
        <div className="ai-feature-title-row">
          <strong>
            {item.label} <HelpTooltip copy={item.help} />
          </strong>
          {item.statusId && item.status ? (
            <span id={item.statusId} className={`options-chip ai-inline-status ${item.statusTone || 'muted'}`}>
              {item.status}
            </span>
          ) : null}
        </div>
      </div>
      <span className="ai-switch">
        <SwitchControl
          id={item.key}
          aria-label={item.label}
          checked={item.checked}
          className="ai-switch-control"
          disabled={item.disabled}
          thumbClassName="ai-switch-thumb"
          onCheckedChange={(checked) => dispatchFeatureSettingsChange({
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
    <button className="ai-help-tooltip" type="button" aria-label={copy} data-tooltip={copy}>
      ?
    </button>
  )
}
