import { useEffect, useRef, useState } from 'react'
import { AiSetupPrompt, Button, Icon, Input } from '../../ui'
import {
  dispatchPopupModalAction,
  POPUP_MODALS_CHANGE_EVENT,
  type PopupModalsChangeDetail,
  type PopupModalsView
} from '../popup-events'
import { PopupFolderPickerHost } from './PopupFolderPickerHost'

const EMPTY_MODALS: PopupModalsView = {
  active: null,
  aiProvider: { open: false },
  delete: {
    cancelDisabled: false,
    confirmDisabled: false,
    confirmLabel: '删除',
    open: false,
    path: '',
    title: ''
  },
  edit: {
    cancelDisabled: false,
    closeDisabled: false,
    dirty: false,
    folderPickerOpen: false,
    folderQuery: '',
    folderSearchDisabled: false,
    open: false,
    path: '',
    pathChanged: false,
    saveDisabled: true,
    saveLabel: '未修改',
    title: '',
    titleDisabled: false,
    url: '',
    urlDisabled: false
  },
  move: {
    open: false,
    path: '',
    query: '',
    title: ''
  },
  open: false,
  smartFolder: {
    open: false,
    query: '',
    title: '',
    urlLabel: ''
  }
}

export function PopupModalsHost() {
  const [state, setState] = useState<PopupModalsView>(EMPTY_MODALS)
  const previousActiveRef = useRef<PopupModalsView['active']>(null)
  const previousEditPickerOpenRef = useRef(false)

  useEffect(() => {
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<PopupModalsChangeDetail>).detail
      setState(detail?.state ?? EMPTY_MODALS)
    }

    window.addEventListener(POPUP_MODALS_CHANGE_EVENT, handleChange)
    return () => window.removeEventListener(POPUP_MODALS_CHANGE_EVENT, handleChange)
  }, [])

  useEffect(() => {
    if (state.active !== previousActiveRef.current) {
      previousActiveRef.current = state.active
      focusInitialModalControl(state.active)
    }

    if (state.edit.folderPickerOpen && !previousEditPickerOpenRef.current) {
      focusElement('edit-folder-search-input')
    }
    previousEditPickerOpenRef.current = state.edit.folderPickerOpen
  }, [state.active, state.edit.folderPickerOpen])

  return (
    <div
      className="popup-modal-stack"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          dispatchPopupModalAction('close')
        }
      }}
    >
      {state.move.open ? <MoveBookmarkModal view={state.move} /> : null}
      {state.smartFolder.open ? <SmartFolderModal view={state.smartFolder} /> : null}
      {state.aiProvider.open ? <AiProviderPromptModal /> : null}
      {state.edit.open ? <EditBookmarkModal view={state.edit} /> : null}
      {state.delete.open ? <DeleteBookmarkModal view={state.delete} /> : null}
    </div>
  )
}

function FolderSearch({
  htmlFor,
  inputId,
  placeholder,
  label,
  controls,
  value,
  action,
  disabled = false
}: {
  action: string
  controls: string
  disabled?: boolean
  htmlFor: string
  inputId: string
  label: string
  placeholder: string
  value: string
}) {
  return (
    <label className="cb-search modal-search" htmlFor={htmlFor}>
      <Icon name="Search" className="cb-search__icon" size={16} aria-hidden="true" />
      <Input
        id={inputId}
        className="cb-search__input"
        type="text"
        role="searchbox"
        spellCheck={false}
        autoComplete="off"
        placeholder={placeholder}
        aria-label={label}
        aria-controls={controls}
        value={value}
        disabled={disabled}
        onValueChange={(nextValue) => dispatchPopupModalAction(action, nextValue)}
        unstyled
      />
    </label>
  )
}

function MoveBookmarkModal({ view }: { view: PopupModalsView['move'] }) {
  return (
    <section id="move-modal" className="modal-card t-modal is-open" aria-labelledby="move-modal-title" tabIndex={-1}>
      <header className="modal-header">
        <div>
          <p className="modal-eyebrow">移动书签</p>
          <h2 id="move-modal-title">选择目标文件夹</h2>
        </div>
        <Button id="close-move-modal" className="icon-button ghost" type="button" aria-label="关闭移动面板" onClick={() => dispatchPopupModalAction('close')} unstyled>
          关闭
        </Button>
      </header>
      <div className="modal-bookmark-card">
        <p className="modal-card-label">当前书签</p>
        <p id="move-bookmark-title" className="modal-card-title">{view.title}</p>
        <p id="move-bookmark-path" className="modal-card-path">{view.path}</p>
      </div>
      <FolderSearch
        htmlFor="move-search-input"
        inputId="move-search-input"
        placeholder="搜索目标文件夹"
        label="搜索移动目标文件夹"
        controls="move-folder-list"
        value={view.query}
        action="move-query-change"
      />
      <PopupFolderPickerHost id="move-folder-list" className="modal-list" mode="move" />
    </section>
  )
}

function SmartFolderModal({ view }: { view: PopupModalsView['smartFolder'] }) {
  return (
    <section id="smart-folder-modal" className="modal-card t-modal is-open" aria-labelledby="smart-folder-modal-title" tabIndex={-1}>
      <header className="modal-header">
        <div>
          <p className="modal-eyebrow">当前网页</p>
          <h2 id="smart-folder-modal-title">选择保存文件夹</h2>
        </div>
        <Button id="close-smart-folder-modal" className="icon-button ghost" type="button" aria-label="关闭文件夹选择" onClick={() => dispatchPopupModalAction('close')} unstyled>
          关闭
        </Button>
      </header>
      <div className="modal-bookmark-card">
        <p className="modal-card-label">即将保存</p>
        <p id="smart-folder-page-title" className="modal-card-title">{view.title}</p>
        <p id="smart-folder-page-url" className="modal-card-path">{view.urlLabel}</p>
      </div>
      <FolderSearch
        htmlFor="smart-folder-search-input"
        inputId="smart-folder-search-input"
        placeholder="搜索目标文件夹"
        label="搜索保存目标文件夹"
        controls="smart-folder-list"
        value={view.query}
        action="smart-folder-query-change"
      />
      <PopupFolderPickerHost id="smart-folder-list" className="modal-list" mode="smart" />
    </section>
  )
}

function AiProviderPromptModal() {
  return (
    <section id="ai-provider-prompt-modal" className="modal-card t-modal small is-open" aria-labelledby="ai-provider-prompt-title" tabIndex={-1}>
      <header className="modal-header compact">
        <div>
          <p className="modal-eyebrow">AI 搜索</p>
          <h2 id="ai-provider-prompt-title">请配置 AI 渠道</h2>
        </div>
        <Button id="close-ai-provider-prompt" className="icon-button ghost" type="button" aria-label="关闭 AI 渠道配置提示" onClick={() => dispatchPopupModalAction('close')} unstyled>
          关闭
        </Button>
      </header>
      <AiSetupPrompt
        className="modal-ai-setup-prompt"
        description="普通搜索已包含本地规则。语义搜索需要先配置 AI 渠道。"
        descriptionClassName="modal-note"
        titleClassName="sr-only"
        title="AI 渠道配置提示"
      />
      <footer className="modal-actions">
        <Button id="cancel-ai-provider-prompt" className="secondary-button" type="button" onClick={() => dispatchPopupModalAction('close')} unstyled>暂不配置</Button>
        <Button id="open-ai-provider-settings" className="secondary-button primary-button" type="button" onClick={() => dispatchPopupModalAction('open-ai-settings')} unstyled>配置 AI 渠道</Button>
      </footer>
    </section>
  )
}

function EditBookmarkModal({ view }: { view: PopupModalsView['edit'] }) {
  return (
    <section id="edit-modal" className="modal-card t-modal is-open" aria-labelledby="edit-modal-title" tabIndex={-1}>
      <header className="modal-header">
        <div>
          <p className="modal-eyebrow">编辑书签</p>
          <h2 id="edit-modal-title">修改标题与网址</h2>
        </div>
        <Button id="close-edit-modal" className="icon-button ghost" type="button" aria-label="关闭编辑面板" disabled={view.closeDisabled} onClick={() => dispatchPopupModalAction('close')} unstyled>
          关闭
        </Button>
      </header>
      <div className="modal-bookmark-card">
        <p className="modal-card-label">来源路径</p>
        <div className="modal-path-row">
          <p id="edit-bookmark-path" className={['modal-card-path', view.pathChanged ? 'changed' : ''].filter(Boolean).join(' ')}>
            {view.path}
          </p>
          <Button
            id="edit-folder-picker-button"
            className="secondary-button compact"
            type="button"
            aria-expanded={view.folderPickerOpen}
            aria-controls="edit-folder-picker"
            disabled={view.closeDisabled}
            onClick={() => dispatchPopupModalAction('edit-toggle-folder-picker')}
            unstyled
          >
            {view.folderPickerOpen ? '收起' : '更改'}
          </Button>
        </div>
      </div>
      <section id="edit-folder-picker" className={['edit-folder-picker', view.folderPickerOpen ? '' : 'hidden'].filter(Boolean).join(' ')} aria-label="选择新的来源路径">
        <FolderSearch
          htmlFor="edit-folder-search-input"
          inputId="edit-folder-search-input"
          placeholder="搜索目标文件夹"
          label="搜索编辑目标文件夹"
          controls="edit-folder-list"
          value={view.folderQuery}
          action="edit-folder-query-change"
          disabled={view.folderSearchDisabled}
        />
        <PopupFolderPickerHost id="edit-folder-list" className="modal-list compact" mode="edit" />
      </section>
      <div className="modal-form">
        <label className="modal-field" htmlFor="edit-title-input">
          <span className="modal-label">标题</span>
          <Input
            id="edit-title-input"
            className="modal-input"
            type="text"
            spellCheck={false}
            maxLength={512}
            value={view.title}
            disabled={view.titleDisabled}
            onValueChange={(nextValue) => dispatchPopupModalAction('edit-title-change', nextValue)}
            onKeyDown={handleEditInputKeydown}
            unstyled
          />
        </label>
        <label className="modal-field" htmlFor="edit-url-input">
          <span className="modal-label">网址</span>
          <Input
            id="edit-url-input"
            className="modal-input"
            type="url"
            spellCheck={false}
            inputMode="url"
            value={view.url}
            disabled={view.urlDisabled}
            onValueChange={(nextValue) => dispatchPopupModalAction('edit-url-change', nextValue)}
            onKeyDown={handleEditInputKeydown}
            unstyled
          />
        </label>
      </div>
      <footer className="modal-actions">
        <Button id="cancel-edit" className="secondary-button" type="button" disabled={view.cancelDisabled} onClick={() => dispatchPopupModalAction('close')} unstyled>取消</Button>
        <Button id="save-edit" className="secondary-button primary-button" type="button" disabled={view.saveDisabled} onClick={() => dispatchPopupModalAction('save-edit')} unstyled>{view.saveLabel}</Button>
      </footer>
    </section>
  )
}

function DeleteBookmarkModal({ view }: { view: PopupModalsView['delete'] }) {
  return (
    <section id="delete-modal" className="modal-card t-modal small is-open" aria-labelledby="delete-modal-title" tabIndex={-1}>
      <header className="modal-header compact">
        <div>
          <p className="modal-eyebrow danger">删除确认</p>
          <h2 id="delete-modal-title">确认删除该书签？</h2>
        </div>
      </header>
      <div className="modal-bookmark-card">
        <p className="modal-card-label">即将删除</p>
        <p id="delete-bookmark-title" className="modal-card-title">{view.title}</p>
        <p id="delete-bookmark-path" className="modal-card-path">{view.path}</p>
      </div>
      <footer className="modal-actions">
        <Button id="cancel-delete" className="secondary-button" type="button" disabled={view.cancelDisabled} onClick={() => dispatchPopupModalAction('close')} unstyled>取消</Button>
        <Button id="confirm-delete" className="danger-button" type="button" disabled={view.confirmDisabled} onClick={() => dispatchPopupModalAction('confirm-delete')} unstyled>{view.confirmLabel}</Button>
      </footer>
    </section>
  )
}

function handleEditInputKeydown(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') {
    event.preventDefault()
    dispatchPopupModalAction('save-edit')
  }
}

function focusInitialModalControl(active: PopupModalsView['active']) {
  if (active === 'move') {
    focusElement('move-search-input')
    return
  }
  if (active === 'smart-folder') {
    focusElement('smart-folder-search-input')
    return
  }
  if (active === 'ai-provider') {
    focusElement('open-ai-provider-settings')
    return
  }
  if (active === 'edit') {
    focusElement('edit-title-input', true)
    return
  }
  if (active === 'delete') {
    focusElement('cancel-delete')
  }
}

function focusElement(id: string, select = false) {
  window.requestAnimationFrame(() => {
    const element = document.getElementById(id)
    if (!(element instanceof HTMLElement)) {
      return
    }
    element.focus()
    if (select && 'select' in element && typeof element.select === 'function') {
      element.select()
    }
  })
}
