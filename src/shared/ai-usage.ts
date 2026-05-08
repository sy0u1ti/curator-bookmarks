import { STORAGE_KEYS } from './constants.js'
import { getLocalStorage, setLocalStorage } from './storage.js'

export const AI_USAGE_DEFAULT_DAILY_LIMIT = 120
export const AI_USAGE_MAX_DAILY_LIMIT = 1000

export type AiUsageFeature =
  | 'ai-naming'
  | 'popup-smart-classifier'
  | 'popup-natural-search'
  | 'dashboard-natural-search'
  | 'service-worker-auto-analyze'

export interface AiUsageLedger {
  version: 1
  dayKey: string
  used: number
  updatedAt: number
}

export interface AiUsageReservation {
  ledger: AiUsageLedger
  requested: number
  limit: number
  remainingBefore: number
  remainingAfter: number
}

export class AiUsageLimitError extends Error {
  feature: AiUsageFeature
  requested: number
  used: number
  limit: number
  remaining: number

  constructor({
    feature,
    requested,
    used,
    limit
  }: {
    feature: AiUsageFeature
    requested: number
    used: number
    limit: number
  }) {
    const remaining = Math.max(0, limit - used)
    super(`今日 AI 请求上限已达到：已用 ${used}/${limit}，本次需要 ${requested}。请明天再试，或在 AI 服务设置中提高每日上限。`)
    this.name = 'AiUsageLimitError'
    this.feature = feature
    this.requested = requested
    this.used = used
    this.limit = limit
    this.remaining = remaining
  }
}

export function getLocalAiUsageDayKey(now = Date.now()): string {
  const date = new Date(now)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function normalizeAiDailyLimit(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return AI_USAGE_DEFAULT_DAILY_LIMIT
  }
  return Math.max(1, Math.min(Math.round(numeric), AI_USAGE_MAX_DAILY_LIMIT))
}

export function normalizeAiUsageLedger(rawLedger: unknown, now = Date.now()): AiUsageLedger {
  const dayKey = getLocalAiUsageDayKey(now)
  const source = rawLedger && typeof rawLedger === 'object' && !Array.isArray(rawLedger)
    ? rawLedger as Record<string, unknown>
    : {}
  const sourceDayKey = String(source.dayKey || '').trim()
  const used = Math.max(0, Math.floor(Number(source.used) || 0))
  const updatedAt = Math.max(0, Math.floor(Number(source.updatedAt) || 0))

  return {
    version: 1,
    dayKey,
    used: sourceDayKey === dayKey ? used : 0,
    updatedAt: sourceDayKey === dayKey ? updatedAt : 0
  }
}

export function getAiUsageRemaining(rawLedger: unknown, dailyLimit: unknown, now = Date.now()): number {
  const ledger = normalizeAiUsageLedger(rawLedger, now)
  const limit = normalizeAiDailyLimit(dailyLimit)
  return Math.max(0, limit - ledger.used)
}

export async function loadAiUsageLedger(now = Date.now()): Promise<AiUsageLedger> {
  const stored = await getLocalStorage([STORAGE_KEYS.aiUsageLedger])
  return normalizeAiUsageLedger(stored[STORAGE_KEYS.aiUsageLedger], now)
}

export async function reserveAiUsage({
  feature,
  itemCount = 1,
  dailyLimit,
  now = Date.now()
}: {
  feature: AiUsageFeature
  itemCount?: number
  dailyLimit?: unknown
  now?: number
}): Promise<AiUsageReservation> {
  const requested = Math.max(1, Math.floor(Number(itemCount) || 1))
  const limit = normalizeAiDailyLimit(dailyLimit)
  const current = await loadAiUsageLedger(now)
  if (current.used + requested > limit) {
    throw new AiUsageLimitError({
      feature,
      requested,
      used: current.used,
      limit
    })
  }

  const ledger: AiUsageLedger = {
    version: 1,
    dayKey: getLocalAiUsageDayKey(now),
    used: current.used + requested,
    updatedAt: now
  }
  await setLocalStorage({
    [STORAGE_KEYS.aiUsageLedger]: ledger
  })

  return {
    ledger,
    requested,
    limit,
    remainingBefore: Math.max(0, limit - current.used),
    remainingAfter: Math.max(0, limit - ledger.used)
  }
}

export function normalizeAiUsageError(error: unknown): string {
  if (error instanceof AiUsageLimitError) {
    return error.message
  }
  return error instanceof Error ? error.message : 'AI 请求失败，请稍后重试。'
}
