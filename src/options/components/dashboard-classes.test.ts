import assert from 'node:assert/strict'
import { DASHBOARD_CARD_PATH_CHIP_CLASS } from './dashboard-classes.js'

const cardPathChipTokens = new Set(DASHBOARD_CARD_PATH_CHIP_CLASS.split(/\s+/))

assert.ok(
  cardPathChipTokens.has('appearance-none'),
  'Dashboard card path chips must reset native button appearance to keep button/span text baselines aligned.'
)
assert.ok(
  cardPathChipTokens.has('h-[14px]') &&
    cardPathChipTokens.has('min-h-[14px]') &&
    cardPathChipTokens.has('leading-[14px]'),
  'Dashboard card path chips must keep a fixed 14px line box so scroll preview and full interaction states do not jump.'
)

console.log('Dashboard class tests passed.')
