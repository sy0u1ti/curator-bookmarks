import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const storageKey = 'curatorBookmarkAiNamingSettings'
const outputDir = path.resolve('output/playwright/ai-compatibility')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-ai-compatibility-'))
await mkdir(outputDir, { recursive: true })
const requests = []
let mode = 'success'
let context
let page
const server = createServer(async (request, response) => {
  response.setHeader('access-control-allow-origin', '*')
  response.setHeader('access-control-allow-headers', 'content-type, authorization')
  response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
  response.setHeader('content-type', 'application/json')
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return }
  let raw = ''
  for await (const chunk of request) raw += chunk.toString()
  const body = raw ? JSON.parse(raw) : null
  requests.push({ method: request.method, path: request.url, authorization: request.headers.authorization, body })
  if (request.method === 'GET' && request.url === '/v1/models') {
    response.end(JSON.stringify({ data: [{ id: 'fixture-local-text' }, { id: 'text-embedding-3-small' }] }))
  } else if (request.method === 'POST' && request.url === '/v1/chat/completions') {
    if (mode === 'compatible' && body.response_format?.type === 'json_schema') {
      response.writeHead(400)
      response.end(JSON.stringify({ error: { message: 'response_format json_schema is not supported' } }))
    } else response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
      content: mode === 'unusable' ? 'The server is reachable.' : '{"status":"ok"}'
    } }] }))
  } else { response.writeHead(404); response.end(JSON.stringify({ error: { message: 'Fixture endpoint not found' } })) }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://127.0.0.1:' + server.address().port

try {
  context = await chromium.launchPersistentContext(profilePath, {
    channel: 'chromium', headless: true, viewport: { width: 1360, height: 1000 }, reducedMotion: 'reduce',
    args: ['--disable-extensions-except=' + path.resolve('dist'), '--load-extension=' + path.resolve('dist')]
  })
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15000 })
  const extensionId = new URL(worker.url()).host
  await worker.evaluate(({ key, origin }) => chrome.storage.local.set({ [key]: {
    baseUrl: origin, apiKey: '', model: 'fixture-local-text', customModels: ['fixture-local-text'], fetchedModels: [],
    apiStyle: 'auto', timeoutMs: 10000, reasoningEffort: 'default', autoAnalyzeBookmarks: false
  } }), { key: storageKey, origin })
  page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  // Simulate consent only for this disposable localhost fixture; no real host grants or credentials are changed.
  await page.addInitScript((origin) => {
    const contains = chrome.permissions.contains.bind(chrome.permissions)
    const request = chrome.permissions.request.bind(chrome.permissions)
    const localOnly = (query) => query.origins?.length && query.origins.every((value) => value === origin + '/*')
    const granted = (callback) => callback ? callback(true) : Promise.resolve(true)
    chrome.permissions.contains = (query, callback) => localOnly(query) ? granted(callback) : contains(query, callback)
    chrome.permissions.request = (query, callback) => localOnly(query) ? granted(callback) : request(query, callback)
  }, origin)
  await page.goto('chrome-extension://' + extensionId + '/src/options/options.html#general', { waitUntil: 'domcontentloaded' })
  await page.locator('#ai-api-key').waitFor({ state: 'visible', timeout: 20000 })
  assert.equal(await page.locator('#ai-api-key').inputValue(), '')
  await page.getByRole('button', { name: 'Base URL 与接口选项', exact: true }).click()
  await page.getByRole('combobox', { name: '接口类型', exact: true }).click()
  const labels = ['自动识别（推荐）', 'OpenAI Responses', 'OpenAI Chat Completions', 'Anthropic Messages', 'Gemini GenerateContent', 'Gemini Interactions']
  for (const label of labels) await page.getByRole('option', { name: label, exact: true }).waitFor({ state: 'visible' })
  await page.screenshot({ path: path.join(outputDir, 'protocol-options.png'), fullPage: true })
  await page.getByRole('option', { name: 'Gemini Interactions', exact: true }).click()
  await page.getByRole('combobox', { name: '接口类型', exact: true }).click()
  await page.getByRole('option', { name: '自动识别（推荐）', exact: true }).click()

  await page.getByRole('button', { name: '从自定义 AI 渠道获取模型列表', exact: true }).click()
  await page.waitForFunction((key) => chrome.storage.local.get(key).then((stored) => stored[key]?.fetchedModels?.includes('fixture-local-text')), storageKey)
  const stored = await page.evaluate((key) => chrome.storage.local.get(key), storageKey)
  assert.deepEqual(stored[storageKey].fetchedModels, ['fixture-local-text'])
  assert.equal(stored[storageKey].apiKey, '')
  assert.equal(stored[storageKey].apiStyle, 'auto')

  const testButton = page.getByRole('button', { name: '测试自定义 AI 渠道连接', exact: true })
  await testButton.click()
  await page.getByText(/已通过结构化输出测试/).first().waitFor({ state: 'visible' })
  const strictRequest = requests.find((entry) => entry.method === 'POST')
  assert.equal(strictRequest.body.response_format.type, 'json_schema')
  assert.equal(strictRequest.authorization, undefined)
  mode = 'compatible'
  const beforeFallback = requests.length
  await testButton.click()
  await page.getByText(/已启用渠道兼容模式/).first().waitFor({ state: 'visible' })
  const fallbackRequests = requests.slice(beforeFallback).filter((entry) => entry.method === 'POST')
  assert.deepEqual(fallbackRequests.map((entry) => entry.body.response_format.type), ['json_schema', 'json_object'])
  await page.screenshot({ path: path.join(outputDir, 'compatible-connection.png'), fullPage: true })
  const beforeReuse = requests.length
  await testButton.click()
  await page.getByText(/已通过结构化输出测试/).first().waitFor({ state: 'visible' })
  assert.equal(requests.length - beforeReuse, 1)

  mode = 'unusable'
  const beforeUnusable = requests.length
  await testButton.click()
  await page.getByText(/AI 返回了无法解析的 ai_connectivity JSON/).first().waitFor({ state: 'visible' })
  assert.equal(requests.length - beforeUnusable, 2)
  assert.equal(await page.getByText(/连接成功，当前模型/).count(), 0)
  await page.screenshot({ path: path.join(outputDir, 'unusable-response.png'), fullPage: true })
  assert.deepEqual(pageErrors, [])
  await writeFile(path.join(outputDir, 'browser-results.json'), JSON.stringify({
    protocolOptions: labels, localProviderWithoutKey: true, filteredNonTextModel: true,
    structuredConnectionCheck: true, formatFallback: true, capabilityReuse: true,
    rejectsUnusableHttp200: true, pageErrors, provider: 'disposable localhost mock only',
    requests: requests.map(({ method, path, body }) => ({ method, path, outputMode: body?.response_format?.type }))
  }, null, 2))
  console.log('AI browser compatibility tests passed: protocol selector, local models, structured health check, fallback, cache and false-success rejection.')
} catch (error) {
  if (page) {
    await page.screenshot({ path: path.join(outputDir, 'failure.png'), fullPage: true }).catch(() => {})
    await writeFile(path.join(outputDir, 'failure-state.txt'), await page.locator('body').ariaSnapshot()).catch(() => {})
  }
  throw error
} finally {
  await context?.close()
  await new Promise((resolve) => server.close(resolve))
  const resolvedProfile = path.resolve(profilePath)
  assert.ok(resolvedProfile.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(resolvedProfile).startsWith('curator-ai-compatibility-'))
  await rm(resolvedProfile, { recursive: true, force: true })
}
