import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '../../ui/base/Button'
import { Checkbox } from '../../ui/base/Checkbox'
import { DialogBackdrop, DialogOverlay, DialogPanel } from '../../ui/base/Dialog'
import { ErrorState } from '../../ui/base/ErrorState'
import { StableLabel } from '../../ui/base/StatusMessage'
import { Icon, type IconName } from '../../ui/icons/Icon'
import { downloadBlobFile, downloadJsonFile } from '../../shared/download'
import { isSidePanelSurface } from '../../shared/extension-surfaces'
import { isBackgroundRuntimeError, openExtensionManager } from '../../shared/background-runtime'
import { getMotionDurationMs, prefersReducedMotion } from '../../shared/motion'
import { SYNC_ACCOUNTS_STORAGE_KEY, SYNC_TABS_ROOT, type SyncProfileView, type SyncRunMode } from '../../shared/sync/sync-contract'
import { requestSync } from '../../shared/sync/sync-messages'
import { formatSyncTime } from '../../shared/sync/sync-status'
import {
  SYNC_ADAPTERS, SYNC_DIRECTION_LABELS, formatSyncInterval, getSyncProfileStatus, getSyncProfileTitle, loadSyncProfiles,
  requestSyncPermissions, requestSyncProfilePermissions, type SyncProfileStatus
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

type Subview = Exclude<View, { kind: 'home' }>

interface SubviewLayerState {
  view: Subview
  phase: 'open' | 'closing'
}

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

interface ProfilePresentation {
  title: string
  state: SyncProfileStatus
  isBusy: boolean
  automatic: boolean
  service: string
  icon: IconName
  label: string
  resting: boolean
  runLabel: string
}

function describeProfile(profile: SyncProfileView, pending: string | null): ProfilePresentation {
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
  return { title, state, isBusy, automatic, service, icon, label, resting, runLabel }
}

function automaticLabel(profile: SyncProfileView): string {
  if (!profile.data.enabled && !profile.data.syncIntervalEnabled && !profile.data.syncOnStartupEnabled) return '手动'
  if (profile.data.syncIntervalEnabled) return `每 ${formatSyncInterval(profile.data.syncInterval || 15)}`
  if (profile.data.enabled) return '变化时同步'
  return '启动时同步'
}

function formatRemoteSummary(label: string, service: string): string {
  const trimmed = label.trim()
  if (!trimmed || trimmed === service) return service
  const prefix = `${service}:`
  if (trimmed.startsWith(prefix)) {
    const detail = trimmed.slice(prefix.length).trim()
    return detail ? `${service} · ${detail}` : service
  }
  if (trimmed.startsWith(service)) return trimmed
  return `${service} · ${trimmed}`
}

function directionIcon(strategy: SyncProfileView['data']['strategy']): IconName {
  if (strategy === 'slave') return 'ArrowLeft'
  if (strategy === 'overwrite') return 'ArrowRight'
  return 'ArrowLeftRight'
}

function ProfileStatus({ profile, presentation, onError }: {
  profile: SyncProfileView
  presentation: ProfilePresentation
  onError: () => void
}) {
  const { label, icon, resting, state, title } = presentation
  const tone = state.tone !== 'neutral' ? state.tone : profile.data.lastSync && state.state !== 'syncing' && state.state !== 'scheduled' ? 'success' : 'neutral'
  return <div className="popup-sync-profile-status" data-tone={tone}>
    <span><Icon name={icon} size={13} aria-hidden="true" className={state.state === 'syncing' ? 'animate-spin motion-reduce:animate-none' : ''} />{label}</span>
    {state.tone !== 'neutral' || state.state === 'pending' ? <Button className="popup-sync-error" title={state.text}
      onClick={onError} unstyled>{state.text}</Button> : null}
    {resting ? null : <p>{profile.data.lastSync ? `上次成功 ${formatSyncTime(profile.data.lastSync)}` : '尚未完成首次同步'}</p>}
    <span className="sr-only">{title}</span>
  </div>
}

function ProfileActions({ profile, presentation, pending, className, showRun = true, showAuto = true, onOptions, onAutoChange, onForce, onDownload, onUpload, onRun }: {
  profile: SyncProfileView
  presentation: ProfilePresentation
  pending: string | null
  className?: string
  showRun?: boolean
  showAuto?: boolean
  onOptions: () => void
  onAutoChange: (checked: boolean) => void
  onForce: () => void
  onDownload: () => void
  onUpload: () => void
  onRun: () => void
}) {
  const { automatic, isBusy, runLabel, state, title } = presentation
  return <div className={`popup-sync-actions${className ? ` ${className}` : ''}`}>
    <Button className="popup-sync-action" aria-label={`${title}的同步选项`} disabled={isBusy || Boolean(pending)} onClick={onOptions} unstyled>
      <Icon name="Settings" size={14} aria-hidden="true" />选项
    </Button>
    {showAuto ? <Checkbox label="自动" aria-label={`${title}自动同步`} checked={automatic}
      labelClassName="popup-sync-auto" disabled={isBusy || Boolean(pending)}
      onCheckedChange={onAutoChange} /> : null}
    {profile.data.failsafe === false ? <Button className="popup-sync-action text-ds-warning" data-tone="warning" title="大量变更保护已关闭"
      onClick={onOptions} unstyled><Icon name="AlertTriangle" size={13} /></Button> : null}
    {state.state === 'scheduled' ? <Button className="popup-sync-action" onClick={onForce} unstyled>现在同步</Button> : null}
    <div className="popup-sync-profile-buttons">
      <Button className="popup-sync-direction" title="下载一次" aria-label={`下载一次：${title}`}
        disabled={isBusy || Boolean(pending) || profile.needsAuthorization || !profile.localFolderExists}
        onClick={onDownload} unstyled><Icon name="Download" size={14} aria-hidden="true" /></Button>
      <Button className="popup-sync-direction" title="上传一次" aria-label={`上传一次：${title}`}
        disabled={isBusy || Boolean(pending) || profile.needsAuthorization || !profile.localFolderExists}
        onClick={onUpload} unstyled><Icon name="Upload" size={14} aria-hidden="true" /></Button>
      {showRun ? <Button className="popup-sync-run" aria-label={`${runLabel}：${title}`} disabled={Boolean(pending)}
        data-primary={state.state === 'error' || state.state === 'authorize' || undefined}
        onClick={onRun} unstyled>
        <StableLabel text={runLabel} reserve={['立即同步', '选择文件夹']} />
      </Button> : null}
    </div>
  </div>
}

function ProfileCockpit({ profile, presentation, pending, onOptions, onAutoChange, onForce, onDownload, onUpload, onRun, onError }: {
  profile: SyncProfileView
  presentation: ProfilePresentation
  pending: string | null
  onOptions: () => void
  onAutoChange: (checked: boolean) => void
  onForce: () => void
  onDownload: () => void
  onUpload: () => void
  onRun: () => void
  onError: () => void
}) {
  const { isBusy, service, state, title } = presentation
  const lastSync = profile.data.lastSync ? formatSyncTime(profile.data.lastSync) : '尚未同步'
  const remoteSummary = formatRemoteSummary(profile.label, service)
  const direction = SYNC_DIRECTION_LABELS[profile.data.strategy || 'default']
  const syncedReady = state.tone === 'neutral' && state.state !== 'syncing' && state.state !== 'scheduled' && Boolean(profile.data.lastSync)
  const orbTone = state.tone !== 'neutral' ? state.tone : state.state === 'syncing' ? 'syncing' : syncedReady ? 'success' : 'neutral'
  const orbIcon: IconName = state.state === 'syncing' ? 'RefreshCw'
    : state.state === 'scheduled' || state.state === 'pending' || (!profile.data.lastSync && state.tone === 'neutral') ? 'Clock'
      : state.tone !== 'neutral' ? 'AlertTriangle' : 'Check'
  const showStatusDetail = ['error', 'pending', 'authorize', 'folder', 'stale'].includes(state.state)
  const sideLabel = state.state === 'syncing' ? state.text : state.state === 'scheduled' ? '等待同步'
    : state.state === 'error' ? '同步失败' : state.state === 'pending' ? '待同步'
      : state.state === 'stale' ? '久未同步' : state.state === 'authorize' ? '需要连接账号'
        : state.state === 'folder' ? '文件夹失效' : !profile.data.lastSync ? '尚未同步' : '同步就绪'
  const sideText = state.state === 'syncing' ? ''
    : state.state === 'scheduled' ? '等待其他任务结束'
      : state.state === 'error' ? (profile.data.lastSync ? `上次成功 ${lastSync}` : '尚未同步')
        : state.state === 'pending' ? (profile.data.lastSync ? `上次成功 ${lastSync}` : '尚未同步')
          : state.state === 'stale' ? lastSync
            : state.state === 'authorize' ? '连接后继续'
              : state.state === 'folder' ? '需重新选择'
                : profile.data.lastSync ? lastSync : ''
  const runIcon: IconName = isBusy
    ? 'X'
    : state.state === 'folder'
      ? 'Folder'
      : state.state === 'authorize'
        ? 'ExternalLink'
        : 'RefreshCw'
  return <li className="popup-sync-profile popup-sync-cockpit" data-sync-profile={profile.id}>
    <div className="popup-sync-cockpit-card" data-tone={orbTone}>
      <div className="popup-sync-cockpit-main">
        <div className="popup-sync-cockpit-hero">
          <div className="popup-sync-cockpit-glyph" aria-hidden="true">
            <Icon name={profile.data.localRoot === SYNC_TABS_ROOT ? 'PanelRight' : 'Folder'} size={19} />
          </div>
          <div className="popup-sync-name">
            <h3><span title={profile.folderPath.join(' / ')}>{title}</span></h3>
            <p title={profile.label}>{remoteSummary}</p>
          </div>
        </div>
        <div className="popup-sync-path" aria-label="同步路径" data-syncing={state.state === 'syncing' || undefined}>
          <span className="popup-sync-endpoint">
            <Icon name={profile.data.localRoot === SYNC_TABS_ROOT ? 'PanelRight' : 'Folder'} size={13} aria-hidden="true" />
            <span title={profile.folderPath.join(' / ')}>{title}</span>
          </span>
          <span className="popup-sync-path-connector" title={direction} aria-hidden="true">
            <span />
            <Icon name={directionIcon(profile.data.strategy)} size={13} />
            <span />
          </span>
          <span className="popup-sync-endpoint popup-sync-endpoint-right">
            <span title={service}>{service}</span>
            <Icon name="Globe" size={13} aria-hidden="true" />
          </span>
        </div>
        {showStatusDetail ? (
          <div className="popup-sync-profile-status popup-sync-cockpit-alert" data-tone={state.tone}>
            {state.tone === 'neutral' ? <Icon name={presentation.icon} size={13} aria-hidden="true" /> : null}
            <Button className="popup-sync-error" title={state.text} onClick={onError} unstyled>{state.text}</Button>
          </div>
        ) : null}
      </div>
      <aside className="popup-sync-cockpit-side" data-tone={orbTone}>
        <div className="popup-sync-orb" data-tone={orbTone} aria-hidden="true">
          <Icon name={orbIcon} size={20} className={state.state === 'syncing' ? 'animate-spin motion-reduce:animate-none' : undefined} />
        </div>
        <div className="popup-sync-cockpit-side-copy">
          <strong>{sideLabel}</strong>
          {sideText ? <p>{sideText}</p> : null}
        </div>
        <Button className="popup-sync-run popup-sync-cockpit-run" aria-label={`${presentation.runLabel}：${title}`} disabled={Boolean(pending)}
          data-primary={!isBusy || undefined}
          onClick={onRun} unstyled>
          <Icon name={runIcon} size={13} aria-hidden="true" />
          <StableLabel text={presentation.runLabel} reserve={['立即同步', '选择文件夹']} />
        </Button>
      </aside>
    </div>
    <div className="popup-sync-facts">
      <div className="popup-sync-fact popup-sync-fact--toggle">
        <div>
          <span>自动同步</span>
          <strong>{automaticLabel(profile)}</strong>
        </div>
        <Checkbox aria-label={`${title}自动同步`} checked={presentation.automatic}
          labelClassName="popup-sync-auto" disabled={isBusy || Boolean(pending)}
          onCheckedChange={onAutoChange} />
      </div>
      <div className="popup-sync-fact"><span>同步方向</span><strong>{direction}</strong></div>
      <div className="popup-sync-fact" data-warning={profile.data.failsafe === false || undefined}>
        <span>安全保护</span><strong>{profile.data.failsafe === false ? '已关闭' : '已开启'}</strong>
      </div>
    </div>
    <ProfileActions profile={profile} presentation={presentation} pending={pending} className="popup-sync-cockpit-actions" showRun={false} showAuto={false}
      onOptions={onOptions} onAutoChange={onAutoChange} onForce={onForce} onDownload={onDownload} onUpload={onUpload} onRun={onRun} />
  </li>
}

export function PopupSyncWorkspace({ active, onBackToBookmarks, onHeaderModeChange }: {
  active: boolean
  onBackToBookmarks: () => void
  onHeaderModeChange?: (mode: 'summary' | 'quiet') => void
}) {
  const [profiles, setProfiles] = useState<SyncProfileView[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadFailure, setLoadFailure] = useState<{ text: string; needsReload: boolean } | null>(null)
  const [message, setMessage] = useState({ text: '', error: false })
  const [pending, setPending] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'home' })
  const [subviewLayer, setSubviewLayer] = useState<SubviewLayerState | null>(null)
  const [confirmation, setConfirmation] = useState<{ profile: SyncProfileView; mode: 'download' | 'upload' | 'force' } | null>(null)
  const [imported, setImported] = useState<unknown[] | null>(null)
  const [importName, setImportName] = useState('')
  const [exportIds, setExportIds] = useState<string[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [fullLogs, setFullLogs] = useState(false)
  const [logsLoaded, setLogsLoaded] = useState(false)
  const [logsError, setLogsError] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const subviewRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | null>(null)
  const alive = useRef(true)
  const busy = useRef(false)
  const refreshState = useRef({ pending: false, dirty: false })
  const requestEpoch = useRef(0)
  const editorKey = useRef(0)
  const [, tick] = useState(0)

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

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
      clearCloseTimer()
      clearInterval(timer)
      chrome.storage.onChanged.removeListener(changed)
    }
  }, [clearCloseTimer, refresh])

  useEffect(() => {
    if (active) {
      void refresh()
    } else if (subviewLayer?.phase === 'closing') {
      clearCloseTimer()
      setSubviewLayer(null)
    }
  }, [active, clearCloseTimer, refresh, subviewLayer?.phase])
  useLayoutEffect(() => {
    if (!active || view.kind === 'home') return
    if (document.documentElement.dataset.motionInput === 'keyboard') {
      subviewRef.current?.querySelector<HTMLButtonElement>('[data-sync-back]')?.focus({ preventScroll: true })
    } else {
      subviewRef.current?.focus({ preventScroll: true })
    }
  }, [view, active])

  const navigate = (next: View) => {
    requestEpoch.current++
    setView(next)
    setMessage({ text: '', error: false })
    clearCloseTimer()
    if (next.kind === 'home') {
      const duration = getMotionDurationMs('--ds-motion-standard', 220, root.current ?? undefined)
      if (duration <= 0) {
        setSubviewLayer(null)
      } else {
        setSubviewLayer(current => current ? { ...current, phase: 'closing' } : null)
        closeTimer.current = window.setTimeout(() => {
          closeTimer.current = null
          setSubviewLayer(current => current?.phase === 'closing' ? null : current)
        }, duration + 80)
      }
    } else {
      setSubviewLayer({ view: next, phase: 'open' })
    }
  }
  const back = () => {
    const keyboard = document.documentElement.dataset.motionInput === 'keyboard'
    navigate({ kind: 'home' })
    if (keyboard) document.getElementById('popup-sync-collapse')?.focus({ preventScroll: true })
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
    setLogsError('')
    setFullLogs(!anonymous)
    busy.current = true
    setPending('logs')
    setMessage({ text: '', error: false })
    const epoch = requestEpoch.current
    const current = () => alive.current && epoch === requestEpoch.current
    void requestSync({ type: 'sync:logs', anonymous }).then(result => {
      if (current()) { setLogs(result); setLogsLoaded(true) }
    }, reason => {
      if (current()) {
        setLogsError(failure(reason, '同步日志读取失败，请重试。'))
        setLogsLoaded(true)
      }
    }).finally(() => {
      busy.current = false
      if (alive.current) { setPending(null); void refresh() }
    })
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
  const blockingLoadFailure = Boolean(loadFailure && !profiles.length)
  const singleProfile = profiles.length === 1 ? profiles[0] : null
  const singlePresentation = singleProfile ? describeProfile(singleProfile, pending) : null
  const headerMode: 'summary' | 'quiet' = blockingLoadFailure || Boolean(loadFailure) || profiles.length <= 1 ? 'quiet' : 'summary'
  useEffect(() => {
    onHeaderModeChange?.(headerMode)
  }, [headerMode, onHeaderModeChange])
  const changeAutomatic = (profile: SyncProfileView, checked: boolean) => {
    if (busy.current) return
    const data = checked ? { enabled: true, syncIntervalEnabled: true } : { enabled: false, syncIntervalEnabled: false, syncOnStartupEnabled: false }
    const granted = checked ? requestSyncPermissions(profile.data) : Promise.resolve(true)
    perform(profile.id, async () => {
      if (!await granted) throw new Error('未授予访问权限，无法开启自动同步。')
      await requestSync({ type: 'sync:update', id: profile.id, data })
    }, '自动同步设置失败。')
  }
  const runProfile = (profile: SyncProfileView, presentation: ProfilePresentation) => {
    if (presentation.isBusy) {
      perform(profile.id, async () => { await requestSync({ type: 'sync:cancel', id: profile.id }) }, '取消失败。')
    } else if (profile.needsAuthorization || !profile.localFolderExists) {
      editor(profile)
    } else {
      run(profile, 'normal')
    }
  }
  const currentConfirmation = confirmation && profiles.find(profile => profile.id === confirmation.profile.id)
  const copy = confirmation ? overwriteCopy[confirmation.mode] : null
  const activeSubview = subviewLayer?.view ?? null
  const subviewOpen = view.kind !== 'home'
  const subviewClosing = subviewLayer?.phase === 'closing'
  const subviewKey = activeSubview ? (activeSubview.kind === 'editor' ? `editor-${activeSubview.key}` : activeSubview.kind) : ''
  const viewHeading = activeSubview?.kind === 'logs' ? fullLogs ? '完整同步日志' : '同步日志' : activeSubview?.kind === 'import' ? '导入同步配置'
    : activeSubview?.kind === 'export' ? '导出同步配置' : activeSubview?.kind === 'detail' ? activeSubview.title : ''

  return <div ref={root} className="popup-sync-body" onKeyDown={event => {
    if (event.defaultPrevented || event.key !== 'Escape' || confirmation) return
    if (view.kind !== 'home') { event.preventDefault(); event.stopPropagation(); back() }
    else { event.preventDefault(); onBackToBookmarks() }
  }}>
    <section className="popup-sync-home" data-covered={subviewOpen ? 'true' : 'false'}
      inert={subviewOpen} aria-hidden={subviewOpen || undefined}>
      {singleProfile && singlePresentation ? (
        <ul className="popup-sync-list popup-sync-list--cockpit" aria-label="同步配置">
          <ProfileCockpit profile={singleProfile} presentation={singlePresentation} pending={pending}
            onOptions={() => editor(singleProfile)}
            onAutoChange={checked => changeAutomatic(singleProfile, checked)}
            onForce={() => setConfirmation({ profile: singleProfile, mode: 'force' })}
            onDownload={() => setConfirmation({ profile: singleProfile, mode: 'download' })}
            onUpload={() => setConfirmation({ profile: singleProfile, mode: 'upload' })}
            onRun={() => runProfile(singleProfile, singlePresentation)}
            onError={() => navigate({ kind: 'detail', title: `${singlePresentation.title} · 同步状态`, text: singlePresentation.state.text })} />
        </ul>
      ) : (
        <ul className="popup-sync-list" aria-label="同步配置">
          {profiles.map(profile => {
            const presentation = describeProfile(profile, pending)
            const { title, state } = presentation
            return <li key={profile.id} className="popup-sync-profile" data-sync-profile={profile.id}>
              <div className="popup-sync-identity">
                <span className="popup-sync-profile-glyph" aria-hidden="true">
                  <Icon name={profile.data.localRoot === SYNC_TABS_ROOT ? 'PanelRight' : 'Folder'} size={15} />
                </span>
                <div className="popup-sync-name">
                  <h3><span title={profile.folderPath.join(' / ')}>{title}</span></h3>
                  <p title={profile.label}>{formatRemoteSummary(profile.label, presentation.service)}</p>
                </div>
                <ProfileStatus profile={profile} presentation={presentation}
                  onError={() => navigate({ kind: 'detail', title: `${title} · 同步状态`, text: state.text })} />
              </div>
              <ProfileActions profile={profile} presentation={presentation} pending={pending}
                onOptions={() => editor(profile)} onAutoChange={checked => changeAutomatic(profile, checked)}
                onForce={() => setConfirmation({ profile, mode: 'force' })}
                onDownload={() => setConfirmation({ profile, mode: 'download' })}
                onUpload={() => setConfirmation({ profile, mode: 'upload' })}
                onRun={() => runProfile(profile, presentation)} />
            </li>
          })}
          {!profiles.length ? (
            loadFailure ? (
              <li className="popup-sync-notice popup-sync-notice--error">
                <ErrorState
                  size="compact"
                  title={loadFailure.needsReload ? '同步后台需要重新加载' : '无法读取同步配置'}
                  detail={loadFailure.text}
                  actions={loadFailure.needsReload ? (
                    <>
                      <Button size="sm" variant="primary" onClick={() => void openExtensionManager()}>扩展管理</Button>
                      <Button size="sm" variant="secondary" disabled={Boolean(pending)} onClick={() => void refresh()}>重试</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="primary" disabled={Boolean(pending)} onClick={() => void refresh()}>重试</Button>
                      <Button size="sm" variant="secondary" disabled={Boolean(pending)} onClick={() => readLogs()}>查看日志</Button>
                    </>
                  )}
                />
              </li>
            ) : (
              <li className="popup-sync-notice">
                <div className="popup-sync-empty-icon" aria-hidden="true">
                  <Icon name="RefreshCw" size={18} />
                </div>
                <p>{loaded ? '还没有同步配置' : '正在读取同步配置…'}</p>
                {loaded ? <Button size="sm" variant="primary" disabled={Boolean(pending)} onClick={() => editor(null)}>
                  <Icon name="Plus" size={14} aria-hidden="true" />添加配置
                </Button> : null}
              </li>
            )
          ) : null}
        </ul>
      )}
      {!blockingLoadFailure ? <footer className="popup-sync-footer">
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
          {loadFailure ? '刷新失败，查看详情' : message.text}
        </button>
        {loadFailure ? <Button size="sm" variant="secondary" onClick={() => loadFailure.needsReload ? void openExtensionManager() : void refresh()}>{loadFailure.needsReload ? '扩展管理' : '重试'}</Button>
          : profiles.length > 1 ? <Button className="popup-sync-run" data-primary="true" disabled={Boolean(pending) || anyRunning} onClick={runAll} unstyled>
            <Icon name="RefreshCw" size={14} aria-hidden="true" />同步全部
          </Button> : null}
      </footer> : null}
    </section>

    {activeSubview ? (
      <div
        key={subviewKey}
        ref={subviewRef}
        tabIndex={-1}
        className="popup-sync-subview-layer"
        data-phase={subviewLayer?.phase}
        inert={subviewClosing}
        aria-hidden={subviewClosing || undefined}
        onTransitionEnd={event => {
          if (event.target !== event.currentTarget || subviewLayer?.phase !== 'closing') return
          const finishProp = prefersReducedMotion() ? 'opacity' : 'transform'
          if (event.propertyName === finishProp) {
            clearCloseTimer()
            setSubviewLayer(current => current?.phase === 'closing' ? null : current)
          }
        }}
      >
        {activeSubview.kind === 'editor' ? <section className="popup-sync-editor">
          <SyncProfileEditor key={activeSubview.key} profile={activeSubview.profile} embedded transient={!isSidePanelSurface()} onClose={back} onSaved={text => {
            back(); setMessage({ text, error: false }); void refresh()
          }} />
        </section> : <section className="popup-sync-subview">
          <header className="popup-sync-subheader"><Button data-sync-back size="icon-xs" variant="ghost" aria-label="返回同步列表" onClick={back}>
            <Icon name="ArrowLeft" size={15} aria-hidden="true" /></Button><h3>{viewHeading}</h3></header>
          <div className="popup-sync-detail">
            {activeSubview.kind === 'detail' ? (
              <div className="popup-sync-detail-card" role="alert">
                <span className="popup-sync-detail-icon" aria-hidden="true">
                  <Icon name="AlertTriangle" size={15} />
                </span>
                <p className="popup-sync-detail-text">{activeSubview.text}</p>
              </div>
            ) : null}
            {activeSubview.kind === 'logs' ? <>
              {!logsLoaded ? (
                <div className="popup-sync-subview-state">正在读取日志…</div>
              ) : logsError ? (
                <ErrorState
                  size="compact"
                  className="popup-sync-subview-state"
                  title="无法读取同步日志"
                  detail={logsError}
                  actions={<Button size="sm" variant="primary" disabled={Boolean(pending)} onClick={() => readLogs(!fullLogs)}>重试</Button>}
                />
              ) : logs.length ? <pre>{logs.slice(-200).join('\n')}</pre> : (
                <div className="popup-sync-subview-state">还没有同步日志。</div>
              )}
            </> : null}
            {activeSubview.kind === 'import' ? <>
              <label className="grid gap-3">选择同步配置文件
                <input aria-label="同步配置文件" type="file" accept=".json,application/json" disabled={Boolean(pending)}
                  onChange={event => { readImport(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
              </label>
              <p>{imported ? `${importName} · 将添加 ${imported.length} 项配置` : '支持 Curator 与 floccus 导出的同步配置。'}</p>
            </> : null}
            {activeSubview.kind === 'export' ? <>
              <p>文件包含服务器密码和账号凭据，请妥善保管。</p>
              <div className="grid gap-3">{profiles.map(profile => <Checkbox key={profile.id}
                label={`${getSyncProfileTitle(profile)} · ${profile.label}`}
                labelClassName="flex gap-2 items-center text-xs"
                checked={exportIds.includes(profile.id)} onCheckedChange={checked => setExportIds(ids => checked ? [...ids, profile.id] : ids.filter(id => id !== profile.id))} />)}</div>
            </> : null}
          </div>
          {!(activeSubview.kind === 'logs' && Boolean(logsError)) ? <footer className="popup-sync-footer">
            <span className="popup-sync-footer-message" data-error={message.error} title={message.text} role="status">{message.text}</span>
            {activeSubview.kind === 'import' ? <Button size="sm" variant="primary" disabled={!imported || Boolean(pending)} onClick={commitImport}>导入配置</Button> : null}
            {activeSubview.kind === 'export' ? <Button size="sm" variant="primary" disabled={!exportIds.length || Boolean(pending)} onClick={commitExport}>导出 {exportIds.length} 项</Button> : null}
            {activeSubview.kind === 'logs' ? <>
              <OptionActionsMenu label="日志操作" triggerLabel="更多" side="top" disabled={Boolean(pending)} actions={[
                { id: 'refresh', label: '重新读取日志', onSelect: () => readLogs(!fullLogs) },
                { id: 'full', label: fullLogs ? '查看匿名日志' : '查看完整日志', description: fullLogs ? undefined : '包含书签标题和网址', onSelect: () => readLogs(fullLogs) },
                { id: 'clear', label: '清空日志', danger: true, onSelect: () => perform('clear-logs', async current => {
                  await requestSync({ type: 'sync:clear-logs' }); if (current()) setLogs([])
                }, '日志清理失败。') }
              ]} />
              <Button size="sm" variant="secondary" disabled={!logs.length || Boolean(pending)} onClick={downloadLogs}>导出日志</Button>
            </> : null}
            {activeSubview.kind === 'detail' ? <>
              <Button size="sm" variant="secondary" onClick={() => readLogs()}>查看日志</Button>
              {loadFailure ? <Button size="sm" variant="primary" onClick={() => loadFailure.needsReload ? void openExtensionManager() : void refresh()}>{loadFailure.needsReload ? '扩展管理' : '重试'}</Button> : null}
            </> : null}
          </footer> : null}
        </section>}
      </div>
    ) : null}

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
