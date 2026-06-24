import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { Button, Icon, cx } from '../../ui'
import { normalizeText } from '../../shared/text.js'
import { handleFolderPickerAction } from '../options-controller'
import { useFolderPickerResultsState } from './folder-picker-results-store.js'
import {
  FOLDER_PICKER_BADGE_CLASS,
  FOLDER_PICKER_BADGE_MUTED_CLASS,
  FOLDER_PICKER_BRANCH_CLASS,
  FOLDER_PICKER_CARD_CLASS,
  FOLDER_PICKER_CARD_CURRENT_CLASS,
  FOLDER_PICKER_DESCRIPTION_CLASS,
  FOLDER_PICKER_EMPTY_CLASS,
  FOLDER_PICKER_MAIN_CLASS,
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
      {options.map((option, index) => (
        <FolderPickerTreeOption
          active={String(option.id || '') === state.activeId}
          kind={kind}
          option={option}
          query={state.query || ''}
          searchInputRef={searchInputRef}
          setOptionRef={setOptionRef}
          key={`${kind}:${option.id}:${index}`}
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
        <span className={FOLDER_PICKER_BRANCH_CLASS} aria-hidden="true"></span>
        <span className={FOLDER_PICKER_MAIN_CLASS}>
          <span className={FOLDER_PICKER_TITLE_CLASS}>
            <HighlightedText text={option.title} query={query} />
          </span>
          <span className={FOLDER_PICKER_DESCRIPTION_CLASS}>
            <HighlightedText text={option.path} query={query} />
          </span>
          {option.badges.map((badge) => (
            <span
              className={cx(FOLDER_PICKER_BADGE_CLASS, badge.muted ? FOLDER_PICKER_BADGE_MUTED_CLASS : '')}
              key={badge.label}
            >
              {badge.label}
            </span>
          ))}
        </span>
      </Button>
    </div>
  )
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitHighlightText(text, query).map((part, index) => {
        const key = `${index}:${part.text}`
        return part.highlight ? (
          <mark className="rounded-md bg-ds-text-primary/[0.12] px-[0.02em] text-ds-text-primary shadow-none" key={key}>
            {part.text}
          </mark>
        ) : (
          <span key={key}>{part.text}</span>
        )
      })}
    </>
  )
}

function splitHighlightText(text: string, query: string): Array<{ highlight: boolean; text: string }> {
  const safeText = String(text || '')
  const terms = normalizeText(query)
    .split(/\s+/g)
    .map((term) => term.trim())
    .filter(Boolean)

  if (!terms.length || !safeText) {
    return [{ highlight: false, text: safeText }]
  }

  const lowerText = safeText.toLowerCase()
  const ranges: Array<[number, number]> = []

  for (const term of terms.sort((left, right) => right.length - left.length)) {
    let fromIndex = 0
    while (fromIndex < lowerText.length) {
      const matchIndex = lowerText.indexOf(term, fromIndex)
      if (matchIndex === -1) {
        break
      }
      ranges.push([matchIndex, matchIndex + term.length])
      fromIndex = matchIndex + term.length
    }
  }

  if (!ranges.length) {
    return [{ highlight: false, text: safeText }]
  }

  ranges.sort((left, right) => left[0] - right[0])
  const mergedRanges: Array<[number, number]> = []

  for (const currentRange of ranges) {
    const previousRange = mergedRanges.at(-1)
    if (!previousRange || currentRange[0] > previousRange[1]) {
      mergedRanges.push([...currentRange])
      continue
    }

    previousRange[1] = Math.max(previousRange[1], currentRange[1])
  }

  const parts: Array<{ highlight: boolean; text: string }> = []
  let cursor = 0

  for (const [start, end] of mergedRanges) {
    if (start > cursor) {
      parts.push({ highlight: false, text: safeText.slice(cursor, start) })
    }
    parts.push({ highlight: true, text: safeText.slice(start, end) })
    cursor = end
  }

  if (cursor < safeText.length) {
    parts.push({ highlight: false, text: safeText.slice(cursor) })
  }

  return parts.length ? parts : [{ highlight: false, text: safeText }]
}
