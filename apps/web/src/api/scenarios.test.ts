import { describe, expect, it, vi } from 'vitest'
import { webRequest } from './client'
import { listAvailableScenarios } from './scenarios'

vi.mock('./client', () => ({
  webRequest: vi.fn(),
}))

describe('scenario catalogue api', () => {
  it('reads the public catalogue, which Core already limits to active scenarios', async () => {
    vi.mocked(webRequest).mockResolvedValue({
      scenarios: [{ scenarioId: 'scenario_a', name: 'Scenario A', language: 'en' }],
    })

    const scenarios = await listAvailableScenarios()

    expect(webRequest).toHaveBeenCalledWith('GET', '/v1/scenarios')
    expect(scenarios).toEqual([{ scenarioId: 'scenario_a', name: 'Scenario A', language: 'en' }])
  })
})
