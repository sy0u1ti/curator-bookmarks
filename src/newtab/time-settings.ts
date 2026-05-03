export type NewTabTimeDisplayMode = 'time-date' | 'time' | 'date'
export type NewTabDateFormat =
  | 'year-month-day-weekday'
  | 'chinese-date-weekday'
  | 'month-day-weekday'
  | 'weekday-month-day'
  | 'weekday-day-month'
  | 'year-month-day'
export type NewTabClockDensity = 'compact' | 'balanced' | 'comfortable'
export type NewTabTimeZone =
  | 'auto'
  | 'UTC'
  | 'Asia/Shanghai'
  | 'Asia/Hong_Kong'
  | 'Asia/Tokyo'
  | 'Asia/Singapore'
  | 'Europe/London'
  | 'Europe/Paris'
  | 'America/New_York'
  | 'America/Los_Angeles'

export interface NewTabTimeSettings {
  enabled: boolean
  showSeconds: boolean
  hour12: boolean
  clockSize: number
  dateFormat: NewTabDateFormat
  timeZone: NewTabTimeZone
  displayMode: NewTabTimeDisplayMode
  density: NewTabClockDensity
}

export interface ClockParts {
  year: number
  month: number
  day: number
  weekday: string
  hours: number
  minutes: number
  seconds: number
}

export const DEFAULT_TIME_SETTINGS: NewTabTimeSettings = {
  enabled: true,
  showSeconds: false,
  hour12: false,
  clockSize: 100,
  dateFormat: 'year-month-day-weekday',
  timeZone: 'auto',
  displayMode: 'time-date',
  density: 'balanced'
}

export const TIME_ZONE_LABELS: Record<NewTabTimeZone, string> = {
  auto: '本地',
  UTC: 'UTC',
  'Asia/Shanghai': '北京',
  'Asia/Hong_Kong': '香港',
  'Asia/Tokyo': '东京',
  'Asia/Singapore': '新加坡',
  'Europe/London': '伦敦',
  'Europe/Paris': '巴黎',
  'America/New_York': '纽约',
  'America/Los_Angeles': '洛杉矶'
}

const SUPPORTED_TIME_ZONES = new Set<string>(Object.keys(TIME_ZONE_LABELS))
const SUPPORTED_DISPLAY_MODES = new Set<string>(['time-date', 'time', 'date'])
const SUPPORTED_DATE_FORMATS = new Set<string>([
  'year-month-day-weekday',
  'chinese-date-weekday',
  'month-day-weekday',
  'weekday-day-month',
  'weekday-month-day',
  'year-month-day'
])
const SUPPORTED_DENSITIES = new Set<string>(['compact', 'balanced', 'comfortable'])
const LEGACY_DATE_FORMAT_MAP: Record<string, NewTabDateFormat> = {
  auto: 'month-day-weekday',
  zh: 'month-day-weekday',
  iso: 'year-month-day'
}

export function normalizeTimeSettings(rawSettings: unknown): NewTabTimeSettings {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_TIME_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const rawDateFormat = String(settings.dateFormat)
  const dateFormat = LEGACY_DATE_FORMAT_MAP[rawDateFormat] || rawDateFormat
  const displayMode = String(settings.displayMode)
  const timeZone = String(settings.timeZone)
  const density = String(settings.density)

  return {
    enabled: settings.enabled !== false,
    showSeconds: settings.showSeconds === true,
    hour12: settings.hour12 === true,
    clockSize: clampNumber(settings.clockSize, 70, 140, DEFAULT_TIME_SETTINGS.clockSize),
    dateFormat: SUPPORTED_DATE_FORMATS.has(dateFormat)
      ? dateFormat as NewTabDateFormat
      : DEFAULT_TIME_SETTINGS.dateFormat,
    timeZone: SUPPORTED_TIME_ZONES.has(timeZone)
      ? timeZone as NewTabTimeZone
      : DEFAULT_TIME_SETTINGS.timeZone,
    displayMode: SUPPORTED_DISPLAY_MODES.has(displayMode)
      ? displayMode as NewTabTimeDisplayMode
      : DEFAULT_TIME_SETTINGS.displayMode,
    density: SUPPORTED_DENSITIES.has(density)
      ? density as NewTabClockDensity
      : DEFAULT_TIME_SETTINGS.density
  }
}

export function getClockUpdateDelay(date: Date, settings: NewTabTimeSettings): number {
  if (!settings.enabled) {
    return 0
  }

  const milliseconds = date.getMilliseconds()
  if (settings.displayMode === 'date') {
    return getDateOnlyUpdateDelay(date, settings)
  }
  if (settings.showSeconds) {
    return Math.max(250, 1000 - milliseconds + 25)
  }

  return Math.max(1000, (60 - date.getSeconds()) * 1000 - milliseconds + 25)
}

export function formatClockTime(date: Date, settings: NewTabTimeSettings): string {
  const parts = getClockParts(date, settings)
  let hours = parts.hours
  if (settings.hour12) {
    hours = hours % 12 || 12
  }

  const timeParts = [
    String(hours).padStart(2, '0'),
    String(parts.minutes).padStart(2, '0')
  ]
  if (settings.showSeconds) {
    timeParts.push(String(parts.seconds).padStart(2, '0'))
  }
  return timeParts.join(':')
}

export function formatClockPeriod(date: Date, settings: NewTabTimeSettings): string {
  return getClockParts(date, settings).hours < 12 ? 'AM' : 'PM'
}

export function formatClockTimeDateTime(date: Date, settings: NewTabTimeSettings): string {
  const parts = getClockParts(date, settings)
  return [
    String(parts.hours).padStart(2, '0'),
    String(parts.minutes).padStart(2, '0'),
    String(parts.seconds).padStart(2, '0')
  ].join(':')
}

export function formatClockDateTime(date: Date, settings: NewTabTimeSettings): string {
  const parts = getClockParts(date, settings)
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0')
  ].join('-')
}

export function formatClockDate(date: Date, settings: NewTabTimeSettings): string {
  const parts = getClockParts(date, settings)
  const yearText = String(parts.year).padStart(4, '0')
  const monthText = String(parts.month).padStart(2, '0')
  const dayText = String(parts.day).padStart(2, '0')
  const weekdayText = parts.weekday.replace(/^星期/, '周')

  switch (settings.dateFormat) {
    case 'chinese-date-weekday':
      return `${parts.year}年${parts.month}月${parts.day}日 ${weekdayText}`
    case 'year-month-day':
      return `${yearText}.${monthText}.${dayText}`
    case 'year-month-day-weekday':
      return `${yearText}.${monthText}.${dayText} ${weekdayText}`
    case 'weekday-day-month':
      return `${weekdayText} ${dayText}/${monthText}`
    case 'weekday-month-day':
      return `${weekdayText} ${monthText}/${dayText}`
    case 'month-day-weekday':
    default:
      return `${monthText}.${dayText} ${weekdayText}`
  }
}

export function getClockAriaLabel(date: Date, settings: NewTabTimeSettings): string {
  const parts: string[] = []
  if (settings.displayMode !== 'date') {
    parts.push(settings.hour12
      ? `${formatClockTime(date, settings)} ${formatClockPeriod(date, settings)}`
      : formatClockTime(date, settings))
  }
  if (settings.displayMode !== 'time') {
    parts.push(formatClockDate(date, settings))
  }
  parts.push(getClockZoneLabel(settings))
  return parts.join('，')
}

export function getClockZoneLabel(settings: NewTabTimeSettings): string {
  return TIME_ZONE_LABELS[settings.timeZone] || settings.timeZone
}

export function getClockParts(date: Date, settings: NewTabTimeSettings): ClockParts {
  const { timeZone } = settings
  if (timeZone === 'auto') {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      weekday: weekdays[date.getDay()],
      hours: date.getHours(),
      minutes: date.getMinutes(),
      seconds: date.getSeconds()
    }
  }

  const formatter = new Intl.DateTimeFormat('zh-CN-u-ca-gregory', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23'
  })
  const formattedParts = formatter.formatToParts(date)
  const getPart = (type: Intl.DateTimeFormatPartTypes): string =>
    formattedParts.find((part) => part.type === type)?.value || ''

  return {
    year: Number(getPart('year')) || date.getFullYear(),
    month: Number(getPart('month')) || date.getMonth() + 1,
    day: Number(getPart('day')) || date.getDate(),
    weekday: getPart('weekday') || '',
    hours: Number(getPart('hour')) || 0,
    minutes: Number(getPart('minute')) || 0,
    seconds: Number(getPart('second')) || 0
  }
}

function getDateOnlyUpdateDelay(date: Date, settings: NewTabTimeSettings): number {
  const currentDateKey = formatClockDateTime(date, settings)
  const startMs = date.getTime()
  const maxDelayMs = 36 * 60 * 60 * 1000
  let low = 0
  let high = 60 * 60 * 1000

  while (
    high < maxDelayMs &&
    formatClockDateTime(new Date(startMs + high), settings) === currentDateKey
  ) {
    high *= 2
  }

  if (high >= maxDelayMs) {
    return maxDelayMs
  }

  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2)
    if (formatClockDateTime(new Date(startMs + mid), settings) === currentDateKey) {
      low = mid
    } else {
      high = mid
    }
  }

  return Math.max(1000, high + 25)
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  return Math.max(min, Math.min(max, Math.round(numericValue)))
}
