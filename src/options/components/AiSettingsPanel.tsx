import type { Ref } from 'react'
import { AiProviderSettings } from './AiProviderSettings.js'
import { OPTION_PANEL_CLASS } from './option-layout-classes.js'
import { OptionPanelHeader } from './OptionPanelHeader.js'

export function AiSettingsPanel({ anchorRef, attentionRequestId }: { anchorRef?: Ref<HTMLDivElement>; attentionRequestId: number }) {
  return <section id="ai-settings" className={OPTION_PANEL_CLASS} aria-labelledby="ai-settings-title">
    <OptionPanelHeader titleId="ai-settings-title" title="AI 服务配置" />
    <div ref={anchorRef}><AiProviderSettings attentionRequestId={attentionRequestId} /></div>
  </section>
}
