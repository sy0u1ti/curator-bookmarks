import { memo } from 'react'
import { Button } from '../../ui/base/Button'
import { Icon } from '../../ui/icons/Icon'
import { cx } from '../../ui/base/utils'
import { getHighlightTerms, HighlightedText } from '../../ui/base/HighlightedText'
import { normalizeQuery } from '../search'
import {
  folderBranchClass,
  folderCardActiveClass,
  folderCardClass,
  folderCountActiveClass,
  folderCountClass,
  folderMainClass,
  folderRowClass,
  folderTitleClass,
  getFolderDepthStyle
} from './popup-folder-tree-styles'
import type { PopupFolderPickerState, PopupFolderTreeOptionViewModel } from './PopupViewModels'

const pickerRowClass = cx(folderRowClass, 'popup-folder-picker-row')
const toggleButtonClass = [
  'popup-folder-picker-toggle absolute top-1 z-[2] inline-flex h-[26px] w-[18px] items-center justify-center rounded-ds-sm border-0 bg-transparent p-0 text-ds-text-muted outline-none',
  'hover:text-ds-text-primary focus-visible:text-ds-text-primary',
  'disabled:pointer-events-none disabled:opacity-50'
].join(' ')
const toggleIconClass =
  'popup-folder-picker-chevron transition-transform duration-ds-fast ease-ds-standard motion-reduce:transition-none'
const pickerCardClass = [
  folderCardClass,
  'popup-folder-picker-card disabled:pointer-events-none disabled:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
].join(' ')
const pickerEmptyStateClass =
  'grid h-full place-items-center rounded-ds-sm px-5 py-5 text-center text-xs leading-[1.55] tracking-[0.01em] text-ds-text-muted'

export function PopupFolderPicker({
  endIndex,
  onFolderSelect,
  onFolderToggle,
  rowHeight = 34,
  startIndex = 0,
  state
}: {
  endIndex?: number
  onFolderSelect?: (folderId: string) => void
  onFolderToggle?: (folderId: string) => void
  rowHeight?: number
  startIndex?: number
  state: PopupFolderPickerState
}) {
  const options = state.treeOptions || []
  const end = Math.min(endIndex ?? options.length, options.length)

  if (!options.length) {
    return state.empty?.message ? <div className={pickerEmptyStateClass}>{state.empty.message}</div> : null
  }

  return (
    <>
      {startIndex > 0 ? (
        <div aria-hidden="true" style={{ height: startIndex * rowHeight }} />
      ) : null}
      {options.slice(startIndex, end).map((option) => (
        <MemoPopupTreeFolderOption
          onFolderSelect={onFolderSelect}
          onFolderToggle={onFolderToggle}
          option={option}
          query={state.query}
          key={`${option.mode}:${option.id}`}
        />
      ))}
      {end < options.length ? (
        <div aria-hidden="true" style={{ height: (options.length - end) * rowHeight }} />
      ) : null}
    </>
  )
}

function PopupTreeFolderOption({
  onFolderSelect,
  onFolderToggle,
  option,
  query
}: {
  onFolderSelect?: (folderId: string) => void
  onFolderToggle?: (folderId: string) => void
  option: PopupFolderTreeOptionViewModel
  query: string
}) {
  const toggleAttrs = getTreeFolderToggleAttributes(option)
  const selectAttrs = getTreeFolderSelectAttributes(option)
  const style = getFolderDepthStyle(option.depth)

  return (
    <div className={pickerRowClass} data-folder-picker-row="">
      <Button
        className={cx(pickerCardClass, option.rowCurrent ? folderCardActiveClass : '')}
        type="button"
        role="treeitem"
        aria-expanded={option.hasChildren ? option.expanded : undefined}
        aria-level={option.depth + 1}
        aria-selected={option.selected ? 'true' : 'false'}
        title={option.path}
        style={style}
        disabled={option.disabled}
        unstyled
        {...selectAttrs}
        onClick={() => onFolderSelect?.(option.id)}
      >
        <span className={cx(folderBranchClass, 'popup-folder-picker-branch')} aria-hidden="true"></span>
        <span className={folderMainClass}>
          <span className={folderTitleClass}>
            <HighlightedText terms={getHighlightTerms(normalizeQuery(query))} text={option.title} />
          </span>
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            {option.badges.map((badge) => (
              <span
                className={cx(folderCountClass, badge.muted ? '' : folderCountActiveClass)}
                key={badge.label}
              >
                {badge.label}
              </span>
            ))}
          </span>
        </span>
      </Button>
      {option.hasChildren ? (
        <Button
          className={toggleButtonClass}
          type="button"
          aria-expanded={option.expanded}
          aria-label={option.toggleLabel}
          style={{ left: `calc(${style.paddingLeft} - 2px)` }}
          disabled={option.disabled}
          unstyled
          {...toggleAttrs}
          onClick={() => onFolderToggle?.(option.id)}
        >
          <Icon
            name="ChevronDown"
            className={cx(toggleIconClass, option.expanded ? 'rotate-0' : '-rotate-90')}
            size={14}
            aria-hidden="true"
          />
        </Button>
      ) : null}
    </div>
  )
}

const MemoPopupTreeFolderOption = memo(PopupTreeFolderOption)

function getTreeFolderToggleAttributes(option: PopupFolderTreeOptionViewModel) {
  if (option.mode === 'move') {
    return { 'data-toggle-move-folder': option.id }
  }
  if (option.mode === 'smart') {
    return { 'data-toggle-smart-folder': option.id }
  }
  return { 'data-toggle-edit-folder': option.id }
}

function getTreeFolderSelectAttributes(option: PopupFolderTreeOptionViewModel) {
  if (option.mode === 'move') {
    return { 'data-select-folder': option.id }
  }
  if (option.mode === 'smart') {
    return { 'data-smart-select-folder': option.id }
  }
  return { 'data-select-edit-folder': option.id }
}
