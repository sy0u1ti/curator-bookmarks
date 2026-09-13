import { useMemo, useState } from 'react'
import type { BackupRestorePreview } from '../../shared/backup'
import { Button } from '../../ui/base/Button'
import { Input } from '../../ui/base/Input'

const PAGE_SIZE = 40

export function BackupBookmarkPreview({ bookmarks }: { bookmarks: BackupRestorePreview['bookmarks'] }) {
  const [query, setQuery] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)
  const [page, setPage] = useState(0)
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return bookmarks.filter(bookmark => (!missingOnly || bookmark.missing) && (!needle ||
      `${bookmark.title}\n${bookmark.url}\n${bookmark.path}`.toLocaleLowerCase().includes(needle)))
  }, [bookmarks, missingOnly, query])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)

  return (
    <section className="mt-5 border-t border-ds-border-subtle pt-4" aria-label="备份中的书签">
      <h3 className="text-sm font-semibold text-ds-text-primary">备份中的书签</h3>
      <p className="mt-2 text-xs leading-relaxed text-ds-text-secondary">查看保存时的标题和文件夹路径。书签恢复会补齐缺失项，保留当前已有书签。</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          aria-label="搜索备份中的书签"
          placeholder="搜索标题、网址或文件夹"
          value={query}
          onChange={event => { setQuery(event.currentTarget.value); setPage(0) }}
          className="min-w-0 flex-1 basis-60"
        />
        <Button size="sm" variant="secondary" aria-pressed={missingOnly} onClick={() => { setMissingOnly(!missingOnly); setPage(0) }}>只看当前缺失</Button>
      </div>
      <p className="mt-3 text-xs text-ds-text-secondary" role="status">共 {filtered.length} 条 · 第 {currentPage + 1} / {pageCount} 页</p>
      {filtered.length ? (
        <ul className="mt-3 grid max-h-96 list-none gap-2 overflow-y-auto p-0" aria-label="备份书签预览列表">
          {filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(bookmark => (
            <li key={bookmark.id} className="min-w-0 rounded-ds-sm border border-ds-border-subtle p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <strong className="min-w-0 flex-1 break-words text-sm text-ds-text-primary">{bookmark.title}</strong>
                <span className="shrink-0 text-xs text-ds-text-secondary">{bookmark.missing ? '当前缺失' : '当前已有'}</span>
              </div>
              <p className="mt-1 break-all text-xs text-ds-text-secondary">{bookmark.url}</p>
              <p className="mt-1 break-words text-xs text-ds-text-secondary">{bookmark.path || '根目录'}</p>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-ds-text-secondary">没有符合条件的书签。</p>}
      {pageCount > 1 && <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</Button>
        <Button size="sm" variant="secondary" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}>下一页</Button>
      </div>}
    </section>
  )
}
