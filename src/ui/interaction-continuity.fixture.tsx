import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createUiViewStoreSlice } from '../shared/ui-view-store'
import { AiProviderSettings } from '../options/components/AiProviderSettings'
import { publishAiProviderSettings } from '../options/components/ai-provider-settings-store'
import type { AiProviderSettingsState } from '../options/components/ai-provider-settings-types'
import { OptionsModals } from '../options/components/OptionsModals'
import { publishOptionsModals } from '../options/components/options-modals-store'
import { getFolderPickerResultsSnapshot, publishFolderPickerResults } from '../options/components/folder-picker-results-store'
import { useOptionsFocusTargetRef } from '../options/components/options-focus-target-store'
import { OptionsApp } from '../options/OptionsApp'
import { Button } from './base/Button'
import { useListExit } from './motion/useListExit'
import { ThemeProvider } from './theme/ThemeProvider'

const surface = new URLSearchParams(location.search).get('surface') || 'models'
const base = createUiViewStoreSlice<AiProviderSettingsState>('options', 'ai-provider-settings', {} as AiProviderSettingsState).getState()
const modelIds = Array.from({ length: 40 }, (_, index) => `gpt-fixture-${String(index).padStart(2, '0')}`)
let provider: AiProviderSettingsState = {
  ...base, baseUrl: 'https://example.test/v1', apiKey: '', fieldsDisabled: false,
  hasRequiredConfig: true, modelToolsDisabled: false, testDisabled: false,
  showSaveSettingsButton: false, customModels: ['local-model'],
  modelCatalog: { ...base.modelCatalog, loaded: true },
  modelTools: {
    ...base.modelTools, manageDisabled: false, fetchDisabled: false,
    selector: { disabled: false, currentModel: modelIds[0], models: modelIds, fetchedModels: [], customModels: [], labs: {}, presetModels: modelIds }
  }
}
publishAiProviderSettings(provider)

const folders = Array.from({ length: 24 }, (_, index) => {
  const id = `folder-${index}`
  const title = `参考资料 ${String(index).padStart(2, '0')}`
  return {
    id, title, path: `书签栏 / ${title}`, folder: { id, title, path: `书签栏 / ${title}` },
    badges: [], depth: 0, disabled: false, expanded: false, hasChildren: false,
    rowCurrent: false, selected: false, toggleLabel: `展开 ${title}`
  }
})
const modals = createUiViewStoreSlice<any>('options', 'modals', {}).getState()
const showFolderResults = (kind: 'scope' | 'move', query = '') => publishFolderPickerResults(kind, {
  kind, query, activeId: '', treeOptions: folders.filter(folder => folder.title.includes(query)), emptyMessage: '没有匹配的文件夹。'
})
const probe = {
  updateModels(values: string[]) {
    provider = { ...provider, customModels: values }
    publishAiProviderSettings(provider)
  },
  updateCatalog(values: string[]) {
    provider = { ...provider, modelTools: { ...provider.modelTools, selector: { ...provider.modelTools.selector, models: values } } }
    publishAiProviderSettings(provider)
  },
  savedModels: [] as string[],
  dispatch(name: string, [detail]: any[]) {
    if (name === 'handleFolderPickerAction' && ['search-keydown', 'results-keydown'].includes(detail.action)) {
      const current = getFolderPickerResultsSnapshot(detail.kind)
      const index = current.treeOptions.findIndex(folder => folder.id === current.activeId)
      const next = detail.key === 'End' ? current.treeOptions.length - 1 : detail.key === 'Home' ? 0 :
        Math.max(0, Math.min(current.treeOptions.length - 1, index + (detail.key === 'ArrowUp' ? -1 : 1)))
      const id = current.treeOptions[next]?.id
      if (id) publishFolderPickerResults(detail.kind, { ...current, activeId: id, focusRequestId: id })
    }
    if (name === 'handleOptionsModalAction') {
      if (detail.action === 'search-change') {
        publishOptionsModals({ [detail.modal]: { ...modals[detail.modal], open: true, finalFocusId: `continuity-${detail.modal}`, query: detail.query } })
        showFolderResults(detail.modal, detail.query)
      } else {
        publishOptionsModals({ [detail.modal]: { ...modals[detail.modal], open: false } })
      }
    }
    if (name === 'handleAiProviderSettingsAction' && detail.action === 'custom-models-save') {
      probe.savedModels = detail.value
      probe.updateModels(detail.value)
    }
    if (name === 'handleAiProviderSettingsAction' && detail.action === 'model-change') {
      provider = { ...provider, modelTools: { ...provider.modelTools, selector: { ...provider.modelTools.selector, currentModel: detail.value } } }
      publishAiProviderSettings(provider)
    }
  },
  setRows: (_ids: string[]) => {}
}
;(window as any).__continuity = probe

function FolderFixture() {
  const scopeRef = useOptionsFocusTargetRef<HTMLButtonElement>('continuity-scope')
  const moveRef = useOptionsFocusTargetRef<HTMLButtonElement>('continuity-move')
  const open = (kind: 'scope' | 'move') => {
    showFolderResults(kind)
    publishOptionsModals({ [kind]: { ...modals[kind], open: true, query: '', finalFocusId: `continuity-${kind}` } })
  }
  return <>
    <Button id="open-scope" ref={scopeRef} onClick={() => open('scope')}>选择筛选文件夹</Button>
    <Button id="open-move" ref={moveRef} onClick={() => open('move')}>批量移动书签</Button>
    <OptionsModals />
  </>
}

const rowData = ['one', 'two', 'three', 'four'].map(id => ({ id, title: `书签 ${id}` }))
function ListFixture() {
  const [items, setItems] = useState(rowData)
  probe.setRows = ids => setItems(ids.map(id => rowData.find(row => row.id === id)!).filter(Boolean))
  const rows = useListExit(items, item => item.id)
  return <>
    <div style={{ display: 'flex', gap: 8 }}>
      <Button id="remove-middle" onClick={() => setItems(items => items.filter(item => item.id !== 'two'))}>移除第二行</Button>
      <Button id="restore-rows" onClick={() => setItems(rowData)}>恢复列表</Button>
    </div>
    <div id="continuity-list" style={{ marginTop: 16 }}>
      {rows.map(row => <div ref={row.ref} key={row.key} className="t-list-exit" data-exiting={row.exiting ? 'true' : 'false'} inert={row.exiting || undefined} data-list-key={row.key}>
        <div className="t-list-exit-inner"><div style={{ padding: 18, height: 80 }}>
          <label>{row.item.title}<input aria-label={row.item.title} defaultValue={row.item.title} /></label>
        </div></div>
      </div>)}
    </div>
  </>
}

function Fixture() {
  if (surface === 'navigation') return <OptionsApp />
  return <ThemeProvider>
    <main style={{ maxWidth: 1000, padding: 24, margin: '0 auto', height: '100dvh', overflow: 'auto' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 20px' }}>Curator</h1>
      {surface === 'models' ? <AiProviderSettings /> : surface === 'folders' ? <FolderFixture /> : <ListFixture />}
    </main>
  </ThemeProvider>
}

createRoot(document.getElementById('options-root')!).render(<Fixture />)
