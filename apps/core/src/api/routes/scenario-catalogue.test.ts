import { describe, expect, it } from 'vitest'
import type { ApiResponse, ListPublicScenariosResponse } from '@gami/shared'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

function makeScenario(overrides: Partial<Scenario>): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    language: 'en',
    objectives: ['secret objective'],
    worldContext: 'secret world context',
    avatarAvailability: { initialAvatarIds: [] },
    config: { goals: ['hidden goal'] },
    createdAt: '2026-10-18T10:00:00.000Z',
    updatedAt: '2026-10-18T10:00:00.000Z',
    ...overrides,
  }
}

function createCatalogueServer(): ReturnType<typeof createServer> {
  return createServer(TEST_CONFIG, {
    scenarioRepository: new InMemoryScenarioRepository([
      makeScenario({ scenarioId: 'scenario_active', name: 'Active' }),
      makeScenario({ scenarioId: 'scenario_draft', name: 'Draft', status: 'draft' }),
      makeScenario({ scenarioId: 'scenario_archived', name: 'Archived', status: 'archived' }),
    ]),
  })
}

describe('GET /v1/scenarios — public catalogue', () => {
  it('returns 401 without a credential', async () => {
    const response = await createCatalogueServer().inject({ method: 'GET', url: '/v1/scenarios' })

    expect(response.statusCode).toBe(401)
  })

  it('lists only active scenarios through the public projection', async () => {
    const response = await createCatalogueServer().inject({
      method: 'GET',
      url: '/v1/scenarios',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<ListPublicScenariosResponse>>()
    expect(body.data?.scenarios).toEqual([
      { scenarioId: 'scenario_active', name: 'Active', language: 'en' },
    ])
    expect(response.body).not.toContain('secret')
    expect(response.body).not.toContain('hidden')
  })

  it('does not accept authoring writes on the public path', async () => {
    const response = await createCatalogueServer().inject({
      method: 'POST',
      url: '/v1/scenarios',
      headers: { 'x-api-key': 'test-secret' },
      payload: { name: 'Demo' },
    })

    expect(response.statusCode).toBe(404)
  })
})
