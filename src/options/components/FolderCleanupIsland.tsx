import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { Button, ThemeProvider } from '../../ui'
import type {
  FolderCleanupSplitUndo,
  FolderCleanupSuggestion
} from '../../shared/folder-cleanup.js'

const KIND_LABELS = {
  'empty-folder': '空文件夹',
  'deep-single-bookmark': '深层单书签',
  'single-path-chain': '单一路径',
  'same-name-folders': '同名合并',
  'large-folder-split': '超大拆分'
}

export interface FolderCleanupResultsState {
  emptyMessage: string
  locked: boolean
  selectedSuggestionId: string
  splitUndo: FolderCleanupSplitUndo | null
  suggestions: FolderCleanupSuggestion[]
}

const roots = new WeakMap<Element, Root>()

export function renderFolderCleanupIsland(
  container: Element,
  state: FolderCleanupResultsState
): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <FolderCleanupResults state={state} />
      </ThemeProvider>
    )
  })
}

function FolderCleanupResults({ state }: { state: FolderCleanupResultsState }) {
  if (!state.suggestions.length && !state.splitUndo) {
    return <div className="detect-empty">{state.emptyMessage}</div>
  }

  return (
    <>
      {state.splitUndo ? <SplitUndoNotice locked={state.locked} splitUndo={state.splitUndo} /> : null}
      {state.suggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          locked={state.locked}
          previewOpen={state.selectedSuggestionId === suggestion.id}
          suggestion={suggestion}
        />
      ))}
    </>
  )
}

function SplitUndoNotice({
  locked,
  splitUndo
}: {
  locked: boolean
  splitUndo: FolderCleanupSplitUndo
}) {
  const undoLabel = getFolderCleanupSplitUndoActionLabel('撤销本次拆分', splitUndo)

  return (
    <article className="detect-result-card folder-cleanup-undo-card">
      <div className="detect-result-head">
        <span className="options-chip warning">可撤销拆分</span>
        <div className="detect-result-actions">
          <Button
            className="detect-result-action"
            type="button"
            data-folder-cleanup-undo-split={splitUndo.id}
            aria-label={undoLabel}
            disabled={locked}
            unstyled
          >
            撤销本次拆分
          </Button>
        </div>
      </div>
      <div className="detect-result-copy">
        <strong>{splitUndo.title}</strong>
        <p className="detect-result-detail">
          已记录 {splitUndo.moves.length}
          {' '}个书签的拆分前位置。撤销会先确认并触发自动备份 hook，然后移回书签并删除本次新建的空拆分文件夹。
        </p>
      </div>
    </article>
  )
}

function SuggestionCard({
  locked,
  previewOpen,
  suggestion
}: {
  locked: boolean
  previewOpen: boolean
  suggestion: FolderCleanupSuggestion
}) {
  const operationCopy = getOperationCopy(suggestion)
  const previewLabel = getFolderCleanupSuggestionActionLabel(
    previewOpen ? '收起文件夹清理预览' : '查看文件夹清理预览',
    suggestion
  )
  const operationLabel = getFolderCleanupSuggestionActionLabel(operationCopy, suggestion)
  const severityClass = suggestion.severity === 'danger'
    ? 'danger'
    : suggestion.severity === 'warning'
      ? 'warning'
      : 'muted'

  return (
    <article className="detect-result-card folder-cleanup-card">
      <div className="detect-result-head">
        <span className={`options-chip ${severityClass}`}>{KIND_LABELS[suggestion.kind]}</span>
        <div className="detect-result-actions">
          <Button
            className="detect-result-action"
            type="button"
            data-folder-cleanup-preview={suggestion.id}
            aria-label={previewLabel}
            unstyled
          >
            {previewOpen ? '收起预览' : '查看预览'}
          </Button>
          <Button
            className={['detect-result-action', suggestion.severity === 'danger' ? 'danger' : '']
              .filter(Boolean)
              .join(' ')}
            type="button"
            data-folder-cleanup-action={suggestion.id}
            aria-label={operationLabel}
            disabled={locked || !suggestion.canExecute}
            unstyled
          >
            {operationCopy}
          </Button>
        </div>
      </div>
      <div className="detect-result-copy">
        <strong>{suggestion.title}</strong>
        <p className="detect-result-path">{suggestion.summary}</p>
        <p className="detect-result-detail">{suggestion.reason}</p>
        {suggestion.bookmarks.length ? (
          <p className="detect-result-detail">
            涉及书签：{suggestion.bookmarks.slice(0, 4).map((bookmark) => bookmark.title).join('、')}
            {suggestion.bookmarks.length > 4 ? '…' : ''}
          </p>
        ) : null}
        {suggestion.splitGroups?.length ? (
          <div className="folder-cleanup-split-preview">
            {suggestion.splitGroups.map((group) => (
              <span className="options-chip muted" key={`${suggestion.id}:${group.label}`}>
                {group.label} · {group.count}
              </span>
            ))}
          </div>
        ) : null}
        <div className={['folder-cleanup-preview', previewOpen ? '' : 'hidden'].filter(Boolean).join(' ')}>
          {suggestion.folders.map((folder) => (
            <div className="folder-cleanup-preview-row" key={folder.id}>
              <strong>{folder.path || folder.title}</strong>
              <span>{folder.descendantBookmarkCount} 个书签 · {folder.depth} 层</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

function getFolderCleanupSuggestionActionLabel(
  action: string,
  suggestion: Pick<FolderCleanupSuggestion, 'title' | 'summary'>
): string {
  const context = getFolderCleanupActionContext(suggestion?.title || suggestion?.summary, '未命名清理建议')
  return `${action}：${context}`
}

function getFolderCleanupSplitUndoActionLabel(
  action: string,
  splitUndo: Pick<FolderCleanupSplitUndo, 'title' | 'moves'>
): string {
  const context = getFolderCleanupActionContext(splitUndo?.title, '拆分超大文件夹')
  const moveCount = Array.isArray(splitUndo?.moves) ? splitUndo.moves.length : 0
  return `${action}：${context}${moveCount ? `，${moveCount} 个书签` : ''}`
}

function getFolderCleanupActionContext(value: unknown, fallback: string): string {
  const normalized = String(value || fallback)
    .replace(/\s+/g, ' ')
    .trim()
  const safeValue = normalized.length > 48
    ? `${normalized.slice(0, 47).trim()}...`
    : normalized

  return safeValue || fallback
}

function getOperationCopy(suggestion: FolderCleanupSuggestion): string {
  if (!suggestion.canExecute) {
    return '仅预览'
  }
  if (suggestion.operation === 'delete') {
    return '确认删除'
  }
  if (suggestion.operation === 'merge') {
    return '确认合并'
  }
  if (suggestion.operation === 'split') {
    return '确认拆分'
  }
  return '确认移动'
}
