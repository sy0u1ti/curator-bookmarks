import type { CSSProperties } from 'react'
import { Button } from '../../ui/primitives/Button'
import { HighlightedText } from './HighlightedText'
import type { PopupFolderPickerState, PopupFolderTreeOptionViewModel } from './PopupViewModels'

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
    return state.empty?.message ? <div className="state-panel">{state.empty.message}</div> : null
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
  const style = { '--depth': option.depth } as CSSProperties

  return (
    <div className={['picker-row', option.rowCurrent ? 'current' : ''].filter(Boolean).join(' ')} style={style}>
      <Button
        className={['tree-toggle', option.expanded ? 'expanded' : ''].filter(Boolean).join(' ')}
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
      ></Button>
      <Button
        className="picker-folder-card"
        type="button"
        role="treeitem"
        aria-level={option.depth + 1}
        aria-selected={option.selected ? 'true' : 'false'}
        disabled={option.disabled}
        unstyled
        {...selectAttrs}
        onClick={() => onFolderSelect?.(option.id)}
      >
        <span className="folder-tree-branch" aria-hidden="true"></span>
        <span className="picker-folder-main">
          <span className="row-title">
            <HighlightedText text={option.title} query={query} />
          </span>
          <span className="picker-path" title={option.path}>
            <HighlightedText text={option.path} query={query} />
          </span>
          {option.badges.map((badge) => (
            <span
              className={['picker-badge', badge.muted ? 'muted' : ''].filter(Boolean).join(' ')}
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
