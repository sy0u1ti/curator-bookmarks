import { useCallback, useEffect, useRef, useState } from 'react'
import { AiProviderCard } from '../../ui/ai/AiProviderCard'
import { Button } from '../../ui/base/Button'
import { Checkbox } from '../../ui/base/Checkbox'
import { DialogBody, DialogFooter, DialogHeader } from '../../ui/base/Dialog'
import { Input } from '../../ui/base/Input'
import { Popover } from '../../ui/base/Popover'
import { StableLabel, StatusMessage } from '../../ui/base/StatusMessage'
import { Icon } from '../../ui/icons/Icon'
import { downloadBlobFile, downloadJsonFile } from '../../shared/download'
import { formatDateTime } from '../../shared/format'
import { SYNC_ACCOUNTS_STORAGE_KEY, SYNC_TABS_ROOT, type SyncProfileView, type SyncRunMode } from '../../shared/sync/sync-contract'
import { requestSync } from '../../shared/sync/sync-messages'
import { takeSyncEditorTransfer, type SyncEditorTransfer } from '../../shared/sync/sync-editor-transfer'
import { isBackgroundRuntimeError, openExtensionManager } from '../../shared/background-runtime'
import {
  SYNC_ADAPTERS,
  SYNC_DIRECTION_LABELS,
  getSyncProfileStatus,
  getSyncProfileTitle,
  getSyncRestingText,
  loadSyncProfiles,
  requestSyncPermissions,
  requestSyncProfilePermissions
} from '../sync/sync-model'
import { exportSyncBookmarks } from '../sync/sync-files'
import {
  AI_SETTINGS_BODY_CLASS,
  AI_SETTINGS_CARD_CLASS,
  AI_SETTINGS_HEADER_BORDERLESS_CLASS,
  AI_SETTINGS_HEADER_CLASS,
  AI_SETTINGS_SUBTITLE_CLASS,
  AI_SETTINGS_TITLE_CLASS
} from './ai-settings-card-classes.js'
import { BACKUP_CARD_COPY_CLASS, BACKUP_ROW_ACTIONS_CLASS, BACKUP_ROW_DETAIL_CLASS, BackupRow } from './BackupRow.js'
import { OptionActionsMenu } from './OptionActionsMenu.js'
import {
  OPTIONS_MODAL_ACTIONS_CLASS,
  OPTIONS_MODAL_BUTTON_CLASS,
  OPTIONS_MODAL_COPY_CLASS,
  OPTIONS_MODAL_TITLE_CLASS
} from './options-modal-classes.js'
import { SyncDialog } from './SyncDialog.js'
import { SyncProfileEditor } from './SyncProfileEditor.js'

const SYNC_COPY = '在设备之间同步书签文件夹或标签页；数据只发往你填写的服务器。'
const RUN_LABELS = ['同步', '取消'] as const

const OVERWRITE_COPY: Record<'download' | 'upload' | 'force', { title: string; copy: string; confirm: string }> = {
  download: {
    title: '本次以服务器为准？',
    copy: '本机这个文件夹里与服务器不同的书签会被改写或删除。同步前会自动创建恢复点。',
    confirm: '覆盖本机'
  },
  upload: {
    title: '本次以本机为准？',
    copy: '服务器上与本机不同的书签会被改写或删除，其他设备下次同步时也会跟着变化。',
    confirm: '覆盖服务器'
  },
  force: {
    title: '立即强制同步？',
    copy: '这会忽略服务器上的同步锁。请确认其他设备已停止同步，同时写入可能损坏数据。',
    confirm: '强制同步'
  }
}

const errorText = (reason: unknown, fallback: string) => reason instanceof Error ? reason.message : fallback

export function SyncCard() {
  const [profiles, setProfiles] = useState<SyncProfileView[]>([])
  const [status, setStatus] = useState<{ text: string; failed: boolean }>({ text: '', failed: false })
  const [loadFailure, setLoadFailure] = useState<{ text: string; needsReload: boolean } | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editor, setEditor] = useState<{ open: boolean; key: number; profile: SyncProfileView | null; transfer?: SyncEditorTransfer }>({ open: false, key: 0, profile: null })
  const [overwrite, setOverwrite] = useState<{ open: boolean; profile: SyncProfileView | null; mode: 'download' | 'upload' | 'force' }>({ open: false, profile: null, mode: 'download' })
  const [exportSelection, setExportSelection] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] })
  const [, tick] = useState(0)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const generation = useRef(0)

  const refresh = useCallback(async () => {
    const request = ++generation.current
    setLoading(true)
    try {
      const next = await loadSyncProfiles()
      if (request === generation.current) { setProfiles(next); setLoadFailure(null) }
    } catch (reason) {
      if (request === generation.current) setLoadFailure({
        text: errorText(reason, '同步状态读取失败，请重试。'), needsReload: isBackgroundRuntimeError(reason)
      })
    } finally {
      if (request === generation.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    void refresh()
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[SYNC_ACCOUNTS_STORAGE_KEY]) void refresh()
    }
    chrome.storage.onChanged.addListener(changed)
    return () => {
      generation.current++
      chrome.storage.onChanged.removeListener(changed)
    }
  }, [refresh])
  const hasProfiles = profiles.length > 0
  useEffect(() => {
    if (!hasProfiles) return
    const timer = setInterval(() => tick(value => value + 1), 60000)
    return () => {
      clearInterval(timer)
    }
  }, [hasProfiles])
  useEffect(() => {
    let current = true
    void takeSyncEditorTransfer().then(async transfer => {
      if (!transfer || !current) return
      const next = await loadSyncProfiles()
      if (!current) return
      const profile = transfer.profileId ? next.find(item => item.id === transfer.profileId) : null
      if (transfer.profileId && !profile) throw new Error('这项同步配置已不存在，请重新添加。')
      setEditor(value => ({ open: true, key: value.key + 1, profile: profile || null, transfer }))
    }).catch(reason => {
      if (current) setStatus({ text: errorText(reason, '无法恢复同步设置。'), failed: true })
    })
    return () => { current = false }
  }, [])

  /** Runs a request to the sync service; what the sync itself did shows on its row. */
  const act = (task: () => Promise<string | void>, failure: string) => {
    setBusy(true)
    setStatus({ text: '', failed: false })
    void task().then(
      text => setStatus({ text: text || '', failed: false }),
      reason => setStatus({ text: errorText(reason, failure), failed: true })
    ).finally(() => setBusy(false))
  }

  const run = (profile: SyncProfileView, mode: SyncRunMode) => {
    // Asked for inside the click: an imported profile has no access to its server yet.
    const granted = requestSyncPermissions(profile.data)
    act(async () => {
      if (!(await granted)) throw new Error('未授予访问权限，无法同步。')
      await requestSync({ type: 'sync:run', id: profile.id, mode })
    }, '同步未能开始，请重试。')
  }

  const openEditor = (profile: SyncProfileView | null) => setEditor(current => ({ open: true, key: current.key + 1, profile }))
  const exportProfiles = (selected: SyncProfileView[]) => act(async () => {
    downloadJsonFile('curator-sync-profiles.json', await requestSync({ type: 'sync:export', ids: selected.map(profile => profile.id) }))
  }, '同步配置导出失败。')
  const runAll = () => {
    const granted = requestSyncProfilePermissions(profiles.map(profile => profile.data))
    act(async () => {
      if (!await granted) throw new Error('未授予访问权限，无法同步。')
      await requestSync({ type: 'sync:run-all' })
    }, '同步未能开始，请重试。')
  }

  const importProfiles = (file?: File) => {
    if (!file) return
    act(async () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(await file.text())
      } catch {
        throw new Error('文件不是有效的同步配置。')
      }
      const result = await requestSync({ type: 'sync:import', profiles: Array.isArray(parsed) ? parsed : [parsed] })
      const next = await loadSyncProfiles()
      setProfiles(next)
      const incomplete = result.incomplete && next.find(profile => profile.id === result.incomplete?.id)
      if (incomplete) openEditor(incomplete)
      return incomplete
        ? `已导入 ${result.ids.length} 项。${result.incomplete?.reason === 'folder' ? '请为它选择本地文件夹。' : '请重新连接账号。'}`
        : `已导入 ${result.ids.length} 项，首次同步时会请求访问服务器。`
    }, '同步配置导入失败。')
  }

  const downloadLogs = (anonymous: boolean) => act(async () => {
    const lines = await requestSync({ type: 'sync:logs', anonymous })
    if (!lines.length) return '还没有同步日志。'
    const date = new Date().toISOString().slice(0, 10)
    downloadBlobFile(`curator-sync-${date}-${anonymous ? 'redacted' : 'full'}.log`, new Blob([lines.join('\n')], { type: 'text/plain' }))
  }, '日志读取失败。')

  const anySyncing = profiles.some(profile => profile.data.syncing)
  const overwriteCopy = OVERWRITE_COPY[overwrite.mode]

  return (
    <>
      <AiProviderCard
        as="section"
        id="settings-sync"
        aria-labelledby="sync-title"
        className={AI_SETTINGS_CARD_CLASS}
        title={<h2 id="sync-title" className={AI_SETTINGS_TITLE_CLASS}>同步</h2>}
        description={
          <StatusMessage className={AI_SETTINGS_SUBTITLE_CLASS} reserve={[SYNC_COPY]} tone={loadFailure || status.failed ? 'error' : 'neutral'}>
            {loadFailure?.text || status.text || SYNC_COPY}
          </StatusMessage>
        }
        status={
          <div className={BACKUP_ROW_ACTIONS_CLASS}>
            {profiles.length > 1 ? (
              <Button size="sm" variant="secondary" disabled={busy || anySyncing} aria-label="同步全部"
                onClick={runAll}>
                <Icon name="RefreshCw" size={14} aria-hidden="true" />
                全部同步
              </Button>
            ) : null}
            <OptionActionsMenu
              label="同步配置与日志"
              triggerLabel="更多"
              disabled={busy}
              actions={[
                { id: 'import', label: '导入配置', icon: 'Upload', onSelect: () => importInputRef.current?.click() },
                {
                  id: 'export', label: '导出配置', description: '选择要导出的同步项', icon: 'Download', disabled: !profiles.length,
                  onSelect: () => setExportSelection({ open: true, ids: profiles.map(profile => profile.id) })
                },
                { id: 'logs', label: '下载日志', description: '已隐去书签、网址和账号', separatorBefore: true, onSelect: () => downloadLogs(true) },
                { id: 'full-logs', label: '下载完整日志', description: '包含书签标题和网址', onSelect: () => downloadLogs(false) }
              ]}
            />
            <Button size="sm" variant={loadFailure ? 'secondary' : 'primary'} disabled={loading && Boolean(loadFailure)}
              aria-label={loadFailure ? loadFailure.needsReload ? '打开扩展管理以更新后台' : '重新读取同步状态' : '添加同步'}
              onClick={() => loadFailure
                ? loadFailure.needsReload ? void openExtensionManager() : void refresh()
                : openEditor(null)}>
              <Icon name={loadFailure ? 'RefreshCw' : 'Plus'} size={14} aria-hidden="true" />
              <StableLabel reserve={['添加', '扩展管理', '重试']} text={loadFailure ? loadFailure.needsReload ? '扩展管理' : '重试' : '添加'} />
            </Button>
            <Input ref={importInputRef} aria-label="导入同步配置文件" type="file" accept="application/json,.json" hidden
              onChange={(event) => {
                importProfiles(event.currentTarget.files?.[0])
                event.currentTarget.value = ''
              }} />
          </div>
        }
        headerClassName={profiles.length ? AI_SETTINGS_HEADER_CLASS : AI_SETTINGS_HEADER_BORDERLESS_CLASS}
        copyClassName={BACKUP_CARD_COPY_CLASS}
        iconName={false}
        bodyClassName={AI_SETTINGS_BODY_CLASS}
      >
        {profiles.length ? (
          <ul className="m-0 grid list-none divide-y divide-ds-border-subtle p-0" aria-label="同步项">
            {profiles.map(profile => {
              const title = getSyncProfileTitle(profile)
              const state = getSyncProfileStatus(profile, formatDateTime)
              const active = state.state === 'syncing' || state.state === 'scheduled'
              const service = SYNC_ADAPTERS[profile.data.type]?.label || profile.data.type
              return (
                <li key={profile.id} className="relative" aria-busy={state.state === 'syncing' || undefined}>
                  <BackupRow
                    title={title}
                    detail={<>
                      <p className={`${BACKUP_ROW_DETAIL_CLASS} [overflow-wrap:anywhere]`}>
                        {/* Some services already name themselves in the address */}
                        {profile.label.startsWith(service) ? profile.label : `${service} · ${profile.label}`}
                        {' · '}{SYNC_DIRECTION_LABELS[profile.data.strategy || 'default']}
                        {profile.data.failsafe === false ? <span className="text-ds-warning-text"> · 安全保护已关闭</span> : null}
                      </p>
                      <StatusMessage className={BACKUP_ROW_DETAIL_CLASS} reserve={[getSyncRestingText(profile, formatDateTime)]} tone={state.tone}>
                        {state.state === 'error' ? (
                          // The row keeps its height; the whole message, which says how to recover, opens beside it.
                          <Popover
                            title="同步失败"
                            align="start"
                            sideOffset={6}
                            collisionPadding={16}
                            showArrow={false}
                            popupClassName="max-h-[min(320px,var(--available-height))] overflow-auto"
                            trigger={
                              <button type="button" aria-label={`查看同步失败详情：${title}`}
                                className="flex max-w-full cursor-pointer items-center gap-1 rounded-ds-xs border-0 bg-transparent p-0 text-left font-[inherit] text-[length:inherit] leading-[inherit] text-ds-danger-text outline-none hover:underline focus-visible:shadow-ds-focus">
                                <span className="min-w-0 truncate">{state.text}</span>
                              </button>
                            }
                          >
                            <p className="m-0 text-sm leading-relaxed [overflow-wrap:anywhere]">{state.text}</p>
                            <Button size="sm" variant="secondary" className="mt-3" onClick={() => downloadLogs(true)}>下载日志</Button>
                          </Popover>
                        ) : state.text}
                      </StatusMessage>
                    </>}
                  >
                    <Button size="sm" variant="secondary" aria-label={`同步设置：${title}`}
                      onClick={() => openEditor(profile)}>
                      <Icon name="Settings" size={14} aria-hidden="true" />
                      设置
                    </Button>
                    <OptionActionsMenu
                      label={`${title}的更多同步操作`}
                      triggerLabel="更多"
                      actions={[
                        { id: 'download', label: '本次以服务器为准', description: '覆盖本机，先创建恢复点', disabled: active, onSelect: () => setOverwrite({ open: true, profile, mode: 'download' }) },
                        { id: 'upload', label: '本次以本机为准', description: '覆盖服务器', disabled: active, onSelect: () => setOverwrite({ open: true, profile, mode: 'upload' }) },
                        ...(state.state === 'scheduled' ? [{
                          id: 'force', label: '立即强制同步', description: '不等其他设备释放服务器上的锁', onSelect: () => setOverwrite({ open: true, profile, mode: 'force' })
                        }] : []),
                        { id: 'export-profile', label: '导出此配置', description: '文件包含服务器密码，请妥善保管', icon: 'Download', separatorBefore: true, onSelect: () => exportProfiles([profile]) },
                        { id: 'export-bookmarks', label: '导出此项书签', disabled: !profile.localFolderExists, onSelect: () => act(() => exportSyncBookmarks(profile), '书签导出失败。') }
                      ]}
                    />
                    <Button size="sm" variant="secondary"
                      aria-label={active ? `取消同步：${title}` : state.state === 'authorize' ? `连接同步账号：${title}` : state.state === 'folder' ? `选择同步文件夹：${title}` : `同步：${title}`}
                      disabled={busy}
                      onClick={() => active
                        ? act(() => requestSync({ type: 'sync:cancel', id: profile.id }), '取消失败，请重试。')
                        : state.state === 'authorize' || state.state === 'folder' ? openEditor(profile) : run(profile, 'normal')}>
                      <Icon name={active ? 'X' : state.state === 'folder' ? 'Folder' : 'RefreshCw'} size={14} aria-hidden="true" />
                      <StableLabel text={active ? '取消' : state.state === 'authorize' ? '连接' : state.state === 'folder' ? '选择文件夹' : '同步'} reserve={RUN_LABELS} />
                    </Button>
                  </BackupRow>
                </li>
              )
            })}
          </ul>
        ) : null}
      </AiProviderCard>

      <SyncDialog open={editor.open} form labelledBy="sync-editor-title" onClose={() => setEditor(current => ({ ...current, open: false }))}>
        {/* The dialog stays mounted while closed; the editor reads the bookmark tree, so it waits for its first opening. */}
        {editor.key ? (
          <SyncProfileEditor
            key={editor.key}
            profile={editor.profile}
            initialTransfer={editor.transfer}
            onClose={() => setEditor(current => ({ ...current, open: false }))}
            onSaved={(text) => {
              setEditor(current => ({ ...current, open: false }))
              setStatus({ text, failed: false })
              void refresh()
            }}
          />
        ) : null}
      </SyncDialog>

      <SyncDialog open={exportSelection.open} form labelledBy="sync-export-title" onClose={() => setExportSelection(current => ({ ...current, open: false }))}>
        <DialogHeader>
          <h2 id="sync-export-title" className={OPTIONS_MODAL_TITLE_CLASS}>导出同步配置</h2>
          <p className={OPTIONS_MODAL_COPY_CLASS}>文件包含服务器密码，请妥善保管。</p>
        </DialogHeader>
        <DialogBody className="grid gap-1">
          {profiles.map(profile => <Checkbox key={profile.id}
            label={`${getSyncProfileTitle(profile)} · ${profile.label}`}
            checked={exportSelection.ids.includes(profile.id)}
            labelClassName="min-h-11 rounded-ds-sm px-2 py-2 text-sm"
            onCheckedChange={checked => setExportSelection(current => ({
              ...current, ids: checked ? [...current.ids, profile.id] : current.ids.filter(id => id !== profile.id)
            }))} />)}
        </DialogBody>
        <DialogFooter className={OPTIONS_MODAL_ACTIONS_CLASS}>
          <Button variant="secondary" onClick={() => setExportSelection(current => ({ ...current, open: false }))}>取消</Button>
          <Button variant="primary" disabled={!exportSelection.ids.length} onClick={() => {
            exportProfiles(profiles.filter(profile => exportSelection.ids.includes(profile.id)))
            setExportSelection(current => ({ ...current, open: false }))
          }}>导出 {exportSelection.ids.length} 项</Button>
        </DialogFooter>
      </SyncDialog>

      <SyncDialog open={overwrite.open} labelledBy="sync-overwrite-title" describedBy="sync-overwrite-copy"
        onClose={() => setOverwrite(current => ({ ...current, open: false }))}>
        <h2 id="sync-overwrite-title" className={OPTIONS_MODAL_TITLE_CLASS}>{overwriteCopy.title}</h2>
        <p id="sync-overwrite-copy" className={OPTIONS_MODAL_COPY_CLASS}>{
          overwrite.profile?.data.localRoot === SYNC_TABS_ROOT && overwrite.mode === 'download'
            ? '服务器上的窗口和标签组会覆盖本机普通窗口，可能关闭当前标签页。隐身窗口不受影响。'
            : overwriteCopy.copy
        }</p>
        <div className={OPTIONS_MODAL_ACTIONS_CLASS}>
          <Button className={OPTIONS_MODAL_BUTTON_CLASS} variant="secondary" onClick={() => setOverwrite(current => ({ ...current, open: false }))}>取消</Button>
          <Button className={OPTIONS_MODAL_BUTTON_CLASS} variant="danger" onClick={() => {
            setOverwrite(current => ({ ...current, open: false }))
            if (overwrite.profile) run(overwrite.profile, overwrite.mode)
          }}>{overwriteCopy.confirm}</Button>
        </div>
      </SyncDialog>
    </>
  )
}
