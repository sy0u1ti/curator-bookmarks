import { useCallback, useEffect, useRef, useState } from 'react'
import { listAutoBackupPoints, type AutoBackupIndexEntry } from '../../shared/backup'
import { STORAGE_KEYS } from '../../shared/constants'
import { Button } from '../../ui/base/Button'
import { Icon } from '../../ui/icons/Icon'
import { handleBackupAction } from '../options-controller'

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
    <section className="mt-7 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-5" aria-labelledby="recovery-points-title" aria-busy={loading}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="recovery-points-title" className="text-[15px] font-semibold text-ds-text-primary">自动恢复点</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ds-text-secondary">整理前的本地备份。选中后先比较差异，再选择恢复范围。</p>
        </div>
        <Button size="sm" variant="secondary" disabled={loading || busy} onClick={() => void refresh()} aria-label="刷新自动恢复点">
          <Icon name="RefreshCw" size={14} />刷新
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm text-ds-text-secondary" role="alert">{error}</p> : null}
      {!points.length ? <p className="mt-4 text-sm text-ds-text-secondary" role="status">{loading ? '正在读取恢复点…' : '暂无自动恢复点。批量清理、整理或恢复数据前会自动创建。'}</p> : (
        <ul className="mt-4 grid list-none gap-3 p-0" aria-label="可用的自动恢复点">
          {points.map(point => (
            <li key={point.backupId} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-ds-border-subtle p-3">
              <div className="min-w-0 flex-1 basis-52">
                <strong className="block break-words text-sm text-ds-text-primary">{point.operationReason || '自动恢复点'}</strong>
                <p className="mt-1 text-xs text-ds-text-secondary"><time dateTime={new Date(point.createdAt).toISOString()}>{new Date(point.createdAt).toLocaleString('zh-CN')}</time> · {formatBackupSize(point.sizeBytes || 0)}</p>
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

function formatBackupSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`
}
