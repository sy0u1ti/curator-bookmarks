import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { FolderRecord } from '../../shared/types.js'
import { Button, ThemeProvider } from '../../ui'

export interface FolderPickerOptionViewModel {
  current?: boolean
  description?: string
  disabled?: boolean
  folder: Pick<FolderRecord, 'id' | 'title' | 'path'>
}

export type FolderPickerKind = 'scope' | 'move'

export interface FolderPickerResultsState {
  activeId: string
  emptyMessage?: string
  kind: FolderPickerKind
  options: FolderPickerOptionViewModel[]
  showEmpty?: boolean
}

const roots = new WeakMap<Element, Root>()

export function renderFolderPickerResultsIsland(
  container: Element,
  state: FolderPickerResultsState
): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <FolderPickerResults state={state} />
      </ThemeProvider>
    )
  })
}

function FolderPickerResults({ state }: { state: FolderPickerResultsState }) {
  if (!state.options.length) {
    return <div className="detect-empty">{state.emptyMessage || '没有匹配的文件夹。'}</div>
  }

  return (
    <>
      {state.options.map((option, index) => (
        <FolderPickerOption
          active={String(option.folder.id || '') === state.activeId}
          key={`${state.kind}:${option.folder.id}:${index}`}
          kind={state.kind}
          option={option}
        />
      ))}
      {state.showEmpty ? (
        <div className="detect-empty" role="presentation">
          {state.emptyMessage || '没有匹配的文件夹。'}
        </div>
      ) : null}
    </>
  )
}

function FolderPickerOption({
  active,
  kind,
  option
}: {
  active: boolean
  kind: FolderPickerKind
  option: FolderPickerOptionViewModel
}) {
  const folderId = String(option.folder.id || '')
  const title = option.folder.title || '未命名文件夹'
  const description = option.description || option.folder.path || title || '文件夹'
  const className = kind === 'scope'
    ? ['scope-folder-card', option.current ? 'current' : ''].filter(Boolean).join(' ')
    : 'move-folder-card'
  const dataAttributes = kind === 'scope'
    ? { 'data-scope-folder-id': folderId }
    : { 'data-move-target-folder': folderId }

  return (
    <Button
      className={className}
      type="button"
      role="option"
      aria-selected={option.current ? 'true' : 'false'}
      tabIndex={active ? 0 : -1}
      title={kind === 'scope' ? description : undefined}
      disabled={option.disabled}
      unstyled
      {...dataAttributes}
    >
      {kind === 'scope' ? (
        <>
          <div className="scope-folder-head">
            <span className="scope-folder-icon" aria-hidden="true" />
            <strong>{title}</strong>
          </div>
          <span>{description}</span>
        </>
      ) : (
        <>
          <strong>{title}</strong>
          <span>{description}</span>
        </>
      )}
    </Button>
  )
}
