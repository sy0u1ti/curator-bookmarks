import { OPTION_SURFACE_CLASS } from './option-layout-classes.js'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '../../ui/base/Button.js'
import { ErrorState } from '../../ui/base/ErrorState.js'
import { Select } from '../../ui/base/Select.js'
import { Input } from '../../ui/base/Input.js'
import { type InboxItem } from '../../shared/inbox.js'
import type { InboxReviewMessage } from '../../shared/messages.js'
import type { FolderRecord } from '../../shared/types.js'
import { formatBookmarkPath } from '../../shared/bookmark-path.js'
import { displayUrl } from '../../shared/text.js'
import { Icon } from '../../ui/icons/Icon.js'
import { StableLabel, StatusMessage } from '../../ui/base/StatusMessage.js'
import { useListExit, type MountedListEntry } from '../../ui/motion/useListExit.js'
import { getInboxReviewData, refreshInboxReview, useInboxReviewData } from './inbox-review-store.js'
import { OptionEmptyState } from './OptionEmptyState.js'
import { showOptionsUndoToast } from './options-undo-toast-store.js'

const PAGE_SIZE = 20
const NEW_FOLDER_VALUE = '__inbox-recommended-new__'
const PATH_SEPARATOR = ' / '
const EMPTY_PENDING: InboxItem[] = []

type InboxRunMessage = InboxReviewMessage | { type: 'inbox:undo-last-move' }
/** Resolves to an error message, or an empty string on success. */
type InboxReviewRunner = (message: InboxRunMessage) => Promise<string>
type FolderOption = { value: string; label: ReactNode }

export function InboxReview() {
  const { data, error } = useInboxReviewData()
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const pendingOperation = useRef(false)
  const generation = useRef(0)
  useEffect(() => () => { generation.current++; pendingOperation.current = false }, [])
  const folders = data?.folders
  const folderOptions = useMemo(() => (folders || []).map(folder => ({ value: folder.id, label: formatBookmarkPath(folder.path || folder.title, PATH_SEPARATOR) })), [folders])
  const folderMap = useMemo(() => new Map((folders || []).map(folder => [folder.id, folder])), [folders])

  const runRef = useRef<InboxReviewRunner>(async () => '')

  const undoLastMove = useCallback(async () => {
    const failure = await runRef.current({ type: 'inbox:undo-last-move' })
    if (failure) showOptionsUndoToast({ title: '撤销失败', detail: failure, tone: 'error' })
  }, [])

  const announceMove = useCallback((bookmarkId: string) => {
    const latest = getInboxReviewData()
    const move = latest?.inbox.lastUndoMove
    if (move?.bookmarkId !== bookmarkId) return
    const folder = latest?.folders.find(candidate => candidate.id === move.toFolderId)
    showOptionsUndoToast({
      title: folder ? `已移到「${folder.title || '未命名文件夹'}」` : '已移动',
      onUndo: undoLastMove
    })
  }, [undoLastMove])

  const run = useCallback<InboxReviewRunner>(async message => {
    if (pendingOperation.current) return ''
    pendingOperation.current = true
    const request = generation.current
    setBusy(true)
    let failure = ''
    try {
      const response = await chrome.runtime.sendMessage(message)
      if (!response?.ok) throw new Error(response?.error || '操作失败，请重试。')
    } catch (caught) {
      failure = caught instanceof Error ? caught.message : '操作失败，请重试。'
    } finally {
      if (request === generation.current) {
        await refreshInboxReview()
        if (request === generation.current) { pendingOperation.current = false; setBusy(false) }
      }
    }
    if (!failure && request === generation.current && message.type === 'inbox:review' && (message.action === 'accept' || message.action === 'move')) {
      announceMove(message.bookmarkId)
    }
    return failure
  }, [announceMove])
  runRef.current = run

  const pending = data?.pending ?? EMPTY_PENDING
  const indexedPending = useMemo(
    () => pending.map(item => ({
      item,
      searchText: `${item.title} ${item.url}`.toLocaleLowerCase()
    })),
    [pending]
  )
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = useMemo(
    () => (normalizedQuery
      ? indexedPending.filter(entry => entry.searchText.includes(normalizedQuery)).map(entry => entry.item)
      : pending),
    [indexedPending, normalizedQuery, pending]
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)
  const rows = useListExit(visible, item => item.captureId, `${normalizedQuery}\u0000${currentPage}`)
  const searchable = pending.length > 1 || Boolean(query)
  const emptyReady = Boolean(data) && !error && !pending.length && !rows.length

  if (emptyReady) {
    return (
      <section aria-labelledby="inbox-review-title" className="mt-5 mb-7">
        <h3 id="inbox-review-title" className="sr-only">待整理 0 条</h3>
        <OptionEmptyState
          title="没有待整理的书签"
          description="用快捷键保存或自动分析未命中分类的书签，会暂存在这里等待确认。"
          actions={data?.inbox.lastUndoMove
            ? [{ label: '撤销最近一次移动', onClick: () => void undoLastMove(), variant: 'secondary' }]
            : [{ action: 'open-auto-analyze', label: '前往通用设置', variant: 'secondary' }]}
        />
      </section>
    )
  }

  if (!data && error) {
    return (
      <section aria-labelledby="inbox-review-title" className="mt-5 mb-7">
        <ErrorState
          surface="card"
          titleAs="h3"
          titleId="inbox-review-title"
          title="无法读取待整理书签"
          detail={error}
          actions={
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void refreshInboxReview()}>
              重新读取
            </Button>
          }
        />
      </section>
    )
  }

  return <section aria-labelledby="inbox-review-title" className={`mt-5 mb-7 ${OPTION_SURFACE_CLASS} px-5`}>
    <div className="flex min-h-[68px] flex-wrap items-center gap-3 py-4">
      {searchable ? <label className="relative flex min-w-[220px] flex-1 items-center text-ds-text-muted">
        <Icon name="Search" size={15} aria-hidden="true" className="pointer-events-none absolute left-3" />
        <Input
          className="bg-ds-surface-2 pl-9 text-[13px]"
          aria-label="搜索待整理书签"
          placeholder="搜索标题或网址"
          value={query}
          onChange={event => { setQuery(event.target.value); setPage(0) }}
        />
      </label> : null}
      <h3 id="inbox-review-title" className={`m-0 text-[13px] font-medium tabular-nums text-ds-text-secondary ${searchable ? '' : 'flex-1'}`}>
        <span className="sr-only">待整理 </span>{pending.length} 条
      </h3>
      {data?.inbox.lastUndoMove ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => void undoLastMove()}>
        <Icon name="RotateCcw" size={14} aria-hidden="true" />撤销最近一次移动
      </Button> : null}
    </div>
    {error ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-ds-danger/30 bg-ds-danger-soft/60 px-3.5 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-ds-danger-text">
        <Icon name="AlertTriangle" size={14} aria-hidden="true" className="shrink-0" />
        <p role="alert" className="m-0 min-w-0 [overflow-wrap:anywhere]">{error}</p>
      </div>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void refreshInboxReview()}>重新读取</Button>
    </div> : null}
    {!data ? (!error ? <p className="m-0 border-t border-ds-border-subtle/70 py-10 text-center text-[13px] text-ds-text-muted">正在读取…</p> : null)
      : !pending.length && !rows.length ? <p className="m-0 border-t border-ds-border-subtle/70 py-10 text-center text-[13px] text-ds-text-muted">没有待整理的书签</p>
      : filtered.length === 0 && !rows.length ? <p className="m-0 border-t border-ds-border-subtle/70 py-10 text-center text-[13px] text-ds-text-muted">没有匹配的书签</p>
      : <InboxReviewList rows={rows} bookmarks={data.bookmarks} folderMap={folderMap} folderOptions={folderOptions} busy={busy} run={run} />}
    {filtered.length > PAGE_SIZE ? <div className="flex items-center justify-end gap-3 border-t border-ds-border-subtle/70 py-3">
      <span className="text-xs tabular-nums text-ds-text-secondary">{currentPage + 1} / {pageCount}</span>
      <Button size="sm" variant="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</Button>
      <Button size="sm" variant="secondary" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>下一页</Button>
    </div> : null}
  </section>
}

function InboxReviewList({ rows, bookmarks, folderMap, folderOptions, busy, run }: { rows: MountedListEntry<InboxItem>[]; bookmarks: Map<string, { url?: string }>; folderMap: Map<string, FolderRecord>; folderOptions: FolderOption[]; busy: boolean; run: InboxReviewRunner }) {
  return <div className="flex flex-col">
    {rows.map(entry =>
      <div ref={entry.ref} className="t-list-exit border-t border-ds-border-subtle/70" data-exiting={entry.exiting ? 'true' : 'false'} inert={entry.exiting || undefined} key={entry.key}>
        <div className="t-list-exit-inner">
          <InboxReviewRow item={entry.item} stale={bookmarks.get(entry.item.bookmarkId)?.url !== entry.item.url} folderMap={folderMap} folderOptions={folderOptions} busy={busy || entry.exiting} run={run} />
        </div>
      </div>)}
  </div>
}

function renderRecommendedLabel(label: ReactNode) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Icon name="Sparkles" size={13} aria-hidden="true" className="shrink-0 text-ds-accent" />
      <span className="truncate">{label}</span>
    </span>
  )
}

const InboxReviewRow = memo(function InboxReviewRow({ item, stale, folderMap, folderOptions, busy, run }: { item: InboxItem; stale: boolean; folderMap: Map<string, FolderRecord>; folderOptions: FolderOption[]; busy: boolean; run: InboxReviewRunner }) {
  const [chosenFolderId, setChosenFolderId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const analyzing = !stale && item.status === 'analyzing'
  const disabled = busy || analyzing || stale
  const recommendedPath = !stale && item.recommendedFolderPath ? item.recommendedFolderPath : ''
  const recommendedFolder = item.recommendedFolderId ? folderMap.get(item.recommendedFolderId) : undefined
  const recommendedTarget = recommendedPath ? (recommendedFolder ? recommendedFolder.id : item.recommendedFolderId ? null : NEW_FOLDER_VALUE) : null
  const target = chosenFolderId ?? recommendedTarget
  const options = useMemo(() => {
    if (recommendedTarget === NEW_FOLDER_VALUE) {
      return [{ value: NEW_FOLDER_VALUE, label: renderRecommendedLabel(`${formatBookmarkPath(recommendedPath, PATH_SEPARATOR)}（新建）`) }, ...folderOptions]
    }
    if (recommendedTarget) {
      return folderOptions.map(option => option.value === recommendedTarget ? { ...option, label: renderRecommendedLabel(option.label) } : option)
    }
    return folderOptions
  }, [folderOptions, recommendedPath, recommendedTarget])
  const act = async (action: InboxReviewMessage['action']) => {
    setError('')
    const folder = target && target !== NEW_FOLDER_VALUE ? folderMap.get(target) : undefined
    const accept = action === 'move' && (target === NEW_FOLDER_VALUE || (Boolean(target) && target === recommendedTarget))
    const failure = await run({
      type: 'inbox:review', bookmarkId: item.bookmarkId, captureId: item.captureId,
      action: accept ? 'accept' : action,
      ...(action === 'move' && !accept ? { folderId: folder?.id, folderPath: folder?.path } : {})
    })
    setError(failure)
  }
  const note = error || (stale ? '地址已变化，旧建议不再适用。处理后请重新保存。' : analyzing ? '正在分析…' : item.lastError || '')
  const noteTone = error || item.status === 'failed' ? 'error' : stale ? 'warning' : 'neutral'
  const confidence = Math.round((item.confidence || 0) * 100)
  const urlLabel = displayUrl(item.url)
  const hasRecommendation = Boolean(recommendedPath && (item.recommendationReason || confidence > 0))
  const recommendationContent = hasRecommendation ? (
    <>
      {item.recommendationReason}
      {confidence > 0 ? <span className="ml-2 whitespace-nowrap tabular-nums text-ds-text-muted">置信度 {confidence}%</span> : null}
    </>
  ) : null

  return <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-8 gap-y-3 py-4 max-[1180px]:grid-cols-1">
    <div className="min-w-0">
      <a className="block truncate rounded-ds-xs text-[15px] font-semibold text-ds-text-primary no-underline outline-none hover:underline focus-visible:underline focus-visible:shadow-ds-focus" href={item.url} target="_blank" rel="noreferrer" title={item.title}>{item.title}</a>
      {hasRecommendation ? (
        <>
          <p className="m-0 mt-1 truncate text-xs text-ds-text-muted" title={item.url}>{urlLabel}</p>
          <StatusMessage
            className="m-0 mt-2.5 text-xs leading-relaxed text-ds-text-secondary"
            reserve={[recommendationContent]}
            tone={note ? noteTone : 'neutral'}
            title={note || undefined}
          >
            {note || recommendationContent}
          </StatusMessage>
        </>
      ) : (
        <StatusMessage
          className="m-0 mt-1 text-xs leading-[1.5] text-ds-text-muted"
          reserve={[<span className="block truncate">{urlLabel}</span>]}
          tone={note ? noteTone : 'neutral'}
          title={note || item.url}
        >
          {note || <span className="block truncate">{urlLabel}</span>}
        </StatusMessage>
      )}
    </div>
    <div className="flex flex-nowrap items-center gap-2 max-[1180px]:flex-wrap">
      <Select className="w-[260px] max-[520px]:w-full" triggerClassName="w-full" valueClassName="truncate text-left" ariaLabel={`为 ${item.title} 选择目录`} value={target} onValueChange={setChosenFolderId} disabled={disabled} placeholder="选择目录" options={options} />
      <Button size="sm" variant="primary" disabled={disabled || !target} onClick={() => void act('move')}>
        <StableLabel text={target === NEW_FOLDER_VALUE ? '新建并移动' : '移动'} reserve={['移动', '新建并移动']} />
      </Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act('keep')}>{stale || analyzing ? '结清待办' : '保留原位'}</Button>
      <Button size="icon-sm" variant="ghost" disabled={disabled} aria-label="重新分析" title="重新分析" onClick={() => void act('retry')}>
        <Icon name="RefreshCw" size={14} aria-hidden="true" />
      </Button>
    </div>
  </article>
})
