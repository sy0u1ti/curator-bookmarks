import { useRef } from 'react'
import type { BackupRestorePreview } from '../../shared/backup'
import { Button } from '../../ui/base/Button'
import { CloseButton } from '../../ui/base/CloseButton'
import { DialogBackdrop, DialogBody, DialogFooter, DialogHeader, DialogOverlay, DialogPanel } from '../../ui/base/Dialog'
import { StatusMessage } from '../../ui/base/StatusMessage'
import { formatDateTime } from '../../shared/format'
import type { BackupActionDetail, BackupControlsState } from './backup-controls-types'
import { BackupBookmarkPreview } from './BackupBookmarkPreview'
import { OptionActionsMenu } from './OptionActionsMenu'
import { BACKUP_ROW_ACTIONS_CLASS } from './BackupRow'
import { OPTIONS_MODAL_BACKDROP_CLASS, OPTIONS_MODAL_TITLE_CLASS, OPTIONS_MODAL_WIDE_PANEL_CLASS } from './options-modal-classes'

const RESTORE_COPY = '恢复前自动备份；缺失书签补到恢复文件夹，保留现有书签。'

export function BackupRestoreDialog({ state, onAction }: {
  state: BackupControlsState
  onAction: (detail: BackupActionDetail) => void
}) {
  const { busy, hasBackup, preview: currentPreview, status, statusTone } = state.backup
  const retainedPreview = useRef<BackupRestorePreview | null>(null)
  if (currentPreview) retainedPreview.current = currentPreview
  // Keep the preview's geometry through the dialog exit, then let its portal
  // unmount. Removing its contents first would collapse the fading panel.
  const preview = currentPreview || retainedPreview.current
  const close = () => { if (!busy) onAction({ action: 'close-preview' }) }
  const counts = preview?.counts
  const exportedAt = preview ? Date.parse(preview.exportedAt) : NaN
  const stats: Array<[string, number | undefined, string?]> = [
    ['书签', counts?.bookmarkUrls, `缺失 ${counts?.missingBookmarkUrls || 0}`],
    ['标签', counts?.tagRecords, `可匹配 ${counts?.tagMatched || 0}`],
    ['新标签页', counts?.newTabSections],
    ['回收站', counts?.recycleEntries],
    ['忽略规则', counts?.ignoreRules],
    ['重定向历史', counts?.redirectEntries]
  ]
  return (
    <DialogOverlay className="pointer-events-none fixed inset-0 z-20 grid place-items-center p-5"
      open={Boolean(currentPreview)} onOpenChange={open => { if (!open) close() }} modal disablePointerDismissal keepMounted={false}>
      <DialogBackdrop className={OPTIONS_MODAL_BACKDROP_CLASS} onClick={close} />
      <DialogPanel layout="workspace" className={OPTIONS_MODAL_WIDE_PANEL_CLASS}
        aria-labelledby="backup-preview-title" aria-describedby="backup-preview-source">
        {preview ? <>
          <DialogHeader className="pb-4">
            <div className="flex items-start justify-between gap-3">
              <h2 id="backup-preview-title" className={OPTIONS_MODAL_TITLE_CLASS}>恢复预览</h2>
              <CloseButton label="关闭恢复预览" variant="ghost" size="icon" disabled={busy} onClick={close} />
            </div>
            <p id="backup-preview-source" className="mb-0 mt-3 text-[13px] leading-relaxed text-ds-text-secondary [overflow-wrap:anywhere]">
              {preview.fileName || '已导入备份'}
              {Number.isFinite(exportedAt) ? <span className="mt-1 block text-xs text-ds-text-muted">{formatDateTime(exportedAt)}</span> : null}
            </p>
          </DialogHeader>
          <DialogBody id="backup-restore-preview" aria-label="恢复预览" className="grid gap-4 pr-1">
            <dl className="m-0 grid grid-cols-3 gap-x-4 gap-y-3 max-[440px]:grid-cols-2">
              {stats.map(([label, value, note]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs leading-[1.5] text-ds-text-secondary">{label}</dt>
                  <dd className="m-0 mt-0.5 text-sm font-semibold tabular-nums text-ds-text-primary">
                    {value}
                    {note ? <span className="ml-1.5 text-xs font-normal text-ds-text-secondary">{note}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
            {preview.warnings.length ? (
              <ul className="m-0 grid gap-1 pl-[18px] text-[13px] leading-[1.6] text-ds-text-secondary" aria-label="恢复提示">
                {preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
              </ul>
            ) : null}
            <BackupBookmarkPreview key={`${preview.fileName}:${preview.exportedAt}`} bookmarks={preview.bookmarks} />
          </DialogBody>
          <DialogFooter className="mt-4 grid gap-3 border-t border-ds-border-subtle pt-4">
            <StatusMessage className="text-[13px] leading-[1.6] text-ds-text-secondary" reserve={[RESTORE_COPY]} tone={statusTone || 'neutral'}>
              {status || RESTORE_COPY}
            </StatusMessage>
            {hasBackup ? (
              <div className={`${BACKUP_ROW_ACTIONS_CLASS} max-[560px]:justify-end`}>
                <OptionActionsMenu label="部分恢复" triggerLabel="部分恢复" disabled={busy} actions={[
                  { id: 'bookmarks', label: '书签与标签', onSelect: () => onAction({ action: 'restore', mode: 'bookmarksOnly' }) },
                  { id: 'tags', label: '仅标签数据', onSelect: () => onAction({ action: 'restore', mode: 'tagsOnly' }) },
                  { id: 'newtab', label: '仅新标签页设置', onSelect: () => onAction({ action: 'restore', mode: 'newTabOnly' }) }
                ]} />
                <Button size="sm" variant="primary" aria-label="从备份预览恢复全部可安全恢复的数据"
                  disabled={busy} focusableWhenDisabled={busy} onClick={() => onAction({ action: 'restore', mode: 'safeFull' })}>恢复全部</Button>
              </div>
            ) : <div className="flex justify-end"><Button size="sm" variant="primary" onClick={close}>完成</Button></div>}
          </DialogFooter>
        </> : null}
      </DialogPanel>
    </DialogOverlay>
  )
}
