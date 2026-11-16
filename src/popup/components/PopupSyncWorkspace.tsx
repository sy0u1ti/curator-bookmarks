import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '../../ui/base/Button'
import { Checkbox } from '../../ui/base/Checkbox'
import { DialogBackdrop, DialogOverlay, DialogPanel } from '../../ui/base/Dialog'
import { StableLabel } from '../../ui/base/StatusMessage'
import { Icon, type IconName } from '../../ui/icons/Icon'
import { downloadBlobFile, downloadJsonFile } from '../../shared/download'
import { isSidePanelSurface } from '../../shared/extension-surfaces'
import { isBackgroundRuntimeError, openExtensionManager } from '../../shared/background-runtime'
import { SYNC_ACCOUNTS_STORAGE_KEY, SYNC_TABS_ROOT, type SyncProfileView, type SyncRunMode } from '../../shared/sync/sync-contract'
import { requestSync } from '../../shared/sync/sync-messages'
import { formatSyncTime } from '../../shared/sync/sync-status'
import {
  SYNC_ADAPTERS, getSyncProfileStatus, getSyncProfileTitle, loadSyncProfiles,
  requestSyncPermissions, requestSyncProfilePermissions
} from '../../options/sync/sync-model'
import { SyncProfileEditor } from '../../ui/sync/SyncProfileEditor'
import { OptionActionsMenu } from '../../ui/base/OptionActionsMenu'

type View =
  | { kind: 'home' }
  | { kind: 'editor'; profile: SyncProfileView | null; key: number }
  | { kind: 'logs' }
  | { kind: 'detail'; title: string; text: string }
  | { kind: 'import' }
  | { kind: 'export' }

const failure = (reason: unknown, fallback: string) => reason instanceof Error ? reason.message : fallback
const busyProfile = (profile: SyncProfileView) => Boolean(profile.data.syncing || profile.data.scheduled)
const overwriteCopy = {
  download: {
    title: '以服务器为准，覆盖本机？',
    text: '本机这个文件夹中与服务器不同的书签会被改写或删除。同步前会自动创建恢复点。',
    button: '下载一次'
  },
  upload: {
    title: '以本机为准，覆盖服务器？',
    text: '服务器上的对应书签会被改写或删除，其他设备下次同步时也会跟着变化。',
    button: '上传一次'
  },
  force: {
    title: '立即强制同步？',
    text: '这会忽略服务器上的同步锁。请先确认其他设备已停止同步，同时写入可能损坏数据。',
    button: '强制同步'
  }
} as const

export function PopupSyncWorkspace({ active, onBackToBookmarks }: {
  active: boolean
  onBackToBookmarks: () => void
}) {
  const [profiles, setProfiles] = useState<SyncProfileView[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadFailure, setLoadFailure] = useState<{ text: string; needsReload: boolean } | null>(null)
  const [message, setMessage] = useState({ text: '', error: false })
  const [pending, setPending] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'home' })
  const [confirmation, setConfirmation] = useState<{ profile: SyncProfileView; mode: 'download' | 'upload' | 'force' } | null>(null)
  const [imported, setImported] = useState<unknown[] | null>(null)
  const [importName, setImportName] = useState('')
  const [exportIds, setExportIds] = useState<string[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [fullLogs, setFullLogs] = useState(false)
  const [logsLoaded, setLogsLoaded] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  const busy = useRef(false)
  const refreshState = useRef({ pending: false, dirty: false })
  const requestEpoch = useRef(0)
  const editorKey = useRef(0)
  const [, tick] = useState(0)

  const refresh = useCallback(async () => {
    const state = refreshState.current
    if (state.pending) { state.dirty = true; return }
    state.pending = true
    do {
      state.dirty = false
      try {
        const next = await loadSyncProfiles()
        if (alive.current && !state.dirty) { setProfiles(next); setLoaded(true); setLoadFailure(null) }
      } catch (reason) {
        if (alive.current && !state.dirty) setLoadFailure({
          text: failure(reason, '同步状态读取失败，请重试。'), needsReload: isBackgroundRuntimeError(reason)
        })
      }
    } while (alive.current && state.dirty)
    state.pending = false
  }, [])

  useEffect(() => {
    alive.current = true
    void refresh()
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[SYNC_ACCOUNTS_STORAGE_KEY]) void refresh()
    }
    chrome.storage.onChanged.addListener(changed)
    const timer = setInterval(() => tick(value => value + 1), 60000)
    return () => {
      alive.current = false
      requestEpoch.current++
      clearInterval(timer)
      chrome.storage.onChanged.removeListener(changed)
    }
  }, [refresh])

  useEffect(() => { if (active) void refresh() }, [active, refresh])
  useLayoutEffect(() => {
    if (active && view.kind !== 'home') root.current?.querySelector<HTMLButtonElement>('[data-sync-back]')?.focus({ preventScroll: true })
  }, [view.kind, active])

  const navigate = (next: View) => {
    requestEpoch.current++
    setView(next)
    setMessage({ text: '', error: false })
  }
  const back = () => {
    navigate({ kind: 'home' })
    document.getElementById('popup-sync-collapse')?.focus({ preventScroll: true })
  }
  const editor = (profile: SyncProfileView | null) => navigate({ kind: 'editor', profile, key: ++editorKey.current })

  const perform = (id: string, task: (current: () => boolean) => Promise<string | void>, fallback: string) => {
    if (busy.current) return
    busy.current = true
    setPending(id)
    setMessage({ text: '', error: false })
    const epoch = requestEpoch.current
    const current = () => alive.current && epoch === requestEpoch.current
    void task(current).then(text => {
      if (current() && text) setMessage({ text, error: false })
    }, reason => {
      if (current()) setMessage({ text: failure(reason, fallback), error: true })
    }).finally(() => {
      busy.current = false
      if (alive.current) { setPending(null); void refresh() }
    })
  }
  const run = (profile: SyncProfileView, mode: SyncRunMode) => {
    if (busy.current) return
    const granted = requestSyncPermissions(profile.data)
    perform(profile.id, async () => {
      if (!await granted) throw new Error('未授予访问权限，无法同步。')
      await requestSync({ type: 'sync:run', id: profile.id, mode })
    }, '同步未能开始，请重试。')
  }
  const runAll = () => {
    if (busy.current) return
    const granted = requestSyncProfilePermissions(profiles.map(profile => profile.data))
    perform('all', async () => {
      if (!await granted) throw new Error('未授予访问权限，无法同步。')
      await requestSync({ type: 'sync:run-all' })
    }, '同步未能开始，请重试。')
  }
  const readLogs = (anonymous = true) => {
    if (busy.current) return
    navigate({ kind: 'logs' })
    setLogs([])
    setLogsLoaded(false)
    setFullLogs(!anonymous)
    perform('logs', async current => {
      const result = await requestSync({ type: 'sync:logs', anonymous })
      if (current()) { setLogs(result); setLogsLoaded(true) }
    }, '同步日志读取失败，请重试。')
  }
  const downloadLogs = () => {
    downloadBlobFile(`curator-sync-${fullLogs ? 'full' : 'redacted'}.log`, new Blob([logs.join('\n')], { type: 'text/plain;charset=utf-8' }))
  }
  const readImport = (file?: File) => {
    if (!file) return
    setImported(null)
    setImportName('')
    perform('read-import', async current => {
      if (file.size > 5 * 1024 * 1024) throw new Error('请选择 5 MB 以内的同步配置文件。')
      let value: unknown
      try { value = JSON.parse(await file.text()) } catch { throw new Error('文件不是有效的 JSON 同步配置。') }
      const list = Array.isArray(value) ? value : [value]
      if (!list.length || list.length > 100 || list.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
        throw new Error('文件里没有可导入的同步配置。')
      }
      if (current()) { setImported(list); setImportName(file.name) }
    }, '同步配置读取失败。')
  }
  const commitImport = () => {
    if (!imported) return
    perform('import', async current => {
      const result = await requestSync({ type: 'sync:import', profiles: imported })
      const next = await loadSyncProfiles()
      if (!current()) return
      setProfiles(next)
      const incomplete = result.incomplete && next.find(profile => profile.id === result.incomplete?.id)
      setImported(null)
      if (incomplete) editor(incomplete)
      else navigate({ kind: 'home' })
      setMessage({ text: `已导入 ${result.ids.length} 项配置${incomplete ? '，请完成账号或文件夹设置。' : '。'}`, error: false })
    }, '同步配置导入失败。')
  }
  const commitExport = () => {
    perform('export', async current => {
      const value = await requestSync({ type: 'sync:export', ids: exportIds })
      if (!current()) return
      downloadJsonFile('curator-sync-profiles.json', value)
      back()
    }, '同步配置导出失败。')
  }
  const errorDetail = () => navigate({ kind: 'detail', title: '同步操作未完成', text: loadFailure?.text || message.text })
  const anyRunning = profiles.some(busyProfile)
  const currentConfirmation = confirmation && profiles.find(profile => profile.id === confirmation.profile.id)
  const copy = confirmation ? overwriteCopy[confirmation.mode] : null
  const viewHeading = view.kind === 'logs' ? fullLogs ? '完整同步日志' : '同步日志' : view.kind === 'import' ? '导入同步配置'
    : view.kind === 'export' ? '导出同步配置' : view.kind === 'detail' ? view.title : ''

  return <div ref={root} className="popup-sync-body" onKeyDown={event => {
    if (event.defaultPrevented || event.key !== 'Escape' || confirmation) return
    if (view.kind !== 'home') { event.preventDefault(); event.stopPropagation(); back() }
    else { event.preventDefault(); onBackToBookmarks() }
  }}>
    <section className="popup-sync-home" hidden={view.kind !== 'home'}>
      <ul className="popup-sync-list" aria-label="同步配置">
        {profiles.map(profile => {
          const title = getSyncProfileTitle(profile)
          const state = getSyncProfileStatus(profile, time => formatSyncTime(time))
          const isBusy = busyProfile(profile)
          const automatic = Boolean(profile.data.enabled || profile.data.syncIntervalEnabled || profile.data.syncOnStartupEnabled)
          const service = SYNC_ADAPTERS[profile.data.type]?.label || profile.data.type
          const icon: IconName = state.state === 'syncing' ? 'RefreshCw'
            : state.state === 'scheduled' || state.state === 'pending' ? 'Clock'
              : state.tone !== 'neutral' ? 'AlertTriangle' : profile.data.lastSync ? 'Check' : 'Clock'
          const label = state.state === 'syncing' || state.state === 'scheduled' ? state.text
            : state.state === 'error' ? '同步失败' : state.state === 'authorize' ? '需要连接'
              : state.state === 'folder' ? '文件夹失效' : state.state === 'pending' ? '待同步'
                : state.state === 'stale' ? '久未同步' : !profile.data.lastSync ? '尚未同步'
                  : `上次成功 ${formatSyncTime(profile.data.lastSync)}`
          // A healthy row's state is its last success; the automatic checkbox already shows the mode.
          const resting = state.tone === 'neutral' && state.state !== 'syncing' && state.state !== 'scheduled' && state.state !== 'pending'
          const runLabel = pending === profile.id ? '处理中' : isBusy ? '取消本次'
            : state.state === 'authorize' ? '连接账号' : state.state === 'folder' ? '选择文件夹' : state.state === 'error' ? '重试' : '立即同步'
          return <li key={profile.id} className="popup-sync-profile" data-sync-profile={profile.id}>
            <div className="popup-sync-identity">
              <div className="popup-sync-name">
                <h3><Icon name={profile.data.localRoot === SYNC_TABS_ROOT ? 'PanelRight' : 'Folder'} size={14} aria-hidden="true" /><span title={profile.folderPath.join(' / ')}>{title}</span></h3>
                <p title={profile.label}>{profile.label.startsWith(service) ? profile.label : `${service} · ${profile.label}`}</p>
              </div>
              <div className="popup-sync-profile-status" data-tone={state.tone}>
                <span><Icon name={icon} size={13} aria-hidden="true" className={state.state === 'syncing' ? 'animate-spin motion-reduce:animate-none' : ''} />{label}</span>
                {state.tone !== 'neutral' || state.state === 'pending' ? <Button className="popup-sync-error" title={state.text}
                  onClick={() => navigate({ kind: 'detail', title: `${title} · 同步状态`, text: state.text })} unstyled>{state.text}</Button> : null}
                {resting ? null : <p>{profile.data.lastSync ? `上次成功 ${formatSyncTime(profile.data.lastSync)}` : '尚未完成首次同步'}</p>}
              </div>
            </div>
            <div className="popup-sync-actions">
              <Button className="popup-sync-action" aria-label={`${title}的同步选项`} disabled={isBusy || Boolean(pending)} onClick={() => editor(profile)} unstyled>
                <Icon name="Settings" size={14} aria-hidden="true" />选项
              </Button>
              <Checkbox label="自动" aria-label={`${title}自动同步`} checked={automatic}
                labelClassName="popup-sync-auto" disabled={isBusy || Boolean(pending)}
                onCheckedChange={checked => {
                  if (busy.current) return
                  const data = checked ? { enabled: true, syncIntervalEnabled: true } : { enabled: false, syncIntervalEnabled: false, syncOnStartupEnabled: false }
                  const granted = checked ? requestSyncPermissions(profile.data) : Promise.resolve(true)
                  perform(profile.id, async () => {
                    if (!await granted) throw new Error('未授予访问权限，无法开启自动同步。')
                    await requestSync({ type: 'sync:update', id: profile.id, data })
                  }, '自动同步设置失败。')
                }} />
              {profile.data.failsafe === false ? <Button className="popup-sync-action text-ds-warning" title="大量变更保护已关闭"
                onClick={() => editor(profile)} unstyled><Icon name="AlertTriangle" size={13} /></Button> : null}
              {state.state === 'scheduled' ? <Button className="popup-sync-action" onClick={() => setConfirmation({ profile, mode: 'force' })} unstyled>现在同步</Button> : null}
              <div className="popup-sync-profile-buttons">
                <Button className="popup-sync-direction" title="下载一次" aria-label={`下载一次：${title}`}
                  disabled={isBusy || Boolean(pending) || profile.needsAuthorization || !profile.localFolderExists}
                  onClick={() => setConfirmation({ profile, mode: 'download' })} unstyled><Icon name="ArrowDown" size={14} aria-hidden="true" /></Button>
                <Button className="popup-sync-direction" title="上传一次" aria-label={`上传一次：${title}`}
                  disabled={isBusy || Boolean(pending) || profile.needsAuthorization || !profile.localFolderExists}
                  onClick={() => setConfirmation({ profile, mode: 'upload' })} unstyled><Icon name="ArrowUp" size={14} aria-hidden="true" /></Button>
                <Button className="popup-sync-run" aria-label={`${runLabel}：${title}`} disabled={Boolean(pending)}
                  data-primary={state.state === 'error' || state.state === 'authorize' || undefined}
                  onClick={() => isBusy ? perform(profile.id, async () => { await requestSync({ type: 'sync:cancel', id: profile.id }) }, '取消失败。')
                    : profile.needsAuthorization || !profile.localFolderExists ? editor(profile) : run(profile, 'normal')} unstyled>
                  <StableLabel text={runLabel} reserve={['立即同步', '选择文件夹']} />
                </Button>
              </div>
            </div>
            {state.progress !== null ? <div className="popup-sync-progress" role="progressbar" aria-label={`${title}同步进度`}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.progress * 100)}>
              <div style={{ transform: `scaleX(${state.progress})` }} />
            </div> : null}
          </li>
        })}
        {!profiles.length ? <li className="popup-sync-notice">{loadFailure ? '暂时无法读取同步配置。' : loaded ? '还没有同步配置。' : '正在读取同步配置…'}</li> : null}
      </ul>
      <footer className="popup-sync-footer">
        <div className="popup-sync-footer-actions">
          <Button className="popup-sync-action" onClick={() => editor(null)} disabled={Boolean(pending)} unstyled>
            <Icon name="Plus" size={14} aria-hidden="true" />添加配置
          </Button>
          <OptionActionsMenu label="更多同步操作" triggerLabel="更多" side="top" disabled={Boolean(pending)}
            actions={[
              { id: 'import', label: '导入配置', icon: 'Upload', onSelect: () => { setImported(null); setImportName(''); navigate({ kind: 'import' }) } },
              { id: 'export', label: '导出配置', icon: 'Download', disabled: !profiles.length, onSelect: () => { setExportIds(profiles.map(profile => profile.id)); navigate({ kind: 'export' }) } },
              { id: 'logs', label: '同步日志', separatorBefore: true, onSelect: () => readLogs() }
            ]} />
        </div>
        <button className="popup-sync-footer-message" data-error={Boolean(loadFailure || message.error)}
          title={loadFailure?.text || message.text} onClick={errorDetail} disabled={!loadFailure && !message.text}>
          {loadFailure ? '读取失败，查看详情' : message.text}
        </button>
        {loadFailure ? <Button size="sm" variant="secondary" onClick={() => loadFailure.needsReload ? void openExtensionManager() : void refresh()}>{loadFailure.needsReload ? '扩展管理' : '重试'}</Button>
          : <Button className="popup-sync-run" data-primary="true" disabled={!profiles.length || Boolean(pending) || anyRunning} onClick={runAll} unstyled>
            <Icon name="RefreshCw" size={14} aria-hidden="true" />同步全部
          </Button>}
      </footer>
    </section>

    {view.kind === 'editor' ? <section className="popup-sync-editor">
      <SyncProfileEditor key={view.key} profile={view.profile} embedded transient={!isSidePanelSurface()} onClose={back} onSaved={text => {
        back(); setMessage({ text, error: false }); void refresh()
      }} />
    </section> : view.kind !== 'home' ? <section className="popup-sync-subview">
      <header className="popup-sync-subheader"><Button data-sync-back size="icon-sm" variant="ghost" aria-label="返回同步列表" onClick={back}>
        <Icon name="ChevronRight" className="rotate-180" size={16} /></Button><h3>{viewHeading}</h3></header>
      <div className="popup-sync-detail">
        {view.kind === 'detail' ? <p>{view.text}</p> : null}
        {view.kind === 'logs' ? <>
          {!logsLoaded ? <p>正在读取日志…</p> : logs.length ? <pre>{logs.slice(-200).join('\n')}</pre> : <p>还没有同步日志。</p>}
        </> : null}
        {view.kind === 'import' ? <>
          <label className="grid gap-3">选择同步配置文件
            <input aria-label="同步配置文件" type="file" accept=".json,application/json" disabled={Boolean(pending)}
              onChange={event => { readImport(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
          </label>
          <p>{imported ? `${importName} · 将添加 ${imported.length} 项配置` : '支持 Curator 与 floccus 导出的同步配置。'}</p>
        </> : null}
        {view.kind === 'export' ? <>
          <p>文件包含服务器密码和账号凭据，请妥善保管。</p>
          <div className="grid gap-3">{profiles.map(profile => <Checkbox key={profile.id}
            label={`${getSyncProfileTitle(profile)} · ${profile.label}`}
            labelClassName="flex gap-2 items-center text-xs"
            checked={exportIds.includes(profile.id)} onCheckedChange={checked => setExportIds(ids => checked ? [...ids, profile.id] : ids.filter(id => id !== profile.id))} />)}</div>
        </> : null}
      </div>
      <footer className="popup-sync-footer">
        <span className="popup-sync-footer-message" data-error={message.error} title={message.text} role="status">{message.text}</span>
        {view.kind === 'import' ? <Button size="sm" variant="primary" disabled={!imported || Boolean(pending)} onClick={commitImport}>导入配置</Button> : null}
        {view.kind === 'export' ? <Button size="sm" variant="primary" disabled={!exportIds.length || Boolean(pending)} onClick={commitExport}>导出 {exportIds.length} 项</Button> : null}
        {view.kind === 'logs' ? <>
          <OptionActionsMenu label="日志操作" triggerLabel="更多" side="top" disabled={Boolean(pending)} actions={[
            { id: 'refresh', label: '重新读取日志', onSelect: () => readLogs(!fullLogs) },
            { id: 'full', label: fullLogs ? '查看匿名日志' : '查看完整日志', description: fullLogs ? undefined : '包含书签标题和网址', onSelect: () => readLogs(fullLogs) },
            { id: 'clear', label: '清空日志', danger: true, onSelect: () => perform('clear-logs', async current => {
              await requestSync({ type: 'sync:clear-logs' }); if (current()) setLogs([])
            }, '日志清理失败。') }
          ]} />
          <Button size="sm" variant="secondary" disabled={!logs.length || Boolean(pending)} onClick={downloadLogs}>导出日志</Button>
        </> : null}
        {view.kind === 'detail' ? <>
          <Button size="sm" variant="secondary" onClick={() => readLogs()}>查看日志</Button>
          {loadFailure ? <Button size="sm" variant="primary" onClick={() => loadFailure.needsReload ? void openExtensionManager() : void refresh()}>{loadFailure.needsReload ? '扩展管理' : '重试'}</Button> : null}
        </> : null}
      </footer>
    </section> : null}

    <DialogOverlay open={Boolean(confirmation && active)} onOpenChange={next => { if (!next) setConfirmation(null) }}
      keepMounted={false} modal className="fixed inset-0 z-[10100] grid place-items-center p-3" data-popup-sync-overlay>
      <DialogBackdrop className="absolute inset-0 bg-black/70" />
      <DialogPanel className="popup-sync-confirm relative" aria-labelledby="popup-sync-confirm-title" initialFocus={() => document.getElementById('popup-sync-confirm-cancel')}>
        <h2 id="popup-sync-confirm-title">{copy?.title}</h2>
        <p>{confirmation?.mode === 'download' && confirmation.profile.data.localRoot === SYNC_TABS_ROOT
          ? '服务器上的窗口和标签组会覆盖本机普通窗口，可能关闭当前标签页。隐身窗口不受影响。' : copy?.text}</p>
        <div className="popup-sync-confirm-actions">
          <Button id="popup-sync-confirm-cancel" size="sm" variant="secondary" onClick={() => setConfirmation(null)}>取消</Button>
          <Button size="sm" variant="danger" disabled={!currentConfirmation || Boolean(pending) || Boolean(currentConfirmation.data.syncing)}
            onClick={() => {
              if (confirmation && currentConfirmation) run(currentConfirmation, confirmation.mode)
              setConfirmation(null)
            }}>{copy?.button}</Button>
        </div>
      </DialogPanel>
    </DialogOverlay>
  </div>
}
