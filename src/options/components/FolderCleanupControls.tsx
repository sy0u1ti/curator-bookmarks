import { Button } from '../../ui/base/Button.js'
import { Card } from '../../ui/base/Card.js'
import { handleFolderCleanupAction } from '../options-controller'
import { useFolderCleanupControlsState } from './folder-cleanup-controls-store.js'
import {
  OPTION_GROUP_CLASS,
  OPTION_COPY_CLASS,
  OPTION_COPY_TEXT_CLASS,
  OPTION_COPY_TITLE_CLASS,
  OPTION_ROW_CLASS,
} from './option-layout-classes.js'

const FOLDER_CLEANUP_ACTIONS_CLASS =
  'flex min-w-0 flex-wrap items-center justify-end gap-2.5 max-[760px]:w-full max-[760px]:justify-start'
const FOLDER_CLEANUP_STATUS_BASE_CLASS =
  'inline-flex min-h-[26px] items-center whitespace-nowrap rounded-full border px-[10px] text-[11px] font-semibold leading-none tracking-[0]'
const FOLDER_CLEANUP_STATUS_TONE_CLASS = {
  muted: 'border-[var(--ui-surface-hover)] bg-[var(--ui-surface-raised)] text-[var(--ui-text-tertiary)]',
  success: 'border-[rgba(170,237,189,0.32)] bg-[rgba(170,237,189,0.16)] text-[#e2ffe9]',
  warning: 'border-[rgba(255,206,141,0.2)] bg-[rgba(255,206,141,0.12)] text-[#ffdca5]'
} as const
const FOLDER_CLEANUP_ANALYZE_BUTTON_CLASS =
  'justify-center whitespace-nowrap max-[760px]:w-full'
const FOLDER_CLEANUP_SUMMARY_GRID_CLASS =
  'mt-5 grid grid-cols-5 gap-3 max-[1180px]:grid-cols-3 max-[920px]:grid-cols-2 max-[620px]:grid-cols-1'
const FOLDER_CLEANUP_SUMMARY_CARD_CLASS =
  'min-h-[96px] rounded-[var(--ui-radius-group)] border border-[var(--ui-divider-subtle)] bg-[var(--ui-surface)] p-4 shadow-none'
const FOLDER_CLEANUP_SUMMARY_LABEL_CLASS =
  'block text-xs font-semibold leading-[1.3] text-[var(--ui-text-tertiary)]'
const FOLDER_CLEANUP_SUMMARY_VALUE_CLASS =
  'mt-2 block text-[26px] font-bold leading-none tracking-[0] text-[var(--ui-text-primary)]'
const FOLDER_CLEANUP_HEADER_CLASS =
  'mt-5 flex min-w-0 flex-wrap items-center justify-between gap-3'
const FOLDER_CLEANUP_HEADER_COPY_CLASS = 'min-w-0'
const FOLDER_CLEANUP_HEADER_TITLE_CLASS =
  'block text-[15px] font-semibold leading-[1.35] tracking-[0] text-[var(--ui-text-primary)]'
const FOLDER_CLEANUP_HEADER_SUBTITLE_CLASS =
  'mt-2 text-[13px] leading-[1.7] text-[var(--ui-text-secondary)]'

export function FolderCleanupControls() {
  const state = useFolderCleanupControlsState()
  const metrics = [
    { key: 'total', label: '建议总数', value: state.summary.total },
    { key: 'empty', label: '空文件夹', value: state.summary.empty },
    { key: 'deep', label: '深层低价值', value: state.summary.deep },
    { key: 'same-name', label: '同名合并', value: state.summary.sameName },
    { key: 'large', label: '超大拆分', value: state.summary.large }
  ]

  return (
    <>
      <div className={OPTION_GROUP_CLASS}>
        <div className={OPTION_ROW_CLASS}>
          <div className={OPTION_COPY_CLASS}>
            <strong className={OPTION_COPY_TITLE_CLASS}>建议和预览优先</strong>
            <p className={OPTION_COPY_TEXT_CLASS}>先重新读取当前 Chrome 书签树，再扫描空文件夹、深层低价值文件夹、单一路径、同名文件夹和超大文件夹；删除、合并、移动和拆分都会在确认后执行，并先调用自动备份 hook。拆分会记录本次移动，可在建议区撤销本次拆分。</p>
          </div>
          <div className={FOLDER_CLEANUP_ACTIONS_CLASS}>
            <span
              className={`${FOLDER_CLEANUP_STATUS_BASE_CLASS} ${FOLDER_CLEANUP_STATUS_TONE_CLASS[state.status.tone]}`}
            >
              {state.status.label}
            </span>
            <Button
              className={FOLDER_CLEANUP_ANALYZE_BUTTON_CLASS}
              size="sm"
              type="button"
              variant="primary"
              disabled={state.analyzeDisabled}
              focusableWhenDisabled={state.analyzeLabel === '扫描中...'}
              onClick={() => handleFolderCleanupAction({ action: 'rescan' })}
            >
              {state.analyzeLabel}
            </Button>
          </div>
        </div>
      </div>

      <div className={FOLDER_CLEANUP_SUMMARY_GRID_CLASS}>
        {metrics.map((metric) => (
          <Card className={FOLDER_CLEANUP_SUMMARY_CARD_CLASS} key={metric.key}>
            <span className={FOLDER_CLEANUP_SUMMARY_LABEL_CLASS}>{metric.label}</span>
            <strong className={FOLDER_CLEANUP_SUMMARY_VALUE_CLASS}>{metric.value}</strong>
          </Card>
        ))}
      </div>

      <div className={FOLDER_CLEANUP_HEADER_CLASS}>
        <div className={FOLDER_CLEANUP_HEADER_COPY_CLASS}>
          <strong className={FOLDER_CLEANUP_HEADER_TITLE_CLASS}>清理建议</strong>
          <p className={FOLDER_CLEANUP_HEADER_SUBTITLE_CLASS}>
            {state.resultsSubtitle}
          </p>
        </div>
      </div>
    </>
  )
}
