import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type { UserFact } from '../../domain/memory/memory.types.js'
import { InMemoryUserMemoryFactRepository } from '../../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { InMemoryUserRepository } from '../../infrastructure/db/in-memory-user.repository.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

const appsToClose: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(appsToClose.splice(0).map(async (app) => app.close()))
})

function authHeaders(apiKey = 'test-secret'): { 'x-api-key': string } {
  return { 'x-api-key': apiKey }
}

function makeFact(overrides: Partial<UserFact> = {}): UserFact {
  return {
    id: 'umf_1',
    userId: 'user_1',
    category: 'preference',
    key: 'language',
    value: 'English',
    confidence: 0.8,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  }
}

function makeApp(facts: UserFact[] = []): FastifyInstance {
  const app = createServer(TEST_CONFIG, {
    userRepository: new InMemoryUserRepository(),
    userMemoryFactRepository: new InMemoryUserMemoryFactRepository(facts),
  })
  appsToClose.push(app)
  return app
}

describe('GET /v1/users/:userId/memory-facts', () => {
  it('returns 401 without API key', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/users/user_1/memory-facts',
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 401 with wrong API key', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/users/user_1/memory-facts',
      headers: authHeaders('wrong'),
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns empty facts for unknown user', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/users/missing/memory-facts',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ facts: unknown[] }>>()
    expect(body.error).toBeNull()
    expect(body.data?.facts).toEqual([])
  })

  it('returns facts for seeded user', async () => {
    const response = await makeApp([
      makeFact({ id: 'umf_1', key: 'language', value: 'English' }),
      makeFact({ id: 'umf_2', key: 'role', value: 'friend' }),
    ]).inject({
      method: 'GET',
      url: '/v1/users/user_1/memory-facts',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(200)
    const body =
      response.json<ApiResponse<{ facts: Array<{ id: string; key: string; value: string }> }>>()
    expect(body.error).toBeNull()
    expect(body.data?.facts).toHaveLength(2)
    expect(body.data?.facts[0]).toEqual(
      expect.objectContaining({ id: 'umf_1', key: 'language', value: 'English' }),
    )
    expect(body.data?.facts[1]).toEqual(
      expect.objectContaining({ id: 'umf_2', key: 'role', value: 'friend' }),
    )
  })
})

describe('DELETE /v1/users/:userId/memory-facts/:factId', () => {
  it('returns 401 without API key', async () => {
    const response = await makeApp().inject({
      method: 'DELETE',
      url: '/v1/users/user_1/memory-facts/umf_1',
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 404 for unknown factId', async () => {
    const response = await makeApp().inject({
      method: 'DELETE',
      url: '/v1/users/user_1/memory-facts/umf_unknown',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns 404 when fact belongs to a different user', async () => {
    const response = await makeApp([makeFact({ id: 'umf_2', userId: 'user_2' })]).inject({
      method: 'DELETE',
      url: '/v1/users/user_1/memory-facts/umf_2',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('deletes a valid fact', async () => {
    const app = makeApp([makeFact({ id: 'umf_ok' })])

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/users/user_1/memory-facts/umf_ok',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ factId: string; deleted: true }>>()
    expect(body.error).toBeNull()
    expect(body.data).toEqual({ factId: 'umf_ok', deleted: true })

    const listAfterDelete = await app.inject({
      method: 'GET',
      url: '/v1/users/user_1/memory-facts',
      headers: authHeaders(),
    })
    const listBody = listAfterDelete.json<ApiResponse<{ facts: unknown[] }>>()
    expect(listBody.data?.facts).toEqual([])
  })
})
