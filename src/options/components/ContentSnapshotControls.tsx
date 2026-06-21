import { AiProviderCard } from '../../ui/ai/AiProviderCard.js'
import {
  CollapsiblePanel,
  CollapsibleRoot,
  CollapsibleTrigger
} from '../../ui/base/Collapsible.js'
import { SwitchControl } from '../../ui/base/Switch.js'
import {
  AI_SETTINGS_ADVANCED_CLASS,
  AI_SETTINGS_ADVANCED_NOTE_CLASS,
  AI_SETTINGS_ADVANCED_PANEL_CLASS,
  AI_SETTINGS_ADVANCED_TRIGGER_CLASS,
  AI_SETTINGS_BODY_CLASS,
  AI_SETTINGS_COPY_CLASS,
  AI_SETTINGS_FIELD_TIP_CLASS,
  AI_SETTINGS_HEADER_CLASS,
  AI_SETTINGS_NARROW_CARD_CLASS,
  AI_SETTINGS_ROW_CLASS,
  AI_SETTINGS_ROW_TITLE_CLASS,
  AI_SETTINGS_SECONDARY_CLASS,
  AI_SETTINGS_STATUS_BADGE_CLASS,
  AI_SETTINGS_SUBTITLE_CLASS,
  AI_SETTINGS_SWITCH_CONTROL_CLASS,
  AI_SETTINGS_SWITCH_THUMB_CLASS,
  AI_SETTINGS_SWITCH_WRAP_CLASS
} from './ai-settings-card-classes.js'
import { handleContentSnapshotSettingsChange } from '../options-controller'
import { useContentSnapshotControlsState } from './content-snapshot-store.js'

const contentSnapshotTitle = (
  <div>
    <strong>网页内容索引</strong>
    <p className={AI_SETTINGS_SUBTITLE_CLASS}>用于让本地搜索和 AI 分类记住网页摘要，不是备份网页。</p>
  </div>
)

const contentSnapshotStatus = <span className={AI_SETTINGS_STATUS_BADGE_CLASS}>本地内容记忆</span>

export function ContentSnapshotControls() {
  const state = useContentSnapshotControlsState()

  return (
    <AiProviderCard
      className={AI_SETTINGS_NARROW_CARD_CLASS}
      title={contentSnapshotTitle}
      status={contentSnapshotStatus}
      headerClassName={AI_SETTINGS_HEADER_CLASS}
      iconName="ArchiveRestore"
      bodyClassName={AI_SETTINGS_BODY_CLASS}
    >
      <div className={AI_SETTINGS_ROW_CLASS}>
        <span className={AI_SETTINGS_COPY_CLASS}>
          <strong className={AI_SETTINGS_ROW_TITLE_CLASS}>保存网页内容索引</strong>
          <span className={AI_SETTINGS_SECONDARY_CLASS}>新增网页书签后保存标题、摘要和链接信息，让本地搜索/AI 分类更容易找到它。</span>
        </span>
        <span className={AI_SETTINGS_SWITCH_WRAP_CLASS}>
          <SwitchControl
            aria-label="保存网页内容索引"
            checked={state.enabled}
            className={AI_SETTINGS_SWITCH_CONTROL_CLASS}
            thumbClassName={AI_SETTINGS_SWITCH_THUMB_CLASS}
            onCheckedChange={(enabled) => handleContentSnapshotSettingsChange({ enabled })}
            unstyled
          />
        </span>
      </div>
      <div className={AI_SETTINGS_ROW_CLASS}>
        <span className={AI_SETTINGS_COPY_CLASS}>
          <strong className={AI_SETTINGS_ROW_TITLE_CLASS}>增强：记住正文，搜索更准</strong>
          <span className={AI_SETTINGS_SECONDARY_CLASS}>适合长文档和教程。开启后会保存可提取的正文，并把正文纳入本地搜索。</span>
        </span>
        <span className={AI_SETTINGS_SWITCH_WRAP_CLASS}>
          <SwitchControl
            aria-label="增强：记住正文，搜索更准"
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
        </span>
      </div>
      <CollapsibleRoot className={AI_SETTINGS_ADVANCED_CLASS}>
        <CollapsibleTrigger className={AI_SETTINGS_ADVANCED_TRIGGER_CLASS}>高级说明</CollapsibleTrigger>
        <CollapsiblePanel className={AI_SETTINGS_ADVANCED_PANEL_CLASS}>
          <p className={AI_SETTINGS_ADVANCED_NOTE_CLASS}>
            默认只保存摘要、标题和链接信息。开启增强后，正文只保存在本机，较长正文会放到浏览器的大数据存储区以减少普通设置占用。
          </p>
        </CollapsiblePanel>
      </CollapsibleRoot>
      <p className={AI_SETTINGS_FIELD_TIP_CLASS}>
        {state.statusCopy}
      </p>
    </AiProviderCard>
  )
}
