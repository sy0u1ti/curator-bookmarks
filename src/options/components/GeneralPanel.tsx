import type { Ref } from 'react'
import { AiProviderSettings } from './AiProviderSettings.js'
import { ContentSnapshotControls } from './ContentSnapshotControls.js'
import { FeatureSettingsControls } from './FeatureSettingsControls.js'
import {
  OPTION_PANEL_CLASS,
  OPTION_PANEL_TITLE_CLASS,
  OPTION_SECTION_LABEL_CLASS
} from './option-layout-classes.js'
import { ShortcutControls } from './ShortcutControls.js'

interface OptionsPanelVisibilityProps {
  aiProviderAnchorRef?: Ref<HTMLDivElement>
  aiProviderAttentionRequestId?: number
  hidden: boolean
}

export function GeneralPanel({
  aiProviderAnchorRef,
  aiProviderAttentionRequestId = 0,
  hidden
}: OptionsPanelVisibilityProps) {
  return (
    <section id="general" className={OPTION_PANEL_CLASS} aria-labelledby="general-title" hidden={hidden}>
      <p className={OPTION_SECTION_LABEL_CLASS}>General</p>
      <h1 id="general-title" className={OPTION_PANEL_TITLE_CLASS}>通用设置</h1>

      <FeatureSettingsControls />

      <ContentSnapshotControls />

      <ShortcutControls />

      <div ref={aiProviderAnchorRef}>
        <AiProviderSettings attentionRequestId={aiProviderAttentionRequestId} />
      </div>
    </section>
  )
}
