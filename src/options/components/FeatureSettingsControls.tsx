import { AiProviderCard } from '../../ui/ai/AiProviderCard'
import { SwitchControl } from '../../ui/base/Switch'
import { Select } from '../../ui/base/Select'
import { StableLabel, StatusMessage } from '../../ui/base/StatusMessage'
import type { InboxWorkflowMode } from '../../shared/inbox-workflow'
import {
  AI_SETTINGS_BODY_CLASS,
  AI_SETTINGS_CARD_CLASS,
  AI_SETTINGS_COPY_CLASS,
  AI_SETTINGS_HEADER_CLASS,
  AI_SETTINGS_INLINE_STATUS_CLASS,
  AI_SETTINGS_LOADING_SWITCH_CLASS,
  AI_SETTINGS_READY_BODY_CLASS,
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
import { FEATURE_SWITCH_CONTENT, type FeatureSwitchItemState, type FeatureSettingsControlsState } from './feature-settings-types.js'

const FEATURE_SETTINGS_LOADING_ROWS = FEATURE_SWITCH_CONTENT
const FEATURE_STATUS_LABELS = ['保存中…', '待授权'] as const

export function FeatureSettingsControls() {
  const state = useFeatureSettingsControlsState()

  return (
    <AiProviderCard
      className={AI_SETTINGS_CARD_CLASS}
      title={<h2 className={AI_SETTINGS_TITLE_CLASS}>收藏与整理</h2>}
      headerClassName={AI_SETTINGS_HEADER_CLASS}
      iconName="Sparkles"
      bodyClassName={`${AI_SETTINGS_BODY_CLASS} ${state.loading ? '' : AI_SETTINGS_READY_BODY_CLASS}`}
      aria-busy={state.loading ? 'true' : undefined}
    >
      {state.loading
        ? FEATURE_SETTINGS_LOADING_ROWS.map((item) => (
            <FeatureSwitchLoadingRow item={item} key={item.key} />
          ))
        : state.switches.map((item) => (
            <FeatureSwitchRow item={item} key={item.key} />
          ))}
      <InboxWorkflowControl state={state.loading ? undefined : state.inboxWorkflow} />
    </AiProviderCard>
  )
}

function InboxWorkflowControl({ state }: { state: FeatureSettingsControlsState['inboxWorkflow'] }) {
  return (
    <div className="grid gap-3 px-4 py-4" aria-hidden={!state || undefined}>
      <div>
        <h3 className={AI_SETTINGS_ROW_TITLE_CLASS}>待整理 · 快捷键收藏后</h3>
      </div>
      {state ? (
        <Select
          ariaLabel="Inbox 收藏后的整理方式"
          value={state.value}
          disabled={state.disabled}
          options={[
            { value: 'capture', label: '只收藏，暂不分析' },
            { value: 'move', label: '生成标签，高置信时自动移动' },
            { value: 'tags', label: '只生成标签和摘要，保留在 Inbox' },
            { value: 'keep', label: '生成整理建议，由我决定是否移动' }
          ]}
          onValueChange={value => {
            if (value) handleFeatureSettingsChange({ key: 'inboxWorkflow', value: value as InboxWorkflowMode })
          }}
        />
      ) : <span className="block h-9 rounded-ds-sm bg-ds-surface-2" />}
      <StatusMessage className="m-0 text-xs leading-relaxed text-ds-text-secondary">
        {state?.status || 'AI 配置可用时执行；分析失败或置信度不足时保留在 Inbox。'}
      </StatusMessage>
    </div>
  )
}

function FeatureSwitchLoadingRow({
  item
}: {
  item: (typeof FEATURE_SETTINGS_LOADING_ROWS)[number]
}) {
  return (
    <div className={AI_SETTINGS_ROW_CLASS} aria-hidden="true">
      <div className={AI_SETTINGS_COPY_CLASS}>
        <div className={AI_SETTINGS_TITLE_ROW_CLASS}>
          <strong className={AI_SETTINGS_ROW_TITLE_CLASS}>{item.label}</strong>
        </div>
        <p className="mb-0 mt-1 text-xs leading-relaxed text-ds-text-secondary">{item.description}</p>
      </div>
      <span className={AI_SETTINGS_SWITCH_WRAP_CLASS}>
        <span className={AI_SETTINGS_LOADING_SWITCH_CLASS} />
      </span>
    </div>
  )
}

function FeatureSwitchRow({ item }: { item: FeatureSwitchItemState }) {
  return (
    <div className={AI_SETTINGS_ROW_CLASS}>
      <div className={AI_SETTINGS_COPY_CLASS}>
        <div className={AI_SETTINGS_TITLE_ROW_CLASS}>
          <strong className={AI_SETTINGS_ROW_TITLE_CLASS}>
            {item.label}
          </strong>
          <span
            className={`${AI_SETTINGS_INLINE_STATUS_CLASS} ${AI_SETTINGS_STATUS_TONE_CLASS[item.statusTone || 'muted']} ${item.status ? '' : 'invisible'}`}
            role="status"
            aria-hidden={!item.status || undefined}
          >
            <StableLabel text={item.status || ''} reserve={FEATURE_STATUS_LABELS} />
          </span>
        </div>
        {item.description && <p id={`feature-${item.key}-description`} className="mb-0 mt-1 text-xs leading-relaxed text-ds-text-secondary">{item.description}</p>}
      </div>
      <span className={AI_SETTINGS_SWITCH_WRAP_CLASS}>
        <SwitchControl
          aria-label={item.label}
          aria-describedby={item.description ? `feature-${item.key}-description` : undefined}
          checked={item.checked}
          className={AI_SETTINGS_SWITCH_CONTROL_CLASS}
          disabled={item.disabled}
          thumbClassName={AI_SETTINGS_SWITCH_THUMB_CLASS}
          onCheckedChange={(checked) => handleFeatureSettingsChange({
            checked,
            key: item.key
          })}
          unstyled
        />
      </span>
    </div>
  )
}
