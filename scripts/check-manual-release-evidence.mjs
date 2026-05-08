#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = 'release/manual-evidence'
const SCREENSHOT_DIR = path.join(ROOT, 'screenshots')
const CWS_FIELDS_DIR = path.join(ROOT, 'cws-fields')
const USER_RESEARCH_DIR = path.join(ROOT, 'user-research')
const SCREENSHOT_MANIFEST_PATH = path.join(SCREENSHOT_DIR, 'manifest.md')
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const REQUIRED_SCREENSHOT_SURFACES = [
  { id: 'Popup', terms: ['popup'] },
  { id: 'Dashboard', terms: ['dashboard'] },
  { id: 'Newtab', terms: ['newtab', 'new tab'] },
  { id: 'Privacy', terms: ['privacy'] },
  { id: 'Health or availability', terms: ['health', 'availability', 'link-check'] },
  { id: 'Backup or Recycle Bin', terms: ['backup', 'recycle'] },
  { id: 'AI preview', terms: ['ai'] }
]

const REQUIRED_FILES = [
  {
    id: 'visual-review',
    path: path.join(ROOT, 'visual-review.md'),
    requiredTerms: [
      'Popup',
      'Options',
      'Dashboard',
      'Newtab',
      'Privacy Center',
      'baseline',
      'overflow',
      'primary',
      'danger',
      'severity',
      'owner',
      'release decision'
    ]
  },
  {
    id: 'accessibility',
    path: path.join(ROOT, 'accessibility.md'),
    requiredTerms: [
      'keyboard',
      'screen-reader',
      'Popup',
      'Dashboard',
      'Newtab',
      'Options',
      'focus',
      'tab order',
      'Escape',
      'destructive'
    ]
  },
  {
    id: 'high-risk-operations',
    path: path.join(ROOT, 'high-risk-operations.md'),
    requiredTerms: [
      'delete',
      'restore',
      'move',
      'backup',
      'AI',
      'partial failure',
      'cancel',
      'missing parent',
      'duplicate',
      'quota',
      'summary'
    ]
  },
  {
    id: 'platform-review',
    path: path.join(ROOT, 'platform-review.md'),
    requiredTerms: [
      'clean Chrome profile',
      'Newtab',
      'restore',
      'Privacy Center',
      'optional host permission',
      'denied permission',
      'authorized link-check',
      'Featured Gallery',
      '5-10 minutes'
    ]
  },
  {
    id: 'release-decision',
    path: path.join(ROOT, 'release-decision.md'),
    requiredTerms: ['sha256', 'release:check', 'decision', 'owner', 'manual evidence', 'P0', 'P1'],
    anyTermGroups: [['submit', 'hold']]
  }
]

const REQUIRED_SCREENSHOT_TERMS = [
  'path',
  'date',
  'version',
  'desensitized',
  'Popup',
  'Dashboard',
  'Newtab',
  'Privacy',
  'Health',
  'Backup',
  'AI'
]

const REQUIRED_CWS_TERMS = [
  'short description',
  'detailed description',
  'category',
  'language',
  'permissions',
  'privacy practices',
  'support link',
  'privacy policy',
  'Newtab',
  'bookmarks',
  'optional host permission',
  'webRequest',
  'webNavigation',
  'AI',
  'Jina',
  'link',
  'remote code',
  'telemetry',
  'sale',
  'ads'
]

const REQUIRED_USER_RESEARCH_TERMS = [
  'participant',
  'date',
  'version',
  'first search',
  'permission',
  'Newtab',
  'restore',
  'AI',
  'Jina',
  'link-check',
  'finding',
  'P0',
  'P1'
]

const DISALLOWED_PLACEHOLDERS = [
  { label: 'TODO marker', pattern: /\bTODO\b/i },
  { label: 'TBD marker', pattern: /\bTBD\b/i },
  { label: 'YYYY-MM-DD date placeholder', pattern: /\bYYYY-MM-DD\b/i },
  { label: 'XX placeholder', pattern: /\bXX\b/i },
  { label: 'blank evidence field', pattern: /^(?:[-*][ \t]*)?[A-Za-z][A-Za-z0-9 /&().'-]{0,80}:[ \t]*$/m },
  { label: 'blank markdown table cell', pattern: /^\|(?=.*\|[ \t]*\|).+\|$/m }
]

async function main() {
  const checks = []

  checks.push(await checkDirectory(SCREENSHOT_DIR, {
    id: 'screenshots',
    minFiles: 6,
    allowedExtensions: new Set(['.png', '.jpg', '.jpeg', '.webp'])
  }))
  checks.push(await checkDirectoryTerms(SCREENSHOT_DIR, 'screenshots-metadata', REQUIRED_SCREENSHOT_TERMS))
  checks.push(await checkScreenshotManifest())

  checks.push(await checkDirectory(CWS_FIELDS_DIR, {
    id: 'cws-fields',
    minFiles: 1,
    allowedExtensions: new Set(['.md', '.json', '.png', '.jpg', '.jpeg', '.webp', '.pdf'])
  }))
  checks.push(await checkDirectoryTerms(CWS_FIELDS_DIR, 'cws-field-parity', REQUIRED_CWS_TERMS))

  checks.push(await checkDirectory(USER_RESEARCH_DIR, {
    id: 'user-research-records',
    minFiles: 5,
    allowedExtensions: new Set(['.md', '.txt', '.json'])
  }))
  checks.push(await checkDirectoryTerms(USER_RESEARCH_DIR, 'user-research-coverage', REQUIRED_USER_RESEARCH_TERMS))

  for (const file of REQUIRED_FILES) {
    checks.push(await checkFileTerms(file.path, file.id, file.requiredTerms, file.anyTermGroups))
  }
  checks.push(await checkReleaseDecisionSha())

  const failures = checks.filter((check) => !check.ok)
  for (const check of checks) {
    const status = check.ok ? 'PASS' : 'FAIL'
    console.log(`[${status}] ${check.id}: ${check.detail}`)
  }

  if (failures.length) {
    console.error(`Manual release evidence incomplete: ${failures.length} failed check(s).`)
    console.error('Run docs/manual-verification-runbook.md and store artifacts under release/manual-evidence/.')
    process.exit(1)
  }

  console.log('Manual release evidence complete.')
}

async function checkDirectory(directory, options) {
  const files = await listFiles(directory)
  const matchingFiles = files.filter((file) => options.allowedExtensions.has(path.extname(file).toLowerCase()))
  const ok = matchingFiles.length >= options.minFiles
  return {
    id: options.id,
    ok,
    detail: ok
      ? `${matchingFiles.length} matching files found`
      : `${directory} needs at least ${options.minFiles} matching files; found ${matchingFiles.length}`
  }
}

async function checkDirectoryTerms(directory, id, terms) {
  const files = await listFiles(directory)
  const textFiles = await readTextFiles(files)
  const text = textFiles.map((file) => file.text).join('\n')
  const missing = terms.filter((term) => !text.toLowerCase().includes(term.toLowerCase()))
  const placeholders = findPlaceholderIssues(textFiles)
  return {
    id,
    ok: missing.length === 0 && placeholders.length === 0,
    detail: formatTermCheckDetail({
      success: 'required terms found and no template placeholders remain',
      missing,
      placeholders
    })
  }
}

async function checkFileTerms(filePath, id, terms, anyTermGroups = []) {
  const text = await fs.readFile(filePath, 'utf8').catch(() => '')
  const missing = terms.filter((term) => !text.toLowerCase().includes(term.toLowerCase()))
  const placeholders = findPlaceholderIssues([{ path: filePath, text }])
  const missingAnyGroups = anyTermGroups
    .map((group) => group.filter((term) => text.toLowerCase().includes(term.toLowerCase())))
    .map((matches, index) => ({ index, matches, terms: anyTermGroups[index] }))
    .filter((group) => group.matches.length === 0)
  return {
    id,
    ok: Boolean(text.trim()) && missing.length === 0 && missingAnyGroups.length === 0 && placeholders.length === 0,
    detail: !text.trim()
      ? `${filePath} missing or empty`
      : formatTermCheckDetail({
        success: `${filePath} contains required terms and no template placeholders remain`,
        missing,
        placeholders,
        missingAnyGroups
      })
  }
}

async function checkScreenshotManifest() {
  const text = await fs.readFile(SCREENSHOT_MANIFEST_PATH, 'utf8').catch(() => '')
  if (!text.trim()) {
    return {
      id: 'screenshots-manifest',
      ok: false,
      detail: `${SCREENSHOT_MANIFEST_PATH} missing or empty`
    }
  }

  const packageVersion = await readPackageVersion()
  const rows = parseMarkdownTableRows(text)
    .filter((row) => IMAGE_EXTENSIONS.has(path.extname(normalizeManifestPath(row[0] || '')).toLowerCase()))
  const placeholders = findPlaceholderIssues([{ path: SCREENSHOT_MANIFEST_PATH, text }])
  const problems = []

  if (rows.length < 6) {
    problems.push(`needs at least 6 image rows; found ${rows.length}`)
  }

  const joinedRows = rows.map((row) => row.join(' ')).join(' ').toLowerCase()
  const missingSurfaces = REQUIRED_SCREENSHOT_SURFACES
    .filter((surface) => !surface.terms.some((term) => joinedRows.includes(term)))
    .map((surface) => surface.id)
  if (missingSurfaces.length) {
    problems.push(`missing screenshot surfaces: ${missingSurfaces.join(', ')}`)
  }

  for (const [index, row] of rows.entries()) {
    const [filePath, surface, viewport, date, version, desensitized, notes] = row.map((cell) => cell.trim())
    const normalizedPath = normalizeManifestPath(filePath)
    if (!isPathInsideDirectory(normalizedPath, SCREENSHOT_DIR)) {
      problems.push(`row ${index + 1} path must stay under ${SCREENSHOT_DIR}: ${filePath}`)
    } else if (!(await fileExists(normalizedPath))) {
      problems.push(`row ${index + 1} image missing: ${normalizedPath}`)
    }
    if (!surface) {
      problems.push(`row ${index + 1} surface missing`)
    }
    if (!/^\d{3,5}x\d{3,5}$/i.test(viewport)) {
      problems.push(`row ${index + 1} viewport must be WIDTHxHEIGHT`)
    }
    if (!isValidDate(date)) {
      problems.push(`row ${index + 1} date must be YYYY-MM-DD`)
    }
    if (packageVersion ? version !== packageVersion : !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
      problems.push(`row ${index + 1} version must match current package version${packageVersion ? ` ${packageVersion}` : ''}`)
    }
    if (!/^(yes|true)$/i.test(desensitized)) {
      problems.push(`row ${index + 1} desensitized must be yes`)
    }
    if (!notes) {
      problems.push(`row ${index + 1} notes missing`)
    }
  }

  return {
    id: 'screenshots-manifest',
    ok: rows.length >= 6 && problems.length === 0 && placeholders.length === 0,
    detail: formatTermCheckDetail({
      success: `${rows.length} screenshot manifest row(s) reference existing desensitized images for package version ${packageVersion || '(not available)'}`,
      placeholders,
      missing: problems
    })
  }
}

async function checkReleaseDecisionSha() {
  const decisionText = await fs.readFile(path.join(ROOT, 'release-decision.md'), 'utf8').catch(() => '')
  const evidenceText = await fs.readFile('.perf-results/release-evidence.json', 'utf8').catch(() => '')
  if (!decisionText.trim()) {
    return {
      id: 'release-decision-sha',
      ok: false,
      detail: `${path.join(ROOT, 'release-decision.md')} missing or empty`
    }
  }
  if (!evidenceText.trim()) {
    return {
      id: 'release-decision-sha',
      ok: false,
      detail: '.perf-results/release-evidence.json missing; run npm run release:check first'
    }
  }

  let sha256 = ''
  try {
    const evidence = JSON.parse(evidenceText)
    sha256 = String(evidence?.zip?.sha256 || '')
  } catch {
    return {
      id: 'release-decision-sha',
      ok: false,
      detail: '.perf-results/release-evidence.json is not valid JSON'
    }
  }

  const ok = Boolean(sha256) && decisionText.includes(sha256)
  return {
    id: 'release-decision-sha',
    ok,
    detail: ok
      ? `release decision references current zip sha256 ${sha256}`
      : `release decision must reference current zip sha256 ${sha256 || '(missing in release evidence)'}`
  }
}

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error?.code === 'ENOENT') {
      return []
    }
    throw error
  })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(directory, entry.name))
}

async function readPackageVersion() {
  try {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'))
    return packageJson?.version ? String(packageJson.version) : ''
  } catch {
    return ''
  }
}

async function readTextFiles(files) {
  const textExtensions = new Set(['.md', '.txt', '.json'])
  return Promise.all(
    files
      .filter((file) => textExtensions.has(path.extname(file).toLowerCase()))
      .map(async (file) => ({
        path: file,
        text: await fs.readFile(file, 'utf8').catch(() => '')
      }))
  )
}

function parseMarkdownTableRows(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'))
    .filter((line) => !/^\|[ \t:-]+\|(?:[ \t:-]+\|)+$/.test(line))
    .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 7)
    .filter((cells) => !/^path$/i.test(cells[0]))
}

function normalizeManifestPath(value) {
  return value
    .replace(/`/g, '')
    .trim()
    .split(/[\\/]+/)
    .join(path.sep)
}

function isPathInsideDirectory(filePath, directory) {
  const normalizedFile = path.normalize(filePath)
  const normalizedDirectory = path.normalize(directory)
  return normalizedFile === normalizedDirectory || normalizedFile.startsWith(`${normalizedDirectory}${path.sep}`)
}

async function fileExists(filePath) {
  const stat = await fs.stat(filePath).catch(() => null)
  return Boolean(stat?.isFile())
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function findPlaceholderIssues(textFiles) {
  const issues = []
  for (const file of textFiles) {
    for (const placeholder of DISALLOWED_PLACEHOLDERS) {
      if (placeholder.pattern.test(file.text)) {
        issues.push(`${path.basename(file.path)}: ${placeholder.label}`)
      }
    }
  }
  return issues
}

function formatTermCheckDetail({ success, missing = [], placeholders = [], missingAnyGroups = [] }) {
  const problems = []
  if (missing.length) {
    problems.push(`missing terms: ${missing.join(', ')}`)
  }
  if (missingAnyGroups.length) {
    problems.push(`missing one of: ${missingAnyGroups.map((group) => group.terms.join(' or ')).join('; ')}`)
  }
  if (placeholders.length) {
    problems.push(`placeholder content: ${placeholders.join(', ')}`)
  }
  return problems.length ? problems.join('; ') : success
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
