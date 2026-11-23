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

test('resting settings copy reserves its own measured height, not blank fixed lines', () => {
  assert.match(source('./base/status-message.css'), /\[data-reserve="true"\][\s\S]*block-size:\s*auto/)
  for (const name of ['ContentSnapshotControls', 'ShortcutControls', 'FeatureSettingsControls']) {
    assert.match(source(`../options/components/${name}.tsx`), /<StatusMessage[^>]*reserve=\{/)
  }
})

test('the shortcut card shares the settings card header, dividers and insets', () => {
  const card = source('../options/components/ShortcutControls.tsx')
  assert.match(card, /<AiProviderCard/)
  assert.match(card, /headerClassName=\{AI_SETTINGS_HEADER_CLASS\}/)
  assert.match(card, /AI_SETTINGS_BODY_CLASS/)
  assert.doesNotMatch(source('../options/components/ShortcutList.tsx'), /border-t/)
})

test('visible checkbox captions do not replace the row-specific accessible name', () => {
  // Base UI labels a wrapped control by its <label>, which outranks aria-label,
  // so a caption would be appended to every per-row name.
  for (const name of ['RecycleBin', 'RedirectResults', 'AiAnalysisResults']) {
    assert.match(source(`../options/components/${name}.tsx`), /unstyled\s*\/>\s*<span aria-hidden="true">/)
  }
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
  const popup = source('../popup/components/PopupActivityHost.tsx')
  assert.match(popup, /popup-activity-slot/)
  assert.match(popup, /usePopupAutoAnalyzeStatusView/)
  assert.match(source('../popup/popup.css'), /block-size: var\(--popup-activity-size\)/)
  assert.doesNotMatch(source('../popup/popup.css'), /popup-feedback-layer|padding-bottom: 80px/)
  assert.doesNotMatch(source('../popup/components/PopupChromeHost.tsx'), /id="error-banner"/)
})

test('compact selection actions retain safety and secondary operations', () => {
  const availability = source('../options/components/AvailabilitySelectionActions.tsx')
  for (const action of ['ignore-bookmarks', 'ignore-domains', 'ignore-folders', 'delete-selected', 'retest-selection', 'move-selection']) {
    assert.ok(availability.includes(action), `Missing ${action}`)
  }
  assert.match(availability, /OptionActionsMenu/)
  assert.doesNotMatch(availability, /promote-selection|demote-selection/)
  const row = source('../options/components/AvailabilityResults.tsx')
  assert.match(row, /result\.selectable[\s\S]*action: 'delete'/)
  assert.doesNotMatch(row, /promote-failed|demote-review/)
  const duplicates = source('../options/components/DuplicateGroups.tsx')
  assert.match(duplicates, /disabled=\{locked \|\| unsafe\}/)
  assert.match(duplicates, /isNewtabSource \? \(\s*<StatusMessage/)
  assert.match(duplicates, /删除此副本也会移除新标签页入口/)
})

test('quiet states reuse existing copy and preserve the shared corner inset', () => {
  const snapshot = source('../options/components/ContentSnapshotControls.tsx')
  assert.equal((snapshot.match(/<StatusMessage/g) || []).length, 1)
  assert.match(snapshot, /description=\{<StatusMessage/)
  assert.match(source('../options/options.css'), /padding: calc\(var\(--ds-inset-card\) - var\(--ds-stroke-width\)\)/)
  const controller = source('../options/options-controller.ts')
  assert.match(controller, /statusTone: statusTone === 'success' && !hasAssignedShortcut \? 'muted' : statusTone/)
})

test('resting copy owns the status slot, so no blank fixed-height line appears at rest', () => {
  const components = ['BackupControls', 'SyncCard', 'StorageManagement', 'AutoBackupPoints', 'AvailabilityControls', 'AiAnalysisProgressPanel', 'RecycleBin']
  for (const name of components) {
    const file = source(`../options/components/${name}.tsx`)
    for (const [tag] of file.matchAll(/<StatusMessage\b[^>]*>/g)) {
      assert.match(tag, /reserve=\{/, `${name}: a status slot beside resting copy must size from that copy`)
    }
  }
  assert.doesNotMatch(source('../options/components/DuplicateGroups.tsx'), /<StatusMessage className=\{RECOMMENDATION_TEXT_CLASS\}/)
})

test('a panel named by the URL hash is never scrolled past its own title', () => {
  assert.match(source('../options/options.css'), /\.options-main-scroll > section \{\s*scroll-margin-block-start: 100dvh;/)
})

test('ErrorState keeps error details bounded, scrollable by keyboard and announced cleanly', () => {
  const component = source('./base/ErrorState.tsx')
  const css = source('./base/error-state.css')
  assert.match(source('../styles/globals.css'), /@import "\.\.\/ui\/base\/error-state\.css";/)
  assert.match(css, /max-height:\s*5lh/)
  assert.match(css, /overflow:\s*auto/)
  assert.match(css, /overflow-wrap:\s*anywhere/)
  assert.match(component, /tabIndex=\{overflow \? 0 : undefined\}/)
  assert.match(component, /tone === 'error' \? 'alert' : 'status'/)
  assert.doesNotMatch(component, /line-clamp|\.slice\(/)
})

test('blocking error states render once without duplicate banners or dead footers', () => {
  const island = source('../popup/components/PopupSyncIsland.tsx')
  const workspace = source('../popup/components/PopupSyncWorkspace.tsx')
  assert.match(island, /onHeaderModeChange=\{setWorkspaceHeaderMode\}/)
  assert.match(island, /const quietHeader = !Workspace \|\| Boolean\(loadError\) \|\| workspaceHeaderMode === 'quiet'/)
  assert.match(workspace, /\{!blockingLoadFailure \? <footer className="popup-sync-footer">/)
  assert.match(workspace, /<ErrorState[\s\S]*logsError/)

  const popupController = source('../popup/popup-controller.ts')
  assert.match(popupController, /loadError: hasBlockingMainError\(\) \? '' :/)

  const settingsDrawer = source('../newtab/components/SettingsDrawer.tsx')
  assert.doesNotMatch(settingsDrawer, /<p[^>]*>保存失败，请重试/)
  assert.match(settingsDrawer, /glassError/)

  const undoToast = source('../options/components/OptionsUndoToast.tsx')
  assert.match(undoToast, /view\?\.tone === 'error'/)

  const newtabDeleteToast = source('../newtab/components/NewtabDeleteToastHost.tsx')
  assert.match(newtabDeleteToast, /toast\.tone === 'error' \? 'error' : 'success'/)
  assert.match(source('../newtab/newtab.css'), /\.newtab-delete-toast-panel\[data-type="error"\]/)
  assert.match(source('../newtab/glass-surface.css'), /\.newtab-glass\[data-glass-tone="panel"\]\[data-type="error"\]/)

  const backupControls = source('../options/components/BackupControls.tsx')
  assert.match(backupControls, /tone=\{backup\.preview \? 'neutral' : tone\}/)

  const providerCard = source('./ai/AiProviderCard.tsx')
  assert.match(providerCard, /min-w-0 flex-auto content-start self-stretch/)
})
