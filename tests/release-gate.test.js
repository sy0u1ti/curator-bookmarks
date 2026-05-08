import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

test('release gate wires fixtures, perf budgets, package zip and extension smoke e2e', () => {
  const releaseCheck = packageJson.scripts['release:check'] || ''

  for (const command of [
    'npm run validate',
    'npm run pack:zip:dist',
    'npm run perf:fixtures',
    'npm run perf:bundle',
    'npm run perf:search',
    'npm run perf:dashboard-scroll',
    'npm run perf:dashboard-trace',
    'npm run perf:popup-startup',
    'npm run perf:newtab-startup',
    'npm run e2e'
  ]) {
    assert.match(releaseCheck, new RegExp(escapeRegExp(command)))
  }
})

test('release workflow runs the same release gate and uploads local evidence', () => {
  const workflow = readFileSync('.github/workflows/release-check.yml', 'utf8')

  assert.match(workflow, /npm ci/)
  assert.match(workflow, /npx playwright install chromium --with-deps/)
  assert.match(workflow, /npm run release:check/)
  assert.match(workflow, /release\/\*\.zip/)
  assert.match(workflow, /\.perf-results\/\*\.json/)
  assert.match(workflow, /\.e2e-results\/\*\.json/)
})

test('popup bundle hard budget is tightened to the release review target', () => {
  const budgetScript = readFileSync('scripts/check-bundle-budget.mjs', 'utf8')

  assert.match(budgetScript, /\{ id: 'popup'[\s\S]*?maxKb: 105[\s\S]*?warnKb: 100/)
  assert.doesNotMatch(budgetScript, /\{ id: 'popup'[\s\S]*?maxKb: 110/)
})

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
