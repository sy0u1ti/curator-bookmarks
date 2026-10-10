import type { Ref } from 'react'
import { AiProviderSettings } from './AiProviderSettings.js'
import { OPTION_PANEL_CLASS } from './option-layout-classes.js'
import { OptionPanelHeader } from './OptionPanelHeader.js'

export function AiSettingsPanel({ anchorRef, attentionRequestId }: { anchorRef?: Ref<HTMLDivElement>; attentionRequestId: number }) {
  return <section id="ai-settings" className={OPTION_PANEL_CLASS} aria-labelledby="ai-settings-title">
    <OptionPanelHeader titleId="ai-settings-title" title="AI 服务配置" description="配置大模型接入点、模型规格及推理参数。自动化整理策略可前往「通用设置」进行自定义。" />
    <div ref={anchorRef}><AiProviderSettings attentionRequestId={attentionRequestId} /></div>
  </section>
}
