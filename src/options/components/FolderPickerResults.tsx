import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { Button } from '../../ui/base/Button'
import { cx } from '../../ui/base/utils'
import { Icon } from '../../ui/icons/Icon'
import { normalizeText } from '../../shared/text.js'
import { getHighlightTerms, HighlightedText } from '../../ui/base/HighlightedText'
import { handleFolderPickerAction } from '../options-controller'
import { useFolderPickerResultsState } from './folder-picker-results-store.js'
import {
  FOLDER_PICKER_BADGE_CLASS,
  FOLDER_PICKER_BADGE_MUTED_CLASS,
  FOLDER_PICKER_CARD_CLASS,
  FOLDER_PICKER_CARD_CURRENT_CLASS,
  FOLDER_PICKER_CHECK_CLASS,
  FOLDER_PICKER_DESCRIPTION_CLASS,
  FOLDER_PICKER_EMPTY_CLASS,
  FOLDER_PICKER_ICON_CLASS,
  FOLDER_PICKER_MAIN_CLASS,
  FOLDER_PICKER_META_CLASS,
  FOLDER_PICKER_TITLE_CLASS,
  FOLDER_PICKER_TOGGLE_CLASS,
  FOLDER_PICKER_TOGGLE_ICON_CLASS,
  FOLDER_PICKER_TREE_ROW_CLASS
} from './options-modal-classes.js'
import type {
  FolderPickerKind,
  FolderPickerTreeOptionViewModel
} from './folder-picker-results-types.js'

function getTreeDepthStyle(depth: number): CSSProperties {
  const normalizedDepth = Math.max(0, Number(depth) || 0)
  return { paddingLeft: `${normalizedDepth * 13}px` }
}

export function FolderPickerResults({
  kind,
  searchInputRef
}: {
  kind: FolderPickerKind
  searchInputRef?: RefObject<HTMLInputElement | null>
}) {
  const state = useFolderPickerResultsState(kind)
  const optionRefs = useRef<Map<string, HTMLElement> | null>(null)
  if (optionRefs.current === null) {
    optionRefs.current = new Map()
  }
  const optionRefMap = optionRefs.current

  useEffect(() => {
    const focusId = state.focusRequestId
    if (typeof focusId !== 'string') {
      return
    }

    window.setTimeout(() => {
      optionRefMap.get(focusId)?.focus()
    }, 0)
  }, [optionRefMap, state.focusRequestId])

  const setOptionRef = (folderId: string, button: HTMLElement | null) => {
    if (button) {
      optionRefMap.set(folderId, button)
      return
    }

    optionRefMap.delete(folderId)
  }

  const options = state.treeOptions || []

  if (!options.length) {
    return (
      <div className={FOLDER_PICKER_EMPTY_CLASS} role="presentation">
        {state.emptyMessage || '没有匹配的文件夹。'}
      </div>
    )
  }

  return (
    <>
      {options.map((option) => (
        <FolderPickerTreeOption
          active={String(option.id || '') === state.activeId}
          kind={kind}
          option={option}
          query={state.query || ''}
          searchInputRef={searchInputRef}
          setOptionRef={setOptionRef}
          key={`${kind}:${option.id}`}
        />
      ))}
      {state.showEmpty ? (
        <div className={FOLDER_PICKER_EMPTY_CLASS} role="presentation">
          {state.emptyMessage || '没有匹配的文件夹。'}
        </div>
      ) : null}
    </>
  )
}

function FolderPickerTreeOption({
  active,
  kind,
  option,
  query,
  searchInputRef,
  setOptionRef
}: {
  active: boolean
  kind: FolderPickerKind
  option: FolderPickerTreeOptionViewModel
  query: string
  searchInputRef?: RefObject<HTMLInputElement | null>
  setOptionRef: (folderId: string, button: HTMLElement | null) => void
}) {
  const folderId = String(option.id || '')
  const style = getTreeDepthStyle(option.depth)

  return (
    <div className={FOLDER_PICKER_TREE_ROW_CLASS} style={style} role="presentation">
      <Button
        className={FOLDER_PICKER_TOGGLE_CLASS}
        type="button"
        tabIndex={-1}
        aria-label={option.toggleLabel}
        unstyled
        {...(!option.hasChildren ? { 'data-disabled': 'true' } : {})}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (option.hasChildren) {
            handleFolderPickerAction({
              action: 'toggle',
              folderId,
              kind
            })
          }
        }}
      >
        {option.hasChildren ? (
          <Icon
            name="ChevronDown"
            className={cx(FOLDER_PICKER_TOGGLE_ICON_CLASS, option.expanded ? 'rotate-0' : '-rotate-90')}
            size={14}
            aria-hidden="true"
          />
        ) : null}
      </Button>
      <Button
        ref={(button) => setOptionRef(folderId, button)}
        className={cx(FOLDER_PICKER_CARD_CLASS, option.rowCurrent ? FOLDER_PICKER_CARD_CURRENT_CLASS : '')}
        type="button"
        role="treeitem"
        aria-level={option.depth + 1}
        aria-expanded={option.hasChildren ? option.expanded : undefined}
        aria-selected={option.selected ? 'true' : 'false'}
        tabIndex={active ? 0 : -1}
        title={option.path || option.title}
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
          if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) {
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
        <Icon
          name={folderId ? 'Folder' : 'Bookmark'}
          className={FOLDER_PICKER_ICON_CLASS}
          size={16}
          aria-hidden="true"
        />
        <span className={FOLDER_PICKER_MAIN_CLASS}>
          <span className={FOLDER_PICKER_TITLE_CLASS}>
            <HighlightedText terms={getHighlightTerms(normalizeText(query))} text={option.title} />
          </span>
          <span className={FOLDER_PICKER_DESCRIPTION_CLASS}>
            <HighlightedText terms={getHighlightTerms(normalizeText(query))} text={option.path} />
          </span>
        </span>
        {option.badges.length || option.selected ? (
          <span className={FOLDER_PICKER_META_CLASS} aria-hidden="true">
            {option.badges.map((badge) => (
              <span
                className={cx(FOLDER_PICKER_BADGE_CLASS, badge.muted ? FOLDER_PICKER_BADGE_MUTED_CLASS : '')}
                key={badge.label}
              >
                {badge.label}
              </span>
            ))}
            {option.selected ? <Icon name="Check" className={FOLDER_PICKER_CHECK_CLASS} size={14} /> : null}
          </span>
        ) : null}
      </Button>
    </div>
  )
}

