import {
  AiRuntimeError,
  buildAiFolderCandidates,
  normalizeAiFolderDecision,
  requestStructuredAiOutput,
  validateJsonSchema,
  validateKnownFolderId,
  type JsonSchema
} from './ai-runtime.js'
import {
  getModelReasoningProfile,
  getReasoningEffortOptions,
  resolveReasoningEffortForModel
} from './ai-reasoning.js'

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
  await testResponsesProviderErrorDoesNotFallback()
  await testProviderTextErrorBody()
  await testTimeoutErrorMessage()
  await testNoRetryForAbort()
  await testThinkTagAndProseExtraction()
  await testReasoningContentSalvage()
  await testTruncationDetection()
  await testResponseFormatFallback()
  await testRetryAfterBackoff()
  await testBodyReadTimeout()
  await testReasoningEffortInjection()
  await testReasoningEffortFallback()
  testModelReasoningProfiles()
}

function testModelReasoningProfiles(): void {
  assert(getModelReasoningProfile('gpt-5').levels.includes('minimal'), 'gpt-5 should offer minimal')
  assert(!getModelReasoningProfile('gpt-5.5').levels.includes('minimal'), 'gpt-5.1+ should drop minimal')
  assert(getModelReasoningProfile('o4-mini').supported, 'o-series should support effort')
  assert(!getModelReasoningProfile('gpt-4o').supported, 'gpt-4o is not a reasoning model')
  assert(getModelReasoningProfile('deepseek-v4-flash').supported, 'deepseek v4 should support effort')
  assert(!getModelReasoningProfile('qwen3-max').supported, 'qwen uses thinking budget, not effort')
  assert(getModelReasoningProfile('grok-4.3').supported, 'grok 4.3 should support effort')
  assert(!getModelReasoningProfile('grok-4').supported, 'legacy grok-4 rejects reasoning_effort')
  assert(getModelReasoningProfile('claude-sonnet-5').supported, 'claude via openrouter maps effort')
  assert(getModelReasoningProfile('my-house-model').supported, 'unknown models fall back to standard levels')
  assert(getReasoningEffortOptions('gpt-5').length === 5, 'gpt-5 options should include default + 4 levels')
  assert(resolveReasoningEffortForModel('gpt-4o', 'high') === 'default', 'unsupported model resolves to default')
  assert(resolveReasoningEffortForModel('gpt-5', 'minimal') === 'minimal', 'supported level passes through')
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
  const responsesInput = (calls[0] as { input?: Array<{ content?: unknown }> })?.input || []
  assert(typeof responsesInput[0]?.content === 'string', 'Responses system content should use plain string input')
  assert(typeof responsesInput[1]?.content === 'string', 'Responses user content should use plain string input')
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
  const chatMessages = (calls[0] as { messages?: Array<{ content?: unknown }> })?.messages || []
  assert(
    String(chatMessages[0]?.content || '').includes('json') &&
      String(chatMessages[1]?.content || '').includes('json'),
    'Chat prompt should include lower-case json cues for strict JSON mode gateways'
  )
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

async function testResponsesProviderErrorDoesNotFallback(): Promise<void> {
  const calls: Array<{ url: string; body: any }> = []
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput<Record<string, unknown>>({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      retry: false,
      fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(url),
          body: init?.body ? JSON.parse(String(init.body)) : null
        })
        return new Response(
          "failed to transform response: failed to unmarshal responses api response: invalid character 'e' looking for beginning of value",
          {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
          }
        )
      }) as typeof fetch
    })
  }, 'provider')

  assert(error.message.includes('failed to transform response'), 'Responses provider error should remain visible')
  assert(calls.length === 1, 'Responses provider error should not switch API style automatically')
  assert(calls[0].url.endsWith('/responses'), 'only call should use Responses endpoint')
}

async function testProviderTextErrorBody(): Promise<void> {
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      retry: false,
      fetchImpl: (async () => new Response('upstream overloaded without json', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      })) as typeof fetch
    })
  }, 'provider')

  assert(error.status === 500, 'provider text error should keep HTTP status')
  assert(error.message.includes('upstream overloaded without json'), 'provider text error should preserve raw body excerpt')
}

async function testTimeoutErrorMessage(): Promise<void> {
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      retry: false,
      timeoutMs: 1,
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        return await new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (signal?.aborted) {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
            return
          }
          signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          }, { once: true })
        })
      }) as typeof fetch
    })
  }, 'abort')

  assert(error.message.includes('AI 请求超时'), 'timeout should be reported as a timeout, not a generic abort')
  assert(error.message.includes('1 秒'), 'timeout message should include the effective timeout seconds')
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

async function testThinkTagAndProseExtraction(): Promise<void> {
  // DeepSeek-R1 / Qwen3 风格输出：<think> 思考段 + 说明文字包裹的裸 JSON。
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('chat_completions'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub([], {
      choices: [{
        message: {
          content: '<think>需要先分析书签语义，再决定动作。</think>好的，结果如下：\n{"action":"keep","confidence":0.5,"items":[{"id":"d"}]}\n希望对你有帮助！'
        }
      }]
    })
  })

  assert(result.data.action === 'keep', 'think tag and surrounding prose should be stripped before parsing')
}

async function testReasoningContentSalvage(): Promise<void> {
  // 部分兼容层把全部输出塞进 reasoning_content，正文为空。
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('chat_completions'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub([], {
      choices: [{
        message: {
          content: '',
          reasoning_content: '让我推理一下……最终答案：{"action":"rename","confidence":0.8,"items":[{"id":"e"}]}'
        }
      }]
    })
  })

  assert(result.data.action === 'rename', 'JSON inside reasoning_content should be salvaged')
}

async function testTruncationDetection(): Promise<void> {
  let attempts = 0
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('chat_completions'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      fetchImpl: (async () => {
        attempts += 1
        return new Response(JSON.stringify({
          choices: [{
            finish_reason: 'length',
            message: { content: '{"action":"keep","confidence":0.5,' }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }) as typeof fetch
    })
  }, 'provider')

  assert(error.message.includes('截断'), 'length finish_reason should surface a truncation error')
  assert(attempts === 1, 'truncated output should not waste retry attempts')
}

async function testResponseFormatFallback(): Promise<void> {
  const calls: Array<Record<string, unknown>> = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('chat_completions'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init?.body ? JSON.parse(String(init.body)) : {})
      if (calls.length === 1) {
        return new Response(JSON.stringify({
          error: { message: "Unknown parameter: 'response_format'" }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        choices: [{
          message: { content: '{"action":"keep","confidence":0.4,"items":[{"id":"f"}]}' }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
  })

  assert(calls.length === 2, 'response_format rejection should trigger a compatibility retry')
  assert('response_format' in calls[0], 'first attempt should request structured output')
  assert(!('response_format' in calls[1]), 'fallback attempt should drop response_format')
  assert(result.data.action === 'keep', 'fallback attempt should succeed')
}

async function testRetryAfterBackoff(): Promise<void> {
  const calls: Array<Record<string, unknown>> = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('chat_completions'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init?.body ? JSON.parse(String(init.body)) : {})
      if (calls.length === 1) {
        return new Response(JSON.stringify({ error: { message: 'rate limited' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '0' }
        })
      }
      return new Response(JSON.stringify({
        choices: [{
          message: { content: '{"action":"rename","confidence":0.9,"items":[{"id":"g"}]}' }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
  })

  assert(calls.length === 2, '429 should retry after honoring Retry-After')
  assert(result.metadata.attempts === 2, 'metadata should count the retry attempt')
}

async function testBodyReadTimeout(): Promise<void> {
  const error = await assertRejectsKind(async () => {
    await requestStructuredAiOutput({
      settings: getSettings('responses'),
      schema: SAMPLE_SCHEMA,
      schemaName: 'sample',
      systemPrompt: 'system',
      userPrompt: 'user',
      retry: false,
      timeoutMs: 1,
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal
        // headers 立即返回，body 永久挂起：超时保护必须覆盖读体阶段。
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: () => new Promise<string>((_resolve, reject) => {
            if (signal?.aborted) {
              reject(new DOMException('The operation was aborted.', 'AbortError'))
              return
            }
            signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            }, { once: true })
          })
        } as unknown as Response
      }) as typeof fetch
    })
  }, 'abort')

  assert(error.message.includes('AI 请求超时'), 'hung response body should hit the timeout instead of hanging forever')
}

async function testReasoningEffortInjection(): Promise<void> {
  const chatCalls: Array<Record<string, any>> = []
  await requestStructuredAiOutput<Record<string, unknown>>({
    settings: { ...getSettings('chat_completions'), reasoningEffort: 'low' },
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(chatCalls, {
      choices: [{ message: { content: '{"action":"keep","confidence":0.4,"items":[{"id":"h"}]}' } }]
    })
  })
  assert(chatCalls[0]?.reasoning_effort === 'low', 'chat body should carry reasoning_effort')

  const responsesCalls: Array<Record<string, any>> = []
  await requestStructuredAiOutput<Record<string, unknown>>({
    settings: { ...getSettings('responses'), reasoningEffort: 'high' },
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(responsesCalls, {
      output_text: '{"action":"keep","confidence":0.4,"items":[{"id":"i"}]}'
    })
  })
  assert(responsesCalls[0]?.reasoning?.effort === 'high', 'responses body should carry reasoning.effort')

  const defaultCalls: Array<Record<string, any>> = []
  await requestStructuredAiOutput<Record<string, unknown>>({
    settings: { ...getSettings('chat_completions'), reasoningEffort: 'default' },
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(defaultCalls, {
      choices: [{ message: { content: '{"action":"keep","confidence":0.4,"items":[{"id":"j"}]}' } }]
    })
  })
  assert(!('reasoning_effort' in (defaultCalls[0] ?? {})), 'default should not send reasoning_effort')
}

async function testReasoningEffortFallback(): Promise<void> {
  const calls: Array<Record<string, any>> = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: { ...getSettings('chat_completions'), reasoningEffort: 'medium' },
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init?.body ? JSON.parse(String(init.body)) : {})
      if (calls.length === 1) {
        return new Response(JSON.stringify({
          error: { message: 'Unrecognized parameter: reasoning_effort' }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"action":"rename","confidence":0.7,"items":[{"id":"k"}]}' } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
  })

  assert(calls.length === 2, 'reasoning_effort rejection should trigger one compatibility retry')
  assert('reasoning_effort' in calls[0], 'first attempt should send reasoning_effort')
  assert(!('reasoning_effort' in calls[1]), 'fallback attempt should drop reasoning_effort')
  assert('response_format' in calls[1], 'fallback should keep response_format untouched')
  assert(result.data.action === 'rename', 'fallback attempt should succeed')
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

async function assertRejectsKind(callback: () => Promise<void>, kind: string): Promise<AiRuntimeError> {
  try {
    await callback()
  } catch (error) {
    assert(error instanceof AiRuntimeError, 'expected AiRuntimeError')
    assert(error.kind === kind, `expected ${kind}, got ${error.kind}`)
    return error
  }
  throw new Error(`expected ${kind} rejection`)
}

await run()
console.log('AI runtime tests passed.')
