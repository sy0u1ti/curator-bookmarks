import { ContentSnapshotControls } from './ContentSnapshotControls.js'
import { FeatureSettingsControls } from './FeatureSettingsControls.js'
import { OPTION_PANEL_CLASS } from './option-layout-classes.js'
import { OptionPanelHeader } from './OptionPanelHeader.js'
import { ShortcutControls } from './ShortcutControls.js'

interface OptionsPanelVisibilityProps {
  hidden: boolean
}

export function GeneralPanel({
  hidden
}: OptionsPanelVisibilityProps) {
  return (
    <section id="general" className={OPTION_PANEL_CLASS} aria-labelledby="general-title" hidden={hidden}>
      <OptionPanelHeader
        titleId="general-title"
        title="通用设置"
        description="调整自动整理方式、网页内容索引与快捷键。"
      />

      <FeatureSettingsControls />

      <ContentSnapshotControls />

      <ShortcutControls />

    </section>
  )
}
