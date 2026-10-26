export interface SearchDateRange {
  from: number
  /** Exclusive local-calendar boundary. */
  to: number
  label: string
}

export function searchDateBucket(now = Date.now()): string {
  const date = new Date(now)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseSearchCalendarDate(value: string): number | null {
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(value)
  if (!match) return null
  const [, y, m, d] = match.map(Number)
  const date = new Date(y, m - 1, d)
  return y >= 1970 && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
    ? date.getTime() : null
}

function day(now: number, offset = 0): number {
  const date = new Date(now)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset).getTime()
}

function monthsBefore(now: number, months: number): number {
  const date = new Date(now)
  const first = new Date(date.getFullYear(), date.getMonth() - months, 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), last)).getTime()
}

function amount(value: string): number {
  if (/^\d+$/.test(value)) return Number(value)
  const digits: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  if (value === '十') return 10
  const parts = value.split('十')
  return parts.length === 2 ? (digits[parts[0]] || 1) * 10 + (digits[parts[1]] || 0) : digits[value] || 0
}

/** Only a complete expression is a date: 最近邻 and Today.js remain names. */
export function parseSearchDateExpression(input: string, now = Date.now()): SearchDateRange | null {
  const value = input.toLowerCase().replace(/\s+/g, '')
  const current = new Date(now)
  const nextDay = day(now, 1)
  const range = (from: number, to: number, label: string): SearchDateRange => ({ from, to, label })
  const relative = /^(?:最近|近|过去)(\d+|[一二两三四五六七八九十]{1,3})(?:个)?(天|日|周|星期|礼拜|月)$/.exec(value)
  if (relative) {
    const count = amount(relative[1])
    if (!Number.isSafeInteger(count) || count <= 0 || count > 3650) return null
    const unit = relative[2]
    if (unit === '月') return range(monthsBefore(now, count), nextDay, `最近 ${count} 个月`)
    const weeks = /^(周|星期|礼拜)$/.test(unit)
    return range(day(now, 1 - count * (weeks ? 7 : 1)), nextDay, `最近 ${count} ${weeks ? '周' : '天'}`)
  }
  if (/^(最近|近|过去)半年$/.test(value)) return range(monthsBefore(now, 6), nextDay, '最近 6 个月')
  if (/^(今天|今日|today)$/.test(value)) return range(day(now), nextDay, '今天')
  if (/^(昨天|昨日|yesterday)$/.test(value)) return range(day(now, -1), day(now), '昨天')
  if (value === '前天') return range(day(now, -2), day(now, -1), '前天')
  const weekStart = day(now, -((current.getDay() + 6) % 7))
  if (/^(本周|这周|这个星期|thisweek)$/.test(value)) return range(weekStart, nextDay, '本周')
  if (/^(上周|上一周|上星期|上个星期|lastweek)$/.test(value)) return range(day(weekStart, -7), weekStart, '上周')
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1).getTime()
  if (/^(本月|这个月|thismonth)$/.test(value)) return range(monthStart, nextDay, '本月')
  if (/^(上月|上个月|lastmonth)$/.test(value)) return range(new Date(current.getFullYear(), current.getMonth() - 1, 1).getTime(), monthStart, '上个月')
  const year = current.getFullYear()
  if (/^(今年|thisyear)$/.test(value)) return range(new Date(year, 0, 1).getTime(), nextDay, '今年')
  if (/^(去年|lastyear)$/.test(value)) return range(new Date(year - 1, 0, 1).getTime(), new Date(year, 0, 1).getTime(), '去年')
  if (value === '前年') return range(new Date(year - 2, 0, 1).getTime(), new Date(year - 1, 0, 1).getTime(), '前年')
  const dateText = value.replace(/年|月/g, '-').replace(/日|号/g, '').replace(/-$/, '')
  const date = parseSearchCalendarDate(dateText)
  if (date !== null) return range(date, day(date, 1), searchDateBucket(date))
  const month = /^(\d{4})[-/.](\d{1,2})$/.exec(dateText)
  if (month && +month[1] >= 1970 && +month[2] >= 1 && +month[2] <= 12) {
    return range(new Date(+month[1], +month[2] - 1, 1).getTime(), new Date(+month[1], +month[2], 1).getTime(), `${month[1]}-${month[2].padStart(2, '0')}`)
  }
  return null
}
