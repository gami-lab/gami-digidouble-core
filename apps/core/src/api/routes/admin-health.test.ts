import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { ApiResponse } from '@gami/shared'
import type { IDependencyProbe } from '../../application/ports/IDependencyProbe.js'
import type { HealthReport } from '../../domain/health/index.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

const appsToClose: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(appsToClose.splice(0).map(async (app) => app.close()))
})

class DegradedProbe implements IDependencyProbe {
  constructor(private readonly name: string) {}

  probe() {
    return Promise.resolve({
      name: this.name,
      status: 'degraded' as const,
      message: 'synthetic failure',
    })
  }
}

class HealthyProbe implements IDependencyProbe {
  constructor(private readonly name: string) {}

  probe() {
    return Promise.resolve({
      name: this.name,
      status: 'healthy' as const,
      latencyMs: 1,
    })
  }
}

function makeApp(probes: IDependencyProbe[]): FastifyInstance {
  const app = createServer(TEST_CONFIG, { probes })
  appsToClose.push(app)
  return app
}

function authHeaders(apiKey = 'test-secret'): { 'x-api-key': string } {
  return { 'x-api-key': apiKey }
}

describe('GET /v1/admin/health', () => {
  it('returns 401 when API key is missing', async () => {
    const app = makeApp([new HealthyProbe('postgres')])

    const response = await app.inject({ method: 'GET', url: '/v1/admin/health' })

    expect(response.statusCode).toBe(401)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 when API key is invalid', async () => {
    const app = makeApp([new HealthyProbe('postgres')])

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/health',
      headers: authHeaders('wrong-key'),
    })

    expect(response.statusCode).toBe(401)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 200 and healthy when all probes are healthy', async () => {
    const app = makeApp([
      new HealthyProbe('postgres'),
      new HealthyProbe('redis'),
      new HealthyProbe('llm'),
    ])

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/health',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<HealthReport>>()
    expect(body.error).toBeNull()
    expect(body.data?.status).toBe('healthy')
    expect(Array.isArray(body.data?.dependencies)).toBe(true)
    expect(body.data?.dependencies).toHaveLength(3)
    expect(Number.isNaN(Date.parse(body.data?.checkedAt ?? ''))).toBe(false)
  })

  it('returns 200 and degraded when one probe is degraded', async () => {
    const app = makeApp([
      new HealthyProbe('postgres'),
      new DegradedProbe('redis'),
      new HealthyProbe('llm'),
    ])

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/health',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<HealthReport>>()
    expect(body.error).toBeNull()
    expect(body.data?.status).toBe('degraded')
    expect(body.data?.dependencies).toHaveLength(3)
    expect(
      body.data?.dependencies.some((dep) => dep.name === 'redis' && dep.status === 'degraded'),
    ).toBe(true)
  })
})
