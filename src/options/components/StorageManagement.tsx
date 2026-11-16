import { useCallback, useEffect, useRef, useState } from 'react'
import { AiProviderCard } from '../../ui/ai/AiProviderCard'
import { Button } from '../../ui/base/Button.js'
import { StableLabel, StatusMessage } from '../../ui/base/StatusMessage.js'
import { STORAGE_KEYS } from '../../shared/constants.js'
import { formatBytes as size } from '../../shared/format.js'
import { requestStorageUsage } from '../../shared/messages.js'
import { ensureBackgroundReady, isBackgroundRuntimeError, openExtensionManager } from '../../shared/background-runtime.js'
import { cleanStorageCategory, type StorageCleanupCategory, type StorageUsage } from '../../shared/storage-maintenance.js'
import {
  AI_SETTINGS_BODY_CLASS,
  AI_SETTINGS_CARD_CLASS,
  AI_SETTINGS_HEADER_CLASS,
  AI_SETTINGS_SUBTITLE_CLASS,
  AI_SETTINGS_TITLE_CLASS
} from './ai-settings-card-classes.js'
import { BACKUP_CARD_COPY_CLASS, BACKUP_ROW_DETAIL_CLASS, BackupRow } from './BackupRow.js'

export function StorageManagement() {
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const [busy, setBusy] = useState(true)
  const [status, setStatus] = useState('')
  const [failed, setFailed] = useState(false)
  const [needsReload, setNeedsReload] = useState(false)
  const [storageIssue, setStorageIssue] = useState('')
  const generation = useRef(0)
  const pending = useRef(false)
  const run = useCallback(async (category?: StorageCleanupCategory) => {
    if (pending.current) return
    pending.current = true
    const request = ++generation.current
    setBusy(true)
    setStatus('')
    setFailed(false)
    let message = ''
    try {
      await ensureBackgroundReady()
      message = category ? await cleanStorageCategory(category) : ''
      const next = await requestStorageUsage()
      if (request !== generation.current) return
      setUsage(next)
      setNeedsReload(false)
      setStatus(message)
    } catch (error) {
      if (request === generation.current) {
        const detail = error instanceof Error ? error.message : '请重试。'
        setFailed(true)
        setNeedsReload(isBackgroundRuntimeError(error))
        setStatus(message ? `${message} 用量刷新失败：${detail}` : `用量读取或清理失败：${detail}`)
      }
    } finally {
      if (request === generation.current) { pending.current = false; setBusy(false) }
    }
  }, [])
  useEffect(() => {
    void run()
    void chrome.storage.local.get(STORAGE_KEYS.storageIssue).then((stored) => {
      const issue = stored?.[STORAGE_KEYS.storageIssue] as { message?: string } | undefined
      setStorageIssue(String(issue?.message || ''))
    }).catch(() => {})
    return () => { generation.current++; pending.current = false }
  }, [run])
  const clean = (category: StorageCleanupCategory) => run(category)
  const summary = usage
    ? `配置与搜索索引约 ${size(usage.localBytes)}${usage.originBytes !== null ? `，站点存储约 ${size(usage.originBytes)}` : ''}`
    : busy ? '正在读取用量…' : '用量暂不可用'

  return (
    <AiProviderCard
      as="section"
      id="settings-storage"
      aria-labelledby="storage-management-title"
      aria-busy={busy || undefined}
      className={AI_SETTINGS_CARD_CLASS}
      title={<h2 id="storage-management-title" className={AI_SETTINGS_TITLE_CLASS}>存储空间</h2>}
      description={
        <StatusMessage className={AI_SETTINGS_SUBTITLE_CLASS} reserve={[summary]} tone={failed ? 'error' : 'neutral'}>
          {status || summary}
        </StatusMessage>
      }
      status={
        <Button size="sm" variant="secondary" aria-label={needsReload ? '打开扩展管理' : '刷新用量'} disabled={busy}
          onClick={() => needsReload ? void openExtensionManager() : void run()}>
          <StableLabel reserve={['刷新', '扩展管理']} text={needsReload ? '扩展管理' : '刷新'} />
        </Button>
      }
      headerClassName={AI_SETTINGS_HEADER_CLASS}
      copyClassName={BACKUP_CARD_COPY_CLASS}
      iconName="HardDrive"
      bodyClassName={AI_SETTINGS_BODY_CLASS}
    >
      {storageIssue ? (
        <p role="alert" className="m-0 px-4 py-3 text-[13px] leading-[1.55] text-ds-warning">{storageIssue}</p>
      ) : null}
      {usage ? <>
        {usage.sync?.profiles || usage.sync?.logLines ? <BackupRow title="同步数据"
          detail={<p className={BACKUP_ROW_DETAIL_CLASS}>{usage.sync.profiles} 项配置 · {size(usage.sync.bytes)} · 日志 {size(usage.sync.logBytes)}</p>}>
          <Button size="sm" variant="secondary" disabled={busy || !usage.sync.logLines} aria-label="清除同步日志"
            onClick={() => void clean('sync-logs')}>清除日志</Button>
        </BackupRow> : null}
        <BackupRow title="自定义图标" detail={<p className={BACKUP_ROW_DETAIL_CLASS}>{usage.icons.count} 张 · {size(usage.icons.bytes)}{usage.icons.unused ? ` · ${usage.icons.unused} 张闲置` : ''}</p>}>
          <Button size="sm" variant="secondary" disabled={busy || !usage.icons.unused} aria-label="清理闲置图标" onClick={() => void clean('icons')}>清理</Button>
        </BackupRow>
        {usage.missingIcons > 0 ? (
          <BackupRow title={`${usage.missingIcons} 张图标无法读取`} detail={<p className={BACKUP_ROW_DETAIL_CLASS}>已改用站点图标</p>}>
            <Button size="sm" variant="secondary" disabled={busy} aria-label="移除失效图标引用" onClick={() => void clean('missing-icons')}>移除引用</Button>
          </BackupRow>
        ) : null}
        <BackupRow title="本地正文" detail={<p className={BACKUP_ROW_DETAIL_CLASS}>{usage.fullText.count} 份 · {size(usage.fullText.bytes)} · 清除后无法按正文检索</p>}>
          <Button size="sm" variant="secondary" disabled={busy || !usage.fullText.count} aria-label="清除本地正文" onClick={() => void clean('full-text')}>清除</Button>
        </BackupRow>
        <BackupRow title="壁纸预览缓存" detail={<p className={BACKUP_ROW_DETAIL_CLASS}>{size(usage.previewBytes)}</p>}>
          <Button size="sm" variant="secondary" disabled={busy || !usage.previewBytes} aria-label="清除预览缓存" onClick={() => void clean('previews')}>清除</Button>
        </BackupRow>
      </> : null}
    </AiProviderCard>
  )
}
