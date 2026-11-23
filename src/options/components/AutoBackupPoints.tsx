import { useCallback, useEffect, useRef, useState } from 'react'
import { listAutoBackupPoints, type AutoBackupIndexEntry } from '../../shared/backup'
import { STORAGE_KEYS } from '../../shared/constants'
import { formatBytes, formatDateTime } from '../../shared/format'
import { Button } from '../../ui/base/Button'
import { StatusMessage } from '../../ui/base/StatusMessage'
import { Popover } from '../../ui/base/Popover'
import { Icon } from '../../ui/icons/Icon'
import { handleBackupAction } from '../options-controller'

const EMPTY_COPY = '整理书签前自动保存，暂时没有恢复点。'

export function AutoBackupPoints({ busy, onPreview }: { busy: boolean; onPreview?: (backupId: string) => void }) {
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
      if (request === generation.current) setLoading(false)
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
    <section id="settings-recovery-points" aria-labelledby="recovery-points-title">
      <header className="mb-2 flex min-h-7 items-center justify-between gap-3">
        <h3 id="recovery-points-title" className="m-0 text-sm font-semibold leading-6 text-ds-text-primary">自动恢复点</h3>
        {error ? <div className="-my-0.5 flex items-center gap-1">
          {points.length ? <Popover title="恢复点读取失败" showArrow={false} align="end"
            trigger={<Button size="icon-sm" variant="ghost" className="text-ds-danger-text hover:bg-ds-danger-soft hover:text-ds-danger-text" aria-label="查看恢复点读取错误">
              <Icon name="AlertTriangle" size={15} aria-hidden="true" />
            </Button>}>
            <p className="m-0 text-[13px] leading-relaxed text-ds-text-primary [overflow-wrap:anywhere]">{error}</p>
          </Popover> : null}
          <Button size="sm" variant="ghost" disabled={loading} onClick={() => void refresh()} aria-label="重新读取自动恢复点">重试</Button>
        </div> : null}
      </header>
      {!points.length ? (
        <StatusMessage className="mb-0 text-[13px] leading-[1.65] text-ds-text-secondary" reserve={[EMPTY_COPY]} tone={error ? 'error' : 'neutral'}>
          {error || (loading ? '正在读取恢复点…' : EMPTY_COPY)}
        </StatusMessage>
      ) : null}
      {points.length ? (
        <ol className="m-0 ml-1 grid list-none gap-1 border-l border-ds-border py-0 pl-3 pr-0" aria-label="可用的自动恢复点">
          {points.map(point => {
            const title = point.operationReason || '自动恢复点'
            return (
              <li key={point.backupId}>
                <Button unstyled
                  className="group grid min-h-[60px] w-full grid-cols-[minmax(0,1fr)] items-center rounded-ds-sm px-3 py-2.5 text-left outline-none hover:bg-ds-hover focus-visible:shadow-ds-focus disabled:cursor-default disabled:opacity-55"
                  disabled={busy} focusableWhenDisabled={busy} aria-label={`预览恢复点：${title}`}
                  onClick={() => onPreview ? onPreview(point.backupId) : handleBackupAction({ action: 'preview-auto-backup', backupId: point.backupId })}>
                  <span className="grid min-w-0 gap-1">
                    <span className="text-[13px] font-normal leading-[1.5] text-ds-text-secondary [overflow-wrap:anywhere] group-hover:text-ds-text-primary">{title}</span>
                    <span className="flex flex-wrap gap-x-3 text-xs font-normal leading-[1.5] tabular-nums text-ds-text-muted">
                      <time dateTime={new Date(point.createdAt).toISOString()}>{formatDateTime(point.createdAt)}</time>
                      <span>{formatBytes(point.sizeBytes || 0)}</span>
                    </span>
                  </span>
                </Button>
              </li>
            )
          })}
        </ol>
      ) : null}
    </section>
  )
}
