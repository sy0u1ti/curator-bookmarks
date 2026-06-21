import type { CSSProperties } from 'react'
import { Button } from '../../ui/base/Button'
import { Icon } from '../../ui/icons/Icon'
import { cx } from '../../ui/base/utils'
import { HighlightedText } from './HighlightedText'
import type { PopupFolderPickerState, PopupFolderTreeOptionViewModel } from './PopupViewModels'

const pickerRowClass =
  'relative grid min-h-[31px] grid-cols-[18px_minmax(0,1fr)] items-center gap-1'
const toggleButtonClass = [
  'inline-flex h-[26px] min-h-[26px] w-[18px] min-w-[18px] items-center justify-center rounded-md border border-transparent bg-transparent text-[var(--ui-text-tertiary)] outline-none',
  'transition-[border-color,background,color,transform,opacity] duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)]',
  'hover:border-[var(--ui-divider)] hover:bg-white/[0.055] hover:text-[var(--ui-text-primary)]',
  'focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-white/[0.055] focus-visible:text-[var(--ui-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.36)] focus-visible:outline-offset-1',
  'active:scale-95 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-20'
].join(' ')
const toggleIconClass =
  'transition-transform duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)]'
const pickerCardClass = [
  'grid min-h-[31px] w-full min-w-0 grid-cols-[12px_minmax(0,1fr)_max-content] items-center gap-[7px] rounded-md border border-transparent bg-transparent px-2 py-0 text-left text-[var(--ui-text-primary)] shadow-none outline-none',
  'transition-[border-color,background,color,transform] duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)]',
  'hover:border-white/10 hover:bg-white/[0.055] focus-visible:border-white/10 focus-visible:bg-white/[0.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.34)] focus-visible:outline-offset-1',
  'active:scale-[0.993] disabled:pointer-events-none disabled:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
].join(' ')
const pickerCardCurrentClass = 'border-white/20 bg-white/[0.11]'
const pickerBranchClass = 'h-2.5 w-2.5 justify-self-center rounded-full border border-white/18 bg-transparent'
const pickerMainClass = 'grid min-w-0 max-w-full gap-px text-left leading-normal'
const pickerTitleClass =
  'block min-w-0 truncate text-left text-xs font-semibold leading-[1.28] text-[var(--ui-text-primary)]'
const pickerPathClass =
  'm-0 block min-w-0 truncate text-left text-[11px] leading-tight text-[var(--ui-text-tertiary)]'
const pickerBadgeClass =
  'inline-flex min-h-[18px] w-fit items-center justify-self-start rounded-full bg-white/[0.07] px-[7px] py-0.5 text-[10px] font-bold leading-tight text-[var(--ui-text-primary)]'
const pickerBadgeMutedClass = 'text-[var(--ui-text-disabled)]'
const pickerEmptyStateClass =
  'grid h-full place-items-center rounded-[var(--ui-radius-control)] px-5 py-5 text-center text-xs leading-[1.55] tracking-[0.01em] text-[var(--ui-text-tertiary)]'

function getPickerDepthStyle(depth: number): CSSProperties {
  const normalizedDepth = Math.max(0, Number(depth) || 0)
  return { paddingLeft: `${normalizedDepth * 13}px` }
}

export function PopupFolderPicker({
  onFolderSelect,
  onFolderToggle,
  state
}: {
  onFolderSelect?: (folderId: string) => void
  onFolderToggle?: (folderId: string) => void
  state: PopupFolderPickerState
}) {
  return <PopupTreeFolderPicker onFolderSelect={onFolderSelect} onFolderToggle={onFolderToggle} state={state} />
}

function PopupTreeFolderPicker({
  onFolderSelect,
  onFolderToggle,
  state
}: {
  onFolderSelect?: (folderId: string) => void
  onFolderToggle?: (folderId: string) => void
  state: PopupFolderPickerState
}) {
  const options = state.treeOptions || []

  if (!options.length) {
    return state.empty?.message ? <div className={pickerEmptyStateClass}>{state.empty.message}</div> : null
  }

  return (
    <>
      {options.map((option) => (
        <PopupTreeFolderOption
          onFolderSelect={onFolderSelect}
          onFolderToggle={onFolderToggle}
          option={option}
          query={state.query}
          key={`${option.mode}:${option.id}`}
        />
      ))}
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
  const style = getPickerDepthStyle(option.depth)

  return (
    <div className={pickerRowClass} style={style}>
      <Button
        className={toggleButtonClass}
        type="button"
        role="treeitem"
        aria-level={option.depth + 1}
        aria-expanded={option.hasChildren ? option.expanded : false}
        aria-label={option.toggleLabel}
        unstyled
        {...(!option.hasChildren ? { 'data-disabled': 'true' } : {})}
        {...toggleAttrs}
        onClick={() => {
          if (option.hasChildren) {
            onFolderToggle?.(option.id)
          }
        }}
      >
        {option.hasChildren ? (
          <Icon
            name="ChevronDown"
            className={cx(toggleIconClass, option.expanded ? 'rotate-0' : '-rotate-90')}
            size={14}
            aria-hidden="true"
          />
        ) : null}
      </Button>
      <Button
        className={cx(pickerCardClass, option.rowCurrent ? pickerCardCurrentClass : '')}
        type="button"
        role="treeitem"
        aria-level={option.depth + 1}
        aria-selected={option.selected ? 'true' : 'false'}
        disabled={option.disabled}
        unstyled
        {...selectAttrs}
        onClick={() => onFolderSelect?.(option.id)}
      >
        <span className={pickerBranchClass} aria-hidden="true"></span>
        <span className={pickerMainClass}>
          <span className={pickerTitleClass}>
            <HighlightedText text={option.title} query={query} />
          </span>
          <span className={pickerPathClass} title={option.path}>
            <HighlightedText text={option.path} query={query} />
          </span>
          {option.badges.map((badge) => (
            <span
              className={cx(pickerBadgeClass, badge.muted ? pickerBadgeMutedClass : '')}
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
