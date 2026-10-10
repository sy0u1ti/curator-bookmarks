import { InboxReview } from './InboxReview.js'
import { OPTION_PANEL_CLASS } from './option-layout-classes.js'
import { OptionPanelHeader } from './OptionPanelHeader.js'

export function InboxPanel() {
  return <section id="inbox" className={OPTION_PANEL_CLASS} aria-labelledby="inbox-title">
    <OptionPanelHeader titleId="inbox-title" title="待整理" description="集中审阅快捷收藏的书签。支持采纳 AI 建议、批量调整归档目录或就地保留；未配置 AI 时亦可流畅手动整理。" />
    <InboxReview />
  </section>
}
