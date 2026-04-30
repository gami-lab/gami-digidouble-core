import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { HealthReport, HealthStatus } from '../../domain/health/index.js'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = 'e2e-stack-secret'

function isHealthStatus(value: string): value is HealthStatus {
  return value === 'healthy' || value === 'degraded' || value === 'unknown'
}

describe('Stack E2E — GET /v1/admin/health — auth', () => {
  it('rejects requests with no API key (401)', async () => {
    const response = await fetch(`${APP_URL}/v1/admin/health`)
    expect(response.status).toBe(401)
  })

  it('rejects requests with wrong API key (401)', async () => {
    const response = await fetch(`${APP_URL}/v1/admin/health`, {
      headers: { 'x-api-key': 'wrong-key' },
    })
    expect(response.status).toBe(401)
  })
})

describe('Stack E2E — GET /v1/admin/health — shape', () => {
  it('returns 200 with correct HealthReport shape', async () => {
    const response = await fetch(`${APP_URL}/v1/admin/health`, {
      headers: { 'x-api-key': API_KEY },
    })

    expect(response.status).toBe(200)

    const body = (await response.json()) as ApiResponse<HealthReport>
    expect(body.error).toBeNull()
    expect(body.data).not.toBeNull()

    const status = body.data?.status ?? 'unknown'
    expect(isHealthStatus(status)).toBe(true)
    expect(Array.isArray(body.data?.dependencies)).toBe(true)
    expect(Number.isNaN(Date.parse(body.data?.checkedAt ?? ''))).toBe(false)
  })
})
