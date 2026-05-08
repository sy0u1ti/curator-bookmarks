import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { test } from 'node:test'

const execFileAsync = promisify(execFile)
const SCRIPT_PATH = path.resolve('scripts/check-manual-release-evidence.mjs')
const INIT_SCRIPT_PATH = path.resolve('scripts/init-manual-release-evidence.mjs')
const CURRENT_SHA = 'abc123manualevidencechecker'

test('manual release evidence checker passes complete external evidence packet', async () => {
  const workspace = await createManualEvidenceWorkspace({ releaseDecisionSha: CURRENT_SHA })
  try {
    const result = await runChecker(workspace)

    assert.match(result.stdout, /\[PASS\] screenshots:/)
    assert.match(result.stdout, /\[PASS\] screenshots-metadata:/)
    assert.match(result.stdout, /\[PASS\] cws-field-parity:/)
    assert.match(result.stdout, /\[PASS\] user-research-coverage:/)
    assert.match(result.stdout, /\[PASS\] release-decision-sha:/)
    assert.match(result.stdout, /Manual release evidence complete\./)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('manual release evidence checker rejects release decision with stale zip sha', async () => {
  const workspace = await createManualEvidenceWorkspace({ releaseDecisionSha: 'stale-sha' })
  try {
    await assert.rejects(
      runChecker(workspace),
      (error) => {
        assert.equal(error.code, 1)
        assert.match(error.stdout, /\[FAIL\] release-decision-sha:/)
        assert.match(error.stdout, /release decision must reference current zip sha256 abc123manualevidencechecker/)
        assert.match(error.stderr, /Manual release evidence incomplete: 1 failed check\(s\)\./)
        return true
      }
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('manual release evidence checker rejects unfilled template placeholders', async () => {
  const workspace = await createManualEvidenceWorkspace({ releaseDecisionSha: CURRENT_SHA })
  const visualReviewPath = path.join(workspace, 'release/manual-evidence/visual-review.md')
  try {
    await writeFile(visualReviewPath, [
      '# Visual Review',
      'Popup Options Dashboard Newtab Privacy Center',
      'baseline overflow primary danger severity owner release decision',
      'Decision summary: TODO'
    ].join('\n'))

    await assert.rejects(
      runChecker(workspace),
      (error) => {
        assert.equal(error.code, 1)
        assert.match(error.stdout, /\[FAIL\] visual-review:/)
        assert.match(error.stdout, /placeholder content:/)
        assert.match(error.stdout, /visual-review\.md: TODO marker/)
        return true
      }
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('manual release evidence initializer creates non-overwriting hold scaffold from release context', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'curator-manual-evidence-init-test-'))
  try {
    await mkdir(path.join(workspace, '.perf-results'), { recursive: true })
    await writeFile(path.join(workspace, 'package.json'), `${JSON.stringify({ version: '9.8.7' }, null, 2)}\n`)
    await writeFile(
      path.join(workspace, '.perf-results/release-evidence.json'),
      `${JSON.stringify({ zip: { path: 'release/curator-bookmarks-9.8.7.zip', sha256: CURRENT_SHA } }, null, 2)}\n`
    )

    const firstRun = await runInitializer(workspace)
    assert.match(firstRun.stdout, /manual evidence scaffold ready/)
    assert.match(firstRun.stdout, /created 12 file\(s\):/)

    const releaseDecisionPath = path.join(workspace, 'release/manual-evidence/release-decision.md')
    const releaseDecision = await readFile(releaseDecisionPath, 'utf8')
    assert.match(releaseDecision, /Version: 9\.8\.7/)
    assert.match(releaseDecision, new RegExp(CURRENT_SHA))
    assert.match(releaseDecision, /Decision: hold/)
    assert.match(releaseDecision, /TODO/)

    await writeFile(releaseDecisionPath, 'existing release decision\n')
    const secondRun = await runInitializer(workspace)
    assert.match(secondRun.stdout, /kept 12 existing file\(s\); no overwrite performed\./)
    assert.equal(await readFile(releaseDecisionPath, 'utf8'), 'existing release decision\n')
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

async function runChecker(cwd) {
  return execFileAsync(process.execPath, [SCRIPT_PATH], {
    cwd,
    encoding: 'utf8'
  })
}

async function runInitializer(cwd) {
  return execFileAsync(process.execPath, [INIT_SCRIPT_PATH], {
    cwd,
    encoding: 'utf8'
  })
}

async function createManualEvidenceWorkspace({ releaseDecisionSha }) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'curator-manual-evidence-test-'))
  const root = path.join(workspace, 'release/manual-evidence')

  await mkdir(path.join(root, 'screenshots'), { recursive: true })
  await mkdir(path.join(root, 'cws-fields'), { recursive: true })
  await mkdir(path.join(root, 'user-research'), { recursive: true })
  await mkdir(path.join(workspace, '.perf-results'), { recursive: true })

  await writeFile(
    path.join(workspace, '.perf-results/release-evidence.json'),
    `${JSON.stringify({ zip: { sha256: CURRENT_SHA } }, null, 2)}\n`
  )

  for (const name of [
    'popup.png',
    'dashboard.png',
    'newtab.png',
    'privacy.png',
    'health.png',
    'backup.png'
  ]) {
    await writeFile(path.join(root, 'screenshots', name), 'fake image bytes')
  }

  await writeFile(path.join(root, 'screenshots/manifest.md'), [
    '# Store Screenshot Manifest',
    'path date version desensitized',
    'Popup Dashboard Newtab Privacy Health Backup AI'
  ].join('\n'))

  await writeFile(path.join(root, 'cws-fields/cws-field-parity.md'), [
    '# CWS Field Parity',
    'short description detailed description category language',
    'permissions privacy practices support link privacy policy',
    'Newtab bookmarks optional host permission webRequest webNavigation',
    'AI Jina link remote code telemetry sale ads'
  ].join('\n'))

  for (let index = 1; index <= 5; index += 1) {
    await writeFile(path.join(root, 'user-research', `participant-${index}.md`), [
      '# User Research Record',
      `participant P${index}`,
      'date version first search permission Newtab restore',
      'AI Jina link-check finding P0 P1'
    ].join('\n'))
  }

  await writeFile(path.join(root, 'visual-review.md'), [
    '# Visual Review',
    'Popup Options Dashboard Newtab Privacy Center',
    'baseline overflow primary danger severity owner release decision'
  ].join('\n'))

  await writeFile(path.join(root, 'accessibility.md'), [
    '# Accessibility Review',
    'keyboard screen-reader Popup Dashboard Newtab Options',
    'focus tab order Escape destructive'
  ].join('\n'))

  await writeFile(path.join(root, 'high-risk-operations.md'), [
    '# High-Risk Operations',
    'delete restore move backup AI partial failure',
    'cancel missing parent duplicate quota summary'
  ].join('\n'))

  await writeFile(path.join(root, 'platform-review.md'), [
    '# Platform Review',
    'clean Chrome profile Newtab restore Privacy Center',
    'optional host permission denied permission authorized link-check',
    'Featured Gallery 5-10 minutes'
  ].join('\n'))

  await writeFile(path.join(root, 'release-decision.md'), [
    '# Release Decision',
    `sha256 ${releaseDecisionSha}`,
    'release:check decision owner manual evidence P0 P1',
    'submit'
  ].join('\n'))

  return workspace
}
