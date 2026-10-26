import { InboxReview } from './InboxReview.js'
import { OPTION_PANEL_CLASS } from './option-layout-classes.js'
import { OptionPanelHeader } from './OptionPanelHeader.js'

export function InboxPanel() {
  return <section id="inbox" className={OPTION_PANEL_CLASS} aria-labelledby="inbox-title">
    <OptionPanelHeader titleId="inbox-title" title="待整理" />
    <InboxReview />
  </section>
}
