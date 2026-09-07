import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = 'e2e-stack-secret'
const RUN_REINDEX_STACK_E2E = process.env['RUN_REINDEX_STACK_E2E'] === '1'

function authHeaders(apiKey = API_KEY): Record<string, string> {
  return { 'content-type': 'application/json', 'x-api-key': apiKey }
}

describe.skipIf(!RUN_REINDEX_STACK_E2E)('Stack E2E — admin knowledge reindex', () => {
  it('rejects unauthenticated starts and invalid request bodies', async () => {
    const unauthenticated = await fetch(`${APP_URL}/v1/admin/knowledge/reindex`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(unauthenticated.status).toBe(401)

    const wrongKey = await fetch(`${APP_URL}/v1/admin/knowledge/reindex`, {
      method: 'POST',
      headers: { ...authHeaders('wrong-key') },
      body: JSON.stringify({}),
    })
    expect(wrongKey.status).toBe(401)

    const invalid = await fetch(`${APP_URL}/v1/admin/knowledge/reindex`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ unexpected: true }),
    })
    expect(invalid.status).toBe(400)
  })

  it('returns a not-found ApiResponse for an unknown operation', async () => {
    const response = await fetch(
      `${APP_URL}/v1/admin/knowledge/reindex/reindex_operation_00000000-0000-0000-0000-000000000000`,
      { headers: { 'x-api-key': API_KEY } },
    )
    expect(response.status).toBe(404)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('requires authentication on status and retry routes', async () => {
    const status = await fetch(`${APP_URL}/v1/admin/knowledge/reindex/reindex_operation_missing`)
    expect(status.status).toBe(401)
    const retry = await fetch(
      `${APP_URL}/v1/admin/knowledge/reindex/reindex_operation_missing/retry`,
      { method: 'POST', headers: { 'x-api-key': 'wrong-key' }, body: JSON.stringify({}) },
    )
    expect(retry.status).toBe(401)
  })

  it('starts and inspects the configured reindex operation', async () => {
    const started = await fetch(`${APP_URL}/v1/admin/knowledge/reindex`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    })
    expect([200, 202]).toContain(started.status)
    const body = (await started.json()) as ApiResponse<{
      status: string
      operation: { reindexOperationId: string } | null
    }>
    if (body.data?.operation === null) return

    const inspected = await fetch(
      `${APP_URL}/v1/admin/knowledge/reindex/${body.data?.operation.reindexOperationId ?? ''}`,
      { headers: { 'x-api-key': API_KEY } },
    )
    expect(inspected.status).toBe(200)
    const inspectedBody = (await inspected.json()) as ApiResponse<{
      operation: { status: string }
    }>
    expect(inspectedBody.data?.operation).toBeDefined()
  })

  it('accepts a retry request for a failed operation', async () => {
    const started = await fetch(`${APP_URL}/v1/admin/knowledge/reindex`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    })
    const body = (await started.json()) as ApiResponse<{
      operation: { reindexOperationId: string } | null
    }>
    const operationId = body.data?.operation?.reindexOperationId
    if (operationId === undefined) return

    const retry = await fetch(`${APP_URL}/v1/admin/knowledge/reindex/${operationId}/retry`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    })
    expect([202, 409]).toContain(retry.status)
  })
})
