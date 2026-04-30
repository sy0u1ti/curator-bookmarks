import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildAiStructuredOutputRefusalError,
  extractAiErrorMessage,
  extractChatCompletionsJsonText,
  extractResponsesJsonText,
  getAiEndpoint,
  stripMarkdownCodeFences
} from '../src/shared/ai-response.js'

test('builds AI endpoint from base URL and API style', () => {
  assert.equal(
    getAiEndpoint({ baseUrl: 'https://api.example.com/v1', apiStyle: 'responses' }),
    'https://api.example.com/v1/responses'
  )
  assert.equal(
    getAiEndpoint({ baseUrl: 'https://api.example.com/v1/responses', apiStyle: 'responses' }),
    'https://api.example.com/v1/responses'
  )
  assert.equal(
    getAiEndpoint({ baseUrl: 'https://api.example.com/v1/', apiStyle: 'chat_completions' }),
    'https://api.example.com/v1/chat/completions'
  )
})

test('extracts structured JSON text from Responses API payloads', () => {
  assert.equal(
    extractResponsesJsonText({ output_text: '{"ok":true}' }),
    '{"ok":true}'
  )
  assert.equal(
    extractResponsesJsonText({
      output: [
        {
          content: [
            { type: 'output_text', text: '{"items":[]}' }
          ]
        }
      ]
    }),
    '{"items":[]}'
  )
})

test('extracts structured JSON text from Chat Completions payloads', () => {
  assert.equal(
    extractChatCompletionsJsonText({
      choices: [
        {
          message: {
            content: '```json\n{"ok":true}\n```'
          }
        }
      ]
    }),
    '{"ok":true}'
  )
  assert.equal(
    extractChatCompletionsJsonText({
      choices: [
        {
          message: {
            content: [
              { type: 'text', text: '{"items":[]}' }
            ]
          }
        }
      ]
    }),
    '{"items":[]}'
  )
})

test('formats AI refusal and error payloads consistently', () => {
  let refusalMessage = ''
  try {
    extractResponsesJsonText({ output: [{ content: [{ refusal: 'cannot comply' }] }] })
  } catch (error) {
    refusalMessage = error instanceof Error ? error.message : String(error)
  }
  assert.ok(refusalMessage.includes('模型拒绝生成结构化结果：cannot comply'))
  assert.equal(stripMarkdownCodeFences('```json\n{"a":1}\n```'), '{"a":1}')
  assert.equal(
    extractAiErrorMessage({ error: { message: 'bad key' } }, 401),
    'AI 请求失败（401）：bad key'
  )
  assert.equal(
    buildAiStructuredOutputRefusalError('  a   b  '),
    '模型拒绝生成结构化结果：a b'
  )
})
