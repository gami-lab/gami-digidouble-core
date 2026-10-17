import { describe, expect, it, vi } from 'vitest'
import type { ILlmAdapter, LlmRequest } from '../../ports/ILlmAdapter.js'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import {
  PrepareScenarioAvatarTraitsUseCase,
  TRAIT_PREPARATION_MAX_TOKENS,
} from './prepare-scenario-avatar-traits.use-case.js'

const TIMESTAMP = '2026-07-20T00:00:00.000Z'
const CUT_OFF_JSON = '{\n  "identity": [\n    "Max Lorenzo, 55 ans, journaliste'

function createUseCase(outputTokens: number): {
  llm: ILlmAdapter & { requests: LlmRequest[] }
  useCase: PrepareScenarioAvatarTraitsUseCase
} {
  const requests: LlmRequest[] = []
  const llm = {
    requests,
    complete: vi.fn((request: LlmRequest) => {
      requests.push(request)
      return Promise.resolve({
        content: CUT_OFF_JSON,
        model: 'test-model',
        inputTokens: 10,
        outputTokens,
        latencyMs: 1,
      })
    }),
  }
  const useCase = new PrepareScenarioAvatarTraitsUseCase(
    new InMemoryScenarioRepository([
      {
        scenarioId: 'scenario_1',
        name: 'Scenario',
        status: 'active',
        objectives: [],
        worldContext: '',
        avatarAvailability: { initialAvatarIds: [] },
        config: {},
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ]),
    new InMemoryAvatarRepository([
      {
        avatarId: 'avatar_max',
        scenarioId: 'scenario_1',
        name: 'Max',
        status: 'active',
        personaPrompt: 'You are Max.',
        config: {},
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ]),
    new InMemoryKnowledgeSourceRepository(),
    llm,
  )
  return { llm, useCase }
}

describe('PrepareScenarioAvatarTraitsUseCase — output token budget', () => {
  it('reports output_truncated when the output stopped at the token cap', async () => {
    const { llm, useCase } = createUseCase(TRAIT_PREPARATION_MAX_TOKENS)

    const output = await useCase.execute({ scenarioId: 'scenario_1' })

    expect(llm.requests[0]?.maxTokens).toBe(TRAIT_PREPARATION_MAX_TOKENS)
    expect(output.results).toEqual([
      { avatarId: 'avatar_max', status: 'failed', reason: 'output_truncated' },
    ])
  })

  it('keeps unparseable_output when invalid output ended below the token cap', async () => {
    const { useCase } = createUseCase(120)

    const output = await useCase.execute({ scenarioId: 'scenario_1' })

    expect(output.results).toEqual([
      { avatarId: 'avatar_max', status: 'failed', reason: 'unparseable_output' },
    ])
  })
})
