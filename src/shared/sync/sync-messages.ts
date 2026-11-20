import {
  type SyncImportResult,
  type SyncOAuthAdapterType,
  type SyncOAuthClient,
  type SyncOAuthSettings,
  type SyncProfileInput,
  type SyncProfileView,
  type SyncRunMode
} from './sync-contract.js'
import { BackgroundRuntimeError, ensureBackgroundReady, recoverFromBackgroundRuntime } from '../background-runtime.js'
import type { SyncStatusSummary } from './sync-status.js'

export type SyncMessage =
  | { type: 'sync:status' }
  | { type: 'sync:list' }
  | { type: 'sync:create'; data: SyncProfileInput }
  | { type: 'sync:update'; id: string; data: SyncProfileInput }
  | { type: 'sync:delete'; id: string }
  | { type: 'sync:reset'; id: string }
  | { type: 'sync:export'; ids: string[] }
  | { type: 'sync:import'; profiles: unknown[] }
  | { type: 'sync:test'; data: SyncProfileInput; id?: string }
  | { type: 'sync:oauth-settings' }
  | { type: 'sync:authorize'; adapter: SyncOAuthAdapterType; client?: SyncOAuthClient }
  | { type: 'sync:logs'; anonymous: boolean }
  | { type: 'sync:clear-logs' }
  | { type: 'sync:run'; id: string; mode: SyncRunMode }
  | { type: 'sync:run-all' }
  | { type: 'sync:cancel'; id: string }

export interface SyncMessageResults {
  'sync:status': SyncStatusSummary
  'sync:list': SyncProfileView[]
  'sync:create': string
  'sync:update': void
  'sync:delete': void
  'sync:reset': void
  'sync:export': unknown[]
  'sync:import': SyncImportResult
  'sync:test': void
  'sync:oauth-settings': SyncOAuthSettings
  'sync:authorize': { refreshToken: string; username: string }
  'sync:logs': string[]
  'sync:clear-logs': void
  'sync:run': void
  'sync:run-all': void
  'sync:cancel': void
}

const RUN_MODES: readonly SyncRunMode[] = ['normal', 'download', 'upload', 'force']
const ID_MAX_LENGTH = 128
const IMPORT_PROFILE_LIMIT = 100

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= ID_MAX_LENGTH

export function isSyncMessageType(type: unknown): type is SyncMessage['type'] {
  return typeof type === 'string' && type.startsWith('sync:')
}

/** Messages cross a process boundary; the worker accepts only these shapes. */
export function parseSyncMessage(message: unknown): { value: SyncMessage } | { error: string } {
  const invalid = { error: '同步请求无效。' }
  if (!isRecord(message)) return invalid
  const { type } = message
  switch (type) {
    case 'sync:status':
    case 'sync:list':
    case 'sync:oauth-settings':
    case 'sync:run-all':
    case 'sync:clear-logs':
      return { value: { type } }
    case 'sync:create':
      return isRecord(message.data) ? { value: { type, data: message.data as SyncProfileInput } } : invalid
    case 'sync:update':
      return isId(message.id) && isRecord(message.data)
        ? { value: { type, id: message.id, data: message.data as SyncProfileInput } }
        : invalid
    case 'sync:delete':
    case 'sync:reset':
    case 'sync:cancel':
      return isId(message.id) ? { value: { type, id: message.id } } : invalid
    case 'sync:export':
      return Array.isArray(message.ids) && message.ids.length > 0 && message.ids.every(isId)
        ? { value: { type, ids: message.ids } }
        : invalid
    case 'sync:import':
      return Array.isArray(message.profiles) && message.profiles.length <= IMPORT_PROFILE_LIMIT &&
        message.profiles.every(isRecord)
        ? { value: { type, profiles: message.profiles } }
        : { error: '文件里没有可导入的同步配置。' }
    case 'sync:test':
      return isRecord(message.data) && (message.id === undefined || isId(message.id))
        ? { value: { type, data: message.data as SyncProfileInput, id: message.id as string | undefined } }
        : invalid
    case 'sync:authorize':
      if (message.adapter !== 'google-drive' && message.adapter !== 'dropbox') return invalid
      if (message.client === undefined) return { value: { type, adapter: message.adapter } }
      return isRecord(message.client) &&
        typeof message.client.clientId === 'string'
        ? {
            value: {
              type,
              adapter: message.adapter,
              client: {
                clientId: message.client.clientId,
                ...(typeof message.client.clientSecret === 'string' ? { clientSecret: message.client.clientSecret } : {})
              }
            }
          }
        : invalid
    case 'sync:logs':
      return { value: { type, anonymous: message.anonymous !== false } }
    case 'sync:run':
      return isId(message.id) && RUN_MODES.includes(message.mode as SyncRunMode)
        ? { value: { type, id: message.id, mode: message.mode as SyncRunMode } }
        : invalid
    default:
      return invalid
  }
}

export async function requestSync<TMessage extends SyncMessage>(
  message: TMessage
): Promise<SyncMessageResults[TMessage['type']]> {
  await ensureBackgroundReady()
  let response: { ok?: boolean; error?: unknown; result?: unknown } | undefined
  try {
    response = await chrome.runtime.sendMessage(message)
  } catch {
    const runtimeError = new BackgroundRuntimeError('background-unavailable')
    recoverFromBackgroundRuntime(runtimeError)
    throw runtimeError
  }
  if (!response?.ok) {
    throw new Error(String(response?.error || '同步服务没有响应，请重试。'))
  }
  return response.result as SyncMessageResults[TMessage['type']]
}
