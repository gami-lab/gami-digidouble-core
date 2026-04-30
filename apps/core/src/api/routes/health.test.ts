import { describe, it, expect, vi } from 'vitest'
import { createServer } from '../server.js'
import type { Config } from '../../config.js'
import type { ApiResponse } from '@gami/shared'
import type { ServerAdapters } from '../server.js'

const testConfig: Config = {
  port: 3000,
  host: '0.0.0.0',
  nodeEnv: 'test',
  logLevel: 'silent',
  databaseUrl: 'postgresql://test',
  redisUrl: 'redis://test',
  apiKeySecret: 'test-secret',
  corsOrigin: '*',
  llmProvider: 'null',
  openaiApiKey: undefined,
  anthropicApiKey: undefined,
  mistralApiKey: undefined,
  langfusePublicKey: undefined,
  langfuseSecretKey: undefined,
  langfuseHost: undefined,
}

describe('GET /health', () => {
  it('returns 200 with ok status and standard envelope', async () => {
    const app = createServer(testConfig)

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)

    const body =
      response.json<ApiResponse<{ status: string; version: string; timestamp: string }>>()
    expect(body.error).toBeNull()
    expect(body.data).not.toBeNull()
    expect(body.data?.status).toBe('ok')
    expect(typeof body.data?.timestamp).toBe('string')
  })

  it('never touches external adapters — safe as a Kubernetes liveness probe', async () => {
    const failIfCalled = (): never => {
      throw new Error('GET /health must not call any external adapter')
    }

    const adapters: ServerAdapters = {
      llmAdapter: { complete: vi.fn(failIfCalled) },
      avatarRepository: {
        create: vi.fn(failIfCalled),
        findById: vi.fn(failIfCalled),
        listByScenarioId: vi.fn(failIfCalled),
        delete: vi.fn(failIfCalled),
        update: vi.fn(failIfCalled),
      },
      probes: [{ probe: vi.fn(failIfCalled) }],
    }

    const app = createServer(testConfig, adapters)

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json<ApiResponse<{ status: string }>>().data?.status).toBe('ok')
  })
})
