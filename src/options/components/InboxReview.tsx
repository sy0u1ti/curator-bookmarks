import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../ui/base/Button.js'
import { Select } from '../../ui/base/Select.js'
import { type InboxItem } from '../../shared/inbox.js'
import type { InboxReviewMessage } from '../../shared/messages.js'
import type { FolderRecord } from '../../shared/types.js'
import { Input } from '../../ui/base/Input.js'
import { refreshInboxReview, useInboxReviewData } from './inbox-review-store.js'

export function InboxReview() {
  const { data, error } = useInboxReviewData()
  const [status, setStatus] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const pendingOperation = useRef(false)
  const generation = useRef(0)
  useEffect(() => () => { generation.current++; pendingOperation.current = false }, [])
  const folders = data?.folders
  const folderOptions = useMemo(() => (folders || []).map(folder => ({ value: folder.id, label: folder.path || folder.title })), [folders])
  const folderMap = useMemo(() => new Map((folders || []).map(folder => [folder.id, folder])), [folders])
  const run = async (message: InboxReviewMessage | { type: 'inbox:undo-last-move' }) => {
    if (pendingOperation.current) return
    pendingOperation.current = true
    const request = generation.current
    setBusy(true)
    setStatus('')
    setActionError('')
    try {
      const response = await chrome.runtime.sendMessage(message)
      if (request !== generation.current) return
      if (!response?.ok) throw new Error(response?.error || '操作失败，请重试。')
      setStatus(typeof response.result === 'string' ? response.result : '已撤销最近一次移动。')
    } catch (error) {
      if (request === generation.current) setActionError(error instanceof Error ? error.message : '操作失败，请重试。')
    } finally {
      if (request === generation.current) {
        await refreshInboxReview()
        if (request === generation.current) { pendingOperation.current = false; setBusy(false) }
      }
    }
  }
  const pending = data?.pending || []
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = pending.filter(item => `${item.title} ${item.url}`.toLocaleLowerCase().includes(normalizedQuery))
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1))
  const visible = filtered.slice(currentPage * 20, currentPage * 20 + 20)
  return <section aria-labelledby="inbox-review-title" className="mb-7 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 id="inbox-review-title" className="m-0 text-[15px] font-semibold">待整理 · {pending.length}</h3>
      {data?.inbox.lastUndoMove ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run({ type: 'inbox:undo-last-move' })}>撤销最近一次移动</Button> : null}
    </div>
    <p className="text-[13px] text-ds-text-secondary">快速审阅分类建议、另选归档文件夹，或确认保留在待整理箱。</p>
    <p role="status" className="text-[13px] text-ds-text-secondary">{status}</p>
    {actionError || error ? <p role="alert" className="text-[13px] text-ds-text-secondary">{[actionError, error].filter(Boolean).join('；')}</p> : null}
    <Input aria-label="搜索待整理书签" placeholder="搜索标题或网址" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} />
    {error ? <Button size="sm" disabled={busy} onClick={() => void refreshInboxReview()}>重新读取</Button> : null}
    {!data ? (!error ? <p>正在读取待整理…</p> : null) : !pending.length ? <p className="text-[13px] text-ds-text-secondary">当前没有待整理书签。</p> : visible.map(item =>
      <InboxReviewRow key={item.captureId} item={item} stale={data.bookmarks.get(item.bookmarkId)?.url !== item.url} folderMap={folderMap} folderOptions={folderOptions} busy={busy} run={run} />)}
    {data && filtered.length === 0 && pending.length > 0 ? <p>没有匹配的待办。</p> : null}
    {filtered.length > 20 ? <div className="mt-4 flex items-center justify-between gap-3">
      <Button size="sm" variant="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</Button>
      <span className="text-xs text-ds-text-secondary">第 {currentPage + 1} / {Math.ceil(filtered.length / 20)} 页 · {filtered.length} 条</span>
      <Button size="sm" variant="secondary" disabled={(currentPage + 1) * 20 >= filtered.length} onClick={() => setPage(currentPage + 1)}>下一页</Button>
    </div> : null}
  </section>
}

function InboxReviewRow({ item, stale, folderMap, folderOptions, busy, run }: { item: InboxItem; stale: boolean; folderMap: Map<string, FolderRecord>; folderOptions: { value: string; label: string }[]; busy: boolean; run: (message: InboxReviewMessage) => Promise<void> }) {
  const [folderId, setFolderId] = useState<string | null>(null)
  const selectedFolder = folderId ? folderMap.get(folderId) : undefined
  const analyzing = !stale && item.status === 'analyzing'
  const disabled = busy || analyzing || stale
  const act = (action: InboxReviewMessage['action']) => void run({
    type: 'inbox:review', bookmarkId: item.bookmarkId, captureId: item.captureId, action,
    folderId: selectedFolder?.id, folderPath: selectedFolder?.path
  })
  return <article className="border-t border-ds-border-subtle py-4">
    <strong className="block text-[14px] [overflow-wrap:anywhere]">{item.title}</strong>
    <p className="my-2 text-[12px] text-ds-text-secondary [overflow-wrap:anywhere]">{item.url}</p>
    <p className="my-2 text-[13px] text-ds-text-secondary">{stale ? '地址已变化，旧建议不再适用。请结清待办后重新收藏。' : analyzing ? '正在分析…' : item.lastError || '等待整理'}{item.recommendedFolderPath ? ` · 建议：${item.recommendedFolderPath} · 置信度 ${Math.round((item.confidence || 0) * 100)}%` : ''}</p>
    {item.recommendationReason ? <p className="text-[13px] text-ds-text-secondary">{item.recommendationReason}</p> : null}
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={disabled || !item.recommendedFolderPath} onClick={() => act('accept')}>{item.recommendedFolderId ? '接受建议' : '新建建议目录并移动'}</Button>
      <Select ariaLabel={`为 ${item.title} 选择目录`} value={selectedFolder?.id || null} onValueChange={setFolderId} disabled={disabled} placeholder="选择其他目录" options={folderOptions} />
      <Button size="sm" variant="secondary" disabled={disabled || !selectedFolder} onClick={() => act('move')}>移至所选目录</Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => act('keep')}>{stale || analyzing ? '结清待办' : '保留原位'}</Button>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => act('retry')}>重新分析</Button>
    </div>
  </article>
}
