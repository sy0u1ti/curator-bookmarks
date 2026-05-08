import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

function readProjectFile(path) {
  return readFileSync(path, 'utf8')
}

const POSITIONING = '本地优先的 Chrome 书签搜索、整理、清理'

test('release-blocking compliance documents exist and cover required categories', () => {
  assert.equal(existsSync('docs/permissions-matrix.md'), true)
  assert.equal(existsSync('docs/privacy-practices-mapping.md'), true)
  assert.equal(existsSync('docs/manual-release-evidence.md'), true)
  assert.equal(existsSync('docs/manual-verification-runbook.md'), true)
  assert.equal(existsSync('docs/high-risk-operations-safety.md'), true)

  const matrix = readProjectFile('docs/permissions-matrix.md')
  const privacyMapping = readProjectFile('docs/privacy-practices-mapping.md')
  const manualEvidence = readProjectFile('docs/manual-release-evidence.md')
  const manualRunbook = readProjectFile('docs/manual-verification-runbook.md')
  const highRisk = readProjectFile('docs/high-risk-operations-safety.md')

  for (const term of [
    '`bookmarks`',
    '`storage`',
    '`activeTab`',
    '`favicon`',
    '`notifications`',
    '`alarms`',
    '`optional_host_permissions`',
    '`webRequest`',
    '`webNavigation`',
    '`chrome_url_overrides.newtab`',
    'Newtab web search',
    'Featured remote backgrounds'
  ]) {
    assert.match(matrix, new RegExp(escapeRegExp(term)))
  }

  for (const term of [
    'Chrome bookmark data',
    'Newtab webpage search query',
    'Link availability checks',
    'AI requests',
    'AI usage counters',
    'Jina Reader requests',
    'Featured remote backgrounds',
    'User custom remote background',
    'Audit and diagnostics',
    'Backup files'
  ]) {
    assert.match(privacyMapping, new RegExp(escapeRegExp(term)))
  }

  for (const term of [
    'Chrome Web Store backend fields',
    '5-8 target-user records',
    'Visual review',
    'Accessibility review',
    'not automatically satisfied by CI'
  ]) {
    assert.match(manualEvidence, new RegExp(escapeRegExp(term)))
  }

  for (const term of [
    'Store Screenshot Capture',
    'CWS Backend Field Parity',
    'Target-User Research',
    'Accessibility Review',
    'High-Risk Operation Exploratory Pass',
    'Clean-Profile Platform Review'
  ]) {
    assert.match(manualRunbook, new RegExp(escapeRegExp(term)))
  }

  for (const term of [
    'Bookmark delete',
    'Folder cleanup',
    'Recycle Bin restore',
    'Backup restore',
    'AI naming/tagging suggestions',
    'Manual evidence still required'
  ]) {
    assert.match(highRisk, new RegExp(escapeRegExp(term)))
  }
})

test('privacy listing readme and manifest share compatible local-first wording', () => {
  const manifest = JSON.parse(readProjectFile('src/manifest.json'))
  const readme = readProjectFile('README.md')
  const privacy = readProjectFile('PRIVACY.md')
  const listing = readProjectFile('docs/chrome-web-store-listing.md')

  for (const content of [manifest.description, readme, privacy, listing]) {
    assert.match(content, new RegExp(POSITIONING))
  }

  for (const content of [readme, privacy, listing]) {
    assert.match(content, /AI 与远程解析为用户主动启用的可选辅助能力/)
    assert.match(content, /网页搜索/)
    assert.match(content, /精选远程背景|精选远程图库|精选图库/)
    assert.match(content, /无默认远程行为遥测|不使用默认远程行为遥测|不提供.*默认远程行为遥测/)
  }
})

test('public compliance materials avoid over-promising privacy or performance', () => {
  const combined = [
    readProjectFile('README.md'),
    readProjectFile('PRIVACY.md'),
    readProjectFile('docs/chrome-web-store-listing.md'),
    readProjectFile('docs/privacy-practices-mapping.md')
  ].join('\n')

  assert.doesNotMatch(combined, /完全本地|绝不联网|100%\s*隐私|一定通过审核|秒搜所有书签/)
  assert.match(combined, /它不表示所有功能永远离线|Do not say "never connects to the internet"/)
  assert.match(combined, /local AI usage ledger|AI 用量计数/)
})

test('README keeps AI and automatic analysis framed as optional and reviewable', () => {
  const readme = readProjectFile('README.md')

  assert.match(readme, /可选自动分析/)
  assert.match(readme, /启用 AI 服务并授权相关 origin/)
  assert.match(readme, /也可设置为仅生成信息、不自动移动/)
  assert.match(readme, /未启用 AI 时本地搜索、手动整理和备份仍可使用/)
  assert.match(readme, /AI 可推荐书签文件夹；应用前可预览，手动整理结果默认优先/)
  assert.doesNotMatch(readme, /后台自动分析网页内容、生成标签和摘要，并移动到推荐文件夹/)
})

test('web search and remote background disclosures are not used to justify host permissions', () => {
  const matrix = readProjectFile('docs/permissions-matrix.md')
  const listing = readProjectFile('docs/chrome-web-store-listing.md')
  const privacy = readProjectFile('PRIVACY.md')

  assert.match(matrix, /Newtab web search or remote backgrounds do not justify host permissions/)
  assert.match(listing, /Newtab 网页搜索和远程背景不是主机权限理由/)
  assert.match(privacy, /Newtab 网页搜索和远程背景不是该权限理由/)
})

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
