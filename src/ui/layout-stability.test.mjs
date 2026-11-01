import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('feedback keeps its footprint without discarding long error text or keyboard access', () => {
  const component = source('./base/StatusMessage.tsx')
  const css = source('./base/status-message.css')
  assert.match(css, /block-size:\s*calc\(var\(--status-message-lines/)
  assert.match(css, /overflow:\s*auto/)
  assert.match(css, /scrollbar-gutter:\s*stable/)
  assert.match(component, /tabIndex=\{overflow \? 0 : undefined\}/)
  assert.match(component, /tone === 'error' \? 'alert' : 'status'/)
  assert.doesNotMatch(component, /line-clamp|\.slice\(/)
})

test('the drawer header updates a bounded status instead of inserting a new row', () => {
  const component = source('../newtab/components/SettingsDrawer.tsx')
  const header = component.slice(component.indexOf('function SettingsDrawerHeader'), component.indexOf('function SettingsDrawerTabs'))
  assert.match(header, /<StatusMessage[\s\S]*id="settings-save-status"/)
  assert.doesNotMatch(header, /\shidden=|col-span-2/)
  assert.match(header, /title=\{view.saveMessage/)
})

test('run controls swap in the same grid cell rather than reserving an empty extra row', () => {
  const slot = source('../options/components/RunActionSlot.tsx')
  const css = source('../options/options.css')
  assert.match(css, /\.options-run-action-slot > \* \{\s*grid-area: 1 \/ 1;/)
  assert.match(slot, /preventScroll: true/)
  for (const name of ['AiAnalysisActions', 'AvailabilityControls']) {
    assert.match(source(`../options/components/${name}.tsx`), /<RunActionSlot active=\{active\}/)
  }
})

test('selection and background notifications stay outside the result layout', () => {
  const dock = source('../options/components/SelectionDock.tsx')
  const css = source('../options/options.css')
  assert.match(dock, /createPortal\(/)
  assert.match(css, /\.options-selection-dock \{\s*position: fixed;/)
  assert.doesNotMatch(css, /padding-bottom:\s*min\(40dvh,\s*296px\)/)
  for (const name of ['AiAnalysisSelectionActions', 'AvailabilitySelectionActions', 'RecycleControls', 'RedirectControls', 'DuplicateGroups']) {
    assert.match(source(`../options/components/${name}.tsx`), /<SelectionDock/)
  }
  assert.match(source('../popup/components/PopupAutoAnalyzeStatus.tsx'), /popup-feedback-layer absolute/)
  assert.match(source('../popup/components/PopupChromeHost.tsx'), /popup-feedback-layer absolute/)
})

test('compact selection actions retain safety and secondary operations', () => {
  const availability = source('../options/components/AvailabilitySelectionActions.tsx')
  for (const action of ['promote-selection', 'demote-selection', 'ignore-bookmarks', 'ignore-domains', 'ignore-folders', 'delete-selected', 'retest-selection', 'move-selection']) {
    assert.ok(availability.includes(action), `Missing ${action}`)
  }
  assert.match(availability, /OptionActionsMenu/)
  const duplicates = source('../options/components/DuplicateGroups.tsx')
  assert.match(duplicates, /disabled=\{locked \|\| unsafe\}/)
  assert.match(duplicates, /isNewtabSource \? \(\s*<StatusMessage/)
  assert.match(duplicates, /清理此副本也会移除新标签页入口/)
})

test('quiet states reuse existing copy and preserve the shared corner inset', () => {
  const snapshot = source('../options/components/ContentSnapshotControls.tsx')
  assert.equal((snapshot.match(/<StatusMessage/g) || []).length, 1)
  assert.match(snapshot, /description=\{<StatusMessage/)
  assert.match(source('../options/options.css'), /padding: calc\(var\(--ds-inset-card\) - var\(--ds-stroke-width\)\)/)
  const controller = source('../options/options-controller.ts')
  assert.match(controller, /statusTone: statusTone === 'success' && !hasAssignedShortcut \? 'muted' : statusTone/)
})
