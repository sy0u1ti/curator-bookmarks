import assert from 'node:assert/strict'
import { buildJinaReaderUrl } from './content-extraction.js'

assert.equal(
  buildJinaReaderUrl('https://example.com/path?q=curator'),
  'https://r.jina.ai/https://example.com/path?q=curator',
  'https targets should keep their protocol after the Jina Reader prefix'
)

assert.equal(
  buildJinaReaderUrl('http://example.com/path'),
  'https://r.jina.ai/http://example.com/path',
  'http targets should keep their protocol after the Jina Reader prefix'
)

assert.equal(
  buildJinaReaderUrl('  https://example.com/path  '),
  'https://r.jina.ai/https://example.com/path',
  'reader URLs should trim user-facing URL strings'
)

assert.equal(
  buildJinaReaderUrl('chrome://extensions'),
  '',
  'non-http URLs should not be proxied through Jina Reader'
)

assert.equal(
  buildJinaReaderUrl('not a url'),
  '',
  'invalid URLs should not be proxied through Jina Reader'
)

console.log('Content extraction tests passed.')
