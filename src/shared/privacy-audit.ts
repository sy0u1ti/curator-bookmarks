import { STORAGE_KEYS } from './constants.js'
import { getLocalStorage, setLocalStorage } from './storage.js'

export type PrivacyAuditFeature =
  | 'ai-naming'
  | 'ai-provider-models'
  | 'ai-connectivity-test'
  | 'popup-smart-classifier'
  | 'popup-natural-search'
  | 'jina-reader'
  | 'availability-check'

export type PrivacyAuditStatus = 'success' | 'error' | 'cancelled' | 'skipped'

export interface PrivacyAuditLogEntry {
  id: string
  createdAt: number
  feature: PrivacyAuditFeature
  label: string
  target: string
  itemCount: number
  fields: string[]
  includesBody: boolean
  status: PrivacyAuditStatus
  reason: string
}

export interface PrivacyAuditLog {
  version: 1
  updatedAt: number
  entries: PrivacyAuditLogEntry[]
}

export interface PrivacyAuditInput {
  feature: PrivacyAuditFeature
  label?: string
  target?: string
  itemCount?: number
  fields?: unknown
  includesBody?: boolean
  status?: PrivacyAuditStatus
  reason?: unknown
  now?: number
}

export const PRIVACY_AUDIT_LOG_LIMIT = 80

const FEATURE_LABELS: Record<PrivacyAuditFeature, string> = {
  'ai-naming': '书签智能分析',
  'ai-provider-models': 'AI 模型列表',
  'ai-connectivity-test': 'AI 连接测试',
  'popup-smart-classifier': 'Popup 智能分类',
  'popup-natural-search': 'Popup 自然语言搜索',
  'jina-reader': 'Jina Reader 远程解析',
  'availability-check': '死链/重定向检测'
}

export function normalizePrivacyAuditLog(rawLog: unknown): PrivacyAuditLog {
  const source = rawLog && typeof rawLog === 'object' && !Array.isArray(rawLog)
    ? rawLog as Record<string, unknown>
    : {}
  const entries = Array.isArray(source.entries)
    ? source.entries
      .map(normalizePrivacyAuditEntry)
      .filter((entry): entry is PrivacyAuditLogEntry => Boolean(entry))
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, PRIVACY_AUDIT_LOG_LIMIT)
    : []

  return {
    version: 1,
    updatedAt: normalizeTimestamp(source.updatedAt) || latestEntryTime(entries),
    entries
  }
}

export async function loadPrivacyAuditLog(): Promise<PrivacyAuditLog> {
  const stored = await getLocalStorage([STORAGE_KEYS.privacyAuditLog])
  return normalizePrivacyAuditLog(stored[STORAGE_KEYS.privacyAuditLog])
}

export async function appendPrivacyAuditLogEntry(input: PrivacyAuditInput): Promise<PrivacyAuditLog> {
  const current = await loadPrivacyAuditLog().catch(() => normalizePrivacyAuditLog(null))
  const now = normalizeTimestamp(input.now) || Date.now()
  const entry: PrivacyAuditLogEntry = {
    id: `audit-${now}-${Math.random().toString(16).slice(2, 10)}`,
    createdAt: now,
    feature: normalizePrivacyAuditFeature(input.feature),
    label: normalizeText(input.label) || FEATURE_LABELS[normalizePrivacyAuditFeature(input.feature)],
    target: normalizeText(input.target) || '本地任务',
    itemCount: Math.max(0, Math.floor(Number(input.itemCount) || 0)),
    fields: normalizeFieldList(input.fields),
    includesBody: Boolean(input.includesBody),
    status: normalizePrivacyAuditStatus(input.status),
    reason: normalizeText(input.reason).slice(0, 220)
  }
  const nextLog = normalizePrivacyAuditLog({
    version: 1,
    updatedAt: now,
    entries: [entry, ...current.entries]
  })
  await setLocalStorage({
    [STORAGE_KEYS.privacyAuditLog]: nextLog
  })
  return nextLog
}

export async function clearPrivacyAuditLog(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.privacyAuditLog]: normalizePrivacyAuditLog({
      version: 1,
      updatedAt: Date.now(),
      entries: []
    })
  })
}

function normalizePrivacyAuditEntry(rawEntry: unknown): PrivacyAuditLogEntry | null {
  if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
    return null
  }
  const source = rawEntry as Record<string, unknown>
  const createdAt = normalizeTimestamp(source.createdAt)
  const feature = normalizePrivacyAuditFeature(source.feature)
  if (!createdAt) {
    return null
  }

  return {
    id: normalizeText(source.id) || `audit-${createdAt}`,
    createdAt,
    feature,
    label: normalizeText(source.label) || FEATURE_LABELS[feature],
    target: normalizeText(source.target) || '本地任务',
    itemCount: Math.max(0, Math.floor(Number(source.itemCount) || 0)),
    fields: normalizeFieldList(source.fields),
    includesBody: Boolean(source.includesBody),
    status: normalizePrivacyAuditStatus(source.status),
    reason: normalizeText(source.reason).slice(0, 220)
  }
}

function normalizePrivacyAuditFeature(value: unknown): PrivacyAuditFeature {
  const feature = String(value || '').trim() as PrivacyAuditFeature
  return feature in FEATURE_LABELS ? feature : 'availability-check'
}

function normalizePrivacyAuditStatus(value: unknown): PrivacyAuditStatus {
  return value === 'error' || value === 'cancelled' || value === 'skipped'
    ? value
    : 'success'
}

function normalizeFieldList(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，、\n]/)
      : []
  const seen = new Set<string>()
  const output: string[] = []
  for (const item of rawValues) {
    const text = normalizeText(item).slice(0, 48)
    const key = text.toLowerCase()
    if (!text || seen.has(key)) {
      continue
    }
    seen.add(key)
    output.push(text)
    if (output.length >= 12) {
      break
    }
  }
  return output
}

function normalizeTimestamp(value: unknown): number {
  const timestamp = Number(value)
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
}

function normalizeText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function latestEntryTime(entries: PrivacyAuditLogEntry[]): number {
  return entries.reduce((latest, entry) => Math.max(latest, Number(entry.createdAt) || 0), 0)
}
