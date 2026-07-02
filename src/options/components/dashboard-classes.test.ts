import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DASHBOARD_CARD_MENU_CLASS,
  DASHBOARD_CARD_PATH_CHIP_CLASS,
  DASHBOARD_CARD_ROOT_CLASS,
  DASHBOARD_PERFORMANCE_CLASS,
  DASHBOARD_SEARCH_HELP_POPOVER_CLASS
} from './dashboard-classes.js'
import {
  OPTION_GROUP_CLASS,
  OPTION_ROW_CLASS,
  OPTION_TOOL_PANEL_CLASS
} from './option-layout-classes.js'
import {
  navLinkClass,
  optionsDashboardEntryClass
} from './options-chrome-classes.js'

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

assert.ok(
  DASHBOARD_PERFORMANCE_CLASS.includes('motion-reduce:[&_:where(*)]:duration-0') &&
    !DASHBOARD_PERFORMANCE_CLASS.startsWith('[&_:where(*)]:duration-0'),
  'Dashboard performance class must not zero out all transition durations outside reduced-motion mode.'
)
assert.ok(
  DASHBOARD_CARD_ROOT_CLASS.includes('curator-motion-card'),
  'Dashboard cards should use the shared card motion treatment.'
)
assert.ok(
  DASHBOARD_SEARCH_HELP_POPOVER_CLASS.includes('curator-motion-popover') &&
    !DASHBOARD_SEARCH_HELP_POPOVER_CLASS.includes('t-dropdown') &&
    DASHBOARD_CARD_MENU_CLASS.includes('curator-motion-popover') &&
    !DASHBOARD_CARD_MENU_CLASS.includes('t-dropdown'),
  'Dashboard MotionPanel popovers should use shared popover motion without t-dropdown pointer-event gating.'
)
assert.ok(
  OPTION_GROUP_CLASS.includes('curator-motion-surface') &&
    OPTION_TOOL_PANEL_CLASS.includes('curator-motion-surface') &&
    OPTION_ROW_CLASS.includes('curator-motion-row'),
  'Options panels and rows should use the shared Curator motion treatment.'
)
assert.ok(
  navLinkClass.includes('curator-motion-row') &&
    optionsDashboardEntryClass.includes('curator-motion-card'),
  'Options chrome navigation should share the polished row/card motion treatment.'
)

const globals = readFileSync('src/styles/globals.css', 'utf8')
assert.ok(
  globals.includes('.curator-motion-card') &&
    globals.includes('.curator-motion-popover') &&
    globals.includes('@media (prefers-reduced-motion: reduce)'),
  'Shared Curator motion utilities must define card, popover, and reduced-motion behavior.'
)

console.log('Dashboard class tests passed.')
