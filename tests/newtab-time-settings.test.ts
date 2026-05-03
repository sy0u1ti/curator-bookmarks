import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_TIME_SETTINGS,
  formatClockDate,
  formatClockPeriod,
  formatClockTime,
  getClockUpdateDelay,
  getClockZoneLabel,
  normalizeTimeSettings
} from '../src/newtab/time-settings.js'

test('normalizes newtab time settings with legacy date formats and new density defaults', () => {
  assert.deepEqual(normalizeTimeSettings(undefined), DEFAULT_TIME_SETTINGS)

  assert.deepEqual(
    normalizeTimeSettings({
      enabled: false,
      showSeconds: true,
      hour12: true,
      clockSize: 999,
      dateFormat: 'iso',
      timeZone: 'UTC',
      displayMode: 'date',
      density: 'comfortable'
    }),
    {
      ...DEFAULT_TIME_SETTINGS,
      enabled: false,
      showSeconds: true,
      hour12: true,
      clockSize: 140,
      dateFormat: 'year-month-day',
      timeZone: 'UTC',
      displayMode: 'date',
      density: 'comfortable'
    }
  )
})

test('formats time and date consistently across display preferences', () => {
  const date = new Date(Date.UTC(2026, 4, 1, 9, 7, 5))
  const base = normalizeTimeSettings({
    timeZone: 'UTC',
    dateFormat: 'chinese-date-weekday'
  })

  assert.equal(formatClockTime(date, base), '09:07')
  assert.equal(formatClockDate(date, base), '2026年5月1日 周五')

  const hour12 = normalizeTimeSettings({
    timeZone: 'UTC',
    hour12: true,
    showSeconds: true
  })

  assert.equal(formatClockTime(date, hour12), '09:07:05')
  assert.equal(formatClockPeriod(date, hour12), 'AM')
})

test('clock update delay matches visible granularity', () => {
  const date = new Date(2026, 4, 1, 10, 20, 30, 400)

  const seconds = normalizeTimeSettings({ showSeconds: true })
  assert.equal(getClockUpdateDelay(date, seconds), 625)

  const minutes = normalizeTimeSettings({ showSeconds: false })
  assert.equal(getClockUpdateDelay(date, minutes), 29625)

  const dateOnly = normalizeTimeSettings({ displayMode: 'date' })
  assert.ok(getClockUpdateDelay(date, dateOnly) > 13 * 60 * 60 * 1000)
})

test('supports fixed common time zones without network or external data', () => {
  const settings = normalizeTimeSettings({
    timeZone: 'Asia/Hong_Kong'
  })

  assert.equal(settings.timeZone, 'Asia/Hong_Kong')
  assert.equal(getClockZoneLabel(settings), '香港')
})
