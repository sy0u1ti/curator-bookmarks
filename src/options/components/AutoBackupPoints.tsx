import { OPTION_SURFACE_CLASS, OPTION_INSET_CLASS } from './option-layout-classes.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { listAutoBackupPoints, type AutoBackupIndexEntry } from '../../shared/backup'
import { STORAGE_KEYS } from '../../shared/constants'
import { formatBytes, formatDateTime } from '../../shared/format'
import { Button } from '../../ui/base/Button'
import { StatusMessage } from '../../ui/base/StatusMessage'
import { Icon } from '../../ui/icons/Icon'
import { handleBackupAction } from '../options-controller'

const AUTO_BACKUP_COPY = '整理前的本地备份。选中后先比较差异，再选择恢复范围。'

export function AutoBackupPoints({ busy }: { busy: boolean }) {
  const [points, setPoints] = useState<AutoBackupIndexEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const refresh = useCallback(async () => {
    const request = ++generation.current
    setLoading(true)
    try {
      const next = await listAutoBackupPoints()
      if (request !== generation.current) return
      setPoints(next)
      setError('')
    } catch (reason) {
      if (request === generation.current) setError(reason instanceof Error ? reason.message : '恢复点读取失败，请重试。')
    } finally {
      if (request === generation.current) {
        setLoading(false)
      }
    }
  }, [])
  useEffect(() => {
    void refresh()
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[STORAGE_KEYS.autoBackupIndex]) void refresh()
    }
    chrome.storage.onChanged.addListener(changed)
    return () => {
      generation.current++
      chrome.storage.onChanged.removeListener(changed)
    }
  }, [refresh])

  return (
    <section id="settings-recovery-points" className={`mt-7 ${OPTION_SURFACE_CLASS} p-5`} aria-labelledby="recovery-points-title" aria-busy={loading}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="recovery-points-title" className="text-[15px] font-semibold text-ds-text-primary">自动恢复点</h2>
          <StatusMessage className="mt-2 text-[13px] leading-relaxed text-ds-text-secondary" reserve={[AUTO_BACKUP_COPY]} tone={error ? 'error' : 'neutral'}>
            {error || AUTO_BACKUP_COPY}
          </StatusMessage>
        </div>
        <Button size="sm" variant="secondary" disabled={loading || busy} onClick={() => void refresh()} aria-label="刷新自动恢复点">
          <Icon name="RefreshCw" size={14} />刷新
        </Button>
      </div>
      {!points.length ? <p className="mt-4 text-sm text-ds-text-secondary" role="status">{loading ? '正在读取恢复点…' : '暂无自动恢复点。批量清理、整理或恢复数据前会自动创建。'}</p> : (
        <ul className="mt-4 grid list-none gap-3 p-0" aria-label="可用的自动恢复点">
          {points.map(point => (
            <li key={point.backupId} className={`flex min-w-0 flex-wrap items-center justify-between gap-3 ${OPTION_INSET_CLASS} p-3`}>
              <div className="min-w-0 flex-1 basis-52">
                <strong className="block break-words text-sm text-ds-text-primary">{point.operationReason || '自动恢复点'}</strong>
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-ds-text-secondary"><time dateTime={new Date(point.createdAt).toISOString()}>{formatDateTime(point.createdAt)}</time><span className="tabular-nums">{formatBytes(point.sizeBytes || 0)}</span></p>
              </div>
              <Button size="sm" variant="secondary" disabled={busy} aria-label={`预览恢复点：${point.operationReason || '自动恢复点'}`} onClick={() => handleBackupAction({ action: 'preview-auto-backup', backupId: point.backupId })}>
                <Icon name="ArchiveRestore" size={14} />预览恢复
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

