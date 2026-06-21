import { useEffect, useRef, type RefObject } from 'react'
import { Button } from '../../ui/base/Button.js'
import { handleFolderPickerAction } from '../options-controller'
import { useFolderPickerResultsState } from './folder-picker-results-store.js'
import {
  FOLDER_PICKER_CARD_CLASS,
  FOLDER_PICKER_DESCRIPTION_CLASS,
  FOLDER_PICKER_EMPTY_CLASS,
  FOLDER_PICKER_HEAD_CLASS,
  FOLDER_PICKER_ICON_CLASS,
  FOLDER_PICKER_SCOPE_DESCRIPTION_CLASS,
  FOLDER_PICKER_TITLE_CLASS
} from './options-modal-classes.js'
import type {
  FolderPickerKind,
  FolderPickerOptionViewModel
} from './folder-picker-results-types.js'

export function FolderPickerResults({
  kind,
  searchInputRef
}: {
  kind: FolderPickerKind
  searchInputRef?: RefObject<HTMLInputElement | null>
}) {
  const state = useFolderPickerResultsState(kind)
  const optionRefs = useRef(new Map<string, HTMLElement>())

  useEffect(() => {
    const focusId = state.focusRequestId
    if (typeof focusId !== 'string') {
      return
    }

    window.setTimeout(() => {
      optionRefs.current.get(focusId)?.focus()
    }, 0)
  }, [state.focusRequestId])

  const setOptionRef = (folderId: string, button: HTMLElement | null) => {
    if (button) {
      optionRefs.current.set(folderId, button)
      return
    }

    optionRefs.current.delete(folderId)
  }

  if (!state.options.length) {
    return (
      <li className={FOLDER_PICKER_EMPTY_CLASS} role="presentation">
        {state.emptyMessage || '没有匹配的文件夹。'}
      </li>
    )
  }

  return (
    <>
      {state.options.map((option, index) => (
        <li role="presentation" key={`${kind}:${option.folder.id}:${index}`}>
          <FolderPickerOption
            active={String(option.folder.id || '') === state.activeId}
            kind={kind}
            option={option}
            searchInputRef={searchInputRef}
            setOptionRef={setOptionRef}
          />
        </li>
      ))}
      {state.showEmpty ? (
        <li className={FOLDER_PICKER_EMPTY_CLASS} role="presentation">
          {state.emptyMessage || '没有匹配的文件夹。'}
        </li>
      ) : null}
    </>
  )
}

function FolderPickerOption({
  active,
  kind,
  option,
  searchInputRef,
  setOptionRef
}: {
  active: boolean
  kind: FolderPickerKind
  option: FolderPickerOptionViewModel
  searchInputRef?: RefObject<HTMLInputElement | null>
  setOptionRef: (folderId: string, button: HTMLElement | null) => void
}) {
  const folderId = String(option.folder.id || '')
  const title = option.folder.title || '未命名文件夹'
  const description = option.description || option.folder.path || title || '文件夹'

  return (
    <Button
      ref={(button) => setOptionRef(folderId, button)}
      className={FOLDER_PICKER_CARD_CLASS}
      type="button"
      aria-current={option.current ? 'true' : undefined}
      tabIndex={active ? 0 : -1}
      title={kind === 'scope' ? description : undefined}
      disabled={option.disabled}
      onClick={() => handleFolderPickerAction({
        action: 'select',
        folderId,
        kind
      })}
      onFocus={() => handleFolderPickerAction({
        action: 'focus',
        folderId,
        kind
      })}
      onKeyDown={(event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'].includes(event.key)) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        if (event.key === 'Escape') {
          searchInputRef?.current?.focus()
          return
        }
        handleFolderPickerAction({
          action: 'results-keydown',
          key: event.key,
          kind
        })
      }}
      unstyled
    >
      {kind === 'scope' ? (
        <>
          <div className={FOLDER_PICKER_HEAD_CLASS}>
            <span className={FOLDER_PICKER_ICON_CLASS} aria-hidden="true" />
            <strong className={FOLDER_PICKER_TITLE_CLASS}>{title}</strong>
          </div>
          <span className={FOLDER_PICKER_SCOPE_DESCRIPTION_CLASS}>{description}</span>
        </>
      ) : (
        <>
          <strong className={FOLDER_PICKER_TITLE_CLASS}>{title}</strong>
          <span className={`${FOLDER_PICKER_DESCRIPTION_CLASS} !whitespace-normal`}>
            {description}
          </span>
        </>
      )}
    </Button>
  )
}
