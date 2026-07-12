import { useRef } from 'react'
import { Button } from '../../ui/base/Button'
import { Input } from '../../ui/base/Input'
import { handleBackupAction } from '../options-controller'
import { useBackupControlsState } from './backup-controls-store.js'
import type { BackupControlsState, BackupPreviewState } from './backup-controls-types.js'
import { OPTION_VALUE_CLASS } from './option-layout-classes.js'
import { OptionEmptyState } from './OptionEmptyState.js'

const BACKUP_CARD_CLASS =
  'mt-7 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px_16px]'
const BACKUP_HEADER_CLASS =
  'flex flex-wrap items-start justify-between gap-4'
const BACKUP_HEAD_CLASS = `${BACKUP_HEADER_CLASS} border-b border-ds-border-subtle pb-[14px]`
const BACKUP_ROW_CLASS = `${BACKUP_HEADER_CLASS} pt-[14px]`
const BACKUP_COPY_COLUMN_CLASS = 'min-w-0'
const BACKUP_TITLE_CLASS =
  'block text-[15px] font-semibold leading-normal tracking-[0] text-ds-text-primary'
const BACKUP_COPY_CLASS =
  'mt-2 mb-0 max-w-[680px] text-[13px] leading-[1.55] text-ds-text-secondary'
const BACKUP_STATUS_CLASS =
  'mt-2 mb-0 max-w-[680px] text-[13px] leading-[1.55] text-ds-text-secondary'
const BACKUP_ROW_ACTIONS_CLASS =
  'flex min-w-0 flex-wrap items-center justify-end gap-2.5 self-end max-[760px]:justify-start'
const BACKUP_PREVIEW_LIST_CLASS = 'mt-4 flex flex-col gap-3'
const BACKUP_EMPTY_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[14px_16px] text-[13px] leading-[1.55] text-ds-text-secondary'
const BACKUP_PREVIEW_CARD_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[14px_16px]'
const BACKUP_PREVIEW_COPY_CLASS = 'mt-0 min-w-0'
const BACKUP_PREVIEW_TITLE_CLASS =
  'block min-w-0 text-[15px] font-semibold leading-[1.4] text-ds-text-primary [overflow-wrap:anywhere]'
const BACKUP_PREVIEW_DETAIL_CLASS =
  'mt-[7px] mb-0 text-[13px] leading-[1.6] text-ds-text-secondary [overflow-wrap:anywhere] [word-break:break-word]'
const BACKUP_WARNING_LIST_CLASS =
  'mt-[10px] mb-0 pl-[18px] text-[13px] leading-[1.65] text-ds-text-secondary [&_li+li]:mt-1'

export function BackupControls() {
  const state = useBackupControlsState()

  return <BackupControlsContent state={state} />
}

function BackupControlsContent({ state }: { state: BackupControlsState }) {
  const tagImportInputRef = useRef<HTMLInputElement | null>(null)
  const backupImportInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <>
      <div className={BACKUP_CARD_CLASS}>
        <div className={BACKUP_HEAD_CLASS}>
          <div className={BACKUP_COPY_COLUMN_CLASS}>
            <strong className={BACKUP_TITLE_CLASS}>标签数据</strong>
            <p className={BACKUP_COPY_CLASS}>
              保存 AI 摘要、别名和标签；清空不会删除 Chrome 书签。
            </p>
          </div>
          <span className={OPTION_VALUE_CLASS}>{state.tagData.countLabel}</span>
        </div>
        <div className={BACKUP_ROW_CLASS}>
          <div className={BACKUP_COPY_COLUMN_CLASS}>
            <p className={BACKUP_COPY_CLASS}>{state.tagData.updatedLabel}</p>
            {state.tagData.status ? (
              <p className={BACKUP_STATUS_CLASS}>{state.tagData.status}</p>
            ) : null}
          </div>
          <div className={BACKUP_ROW_ACTIONS_CLASS}>
            {state.tagData.hasRecords ? (
              <Button
                size="sm"
                type="button"
                variant="secondary"
                aria-label="导出书签标签数据"
                disabled={state.tagData.busy}
                focusableWhenDisabled={state.tagData.busy}
                onClick={() => handleBackupAction({ action: 'export-tags' })}
              >
                导出标签数据
              </Button>
            ) : null}
            <Button
              size="sm"
              type="button"
              variant="secondary"
              aria-label="导入书签标签数据"
              disabled={state.tagData.busy}
              focusableWhenDisabled={state.tagData.busy}
              onClick={() => tagImportInputRef.current?.click()}
            >
              导入标签数据
            </Button>
            {state.tagData.hasRecords ? (
              <Button
                size="sm"
                type="button"
                variant="danger"
                aria-label="清空全部书签标签数据"
                disabled={state.tagData.busy}
                focusableWhenDisabled={state.tagData.busy}
                onClick={() => handleBackupAction({ action: 'clear-tags' })}
              >
                清空标签数据
              </Button>
            ) : null}
          </div>
          <Input
            ref={tagImportInputRef}
            aria-label="导入书签标签数据文件"
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              handleBackupAction({ action: 'import-tags', file: event.currentTarget.files?.[0] })
              event.currentTarget.value = ''
            }}
          />
        </div>
      </div>

      <div className={BACKUP_CARD_CLASS}>
        <div className={BACKUP_HEAD_CLASS}>
          <div className={BACKUP_COPY_COLUMN_CLASS}>
            <strong className={BACKUP_TITLE_CLASS}>完整备份</strong>
            <p className={BACKUP_COPY_CLASS}>
              导出书签、标签、规则和设置；不包含 API Key、密码或 Cookie。
            </p>
          </div>
          <div className={BACKUP_ROW_ACTIONS_CLASS}>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              aria-label="导出完整书签备份"
              disabled={state.backup.busy}
              focusableWhenDisabled={state.backup.busy}
              onClick={() => handleBackupAction({ action: 'export-backup' })}
            >
              导出完整备份
            </Button>
            <Button
              size="sm"
              type="button"
              variant="primary"
              aria-label="导入完整备份并预览"
              disabled={state.backup.busy}
              focusableWhenDisabled={state.backup.busy}
              onClick={() => backupImportInputRef.current?.click()}
            >
              导入并预览
            </Button>
          </div>
          <Input
            ref={backupImportInputRef}
            aria-label="导入完整备份文件"
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              handleBackupAction({ action: 'import-backup', file: event.currentTarget.files?.[0] })
              event.currentTarget.value = ''
            }}
          />
        </div>
        {state.backup.status ? (
          <p className={BACKUP_STATUS_CLASS}>{state.backup.status}</p>
        ) : null}
      </div>

      <div className={BACKUP_CARD_CLASS}>
        <div className={BACKUP_ROW_CLASS}>
          <div className={BACKUP_COPY_COLUMN_CLASS}>
            <strong className={BACKUP_TITLE_CLASS}>恢复预览</strong>
            <p className={BACKUP_COPY_CLASS}>
              先查看差异，再选择恢复范围；完整恢复只补齐缺失书签。
            </p>
          </div>
          {state.backup.hasBackup ? (
            <div className={BACKUP_ROW_ACTIONS_CLASS}>
              <Button
                size="sm"
                type="button"
                variant="secondary"
                aria-label="从备份预览只恢复书签标签数据"
                disabled={state.backup.busy}
                focusableWhenDisabled={state.backup.busy}
                onClick={() => handleBackupAction({ action: 'restore', mode: 'tagsOnly' })}
              >
                只恢复标签数据
              </Button>
              <Button
                size="sm"
                type="button"
                variant="secondary"
                aria-label="从备份预览只恢复新标签页设置"
                disabled={state.backup.busy}
                focusableWhenDisabled={state.backup.busy}
                onClick={() => handleBackupAction({ action: 'restore', mode: 'newTabOnly' })}
              >
                只恢复新标签页设置
              </Button>
              <Button
                size="sm"
                type="button"
                variant="primary"
                aria-label="从备份预览恢复全部可安全恢复的数据"
                disabled={state.backup.busy}
                focusableWhenDisabled={state.backup.busy}
                onClick={() => handleBackupAction({ action: 'restore', mode: 'safeFull' })}
              >
                安全恢复全部
              </Button>
            </div>
          ) : null}
        </div>
        <div className={BACKUP_PREVIEW_LIST_CLASS}>
          <BackupPreview
            state={{ preview: state.backup.preview }}
            onImportPreview={() => backupImportInputRef.current?.click()}
          />
        </div>
      </div>
    </>
  )
}

function BackupPreview({
  onImportPreview,
  state
}: {
  onImportPreview: () => void
  state: BackupPreviewState
}) {
  if (!state.preview) {
    return (
      <OptionEmptyState
        title="先导入备份文件"
        description="导入后先显示差异与风险，确认后才提供恢复操作。"
        actions={[{ label: '导入并预览', onClick: onImportPreview, variant: 'primary' }]}
        className={BACKUP_EMPTY_CLASS}
      />
    )
  }

  const { counts } = state.preview

  return (
    <article className={BACKUP_PREVIEW_CARD_CLASS}>
      <div className={BACKUP_PREVIEW_COPY_CLASS}>
        <strong className={BACKUP_PREVIEW_TITLE_CLASS}>{state.preview.fileName || '已导入备份文件'}</strong>
        <div className={BACKUP_PREVIEW_DETAIL_CLASS}>
          导出时间：{state.preview.exportedAt || '未知'} · 扩展版本：{state.preview.extensionVersion || '未知'}
        </div>
        <div className={BACKUP_PREVIEW_DETAIL_CLASS}>
          书签 URL：{counts.bookmarkUrls}，当前缺失：{counts.missingBookmarkUrls}；标签记录：
          {counts.tagRecords}，可匹配：{counts.tagMatched}，无法匹配：{counts.tagUnmatched}
        </div>
        <div className={BACKUP_PREVIEW_DETAIL_CLASS}>
          回收站：{counts.recycleEntries}；忽略规则：{counts.ignoreRules}；重定向历史：
          {counts.redirectEntries}；新标签页配置：{counts.newTabSections}
        </div>
        {state.preview.warnings.length ? (
          <ul className={BACKUP_WARNING_LIST_CLASS}>
            {state.preview.warnings.map((warning, index) => (
              <li key={`${index}:${warning}`}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className={BACKUP_PREVIEW_DETAIL_CLASS}>未发现阻塞恢复的问题。</p>
        )}
      </div>
    </article>
  )
}
