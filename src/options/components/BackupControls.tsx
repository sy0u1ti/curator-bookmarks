import { useRef, useState } from 'react'
import { AiProviderCard } from '../../ui/ai/AiProviderCard'
import { Button } from '../../ui/base/Button'
import { StatusButton } from '../../ui/actions/StatusButton'
import { StatusMessage } from '../../ui/base/StatusMessage'
import { Input } from '../../ui/base/Input'
import { Popover } from '../../ui/base/Popover'
import { Icon } from '../../ui/icons/Icon'
import { handleBackupAction } from '../options-controller'
import { useBackupControlsState } from './backup-controls-store.js'
import type { BackupActionDetail, BackupControlsState } from './backup-controls-types.js'
import {
  AI_SETTINGS_CARD_CLASS,
  AI_SETTINGS_HEADER_CLASS,
  AI_SETTINGS_SUBTITLE_CLASS,
  AI_SETTINGS_TITLE_CLASS
} from './ai-settings-card-classes.js'
import { BACKUP_CARD_COPY_CLASS } from './BackupRow.js'
import { OptionActionsMenu } from './OptionActionsMenu.js'
import { AutoBackupPoints } from './AutoBackupPoints.js'
import { BackupRestoreDialog } from './BackupRestoreDialog.js'
import { StorageManagement } from './StorageManagement.js'
import { SyncCard } from './SyncCard.js'

const BACKUP_SCOPE = '书签、标签、规则和设置'
const BACKUP_LABELS = { idle: '备份到文件', pending: '正在备份', success: '已备份', error: '重试备份' }

export function BackupControls() {
  const state = useBackupControlsState()
  return (
    <>
      <SyncCard />
      <BackupCard state={state} />
      <StorageManagement />
    </>
  )
}

function BackupCard({ state }: { state: BackupControlsState }) {
  const tagImportInput = useRef<HTMLInputElement | null>(null)
  const backupImportInput = useRef<HTMLInputElement | null>(null)
  const [activity, setActivity] = useState<BackupActionDetail['action']>('export-backup')
  const { backup, tagData } = state
  const busy = backup.busy || tagData.busy
  const dispatch = (detail: BackupActionDetail) => {
    setActivity(detail.action)
    handleBackupAction(detail)
  }
  const tagAction = ['export-tags', 'import-tags', 'clear-tags'].includes(activity)
  const exporting = activity === 'export-backup' || activity === 'export-html'
  const feedback = activity === 'export-html' ? backup.htmlExportFeedback : backup.exportFeedback
  const message = tagAction ? tagData.status : exporting ? backup.exportStatus : backup.status
  const tone = tagAction ? tagData.statusTone || (tagData.exportFeedback.status === 'error' ? 'error' : 'neutral')
    : exporting ? feedback.status === 'error' ? 'error' : 'neutral' : backup.statusTone || 'neutral'

  return (
    <>
      <AiProviderCard
        as="section"
        id="settings-full-backup"
        aria-labelledby="backup-export-title"
        className={AI_SETTINGS_CARD_CLASS}
        title={
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 id="backup-export-title" className={AI_SETTINGS_TITLE_CLASS}>备份与恢复</h2>
            <Popover title="备份范围" align="start" showArrow={false} collisionPadding={16}
              trigger={<Button variant="ghost" size="icon-xs" className="-my-1" aria-label="查看备份范围">
                <Icon name="CircleHelp" size={14} aria-hidden="true" />
              </Button>}>
              <p className="m-0 text-[13px] leading-relaxed text-ds-text-secondary">
                保存全部书签、标签、整理规则和设置，包括自定义图标。
              </p>
              <p className="m-0 text-[13px] leading-relaxed text-ds-text-secondary">
                不包含 API Key、密码、Cookie、同步配置、正文索引、本地壁纸和 MHTML 存档。同步配置可在上方“同步”的菜单中导出。
              </p>
            </Popover>
          </div>
        }
        description={
          <StatusMessage id="backup-action-status" className={AI_SETTINGS_SUBTITLE_CLASS} reserve={[BACKUP_SCOPE]} tone={tone}>
            {backup.preview ? BACKUP_SCOPE : message || BACKUP_SCOPE}
          </StatusMessage>
        }
        status={
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StatusButton size="sm" variant="primary" aria-label="备份到文件" feedback={backup.exportFeedback}
              icon="Download" labels={BACKUP_LABELS} disabled={busy} focusableWhenDisabled={busy}
              onClick={() => dispatch({ action: 'export-backup' })} />
            <Button size="sm" variant="secondary" aria-label="从文件恢复" disabled={busy} focusableWhenDisabled={busy}
              onClick={() => backupImportInput.current?.click()}>
              <Icon name="Upload" size={14} aria-hidden="true" /> 从文件恢复
            </Button>
            <span id="settings-tag-data">
              <OptionActionsMenu label="其他备份操作" iconOnly disabled={busy} actions={[
                { id: 'html', label: '导出 HTML 书签', icon: 'Globe', onSelect: () => dispatch({ action: 'export-html' }) },
                { id: 'tags-export', label: '导出标签数据', icon: 'Tag', disabled: !tagData.hasRecords, separatorBefore: true,
                  onSelect: () => dispatch({ action: 'export-tags' }) },
                { id: 'tags-import', label: '导入标签数据', icon: 'Upload', onSelect: () => tagImportInput.current?.click() },
                { id: 'tags-clear', label: '清空标签数据', icon: 'Trash2', danger: true, disabled: !tagData.hasRecords, separatorBefore: true,
                  onSelect: () => dispatch({ action: 'clear-tags' }) }
              ]} />
            </span>
            <Input ref={backupImportInput} aria-label="导入完整备份文件" type="file" accept="application/json,.json" hidden
              onChange={event => {
                dispatch({ action: 'import-backup', file: event.currentTarget.files?.[0] })
                event.currentTarget.value = ''
              }} />
            <Input ref={tagImportInput} aria-label="导入书签标签数据文件" type="file" accept="application/json,.json" hidden
              onChange={event => {
                dispatch({ action: 'import-tags', file: event.currentTarget.files?.[0] })
                event.currentTarget.value = ''
              }} />
          </div>
        }
        headerClassName={AI_SETTINGS_HEADER_CLASS}
        copyClassName={BACKUP_CARD_COPY_CLASS}
        iconName="Save"
        bodyClassName="px-5 py-4 max-[760px]:px-4"
      >
        <AutoBackupPoints busy={busy} onPreview={backupId => dispatch({ action: 'preview-auto-backup', backupId })} />
      </AiProviderCard>
      <BackupRestoreDialog state={state} onAction={dispatch} />
    </>
  )
}
