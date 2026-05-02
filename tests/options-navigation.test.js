import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('recycle bin is the last item in bookmark management navigation', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const start = optionsHtml.indexOf('id="options-bookmark-nav-label"')
  const end = optionsHtml.indexOf('id="options-ai-nav-label"')

  assert.ok(start > -1)
  assert.ok(end > start)

  const bookmarkNav = optionsHtml.slice(start, end)
  const links = [...bookmarkNav.matchAll(/data-section-link="([^"]+)"/g)].map((match) => match[1])

  assert.equal(links.at(-1), 'recycle')
})

test('smart analysis section uses the renamed Chinese entry copy', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const constants = readProjectFile('src/options/shared-options/constants.ts')

  assert.match(optionsHtml, /data-section-link="ai">书签智能分析</)
  assert.match(optionsHtml, /<h1 id="ai-title">书签智能分析<\/h1>/)
  assert.match(constants, /title: '书签智能分析'/)
  assert.doesNotMatch(optionsHtml, /标签与命名建议/)
  assert.doesNotMatch(constants, /标签与命名建议/)
})
