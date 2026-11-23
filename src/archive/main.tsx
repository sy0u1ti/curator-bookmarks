import { createRoot } from 'react-dom/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import '../styles/globals.css'
import './archive.css'
import { Button } from '../ui/base/Button'
import { ErrorState } from '../ui/base/ErrorState'
import { StableLabel, StatusMessage } from '../ui/base/StatusMessage'
import { Surface } from '../ui/base/Surface'
import { Icon } from '../ui/icons/Icon'
import { ThemeProvider } from '../ui/theme/ThemeProvider'
import { downloadBlobFile } from '../shared/download'
import { formatBytes } from '../shared/format'
import { capturePageArchive, getArchiveSourceTab, getPageArchiveFilename, parseArchiveTabId, requestPageCapturePermission } from './page-archive'
import { InputCaretHost } from '../ui/input-caret/InputCaretHost'

const tabId = parseArchiveTabId(new URLSearchParams(location.search).get('tabId'))
const archivePrivacyNote = '存档内容保存在下载文件中。该操作不使用 AI，也不上传到 Curator 服务。'

function ArchivePage() {
  const [source, setSource] = useState<chrome.tabs.Tab | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(tabId === null ? '未指定来源网页，请从 Curator 的页面存档入口打开。' : '')
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null)
  const running = useRef(false)
  const generation = useRef(0)
  const loadSource = useCallback(async () => {
    if (tabId === null) return
    const request = ++generation.current
    setLoading(true)
    setError('')
    try {
      const tab = await getArchiveSourceTab(tabId)
      if (request === generation.current) setSource(tab)
    } catch (reason) {
      if (request === generation.current) setError(reason instanceof Error ? reason.message : '来源网页读取失败，请重试。')
    } finally {
      if (request === generation.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    void loadSource()
    return () => { generation.current++ }
  }, [loadSource])

  async function save() {
    if (running.current || tabId === null) return
    const request = ++generation.current
    running.current = true
    setBusy(true)
    setError('')
    try {
      const granted = await requestPageCapturePermission()
      if (request !== generation.current) return
      if (!granted) { setError('未授予页面存档权限。你可以再次点击保存并选择允许。'); return }
      const current = await getArchiveSourceTab(tabId)
      if (request !== generation.current) return
      setSource(current)
      const blob = await capturePageArchive(tabId)
      if (request !== generation.current) return
      const filename = getPageArchiveFilename(current.title || source?.title || '网页存档')
      setResult({ blob, filename })
      downloadBlobFile(filename, blob)
    } catch (reason) {
      if (request === generation.current) setError(reason instanceof Error ? reason.message : '保存失败，请重试。')
    } finally {
      running.current = false
      if (request === generation.current) setBusy(false)
    }
  }

  async function returnToSource() {
    if (tabId === null) return
    try {
      const current = await getArchiveSourceTab(tabId)
      await chrome.tabs.update(tabId, { active: true })
      await chrome.windows.update(current.windowId, { focused: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '来源标签页无法打开，请重新发起存档。')
    }
  }

  function openOptions() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      void chrome.runtime.openOptionsPage()
      return
    }
    window.open(chrome.runtime.getURL('src/options/options.html'), '_blank', 'noopener')
  }

  const statusPhase = error ? `error:${error}` : loading ? 'loading' : busy ? 'busy' : result ? `saved:${result.filename}` : 'idle'
  const sourceLoadError = tabId !== null && !loading && !source && Boolean(error)

  return <ThemeProvider>
    <InputCaretHost />
    <main className="mx-auto grid w-full min-w-0 max-w-3xl gap-6 px-6 py-12 text-ds-text-primary [overflow-wrap:anywhere]">
      <header className="grid gap-2 border-b border-ds-border-subtle pb-5">
        <div className="flex items-center gap-2 text-xs font-medium text-ds-text-muted"><Icon name="ArchiveRestore" size={16} aria-hidden="true" />Curator</div>
        <h1 className="m-0 text-[22px] font-semibold leading-[1.2] tracking-[-0.025em] text-ds-text-primary">网页离线存档</h1>
        <p className="m-0 text-[13px] leading-relaxed text-ds-text-secondary">将已加载的页面、图片和样式保存为单个 MHTML 文件，可用 Chrome 或 Edge 离线打开。</p>
      </header>
      {tabId === null ? (
        <section aria-label="未指定来源网页">
          <ErrorState
            surface="card"
            tone="neutral"
            icon="ArchiveRestore"
            titleAs="h2"
            title="未找到来源网页"
            detail={error}
            actions={<Button variant="secondary" size="sm" onClick={openOptions}>打开设置</Button>}
          />
        </section>
      ) : sourceLoadError ? (
        <section aria-label="来源网页读取失败">
          <ErrorState
            surface="card"
            titleAs="h2"
            title="无法读取来源网页"
            detail={error}
            actions={
              <>
                <Button variant="primary" size="sm" disabled={busy || loading} onClick={() => void loadSource()}>重新读取来源</Button>
                <Button variant="secondary" size="sm" onClick={openOptions}>打开设置</Button>
              </>
            }
          />
        </section>
      ) : (
        <>
          <Surface as="section" className="rounded-ds-md border border-ds-border-subtle p-5" aria-label="来源网页" aria-busy={loading}>
            <h2 className="ds-scrollbar m-0 max-h-[2lh] overflow-auto text-base font-semibold tracking-[-0.01em]" title={source?.title}>{source?.title || '正在读取来源网页…'}</h2>
            {source?.url ? (
              <p className="ds-scrollbar m-0 mt-1.5 max-h-[2lh] overflow-auto font-mono text-xs text-ds-text-muted [overflow-wrap:anywhere]">{source.url}</p>
            ) : null}
            <p className="m-0 mt-3 border-t border-ds-border-subtle pt-3 text-[13px] leading-relaxed text-ds-text-secondary">保存前请在来源页展开或加载需要保留的内容，并保持来源标签页打开。脚本交互、流媒体和服务器功能无法离线运行。</p>
          </Surface>
          <div className="archive-actions grid grid-cols-2 gap-3">
            <Button variant="primary" disabled={busy || loading || !source} aria-busy={busy} onClick={() => void save()}>
              <Icon name={busy ? 'LoaderCircle' : 'Download'} size={16} className={busy ? 'animate-spin' : undefined} aria-hidden="true" />
              <StableLabel text={busy ? '正在保存…' : result ? '重新保存网页' : '保存离线文件'} reserve={['保存离线文件', '重新保存网页', '正在保存…']} />
            </Button>
            <Button variant="secondary" disabled={busy || loading} onClick={() => void loadSource()}>重新读取来源</Button>
            <Button variant="secondary" disabled={!source} onClick={() => void returnToSource()}>回到来源网页</Button>
            <Button variant="secondary" disabled={!result} onClick={() => { if (result) downloadBlobFile(result.filename, result.blob) }}>再次下载</Button>
          </div>
          <StatusMessage lines={3} className="archive-status text-sm leading-relaxed text-ds-text-secondary" tone={error ? 'error' : 'neutral'}>
            <span key={statusPhase} className="archive-status-copy">
              {error ? (
                <span className="flex items-start gap-2">
                  <Icon name="AlertTriangle" size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </span>
              ) : loading ? '正在读取来源网页…' : busy ? '正在保存已加载的页面内容…' : result ? (
                <span className="flex items-start gap-2">
                  <svg className="archive-saved-check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" /></svg>
                  <span>离线文件已生成：{result.filename}（{formatBytes(result.blob.size)}）。</span>
                </span>
              ) : archivePrivacyNote}
            </span>
          </StatusMessage>
        </>
      )}
    </main>
  </ThemeProvider>
}

createRoot(document.getElementById('archive-root')!).render(<ArchivePage />)
