import { AiProviderCard } from '../../ui/ai/AiProviderCard.js'
import {
  CollapsiblePanel,
  CollapsibleRoot,
  CollapsibleTrigger
} from '../../ui/primitives/Collapsible.js'
import { SwitchControl } from '../../ui/primitives/Switch.js'
import { dispatchContentSnapshotSettingsChange } from './content-snapshot-events.js'
import type { ContentSnapshotControlsState } from './content-snapshot-types.js'

const contentSnapshotTitle = (
  <div>
    <strong>网页内容索引</strong>
    <p className="ai-settings-subtitle">用于让本地搜索和 AI 分类记住网页摘要，不是备份网页。</p>
  </div>
)

const contentSnapshotStatus = <span className="options-chip muted">本地内容记忆</span>

export function ContentSnapshotControls({ state }: { state: ContentSnapshotControlsState }) {
  return (
    <AiProviderCard
      className="options-group ai-naming-settings-card"
      title={contentSnapshotTitle}
      status={contentSnapshotStatus}
      headerClassName="ai-feature-settings-head"
      iconName="ArchiveRestore"
      bodyClassName="ai-provider-layout"
    >
      <div className="ai-feature-switch-row">
        <span className="ai-feature-switch-copy">
          <strong>保存网页内容索引</strong>
          <span className="ai-feature-secondary">新增网页书签后保存标题、摘要和链接信息，让本地搜索/AI 分类更容易找到它。</span>
        </span>
        <span className="ai-switch">
          <SwitchControl
            id="content-snapshot-enabled"
            aria-label="保存网页内容索引"
            checked={state.enabled}
            className="ai-switch-control"
            thumbClassName="ai-switch-thumb"
            onCheckedChange={(enabled) => dispatchContentSnapshotSettingsChange({ enabled })}
            unstyled
          />
        </span>
      </div>
      <div className="ai-feature-switch-row">
        <span className="ai-feature-switch-copy">
          <strong>增强：记住正文，搜索更准</strong>
          <span className="ai-feature-secondary">适合长文档和教程。开启后会保存可提取的正文，并把正文纳入本地搜索。</span>
        </span>
        <span className="ai-switch">
          <SwitchControl
            id="content-snapshot-full-text"
            aria-label="增强：记住正文，搜索更准"
            checked={state.saveFullText}
            className="ai-switch-control"
            disabled={state.fullTextDisabled}
            thumbClassName="ai-switch-thumb"
            onCheckedChange={(saveFullText) => dispatchContentSnapshotSettingsChange({
              saveFullText,
              syncFullTextSearch: true
            })}
            unstyled
          />
        </span>
      </div>
      <CollapsibleRoot className="ai-advanced-details content-snapshot-advanced">
        <CollapsibleTrigger className="ai-advanced-summary">高级说明</CollapsibleTrigger>
        <CollapsiblePanel className="ai-advanced-body">
          <p className="ai-advanced-note">
            默认只保存摘要、标题和链接信息。开启增强后，正文只保存在本机，较长正文会放到浏览器的大数据存储区以减少普通设置占用。
          </p>
        </CollapsiblePanel>
      </CollapsibleRoot>
      <p id="content-snapshot-status" className="ai-provider-field-tip content-snapshot-status-copy">
        {state.statusCopy}
      </p>
    </AiProviderCard>
  )
}
