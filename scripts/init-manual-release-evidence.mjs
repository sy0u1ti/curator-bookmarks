#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = 'release/manual-evidence'
const SCREENSHOT_DIR = path.join(ROOT, 'screenshots')
const CWS_FIELDS_DIR = path.join(ROOT, 'cws-fields')
const USER_RESEARCH_DIR = path.join(ROOT, 'user-research')
const PARTICIPANT_COUNT = 5

async function main() {
  const release = await readReleaseContext()
  const context = {
    version: release.version || 'TODO-version',
    zipPath: release.zipPath || 'TODO-release-zip-path',
    sha256: release.sha256 || 'TODO-release-zip-sha256',
    generatedAt: new Date().toISOString().slice(0, 10)
  }

  await Promise.all([
    fs.mkdir(SCREENSHOT_DIR, { recursive: true }),
    fs.mkdir(CWS_FIELDS_DIR, { recursive: true }),
    fs.mkdir(USER_RESEARCH_DIR, { recursive: true })
  ])

  const writes = [
    writeIfMissing(path.join(SCREENSHOT_DIR, 'manifest.md'), screenshotManifest(context)),
    writeIfMissing(path.join(CWS_FIELDS_DIR, 'cws-field-parity.md'), cwsFieldParity(context)),
    writeIfMissing(path.join(ROOT, 'visual-review.md'), visualReview(context)),
    writeIfMissing(path.join(ROOT, 'accessibility.md'), accessibilityReview(context)),
    writeIfMissing(path.join(ROOT, 'high-risk-operations.md'), highRiskOperations(context)),
    writeIfMissing(path.join(ROOT, 'platform-review.md'), platformReview(context)),
    writeIfMissing(path.join(ROOT, 'release-decision.md'), releaseDecision(context))
  ]

  for (let index = 1; index <= PARTICIPANT_COUNT; index += 1) {
    writes.push(
      writeIfMissing(
        path.join(USER_RESEARCH_DIR, `participant-${String(index).padStart(2, '0')}.md`),
        userResearchRecord(context, index)
      )
    )
  }

  const results = await Promise.all(writes)
  const created = results.filter((result) => result.created).map((result) => result.path)
  const kept = results.filter((result) => !result.created).map((result) => result.path)

  console.log(`manual evidence scaffold ready under ${ROOT}/`)
  console.log(`release version: ${context.version}`)
  console.log(`release zip sha256: ${context.sha256}`)
  if (created.length) {
    console.log(`created ${created.length} file(s):`)
    for (const file of created) {
      console.log(`- ${file}`)
    }
  }
  if (kept.length) {
    console.log(`kept ${kept.length} existing file(s); no overwrite performed.`)
  }
  console.log('The scaffold intentionally contains TODO placeholders and Decision: hold.')
  console.log('Replace every placeholder with real CWS/manual evidence before running npm run release:manual-evidence for submission.')
}

async function readReleaseContext() {
  const [packageJson, evidence] = await Promise.all([
    readJson('package.json').catch(() => null),
    readJson('.perf-results/release-evidence.json').catch(() => null)
  ])
  return {
    version: packageJson?.version ? String(packageJson.version) : '',
    zipPath: evidence?.zip?.path ? String(evidence.zip.path) : '',
    sha256: evidence?.zip?.sha256 ? String(evidence.zip.sha256) : ''
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

async function writeIfMissing(filePath, text) {
  try {
    await fs.writeFile(filePath, text, { flag: 'wx' })
    return { path: filePath, created: true }
  } catch (error) {
    if (error?.code === 'EEXIST') {
      return { path: filePath, created: false }
    }
    throw error
  }
}

function header(title, context) {
  return [
    `# ${title}`,
    '',
    `Version: ${context.version}`,
    `Release zip path: ${context.zipPath}`,
    `Release zip sha256: ${context.sha256}`,
    `Date: ${context.generatedAt}`,
    'Reviewer: TODO',
    ''
  ].join('\n')
}

function screenshotManifest(context) {
  return `${header('Store Screenshot Manifest', context)}Fixture data: TODO
Desensitized: yes

| Path | Surface | Viewport | Date | Version | Desensitized | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| release/manual-evidence/screenshots/popup-search.png | Popup local search | TODO | TODO | ${context.version} | yes | TODO |
| release/manual-evidence/screenshots/dashboard.png | Dashboard batch management | TODO | TODO | ${context.version} | yes | TODO |
| release/manual-evidence/screenshots/newtab.png | Newtab replacement | TODO | TODO | ${context.version} | yes | TODO |
| release/manual-evidence/screenshots/privacy.png | Privacy Center | TODO | TODO | ${context.version} | yes | TODO |
| release/manual-evidence/screenshots/health.png | Health or link-check workflow | TODO | TODO | ${context.version} | yes | TODO |
| release/manual-evidence/screenshots/backup.png | Backup or Recycle Bin | TODO | TODO | ${context.version} | yes | TODO |
| release/manual-evidence/screenshots/ai-preview.png | AI request preview | TODO | TODO | ${context.version} | yes | TODO |
`
}

function cwsFieldParity(context) {
  return `${header('CWS Field Parity', context)}## Required Fields

- Short description: TODO
- Detailed description: TODO
- Category: TODO
- Language: TODO
- Permissions: TODO
- Privacy practices: TODO
- Support link: TODO
- Privacy policy: TODO

## Sensitive Capability Parity

- Newtab replacement and restore path: TODO
- bookmarks permission: TODO
- optional host permission: TODO
- webRequest: TODO
- webNavigation: TODO
- AI default-off statement: TODO
- Jina default-off statement: TODO
- link-check target URL request disclosure: TODO
- remote code statement: TODO
- telemetry statement: TODO
- sale statement: TODO
- ads statement: TODO

## Cross-References

- docs/privacy-practices-mapping.md checked: TODO
- PRIVACY.md checked: TODO
- docs/chrome-web-store-listing.md checked: TODO
- Options Privacy Center checked: TODO
- Contradictions found: TODO
- Owner and decision: TODO
`
}

function userResearchRecord(context, index) {
  return `${header('User Research Record', context)}Participant: TODO-${String(index).padStart(2, '0')}
Fixture data: TODO
Private data removed: yes

## Tasks

- First search within 3 minutes: TODO
- Permission explanation comprehension: TODO
- Newtab restore path: TODO
- AI off switch: TODO
- Jina off switch: TODO
- link-check request understanding: TODO
- AI request preview decision: TODO

## Findings

- Finding: TODO
- P0 follow-up: TODO
- P1 follow-up: TODO
- Owner: TODO
`
}

function visualReview(context) {
  return `${header('Visual Review', context)}Baseline source: TODO

| Surface | Baseline | Current screenshot | Overflow | Primary action | Danger action | Severity | Owner | Release decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Popup | TODO | TODO | TODO | TODO | TODO | TODO | TODO | hold |
| Options | TODO | TODO | TODO | TODO | TODO | TODO | TODO | hold |
| Dashboard | TODO | TODO | TODO | TODO | TODO | TODO | TODO | hold |
| Newtab | TODO | TODO | TODO | TODO | TODO | TODO | TODO | hold |
| Privacy Center | TODO | TODO | TODO | TODO | TODO | TODO | TODO | hold |

Decision summary: TODO
`
}

function accessibilityReview(context) {
  return `${header('Accessibility Review', context)}Screen-reader: TODO
Browser: TODO

| Path | Keyboard | Screen-reader | Focus | Tab order | Escape behavior | Destructive confirmation announced | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Popup | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| Dashboard | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| Newtab | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| Options | TODO | TODO | TODO | TODO | TODO | TODO | TODO |

Blocking issues: TODO
Owner: TODO
Decision: hold
`
}

function highRiskOperations(context) {
  return `${header('High-Risk Operations Exploratory Pass', context)}Fixture data: TODO

| Operation | Delete | Restore | Move | Backup | AI | Partial failure | Cancel | Missing parent | Duplicate | Quota | Summary | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bookmark delete and bulk delete | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| Recycle Bin restore and clear records | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| Bookmark move and batch move | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| Backup restore modes | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| AI apply and move suggestions | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO |

Issues: TODO
Owner: TODO
Decision: hold
`
}

function platformReview(context) {
  return `${header('Clean Chrome Profile Platform Review', context)}Clean Chrome profile: TODO
Fixture data: TODO
Elapsed reviewer path: 5-10 minutes

- Newtab replacement disclosure: TODO
- Restore instructions from Newtab: TODO
- Restore instructions from Options: TODO
- Privacy Center review: TODO
- optional host permission prompt captured: TODO
- denied permission outcome: TODO
- authorized link-check outcome: TODO
- Featured Gallery default state: TODO
- Web search disabled while local search works: TODO
- CWS reviewer path completed: TODO

Issues: TODO
Owner: TODO
Decision: hold
`
}

function releaseDecision(context) {
  return `${header('Release Decision', context)}release:check timestamp: TODO
Owner: TODO
Decision: hold

## Manual Evidence

- Screenshots: TODO
- CWS fields: TODO
- User research: TODO
- Visual review: TODO
- Accessibility: TODO
- High-risk operations: TODO
- Platform review: TODO

## Exceptions

- P0 exceptions: TODO
- P1 exceptions: TODO
- Risk: TODO
- Mitigation: TODO
- Rollback plan: TODO

Final decision: hold
`
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
