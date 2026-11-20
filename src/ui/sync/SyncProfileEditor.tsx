import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '../base/Button'
import { CloseButton } from '../base/CloseButton'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '../base/Collapsible'
import { DialogBody, DialogFooter, DialogHeader } from '../base/Dialog'
import { Input } from '../base/Input'
import { Select } from '../base/Select'
import { StableLabel, StatusMessage } from '../base/StatusMessage'
import { SwitchControl } from '../base/Switch'
import { HoldConfirmButton } from '../actions/HoldConfirmButton'
import { RevealInput } from '../actions/RevealInput'
import { Icon } from '../icons/Icon'
import { writeClipboardText } from '../../shared/clipboard'
import { findBookmarksBar } from '../../shared/bookmark-tree'
import {
  SYNC_INTERVAL_MINUTES,
  SYNC_TABS_ROOT,
  type SyncAdapterType,
  type SyncOAuthSettings,
  type SyncProfileInput,
  type SyncProfileView
} from '../../shared/sync/sync-contract'
import { requestSync } from '../../shared/sync/sync-messages'
import { continueSyncEditorInTab, type SyncEditorTransfer } from '../../shared/sync/sync-editor-transfer'
import { closeTransientPopup } from '../../shared/extension-surfaces'
import { runNextcloudLogin } from '../../options/sync/nextcloud-login'
import {
  SYNC_ADAPTERS,
  SYNC_ADAPTER_ORDER,
  SYNC_BEHAVIOR_DEFAULTS,
  SYNC_DIRECTION_LABELS,
  WEBDAV_PRESETS,
  formatSyncInterval,
  getSyncProfileTitle,
  listSyncFolders,
  requestSyncPermissions,
  type SyncFieldSpec,
  type SyncFolderOption
} from '../../options/sync/sync-model'
import {
  OPTION_SWITCH_CONTROL_CLASS as AI_SETTINGS_SWITCH_CONTROL_CLASS,
  OPTION_SWITCH_THUMB_CLASS as AI_SETTINGS_SWITCH_THUMB_CLASS,
  OPTION_SWITCH_WRAP_CLASS as AI_SETTINGS_SWITCH_WRAP_CLASS
} from '../switch-classes.js'
import './sync-profile-editor.css'

const OPTIONS_MODAL_TITLE_CLASS = 'm-0 text-base font-semibold leading-[1.35] text-ds-text-primary'

const LABEL_CLASS = 'text-xs font-semibold leading-[1.2] text-ds-text-muted'
const FIELD_CLASS = 'flex min-w-0 flex-col gap-2'
const INPUT_CLASS = 'bg-ds-surface-3 placeholder:text-ds-text-disabled'
const SELECT_TRIGGER_CLASS = 'w-full bg-ds-surface-3 text-left'
// The list is portalled to the body; it has to sit above the dialog that opened it.
const SELECT_POSITIONER_CLASS = 'z-[10000]'
const BODY_CLASS = 'grid gap-5 pr-1 [scrollbar-color:var(--ds-border-hover)_transparent] [scrollbar-width:thin]'
const GRID_CLASS = 'grid grid-cols-2 items-start gap-x-3.5 gap-y-4 @max-[560px]/sync-editor:grid-cols-1'
const SECTION_CLASS = 'grid gap-4 border-t border-ds-border-subtle pt-5'
const NOTE_CLASS = 'm-0 text-[13px] leading-[1.6] text-ds-text-secondary'
const SAVED_SECRET_PLACEHOLDER = '已保存，留空不修改'

const errorText = (reason: unknown, fallback: string) => reason instanceof Error ? reason.message : fallback

function Field({ label, action, children, wide = false }: {
  label: string
  action?: ReactNode
  children: (id: string) => ReactNode
  wide?: boolean
}) {
  const id = useId()
  return (
    <div className={`${FIELD_CLASS} ${wide ? 'col-span-full' : ''}`}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <label htmlFor={id} className={LABEL_CLASS}>{label}</label>
        {action}
      </div>
      {children(id)}
    </div>
  )
}

function Toggle({ label, detail, checked, onChange, disabled }: {
  label: string
  detail?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <div className="min-w-0">
        <span className="block text-sm leading-[1.4] text-ds-text-primary">{label}</span>
        {detail ? <span id={id} className="mt-0.5 block text-xs leading-[1.5] text-ds-text-secondary">{detail}</span> : null}
      </div>
      <span className={AI_SETTINGS_SWITCH_WRAP_CLASS}>
        <SwitchControl
          aria-label={label}
          aria-describedby={detail ? id : undefined}
          checked={checked}
          disabled={disabled}
          className={AI_SETTINGS_SWITCH_CONTROL_CLASS}
          thumbClassName={AI_SETTINGS_SWITCH_THUMB_CLASS}
          onCheckedChange={onChange}
          unstyled
        />
      </span>
    </div>
  )
}

export function SyncProfileEditor({ profile, onClose, onSaved, embedded = false, transient = false, initialTransfer }: {
  profile: SyncProfileView | null
  onClose: () => void
  onSaved: (message: string) => void
  embedded?: boolean
  transient?: boolean
  initialTransfer?: SyncEditorTransfer
}) {
  const initialType: SyncAdapterType = initialTransfer?.input.type || profile?.data.type || 'webdav'
  const [draft, setDraft] = useState<SyncProfileInput>(() => {
    if (initialTransfer) {
      const { password: _password, passphrase: _passphrase, refreshToken: _token, ...data } = initialTransfer.input
      return data
    }
    return profile
    ? { ...profile.data }
    : { type: initialType, label: '', localRoot: '', ...SYNC_BEHAVIOR_DEFAULTS, ...SYNC_ADAPTERS[initialType].defaults }
  })
  // Stored secrets never reach the page; an empty field leaves the stored one alone.
  const [password, setPassword] = useState(initialTransfer?.input.password || '')
  const [passphrase, setPassphrase] = useState(
    SYNC_ADAPTERS[initialType].passphraseField === 'password' ? initialTransfer?.input.password || '' : initialTransfer?.input.passphrase || ''
  )
  const [removePassphrase, setRemovePassphrase] = useState(
    initialTransfer?.input[SYNC_ADAPTERS[initialType].passphraseField || 'passphrase'] === ''
  )
  const [revealPassword, setRevealPassword] = useState(false)
  const [revealPassphrase, setRevealPassphrase] = useState(false)
  const [revealClientSecret, setRevealClientSecret] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [folders, setFolders] = useState<SyncFolderOption[]>([])
  const [oauth, setOauth] = useState<SyncOAuthSettings | null>(null)
  const [client, setClient] = useState(initialTransfer?.client || { clientId: '', clientSecret: '' })
  const [customOAuth, setCustomOAuth] = useState(initialTransfer?.customOAuth || false)
  const [status, setStatus] = useState<{ text: string; tone: 'neutral' | 'error' | 'success' }>({ text: '', tone: 'neutral' })
  const [pending, setPending] = useState<'save' | 'test' | 'authorize' | 'login' | 'delete' | 'reset' | 'folder' | null>(null)
  const login = useRef<AbortController | null>(null)
  const alive = useRef(true)
  const operation = useRef(0)
  const pendingRef = useRef(false)
  const layoutGrid = embedded
    ? 'grid grid-cols-2 items-start gap-x-3.5 gap-y-4 @max-[560px]/popup:grid-cols-1'
    : GRID_CLASS

  const type = draft.type as SyncAdapterType
  const adapter = SYNC_ADAPTERS[type]
  const tabs = draft.localRoot === SYNC_TABS_ROOT
  const hasPassphrase = adapter.passphraseField ? Boolean(profile?.secrets[adapter.passphraseField]) && !removePassphrase : false
  const authorized = Boolean(refreshToken) || Boolean(profile?.secrets.refreshToken && !profile.needsAuthorization)
  const loginLabel = type === 'google-drive' ? '使用 Google 登录' : '使用 Dropbox 登录'
  const set = (changes: SyncProfileInput) => setDraft(current => ({ ...current, ...changes }))

  useEffect(() => {
    alive.current = true
    void chrome.bookmarks.getTree().then(tree => {
      if (!alive.current) return
      setFolders(listSyncFolders(tree))
      if (!profile && !initialTransfer?.profileId) {
        const localRoot = findBookmarksBar(tree[0])?.id
        if (localRoot) setDraft(current => current.localRoot ? current : { ...current, localRoot })
      }
    })
      .catch(reason => { if (alive.current) setStatus({ text: errorText(reason, '文件夹读取失败，请重新打开设置。'), tone: 'error' }) })
    return () => {
      alive.current = false
      operation.current++
      login.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (!adapter.oauth || oauth) return
    let current = true
    void requestSync({ type: 'sync:oauth-settings' }).then((settings) => {
      if (!current) return
      setOauth(settings)
      setClient(value => value.clientId ? value : { clientId: settings.clients[adapter.oauth!].clientId, clientSecret: '' })
    }).catch(reason => {
      if (current) setStatus({ text: errorText(reason, '授权设置读取失败，请重试。'), tone: 'error' })
    })
    return () => { current = false }
  }, [adapter.oauth, oauth])

  const folderOptions = useMemo(() => [
    ...folders.map(folder => ({ value: folder.id, label: folder.path })),
    { value: SYNC_TABS_ROOT, label: '标签页（所有普通窗口）' }
  ], [folders])

  /** The settings as they will be stored: only secrets the user entered or removed are sent. */
  const buildInput = (): SyncProfileInput => {
    const input: SyncProfileInput = { ...draft, type }
    for (const key of ['syncing', 'scheduled', 'error', 'lastSync', 'pendingChanges', 'rootPath'] as const) delete input[key]
    const field = adapter.passphraseField
    if (field === 'password') {
      // The OAuth services keep their passphrase where others keep the password
      if (passphrase) input.password = passphrase
      else if (removePassphrase) input.password = ''
    } else {
      if (password) input.password = password
      if (field === 'passphrase') {
        if (passphrase) input.passphrase = passphrase
        else if (removePassphrase) input.passphrase = ''
      }
    }
    if (refreshToken) input.refreshToken = refreshToken
    return input
  }

  const run = (kind: NonNullable<typeof pending>, task: () => Promise<string | void>, failure: string) => {
    if (pendingRef.current) return
    pendingRef.current = true
    const request = ++operation.current
    setPending(kind)
    setStatus({ text: '', tone: 'neutral' })
    void task().then(
      (text) => { if (text && alive.current && operation.current === request) setStatus({ text, tone: 'success' }) },
      (reason) => {
        if (!alive.current || operation.current !== request) return
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setStatus({ text: errorText(reason, failure), tone: 'error' })
      }
    ).finally(() => {
      if (operation.current === request) {
        pendingRef.current = false
        if (alive.current) setPending(null)
      }
    })
  }

  const save = () => {
    if (pendingRef.current) return
    const input = buildInput()
    // Chrome shows its prompt only for a request made while the click is handled.
    const granted = requestSyncPermissions(input)
    run('save', async () => {
      if (!input.localRoot) throw new Error('请选择要同步的本地文件夹。')
      if (adapter.oauth && !authorized) throw new Error(`请先连接 ${adapter.label} 账号。`)
      if (!(await granted)) throw new Error('未授予访问权限，未保存。')
      if (profile) await requestSync({ type: 'sync:update', id: profile.id, data: input })
      else await requestSync({ type: 'sync:create', data: input })
      if (alive.current) onSaved(profile ? '同步设置已保存。' : '已添加同步。')
    }, '同步设置保存失败。')
  }

  const test = () => {
    if (pendingRef.current) return
    const input = buildInput()
    const granted = requestSyncPermissions({ ...input, localRoot: '', clickCountEnabled: false })
    run('test', async () => {
      if (!(await granted)) throw new Error('未授予访问权限，无法测试。')
      await requestSync({ type: 'sync:test', data: input, id: profile?.id })
      return '连接成功。'
    }, '连接失败。')
  }

  const authorize = () => {
    if (pendingRef.current) return
    if (transient) {
      run('authorize', async () => {
        await continueSyncEditorInTab({ profileId: profile?.id, input: buildInput(), client, customOAuth })
        closeTransientPopup()
      }, '无法打开登录页面，请重试。')
      return
    }
    // A build without publisher credentials must explain that before asking
    // the user to grant account access. Configured builds go straight to login.
    const configured = customOAuth ? Boolean(client.clientId.trim()) : oauth?.clients[adapter.oauth!].available
    const granted = configured === false ? Promise.resolve(true) : requestSyncPermissions({ type })
    run('authorize', async () => {
      if (!(await granted)) throw new Error('未授予访问权限，无法连接账号。')
      const result = await requestSync({
        type: 'sync:authorize',
        adapter: adapter.oauth!,
        ...(customOAuth ? { client: { clientId: client.clientId, ...(client.clientSecret ? { clientSecret: client.clientSecret } : {}) } } : {})
      })
      if (!alive.current) return
      setRefreshToken(result.refreshToken)
      set({ username: result.username })
    }, '账号连接失败。')
  }

  const nextcloudLogin = () => {
    if (pendingRef.current) return
    if (transient) {
      run('login', async () => {
        await continueSyncEditorInTab({ profileId: profile?.id, input: buildInput(), client, customOAuth })
        closeTransientPopup()
      }, '无法打开登录页面，请重试。')
      return
    }
    const granted = requestSyncPermissions({ type, url: draft.url })
    const controller = new AbortController()
    login.current = controller
    run('login', async () => {
      if (!(await granted)) throw new Error('未授予访问权限，无法登录。')
      const result = await runNextcloudLogin(String(draft.url || ''), controller.signal)
      if (!alive.current) return
      set({ username: result.username })
      setPassword(result.password)
      return `已登录 ${result.username}。`
    }, 'Nextcloud 登录失败。')
  }

  const createFolder = () => run('folder', async () => {
    const title = folderName.trim()
    if (!title) throw new Error('请填写文件夹名称。')
    const parentId = !tabs && draft.localRoot && draft.localRoot !== '0'
      ? draft.localRoot : folders.find(folder => folder.id !== '0')?.id
    if (!parentId) throw new Error('没有可用的父文件夹。')
    const folder = await chrome.bookmarks.create({ parentId, title })
    setFolders(listSyncFolders(await chrome.bookmarks.getTree()))
    set({ localRoot: folder.id })
    setFolderName('')
    setCreatingFolder(false)
    return `已选择“${title}”。`
  }, '文件夹创建失败。')

  const textField = (field: SyncFieldSpec) => {
    const wide = field.key === 'url' || adapter.fields.length === 1
    if (field.secret) {
      return (
        <Field key={field.key} label={field.label} wide={wide}>
          {id => <RevealInput id={id} revealLabel={field.label} revealed={revealPassword} onRevealChange={setRevealPassword}
            autoComplete="new-password" className={INPUT_CLASS} value={password}
            placeholder={profile?.secrets.password ? SAVED_SECRET_PLACEHOLDER : undefined}
            onValueChange={setPassword} />}
        </Field>
      )
    }
    return (
      <Field key={field.key} label={field.label} wide={wide}>
        {id => <Input id={id} className={INPUT_CLASS} value={String(draft[field.key] ?? '')} placeholder={field.placeholder}
          spellCheck={false} autoComplete="off" inputMode={field.key === 'url' ? 'url' : undefined}
          onValueChange={value => set({ [field.key]: value })} />}
      </Field>
    )
  }

  const insecure = /^http:\/\//i.test(String(draft.url || ''))
  const profileSubtitle = profile ? getSyncProfileTitle(profile) : ''

  return (
    <div className="sync-profile-editor">
      <DialogHeader className={embedded ? 'popup-sync-editor-header' : 'flex items-start justify-between gap-3 pb-4'}>
        {embedded ? <Button data-sync-back size="icon-xs" variant="ghost" aria-label="返回同步列表" onClick={onClose}><Icon name="ArrowLeft" size={15} aria-hidden="true" /></Button> : null}
        <div className={embedded ? 'popup-sync-editor-heading' : 'min-w-0'}>
          <h2 id="sync-editor-title" className={OPTIONS_MODAL_TITLE_CLASS}>{profile ? '同步设置' : '添加同步'}</h2>
          {embedded && profileSubtitle ? <span className="popup-sync-editor-subtitle" title={profileSubtitle}>{profileSubtitle}</span> : null}
        </div>
        {!embedded ? <CloseButton label="关闭同步设置" variant="ghost" size="icon" className="shrink-0" onClick={onClose} /> : null}
      </DialogHeader>

      <DialogBody className={embedded ? `${BODY_CLASS} popup-sync-editor-body` : BODY_CLASS}>
        <div className={layoutGrid}>
          <Field label="服务">
            {id => <Select id={id} ariaLabel="同步服务" triggerClassName={SELECT_TRIGGER_CLASS} positionerClassName={SELECT_POSITIONER_CLASS} value={type} disabled={Boolean(profile) || pending !== null}
              options={SYNC_ADAPTER_ORDER.map(value => ({ value, label: SYNC_ADAPTERS[value].label }))}
              onValueChange={(value) => {
                if (!value || value === type) return
                // What was typed for one service means nothing to another
                setPassword(''); setPassphrase(''); setRefreshToken(null)
                setCustomOAuth(false)
                setRevealPassword(false); setRevealPassphrase(false); setRevealClientSecret(false)
                setClient({ clientId: oauth?.clients[value as 'google-drive' | 'dropbox']?.clientId || '', clientSecret: '' })
                setStatus({ text: '', tone: 'neutral' })
                setDraft(current => ({
                  type: value as SyncAdapterType, label: current.label, localRoot: current.localRoot,
                  ...SYNC_BEHAVIOR_DEFAULTS, ...SYNC_ADAPTERS[value as SyncAdapterType].defaults
                }))
              }} />}
          </Field>
          <Field
            label="本地文件夹"
            action={!tabs && !creatingFolder ? (
              <Button unstyled className="inline-flex h-5 items-center gap-1 rounded-ds-xs px-1.5 text-[11px] font-medium text-ds-text-secondary hover:bg-ds-hover hover:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus"
                onClick={() => setCreatingFolder(true)}>
                <Icon name="Plus" size={12} aria-hidden="true" />新建文件夹
              </Button>
            ) : undefined}
          >
            {id => <Select id={id} ariaLabel="要同步的本地文件夹" triggerClassName={SELECT_TRIGGER_CLASS} positionerClassName={SELECT_POSITIONER_CLASS} placeholder="选择文件夹"
              value={draft.localRoot || null} options={folderOptions}
              onValueChange={value => { if (value) set({ localRoot: value }) }} />}
          </Field>
        </div>

        {!tabs ? (
          creatingFolder ? (
            <div className="flex min-w-0 items-center gap-2">
              <Input className={`${INPUT_CLASS} min-w-0 flex-1`} aria-label="新文件夹名称" value={folderName}
                placeholder="在所选文件夹内新建" onValueChange={setFolderName}
                onKeyDown={event => {
                  if (event.key === 'Enter' && pending === null) { event.preventDefault(); createFolder() }
                  if (event.key === 'Escape') { event.stopPropagation(); setCreatingFolder(false) }
                }} />
              <Button size="sm" variant="secondary" disabled={pending !== null || !folderName.trim()} onClick={createFolder}>创建</Button>
              <CloseButton label="取消新建文件夹" size="icon-sm" variant="ghost" onClick={() => setCreatingFolder(false)} />
            </div>
          ) : null
        ) : <p className={NOTE_CLASS}>同步所有普通窗口及标签组，不含隐身窗口。只下载可能关闭本机标签页。</p>}

        <section className={SECTION_CLASS} aria-label="服务器">
          {adapter.oauth ? (
            <>
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <Button size="sm" variant={authorized ? 'secondary' : 'primary'} disabled={pending !== null || !oauth}
                  aria-busy={!oauth || pending === 'authorize' || undefined} onClick={authorize}>
                  <StableLabel reserve={[loginLabel, '重新登录', '正在登录…']}
                    text={pending === 'authorize' ? '正在登录…' : authorized ? '重新登录' : loginLabel} />
                </Button>
                {authorized ? <span className="text-[13px] text-ds-text-secondary [overflow-wrap:anywhere]">已连接{draft.username ? ` ${draft.username}` : ''}</span> : null}
              </div>
              <div className={layoutGrid}>{adapter.fields.map(textField)}</div>
            </>
          ) : (
            <>
              {type === 'webdav' ? <Field label="服务商">
                {id => <Select id={id} ariaLabel="WebDAV 服务商" triggerClassName={SELECT_TRIGGER_CLASS} positionerClassName={SELECT_POSITIONER_CLASS}
                  value={Object.entries(WEBDAV_PRESETS).find(([, address]) => address === draft.url)?.[0] || 'custom'}
                  options={[{ value: 'custom', label: '自定义地址' }, ...Object.keys(WEBDAV_PRESETS).map(value => ({ value, label: value }))]}
                  onValueChange={value => { if (value && value !== 'custom') set({ url: WEBDAV_PRESETS[value] }) }} />}
              </Field> : null}
              <div className={layoutGrid}>{adapter.fields.map(textField)}</div>
              {type === 's3' ? (
                <Toggle label="路径式访问" detail="关闭后以存储桶名作为子域名" checked={draft.pathStyle !== false} onChange={pathStyle => set({ pathStyle })} />
              ) : null}
              {insecure ? <p className={`${NOTE_CLASS} text-ds-warning`}>地址使用 http，密码和书签会以明文传输。</p> : null}
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {adapter.testable ? <Button size="sm" variant="secondary" disabled={pending !== null} onClick={test}>测试连接</Button> : null}
                {type === 'nextcloud-bookmarks' ? (
                  pending === 'login'
                    ? <Button size="sm" variant="secondary" onClick={() => login.current?.abort()}>取消登录</Button>
                    : <Button size="sm" variant="secondary" disabled={pending !== null} onClick={nextcloudLogin}>用浏览器登录</Button>
                ) : null}
              </div>
            </>
          )}

          {adapter.passphraseField || adapter.file ? (
            <div className={layoutGrid}>
              {adapter.passphraseField ? (
                <Field label="加密口令" wide={!adapter.file}>
                  {id => (
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="min-w-0 flex-1"><RevealInput id={id} revealLabel="加密口令" revealed={revealPassphrase} onRevealChange={setRevealPassphrase}
                        autoComplete="new-password" className={INPUT_CLASS} value={passphrase}
                        placeholder={hasPassphrase ? SAVED_SECRET_PLACEHOLDER : removePassphrase ? '保存后不再加密' : '可选，服务器将无法读取书签'}
                        onValueChange={(value) => { setPassphrase(value); if (value) setRemovePassphrase(false) }} /></div>
                      {hasPassphrase && !passphrase ? <Button size="sm" variant="secondary" onClick={() => setRemovePassphrase(true)}>移除</Button> : null}
                    </div>
                  )}
                </Field>
              ) : null}
              {adapter.file ? (
                <Field label="文件格式">
                  {id => <Select id={id} ariaLabel="书签文件格式" triggerClassName={SELECT_TRIGGER_CLASS} positionerClassName={SELECT_POSITIONER_CLASS} value={draft.bookmark_file_type || 'xbel'}
                    options={[{ value: 'xbel', label: 'XBEL（推荐）' }, { value: 'html', label: 'HTML（浏览器可直接导入）' }]}
                    onValueChange={value => { if (value) set({ bookmark_file_type: value as 'xbel' | 'html' }) }} />}
                </Field>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className={SECTION_CLASS} aria-label="同步方式">
          <div className={layoutGrid}>
            <Field label="方向">
              {id => <Select id={id} ariaLabel="同步方向" triggerClassName={SELECT_TRIGGER_CLASS} positionerClassName={SELECT_POSITIONER_CLASS} value={draft.strategy || 'default'}
                options={[
                  { value: 'default', label: SYNC_DIRECTION_LABELS.default },
                  { value: 'slave', label: `${SYNC_DIRECTION_LABELS.slave}：服务器覆盖本机` },
                  { value: 'overwrite', label: `${SYNC_DIRECTION_LABELS.overwrite}：本机覆盖服务器` }
                ]}
                onValueChange={value => { if (value) set({ strategy: value as SyncProfileInput['strategy'] }) }} />}
            </Field>
            <Field label="定时间隔">
              {id => <Select id={id} ariaLabel="定时同步间隔" triggerClassName={SELECT_TRIGGER_CLASS} positionerClassName={SELECT_POSITIONER_CLASS}
                value={draft.syncIntervalEnabled ? String(draft.syncInterval || 15) : 'off'}
                options={[{ value: 'off', label: '不定时' }, ...SYNC_INTERVAL_MINUTES.map(minutes => ({ value: String(minutes), label: `每 ${formatSyncInterval(minutes)}` }))]}
                onValueChange={(value) => {
                  if (!value) return
                  set(value === 'off' ? { syncIntervalEnabled: false } : { syncIntervalEnabled: true, syncInterval: Number(value) })
                }} />}
            </Field>
          </div>
          <Toggle label={tabs ? '标签页变化后同步' : '书签变化后同步'} checked={Boolean(draft.enabled)} onChange={enabled => set({ enabled })} />
          <Toggle label="浏览器启动时同步" checked={Boolean(draft.syncOnStartupEnabled)} onChange={syncOnStartupEnabled => set({ syncOnStartupEnabled })} />
          <Toggle label="只检查，不自动同步" detail="发现待同步的更改后由你决定何时同步"
            checked={Boolean(draft.notifyOnly)} onChange={notifyOnly => set(notifyOnly ? { notifyOnly } : { notifyOnly, notificationsEnabled: false })} />
          {draft.notifyOnly ? (
            <Toggle label="有待同步的更改时发系统通知" checked={Boolean(draft.notificationsEnabled)} onChange={notificationsEnabled => set({ notificationsEnabled })} />
          ) : null}
        </section>

        <div className="border-t border-ds-border-subtle pt-4">
        <CollapsibleRoot>
          <CollapsibleTrigger className="w-fit" render={<Button size="sm" variant="ghost" />}>
            高级
          </CollapsibleTrigger>
          {/* Focus in a scrolling form needs the expanded geometry immediately. */}
          <CollapsiblePanel keepMounted={false} style={{ transition: 'none' }} className="mt-4 grid gap-4">
            <Field label="名称" wide>
              {id => <Input id={id} className={INPUT_CLASS} value={draft.label || ''} placeholder="可选，用于区分同一服务器上的多项同步"
                onValueChange={label => set({ label })} />}
            </Field>
            {adapter.oauth ? <>
              <Toggle label="使用自定义 OAuth 客户端" checked={customOAuth} disabled={pending !== null} onChange={setCustomOAuth} />
              {customOAuth ? <div className="grid gap-4">
                <p className={NOTE_CLASS}>更换客户端后，此服务的其他同步项需要重新登录。</p>
                <div className={FIELD_CLASS}>
                  <span className={LABEL_CLASS}>重定向 URI</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <code className="min-w-0 flex-1 rounded-ds-sm bg-ds-surface-3 px-3 py-2 text-xs text-ds-text-primary [overflow-wrap:anywhere]">
                      {oauth?.redirectUrl || `https://${chrome.runtime.id}.chromiumapp.org/`}
                    </code>
                    <Button size="sm" variant="secondary" aria-label="复制重定向 URI" onClick={() => {
                      const redirect = oauth?.redirectUrl || `https://${chrome.runtime.id}.chromiumapp.org/`
                      void writeClipboardText(redirect).then(
                        () => setStatus({ text: '已复制重定向 URI。', tone: 'success' }),
                        () => setStatus({ text: '复制失败，请手动选择地址复制。', tone: 'error' })
                      )
                    }}>复制</Button>
                  </div>
                </div>
                <div className={layoutGrid}>
                  <Field label="客户端 ID" wide={type === 'dropbox'}>
                    {id => <Input id={id} className={INPUT_CLASS} value={client.clientId} spellCheck={false} autoComplete="off"
                      onValueChange={clientId => setClient(current => ({ ...current, clientId }))} />}
                  </Field>
                  {type === 'google-drive' ? (
                    <Field label="客户端密钥">
                      {id => <RevealInput id={id} revealLabel="客户端密钥" revealed={revealClientSecret} onRevealChange={setRevealClientSecret}
                        autoComplete="new-password" className={INPUT_CLASS} value={client.clientSecret}
                        placeholder={oauth?.clients['google-drive'].hasSecret && client.clientId.trim() === oauth.clients['google-drive'].clientId
                          ? SAVED_SECRET_PLACEHOLDER : undefined}
                        onValueChange={clientSecret => setClient(current => ({ ...current, clientSecret }))} />}
                    </Field>
                  ) : null}
                </div>
              </div> : null}
            </> : null}
            <Toggle label="安全保护" detail="一次同步会删除或新增大量书签时停止，等你确认"
              checked={draft.failsafe !== false} onChange={failsafe => set({ failsafe })} />
            {!tabs ? (
              <Toggle label="包含其他同步项的文件夹" detail="子文件夹另有同步项时，仍把它同步到这里"
                checked={Boolean(draft.nestedSync)} onChange={nestedSync => set({ nestedSync })} />
            ) : null}
            {type === 'linkwarden' ? (
              <Toggle label="同步书签和文件夹顺序" checked={Boolean(draft.syncOrder)}
                onChange={syncOrder => set({ syncOrder })} />
            ) : null}
            {type === 'nextcloud-bookmarks' ? (
              <Toggle label="统计点击次数" detail="需要读取浏览历史，把书签的访问次数记到 Nextcloud"
                checked={Boolean(draft.clickCountEnabled)} onChange={clickCountEnabled => set({ clickCountEnabled })} />
            ) : null}
            {adapter.clientCert ? (
              <Toggle label="发送 Cookie 和客户端证书" detail="服务器位于需要它们的代理之后时开启"
                checked={Boolean(draft.includeCredentials)} onChange={includeCredentials => set({ includeCredentials })} />
            ) : null}
            {adapter.redirects ? (
              <Toggle label="允许重定向" detail="仅当服务器地址有意跳转到别处时开启"
                checked={Boolean(draft.allowRedirects)} onChange={allowRedirects => set({ allowRedirects })} />
            ) : null}
            {profile ? (
              <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                <div className="min-w-0">
                  <span className="block text-sm leading-[1.4] text-ds-text-primary">重置同步记录</span>
                  <span className="mt-0.5 block text-xs leading-[1.5] text-ds-text-secondary">下次同步重新合并本机与服务器，不删除书签</span>
                </div>
                <Button size="sm" variant="secondary" disabled={pending !== null}
                  onClick={() => run('reset', async () => {
                    await requestSync({ type: 'sync:reset', id: profile.id })
                    return '同步记录已重置。'
                  }, '重置失败。')}>重置</Button>
              </div>
            ) : null}
          </CollapsiblePanel>
        </CollapsibleRoot>
        </div>
      </DialogBody>

      <DialogFooter className={embedded ? 'popup-sync-editor-footer' : 'mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-ds-border-subtle pt-4 @max-[560px]/sync-editor:grid-cols-1'}>
        <StatusMessage className={embedded ? 'text-xs leading-[1.5] text-ds-text-secondary' : 'text-[13px] leading-[1.5] text-ds-text-secondary'} lines={embedded ? 1 : 2} tone={status.tone}>
          {status.text}
        </StatusMessage>
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {profile ? (
            <HoldConfirmButton variant="danger" label="删除" disabled={pending !== null}
              onConfirm={() => run('delete', async () => {
                await requestSync({ type: 'sync:delete', id: profile.id })
                if (alive.current) onSaved('已删除同步，本机和服务器上的书签都保留。')
              }, '删除失败。')} />
          ) : null}
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={pending !== null} aria-busy={pending === 'save' || undefined} onClick={save}>
            {profile ? '保存' : '添加'}
          </Button>
        </div>
      </DialogFooter>
    </div>
  )
}
