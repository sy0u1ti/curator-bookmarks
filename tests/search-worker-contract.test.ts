import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import type {
  DashboardSearchWorkerRequest,
  DashboardSearchWorkerResponse,
  SearchWorkerRequest,
  SearchWorkerResponse
} from '../src/shared/search/search-worker-contract.js'

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('shared search worker contract defines progressive and cancellable messages', () => {
  const contract = readProjectFile('src/shared/search/search-worker-contract.ts')
  const worker = readProjectFile('src/shared/search/search-worker.ts')
  const dashboard = readProjectFile('src/options/sections/dashboard.ts')

  const request: SearchWorkerRequest = { type: 'cancel', requestId: 2, searchKey: 'q' }
  const response: SearchWorkerResponse = { type: 'cancelled', requestId: 2, searchKey: 'q' }
  const dashboardRequest: DashboardSearchWorkerRequest = request
  const dashboardResponse: DashboardSearchWorkerResponse = response

  assert.equal(dashboardRequest.type, 'cancel')
  assert.equal(dashboardResponse.type, 'cancelled')
  assert.match(contract, /type: 'partial'/)
  assert.match(contract, /type: 'final'/)
  assert.match(contract, /type: 'cancelled'/)
  assert.match(contract, /export type DashboardSearchWorkerRequest = SearchWorkerRequest/)
  assert.match(worker, /searchBookmarksFirstBatch/)
  assert.match(worker, /type: 'partial'/)
  assert.match(worker, /type: 'final'/)
  assert.match(worker, /type: 'cancelled'/)
  assert.match(dashboard, /message\.type === 'partial' \|\| message\.type === 'final'/)
})
