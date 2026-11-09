import { useRef, type ReactNode, type RefObject } from 'react'
import { Button } from '../../ui/base/Button'
import { HoldConfirmButton } from '../../ui/actions/HoldConfirmButton'
import { DialogBackdrop, DialogBody, DialogHeader, DialogOverlay, DialogPanel } from '../../ui/base/Dialog'
import { CloseButton } from '../../ui/base/CloseButton'
import { Input } from '../../ui/base/Input'
import { cx } from '../../ui/base/utils'
import { handleFolderPickerAction, handleOptionsModalAction } from '../options-controller'
import { FolderPickerResults } from './FolderPickerResults.js'
import { getOptionsFocusTarget } from './options-focus-target-store.js'
import {
  OPTIONS_MODAL_ACTIONS_CLASS,
  OPTIONS_MODAL_BACKDROP_CLASS,
  OPTIONS_MODAL_BUTTON_CLASS,
  OPTIONS_MODAL_COPY_CLASS,
  OPTIONS_MODAL_DANGER_BUTTON_CLASS,
  OPTIONS_MODAL_PANEL_CLASS,
  OPTIONS_MODAL_PRIMARY_BUTTON_CLASS,
  OPTIONS_MODAL_RESULTS_CLASS,
  OPTIONS_MODAL_SEARCH_CLASS,
  OPTIONS_MODAL_SEARCH_INPUT_CLASS,
  OPTIONS_MODAL_SEARCH_LABEL_CLASS,
  OPTIONS_MODAL_TITLE_CLASS,
  OPTIONS_MODAL_WIDE_PANEL_CLASS
} from './options-modal-classes.js'
import { useOptionsModalsState } from './options-modals-store.js'
import type { OptionsModalKey } from './options-modals-types.js'

function ModalBackdrop({
  labelledBy,
  describedBy,
  className = OPTIONS_MODAL_PANEL_CLASS,
  finalFocusId,
  initialFocusRef,
  modal,
  open,
  children
}: {
  labelledBy: string
  describedBy?: string
  className?: string
  finalFocusId?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  modal: OptionsModalKey
  open: boolean
  children: ReactNode
}) {
  return (
    <DialogOverlay
      className="fixed inset-0 z-30 grid place-items-center p-5 pointer-events-none"
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) {
          handleOptionsModalAction({ action: 'dismiss', modal })
        }
      }}
      modal
      disablePointerDismissal
    >
      <DialogBackdrop
        className={OPTIONS_MODAL_BACKDROP_CLASS}
        onClick={() => {
          if (open) {
          handleOptionsModalAction({ action: 'dismiss', modal })
          }
        }}
      />
      <DialogPanel
        layout={modal === 'move' || modal === 'scope' ? 'workspace' : 'centered'}
        className={className}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        initialFocus={() => initialFocusRef?.current || true}
        finalFocus={() => {
          return getOptionsFocusTarget(finalFocusId) || true
        }}
      >
        {children}
      </DialogPanel>
    </DialogOverlay>
  )
}

function confirmButtonClass(tone: 'danger' | 'warning') {
  return cx(
    OPTIONS_MODAL_BUTTON_CLASS,
    tone === 'danger' ? OPTIONS_MODAL_DANGER_BUTTON_CLASS : OPTIONS_MODAL_PRIMARY_BUTTON_CLASS
  )
}

export function OptionsModals() {
  const modals = useOptionsModalsState()
  const cancelConfirmRef = useRef<HTMLElement | null>(null)
  const moveSearchRef = useRef<HTMLInputElement | null>(null)
  const scopeSearchRef = useRef<HTMLInputElement | null>(null)

  return (
    <>
      <ModalBackdrop
        labelledBy="confirm-modal-title"
        describedBy="confirm-modal-copy"
        initialFocusRef={cancelConfirmRef}
        modal="confirm"
        open={modals.confirm.open}
      >
        <>
          <h2 id="confirm-modal-title" className={OPTIONS_MODAL_TITLE_CLASS}>{modals.confirm.title}</h2>
          <p id="confirm-modal-copy" className={OPTIONS_MODAL_COPY_CLASS}>{modals.confirm.copy}</p>
          <div className={OPTIONS_MODAL_ACTIONS_CLASS}>
            <Button
              className={OPTIONS_MODAL_BUTTON_CLASS}
              ref={cancelConfirmRef}
              type="button"
              variant="secondary"
              onClick={() => handleOptionsModalAction({ action: 'cancel', modal: 'confirm' })}
            >
              {modals.confirm.cancelLabel}
            </Button>
            {modals.confirm.holdToConfirm && modals.confirm.open ? (
              <HoldConfirmButton
                key={modals.confirm.requestId}
                className={confirmButtonClass(modals.confirm.tone)}
                type="button"
                variant="danger"
                label={modals.confirm.confirmLabel}
                onConfirm={() => handleOptionsModalAction({ action: 'confirm', modal: 'confirm' })}
              />
            ) : (
              <Button
                className={confirmButtonClass(modals.confirm.tone)}
                type="button"
                variant={modals.confirm.tone === 'danger' ? 'danger' : 'primary'}
                onClick={() => handleOptionsModalAction({ action: 'confirm', modal: 'confirm' })}
              >
                {modals.confirm.confirmLabel}
              </Button>
            )}
          </div>
        </>
      </ModalBackdrop>

      <ModalBackdrop
        labelledBy="move-modal-title"
        describedBy="move-modal-copy"
        className={OPTIONS_MODAL_WIDE_PANEL_CLASS}
        initialFocusRef={moveSearchRef}
        finalFocusId={modals.move.finalFocusId}
        modal="move"
        open={modals.move.open}
      >
        <>
          <DialogHeader className="flex items-start justify-between gap-3">
            <h2 id="move-modal-title" className={OPTIONS_MODAL_TITLE_CLASS}>批量移动书签</h2>
            <CloseButton label="取消批量移动书签" variant="ghost" size="icon" className="shrink-0"
              onClick={() => handleOptionsModalAction({ action: 'cancel', modal: 'move' })} />
          </DialogHeader>
          <p id="move-modal-copy" className={OPTIONS_MODAL_COPY_CLASS}>
            {modals.move.copy}
          </p>
          <label className={OPTIONS_MODAL_SEARCH_CLASS} htmlFor="move-search-input">
            <span className={OPTIONS_MODAL_SEARCH_LABEL_CLASS}>搜索目标文件夹</span>
            <Input
              id="move-search-input"
              ref={moveSearchRef}
              className={OPTIONS_MODAL_SEARCH_INPUT_CLASS}
              type="search"
              placeholder="搜索文件夹名称或路径"
              aria-label="搜索移动目标文件夹"
              aria-controls="move-folder-results"
              value={modals.move.query}
              onValueChange={(query) => handleOptionsModalAction({
                action: 'search-change',
                modal: 'move',
                query
              })}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
                  return
                }
                event.preventDefault()
                handleFolderPickerAction({
                  action: 'search-keydown',
                  key: event.key,
                  kind: 'move'
                })
              }}
            />
          </label>
          <DialogBody
            id="move-folder-results"
            className={OPTIONS_MODAL_RESULTS_CLASS}
            role="tree"
            aria-label="移动目标文件夹"
          >
            <FolderPickerResults kind="move" searchInputRef={moveSearchRef} />
          </DialogBody>
        </>
      </ModalBackdrop>

      <ModalBackdrop
        labelledBy="scope-modal-title"
        describedBy="scope-modal-copy"
        className={OPTIONS_MODAL_WIDE_PANEL_CLASS}
        initialFocusRef={scopeSearchRef}
        finalFocusId={modals.scope.finalFocusId}
        modal="scope"
        open={modals.scope.open}
      >
        <>
          <DialogHeader className="flex items-start justify-between gap-3">
            <h2 id="scope-modal-title" className={OPTIONS_MODAL_TITLE_CLASS}>选择筛选文件夹</h2>
            <CloseButton label="关闭筛选文件夹弹窗" variant="ghost" size="icon" className="shrink-0"
              onClick={() => handleOptionsModalAction({ action: 'cancel', modal: 'scope' })} />
          </DialogHeader>
          <p id="scope-modal-copy" className={OPTIONS_MODAL_COPY_CLASS}>
            {modals.scope.copy}
          </p>
          <label className={OPTIONS_MODAL_SEARCH_CLASS} htmlFor="scope-search-input">
            <span className={OPTIONS_MODAL_SEARCH_LABEL_CLASS}>搜索文件夹</span>
            <Input
              id="scope-search-input"
              ref={scopeSearchRef}
              className={OPTIONS_MODAL_SEARCH_INPUT_CLASS}
              type="search"
              placeholder="搜索文件夹名称或路径"
              aria-label="搜索筛选文件夹"
              aria-controls="scope-folder-results"
              value={modals.scope.query}
              onValueChange={(query) => handleOptionsModalAction({
                action: 'search-change',
                modal: 'scope',
                query
              })}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
                  return
                }
                event.preventDefault()
                handleFolderPickerAction({
                  action: 'search-keydown',
                  key: event.key,
                  kind: 'scope'
                })
              }}
            />
          </label>
          <DialogBody
            id="scope-folder-results"
            className={OPTIONS_MODAL_RESULTS_CLASS}
            role="tree"
            aria-label="筛选文件夹"
          >
            <FolderPickerResults kind="scope" searchInputRef={scopeSearchRef} />
          </DialogBody>
        </>
      </ModalBackdrop>

    </>
  )
}
