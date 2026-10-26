import { OPTION_SURFACE_CLASS } from './option-layout-classes.js'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '../../ui/base/Button.js'
import { STORAGE_KEYS } from '../../shared/constants.js'
import { cleanStorageCategory, getStorageUsage, type StorageCleanupCategory } from '../../shared/storage-maintenance.js'

const size = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function StorageManagement() {
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof getStorageUsage>> | null>(null)
  const [busy, setBusy] = useState(true)
  const [status, setStatus] = useState('')
  const [storageIssue, setStorageIssue] = useState('')
  const generation = useRef(0)
  const pending = useRef(false)
  const run = useCallback(async (category?: StorageCleanupCategory) => {
    if (pending.current) return
    pending.current = true
    const request = ++generation.current
    setBusy(true)
    setStatus('')
    let message = ''
    try {
      message = category ? await cleanStorageCategory(category) : ''
      const next = await getStorageUsage()
      if (request !== generation.current) return
      setUsage(next)
      setStatus(message)
    } catch (error) {
      if (request === generation.current) {
        const detail = error instanceof Error ? error.message : '请重试。'
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
  const refresh = () => run()
  const clean = (category: StorageCleanupCategory) => run(category)
  return <section aria-labelledby="storage-management-title" className={`mt-7 ${OPTION_SURFACE_CLASS} p-5`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 id="storage-management-title" className="m-0 text-[15px] font-semibold">本地存储空间</h3>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void refresh()}>刷新用量</Button>
    </div>
    {storageIssue ? (
      <p role="alert" className="mt-2 rounded-ds-sm border border-ds-border px-3 py-2 text-[13px] text-ds-text-secondary">{storageIssue}</p>
    ) : null}
    {usage ? <>
      <p className="text-[13px] text-ds-text-secondary">配置与搜索索引占用约 {size(usage.localBytes)}{usage.originBytes !== null ? ` · 浏览器站点存储估算 ${size(usage.originBytes)}` : ''}</p>
      <StorageRow title={`自定义图标 · ${usage.icons.count} 张 · ${size(usage.icons.bytes)}`} copy={`${usage.icons.unused} 张暂未关联任何书签。首次扫描后保留 24 小时缓冲期，确认后再次清理即可彻底移除。`}>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void clean('icons')}>清理闲置图标</Button>
      </StorageRow>
      {usage.missingIcons > 0 ? <StorageRow title={`${usage.missingIcons} 张图标无法读取`} copy="已自动使用站点图标。移除失效引用后，可从书签菜单重新选择图片。">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void clean('missing-icons')}>移除失效图标引用</Button>
      </StorageRow> : null}
      <StorageRow title={`本地正文 · ${usage.fullText.count} 份 · ${size(usage.fullText.bytes)}`} copy="清除后无法再按这些正文检索；摘要、标签和书签保留。">
        <Button size="sm" variant="secondary" disabled={busy || !usage.fullText.count} onClick={() => void clean('full-text')}>清除本地正文</Button>
      </StorageRow>
      <StorageRow title={`壁纸预览缓存 · ${size(usage.previewBytes)}`} copy="清理后再次浏览新标签页壁纸库时会按需重新拉取缩略图。">
        <Button size="sm" variant="secondary" disabled={busy || !usage.previewBytes} onClick={() => void clean('previews')}>清除预览缓存</Button>
      </StorageRow>
    </> : <p className="text-[13px] text-ds-text-secondary">{busy ? '正在读取用量…' : '用量暂不可用，请点击刷新用量重试。'}</p>}
    {status ? <p role="status" className="text-[13px] text-ds-text-secondary">{status}</p> : null}
  </section>
}

function StorageRow({ title, copy, children }: { title: string; copy: string; children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ds-border-subtle py-3">
    <div><strong className="text-[13px]">{title}</strong><p className="my-1 max-w-[640px] text-[13px] text-ds-text-secondary">{copy}</p></div>{children}
  </div>
}
