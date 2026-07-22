import {
  AiRuntimeError,
  buildAiFolderCandidates,
  compileStrictJsonSchema,
  normalizeAiFolderDecision,
  requestStructuredAiOutput,
  validateJsonSchema,
  validateKnownFolderId,
  type JsonSchema
} from './ai-runtime.js'
import {
  extractModelReasoningCapabilities,
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

const OPTIONAL_FOLDER_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['bookmark_id'],
        properties: {
          bookmark_id: { type: 'string' },
          folder_decision: {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'reason', 'confidence'],
            properties: {
              kind: { type: 'string', enum: ['existing', 'new', 'manual_review'] },
              folder_id: { type: 'string' },
              folder_path: { type: 'string' },
              reason: { type: 'string' },
              confidence: { type: 'number' }
            }
          }
        }
      }
    }
  }
}

async function run(): Promise<void> {
  testSchemaValidation()
  testStrictSchemaCompilation()
  testFolderCandidatesAndDecision()
  await testResponsesProviderEnvelope()
  await testStrictOptionalNullRestoration()
  await testChatCompletionsEnvelope()
  await testParseRepairRetry()
  await testResponsesProviderErrorDoesNotFallback()
  await testProviderTextErrorBody()
  await testTimeoutErrorMessage()
  await testNoRetryForAbort()
  await testThinkTagAndProseExtraction()
  await testReasoningContentSalvage()
  await testTruncationDetection()
  await testResponsesInvalidSchemaFallback()
  await testResponseFormatFallback()
  await testResponseFormatFullFallback()
  await testRetryAfterBackoff()
  await testBodyReadTimeout()
  await testReasoningEffortInjection()
  await testDirectAnthropicAdapter()
  await testReasoningEffortFallback()
  testModelReasoningProfiles()
}

function testStrictSchemaCompilation(): void {
  const strictSchema = compileStrictJsonSchema(OPTIONAL_FOLDER_SCHEMA)
  const itemSchema = strictSchema.properties?.items?.items
  const decisionSchema = itemSchema?.properties?.folder_decision
  const decisionTypes = Array.isArray(decisionSchema?.type)
    ? decisionSchema.type
    : [decisionSchema?.type]
  const folderIdTypes = Array.isArray(decisionSchema?.properties?.folder_id?.type)
    ? decisionSchema.properties.folder_id.type
    : [decisionSchema?.properties?.folder_id?.type]

  assert(itemSchema?.required?.includes('folder_decision'), 'strict item schema should require folder_decision')
  assert(decisionTypes.includes('object') && decisionTypes.includes('null'), 'optional object should become nullable')
  assert(
    ['kind', 'folder_id', 'folder_path', 'reason', 'confidence']
      .every((key) => decisionSchema?.required?.includes(key)),
    'strict nested object should require every property, including folder_id and folder_path'
  )
  assert(folderIdTypes.includes('string') && folderIdTypes.includes('null'), 'optional folder_id should become nullable')
  assert(
    !OPTIONAL_FOLDER_SCHEMA.properties?.items?.items?.required?.includes('folder_decision'),
    'strict compilation must not mutate the business schema'
  )
}

function testModelReasoningProfiles(): void {
  assert(getModelReasoningProfile('gpt-5').levels.includes('minimal'), 'gpt-5 should offer minimal')
  assert(!getModelReasoningProfile('gpt-5.5').levels.includes('minimal'), 'gpt-5.1+ should drop minimal')
  assert(
    getModelReasoningProfile('gpt-5.6-sol').levels.join(',') === 'low,medium,high,xhigh,max',
    'gpt-5.6 should expose the five current strength levels'
  )
  assert(
    getModelReasoningProfile('gpt-5.5').levels.join(',') === 'low,medium,high,xhigh',
    'gpt-5.5 should expose xhigh but not max'
  )
  assert(getModelReasoningProfile('o4-mini').supported, 'o-series should support effort')
  assert(!getModelReasoningProfile('gpt-4o').supported, 'gpt-4o is not a reasoning model')
  assert(getModelReasoningProfile('deepseek-v4-flash').supported, 'deepseek v4 should support effort')
  assert(!getModelReasoningProfile('qwen3-max').supported, 'qwen uses thinking budget, not effort')
  assert(getModelReasoningProfile('grok-4.3').supported, 'grok 4.3 should support effort')
  assert(!getModelReasoningProfile('grok-4').supported, 'legacy grok-4 rejects reasoning_effort')
  assert(getModelReasoningProfile('claude-sonnet-5').supported, 'claude via openrouter maps effort')
  assert(
    getModelReasoningProfile('claude-sonnet-5').levels.includes('max'),
    'claude sonnet 5 should expose max'
  )
  assert(
    !getModelReasoningProfile('claude-sonnet-4-6').levels.includes('xhigh') &&
      getModelReasoningProfile('claude-sonnet-4-6').levels.includes('max'),
    'claude sonnet 4.6 should expose max without xhigh'
  )
  assert(getModelReasoningProfile('my-house-model').supported, 'unknown models fall back to standard levels')
  assert(getReasoningEffortOptions('gpt-5').length === 4, 'gpt-5 should expose four actual strength levels')
  assert(getReasoningEffortOptions('gpt-5.6-sol').length === 5, 'gpt-5.6 should expose five levels')
  assert(resolveReasoningEffortForModel('gpt-4o', 'high') === 'default', 'unsupported model resolves to default')
  assert(resolveReasoningEffortForModel('gpt-5.6-sol', 'default') === 'medium', 'default should point at model default in the UI')
  assert(resolveReasoningEffortForModel('gpt-5', 'minimal') === 'minimal', 'supported level passes through')

  const openRouterCapabilities = extractModelReasoningCapabilities({
    data: [{
      id: 'vendor/custom-reasoner',
      reasoning: {
        supported_efforts: ['max', 'high', 'medium', 'low'],
        default_effort: 'medium',
        mandatory: true
      }
    }]
  })
  const openRouterProfile = getModelReasoningProfile(
    'vendor/custom-reasoner',
    openRouterCapabilities['vendor/custom-reasoner']
  )
  assert(openRouterProfile.source === 'metadata', 'channel metadata should override model-id fallback')
  assert(openRouterProfile.levels.join(',') === 'low,medium,high,max', 'metadata levels should be normalized low-to-high')
  assert(openRouterProfile.mandatory, 'metadata mandatory flag should be retained')

  const anthropicCapabilities = extractModelReasoningCapabilities({
    data: [{
      id: 'claude-opus-4-8',
      capabilities: {
        effort: {
          supported: true,
          low: { supported: true },
          medium: { supported: true },
          high: { supported: true },
          xhigh: { supported: true },
          max: { supported: true }
        }
      }
    }]
  })
  assert(
    anthropicCapabilities['claude-opus-4-8']?.levels.length === 5,
    'Anthropic Models API capability flags should be detected'
  )
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

async function testStrictOptionalNullRestoration(): Promise<void> {
  const calls: Array<Record<string, any>> = []
  const result = await requestStructuredAiOutput<{ items: Array<Record<string, unknown>> }>({
    settings: getSettings('responses'),
    schema: OPTIONAL_FOLDER_SCHEMA,
    schemaName: 'bookmark_naming_batch',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(calls, {
      output_text: JSON.stringify({
        items: [{ bookmark_id: 'bookmark-1', folder_decision: null }]
      })
    })
  })

  const sentSchema = calls[0]?.text?.format?.schema as JsonSchema | undefined
  const sentDecisionSchema = sentSchema?.properties?.items?.items?.properties?.folder_decision
  assert(
    sentDecisionSchema?.required?.includes('folder_id') && sentDecisionSchema.required.includes('folder_path'),
    'request schema should satisfy OpenAI required-property rules at the failing folder_decision path'
  )
  assert(
    !('folder_decision' in (result.data.items[0] || {})),
    'nullable strict placeholder should be restored to the original optional-field shape'
  )
  assert(result.metadata.structuredOutputMode === 'json_schema', 'successful strict request should report json_schema mode')
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
  assert(JSON.stringify(calls[0]).includes('"json_schema"'), 'Chat body should prefer strict json_schema')
  const responseFormat = (calls[0] as { response_format?: Record<string, any> })?.response_format
  assert(responseFormat?.json_schema?.strict === true, 'Chat json_schema should enable strict mode')
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

  assert(calls.length === 2, 'json_schema rejection should trigger a compatibility retry')
  assert((calls[0]?.response_format as any)?.type === 'json_schema', 'first attempt should request json_schema')
  assert((calls[1]?.response_format as any)?.type === 'json_object', 'first fallback should retain JSON mode')
  assert(result.data.action === 'keep', 'fallback attempt should succeed')
  assert(result.metadata.structuredOutputMode === 'json_object', 'metadata should expose the successful fallback mode')
}

async function testResponsesInvalidSchemaFallback(): Promise<void> {
  const calls: Array<Record<string, any>> = []
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: getSettings('responses'),
    schema: SAMPLE_SCHEMA,
    schemaName: 'bookmark_naming_batch',
    systemPrompt: 'system',
    userPrompt: 'user',
    fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init?.body ? JSON.parse(String(init.body)) : {})
      if (calls.length === 1) {
        return new Response(JSON.stringify({
          error: {
            message: "Invalid schema for response_format 'bookmark_naming_batch': In context=('properties', 'items', 'items', 'properties', 'folder_decision'), 'required' is required to be supplied and to be an array including every key in properties. Missing 'folder_id'.",
            type: 'invalid_request_error',
            param: 'text.format.schema',
            code: 'invalid_json_schema'
          }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        output_text: '{"action":"keep","confidence":0.4,"items":[{"id":"responses-fallback"}]}'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
  })

  assert(calls[0]?.text?.format?.type === 'json_schema', 'Responses should begin with strict json_schema')
  assert(calls[1]?.text?.format?.type === 'json_object', 'invalid strict schema errors should downgrade to JSON mode')
  assert(result.metadata.structuredOutputMode === 'json_object', 'Responses fallback should report JSON mode')
}

async function testResponseFormatFullFallback(): Promise<void> {
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
          error: { message: "Invalid value 'json_schema' for response_format.type" }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      if (calls.length === 2) {
        return new Response(JSON.stringify({
          error: { message: "Unknown parameter: 'response_format'" }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        choices: [{
          message: { content: '{"action":"keep","confidence":0.4,"items":[{"id":"fallback"}]}' }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
  })

  assert(calls.length === 3, 'unsupported formats should downgrade through both compatibility levels')
  assert((calls[0]?.response_format as any)?.type === 'json_schema', 'full fallback should begin with json_schema')
  assert((calls[1]?.response_format as any)?.type === 'json_object', 'full fallback should next try json_object')
  assert(!('response_format' in calls[2]), 'full fallback should finally use prompt-only JSON')
  assert(result.metadata.structuredOutputMode === 'prompt', 'metadata should report prompt-only fallback')
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

  const openRouterCalls: Array<Record<string, any>> = []
  await requestStructuredAiOutput<Record<string, unknown>>({
    settings: {
      ...getSettings('chat_completions'),
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'gpt-5.6-sol',
      reasoningEffort: 'max'
    },
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: createFetchStub(openRouterCalls, {
      choices: [{ message: { content: '{"action":"keep","confidence":0.4,"items":[{"id":"or"}]}' } }]
    })
  })
  assert(openRouterCalls[0]?.reasoning?.effort === 'max', 'OpenRouter chat should carry reasoning.effort')
  assert(!('reasoning_effort' in (openRouterCalls[0] ?? {})), 'OpenRouter should not receive reasoning_effort')

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

async function testDirectAnthropicAdapter(): Promise<void> {
  let calledUrl = ''
  let calledHeaders = new Headers()
  let calledBody: Record<string, any> = {}
  const result = await requestStructuredAiOutput<Record<string, unknown>>({
    settings: {
      ...getSettings('chat_completions'),
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: 'anthropic-test-key',
      model: 'claude-opus-4-8',
      reasoningEffort: 'xhigh'
    },
    schema: SAMPLE_SCHEMA,
    schemaName: 'sample',
    systemPrompt: 'system',
    userPrompt: 'user',
    retry: false,
    fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
      calledUrl = String(url)
      calledHeaders = new Headers(init?.headers)
      calledBody = init?.body ? JSON.parse(String(init.body)) : {}
      return new Response(JSON.stringify({
        content: [{
          type: 'text',
          text: '{"action":"keep","confidence":0.9,"items":[{"id":"claude"}]}'
        }],
        stop_reason: 'end_turn'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
  })

  assert(calledUrl === 'https://api.anthropic.com/v1/messages', 'direct Anthropic should use Messages API')
  assert(calledHeaders.get('x-api-key') === 'anthropic-test-key', 'direct Anthropic should use x-api-key')
  assert(calledHeaders.get('anthropic-version') === '2023-06-01', 'direct Anthropic should send API version')
  assert(!calledHeaders.has('authorization'), 'direct Anthropic should not send Bearer authorization')
  assert(calledBody.output_config?.effort === 'xhigh', 'direct Anthropic should use output_config.effort')
  assert(calledBody.output_config?.format?.type === 'json_schema', 'direct Anthropic should use native structured output')
  assert(result.data.action === 'keep', 'direct Anthropic response should be parsed')
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
