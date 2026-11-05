import { createRoot } from 'react-dom/client'
import { observeMotionPreferences } from '../shared/motion-preferences'
import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store'
import { FeatureSettingsControls } from '../options/components/FeatureSettingsControls'
import { FEATURE_SWITCH_CONTENT } from '../options/components/feature-settings-types'
import { ContentSnapshotControls } from '../options/components/ContentSnapshotControls'
import { InputCaretSettings } from '../options/components/InputCaretSettings'
import { ShortcutControls } from '../options/components/ShortcutControls'
import { AiAnalysisPanel } from '../options/components/AiAnalysisPanel'
import { AvailabilityPanel } from '../options/components/AvailabilityPanel'
import { DuplicateGroups } from '../options/components/DuplicateGroups'
import { RecycleControls } from '../options/components/RecycleControls'
import { RecycleBin } from '../options/components/RecycleBin'
import { RedirectControls } from '../options/components/RedirectControls'
import { RedirectResults } from '../options/components/RedirectResults'
import { BackupControls } from '../options/components/BackupControls'
import { PopupApp } from '../popup/PopupApp'
import { registerPopupActionHandlers } from '../popup/popup-controller-store'
import { SettingsDrawerHost } from '../newtab/components/SettingsDrawer'
import { SurfaceMaterialProvider } from './base/SurfaceMaterial'
import { NewtabFloatingSurface } from '../newtab/components/NewtabGlassSurface'
import { BookmarkMenusHost } from '../newtab/components/BookmarkMenusHost'
import { registerNewtabSettingsDrawerActions } from '../newtab/newtab-settings-drawer-store'
import { Button } from './base/Button'
import { StableLabel, StatusMessage } from './base/StatusMessage'

// These are the real components and view stores. Only external I/O is replaced.
addEventListener('pagehide', observeMotionPreferences(), { once: true })
const surface = new URLSearchParams(location.search).get('surface') || 'general'
const scope = surface.startsWith('newtab') ? 'newtab' : surface.startsWith('popup') || surface === 'sidepanel' ? 'popup' : 'options'
document.documentElement.dataset.curatorSurface = surface === 'sidepanel' ? 'sidepanel' : scope
document.documentElement.dataset.fixtureSurface = surface
if (surface === 'sidepanel') document.documentElement.classList.add('side-panel')

const state = createUiViewStoreSlice('options', 'stability-fixture', { phase: 'idle' })
const store = (key: string, area: 'options' | 'popup' | 'newtab' = 'options') =>
  createUiViewStoreSlice<any>(area, key, {})
const copy = (key: string, area: 'options' | 'popup' | 'newtab' = 'options') =>
  structuredClone(store(key, area).getState())
const initialAi = copy('ai-analysis')
const initialAvailability = copy('availability-overview')
const initialControls = copy('availability-controls')
const initialBackup = copy('backup-controls')
const initialPopup = copy('root', 'popup')
const longError = '操作未完成，请检查站点权限后重试。已有书签和设置未被修改。'.repeat(8)
const noop = () => {}
const item = {
  id: 'reference', currentTitle: '排版与交互参考', suggestedTitle: '排版与交互设计参考',
  url: 'https://example.test/design', path: '书签栏 / 设计', tags: ['设计'],
  canMoveToSuggestedFolder: true, confidenceLabel: '高置信', confidenceScorePercent: 92,
  detailRows: [], errorMessage: '', expandedTags: false, interactionLocked: false,
  isSelected: false, moveLabel: '移动', openLabel: '打开排版与交互参考',
  pendingMove: false, selectable: true, selectionLabel: '选择排版与交互参考',
  statusLabel: '建议改名', badgeTone: 'success', suggestedFolder: '设计',
  applyLabel: '应用标题建议', rejectLabel: '保留原标题'
}
const recycled = Array.from({ length: 3 }, (_, i) => ({
  bookmarkId: `reference-${i}`, recycleId: `recycle-${i}`, parentId: 'design',
  deletedAt: Date.UTC(2026, 9, 30), index: i, path: '书签栏 / 设计',
  source: 'manual', title: `设计参考 ${i + 1}`, url: `https://example.test/design/${i}`
}))
const shortcuts = [
  ['save-to-inbox', '直接收藏到 Inbox', '保存当前网页到 Inbox / 待整理，并在后台分析归类。', ''],
  ['open-side-panel', '打开侧栏搜索', '打开侧栏页面并聚焦搜索框。', 'Alt+Shift+S'],
  ['open-smart-classifier', '直接智能分类当前页', '打开弹窗立即分析当前页面并给出保存建议。', 'Alt+Shift+F'],
  ['toggle-auto-analyze', '切换自动分析', '通过快捷键开启或关闭新增书签自动分析。', '']
].map(([name, title, detail, shortcut]) => ({ name, title, detail, shortcut }))

function phase(name: string) {
  state.setState({ phase: name })
  const busy = name === 'saving' || name === 'running'
  const active = busy || name === 'paused'
  const error = name === 'error' || name === 'long-error'
  const message = name === 'long-error' ? longError : error ? '操作未完成，请重试。' : ''
  const selected = name === 'selected' || name === 'all-selected'
  if (surface === 'general') {
    store('feature-settings-controls').setState({
      loading: name === 'loading',
      switches: FEATURE_SWITCH_CONTENT.map(entry => ({
        ...entry, checked: !error, disabled: busy,
        status: error ? '待授权' : '',
        statusTone: error ? 'warning' : 'muted'
      })),
      inboxWorkflow: { value: 'move', disabled: busy, status: message }
    })
    store('content-snapshot-controls').setState({
      loading: name === 'loading', enabled: true, fullTextDisabled: busy,
      saveFullText: true, statusCopy: message || '已保存 21 条索引，17 条全文。'
    })
    store('shortcut-controls').setState({
      loading: name === 'loading', detail: message,
      statusLabel: busy ? '读取中…' : error ? '读取失败' : '已同步',
      statusTone: error ? 'warning' : 'success',
      list: name === 'loading' ? { kind: 'loading' } : { kind: 'commands', commands: shortcuts }
    })
  }
  if (surface === 'ai') {
    store('ai-config-link').setState({ configured: true })
    const view = structuredClone(initialAi)
    view.actions = { ...view.actions,
       actionDisabled: active, actionLabel: name === 'success' ? '重新分析并生成建议' : '开始分析并生成建议',
      pauseHidden: !active, pauseDisabled: false, pauseLabel: name === 'paused' ? '继续生成' : '暂停生成',
      stopHidden: !active, stopDisabled: false
    }
    view.status = { badgeText: error ? '分析失败' : active ? '正在分析' : '已就绪', badgeTone: error ? 'danger' : 'muted', statusCopy: message || '当前范围有 3 条书签可供分析。' }
    view.resultsHeader = { visible: true, resultCount: '1 条结果', subtitle: '' }
    view.results = { emptyMessage: '', results: [{ ...item, isSelected: selected }] }
    view.selectionActions = { ...view.selectionActions, hidden: !selected, clearDisabled: false, applyDisabled: false, countLabel: selected ? '1 条已选择' : '0 条已选择' }
    store('ai-analysis').setState(view)
  }
  if (surface === 'availability') {
    const preparing = name === 'loading' || name === 'pending'
    store('availability-controls').setState({ ...initialControls,
      actionDisabled: active || preparing, actionBusy: busy || preparing,
      actionLabel: name === 'loading' ? '正在准备检测…' : name === 'pending' ? '正在请求站点授权…' : name === 'success' ? '重新检测全部书签' : '开始检测全部书签',
      badgeText: name === 'loading' ? '读取中' : name === 'pending' ? '待授权' : error ? '未授权' : '多层校验', badgeTone: error ? 'warning' : 'muted',
      permissionCopy: message || (name === 'loading' ? '正在读取书签和站点权限。' : name === 'pending' ? '等待确认站点授权。' : initialControls.permissionCopy),
      pauseHidden: !active, pauseDisabled: false, pauseLabel: name === 'paused' ? '继续检测' : '暂停检测',
      stopHidden: !active, stopDisabled: false, settingsDisabled: false
    })
    const view = structuredClone(initialAvailability)
    view.resultsHeader = { ...view.resultsHeader, visible: true, reviewVisible: true, failedVisible: false, reviewCount: '1 条待确认', failedCount: '0 条无法访问', failedLastRun: '上次检测已完成' }
    view.selectionActions = { ...view.selectionActions, hidden: !selected, clearDisabled: false, countLabel: '1 条已选择',
      deleteDisabled: false, ignoreBookmarkDisabled: false, ignoreDomainDisabled: false,
      ignoreFolderDisabled: false, moveDisabled: false, retestDisabled: false
    }
    store('availability-overview').setState(view)
    store('availability-results').setState({
      review: { emptyMessage: '', results: [{
        badgeText: '待确认', bookmarkId: 'reference', evidenceCopy: '站点响应超时',
        finalUrl: '', metadataItems: [], openLabel: '打开排版与交互参考', path: item.path, quickActions: [],
        summary: '请求超时，尚不能确定书签是否失效。',
        retestDisabled: false, retestLabel: '重新检测', deleteDisabled: false, selectable: true, selected, selectionDisabled: false,
        selectionLabel: item.selectionLabel, showFinalUrl: false, statusLabel: '待确认', title: item.currentTitle,
        tone: 'warning', url: item.url
      }] },
      failed: { emptyMessage: '没有无法访问的书签。', results: [] }
    })
  }
  if (surface === 'duplicates') {
    const selectedIds = new Set(selected ? name === 'all-selected' ? ['original', 'copy'] : ['copy'] : [])
    store('duplicate-groups').setState({
      catalogLoading: false, currentScopeFolderId: '', locked: false, selectedIds, tagBadgeLabels: {},
      selectionStats: { deleteCount: selectedIds.size, groupCount: selected ? 1 : 0, keepCount: 2 - selectedIds.size, unsafeGroupCount: name === 'all-selected' ? 1 : 0 },
      groups: [{
        id: 'design-reference', displayUrl: 'example.test/design', folders: ['设计'],
        fullerTitleItemId: 'original', hasTitleVariants: false, isCrossFolder: false,
        latestItemId: 'copy', newTabSourceItemId: 'copy', oldestItemId: 'original', recentItemId: '',
        recommendedKeepId: 'original', recommendation: { kind: 'oldest', reason: '保留最早收藏' },
        risk: 'low', shorterPathItemId: 'original', taggedItemId: '',
        items: ['original', 'copy'].map((id, i) => ({ id, parentId: 'design', dateAdded: i + 1, title: '排版与交互参考', path: '书签栏 / 设计', url: item.url }))
      }]
    })
  }
  if (surface === 'recycle') {
    store('recycle-controls').setState({ busy: false, entryCount: 3, locked: false, selectedCount: selected ? 1 : 0 })
    store('recycle-bin').setState({ disabled: false, entries: recycled, selectedIds: new Set(selected ? ['recycle-0'] : []) })
  }
  if (surface === 'redirects') {
    store('redirect-controls').setState({ count: 3, locked: false, selectedCount: selected ? 1 : 0, subtitle: '3 条书签可以更新为最终地址。' })
    store('redirect-results').setState({ emptyMessage: '', locked: false,
      results: recycled.map(entry => ({ id: entry.bookmarkId, title: entry.title, path: entry.path, url: entry.url, finalUrl: entry.url + '/updated' })),
      selectedIds: new Set(selected ? ['reference-0'] : [])
    })
  }
  if (surface === 'backup') {
    const view = structuredClone(initialBackup)
    view.tagData = { ...view.tagData, hasRecords: true, countLabel: '21 条记录', status: message, busy }
    view.backup = { ...view.backup, hasBackup: false, status: message, busy }
    store('backup-controls').setState(view)
  }
  if (scope === 'popup') {
    const view = structuredClone(initialPopup)
    view.content.state = { ...view.content.state, loading: false, rows: [] }
    view.chrome.loadError = error && surface !== 'popup-dialog' ? message : ''
    view.autoAnalyzeStatus = {
      status: name === 'idle' || error ? null : name === 'success' ? 'completed' : 'processing',
      collapsed: name === 'collapsed', detail: '正在分析刚收藏的参考页面', title: '自动分析',
      showHistory: name === 'success'
    }
    if (surface === 'popup-dialog') {
      view.modals = { ...view.modals, open: true, active: 'smart-folder',
        smartFolder: { ...view.modals.smartFolder, open: true, title: '排版与交互参考',
          urlLabel: item.url, selectedPath: '书签栏 / 设计', error: error ? message : '',
         saving: busy, saveDisabled: busy, saveLabel: '保存书签' }
      }
    }
    store('root', 'popup').setState(view)
  }
  if (surface === 'newtab-settings') {
    store('settings-drawer', 'newtab').setState({
      open: true, activeGroup: 'appearance', saveState: error ? 'error' : busy ? 'saving' : name === 'success' ? 'saved' : 'idle',
      saveMessage: message
    })
    store('background-settings', 'newtab').setState(current => ({
      ...current, ready: true, type: 'color', backgroundStatus: message,
      backgroundStatusTone: error ? 'error' : 'info'
    }))
  }
  if (surface === 'newtab-menu' || surface === 'newtab-add') {
    const menu = {
      actions: [{ id: 'save', actionId: 'save', label: '保存书签', ariaLabel: '保存书签', icon: 'save', disabled: busy, onSelect: () => phase('error') }],
      fields: [
        { id: 'stability-title', label: '名称', type: 'text', value: '排版与交互参考' },
        { id: 'stability-url', label: '网址', type: 'url', value: item.url }
      ].map(field => ({ ...field, disabled: busy, placeholder: '', onChange: noop, onEnter: noop })),
      error: error ? message : '', status: name === 'success' ? '已保存' : '',
      iconMode: 'website', iconModeDisabled: false, onCustomIconFileSelect: noop,
      onCloseRequest: noop, onIconModeChange: noop, onExpand: noop, expanded: true,
      x: Math.min(120, innerWidth - 320), y: innerHeight - 340
    }
    store('bookmark-menus', 'newtab').setState({
      edit: surface === 'newtab-menu' ? { sessionId: 1, closing: false, focusFirst: false, focusAction: '', menu, onExitComplete: noop } : null,
      add: surface === 'newtab-add' ? { sessionId: 1, closing: false, focusFirst: false, menu, onExitComplete: noop } : null
    })
  }
}

;(window as any).__stability = {
  phase,
  dispatch(name: string, args: any[]) {
    const action = typeof args[0] === 'string' ? args[0] : args[0]?.action
    if (action === 'clear-selection') phase('idle')
    else if (action?.includes('select') || action?.includes('toggle-entry') || name === 'handleDuplicateSelectionChange') phase('selected')
    else if (action === 'pause-toggle') phase('paused')
    else if (action === 'stop') phase('idle')
    else phase('saving')
  }
}
registerPopupActionHandlers({
  autoAnalyzeStatus: ({ action }) => phase(action === 'dismiss' ? 'idle' : 'collapsed'),
  modal: () => phase('saving')
})
registerNewtabSettingsDrawerActions({
  onActiveGroupChange: group => store('settings-drawer', 'newtab').setState(current => ({ ...current, activeGroup: group })),
  onFeaturedPickerClick: noop, onOpenChange: noop, onReady: noop, onToggleRequest: noop
})
phase('idle')

function Fixture() {
  const { phase: current } = useUiViewStoreSlice(state)
  if (scope === 'popup') return <PopupApp />
  if (surface === 'newtab-settings') return <SurfaceMaterialProvider component={NewtabFloatingSurface}><SettingsDrawerHost /></SurfaceMaterialProvider>
  if (surface === 'newtab-menu' || surface === 'newtab-add') return <SurfaceMaterialProvider component={NewtabFloatingSurface}><BookmarkMenusHost /></SurfaceMaterialProvider>
  return (
    <main id="options-main" className="options-main-scroll" style={{ height: '100dvh', overflowY: 'auto', paddingInline: 24, paddingTop: 24 }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        {surface === 'general' ? <>
          <h1 className="text-xl mb-6">通用设置</h1>
          <div id="fixture-features"><FeatureSettingsControls /></div>
          <div id="fixture-appearance"><InputCaretSettings /></div>
          <div id="fixture-snapshot"><ContentSnapshotControls /></div>
          <div id="fixture-shortcuts"><ShortcutControls /></div>
        </> : null}
        {surface === 'ai' ? <AiAnalysisPanel hidden={false} /> : null}
        {surface === 'availability' ? <AvailabilityPanel hidden={false} /> : null}
        {surface === 'duplicates' ? <section id="duplicates"><h1 className="text-xl mb-6">重复书签检测</h1><DuplicateGroups /></section> : null}
        {surface === 'recycle' ? <section id="recycle"><h1 className="text-xl mb-6">回收站</h1><RecycleControls /><RecycleBin /></section> : null}
        {surface === 'redirects' ? <section id="redirects"><h1 className="text-xl mb-6">更新重定向</h1><RedirectControls /><RedirectResults /></section> : null}
        {surface === 'backup' ? <section id="backup"><h1 className="text-xl">数据与备份</h1><BackupControls /></section> : null}
        {surface === 'feedback' ? <section id="fixture-feedback" className="grid gap-3">
          <h1 className="text-xl">状态消息</h1>
          <StatusMessage id="fixture-status" className="text-sm leading-relaxed" tone={current === 'long-error' ? 'error' : 'neutral'}>
            {current === 'long-error' ? longError : current === 'success' ? '已保存' : ''}
          </StatusMessage>
         <Button id="fixture-stable-button"><StableLabel text="保存" reserve={['保存']} /></Button>
        </section> : null}
        <div id="fixture-tail" className="mt-6 text-sm text-ds-text-secondary">本地书签</div>
      </div>
    </main>
  )
}

createRoot(document.getElementById(scope === 'popup' ? 'popup-root' : 'root')!).render(<Fixture />)
