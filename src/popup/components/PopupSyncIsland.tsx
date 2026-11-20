import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { Button } from '../../ui/base/Button'
import { Icon } from '../../ui/icons/Icon'
import { formatSyncTime, syncStatusDetail, syncStatusLabel } from '../../shared/sync/sync-status'
import { popupActivities, usePopupActivity } from '../popup-activity-store'
import { isPopupSyncOpen, setPopupSyncOpen, usePopupSyncOpen, usePopupSyncStatus } from '../popup-sync-state'
import { PopupSmartClassifierHost } from './PopupSmartClassifierHost'
import { PopupContentHost } from './PopupContentHost'
import '../popup-sync.css'

type SyncWorkspace = ComponentType<{ active: boolean; onBackToBookmarks: () => void }>
let workspace: SyncWorkspace | null = null
let workspacePromise: Promise<SyncWorkspace> | null = null
function loadWorkspace() {
  return workspacePromise ??= import('./PopupSyncWorkspace').then(module => (workspace = module.PopupSyncWorkspace)).catch(error => {
    workspacePromise = null
    throw error
  })
}

export function PopupSyncTrigger() {
  const { status, error } = usePopupSyncStatus()
  const open = usePopupSyncOpen()
  if (!error && !status?.count) return null
  const text = error ? '需处理' : syncStatusLabel(status!)
  const detail = error || (status?.state === 'idle' ? `上次成功 ${formatSyncTime(status.lastSync)}` : syncStatusDetail(status!))
  const running = !error && status?.state === 'running'
  return <Button
    id="popup-sync-toggle" type="button" className="popup-sync-toggle"
    aria-label={error ? '同步状态读取失败，打开同步面板查看详情' : `${detail}，打开同步面板`}
    aria-expanded={open} aria-controls="popup-sync-workspace"
    title={`打开同步面板 · ${detail}`}
    data-tone={error ? 'error' : status?.tone}
    onClick={() => setPopupSyncOpen(!open)} unstyled
  >
    <Icon name={error || status?.attention ? 'AlertTriangle' : status?.waiting ? 'Clock' : 'RefreshCw'}
      size={14} className={running ? 'animate-spin motion-reduce:animate-none' : undefined} aria-hidden="true" />
    <span>{text}</span>
  </Button>
}

/** The bookmark DOM keeps its size and identity while the island reveals over it. */
export function PopupSyncIsland({ hidden }: { hidden: boolean }) {
  const open = usePopupSyncOpen()
  const { status, error } = usePopupSyncStatus()
  const activity = usePopupActivity()
  const [Workspace, setWorkspace] = useState<SyncWorkspace | null>(() => workspace)
  const [loadError, setLoadError] = useState('')
  const root = useRef<HTMLElement>(null)
  const returnFocus = useRef(false)
  const initialActivities = useRef(new Map<string, string>())
  const lastOpen = useRef(false)

  const close = (focus = true) => {
    returnFocus.current = focus
    setPopupSyncOpen(false)
  }
  const load = () => {
    setLoadError('')
    void loadWorkspace().then(component => setWorkspace(() => component))
      .catch(() => setLoadError('同步页面加载失败，请重试。'))
  }
  useEffect(() => { if (open && !Workspace) load() }, [open, Workspace])
  useLayoutEffect(() => {
    popupActivities.pause('sync-workspace', open && !hidden, true)
    if (open && !lastOpen.current) {
      initialActivities.current = new Map(activity.items.map(item => [item.id, JSON.stringify(item)]))
      root.current?.querySelector<HTMLButtonElement>('#popup-sync-collapse')?.focus({ preventScroll: true })
    } else if (!open && lastOpen.current && returnFocus.current) {
      document.getElementById('popup-sync-toggle')?.focus({ preventScroll: true })
      returnFocus.current = false
    }
    lastOpen.current = open
  }, [open, hidden])
  useEffect(() => () => popupActivities.pause('sync-workspace', false), [])
  useEffect(() => {
    if (hidden && open) close(false)
  }, [hidden, open])
  useEffect(() => {
    const focus = (event: FocusEvent) => {
      if (isPopupSyncOpen() && (event.target as HTMLElement)?.closest('#search-input')) close(false)
    }
    const keydown = (event: KeyboardEvent) => {
      if (!isPopupSyncOpen() || event.defaultPrevented) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        close(false)
        document.getElementById('search-input')?.focus({ preventScroll: true })
      } else if (event.key === 'Escape' &&
        !(event.target as HTMLElement)?.closest('[role="menu"], [role="listbox"], [role="dialog"], [data-popup-sync-overlay]')) {
        event.preventDefault()
        const back = root.current?.querySelector<HTMLButtonElement>('.popup-sync-subview-layer:not([data-phase="closing"]) [data-sync-back]')
        if (back) back.click()
        else close()
      }
    }
    document.addEventListener('focusin', focus)
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('focusin', focus)
      document.removeEventListener('keydown', keydown)
    }
  }, [])
  const latest = [...activity.items].reverse().find(item => initialActivities.current.get(item.id) !== JSON.stringify(item))
    || activity.items.find(item => item.id === activity.activeId)
  return <section ref={root} className="popup-sync-stage" hidden={hidden} data-sync-open={open ? 'true' : 'false'}>
    <div className="popup-sync-bookmarks" inert={open} aria-hidden={open || undefined}>
      <PopupContentHost />
    </div>
    <div className="popup-sync-surface">
      <div className="popup-sync-page" inert={open} aria-hidden={open || undefined}>
        <PopupSmartClassifierHost mode="page" covered={open} pageActionAccessory={<PopupSyncTrigger />} />
      </div>
      <section id="popup-sync-workspace" className="popup-sync-view" aria-label="书签同步"
        inert={!open} aria-hidden={!open || undefined}>
        <header className="popup-sync-header">
          <span
            className="popup-sync-header-icon"
            data-tone={error || status?.tone === 'error' ? 'error' : status?.tone === 'warning' ? 'warning' : status?.state === 'idle' ? 'success' : 'neutral'}
            aria-hidden="true"
          >
            <Icon
              name={error || status?.attention ? 'AlertTriangle' : status?.state === 'idle' ? 'Check' : 'RefreshCw'}
              size={14}
              className={!error && status?.state === 'running' ? 'animate-spin motion-reduce:animate-none' : undefined}
            />
          </span>
          <div className="popup-sync-header-copy">
            <h2>同步{status && status.count > 1 ? ` · ${status.count} 项` : ''}</h2>
            <p title={error || undefined}>{error ? '状态读取失败' : status ? syncStatusDetail(status) : '正在读取同步状态'}</p>
          </div>
          {latest ? <Button className="popup-sync-feedback" size="sm" variant="secondary" title={latest.message} onClick={() => {
            popupActivities.select(latest.id)
            close()
          }}>操作反馈</Button> : null}
          <Button id="popup-sync-collapse" className="popup-sync-toggle" aria-label="收起同步面板，返回书签"
            onClick={() => close()} unstyled>收起</Button>
        </header>
        {Workspace ? <Workspace active={open && !hidden} onBackToBookmarks={() => close()} /> :
          <div className="popup-sync-loading" role="status">
            {loadError || '正在读取同步配置…'}
            {loadError ? <Button size="sm" variant="secondary" onClick={load}>重试</Button> : null}
          </div>}
      </section>
    </div>
  </section>
}
