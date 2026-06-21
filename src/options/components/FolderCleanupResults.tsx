import { Button } from '../../ui'
import type {
  FolderCleanupSplitUndo,
  FolderCleanupSuggestion
} from '../../shared/folder-cleanup.js'
import { handleFolderCleanupAction } from '../options-controller'
import { useFolderCleanupResultsState } from './folder-cleanup-results-store.js'

const KIND_LABELS = {
  'empty-folder': '空文件夹',
  'deep-single-bookmark': '深层单书签',
  'single-path-chain': '单一路径',
  'same-name-folders': '同名合并',
  'large-folder-split': '超大拆分'
}

const FOLDER_CLEANUP_RESULTS_CLASS = 'mt-4 flex flex-col gap-3'
const FOLDER_CLEANUP_EMPTY_CLASS =
  'rounded-lg border border-[var(--ui-divider-subtle)] bg-[#171719] px-4 py-[18px] text-[13px] leading-[1.7] text-[var(--ui-text-secondary)]'
const FOLDER_CLEANUP_CARD_CLASS =
  'rounded-lg border border-[var(--ui-divider-subtle)] bg-[#171719] p-[14px_16px]'
const SPLIT_UNDO_CARD_CLASS =
  'rounded-lg border border-[rgba(255,206,141,0.2)] bg-[rgba(255,206,141,0.08)] p-[14px_16px]'
const FOLDER_CLEANUP_CARD_HEAD_CLASS =
  'flex min-w-0 items-start justify-between gap-3'
const FOLDER_CLEANUP_ACTIONS_CLASS =
  'flex min-w-0 flex-wrap items-center justify-end gap-2.5'
const FOLDER_CLEANUP_BADGE_BASE_CLASS =
  'inline-flex min-h-[26px] items-center whitespace-nowrap rounded-full border px-[10px] text-[11px] font-semibold leading-none tracking-[0]'
const FOLDER_CLEANUP_BADGE_TONE_CLASS = {
  danger: 'border-[rgba(255,138,130,0.22)] bg-[rgba(255,138,130,0.12)] text-[#ffb7b0]',
  info: 'border-[var(--ui-surface-hover)] bg-[var(--ui-surface-raised)] text-[var(--ui-text-tertiary)]',
  muted: 'border-[var(--ui-surface-hover)] bg-[var(--ui-surface-raised)] text-[var(--ui-text-tertiary)]',
  warning: 'border-[rgba(255,206,141,0.2)] bg-[rgba(255,206,141,0.12)] text-[#ffdca5]'
} as const
const FOLDER_CLEANUP_ACTION_BUTTON_CLASS =
  'border-0 bg-transparent p-0 font-[inherit] text-xs font-semibold text-[var(--ui-text-disabled)] transition-colors hover:text-[var(--ui-text-secondary)] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus-ring)] disabled:cursor-default disabled:opacity-50 data-disabled:cursor-default data-disabled:opacity-50'
const FOLDER_CLEANUP_DANGER_ACTION_BUTTON_CLASS =
  `${FOLDER_CLEANUP_ACTION_BUTTON_CLASS} text-[#ffb7b0] hover:text-[#ffe7e3]`
const FOLDER_CLEANUP_COPY_CLASS = 'mt-3 min-w-0'
const FOLDER_CLEANUP_TITLE_CLASS =
  'block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold leading-[1.35] text-[var(--ui-text-primary)] max-[760px]:whitespace-normal'
const FOLDER_CLEANUP_PATH_CLASS =
  'mt-1 min-w-0 [overflow-wrap:anywhere] text-[13px] leading-[1.55] text-[var(--ui-text-secondary)]'
const FOLDER_CLEANUP_DETAIL_CLASS =
  'mt-1 min-w-0 [overflow-wrap:anywhere] text-[13px] leading-[1.55] text-[var(--ui-text-disabled)]'
const SPLIT_PREVIEW_CLASS = 'mt-3 flex flex-wrap gap-2'
const PREVIEW_CLASS = 'mt-3 grid gap-2 border-t border-[var(--ui-divider-subtle)] pt-3'
const PREVIEW_ROW_CLASS =
  'flex min-w-0 items-center justify-between gap-3 text-xs leading-[1.5] text-[var(--ui-text-disabled)]'
const PREVIEW_ROW_TITLE_CLASS =
  'min-w-0 [overflow-wrap:anywhere] !text-[13px] !font-semibold !text-[var(--ui-text-secondary)]'

export function FolderCleanupResults() {
  const state = useFolderCleanupResultsState()

  if (!state.suggestions.length && !state.splitUndo) {
    return (
      <div className={FOLDER_CLEANUP_RESULTS_CLASS}>
        <div className={FOLDER_CLEANUP_EMPTY_CLASS}>{state.emptyMessage}</div>
      </div>
    )
  }

  return (
    <div className={FOLDER_CLEANUP_RESULTS_CLASS}>
      {state.splitUndo ? <SplitUndoNotice locked={state.locked} splitUndo={state.splitUndo} /> : null}
      {state.suggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          locked={state.locked}
          previewOpen={state.selectedSuggestionId === suggestion.id}
          suggestion={suggestion}
        />
      ))}
    </div>
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
    <article className={SPLIT_UNDO_CARD_CLASS}>
      <div className={FOLDER_CLEANUP_CARD_HEAD_CLASS}>
        <span className={`${FOLDER_CLEANUP_BADGE_BASE_CLASS} ${FOLDER_CLEANUP_BADGE_TONE_CLASS.warning}`}>可撤销拆分</span>
        <div className={FOLDER_CLEANUP_ACTIONS_CLASS}>
          <Button
            className={FOLDER_CLEANUP_ACTION_BUTTON_CLASS}
            type="button"
            aria-label={undoLabel}
            disabled={locked}
            onClick={() => handleFolderCleanupAction({ action: 'undo-split' })}
            unstyled
          >
            撤销本次拆分
          </Button>
        </div>
      </div>
      <div className={FOLDER_CLEANUP_COPY_CLASS}>
        <strong className={FOLDER_CLEANUP_TITLE_CLASS}>{splitUndo.title}</strong>
        <p className={FOLDER_CLEANUP_DETAIL_CLASS}>
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
      : 'info'

  return (
    <article className={FOLDER_CLEANUP_CARD_CLASS}>
      <div className={FOLDER_CLEANUP_CARD_HEAD_CLASS}>
        <span className={`${FOLDER_CLEANUP_BADGE_BASE_CLASS} ${FOLDER_CLEANUP_BADGE_TONE_CLASS[severityClass]}`}>{KIND_LABELS[suggestion.kind]}</span>
        <div className={FOLDER_CLEANUP_ACTIONS_CLASS}>
          <Button
            className={FOLDER_CLEANUP_ACTION_BUTTON_CLASS}
            type="button"
            aria-label={previewLabel}
            onClick={() => handleFolderCleanupAction({
              action: 'preview',
              suggestionId: suggestion.id
            })}
            unstyled
          >
            {previewOpen ? '收起预览' : '查看预览'}
          </Button>
          <Button
            className={suggestion.severity === 'danger'
              ? FOLDER_CLEANUP_DANGER_ACTION_BUTTON_CLASS
              : FOLDER_CLEANUP_ACTION_BUTTON_CLASS}
            type="button"
            aria-label={operationLabel}
            disabled={locked || !suggestion.canExecute}
            onClick={() => handleFolderCleanupAction({
              action: 'execute',
              suggestionId: suggestion.id
            })}
            unstyled
          >
            {operationCopy}
          </Button>
        </div>
      </div>
      <div className={FOLDER_CLEANUP_COPY_CLASS}>
        <strong className={FOLDER_CLEANUP_TITLE_CLASS}>{suggestion.title}</strong>
        <p className={FOLDER_CLEANUP_PATH_CLASS}>{suggestion.summary}</p>
        <p className={FOLDER_CLEANUP_DETAIL_CLASS}>{suggestion.reason}</p>
        {suggestion.bookmarks.length ? (
          <p className={FOLDER_CLEANUP_DETAIL_CLASS}>
            涉及书签：{suggestion.bookmarks.slice(0, 4).map((bookmark) => bookmark.title).join('、')}
            {suggestion.bookmarks.length > 4 ? '…' : ''}
          </p>
        ) : null}
        {suggestion.splitGroups?.length ? (
          <div className={SPLIT_PREVIEW_CLASS}>
            {suggestion.splitGroups.map((group) => (
              <span
                className={`${FOLDER_CLEANUP_BADGE_BASE_CLASS} ${FOLDER_CLEANUP_BADGE_TONE_CLASS.muted}`}
                key={`${suggestion.id}:${group.label}`}
              >
                {group.label} · {group.count}
              </span>
            ))}
          </div>
        ) : null}
        {previewOpen ? (
          <div className={PREVIEW_CLASS}>
            {suggestion.folders.map((folder) => (
              <div className={PREVIEW_ROW_CLASS} key={folder.id}>
                <strong className={PREVIEW_ROW_TITLE_CLASS}>{folder.path || folder.title}</strong>
                <span>{folder.descendantBookmarkCount} 个书签 · {folder.depth} 层</span>
              </div>
            ))}
          </div>
        ) : null}
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
