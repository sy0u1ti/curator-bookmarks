import { createRoot } from 'react-dom/client'
import { useEffect, useRef, useState } from 'react'
import '../styles/globals.css'
import { Button } from '../ui/base/Button'
import { Icon } from '../ui/icons/Icon'
import { ThemeProvider } from '../ui/theme/ThemeProvider'
import { downloadBlobFile } from '../shared/download'
import { capturePageArchive, getArchiveSourceTab, getPageArchiveFilename, parseArchiveTabId, requestPageCapturePermission } from './page-archive'

const tabId = parseArchiveTabId(new URLSearchParams(location.search).get('tabId'))

function ArchivePage() {
  const [source, setSource] = useState<chrome.tabs.Tab | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(tabId === null ? '未指定来源网页，请从 Curator 的页面存档入口打开。' : '')
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null)
  const running = useRef(false)
  useEffect(() => {
    let active = true
    if (tabId !== null) void getArchiveSourceTab(tabId).then(tab => { if (active) setSource(tab) }, reason => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [])

  async function save() {
    if (running.current || tabId === null) return
    running.current = true
    setBusy(true)
    setError('')
    try {
      const granted = await requestPageCapturePermission()
      if (!granted) { setError('未授予页面存档权限。你可以再次点击保存并选择允许。'); return }
      const current = await getArchiveSourceTab(tabId)
      setSource(current)
      const blob = await capturePageArchive(tabId)
      const filename = getPageArchiveFilename(current.title || source?.title || '网页存档')
      setResult({ blob, filename })
      downloadBlobFile(filename, blob)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请重试。')
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  async function returnToSource() {
    if (tabId === null) return
    try {
      await getArchiveSourceTab(tabId)
      await chrome.tabs.update(tabId, { active: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '来源标签页无法打开，请重新发起存档。')
    }
  }

  return <ThemeProvider>
    <main className="mx-auto grid w-full min-w-0 max-w-3xl gap-6 px-6 py-12 text-ds-text-primary [overflow-wrap:anywhere]">
      <div className="flex items-center gap-3 text-sm text-ds-text-secondary"><Icon name="ArchiveRestore" size={22} />Curator · 页面离线存档</div>
      <h1 className="text-3xl font-semibold">保留当前网页的离线副本</h1>
      <p className="text-sm leading-relaxed text-ds-text-secondary">将已加载的页面、图片和样式保存为单个 MHTML 文件，可用 Chrome 或 Edge 离线打开。</p>
      <section className="rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-5" aria-label="来源网页">
        <h2 className="text-lg font-semibold">{source?.title || '来源标签页'}</h2>
        {source?.url ? <p className="mt-2 break-all text-sm text-ds-text-secondary">{source.url}</p> : null}
        <p className="mt-3 text-sm leading-relaxed text-ds-text-secondary">保存前请在来源页展开或加载需要保留的内容，并保持来源标签页打开。脚本交互、流媒体和服务器功能无法离线运行。</p>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" disabled={!source || busy} onClick={() => void save()}><Icon name="Download" size={16} />{busy ? '正在生成离线副本…' : '保存离线文件'}</Button>
        {source && <Button variant="secondary" onClick={() => void returnToSource()}>回到来源网页</Button>}
        {result && <Button variant="secondary" onClick={() => downloadBlobFile(result.filename, result.blob)}>再次下载</Button>}
      </div>
      {error && <p role="alert" className="rounded-ds-sm border border-ds-border p-3 text-sm">{error}</p>}
      {busy && <p role="status" className="text-sm text-ds-text-secondary">正在保存已加载的页面内容…</p>}
      {result && <p role="status" className="text-sm text-ds-text-secondary">离线文件已生成：{result.filename}（{result.blob.size >= 1024 * 1024 ? `${(result.blob.size / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.ceil(result.blob.size / 1024))} KB`}）。</p>}
      <p className="text-xs leading-relaxed text-ds-text-secondary">存档内容保存在下载文件中。该操作不使用 AI，也不上传到 Curator 服务。</p>
    </main>
  </ThemeProvider>
}

createRoot(document.getElementById('archive-root')!).render(<ArchivePage />)
