import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

test('release gate wires fixtures, perf budgets, package zip and extension smoke e2e', () => {
  const releaseCheck = packageJson.scripts['release:check'] || ''
  const manualEvidenceCheck = packageJson.scripts['release:manual-evidence'] || ''
  const manualEvidenceInit = packageJson.scripts['release:manual-evidence:init'] || ''

  for (const command of [
    'npm run validate',
    'npm run pack:zip:dist',
    'npm run perf:fixtures',
    'npm run perf:bundle',
    'npm run perf:search',
    'npm run perf:dashboard-scroll',
    'npm run perf:dashboard-trace',
    'npm run perf:popup-startup:release',
    'npm run perf:newtab-startup:release',
    'npm run e2e',
    'npm run release:evidence'
  ]) {
    assert.match(releaseCheck, new RegExp(escapeRegExp(command)))
  }
  assert.match(releaseCheck, /npm run release:zip-scan/)
  assert.equal(manualEvidenceInit, 'node scripts/init-manual-release-evidence.mjs')
  assert.equal(manualEvidenceCheck, 'node scripts/check-manual-release-evidence.mjs')
  assert.doesNotMatch(releaseCheck, /release:manual-evidence/)

  assert.ok(
    releaseCheck.lastIndexOf('npm run pack:zip:dist') > releaseCheck.lastIndexOf('npm run e2e'),
    'release zip must be packed after the final build-backed validation step'
  )
  assert.ok(
    releaseCheck.lastIndexOf('npm run release:zip-scan') > releaseCheck.lastIndexOf('npm run pack:zip:dist'),
    'release zip must be scanned after packaging'
  )
  assert.ok(
    releaseCheck.lastIndexOf('npm run release:evidence') > releaseCheck.lastIndexOf('npm run pack:zip:dist'),
    'release evidence must be written after the zip exists'
  )
})

test('release workflow runs the same release gate and uploads local evidence', () => {
  const workflow = readFileSync('.github/workflows/release-check.yml', 'utf8')

  assert.match(workflow, /npm ci/)
  assert.match(workflow, /npx playwright install chromium --with-deps/)
  assert.match(workflow, /npm run release:check/)
  assert.match(workflow, /release\/\*\.zip/)
  assert.match(workflow, /\.perf-results\/release-evidence\.json/)
  assert.match(workflow, /\.perf-results\/bundle-budget-report\.json/)
  assert.match(workflow, /\.perf-results\/\*\.json/)
  assert.match(workflow, /\.e2e-results\/\*\.json/)
  assert.match(workflow, /\.e2e-results\/screenshot-manifest-\*\.json/)
  assert.match(workflow, /\.e2e-results\/screenshots\/\*\.png/)
})

test('popup bundle hard budget is tightened to the release review target', () => {
  const budgetScript = readFileSync('scripts/check-bundle-budget.mjs', 'utf8')

  assert.match(budgetScript, /\{ id: 'popup'[\s\S]*?maxKb: 105[\s\S]*?warnKb: 100/)
  assert.match(budgetScript, /\{ id: 'search'[\s\S]*?maxKb: 30[\s\S]*?warnPct: 95/)
  assert.match(budgetScript, /\{ id: 'vendor-pinyin'[\s\S]*?maxKb: 320[\s\S]*?warnPct: 95/)
  assert.match(budgetScript, /bundle-budget-report\.json/)
  assert.doesNotMatch(budgetScript, /\{ id: 'popup'[\s\S]*?maxKb: 110/)
})

test('extension smoke gate fails when any recorded flow is not ok', () => {
  const smokeScript = readFileSync('scripts/e2e-extension-smoke.mjs', 'utf8')

  assert.match(smokeScript, /flows\.every\(\(flow\) => flow\.ok === true\)/)
  assert.match(smokeScript, /flow\.ok is not true/)
  for (const id of [
    'popup-search',
    'options-onboarding',
    'options-privacy',
    'options-dashboard',
    'options-health',
    'options-backup',
    'options-recycle',
    'options-ai-preview',
    'newtab-portal'
  ]) {
    assert.match(smokeScript, new RegExp(escapeRegExp(`id: '${id}'`)))
  }
  assert.match(smokeScript, /screenshotCount/)
  assert.match(smokeScript, /screenshotExists/)
  assert.match(smokeScript, /screenshotManifestPath/)
  assert.match(smokeScript, /buildScreenshotManifest/)
  assert.match(smokeScript, /automated-e2e-smoke-screenshot-manifest/)
  assert.match(smokeScript, /desensitizedFixture/)
  assert.match(smokeScript, /not Chrome Web Store screenshot approval/)
  assert.match(smokeScript, /expectAllText\(page, '#privacy-permission-list'/)
  assert.match(smokeScript, /expectAllText\(page, '#privacy-remote-matrix'/)
  assert.match(smokeScript, /Newtab 网页搜索/)
  assert.match(smokeScript, /精选远程背景/)
  assert.match(smokeScript, /用户自定义远程背景/)
  assert.match(smokeScript, /AI 命名\/分类/)
  assert.match(smokeScript, /Popup AI 自然语言改写/)
  assert.match(smokeScript, /Jina Reader 远程解析/)
  assert.match(smokeScript, /死链\/重定向检测/)
})

test('release evidence documents gate boundaries and zip identity', () => {
  const evidenceScript = readFileSync('scripts/write-release-evidence.mjs', 'utf8')
  const searchPerfScript = readFileSync('scripts/perf-benchmark-search.mjs', 'utf8')
  const zipScanScript = readFileSync('scripts/scan-release-zip.mjs', 'utf8')
  const listing = readFileSync('docs/chrome-web-store-listing.md', 'utf8')

  assert.match(evidenceScript, /release-evidence\.json/)
  assert.match(evidenceScript, /sha256/)
  assert.match(evidenceScript, /zipPackedAfterValidation/)
  assert.match(evidenceScript, /manualEvidence/)
  assert.match(evidenceScript, /requiredBeforeCwsSubmission/)
  assert.match(evidenceScript, /external-prerequisites-required/)
  assert.match(evidenceScript, /docs\/manual-release-evidence\.md/)
  assert.match(evidenceScript, /docs\/manual-verification-runbook\.md/)
  assert.match(evidenceScript, /docs\/manual-evidence-templates\.md/)
  assert.match(evidenceScript, /docs\/high-risk-operations-safety\.md/)
  assert.match(evidenceScript, /COMPLIANCE_DOCS/)
  assert.match(evidenceScript, /README\.md/)
  assert.match(evidenceScript, /PRIVACY\.md/)
  assert.match(evidenceScript, /docs\/chrome-web-store-listing\.md/)
  assert.match(evidenceScript, /docs\/permissions-matrix\.md/)
  assert.match(evidenceScript, /docs\/privacy-practices-mapping\.md/)
  assert.match(evidenceScript, /docs\.compliance/)
  assert.match(evidenceScript, /complianceDocuments/)
  assert.match(evidenceScript, /docs\.manual-release-evidence/)
  assert.match(evidenceScript, /Manual release evidence is an external CWS submission prerequisite/)
  assert.match(evidenceScript, /results\.release-zip-scan/)
  assert.match(evidenceScript, /results\.e2e-screenshot-manifest/)
  assert.match(evidenceScript, /automated-e2e-smoke-screenshot-manifest/)
  assert.match(evidenceScript, /validateScreenshotManifestPayload/)
  assert.match(evidenceScript, /not Chrome Web Store screenshot approval/)
  assert.match(evidenceScript, /manual release evidence/)
  assert.match(evidenceScript, /desensitized fixture metadata/)
  assert.match(evidenceScript, /screenshots\[\$\{index\}\]\.viewport/)
  assert.match(evidenceScript, /E2E screenshot manifests record automated screenshot paths/)
  assert.match(evidenceScript, /release-zip-scan checks packaged HTML\/JS/)
  assert.match(evidenceScript, /results\.search/)
  assert.match(evidenceScript, /results\.dashboard-scroll/)
  assert.match(evidenceScript, /results\.dashboard-trace/)
  assert.match(evidenceScript, /results\.popup-startup/)
  assert.match(evidenceScript, /results\.newtab-startup/)
  assert.match(evidenceScript, /50k final rows are observation/)
  assert.match(evidenceScript, /Popup startup release profile uses 20-run p95 gates/)
  assert.match(evidenceScript, /Newtab startup release profile uses 20-run p95 gates/)
  assert.match(evidenceScript, /20-run release p95 gate/)
  assert.match(evidenceScript, /every flow\.ok to be true/)
  assert.match(evidenceScript, /automated smoke artifacts/)
  assert.match(evidenceScript, /automated screenshots/)
  assert.match(readFileSync('scripts/perf-benchmark-popup-startup.mjs', 'utf8'), /release:[\s\S]*?runs:\s*20[\s\S]*?gate:\s*'p95'/)
  assert.match(readFileSync('scripts/perf-benchmark-newtab-startup.mjs', 'utf8'), /release:[\s\S]*?runs:\s*20[\s\S]*?gate:\s*'p95'/)
  assert.match(evidenceScript, /file\.path !== REPORT_PATH/)
  assert.match(evidenceScript, /payload\.rules\.every/)
  assert.match(evidenceScript, /payload\.rows\.every/)
  assert.match(searchPerfScript, /budgeted: Boolean/)
  assert.match(searchPerfScript, /gate: budgetMs \? 'p95' : 'observe'/)
  assert.match(searchPerfScript, /gate: BUDGETS\.firstBatchP95MsByFixture\[label\] \? 'p95-and-min-hits' : 'observe'/)
  assert.match(zipScanScript, /no-dynamic-code-execution/)
  assert.match(zipScanScript, /no-remote-script-execution/)
  assert.match(zipScanScript, /no-wasm/)
  assert.match(zipScanScript, /eval\(\) found/)
  assert.match(zipScanScript, /new Function\(\) found/)
  assert.match(zipScanScript, /remote dynamic import found/)
  assert.match(zipScanScript, /isHtml[\s\S]*?javascript\\s\*:/)
  assert.match(listing, /docs\/manual-release-evidence\.md/)
  assert.match(listing, /docs\/manual-verification-runbook\.md/)
  assert.match(listing, /docs\/high-risk-operations-safety\.md/)
  assert.match(listing, /自动门禁不替代人工上架证据/)
})

test('manual release and high-risk operation evidence documents define external CWS prerequisites', () => {
  assert.equal(existsSync('docs/manual-release-evidence.md'), true)
  assert.equal(existsSync('docs/manual-verification-runbook.md'), true)
  assert.equal(existsSync('docs/manual-evidence-templates.md'), true)
  assert.equal(existsSync('docs/high-risk-operations-safety.md'), true)

  const manualEvidence = readFileSync('docs/manual-release-evidence.md', 'utf8')
  const manualRunbook = readFileSync('docs/manual-verification-runbook.md', 'utf8')
  const manualTemplates = readFileSync('docs/manual-evidence-templates.md', 'utf8')
  const highRisk = readFileSync('docs/high-risk-operations-safety.md', 'utf8')
  const manualEvidenceScript = readFileSync('scripts/check-manual-release-evidence.mjs', 'utf8')

  for (const term of [
    'Store screenshots',
    'Store backend fields',
    'Privacy practices parity',
    '5-8 target-user records',
    'Visual review',
    'Accessibility review',
    'High-risk operations',
    'Platform review',
    'optional host permission',
    'not sufficient for CWS submission'
  ]) {
    assert.match(manualEvidence, new RegExp(escapeRegExp(term)))
  }
  assert.match(manualEvidence, /npm run release:manual-evidence/)
  assert.match(manualEvidence, /npm run release:manual-evidence:init/)
  assert.match(manualEvidence, /rejects placeholders/)
  assert.match(manualEvidence, /docs\/manual-evidence-templates\.md/)
  assert.match(manualRunbook, /docs\/manual-evidence-templates\.md/)
  assert.match(manualRunbook, /npm run release:manual-evidence:init/)

  for (const term of [
    'Store Screenshot Capture',
    'CWS Backend Field Parity',
    'Target-User Research',
    'Visual Review',
    'Accessibility Review',
    'High-Risk Operation Exploratory Pass',
    'Clean-Profile Platform Review',
    'optional host permission prompt',
    'denied permission',
    'Release Decision Record'
  ]) {
    assert.match(manualRunbook, new RegExp(escapeRegExp(term)))
  }

  for (const term of [
    'Bookmark delete from Popup, Dashboard, duplicates, redirects and availability results',
    'Folder cleanup delete/merge/move/split',
    'Recycle Bin restore and record clearing',
    'Redirect URL update',
    'Tag import, rename, delete and clear',
    'Backup restore',
    'Audit log and history clearing',
    'AI naming/tagging suggestions',
    'Link availability detection and cleanup',
    'Scheduled/automatic tasks',
    'Remote backgrounds and cached media'
  ]) {
    assert.match(highRisk, new RegExp(escapeRegExp(term)))
  }

  assert.match(highRisk, /Manual evidence still required/)
  assert.match(highRisk, /Before Chrome Web Store submission/)
  assert.match(manualEvidenceScript, /release\/manual-evidence/)
  assert.match(manualEvidenceScript, /Manual release evidence incomplete/)
  assert.match(manualEvidenceScript, /DISALLOWED_PLACEHOLDERS/)
  assert.match(manualEvidenceScript, /placeholder content/)
  assert.match(manualEvidenceScript, /optional host permission/)
  assert.match(manualEvidenceScript, /denied permission/)
  assert.match(manualEvidenceScript, /screenshots-metadata/)
  assert.match(manualEvidenceScript, /REQUIRED_SCREENSHOT_TERMS/)
  assert.match(manualEvidenceScript, /REQUIRED_CWS_TERMS/)
  assert.match(manualEvidenceScript, /REQUIRED_USER_RESEARCH_TERMS/)
  assert.match(manualEvidenceScript, /release-decision-sha/)
  assert.match(manualEvidenceScript, /\.perf-results\/release-evidence\.json/)
  assert.match(manualEvidenceScript, /decisionText\.includes\(sha256\)/)
  assert.match(manualEvidenceScript, /minFiles:\s*6/)
  assert.match(manualEvidenceScript, /minFiles:\s*5/)
  assert.match(manualEvidence, /screenshot manifest/)
  assert.match(manualEvidence, /current zip sha256/)
  assert.match(manualRunbook, /screenshots\/manifest\.md/)
  assert.match(manualRunbook, /Final `submit` or `hold` decision/)

  const manualEvidenceInitScript = readFileSync('scripts/init-manual-release-evidence.mjs', 'utf8')
  assert.match(manualEvidenceInitScript, /release\/manual-evidence/)
  assert.match(manualEvidenceInitScript, /flag: 'wx'/)
  assert.match(manualEvidenceInitScript, /Decision: hold/)
  assert.match(manualEvidenceInitScript, /TODO/)
  assert.match(manualEvidenceInitScript, /\.perf-results\/release-evidence\.json/)

  for (const term of [
    'Screenshot Manifest',
    'CWS Field Parity',
    'User Research Record',
    'Visual Review',
    'Accessibility Review',
    'High-Risk Operations',
    'Platform Review',
    'Release Decision',
    'Release zip sha256',
    'Decision: hold'
  ]) {
    assert.match(manualTemplates, new RegExp(escapeRegExp(term)))
  }
})

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
