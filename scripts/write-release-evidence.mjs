#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const RESULT_DIR = '.perf-results'
const E2E_RESULT_DIR = '.e2e-results'
const RELEASE_DIR = 'release'
const REPORT_PATH = path.join(RESULT_DIR, 'release-evidence.json')
const MANUAL_EVIDENCE_DOCS = [
  'docs/manual-release-evidence.md',
  'docs/manual-verification-runbook.md',
  'docs/manual-evidence-templates.md',
  'docs/high-risk-operations-safety.md'
]
const COMPLIANCE_DOCS = [
  'README.md',
  'PRIVACY.md',
  'docs/chrome-web-store-listing.md',
  'docs/permissions-matrix.md',
  'docs/privacy-practices-mapping.md'
]

async function main() {
  await fs.mkdir(RESULT_DIR, { recursive: true })

  const [packageJson, manifest, distManifest] = await Promise.all([
    readJson('package.json'),
    readJson('src/manifest.json'),
    readJson('dist/manifest.json').catch(() => null)
  ])
  const version = String(packageJson.version || '')
  const zipPath = path.join(RELEASE_DIR, `curator-bookmarks-${version}.zip`)
  const zip = await describeFile(zipPath)
  const gitStatus = await getGitStatus()
  const manualEvidenceDocs = await Promise.all(MANUAL_EVIDENCE_DOCS.map(describeRequiredTextFile))
  const complianceDocs = await Promise.all(COMPLIANCE_DOCS.map(describeRequiredTextFile))
  const resultFiles = await collectResultFiles()
  const latestResults = await collectLatestResultSummaries(resultFiles)
  const latestResultMap = new Map(latestResults.map((result) => [result.prefix, result]))
  const distManifestVersion = distManifest?.version ? String(distManifest.version) : ''

  const checks = [
    {
      id: 'version.package-manifest',
      ok: version === String(manifest.version || ''),
      detail: `package=${version}; manifest=${manifest.version || ''}`
    },
    {
      id: 'version.dist-manifest',
      ok: Boolean(distManifestVersion) && distManifestVersion === version,
      detail: `package=${version}; dist=${distManifestVersion || 'missing'}`
    },
    {
      id: 'release.zip',
      ok: Boolean(zip),
      detail: zip ? `${zip.path}; ${zip.sizeBytes} bytes; sha256=${zip.sha256}` : `${zipPath} missing`
    },
    {
      id: 'results.bundle-budget',
      ok: latestResultMap.get('bundle-budget-report')?.ok === true,
      detail: formatResultCheckDetail(latestResultMap.get('bundle-budget-report'), 'bundle-budget-report.json')
    },
    {
      id: 'results.search',
      ok: latestResultMap.get('search')?.ok === true,
      detail: formatResultCheckDetail(latestResultMap.get('search'), 'search-*.json')
    },
    {
      id: 'results.dashboard-scroll',
      ok: latestResultMap.get('dashboard-scroll')?.ok === true,
      detail: formatResultCheckDetail(latestResultMap.get('dashboard-scroll'), 'dashboard-scroll-*.json')
    },
    {
      id: 'results.dashboard-trace',
      ok: latestResultMap.get('dashboard-trace')?.ok === true,
      detail: formatResultCheckDetail(latestResultMap.get('dashboard-trace'), 'dashboard-trace-*.json')
    },
    {
      id: 'results.popup-startup',
      ok: latestResultMap.get('popup-startup')?.ok === true,
      detail: formatResultCheckDetail(latestResultMap.get('popup-startup'), 'popup-startup-*.json')
    },
    {
      id: 'results.newtab-startup',
      ok: latestResultMap.get('newtab-startup')?.ok === true,
      detail: formatResultCheckDetail(latestResultMap.get('newtab-startup'), 'newtab-startup-*.json')
    },
    {
      id: 'results.e2e-smoke',
      ok: latestResultMap.get('extension-smoke')?.ok === true,
      detail: formatResultCheckDetail(latestResultMap.get('extension-smoke'), 'extension-smoke-*.json')
    },
    {
      id: 'results.e2e-screenshot-manifest',
      ok: latestResultMap.get('screenshot-manifest')?.ok === true,
      detail: formatResultCheckDetail(latestResultMap.get('screenshot-manifest'), 'screenshot-manifest-*.json')
    },
    {
      id: 'results.release-zip-scan',
      ok: latestResultMap.get('release-zip-scan')?.ok === true,
      detail: formatResultCheckDetail(latestResultMap.get('release-zip-scan'), 'release-zip-scan.json')
    },
    {
      id: 'docs.manual-release-evidence',
      ok: manualEvidenceDocs.every((doc) => doc.exists),
      detail: manualEvidenceDocs.map((doc) => `${doc.path}: ${doc.exists ? `${doc.sizeBytes} bytes` : 'missing'}`).join('; ')
    },
    {
      id: 'docs.compliance',
      ok: complianceDocs.every((doc) => doc.exists),
      detail: complianceDocs.map((doc) => `${doc.path}: ${doc.exists ? `${doc.sizeBytes} bytes` : 'missing'}`).join('; ')
    }
  ]

  const report = {
    generatedAt: new Date().toISOString(),
    releaseGate: {
      command: 'npm run release:check',
      zipPackedAfterValidation: true,
      note: 'release:check runs validation, perf gates and extension smoke before pack:zip:dist and this evidence writer.'
    },
    versions: {
      package: version,
      manifest: String(manifest.version || ''),
      distManifest: distManifestVersion
    },
    zip,
    manualEvidence: {
      requiredBeforeCwsSubmission: true,
      status: 'external-prerequisites-required',
      note: 'release:check verifies automated gates and documents the manual checklist, but it does not satisfy Chrome Web Store screenshots, backend field review, user research, visual regression review, manual accessibility review or platform review.',
      documents: manualEvidenceDocs,
      requiredAreas: [
        'store screenshots with desensitized data, capture date, version and file paths',
        'Chrome Web Store backend fields and privacy practices export or screenshots',
        '5-8 target-user research records and findings',
        'visual review against accepted screenshots or baseline notes',
        'manual keyboard/screen-reader accessibility pass',
        'high-risk operation exploratory pass',
        'clean-profile platform review of Newtab replacement and restore instructions'
      ]
    },
    complianceDocuments: {
      note: 'Repository-owned compliance sources that must remain aligned with Chrome Web Store fields, privacy practices and Options Privacy Center copy.',
      documents: complianceDocs
    },
    checks,
    ok: checks.every((check) => check.ok),
    worktree: {
      statusShort: gitStatus
    },
    resultFiles,
    latestResults,
    evidenceBoundaries: [
      'Search 1k/10k final rows and 50k first-batch rows are release gates; 50k final rows are observation unless marked budgeted.',
      'Popup startup release profile uses 20-run p95 gates and records max observations; smoke profile remains available for quick local checks.',
      'Newtab startup release profile uses 20-run p95 gates and records max observations; smoke profile remains available for quick local checks.',
      'dashboard-scroll is a virtual window benchmark; dashboard-trace is the browser frame and long-task gate.',
      'E2E smoke requires errors to be empty and every flow.ok to be true; screenshots are automated smoke artifacts, not subjective store screenshot or visual-regression sign-off.',
      'E2E screenshot manifests record automated screenshot paths, version, viewport and desensitized fixture metadata; they do not satisfy manual store screenshot review.',
      'release-zip-scan checks packaged HTML/JS for dynamic code execution, remote script imports and Wasm payloads.',
      'Manual release evidence is an external CWS submission prerequisite and is not completed by release:check.'
    ]
  }

  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`release evidence written to ${REPORT_PATH}`)
  if (!report.ok) {
    for (const check of checks.filter((item) => !item.ok)) {
      console.error(`- ${check.id}: ${check.detail}`)
    }
    process.exit(1)
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

async function describeFile(filePath) {
  try {
    const data = await fs.readFile(filePath)
    const stat = await fs.stat(filePath)
    return {
      path: filePath.split(path.sep).join('/'),
      sizeBytes: stat.size,
      sha256: createHash('sha256').update(data).digest('hex')
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

async function describeRequiredTextFile(filePath) {
  try {
    const data = await fs.readFile(filePath)
    const stat = await fs.stat(filePath)
    return {
      path: filePath.split(path.sep).join('/'),
      exists: true,
      sizeBytes: stat.size,
      sha256: createHash('sha256').update(data).digest('hex')
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        path: filePath.split(path.sep).join('/'),
        exists: false,
        sizeBytes: 0,
        sha256: ''
      }
    }
    throw error
  }
}

async function collectResultFiles() {
  const files = []
  await collectJsonFiles(RESULT_DIR, files)
  await collectJsonFiles(E2E_RESULT_DIR, files)
  return files
    .filter((file) => file.path !== REPORT_PATH)
    .sort((left, right) => left.path.localeCompare(right.path))
}

async function collectJsonFiles(directory, output) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error?.code === 'ENOENT') {
      return []
    }
    throw error
  })
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue
    }
    const filePath = path.join(directory, entry.name)
    const stat = await fs.stat(filePath)
    output.push({
      path: filePath.split(path.sep).join('/'),
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString()
    })
  }
}

async function collectLatestResultSummaries(resultFiles) {
  const latestByPrefix = new Map()
  for (const file of resultFiles) {
    const prefix = getResultPrefix(file.path)
    const previous = latestByPrefix.get(prefix)
    if (!previous || file.modifiedAt > previous.modifiedAt) {
      latestByPrefix.set(prefix, file)
    }
  }

  const summaries = []
  for (const [prefix, file] of [...latestByPrefix.entries()].sort()) {
    const payload = await readJson(file.path).catch(() => null)
    summaries.push({
      prefix,
      path: file.path,
      ok: summarizePayloadOk(payload),
      benchmark: payload?.benchmark || prefix,
      gate: summarizeGate(payload)
    })
  }
  return summaries
}

function getResultPrefix(filePath) {
  const name = path.basename(filePath, '.json')
  return name
    .replace(/-\d{4}-\d{2}-\d{2}T.*/, '')
    .replace(/-\d{13,}$/, '')
}

function summarizeGate(payload) {
  if (!payload || typeof payload !== 'object') {
    return ''
  }
  if (payload.benchmark === 'searchBookmarks') {
    const rows = Array.isArray(payload.rows) ? payload.rows : []
    const budgeted = rows.filter((row) => row.budgeted)
    return `${budgeted.length}/${rows.length} rows budgeted`
  }
  if (payload.benchmark === 'popup-startup') {
    if (payload.profile === 'release' && payload.gate === 'p95') {
      return '20-run release p95 gate; max observation'
    }
    return '5-run smoke median gate; p95/max observation'
  }
  if (payload.benchmark === 'newtab-startup') {
    if (payload.profile === 'release' && payload.gate === 'p95') {
      return '20-run release p95 gate; max observation'
    }
    return 'single-run smoke gate'
  }
  if (payload.benchmark === 'dashboard-scroll-window-budget') {
    return 'virtual window card/node budget'
  }
  if (payload.benchmark === 'dashboard-trace') {
    return 'browser frame/long-task gate'
  }
  if (Array.isArray(payload.flows)) {
    const errors = Array.isArray(payload.errors) ? payload.errors : []
    const passedFlows = payload.flows.filter((flow) => flow?.ok === true).length
    const screenshotCount = Number(payload.screenshotCount) || 0
    return `errors ${errors.length ? errors.length : 'empty'}; ${passedFlows}/${payload.flows.length} flow.ok true; ${screenshotCount} automated screenshots`
  }
  if (payload.artifactType === 'automated-e2e-smoke-screenshot-manifest') {
    const validation = validateScreenshotManifestPayload(payload)
    return validation.detail
  }
  if (Array.isArray(payload.checks) && payload.zipPath) {
    const passed = payload.checks.filter((check) => check.ok === true).length
    return `${passed}/${payload.checks.length} zip remote-code checks passed`
  }
  return ''
}

function summarizePayloadOk(payload) {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  if (payload.artifactType === 'automated-e2e-smoke-screenshot-manifest') {
    return validateScreenshotManifestPayload(payload).ok
  }
  if (typeof payload.ok === 'boolean') {
    return payload.ok
  }
  if (Array.isArray(payload.rules)) {
    return payload.rules.every((rule) => rule.gate === 'pass')
  }
  if (Array.isArray(payload.rows)) {
    return payload.rows.length > 0 && payload.rows.every((row) => row.ok === true)
  }
  return null
}

function validateScreenshotManifestPayload(payload) {
  const screenshots = Array.isArray(payload?.screenshots) ? payload.screenshots : []
  const existing = screenshots.filter((screenshot) => screenshot?.exists === true).length
  const missing = []

  if (payload?.artifactType !== 'automated-e2e-smoke-screenshot-manifest') {
    missing.push('artifactType')
  }
  if (!String(payload?.version || '').trim()) {
    missing.push('version')
  }
  const boundary = String(payload?.boundary || '')
  if (!/not Chrome Web Store screenshot approval/i.test(boundary)) {
    missing.push('CWS screenshot boundary')
  }
  if (!/manual release evidence/i.test(boundary)) {
    missing.push('manual evidence boundary')
  }
  if (payload?.fixture?.desensitized !== true || payload?.fixture?.privateUserData !== false) {
    missing.push('desensitized fixture metadata')
  }
  if (screenshots.length < 6) {
    missing.push('at least 6 screenshots')
  }

  screenshots.forEach((screenshot, index) => {
    if (!String(screenshot?.id || '').trim()) {
      missing.push(`screenshots[${index}].id`)
    }
    if (!String(screenshot?.path || '').startsWith('.e2e-results/screenshots/')) {
      missing.push(`screenshots[${index}].path`)
    }
    if (screenshot?.exists !== true) {
      missing.push(`screenshots[${index}].exists`)
    }
    if (!String(screenshot?.capturedAt || '').trim()) {
      missing.push(`screenshots[${index}].capturedAt`)
    }
    if (!String(screenshot?.version || '').trim()) {
      missing.push(`screenshots[${index}].version`)
    }
    if (!Number.isFinite(Number(screenshot?.viewport?.width)) || !Number.isFinite(Number(screenshot?.viewport?.height))) {
      missing.push(`screenshots[${index}].viewport`)
    }
    if (screenshot?.desensitizedFixture !== true) {
      missing.push(`screenshots[${index}].desensitizedFixture`)
    }
  })

  const ok = missing.length === 0
  return {
    ok,
    detail: ok
      ? `${existing}/${screenshots.length} automated screenshots manifest entries; version=${payload.version || 'unknown'}; boundary documented`
      : `${existing}/${screenshots.length} automated screenshots manifest entries; missing ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ` and ${missing.length - 8} more` : ''}`
  }
}

function formatResultCheckDetail(result, expectedPattern) {
  if (!result) {
    return `${expectedPattern} missing`
  }
  return `${result.path}; ok=${result.ok}; ${result.gate || 'gate summary unavailable'}`
}

async function getGitStatus() {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--short'], {
      maxBuffer: 1024 * 1024
    })
    return stdout.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

await main()
