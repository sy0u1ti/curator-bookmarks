import {
  AiRuntimeError,
  buildAiFolderCandidates,
  normalizeAiFolderDecision,
  requestStructuredAiOutput,
  validateJsonSchema,
  validateKnownFolderId,
  type JsonSchema
} from './ai-runtime.js'

const SAMPLE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['action', 'confidence', 'items'],
  properties: {
    action: { type: 'string', enum: ['keep', 'rename'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    items: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }
}

async function run(): Promise<void> {
  testSchemaValidation()
  testFolderCandidatesAndDecision()
  await testResponsesProviderEnvelope()
  await testChatCompletionsEnvelope()
  await testParseRepairRetry()
  await testNoRetryForAbort()
}

function testSchemaValidation(): void {
  validateJsonSchema({
    action: 'keep',
    confidence: 0.8,
    items: [{ id: 'a' }]
  }, SAMPLE_SCHEMA, 'sample')

  assertThrowsKind(() => validateJsonSchema({
    action: 'delete',
    confidence: 0.8,
    items: [{ id: 'a' }]
  }, SAMPLE_SCHEMA, 'sample'), 'schema')

  assertThrowsKind(() => validateJsonSchema({
    action: 'keep',
    confidence: 2,
    items: [{ id: 'a' }]
  }, SAMPLE_SCHEMA, 'sample'), 'schema')

  assertThrowsKind(() => validateJsonSchema({
    action: 'keep',
    confidence: 0.2,
    items: [{ id: 'a', extra: true }]
  }, SAMPLE_SCHEMA, 'sample'), 'schema')
}

function testFolderCandidatesAndDecision(): void {
  const candidates = buildAiFolderCandidates([
    { id: '1', title: 'Dev', path: 'Bookmarks / Dev', depth: 2 },
    { id: '2', title: 'AI', path: 'Bookmarks / Dev / AI', depth: 3 }
  ], { currentFolderPath: 'Bookmarks / Dev / AI / Papers' })

  assert(candidates[0].folderId === '2', 'deeper current-path candidate should rank first')
  assert(validateKnownFolderId('2', candidates).folderPath === 'Bookmarks / Dev / AI', 'known folder id should resolve')
  assertThrowsKind(() => validateKnownFolderId('missing', candidates), 'schema')

  const existingDecision = normalizeAiFolderDecision({
    kind: 'existing',
    folder_id: '2',
    reason: 'matches topic',
    confidence: 0.9
  }, candidates)
  assert(existingDecision.kind === 'existing' && existingDecision.folderId === '2', 'existing decision should keep folder_id')

  const newDecision = normalizeAiFolderDecision({
    kind: 'new',
    folder_path: 'Bookmarks / Research',
    confidence: 0.6
  }, candidates)
  assert(newDecision.kind === 'new' && newDecision.folderPath === 'Bookmarks / Research', 'new decision should keep path')
}

async function testResponsesProviderEnvelope(): Promise<void> {
  const calls: unknown[] = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('responses'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(calls, {
      output_text: JSON.stringify({
        action: 'rename',
        confidence: 0.7,
        items: [{ id: 'a' }]
      })
    })
  })

  assert(result.data.action === 'rename', 'Responses payload should parse')
  assert(result.metadata.apiStyle === 'responses', 'metadata should retain API style')
  assert(JSON.stringify(calls[0]).includes('"json_schema"'), 'Responses body should request json_schema')
}

async function testChatCompletionsEnvelope(): Promise<void> {
  const calls: unknown[] = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('chat_completions'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(calls, {
      choices: [{
        message: {
          content: '```json\n{"action":"keep","confidence":0.4,"items":[{"id":"b"}]}\n```'
        }
      }]
    })
  })

  assert(result.data.action === 'keep', 'Chat Completions payload should parse fenced JSON')
  assert(JSON.stringify(calls[0]).includes('"json_object"'), 'Chat body should request json_object')
}

async function testParseRepairRetry(): Promise<void> {
  const calls: unknown[] = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('responses'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    fetchImpl: createFetchStub(calls, [
      { output_text: 'not json' },
      { output_text: '{"action":"keep","confidence":0.6,"items":[{"id":"c"}]}' }
    ])
  })

  assert(result.metadata.attempts === 2, 'parse failure should retry once')
  assert(result.metadata.repaired, 'second attempt should be marked repaired')
  assert(JSON.stringify(calls[1]).includes('上一次 sample 输出未通过本地校验'), 'repair prompt should describe failure')
}

async function testNoRetryForAbort(): Promise<void> {
  const controller = new AbortController()
  controller.abort()
  let attempts = 0

  await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      signal: controller.signal,
      fetchImpl: ((async () => {
        attempts += 1
        return new Response('{}')
      }) as typeof fetch)
    })
  }, 'abort')

  assert(attempts === 0, 'abort should not call provider')
}

function getSettings(apiStyle: 'responses' | 'chat_completions') {
  return {
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'test-key',
    model: 'test-model',
    apiStyle,
    timeoutMs: 1000
  }
}

function createFetchStub(calls: unknown[], payloads: unknown | unknown[]): typeof fetch {
  const queue = Array.isArray(payloads) ? payloads.slice() : [payloads]
  return (async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init?.body ? JSON.parse(String(init.body)) : null)
    const payload = queue.shift() ?? queue[queue.length - 1]
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }) as typeof fetch
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

function assertThrowsKind(callback: () => void, kind: string): void {
  try {
    callback()
  } catch (error) {
    assert(error instanceof AiRuntimeError, 'expected AiRuntimeError')
    assert(error.kind === kind, `expected ${kind}, got ${error.kind}`)
    return
  }
  throw new Error(`expected ${kind} error`)
}

async function assertRejectsKind(callback: () => Promise<void>, kind: string): Promise<void> {
  try {
    await callback()
  } catch (error) {
    assert(error instanceof AiRuntimeError, 'expected AiRuntimeError')
    assert(error.kind === kind, `expected ${kind}, got ${error.kind}`)
    return
  }
  throw new Error(`expected ${kind} rejection`)
}

await run()
console.log('AI runtime tests passed.')
