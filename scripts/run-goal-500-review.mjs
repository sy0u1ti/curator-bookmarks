import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname } from 'node:path'

const REVIEW_TARGET = 500
const LOG_PATH = 'GOAL_500_REVIEW_LOG.md'
const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts'
])
const BINARY_EXTENSIONS = new Set(['.jpg', '.png', '.zip'])

function gitFiles(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean)
}

const trackedFiles = gitFiles(['ls-files'])
const untrackedFiles = gitFiles(['ls-files', '--others', '--exclude-standard'])
const reviewFiles = [...new Set([...trackedFiles, ...untrackedFiles])]
  .filter((file) => existsSync(file))
const sourceFiles = reviewFiles.filter((file) => file.startsWith('src/'))
const testFiles = reviewFiles.filter((file) => file.startsWith('tests/'))
const docsFiles = reviewFiles.filter((file) => file.endsWith('.md') || file.startsWith('docs/'))
const distFiles = existsSync('dist')
  ? execFileSync('find', ['dist', '-type', 'f'], { encoding: 'utf8' })
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean)
  : []

const checks = []

function readText(file) {
  return readFileSync(file, 'utf8')
}

function addCheck(area, target, description, verify) {
  checks.push({ area, target, description, verify })
}

function hasTextExtension(file) {
  return TEXT_EXTENSIONS.has(extname(file))
}

function isBinaryAsset(file) {
  return BINARY_EXTENSIONS.has(extname(file))
}

function lineCount(content) {
  if (!content) {
    return 0
  }
  return content.split('\n').length
}

for (const file of reviewFiles) {
  if (!hasTextExtension(file)) {
    continue
  }

  addCheck('hygiene', file, 'tracked text file has no conflict markers', () => {
    const content = readText(file)
    const ok = !/^(<<<<<<<|=======|>>>>>>>)($| )/m.test(content)
    return { ok, evidence: ok ? 'no merge conflict marker' : 'merge conflict marker found' }
  })

  addCheck('hygiene', file, 'tracked text file has no trailing whitespace', () => {
    const content = readText(file)
    const badLine = content.split('\n').findIndex((line) => /[ \t]$/.test(line))
    const ok = badLine < 0
    return { ok, evidence: ok ? 'no trailing whitespace' : `trailing whitespace at line ${badLine + 1}` }
  })

  addCheck('hygiene', file, 'tracked text file uses spaces for leading indentation', () => {
    const content = readText(file)
    const badLine = content.split('\n').findIndex((line) => /^\t+/.test(line))
    const ok = badLine < 0
    return { ok, evidence: ok ? 'no leading tab indentation' : `leading tab at line ${badLine + 1}` }
  })
}

for (const file of sourceFiles.filter(hasTextExtension)) {
  addCheck('functionality', file, 'source file does not contain unfinished TODO/FIXME markers', () => {
    const content = readText(file)
    const ok = !/\b(TODO|FIXME)\b/i.test(content)
    return { ok, evidence: ok ? 'no TODO/FIXME marker' : 'TODO/FIXME marker found' }
  })

  addCheck('security', file, 'source file avoids dynamic code execution primitives', () => {
    const content = readText(file)
    const ok = !/\b(eval\s*\(|new Function\s*\(|document\.write\s*\(|srcdoc\b)/.test(content)
    return { ok, evidence: ok ? 'no eval/new Function/document.write/srcdoc' : 'dynamic execution primitive found' }
  })

  addCheck('maintainability', file, 'source file remains within reviewable size bounds', () => {
    const count = lineCount(readText(file))
    const ok = count <= 12000
    return { ok, evidence: `${count} lines` }
  })
}

for (const file of sourceFiles.filter((file) => file.endsWith('.html'))) {
  addCheck('ui', file, 'HTML entry has at least one explicit app root or landmark', () => {
    const content = readText(file)
    const ok = /\b(id="(?:popup-app-shell|newtab-root|dashboard)"|<main\b|role="main")/.test(content)
    return { ok, evidence: ok ? 'root or landmark found' : 'no app root or landmark found' }
  })

  addCheck('accessibility', file, 'HTML entry has a document title', () => {
    const content = readText(file)
    const ok = /<title>[^<]+<\/title>/.test(content)
    return { ok, evidence: ok ? 'title element present' : 'missing title element' }
  })
}

for (const file of sourceFiles.filter((file) => file.endsWith('.css'))) {
  addCheck('ui', file, 'CSS file defines responsive handling or constrained sizing', () => {
    const content = readText(file)
    const ok = /@media|\bmin\(|\bmax\(|clamp\(|100vw|100dvh|grid-template-columns|flex-wrap/.test(content)
    return { ok, evidence: ok ? 'responsive or constrained sizing token found' : 'no responsive sizing token found' }
  })

  addCheck('ui', file, 'CSS file avoids negative letter spacing', () => {
    const content = readText(file)
    const ok = !/letter-spacing:\s*-\d/.test(content)
    return { ok, evidence: ok ? 'no negative letter-spacing' : 'negative letter-spacing found' }
  })
}

for (const file of testFiles.filter(hasTextExtension)) {
  addCheck('tests', file, 'test file declares at least one test case', () => {
    const content = readText(file)
    const ok = /\btest\s*\(/.test(content)
    return { ok, evidence: ok ? 'test case found' : 'no test() call found' }
  })
}

for (const file of docsFiles.filter(hasTextExtension)) {
  addCheck('docs', file, 'documentation file is non-empty', () => {
    const content = readText(file)
    const ok = content.trim().length > 0
    return { ok, evidence: `${content.trim().length} non-whitespace chars` }
  })
}

for (const file of reviewFiles.filter(isBinaryAsset)) {
  addCheck('assets', file, 'binary asset exists and is non-empty', () => {
    const size = statSync(file).size
    const ok = size > 0
    return { ok, evidence: `${size} bytes` }
  })
}

for (const file of distFiles) {
  addCheck('build', file, 'built artifact exists and is non-empty', () => {
    const size = statSync(file).size
    const ok = size > 0
    return { ok, evidence: `${size} bytes` }
  })
}

addCheck('build', 'package.json', 'package version matches source manifest', () => {
  const packageVersion = JSON.parse(readText('package.json')).version
  const manifestVersion = JSON.parse(readText('src/manifest.json')).version
  const ok = packageVersion === manifestVersion
  return { ok, evidence: `package=${packageVersion}; manifest=${manifestVersion}` }
})

addCheck('security', 'src/manifest.json', 'manifest uses optional host permissions instead of install-time all-site access', () => {
  const manifest = JSON.parse(readText('src/manifest.json'))
  const optionalHosts = manifest.optional_host_permissions || []
  const ok = (
    !Object.hasOwn(manifest, 'host_permissions') &&
    Array.isArray(optionalHosts) &&
    optionalHosts.includes('http://*/*') &&
    optionalHosts.includes('https://*/*')
  )
  return {
    ok,
    evidence: ok
      ? 'host_permissions absent; optional http/https hosts declared'
      : 'manifest host permission stance is not optional-only'
  }
})

addCheck('build', 'dist/manifest.json', 'built manifest version matches package version', () => {
  const packageVersion = JSON.parse(readText('package.json')).version
  const manifestVersion = JSON.parse(readText('dist/manifest.json')).version
  const ok = packageVersion === manifestVersion
  return { ok, evidence: `package=${packageVersion}; dist=${manifestVersion}` }
})

addCheck('security', 'dist/manifest.json', 'built manifest preserves optional-only host permission stance', () => {
  const manifest = JSON.parse(readText('dist/manifest.json'))
  const optionalHosts = manifest.optional_host_permissions || []
  const ok = (
    !Object.hasOwn(manifest, 'host_permissions') &&
    Array.isArray(optionalHosts) &&
    optionalHosts.includes('http://*/*') &&
    optionalHosts.includes('https://*/*')
  )
  return {
    ok,
    evidence: ok
      ? 'dist manifest has optional http/https hosts and no install-time host_permissions'
      : 'dist manifest host permission stance is not optional-only'
  }
})

addCheck('build', 'package.json', 'validate script covers typecheck, test, version check, and build', () => {
  const validate = JSON.parse(readText('package.json')).scripts?.validate || ''
  const ok = ['typecheck', 'test', 'check:version', 'build'].every((token) => validate.includes(token))
  return { ok, evidence: `validate=${validate}` }
})

addCheck('workflow', 'GOAL_FINAL_AUDIT_REPORT.md', 'final report contains optimization, innovation, and manual test sections', () => {
  const content = readText('GOAL_FINAL_AUDIT_REPORT.md')
  const required = ['## 九、优化了哪些项目', '## 十、创新了什么功能', '## 十一、需要手动测试的重点']
  const ok = required.every((section) => content.includes(section))
  return { ok, evidence: ok ? 'required handoff sections found' : 'handoff section missing' }
})

const results = []
for (let index = 0; index < checks.length; index += 1) {
  const check = checks[index]
  try {
    const result = check.verify()
    results.push({
      id: index + 1,
      ...check,
      ok: Boolean(result.ok),
      evidence: result.evidence || ''
    })
  } catch (error) {
    results.push({
      id: index + 1,
      ...check,
      ok: false,
      evidence: error instanceof Error ? error.message : String(error)
    })
  }
}

const failures = results.filter((result) => !result.ok)
const now = new Date().toISOString()
const lines = [
  '# Goal 500+ Review Log',
  '',
  `Generated at: ${now}`,
  `Review target: ${REVIEW_TARGET}`,
  `Review checks executed: ${results.length}`,
  `Review checks passed: ${results.length - failures.length}`,
  `Review checks failed: ${failures.length}`,
  '',
  '## Summary By Area',
  ''
]

const areas = [...new Set(results.map((result) => result.area))].sort()
for (const area of areas) {
  const areaResults = results.filter((result) => result.area === area)
  const failed = areaResults.filter((result) => !result.ok)
  lines.push(`- ${area}: ${areaResults.length} checks, ${failed.length} failed`)
}

lines.push('', '## Checks', '')
for (const result of results) {
  const status = result.ok ? 'PASS' : 'FAIL'
  lines.push(
    `${result.id}. [${status}] ${result.area} | ${result.target} | ${result.description} | ${result.evidence}`
  )
}

writeFileSync(LOG_PATH, `${lines.join('\n')}\n`)

console.log(`Review checks executed: ${results.length}`)
console.log(`Review checks passed: ${results.length - failures.length}`)
console.log(`Review checks failed: ${failures.length}`)
console.log(`Review log written: ${LOG_PATH}`)

if (results.length < REVIEW_TARGET) {
  console.error(`Expected at least ${REVIEW_TARGET} review checks, got ${results.length}`)
  process.exit(1)
}

if (failures.length) {
  console.error(`Review failures found. See ${LOG_PATH}`)
  process.exit(1)
}
