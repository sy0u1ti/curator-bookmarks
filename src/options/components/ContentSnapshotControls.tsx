import { AiProviderCard } from '../../ui/ai/AiProviderCard'
import { SwitchControl } from '../../ui/base/Switch'
import {
  AI_SETTINGS_BODY_CLASS,
  AI_SETTINGS_COPY_CLASS,
  AI_SETTINGS_FIELD_TIP_CLASS,
  AI_SETTINGS_HEADER_CLASS,
  AI_SETTINGS_LOADING_SWITCH_CLASS,
  AI_SETTINGS_NARROW_CARD_CLASS,
  AI_SETTINGS_READY_BODY_CLASS,
  AI_SETTINGS_ROW_CLASS,
  AI_SETTINGS_ROW_TITLE_CLASS,
  AI_SETTINGS_SECONDARY_CLASS,
  AI_SETTINGS_SUBTITLE_CLASS,
  AI_SETTINGS_TITLE_CLASS,
  AI_SETTINGS_SWITCH_CONTROL_CLASS,
  AI_SETTINGS_SWITCH_THUMB_CLASS,
  AI_SETTINGS_SWITCH_WRAP_CLASS
} from './ai-settings-card-classes.js'
import { handleContentSnapshotSettingsChange } from '../options-controller'
import { useContentSnapshotControlsState } from './content-snapshot-store.js'

const contentSnapshotTitle = <h2 className={AI_SETTINGS_TITLE_CLASS}>网页内容索引</h2>
const contentSnapshotDescription = (
  <p className={AI_SETTINGS_SUBTITLE_CLASS}>在本地保存网页摘要，用于全文快速搜索与 AI 精准分类。</p>
)

export function ContentSnapshotControls() {
  const state = useContentSnapshotControlsState()

  return (
    <AiProviderCard
      className={AI_SETTINGS_NARROW_CARD_CLASS}
      title={contentSnapshotTitle}
      description={contentSnapshotDescription}
      headerClassName={AI_SETTINGS_HEADER_CLASS}
      iconName="ArchiveRestore"
      bodyClassName={`${AI_SETTINGS_BODY_CLASS} ${state.loading ? '' : AI_SETTINGS_READY_BODY_CLASS}`}
      aria-busy={state.loading ? 'true' : undefined}
    >
      <div className={AI_SETTINGS_ROW_CLASS}>
        <span className={AI_SETTINGS_COPY_CLASS}>
          <strong className={AI_SETTINGS_ROW_TITLE_CLASS}>保存网页内容索引</strong>
        </span>
        <span className={AI_SETTINGS_SWITCH_WRAP_CLASS}>
          {state.loading ? (
            <span className={AI_SETTINGS_LOADING_SWITCH_CLASS} aria-hidden="true" />
          ) : (
            <SwitchControl
              aria-label="保存网页内容索引"
              checked={state.enabled}
              className={AI_SETTINGS_SWITCH_CONTROL_CLASS}
              thumbClassName={AI_SETTINGS_SWITCH_THUMB_CLASS}
              onCheckedChange={(enabled) => handleContentSnapshotSettingsChange({ enabled })}
              unstyled
            />
          )}
        </span>
      </div>
      <div className={AI_SETTINGS_ROW_CLASS}>
        <span className={AI_SETTINGS_COPY_CLASS}>
          <strong className={AI_SETTINGS_ROW_TITLE_CLASS}>保存完整正文</strong>
          <span className={AI_SETTINGS_SECONDARY_CLASS}>正文保存在本地，可离线检索。</span>
        </span>
        <span className={AI_SETTINGS_SWITCH_WRAP_CLASS}>
          {state.loading ? (
            <span className={AI_SETTINGS_LOADING_SWITCH_CLASS} aria-hidden="true" />
          ) : (
            <SwitchControl
              aria-label="保存完整正文"
              checked={state.saveFullText}
              className={AI_SETTINGS_SWITCH_CONTROL_CLASS}
              disabled={state.fullTextDisabled}
              thumbClassName={AI_SETTINGS_SWITCH_THUMB_CLASS}
              onCheckedChange={(saveFullText) => handleContentSnapshotSettingsChange({
                saveFullText,
                syncFullTextSearch: true
              })}
              unstyled
            />
          )}
        </span>
      </div>
      {state.loading || state.statusCopy ? (
        <p className={AI_SETTINGS_FIELD_TIP_CLASS} role="status">
          {state.loading ? '正在读取本地设置…' : state.statusCopy}
        </p>
      ) : null}
    </AiProviderCard>
  )
}
