const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const
const BYTE_FORMATTERS = [0, 1].map((digits) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }))
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})
const DATE_TIME_WITH_YEAR_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

export function formatBytes(bytes: number): string {
  let value = Math.max(0, Number(bytes) || 0)
  let unitIndex = 0
  while (unitIndex < BYTE_UNITS.length - 1 && Math.round(value) >= 1024) {
    value /= 1024
    unitIndex += 1
  }
  const digits = unitIndex === 0 || value >= 100 ? 0 : 1
  return `${BYTE_FORMATTERS[digits].format(value)} ${BYTE_UNITS[unitIndex]}`
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round((Number(durationMs) || 0) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours) return minutes ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`
  if (minutes) return seconds ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分`
  return `${seconds} 秒`
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(Number(timestamp) || 0)
  const formatter = date.getFullYear() === new Date().getFullYear() ? DATE_TIME_FORMATTER : DATE_TIME_WITH_YEAR_FORMATTER
  return formatter.format(date)
}
