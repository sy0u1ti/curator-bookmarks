import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { actionFeedback, IDLE_ACTION_FEEDBACK } from '../../shared/action-feedback'
import { Button } from '../base/Button'
import { StatusButton } from './StatusButton'
import { HoldConfirmButton } from './HoldConfirmButton'
import { RevealInput } from './RevealInput'
import { COPY_ACTION_LABELS } from './ActionFeedback'
import { AiProviderSettings } from '../../options/components/AiProviderSettings'
import { publishAiProviderSettings } from '../../options/components/ai-provider-settings-store'
import type { AiProviderSettingsState } from '../../options/components/ai-provider-settings-types'
import { BackupControls } from '../../options/components/BackupControls'
import { publishBackupControls } from '../../options/components/backup-controls-store'
import type { BackupControlsState } from '../../options/components/backup-controls-types'
import { OptionsModals } from '../../options/components/OptionsModals'
import { publishOptionsModals } from '../../options/components/options-modals-store'
import { PopupContent } from '../../popup/components/PopupContent'
import type { PopupActionMenuViewModel } from '../../popup/components/PopupViewModels'
import { SidePanelBookmarkActions } from '../../sidepanel/SidePanelBookmarkActions'
import { BookmarkMenusHost } from '../../newtab/components/BookmarkMenusHost'
import { dispatchNewtabBookmarkEditMenuView } from '../../newtab/newtab-bookmark-menu-store'
import type { BookmarkMenuActionViewModel } from '../../newtab/bookmark-menu-view-models'
import { fixtureActions } from './action-feedback.fixture-controller'

const probe = {
  calls: 0, confirmed: 0, errors: [] as string[],
  complete: (_success = true) => {},
  disableHold: (_disabled: boolean) => {},
  unmountHold: () => {},
  resetHold: () => {}
}
;(window as any).__actionFixture = probe
window.addEventListener('error', event => probe.errors.push(event.message))
window.addEventListener('unhandledrejection', event => probe.errors.push(String(event.reason)))
const surface = new URLSearchParams(location.search).get('surface') || 'controls'
document.documentElement.dataset.curatorSurface = surface === 'sidepanel' ? 'sidepanel' : surface

function Controls() {
  const [feedback, setFeedback] = useState(IDLE_ACTION_FEEDBACK)
  const [keyValue, setKeyValue] = useState('sk-fixture-not-a-real-key')
  const [revealed, setRevealed] = useState(false)
  const [holdDisabled, setHoldDisabled] = useState(false)
  const [holdMounted, setHoldMounted] = useState(true)
  const [holdKey, setHoldKey] = useState(0)
  probe.disableHold = setHoldDisabled
  probe.unmountHold = () => setHoldMounted(false)
  probe.resetHold = () => { setHoldKey(value => value + 1); setHoldMounted(true); setHoldDisabled(false) }
  const run = () => {
    if (feedback.status === 'pending') return
    probe.calls++
    setFeedback(actionFeedback('pending'))
    probe.complete = success => setFeedback(actionFeedback(success ? 'success' : 'error'))
  }
  return (
    <main style={{ maxWidth: 780, margin: '32px auto', padding: 20, display: 'grid', gap: 24 }}>
      <h1 style={{ fontSize: 22 }}>Curator / Interaction checks</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <StatusButton id="status-button" variant="primary" feedback={feedback} icon="RefreshCw"
          labels={{ idle: '测试连接', pending: '测试中', success: '连接成功', error: '连接失败' }} onClick={run} />
        <StatusButton id="copy-button" feedback={feedback} icon="Copy" labels={COPY_ACTION_LABELS} iconOnly onClick={run} />
        <Button id="outside-button">Outside</Button>
      </div>
      <label htmlFor="fixture-key">API Key</label>
      <RevealInput id="fixture-key" value={keyValue} onValueChange={setKeyValue} revealed={revealed} onRevealChange={setRevealed} />
      <div>
        {holdMounted ? <HoldConfirmButton key={holdKey} id="hold-button" variant="danger" label="清空回收站"
          disabled={holdDisabled} onConfirm={() => { probe.confirmed++ }} /> : null}
      </div>
    </main>
  )
}

let ai: AiProviderSettingsState = {
  apiKey: 'sk-fixture-not-a-real-key', apiKeyPlaceholder: 'API Key', apiStyle: 'chat_completions',
  apiStyleOptions: [{ label: 'OpenAI Chat Completions', value: 'chat_completions' }],
  baseUrl: 'https://fixture.invalid', batchSize: '6', timeoutMs: '30000',
  configStatusText: '已配置', configTone: 'muted', connectivityBusy: false, connectivityCopy: '',
  connectivityTone: 'muted', connectivityVisible: false, customModels: [], fieldsDisabled: false,
  hasRequiredConfig: true, modelToolsDisabled: false, reasoningEffort: 'default',
  modelCatalog: { loaded: true, autoUpdate: false, checkedAt: 0, lastError: '', match: null },
  reasoningEffortNote: '', reasoningEffortOptions: [{ id: 'default', label: '默认', hint: '' }],
  reasoningEffortSupported: false, revealApiKey: false, saveDisabled: false, saveStatusText: '',
  showSaveSettingsButton: true, testButtonSecondary: true, testDisabled: false,
  testLabel: '测试连接', testingConnection: false, testFeedback: IDLE_ACTION_FEEDBACK,
  modelTools: {
    fetchDisabled: false, fetchLabel: '获取模型', fetchModelsStatus: '',
    fetchingModels: false, fetchFeedback: IDLE_ACTION_FEEDBACK, manageDisabled: false,
    selector: { currentModel: 'fixture-text-model', customModels: [], disabled: false,
      fetchedModels: ['fixture-text-model'], models: ['fixture-text-model'], presetModels: [] }
  }
}
let backup: BackupControlsState = {
  backup: { busy: false, exportFeedback: IDLE_ACTION_FEEDBACK, htmlExportFeedback: IDLE_ACTION_FEEDBACK, hasBackup: false, preview: null, status: '' },
  tagData: { busy: false, exportFeedback: IDLE_ACTION_FEEDBACK, hasRecords: true, countLabel: '3 条记录', status: '', updatedLabel: '隔离测试数据' }
}
let confirmationId = 0
function showConfirmation(open = true) {
  publishOptionsModals({ confirm: {
    requestId: ++confirmationId, holdToConfirm: true, open, cancelLabel: '取消',
    confirmLabel: '清空标签数据', title: '清空 3 条标签数据？', label: '清空标签',
    copy: '只会清空本地标签数据，不会删除 Chrome 书签。', tone: 'danger'
  } })
}
fixtureActions.modal = detail => {
  if (detail.action === 'confirm') probe.confirmed++
  showConfirmation(false)
}
fixtureActions.ai = detail => {
  if (detail.action === 'toggle-api-key') {
    ai = { ...ai, revealApiKey: Boolean(detail.value) }; publishAiProviderSettings(ai); return
  }
  if (detail.action === 'change') {
    ai = { ...ai, [detail.field]: detail.value }; publishAiProviderSettings(ai); return
  }
  const test = detail.action === 'test-connection'
  if ((!test && detail.action !== 'fetch-models') || ai.fieldsDisabled) return
  probe.calls++
  const update = (busy: boolean, success = true) => {
    const feedback = actionFeedback(busy ? 'pending' : success ? 'success' : 'error')
    ai = { ...ai, fieldsDisabled: busy, testDisabled: busy, modelToolsDisabled: busy,
      testingConnection: test && busy, testFeedback: test ? feedback : ai.testFeedback,
      connectivityVisible: test, connectivityBusy: busy,
      connectivityTone: success ? 'success' : 'danger', connectivityCopy: busy ? '正在验证连接。' : success ? '服务已响应。' : '测试服务暂时不可用。',
      modelTools: { ...ai.modelTools, fetchDisabled: busy, fetchingModels: !test && busy,
        fetchFeedback: test ? ai.modelTools.fetchFeedback : feedback,
        fetchModelsStatus: test ? '' : busy ? '正在获取模型列表。' : success ? '已获取 1 个模型。' : '获取失败：服务暂时不可用。' }
    }
    publishAiProviderSettings(ai)
  }
  update(true)
  probe.complete = success => update(false, success)
}
fixtureActions.backup = detail => {
  if (detail.action === 'clear-tags') { showConfirmation(); return }
  if (!['export-tags', 'export-backup', 'export-html'].includes(detail.action)) return
  probe.calls++
  const update = (busy: boolean, success = true) => {
    const feedback = actionFeedback(busy ? 'pending' : success ? 'success' : 'error')
    const status = busy ? '正在生成导出文件。' : success ? '文件已导出。' : '导出失败：存储暂时不可用。'
    backup = detail.action === 'export-tags'
      ? { ...backup, tagData: { ...backup.tagData, busy, status, exportFeedback: feedback } }
      : { ...backup, backup: { ...backup.backup, busy, status,
          [detail.action === 'export-html' ? 'htmlExportFeedback' : 'exportFeedback']: feedback } }
    publishBackupControls(backup)
  }
  update(true)
  probe.complete = success => update(false, success)
}
function Options() {
  return <main className="options-shell" style={{ maxWidth: 1040, margin: '24px auto', padding: 20 }}>
    <h1 style={{ fontSize: 22 }}>Curator</h1>
    <AiProviderSettings /><BackupControls /><OptionsModals />
  </main>
}

function Popup() {
  const [feedback, setFeedback] = useState(IDLE_ACTION_FEEDBACK)
  const listRef = useRef<HTMLUListElement>(null)
  const menu: PopupActionMenuViewModel = { items: ['edit', 'copy-url', 'open-current-tab', 'move', 'delete'].map(action => ({
    action, bookmarkId: 'fixture', ariaLabel: action === 'copy-url' ? '复制书签链接：设计参考' : action,
    label: action === 'copy-url' ? '复制链接' : action, danger: action === 'delete',
    disabled: action === 'copy-url' && feedback.status === 'pending',
    feedback: action === 'copy-url' ? feedback : undefined
  })) }
  const copy = (_id: string, action: string) => {
    if (action !== 'copy-url' || feedback.status === 'pending') return
    probe.calls++
    setFeedback(actionFeedback('pending'))
    probe.complete = success => setFeedback(actionFeedback(success ? 'success' : 'error'))
  }
  if (surface === 'sidepanel') return <div style={{ margin: 40, position: 'relative', height: 80 }}>
    <SidePanelBookmarkActions menu={menu} onMenuAction={copy} />
  </div>
  return <main id="popup-app-shell" style={{ width: 'min(720px, 100%)', height: 320, margin: '32px auto' }}>
    <PopupContent mainListRef={listRef} handlers={{ onMenuAction: copy }} state={{ mode: 'tree', rows: [{
      active: true, kind: 'bookmark', bookmarkId: 'fixture', depth: 0, index: 0, parentId: '1',
      title: '设计参考', displayUrl: 'fixture.invalid', url: 'https://fixture.invalid', menu, menuLabel: '书签操作'
    }] }} />
  </main>
}
let newtabFeedback = IDLE_ACTION_FEEDBACK
function publishNewtab(focusAction = '') {
  const actions: BookmarkMenuActionViewModel[] = [
    { actionId: 'copy-url', id: 'copy-url', ariaLabel: '复制书签链接：设计参考', label: '复制链接', icon: 'copy',
      disabled: newtabFeedback.status === 'pending', feedback: newtabFeedback, onSelect: () => {
        if (newtabFeedback.status === 'pending') return
        probe.calls++; newtabFeedback = actionFeedback('pending'); publishNewtab()
        probe.complete = success => { newtabFeedback = actionFeedback(success ? 'success' : 'error'); publishNewtab('copy-url') }
      } },
    { actionId: 'move', id: 'move', ariaLabel: '移动书签', label: '移动到', icon: 'move', disabled: false, onSelect: () => {},
      children: () => [{ id: 'folder', ariaLabel: '参考资料', label: '参考资料', icon: 'folder', disabled: false, onSelect: () => {} }] },
    { id: 'delete', ariaLabel: '删除书签', label: '删除链接', icon: 'trash', variant: 'danger', disabled: false, onSelect: () => {} }
  ]
  dispatchNewtabBookmarkEditMenuView({
    sessionId: 1, closing: false, focusAction, focusFirst: false, onExitComplete: () => {},
    menu: {
      actions, error: '', status: '', iconMode: 'website', iconModeDisabled: false,
      onCustomIconFileSelect: () => {}, onCloseRequest: () => dispatchNewtabBookmarkEditMenuView(null),
      onIconModeChange: () => {}, x: Math.max(12, innerWidth / 2 - 138), y: 80,
      fields: [
        { id: 'newtab-title', label: '标题', value: '设计参考', type: 'text', placeholder: '', disabled: false, onChange: () => {}, onEnter: () => {} },
        { id: 'newtab-url', label: '链接', value: 'https://fixture.invalid', type: 'url', placeholder: '', disabled: false, onChange: () => {}, onEnter: () => {} }
      ]
    }
  })
}
publishAiProviderSettings(ai)
publishBackupControls(backup)
if (surface === 'newtab') publishNewtab()
createRoot(document.getElementById('root')!).render(
  surface === 'options' ? <Options /> :
    surface === 'popup' || surface === 'sidepanel' ? <Popup /> :
      surface === 'newtab' ? <BookmarkMenusHost /> : <Controls />
)
