import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { getMotionDurationMs } from '../../shared/motion'
import { AiSetupPrompt } from '../../ui/ai/AiSetupPrompt'
import { Icon } from '../../ui/icons/Icon'
import { Button } from '../../ui/base/Button'
import { StableLabel, StatusMessage } from '../../ui/base/StatusMessage'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '../../ui/base/Collapsible'
import { Input } from '../../ui/base/Input'
import { cx } from '../../ui/base/utils'
import {
  dispatchPopupModalAction,
  usePopupModalsView,
  type PopupModalsView
} from '../popup-controller-store'
import { focusFolderPickerEdge } from '../popup-keyboard-navigation'
import { PopupFolderPickerHost } from './PopupFolderPickerHost'
import type { PopupFolderPickerState } from './PopupViewModels'

const folderSearchShellClass = [
  'flex min-h-10 w-full items-center gap-1.5 rounded-ds-sm border border-ds-border bg-ds-surface-2 py-0 pl-3 pr-1.5 text-ds-text-primary',
  'transition-[border-color,background-color] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover',
  'focus-within:border-ds-text-primary/45 focus-within:bg-ds-hover focus-within:shadow-[0_0_0_3px_var(--ds-accent-soft)]'
].join(' ')
const folderSearchIconClass =
  'pointer-events-none flex-none text-ds-text-muted transition-colors duration-ds-fast ease-ds-standard'
const folderSearchInputClass =
  'min-w-0 flex-auto self-stretch border-0 bg-transparent pl-1 pr-0.5 py-0 text-sm leading-[1.4] text-ds-text-primary outline-none placeholder:text-ds-text-muted [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:hidden [&::-webkit-search-decoration]:appearance-none'
const modalButtonBaseClass = [
  'inline-flex min-h-[34px] min-w-[88px] items-center justify-center gap-2 rounded-ds-sm border px-3 py-2 text-center text-xs font-semibold leading-none shadow-none',
  'transition-[border-color,background-color,color,scale] duration-ds-fast ease-ds-standard',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-2',
  'active:scale-[0.985]',
  'disabled:pointer-events-none disabled:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
].join(' ')
const modalSecondaryButtonClass = [
  modalButtonBaseClass,
  'border-transparent bg-ds-surface-3 text-ds-text-primary',
  'hover:bg-ds-active hover:text-ds-text-primary',
  'focus-visible:bg-ds-active focus-visible:text-ds-text-primary'
].join(' ')
const modalPrimaryButtonClass = [
  modalButtonBaseClass,
  'border-transparent bg-ds-accent text-ds-accent-contrast',
  'hover:bg-ds-accent-hover hover:text-ds-accent-contrast',
  'focus-visible:bg-ds-accent-hover focus-visible:text-ds-accent-contrast'
].join(' ')
const modalDangerButtonClass = [
  modalButtonBaseClass,
  'border-ds-danger/45 bg-ds-danger-soft text-ds-danger-text',
  'hover:border-ds-danger hover:bg-ds-danger/25 hover:text-ds-danger-text',
  'focus-visible:border-ds-danger focus-visible:bg-ds-danger/25 focus-visible:text-ds-danger-text'
].join(' ')
const modalCompactButtonClass =
  cx(modalSecondaryButtonClass, 'min-h-[30px] min-w-0 flex-none px-2.5 py-0 text-xs')
const modalCloseButtonClass = [
  'inline-flex size-8 shrink-0 items-center justify-center rounded-ds-sm border-0 bg-transparent p-0 text-ds-text-secondary shadow-none',
  'transition-[border-color,background-color,color,scale] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-2',
  'active:scale-[var(--ds-press-scale)]',
  'disabled:pointer-events-none disabled:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
].join(' ')
const modalFormClass = 'flex flex-col gap-3'
const modalFieldClass = 'flex flex-col gap-1.5'
const modalLabelClass = 'text-xs font-medium leading-tight text-ds-text-secondary'
const modalInputClass = [
  'min-h-[42px] w-full rounded-ds-sm border border-ds-border bg-ds-surface-2 px-[11px] text-[13px] leading-normal text-ds-text-primary outline-none',
  'transition-[border-color,background-color] duration-ds-fast ease-ds-standard',
  'placeholder:text-ds-text-muted',
  'hover:border-ds-border-hover focus:border-ds-focus focus:bg-ds-hover',
  'disabled:opacity-50 data-[disabled]:opacity-50'
].join(' ')
const modalHeaderClass = 'flex items-center justify-between gap-2.5'
const modalHeaderCompactClass = cx(modalHeaderClass, 'items-start')
const modalHeaderCopyClass = 'min-w-0'
const modalTitleClass =
  'm-0 mt-0.5 min-w-0 text-base font-semibold leading-[1.1] text-ds-text-primary'
const modalEyebrowClass =
  'm-0 text-xs font-medium leading-4 text-ds-text-secondary'
const modalBookmarkCardClass =
  'relative flex flex-col gap-2 rounded-ds-sm border-0 bg-ds-surface-2 px-3 py-3 shadow-none'
const modalCardLabelClass =
  'm-0 text-xs leading-[1.35] tracking-[0.01em] text-ds-text-muted'
const modalCardTitleClass =
  'm-0 min-w-0 break-words text-xs font-semibold leading-[1.35] text-ds-text-primary'
const modalCardPathClass =
  'm-0 min-w-0 [overflow-wrap:anywhere] text-xs leading-[1.35] tracking-[0.01em] text-ds-text-muted'
const modalCardPathChangedClass = 'text-ds-text-secondary'
const modalPathRowClass = 'flex items-center gap-2'
const modalAiSetupPromptClass = [
  'grid grid-cols-[auto_minmax(0,1fr)] items-start gap-[9px]',
  '[&_.ai-setup-prompt-copy]:grid [&_.ai-setup-prompt-copy]:gap-1',
  '[&_.ai-setup-prompt-icon]:inline-flex [&_.ai-setup-prompt-icon]:h-[26px] [&_.ai-setup-prompt-icon]:w-[26px] [&_.ai-setup-prompt-icon]:items-center [&_.ai-setup-prompt-icon]:justify-center',
  '[&_.ai-setup-prompt-icon]:rounded-ds-sm [&_.ai-setup-prompt-icon]:border [&_.ai-setup-prompt-icon]:border-white/10 [&_.ai-setup-prompt-icon]:bg-ds-text-primary/[0.04] [&_.ai-setup-prompt-icon]:text-ds-text-secondary'
].join(' ')
const modalNoteClass = 'm-0 text-[13px] leading-[1.55] text-ds-text-secondary'
const modalActionsClass = 'flex items-center justify-between gap-2.5'
const modalStackClass =
  'relative grid h-full max-h-full min-h-0 w-full min-w-0 place-items-center overflow-hidden p-4 outline-none'
const modalDismissLayerClass =
  'absolute inset-0 z-0 block cursor-default border-0 bg-transparent'
const modalCardShellClass = [
  'relative z-[1] flex min-h-0 flex-col gap-4 overflow-hidden rounded-ds-card border border-ds-border bg-ds-surface-1 ds-inset-card text-ds-text-primary shadow-none outline-none',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-2'
].join(' ')
const modalStandardCardClass = cx(
  modalCardShellClass,
  'w-[min(398px,calc(100cqw_-_28px),calc(100vw_-_28px))] max-w-[398px] max-h-[calc(100%_-_28px)]'
)
const modalSmallCardClass = cx(
  modalCardShellClass,
  'w-[min(398px,calc(100cqw_-_28px),calc(100vw_-_28px))] max-w-[360px] max-h-[calc(100%_-_28px)]'
)
const modalWideCardClass = cx(
  modalCardShellClass,
  'h-[min(548px,calc(100%_-_36px))] w-[min(620px,calc(100cqw_-_28px),calc(100vw_-_28px))] max-h-[calc(100%_-_36px)] max-w-[620px]'
)
const modalListClass = [
  'ds-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain rounded-ds-sm border-0 bg-ds-surface-2 p-[6px_5px]',
  '[scrollbar-gutter:stable]'
].join(' ')
const modalCompactListClass = cx(modalListClass, 'max-h-[170px]')
const editFolderPickerClass = 'edit-folder-picker flex min-h-0 flex-col gap-1.5'
const modalEditCardClass = cx(modalStandardCardClass, 'popup-edit-modal gap-3')
const modalEditFormClass = 'flex flex-col gap-2'
const modalEditInlineFieldClass = 'grid grid-cols-[36px_minmax(0,1fr)] items-center gap-2'
const modalEditCompactInputClass = cx(modalInputClass, 'h-[34px] min-h-[34px] px-2.5')
const modalEditFolderBarClass =
  'relative flex min-h-[40px] items-center gap-2 rounded-ds-sm border-0 bg-ds-surface-2 px-2.5 py-1.5 shadow-none'

export function PopupModalsHost() {
  const liveState = usePopupModalsView()
  const lastOpenStateRef = useRef(liveState)
  const state = liveState.open ? liveState : lastOpenStateRef.current
  const previousActiveRef = useRef<string | null>(null)
  const liveEditOpen = liveState.open && liveState.edit.open
  const [editSession, setEditSession] = useState(() => ({ open: liveEditOpen, key: 0 }))
  if (editSession.open !== liveEditOpen) {
    setEditSession({
      open: liveEditOpen,
      key: liveEditOpen ? editSession.key + 1 : editSession.key
    })
  }
  const moveSearchRef = useRef<HTMLInputElement | null>(null)
  const smartFolderTitleRef = useRef<HTMLInputElement | null>(null)
  const smartFolderSearchRef = useRef<HTMLInputElement | null>(null)
  const aiProviderSettingsRef = useRef<HTMLButtonElement | null>(null)
  const editTitleRef = useRef<HTMLInputElement | null>(null)
  const editFolderSearchRef = useRef<HTMLInputElement | null>(null)
  const folderTitleRef = useRef<HTMLInputElement | null>(null)
  const folderCancelRef = useRef<HTMLButtonElement | null>(null)

  useLayoutEffect(() => {
    if (liveState.open) {
      lastOpenStateRef.current = liveState
    }
  }, [liveState])

  useEffect(() => {
    if (!liveState.open) {
      previousActiveRef.current = null
      return
    }

    const activeKey = liveState.active === 'folder'
      ? `folder:${liveState.folder.mode || ''}`
      : liveState.active
    if (activeKey !== previousActiveRef.current) {
      previousActiveRef.current = activeKey
      focusInitialModalControl(liveState.active, liveState.folder.mode, {
        aiProviderSettingsRef,
        editTitleRef,
        folderCancelRef,
        folderTitleRef,
        moveSearchRef,
        smartFolderTitleRef
      })
    }

  }, [liveState.open, liveState.active, liveState.folder.mode])

  return (
    <div
      className={modalStackClass}
    >
      <Button
        className={modalDismissLayerClass}
        type="button"
        aria-label="关闭弹窗"
        disabled={
          (state.smartFolder.open && state.smartFolder.saving) ||
          (state.folder.open && state.folder.saving) ||
          (state.move.open && state.move.busy)
        }
        onClick={() => dispatchPopupModalAction('close')}
        unstyled
      />
      {state.move.open ? <MoveBookmarkModal searchRef={moveSearchRef} view={state.move} /> : null}
      {state.folder.open ? <FolderDialogModal cancelRef={folderCancelRef} titleRef={folderTitleRef} view={state.folder} /> : null}
      {state.smartFolder.open ? <SmartFolderModal titleRef={smartFolderTitleRef} searchRef={smartFolderSearchRef} view={state.smartFolder} /> : null}
      {state.aiProvider.open ? <AiProviderPromptModal settingsButtonRef={aiProviderSettingsRef} /> : null}
      {state.edit.open ? <EditBookmarkModal key={editSession.key} folderSearchRef={editFolderSearchRef} titleRef={editTitleRef} view={state.edit} /> : null}
    </div>
  )
}

function PopupModalFeedback({
  id = 'popup-modal-error',
  message = '',
  className = '',
  inline = false,
  overlay = false
}: {
  id?: string
  message?: string
  className?: string
  inline?: boolean
  overlay?: boolean
}) {
  const { error } = usePopupModalsView()
  const text = message || error
  if (!text) return null
  if (inline) {
    return (
      <StatusMessage
        id={id}
        tone="error"
        style={{ blockSize: 'auto', maxBlockSize: '34px' }}
        className={cx('m-0 min-w-0 text-xs leading-[1.4]', className)}
      >
        {text}
      </StatusMessage>
    )
  }
  if (overlay) {
    return (
      <div
        className={cx(
          'absolute inset-x-0 bottom-0 z-[2] rounded-b-ds-sm border-t border-ds-danger/35 bg-[color-mix(in_srgb,var(--ds-danger)_14%,var(--ds-surface-1))] px-3 py-2 shadow-[0_-6px_16px_rgba(0,0,0,0.35)]',
          className
        )}
      >
        <StatusMessage
          id={id}
          tone="error"
          style={{ blockSize: 'auto', maxBlockSize: 'calc(3 * 1lh)' }}
          className="m-0 shrink-0 text-xs leading-normal"
        >
          {text}
        </StatusMessage>
      </div>
    )
  }
  return (
    <StatusMessage
      id={id}
      tone="error"
      style={{ blockSize: 'auto', maxBlockSize: 'calc(3 * 1lh)' }}
      className={cx('m-0 shrink-0 text-xs leading-normal', className)}
    >
      {text}
    </StatusMessage>
  )
}

function FolderSearch({
  inputRef,
  className,
  htmlFor,
  inputId,
  placeholder,
  label,
  mode,
  controls,
  value,
  action,
  disabled = false
}: {
  action: string
  className?: string
  controls: string
  disabled?: boolean
  htmlFor: string
  inputId: string
  inputRef?: RefObject<HTMLInputElement | null>
  label: string
  mode: PopupFolderPickerState['mode']
  placeholder: string
  value: string
}) {
  return (
    <label className={cx(folderSearchShellClass, className)} htmlFor={htmlFor}>
      <Icon name="Search" className={folderSearchIconClass} size={16} aria-hidden="true" />
      <Input
        ref={inputRef}
        id={inputId}
        className={folderSearchInputClass}
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
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
            return
          }
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
            return
          }

          const list = document.getElementById(controls)
          // In a modal, ↑/↓ always enter the list from the nearest edge, so
          // the key does not depend on the current query contents.
          const edge = event.key === 'ArrowUp' ? 'last' : 'first'
          if (focusFolderPickerEdge(list, mode, edge)) {
            event.preventDefault()
          }
        }}
        unstyled
      />
    </label>
  )
}

function MoveBookmarkModal({
  searchRef,
  view
}: {
  searchRef: RefObject<HTMLInputElement | null>
  view: PopupModalsView['move']
}) {
  const { error } = usePopupModalsView()
  const createInputRef = useRef<HTMLInputElement | null>(null)
  const previousCreateOpenRef = useRef(view.createOpen)

  useEffect(() => {
    const wasOpen = previousCreateOpenRef.current
    previousCreateOpenRef.current = view.createOpen
    if (!wasOpen && view.createOpen) {
      const input = createInputRef.current
      if (input) {
        input.focus({ preventScroll: true })
        if (input.value) {
          input.select()
        }
      }
    } else if (wasOpen && !view.createOpen && view.open) {
      searchRef.current?.focus({ preventScroll: true })
    }
  }, [searchRef, view.createOpen, view.open])

  return (
    <section id="move-modal" className={modalWideCardClass} aria-labelledby="move-modal-title" tabIndex={-1}>
      <header className={modalHeaderClass}>
        <div className={modalHeaderCopyClass}>
          <h2 id="move-modal-title" className={modalTitleClass}>{view.heading || '移动书签'}</h2>
        </div>
        <Button id="close-move-modal" className={modalCloseButtonClass} type="button" aria-label="关闭移动面板" disabled={view.busy} onClick={() => dispatchPopupModalAction('close')} unstyled>
          <Icon name="X" size={16} aria-hidden="true" />
        </Button>
      </header>
      <div className={modalBookmarkCardClass}>
        <p className={modalCardLabelClass}>{view.cardLabel || '当前书签'}</p>
        <p id="move-bookmark-title" className={modalCardTitleClass}>{view.title}</p>
        <p id="move-bookmark-path" className={modalCardPathClass}>{view.path}</p>
      </div>
      {view.createOpen ? (
        <>
          <div id="move-inline-create" className="flex shrink-0 flex-col gap-2 rounded-ds-sm border border-ds-border bg-ds-surface-2 p-2.5">
            <div className="flex items-center gap-2">
              <Input
                ref={createInputRef}
                id="move-inline-create-input"
                className={cx(modalInputClass, 'min-h-[34px] min-w-0 flex-1 bg-ds-surface-1')}
                type="text"
                maxLength={180}
                spellCheck={false}
                autoComplete="off"
                placeholder="新文件夹名称"
                aria-label="新文件夹名称"
                value={view.createTitle}
                disabled={view.createSaving}
                onValueChange={(nextValue) => dispatchPopupModalAction('move-create-title-change', nextValue)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    if (!view.createSaveDisabled) {
                      dispatchPopupModalAction('move-create-submit')
                    }
                  }
                }}
                unstyled
              />
              <Button
                id="move-inline-create-submit"
                className={cx(modalPrimaryButtonClass, 'min-h-[34px] min-w-0 shrink-0 px-3')}
                type="button"
                disabled={view.createSaveDisabled}
                onClick={() => dispatchPopupModalAction('move-create-submit')}
                unstyled
              >
                <StableLabel
                  text={view.createSaving ? '移入中…' : '创建并移入'}
                  reserve={['创建并移入', '移入中…']}
                />
              </Button>
              <Button
                id="move-inline-create-cancel"
                className={modalCloseButtonClass}
                type="button"
                aria-label="取消新建文件夹"
                disabled={view.createSaving}
                onClick={() => dispatchPopupModalAction('move-create-close')}
                unstyled
              >
                <Icon name="X" size={15} aria-hidden="true" />
              </Button>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-ds-text-secondary">
              <Icon name="FolderOpen" size={13} className="shrink-0 text-ds-text-muted" aria-hidden="true" />
              <span id="move-inline-create-parent-path" className="min-w-0 truncate">{view.createParentPath}</span>
            </div>
            {view.createError ? (
              <PopupModalFeedback id="move-inline-create-error" message={view.createError} />
            ) : null}
          </div>
          <FolderSearch
            inputRef={searchRef}
            className="shrink-0"
            htmlFor="move-search-input"
            inputId="move-search-input"
            placeholder="搜索上级文件夹"
            label="搜索新建位置的上级文件夹"
            mode="move"
            controls="move-folder-list"
            value={view.query}
            action="move-query-change"
            disabled={view.busy}
          />
        </>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <FolderSearch
            inputRef={searchRef}
            className="min-w-0 flex-1"
            htmlFor="move-search-input"
            inputId="move-search-input"
            placeholder="搜索目标文件夹"
            label="搜索移动目标文件夹"
            mode="move"
            controls="move-folder-list"
            value={view.query}
            action="move-query-change"
            disabled={view.busy}
          />
          <Button
            id="move-inline-create-toggle"
            className={cx(modalSecondaryButtonClass, 'min-h-10 min-w-0 shrink-0 px-3')}
            type="button"
            title="新建文件夹并移入"
            disabled={view.busy}
            onClick={() => dispatchPopupModalAction('move-create-open')}
            unstyled
          >
            <Icon name="FolderPlus" size={14} aria-hidden="true" />
            <span>新建</span>
          </Button>
        </div>
      )}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <PopupFolderPickerHost id="move-folder-list" className={cx(modalListClass, error && 'pb-14')} mode="move" />
        <PopupModalFeedback overlay />
      </div>
    </section>
  )
}

function FolderDialogModal({
  cancelRef,
  titleRef,
  view
}: {
  cancelRef: RefObject<HTMLButtonElement | null>
  titleRef: RefObject<HTMLInputElement | null>
  view: PopupModalsView['folder']
}) {
  const parentSearchRef = useRef<HTMLInputElement | null>(null)
  const previousPickerOpenRef = useRef(view.parentPickerOpen)
  const isDelete = view.mode === 'delete'
  const isCreate = view.mode === 'create'
  const heading = isDelete ? '删除文件夹' : isCreate ? '新建文件夹' : '重命名文件夹'
  const deleteSummary = view.bookmarkCount > 0 && view.subfolderCount > 0
    ? `${view.subfolderCount} 个子文件夹 · ${view.bookmarkCount} 个书签 · 书签进回收站，可撤销`
    : view.bookmarkCount > 0
      ? `${view.bookmarkCount} 个书签 · 书签进回收站，可撤销`
      : view.subfolderCount > 0
        ? `${view.subfolderCount} 个空子文件夹 · 可撤销`
        : '空文件夹 · 可撤销'

  useEffect(() => {
    const wasOpen = previousPickerOpenRef.current
    previousPickerOpenRef.current = view.parentPickerOpen
    if (!isCreate || !view.open) return
    if (!wasOpen && view.parentPickerOpen) {
      parentSearchRef.current?.focus({ preventScroll: true })
    } else if (wasOpen && !view.parentPickerOpen) {
      titleRef.current?.focus({ preventScroll: true })
    }
  }, [isCreate, titleRef, view.open, view.parentPickerOpen])

  return (
    <section id="folder-modal" className={isCreate ? modalStandardCardClass : modalSmallCardClass} aria-labelledby="folder-modal-title" tabIndex={-1}>
      <header className={modalHeaderClass}>
        <div className={modalHeaderCopyClass}>
          <h2 id="folder-modal-title" className={modalTitleClass}>{heading}</h2>
        </div>
        <Button
          id="close-folder-modal"
          className={modalCloseButtonClass}
          type="button"
          aria-label={`关闭${heading}面板`}
          disabled={view.saving}
          onClick={() => dispatchPopupModalAction('close')}
          unstyled
        >
          <Icon name="X" size={16} aria-hidden="true" />
        </Button>
      </header>
      {isDelete ? (
        <>
          <div className={modalBookmarkCardClass}>
            <p className={modalCardLabelClass}>目标文件夹</p>
            <p id="delete-folder-title" className={modalCardTitleClass}>{view.targetTitle}</p>
            <p id="delete-folder-path" className={modalCardPathClass}>{view.targetPath}</p>
          </div>
          <p id="delete-folder-summary" className={modalNoteClass}>{deleteSummary}</p>
        </>
      ) : (
        <div className={cx(modalFormClass, 'min-h-0 flex-1')}>
          <div className={modalBookmarkCardClass}>
            <p className={modalCardLabelClass}>{isCreate ? '创建位置' : '当前位置'}</p>
            <div className={modalPathRowClass}>
              <p
                id="folder-modal-path"
                className={cx(
                  modalCardPathClass,
                  'flex-auto',
                  isCreate && view.parentChanged ? modalCardPathChangedClass : ''
                )}
              >
                {isCreate ? (view.parentPath || view.targetPath) : view.targetPath}
              </p>
              {isCreate ? (
                <Button
                  id="folder-parent-picker-button"
                  className={modalCompactButtonClass}
                  type="button"
                  aria-expanded={view.parentPickerOpen}
                  aria-controls="folder-parent-picker"
                  disabled={view.saving}
                  onClick={() => dispatchPopupModalAction('folder-parent-picker-toggle')}
                  unstyled
                >
                  {view.parentPickerOpen ? '收起' : '更改'}
                </Button>
              ) : null}
            </div>
          </div>
          {isCreate && view.parentPickerOpen ? (
            <div id="folder-parent-picker" className="flex min-h-0 flex-1 flex-col gap-2">
              <FolderSearch
                inputRef={parentSearchRef}
                htmlFor="folder-parent-search-input"
                inputId="folder-parent-search-input"
                placeholder="搜索上级文件夹"
                label="搜索上级文件夹"
                mode="folder-create"
                controls="folder-parent-list"
                value={view.parentQuery}
                action="folder-parent-query-change"
                disabled={view.saving}
              />
              <PopupFolderPickerHost
                id="folder-parent-list"
                className={modalCompactListClass}
                mode="folder-create"
                data-squircle-subtree="off"
              />
            </div>
          ) : null}
          <div className={modalFieldClass}>
            <label className={modalLabelClass} htmlFor="folder-title-input">文件夹名称</label>
            <Input
              ref={titleRef}
              id="folder-title-input"
              className={modalInputClass}
              type="text"
              maxLength={180}
              spellCheck={false}
              autoComplete="off"
              placeholder={isCreate ? '输入文件夹名称' : '输入新名称'}
              value={view.title}
              disabled={view.saving}
              onValueChange={(nextValue) => dispatchPopupModalAction('folder-title-change', nextValue)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (!view.saveDisabled) {
                    dispatchPopupModalAction('save-folder-dialog')
                  }
                }
              }}
              unstyled
            />
          </div>
        </div>
      )}
      <PopupModalFeedback id="folder-modal-error" message={view.error} />
      <footer className={modalActionsClass}>
        <Button
          ref={cancelRef}
          id="cancel-folder-modal"
          className={modalSecondaryButtonClass}
          type="button"
          disabled={view.saving}
          onClick={() => dispatchPopupModalAction('close')}
          unstyled
        >
          取消
        </Button>
        <Button
          id="confirm-folder-modal"
          className={isDelete ? modalDangerButtonClass : modalPrimaryButtonClass}
          type="button"
          disabled={view.saveDisabled}
          onClick={() => dispatchPopupModalAction('save-folder-dialog')}
          unstyled
        >
          <StableLabel
            text={view.saveLabel}
            reserve={isDelete ? ['确认删除', '删除中…'] : isCreate ? ['创建', '创建中…'] : ['保存', '保存中…']}
          />
        </Button>
      </footer>
    </section>
  )
}

function SmartFolderModal({
  titleRef,
  searchRef,
  view
}: {
  titleRef: RefObject<HTMLInputElement | null>
  searchRef: RefObject<HTMLInputElement | null>
  view: PopupModalsView['smartFolder']
}) {
  const { error } = usePopupModalsView()
  const hasError = Boolean(view.error || error)
  return (
    <section id="smart-folder-modal" className={modalWideCardClass} aria-labelledby="smart-folder-modal-title" tabIndex={-1}>
      <header className={cx(modalHeaderClass, 'shrink-0')}>
        <div className={modalHeaderCopyClass}>
          <h2 id="smart-folder-modal-title" className={modalTitleClass}>保存书签</h2>
        </div>
        <Button id="close-smart-folder-modal" className={modalCloseButtonClass} type="button" aria-label="关闭书签保存面板" disabled={view.saving} onClick={() => dispatchPopupModalAction('close')} unstyled>
          <Icon name="X" size={16} aria-hidden="true" />
        </Button>
      </header>
      <div className={cx(modalFieldClass, 'shrink-0')}>
        <label className={modalLabelClass} htmlFor="smart-folder-title-input">书签名称</label>
        <Input
          ref={titleRef}
          id="smart-folder-title-input"
          className={modalInputClass}
          type="text"
          value={view.title}
          maxLength={512}
          autoComplete="off"
          disabled={view.saving}
          aria-invalid={!view.title.trim()}
          aria-describedby={view.error ? 'smart-folder-page-url smart-folder-error' : 'smart-folder-page-url'}
          onValueChange={(value) => dispatchPopupModalAction('smart-folder-title-change', value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
              return
            }
            event.preventDefault()
            if (!view.saveDisabled && !event.repeat) {
              dispatchPopupModalAction('save-smart-folder')
            }
          }}
          unstyled
        />
        <p id="smart-folder-page-url" className={cx(modalCardPathClass, 'truncate')} title={view.urlLabel}>{view.urlLabel}</p>
      </div>
      <FolderSearch
        inputRef={searchRef}
        htmlFor="smart-folder-search-input"
        inputId="smart-folder-search-input"
        placeholder="搜索目标文件夹"
        label="搜索目标文件夹"
        mode="smart"
        controls="smart-folder-list"
        value={view.query}
        action="smart-folder-query-change"
        disabled={view.saving}
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <PopupFolderPickerHost id="smart-folder-list" className={cx(modalListClass, hasError && 'pb-14')} mode="smart" />
        <PopupModalFeedback id="smart-folder-error" message={view.error} overlay />
      </div>
      <footer className={cx(modalActionsClass, 'shrink-0')}>
        <div className="min-w-0 flex-1">
          <p className={modalCardLabelClass}>保存到</p>
          <p id="smart-folder-selected-path" className={cx(modalCardTitleClass, 'truncate')} title={view.selectedPath}>
            {view.selectedPath || '请选择文件夹'}
          </p>
        </div>
        <Button
          id="save-smart-folder-button"
          className={cx(modalPrimaryButtonClass, 'shrink-0')}
          type="button"
          disabled={view.saveDisabled}
          aria-busy={view.saving}
          onClick={() => dispatchPopupModalAction('save-smart-folder')}
          unstyled
        >
         <StableLabel text={view.saveLabel} reserve={['保存书签', '保存更改']} />
        </Button>
      </footer>
    </section>
  )
}

function AiProviderPromptModal({
  settingsButtonRef
}: {
  settingsButtonRef: RefObject<HTMLButtonElement | null>
}) {
  return (
    <section id="ai-provider-prompt-modal" className={modalSmallCardClass} aria-labelledby="ai-provider-prompt-title" tabIndex={-1}>
      <header className={modalHeaderCompactClass}>
        <div className={modalHeaderCopyClass}>
          <p className={modalEyebrowClass}>AI 搜索</p>
          <h2 id="ai-provider-prompt-title" className={modalTitleClass}>请配置 AI 服务</h2>
        </div>
        <Button id="close-ai-provider-prompt" className={modalCloseButtonClass} type="button" aria-label="关闭 AI 服务配置提示" onClick={() => dispatchPopupModalAction('close')} unstyled>
          <Icon name="X" size={16} aria-hidden="true" />
        </Button>
      </header>
      <AiSetupPrompt
        className={modalAiSetupPromptClass}
        description="普通搜索已包含本地规则。语义搜索需要先配置 AI 服务。"
        descriptionClassName={modalNoteClass}
        titleClassName="sr-only"
        title="AI 服务配置提示"
      />
      <footer className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5">
        <div className="min-w-0">
          <PopupModalFeedback inline />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button id="cancel-ai-provider-prompt" className={modalSecondaryButtonClass} type="button" onClick={() => dispatchPopupModalAction('close')} unstyled>暂不配置</Button>
          <Button ref={settingsButtonRef} id="open-ai-provider-settings" className={modalPrimaryButtonClass} type="button" onClick={() => dispatchPopupModalAction('open-ai-settings')} unstyled>配置 AI 服务</Button>
        </div>
      </footer>
    </section>
  )
}

function EditBookmarkModal({
  folderSearchRef,
  titleRef,
  view
}: {
  folderSearchRef: RefObject<HTMLInputElement | null>
  titleRef: RefObject<HTMLInputElement | null>
  view: PopupModalsView['edit']
}) {
  const modalRef = useRef<HTMLElement | null>(null)
  const { error } = usePopupModalsView()

  useLayoutEffect(() => {
    const modal = modalRef.current
    if (!modal) return
    const flowChildren = Array.from(modal.children).filter(
      element => !element.classList.contains('popup-edit-surface')
    )
    const fixedBlocks = flowChildren.map(element =>
      element.classList.contains('edit-folder-accordion') ? element.firstElementChild : element
    ).filter((element): element is HTMLElement => element instanceof HTMLElement)
    const measure = () => {
      const style = getComputedStyle(modal)
      const height = fixedBlocks.reduce((total, element) => total + element.offsetHeight, 0) +
        Math.max(0, flowChildren.length - 1) * Number.parseFloat(style.rowGap) +
        Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom) +
        Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth)
      const value = `${height}px`
      if (modal.style.getPropertyValue('--popup-edit-rest-height') !== value) {
        modal.style.setProperty('--popup-edit-rest-height', value)
      }
      const panelHeight = Math.floor(Math.max(0, Math.min(320, window.innerHeight - height - 52)) / 2) * 2
      modal.style.setProperty('--popup-edit-panel-height', `${panelHeight}px`)
      modal.style.setProperty('--popup-edit-open-shift', `${panelHeight / 2}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    fixedBlocks.forEach(element => observer.observe(element))
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <section ref={modalRef} id="edit-modal" className={modalEditCardClass} data-squircle="off" aria-labelledby="edit-modal-title" tabIndex={-1}>
      <div className="popup-edit-surface" aria-hidden="true" />
      <header className={cx(modalHeaderClass, 'popup-edit-upper')}>
        <div className={modalHeaderCopyClass}>
          <h2 id="edit-modal-title" className={modalTitleClass}>编辑书签</h2>
        </div>
        <Button id="close-edit-modal" className={modalCloseButtonClass} type="button" aria-label="关闭编辑面板" disabled={view.closeDisabled} onClick={() => dispatchPopupModalAction('close')} unstyled>
          <Icon name="X" size={16} aria-hidden="true" />
        </Button>
      </header>
      <EditFolderDisclosure folderSearchRef={folderSearchRef} view={view} />
      <div className={cx(modalEditFormClass, 'popup-edit-lower')}>
        <label className={modalEditInlineFieldClass} htmlFor="edit-title-input">
          <span className={modalLabelClass}>标题</span>
          <Input
            ref={titleRef}
            id="edit-title-input"
            className={modalEditCompactInputClass}
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
        <label className={modalEditInlineFieldClass} htmlFor="edit-url-input">
          <span className={modalLabelClass}>网址</span>
          <Input
            id="edit-url-input"
            aria-describedby={error ? 'popup-modal-error' : undefined}
            className={modalEditCompactInputClass}
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
      <div className="popup-edit-lower">
        <footer className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5">
          <div className="min-w-0">
            <PopupModalFeedback inline />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button id="cancel-edit" className={modalSecondaryButtonClass} type="button" disabled={view.cancelDisabled} onClick={() => dispatchPopupModalAction('close')} unstyled>取消</Button>
            <Button id="save-edit" className={modalPrimaryButtonClass} type="button" disabled={view.saveDisabled} onClick={() => dispatchPopupModalAction('save-edit')} unstyled>{view.saveLabel}</Button>
          </div>
        </footer>
      </div>
    </section>
  )
}

function EditFolderDisclosure({
  folderSearchRef,
  view
}: {
  folderSearchRef: RefObject<HTMLInputElement | null>
  view: PopupModalsView['edit']
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const panel = panelRef.current
    if (panel) {
      panel.inert = true
      panel.setAttribute('aria-hidden', 'true')
    }
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  return (
    <CollapsibleRoot
      className="edit-folder-accordion"
      onOpenChange={(open) => {
        if (closeTimerRef.current !== null) {
          window.clearTimeout(closeTimerRef.current)
          closeTimerRef.current = null
        }
        const panel = panelRef.current
        if (panel) {
          panel.inert = !open
          panel.setAttribute('aria-hidden', String(!open))
        }
        dispatchPopupModalAction('edit-folder-picker-change', String(open))
        if (open) {
          focusElement(folderSearchRef)
        } else {
          closeTimerRef.current = window.setTimeout(() => {
            closeTimerRef.current = null
            if (panelRef.current?.isConnected) {
              dispatchPopupModalAction('edit-folder-query-change', '')
            }
          }, getMotionDurationMs('--acc-collapse', 220, panel ?? undefined))
        }
      }}
    >
      <div className={cx(modalEditFolderBarClass, 'popup-edit-upper')}>
        <Icon name="Folder" size={14} className="shrink-0 text-ds-text-muted" aria-hidden="true" />
        <p
          id="edit-bookmark-path"
          className={cx(modalCardPathClass, 'min-w-0 flex-1 truncate', view.pathChanged ? modalCardPathChangedClass : '')}
          title={view.path}
        >
          {view.path}
        </p>
        <CollapsibleTrigger
          ref={triggerRef}
          id="edit-folder-picker-button"
          className={modalCompactButtonClass}
          type="button"
          aria-controls="edit-folder-picker"
          disabled={view.closeDisabled}
        >
          <span className="popup-edit-toggle-closed">更改</span>
          <span className="popup-edit-toggle-open">收起</span>
        </CollapsibleTrigger>
      </div>
      <CollapsiblePanel
        ref={panelRef}
        id="edit-folder-picker"
        className={editFolderPickerClass}
        aria-label="选择书签文件夹"
        hidden={false}
      >
        <FolderSearch
          inputRef={folderSearchRef}
          className="h-[34px] min-h-[34px] pl-2.5"
          htmlFor="edit-folder-search-input"
          inputId="edit-folder-search-input"
          placeholder="搜索目标文件夹"
          label="搜索编辑目标文件夹"
          mode="edit"
          controls="edit-folder-list"
          value={view.folderQuery}
          action="edit-folder-query-change"
          disabled={view.folderSearchDisabled}
        />
        <PopupFolderPickerHost
          id="edit-folder-list"
          className={modalListClass}
          mode="edit"
          data-squircle-subtree="off"
          onFolderSelectStart={() => {
            if (triggerRef.current?.getAttribute('aria-expanded') === 'true') {
              triggerRef.current.click()
            }
          }}
        />
      </CollapsiblePanel>
    </CollapsibleRoot>
  )
}

function handleEditInputKeydown(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
  if (event.key === 'Enter') {
    event.preventDefault()
    dispatchPopupModalAction('save-edit')
  }
}

interface ModalFocusRefs {
  aiProviderSettingsRef: RefObject<HTMLElement | null>
  editTitleRef: RefObject<HTMLInputElement | null>
  folderCancelRef: RefObject<HTMLButtonElement | null>
  folderTitleRef: RefObject<HTMLInputElement | null>
  moveSearchRef: RefObject<HTMLElement | null>
  smartFolderTitleRef: RefObject<HTMLInputElement | null>
}

function focusInitialModalControl(
  active: PopupModalsView['active'],
  folderMode: PopupModalsView['folder']['mode'],
  refs: ModalFocusRefs
) {
  if (active === 'move') {
    focusElement(refs.moveSearchRef)
    return
  }
  if (active === 'folder') {
    if (folderMode === 'delete') {
      focusElement(refs.folderCancelRef)
    } else {
      focusElement(refs.folderTitleRef, folderMode === 'rename')
    }
    return
  }
  if (active === 'smart-folder') {
    focusElement(refs.smartFolderTitleRef, true)
    return
  }
  if (active === 'ai-provider') {
    focusElement(refs.aiProviderSettingsRef)
    return
  }
  if (active === 'edit') {
    focusElement(refs.editTitleRef, true)
  }
}

function focusElement(ref: RefObject<HTMLElement | null>, select = false) {
  window.requestAnimationFrame(() => {
    const element = ref.current
    if (!(element instanceof HTMLElement)) {
      return
    }
    element.focus({ preventScroll: true })
    if (select && 'select' in element && typeof element.select === 'function') {
      element.select()
    }
  })
}
