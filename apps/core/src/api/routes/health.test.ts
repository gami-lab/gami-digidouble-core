import { describe, it, expect } from 'vitest'
import { createServer } from '../server.js'
import type { Config } from '../../config.js'
import type { ApiResponse } from '@gami/shared'

const testConfig: Config = {
  port: 3000,
  host: '0.0.0.0',
  nodeEnv: 'test',
  logLevel: 'silent',
  databaseUrl: 'postgresql://test',
  redisUrl: 'redis://test',
  apiKeySecret: 'test-secret',
  llmProvider: 'null',
  openaiApiKey: undefined,
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
})
